import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LIGHT, MAX_COLOURS_PER_SPRITE, PALETTE, TILE_HEIGHT, TILE_WIDTH,
  TOWER_PLATFORM_HEIGHT, UNIT_HEIGHT,
} from '@/rendering/artRules';

/**
 * THE BIBLE AND THE CODE SAY THE SAME NUMBERS.
 *
 * `docs/ART_BIBLE.md` is what a person reads before drawing anything, and
 * `artRules.ts` is what the renderer obeys. Two statements of the same fact
 * drift, and the one that drifts is always the document — so this reads the
 * document and fails the build when they disagree.
 *
 * `artRules.ts` has claimed this test existed since Phase 4. It did not. That
 * is worse than having no claim: a comment asserting a guard is a comment
 * people trust.
 */

const BIBLE = readFileSync(
  fileURLToPath(new URL('../../docs/ART_BIBLE.md', import.meta.url)), 'utf8');

/** All the numbers on the first table row whose first cell matches. */
function row(label: string): number[] {
  const line = BIBLE.split('\n').find(l => l.startsWith(`| ${label}`));
  if (!line) throw new Error(`no row in the bible for: ${label}`);
  return (line.match(/\d+/g) ?? []).map(Number);
}

describe('the art bible and the code agree', () => {
  it('on the projection', () => {
    expect(BIBLE).toContain(`tile width   TW = ${TILE_WIDTH}`);
    expect(BIBLE).toContain(`tile height  TH = ${TILE_HEIGHT}`);
  });

  it('on the three foot-soldier height bands', () => {
    expect(row('Foot soldier, rank 1–3').slice(0, 4))
      .toEqual([1, 3, ...UNIT_HEIGHT.militia]);
    expect(row('Foot soldier, rank 4–9').slice(0, 4))
      .toEqual([4, 9, ...UNIT_HEIGHT.professional]);
    expect(row('Foot soldier, rank 10–13').slice(0, 4))
      .toEqual([10, 13, ...UNIT_HEIGHT.elite]);
  });

  it('on the crew-served engine', () => {
    expect(row('Crew-served engine')).toEqual([...UNIT_HEIGHT.engine]);
  });

  it('on the range of tower heights', () => {
    const heights = Object.values(TOWER_PLATFORM_HEIGHT);
    expect(row('Tower, ground to crenellation'))
      .toEqual([Math.min(...heights), Math.max(...heights)]);
  });

  it('on the one sun and how far it mixes', () => {
    expect(BIBLE).toContain(`base mixed ${Math.round(LIGHT.topMix * 100)} % toward warm`);
    expect(BIBLE.toLowerCase()).toContain('one sun, from the upper right');
  });

  /**
   * The bible states a ramp as its two ends and a number of steps, which is
   * what a person drawing needs. So that is what is checked — the ends and the
   * count — rather than every value, which would only be the code restated.
   */
  it('on the ends and the length of every palette ramp', () => {
    for (const [family, ramp] of Object.entries(PALETTE)) {
      const first = ramp[0]!;
      const last = ramp[ramp.length - 1]!;
      const line = BIBLE.split('\n').find(l => l.startsWith('|') && l.includes(first));
      expect(line, `no palette row for ${family} (${first})`).toBeDefined();
      expect(line!, `${family} end`).toContain(last);
      if (family === 'heraldic') {
        // Flat, not a ramp: every value is named outright.
        for (const colour of ramp) expect(line!, `${family} ${colour}`).toContain(colour);
      } else {
        expect(line!.trimEnd().endsWith(`| ${ramp.length} |`), `${family} steps`).toBe(true);
      }
    }
  });

  it('on the colour ceiling per sprite', () => {
    expect(BIBLE).toMatch(new RegExp(`${MAX_COLOURS_PER_SPRITE}\\s*(colours|Farben)`, 'i'));
  });

  /** The decision the four screenshots produced, recorded where art is made. */
  it('records the size decision and the evidence behind it', () => {
    expect(BIBLE).toContain('The decision is 100 %');
    for (const size of ['100 %', '115 %', '125 %', '135 %']) {
      expect(BIBLE, size).toContain(size);
    }
    expect(BIBLE).toContain('docs/blick/groesse-');
  });
});
