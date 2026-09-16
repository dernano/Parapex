import { describe, expect, it } from 'vitest';

import type { CrestDefinition, CrestId, CrestRow } from '@/crests/types';
import { NO_RESOURCES } from '@/crests/types';
import { newSession, resolve, type CrestRegistry } from '@/crests/CrestPipeline';
import {
  addForce, addVolleys, amplifyAllBefore, amplifyPrevious, apply,
  give, held, multiplyForce, take,
} from '@/crests/effects';

function crest(id: CrestId, listens: CrestDefinition['listens']): CrestDefinition {
  return { id, displayName: id, glyph: '⚜', tincture: '#000',
    rarity: 'common', text: '', hint: '', listens };
}

function registryOf(...definitions: CrestDefinition[]): CrestRegistry {
  const byId = new Map(definitions.map(d => [d.id, d]));
  return { crest: id => byId.get(id), commanderRule: id => byId.get(id) };
}

const rowOf = (slots: (CrestId | null)[]): CrestRow => ({
  slots: [...slots, null, null, null, null, null].slice(0, 5),
  sealed: [], commanderRules: [],
});

const run = (
  registry: CrestRegistry, slots: (CrestId | null)[],
  data: Record<string, unknown>, resources = NO_RESOURCES,
) => resolve(registry, newSession(rowOf(slots), { resources }), 'volleyPlanned', data);

describe('an effect that finds no field is recorded, not swallowed', () => {
  it('writes a "missed" effect instead of changing something else', () => {
    const registry = registryOf(crest('lost', {
      volleyPlanned: (context) => { addVolleys(context, 3); },
    }));
    // `volleyPlanned` normally carries `volleys`; this data deliberately does not.
    const result = run(registry, ['lost'], { force: 10 });
    expect(result.data.force).toBe(10);
    expect(result.protocol[0]!.effects).toEqual([
      { kind: 'missed', value: 0, note: 'volleys findet auf volleyPlanned kein Feld' },
    ]);
  });

  it('a change of zero is not recorded at all', () => {
    const registry = registryOf(crest('idle', {
      volleyPlanned: (context) => { addVolleys(context, 0); multiplyForce(context, 1); },
    }));
    const result = run(registry, ['idle'], { volleys: 2, factor: 1 });
    expect(result.protocol[0]!.effects).toEqual([]);
  });
});

describe('amplifying knows nothing about crests', () => {
  /*
   * THE SUBTLEST RULE IN THE SYSTEM.
   *
   * Doubling `+3` gives +6. Doubling `×1.5` gives ×2.25, NOT ×3. Additive and
   * multiplicative shapes are separated precisely so that "counts double"
   * means the same thing for both. Get this wrong and every amplifier in the
   * game is quietly worth something else than its card says.
   */
  it('doubles an addition and squares a factor', () => {
    /*
     * `times` must be 2, not 1. With times = 1 the two arithmetics agree —
     * 1.5 x 1 and 1.5 ^ 1 are both 1.5 — so the first version of this test
     * passed happily with the rule broken. Only times >= 2 separates them:
     *
     *   correct   1.5 ^ 2 = 2.25  applied on top of 1.5  ->  3.375
     *   broken    1.5 x 2 = 3     applied on top of 1.5  ->  4.5
     */
    const registry = registryOf(
      crest('adder', { volleyPlanned: (c) => { addForce(c, 3); } }),
      crest('scaler', { volleyPlanned: (c) => { multiplyForce(c, 1.5); } }),
      crest('amp2', { volleyPlanned: (c, _i, tools) => { amplifyPrevious(c, tools, 2); } }),
    );

    const addition = run(registry, ['adder', 'amp2'], { bonus: 0, factor: 1 });
    expect(addition.data.bonus).toBe(9);               // 3, then 3 x 2

    const scaling = run(registry, ['scaler', 'amp2'], { bonus: 0, factor: 1 });
    expect(scaling.data.factor).toBeCloseTo(3.375, 10);
    expect(scaling.data.factor).not.toBeCloseTo(4.5, 5);
  });

  it('amplifying reaches only what stands to the left', () => {
    const registry = registryOf(
      crest('left', { volleyPlanned: (c) => { addForce(c, 10); } }),
      crest('amp', { volleyPlanned: (c, _i, tools) => { amplifyAllBefore(c, tools, 1); } }),
      crest('right', { volleyPlanned: (c) => { addForce(c, 100); } }),
    );
    const result = run(registry, ['left', 'amp', 'right'], { bonus: 0 });
    // 10, amplified to 20, then 100 — the right-hand crest is untouched.
    expect(result.data.bonus).toBe(120);
  });

  it('a copy of a LATER slot is still out of reach', () => {
    /*
     * The case the plain left-to-right walk never produces, and the only one
     * that actually tests the `slot < current` filter: a mirror in slot 0
     * copies slot 2, so an ignition carrying slot 2 exists BEFORE the
     * amplifier in slot 1 runs. Dropping the filter would let the amplifier
     * reach a slot standing to its right, which is exactly the rule the rack
     * is built on.
     *
     * Without this case the filter could be deleted and every test stayed
     * green.
     */
    const registry = registryOf(
      crest('mirror', { volleyPlanned: (c, _i, tools) => { tools.copy(c, 2); } }),
      crest('amp', { volleyPlanned: (c, _i, tools) => { amplifyAllBefore(c, tools, 1); } }),
      crest('worker', { volleyPlanned: (c) => { addForce(c, 10); } }),
    );
    const result = run(registry, ['mirror', 'amp', 'worker'], { bonus: 0 });
    // mirror copies worker (+10), amp finds nothing to its left, worker (+10).
    expect(result.data.bonus).toBe(20);
  });

  it('an amplifier in slot 1 finds nothing and does nothing', () => {
    const registry = registryOf(
      crest('amp', { volleyPlanned: (c, _i, tools) => { amplifyAllBefore(c, tools, 1); } }),
      crest('worker', { volleyPlanned: (c) => { addForce(c, 7); } }),
    );
    const result = run(registry, ['amp', 'worker'], { bonus: 0 });
    expect(result.data.bonus).toBe(7);
  });

  it('an amplifier does not amplify its own effects into a loop', () => {
    const registry = registryOf(
      crest('worker', { volleyPlanned: (c) => { addForce(c, 1); } }),
      crest('amp', { volleyPlanned: (c, _i, tools) => { amplifyPrevious(c, tools, 3); } }),
    );
    const result = run(registry, ['worker', 'amp'], { bonus: 0 });
    expect(result.data.bonus).toBe(4);   // 1 + 3x1, and then it stops
  });

  /*
   * The copy in `applyAgain` (`ignition.effects.slice()`) guards a crest
   * amplifying its OWN ignition, which would grow the list while iterating it.
   * No route through the public API reaches that: `previousIgnition` excludes
   * the running ignition and `ignitionsBefore` filters by slot. So the copy is
   * belt-and-braces, no test can distinguish it, and removing it breaks
   * nothing today — stated here rather than counted as covered.
   */
});

describe('supplies', () => {
  it('giving always works, taking is capped by the shelf', () => {
    const registry = registryOf(
      crest('giver', { volleyPlanned: (c, _i, t) => { give(c, t, 'powder', 3, 'gemahlen'); } }),
      crest('greedy', { volleyPlanned: (c, _i, t) => { take(c, t, 'powder', 10, 'verfeuert'); } }),
    );
    const result = run(registry, ['giver', 'greedy'], { bonus: 0 });
    expect(result.session.resources.powder).toBe(0);
    // The protocol says two, not ten: a log that claimed ten would send the
    // player looking for eight powder that never existed.
    expect(result.protocol[1]!.effects).toEqual([
      { kind: 'resource', value: { resource: 'powder', amount: -3 }, note: 'verfeuert' },
    ]);
  });

  it('a crest reads the shelf as it stands, not as it started', () => {
    const seen: number[] = [];
    const registry = registryOf(
      crest('giver', { volleyPlanned: (c, _i, t) => { give(c, t, 'powder', 4); } }),
      crest('reader', { volleyPlanned: (_c, _i, t) => { seen.push(held(t, 'powder')); } }),
    );
    run(registry, ['giver', 'reader'], { bonus: 0 }, { ...NO_RESOURCES, powder: 1 });
    expect(seen).toEqual([5]);
  });

  it('a dry run computes with supplies but does not spend them', () => {
    const registry = registryOf(
      crest('burner', { volleyPlanned: (c, _i, t) => {
        const moved = take(c, t, 'powder', 2, 'probe');
        if (moved) addForce(c, 50);
      } }),
    );
    const session = newSession(rowOf(['burner']), { resources: { ...NO_RESOURCES, powder: 5 } });
    const dry = resolve(registry, session, 'volleyPlanned', { bonus: 0 }, { dryRun: true });
    expect(dry.data.bonus).toBe(50);          // it still counted
    expect(dry.session.resources.powder).toBe(5);  // and nothing was burned

    const real = resolve(registry, session, 'volleyPlanned', { bonus: 0 });
    expect(real.session.resources.powder).toBe(3);
  });
});

describe('the ordering rule holds for every effect kind', () => {
  it('a factor before an addition differs from an addition before a factor', () => {
    const registry = registryOf(
      crest('plus', { volleyPlanned: (c) => { apply(c, 'volleys', 4); } }),
      crest('times', { volleyPlanned: (c) => { apply(c, 'volleyFactor', 2); } }),
    );
    const forward = run(registry, ['plus', 'times'], { volleys: 1 });
    const backward = run(registry, ['times', 'plus'], { volleys: 1 });
    expect(forward.data.volleys).toBe(10);   // (1 + 4) * 2
    expect(backward.data.volleys).toBe(6);   // 1 * 2 + 4
  });
});
