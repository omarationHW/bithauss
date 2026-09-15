"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/app/dashboard/_context/user-context";
import { createClient } from "@/lib/supabase/client";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { getTourSteps, tourForPath, type TourContext } from "@/lib/onboarding/tours";
import { isOnboardingRole, type TourId } from "@/lib/onboarding/types";
import { Tour } from "./tour";
import { WelcomeDialog } from "./welcome-dialog";

/** Pequeña pausa para que la pantalla termine de montar antes de resaltarla. */
const AUTO_START_DELAY_MS = 700;

/**
 * Decide qué mostrar al usuario nuevo en cada ruta del panel: bienvenida la
 * primera vez, y luego un recorrido por pantalla la primera vez que la visita.
 * Los pasos se anclan a atributos `data-tour` (ver lib/onboarding/tours.ts).
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const role = user?.role;
  const eligible = isOnboardingRole(role);

  const hydrated = useOnboardingStore((s) => s.hydrated);
  const state = useOnboardingStore((s) => s.state);
  const activeTour = useOnboardingStore((s) => s.activeTour);
  const load = useOnboardingStore((s) => s.load);
  const startTour = useOnboardingStore((s) => s.startTour);
  const endTour = useOnboardingStore((s) => s.endTour);
  const markWelcomeSeen = useOnboardingStore((s) => s.markWelcomeSeen);

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Contexto para adaptar los recorridos: si el usuario ya tiene al menos una
  // propiedad (no archivada). `null` mientras no se sabe; se consulta al
  // montar y se refresca en cada cambio de ruta (p.ej. tras publicar).
  const [hasProperties, setHasProperties] = useState<boolean | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !eligible) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await createClient()
        .from("properties")
        .select("id")
        .eq("owner_id", userId)
        .neq("status", "ARCHIVADO")
        .limit(1);
      if (cancelled) return;
      // Si la consulta falla, asumimos el caso común (con propiedades) para
      // no bloquear el recorrido ni mandar a publicar a quien ya publicó.
      setHasProperties(error ? true : (data?.length ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, eligible, pathname]);

  useEffect(() => {
    if (user?.id && eligible) load(user.id);
  }, [user?.id, eligible, load]);

  // Arranque automático por ruta.
  useEffect(() => {
    if (!hydrated || !eligible || activeTour) return;
    const tour = tourForPath(pathname);
    if (!tour || state.tours[tour]) return;

    if (tour === "dashboard" && !state.welcomeSeen) {
      setWelcomeOpen(true);
      return;
    }
    // El recorrido de expedientes tiene dos versiones según haya propiedades;
    // no lo arrancamos hasta saber cuál corresponde.
    if (tour === "expedientes" && hasProperties === null) return;
    timerRef.current = window.setTimeout(() => startTour(tour), AUTO_START_DELAY_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [
    hydrated,
    eligible,
    activeTour,
    pathname,
    state.tours,
    state.welcomeSeen,
    startTour,
    hasProperties,
  ]);

  const handleWelcomeStart = useCallback(() => {
    setWelcomeOpen(false);
    markWelcomeSeen();
    window.setTimeout(() => startTour("dashboard"), 250);
  }, [markWelcomeSeen, startTour]);

  const handleWelcomeSkip = useCallback(() => {
    setWelcomeOpen(false);
    markWelcomeSeen();
    // Quien prefiere explorar solo no quiere que el recorrido le salte después.
    endTour("dashboard");
  }, [markWelcomeSeen, endTour]);

  const handleTourFinish = useCallback(() => {
    if (activeTour) endTour(activeTour);
  }, [activeTour, endTour]);

  // Si el usuario cambia de ruta a media explicación, cerramos sin marcar
  // el recorrido como visto para que lo retome al volver.
  const tourRouteRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeTour) tourRouteRef.current = pathname;
  }, [activeTour, pathname]);
  useEffect(() => {
    if (activeTour && tourRouteRef.current && tourRouteRef.current !== pathname) {
      useOnboardingStore.setState({ activeTour: null });
    }
  }, [pathname, activeTour]);

  // `Tour` toma los pasos una sola vez al montar, así que un cambio de
  // `hasProperties` a media explicación no lo hace saltar de versión.
  const steps = useMemo(() => {
    if (!activeTour || !eligible || !role) return [];
    const ctx: TourContext = { hasProperties: hasProperties ?? true };
    return getTourSteps(activeTour as TourId, role, ctx);
  }, [activeTour, eligible, role, hasProperties]);

  return (
    <>
      {children}
      {eligible && (
        <WelcomeDialog
          open={welcomeOpen}
          firstName={user?.firstName ?? ""}
          onStartTour={handleWelcomeStart}
          onSkip={handleWelcomeSkip}
        />
      )}
      {eligible && activeTour && steps.length > 0 && (
        <Tour key={activeTour} steps={steps} onFinish={handleTourFinish} />
      )}
      <RestartListener onRestart={() => router.push("/dashboard")} />
    </>
  );
}

/**
 * "Ver guía de inicio" desde el menú de usuario: reinicia el progreso y lleva
 * al dashboard, donde el arranque automático vuelve a mostrar la bienvenida.
 */
function RestartListener({ onRestart }: { onRestart: () => void }) {
  const reset = useOnboardingStore((s) => s.reset);
  useEffect(() => {
    const handler = () => {
      reset();
      onRestart();
    };
    window.addEventListener("bh:onboarding:restart", handler);
    return () => window.removeEventListener("bh:onboarding:restart", handler);
  }, [reset, onRestart]);
  return null;
}

/** Dispara el reinicio del onboarding desde cualquier componente. */
export function restartOnboarding() {
  window.dispatchEvent(new Event("bh:onboarding:restart"));
}
