import { formatBig, type DrawnShot, type SalvoPlan } from './salvoPresentation';

/**
 * DAMAGE, SHOWN AT EVERY MAGNITUDE.
 *
 * A number that works at 84 does not work at 2 700 000, and thirty numbers at
 * once do not work at all. Two rules, and they pull against each other:
 *
 *  1. NEVER LIE. Whatever is shown must add up to what the simulation actually
 *     dealt. Aggregation is a display choice, not a rounding licence — the
 *     test asserts the sum exactly, because a presentation that quietly loses
 *     seven points is a presentation the player will eventually catch.
 *
 *  2. NEVER FLOOD. Past a handful, more numbers carry less information, so the
 *     count is CAPPED and the excess is combined rather than dropped.
 *
 * Under fifteen volleys a player can follow every hit, so they see every hit.
 * Above it they see a few running blows and one total that lands like a
 * verdict.
 */

/** How large a number is drawn. Bands, not a formula — pixel type has sizes. */
export type Magnitude = 'small' | 'medium' | 'large' | 'huge' | 'colossal';

export function magnitudeOf(value: number): Magnitude {
  const n = Math.abs(value);
  if (n < 100) return 'small';
  if (n < 1_000) return 'medium';
  if (n < 10_000) return 'large';
  if (n < 1_000_000) return 'huge';
  return 'colossal';
}

/** Type size and rise per band. The only place these numbers live. */
export const MAGNITUDE_STYLE: Readonly<Record<Magnitude, {
  readonly size: number; readonly rise: number; readonly life: number; readonly weight: number;
}>> = {
  small:    { size: 10, rise: 18, life: 0.7, weight: 0 },
  medium:   { size: 12, rise: 22, life: 0.8, weight: 0 },
  large:    { size: 15, rise: 26, life: 0.9, weight: 1 },
  huge:     { size: 19, rise: 30, life: 1.1, weight: 1 },
  colossal: { size: 24, rise: 34, life: 1.4, weight: 2 },
};

export interface FloatingNumber {
  readonly id: string;
  /** Seconds after the salvo presentation starts. */
  readonly at: number;
  /** The exact damage this number stands for. */
  readonly value: number;
  readonly text: string;
  readonly magnitude: Magnitude;
  /** Which tower it belongs to, for placing it. Null once aggregated. */
  readonly tower: number | null;
  /** True when it stands for several shots at once. */
  readonly aggregate: boolean;
}

export interface DamagePresentation {
  readonly numbers: readonly FloatingNumber[];
  /**
   * The verdict at the end. It is the grand total and is deliberately NOT part
   * of `numbers` — it restates the sum, it does not add to it, and a test that
   * adds everything up has to be able to tell the two apart.
   */
  readonly banner: { readonly value: number; readonly text: string;
    readonly magnitude: Magnitude; readonly at: number } | null;
}

/** More than this on screen at once and nobody reads any of them. */
export const MAX_FLOATING_NUMBERS = 10;

/**
 * Split `total` into `parts` whole numbers that still sum to `total`.
 *
 * Weighted by the shots' own force, so the heavier shots late in a barrage
 * carry the larger numbers — and the remainder goes to the last part rather
 * than being thrown away. This is the function rule 1 lives in.
 */
function share(total: number, weights: readonly number[]): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + b, 0) || weights.length;
  const out: number[] = [];
  let given = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    const piece = Math.round(total * (weights[i]! / sum));
    out.push(piece);
    given += piece;
  }
  // Whatever rounding left over lands on the last one. Nothing is lost.
  out.push(total - given);
  return out;
}

export function planDamageNumbers(
  plan: SalvoPlan,
  shots: readonly DrawnShot[],
  total: number,
): DamagePresentation {
  const damage = Math.round(total);
  if (!shots.length || damage === 0) {
    return {
      numbers: [],
      banner: damage === 0 ? null : {
        value: damage, text: formatBig(damage),
        magnitude: magnitudeOf(damage), at: plan.duration,
      },
    };
  }

  /*
   * Literal tiers: one number per shot, at that shot's tower, at that shot's
   * moment. Nothing is combined, because nothing needs to be.
   */
  if (!plan.aggregateDamage && shots.length <= MAX_FLOATING_NUMBERS) {
    const pieces = share(damage, shots.map(s => s.force));
    return {
      numbers: shots.map((shot, i) => build(`dmg-${i}`, shot.at, pieces[i]!, shot.tower, false)),
      banner: null,
    };
  }

  /*
   * Aggregated tiers. The drawn shots are grouped into at most nine running
   * blows plus the final verdict: the player sees the damage MOUNTING — which
   * is the feeling a barrage is supposed to produce — instead of a snowstorm
   * of four-digit numbers nobody can add up.
   */
  const groups = Math.min(MAX_FLOATING_NUMBERS - 1, shots.length);
  const perGroup = Math.ceil(shots.length / groups);
  const buckets: DrawnShot[][] = [];
  for (let i = 0; i < shots.length; i += perGroup) buckets.push(shots.slice(i, i + perGroup));

  const pieces = share(damage, buckets.map(b => b.reduce((s, x) => s + x.force, 0)));
  const numbers = buckets.map((bucket, i) => {
    const last = bucket[bucket.length - 1]!;
    return build(`dmg-${i}`, last.at, pieces[i]!, bucket.length === 1 ? last.tower : null,
      bucket.length > 1);
  });

  return {
    numbers,
    banner: {
      value: damage, text: formatBig(damage),
      magnitude: magnitudeOf(damage), at: plan.duration,
    },
  };
}

function build(
  id: string, at: number, value: number, tower: number | null, aggregate: boolean,
): FloatingNumber {
  return {
    id, at, value, text: formatBig(value), magnitude: magnitudeOf(value), tower, aggregate,
  };
}

/** What the numbers add up to. The one thing that must equal the real damage. */
export const shownDamage = (presentation: DamagePresentation): number =>
  presentation.numbers.reduce((sum, n) => sum + n.value, 0);
