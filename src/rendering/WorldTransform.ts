import {
  GRID_COLS, GRID_ROWS, STAGE_HEIGHT, STAGE_WIDTH, TILE_HEIGHT, TILE_WIDTH,
} from './artRules';

/**
 * World to screen, in ONE place.
 *
 * The legacy tree computed `isoX` and `isoY` in one module and then scattered
 * hand-authored x/y offsets through every drawing function, so a change to the
 * camera meant hunting them down. Units, projectiles and effects here know a
 * WORLD POSITION; where that lands on screen is this module's business alone.
 *
 * The projection itself is unchanged and must stay unchanged — the brief is
 * explicit, and `worldTransform.test.ts` compares it against the legacy formula
 * over the whole grid.
 */

/** A point on the ground plane, in tiles. Fractional positions are fine. */
export interface WorldPoint {
  readonly col: number;
  readonly row: number;
  /** Height above the ground plane, in logical pixels. Ground is 0. */
  readonly height?: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the grid's origin sits on the stage.
 *
 * The legacy tree recomputes this when the window resizes; the numbers below
 * are its values for the 960 × 768 stage, and `originFor` reproduces the same
 * arithmetic for any stage size.
 */
export interface Camera {
  readonly originX: number;
  readonly originY: number;
}

/** What the legacy leaves above the field before the first row. */
const FIELD_ABOVE = 64;

export function originFor(
  stageWidth = STAGE_WIDTH,
  stageHeight = STAGE_HEIGHT,
): Camera {
  const fieldLeft = GRID_ROWS * TILE_WIDTH / 2;
  const fieldRight = GRID_COLS * TILE_WIDTH / 2;
  const fieldHeight = FIELD_ABOVE + (GRID_COLS + GRID_ROWS - 2) * TILE_HEIGHT / 2 + 34;
  return {
    originX: Math.round(stageWidth / 2 + (fieldLeft - fieldRight) / 2),
    originY: Math.round(10 + (stageHeight - 196 - fieldHeight) / 2 + FIELD_ABOVE),
  };
}

export const DEFAULT_CAMERA: Camera = { originX: 418, originY: 152 };

/**
 * The projection. Two lines, and everything else in the renderer depends on
 * them rather than on a number somebody measured off a screenshot once.
 */
export function toScreen(point: WorldPoint, camera: Camera = DEFAULT_CAMERA): ScreenPoint {
  return {
    x: (point.col - point.row) * (TILE_WIDTH / 2) + camera.originX,
    y: (point.col + point.row) * (TILE_HEIGHT / 2) + camera.originY - (point.height ?? 0),
  };
}

/** The inverse, for turning a click back into a tile. */
export function toWorld(screen: ScreenPoint, camera: Camera = DEFAULT_CAMERA): WorldPoint {
  const dx = (screen.x - camera.originX) / (TILE_WIDTH / 2);
  const dy = (screen.y - camera.originY) / (TILE_HEIGHT / 2);
  return { col: (dx + dy) / 2, row: (dy - dx) / 2 };
}

/**
 * Depth on the ground plane: back to front. Ties are broken deterministically,
 * so the same state always produces the same order — a renderer that sorts
 * unstably flickers, and the flicker is impossible to reproduce in a report.
 */
export function groundDepth(point: WorldPoint): number {
  return point.col + point.row;
}

/**
 * A sprite lands on a whole logical pixel. Half-pixel placement is the other
 * way pixel art turns to mush, after non-integer scaling.
 */
export function snap(point: ScreenPoint): ScreenPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

/**
 * The direction a shot travels, in SCREEN space, normalised.
 *
 * Recoil is the opposite of this. It is computed from the projection rather
 * than guessed, which is why a gun firing toward the lower right recoils toward
 * the upper left instead of simply nudging upward.
 */
export function fireDirection(
  from: WorldPoint,
  to: WorldPoint,
  camera: Camera = DEFAULT_CAMERA,
): ScreenPoint {
  const a = toScreen(from, camera);
  const b = toScreen(to, camera);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

/** Where a weapon kicks: opposite the shot, by the weapon family's strength. */
export function recoilOffset(
  from: WorldPoint,
  to: WorldPoint,
  strength: number,
  camera: Camera = DEFAULT_CAMERA,
): ScreenPoint {
  const direction = fireDirection(from, to, camera);
  return { x: -direction.x * strength, y: -direction.y * strength };
}
