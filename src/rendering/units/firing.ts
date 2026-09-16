import {
  recoilOffset, toScreen, worldOffsetForScreenX,
  type Camera, type ScreenPoint, type WorldPoint,
} from '../WorldTransform';
import type { Socket } from './UnitVisual';
import { firingDuration, type FiringPhase, type UnitVisualDefinition } from './UnitVisual';

/**
 * Firing, as a pure function of time.
 *
 * `poseAt(definition, t)` is the whole animation system: no timers, no tweens,
 * no mutable actor objects. The presentation asks what the unit looks like at
 * second `t` and gets an answer.
 *
 * That is not just tidy. It means the firing animation is TESTABLE — the
 * grounded-feet rule, the recoil direction and the release moment become
 * assertions rather than things one has to watch for. And it makes the length
 * of an animation structurally unable to affect the outcome: the simulation
 * decided everything before `t` was ever 0.
 */

export interface Pose {
  /** Which phase is running, for picking a frame or an effect. */
  readonly phase: string;
  /** 0..1 within that phase. */
  readonly phaseProgress: number;
  /** How far the weapon is drawn, 0..1. */
  readonly draw: number;
  /**
   * The weapon's kick, in SCREEN pixels, already pointed the right way.
   * The unit's feet are not in here and never will be.
   */
  readonly recoil: ScreenPoint;
  /** The effect this phase calls for, if any. */
  readonly effect: FiringPhase['effect'] | undefined;
  /** True on the single step where the projectile leaves the muzzle. */
  readonly released: boolean;
  readonly finished: boolean;
}

/** Which phase second `t` falls in, and how far through it. */
function locate(phases: readonly FiringPhase[], t: number): {
  phase: FiringPhase; index: number; progress: number; elapsed: number;
} {
  let elapsed = 0;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;
    if (t < elapsed + phase.duration || i === phases.length - 1) {
      const within = phase.duration ? (t - elapsed) / phase.duration : 1;
      return { phase, index: i, progress: Math.max(0, Math.min(1, within)), elapsed };
    }
    elapsed += phase.duration;
  }
  const last = phases[phases.length - 1]!;
  return { phase: last, index: phases.length - 1, progress: 1, elapsed };
}

export interface PoseOptions {
  /** Where the shot is going. Recoil is computed from this, not guessed. */
  readonly from: WorldPoint;
  readonly to: WorldPoint;
  readonly camera?: Camera;
  /** The previous frame's time, so `released` fires exactly once. */
  readonly since?: number;
}

export function poseAt(
  definition: UnitVisualDefinition,
  t: number,
  options: PoseOptions,
): Pose {
  const { phase, progress } = locate(definition.phases, t);
  const total = firingDuration(definition);

  /*
   * RECOIL FOLLOWS THE WORLD, NOT THE SCREEN'S VERTICAL.
   *
   * The firing vector comes out of the projection, and the kick is its
   * opposite. A gun firing toward the lower right recoils toward the upper
   * left. A generic `translateY` gives the same answer for every direction,
   * which is the bug this replaces — and on an isometric field it is wrong
   * for four directions out of four.
   */
  const strength = (phase.recoil ?? 0) * recoilShape(progress);
  const recoil = strength
    ? recoilOffset(options.from, options.to, strength, options.camera)
    : { x: 0, y: 0 };

  return {
    phase: phase.name,
    phaseProgress: progress,
    draw: interpolateDraw(definition.phases, t),
    recoil,
    effect: phase.effect,
    released: releasedBetween(definition, options.since ?? t, t),
    finished: t >= total,
  };
}

/**
 * A kick is not linear: it is almost instant and then eases back. Without the
 * shape, recoil reads as a slide rather than a blow.
 */
function recoilShape(progress: number): number {
  return progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
}

/** The draw eases between phases, so the bow bends rather than snapping between poses. */
function interpolateDraw(phases: readonly FiringPhase[], t: number): number {
  const { phase, index, progress } = locate(phases, t);
  const from = index > 0 ? (phases[index - 1]!.draw ?? 0) : 0;
  const to = phase.draw ?? 0;
  const eased = progress * progress * (3 - 2 * progress);
  return from + (to - from) * eased;
}

/** The exact second the projectile leaves the muzzle. */
export function releaseTime(definition: UnitVisualDefinition): number | null {
  let elapsed = 0;
  for (const phase of definition.phases) {
    if (phase.release !== undefined) return elapsed + phase.duration * phase.release;
    elapsed += phase.duration;
  }
  return null;
}

/** True when the release moment falls in (since, now]. Fires exactly once. */
function releasedBetween(
  definition: UnitVisualDefinition, since: number, now: number,
): boolean {
  const at = releaseTime(definition);
  if (at === null) return false;
  if (since === now) return false;
  return since < at && at <= now;
}

/**
 * Where the muzzle is on screen, with the recoil applied.
 *
 * THE PROJECTILE STARTS HERE. Never at the sprite's centre, never at its feet,
 * never at the tower's middle — that is what makes an arrow look like it left
 * the bow instead of appearing near a soldier.
 */
export function muzzlePosition(
  definition: UnitVisualDefinition,
  anchor: WorldPoint,
  pose: Pose,
  camera?: Camera,
): ScreenPoint {
  const feet = toScreen(anchor, camera);
  const socket = definition.sockets.muzzle;
  const spriteHeight = 26;
  return {
    // The socket is measured from the sprite's top-left; the anchor is its
    // bottom centre, which is what actually touches the tile.
    x: feet.x - 7 + socket.x + pose.recoil.x,
    y: feet.y - spriteHeight + socket.y + pose.recoil.y,
  };
}

/**
 * A shot in flight: where it is at time `t` after release.
 *
 * The arc is the weapon's, not a global constant — a cannonball barely arcs and
 * a trebuchet stone loops so high the player watches it travel.
 */
export function projectileAt(
  definition: UnitVisualDefinition,
  from: WorldPoint,
  to: WorldPoint,
  t: number,
): WorldPoint & { readonly done: boolean } {
  const distance = Math.hypot(to.col - from.col, to.row - from.row);
  const flight = distance / definition.projectileSpeed;
  const progress = flight > 0 ? Math.min(1, t / flight) : 1;
  return {
    col: from.col + (to.col - from.col) * progress,
    row: from.row + (to.row - from.row) * progress,
    height: (from.height ?? 0) * (1 - progress)
      + Math.sin(progress * Math.PI) * definition.projectileArc,
    done: progress >= 1,
  };
}

/**
 * A socket as a point in the WORLD, not on the screen.
 *
 * Smoke, flash and the shot itself all live in world coordinates — they have
 * to, or they would not sort against the towers and the enemy correctly. So a
 * socket measured on the sprite has to come back the other way: its height
 * above the figure's feet is straightforward, and its horizontal offset goes
 * through `worldOffsetForScreenX` rather than being divided by something that
 * happens to look right on tower three.
 *
 * `sprite` is the placeholder's or the real frame's box, so this keeps working
 * when authored art replaces the placeholders at a different size.
 */
export function socketWorld(
  anchor: WorldPoint,
  socket: Socket,
  sprite: { readonly width: number; readonly height: number },
  pose?: Pose,
  /**
   * THE SOCKET SCALES WITH THE SPRITE.
   *
   * Sockets are authored in unscaled sprite pixels while the sprite's own box
   * grows with the size probe, so mixing the two puts the muzzle in the wrong
   * place at any scale but 100 %. The debug overlay already multiplied and
   * this did not, which meant the cross-hair and the flash disagreed by
   * several pixels the moment anybody tried a different unit size — precisely
   * while they were trying to judge unit size.
   */
  scale = 1,
): WorldPoint {
  // The sprite hangs from its bottom centre; the socket is measured from its
  // top left.
  const offset = worldOffsetForScreenX(
    socket.x * scale - sprite.width / 2 + (pose?.recoil.x ?? 0));
  return {
    col: anchor.col + offset.col,
    row: anchor.row + offset.row,
    height: (anchor.height ?? 0) + (sprite.height - socket.y * scale) - (pose?.recoil.y ?? 0),
  };
}
