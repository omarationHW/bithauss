"use client";

import Link from "next/link";
import { Construction } from "lucide-react";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <Construction className="h-12 w-12 text-gray-300 mb-4" />
      <h2
        className="text-xl font-bold text-gray-900"
        style={{ fontFamily: "Barlow, Inter, sans-serif" }}
      >
        Próximamente
      </h2>
      <p className="mt-2 text-sm text-gray-500 text-center max-w-sm">
        Esta sección está en desarrollo y estará disponible pronto.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
        style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}
