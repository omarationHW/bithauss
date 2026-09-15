"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Contador animado (patrón "CountUp" de React Bits) para cifras de KPI.
 * Interpola desde el valor anterior hasta el nuevo con requestAnimationFrame
 * y una curva ease-out; sin dependencias. Con `prefers-reduced-motion` o
 * cuando el valor no es numérico, pinta el valor final de inmediato.
 */

interface CountUpProps {
  /** Valor final; si no es un número válido se muestra tal cual. */
  value: number | string;
  /** Duración en ms. */
  duration?: number;
  className?: string;
  /** Formato del número (por defecto separadores de miles es-MX). */
  format?: (n: number) => string;
}

const nf = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const defaultFormat = (n: number) => nf.format(n);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function toNumber(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[\s,]/g, "");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function CountUp({
  value,
  duration = 900,
  className,
  format = defaultFormat,
}: CountUpProps) {
  const target = toNumber(value);
  const [display, setDisplay] = useState<number>(() => target ?? 0);
  /** Último valor pintado: punto de partida de la siguiente animación. */
  const currentRef = useRef<number>(target ?? 0);

  useEffect(() => {
    if (target === null) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = currentRef.current;
    if (reduced || from === target || duration <= 0) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    let frame: number | null = null;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = t < 1 ? Math.round(from + (target - from) * easeOutCubic(t)) : target;
      currentRef.current = next;
      setDisplay(next);
      frame = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  if (target === null) return <span className={className}>{String(value)}</span>;

  return (
    <span className={className} aria-label={format(target)}>
      {format(display)}
    </span>
  );
}
