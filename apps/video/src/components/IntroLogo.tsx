import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS, GRADIENT, LOGO_DARK } from '../brand';

/**
 * Opening shot. Logo lifts in with a soft spring; the tagline
 * fades in beneath after the logo lands.
 */
export const IntroLogo: React.FC<{ tagline?: string }> = ({
  tagline = 'Inmuebles certificados, sin intermediarios.',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.7 },
  });
  const logoOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });

  const taglineOpacity = interpolate(frame, [22, 34], [0, 1], { extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [22, 34], [16, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          transform: `scale(${0.7 + logoScale * 0.3})`,
          opacity: logoOpacity,
          marginBottom: 28,
        }}
      >
        <Img
          src={LOGO_DARK}
          style={{ width: 520, height: 'auto', display: 'block' }}
        />
      </div>
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontFamily: FONTS.display,
          fontSize: 38,
          fontWeight: 600,
          color: COLORS.ink,
          letterSpacing: '-0.01em',
          textAlign: 'center',
          maxWidth: 1100,
          padding: '0 80px',
        }}
      >
        {tagline}
      </div>
      <div
        style={{
          marginTop: 20,
          width: 96,
          height: 6,
          borderRadius: 3,
          background: GRADIENT,
          opacity: taglineOpacity,
        }}
      />
    </AbsoluteFill>
  );
};
