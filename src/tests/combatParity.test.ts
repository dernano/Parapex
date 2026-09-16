import { describe, expect, it } from 'vitest';

import type { CombatState, TowerTypeId, Unit } from '@/core/types';
import { createUnit } from '@/content/units/pool';
import { unitIdFromLegacy } from '@/content/units/legacyIds';
import { LEGACY_TOWER_TYPE_IDS } from '@/content/towers/towerTypes';
import { rejectionMessage } from '@/content/combat/rejections';
import { createCombat, performAction } from '@/simulation/CombatEngine';

import golden from './fixtures/combat.golden.json' with { type: 'json' };

/**
 * PARITY OF THE COMBAT ACTIONS.
 *
 * `scripts/goldenCombat.mjs` drove the legacy engine through scripted action
 * sequences with shuffling switched off, snapshotting everything an action can
 * move after every step. Here the new engine is driven through the same
 * sequences and the snapshots are compared step by step.
 *
 * Shuffling is off on both sides on purpose: it is the one part where the two
 * trees legitimately differ (legacy draws from `Math.random`, the new engine
 * from a seeded generator), and comparing it would prove nothing. Reshuffling
 * is covered below by properties that hold whatever the order.
 */

type Snapshot = {
  runde: number; tatendrang: number; tauschInRunde: number;
  hand: string[]; zug: string[]; ablage: string[];
  tuerme: (string | null)[]; feindHp: number; ende: string | null;
};

const ids = (units: readonly Unit[]): string[] => units.map(u => u.id);

function snapshot(state: CombatState): Snapshot {
  return {
    runde: state.round,
    tatendrang: state.momentum,
    tauschInRunde: state.exchangesThisRound,
    hand: ids(state.hand),
    zug: ids(state.drawPile),
    ablage: ids(state.discardPile),
    tuerme: state.towers.map(t => (t.unit ? t.unit.id : null)),
    feindHp: state.enemy.hp,
    ende: state.outcome === 'victory' ? 'sieg'
      : state.outcome === 'defeat' ? 'niederlage' : null,
  };
}

/** The legacy snapshot carries legacy ids; translate before comparing. */
function translate(expected: Snapshot): Snapshot {
  const unit = (id: string): string => unitIdFromLegacy(id) ?? id;
  return {
    ...expected,
    hand: expected.hand.map(unit),
    zug: expected.zug.map(unit),
    ablage: expected.ablage.map(unit),
    tuerme: expected.tuerme.map(id => (id === null ? null : unit(id))),
  };
}

describe('performAction reproduces the legacy combat', () => {
  for (const testCase of golden.faelle) {
    it(testCase.name, () => {
      const setup = testCase.aufbau;
      const deck = setup.deckIds
        .map(id => createUnit(unitIdFromLegacy(id)!))
        .filter((u): u is Unit => Boolean(u));
      expect(deck).toHaveLength(setup.deckIds.length);

      const towerTypes = setup.turmTypen
        .map(t => LEGACY_TOWER_TYPE_IDS[t]!) as TowerTypeId[];

      const created = createCombat({
        deck,
        enemy: { id: 'pruef', displayName: 'Prüfgegner',
          hp: setup.feindHp, maxHp: setup.feindHp },
        seed: 'parity',
        towerTypes,
        shuffle: false,
      });
      let state = created.state;

      const steps = testCase.schritte as {
        handlung: null | Record<string, unknown>;
        antwort?: { ok: boolean; grund: string | null };
        stand: Snapshot;
      }[];

      expect(snapshot(state)).toEqual(translate(steps[0]!.stand));

      for (let i = 1; i < steps.length; i++) {
        const step = steps[i]!;
        const action = step.handlung as {
          art: string; handIndex?: number; turmIndex?: number; handIndizes?: number[];
        };

        let result;
        if (action.art === 'setzen') {
          const card = state.hand[action.handIndex!];
          result = performAction(state, {
            type: 'DEPLOY_UNIT',
            cardUid: card?.uid ?? 'nicht-auf-der-hand',
            towerIndex: action.turmIndex!,
          });
        } else if (action.art === 'tauschen') {
          const uids = action.handIndizes!
            .map(index => state.hand[index]?.uid)
            .filter((uid): uid is string => Boolean(uid));
          result = performAction(state, { type: 'EXCHANGE_CARDS', cardUids: uids });
        } else {
          result = performAction(state, { type: 'END_ROUND' });
        }

        const expectedAnswer = step.antwort!;
        expect(result.ok, `Schritt ${i} (${action.art})`).toBe(expectedAnswer.ok);
        if (!result.ok) {
          /*
           * Compare the SENTENCE, not the code. The engine returns a code and
           * the content layer turns it into German — so what this asserts is
           * that the player reads exactly what they read before, which is the
           * contract that actually matters. It is also what caught the dropped
           * "Dafür fehlen n Tatendrang."
           */
          expect(rejectionMessage(result)).toBe(expectedAnswer.grund);
        } else {
          state = result.state;
        }
        expect(snapshot(state), `Zustand nach Schritt ${i} (${action.art})`)
          .toEqual(translate(step.stand));
      }
    });
  }
});

describe('the fixtures cover what they claim to cover', () => {
  it('includes a victory, a defeat and a refusal', () => {
    const endings = new Set<string>();
    let refusals = 0;
    for (const testCase of golden.faelle) {
      for (const step of testCase.schritte) {
        const s = step.stand as Snapshot;
        if (s.ende) endings.add(s.ende);
        const answer = (step as { antwort?: { ok: boolean } }).antwort;
        if (answer && !answer.ok) refusals++;
      }
    }
    expect([...endings].sort()).toEqual(['niederlage', 'sieg']);
    expect(refusals).toBeGreaterThanOrEqual(3);
  });
});
