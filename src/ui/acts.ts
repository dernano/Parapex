import type { CombatEvent, Unit } from '@/core/types';
import type { Act } from '@/core/acts';

export type { Act } from '@/core/acts';
export { NOTE_SECONDS, isSpectacle } from '@/core/acts';

/**
 * EVENTS IN, ACTS OUT.
 *
 * The simulation reports what happened; the screen has to decide what to SHOW.
 * Those are different lists and this is where they meet — the seam the whole
 * migration is built around.
 *
 * Why not read the state instead? Because the state is an ANSWER and the
 * events are a STORY. `state.enemy.hp` dropped by 4 200 tells the screen
 * nothing about whether that was one volley, a deployment shot or a crest
 * firing a sixth time; the events say. And because a presentation built from
 * events cannot influence them: by the time the first act is played, the
 * outcome already exists.
 *
 * An act carries NO GERMAN. The wording lives in `content/combat/log.ts`, so a
 * sentence can be reworded without touching this file and this file can be
 * tested without asserting on prose.
 */

/**
 * Fold a burst of events into the acts a player should watch.
 *
 * The damage of an act arrives in a LATER event than the act itself — a
 * deployment is announced, then the shot, then what it did — so this collects
 * forward rather than emitting on sight. Doing it the other way round is how a
 * screen ends up showing a hit before the shot that caused it.
 */
/**
 * Read one deployment act, and say where it ended.
 *
 * A deployment is a RUN of events — the card arriving, the emplacement it
 * displaced, the free shot, what that shot did — and it is built here in one
 * place rather than folded into a variable that four different cases write to.
 *
 * THE RULES REPORT `UNIT_REPLACED` BEFORE `UNIT_DEPLOYED`, not after. I
 * assumed the other order, and got two acts for one card: a soldier arriving
 * twice. The test caught it; nothing else would have, because both orders
 * produce a plausible-looking burst. Reading a run rather than reacting to
 * each event makes the order a detail instead of an assumption.
 */
function readDeployment(
  events: readonly CombatEvent[], start: number,
): { readonly act: Act; readonly next: number } {
  let tower = -1;
  let unit: Unit | null = null;
  let replaced: Unit | null = null;
  let force = 0;
  let damage = 0;
  let overkill = 0;
  let i = start;

  for (; i < events.length; i++) {
    const event = events[i]!;
    if (event.type === 'UNIT_DEPLOYED' || event.type === 'UNIT_REPLACED') {
      // A second card on a DIFFERENT emplacement is a new act.
      if (unit && tower !== event.towerIndex) break;
      // A second card on the SAME one, after it has already fired, likewise.
      if (unit && (force || damage)) break;
      tower = event.towerIndex;
      unit = event.unit;
      if (event.type === 'UNIT_REPLACED') replaced = event.removed;
      continue;
    }
    if (event.type === 'SHOT_FIRED') { force = event.force; continue; }
    if (event.type === 'DAMAGE_DEALT' && event.source === 'deployment') {
      damage += event.amount;
      continue;
    }
    if (event.type === 'OVERKILL' && event.source === 'deployment') {
      overkill += event.amount;
      continue;
    }
    break;
  }

  return {
    act: { kind: 'deployment', tower, unit: unit!, replaced, force, damage, overkill },
    next: i,
  };
}

/** The same for a volley: the settlement, then what it did to the enemy. */
function readVolley(
  events: readonly CombatEvent[], start: number,
): { readonly act: Act; readonly next: number } {
  const first = events[start]!;
  if (first.type !== 'VOLLEY_FIRED') throw new Error('not a volley');

  let damage = 0;
  let overkill = 0;
  let i = start + 1;

  for (; i < events.length; i++) {
    const event = events[i]!;
    if (event.type === 'DAMAGE_DEALT' && event.source === 'volley') {
      damage += event.amount;
      continue;
    }
    if (event.type === 'OVERKILL' && event.source === 'volley') {
      overkill += event.amount;
      continue;
    }
    break;
  }

  return { act: { kind: 'volley', settlement: first.settlement, damage, overkill }, next: i };
}

export function actsFor(events: readonly CombatEvent[]): readonly Act[] {
  const acts: Act[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i]!;
    switch (event.type) {
      case 'UNIT_DEPLOYED':
      case 'UNIT_REPLACED': {
        const read = readDeployment(events, i);
        acts.push(read.act);
        i = read.next;
        break;
      }
      case 'VOLLEY_FIRED': {
        const read = readVolley(events, i);
        acts.push(read.act);
        i = read.next;
        break;
      }
      case 'CARDS_EXCHANGED':
        acts.push({
          kind: 'exchanged', removed: event.removed.length,
          drawn: event.drawn.length, cost: event.cost,
        });
        i++;
        break;
      case 'DRAW_PILE_RESHUFFLED':
        acts.push({ kind: 'reshuffled', count: event.count });
        i++;
        break;
      case 'ROUND_ENDED':
        acts.push({ kind: 'roundEnded', round: event.round, force: event.force });
        i++;
        break;
      case 'ROUND_BEGAN':
        acts.push({ kind: 'roundBegan', round: event.round });
        i++;
        break;
      case 'COMBAT_ENDED':
        acts.push({ kind: 'ended', outcome: event.outcome });
        i++;
        break;
      default:
        // CARDS_DRAWN, SHOT_FIRED and the damage events outside a run: the
        // hand appearing IS the presentation, and a stray hit belongs to
        // whatever run already claimed it.
        i++;
        break;
    }
  }

  return acts;
}
