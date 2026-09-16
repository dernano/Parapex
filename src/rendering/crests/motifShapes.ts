import type { TriggerPresentation, TriggerProfile } from './triggerProfiles';
import { PROFILE_VISUALS } from './triggerProfiles';

/**
 * WHAT A MOTIF LOOKS LIKE AT SECOND `t`.
 *
 * The eight motifs used to be CSS keyframes. They worked, and they were the
 * one thing on the screen running on the WALL CLOCK while the battlefield ran
 * on the director's — so a frame that took a moment longer slid the rack out
 * of step with the guns, and a screenshot of them could only be taken by
 * pausing the animations and seeking into them by hand.
 *
 * So the shape over time is a pure function, like every other animation here.
 * The DOM becomes a sink that is told where things are, the rack and the wall
 * share one clock by construction, and "what does slot three look like 0.3
 * seconds in" is a question one can answer in Node.
 */

export interface MotifFrame {
  /** Around the slot's centre. */
  readonly scaleX: number;
  readonly scaleY: number;
  readonly opacity: number;
  /** Offset from the slot's centre, in logical pixels. */
  readonly x: number;
  readonly y: number;
  /** Radians. Only the ones that turn use it. */
  readonly rotation: number;
}

const HIDDEN: MotifFrame = { scaleX: 1, scaleY: 1, opacity: 0, x: 0, y: 0, rotation: 0 };

/** Linear interpolation across a list of stops. */
function ramp(p: number, stops: readonly (readonly [number, number])[]): number {
  if (p <= stops[0]![0]) return stops[0]![1];
  const last = stops[stops.length - 1]!;
  if (p >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    const [at, value] = stops[i]!;
    const [before, previous] = stops[i - 1]!;
    if (p <= at) {
      const share = (p - before) / (at - before);
      return previous + (value - previous) * share;
    }
  }
  return last[1];
}

const ease = (v: number): number => v * v * (3 - 2 * v);

/**
 * The eight shapes, as functions of progress.
 *
 * Progress, not seconds: each profile declares its own duration in
 * `PROFILE_VISUALS`, and the shapes below are written once against 0..1 so a
 * retimed motif keeps its character.
 */
const SHAPES: Readonly<Record<TriggerProfile, (p: number) => MotifFrame>> = {
  // The tableau turns: a ring opening outward. Slow, because what it altered
  // was the ARRANGEMENT, and arrangements are not violent.
  ROTATE: p => ({
    ...HIDDEN,
    scaleX: ramp(p, [[0, 0.3], [1, 1.8]]),
    scaleY: ramp(p, [[0, 0.3], [1, 1.8]]),
    opacity: ramp(p, [[0, 1], [1, 0]]),
    rotation: p * 0.6,
  }),

  // Something was ADDED. Small, bright, over quickly.
  SPARK: p => ({
    ...HIDDEN,
    scaleX: ramp(p, [[0, 0.2], [0.4, 1.3], [1, 1.5]]),
    scaleY: ramp(p, [[0, 0.2], [0.4, 1.3], [1, 1.5]]),
    opacity: ramp(p, [[0, 1], [0.4, 1], [1, 0]]),
  }),

  // Something was MULTIPLIED. It arrives from outside and lands hard — the
  // heaviest motif in the set, because a factor is the difference between a
  // good run and an absurd one.
  IMPACT: p => ({
    ...HIDDEN,
    scaleX: ramp(ease(p), [[0, 2.4], [0.35, 0.9], [1, 1.1]]),
    scaleY: ramp(ease(p), [[0, 2.4], [0.35, 0.9], [1, 1.1]]),
    opacity: ramp(p, [[0, 0], [0.2, 1], [0.35, 1], [1, 0]]),
    rotation: Math.PI / 4,
  }),

  // The frame of the turn. Nothing struck; something breathed.
  PULSE: p => ({
    ...HIDDEN,
    scaleX: ramp(p, [[0, 0.6], [0.5, 1.2], [1, 0.9]]),
    scaleY: ramp(p, [[0, 0.6], [0.5, 1.2], [1, 0.9]]),
    opacity: ramp(p, [[0, 0], [0.5, 0.9], [1, 0]]),
  }),

  // More volleys. Fire, rising, because volleys are what leave the walls.
  IGNITE: p => ({
    ...HIDDEN,
    scaleX: 1,
    scaleY: ramp(p, [[0, 0.2], [1, 1.4]]),
    opacity: ramp(p, [[0, 1], [1, 0]]),
    y: ramp(p, [[0, -6], [1, -30]]),
  }),

  // Supplies, and the two crests-about-crests. All three TRAVEL: the mark
  // starts where the cause was and arrives here. That is what turns a rack
  // into a machine the player can read.
  TRANSFER: p => travel(p),
  COPY: p => travel(p),
  RETRIGGER: p => travel(p),
};

/** A mark crossing from its cause to the slot that acted. */
function travel(p: number): MotifFrame {
  return {
    ...HIDDEN,
    // Progress along the line; the caller scales it by the real distance.
    x: ease(p),
    y: ease(p),
    opacity: ramp(p, [[0, 1], [0.8, 1], [1, 0]]),
    scaleX: 1,
    scaleY: 1,
  };
}

/** Whether a profile's frame travels, so the caller knows to scale x and y. */
export const travels = (profile: TriggerProfile): boolean =>
  PROFILE_VISUALS[profile].directed;

/**
 * A motif at second `t` after the event began.
 *
 * Before its turn and after its life it is simply invisible — not merely
 * faint. A motif that lingered at opacity 0.01 would keep a sprite alive and
 * make "is the rack idle" unanswerable.
 */
export function motifFrameAt(
  ignition: Pick<TriggerPresentation, 'profile' | 'visual' | 'at'>,
  t: number,
): MotifFrame {
  const age = t - ignition.at;
  if (age < 0 || age >= ignition.visual.duration) return HIDDEN;
  const frame = SHAPES[ignition.profile](age / ignition.visual.duration);
  /*
   * Anything under one 8-bit step IS invisible, so it says so.
   *
   * Without this a motif asked for at exactly its own end time comes back at
   * opacity 2e-16 — floating point, not design — and "is the rack idle" stops
   * having an answer. A thing the screen cannot show is not a thing.
   */
  return frame.opacity < 1 / 255 ? HIDDEN : frame;
}

/** When the last motif of an event has finished. */
export const motifsEndAt = (ignitions: readonly TriggerPresentation[]): number =>
  ignitions.reduce((latest, i) => Math.max(latest, i.at + i.visual.duration), 0);
