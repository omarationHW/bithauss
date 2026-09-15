"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { TourStep } from "@/lib/onboarding/types";

/**
 * Motor de recorridos guiados: oscurece la pantalla, recorta un "foco" sobre
 * el elemento `data-tour="<target>"` de cada paso y muestra una tarjeta con
 * la explicación junto a él. Los pasos cuyo elemento no está en pantalla
 * (p.ej. la barra lateral en móvil) se saltan solos.
 *
 * Accesible: `role="dialog"`, foco en la tarjeta en cada paso, Esc cierra,
 * flechas navegan, respeta `prefers-reduced-motion`.
 */

const SPOT_PAD = 8;
const GAP = 14;
const MARGIN = 12;
const CARD_WIDTH = 344;
/** Cuánto esperar a que aparezca el elemento de un paso (páginas que cargan datos). */
const TARGET_WAIT_MS = 2500;
const TARGET_POLL_MS = 200;

type Placement = "top" | "bottom" | "left" | "right";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Lookup =
  | { status: "found"; el: HTMLElement }
  /** Existe pero está oculto por CSS (p.ej. barra lateral en móvil): saltar ya. */
  | { status: "hidden" }
  /** Aún no está en el DOM (la página sigue cargando): esperar un poco. */
  | { status: "missing" };

function findTarget(target: string): Lookup {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return { status: "missing" };
  return el.getClientRects().length > 0 ? { status: "found", el } : { status: "hidden" };
}

function measure(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - SPOT_PAD,
    left: r.left - SPOT_PAD,
    width: r.width + SPOT_PAD * 2,
    height: r.height + SPOT_PAD * 2,
  };
}

function resolvePlacement(
  spot: Box,
  card: { width: number; height: number },
  preferred: TourStep["placement"],
  vw: number,
  vh: number,
): Placement {
  const space: Record<Placement, number> = {
    top: spot.top,
    bottom: vh - (spot.top + spot.height),
    left: spot.left,
    right: vw - (spot.left + spot.width),
  };
  const fits = (p: Placement) =>
    p === "top" || p === "bottom"
      ? space[p] >= card.height + GAP + MARGIN
      : space[p] >= card.width + GAP + MARGIN;

  if (preferred && preferred !== "auto" && fits(preferred)) return preferred;
  const order: Placement[] = ["bottom", "top", "right", "left"];
  const ok = order.find(fits);
  if (ok) return ok;
  return order.reduce((best, p) => (space[p] > space[best] ? p : best), "bottom");
}

function positionCard(
  spot: Box,
  card: { width: number; height: number },
  placement: Placement,
  vw: number,
  vh: number,
) {
  let top: number;
  let left: number;
  switch (placement) {
    case "bottom":
      top = spot.top + spot.height + GAP;
      left = spot.left + spot.width / 2 - card.width / 2;
      break;
    case "top":
      top = spot.top - GAP - card.height;
      left = spot.left + spot.width / 2 - card.width / 2;
      break;
    case "right":
      top = spot.top + spot.height / 2 - card.height / 2;
      left = spot.left + spot.width + GAP;
      break;
    case "left":
      top = spot.top + spot.height / 2 - card.height / 2;
      left = spot.left - GAP - card.width;
      break;
  }
  left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - card.width - MARGIN));
  top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - card.height - MARGIN));
  return { top, left };
}

interface TourProps {
  steps: TourStep[];
  /** `completed` es false cuando el usuario lo saltó o cerró con Esc. */
  onFinish: (completed: boolean) => void;
}

export function Tour({ steps: allSteps, onFinish }: TourProps) {
  const router = useRouter();
  // Los pasos cuyo elemento existe pero está oculto en este tamaño de
  // pantalla (p.ej. el menú móvil en escritorio) se quitan desde el inicio
  // para que "Paso X de N" cuente solo lo que el usuario verá.
  const [steps] = useState(() =>
    allSteps.filter((s) => !s.target || findTarget(s.target).status !== "hidden"),
  );
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ width: CARD_WIDTH, height: 220 });
  const [viewport, setViewport] = useState({ vw: 0, vh: 0 });
  /** Mientras buscamos el elemento del paso no pintamos nada (evita saltos). */
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const directionRef = useRef<1 | -1>(1);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const finish = useCallback(
    (completed: boolean) => onFinish(completed),
    [onFinish],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      directionRef.current = dir;
      const next = index + dir;
      if (next < 0) return;
      if (next >= steps.length) {
        finish(true);
        return;
      }
      setIndex(next);
    },
    [index, steps.length, finish],
  );

  // Re-mide el foco cuando la página se mueve o cambia de tamaño.
  const refresh = useCallback(() => {
    setViewport({ vw: window.innerWidth, vh: window.innerHeight });
    if (targetRef.current) setSpot(measure(targetRef.current));
  }, []);

  // Localiza el elemento del paso (esperando si la página aún carga) y lo enfoca.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    setReady(false);

    if (!step.target) {
      targetRef.current = null;
      setSpot(null);
      setViewport({ vw: window.innerWidth, vh: window.innerHeight });
      setReady(true);
      return;
    }

    const started = Date.now();
    const attempt = () => {
      if (cancelled) return;
      const found = findTarget(step.target!);
      if (found.status === "found") {
        const el = found.el;
        targetRef.current = el;
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: reducedMotion ? "auto" : "smooth",
        });
        setSpot(measure(el));
        setViewport({ vw: window.innerWidth, vh: window.innerHeight });
        setReady(true);
        return;
      }
      if (found.status === "missing" && Date.now() - started < TARGET_WAIT_MS) {
        window.setTimeout(attempt, TARGET_POLL_MS);
        return;
      }
      // El elemento no existe en esta pantalla: saltamos el paso en la
      // misma dirección en la que veníamos.
      const next = index + directionRef.current;
      if (next < 0 || next >= steps.length) finish(true);
      else setIndex(next);
    };
    attempt();

    return () => {
      cancelled = true;
    };
  }, [step, index, steps.length, finish, reducedMotion]);

  useEffect(() => {
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [refresh]);

  // Tamaño real de la tarjeta para colocarla sin encimarse.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () =>
      setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, ready]);

  useEffect(() => {
    if (ready) cardRef.current?.focus({ preventScroll: true });
  }, [index, ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, finish]);

  if (!step || !ready || typeof document === "undefined") return null;

  const { vw, vh } = viewport;
  const hasCta = isLast && Boolean(step.ctaHref || step.ctaEvent);
  const placement = spot
    ? resolvePlacement(spot, cardSize, step.placement, vw, vh)
    : null;
  const cardPos = spot && placement
    ? positionCard(spot, cardSize, placement, vw, vh)
    : {
        top: Math.max(MARGIN, vh / 2 - cardSize.height / 2),
        left: Math.max(MARGIN, vw / 2 - cardSize.width / 2),
      };
  const transition = reducedMotion ? "none" : "top .25s ease, left .25s ease, width .25s ease, height .25s ease";
  const progress = ((index + 1) / steps.length) * 100;
  const titleId = `tour-step-${index}-title`;
  const bodyId = `tour-step-${index}-body`;

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-hidden={false}>
      {/* Bloquea la interacción con la página mientras dura el recorrido. */}
      <div
        className="absolute inset-0"
        style={{ background: spot ? "transparent" : "rgba(15, 23, 42, 0.62)" }}
        onClick={(e) => e.stopPropagation()}
      />

      {spot && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-white/90"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.62)",
            transition,
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        className="absolute flex flex-col rounded-2xl border border-gray-200/70 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_48px_-16px_rgba(15,23,42,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        style={{
          top: cardPos.top,
          left: cardPos.left,
          width: Math.min(CARD_WIDTH, vw - MARGIN * 2),
          transition: reducedMotion ? "none" : "top .25s ease, left .25s ease",
        }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Puntos de paso (progreso dentro del cuerpo, no en el borde). */}
              <ol
                className="flex items-center gap-1.5"
                aria-label={`Progreso del recorrido: ${Math.round(progress)}%`}
              >
                {steps.map((_, i) => (
                  <li
                    key={i}
                    aria-current={i === index ? "step" : undefined}
                    className={`h-1.5 rounded-full ${
                      i === index
                        ? "w-5 bg-blue-600"
                        : i < index
                          ? "w-1.5 bg-blue-300"
                          : "w-1.5 bg-gray-200"
                    }`}
                    style={{ transition: reducedMotion ? "none" : "width .25s ease, background-color .25s ease" }}
                  />
                ))}
              </ol>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Paso {index + 1} de {steps.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => finish(false)}
              className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              aria-label="Cerrar recorrido"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <h2
            id={titleId}
            className="mt-1 text-lg font-bold leading-snug text-gray-900"
            style={{ fontFamily: "Barlow, Inter, sans-serif" }}
          >
            {step.title}
          </h2>
          <p id={bodyId} className="mt-2 text-[15px] leading-relaxed text-gray-600">
            {step.body}
          </p>

          <div className="mt-5 flex items-center gap-2">
            {index > 0 ? (
              <button
                type="button"
                onClick={() => go(-1)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Atrás
              </button>
            ) : (
              <button
                type="button"
                onClick={() => finish(false)}
                className="h-10 rounded-xl px-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                Saltar
              </button>
            )}

            {hasCta ? (
              <button
                type="button"
                onClick={() => finish(true)}
                className="ml-auto h-10 rounded-xl px-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                {step.nextLabel ?? "Terminar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go(1)}
                className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
                style={{
                  background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                }}
              >
                {step.nextLabel ?? (isLast ? "Terminar" : "Siguiente")}
                {!isLast && <ArrowRight className="h-4 w-4" aria-hidden />}
              </button>
            )}
          </div>

          {hasCta && (
            <button
              type="button"
              onClick={() => {
                finish(true);
                // Un evento deja que la pantalla actual reaccione (p.ej. abrir
                // un modal) sin que el recorrido conozca su estado interno.
                if (step.ctaEvent) window.dispatchEvent(new Event(step.ctaEvent));
                else if (step.ctaHref) router.push(step.ctaHref);
              }}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition-[box-shadow,transform] duration-300 hover:shadow-[0_10px_24px_-12px_hsl(221_83%_53%/0.6)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
              style={{
                background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
              }}
            >
              {step.ctaLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
