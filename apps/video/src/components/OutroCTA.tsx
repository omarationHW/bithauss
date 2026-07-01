import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, FONTS, GRADIENT, LOGO_DARK } from '../brand';

export const OutroCTA: React.FC<{ url?: string }> = ({ url = 'bithauss.com' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const ctaOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateRight: 'clamp' });
  const ctaY = interpolate(frame, [10, 24], [24, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${0.8 + logoIn * 0.2})`, marginBottom: 36 }}>
        <Img src={LOGO_DARK} style={{ width: 480, height: 'auto', display: 'block' }} />
      </div>
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: COLORS.inkSoft,
            marginBottom: 18,
          }}
        >
          Empieza hoy
        </div>
        <div
          style={{
            display: 'inline-block',
            padding: '20px 56px',
            borderRadius: 999,
            background: GRADIENT,
            color: COLORS.white,
            fontFamily: FONTS.display,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            boxShadow: `0 20px 40px -10px ${COLORS.blue}66`,
          }}
        >
          {url}
        </div>
      </div>
    </AbsoluteFill>
  );
};
