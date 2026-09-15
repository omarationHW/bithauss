import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Caption, splitCaption } from '../components/tutorial/Caption';
import { ProgressBar } from '../components/tutorial/ProgressBar';
import { StepScene } from '../components/tutorial/StepScene';
import { buildTimeline, type TutorialScene } from '../components/tutorial/timeline';
import { TutorialIntro } from '../components/tutorial/TutorialIntro';
import { TutorialOutro } from '../components/tutorial/TutorialOutro';
import { useBrandFonts } from '../components/tutorial/useBrandFonts';

/** Crossfade length between scenes (frames). */
const CROSSFADE = 12;

export const TUTORIAL_FPS = 30;

/** Total length derived from the narration files — used by Root's calculateMetadata. */
export const tutorialDurationInFrames = (fps = TUTORIAL_FPS) => buildTimeline(fps).totalFrames;

/**
 * "Cómo cambiar la marca de agua de tus propiedades" — a narrated
 * step-by-step tutorial. Every scene is a <Sequence> whose length comes
 * from narration.json; each one overlaps the previous by CROSSFADE frames
 * and fades in on top of it, so audio timing stays exact while visuals
 * dissolve softly.
 */
export const TutorialMarcaAgua: React.FC = () => {
  const { fps } = useVideoConfig();
  useBrandFonts();
  const { scenes } = buildTimeline(fps);

  return (
    <AbsoluteFill>
      <Background />
      {scenes.map((scene, i) => {
        const isLast = i === scenes.length - 1;
        return (
          <Sequence
            key={scene.id}
            from={scene.from}
            durationInFrames={scene.durationInFrames + (isLast ? 0 : CROSSFADE)}
            name={`${scene.kind} ${scene.id}`}
          >
            <SceneShell fadeIn={i > 0}>
              <Audio src={staticFile(scene.audio)} />
              <SceneContent scene={scene} />
            </SceneShell>
          </Sequence>
        );
      })}
      <ProgressBar />
    </AbsoluteFill>
  );
};

const SceneShell: React.FC<{ fadeIn: boolean; children: React.ReactNode }> = ({ fadeIn, children }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn
    ? interpolate(frame, [0, CROSSFADE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const SceneContent: React.FC<{ scene: TutorialScene }> = ({ scene }) => {
  const captions = splitCaption(scene.text, scene.narrationFrames, scene.durationInFrames - 2);
  switch (scene.kind) {
    case 'intro':
      return (
        <>
          <TutorialIntro
            title="Cómo cambiar la marca de agua de tus propiedades"
            subtitle="Tutorial · 2 minutos"
          />
          <Caption fragments={captions} />
        </>
      );
    case 'outro':
      return (
        <>
          <TutorialOutro
            headline="Protege tu trabajo. Tu marca en cada propiedad."
            url="bithauss-web.azurewebsites.net"
            path="Configuración → Marca de agua"
          />
          <Caption fragments={captions} />
        </>
      );
    default:
      return <StepScene scene={scene} />;
  }
};
