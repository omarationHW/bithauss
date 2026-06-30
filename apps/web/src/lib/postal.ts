"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  SEPOMEX postal-code lookup (client helper)                        */
/* ------------------------------------------------------------------ */

/** A resolved record for a 5-digit Mexican postal code. */
export interface PostalRecord {
  estado: string;
  municipio: string;
  ciudad: string;
  colonias: string[];
}

/** Sentinel <select> value for the "type my own colonia" option. */
export const COLONIA_OTRA = "__OTRA__";

/**
 * Canonical state names used by the property forms (MEXICAN_STATES). The
 * dataset is already normalized to these on generation, but we keep this
 * map as a defensive fallback in case a raw SEPOMEX name slips through.
 */
const STATE_ALIASES: Record<string, string> = {
  "Coahuila de Zaragoza": "Coahuila",
  "Michoacán de Ocampo": "Michoacán",
  "Veracruz de Ignacio de la Llave": "Veracruz",
  México: "Estado de México",
};

/**
 * Map a dataset/raw state name to the canonical value expected by the
 * <Select> options. Returns the input unchanged when no alias applies.
 */
export function normalizeStateName(estado: string): string {
  return STATE_ALIASES[estado] ?? estado;
}

/**
 * Fetch the SEPOMEX record for a 5-digit postal code from our API route.
 * Returns null when the CP is invalid, not found, or the request fails
 * (callers fall back to free-text input).
 */
export async function fetchPostalRecord(
  cp: string,
  signal?: AbortSignal
): Promise<PostalRecord | null> {
  if (!/^\d{5}$/.test(cp)) return null;
  try {
    const res = await fetch(`/api/postal/${cp}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as PostalRecord;
    if (!data || !Array.isArray(data.colonias)) return null;
    return { ...data, estado: normalizeStateName(data.estado) };
  } catch {
    return null;
  }
}

/**
 * Watch a postal-code value and resolve its SEPOMEX record. Returns the
 * list of colonias (for a dropdown) and a loading flag. `onResolve` is
 * invoked with the record (or null) whenever a 5-digit CP resolves; it is
 * read via a ref so changing the callback identity never re-triggers a fetch.
 */
export function usePostalLookup(
  cp: string,
  onResolve: (record: PostalRecord | null) => void
): { colonias: string[]; loading: boolean } {
  const [colonias, setColonias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const cbRef = useRef(onResolve);
  cbRef.current = onResolve;

  useEffect(() => {
    if (!/^\d{5}$/.test(cp)) {
      setColonias([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    fetchPostalRecord(cp, controller.signal)
      .then((record) => {
        if (cancelled) return;
        setColonias(record?.colonias ?? []);
        cbRef.current(record);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cp]);

  return { colonias, loading };
}
