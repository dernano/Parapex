import { describe, expect, it } from 'vitest';
import {
  MAX_PARTICLE_SIZE, PARTICLE_BUDGET, compress, emptyField, fieldMass, impact,
  muzzleBurst, spawn, step, type ParticleField,
} from '@/rendering/effects/particles';

const AT = { col: 7.5, row: 1.5, height: 78 };
const run = (field: ParticleField, seconds: number, dt = 1 / 60): ParticleField => {
  let out = field;
  for (let t = 0; t < seconds; t += dt) out = step(out, dt);
  return out;
};

describe('smoke is chunky, few and deterministic', () => {
  it('a cannon shot makes a dozen particles, not hundreds', () => {
    const field = muzzleBurst(emptyField(), 'gunner', AT, { col: 1, row: 0 });
    expect(field.particles.length).toBeLessThan(16);
    expect(field.particles.length).toBeGreaterThan(8);
  });

  it('every particle is at least one whole pixel — nothing sub-pixel', () => {
    const field = muzzleBurst(emptyField(), 'gunner', AT, { col: 1, row: 0 });
    for (const p of field.particles) expect(p.size).toBeGreaterThanOrEqual(1);
  });

  it('the same shot makes the same smoke, every time', () => {
    const once = run(muzzleBurst(emptyField('shot'), 'gunner', AT, { col: 1, row: 0 }), 0.5);
    const twice = run(muzzleBurst(emptyField('shot'), 'gunner', AT, { col: 1, row: 0 }), 0.5);
    expect(twice).toEqual(once);
  });

  it('smoke grows and thins, and is gone within two seconds', () => {
    const field = spawn(emptyField(), { kind: 'smoke', at: AT, count: 6 });
    const start = field.particles[0]!;
    const later = step(field, 0.4).particles[0]!;
    expect(later.size).toBeGreaterThan(start.size);
    expect(later.opacity).toBeLessThan(start.opacity);
    expect(run(field, 2).particles).toHaveLength(0);
  });

  it('dead particles are dropped, not hidden — the count is the truth', () => {
    const field = spawn(emptyField(), { kind: 'flash', at: AT, count: 4 });
    expect(run(field, 0.3).particles).toHaveLength(0);
  });

  it('several volleys accumulate smoke over the tower', () => {
    let field = emptyField();
    for (let shot = 0; shot < 4; shot++) {
      field = muzzleBurst(field, 'gunner', AT, { col: 1, row: 0 });
      field = run(field, 0.12);
    }
    const smoke = field.particles.filter(p => p.kind === 'smoke');
    expect(smoke.length).toBeGreaterThan(12);
  });
});

describe('the four weapons leave four different traces', () => {
  it('a bow leaves nothing, a gun leaves flash, smoke and dust', () => {
    const bow = muzzleBurst(emptyField(), 'bow', AT, { col: 1, row: 0 });
    expect(bow.particles).toHaveLength(0);

    const gun = muzzleBurst(emptyField(), 'gunner', AT, { col: 1, row: 0 });
    const kinds = new Set(gun.particles.map(p => p.kind));
    expect(kinds).toEqual(new Set(['flash', 'smoke', 'dust']));
  });

  it('no two weapons produce the same mix', () => {
    const mixes = (['bow', 'crossbow', 'artillery', 'gunner'] as const).map(w =>
      [...new Set(muzzleBurst(emptyField(), w, AT, { col: 1, row: 0 })
        .particles.map(p => p.kind))].sort().join('+'));
    expect(new Set(mixes).size).toBe(4);
  });

  it('the dust a gun kicks up sits on the ground, not at the muzzle', () => {
    const gun = muzzleBurst(emptyField(), 'gunner', AT, { col: 1, row: 0 });
    for (const dust of gun.particles.filter(p => p.kind === 'dust')) {
      expect(dust.at.height!).toBeLessThan(10);
    }
  });
});

describe('the four impacts are four different events', () => {
  it('an arrow makes a chip and a cannonball makes a crater', () => {
    const arrow = impact(emptyField(), 'arrow', AT).particles.length;
    const ball = impact(emptyField(), 'ball', AT).particles.length;
    expect(ball).toBeGreaterThan(arrow * 4);
  });

  it('each profile has its own signature', () => {
    const signatures = (['arrow', 'bolt', 'stone', 'ball'] as const).map(p =>
      [...new Set(impact(emptyField(), p, AT).particles.map(x => x.kind))].sort().join('+'));
    expect(new Set(signatures).size).toBe(4);
  });

  it('only the heaviest impact leaves smoke behind', () => {
    const withSmoke = (['arrow', 'bolt', 'stone', 'ball'] as const)
      .filter(p => impact(emptyField(), p, AT).particles.some(x => x.kind === 'smoke'));
    expect(withSmoke).toEqual(['ball']);
  });

  it('a barrage hits harder than a single shot', () => {
    const one = impact(emptyField(), 'ball', AT, 1).particles;
    const many = impact(emptyField(), 'ball', AT, 3).particles;
    const biggest = (ps: typeof one) => Math.max(...ps.map(p => p.size));
    expect(biggest(many)).toBeGreaterThan(biggest(one));
  });
});

describe('debris behaves like debris', () => {
  it('arcs up and falls back to the ground', () => {
    const field = spawn(emptyField(), { kind: 'debris', at: AT, count: 4 });
    const peak = run(field, 0.2).particles[0]!;
    expect(peak.at.height!).toBeGreaterThan(AT.height);
    const landed = run(field, 0.45).particles[0];
    if (landed) expect(landed.at.height!).toBeLessThan(peak.at.height!);
  });
});

/* ============================================================
 *  Accumulation, and the compression that pays for it
 * ============================================================ */

describe('smoke builds up and then compresses instead of multiplying', () => {
  const at = { col: 7.5, row: 9.5, height: 78 };
  const direction = { col: 1, row: 0 };

  /** A long bombardment: forty cannon shots, with time passing between them. */
  function bombard(shots: number): ParticleField {
    let field = emptyField('bombard');
    for (let i = 0; i < shots; i++) {
      field = muzzleBurst(field, 'gunner', at, direction, 2);
      field = impact(field, 'ball', { col: 18, row: 9 }, 2);
      field = step(field, 0.08);
      field = compress(field);
    }
    return field;
  }

  it('lets the bank grow while there is room', () => {
    const few = bombard(3);
    expect(few.particles.length).toBeLessThanOrEqual(PARTICLE_BUDGET);
    expect(few.particles.length).toBeGreaterThan(10);
  });

  it('never exceeds the budget, however long the bombardment', () => {
    for (const shots of [10, 40, 120]) {
      expect(bombard(shots).particles.length, `${shots} shots`)
        .toBeLessThanOrEqual(PARTICLE_BUDGET);
    }
  });

  /**
   * THE POINT OF THE WHOLE THING. Capping the count is easy — one could just
   * throw particles away. What must not happen is the smoke getting THINNER as
   * the barrage gets heavier, which is exactly what dropping would do.
   */
  it('keeps the visible mass growing after the count has stopped', () => {
    const three = bombard(3);
    const ten = bombard(10);
    const forty = bombard(40);
    expect(forty.particles.length).toBeLessThanOrEqual(PARTICLE_BUDGET);
    expect(fieldMass(ten)).toBeGreaterThan(fieldMass(three));
    expect(fieldMass(forty)).toBeGreaterThan(fieldMass(ten));
  });

  /**
   * And then it LEVELS OFF, which is right rather than a limitation: smoke
   * dies, so a bombardment reaches an equilibrium where new smoke arrives as
   * fast as old smoke thins. What must never happen is the bank getting
   * THINNER the longer the guns fire - the failure the packing above exists to
   * prevent, and the one an ordinary "cap the count" compression walks into.
   */
  it('holds that bank for as long as the guns fire, rather than thinning', () => {
    const forty = fieldMass(bombard(40));
    for (const shots of [60, 90, 120, 200]) {
      expect(fieldMass(bombard(shots)), `${shots} shots`).toBeGreaterThan(forty * 0.9);
    }
  });

  it('conserves area exactly when it merges below the ceiling', () => {
    // Four blocks in one cell. Merged, they must cover the same area: that is
    // the difference between compressing smoke and throwing smoke away.
    const field = spawn(emptyField('cluster'),
      { kind: 'smoke', at: { col: 4, row: 4, height: 0 }, count: 4 });
    const before = fieldMass(field);
    expect(Math.sqrt(before)).toBeLessThan(MAX_PARTICLE_SIZE);

    const after = compress(field, 1);
    expect(after.particles).toHaveLength(1);
    expect(fieldMass(after)).toBeCloseTo(before, 6);
  });

  /**
   * The one place compression is NOT lossless, said out loud rather than
   * hidden: when even packing cannot reach the budget, the faintest blocks are
   * dropped. Those are the ones already on their way out, so the loss lands
   * where the player is least able to see it.
   */
  it('drops the faintest, and only as a last resort', () => {
    let field = emptyField('stack');
    for (let i = 0; i < 40; i++) {
      field = spawn(field, { kind: 'smoke', at: { col: 4, row: 4, height: 0 }, count: 8 });
    }
    const after = compress(field, 1);
    expect(after.particles).toHaveLength(1);
    expect(fieldMass(after)).toBeLessThan(fieldMass(field));
    /*
     * What survived is the block the eye would miss most: opacity times area,
     * not merely the biggest. A large faint puff on its way out is a worse
     * thing to keep than a small solid one that has just arrived.
     */
    const weight = (p: { opacity: number; size: number }): number => p.opacity * p.size * p.size;
    const candidates = compress(field, 40).particles;
    const heaviest = candidates.reduce((a, b) => (weight(b) > weight(a) ? b : a));
    expect(weight(after.particles[0]!)).toBeCloseTo(weight(heaviest), 6);
  });

  it('no single block ever exceeds the ceiling', () => {
    let field = emptyField('stack');
    for (let i = 0; i < 40; i++) {
      field = spawn(field, { kind: 'smoke', at: { col: 4, row: 4, height: 0 }, count: 8 });
      field = compress(field, 30);
    }
    for (const p of field.particles) {
      expect(p.size, p.id).toBeLessThanOrEqual(MAX_PARTICLE_SIZE);
    }
  });

  it('leaves a field that already fits completely untouched', () => {
    const field = spawn(emptyField('small'), {
      kind: 'smoke', at: { col: 2, row: 2 }, count: 6,
    });
    expect(compress(field)).toBe(field);
  });

  it('compresses the same way every time', () => {
    expect(bombard(50).particles.map(p => [p.id, Math.round(p.size)]))
      .toEqual(bombard(50).particles.map(p => [p.id, Math.round(p.size)]));
  });

  it('never produces a block larger than a tower is wide', () => {
    for (const p of bombard(120).particles) {
      expect(p.size, p.id).toBeLessThanOrEqual(MAX_PARTICLE_SIZE);
    }
  });
});
