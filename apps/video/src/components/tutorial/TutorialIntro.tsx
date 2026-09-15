import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS, GRADIENT, LOGO_DARK } from '../../brand';

interface TutorialIntroProps {
  title: string;
  subtitle: string;
}

/** Opening card: logo lifts in, then the tutorial title and a small pill. */
export const TutorialIntro: React.FC<TutorialIntroProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 16, stiffness: 110, mass: 0.7 } });
  const logoOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const titleIn = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 100 } });
  const titleOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const pillIn = spring({ frame: frame - 34, fps, config: { damping: 16, stiffness: 120 } });
  const pillOpacity = interpolate(frame, [34, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const lineWidth = interpolate(frame, [26, 50], [0, 120], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Faint tilted logo in the corner nods at the watermark concept.
  const stampOpacity = interpolate(frame, [10, 40], [0, 0.07], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stampDrift = interpolate(frame, [0, durationInFrames], [0, -24]);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Img
        src={LOGO_DARK}
        style={{
          position: 'absolute',
          right: -60,
          bottom: 40 + stampDrift,
          width: 760,
          opacity: stampOpacity,
          transform: 'rotate(-12deg)',
          filter: 'grayscale(1)',
        }}
      />

      <div
        style={{
          transform: `scale(${0.75 + logoIn * 0.25}) translateY(${(1 - logoIn) * 20}px)`,
          opacity: logoOpacity,
          marginBottom: 36,
        }}
      >
        <Img src={LOGO_DARK} style={{ width: 440, height: 'auto', display: 'block' }} />
      </div>

      <div
        style={{
          width: lineWidth,
          height: 6,
          borderRadius: 3,
          background: GRADIENT,
          marginBottom: 28,
        }}
      />

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${(1 - titleIn) * 30}px)`,
          fontFamily: FONTS.display,
          fontSize: 72,
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: '-0.025em',
          color: COLORS.ink,
          textAlign: 'center',
          maxWidth: 1240,
          padding: '0 80px',
        }}
      >
        {title}
      </div>

      <div
        style={{
          opacity: pillOpacity,
          transform: `translateY(${(1 - pillIn) * 20}px) scale(${0.9 + pillIn * 0.1})`,
          marginTop: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 26px 12px 14px',
          borderRadius: 999,
          background: COLORS.white,
          border: `1px solid ${COLORS.muted}44`,
          boxShadow: '0 16px 36px -14px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: GRADIENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="16" viewBox="0 0 14 16">
            <path d="M1 1.5 L13 8 L1 14.5 Z" fill={COLORS.white} />
          </svg>
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 26,
            fontWeight: 600,
            color: COLORS.inkSoft,
            letterSpacing: '0.01em',
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
