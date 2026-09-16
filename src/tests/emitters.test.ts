import { describe, expect, it } from 'vitest';
import type { BranchId } from '@/core/types';
import {
  ALL_EMITTERS, IMPACT_EMITTERS, MUZZLE_EMITTERS, emit, impactEmitter,
  muzzleEmitter, particleCost,
} from '@/rendering/effects/emitters';
import { emptyField } from '@/rendering/effects/particles';
import { ALL_EFFECTS, DEFAULT_PRESENTATION, NO_EFFECTS } from '@/rendering/presentation/settings';

const AT = { col: 7.5, row: 1.5, height: 78 };
const DIRECTION = { col: 1, row: 0 };
const BRANCHES: readonly BranchId[] = ['bow', 'crossbow', 'artillery', 'gunner'];

describe('effects are recipes, not functions', () => {
  it('names every emitter, so the workbench can fire each one alone', () => {
    expect(ALL_EMITTERS.length).toBe(
      Object.keys(MUZZLE_EMITTERS).length + Object.keys(IMPACT_EMITTERS).length);
    for (const emitter of ALL_EMITTERS) {
      expect(emitter.id, emitter.displayName).toMatch(/^(muzzle|impact)\//);
      expect(emitter.displayName.length).toBeGreaterThan(3);
    }
  });

  it('gives each branch and each projectile its own recipe', () => {
    for (const branch of BRANCHES) {
      expect(muzzleEmitter(branch).id, branch).toBe(`muzzle/${branch}`);
    }
    for (const kind of ['arrow', 'bolt', 'stone', 'ball']) {
      expect(impactEmitter(kind).id).toBe(`impact/${kind}`);
    }
  });

  it('falls back to something drawable when asked for a weapon nobody has', () => {
    expect(impactEmitter('trebuchet-of-the-moon').id).toBe('impact/arrow');
  });
});

describe('the muzzle', () => {
  it('gives a bow nothing to burn and a cannon everything', () => {
    expect(MUZZLE_EMITTERS.bow.bursts).toHaveLength(0);
    const gunner = MUZZLE_EMITTERS.gunner.bursts.map(b => b.kind);
    expect(gunner).toContain('flash');
    expect(gunner).toContain('smoke');
    expect(gunner).toContain('dust');
  });

  /** The brief: the flash is stronger for cannons. That is a number. */
  it('flashes harder for a cannon than anything else flashes at all', () => {
    const cannonFlash = MUZZLE_EMITTERS.gunner.bursts.find(b => b.kind === 'flash')!;
    expect(cannonFlash.force).toBeGreaterThan(1.5);
    for (const branch of BRANCHES) {
      if (branch === 'gunner') continue;
      expect(MUZZLE_EMITTERS[branch].bursts.some(b => b.kind === 'flash'), branch).toBe(false);
    }
  });

  it('no two branches leave the same trace', () => {
    const signatures = BRANCHES.map(b =>
      MUZZLE_EMITTERS[b].bursts.map(x => x.kind).sort().join('+'));
    expect(new Set(signatures).size).toBe(BRANCHES.length);
  });

  /**
   * The dust is kicked off the PLANKING the carriage is bolted to, not off
   * thin air beside the barrel. That difference is whether the machine has
   * weight.
   */
  it('kicks its dust at the contact point, on the ground', () => {
    const field = emit(emptyField('m'), MUZZLE_EMITTERS.gunner,
      { at: AT, direction: DIRECTION });
    const dust = field.particles.filter(p => p.kind === 'dust');
    expect(dust.length).toBeGreaterThan(0);
    for (const p of dust) expect(p.at.height!).toBeLessThan(4);

    // While the flash stays up at the muzzle where the socket put it.
    for (const p of field.particles.filter(x => x.kind === 'flash')) {
      expect(p.at.height!).toBeGreaterThan(70);
    }
  });
});

describe('the four impacts', () => {
  it('each has its own signature', () => {
    const signatures = ['arrow', 'bolt', 'stone', 'ball'].map(k =>
      IMPACT_EMITTERS[k]!.bursts.map(b => `${b.kind}:${b.count}`).join('+'));
    expect(new Set(signatures).size).toBe(4);
  });

  it('only the heaviest leaves smoke hanging afterwards', () => {
    for (const kind of ['arrow', 'bolt', 'stone']) {
      expect(IMPACT_EMITTERS[kind]!.bursts.some(b => b.kind === 'smoke'), kind).toBe(false);
    }
    expect(IMPACT_EMITTERS.ball!.bursts.some(b => b.kind === 'smoke')).toBe(true);
  });

  it('grows in weight from arrow to cannonball', () => {
    const costs = ['arrow', 'bolt', 'stone', 'ball']
      .map(k => particleCost(IMPACT_EMITTERS[k]!));
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    }
  });
});

describe('the effect toggles reach all the way down', () => {
  /**
   * A disabled effect is never SPAWNED, not spawned-and-hidden. That is the
   * difference between an accessibility option and a decoration: turning smoke
   * off has to actually cost nothing.
   */
  it('emits nothing at all when everything is off', () => {
    const settings = { ...DEFAULT_PRESENTATION, effects: NO_EFFECTS };
    const field = emit(emptyField('off'), MUZZLE_EMITTERS.gunner,
      { at: AT, direction: DIRECTION, settings });
    expect(field.particles).toHaveLength(0);
  });

  it('switches one kind off and leaves the rest alone', () => {
    const settings = {
      ...DEFAULT_PRESENTATION, effects: { ...ALL_EFFECTS, smoke: false },
    };
    const field = emit(emptyField('one'), MUZZLE_EMITTERS.gunner,
      { at: AT, direction: DIRECTION, settings });
    expect(field.particles.some(p => p.kind === 'smoke')).toBe(false);
    expect(field.particles.some(p => p.kind === 'flash')).toBe(true);
  });

  it('pushes harder at a barrage than at a single shot', () => {
    const one = emit(emptyField('f'), MUZZLE_EMITTERS.gunner, { at: AT, force: 1 });
    const many = emit(emptyField('f'), MUZZLE_EMITTERS.gunner, { at: AT, force: 3 });
    expect(many.particles.length).toBeGreaterThan(one.particles.length);
  });

  it('is deterministic: the same emitter twice is the same smoke twice', () => {
    const a = emit(emptyField('same'), MUZZLE_EMITTERS.gunner, { at: AT, direction: DIRECTION });
    const b = emit(emptyField('same'), MUZZLE_EMITTERS.gunner, { at: AT, direction: DIRECTION });
    expect(a.particles).toEqual(b.particles);
  });
});
