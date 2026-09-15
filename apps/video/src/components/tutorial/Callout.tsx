import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS, GRADIENT } from '../../brand';

export const CALLOUT_MAX_WIDTH = 640;
export const CALLOUT_EST_HEIGHT = 130;

interface CalloutProps {
  stepNumber: number;
  title: string;
  x: number;
  y: number;
  /** Frame at which the callout should start fading out. */
  fadeOutAt: number;
}

/**
 * White rounded card with a gradient "Paso N" chip and the step title.
 * Springs in, fades out before the scene ends.
 */
export const Callout: React.FC<CalloutProps> = ({ stepNumber, title, x, y, fadeOutAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterAt = 6;
  const s = spring({ frame: frame - enterAt, fps, config: { damping: 16, stiffness: 120, mass: 0.8 } });
  const enterOpacity = interpolate(frame, [enterAt, enterAt + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(frame, [fadeOutAt, fadeOutAt + 10], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(s, [0, 1], [26, 0]);
  const scale = interpolate(s, [0, 1], [0.94, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        maxWidth: CALLOUT_MAX_WIDTH,
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${translateY}px) scale(${scale})`,
        transformOrigin: 'top left',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '18px 24px 18px 18px',
        background: COLORS.white,
        borderRadius: 20,
        border: `1px solid ${COLORS.muted}33`,
        boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.28), 0 2px 6px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '7px 14px',
          borderRadius: 999,
          background: GRADIENT,
          color: COLORS.white,
          fontFamily: FONTS.display,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
          boxShadow: `0 8px 18px -6px ${COLORS.blue}88`,
        }}
      >
        Paso {stepNumber}
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 30,
          fontWeight: 600,
          lineHeight: 1.2,
          color: COLORS.ink,
          letterSpacing: '-0.01em',
          paddingTop: 2,
        }}
      >
        {title}
      </div>
    </div>
  );
};
