import { describe, expect, it } from 'vitest';

import { BRANCH_IDS } from '@/content/units/branches';
import { UNIT_HEIGHT } from '@/rendering/artRules';
import { toScreen } from '@/rendering/WorldTransform';
import {
  UNIT_VISUALS, equipmentForRank, firingDuration, visualFor,
} from '@/rendering/units/UnitVisual';
import { muzzlePosition, poseAt, projectileAt, releaseTime } from '@/rendering/units/firing';

/**
 * Firing, tested without watching it.
 *
 * The rules the brief singles out — feet planted, recoil along the world,
 * projectiles from the muzzle — are exactly the ones that are easy to get
 * wrong and hard to notice. Here they are assertions.
 */

const TOWER = { col: 7.5, row: 1.5, height: 78 };
const ENEMY = { col: 18, row: 9 };

describe('every branch has its own firing character', () => {
  it('all four are defined, and no two read the same', () => {
    for (const branch of BRANCH_IDS) expect(visualFor(branch)).toBeDefined();
    const shapes = BRANCH_IDS.map(b => UNIT_VISUALS[b].phases.map(p => p.name).join('-'));
    expect(new Set(shapes).size).toBe(4);
  });

  it('they differ in length, speed and arc — not just in name', () => {
    const durations = BRANCH_IDS.map(b => firingDuration(UNIT_VISUALS[b]));
    const speeds = BRANCH_IDS.map(b => UNIT_VISUALS[b].projectileSpeed);
    const arcs = BRANCH_IDS.map(b => UNIT_VISUALS[b].projectileArc);
    expect(new Set(durations).size).toBe(4);
    expect(new Set(speeds).size).toBe(4);
    expect(new Set(arcs).size).toBe(4);
  });

  it('reads the way the families are meant to', () => {
    // The gunner kicks hardest; the bow is the quickest; the stone loops highest.
    const kick = (b: typeof BRANCH_IDS[number]) =>
      Math.max(...UNIT_VISUALS[b].phases.map(p => p.recoil ?? 0));
    expect(kick('gunner')).toBeGreaterThan(kick('crossbow'));
    expect(kick('crossbow')).toBeGreaterThan(kick('bow'));
    expect(firingDuration(UNIT_VISUALS.bow))
      .toBeLessThan(firingDuration(UNIT_VISUALS.artillery));
    expect(UNIT_VISUALS.artillery.projectileArc)
      .toBeGreaterThan(UNIT_VISUALS.gunner.projectileArc);
  });

  it('every family releases its shot exactly once, inside its own action', () => {
    for (const branch of BRANCH_IDS) {
      const definition = UNIT_VISUALS[branch];
      const at = releaseTime(definition);
      expect(at, branch).not.toBeNull();
      expect(at!).toBeGreaterThan(0);
      expect(at!).toBeLessThan(firingDuration(definition));

      // Stepping through the action must report the release on one step only.
      let count = 0;
      const step = 1 / 240;
      for (let t = 0; t <= firingDuration(definition) + step; t += step) {
        if (poseAt(definition, t, { from: TOWER, to: ENEMY, since: t - step }).released) count++;
      }
      expect(count, branch).toBe(1);
    }
  });
});

describe('the feet stay planted', () => {
  /*
   * The rule the whole brief keeps returning to. A pose carries a weapon kick
   * and nothing else — there is no field in it that could move the unit, which
   * is the strongest form of the guarantee: not "we remember not to", but
   * "there is nothing to move it with".
   */
  it('a pose has no body offset at all, in any phase, for any family', () => {
    for (const branch of BRANCH_IDS) {
      const definition = UNIT_VISUALS[branch];
      for (let t = 0; t <= firingDuration(definition); t += 0.01) {
        const pose = poseAt(definition, t, { from: TOWER, to: ENEMY });
        expect(Object.keys(pose).sort()).toEqual(
          ['draw', 'effect', 'finished', 'phase', 'phaseProgress', 'recoil', 'released']);
      }
    }
  });

  it('the recoil never grows past its phase´s strength', () => {
    for (const branch of BRANCH_IDS) {
      const definition = UNIT_VISUALS[branch];
      const strongest = Math.max(...definition.phases.map(p => p.recoil ?? 0));
      for (let t = 0; t <= firingDuration(definition); t += 0.005) {
        const pose = poseAt(definition, t, { from: TOWER, to: ENEMY });
        expect(Math.hypot(pose.recoil.x, pose.recoil.y)).toBeLessThanOrEqual(strongest + 1e-9);
      }
    }
  });
});

describe('recoil follows the world', () => {
  it('kicks opposite the shot, and sideways differs by target', () => {
    /*
     * Writing this taught me something about the geometry, and it is worth
     * keeping: from a platform 78 pixels up, EVERY ground target is below the
     * muzzle on screen. So the vertical component of the recoil is always
     * upward, for every shot a tower ever fires.
     *
     * What varies is sideways, and it varies by sign — which is precisely what
     * a generic vertical nudge cannot do, and precisely why the kick is
     * derived from the projection.
     */
    const definition = UNIT_VISUALS.gunner;
    const at = releaseTime(definition)!;

    const toTheSouth = poseAt(definition, at, { from: TOWER, to: { col: 18, row: 14 } });
    const toTheEast = poseAt(definition, at, { from: TOWER, to: { col: 14, row: 0 } });

    // Both shots travel downward on screen, so both kicks point up.
    expect(toTheSouth.recoil.y).toBeLessThan(0);
    expect(toTheEast.recoil.y).toBeLessThan(0);

    // And they lean to opposite sides. One value could never do this.
    expect(toTheSouth.recoil.x).toBeGreaterThan(0);
    expect(toTheEast.recoil.x).toBeLessThan(0);
  });

  it('a shot that really is up-screen kicks downward', () => {
    // It takes a target in the far corner, because the platform is high — but
    // the rule holds, and the day a unit fires from the ground it will matter.
    const definition = UNIT_VISUALS.gunner;
    const ground = { col: 7.5, row: 1.5 };
    const pose = poseAt(definition, releaseTime(definition)!,
      { from: ground, to: { col: 8, row: 0 } });
    expect(toScreen({ col: 8, row: 0 }).y).toBeLessThan(toScreen(ground).y);
    expect(pose.recoil.y).toBeGreaterThan(0);
  });

  it('a bow barely moves and a gun shoves', () => {
    const shot = { from: TOWER, to: ENEMY };
    const bow = poseAt(UNIT_VISUALS.bow, releaseTime(UNIT_VISUALS.bow)!, shot);
    const gun = poseAt(UNIT_VISUALS.gunner, releaseTime(UNIT_VISUALS.gunner)!, shot);
    expect(Math.hypot(gun.recoil.x, gun.recoil.y))
      .toBeGreaterThan(Math.hypot(bow.recoil.x, bow.recoil.y) * 2);
  });
});

describe('projectiles leave the muzzle', () => {
  it('not the feet, not the sprite´s centre, not the tower´s middle', () => {
    const definition = UNIT_VISUALS.bow;
    const pose = poseAt(definition, releaseTime(definition)!, { from: TOWER, to: ENEMY });
    const muzzle = muzzlePosition(definition, TOWER, pose);
    const feet = toScreen(TOWER);

    // Out in front, and well above the feet.
    expect(muzzle.x).toBeGreaterThan(feet.x);
    expect(muzzle.y).toBeLessThan(feet.y - 10);
  });

  it('each family´s muzzle sits somewhere different', () => {
    const places = BRANCH_IDS.map(branch => {
      const definition = UNIT_VISUALS[branch];
      const pose = poseAt(definition, 0, { from: TOWER, to: ENEMY });
      const m = muzzlePosition(definition, TOWER, pose);
      return `${m.x},${m.y}`;
    });
    expect(new Set(places).size).toBe(4);
  });

  it('a shot travels from the muzzle to the target and lands', () => {
    const definition = UNIT_VISUALS.artillery;
    const start = projectileAt(definition, TOWER, ENEMY, 0);
    expect(start.col).toBeCloseTo(TOWER.col, 6);
    expect(start.done).toBe(false);

    const distance = Math.hypot(ENEMY.col - TOWER.col, ENEMY.row - TOWER.row);
    const end = projectileAt(definition, TOWER, ENEMY, distance / definition.projectileSpeed);
    expect(end.col).toBeCloseTo(ENEMY.col, 6);
    expect(end.row).toBeCloseTo(ENEMY.row, 6);
    expect(end.done).toBe(true);
  });

  it('a stone loops far higher than a cannonball', () => {
    const half = (branch: 'artillery' | 'gunner') => {
      const d = UNIT_VISUALS[branch];
      const distance = Math.hypot(ENEMY.col - TOWER.col, ENEMY.row - TOWER.row);
      return projectileAt(d, TOWER, ENEMY, distance / d.projectileSpeed / 2).height ?? 0;
    };
    expect(half('artillery')).toBeGreaterThan(half('gunner') * 2);
  });
});

describe('rank is equipment, never size', () => {
  it('progresses through armour, helmet and weapon', () => {
    expect(equipmentForRank(1).armour).toBe('none');
    expect(equipmentForRank(5).armour).toBe('padded');
    expect(equipmentForRank(8).armour).toBe('mail');
    expect(equipmentForRank(13).armour).toBe('plated');
    expect(equipmentForRank(13).helmet).toBe('crested');
    expect(equipmentForRank(13).weapon).toBe('master');
  });

  it('heraldry appears at veteran rank and stays', () => {
    expect(equipmentForRank(6).heraldry).toBe(false);
    for (let rank = 7; rank <= 13; rank++) expect(equipmentForRank(rank).heraldry).toBe(true);
  });

  it('the thirteen ranks span only three height bands, and the bands barely differ', () => {
    // A rank 13 is not a bigger rank 1. Six pixels across the whole ladder.
    const lowest = UNIT_HEIGHT[equipmentForRank(1).band];
    const highest = UNIT_HEIGHT[equipmentForRank(13).band];
    expect(highest[1] - lowest[0]).toBeLessThanOrEqual(6);
  });
});
