"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useOnboardingProgress } from "./first-steps-checklist";

/** Marca de sesión del navegador: la pregunta se hace una sola vez por sesión. */
const SESSION_KEY = "bh:onboarding:reoffer-dismissed";

function wasOfferedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return true; // sin sessionStorage (modo privado estricto) preferimos no insistir
  }
}

function markOfferedThisSession() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignorar */
  }
}

/**
 * Si el usuario ya pasó por la bienvenida y terminó (o saltó) el recorrido del
 * panel pero sigue sin propiedades, al volver al dashboard le ofrecemos ver el
 * tutorial otra vez. Se decide al montar (no reacciona a cambios posteriores)
 * para no saltar justo después de cerrar la bienvenida o terminar el recorrido.
 */
export function TourReoffer({ userId }: { userId: string }) {
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const welcomeSeen = useOnboardingStore((s) => s.state.welcomeSeen);
  const dashboardTourDone = useOnboardingStore((s) => Boolean(s.state.tours.dashboard));
  const activeTour = useOnboardingStore((s) => s.activeTour);

  /** null = aún sin decidir; true = candidato a mostrarse en este montaje. */
  const [candidate, setCandidate] = useState<boolean | null>(null);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current || !hydrated) return;
    decidedRef.current = true;
    setCandidate(
      welcomeSeen && dashboardTourDone && !activeTour && !wasOfferedThisSession(),
    );
  }, [hydrated, welcomeSeen, dashboardTourDone, activeTour]);

  const progress = useOnboardingProgress(userId, { enabled: candidate === true });

  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  useEffect(() => {
    if (shownRef.current || candidate !== true || !progress) return;
    if (progress.propertyCount !== 0) return;
    shownRef.current = true;
    markOfferedThisSession();
    setOpen(true);
  }, [candidate, progress]);

  // Si arranca un recorrido por otra vía (p.ej. "Ver guía de inicio"), cerramos.
  useEffect(() => {
    if (activeTour) setOpen(false);
  }, [activeTour]);

  const handleStart = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => useOnboardingStore.getState().startTour("dashboard"), 250);
  }, []);

  const handleDismiss = useCallback(() => setOpen(false), []);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-gray-200/70 p-0 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_32px_64px_-24px_rgba(15,23,42,0.4)]">
        <div className="relative px-6 pb-2 pt-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(221 83% 53% / 0.18), transparent 70%)" }}
          />
          <div className="relative mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Compass className="h-5 w-5" aria-hidden />
          </div>
          <DialogTitle
            className="relative text-xl font-bold leading-tight text-gray-900"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            ¿Quieres volver a ver el tutorial?
          </DialogTitle>
          <DialogDescription className="relative mt-2 text-[15px] leading-relaxed text-gray-500">
            Aún no tienes propiedades publicadas. En un minuto te mostramos dónde
            está cada cosa para que publiques la primera.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-2 px-6 pb-6 pt-4 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleStart}
            className="h-11 flex-1 rounded-xl px-5 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
            style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
          >
            Ver tutorial
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="h-11 rounded-xl px-5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Ahora no
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
