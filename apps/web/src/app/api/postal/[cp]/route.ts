import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logError } from "@/lib/log";

export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/*  SEPOMEX postal-code API                                            */
/*                                                                     */
/*  The catalog lives as files in apps/web/data/sepomex/<2digits>.json */
/*  (NOT in the client bundle). We read the relevant prefix file with  */
/*  fs and cache the parsed object in a module-level Map so repeated   */
/*  requests for the same prefix never re-read from disk.              */
/* ------------------------------------------------------------------ */

interface PostalRecord {
  estado: string;
  municipio: string;
  ciudad: string;
  colonias: string[];
}

type PrefixFile = Record<string, PostalRecord>;

// prefix (2 digits) -> parsed file (or null when the file does not exist)
const cache = new Map<string, PrefixFile | null>();

/**
 * Resolve the data directory. `next dev`/`next start` run with cwd at the
 * package root (apps/web), but if launched from the monorepo root the data
 * lives under apps/web/data — so we probe both candidates.
 */
function dataCandidates(prefix: string): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "data", "sepomex", `${prefix}.json`),
    path.join(cwd, "apps", "web", "data", "sepomex", `${prefix}.json`),
  ];
}

async function loadPrefix(prefix: string): Promise<PrefixFile | null> {
  if (cache.has(prefix)) return cache.get(prefix) ?? null;

  let parsed: PrefixFile | null = null;
  for (const file of dataCandidates(prefix)) {
    try {
      const raw = await readFile(file, "utf8");
      parsed = JSON.parse(raw) as PrefixFile;
      break;
    } catch (err) {
      // ENOENT just means this candidate path isn't the right one; keep trying.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logError("postal: failed reading prefix file", err);
      }
    }
  }

  cache.set(prefix, parsed);
  return parsed;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cp: string }> }
) {
  const { cp } = await params;

  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json(
      { error: "El código postal debe tener 5 dígitos." },
      { status: 400 }
    );
  }

  const prefix = cp.slice(0, 2);
  const file = await loadPrefix(prefix);
  const record = file?.[cp];

  if (!record) {
    return NextResponse.json(
      { error: "Código postal no encontrado." },
      { status: 404 }
    );
  }

  // CPs don't change; let the browser/CDN cache aggressively.
  return NextResponse.json(record, {
    headers: { "Cache-Control": "public, max-age=86400, immutable" },
  });
}
