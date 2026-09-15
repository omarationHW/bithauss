"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle, Loader2, Rocket, X } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { isProfileComplete } from "@/lib/onboarding/progress";

/**
 * Tarjeta "Primeros pasos" del dashboard. Se calcula con datos reales (no con
 * banderas), así que se marca sola conforme el usuario avanza, y se oculta
 * cuando todo está hecho o cuando el usuario la descarta.
 */

interface StepDef {
  id: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  /** Paso que depende de terceros (notario): se muestra "en proceso", sin CTA. */
  inProgress?: boolean;
}

export interface OnboardingProgress {
  /** Nombre, apellido y teléfono capturados en `profiles`. */
  hasProfile: boolean;
  propertyCount: number;
  /** Primera propiedad sin expediente, para llevar directo a "solicitar BRC". */
  firstUncertifiedId: string | null;
  expedienteCount: number;
  certified: boolean;
}

async function fetchProgress(userId: string): Promise<OnboardingProgress> {
  const supabase = createClient();
  const [profileRes, propsRes, expRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, status")
      .eq("owner_id", userId)
      .neq("status", "ARCHIVADO")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("brc_expedientes")
      .select("property_id, status")
      .eq("requested_by", userId)
      .limit(50),
  ]);

  for (const r of [profileRes, propsRes, expRes]) {
    if (r.error) logError("Primeros pasos: no se pudo leer el progreso", r.error);
  }

  const props = propsRes.data ?? [];
  const exps = expRes.data ?? [];
  const withExp = new Set(exps.map((e) => e.property_id));
  const firstUncertified = props.find((p) => !withExp.has(p.id));

  return {
    hasProfile: isProfileComplete(profileRes.data),
    propertyCount: props.length,
    firstUncertifiedId: firstUncertified?.id ?? null,
    expedienteCount: exps.length,
    certified: exps.some((e) => e.status === "CERTIFICADO"),
  };
}

/**
 * Progreso real del usuario en el flujo (perfil → propiedad → BRC → certificado).
 * Se recarga al volver a la pestaña/ventana, al restaurar la página desde el
 * bfcache y cuando cambia `refreshKey`. Con `enabled = false` no consulta nada.
 */
export function useOnboardingProgress(
  userId: string | null | undefined,
  { refreshKey = 0, enabled = true }: { refreshKey?: number; enabled?: boolean } = {},
): OnboardingProgress | null {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setProgress(await fetchProgress(userId));
    } catch (err) {
      logError("Primeros pasos: error inesperado", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    let active = true;
    const reload = () => { if (active) load(); };
    reload();
    // Al volver a la pestaña o ventana (p.ej. tras publicar en otra) refrescamos.
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", reload);
    window.addEventListener("pageshow", reload);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", reload);
      window.removeEventListener("pageshow", reload);
    };
  }, [load, refreshKey, enabled, userId]);

  return progress;
}

function buildSteps(p: OnboardingProgress): StepDef[] {
  return [
    {
      id: "perfil",
      title: "Completa tu perfil",
      body: "Agrega tu nombre y teléfono para que los compradores y el notario puedan contactarte.",
      href: "/dashboard/perfil",
      cta: "Ir a mi perfil",
      done: p.hasProfile,
    },
    {
      id: "propiedad",
      title: "Publica tu primera propiedad",
      body: "Fotos, precio y ubicación. Te guiamos sección por sección.",
      href: "/dashboard/propiedades/nueva",
      cta: "Publicar propiedad",
      done: p.propertyCount > 0,
    },
    {
      id: "brc",
      title: "Solicita la certificación BRC",
      body: "Sube la escritura y el predial; un notario valida que todo esté en regla.",
      href: p.firstUncertifiedId
        ? `/dashboard/propiedades/${p.firstUncertifiedId}/solicitar-brc`
        : "/dashboard/expedientes",
      cta: "Solicitar BRC",
      done: p.expedienteCount > 0,
    },
    {
      id: "certificado",
      title: "Recibe tu certificado",
      body: "Cuando el notario termine, tu propiedad mostrará el sello BRC y te avisaremos.",
      href: "/dashboard/expedientes",
      cta: "Ver expediente",
      done: p.certified,
      inProgress: p.expedienteCount > 0 && !p.certified,
    },
  ];
}

interface Props {
  userId: string;
  /** Cambia para volver a leer el progreso (botón "Actualizar" del dashboard). */
  refreshKey?: number;
}

export function FirstStepsChecklist({ userId, refreshKey = 0 }: Props) {
  const dismissedAt = useOnboardingStore((s) => s.state.checklistDismissedAt);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const dismiss = useOnboardingStore((s) => s.dismissChecklist);
  const progress = useOnboardingProgress(userId, { refreshKey });

  if (!hydrated || dismissedAt) return null;

  const steps = progress ? buildSteps(progress) : null;
  const doneCount = steps?.filter((s) => s.done).length ?? 0;
  const allDone = steps ? doneCount === steps.length : false;
  if (allDone) return null;

  const current = steps?.find((s) => !s.done) ?? null;
  const pct = steps ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <SpotlightCard padding="none" data-tour="dash:primeros-pasos">
      <section aria-labelledby="first-steps-title" className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-start">
        <div className="lg:w-72 lg:shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
                aria-hidden
              >
                <Rocket className="h-5 w-5" />
              </span>
              <div>
                <h3
                  id="first-steps-title"
                  className="text-lg font-bold leading-tight text-gray-900"
                  style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                >
                  Primeros pasos
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {steps
                    ? `${doneCount} de ${steps.length} completados`
                    : "Calculando tu progreso…"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:hidden"
              aria-label="Ocultar primeros pasos"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div
            className="mt-5 h-2 w-full overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Progreso de primeros pasos"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            />
          </div>

          {current && (
            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Siguiente paso
              </p>
              <p className="mt-1 font-semibold text-gray-900">{current.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">{current.body}</p>
              {current.inProgress ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-600">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  En revisión notarial
                </p>
              ) : (
                <Link
                  href={current.href}
                  className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
                  style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                >
                  {current.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
          )}
        </div>

        <ol className="flex-1 space-y-1">
          {(steps ?? []).map((s, i) => {
            const isCurrent = current?.id === s.id;
            return (
              <li
                key={s.id}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 ${isCurrent ? "bg-blue-50/70" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-500"
                  }`}
                  aria-hidden
                >
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      s.done ? "text-gray-400 line-through decoration-gray-300" : "text-gray-900"
                    }`}
                  >
                    {s.title}
                    {s.done && <span className="sr-only"> (completado)</span>}
                  </p>
                </div>
                {!s.done && !isCurrent && !s.inProgress && (
                  <Link
                    href={s.href}
                    className="hidden min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:inline-flex"
                  >
                    Ir
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                )}
                {s.inProgress && !s.done && (
                  <Circle className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-500" aria-label="En proceso" />
                )}
              </li>
            );
          })}
          {!steps && (
            <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando…
            </li>
          )}
        </ol>

        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 hidden h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:flex"
          aria-label="Ocultar primeros pasos"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </section>
    </SpotlightCard>
  );
}
