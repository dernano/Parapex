import type { Tower, Unit } from '@/core/types';
import { TILE_HEIGHT, TILE_WIDTH } from '../artRules';
import { towerGroundAnchor } from '../SceneGraph';
import { snap, toScreen, type Camera, type ScreenPoint, type WorldPoint } from '../WorldTransform';

/**
 * PUTTING A CARD ON A TOWER.
 *
 * This is the interaction the player performs more than any other, so it is
 * worth more care than any other. Three things make it feel solid rather than
 * fiddly, and all three are decisions rather than polish:
 *
 *  1. THE TARGET IS THE PLATFORM, NOT THE TILE. The player is aiming at the
 *     place the soldier will stand — the top of the tower, where the sprite
 *     goes — and a hit area at the tower's feet means the card refuses to drop
 *     exactly where it looks like it should.
 *  2. THE TARGET IS BIGGER THAN IT LOOKS. A generous snap radius costs nothing
 *     when the five targets are far apart, and it is the difference between
 *     placing a card and aiming at one.
 *  3. THE ANSWER ARRIVES BEFORE THE DROP. What the card would do — the
 *     formation it completes, what it displaces, what it costs — is shown
 *     while it is still in the air. A confirmation after the fact is not an
 *     interface, it is a receipt.
 */

export interface DropTarget {
  readonly tower: number;
  /** The point the sprite's feet will occupy. */
  readonly world: WorldPoint;
  readonly screen: ScreenPoint;
  /** The diamond the platform presents, in screen pixels. */
  readonly halfWidth: number;
  readonly halfHeight: number;
  /** Whether a unit already stands here — dropping replaces it. */
  readonly occupied: boolean;
}

/**
 * How far outside the platform a drop still counts.
 *
 * Half a tile. The towers are four rows apart, so there is no chance of two
 * targets competing, and every pixel of slack is a card that lands where the
 * player meant it to.
 */
export const SNAP_RADIUS = TILE_WIDTH / 2;

export function dropTargets(towers: readonly Tower[], camera: Camera): readonly DropTarget[] {
  return towers.map((tower, index) => {
    const world = towerGroundAnchor(index, tower.type);
    return {
      tower: index,
      world,
      screen: snap(toScreen(world, camera)),
      halfWidth: TILE_WIDTH * 0.6,
      halfHeight: TILE_HEIGHT * 0.6,
      occupied: Boolean(tower.unit),
    };
  });
}

/**
 * Which target a point is over, with the slack applied.
 *
 * Nearest wins, measured in the diamond's own space so the hit area is the
 * shape the player sees rather than a square around it — which on a 2:1
 * projection is nearly twice as tall as the thing it claims to cover.
 */
export function targetAt(
  point: ScreenPoint,
  targets: readonly DropTarget[],
): DropTarget | null {
  let best: DropTarget | null = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    const dx = (point.x - target.screen.x) / (target.halfWidth + SNAP_RADIUS);
    const dy = (point.y - target.screen.y) / (target.halfHeight + SNAP_RADIUS);
    // Diamond distance, matching the projection.
    const distance = Math.abs(dx) + Math.abs(dy);
    if (distance <= 1 && distance < bestDistance) { best = target; bestDistance = distance; }
  }
  return best;
}

/* ---------- The drag itself ---------- */

export type DragPhase =
  /** Nothing in hand. */
  | 'idle'
  /** Picked up and moving. The hand closes behind it. */
  | 'lifted'
  /** Over a legal target. The platform lights, the ghost stands up. */
  | 'over'
  /** Over a target the player cannot afford, or no target at all. */
  | 'refused';

export interface DragState {
  readonly phase: DragPhase;
  /** Which card, by hand index. */
  readonly card: number | null;
  readonly at: ScreenPoint;
  readonly target: DropTarget | null;
  /** What it would cost. Shown while it is still in the air. */
  readonly cost: number;
  readonly affordable: boolean;
}

export const NO_DRAG: DragState = {
  phase: 'idle', card: null, at: { x: 0, y: 0 }, target: null,
  cost: 0, affordable: true,
};

export interface DragInput {
  readonly card: number;
  readonly at: ScreenPoint;
  readonly targets: readonly DropTarget[];
  readonly cost: number;
  readonly momentum: number;
}

export function dragAt(input: DragInput): DragState {
  const target = targetAt(input.at, input.targets);
  const affordable = input.momentum >= input.cost;
  return {
    phase: !target ? 'lifted' : affordable ? 'over' : 'refused',
    card: input.card,
    at: input.at,
    target,
    cost: input.cost,
    affordable,
  };
}

/**
 * The ghost: the unit as it WOULD stand, on the platform, at half weight.
 *
 * It is drawn in the UNITS layer at the real anchor, so the player sees the
 * actual silhouette in the actual place — not a highlighted rectangle that
 * they then have to imagine a soldier into.
 */
export interface DropGhost {
  readonly world: WorldPoint;
  readonly sprite: string;
  readonly opacity: number;
  /** The unit it would push off the wall, if any. */
  readonly displaces: Unit | null;
}

export function dropGhost(
  drag: DragState,
  unit: Unit,
  towers: readonly Tower[],
): DropGhost | null {
  if (!drag.target || drag.phase === 'idle') return null;
  const existing = towers[drag.target.tower]?.unit ?? null;
  return {
    world: drag.target.world,
    sprite: `unit/${unit.branch}/ghost`,
    opacity: drag.phase === 'refused' ? 0.25 : 0.55,
    displaces: existing,
  };
}
