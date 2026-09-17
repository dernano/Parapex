/**
 * The same hash the legacy tree uses, and the smooth field built on it.
 *
 * It is deterministic and stateless: terrain that rerolls every frame shimmers,
 * and terrain that rerolls every load is terrain the player can never learn.
 * Keeping the exact constants means the new ground can be compared against the
 * old one tile for tile.
 */

export function noise(col: number, row: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const fade = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Noise that varies over a DISTANCE rather than per tile.
 *
 * This is what makes terrain read as ground instead of as static: earth and
 * grass want to appear in patches several tiles across, and a per-tile roll
 * gives a checkerboard — which is exactly what the first version of the new
 * renderer produced.
 */
export function smoothNoise(col: number, row: number, scale = 4): number {
  const x = col / scale;
  const y = row / scale;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const top = lerp(noise(x0, y0), noise(x0 + 1, y0), fx);
  const bottom = lerp(noise(x0, y0 + 1), noise(x0 + 1, y0 + 1), fx);
  return lerp(top, bottom, fy);
}
