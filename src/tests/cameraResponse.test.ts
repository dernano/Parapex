import { describe, expect, it } from 'vitest';
import {
  IMPULSE_LIFE, MAX_CAMERA_SHIFT, cameraOffset, impulseFor, impulsesEndAt, shakenCamera,
} from '@/rendering/effects/cameraResponse';
import { planSalvo, scheduleShots } from '@/rendering/effects/salvoPresentation';
import { ALL_EFFECTS, DEFAULT_PRESENTATION } from '@/rendering/presentation/settings';
import { DEFAULT_CAMERA } from '@/rendering/WorldTransform';

const DIRECTION = { x: 0.8, y: 0.6 };
const impulses = [{ at: 0, strength: 1, direction: DIRECTION }];

describe('reduced motion means zero, not less', () => {
  it('never moves the camera by a single pixel', () => {
    const settings = { ...DEFAULT_PRESENTATION, reducedMotion: true };
    for (let t = 0; t < 1; t += 0.01) {
      expect(cameraOffset(impulses, t, settings), `t=${t.toFixed(2)}`).toEqual({ x: 0, y: 0 });
    }
    expect(shakenCamera(DEFAULT_CAMERA, impulses, 0.05, settings)).toBe(DEFAULT_CAMERA);
  });

  it('is equally absolute when the shake toggle alone is off', () => {
    const settings = {
      ...DEFAULT_PRESENTATION, effects: { ...ALL_EFFECTS, shake: false },
    };
    expect(cameraOffset(impulses, 0.05, settings)).toEqual({ x: 0, y: 0 });
  });
});

describe('the shake is small, brief and on whole pixels', () => {
  it('never exceeds three logical pixels', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      at: i * 0.01, strength: 1, direction: DIRECTION,
    }));
    for (let t = 0; t < 1; t += 0.005) {
      const offset = cameraOffset(many, t, DEFAULT_PRESENTATION);
      expect(Math.abs(offset.x), `t=${t}`).toBeLessThanOrEqual(MAX_CAMERA_SHIFT);
      expect(Math.abs(offset.y), `t=${t}`).toBeLessThanOrEqual(MAX_CAMERA_SHIFT);
    }
  });

  /**
   * A camera at x = 417.4 turns every sprite on the field to mush at once —
   * the one bug that can make ALL the art look bad simultaneously.
   */
  it('only ever lands on whole pixels', () => {
    for (let t = 0; t < 0.4; t += 0.003) {
      const offset = cameraOffset(impulses, t, DEFAULT_PRESENTATION);
      expect(Number.isInteger(offset.x)).toBe(true);
      expect(Number.isInteger(offset.y)).toBe(true);
    }
  });

  it('is over, completely, within a third of a second', () => {
    expect(cameraOffset(impulses, IMPULSE_LIFE, DEFAULT_PRESENTATION)).toEqual({ x: 0, y: 0 });
    expect(cameraOffset(impulses, IMPULSE_LIFE + 1, DEFAULT_PRESENTATION))
      .toEqual({ x: 0, y: 0 });
    expect(impulsesEndAt(impulses)).toBe(IMPULSE_LIFE);
  });

  it('does nothing before the blow lands', () => {
    expect(cameraOffset([{ at: 1, strength: 1, direction: DIRECTION }], 0.5,
      DEFAULT_PRESENTATION)).toEqual({ x: 0, y: 0 });
  });

  it('decays: the second half of the kick is smaller than the first', () => {
    const early = Math.abs(cameraOffset(impulses, 0.02, DEFAULT_PRESENTATION).x);
    const late = Math.abs(cameraOffset(impulses, 0.28, DEFAULT_PRESENTATION).x);
    expect(late).toBeLessThan(early);
  });

  it('follows the blow rather than a fixed axis', () => {
    const right = cameraOffset([{ at: 0, strength: 1, direction: { x: 1, y: 0 } }],
      0.01, DEFAULT_PRESENTATION);
    const down = cameraOffset([{ at: 0, strength: 1, direction: { x: 0, y: 1 } }],
      0.01, DEFAULT_PRESENTATION);
    expect(right.x).not.toBe(0);
    expect(right.y).toBe(0);
    expect(down.y).not.toBe(0);
    expect(down.x).toBe(0);
  });
});

/**
 * The refusals. This is most of what the module is FOR — a castle that lurches
 * every two seconds is a castle nobody can aim in.
 */
describe('almost nothing is worth moving the camera for', () => {
  const shotsFor = (volleys: number) => {
    const plan = planSalvo(volleys);
    return { plan, shots: scheduleShots(plan, [0, 1, 2, 3, 4]) };
  };

  it('a single shot moves nothing', () => {
    const { plan, shots } = shotsFor(1);
    expect(shots.map(s => impulseFor(plan, s, DIRECTION))).toEqual([null]);
  });

  it('a drumfire of fifteen still moves nothing', () => {
    const { plan, shots } = shotsFor(15);
    expect(shots.every(s => impulseFor(plan, s, DIRECTION) === null)).toBe(true);
  });

  it('registers from tier C, and then only on a few shots', () => {
    const { plan, shots } = shotsFor(40);
    const registered = shots.filter(s => impulseFor(plan, s, DIRECTION));
    expect(registered.length).toBeGreaterThan(0);
    // Sparse: well under half the drawn shots.
    expect(registered.length).toBeLessThan(shots.length / 2);
  });

  it('always lands the last blow of a salvo that got that far', () => {
    for (const volleys of [40, 120, 5000]) {
      const { plan, shots } = shotsFor(volleys);
      const last = shots[shots.length - 1]!;
      expect(impulseFor(plan, last, DIRECTION), `${volleys}`).not.toBeNull();
    }
  });

  it('hits harder at tier E than at tier C', () => {
    const c = shotsFor(40);
    const e = shotsFor(5000);
    const strengthOf = (x: ReturnType<typeof shotsFor>): number =>
      impulseFor(x.plan, x.shots[x.shots.length - 1]!, DIRECTION)!.strength;
    expect(strengthOf(e)).toBeGreaterThan(strengthOf(c));
  });
});
