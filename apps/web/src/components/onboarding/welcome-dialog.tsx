"use client";

import { Building2, FileCheck2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldBrc } from "@/components/ui/shield-brc";

interface WelcomeDialogProps {
  open: boolean;
  firstName: string;
  onStartTour: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    icon: Building2,
    title: "Publica tu propiedad",
    body: "Un formulario guiado, unos 5 minutos.",
  },
  {
    icon: ShieldBrc,
    title: "Certifícala con BRC",
    body: "Sube los documentos y un notario la valida.",
  },
  {
    icon: FileCheck2,
    title: "Vende con confianza",
    body: "Los compradores ven tu certificado y te contactan.",
  },
];

/** Primer contacto de un usuario nuevo con el panel. */
export function WelcomeDialog({ open, firstName, onStartTour, onSkip }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl border-gray-200/70 p-0 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_32px_64px_-24px_rgba(15,23,42,0.4)] sm:max-w-lg">
        {/* Cabecera: halo suave de marca detrás del icono, sin bloques ni líneas de color. */}
        <div className="relative px-6 pb-2 pt-8 sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(221 83% 53% / 0.18), transparent 70%)" }}
          />
          <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle
            className="relative text-2xl font-bold leading-tight text-gray-900"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            {firstName ? `¡Bienvenido, ${firstName}!` : "¡Bienvenido a BitHauss!"}
          </DialogTitle>
          <DialogDescription className="relative mt-2 text-[15px] leading-relaxed text-gray-500">
            Tu cuenta está lista. Estos son los tres pasos para vender con la
            certificación BRC.
          </DialogDescription>
        </div>

        <ol className="space-y-2 px-6 py-5 sm:px-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-4 rounded-xl bg-gray-50/80 px-4 py-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                <s.icon className="h-5 w-5" aria-hidden />
                <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="text-sm text-gray-500">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-2 px-6 pb-6 pt-1 sm:flex-row-reverse sm:px-8">
          <button
            type="button"
            onClick={onStartTour}
            className="h-11 flex-1 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
            style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
          >
            Empezar recorrido · 1 min
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="h-11 rounded-xl px-5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Explorar por mi cuenta
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
