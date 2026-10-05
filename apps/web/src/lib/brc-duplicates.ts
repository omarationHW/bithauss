import type { SupabaseClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/*  Documentos ya usados en otro inmueble (migración 042)              */
/*                                                                     */
/*  The database blocks the submission and the issuance; this only     */
/*  tells the user earlier, with the same wording. It never names the  */
/*  other property.                                                    */
/* ------------------------------------------------------------------ */

export interface BrcDuplicate {
  kind: "FOLIO_REAL" | "CUENTA_PREDIAL" | "ESCRITURA" | "ARCHIVO" | string;
  document_name: string;
}

function label(d: BrcDuplicate): string {
  switch (d.kind) {
    case "FOLIO_REAL":
      return "el folio real";
    case "CUENTA_PREDIAL":
      return "la cuenta predial";
    case "ESCRITURA":
      return "la escritura (mismo número y notaría)";
    default:
      return `el archivo de «${d.document_name}»`;
  }
}

/** Spanish explanation, or null when there is nothing duplicated. */
export function describeBrcDuplicates(rows: BrcDuplicate[]): string | null {
  if (rows.length === 0) return null;
  const parts = [...new Set(rows.map(label))];
  return (
    `${parts.join(", ")} ya está registrado en otro inmueble con una ` +
    "certificación en proceso o vigente. Un inmueble solo puede certificarse " +
    "una vez. Si eres el propietario legítimo, contacta a soporte de BitHauss."
  ).replace(/^./, (c) => c.toUpperCase());
}

/**
 * Duplicates of one expediente, or [] when the check is unavailable (e.g.
 * migration 042 not applied yet): the database still enforces the rule.
 */
export async function fetchBrcDuplicates(
  supabase: SupabaseClient,
  expedienteId: string,
): Promise<BrcDuplicate[]> {
  const { data, error } = await supabase.rpc("brc_expediente_duplicates", {
    p_expediente_id: expedienteId,
  });
  if (error || !Array.isArray(data)) return [];
  return data as BrcDuplicate[];
}
