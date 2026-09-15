"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Borde "eléctrico" animado (React Bits · ElectricBorder, inspirado en
 * @BalintFerenczy https://codepen.io/BalintFerenczy/pen/KwdoyEN), portado a
 * TypeScript y extendido para trazar el borde con el DEGRADADO de marca en
 * lugar de un solo color.
 *
 * Uso: envolver la tarjeta a destacar. El contenido conserva su radio;
 * el canvas se dibuja por fuera del contenedor (overflow visible).
 * Con `prefers-reduced-motion` la animación se detiene en un fotograma.
 */

export interface ElectricBorderProps {
  children: ReactNode;
  /** Colores del degradado del trazo, de inicio a fin. */
  colors?: [string, string];
  /** Multiplicador de velocidad. */
  speed?: number;
  /** Intensidad de la distorsión (0 = línea limpia). */
  chaos?: number;
  /** Radio del borde en px; debe coincidir con el del contenido. */
  borderRadius?: number;
  className?: string;
  style?: CSSProperties;
}

const BRAND: [string, string] = ["hsl(221 83% 53%)", "hsl(160 84% 39%)"];

function random(x: number) {
  return (Math.sin(x * 12.9898) * 43758.5453) % 1;
}

function noise2D(x: number, y: number) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const a = random(i + j * 57);
  const b = random(i + 1 + j * 57);
  const c = random(i + (j + 1) * 57);
  const d = random(i + 1 + (j + 1) * 57);
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function octavedNoise(
  x: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  baseAmplitude: number,
  baseFrequency: number,
  time: number,
  seed: number,
) {
  let y = 0;
  let amplitude = baseAmplitude;
  let frequency = baseFrequency;
  for (let i = 0; i < octaves; i++) {
    // La primera octava se aplana (baseFlatness = 0 en el original).
    const octaveAmplitude = i === 0 ? 0 : amplitude;
    y += octaveAmplitude * noise2D(frequency * x + seed * 100, time * frequency * 0.3);
    frequency *= lacunarity;
    amplitude *= gain;
  }
  return y;
}

function cornerPoint(cx: number, cy: number, r: number, start: number, arc: number, p: number) {
  const angle = start + p * arc;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Punto sobre el perímetro de un rectángulo redondeado, t ∈ [0, 1]. */
function roundedRectPoint(t: number, left: number, top: number, w: number, h: number, r: number) {
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * sw + 2 * sh + 4 * arc;
  const d = t * total;
  let acc = 0;

  if (d <= acc + sw) return { x: left + r + ((d - acc) / sw) * sw, y: top };
  acc += sw;
  if (d <= acc + arc) return cornerPoint(left + w - r, top + r, r, -Math.PI / 2, Math.PI / 2, (d - acc) / arc);
  acc += arc;
  if (d <= acc + sh) return { x: left + w, y: top + r + ((d - acc) / sh) * sh };
  acc += sh;
  if (d <= acc + arc) return cornerPoint(left + w - r, top + h - r, r, 0, Math.PI / 2, (d - acc) / arc);
  acc += arc;
  if (d <= acc + sw) return { x: left + w - r - ((d - acc) / sw) * sw, y: top + h };
  acc += sw;
  if (d <= acc + arc) return cornerPoint(left + r, top + h - r, r, Math.PI / 2, Math.PI / 2, (d - acc) / arc);
  acc += arc;
  if (d <= acc + sh) return { x: left, y: top + h - r - ((d - acc) / sh) * sh };
  acc += sh;
  return cornerPoint(left + r, top + r, r, Math.PI, Math.PI / 2, (d - acc) / arc);
}

export function ElectricBorder({
  children,
  colors = BRAND,
  speed = 1,
  chaos = 0.12,
  borderRadius = 24,
  className,
  style,
}: ElectricBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [from, to] = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const octaves = 10;
    const lacunarity = 1.6;
    const gain = 0.7;
    const frequency = 10;
    const displacement = 60;
    const offset = 60;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let time = 0;
    let last = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width + offset * 2;
      height = rect.height + offset * 2;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const draw = (now: number) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      time += dt * speed;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const gradient = ctx.createLinearGradient(offset, offset, width - offset, height - offset);
      gradient.addColorStop(0, from);
      gradient.addColorStop(1, to);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const bw = width - 2 * offset;
      const bh = height - 2 * offset;
      const r = Math.min(borderRadius, Math.min(bw, bh) / 2);
      const perimeter = 2 * (bw + bh) + 2 * Math.PI * r;
      const samples = Math.max(16, Math.floor(perimeter / 2));

      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const p = i / samples;
        const pt = roundedRectPoint(p, offset, offset, bw, bh, r);
        const nx = octavedNoise(p * 8, octaves, lacunarity, gain, chaos, frequency, time, 0);
        const ny = octavedNoise(p * 8, octaves, lacunarity, gain, chaos, frequency, time, 1);
        const x = pt.x + nx * displacement;
        const y = pt.y + ny * displacement;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(performance.now());
    });
    ro.observe(container);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [from, to, speed, chaos, borderRadius]);

  const vars = {
    "--eb-from": from,
    "--eb-to": to,
    borderRadius,
  } as CSSProperties;

  return (
    <div ref={containerRef} className={`electric-border ${className ?? ""}`} style={{ ...vars, ...style }}>
      <div className="eb-canvas-container">
        <canvas ref={canvasRef} className="eb-canvas" />
      </div>
      <div className="eb-layers" aria-hidden>
        <div className="eb-glow-1" />
        <div className="eb-glow-2" />
        <div className="eb-background-glow" />
      </div>
      <div className="eb-content">{children}</div>
    </div>
  );
}
