import { EFFECT_KINDS } from '@/crests/effects';
import { resolve, type CrestRegistry, type CrestSession } from '@/crests/CrestPipeline';
import type {
  CrestEventName, EventData, Ignition, Rejection, TriggerSource,
} from '@/crests/types';
import { profileFor, type TriggerProfile } from './triggerProfiles';

/**
 * THE CHAIN, MADE VISIBLE.
 *
 * `(s + 10) × 3` and `s × 3 + 10` are different numbers, and which one a
 * player's rack computes depends on nothing but the ARRANGEMENT. That is the
 * best idea in the game and it is currently invisible: the row resolves, a
 * number appears, and the player is left to infer the machine from the
 * result.
 *
 * So the protocol is replayed, step by step, with the running value at every
 * step. Slot 1 took 40 and made it 50; slot 2 took 50 and made it 150. Written
 * out like that, the player does not need the rule explained — they can see
 * that moving slot 2 to the front would have given them 130 instead, which is
 * the moment the rack stops being a collection.
 *
 * The replay is FAITHFUL, not approximate: it applies the recorded effects in
 * the recorded order with the same arithmetic the pipeline used. A test drives
 * a real resolution through it and asserts the replayed data equals what
 * `resolve` actually returned — if the two ever disagree, this display is
 * lying and the test says so.
 */

export interface ChainChange {
  /** Which field of the event moved. */
  readonly field: string;
  readonly kind: string;
  readonly before: number;
  readonly after: number;
  /** German, the crest's own word for what it did. */
  readonly note: string;
}

export interface ChainStep {
  /** Position in the protocol, which is the order things actually happened. */
  readonly order: number;
  readonly slot: number;
  readonly id: string;
  readonly displayName: string;
  readonly glyph: string;
  readonly tincture: string;
  readonly profile: TriggerProfile;
  readonly source: TriggerSource;
  readonly depth: number;
  readonly causedBy: number | null;
  readonly rejected: Rejection | null;
  readonly changes: readonly ChainChange[];
  /** Supplies moved, which do not live on the event's data. */
  readonly supplies: readonly { readonly kind: string; readonly amount: number;
    readonly note: string }[];
}

export interface ChainReplay {
  readonly steps: readonly ChainStep[];
  /** The data as the row left it. Must equal what the pipeline returned. */
  readonly final: EventData;
}

export function replayChain(
  protocol: readonly Ignition[],
  start: EventData,
  registry: CrestRegistry,
): ChainReplay {
  const data: Record<string, unknown> = { ...start };
  const steps: ChainStep[] = [];

  protocol.forEach((ignition, order) => {
    const definition = registry.crest(ignition.id);
    const changes: ChainChange[] = [];
    const supplies: ChainStep['supplies'] = [];

    for (const effect of ignition.effects) {
      if (effect.kind === 'resource' && typeof effect.value === 'object') {
        (supplies as { kind: string; amount: number; note: string }[]).push({
          kind: effect.value.resource,
          amount: effect.value.amount,
          note: effect.note,
        });
        continue;
      }
      const rule = EFFECT_KINDS[effect.kind];
      if (!rule || typeof effect.value !== 'number') continue;
      const before = data[rule.field];
      if (typeof before !== 'number') continue;
      const after = rule.arithmetic === 'plus'
        ? before + effect.value
        : before * effect.value;
      data[rule.field] = after;
      changes.push({ field: rule.field, kind: effect.kind, before, after, note: effect.note });
    }

    steps.push({
      order,
      slot: ignition.slot,
      id: ignition.id,
      displayName: definition?.displayName ?? ignition.displayName,
      glyph: definition?.glyph ?? '·',
      tincture: definition?.tincture ?? '#6b7079',
      profile: profileFor(ignition),
      source: ignition.source,
      depth: ignition.depth,
      causedBy: ignition.causedBy,
      rejected: ignition.rejected,
      changes,
      supplies,
    });
  });

  return { steps, final: data };
}

/**
 * One field's journey through the row, as the player should read it.
 *
 * `40 → 50 → 150`. Steps that did not touch the field are left out, because a
 * chain with six identical numbers in it teaches nothing.
 */
export function fieldJourney(
  replay: ChainReplay,
  field: string,
  start: number,
): readonly { readonly slot: number; readonly displayName: string;
  readonly value: number; readonly kind: string }[] {
  const journey: { slot: number; displayName: string; value: number; kind: string }[] = [
    { slot: -1, displayName: 'Ausgangswert', value: start, kind: 'base' },
  ];
  for (const step of replay.steps) {
    for (const change of step.changes) {
      if (change.field !== field) continue;
      journey.push({
        slot: step.slot, displayName: step.displayName,
        value: change.after, kind: change.kind,
      });
    }
  }
  return journey;
}

/** The journey as one German line for the interface. */
export function journeyLine(
  journey: readonly { readonly value: number }[],
): string {
  return journey
    .map(j => (Number.isInteger(j.value) ? String(j.value) : j.value.toFixed(2).replace('.', ',')))
    .join(' → ');
}

/**
 * WHAT THE OTHER ARRANGEMENT WOULD HAVE BEEN WORTH.
 *
 * This is the number that turns "the order matters" from a sentence in a codex
 * into something the player watches change while they drag a crest one place
 * to the left.
 *
 * It is a SECOND RESOLUTION, not a replay of the recorded effects, and the
 * distinction is the whole correctness of the feature. A recorded effect
 * carries the value it had at the time — the Lion's `+10` was ten because the
 * Grindstone had already made the rank six. Replaying that `+10` after the
 * Grindstone would answer 18 for both arrangements and quietly tell the player
 * the order does not matter, which is the exact opposite of the truth.
 *
 * A dry run costs nothing the player can feel and it cannot be wrong, because
 * it is the same pipeline the real answer comes out of.
 */
export function valueUnderOrder(
  registry: CrestRegistry,
  session: CrestSession,
  order: readonly number[],
  event: CrestEventName,
  data: EventData,
  field: string,
): number {
  const slots = order.map(slot => session.row.slots[slot] ?? null);
  const rearranged: CrestSession = {
    ...session,
    row: { ...session.row, slots },
  };
  const result = resolve(registry, rearranged, event, { ...data }, { dryRun: true });
  const value = result.data[field];
  return typeof value === 'number' ? value : Number.NaN;
}

/** The arrangement reversed. The commonest question a player asks of a rack. */
export const reversedOrder = (count = 5): readonly number[] =>
  Array.from({ length: count }, (_, i) => count - 1 - i);
