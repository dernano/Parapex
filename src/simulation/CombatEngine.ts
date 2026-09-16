import type {
  ActionResult, CombatAction, CombatEvent, CombatOutcome, CombatState,
  DamageSource, Enemy, Tower, TowerTypeId, Unit,
} from '@/core/types';
import { RULES } from '@/core/constants';
import { effectiveForce } from '@/content/units/pool';
import { STARTING_TOWER_TYPES, towerFactor } from '@/content/towers/towerTypes';
import type { CrestRow, Resources } from '@/crests/types';
import { EMPTY_ROW, NO_RESOURCES } from '@/crests/types';
import {
  newSession, resolve, type CrestRegistry, type CrestServices,
} from '@/crests/CrestPipeline';
import { GAME_REGISTRY } from '@/content/crests/registry';
import { Rng, type RngState } from './Rng';
import { computeForce, computeForceWithCrests } from './VolleyEngine';

/**
 * What the engine needs besides the state. Not part of the state, because the
 * state is plain data: a registry is a lookup table of functions and a save
 * would drop it.
 */
export interface CombatDeps {
  readonly registry: CrestRegistry;
}

const DEFAULT_DEPS: CombatDeps = { registry: GAME_REGISTRY };

/**
 * Send one event through the crest row and fold the result back into the state.
 *
 * Every call site below looks the same on purpose: there is ONE door into the
 * crest system, and a reader can find every place the row gets a say by
 * searching for this function.
 */
function throughCrests(
  deps: CombatDeps,
  state: CombatState,
  event: Parameters<typeof resolve>[2],
  data: Record<string, unknown>,
  services?: CrestServices,
): { state: CombatState; data: Record<string, unknown> } {
  const result = resolve(deps.registry, state.crests, event, data,
    services ? { services } : {});
  return { state: { ...state, crests: result.session }, data: result.data };
}

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
  /** The five crests, in their order. Empty by default. */
  readonly crests?: CrestRow;
  /** Supplies carried in from the run. */
  readonly resources?: Resources;
  readonly deps?: CombatDeps;
}

export function createCombat(options: CreateCombatOptions): {
  state: CombatState;
  events: readonly CombatEvent[];
} {
  const deps = options.deps ?? DEFAULT_DEPS;
  const rng = Rng.fromSeed(options.seed);
  const types = options.towerTypes ?? STARTING_TOWER_TYPES;
  const towers: Tower[] = Array.from({ length: RULES.towers }, (_, i) => ({
    number: i + 1,
    type: types[i] ?? 'watchtower',
    unit: null,
  }));

  const pile = options.shuffle === false ? options.deck.slice() : rng.shuffle(options.deck);

  const crests = newSession(options.crests ?? EMPTY_ROW, {
    resources: options.resources ?? NO_RESOURCES,
    enemy: options.enemy,
    round: 1,
  });

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
    crests,
  };

  const opened = throughCrests(deps, start, 'combatBegan', { enemy: options.enemy });
  return beginRound(deps, opened.state, 1);
}

/* ============================================================
 *  The one entry point
 * ============================================================ */

export function performAction(
  state: CombatState,
  action: CombatAction,
  deps: CombatDeps = DEFAULT_DEPS,
): ActionResult {
  if (state.outcome) return { ok: false, reason: 'COMBAT_OVER' };

  switch (action.type) {
    case 'DEPLOY_UNIT': return deployUnit(deps, state, action.cardUid, action.towerIndex);
    case 'EXCHANGE_CARDS': return exchangeCards(deps, state, action.cardUids);
    case 'END_ROUND': return endRound(deps, state);
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

function deployUnit(
  deps: CombatDeps, state: CombatState, cardUid: string, towerIndex: number,
): ActionResult {
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

  if (removed) {
    events.push({ type: 'UNIT_REPLACED', towerIndex, removed, unit });
    /*
     * The Boar lets the replaced unit fire one last time. HOW a shot is fired
     * is the combat's business, so the combat hands one in here rather than
     * the crest knowing about towers.
     *
     * The shots are COLLECTED and applied after the event, not during it.
     * Applying them inside the callback looks more faithful to the legacy
     * nesting and silently loses them: the callback would update a captured
     * state while `resolve` returns a state derived from the one it was
     * given — so the parting shot happened and then vanished. The numbers
     * come out identical this way and the nesting is flatter, which is also
     * truer: a shot is not a child of a replacement.
     */
    const partingShots: { index: number; force: number }[] = [];
    const services: CrestServices = {
      fireSingleShot: (index) => {
        const at = next.towers[index];
        if (!at) return 0;
        const force = Math.round(effectiveForce(removed) * towerFactor({ ...at, unit: removed }));
        partingShots.push({ index, force });
        return force;
      },
    };
    next = throughCrests(deps, next, 'unitReplaced',
      { tower: towerIndex, old: removed, unit }, services).state;

    for (const shot of partingShots) {
      events.push({ type: 'SHOT_FIRED', towerIndex: shot.index, unit: removed,
        force: shot.force, source: 'deployment' });
      next = applyDamage(deps, next, shot.force, 'deployment', events);
    }
  }
  events.push({ type: 'UNIT_DEPLOYED', towerIndex, unit, cost });
  next = throughCrests(deps, next, 'unitDeployed', { tower: towerIndex, unit }).state;

  // The immediate shot: this unit alone, through this tower's type.
  const force = Math.round(effectiveForce(unit) * towerFactor({ ...tower, unit }));
  events.push({ type: 'SHOT_FIRED', towerIndex, unit, force, source: 'deployment' });
  next = applyDamage(deps, next, force, 'deployment', events);

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
export function exchangeCost(
  state: CombatState, count: number, deps: CombatDeps = DEFAULT_DEPS,
): number {
  /*
   * Asked once per card, because the discount applies PER exchange and only
   * while it lasts — three cards with two free exchanges cost one.
   *
   * This is a DRY RUN: the display asks the price on every click of a hand
   * card, and that must not burn powder or write to the log. The legacy tree
   * learned this the hard way — the Serpent appeared in no combat log at all,
   * because it only ever acted inside queries, and the synergy matrix reported
   * it as a dead crest. Rightly.
   */
  let total = 0;
  for (let i = 0; i < count; i++) {
    const asked = resolve(deps.registry, state.crests, 'cardsExchanged', {
      count, alreadyExchanged: state.exchangesThisRound + i, cost: RULES.costs.exchange,
    }, { dryRun: true });
    total += Math.max(0, Math.round(asked.data.cost as number));
  }
  return total;
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
function exchangeCards(
  deps: CombatDeps, state: CombatState, cardUids: readonly string[],
): ActionResult {
  const chosen = cardUids
    .map(uid => state.hand.find(c => c.uid === uid))
    .filter((c): c is Unit => Boolean(c));
  if (!chosen.length) return { ok: false, reason: 'NO_CARDS_CHOSEN' };

  const cost = exchangeCost(state, chosen.length, deps);
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

  // And now for real, once per card: this is the run that spends supplies and
  // stands in the log.
  for (let i = 0; i < chosen.length; i++) {
    next = throughCrests(deps, next, 'cardsExchanged', {
      count: chosen.length, alreadyExchanged: state.exchangesThisRound + i,
      cost: RULES.costs.exchange,
    }).state;
  }

  const drawn: Unit[] = [];
  for (let i = 0; i < chosen.length; i++) {
    const result = drawOne(deps, next, events);
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
function endRound(deps: CombatDeps, state: CombatState): ActionResult {
  const events: CombatEvent[] = [];

  // NOT a dry run: here powder really burns and here the combat log is written.
  const planned = computeForceWithCrests(state.towers, {
    crests: { registry: deps.registry, session: state.crests, dryRun: false },
  });
  const settlement = planned.settlement;
  let next: CombatState = { ...state, crests: planned.crests?.session ?? state.crests };
  events.push({ type: 'VOLLEY_FIRED', settlement });

  next = throughCrests(deps, next, 'volleyFired',
    { force: settlement.force, volleys: settlement.volleys }).state;
  next = applyDamage(deps, next, settlement.force, 'volley', events);
  events.push({ type: 'ROUND_ENDED', round: state.round, force: settlement.force });
  /*
   * `round` and `force`, and nothing else — exactly what the legacy tree
   * carries here. The War Chest reads `formations` on this event and finds
   * nothing, so it always gives exactly one mark rather than one per
   * formation. That contradicts its own card text, and it is a LEGACY BUG
   * faithfully reproduced: fixing it here would be a balance change smuggled
   * in under a migration. It belongs on the list, not in this commit.
   */
  next = throughCrests(deps, next, 'roundEnded',
    { round: state.round, force: settlement.force }).state;

  if (next.outcome === 'victory') return { ok: true, state: next, events };

  if (next.round >= next.maxRounds) {
    next = { ...next, outcome: 'defeat' };
    events.push({ type: 'COMBAT_ENDED', outcome: 'defeat' });
    next = throughCrests(deps, next, 'combatEnded', { outcome: 'defeat' }).state;
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
  const begun = beginRound(deps, next, next.round);
  return { ok: true, state: begun.state, events: [...events, ...begun.events] };
}

function beginRound(deps: CombatDeps, state: CombatState, round: number): {
  state: CombatState;
  events: readonly CombatEvent[];
} {
  const events: CombatEvent[] = [];
  let next: CombatState = {
    ...state,
    momentum: state.maxMomentum,
    crests: { ...state.crests, round },
  };

  /*
   * Momentum is on the table here too. It is the scarcest currency in a
   * combat — a commander rule that attacks it hits harder than any number on
   * the enemy, and a crest that raises it is worth more than one giving force.
   */
  const opened = throughCrests(deps, next, 'roundBegan',
    { round, draw: RULES.handSize, momentum: next.maxMomentum });
  next = {
    ...opened.state,
    momentum: Math.max(1, Math.round(opened.data.momentum as number)),
  };
  const toDraw = Math.max(1, Math.round(opened.data.draw as number));
  events.push({ type: 'ROUND_BEGAN', round, momentum: next.momentum });

  const drawn: Unit[] = [];
  while (next.hand.length < toDraw) {
    const result = drawOne(deps, next, events);
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
  deps: CombatDeps,
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
  const drawnState: CombatState = {
    ...state,
    drawPile: pile.slice(0, -1),
    discardPile: discard,
    hand: [...state.hand, unit],
    rng: rngState,
  };
  return {
    state: throughCrests(deps, drawnState, 'cardDrawn', { card: unit }).state,
    unit,
  };
}

/**
 * Damage to the enemy, in ONE place — so victory falls only here, and so there
 * is exactly one door through which a crest could later touch a hit.
 */
function applyDamage(
  deps: CombatDeps,
  state: CombatState,
  force: number,
  source: DamageSource,
  events: CombatEvent[],
): CombatState {
  if (state.outcome || force <= 0) return state;

  /*
   * Three events in a row, and the order is the story of a hit: it is led in
   * (`enemyHit`, where the force can still change), it goes past the target
   * (`overkill`, what the Pillager collects), it lands (`enemyDefeated`).
   */
  const led = throughCrests(deps, state, 'enemyHit', { force, source });
  let next = led.state;
  const amount = Math.max(0, Math.round(led.data.force as number));
  if (amount <= 0) return next;

  const hpBefore = next.enemy.hp;
  const hpAfter = Math.max(0, hpBefore - amount);
  const overkill = amount - hpBefore;

  next = { ...next, enemy: { ...next.enemy, hp: hpAfter },
    crests: { ...next.crests, enemy: { ...next.enemy, hp: hpAfter } } };
  events.push({ type: 'DAMAGE_DEALT', amount, source, hpBefore, hpAfter });
  if (overkill > 0) {
    events.push({ type: 'OVERKILL', amount: overkill, source });
    next = throughCrests(deps, next, 'overkill', { over: overkill, source }).state;
  }

  if (hpAfter <= 0 && !next.outcome) {
    const outcome: CombatOutcome = 'victory';
    next = { ...next, outcome };
    events.push({ type: 'COMBAT_ENDED', outcome });
    next = throughCrests(deps, next, 'enemyDefeated', { source }).state;
    next = throughCrests(deps, next, 'combatEnded', { outcome }).state;
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
export function previewDeployment(
  state: CombatState, towerIndex: number, unit: Unit, deps: CombatDeps = DEFAULT_DEPS,
) {
  return computeForce(
    state.towers.map((t, i) => (i === towerIndex ? { ...t, unit } : t)),
    { crests: { registry: deps.registry, session: state.crests, dryRun: true } },
  );
}

/** What the castle weighs right now. A question, so a dry run. */
export function currentForce(state: CombatState, deps: CombatDeps = DEFAULT_DEPS) {
  return computeForce(state.towers, {
    crests: { registry: deps.registry, session: state.crests, dryRun: true },
  });
}
