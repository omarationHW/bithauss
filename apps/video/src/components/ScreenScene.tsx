import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS, FONTS, GRADIENT } from '../brand';

interface ScreenSceneProps {
  /** Filename inside public/screenshots, e.g. "home.png". */
  screenshot: string;
  eyebrow: string;
  title: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  /** Subtle pan/zoom: "in" zooms toward, "out" zooms away. */
  motion?: 'in' | 'out' | 'static';
}

/**
 * Reusable scene: framed product screenshot on the left, a text
 * eyebrow + headline on the right. The screenshot gets a small
 * ken-burns pan so static images feel alive.
 */
export const ScreenScene: React.FC<ScreenSceneProps> = ({
  screenshot,
  eyebrow,
  title,
  subtitle,
  motion = 'in',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Text comes in with a spring on entrance and gently fades out on exit.
  const textIn = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const textOpacity = interpolate(
    frame,
    [0, 10, durationInFrames - 12, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const textY = interpolate(textIn, [0, 1], [40, 0]);

  // Ken-burns motion on the screenshot.
  const motionProgress = interpolate(frame, [0, durationInFrames], [0, 1]);
  const scale =
    motion === 'in'
      ? 1.02 + motionProgress * 0.06
      : motion === 'out'
        ? 1.08 - motionProgress * 0.06
        : 1.04;
  const shiftX = motion === 'in' ? motionProgress * -10 : motion === 'out' ? motionProgress * 10 : 0;

  return (
    <AbsoluteFill>
      {/* Screenshot (left ~60% of screen) */}
      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 80,
          bottom: 80,
          width: 1100,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 40px 80px -20px rgba(15, 23, 42, 0.25)',
          background: COLORS.white,
          // Border-gradient by stacking on a gradient parent later.
          border: `1px solid ${COLORS.muted}33`,
        }}
      >
        <Img
          src={staticFile(`screenshots/${screenshot}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            transform: `scale(${scale}) translateX(${shiftX}px)`,
          }}
        />
      </div>

      {/* Text block (right ~30%) */}
      <div
        style={{
          position: 'absolute',
          right: 80,
          top: 0,
          bottom: 0,
          width: 640,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: COLORS.blue,
            marginBottom: 16,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 60,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
            color: COLORS.ink,
            marginBottom: subtitle ? 20 : 0,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.4,
              color: COLORS.inkSoft,
            }}
          >
            {subtitle}
          </div>
        )}
        <div
          style={{
            marginTop: 28,
            width: 72,
            height: 5,
            borderRadius: 3,
            background: GRADIENT,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
