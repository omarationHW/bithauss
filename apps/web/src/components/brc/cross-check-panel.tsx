"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, MinusCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Validación cruzada del expediente                                  */
/*                                                                     */
/*  The 18 escritura rules plus the captured-address checks, computed  */
/*  by the API over the documents stored in the expediente. Shown to  */
/*  the notary / operator / admin; the Certificado Notarial cannot be */
/*  issued with failures unless the notary justifies them.            */
/* ------------------------------------------------------------------ */

export interface CrossCheckItem {
  rule: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
}

interface CrossCheckResponse {
  checks: CrossCheckItem[];
  summary: { pass: number; fail: number; warn: number; skip: number };
  missing_escritura?: boolean;
}

const ORDER: Record<CrossCheckItem["status"], number> = { fail: 0, warn: 1, pass: 2, skip: 3 };

const STYLE: Record<CrossCheckItem["status"], { icon: typeof XCircle; cls: string; label: string }> = {
  fail: { icon: XCircle, cls: "text-red-600", label: "No coincide" },
  warn: { icon: AlertTriangle, cls: "text-amber-600", label: "Revisar" },
  pass: { icon: CheckCircle2, cls: "text-emerald-600", label: "Coincide" },
  skip: { icon: MinusCircle, cls: "text-gray-400", label: "Sin datos" },
};

/** Orders failures first; exported for tests. */
export function sortChecks(checks: CrossCheckItem[]): CrossCheckItem[] {
  return [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}

export function CrossCheckPanel({
  expedienteId,
  refreshKey = 0,
}: {
  expedienteId: string;
  /** Bump it after OCR corrections or re-uploads to recompute. */
  refreshKey?: number;
}) {
  const [data, setData] = useState<CrossCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${apiBase}/api/v1/brc/expedientes/${expedienteId}/cross-check`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as CrossCheckResponse;
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("No se pudo calcular la validación cruzada.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [expedienteId, refreshKey]);

  const sorted = data ? sortChecks(data.checks) : [];
  const relevant = sorted.filter((c) => c.status === "fail" || c.status === "warn");
  const visible = showAll ? sorted : relevant;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: "Barlow, Inter, sans-serif" }}>
            Validación cruzada de documentos
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Escritura contra identificación, predial, agua, folio real y la dirección capturada del inmueble.
          </p>
        </div>
        {data && !data.missing_escritura && (
          <div className="flex gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">{data.summary.fail} no coinciden</span>
            <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-700">{data.summary.warn} revisar</span>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">{data.summary.pass} coinciden</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
          </p>
        )}
        {!loading && error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && data?.missing_escritura && (
          <p className="text-sm text-gray-500">Aún no hay escritura en el expediente: no hay nada que comparar.</p>
        )}
        {!loading && data && !data.missing_escritura && (
          <>
            {relevant.length === 0 && !showAll && (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Sin diferencias entre los documentos.
              </p>
            )}
            <ul className="space-y-2">
              {visible.map((c) => {
                const s = STYLE[c.status];
                const Icon = s.icon;
                return (
                  <li key={c.rule} className="flex items-start gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.cls}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{c.label}</p>
                      <p className="break-words text-xs text-gray-600">{c.message}</p>
                    </div>
                    <span className={`ml-auto shrink-0 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
            {sorted.length > relevant.length && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                {showAll ? "Ver solo diferencias" : `Ver las ${sorted.length} comprobaciones`}
              </button>
            )}
            {data.summary.fail > 0 && (
              <p className="mt-3 text-xs text-red-700">
                Para emitir el Certificado Notarial, corrige los datos del OCR del documento que esté mal leído
                o justifica por qué se emite de todos modos (queda registrado en el expediente).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
