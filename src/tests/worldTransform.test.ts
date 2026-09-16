import { describe, expect, it } from 'vitest';

import {
  GRID_COLS, GRID_ROWS, LAYERS, TILE_HEIGHT, TILE_WIDTH, heightBandForRank, layerIndex,
} from '@/rendering/artRules';
import {
  fireDirection, groundDepth, recoilOffset, snap, toScreen, toWorld,
} from '@/rendering/WorldTransform';

/**
 * THE PERSPECTIVE MAY NOT CHANGE.
 *
 * The brief is explicit about it, and a camera change is the kind of thing
 * that looks fine in isolation and wrecks every asset built against the old
 * one. So the projection is checked against the LEGACY formula, verbatim, over
 * the entire grid.
 */

/** Copied from index.html, unchanged, as the thing to be matched. */
const legacyIsoX = (c: number, r: number) => (c - r) * (44 / 2) + 418;
const legacyIsoY = (c: number, r: number) => (c + r) * (22 / 2) + 152;

describe('the projection is the legacy projection', () => {
  it('agrees on every tile of the grid', () => {
    const wrong: string[] = [];
    for (let col = -5; col <= GRID_COLS + 5; col++) {
      for (let row = -5; row <= GRID_ROWS + 5; row++) {
        const mine = toScreen({ col, row });
        if (mine.x !== legacyIsoX(col, row) || mine.y !== legacyIsoY(col, row)) {
          wrong.push(`${col}/${row}: ${mine.x},${mine.y} statt ${legacyIsoX(col, row)},${legacyIsoY(col, row)}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('agrees on fractional positions too', () => {
    for (const [col, row] of [[7.5, 1.5], [0.25, 19.75], [12.125, 6.5]] as const) {
      const mine = toScreen({ col, row });
      expect(mine.x).toBeCloseTo(legacyIsoX(col, row), 10);
      expect(mine.y).toBeCloseTo(legacyIsoY(col, row), 10);
    }
  });

  it('keeps the 2:1 diamond', () => {
    // One tile across is twice one tile down. A one-pixel diagonal is exact,
    // which is why it never has to be dithered.
    expect(TILE_WIDTH).toBe(2 * TILE_HEIGHT);
    const a = toScreen({ col: 0, row: 0 });
    const b = toScreen({ col: 1, row: 0 });
    expect(b.x - a.x).toBe(TILE_WIDTH / 2);
    expect(b.y - a.y).toBe(TILE_HEIGHT / 2);
  });

  it('height lifts a thing off the ground without moving it sideways', () => {
    const ground = toScreen({ col: 7, row: 9 });
    const raised = toScreen({ col: 7, row: 9, height: 40 });
    expect(raised.x).toBe(ground.x);
    expect(ground.y - raised.y).toBe(40);
  });

  it('round-trips a screen point back to its tile', () => {
    for (const point of [{ col: 7, row: 1 }, { col: 0, row: 0 }, { col: 19, row: 19 }]) {
      const back = toWorld(toScreen(point));
      expect(back.col).toBeCloseTo(point.col, 10);
      expect(back.row).toBeCloseTo(point.row, 10);
    }
  });
});

describe('depth and snapping', () => {
  it('sorts back to front along the ground plane', () => {
    expect(groundDepth({ col: 0, row: 0 })).toBeLessThan(groundDepth({ col: 7, row: 9 }));
    expect(groundDepth({ col: 7, row: 9 })).toBe(groundDepth({ col: 9, row: 7 }));
  });

  it('puts a sprite on a whole logical pixel', () => {
    expect(snap({ x: 12.4, y: -3.6 })).toEqual({ x: 12, y: -4 });
  });
});

describe('recoil follows the world, not the screen´s vertical', () => {
  /*
   * The rule the brief singles out: a shot travelling toward the lower right
   * must kick toward the UPPER LEFT. A generic vertical nudge would give the
   * same answer for every direction, which is exactly the bug being removed.
   */
  it('kicks opposite the shot', () => {
    const muzzle = { col: 7, row: 9 };
    const target = { col: 18, row: 12 };      // down and to the right on screen
    const direction = fireDirection(muzzle, target);
    expect(direction.x).toBeGreaterThan(0);
    expect(direction.y).toBeGreaterThan(0);

    const kick = recoilOffset(muzzle, target, 6);
    expect(kick.x).toBeLessThan(0);
    expect(kick.y).toBeLessThan(0);
    expect(Math.hypot(kick.x, kick.y)).toBeCloseTo(6, 10);
  });

  it('gives a different answer for a different direction', () => {
    /*
     * Picking the second target taught me something about the projection:
     * (18,2) looks "upward" on the grid and is still BELOW the muzzle on
     * screen, because screen y follows col + row — 20 against 16. A target
     * that really is up-screen needs a smaller sum, and (12,0) has 12.
     *
     * Which is exactly why recoil is computed from the projection instead of
     * from the grid: the intuition about which way is up is wrong here.
     */
    const muzzle = { col: 7, row: 9 };            // screen y 328
    const down = recoilOffset(muzzle, { col: 18, row: 12 }, 6);   // y 482, below
    const up = recoilOffset(muzzle, { col: 12, row: 0 }, 6);      // y 284, above
    expect(down).not.toEqual(up);
    expect(toScreen({ col: 12, row: 0 }).y).toBeLessThan(toScreen(muzzle).y);
    // Firing up-right on screen means kicking down-left.
    expect(up.x).toBeLessThan(0);
    expect(up.y).toBeGreaterThan(0);
  });

  it('a zero-length shot does not produce NaN', () => {
    expect(recoilOffset({ col: 7, row: 9 }, { col: 7, row: 9 }, 6)).toEqual({ x: -0, y: -0 });
  });
});

describe('the art rules are self-consistent', () => {
  it('layers are ordered, unique and addressable by name', () => {
    expect(new Set(LAYERS).size).toBe(LAYERS.length);
    expect(layerIndex('GROUND')).toBe(0);
    expect(layerIndex('FLOATING_TEXT')).toBe(LAYERS.length - 1);
    expect(layerIndex('UNITS')).toBeLessThan(layerIndex('PROJECTILES'));
    expect(layerIndex('TOWERS')).toBeLessThan(layerIndex('UNITS'));
    expect(layerIndex('UNITS')).toBeLessThan(layerIndex('CASTLE_FRONT'));
  });

  it('every rank falls into exactly one height band', () => {
    const bands = Array.from({ length: 13 }, (_, i) => heightBandForRank(i + 1));
    expect(bands.slice(0, 3).every(b => b === 'militia')).toBe(true);
    expect(bands.slice(3, 9).every(b => b === 'professional')).toBe(true);
    expect(bands.slice(9).every(b => b === 'elite')).toBe(true);
  });
});
