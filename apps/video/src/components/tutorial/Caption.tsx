import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COLORS, FONTS } from '../../brand';

export const CAPTION_BOTTOM = 44;
export const CAPTION_TOP = 60;
export const CAPTION_EST_HEIGHT = 124;
export const CAPTION_MAX_WIDTH = 1440;

export type CaptionPlacement = 'bottom' | 'top';

/** Screen band a caption occupies, for layout collision checks. */
export const captionBand = (placement: CaptionPlacement) => ({
  x: (1920 - CAPTION_MAX_WIDTH) / 2,
  y: placement === 'bottom' ? 1080 - CAPTION_BOTTOM - CAPTION_EST_HEIGHT : CAPTION_TOP,
  w: CAPTION_MAX_WIDTH,
  h: CAPTION_EST_HEIGHT,
});

export interface CaptionFragment {
  text: string;
  from: number;
  to: number;
}

/**
 * Splits long narration into two fragments at the most natural
 * punctuation near the middle, and distributes the narration time
 * proportionally to character count.
 */
export const splitCaption = (
  text: string,
  narrationFrames: number,
  holdUntil: number,
): CaptionFragment[] => {
  if (text.length <= 105) return [{ text, from: 0, to: holdUntil }];

  const mid = text.length / 2;
  let best: { index: number; score: number } | null = null;
  const separators: Array<[string, number]> = [
    ['. ', 0],
    ['; ', 8],
    [': ', 14],
    [', ', 22],
  ];
  for (const [sep, penalty] of separators) {
    let idx = text.indexOf(sep);
    while (idx !== -1) {
      const score = Math.abs(idx - mid) + penalty;
      if (!best || score < best.score) best = { index: idx + sep.length - 1, score };
      idx = text.indexOf(sep, idx + 1);
    }
  }
  if (!best) return [{ text, from: 0, to: holdUntil }];

  const a = text.slice(0, best.index).trim();
  const b = text.slice(best.index).trim();
  const split = Math.round((narrationFrames * a.length) / (a.length + b.length));
  return [
    { text: a, from: 0, to: split },
    { text: b, from: split, to: holdUntil },
  ];
};

/** Caption bar (bottom by default), one fragment visible at a time. */
export const Caption: React.FC<{ fragments: CaptionFragment[]; placement?: CaptionPlacement }> = ({
  fragments,
  placement = 'bottom',
}) => {
  const frame = useCurrentFrame();
  const current = fragments.find((f) => frame >= f.from && frame < f.to);
  if (!current) return null;

  const fade = 7;
  const opacity = interpolate(
    frame,
    [current.from, current.from + fade, current.to - fade, current.to],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const rise = interpolate(frame, [current.from, current.from + fade], [placement === 'bottom' ? 10 : -10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        ...(placement === 'bottom' ? { bottom: CAPTION_BOTTOM } : { top: CAPTION_TOP }),
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: CAPTION_MAX_WIDTH,
          padding: '16px 36px',
          borderRadius: 18,
          background: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(6px)',
          color: COLORS.white,
          fontFamily: FONTS.body,
          fontSize: 34,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          opacity,
          transform: `translateY(${rise}px)`,
          boxShadow: '0 12px 30px -10px rgba(15, 23, 42, 0.5)',
        }}
      >
        {current.text}
      </div>
    </div>
  );
};
