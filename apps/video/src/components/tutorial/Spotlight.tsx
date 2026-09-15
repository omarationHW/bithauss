import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../../brand';
import type { Rect } from './kenBurns';

interface SpotlightProps {
  /** Cut-out rectangle in composition pixels. */
  rect: Rect;
  /** 0..1 fade of the whole effect. */
  opacity: number;
  /** Current frame, drives the "breathing" glow. */
  frame: number;
  fps: number;
  radius?: number;
}

/**
 * Dims everything except `rect`, then draws a brand-gradient ring with
 * a soft glow that gently pulses so the eye lands on the element.
 * Coordinates are relative to the nearest positioned ancestor, so wrap
 * it in a clipping container to keep the effect inside a frame.
 */
export const Spotlight: React.FC<SpotlightProps> = ({
  rect,
  opacity,
  frame,
  fps,
  radius = 14,
}) => {
  // Slow breathing: ~0.8 Hz sine mapped to 0..1.
  const breath = (Math.sin((frame / fps) * Math.PI * 2 * 0.8) + 1) / 2;
  const ringWidth = 3 + breath * 1.5;
  const glowBlur = 14 + breath * 12;
  const glowOpacity = 0.45 + breath * 0.35;
  const gradientId = 'spotlight-brand-gradient';

  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      {/* Dim layer with rounded cut-out */}
      <div
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: radius,
          boxShadow: '0 0 0 4000px rgba(15, 23, 42, 0.35)',
        }}
      />
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.blue} />
            <stop offset="100%" stopColor={COLORS.green} />
          </linearGradient>
          <filter id="spotlight-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={glowBlur} />
          </filter>
        </defs>
        {/* Glow */}
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={ringWidth * 3}
          opacity={glowOpacity}
          filter="url(#spotlight-glow)"
        />
        {/* Crisp ring */}
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.w}
          height={rect.h}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={ringWidth}
        />
        {/* Inner hairline keeps the ring legible over dark UI */}
        <rect
          x={rect.x + ringWidth / 2 + 1}
          y={rect.y + ringWidth / 2 + 1}
          width={Math.max(0, rect.w - ringWidth - 2)}
          height={Math.max(0, rect.h - ringWidth - 2)}
          rx={Math.max(0, radius - ringWidth / 2 - 1)}
          ry={Math.max(0, radius - ringWidth / 2 - 1)}
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={1.2}
        />
      </svg>
    </AbsoluteFill>
  );
};
