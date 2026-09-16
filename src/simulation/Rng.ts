/**
 * Seeded randomness.
 *
 * `Math.random()` is how a run stops being reproducible. Everything that
 * affects gameplay draws from here instead, which buys four things at once:
 * a bug that can be reproduced from a seed, tests that do not flake, daily
 * seeds later, and replays.
 *
 * TWO DELIBERATE SEPARATIONS
 *
 * 1. The *source* of randomness and the *draws* made from it are different
 *    things. The draw helpers take a `RandomSource`, so they can be tested
 *    against a scripted stream — which is exactly how they are proven to
 *    match the legacy implementation, with the generator taken out of the
 *    question.
 *
 * 2. The generator is a mutable object; its STATE is plain data. Game state
 *    carries the state, not the object: `RunState.rng` is four integers that
 *    serialise into a save and restore into an identical stream.
 *
 * Nothing here mutates an argument. Every draw returns a new array.
 */

export interface RandomSource {
  /** The next uniform double in [0, 1). */
  next(): number;
}

/** The generator's whole state — four uint32, straight into JSON. */
export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/**
 * sfc32. Chosen over the one-liner generators because its 128-bit state gives
 * a period no run will ever exhaust, and it still serialises to four numbers.
 */
export class Rng implements RandomSource {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  private constructor(state: RngState) {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  /**
   * A generator from a seed. Strings are hashed, so a run can be named
   * ("2026-09-16", "beta-test-3") rather than numbered.
   */
  static fromSeed(seed: string | number): Rng {
    const start = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
    // splitmix32 spreads one seed across the four words; seeding all four from
    // the same value gives a generator that needs many draws to decorrelate.
    let x = start;
    const word = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };
    const rng = new Rng({ a: word(), b: word(), c: word(), d: word() });
    // Discard the first draws: sfc32 is weakest immediately after seeding.
    for (let i = 0; i < 12; i++) rng.next();
    return rng;
  }

  /** Restore an exact generator from a saved state. */
  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  /** The current state, as plain data. Snapshot it, save it, restore it. */
  get state(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  next(): number {
    const t = (this.a + this.b) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.d = (this.d + 1) >>> 0;
    const u = (t + this.d) >>> 0;
    this.c = (this.c + u) >>> 0;
    return u / 4294967296;
  }

  /* Conveniences. Each one is the free function below, applied to this. */
  int(bound: number): number { return drawInt(this, bound); }
  range(min: number, max: number): number { return drawRange(this, min, max); }
  pick<T>(items: readonly T[]): T | undefined { return drawPick(this, items); }
  shuffle<T>(items: readonly T[]): T[] { return drawShuffle(this, items); }
  sample<T>(items: readonly T[], count: number): T[] { return drawSample(this, items, count); }
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | undefined {
    return drawWeighted(this, items, weightOf);
  }
}

/** FNV-1a, so a named seed lands somewhere unremarkable in the space. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/* ============================================================
 *  The draws
 * ============================================================
 *
 * Each of these mirrors an algorithm the legacy tree performs inline, and
 * consumes randomness in exactly the same order — that is what makes them
 * provably equivalent rather than merely similar.
 */

/** An integer in [0, bound). */
export function drawInt(source: RandomSource, bound: number): number {
  if (bound <= 0) return 0;
  return Math.floor(source.next() * bound);
}

/** An integer in [min, max], both ends included. */
export function drawRange(source: RandomSource, min: number, max: number): number {
  if (max < min) return min;
  return min + drawInt(source, max - min + 1);
}

export function drawPick<T>(source: RandomSource, items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  return items[drawInt(source, items.length)];
}

/**
 * Fisher-Yates, walking down from the end — the same direction the legacy
 * shuffle walks, so the same stream yields the same permutation.
 *
 * Returns a new array. The legacy version shuffles in place, which is how a
 * draw pile and a display can end up disagreeing about card order.
 */
export function drawShuffle<T>(source: RandomSource, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(source.next() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** `count` distinct items, drawn without replacement, in the order drawn. */
export function drawSample<T>(source: RandomSource, items: readonly T[], count: number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(drawInt(source, pool.length), 1)[0]!);
  }
  return out;
}

/**
 * One weighted draw: take a point on the total, then count it down.
 *
 * The last item is the fallback, which matters when the weights are floats and
 * rounding leaves the countdown just above zero. The legacy implementation
 * does the same, and a "tidier" version would quietly change which item wins
 * the edge case.
 */
export function drawWeighted<T>(
  source: RandomSource,
  items: readonly T[],
  weightOf: (item: T) => number,
): T | undefined {
  if (!items.length) return undefined;
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let draw = source.next() * total;
  for (const item of items) {
    draw -= weightOf(item);
    if (draw <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * A source that replays a fixed list of numbers. Only for tests and for
 * proving parity against the legacy tree — never for gameplay.
 */
export function scriptedSource(values: readonly number[]): RandomSource {
  let i = 0;
  return {
    next(): number {
      if (i >= values.length) throw new Error(`scripted source exhausted after ${values.length} draws`);
      return values[i++]!;
    },
  };
}
