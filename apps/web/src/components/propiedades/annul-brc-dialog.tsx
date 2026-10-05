"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Anular el BRC para poder editar el inmueble (migración 041)        */
/*                                                                     */
/*  With a valid BRC the property is frozen. Editing means annulling   */
/*  the certificate: it verifies as REVOCADO from then on and the      */
/*  certification starts over from scratch.                            */
/* ------------------------------------------------------------------ */

export interface AnnulBrcDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onAnnulled: () => void;
}

export function AnnulBrcDialog({
  open,
  onOpenChange,
  propertyId,
  onAnnulled,
}: AnnulBrcDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const [annulling, setAnnulling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (annulling) return;
    if (!next) {
      setUnderstood(false);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleAnnul() {
    setAnnulling(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("annul_property_brc", {
      p_property_id: propertyId,
    });
    setAnnulling(false);
    if (rpcError) {
      setError(rpcError.message || "No se pudo anular el BRC. Intenta de nuevo.");
      return;
    }
    setUnderstood(false);
    onOpenChange(false);
    onAnnulled();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            ¿Anular el BRC para editar?
          </DialogTitle>
          <DialogDescription className="text-left text-gray-600">
            Este inmueble tiene un Certificado BRC vigente. Mientras lo esté,
            su información no puede modificarse.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-700">
          <li>
            El certificado quedará <strong>anulado</strong> de inmediato: al
            verificarlo (QR o enlace) aparecerá como revocado.
          </li>
          <li>El inmueble perderá la insignia de Certificado BRC.</li>
          <li>
            Para volver a certificarlo tendrás que hacer el proceso{" "}
            <strong>desde cero</strong>: nueva solicitud, documentos, revisión
            notarial y pago.
          </li>
          <li>Esta acción no se puede deshacer.</li>
        </ul>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
          />
          Entiendo que el BRC quedará anulado y que tendré que certificar el
          inmueble de nuevo.
        </label>

        {error && <p className="text-sm font-medium text-red-700">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={annulling}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Conservar el BRC
          </button>
          <button
            type="button"
            onClick={handleAnnul}
            disabled={!understood || annulling}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {annulling && <Loader2 className="h-4 w-4 animate-spin" />}
            Anular BRC y editar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
