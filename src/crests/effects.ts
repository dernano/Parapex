import type {
  CrestContext, CrestEffect, CrestTools, Ignition, ResourceKind,
} from './types';

/**
 * Everything a crest can change about a situation.
 *
 * A crest NEVER touches the situation itself. It calls an effect, and the
 * effect writes its change into the protocol. That costs one line and buys two
 * things not otherwise available:
 *
 * 1. The combat log is complete. Every number that moved is there with its
 *    author.
 * 2. AMPLIFYING AND COPYING WORK WITHOUT KNOWLEDGE. `amplify` does not need to
 *    know what the slot before it did — it reads that slot's recorded effects
 *    and applies them again. A crest invented tomorrow is amplifiable today.
 *
 * Which is why additive and multiplicative effects are strictly separated.
 * Doubling `+3 volleys` doubles the three; doubling `×1.5 force` squares the
 * factor — ×2.25, not ×3. That is the only way "counts double" can mean the
 * same thing for both shapes.
 */

type Arithmetic = 'plus' | 'times';

/** Which field an effect touches, and how. There are no other kinds. */
export const EFFECT_KINDS: Readonly<Record<string, { field: string; arithmetic: Arithmetic }>> = {
  volleys:       { field: 'volleys',    arithmetic: 'plus' },
  volleyFactor:  { field: 'volleys',    arithmetic: 'times' },
  bonus:         { field: 'bonus',      arithmetic: 'plus' },
  perVolleyFactor: { field: 'perVolley', arithmetic: 'times' },
  factor:        { field: 'factor',     arithmetic: 'times' },
  force:         { field: 'force',      arithmetic: 'plus' },
  forceFactor:   { field: 'force',      arithmetic: 'times' },
  momentum:      { field: 'momentum',   arithmetic: 'plus' },
  rank:          { field: 'rank',       arithmetic: 'plus' },
  draw:          { field: 'draw',       arithmetic: 'plus' },
  cost:          { field: 'cost',       arithmetic: 'plus' },
  copies:        { field: 'copies',     arithmetic: 'plus' },
};

/** Record a change against the ignition currently running. */
function note(
  context: CrestContext,
  kind: string,
  value: CrestEffect['value'],
  text: string,
): CrestEffect | null {
  if (!context.current) return null;
  const effect: CrestEffect = { kind, value, note: text };
  context.current.effects.push(effect);
  return effect;
}

/**
 * The one place where something changes.
 *
 * A crest acting on an event that has no such field is a defect in the CREST,
 * not in the event. It is recorded rather than swallowed — otherwise we get
 * another Dragon: a crest that claimed an effect on its card which it had not
 * had since a rewrite, and which nobody noticed for a year.
 */
export function apply(
  context: CrestContext,
  kind: string,
  value: number,
  text = '',
): CrestEffect | null {
  const rule = EFFECT_KINDS[kind];
  if (!rule) return null;

  const present = Object.prototype.hasOwnProperty.call(context.data, rule.field);
  const current = context.data[rule.field];
  if (!present || typeof current !== 'number') {
    return note(context, 'missed', 0, `${kind} findet auf ${context.event} kein Feld`);
  }

  if (rule.arithmetic === 'plus') {
    if (!value) return null;
    context.data[rule.field] = current + value;
  } else {
    if (value === 1) return null;
    context.data[rule.field] = current * value;
  }
  return note(context, kind, value, text);
}

/** Put a supply on the shelf, or take one off it. */
export function moveResource(
  context: CrestContext,
  tools: CrestTools,
  kind: ResourceKind,
  amount: number,
  text = '',
): CrestEffect | null {
  const moved = tools.moveResource(context, kind, amount);
  if (!moved) return null;
  return note(context, 'resource', { resource: kind, amount: moved }, text);
}

/* ---------- The handy forms ----------
 * So a crest writes `addVolleys(context, 3)` and never has to know the table.
 */

export const addVolleys = (c: CrestContext, n: number, t = '') => apply(c, 'volleys', n, t);
export const multiplyVolleys = (c: CrestContext, f: number, t = '') => apply(c, 'volleyFactor', f, t);
export const addForce = (c: CrestContext, n: number, t = '') => apply(c, 'bonus', n, t);
export const multiplyForce = (c: CrestContext, f: number, t = '') => apply(c, 'factor', f, t);
export const multiplyPerVolley = (c: CrestContext, f: number, t = '') => apply(c, 'perVolleyFactor', f, t);
export const addHit = (c: CrestContext, n: number, t = '') => apply(c, 'force', n, t);
export const multiplyHit = (c: CrestContext, f: number, t = '') => apply(c, 'forceFactor', f, t);
export const addMomentum = (c: CrestContext, n: number, t = '') => apply(c, 'momentum', n, t);
export const addRank = (c: CrestContext, n: number, t = '') => apply(c, 'rank', n, t);
export const addDraw = (c: CrestContext, n: number, t = '') => apply(c, 'draw', n, t);
export const addCost = (c: CrestContext, n: number, t = '') => apply(c, 'cost', n, t);
export const addCopies = (c: CrestContext, n: number, t = '') => apply(c, 'copies', n, t);

export const give = (c: CrestContext, tools: CrestTools, k: ResourceKind, n: number, t = '') =>
  moveResource(c, tools, k, n, t);
export const take = (c: CrestContext, tools: CrestTools, k: ResourceKind, n: number, t = '') =>
  moveResource(c, tools, k, -n, t);
export const held = (tools: CrestTools, k: ResourceKind): number => tools.resources()[k];

/* ---------- Effects upon effects ----------
 *
 * This is where a collection becomes a machine. These three know not one crest
 * name — they work on what the slots to their LEFT recorded. Which is why the
 * arrangement on the rack is a blueprint and not a matter of taste.
 */

/**
 * Apply what a slot did one more time.
 *
 * `times = 1` means once more, so twice in total. Additive effects are
 * multiplied by `times`, multiplicative ones raised to that power — ×1.5 once
 * more is ×2.25, not ×3.
 */
export function applyAgain(
  context: CrestContext,
  tools: CrestTools,
  ignition: Ignition | null,
  times = 1,
): number {
  if (!ignition || times <= 0) return 0;
  let done = 0;
  // Copy the list: this crest's own effects would otherwise land in the same
  // loop and amplify themselves until the stack is full.
  for (const effect of ignition.effects.slice()) {
    if (effect.kind === 'missed') continue;
    if (effect.kind === 'resource') {
      const value = effect.value as { resource: ResourceKind; amount: number };
      if (moveResource(context, tools, value.resource, value.amount * times, 'verstärkt')) done++;
      continue;
    }
    const rule = EFFECT_KINDS[effect.kind];
    if (!rule || typeof effect.value !== 'number') continue;
    const value = rule.arithmetic === 'plus'
      ? effect.value * times
      : Math.pow(effect.value, times);
    if (apply(context, effect.kind, value, 'verstärkt')) done++;
  }
  return done;
}

/** The last ignition BEFORE the running slot — what an amplifier hooks into. */
export function previousIgnition(context: CrestContext): Ignition | null {
  const others = context.ignitions.filter(i => !i.rejected && i !== context.current);
  return others.length ? others[others.length - 1]! : null;
}

/** Every ignition from earlier slots of this event. */
export function ignitionsBefore(context: CrestContext): Ignition[] {
  return context.ignitions.filter(
    i => i !== context.current && i.slot < context.slot && !i.rejected);
}

/**
 * Amplify the slot immediately before. The most ordinary synergy crest there
 * is — and the one a player first notices they can reorder.
 */
export const amplifyPrevious = (c: CrestContext, tools: CrestTools, times = 1) =>
  applyAgain(c, tools, previousIgnition(c), times);

/**
 * Amplify everything to the left. Expensive, rare, and the reason such a crest
 * belongs in slot 5 and does nothing in slot 1.
 */
export function amplifyAllBefore(c: CrestContext, tools: CrestTools, times = 1): number {
  let done = 0;
  for (const ignition of ignitionsBefore(c)) done += applyAgain(c, tools, ignition, times);
  return done;
}
