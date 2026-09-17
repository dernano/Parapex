import { PALETTE, TILE_HEIGHT, TILE_WIDTH } from '../artRules';
import { mix, type PlaceholderSprite, type Shape } from '../placeholderAtlas';
import type { WorldPoint } from '../WorldTransform';
import { noise, smoothNoise } from './noise';
import { terrainKind } from './terrain';

/**
 * TREES, BUSHES AND STONES.
 *
 * An empty plain with a castle on it is a diagram. What turns it into a place
 * is the stuff that has nothing to do with the game: a stand of trees at the
 * edge, scrub along a bank, a boulder somebody's grandfather ploughed around.
 *
 * None of it is interactive and none of it is ever in the way — the rules do
 * not know it exists. That is exactly why it is worth having: it is the part
 * of the picture that is there for its own sake, and a battlefield with
 * nothing gratuitous in it reads as a board rather than as ground.
 */

export type SceneryKind = 'tree' | 'bush' | 'stone';

export interface SceneryPiece {
  readonly id: string;
  readonly kind: SceneryKind;
  readonly world: WorldPoint;
  /** 0.8 to 1.25 — no two of anything exactly alike. */
  readonly scale: number;
  readonly variant: number;
}

/**
 * Where nothing may grow.
 *
 * The wall runs down one column and the enemy forms up on another; a tree in
 * either place is a tree the player will try to click. Everything else is
 * fair ground.
 */
function clear(col: number, row: number, keepOut: readonly { col: number; row: number }[]): boolean {
  for (const point of keepOut) {
    if (Math.abs(point.col - col) < 2.5 && Math.abs(point.row - row) < 2.5) return false;
  }
  return true;
}

export interface SceneryOptions {
  readonly cols: number;
  readonly rows: number;
  readonly margin: number;
  /** Tiles that must stay empty: the wall line, the enemy's ground. */
  readonly keepOut: readonly { readonly col: number; readonly row: number }[];
}

/**
 * Scatter the scenery. Deterministic, so the same field grows the same wood
 * every time and a screenshot of it can be compared with yesterday's.
 *
 * It grows DENSER toward the margin. The playing field stays legible and the
 * land beyond it closes the picture, which is what stops the stage from
 * looking like a tabletop floating in black.
 */
export function scatterScenery(options: SceneryOptions): readonly SceneryPiece[] {
  const out: SceneryPiece[] = [];
  const { cols, rows, margin, keepOut } = options;
  let id = 0;

  for (let row = -margin; row < rows + margin; row++) {
    for (let col = -margin; col < cols + margin; col++) {
      if (!clear(col, row, keepOut)) continue;

      const outside = col < 0 || col >= cols || row < 0 || row >= rows;
      const wood = smoothNoise(col + 40, row + 17, 6);
      const roll = noise(col * 3.1 + 5, row * 7.7 + 11);

      // Woodland gathers where the smooth field is high, and thickens outside.
      const chance = (wood > 0.58 ? 0.30 : 0.05) * (outside ? 2.2 : 1);
      if (roll > chance) continue;

      const kind = terrainKind(col, row);
      const what: SceneryKind = roll < chance * 0.45 && wood > 0.5 ? 'tree'
        : kind === 'grass' || kind === 'scrub' ? 'bush' : 'stone';

      out.push({
        id: `scenery-${id++}`,
        kind: what,
        world: {
          col: col + (noise(col * 2.2, row * 1.8) - 0.5) * 0.6,
          row: row + (noise(col * 1.3, row * 2.7) - 0.5) * 0.6,
        },
        scale: 0.8 + noise(col * 9.1, row * 4.3) * 0.45,
        variant: Math.floor(noise(col * 5.5 + 3, row * 6.1 + 8) * 3),
      });
    }
  }
  return out;
}

/* ---------- The drawings ---------- */

const trunk = PALETTE.wood[1]!;

/**
 * A tree: trunk, two or three masses of leaves, one lit edge.
 *
 * Built from overlapping ellipses rather than a silhouette, because the seam
 * between two masses is what makes a canopy read as foliage instead of as a
 * green blob. Three colours: the mass, its lit side, and one dark note under
 * the crown.
 */
export function treeSprite(variant: number, scale: number): PlaceholderSprite {
  const height = Math.round((30 + variant * 5) * scale);
  const width = Math.round(22 * scale);
  const green = PALETTE.grass[variant % 2 === 0 ? 2 : 1]!;
  const lit = mix(green, '#fff4d4', 0.22);
  const dark = mix(green, '#1a1f12', 0.35);
  const cx = width / 2;

  const crown = (dx: number, dy: number, r: number): Shape[] => [
    { kind: 'ellipse', cx: cx + dx, cy: dy, rx: r, ry: r * 0.82, fill: green },
    { kind: 'ellipse', cx: cx + dx + r * 0.28, cy: dy - r * 0.26,
      rx: r * 0.55, ry: r * 0.45, fill: lit },
  ];

  return {
    width, height,
    anchor: { x: cx, y: height },
    shapes: [
      // The shadow it casts, on the ground plane, toward the lower left.
      { kind: 'ellipse', cx: cx - 3 * scale, cy: height - 1,
        rx: 9 * scale, ry: 4 * scale, fill: '#1a1510', alpha: 0.32 },
      { kind: 'rect', x: cx - 1.5 * scale, y: height * 0.55,
        w: 3 * scale, h: height * 0.45, fill: trunk },
      { kind: 'ellipse', cx, cy: height * 0.56, rx: width * 0.34, ry: 5 * scale, fill: dark },
      ...crown(-width * 0.18, height * 0.40, width * 0.30),
      ...crown(width * 0.20, height * 0.34, width * 0.27),
      ...crown(0, height * 0.20, width * 0.32),
    ],
  };
}

/** A bush: one low mass, one lit edge, a few blades escaping the top. */
export function bushSprite(variant: number, scale: number): PlaceholderSprite {
  const width = Math.round(16 * scale);
  const height = Math.round(11 * scale);
  const green = PALETTE.grass[variant % 2 === 0 ? 1 : 0]!;
  return {
    width, height,
    anchor: { x: width / 2, y: height },
    shapes: [
      { kind: 'ellipse', cx: width / 2 - 2, cy: height - 1,
        rx: width * 0.45, ry: 2.5 * scale, fill: '#1a1510', alpha: 0.28 },
      { kind: 'ellipse', cx: width / 2, cy: height * 0.6,
        rx: width * 0.48, ry: height * 0.5, fill: green },
      { kind: 'ellipse', cx: width * 0.6, cy: height * 0.45,
        rx: width * 0.26, ry: height * 0.28, fill: mix(green, '#fff4d4', 0.2) },
      { kind: 'line', points: [[width * 0.4, height * 0.3], [width * 0.34, 0]],
        colour: PALETTE.grass[3]!, width: 1, alpha: 0.7 },
      { kind: 'line', points: [[width * 0.58, height * 0.28], [width * 0.66, 1]],
        colour: PALETTE.grass[3]!, width: 1, alpha: 0.7 },
    ],
  };
}

/** A boulder: three facets, lit from the upper right like everything else. */
export function stoneSprite(variant: number, scale: number): PlaceholderSprite {
  const width = Math.round((10 + variant * 3) * scale);
  const height = Math.round(8 * scale);
  const base = PALETTE.stone[variant % 2 === 0 ? 1 : 2]!;
  return {
    width, height,
    anchor: { x: width / 2, y: height },
    shapes: [
      { kind: 'ellipse', cx: width / 2 - 2, cy: height - 1,
        rx: width * 0.5, ry: 2 * scale, fill: '#1a1510', alpha: 0.3 },
      { kind: 'poly', fill: mix(base, '#3b3566', 0.3), points: [
        [0, height], [width * 0.3, height * 0.2], [width * 0.5, height * 0.35],
        [width * 0.4, height],
      ] },
      { kind: 'poly', fill: base, points: [
        [width * 0.4, height], [width * 0.5, height * 0.35],
        [width * 0.8, height * 0.15], [width, height],
      ] },
      { kind: 'poly', fill: mix(base, '#fff4d4', 0.26), points: [
        [width * 0.3, height * 0.2], [width * 0.8, height * 0.15], [width * 0.5, height * 0.35],
      ] },
    ],
  };
}

export function scenerySprite(kind: SceneryKind, variant: number, scale: number): PlaceholderSprite {
  if (kind === 'tree') return treeSprite(variant, scale);
  if (kind === 'bush') return bushSprite(variant, scale);
  return stoneSprite(variant, scale);
}

/** The tile footprint a piece of scenery covers, for the keep-out check. */
export const SCENERY_FOOTPRINT = { w: TILE_WIDTH, h: TILE_HEIGHT } as const;
