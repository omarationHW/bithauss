"use client";

import { useCallback, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tarjeta con "spotlight" que sigue al cursor (patrón de React Bits,
 * https://reactbits.dev/components/spotlight-card), adaptada al sistema
 * visual de BitHauss: superficie blanca, borde neutro casi invisible,
 * elevación suave y un halo azul-verde que aparece solo al pasar el mouse.
 *
 * Es la base de todas las tarjetas del panel: sin barras ni líneas de
 * color, la marca se percibe por el halo y por los acentos internos.
 *
 * - `href`: la tarjeta completa se vuelve un enlace (mismo estilo).
 * - `interactive`: eleva al hover aunque no sea enlace (p.ej. botón).
 * - `padding`: escala interna; "none" para tarjetas con cabecera propia.
 * - Respeta `prefers-reduced-motion` (sin desplazamiento al hover).
 */

type Padding = "none" | "sm" | "md" | "lg";

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-6 sm:p-8",
};

export interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  href?: string;
  interactive?: boolean;
  padding?: Padding;
  /** Color del halo; por defecto el azul de marca con transparencia. */
  spotlightColor?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "data-tour"?: string;
  "data-testid"?: string;
}

export function SpotlightCard({
  children,
  className,
  href,
  interactive,
  padding = "md",
  spotlightColor = "hsl(221 83% 53% / 0.14)",
  style,
  ...rest
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | HTMLAnchorElement | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);

  const lift = href || interactive;
  const classes = cn(
    "spotlight-card group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.18)] transition-[transform,box-shadow,border-color] duration-300",
    lift &&
      "hover:border-blue-200/80 hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_16px_32px_-16px_rgba(37,99,235,0.28)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2",
    PADDING[padding],
    className,
  );
  const mergedStyle = { ...style, "--spotlight-color": spotlightColor } as CSSProperties;

  if (href) {
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        onMouseMove={handleMouseMove}
        className={cn(classes, "block")}
        style={mergedStyle}
        {...rest}
      >
        <span aria-hidden className="spotlight-card__glow" />
        {children}
      </Link>
    );
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onMouseMove={handleMouseMove}
      className={classes}
      style={mergedStyle}
      {...rest}
    >
      <span aria-hidden className="spotlight-card__glow" />
      {children}
    </div>
  );
}
