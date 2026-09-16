import { describe, expect, it } from 'vitest';

import {
  Rng, drawPick, drawRange, drawSample, drawShuffle, drawWeighted, scriptedSource,
} from '@/simulation/Rng';
import { STARTING_DECK } from '@/content/units/pool';

import golden from './fixtures/draws.golden.json' with { type: 'json' };

/**
 * PARITY OF THE DRAW ALGORITHMS.
 *
 * Seeding changes every draw, so run outcomes cannot be compared across the
 * migration — a fixture saying "this seed yields that reward" would be
 * meaningless. What IS comparable is the algorithms.
 *
 * `scripts/goldenDraws.mjs` replaced `Math.random` with a scripted stream and
 * ran the REAL legacy functions, recording the stream each consumed and what
 * came back. Here the same stream goes through the new helpers. The generator
 * is out of the question; only the algorithm is on trial.
 */

type Case = (typeof golden.faelle)[number];
const casesFor = (algorithm: string): Case[] =>
  golden.faelle.filter(c => c.algorithmus === algorithm);

describe('shuffle matches the legacy deck shuffle', () => {
  for (const testCase of casesFor('shuffle')) {
    it(testCase.name, () => {
      const items = (testCase.eingabe as { items: string[] }).items;
      const source = scriptedSource(testCase.stream);
      expect(drawShuffle(source, items)).toEqual(testCase.ergebnis);
    });
  }

  it('never mutates what it was given', () => {
    const original = ['a', 'b', 'c', 'd', 'e'];
    const copy = original.slice();
    drawShuffle(Rng.fromSeed('anything'), original);
    expect(original).toEqual(copy);
  });
});

describe('pick matches the legacy encounter draw', () => {
  for (const testCase of casesFor('pick')) {
    it(testCase.name, () => {
      const items = (testCase.eingabe as { items: string[] }).items;
      expect(drawPick(scriptedSource(testCase.stream), items)).toBe(testCase.ergebnis);
    });
  }

  it('returns undefined for an empty list rather than throwing', () => {
    expect(drawPick(Rng.fromSeed(1), [])).toBeUndefined();
  });
});

describe('range matches the legacy reward-rank scatter', () => {
  for (const testCase of casesFor('range')) {
    it(testCase.name, () => {
      const input = testCase.eingabe as {
        min: number; max: number; mitte: number; clampMin: number; clampMax: number;
      };
      const scatter = drawRange(scriptedSource(testCase.stream), input.min, input.max);
      const rank = Math.max(input.clampMin, Math.min(input.clampMax, input.mitte + scatter));
      expect(rank).toBe(testCase.ergebnis);
    });
  }

  it('covers both ends of the range inclusively', () => {
    const seen = new Set<number>();
    const rng = Rng.fromSeed('range-coverage');
    for (let i = 0; i < 2000; i++) seen.add(rng.range(-2, 2));
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });
});

describe('weighted matches the legacy crest offer', () => {
  for (const testCase of casesFor('weighted')) {
    it(testCase.name, () => {
      const candidates = (testCase.eingabe as { candidates: { id: string; weight: number }[] })
        .candidates;
      const chosen = drawWeighted(scriptedSource(testCase.stream), candidates, c => c.weight);
      expect(chosen?.id).toBe(testCase.ergebnis);
    });
  }

  it('falls back to the last item when the countdown never reaches zero', () => {
    /*
     * Float weights really can leave the countdown a hair ABOVE zero after the
     * last subtraction, because `total` accumulates its rounding error once
     * while the countdown accumulates it again. These weights and this draw
     * were found by search, not by guesswork: the remainder is +1.1e-16.
     *
     * The legacy code returns the last item. A "tidier" version returning
     * undefined would silently drop an offer in that edge case — and the first
     * version of this test picked numbers that never reached the fallback at
     * all, so removing the fallback passed. Hence the searched-for case.
     */
    const items = [{ w: 0.506 }, { w: 0.385 }, { w: 0.927 }, { w: 0.809 }, { w: 0.403 }];
    const chosen = drawWeighted(scriptedSource([0.9999999999999999]), items, i => i.w);
    expect(chosen).toBe(items[4]);
  });
});

describe('sample matches the legacy draw without replacement', () => {
  for (const testCase of casesFor('sample')) {
    it(testCase.name, () => {
      const result = testCase.ergebnis as { pool: string[]; drawn: string[] };
      const count = (testCase.eingabe as { count: number }).count;
      expect(drawSample(scriptedSource(testCase.stream), result.pool, count))
        .toEqual(result.drawn);
    });
  }

  it('never returns the same item twice and stops at the pool size', () => {
    const pool = ['a', 'b', 'c'];
    const drawn = drawSample(Rng.fromSeed('sample'), pool, 99);
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
  });
});

describe('the generator is reproducible', () => {
  it('the same seed yields the same sequence', () => {
    const a = Rng.fromSeed('parapex-2026');
    const b = Rng.fromSeed('parapex-2026');
    const first = Array.from({ length: 500 }, () => a.next());
    const second = Array.from({ length: 500 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('different seeds diverge immediately', () => {
    const a = Rng.fromSeed('seed-a');
    const b = Rng.fromSeed('seed-b');
    const first = Array.from({ length: 20 }, () => a.next());
    const second = Array.from({ length: 20 }, () => b.next());
    expect(first).not.toEqual(second);
    // Not merely different overall: different from the very first draw.
    expect(first[0]).not.toBe(second[0]);
  });

  it('numeric and string seeds both work', () => {
    expect(Rng.fromSeed(42).next()).toBe(Rng.fromSeed(42).next());
    expect(Rng.fromSeed('42').next()).not.toBe(Rng.fromSeed(42).next());
  });

  it('state round-trips through JSON and resumes the exact stream', () => {
    const rng = Rng.fromSeed('save-me');
    for (let i = 0; i < 37; i++) rng.next();

    const saved = JSON.parse(JSON.stringify(rng.state));
    const expected = Array.from({ length: 50 }, () => rng.next());

    const restored = Rng.fromState(saved);
    const actual = Array.from({ length: 50 }, () => restored.next());
    expect(actual).toEqual(expected);
  });

  it('state is four plain integers, nothing more', () => {
    const state = Rng.fromSeed('shape').state;
    expect(Object.keys(state).sort()).toEqual(['a', 'b', 'c', 'd']);
    for (const value of Object.values(state)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });

  it('stays inside [0, 1) and spreads evenly enough to deal cards with', () => {
    const rng = Rng.fromSeed('uniformity');
    const buckets = new Array<number>(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      buckets[Math.floor(value * 10)]!++;
    }
    // A fair generator puts a tenth in each bucket. 8 % slack is far tighter
    // than any bias that would matter, and far looser than random noise.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(draws / 10 * 0.92);
      expect(count).toBeLessThan(draws / 10 * 1.08);
    }
  });

  /*
   * The gate for this phase, stated the way a player would state it: the same
   * seed has to deal the same game. Everything above proves pieces; this
   * proves the thing the pieces are for.
   */
  it('the same seed deals the same opening hand, twice, from the real deck', () => {
    const deal = (seed: string): string[] => {
      const rng = Rng.fromSeed(seed);
      // A round draws seven off the end of the shuffled pile.
      return rng.shuffle(STARTING_DECK).slice(-7);
    };
    expect(deal('2026-09-16')).toEqual(deal('2026-09-16'));
    expect(deal('2026-09-16')).not.toEqual(deal('2026-09-17'));
    expect(deal('2026-09-16')).toHaveLength(7);
  });

  it('a run resumed from a saved state deals on exactly as it would have', () => {
    const first = Rng.fromSeed('interrupted-run');
    first.shuffle(STARTING_DECK);              // combat one
    const midRun = JSON.parse(JSON.stringify(first.state));
    const wouldHaveBeen = [
      first.shuffle(STARTING_DECK).slice(-7),  // combat two
      first.shuffle(STARTING_DECK).slice(-7),  // combat three
    ];

    const resumed = Rng.fromState(midRun);
    expect([
      resumed.shuffle(STARTING_DECK).slice(-7),
      resumed.shuffle(STARTING_DECK).slice(-7),
    ]).toEqual(wouldHaveBeen);
  });

  it('shuffles a 52-card deck without losing or duplicating a card', () => {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    const rng = Rng.fromSeed('deck');
    for (let round = 0; round < 200; round++) {
      const shuffled = rng.shuffle(deck);
      expect(shuffled).toHaveLength(52);
      expect([...shuffled].sort((a, b) => a - b)).toEqual(deck);
    }
  });
});
