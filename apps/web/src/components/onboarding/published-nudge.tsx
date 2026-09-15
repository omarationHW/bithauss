"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, PartyPopper, X } from "lucide-react";
import { ShieldBrc } from "@/components/ui/shield-brc";

/**
 * Banner que aparece en "Mis Propiedades" justo después de publicar
 * (`?publicada=<id>`): celebra y lleva al siguiente paso, la certificación.
 * Lee el parámetro en cliente para no exigir un Suspense por useSearchParams.
 */
export function PublishedNudge() {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("publicada");
    if (!id) return;
    setPropertyId(id);
    // Limpia la URL para que un refresh no vuelva a mostrar el banner.
    router.replace("/dashboard/propiedades", { scroll: false });
  }, [router]);

  if (!propertyId) return null;

  return (
    <div
      role="status"
      className="relative overflow-hidden rounded-2xl bg-emerald-50/80 p-5 ring-1 ring-emerald-100/80 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
          <PartyPopper className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            ¡Tu propiedad ya está publicada!
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
            Siguiente paso: certifícala con BRC. Un notario valida la
            documentación y tu anuncio muestra el sello que da confianza a
            los compradores.
          </p>
        </div>
        <Link
          href={`/dashboard/propiedades/${propertyId}/solicitar-brc`}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
          style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
        >
          <ShieldBrc className="h-4 w-4" aria-hidden />
          Certificar ahora
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setPropertyId(null)}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-white hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        aria-label="Cerrar aviso"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
