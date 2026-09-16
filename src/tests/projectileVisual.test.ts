import { describe, expect, it } from 'vitest';
import {
  MIN_SILHOUETTE_AREA, PROJECTILE_VISUALS, TERRAIN_COLOURS, contrastRatio,
  luminance, silhouetteArea, straddlesTerrain, visualForProjectile,
} from '@/rendering/effects/projectileVisual';

const KINDS = ['arrow', 'bolt', 'stone', 'ball'] as const;

/**
 * A shot the player cannot follow is a shot that did not happen. These are the
 * three rules that keep that from being a matter of opinion.
 */
describe('a shot has to be visible at the zoom people play at', () => {
  it('is never a speck', () => {
    for (const kind of KINDS) {
      expect(silhouetteArea(PROJECTILE_VISUALS[kind]), kind)
        .toBeGreaterThanOrEqual(MIN_SILHOUETTE_AREA);
    }
  });

  /**
   * The rule that does the real work: a dark outline BELOW every ground
   * colour and a light core ABOVE the midpoint. Between them the silhouette
   * survives whatever it flies over, without anybody hand-checking the
   * combinations.
   */
  it('straddles the terrain, so no tile can swallow it', () => {
    for (const kind of KINDS) {
      expect(straddlesTerrain(PROJECTILE_VISUALS[kind]), kind).toBe(true);
    }
  });

  it('has real contrast inside itself, not just against the ground', () => {
    for (const kind of KINDS) {
      const visual = PROJECTILE_VISUALS[kind];
      expect(contrastRatio(visual.core, visual.outline), kind).toBeGreaterThan(2.5);
    }
  });

  it('keeps its outline darker than every single terrain colour', () => {
    for (const kind of KINDS) {
      const outline = luminance(PROJECTILE_VISUALS[kind].outline);
      for (const ground of TERRAIN_COLOURS) {
        expect(outline, `${kind} on ${ground}`).toBeLessThan(luminance(ground));
      }
    }
  });
});

describe('shape carries meaning', () => {
  it('turns the ones that fly along their own line and not the ones that tumble', () => {
    expect(PROJECTILE_VISUALS.arrow.oriented).toBe(true);
    expect(PROJECTILE_VISUALS.bolt.oriented).toBe(true);
    // A cast ball and a rough stone have no axis to point along.
    expect(PROJECTILE_VISUALS.stone.oriented).toBe(false);
    expect(PROJECTILE_VISUALS.ball.oriented).toBe(false);
  });

  it('makes the arrow long and thin and the stone heavy', () => {
    const arrow = PROJECTILE_VISUALS.arrow;
    expect(arrow.length / arrow.width).toBeGreaterThan(3);
    const stone = PROJECTILE_VISUALS.stone;
    expect(stone.length / stone.width).toBeLessThan(1.5);
    expect(silhouetteArea(stone)).toBeGreaterThan(silhouetteArea(arrow));
  });

  it('gives the fast ones a trail and the slow one none', () => {
    // The stone is in the air long enough to be watched; it needs no smear.
    expect(PROJECTILE_VISUALS.stone.trail).toBe(0);
    expect(PROJECTILE_VISUALS.bolt.trail).toBeGreaterThan(PROJECTILE_VISUALS.arrow.trail);
  });

  it('sizes the ground shadow to the mass that casts it', () => {
    expect(PROJECTILE_VISUALS.stone.shadowScale)
      .toBeGreaterThan(PROJECTILE_VISUALS.arrow.shadowScale);
  });

  it('falls back to something drawable rather than to nothing', () => {
    expect(visualForProjectile('there-is-no-such-weapon').kind).toBe('arrow');
  });
});
