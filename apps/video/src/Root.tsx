import React from 'react';
import { Composition } from 'remotion';
import { Reel20 } from './compositions/Reel20';
import { Demo90 } from './compositions/Demo90';

const FPS = 30;

/**
 * Composition registry — referenced by `remotion render <id>` and
 * by the Remotion Studio.
 */
export const Root: React.FC = () => (
  <>
    <Composition
      id="Reel20"
      component={Reel20}
      durationInFrames={24 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Demo90"
      component={Demo90}
      durationInFrames={78 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
