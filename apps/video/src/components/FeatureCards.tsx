import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, FONTS, GRADIENT } from '../brand';

interface Feature {
  icon: string;
  title: string;
  subtitle: string;
}

const FEATURES: Feature[] = [
  {
    icon: '🛡️',
    title: 'Certificación notarial',
    subtitle: 'Documentos validados por notario público con sello digital.',
  },
  {
    icon: '📄',
    title: 'Ficha técnica en PDF',
    subtitle: 'Descarga la información de cada propiedad sin contactar al corredor.',
  },
  {
    icon: '🔍',
    title: 'OCR + IA',
    subtitle: 'Validamos cada documento automáticamente antes de notarizar.',
  },
];

/**
 * Three feature cards that cascade in with staggered springs. Designed
 * to sit on its own scene (no screenshot), all attention on the value
 * propositions.
 */
export const FeatureCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 14], [20, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: FONTS.body,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: COLORS.blue,
          marginBottom: 18,
        }}
      >
        Por qué BitHauss
      </div>
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontFamily: FONTS.display,
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          color: COLORS.ink,
          marginBottom: 60,
          textAlign: 'center',
        }}
      >
        Confianza, sin intermediarios opacos.
      </div>

      <div style={{ display: 'flex', gap: 32, justifyContent: 'center', width: '100%', padding: '0 80px' }}>
        {FEATURES.map((feature, i) => {
          // Stagger: each card lifts in 10 frames after the previous one.
          const cardStart = 20 + i * 10;
          const cardSpring = spring({
            frame: frame - cardStart,
            fps,
            config: { damping: 18, stiffness: 110 },
          });
          const cardOpacity = interpolate(frame, [cardStart, cardStart + 14], [0, 1], {
            extrapolateRight: 'clamp',
          });
          const cardY = interpolate(cardSpring, [0, 1], [40, 0]);

          return (
            <div
              key={feature.title}
              style={{
                flex: 1,
                maxWidth: 460,
                background: COLORS.white,
                borderRadius: 20,
                padding: '36px 32px',
                boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.18)',
                border: `1px solid ${COLORS.muted}33`,
                opacity: cardOpacity,
                transform: `translateY(${cardY}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: GRADIENT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                }}
              >
                {feature.icon}
              </div>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 30,
                  fontWeight: 700,
                  color: COLORS.ink,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 18,
                  color: COLORS.inkSoft,
                  lineHeight: 1.45,
                }}
              >
                {feature.subtitle}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
