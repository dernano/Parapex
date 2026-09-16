import type { PresentationSettings } from '../presentation/settings';
import type { Camera, ScreenPoint } from '../WorldTransform';
import type { DrawnShot, SalvoPlan } from './salvoPresentation';

/**
 * THE CAMERA'S ANSWER, AND HOW LITTLE OF IT THERE IS.
 *
 * Screen shake is the cheapest excitement in games and the fastest to become
 * unbearable. The brief is explicit — VERY sparse — so this module is written
 * around refusing rather than around shaking:
 *
 *  · A longbow moves the camera by nothing. Ever.
 *  · A single cannon moves it by nothing. One shot is a sound, not an
 *    earthquake, and a castle that lurches every two seconds is a castle
 *    nobody can aim in.
 *  · Only a SALVO of tier C or above registers at all, and even then the
 *    ceiling is three logical pixels.
 *  · `reducedMotion` returns exactly zero. Not "less" — zero, asserted.
 *
 * It is a pure function of time over a list of impulses, like every other
 * animation here: no timers, no mutable camera object, nothing that could
 * still be shaking after the combat ended.
 */

/** The hard ceiling, in logical pixels. Three. Not negotiable. */
export const MAX_CAMERA_SHIFT = 3;

/** How long a single impulse takes to die out completely, in seconds. */
export const IMPULSE_LIFE = 0.32;

export interface CameraImpulse {
  /** Seconds after the presentation started. */
  readonly at: number;
  /** 0..1. Scaled to MAX_CAMERA_SHIFT. */
  readonly strength: number;
  /** Which way the blow pushed, in screen space, normalised. */
  readonly direction: ScreenPoint;
}

/**
 * Below this, the castle simply does not move. It is the single most important
 * number in the file: it is what makes the shake mean something when it does
 * happen.
 */
const REGISTERS_AT_TIER = 'C';
const TIER_ORDER = ['A', 'B', 'C', 'D', 'E'];

/**
 * The impulse a drawn shot deserves, or none.
 *
 * Most shots deserve none. The ones that do are the heavy ones late in a
 * barrage, and the last shot of any salvo that got this far — so the player
 * feels the sequence LAND rather than feeling it rattle.
 */
export function impulseFor(
  plan: SalvoPlan,
  shot: DrawnShot,
  direction: ScreenPoint,
): CameraImpulse | null {
  if (TIER_ORDER.indexOf(plan.tier.id) < TIER_ORDER.indexOf(REGISTERS_AT_TIER)) return null;
  const escalation = plan.tier.escalation.shake;
  if (escalation <= 0) return null;

  /*
   * Sparse in TIME as well as in strength: every third drawn shot, plus the
   * last. Shaking on all twenty-two shots of a tier D salvo would be a
   * continuous tremor, which reads as a broken renderer rather than as force.
   */
  if (!shot.last && shot.index % 3 !== 0) return null;

  const strength = Math.min(1, (escalation / 3) * (shot.last ? 1 : 0.6));
  return { at: shot.at, strength, direction };
}

/**
 * Where the camera sits at second `t`.
 *
 * A struck bell, not a vibration: one hard displacement along the blow's own
 * direction, then a decaying oscillation back to rest. Rounded to whole
 * pixels, because a camera at x = 417.4 turns every sprite on the field into
 * mush at once — the one bug that can make ALL the art look bad simultaneously.
 */
export function cameraOffset(
  impulses: readonly CameraImpulse[],
  t: number,
  settings: PresentationSettings,
): ScreenPoint {
  if (settings.reducedMotion || !settings.effects.shake) return { x: 0, y: 0 };

  let x = 0;
  let y = 0;
  for (const impulse of impulses) {
    const age = t - impulse.at;
    if (age < 0 || age >= IMPULSE_LIFE) continue;
    const decay = 1 - age / IMPULSE_LIFE;
    // Two and a bit oscillations over the life: enough to read as a recoil,
    // too few to read as a rumble.
    const wave = Math.cos(age / IMPULSE_LIFE * Math.PI * 2.5);
    const amount = impulse.strength * MAX_CAMERA_SHIFT * decay * decay * wave;
    x += impulse.direction.x * amount;
    y += impulse.direction.y * amount;
  }

  return {
    x: clamp(Math.round(x)),
    y: clamp(Math.round(y)),
  };
}

const clamp = (v: number): number =>
  Math.max(-MAX_CAMERA_SHIFT, Math.min(MAX_CAMERA_SHIFT, v));

/** The camera, displaced. The projection reads this; nothing else changes. */
export function shakenCamera(
  base: Camera,
  impulses: readonly CameraImpulse[],
  t: number,
  settings: PresentationSettings,
): Camera {
  const offset = cameraOffset(impulses, t, settings);
  if (!offset.x && !offset.y) return base;
  return { originX: base.originX + offset.x, originY: base.originY + offset.y };
}

/** How long any shake from these impulses can still last. For the debug overlay. */
export const impulsesEndAt = (impulses: readonly CameraImpulse[]): number =>
  impulses.reduce((latest, i) => Math.max(latest, i.at + IMPULSE_LIFE), 0);
