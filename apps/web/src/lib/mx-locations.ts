"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Mexican location catalog (client helper)                           */
/*                                                                     */
/*  Thin client over /api/localidades/*, which serves the SEPOMEX      */
/*  catalog that lives on the server. Nothing here embeds the dataset: */
/*  every list is fetched on demand, cached in memory and debounced.   */
/* ------------------------------------------------------------------ */

/** Canonical state names — the exact strings stored in `properties.state`. */
export const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

export type MexicanState = (typeof MEXICAN_STATES)[number];

export interface MunicipioOption {
  municipio: string;
  ciudad: string;
}

export interface ColoniaOption {
  colonia: string;
  municipio: string;
  ciudad: string;
  estado: string;
  cps: string[];
}

/** Strip accents/case so "Polanco" matches "polanco" and "León" ~ "Leon". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** True when `value` is one of the canonical state names. */
export function isCanonicalState(value: string): boolean {
  const key = normalizeText(value);
  return (MEXICAN_STATES as readonly string[]).some(
    (s) => normalizeText(s) === key
  );
}

/** Canonical state name for a loosely written one ("cdmx" style input aside). */
export function toCanonicalState(value: string): string | null {
  const key = normalizeText(value);
  return (
    (MEXICAN_STATES as readonly string[]).find(
      (s) => normalizeText(s) === key
    ) ?? null
  );
}

/**
 * "Miguel Hidalgo, Ciudad de México" — the label that disambiguates a colonia
 * whose name exists in several places (Polanco, Centro, Del Valle...).
 */
export function locationHint(option: {
  municipio: string;
  ciudad?: string;
  estado: string;
}): string {
  const parts = [option.municipio];
  if (
    option.ciudad &&
    normalizeText(option.ciudad) !== normalizeText(option.municipio) &&
    normalizeText(option.ciudad) !== normalizeText(option.estado)
  ) {
    parts.push(option.ciudad);
  }
  parts.push(option.estado);
  return parts.filter(Boolean).join(", ");
}

/* ------------------------------------------------------------------ */
/*  Fetch helpers (with a small in-memory cache)                       */
/* ------------------------------------------------------------------ */

const MAX_CACHE_ENTRIES = 60;
const responseCache = new Map<string, unknown>();

async function fetchCached<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const cached = responseCache.get(url) as T | undefined;
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    responseCache.set(url, data);
    if (responseCache.size > MAX_CACHE_ENTRIES) {
      const oldest = responseCache.keys().next().value;
      if (oldest !== undefined) responseCache.delete(oldest);
    }
    return data;
  } catch {
    // Aborted or offline: callers fall back to whatever they already have.
    return null;
  }
}

/** Municipios / alcaldías of a state. Empty array when unknown or offline. */
export async function fetchMunicipios(
  estado: string,
  signal?: AbortSignal
): Promise<MunicipioOption[]> {
  if (!estado) return [];
  const data = await fetchCached<{ municipios: MunicipioOption[] }>(
    `/api/localidades/municipios?estado=${encodeURIComponent(estado)}`,
    signal
  );
  return data?.municipios ?? [];
}

export interface ColoniaQuery {
  estado?: string;
  municipio?: string;
  q?: string;
  limit?: number;
}

/** Colonia catalog search, optionally scoped to a state/municipio. */
export async function fetchColonias(
  { estado = "", municipio = "", q = "", limit = 20 }: ColoniaQuery,
  signal?: AbortSignal
): Promise<ColoniaOption[]> {
  if (!estado && normalizeText(q).length < 3) return [];
  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (municipio) params.set("municipio", municipio);
  if (q) params.set("q", q);
  params.set("limit", String(limit));
  const data = await fetchCached<{ colonias: ColoniaOption[] }>(
    `/api/localidades/colonias?${params.toString()}`,
    signal
  );
  return data?.colonias ?? [];
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

/** Municipios of a state, refetched whenever the state changes. */
export function useMunicipios(estado: string): {
  municipios: MunicipioOption[];
  loading: boolean;
  /** False until the first response for the current state has arrived. */
  loaded: boolean;
} {
  const [municipios, setMunicipios] = useState<MunicipioOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!estado) {
      setMunicipios([]);
      setLoading(false);
      setLoaded(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setLoaded(false);

    fetchMunicipios(estado, controller.signal).then((list) => {
      if (cancelled) return;
      setMunicipios(list);
      setLoading(false);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [estado]);

  return { municipios, loading, loaded };
}

/** Debounce a value so typing doesn't fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface ColoniaSearchOptions extends ColoniaQuery {
  /** Set to false to skip the request entirely (e.g. free-text mode). */
  enabled?: boolean;
}

/**
 * Debounced colonia search. Without `estado` the API performs a country-wide
 * lookup (min. 3 characters) whose results carry their municipio/estado, which
 * is what lets the UI show "Polanco — Miguel Hidalgo, Ciudad de México".
 */
export function useColoniaSearch({
  estado = "",
  municipio = "",
  q = "",
  limit = 20,
  enabled = true,
}: ColoniaSearchOptions): { colonias: ColoniaOption[]; loading: boolean } {
  const [colonias, setColonias] = useState<ColoniaOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(q);

  const active =
    enabled && (Boolean(estado) || normalizeText(debouncedQuery).length >= 3);

  useEffect(() => {
    if (!active) {
      setColonias([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    fetchColonias(
      { estado, municipio, q: debouncedQuery, limit },
      controller.signal
    ).then((list) => {
      if (cancelled) return;
      setColonias(list);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, estado, municipio, debouncedQuery, limit]);

  return { colonias, loading };
}

/**
 * Verify that a colonia written by hand (or loaded from an old listing)
 * actually exists in the catalog for the given estado/municipio. Returns
 * `null` while unknown (loading/offline) so callers can fail open.
 */
export function useColoniaValidity(
  estado: string,
  municipio: string,
  colonia: string,
  knownColonias: string[]
): boolean | null {
  const [valid, setValid] = useState<boolean | null>(null);
  const known = useMemo(
    () => knownColonias.map((c) => normalizeText(c)),
    [knownColonias]
  );
  const knownKey = known.join("|");
  const lastRef = useRef("");

  useEffect(() => {
    const target = normalizeText(colonia);
    if (!target) {
      setValid(true);
      return;
    }
    if (known.includes(target)) {
      setValid(true);
      return;
    }
    if (!estado) {
      setValid(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const requestKey = `${estado}|${municipio}|${target}`;
    lastRef.current = requestKey;
    setValid(null);

    fetchColonias(
      { estado, municipio, q: colonia, limit: 25 },
      controller.signal
    ).then((list) => {
      if (cancelled || lastRef.current !== requestKey) return;
      setValid(list.some((c) => normalizeText(c.colonia) === target));
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `knownKey` stands in for the array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, municipio, colonia, knownKey]);

  return valid;
}
