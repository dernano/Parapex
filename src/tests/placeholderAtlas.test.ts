import { describe, expect, it } from 'vitest';
import { BRANCH_IDS } from '@/content/units/branches';
import { UNIT_HEIGHT } from '@/rendering/artRules';
import {
  PARAPET_RISE, drawnBounds, placeholderFor, unitFigure,
} from '@/rendering/placeholderAtlas';
import { UNIT_SCALE_PROBES } from '@/rendering/presentation/settings';
import { UNIT_VISUALS } from '@/rendering/units/UnitVisual';

/**
 * The placeholders are scaffolding and are meant to be deleted. What they are
 * NOT allowed to be is misleading — a placeholder that contradicts the data the
 * game actually uses teaches the wrong lesson and hides real faults.
 */

describe('every muzzle socket lands on a weapon', () => {
  /**
   * The screenshot that prompted this: a cannon's muzzle socket sits at x = 17
   * on a figure fourteen pixels wide, so the flash appeared in mid-air beside
   * a soldier and looked broken — when in fact the socket was right and the
   * placeholder had no barrel for it to sit on.
   */
  it('draws a weapon that reaches the socket, for every branch', () => {
    for (const branch of BRANCH_IDS) {
      const visual = UNIT_VISUALS[branch];
      const sprite = unitFigure(branch, 'professional', 1);
      const weapon = sprite.shapes[0]!;
      expect(weapon.kind, branch).toBe('rect');
      if (weapon.kind !== 'rect') continue;

      const muzzle = visual.sockets.muzzle;
      const left = weapon.x;
      const right = weapon.x + weapon.w;
      expect(muzzle.x, `${branch} muzzle x`).toBeGreaterThanOrEqual(left - 1);
      expect(muzzle.x, `${branch} muzzle x`).toBeLessThanOrEqual(right + 1);
    }
  });

  /** One table. The atlas must not grow a second, disagreeing set. */
  it('keeps the sockets in exactly one place', () => {
    for (const branch of BRANCH_IDS) {
      expect(unitFigure(branch, 'elite', 1).sockets, branch).toBeUndefined();
    }
  });
});

describe('the placeholders obey the rules they are checking', () => {
  it('draws every band and every probe at whole pixels', () => {
    for (const scale of UNIT_SCALE_PROBES) {
      for (const band of Object.keys(UNIT_HEIGHT) as (keyof typeof UNIT_HEIGHT)[]) {
        const sprite = unitFigure('bow', band, scale);
        expect(Number.isInteger(sprite.height), `${band}@${scale}`).toBe(true);
        expect(Number.isInteger(sprite.width), `${band}@${scale}`).toBe(true);
        for (const shape of sprite.shapes) {
          if (shape.kind !== 'rect') continue;
          for (const value of [shape.x, shape.y, shape.w, shape.h]) {
            expect(Number.isInteger(value), `${band}@${scale} ${JSON.stringify(shape)}`).toBe(true);
          }
        }
      }
    }
  });

  it('keeps the parapet a rim rather than a wall', () => {
    const parapet = placeholderFor('castle/parapet-powderTower');
    // It stands eleven pixels down-screen of the figure's feet, so anything
    // much taller than this covers the soldier entirely.
    expect(parapet.height).toBeLessThan(26);
    expect(PARAPET_RISE).toBeLessThan(14);
  });

  it('resolves every sprite family the scene can name', () => {
    for (const sprite of [
      'ground/0', 'castle/wall', 'castle/tower-watchtower',
      'castle/parapet-cannonTower', 'unit/bow/militia', 'enemy/infantry',
      'projectile/ball', 'formation/standardLine', 'formation/connector',
      'fx/contact-shadow',
    ]) {
      const placeholder = placeholderFor(sprite);
      expect(placeholder.width, sprite).toBeGreaterThan(0);
      expect(placeholder.height, sprite).toBeGreaterThan(0);
    }
  });
});

/**
 * THE FIGURE FILLS ITS BOX.
 *
 * It used not to: the layout was measured from the bottom, which left five
 * pixels of dead air above the helmet and drew a 27-pixel soldier 22 pixels
 * tall. The unit-scale probe found it — 125 % of the placeholder came out at
 * exactly the height the bible already specifies — and the sockets had been
 * quietly compensating for it ever since.
 */
describe('a soldier is as tall as he says he is', () => {
  it('draws the full declared height, at every band and every probe', () => {
    for (const scale of UNIT_SCALE_PROBES) {
      for (const band of ['militia', 'professional', 'elite'] as const) {
        const sprite = unitFigure('bow', band, scale);
        const bounds = drawnBounds(sprite);
        expect(bounds.bottom, `${band}@${scale} feet`).toBe(0);
        expect(-bounds.top, `${band}@${scale} height`).toBe(sprite.height);
      }
    }
  });

  it('keeps the bands apart once they are actually drawn', () => {
    for (const scale of UNIT_SCALE_PROBES) {
      const heights = (['militia', 'professional', 'elite'] as const)
        .map(band => unitFigure('bow', band, scale).height);
      expect(heights[0]!, `${scale}`).toBeLessThan(heights[1]!);
      expect(heights[1]!, `${scale}`).toBeLessThan(heights[2]!);
    }
  });

  it('puts the muzzle socket inside the figure it belongs to', () => {
    for (const branch of BRANCH_IDS) {
      const sprite = unitFigure(branch, 'professional', 1);
      const muzzle = UNIT_VISUALS[branch].sockets.muzzle;
      // Vertically on the body, not floating above the helmet or below the
      // boots. Horizontally it may project past the silhouette — a barrel does.
      expect(muzzle.y, `${branch}`).toBeGreaterThan(0);
      expect(muzzle.y, `${branch}`).toBeLessThan(sprite.height);
    }
  });
});
