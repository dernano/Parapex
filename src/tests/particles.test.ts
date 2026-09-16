import { describe, expect, it } from 'vitest';
import {
  emptyField, impact, muzzleBurst, spawn, step, type ParticleField,
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
