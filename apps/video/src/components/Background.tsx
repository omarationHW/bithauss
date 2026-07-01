import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, GRADIENT } from '../brand';

/**
 * Subtle ambient backdrop. Renders behind every scene.
 *  - Light cream base so screenshots pop
 *  - Two soft blue/green radial blobs anchored top-right and bottom-left
 *    that give depth without competing with foreground content.
 */
export const Background: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.cream }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 100% 0%, ${COLORS.blue}22 0%, transparent 40%),
                     radial-gradient(circle at 0% 100%, ${COLORS.green}22 0%, transparent 40%)`,
      }}
    />
    {/* Faint top accent line — keeps the corporate feel */}
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: GRADIENT,
        }}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);
