import type {
  ActionResult, CombatAction, CombatEvent, CombatOutcome, CombatState,
  DamageSource, Enemy, Tower, TowerTypeId, Unit,
} from '@/core/types';
import { RULES } from '@/core/constants';
import { effectiveForce } from '@/content/units/pool';
import { STARTING_TOWER_TYPES, towerFactor } from '@/content/towers/towerTypes';
import { Rng, type RngState } from './Rng';
import { computeForce } from './VolleyEngine';

/**
 * The combat rules.
 *
 * ONE ENTRY POINT: `performAction(state, action)` takes a state and returns a
 * new state plus the list of what happened. It never mutates its argument,
 * never reaches for an ambient binding, never touches the DOM, a canvas, a
 * timer or audio. Run it in Node, run it a thousand times in a balance sweep,
 * run it inside a test — it behaves identically because there is nothing else
 * for it to depend on.
 *
 * THE EVENTS ARE THE SEAM. The renderer replays them; it does not create them.
 * An animation may spend 600 ms on a VOLLEY_FIRED and the damage inside it was
 * decided before the first frame. Animation length cannot change the outcome,
 * because by the time anything is drawn the outcome already exists.
 *
 * Crests do not appear here yet — that is Phase 3. When they arrive they read
 * and amend these same events; they will not become a second set of hooks.
 */

/* ============================================================
 *  Building a combat
 * ============================================================ */

export interface CreateCombatOptions {
  readonly deck: readonly Unit[];
  readonly enemy: Enemy;
  readonly seed: string | number;
  readonly towerTypes?: readonly TowerTypeId[];
  /** Skip the shuffle. Only for tests and for measuring, never for play. */
  readonly shuffle?: boolean;
}

export function createCombat(options: CreateCombatOptions): {
  state: CombatState;
  events: readonly CombatEvent[];
} {
  const rng = Rng.fromSeed(options.seed);
  const types = options.towerTypes ?? STARTING_TOWER_TYPES;
  const towers: Tower[] = Array.from({ length: RULES.towers }, (_, i) => ({
    number: i + 1,
    type: types[i] ?? 'watchtower',
    unit: null,
  }));

  const pile = options.shuffle === false ? options.deck.slice() : rng.shuffle(options.deck);

  const start: CombatState = {
    round: 1,
    maxRounds: RULES.rounds,
    momentum: RULES.momentum,
    maxMomentum: RULES.momentum,
    exchangesThisRound: 0,
    towers,
    drawPile: pile,
    hand: [],
    discardPile: [],
    enemy: options.enemy,
    outcome: null,
    rng: rng.state,
  };

  return beginRound(start, 1);
}

/* ============================================================
 *  The one entry point
 * ============================================================ */

export function performAction(state: CombatState, action: CombatAction): ActionResult {
  if (state.outcome) return { ok: false, reason: 'COMBAT_OVER' };

  switch (action.type) {
    case 'DEPLOY_UNIT': return deployUnit(state, action.cardUid, action.towerIndex);
    case 'EXCHANGE_CARDS': return exchangeCards(state, action.cardUids);
    case 'END_ROUND': return endRound(state);
  }
}

/* ============================================================
 *  Deploying
 * ============================================================ */

/**
 * A unit onto a tower. If somebody is standing there they are replaced and go
 * to the discard pile — which shifts the odds in the pile during the combat,
 * and that is intended.
 *
 * The new unit fires ONE shot immediately. The rest of its force arrives at
 * the end of the round with the volley.
 */
/**
 * What deploying onto this tower costs.
 *
 * Exported so the interface can grey out a card without guessing, and so the
 * distinction between deploying and replacing is pinned to the constants
 * rather than to a literal. Both are 1 today, which means no test can tell a
 * hardcoded `costs.deploy` from the correct expression — this function is what
 * makes that distinction survive the day they differ.
 */
export function deployCost(state: CombatState, towerIndex: number): number {
  return state.towers[towerIndex]?.unit ? RULES.costs.replace : RULES.costs.deploy;
}

function deployUnit(state: CombatState, cardUid: string, towerIndex: number): ActionResult {
  const tower = state.towers[towerIndex];
  if (!tower) return { ok: false, reason: 'NO_SUCH_TOWER' };

  const unit = state.hand.find(c => c.uid === cardUid);
  if (!unit) return { ok: false, reason: 'CARD_NOT_IN_HAND' };

  const cost = deployCost(state, towerIndex);
  if (cost > state.momentum) return { ok: false, reason: 'NOT_ENOUGH_MOMENTUM' };

  const events: CombatEvent[] = [];
  const removed = tower.unit;

  let next: CombatState = {
    ...state,
    momentum: state.momentum - cost,
    hand: state.hand.filter(c => c.uid !== cardUid),
    discardPile: removed ? [...state.discardPile, removed] : state.discardPile,
    towers: state.towers.map((t, i) => (i === towerIndex ? { ...t, unit } : t)),
  };

  if (removed) events.push({ type: 'UNIT_REPLACED', towerIndex, removed, unit });
  events.push({ type: 'UNIT_DEPLOYED', towerIndex, unit, cost });

  // The immediate shot: this unit alone, through this tower's type.
  const force = Math.round(effectiveForce(unit) * towerFactor({ ...tower, unit }));
  events.push({ type: 'SHOT_FIRED', towerIndex, unit, force, source: 'deployment' });
  next = applyDamage(next, force, 'deployment', events);

  return { ok: true, state: next, events };
}

/* ============================================================
 *  Exchanging
 * ============================================================ */

/**
 * What n exchanges cost together.
 *
 * Without crests this is simply n times the base cost. It is a function rather
 * than a multiplication because in Phase 3 the crest row decides it — the
 * legacy tree learned the hard way that a discount implemented as a special
 * hook could not be copied, sealed or amplified like everything else.
 */
export function exchangeCost(_state: CombatState, count: number): number {
  return count * RULES.costs.exchange;
}

/**
 * Exchanging hand cards. This is what replaces discarding: getting rid of a
 * card costs something, which is why a mediocre hand is a decision rather than
 * an annoyance.
 *
 * THE ORDER IS THE WHOLE TRICK: the exchanged cards go ASIDE first, then the
 * replacements are drawn, and only THEN do they reach the discard pile. Discard
 * them straight away and an empty draw pile could shuffle them back in, so you
 * would draw the very card you just paid to be rid of.
 */
function exchangeCards(state: CombatState, cardUids: readonly string[]): ActionResult {
  const chosen = cardUids
    .map(uid => state.hand.find(c => c.uid === uid))
    .filter((c): c is Unit => Boolean(c));
  if (!chosen.length) return { ok: false, reason: 'NO_CARDS_CHOSEN' };

  const cost = exchangeCost(state, chosen.length);
  if (cost > state.momentum) {
    // With the shortfall, because exchanging several at once is where knowing
    // "three short" turns a dead end into a smaller choice.
    return { ok: false, reason: 'NOT_ENOUGH_MOMENTUM', shortfall: cost - state.momentum };
  }

  const events: CombatEvent[] = [];
  const leaving = new Set(chosen.map(c => c.uid));

  // Aside, not discarded.
  let next: CombatState = {
    ...state,
    momentum: state.momentum - cost,
    exchangesThisRound: state.exchangesThisRound + chosen.length,
    hand: state.hand.filter(c => !leaving.has(c.uid)),
  };

  const drawn: Unit[] = [];
  for (let i = 0; i < chosen.length; i++) {
    const result = drawOne(next, events);
    next = result.state;
    if (!result.unit) break;
    drawn.push(result.unit);
  }

  // Only now.
  next = { ...next, discardPile: [...next.discardPile, ...chosen] };
  events.push({ type: 'CARDS_EXCHANGED', removed: chosen, drawn, cost });

  return { ok: true, state: next, events };
}

/* ============================================================
 *  Ending a round
 * ============================================================ */

/**
 * The whole garrison fires together, then the books are closed. After the
 * fifth round it is over — whoever has not brought the enemy down by then has
 * lost. There is no sixth.
 */
function endRound(state: CombatState): ActionResult {
  const events: CombatEvent[] = [];

  const settlement = computeForce(state.towers);
  events.push({ type: 'VOLLEY_FIRED', settlement });

  let next = applyDamage(state, settlement.force, 'volley', events);
  events.push({ type: 'ROUND_ENDED', round: state.round, force: settlement.force });

  if (next.outcome === 'victory') return { ok: true, state: next, events };

  if (next.round >= next.maxRounds) {
    next = { ...next, outcome: 'defeat' };
    events.push({ type: 'COMBAT_ENDED', outcome: 'defeat' });
    return { ok: true, state: next, events };
  }

  // Next round: discard the hand, draw a new one, refill momentum.
  next = {
    ...next,
    discardPile: [...next.discardPile, ...next.hand],
    hand: [],
    round: next.round + 1,
    exchangesThisRound: 0,
  };
  const begun = beginRound(next, next.round);
  return { ok: true, state: begun.state, events: [...events, ...begun.events] };
}

function beginRound(state: CombatState, round: number): {
  state: CombatState;
  events: readonly CombatEvent[];
} {
  const events: CombatEvent[] = [];
  let next: CombatState = { ...state, momentum: state.maxMomentum };
  events.push({ type: 'ROUND_BEGAN', round, momentum: next.momentum });

  const drawn: Unit[] = [];
  while (next.hand.length < RULES.handSize) {
    const result = drawOne(next, events);
    next = result.state;
    if (!result.unit) break;
    drawn.push(result.unit);
  }
  if (drawn.length) events.push({ type: 'CARDS_DRAWN', units: drawn });

  return { state: next, events };
}

/* ============================================================
 *  Drawing and damage
 * ============================================================ */

/** One card off the END of the pile. Empty pile: the discard becomes the pile. */
function drawOne(
  state: CombatState,
  events: CombatEvent[],
): { state: CombatState; unit: Unit | null } {
  let pile = state.drawPile;
  let discard = state.discardPile;
  let rngState: RngState = state.rng;

  if (!pile.length) {
    if (!discard.length) return { state, unit: null };
    const rng = Rng.fromState(rngState);
    pile = rng.shuffle(discard);
    discard = [];
    rngState = rng.state;
    events.push({ type: 'DRAW_PILE_RESHUFFLED', count: pile.length });
  }

  const unit = pile[pile.length - 1]!;
  return {
    state: {
      ...state,
      drawPile: pile.slice(0, -1),
      discardPile: discard,
      hand: [...state.hand, unit],
      rng: rngState,
    },
    unit,
  };
}

/**
 * Damage to the enemy, in ONE place — so victory falls only here, and so there
 * is exactly one door through which a crest could later touch a hit.
 */
function applyDamage(
  state: CombatState,
  force: number,
  source: DamageSource,
  events: CombatEvent[],
): CombatState {
  if (state.outcome || force <= 0) return state;

  const amount = Math.max(0, Math.round(force));
  if (amount <= 0) return state;

  const hpBefore = state.enemy.hp;
  const hpAfter = Math.max(0, hpBefore - amount);
  const overkill = amount - hpBefore;

  let next: CombatState = { ...state, enemy: { ...state.enemy, hp: hpAfter } };
  events.push({ type: 'DAMAGE_DEALT', amount, source, hpBefore, hpAfter });
  if (overkill > 0) events.push({ type: 'OVERKILL', amount: overkill, source });

  if (hpAfter <= 0) {
    const outcome: CombatOutcome = 'victory';
    next = { ...next, outcome };
    events.push({ type: 'COMBAT_ENDED', outcome });
  }
  return next;
}

/* ============================================================
 *  Asking without touching
 * ============================================================ */

/**
 * What the castle would weigh if this card stood on that tower. For the
 * preview while a card hangs over a tower: the player should SEE combinations
 * rather than compute them.
 *
 * There is no `dryRun` flag, because there is nothing to suppress.
 */
export function previewDeployment(state: CombatState, towerIndex: number, unit: Unit) {
  return computeForce(
    state.towers.map((t, i) => (i === towerIndex ? { ...t, unit } : t)),
  );
}

/** What the castle weighs right now. */
export function currentForce(state: CombatState) {
  return computeForce(state.towers);
}
