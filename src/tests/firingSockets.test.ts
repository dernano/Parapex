import { describe, expect, it } from 'vitest';
import { BRANCH_IDS } from '@/content/units/branches';
import { placeholderFor } from '@/rendering/placeholderAtlas';
import { UNIT_VISUALS } from '@/rendering/units/UnitVisual';
import { socketWorld } from '@/rendering/units/firing';
import { toScreen } from '@/rendering/WorldTransform';
import { UNIT_SCALE_PROBES } from '@/rendering/presentation/settings';

/**
 * THE PROJECTILE STARTS AT THE MUZZLE. Never at the sprite's centre, never at
 * its feet, never at the tower's middle — that is what makes an arrow look
 * like it left the bow instead of appearing near a soldier.
 *
 * Which means the conversion from a socket on the sprite to a point in the
 * world has to be right at every size, and it was not: sockets are authored in
 * unscaled pixels while the sprite's box grows with the probe, so a cannon
 * firing at 135 % put its flash several pixels off its own barrel.
 */
describe('a socket lands on the weapon at every size', () => {
  const anchor = { col: 7.5, row: 9.5, height: 70 };

  it('sits above the feet and ahead of them, for every branch', () => {
    for (const branch of BRANCH_IDS) {
      const visual = UNIT_VISUALS[branch];
      const sprite = placeholderFor(`unit/${branch}/professional`);
      const muzzle = socketWorld(anchor, visual.sockets.muzzle, sprite);
      expect(muzzle.height!, `${branch} height`).toBeGreaterThan(anchor.height);
      // Out in front: the muzzle steps forward in columns and back in rows.
      expect(muzzle.col, `${branch} col`).toBeGreaterThan(anchor.col);
      expect(muzzle.row, `${branch} row`).toBeLessThan(anchor.row);
    }
  });

  /**
   * The one the probe exposed. At 100 % the two agreed; at any other size they
   * did not, and a person comparing unit sizes would have been looking at a
   * bug rather than at a size.
   */
  it('stays on the barrel when the figure is drawn larger', () => {
    for (const branch of BRANCH_IDS) {
      const visual = UNIT_VISUALS[branch];
      for (const scale of UNIT_SCALE_PROBES) {
        const sprite = placeholderFor(`unit/${branch}/professional`, { scale });
        const muzzle = socketWorld(anchor, visual.sockets.muzzle, sprite, undefined, scale);
        const feet = toScreen(anchor);
        const at = toScreen(muzzle);

        // Where the renderer's own overlay puts the cross-hair.
        const expectedX = feet.x - sprite.width / 2 + visual.sockets.muzzle.x * scale;
        const expectedY = feet.y - sprite.height + visual.sockets.muzzle.y * scale;
        expect(at.x, `${branch}@${scale} x`).toBeCloseTo(expectedX, 6);
        expect(at.y, `${branch}@${scale} y`).toBeCloseTo(expectedY, 6);
      }
    }
  });

  it('is pushed by the recoil, and the recoil follows the world', () => {
    const visual = UNIT_VISUALS.gunner;
    const sprite = placeholderFor('unit/gunner/elite');
    const still = socketWorld(anchor, visual.sockets.muzzle, sprite);
    const kicked = socketWorld(anchor, visual.sockets.muzzle, sprite, {
      phase: 'recoil', phaseProgress: 0.2, draw: 0,
      recoil: { x: -8, y: -4 }, effect: undefined, released: false, finished: false,
    });
    expect(kicked.col).not.toBe(still.col);
    expect(kicked.height!).toBeGreaterThan(still.height!);
  });
});
