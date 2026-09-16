import { describe, expect, it } from 'vitest';
import {
  MAX_PRESENTATION_SECONDS, formatBig, planSalvo, scheduleShots,
} from '@/rendering/effects/salvoPresentation';

/**
 * The rule the brief states outright: a hundred volleys must feel far stronger
 * than five without being twenty times slower. That is a testable claim.
 */
describe('volleys become spectacle, not waiting', () => {
  it('a hundred volleys are not twenty times slower than five', () => {
    const five = planSalvo(5);
    const hundred = planSalvo(100);
    expect(hundred.duration / five.duration).toBeLessThan(4);
    // But they are unmistakably more.
    expect(hundred.force).toBeGreaterThan(five.force * 2.5);
    expect(hundred.drawn).toBeGreaterThan(five.drawn);
  });

  it('no presentation ever runs long, however absurd the number', () => {
    for (const n of [1, 5, 15, 50, 100, 1000, 100_000, 1_000_000, 10 ** 9]) {
      expect(planSalvo(n).duration, `${n}`).toBeLessThanOrEqual(MAX_PRESENTATION_SECONDS);
    }
  });

  it('small counts stay literal: one volley, one shot', () => {
    expect(planSalvo(1).drawn).toBe(1);
    expect(planSalvo(3).drawn).toBe(3);
    expect(planSalvo(5).drawn).toBe(5);
    expect(planSalvo(3).aggregateDamage).toBe(false);
  });

  it('big counts aggregate the damage instead of making number soup', () => {
    expect(planSalvo(30).aggregateDamage).toBe(true);
    expect(planSalvo(100).aggregateDamage).toBe(true);
  });

  it('force and drawn shots grow monotonically with the count', () => {
    let previousForce = 0;
    let previousDrawn = 0;
    for (const n of [1, 3, 5, 10, 15, 30, 50, 100, 1000]) {
      const plan = planSalvo(n);
      expect(plan.force, `force at ${n}`).toBeGreaterThanOrEqual(previousForce);
      expect(plan.drawn, `drawn at ${n}`).toBeGreaterThanOrEqual(previousDrawn);
      previousForce = plan.force;
      previousDrawn = plan.drawn;
    }
  });

  it('the five levels are all reachable', () => {
    expect([1, 3, 10, 30, 100].map(n => planSalvo(n).level))
      .toEqual(['single', 'readable', 'accelerated', 'barrage', 'catastrophe']);
  });

  it('a million volleys does not mean a million animations', () => {
    const plan = planSalvo(1_000_000);
    expect(plan.drawn).toBeLessThan(50);
    expect(plan.caption).toContain('SALVEN');
  });
});

describe('the castle fires as a whole', () => {
  it('cycles the shots across the manned towers, building toward the end', () => {
    const shots = scheduleShots(planSalvo(30), [0, 1, 3, 4]);
    expect(new Set(shots.map(s => s.tower))).toEqual(new Set([0, 1, 3, 4]));
    expect(shots[shots.length - 1]!.force).toBeGreaterThan(shots[0]!.force);
    // In order, and inside the plan's own length.
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i]!.at).toBeGreaterThan(shots[i - 1]!.at);
    }
    expect(shots[shots.length - 1]!.at).toBeLessThanOrEqual(MAX_PRESENTATION_SECONDS);
  });

  it('an empty castle schedules nothing rather than crashing', () => {
    expect(scheduleShots(planSalvo(10), [])).toEqual([]);
  });
});

describe('damage reads at every magnitude', () => {
  it('stops treating every point as equally important', () => {
    expect(formatBig(84)).toBe('84');
    expect(formatBig(1234)).toBe('1.234');
    expect(formatBig(18_400)).toBe('18,4K');
    expect(formatBig(2_700_000)).toBe('2,7M');
    expect(formatBig(1_200_000_000)).toBe('1,2B');
  });
});
