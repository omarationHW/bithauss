import React from 'react';
import { COLORS } from '../../brand';

interface CursorProps {
  /** Tip position in composition pixels. */
  x: number;
  y: number;
  opacity: number;
  /** 0..1 — how far the cursor is "pressed" (shrinks slightly). */
  pressed: number;
  /** 0..1 progress of the click ripple, or null when idle. */
  ripple: number | null;
}

/**
 * Animated pointer with a click ripple. The SVG's hot spot is its
 * top-left corner so `x`/`y` describe exactly where the tip lands.
 */
export const Cursor: React.FC<CursorProps> = ({ x, y, opacity, pressed, ripple }) => {
  const scale = 1 - pressed * 0.16;
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}>
      {ripple !== null && (
        <>
          <Ring progress={ripple} maxRadius={64} />
          <Ring progress={Math.max(0, ripple - 0.18) / 0.82} maxRadius={44} />
        </>
      )}
      <svg
        width={44}
        height={64}
        viewBox="0 0 18 27"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: '2px 2px',
          filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.35))',
        }}
      >
        <path
          d="M1 1 L1 21.5 L6.2 16.8 L10.2 25.5 L14 23.8 L10 15.2 L17 15 Z"
          fill={COLORS.white}
          stroke={COLORS.ink}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const Ring: React.FC<{ progress: number; maxRadius: number }> = ({ progress, maxRadius }) => {
  const p = Math.min(1, Math.max(0, progress));
  const r = 8 + p * maxRadius;
  const o = (1 - p) * 0.75;
  return (
    <div
      style={{
        position: 'absolute',
        left: -r,
        top: -r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `3px solid ${COLORS.blue}`,
        background: `${COLORS.blue}22`,
        opacity: o,
      }}
    />
  );
};
