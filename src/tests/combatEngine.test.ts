import { describe, expect, it } from 'vitest';

import type { CombatAction, CombatEvent, CombatState, Unit } from '@/core/types';
import { RULES } from '@/core/constants';
import { UNIT_POOL, createUnit } from '@/content/units/pool';
import {
  createCombat, deployCost, performAction, previewDeployment,
} from '@/simulation/CombatEngine';

/**
 * What parity cannot prove.
 *
 * The fixtures show the new engine answers what the old one answered. These
 * tests show the things the migration exists FOR — purity, determinism, and
 * the claim that animation cannot influence the outcome. None of them would
 * have been expressible against the legacy tree at all.
 */

const deckOf = (count: number): Unit[] =>
  UNIT_POOL.slice(0, count).map(p => createUnit(p.id)!).filter(Boolean);

function start(options: { deck?: Unit[]; hp?: number; seed?: string } = {}) {
  const hp = options.hp ?? 100_000;
  return createCombat({
    deck: options.deck ?? deckOf(40),
    enemy: { id: 'e', displayName: 'Prüfgegner', hp, maxHp: hp },
    seed: options.seed ?? 'test',
  });
}

/** Freeze a state and everything reachable from it. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

describe('the engine never touches what it was given', () => {
  it('a deep-frozen state survives every action', () => {
    let state = deepFreeze(start().state);

    const actions: CombatAction[] = [
      { type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0 },
      { type: 'EXCHANGE_CARDS', cardUids: [state.hand[1]!.uid] },
      { type: 'END_ROUND' },
    ];

    for (const action of actions) {
      // Frozen: any attempt to write a field throws in strict mode, and every
      // module here is a module, so strict mode is not optional.
      const result = performAction(state, action);
      expect(result.ok).toBe(true);
      if (result.ok) state = deepFreeze(result.state);
    }
    expect(state.round).toBe(2);
  });

  it('a refused action returns the state untouched', () => {
    const { state } = start();
    const before = JSON.stringify(state);
    const result = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: 'does-not-exist', towerIndex: 0,
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('a preview costs nothing and changes nothing', () => {
    const { state } = start();
    const before = JSON.stringify(state);
    const settlement = previewDeployment(state, 2, state.hand[0]!);
    expect(settlement.force).toBeGreaterThan(0);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.momentum).toBe(RULES.momentum);
  });
});

describe('the engine is deterministic', () => {
  const playOut = (seed: string): CombatState => {
    let state = createCombat({
      deck: deckOf(20),
      enemy: { id: 'e', displayName: 'Prüfgegner', hp: 100_000, maxHp: 100_000 },
      seed,
    }).state;
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 5 && state.hand.length; i++) {
        const result = performAction(state, {
          type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: i,
        });
        if (result.ok) state = result.state;
      }
      const ended = performAction(state, { type: 'END_ROUND' });
      if (ended.ok) state = ended.state;
    }
    return state;
  };

  const withoutUids = (state: CombatState) =>
    JSON.parse(JSON.stringify(state, (key, value) => (key === 'uid' ? undefined : value)));

  it('the same seed plays out identically', () => {
    expect(withoutUids(playOut('same'))).toEqual(withoutUids(playOut('same')));
  });

  it('a different seed deals a different combat', () => {
    expect(withoutUids(playOut('one'))).not.toEqual(withoutUids(playOut('two')));
  });

  it('a state survives JSON and resumes identically', () => {
    let state = start({ deck: deckOf(20), seed: 'resume' }).state;
    const deployed = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0,
    });
    if (deployed.ok) state = deployed.state;

    const saved: CombatState = JSON.parse(JSON.stringify(state));
    const fromLive = performAction(state, { type: 'END_ROUND' });
    const fromSaved = performAction(saved, { type: 'END_ROUND' });
    expect(fromSaved.ok && fromLive.ok).toBe(true);
    if (fromLive.ok && fromSaved.ok) {
      expect(fromSaved.state).toEqual(fromLive.state);
    }
  });
});

describe('no card is ever lost or duplicated', () => {
  it('holds across a full combat, reshuffles included', () => {
    // A deck small enough that the pile empties and has to be rebuilt.
    const deck = deckOf(9);
    const census = deck.map(u => u.uid).sort();
    let state = start({ deck, seed: 'reshuffle' }).state;
    let reshuffles = 0;

    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 4 && state.hand.length; i++) {
        const result = performAction(state, {
          type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: i,
        });
        if (result.ok) state = result.state;
      }
      const ended = performAction(state, { type: 'END_ROUND' });
      if (ended.ok) {
        reshuffles += ended.events.filter(e => e.type === 'DRAW_PILE_RESHUFFLED').length;
        state = ended.state;
      }

      const present = [
        ...state.hand, ...state.drawPile, ...state.discardPile,
        ...state.towers.map(t => t.unit).filter((u): u is Unit => Boolean(u)),
      ].map(u => u.uid).sort();
      expect(present).toEqual(census);
    }
    // The test is worthless if the pile never actually emptied.
    expect(reshuffles).toBeGreaterThan(0);
  });
});

describe('exchanging puts cards aside before drawing, not into the discard', () => {
  /*
   * The subtlety the legacy tree warns about in a comment, pinned as a test.
   *
   * Discard the exchanged cards straight away and an empty draw pile shuffles
   * them back in — so you draw the very card you just paid to be rid of. That
   * is invisible in every ordinary hand and inevitable in a thin deck, which
   * is exactly the deck a good run builds.
   *
   * The first version of this suite did not catch it: the reshuffle test only
   * deployed, so the ordering never mattered.
   */
  it('a card just exchanged cannot come straight back', () => {
    // Eight cards: seven on hand, one left in the pile. Exchanging three means
    // the pile runs dry mid-draw, with nothing legitimately in the discard.
    const deck = deckOf(8);
    const { state } = start({ deck, seed: 'aside' });
    expect(state.hand).toHaveLength(7);
    expect(state.drawPile).toHaveLength(1);

    const given = state.hand.slice(0, 3);
    const result = performAction(state, {
      type: 'EXCHANGE_CARDS', cardUids: given.map(c => c.uid),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exchanged = result.events.find(
      (e): e is Extract<CombatEvent, { type: 'CARDS_EXCHANGED' }> =>
        e.type === 'CARDS_EXCHANGED')!;

    // Only the one card that was really left may be drawn. Three drawn cards
    // would mean the discard was reshuffled — with the cards just handed in.
    expect(exchanged.drawn).toHaveLength(1);
    const back = new Set(given.map(c => c.uid));
    for (const card of exchanged.drawn) expect(back.has(card.uid)).toBe(false);
    for (const card of given) expect(result.state.discardPile).toContain(card);
    expect(result.events.some(e => e.type === 'DRAW_PILE_RESHUFFLED')).toBe(false);
  });
});

describe('costs come from the rules, not from literals', () => {
  it('an occupied tower costs the replacement price, an empty one the deployment price', () => {
    let state = start().state;
    expect(deployCost(state, 0)).toBe(RULES.costs.deploy);

    const deployed = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0,
    });
    if (!deployed.ok) throw new Error('setup failed');
    state = deployed.state;

    expect(deployCost(state, 0)).toBe(RULES.costs.replace);
    expect(deployCost(state, 1)).toBe(RULES.costs.deploy);
  });
});

describe('the events describe what happened, in order', () => {
  it('deploying reports the deployment, then the shot, then the damage', () => {
    const { state } = start({ hp: 100_000 });
    const result = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.map(e => e.type))
      .toEqual(['UNIT_DEPLOYED', 'SHOT_FIRED', 'DAMAGE_DEALT']);
  });

  it('replacing reports the replacement before the deployment', () => {
    let state = start().state;
    const first = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0,
    });
    if (!first.ok) throw new Error('setup failed');
    state = first.state;

    const second = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events[0]!.type).toBe('UNIT_REPLACED');
    expect(second.events[1]!.type).toBe('UNIT_DEPLOYED');
  });

  it('victory is reported once, and nothing follows it', () => {
    let state = start({ hp: 1 }).state;
    const result = performAction(state, {
      type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    expect(state.outcome).toBe('victory');
    expect(result.events.filter(e => e.type === 'COMBAT_ENDED')).toHaveLength(1);
    expect(result.events.at(-1)!.type).toBe('COMBAT_ENDED');

    // And the combat is closed: nothing more is accepted.
    expect(performAction(state, { type: 'END_ROUND' }).ok).toBe(false);
  });

  /*
   * THE ARCHITECTURAL CLAIM, as a test.
   *
   * Everything the presentation needs is already in the returned events, and
   * the state already reflects it. An AnimationDirector may take a second over
   * this list or no time at all; it cannot change what happened, because what
   * happened was decided before it was handed anything.
   */
  it('every hit carries its damage already decided', () => {
    let state = start({ hp: 5000 }).state;
    for (let i = 0; i < 3; i++) {
      const result = performAction(state, {
        type: 'DEPLOY_UNIT', cardUid: state.hand[0]!.uid, towerIndex: i,
      });
      if (result.ok) state = result.state;
    }
    const ended = performAction(state, { type: 'END_ROUND' });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;

    const hits = ended.events.filter(
      (e): e is Extract<CombatEvent, { type: 'DAMAGE_DEALT' }> => e.type === 'DAMAGE_DEALT');
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.amount).toBeGreaterThan(0);
      expect(hit.hpBefore - hit.hpAfter).toBe(Math.min(hit.amount, hit.hpBefore));
    }
    // The last hit's end state is the state the engine returned.
    expect(hits.at(-1)!.hpAfter).toBe(ended.state.enemy.hp);
  });
});
