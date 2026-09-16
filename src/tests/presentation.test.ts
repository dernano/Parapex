import { describe, expect, it } from 'vitest';
import { UNIT_HEIGHT } from '@/rendering/artRules';
import {
  ALL_EFFECTS, DEFAULT_PRESENTATION, NO_DEBUG, UNIT_SCALE_PROBES,
  effectEnabled, scaledBand, scaledUnitHeight, withReducedMotion,
} from '@/rendering/presentation/settings';

describe('the unit scale probe', () => {
  it('offers exactly the four sizes the brief asks to be compared', () => {
    expect(UNIT_SCALE_PROBES).toEqual([1, 1.15, 1.25, 1.35]);
  });

  /**
   * The rule that keeps the probe honest. 24 × 1.15 is 27.6, and a 27.6-pixel
   * soldier does not exist — the probe decides how tall somebody DRAWS the
   * unit, and the answer has to be a number they can draw.
   */
  it('always lands on whole pixels, at every probe and every band', () => {
    for (const scale of UNIT_SCALE_PROBES) {
      for (const band of Object.keys(UNIT_HEIGHT) as (keyof typeof UNIT_HEIGHT)[]) {
        const [low, high] = scaledBand(band, scale);
        expect(Number.isInteger(low), `${band}@${scale}`).toBe(true);
        expect(Number.isInteger(high), `${band}@${scale}`).toBe(true);
        expect(Number.isInteger(scaledUnitHeight(band, scale))).toBe(true);
      }
    }
  });

  it('leaves the bands untouched at 100 %', () => {
    for (const band of Object.keys(UNIT_HEIGHT) as (keyof typeof UNIT_HEIGHT)[]) {
      expect(scaledBand(band, 1)).toEqual([...UNIT_HEIGHT[band]]);
    }
  });

  it('keeps the bands separated at every probe', () => {
    // If two bands collide at some scale, rank would stop reading through
    // size at all - and the point of testing the sizes is to find that out.
    for (const scale of UNIT_SCALE_PROBES) {
      const militia = scaledUnitHeight('militia', scale);
      const professional = scaledUnitHeight('professional', scale);
      const elite = scaledUnitHeight('elite', scale);
      expect(militia, `${scale}`).toBeLessThan(professional);
      expect(professional, `${scale}`).toBeLessThan(elite);
    }
  });

  it('grows monotonically with the probe', () => {
    let previous = 0;
    for (const scale of UNIT_SCALE_PROBES) {
      const height = scaledUnitHeight('professional', scale);
      expect(height).toBeGreaterThan(previous);
      previous = height;
    }
  });
});

describe('reduced motion', () => {
  it('takes away the camera and leaves the information', () => {
    const on = withReducedMotion({ ...DEFAULT_PRESENTATION, reducedMotion: true });
    expect(on.effects.shake).toBe(false);
    // Everything that CARRIES A FACT stays: the player still sees the shot,
    // the smoke, the impact and the number.
    expect(on.effects.smoke).toBe(true);
    expect(on.effects.floatingText).toBe(true);
    expect(on.effects.flash).toBe(true);
  });

  it('changes nothing when it is off', () => {
    expect(withReducedMotion(DEFAULT_PRESENTATION)).toBe(DEFAULT_PRESENTATION);
  });
});

describe('the effect toggles', () => {
  it('answer for every particle kind the emitters can produce', () => {
    const settings = { ...DEFAULT_PRESENTATION, effects: ALL_EFFECTS, debug: NO_DEBUG };
    for (const kind of ['smoke', 'dust', 'flash', 'debris', 'spark']) {
      expect(effectEnabled(settings, kind), kind).toBe(true);
    }
  });

  it('switch off individually', () => {
    const settings = {
      ...DEFAULT_PRESENTATION,
      effects: { ...ALL_EFFECTS, smoke: false },
    };
    expect(effectEnabled(settings, 'smoke')).toBe(false);
    expect(effectEnabled(settings, 'dust')).toBe(true);
  });
});
