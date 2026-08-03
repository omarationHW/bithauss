import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { logError } from "@/lib/log";

/* ------------------------------------------------------------------ */
/*  SEPOMEX catalog (server only)                                      */
/*                                                                     */
/*  The dataset lives as ~96 files in apps/web/data/sepomex/NN.json    */
/*  (NN = the 2-digit postal-code prefix) and is NEVER shipped to the  */
/*  client. This module is the single reader for every API route that  */
/*  needs it:                                                          */
/*                                                                     */
/*    - lookupPostal(cp)      -> record for one postal code            */
/*    - listMunicipios(state) -> municipios/ciudades of a state        */
/*    - searchColonias(...)   -> colonia search, optionally scoped     */
/*                                                                     */
/*  Caching strategy (all module-level, per server instance):          */
/*    - raw file text is cached on the first full scan (~5.5 MB) so    */
/*      name searches never hit the disk again;                        */
/*    - parsed prefixes and per-state indexes are kept in small LRUs   */
/*      so memory stays bounded no matter how many states are queried. */
/* ------------------------------------------------------------------ */

export interface PostalRecord {
  estado: string;
  municipio: string;
  ciudad: string;
  colonias: string[];
}

export interface MunicipioEntry {
  /** Municipio / alcaldía as written in the catalog. */
  municipio: string;
  /** Ciudad reported by SEPOMEX (may be empty or equal to the municipio). */
  ciudad: string;
}

export interface ColoniaEntry {
  colonia: string;
  municipio: string;
  ciudad: string;
  estado: string;
  /** Postal codes where this colonia appears (sorted, capped). */
  cps: string[];
}

type PrefixFile = Record<string, PostalRecord>;

/** Max postal codes reported per colonia (a colonia rarely has more). */
const MAX_CPS_PER_COLONIA = 12;
/** Parsed prefix files kept in memory at once. */
const PARSED_LRU_SIZE = 8;
/** Per-state indexes kept in memory at once. */
const STATE_LRU_SIZE = 6;

/**
 * Some rows carry the literal string "NULL" as the ciudad. Treat it (and any
 * blank) as "no city reported" so it never reaches the UI.
 */
function cleanCity(ciudad: string | null | undefined): string {
  const value = (ciudad ?? "").trim();
  return value && value.toUpperCase() !== "NULL" ? value : "";
}

/** Strip accents/case so "Polanco" matches "polanco" and "León" ~ "Leon". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* ------------------------------------------------------------------ */
/*  File access                                                        */
/* ------------------------------------------------------------------ */

let dataDirPromise: Promise<string | null> | null = null;

/**
 * Resolve the dataset directory. `next dev`/`next start` run with cwd at
 * the package root (apps/web) but the process may also be launched from
 * the monorepo root, so we probe both candidates once.
 */
function resolveDataDir(): Promise<string | null> {
  if (dataDirPromise) return dataDirPromise;
  dataDirPromise = (async () => {
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, "data", "sepomex"),
      path.join(cwd, "apps", "web", "data", "sepomex"),
    ];
    for (const dir of candidates) {
      try {
        const entries = await readdir(dir);
        if (entries.some((f) => /^\d{2}\.json$/.test(f))) return dir;
      } catch {
        // Not this candidate; keep probing.
      }
    }
    logError("sepomex: dataset directory not found", { candidates });
    return null;
  })();
  return dataDirPromise;
}

// prefix -> raw file text (populated by the full scan below)
const rawCache = new Map<string, string>();

async function readRaw(prefix: string): Promise<string | null> {
  const cached = rawCache.get(prefix);
  if (cached !== undefined) return cached;

  const dir = await resolveDataDir();
  if (!dir) return null;
  try {
    return await readFile(path.join(dir, `${prefix}.json`), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      logError("sepomex: failed reading prefix file", err);
    }
    return null;
  }
}

// prefix -> parsed file, bounded LRU (Map preserves insertion order)
const parsedCache = new Map<string, PrefixFile>();

async function loadPrefix(prefix: string): Promise<PrefixFile | null> {
  const cached = parsedCache.get(prefix);
  if (cached) {
    // Refresh recency.
    parsedCache.delete(prefix);
    parsedCache.set(prefix, cached);
    return cached;
  }

  const raw = await readRaw(prefix);
  if (!raw) return null;

  let parsed: PrefixFile;
  try {
    parsed = JSON.parse(raw) as PrefixFile;
  } catch (err) {
    logError("sepomex: invalid JSON in prefix file", err);
    return null;
  }

  parsedCache.set(prefix, parsed);
  if (parsedCache.size > PARSED_LRU_SIZE) {
    const oldest = parsedCache.keys().next().value;
    if (oldest !== undefined) parsedCache.delete(oldest);
  }
  return parsed;
}

/* ------------------------------------------------------------------ */
/*  Prefix -> estado index (built once)                                */
/* ------------------------------------------------------------------ */

interface PrefixIndex {
  /** All prefixes present on disk, sorted. */
  prefixes: string[];
  /** normalized estado -> { estado, prefixes } */
  byState: Map<string, { estado: string; prefixes: string[] }>;
}

let prefixIndexPromise: Promise<PrefixIndex> | null = null;

/**
 * Read every file once to learn which postal prefixes belong to which
 * state, caching the raw text along the way (it is reused by the global
 * colonia search, which greps the raw JSON before parsing anything).
 */
function buildPrefixIndex(): Promise<PrefixIndex> {
  if (prefixIndexPromise) return prefixIndexPromise;
  prefixIndexPromise = (async () => {
    const index: PrefixIndex = { prefixes: [], byState: new Map() };
    const dir = await resolveDataDir();
    if (!dir) return index;

    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => /^\d{2}\.json$/.test(f));
    } catch (err) {
      logError("sepomex: failed listing dataset directory", err);
      return index;
    }
    files.sort();

    const estadoRe = /"estado":"((?:[^"\\]|\\.)*)"/g;
    for (const file of files) {
      const prefix = file.slice(0, 2);
      let raw: string;
      try {
        raw = await readFile(path.join(dir, file), "utf8");
      } catch (err) {
        logError("sepomex: failed reading prefix file", err);
        continue;
      }
      rawCache.set(prefix, raw);
      index.prefixes.push(prefix);

      const states = new Set<string>();
      estadoRe.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = estadoRe.exec(raw)) !== null) {
        if (match[1]) states.add(match[1]);
      }

      for (const estado of states) {
        const key = normalizeText(estado);
        const entry = index.byState.get(key);
        if (entry) entry.prefixes.push(prefix);
        else index.byState.set(key, { estado, prefixes: [prefix] });
      }
    }
    return index;
  })();
  return prefixIndexPromise;
}

/** Canonical state names present in the dataset, alphabetically sorted. */
export async function listEstados(): Promise<string[]> {
  const index = await buildPrefixIndex();
  return [...index.byState.values()]
    .map((e) => e.estado)
    .sort((a, b) => a.localeCompare(b, "es"));
}

/* ------------------------------------------------------------------ */
/*  Per-state index                                                    */
/* ------------------------------------------------------------------ */

interface StateIndex {
  estado: string;
  municipios: MunicipioEntry[];
  /** normalized municipio -> colonias of that municipio */
  colonias: Map<string, ColoniaEntry[]>;
}

const stateCache = new Map<string, StateIndex>();

async function getStateIndex(estado: string): Promise<StateIndex | null> {
  const key = normalizeText(estado);
  if (!key) return null;

  const cached = stateCache.get(key);
  if (cached) {
    stateCache.delete(key);
    stateCache.set(key, cached);
    return cached;
  }

  const index = await buildPrefixIndex();
  const entry = index.byState.get(key);
  if (!entry) return null;

  const municipios = new Map<string, MunicipioEntry>();
  const colonias = new Map<string, Map<string, ColoniaEntry>>();

  for (const prefix of entry.prefixes) {
    const file = await loadPrefix(prefix);
    if (!file) continue;
    for (const [cp, record] of Object.entries(file)) {
      if (normalizeText(record.estado) !== key) continue;
      const munKey = normalizeText(record.municipio);
      if (!munKey) continue;

      const existing = municipios.get(munKey);
      if (!existing) {
        municipios.set(munKey, {
          municipio: record.municipio,
          ciudad: cleanCity(record.ciudad),
        });
      } else if (!existing.ciudad) {
        existing.ciudad = cleanCity(record.ciudad);
      }

      let bucket = colonias.get(munKey);
      if (!bucket) {
        bucket = new Map<string, ColoniaEntry>();
        colonias.set(munKey, bucket);
      }
      for (const colonia of record.colonias) {
        const colKey = normalizeText(colonia);
        if (!colKey) continue;
        const hit = bucket.get(colKey);
        if (hit) {
          if (hit.cps.length < MAX_CPS_PER_COLONIA && !hit.cps.includes(cp)) {
            hit.cps.push(cp);
          }
        } else {
          bucket.set(colKey, {
            colonia,
            municipio: record.municipio,
            ciudad: cleanCity(record.ciudad),
            estado: record.estado,
            cps: [cp],
          });
        }
      }
    }
  }

  const built: StateIndex = {
    estado: entry.estado,
    municipios: [...municipios.values()].sort((a, b) =>
      a.municipio.localeCompare(b.municipio, "es")
    ),
    colonias: new Map(
      [...colonias.entries()].map(([munKey, bucket]) => [
        munKey,
        [...bucket.values()].sort((a, b) =>
          a.colonia.localeCompare(b.colonia, "es")
        ),
      ])
    ),
  };

  stateCache.set(key, built);
  if (stateCache.size > STATE_LRU_SIZE) {
    const oldest = stateCache.keys().next().value;
    if (oldest !== undefined) stateCache.delete(oldest);
  }
  return built;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Resolve a single 5-digit postal code. */
export async function lookupPostal(cp: string): Promise<PostalRecord | null> {
  if (!/^\d{5}$/.test(cp)) return null;
  const file = await loadPrefix(cp.slice(0, 2));
  const record = file?.[cp];
  if (!record) return null;
  return { ...record, ciudad: cleanCity(record.ciudad) };
}

/**
 * Municipios (alcaldías) of a state, optionally filtered by a name query.
 * Returns an empty array when the state is unknown to the catalog.
 */
export async function listMunicipios(
  estado: string,
  query = "",
  limit = 600
): Promise<MunicipioEntry[]> {
  const index = await getStateIndex(estado);
  if (!index) return [];
  const q = normalizeText(query);
  if (!q) return index.municipios.slice(0, limit);
  return index.municipios
    .filter((m) => normalizeText(m.municipio).includes(q))
    .sort(
      (a, b) =>
        rank(normalizeText(a.municipio), q) - rank(normalizeText(b.municipio), q)
    )
    .slice(0, limit);
}

/** 0 = exact, 1 = prefix, 2 = word start, 3 = anywhere. */
function rank(candidate: string, q: string): number {
  if (candidate === q) return 0;
  if (candidate.startsWith(q)) return 1;
  if (candidate.includes(` ${q}`)) return 2;
  return 3;
}

export interface SearchColoniasParams {
  /** Scope the search to a state (strongly recommended). */
  estado?: string;
  /** Scope the search to a municipio inside `estado`. */
  municipio?: string;
  /** Free-text colonia query (accent/case insensitive). */
  q?: string;
  limit?: number;
}

/**
 * Search colonias. With `estado` (and optionally `municipio`) the search is
 * scoped to that state index. Without a state it falls back to a country-wide
 * search that greps the raw JSON before parsing, so an ambiguous name like
 * "Polanco" returns one entry per municipio/estado where it exists — which is
 * what lets the UI disambiguate it.
 */
export async function searchColonias({
  estado,
  municipio,
  q = "",
  limit = 20,
}: SearchColoniasParams): Promise<ColoniaEntry[]> {
  const query = normalizeText(q);
  const cap = Math.min(Math.max(limit, 1), 100);

  if (estado) {
    const index = await getStateIndex(estado);
    if (!index) return [];

    const buckets = municipio
      ? [index.colonias.get(normalizeText(municipio)) ?? []]
      : [...index.colonias.values()];

    const hits: ColoniaEntry[] = [];
    for (const bucket of buckets) {
      for (const entry of bucket) {
        if (query && !normalizeText(entry.colonia).includes(query)) continue;
        hits.push(entry);
        // Without a query we only need the head of the (already sorted) list.
        if (!query && hits.length >= cap * 4) break;
      }
      if (!query && hits.length >= cap * 4) break;
    }
    return sortHits(hits, query).slice(0, cap);
  }

  // Country-wide search: require enough characters to keep it cheap.
  if (query.length < 3) return [];

  const index = await buildPrefixIndex();
  const probe = buildLooseRegex(query);
  // key = colonia|municipio|estado, so the same colonia in two states stays
  // as two distinct (disambiguable) results.
  const hits = new Map<string, ColoniaEntry>();

  for (const prefix of index.prefixes) {
    const raw = rawCache.get(prefix);
    if (!raw || !probe.test(raw)) continue;

    const file = await loadPrefix(prefix);
    if (!file) continue;
    for (const [cp, record] of Object.entries(file)) {
      for (const colonia of record.colonias) {
        if (!normalizeText(colonia).includes(query)) continue;
        const key = `${normalizeText(colonia)}|${normalizeText(
          record.municipio
        )}|${normalizeText(record.estado)}`;
        const existing = hits.get(key);
        if (existing) {
          if (existing.cps.length < MAX_CPS_PER_COLONIA) existing.cps.push(cp);
          continue;
        }
        hits.set(key, {
          colonia,
          municipio: record.municipio,
          ciudad: cleanCity(record.ciudad),
          estado: record.estado,
          cps: [cp],
        });
      }
    }
    // Enough candidates to rank without scanning the rest of the country.
    if (hits.size >= cap * 5) break;
  }

  return sortHits([...hits.values()], query).slice(0, cap);
}

function sortHits(hits: ColoniaEntry[], query: string): ColoniaEntry[] {
  if (!query) return hits;
  return hits.sort((a, b) => {
    const diff =
      rank(normalizeText(a.colonia), query) -
      rank(normalizeText(b.colonia), query);
    if (diff !== 0) return diff;
    const byColonia = a.colonia.localeCompare(b.colonia, "es");
    if (byColonia !== 0) return byColonia;
    return a.municipio.localeCompare(b.municipio, "es");
  });
}

/**
 * Build an accent-tolerant regex used to grep the raw JSON: the dataset keeps
 * accents ("Peñón") while queries usually don't ("penon"), so every vowel and
 * "n" also matches its accented variants.
 */
function buildLooseRegex(query: string): RegExp {
  const variants: Record<string, string> = {
    a: "aáàä",
    e: "eéèë",
    i: "iíìï",
    o: "oóòö",
    u: "uúùü",
    n: "nñ",
    c: "cç",
  };
  const source = query
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .split("")
    .map((ch) => {
      const set = variants[ch];
      return set ? `[${set}]` : ch;
    })
    .join("");
  return new RegExp(source, "i");
}
