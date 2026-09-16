import { describe, expect, it } from 'vitest';
import {
  MAGNITUDE_STYLE, MAX_FLOATING_NUMBERS, magnitudeOf, planDamageNumbers, shownDamage,
} from '@/rendering/effects/damagePresentation';
import { planSalvo, scheduleShots } from '@/rendering/effects/salvoPresentation';

const TOWERS = [0, 1, 2, 3, 4];
const present = (volleys: number, damage: number) => {
  const plan = planSalvo(volleys);
  return planDamageNumbers(plan, scheduleShots(plan, TOWERS), damage);
};

/**
 * Two rules, pulling against each other, and both are assertions rather than
 * intentions.
 */
describe('damage numbers never lie', () => {
  /**
   * THE ONE THAT MATTERS. Aggregation is a display choice, not a rounding
   * licence. If the shown numbers ever stop adding up to the damage dealt, a
   * player will eventually notice, and from then on they will not believe any
   * number the game shows them.
   */
  it('adds up to exactly what was dealt, at every magnitude', () => {
    for (const volleys of [1, 3, 5, 12, 30, 100, 2000, 1_000_000]) {
      for (const damage of [1, 7, 84, 999, 12_345, 6_700_000, 999_999_999]) {
        expect(shownDamage(present(volleys, damage)), `${volleys}×${damage}`).toBe(damage);
      }
    }
  });

  it('shows the grand total separately, so it is never double counted', () => {
    const presentation = present(100, 50_000);
    expect(presentation.banner!.value).toBe(50_000);
    expect(shownDamage(presentation)).toBe(50_000);
  });

  it('says nothing at all when nothing happened', () => {
    const presentation = present(3, 0);
    expect(presentation.numbers).toEqual([]);
    expect(presentation.banner).toBeNull();
  });
});

describe('damage numbers never flood', () => {
  it('stays under the cap however many volleys there were', () => {
    for (const volleys of [1, 5, 15, 50, 250, 10_000, 1_000_000]) {
      expect(present(volleys, 400_000).numbers.length, `${volleys}`)
        .toBeLessThanOrEqual(MAX_FLOATING_NUMBERS);
    }
  });

  it('is literal while the player can still follow it', () => {
    const plan = planSalvo(5);
    const presentation = planDamageNumbers(plan, scheduleShots(plan, TOWERS), 500);
    expect(presentation.numbers).toHaveLength(5);
    expect(presentation.numbers.every(n => !n.aggregate)).toBe(true);
    expect(presentation.numbers.every(n => n.tower !== null)).toBe(true);
    expect(presentation.banner).toBeNull();
  });

  it('combines once it cannot, and says so', () => {
    const presentation = present(300, 900_000);
    expect(presentation.numbers.some(n => n.aggregate)).toBe(true);
    expect(presentation.banner).not.toBeNull();
  });

  it('mounts: the numbers arrive in order through the salvo', () => {
    const presentation = present(120, 80_000);
    for (let i = 1; i < presentation.numbers.length; i++) {
      expect(presentation.numbers[i]!.at)
        .toBeGreaterThanOrEqual(presentation.numbers[i - 1]!.at);
    }
    expect(presentation.banner!.at).toBeGreaterThanOrEqual(
      presentation.numbers[presentation.numbers.length - 1]!.at);
  });

  it('weights the later blows more heavily, because the barrage builds', () => {
    const presentation = present(4, 1000);
    const first = presentation.numbers[0]!.value;
    const last = presentation.numbers[presentation.numbers.length - 1]!.value;
    expect(last).toBeGreaterThan(first);
  });
});

describe('a number reads at its own size', () => {
  it('bands by magnitude rather than by a formula', () => {
    expect(magnitudeOf(84)).toBe('small');
    expect(magnitudeOf(940)).toBe('medium');
    expect(magnitudeOf(9_400)).toBe('large');
    expect(magnitudeOf(940_000)).toBe('huge');
    expect(magnitudeOf(9_400_000)).toBe('colossal');
  });

  it('grows in type size and in life as the band climbs', () => {
    const bands = ['small', 'medium', 'large', 'huge', 'colossal'] as const;
    for (let i = 1; i < bands.length; i++) {
      expect(MAGNITUDE_STYLE[bands[i]!].size)
        .toBeGreaterThan(MAGNITUDE_STYLE[bands[i - 1]!].size);
      expect(MAGNITUDE_STYLE[bands[i]!].life)
        .toBeGreaterThan(MAGNITUDE_STYLE[bands[i - 1]!].life);
    }
  });

  it('writes a big number the way a player can read it', () => {
    expect(present(1, 2_700_000).numbers[0]!.text).toBe('2,7M');
  });
});
