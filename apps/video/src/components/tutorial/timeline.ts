import narration from '../../../public/audio/marca-agua/narration.json';
import stepsData from '../../../public/screenshots/marca-agua/steps.json';

/**
 * Timeline of the "Marca de agua" tutorial, derived entirely from the
 * narration JSON (exact TTS durations) and the screenshot manifest, so
 * visuals, captions and audio can never drift apart.
 */

export interface Focus {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SceneKind = 'intro' | 'step' | 'outro';
export type Interaction = 'click' | 'drag' | 'none';

export interface TutorialScene {
  id: string;
  kind: SceneKind;
  /** 1-based step number (steps only). */
  stepNumber?: number;
  title?: string;
  /** Path inside public/, e.g. "screenshots/marca-agua/01-dashboard.png". */
  screenshot?: string;
  focus?: Focus;
  interaction: Interaction;
  /** Narration audio path inside public/. */
  audio: string;
  /** Narration text, used for captions. */
  text: string;
  /** Exact narration length in frames. */
  narrationFrames: number;
  /** Scene length (narration + breathing room), without transition overlap. */
  durationInFrames: number;
  /** Absolute start frame in the composition. */
  from: number;
}

export interface TutorialTimeline {
  scenes: TutorialScene[];
  totalFrames: number;
}

/** Steps where the cursor travels to the focus and clicks. */
const CLICK_STEPS = new Set(['01', '03', '04', '05', '08']);
/** Steps where the cursor drags across a slider. */
const DRAG_STEPS = new Set(['06']);

const PADDING_SECONDS: Record<SceneKind, number> = {
  intro: 0.5,
  step: 0.6,
  outro: 1,
};

const kindOf = (id: string): SceneKind =>
  id === 'intro' ? 'intro' : id === 'outro' ? 'outro' : 'step';

export const buildTimeline = (fps: number): TutorialTimeline => {
  let cursor = 0;
  const scenes: TutorialScene[] = narration.map((entry) => {
    const kind = kindOf(entry.id);
    const narrationFrames = Math.ceil(entry.seconds * fps);
    const durationInFrames = Math.ceil((entry.seconds + PADDING_SECONDS[kind]) * fps);

    const base: TutorialScene = {
      id: entry.id,
      kind,
      interaction: CLICK_STEPS.has(entry.id) ? 'click' : DRAG_STEPS.has(entry.id) ? 'drag' : 'none',
      audio: entry.file,
      text: entry.text,
      narrationFrames,
      durationInFrames,
      from: cursor,
    };
    cursor += durationInFrames;

    if (kind !== 'step') return base;

    const stepNumber = Number.parseInt(entry.id, 10);
    const step = stepsData.steps[stepNumber - 1];
    if (!step) {
      throw new Error(`No screenshot manifest entry for narration step "${entry.id}"`);
    }
    return {
      ...base,
      stepNumber,
      title: step.title,
      screenshot: `screenshots/marca-agua/${step.file}`,
      focus: step.focus,
    };
  });

  return { scenes, totalFrames: cursor };
};
