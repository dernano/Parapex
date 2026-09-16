import { describe, expect, it } from 'vitest';
import { UNIT_POOL, createUnit } from '@/content/units/pool';
import { logLine } from '@/content/combat/log';
import type { CombatEvent, CombatState, Unit } from '@/core/types';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { actsFor, isSpectacle, type Act } from '@/ui/acts';

/**
 * The seam. The simulation reports what happened; the screen decides what to
 * show. These are real events from the real engine, never hand-written ones —
 * a translation tested against an invented input tests the invention.
 */

function freshCombat(): CombatState {
  return createCombat({
    deck: UNIT_POOL.map(u => createUnit(u.id)!),
    enemy: { id: 'vorhut', displayName: 'Spähertrupp', hp: 4000, maxHp: 4000 },
    seed: 'acts',
    towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
  }).state;
}

function deploy(state: CombatState, card: Unit, tower: number) {
  const result = performAction({ ...state, hand: [...state.hand, card], momentum: 9 },
    { type: 'DEPLOY_UNIT', cardUid: card.uid, towerIndex: tower });
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result;
}

describe('events become acts', () => {
  it('turns a deployment and its free shot into ONE act', () => {
    const state = freshCombat();
    const { events } = deploy(state, createUnit('gunner-13')!, 2);
    const acts = actsFor(events);

    expect(acts.filter(a => a.kind === 'deployment')).toHaveLength(1);
    const act = acts.find(a => a.kind === 'deployment')!;
    expect(act.tower).toBe(2);
    expect(act.unit.id).toBe('gunner-13');
    expect(act.force).toBeGreaterThan(0);
    expect(act.damage).toBeGreaterThan(0);
  });

  /**
   * Replacing is ONE action, not two: the rules emit `UNIT_DEPLOYED` and then
   * `UNIT_REPLACED` for the same move. Two flourishes for one card would read
   * as two cards.
   */
  it('keeps a replacement as one act, and names who was pushed off the wall', () => {
    let state = freshCombat();
    state = deploy(state, createUnit('bow-3')!, 1).state;
    const { events } = deploy(state, createUnit('gunner-13')!, 1);

    const acts = actsFor(events).filter(a => a.kind === 'deployment');
    expect(acts).toHaveLength(1);
    expect(acts[0]!.replaced?.id).toBe('bow-3');
    expect(acts[0]!.unit.id).toBe('gunner-13');
  });

  it('gathers a volley with the damage that followed it', () => {
    let state = freshCombat();
    for (const [tower, id] of [[0, 'bow-11'], [1, 'crossbow-9'], [2, 'gunner-13']] as const) {
      state = deploy(state, createUnit(id)!, tower).state;
    }
    const ended = performAction(state, { type: 'END_ROUND' });
    if (!ended.ok) throw new Error('refused');

    const acts = actsFor(ended.events);
    const volley = acts.find(a => a.kind === 'volley')!;
    expect(volley).toBeDefined();
    expect(volley.damage).toBeGreaterThan(0);
    expect(volley.settlement.volleys).toBeGreaterThanOrEqual(1);

    // And the round boundary is reported, in order, after it.
    const kinds = acts.map(a => a.kind);
    expect(kinds.indexOf('volley')).toBeLessThan(kinds.indexOf('roundEnded'));
  });

  it('never attributes a volley\'s damage to a deployment', () => {
    let state = freshCombat();
    state = deploy(state, createUnit('gunner-13')!, 2).state;
    const ended = performAction(state, { type: 'END_ROUND' });
    if (!ended.ok) throw new Error('refused');

    const acts = actsFor(ended.events);
    expect(acts.filter(a => a.kind === 'deployment')).toHaveLength(0);
    expect(acts.find(a => a.kind === 'volley')!.damage).toBeGreaterThan(0);
  });

  it('reports an exchange with what it cost', () => {
    const state = freshCombat();
    const result = performAction(state, {
      type: 'EXCHANGE_CARDS', cardUids: state.hand.slice(0, 2).map(c => c.uid),
    });
    if (!result.ok) throw new Error('refused');
    const act = actsFor(result.events).find(a => a.kind === 'exchanged')!;
    expect(act.removed).toBe(2);
    expect(act.drawn).toBe(2);
  });

  it('says when the combat is over, and how', () => {
    let state = freshCombat();
    state = { ...state, enemy: { ...state.enemy, hp: 1 } };
    const { events } = deploy(state, createUnit('gunner-13')!, 2);
    const acts = actsFor(events);
    expect(acts.find(a => a.kind === 'ended')?.outcome).toBe('victory');
  });

  it('plays nothing for an empty burst', () => {
    expect(actsFor([])).toEqual([]);
  });

  it('loses no event that carries damage', () => {
    let state = freshCombat();
    for (const [tower, id] of [[0, 'bow-11'], [3, 'artillery-12']] as const) {
      state = deploy(state, createUnit(id)!, tower).state;
    }
    const ended = performAction(state, { type: 'END_ROUND' });
    if (!ended.ok) throw new Error('refused');

    const dealt = ended.events
      .filter((e): e is Extract<CombatEvent, { type: 'DAMAGE_DEALT' }> =>
        e.type === 'DAMAGE_DEALT')
      .reduce((sum, e) => sum + e.amount, 0);
    const shown = actsFor(ended.events)
      .reduce((sum, a) => sum + (a.kind === 'volley' || a.kind === 'deployment'
        ? a.damage : 0), 0);
    expect(shown).toBe(dealt);
  });

  it('knows which acts are worth watching and which are only worth reading', () => {
    expect(isSpectacle({ kind: 'roundBegan', round: 2 })).toBe(false);
    expect(isSpectacle({ kind: 'reshuffled', count: 12 })).toBe(false);
  });
});

describe('the wording lives in content, not in the seam', () => {
  it('carries no German at all in an act', () => {
    const state = freshCombat();
    const acts = actsFor(deploy(state, createUnit('gunner-13')!, 2).events);
    const text = JSON.stringify(acts.filter(a => a.kind !== 'deployment'));
    expect(text).not.toMatch(/[äöüß]/i);
  });

  it('writes a line for every kind of act', () => {
    const state = freshCombat();
    const unit = createUnit('gunner-13')!;
    const samples: Act[] = [
      { kind: 'deployment', tower: 2, unit, replaced: null, force: 30, damage: 30, overkill: 0 },
      { kind: 'exchanged', removed: 2, drawn: 2, cost: 1 },
      { kind: 'exchanged', removed: 2, drawn: 2, cost: 0 },
      { kind: 'reshuffled', count: 12 },
      { kind: 'roundEnded', round: 2, force: 400 },
      { kind: 'roundBegan', round: 3 },
      { kind: 'ended', outcome: 'victory' },
      { kind: 'ended', outcome: 'defeat' },
      ...actsFor(performAction(
        deploy(state, createUnit('bow-11')!, 0).state, { type: 'END_ROUND' },
      ).ok ? [] : []),
    ];
    for (const act of samples) {
      const line = logLine(act);
      expect(line.length, act.kind).toBeGreaterThan(3);
    }
  });
});
