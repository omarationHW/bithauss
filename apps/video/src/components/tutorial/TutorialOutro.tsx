import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS, GRADIENT, LOGO_DARK } from '../../brand';

interface TutorialOutroProps {
  headline: string;
  url: string;
  path: string;
}

/** Closing card: logo, headline, URL pill and the in-app path to the feature. */
export const TutorialOutro: React.FC<TutorialOutroProps> = ({ headline, url, path }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const headIn = spring({ frame: frame - 12, fps, config: { damping: 18, stiffness: 100 } });
  const headOpacity = interpolate(frame, [12, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaIn = spring({ frame: frame - 30, fps, config: { damping: 16, stiffness: 120 } });
  const ctaOpacity = interpolate(frame, [30, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pathOpacity = interpolate(frame, [44, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pathY = interpolate(frame, [44, 58], [14, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const [first, ...rest] = headline.split('. ');
  const second = rest.join('. ');

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${0.8 + logoIn * 0.2})`, marginBottom: 40 }}>
        <Img src={LOGO_DARK} style={{ width: 420, height: 'auto', display: 'block' }} />
      </div>

      <div
        style={{
          opacity: headOpacity,
          transform: `translateY(${(1 - headIn) * 28}px)`,
          textAlign: 'center',
          fontFamily: FONTS.display,
          fontWeight: 800,
          fontSize: 68,
          lineHeight: 1.1,
          letterSpacing: '-0.025em',
          color: COLORS.ink,
          maxWidth: 1300,
        }}
      >
        <div>{first}{second ? '.' : ''}</div>
        {second && (
          <div
            style={{
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              paddingBottom: 6,
            }}
          >
            {second}
          </div>
        )}
      </div>

      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${(1 - ctaIn) * 24}px) scale(${0.94 + ctaIn * 0.06})`,
          marginTop: 44,
          padding: '20px 52px',
          borderRadius: 999,
          background: GRADIENT,
          color: COLORS.white,
          fontFamily: FONTS.display,
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          boxShadow: `0 20px 40px -10px ${COLORS.blue}66`,
        }}
      >
        {url}
      </div>

      <div
        style={{
          opacity: pathOpacity,
          transform: `translateY(${pathY}px)`,
          marginTop: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 22px',
          borderRadius: 999,
          background: COLORS.white,
          border: `1px solid ${COLORS.muted}44`,
          boxShadow: '0 12px 28px -14px rgba(15, 23, 42, 0.25)',
          fontFamily: FONTS.body,
          fontSize: 24,
          fontWeight: 600,
          color: COLORS.inkSoft,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {path}
      </div>
    </AbsoluteFill>
  );
};
