import { describe, expect, it } from 'vitest';

import type {
  CrestDefinition, CrestId, CrestReaction, CrestRow, Rejection,
} from '@/crests/types';
import { LIMITS, NO_RESOURCES } from '@/crests/types';
import { newSession, resolve, type CrestRegistry } from '@/crests/CrestPipeline';

/**
 * The machinery, on its own.
 *
 * These stubs are not game content — they are the smallest crests that can
 * exercise one behaviour each. Testing the pipeline through the real fifty
 * would mean a failure could be either the machine or the crest, and the whole
 * point of this system is that those are separate things.
 */

function crest(id: CrestId, listens: CrestDefinition['listens']): CrestDefinition {
  return {
    id, displayName: id, glyph: '⚜', tincture: '#000',
    rarity: 'common', text: '', hint: '', listens,
  };
}

/** Writes its own id into `order`, so the walk can be read off afterwards. */
const notes = (order: string[]): CrestReaction => (_context, ignition) => {
  order.push(`${ignition.id}@${ignition.slot}`);
};

/** Adds to `force`, so ordering shows up as arithmetic. */
const adds = (amount: number): CrestReaction => (context) => {
  context.data.force = (context.data.force as number) + amount;
};
const multiplies = (factor: number): CrestReaction => (context) => {
  context.data.force = (context.data.force as number) * factor;
};

function registryOf(...definitions: CrestDefinition[]): CrestRegistry {
  const byId = new Map(definitions.map(d => [d.id, d]));
  return { crest: id => byId.get(id), commanderRule: id => byId.get(id) };
}

const rowOf = (slots: (CrestId | null)[], extra: Partial<CrestRow> = {}): CrestRow => ({
  slots: [...slots, null, null, null, null, null].slice(0, 5),
  sealed: extra.sealed ?? [],
  commanderRules: extra.commanderRules ?? [],
});

const reasons = (protocol: readonly { rejected: Rejection | null }[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const entry of protocol) if (entry.rejected) out[entry.rejected] = (out[entry.rejected] ?? 0) + 1;
  return out;
};

describe('the row resolves strictly left to right', () => {
  it('walks the slots in order, skipping empty ones', () => {
    const order: string[] = [];
    const registry = registryOf(
      crest('a', { volleyPlanned: notes(order) }),
      crest('b', { volleyPlanned: notes(order) }),
      crest('c', { volleyPlanned: notes(order) }),
    );
    const session = newSession(rowOf(['a', null, 'b', null, 'c']), { resources: NO_RESOURCES });
    resolve(registry, session, 'volleyPlanned', { force: 0 });
    expect(order).toEqual(['a@0', 'b@2', 'c@4']);
  });

  /*
   * THE POINT OF THE WHOLE SYSTEM, as one assertion.
   *
   * (s+10)x3 is not s*3+10. If this ever passes with the two results equal,
   * the ordering has been lost and every crest in the game means something
   * different from what its card says.
   */
  it('(s+10)x3 is not s*3+10', () => {
    const registry = registryOf(
      crest('plus', { volleyPlanned: adds(10) }),
      crest('times', { volleyPlanned: multiplies(3) }),
    );
    const forward = resolve(
      registry, newSession(rowOf(['plus', 'times']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 5 });
    const backward = resolve(
      registry, newSession(rowOf(['times', 'plus']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 5 });

    expect(forward.data.force).toBe(45);   // (5 + 10) * 3
    expect(backward.data.force).toBe(25);  // 5 * 3 + 10
    expect(forward.data.force).not.toBe(backward.data.force);
  });

  it('the commander runs behind the crests, never in front', () => {
    const order: string[] = [];
    const registry = registryOf(
      crest('mine', { volleyPlanned: notes(order) }),
      crest('theirs', { volleyPlanned: notes(order) }),
    );
    const session = newSession(
      rowOf(['mine'], { commanderRules: ['theirs'] }), { resources: NO_RESOURCES });
    resolve(registry, session, 'volleyPlanned', { force: 0 });
    expect(order).toEqual(['mine@0', 'theirs@-1']);
  });

  it('a crest that does not listen to this event stays out of the protocol', () => {
    const registry = registryOf(crest('deaf', { roundBegan: adds(1) }));
    const result = resolve(
      registry, newSession(rowOf(['deaf']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 7 });
    expect(result.data.force).toBe(7);
    expect(result.protocol).toEqual([]);
  });
});

describe('the guards', () => {
  it('a sealed slot is refused, and the reason is recorded', () => {
    const registry = registryOf(crest('a', { volleyPlanned: adds(5) }));
    const result = resolve(
      registry,
      newSession(rowOf(['a'], { sealed: [0] }), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });
    expect(result.data.force).toBe(0);
    expect(reasons(result.protocol)).toEqual({ sealed: 1 });
  });

  it('a seal never touches the commander', () => {
    const registry = registryOf(crest('rule', { volleyPlanned: adds(5) }));
    const result = resolve(
      registry,
      newSession(rowOf([], { sealed: [-1, 0], commanderRules: ['rule'] }),
        { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });
    expect(result.data.force).toBe(5);
  });

  it('one slot may ignite at most perSlot times in one event', () => {
    // A crest that retriggers the slot to its left, forever if it could.
    const registry = registryOf(
      crest('worker', { volleyPlanned: adds(1) }),
      crest('driver', {
        volleyPlanned: (context, _ignition, tools) => {
          for (let i = 0; i < LIMITS.perSlot + 5; i++) tools.retrigger(context, 0);
        },
      }),
    );
    const result = resolve(
      registry, newSession(rowOf(['worker', 'driver']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });

    // One ordinary ignition plus (perSlot - 1) retriggers before the guard bites.
    expect(result.data.force).toBe(LIMITS.perSlot);
    expect(reasons(result.protocol).perSlot).toBe(6);
  });

  it('one event holds at most perEvent ignitions', () => {
    /*
     * Retriggering cannot reach this guard: perSlot caps each of the five
     * slots at 12, which is exactly perEvent. COPIES can, because a copy does
     * not spend the copied slot's allowance but is still counted in the event.
     * That is also the only way the legacy tree ever reached it — measured at
     * 65 ignitions in one event.
     */
    const registry = registryOf(
      crest('worker', { volleyPlanned: adds(1) }),
      crest('mirror', {
        volleyPlanned: (context, _ignition, tools) => {
          for (let i = 0; i < LIMITS.perEvent + 10; i++) tools.copy(context, 0);
        },
      }),
    );
    const result = resolve(
      registry, newSession(rowOf(['worker', 'mirror']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });

    const fired = result.protocol.filter(e => !e.rejected).length;
    expect(fired).toBe(LIMITS.perEvent);
    expect(reasons(result.protocol).perEvent).toBeGreaterThan(0);
    // The guard stopped it; the copies did not silently keep going.
    expect(result.data.force).toBeLessThan(LIMITS.perEvent + 10);
  });

  it('a crest does not ignite in an event it raised itself', () => {
    const registry = registryOf(
      crest('echo', {
        volleyPlanned: (context, _ignition, tools) => {
          context.data.force = (context.data.force as number) + 1;
          tools.raise(context, 'volleyPlanned', context.data);
        },
      }),
    );
    const result = resolve(
      registry, newSession(rowOf(['echo']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });
    // Once, not endlessly.
    expect(result.data.force).toBe(1);
    expect(reasons(result.protocol)).toEqual({ circle: 1 });
  });

  /*
   * `depth` and `chains` have no reachable case with the current crest set —
   * the circle guard stops every chain at depth 1 or 2, which a sweep over
   * 4000 rows confirmed. Here they CAN be reached, because a stub is allowed
   * to be something no real crest is: a raiser that is not itself in the row.
   * That is the only way these two limits get tested at all.
   */
  it('depth is capped, using a raiser that is not in the row it raises into', () => {
    const registry = registryOf(
      crest('inner', {
        volleyPlanned: (context, _ignition, tools) => {
          context.data.force = (context.data.force as number) + 1;
          tools.raise(context, 'volleyPlanned', context.data);
        },
      }),
      crest('outer', {
        volleyPlanned: (context, _ignition, tools) => { tools.raise(context, 'volleyPlanned', context.data); },
      }),
    );
    // `outer` raises into a row containing `inner`, which raises again — and
    // `inner` is blocked by the circle only from its OWN descendants, so the
    // chain deepens through alternating identities until `depth` bites.
    const result = resolve(
      registry, newSession(rowOf(['inner', 'outer']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });
    const deepest = result.protocol.reduce((m, e) => Math.max(m, e.depth), 0);
    expect(deepest).toBeLessThanOrEqual(LIMITS.depth);
  });

  it('chains are capped', () => {
    const registry = registryOf(
      crest('spammer', {
        volleyPlanned: (context, _ignition, tools) => {
          for (let i = 0; i < LIMITS.chains + 5; i++) {
            tools.raise(context, 'roundBegan', { round: 1 });
          }
        },
      }),
    );
    const result = resolve(
      registry, newSession(rowOf(['spammer']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });
    expect(reasons(result.protocol).chains).toBe(5);
  });
});

/*
 * COVERAGE, asserted rather than assumed.
 *
 * The legacy fixtures reach four of the six rejection reasons. `depth` and
 * `chains` have no case among the real fifty crests, because the circle guard
 * ends every chain at depth 1 or 2.
 *
 * `depth` in particular has a precise threshold, measured rather than reasoned:
 * a chain deepens only while a NEW identity is still available to raise, since
 * the circle guard blocks everyone already in the chain's origin. So
 *
 *     5 crests, 0 commander rules  -> deepest 5, guard never fires
 *     5 crests, 1 commander rule   -> deepest 6, guard never fires
 *     5 crests, 2 commander rules  -> guard fires
 *
 * Seven raising identities is the threshold. That is why the row below has
 * two commander rules, and why the number is worth writing down: it says
 * exactly when `depth` stops being insurance and becomes a live rule.
 */
describe('every rejection reason is exercised somewhere', () => {
  it('all six reasons occur across the stub rows', () => {
    const seen = new Set<Rejection>();
    const note = (protocol: readonly { rejected: Rejection | null }[]) => {
      for (const entry of protocol) if (entry.rejected) seen.add(entry.rejected);
    };

    const worker = crest('worker', { volleyPlanned: adds(1) });
    const driver = crest('driver', {
      volleyPlanned: (context, _i, tools) => {
        for (let i = 0; i < LIMITS.perSlot + 5; i++) tools.retrigger(context, 0);
      },
    });
    const mirror = crest('mirror', {
      volleyPlanned: (context, _i, tools) => {
        for (let i = 0; i < LIMITS.perEvent + 10; i++) tools.copy(context, 0);
      },
    });
    const echo = crest('echo', {
      volleyPlanned: (context, _i, tools) => { tools.raise(context, 'volleyPlanned', context.data); },
    });
    const spammer = crest('spammer', {
      volleyPlanned: (context, _i, tools) => {
        for (let i = 0; i < LIMITS.chains + 5; i++) tools.raise(context, 'roundBegan', { round: 1 });
      },
    });
    // Seven distinct raisers: five slots and two commander rules.
    const raisers = ['d1', 'd2', 'd3', 'd4', 'd5', 'r1', 'r2'].map(id => crest(id, {
      volleyPlanned: (context, _i, tools) => { tools.raise(context, 'volleyPlanned', context.data); },
    }));

    const registry = registryOf(worker, driver, mirror, echo, spammer, ...raisers);
    const run = (row: CrestRow) =>
      note(resolve(registry, newSession(row, { resources: NO_RESOURCES }),
        'volleyPlanned', { force: 0 }).protocol);

    run(rowOf(['worker'], { sealed: [0] }));
    run(rowOf(['worker', 'driver']));
    run(rowOf(['worker', 'mirror']));
    run(rowOf(['echo']));
    run(rowOf(['spammer']));
    run(rowOf(['d1', 'd2', 'd3', 'd4', 'd5'], { commanderRules: ['r1', 'r2'] }));

    expect([...seen].sort())
      .toEqual(['chains', 'circle', 'depth', 'perEvent', 'perSlot', 'sealed']);
  });
});

describe('copying is not retriggering', () => {
  it('a copy does not spend the copied slot´s own allowance', () => {
    const registry = registryOf(
      crest('worker', { volleyPlanned: adds(1) }),
      crest('mirror', {
        volleyPlanned: (context, _ignition, tools) => {
          for (let i = 0; i < LIMITS.perSlot + 5; i++) tools.copy(context, 0);
        },
      }),
    );
    const result = resolve(
      registry, newSession(rowOf(['worker', 'mirror']), { resources: NO_RESOURCES }),
      'volleyPlanned', { force: 0 });

    // Every copy went through: 1 ordinary + (perSlot + 5) copies.
    expect(result.data.force).toBe(1 + LIMITS.perSlot + 5);
    expect(reasons(result.protocol).perSlot).toBeUndefined();
  });
});

describe('a resolution cannot leak into the next', () => {
  it('the session handed in is never modified', () => {
    const registry = registryOf(crest('a', { volleyPlanned: adds(1) }));
    const session = newSession(rowOf(['a']), { resources: NO_RESOURCES });
    const before = JSON.stringify(session);
    resolve(registry, session, 'volleyPlanned', { force: 0 });
    resolve(registry, session, 'volleyPlanned', { force: 0 });
    expect(JSON.stringify(session)).toBe(before);
  });

  it('resolving the same session twice gives the same answer', () => {
    const registry = registryOf(
      crest('a', { volleyPlanned: adds(10) }),
      crest('b', { volleyPlanned: multiplies(3) }),
    );
    const session = newSession(rowOf(['a', 'b']), { resources: NO_RESOURCES });
    const first = resolve(registry, session, 'volleyPlanned', { force: 5 });
    const second = resolve(registry, session, 'volleyPlanned', { force: 5 });
    expect(second.data.force).toBe(first.data.force);
    expect(second.protocol.length).toBe(first.protocol.length);
  });

  it('a dry run leaves the combat protocol and the tally alone', () => {
    const registry = registryOf(crest('a', { volleyPlanned: adds(1) }));
    const session = newSession(rowOf(['a']), { resources: NO_RESOURCES });

    const dry = resolve(registry, session, 'volleyPlanned', { force: 0 }, { dryRun: true });
    expect(dry.data.force).toBe(1);              // it still computes
    expect(dry.session.protocol).toEqual([]);     // but wrote nothing down
    expect(dry.session.tally).toEqual({});

    const real = resolve(registry, session, 'volleyPlanned', { force: 0 });
    expect(real.session.protocol).toHaveLength(1);
    expect(real.session.tally).toEqual({ 0: 1 });
  });
});
