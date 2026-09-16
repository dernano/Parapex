import { describe, expect, it } from 'vitest';
import {
  MAX_PRESENTATION_SECONDS, SALVO_TIERS, formatBig, planSalvo, scheduleShots,
  tierFor,
} from '@/rendering/effects/salvoPresentation';

/**
 * The rule the brief states outright: a hundred volleys must feel far stronger
 * than five without being twenty times slower. That is a testable claim, and
 * so is the harder one underneath it — that escalation is more than speed.
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

  it('a million volleys does not mean a million animations', () => {
    const plan = planSalvo(1_000_000);
    expect(plan.drawn).toBeLessThan(50);
    expect(plan.caption).toContain('Vernichtung');
  });

  it('nothing to fire is not an empty animation, it is no animation', () => {
    const plan = planSalvo(0);
    expect(plan.drawn).toBe(0);
    expect(plan.duration).toBe(0);
    expect(scheduleShots(plan, [0, 1, 2])).toEqual([]);
  });
});

/**
 * The brief's own boundaries, and the claim they encode: the player should be
 * able to FEEL which tier they are in.
 */
describe('the five tiers are the brief\'s', () => {
  it('covers 1-5, 6-15, 16-50, 51-250, 251+ with no gap and no overlap', () => {
    expect(SALVO_TIERS.map(t => [t.from, t.to]))
      .toEqual([[1, 5], [6, 15], [16, 50], [51, 250], [251, null]]);
    for (let i = 1; i < SALVO_TIERS.length; i++) {
      expect(SALVO_TIERS[i]!.from).toBe(SALVO_TIERS[i - 1]!.to! + 1);
    }
  });

  it('puts each boundary count in the tier that claims it', () => {
    expect([1, 5, 6, 15, 16, 50, 51, 250, 251, 10_000].map(n => tierFor(n).id))
      .toEqual(['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E']);
  });

  /**
   * THE IMPORTANT ONE. A tier that merely runs the same animation faster is a
   * tier the player cannot distinguish. Every escalation dimension has to
   * grow, and the ones that are booleans have to switch on and stay on.
   */
  it('escalates in every dimension, not just in speed', () => {
    const dimensions = ['smoke', 'impact', 'shake', 'simultaneous'] as const;
    for (const dimension of dimensions) {
      const values = SALVO_TIERS.map(t => t.escalation[dimension]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]!, `${dimension} ${SALVO_TIERS[i]!.id}`)
          .toBeGreaterThanOrEqual(values[i - 1]!);
      }
      // And it must actually move across the range, not merely fail to shrink.
      expect(values[values.length - 1]!, dimension).toBeGreaterThan(values[0]!);
    }

    for (const flag of ['screenFlash', 'groundScar', 'continuousRoar'] as const) {
      const values = SALVO_TIERS.map(t => t.escalation[flag]);
      expect(values[0], flag).toBe(false);
      expect(values[values.length - 1], flag).toBe(true);
      // Once on, never off again.
      let on = false;
      for (const value of values) {
        if (value) on = true;
        else expect(on, flag).toBe(false);
      }
    }
  });

  it('gets faster as well, but that is the least of it', () => {
    const intervals = SALVO_TIERS.map(t => t.interval);
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]!).toBeLessThan(intervals[i - 1]!);
    }
  });
});

describe('the castle fires as a whole', () => {
  it('cycles the shots across the manned towers, building toward the end', () => {
    const shots = scheduleShots(planSalvo(30), [0, 1, 3, 4]);
    expect(new Set(shots.map(s => s.tower))).toEqual(new Set([0, 1, 3, 4]));
    expect(shots[shots.length - 1]!.force).toBeGreaterThan(shots[0]!.force);
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i]!.at).toBeGreaterThanOrEqual(shots[i - 1]!.at);
    }
    expect(shots[shots.length - 1]!.at).toBeLessThanOrEqual(MAX_PRESENTATION_SECONDS);
    expect(shots.filter(s => s.last)).toHaveLength(1);
  });

  it('at tier A the towers take turns; at tier D they speak together', () => {
    const solo = scheduleShots(planSalvo(4), [0, 1, 2, 3, 4]);
    // Four separate moments.
    expect(new Set(solo.map(s => s.at)).size).toBe(4);

    const together = scheduleShots(planSalvo(120), [0, 1, 2, 3, 4]);
    const moments = new Set(together.map(s => s.at));
    // Three towers per instant, so far fewer moments than shots.
    expect(moments.size).toBeLessThan(together.length);
    expect(Math.ceil(together.length / 3)).toBe(moments.size);
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
