import { describe, expect, it } from 'vitest';
import {
  SCAR_BUDGET, SCAR_LIFE, addScar, emptyScars, scarOpacity, scarredArea, stepScars,
} from '@/rendering/effects/groundScars';
import {
  FLASH_FALL, FLASH_RISE, MAX_FLASH_ALPHA, flashAt, flashEndsAt, flashWindow,
} from '@/rendering/effects/screenFlash';
import { planSalvo, scheduleShots } from '@/rendering/effects/salvoPresentation';
import { ALL_EFFECTS, DEFAULT_PRESENTATION } from '@/rendering/presentation/settings';
import { createUnit } from '@/content/units/pool';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { SalvoDirector } from '@/rendering/presentation/SalvoDirector';
import { DEFAULT_CAMERA, toScreen } from '@/rendering/WorldTransform';

/**
 * The escalation table promised these two from tier C and D upward, the
 * monotonicity test checked the promise, and nothing drew either one. A
 * specification that is verified and still false is worse than none.
 */

describe('the earth keeps the marks', () => {
  const at = (col: number, row: number) => ({ col, row, height: 0 });

  it('scars where the shot landed, on the ground', () => {
    const field = addScar(emptyScars(), at(18, 9), 2);
    expect(field.scars).toHaveLength(1);
    expect(field.scars[0]!.at.height).toBe(0);
    expect(field.scars[0]!.at.col).toBe(18);
  });

  /**
   * Two hundred separate craters is a rash; one churned patch that keeps
   * getting darker is a bombardment.
   */
  it('deepens one patch rather than making two of them', () => {
    let field = emptyScars();
    for (let i = 0; i < 12; i++) field = addScar(field, at(18 + i * 0.03, 9), 2);
    expect(field.scars).toHaveLength(1);
    expect(field.scars[0]!.depth).toBe(1);
    expect(field.scars[0]!.size).toBeGreaterThan(addScar(emptyScars(), at(18, 9), 2)
      .scars[0]!.size);
  });

  it('keeps hits far apart apart', () => {
    let field = addScar(emptyScars(), at(18, 9), 1);
    field = addScar(field, at(18, 13), 1);
    expect(field.scars).toHaveLength(2);
  });

  /** Order must not decide the result: merging goes to the NEAREST. */
  it('produces the same field whichever order the shots arrived in', () => {
    const points = [at(18, 9), at(18.4, 9), at(17.6, 9), at(18.2, 9.3)];
    const forward = points.reduce((f, p) => addScar(f, p, 2), emptyScars());
    const backward = [...points].reverse().reduce((f, p) => addScar(f, p, 2), emptyScars());
    expect(forward.scars.length).toBe(backward.scars.length);
    expect(forward.scars.map(s => Math.round(s.size)).sort())
      .toEqual(backward.scars.map(s => Math.round(s.size)).sort());
  });

  it('never grows past the budget, however long the bombardment', () => {
    let field = emptyScars();
    for (let i = 0; i < 400; i++) field = addScar(field, at(10 + i * 0.9, 4 + (i % 13)), 3);
    expect(field.scars.length).toBeLessThanOrEqual(SCAR_BUDGET);
  });

  it('never grows a single crater past a tower width', () => {
    let field = emptyScars();
    for (let i = 0; i < 200; i++) field = addScar(field, at(18, 9), 3);
    expect(field.scars[0]!.size).toBeLessThanOrEqual(26);
  });

  /** The one effect that outlives its own salvo. That IS the point. */
  it('is still there long after the smoke has gone', () => {
    let field = addScar(emptyScars(), at(18, 9), 2);
    for (let t = 0; t < 4; t += 1 / 60) field = stepScars(field, 1 / 60);
    expect(field.scars).toHaveLength(1);
    expect(scarOpacity(field.scars[0]!)).toBeGreaterThan(0.2);
  });

  it('and gone before a whole combat has passed', () => {
    let field = addScar(emptyScars(), at(18, 9), 2);
    for (let t = 0; t < SCAR_LIFE + 1; t += 0.1) field = stepScars(field, 0.1);
    expect(field.scars).toHaveLength(0);
  });

  it('holds its darkness and then fades, rather than fading steadily', () => {
    let field = addScar(emptyScars(), at(18, 9), 2);
    const fresh = scarOpacity(field.scars[0]!);
    for (let t = 0; t < SCAR_LIFE * 0.6; t += 0.1) field = stepScars(field, 0.1);
    expect(scarOpacity(field.scars[0]!)).toBeCloseTo(fresh, 6);
  });

  it('renews the whole patch when something lands in it again', () => {
    let field = addScar(emptyScars(), at(18, 9), 2);
    for (let t = 0; t < SCAR_LIFE * 0.9; t += 0.1) field = stepScars(field, 0.1);
    expect(scarOpacity(field.scars[0]!)).toBeLessThan(0.3);
    field = addScar(field, at(18, 9), 2);
    expect(field.scars[0]!.age).toBe(0);
  });

  it('measures a worked-over field as more than a lightly shelled one', () => {
    const light = [0, 1, 2].reduce((f, i) => addScar(f, at(14 + i * 2, 9), 1), emptyScars());
    const heavy = Array.from({ length: 40 }, (_, i) => i)
      .reduce((f, i) => addScar(f, at(12 + (i % 9), 5 + (i % 11)), 3), emptyScars());
    expect(scarredArea(heavy)).toBeGreaterThan(scarredArea(light) * 5);
  });
});

describe('the field lit by its own guns', () => {
  const shotsFor = (volleys: number) => {
    const plan = planSalvo(volleys);
    const shots = scheduleShots(plan, [0, 1, 2, 3, 4]);
    return { plan, last: shots.length ? shots[shots.length - 1]!.at : 0 };
  };
  const windowFor = (volleys: number) => {
    const { plan, last } = shotsFor(volleys);
    return flashWindow(plan, last);
  };

  it('lights nothing below tier D — which is what makes tier D mean something', () => {
    for (const volleys of [1, 5, 15, 50]) {
      expect(windowFor(volleys), `${volleys}`).toBeNull();
      expect(flashAt(windowFor(volleys), 0.3, DEFAULT_PRESENTATION)).toBe(0);
    }
  });

  it('lights tier D and E, and E harder than D', () => {
    const d = windowFor(100)!;
    const e = windowFor(5000)!;
    expect(d).not.toBeNull();
    expect(e.strength).toBeGreaterThan(d.strength);
  });

  /**
   * THE ONE THAT MATTERS.
   *
   * A pulse on each drawn shot of a tier E salvo would be a 22 Hz full-screen
   * strobe — squarely inside the band that triggers photosensitive seizures,
   * and `reducedMotion` would not save anybody who had not already found the
   * setting. So the wash rises once, holds, and dies once, and this proves it:
   * across the whole salvo the light changes direction exactly twice.
   */
  it('is a wash and can never be a strobe', () => {
    const window = windowFor(1_000_000)!;
    const step = 1 / 240;
    let previous = flashAt(window, 0, DEFAULT_PRESENTATION);
    let direction = 0;
    let reversals = 0;

    for (let t = step; t <= flashEndsAt(window) + 0.5; t += step) {
      const value = flashAt(window, t, DEFAULT_PRESENTATION);
      const next = Math.sign(Math.round((value - previous) * 1e6));
      if (next !== 0 && next !== direction) {
        if (direction !== 0) reversals++;
        direction = next;
      }
      previous = value;
    }
    // Up, then down. Nothing else.
    expect(reversals).toBe(1);
  });

  it('never exceeds its ceiling, at any tier or any moment', () => {
    for (const volleys of [51, 100, 250, 1000, 1_000_000]) {
      const window = windowFor(volleys);
      for (let t = 0; t <= flashEndsAt(window) + 0.2; t += 1 / 120) {
        expect(flashAt(window, t, DEFAULT_PRESENTATION), `${volleys}@${t}`)
          .toBeLessThanOrEqual(MAX_FLASH_ALPHA);
      }
    }
  });

  it('comes up and goes down smoothly rather than switching on', () => {
    const window = windowFor(1000)!;
    expect(flashAt(window, 0, DEFAULT_PRESENTATION)).toBe(0);
    expect(flashAt(window, FLASH_RISE, DEFAULT_PRESENTATION)).toBeGreaterThan(0);
    expect(flashAt(window, window.until + FLASH_FALL, DEFAULT_PRESENTATION)).toBe(0);
    expect(flashEndsAt(window)).toBe(window.until + FLASH_FALL);
  });

  it('is exactly zero under reduced motion', () => {
    const window = windowFor(1000)!;
    const settings = { ...DEFAULT_PRESENTATION, reducedMotion: true };
    for (let t = 0; t <= flashEndsAt(window); t += 0.02) {
      expect(flashAt(window, t, settings), `t=${t.toFixed(2)}`).toBe(0);
    }
  });

  it('obeys the same toggle the muzzle flash does', () => {
    const window = windowFor(1000)!;
    const settings = {
      ...DEFAULT_PRESENTATION, effects: { ...ALL_EFFECTS, flash: false },
    };
    expect(flashAt(window, 0.4, settings)).toBe(0);
  });
});

/**
 * A hundred cannonballs landing on one coordinate is not a bombardment, it is
 * a laser — and it is what the first version drew: every impact on the same
 * pixel, every scar merged into one crater, a shelled field that looked like a
 * single pothole.
 */
describe('a barrage covers ground', () => {
  const build = (volleys: number) => {
    let state = createCombat({
      deck: [], enemy: { id: 'v', displayName: 'v', hp: 9000, maxHp: 9000 },
      seed: 'scatter', shuffle: false,
      towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
    }).state;
    for (const [tower, id] of [[2, 'gunner-13'], [0, 'gunner-11'], [1, 'gunner-9'],
      [3, 'gunner-8'], [4, 'gunner-6']] as const) {
      const unit = createUnit(id);
      if (!unit) continue;
      const result = performAction({ ...state, hand: [unit], momentum: 99 },
        { type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: tower });
      if (result.ok) state = result.state;
    }
    const director = new SalvoDirector({
      towers: state.towers, camera: DEFAULT_CAMERA,
      settings: DEFAULT_PRESENTATION, target: { col: 18, row: 10 },
      volleys, damage: 5000, towerOrder: [2, 0, 1, 3, 4], seed: `s${volleys}`,
    });
    for (let i = 0; i < 240; i++) director.advance(1 / 60);
    return director;
  };

  it('scars an AREA rather than a single crater', () => {
    const scars = build(100).scars;
    expect(scars.length).toBeGreaterThan(3);
    const cols = scars.map(s => s.at.col);
    const rows = scars.map(s => s.at.row);
    expect(Math.max(...cols) - Math.min(...cols)).toBeGreaterThan(1);
    expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThan(1);
  });

  it('spreads wider at a heavier tier', () => {
    const spread = (director: SalvoDirector): number => {
      const cols = director.scars.map(s => s.at.col);
      return cols.length ? Math.max(...cols) - Math.min(...cols) : 0;
    };
    expect(spread(build(1000))).toBeGreaterThan(spread(build(30)));
  });

  it('leaves the ground alone below tier C', () => {
    expect(build(3).scars).toHaveLength(0);
    expect(build(12).scars).toHaveLength(0);
  });

  it('scatters the same way every time', () => {
    expect(build(100).scars.map(s => [s.at.col.toFixed(4), s.at.row.toFixed(4)]))
      .toEqual(build(100).scars.map(s => [s.at.col.toFixed(4), s.at.row.toFixed(4)]));
  });

  it('never throws a shot somewhere the player would call a miss', () => {
    for (const volleys of [30, 100, 1000]) {
      for (const scar of build(volleys).scars) {
        const off = Math.hypot(scar.at.col - 18, scar.at.row - 10);
        expect(off, `${volleys}: ${off.toFixed(2)} tiles`).toBeLessThan(2.2);
      }
    }
  });
});

/**
 * Spreading the numbers in world tiles does not work and looked like it did:
 * two points one row apart are eleven screen pixels apart on a 2:1 diamond,
 * which is less than the type is tall.
 */
describe('damage numbers do not stack on each other', () => {
  it('separates them on SCREEN, not in tiles', () => {
    let state = createCombat({
      deck: [], enemy: { id: 'v', displayName: 'v', hp: 90_000, maxHp: 90_000 },
      seed: 'labels', shuffle: false,
      towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
    }).state;
    for (const [tower, id] of [[2, 'gunner-13'], [0, 'gunner-11'], [1, 'gunner-9'],
      [3, 'gunner-8'], [4, 'gunner-6']] as const) {
      const unit = createUnit(id);
      if (!unit) continue;
      const result = performAction({ ...state, hand: [unit], momentum: 99 },
        { type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: tower });
      if (result.ok) state = result.state;
    }

    const director = new SalvoDirector({
      towers: state.towers, camera: DEFAULT_CAMERA,
      settings: DEFAULT_PRESENTATION, target: { col: 18, row: 10 },
      volleys: 1000, damage: 900_000, towerOrder: [2, 0, 1, 3, 4], seed: 'labels',
    });

    let worst = Infinity;
    for (let i = 0; i < 200; i++) {
      director.advance(1 / 60);
      const points = director.floating.map(l => toScreen(l.at, DEFAULT_CAMERA));
      for (let a = 0; a < points.length; a++) {
        for (let b = a + 1; b < points.length; b++) {
          // Chebyshev in screen space: two labels are legible when they are
          // clear either horizontally or vertically.
          worst = Math.min(worst, Math.max(
            Math.abs(points[a]!.x - points[b]!.x),
            Math.abs(points[a]!.y - points[b]!.y)));
        }
      }
    }
    // The tallest band is 24 px; the widest number at that size is under 62.
    expect(worst).toBeGreaterThanOrEqual(24);
  });
});
