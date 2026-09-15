import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { GRADIENT } from '../../brand';

/** Thin brand-gradient bar along the bottom edge tracking overall progress. */
export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 6,
        background: 'rgba(15, 23, 42, 0.08)',
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          background: GRADIENT,
          borderTopRightRadius: 3,
          borderBottomRightRadius: 3,
        }}
      />
    </div>
  );
};
