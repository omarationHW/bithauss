import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../../brand';
import { Callout, CALLOUT_EST_HEIGHT, CALLOUT_MAX_WIDTH } from './Callout';
import { Caption, captionBand, splitCaption, type CaptionPlacement } from './Caption';
import { Cursor } from './Cursor';
import {
  easeInOutCubic,
  easeOutCubic,
  getCamera,
  inflate,
  intersects,
  landedCamera,
  projectPoint,
  projectRect,
  SCREEN,
  type Rect,
} from './kenBurns';
import { Spotlight } from './Spotlight';
import type { TutorialScene } from './timeline';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Padding (capture px) between the element and the spotlight ring. */
const FOCUS_PAD = 10;

interface CursorState {
  x: number;
  y: number;
  opacity: number;
  pressed: number;
  ripple: number | null;
}

/**
 * One tutorial step: framed screenshot with a cinematic zoom toward the
 * focus, spotlight ring, animated cursor, numbered callout and caption.
 */
export const StepScene: React.FC<{ scene: TutorialScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { focus, screenshot, title, stepNumber } = scene;
  if (!focus || !screenshot || !title || !stepNumber) {
    throw new Error(`Scene ${scene.id} is not a step scene`);
  }

  const nominal = scene.durationInFrames;
  const cam = getCamera(focus, frame, nominal);
  const focusRect = projectRect(inflate(focus, FOCUS_PAD), cam);

  // Spotlight fades in as the zoom starts landing.
  const spotlightOpacity = interpolate(frame, [8, 26, nominal - 8, nominal + 4], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Where the zoom settles: UI must never cover this rectangle.
  const landed = projectRect(inflate(focus, FOCUS_PAD + 24), landedCamera(focus, nominal));
  // Captions live at the bottom unless a *specific* element (not a whole
  // section) would be hidden there; whole-section focuses keep the default.
  const isWholeSection = landed.h > 1080 * 0.5;
  const captionPlacement: CaptionPlacement =
    !isWholeSection && intersects(landed, captionBand('bottom')) ? 'top' : 'bottom';
  const calloutPos = pickCalloutPosition(landed, captionPlacement);
  const captions = splitCaption(scene.text, scene.narrationFrames, nominal - 2);
  const cursor = getCursorState(scene, frame, nominal);

  return (
    <AbsoluteFill>
      {/* Framed screenshot */}
      <div
        style={{
          position: 'absolute',
          left: SCREEN.x,
          top: SCREEN.y,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: 24,
          overflow: 'hidden',
          background: COLORS.white,
          border: `1px solid ${COLORS.muted}44`,
          boxShadow: '0 40px 80px -24px rgba(15, 23, 42, 0.35), 0 4px 12px rgba(15, 23, 42, 0.06)',
        }}
      >
        <Img
          src={staticFile(screenshot)}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})`,
            transformOrigin: '50% 50%',
          }}
        />
      </div>

      {/* Spotlight clipped to the screenshot frame */}
      <div
        style={{
          position: 'absolute',
          left: SCREEN.x,
          top: SCREEN.y,
          width: SCREEN.w,
          height: SCREEN.h,
          borderRadius: 24,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Spotlight
          rect={{ ...focusRect, x: focusRect.x - SCREEN.x, y: focusRect.y - SCREEN.y }}
          opacity={spotlightOpacity}
          frame={frame}
          fps={fps}
        />
      </div>

      {cursor && (
        <Cursor
          x={cursor.x}
          y={cursor.y}
          opacity={cursor.opacity}
          pressed={cursor.pressed}
          ripple={cursor.ripple}
        />
      )}

      <Callout
        stepNumber={stepNumber}
        title={title}
        x={calloutPos.x}
        y={calloutPos.y}
        fadeOutAt={nominal - 10}
      />

      <Caption fragments={captions} placement={captionPlacement} />
    </AbsoluteFill>
  );
};

/**
 * Prefer the top-left corner; fall back to bottom-left, then the right
 * side, so the card never covers the landed focus nor the caption.
 */
const pickCalloutPosition = (landed: Rect, captionPlacement: CaptionPlacement) => {
  const margin = 32;
  const box = { w: CALLOUT_MAX_WIDTH, h: CALLOUT_EST_HEIGHT };
  const caption = captionBand(captionPlacement);
  const top = captionPlacement === 'top' ? caption.y + caption.h + 20 : SCREEN.y + margin;
  const bottom =
    captionPlacement === 'bottom' ? caption.y - 20 - box.h : SCREEN.y + SCREEN.h - margin - box.h;
  const left = SCREEN.x + margin;
  const right = SCREEN.x + SCREEN.w - margin - box.w;
  const candidates = [
    { x: left, y: top },
    { x: left, y: bottom },
    { x: right, y: top },
    { x: right, y: bottom },
  ];
  const obstacles = [landed, caption];
  return (
    candidates.find((c) => !obstacles.some((o) => intersects({ x: c.x, y: c.y, w: box.w, h: box.h }, o))) ??
    candidates[0]!
  );
};

/** Cursor choreography for click and drag steps. */
const getCursorState = (scene: TutorialScene, frame: number, nominal: number): CursorState | null => {
  const focus = scene.focus;
  if (!focus || scene.interaction === 'none') return null;

  const cam = getCamera(focus, frame, nominal);
  const exit = interpolate(frame, [nominal - 8, nominal + 4], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (scene.interaction === 'drag') {
    // Slider: press at ~24% of the track, drag to the knob (~60%).
    const trackY = focus.y + focus.h * 0.72;
    const fromX = focus.x + focus.w * 0.24;
    const toX = focus.x + focus.w * 0.6;
    const arriveEnd = 34;
    const pressAt = 40;
    const dragStart = 46;
    const dragEnd = Math.min(nominal - 40, 110);
    const releaseAt = dragEnd + 6;

    const dragP = easeInOutCubic(clamp01((frame - dragStart) / (dragEnd - dragStart)));
    const targetSrc = { x: fromX + (toX - fromX) * dragP, y: trackY };
    const target = projectPoint(targetSrc.x, targetSrc.y, cam);
    const start = { x: target.x + 260, y: target.y + 200 };
    const move = easeOutCubic(clamp01((frame - 8) / (arriveEnd - 8)));
    const pressed =
      frame < pressAt
        ? 0
        : frame < releaseAt
          ? clamp01((frame - pressAt) / 4)
          : 1 - clamp01((frame - releaseAt) / 4);
    const ripple = frame >= pressAt && frame < pressAt + 22 ? (frame - pressAt) / 22 : null;
    return {
      x: start.x + (target.x - start.x) * move,
      y: start.y + (target.y - start.y) * move,
      opacity: interpolate(frame, [6, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exit,
      pressed,
      ripple,
    };
  }

  // Click: travel to the focus centre, press, ripple.
  const centre = projectPoint(focus.x + focus.w / 2, focus.y + focus.h / 2, cam);
  const arriveEnd = 40;
  const clickAt = 46;
  // Approach from the lower-right, unless that would leave the canvas.
  const dx = centre.x + 300 > 1900 ? -300 : 300;
  const dy = centre.y + 220 > 1000 ? -220 : 220;
  const start = { x: centre.x + dx, y: centre.y + dy };
  const move = easeOutCubic(clamp01((frame - 8) / (arriveEnd - 8)));
  const pressed = frame < clickAt ? 0 : frame < clickAt + 4 ? (frame - clickAt) / 4 : frame < clickAt + 10 ? 1 - (frame - clickAt - 4) / 6 : 0;
  const ripple = frame >= clickAt && frame < clickAt + 24 ? (frame - clickAt) / 24 : null;
  return {
    x: start.x + (centre.x - start.x) * move,
    y: start.y + (centre.y - start.y) * move,
    opacity: interpolate(frame, [6, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * exit,
    pressed: clamp01(pressed),
    ripple,
  };
};
