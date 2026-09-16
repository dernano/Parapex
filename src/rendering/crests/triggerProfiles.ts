import { EFFECT_KINDS } from '@/crests/effects';
import type { CrestEffect, Ignition, TriggerSource } from '@/crests/types';

/**
 * WHAT A CREST LOOKS LIKE WHEN IT FIRES.
 *
 * The brief's rule, and it is the important one: no generic glow, and no
 * `if (crest.id === 'lion')` anywhere in the renderer. Fifty crests with fifty
 * bespoke animations is fifty places for one of them to quietly stop obeying
 * the rack's layout; fifty crests sharing one yellow flash is a machine whose
 * workings the player can never learn to read.
 *
 * So the presentation is DERIVED FROM WHAT THE CREST DID. A crest that
 * multiplies looks like multiplication; a crest that moves powder looks like
 * something being carried; a crest that runs another slot again points AT that
 * slot. Nothing here knows a single crest's name, which is why a fifty-first
 * crest needs no work at all — and why a crest whose look is wrong is telling
 * you its EFFECT is wrong.
 */

export const TRIGGER_PROFILES = [
  'ROTATE', 'SPARK', 'IMPACT', 'PULSE', 'IGNITE', 'TRANSFER', 'COPY', 'RETRIGGER',
] as const;

export type TriggerProfile = (typeof TRIGGER_PROFILES)[number];

export interface ProfileVisual {
  readonly id: TriggerProfile;
  /** German, for the codex and the workbench. */
  readonly displayName: string;
  /** The shape the renderer draws. One motif per profile, no exceptions. */
  readonly motif: 'ring' | 'burst' | 'slam' | 'breathe' | 'flame' | 'stream' | 'echo' | 'rewind';
  readonly colour: string;
  readonly accent: string;
  /** Seconds. Long enough to read in a chain of five, short enough to stack. */
  readonly duration: number;
  /** How far the motif reaches beyond its slot, in logical pixels. */
  readonly reach: number;
  /**
   * Whether the motif points at something else — another slot, or the shelf.
   * This is what makes a CHAIN legible instead of five separate sparkles.
   */
  readonly directed: boolean;
}

export const PROFILE_VISUALS: Readonly<Record<TriggerProfile, ProfileVisual>> = {
  // The tableau itself turns: ranks change, copies appear. A slow ring, because
  // what it altered was the ARRANGEMENT, and arrangements are not violent.
  ROTATE: { id: 'ROTATE', displayName: 'Drehung', motif: 'ring',
    colour: '#a8791c', accent: '#e3b552', duration: 0.42, reach: 14, directed: false },

  // Something was ADDED. Small, bright, over quickly.
  SPARK: { id: 'SPARK', displayName: 'Funke', motif: 'burst',
    colour: '#e89a3c', accent: '#ffd98a', duration: 0.26, reach: 10, directed: false },

  // Something was MULTIPLIED. The heaviest motif in the set, deliberately: a
  // factor is the difference between a good run and an absurd one, and the
  // player must learn to recognise it at a glance.
  IMPACT: { id: 'IMPACT', displayName: 'Schlag', motif: 'slam',
    colour: '#a8261f', accent: '#ffd98a', duration: 0.34, reach: 20, directed: false },

  // The frame of the turn: momentum, cards, costs. Nothing struck, something
  // breathed.
  PULSE: { id: 'PULSE', displayName: 'Puls', motif: 'breathe',
    colour: '#2f5fa8', accent: '#9fc4f0', duration: 0.38, reach: 12, directed: false },

  // More volleys. Fire, because volleys are what actually leave the walls.
  IGNITE: { id: 'IGNITE', displayName: 'Zündung', motif: 'flame',
    colour: '#c25a15', accent: '#ffd98a', duration: 0.40, reach: 16, directed: false },

  // Supplies moving to or from the shelf. Directed, so the player sees WHERE
  // the powder went — which is the single most confusing thing about the
  // resource crests.
  TRANSFER: { id: 'TRANSFER', displayName: 'Übertrag', motif: 'stream',
    colour: '#4f7a3a', accent: '#c9e0a0', duration: 0.44, reach: 30, directed: true },

  // This slot performed another slot's effect. Points at the slot it copied.
  COPY: { id: 'COPY', displayName: 'Abbild', motif: 'echo',
    colour: '#6b7079', accent: '#e3d2a4', duration: 0.36, reach: 34, directed: true },

  // This slot made another slot run again. Points back at it.
  RETRIGGER: { id: 'RETRIGGER', displayName: 'Nachzündung', motif: 'rewind',
    colour: '#7a4fa8', accent: '#d9c0f0', duration: 0.36, reach: 34, directed: true },
};

/**
 * Which profile an EFFECT KIND reads as.
 *
 * Exhaustive over `EFFECT_KINDS` by construction — the test below the fold
 * walks that table and fails if a kind is missing, so adding an effect to the
 * rules forces a decision here rather than silently falling through to a glow.
 */
export const PROFILE_FOR_EFFECT: Readonly<Record<string, TriggerProfile>> = {
  // Arrangement
  rank: 'ROTATE',
  copies: 'ROTATE',
  // Addition
  bonus: 'SPARK',
  force: 'SPARK',
  // Multiplication
  factor: 'IMPACT',
  forceFactor: 'IMPACT',
  perVolleyFactor: 'IMPACT',
  volleyFactor: 'IMPACT',
  // Volleys
  volleys: 'IGNITE',
  // The turn's frame
  momentum: 'PULSE',
  draw: 'PULSE',
  cost: 'PULSE',
  // Supplies
  resource: 'TRANSFER',
};

/** Every effect kind the rules can record, including the two the table adds. */
export const ALL_EFFECT_KINDS: readonly string[] = [
  ...Object.keys(EFFECT_KINDS), 'resource', 'missed',
];

/**
 * How an ignition presents.
 *
 * The SOURCE wins over the effect: a slot that ran because another slot
 * retriggered it should read as a retrigger, whatever it then did, because the
 * fact the player needs is where the second firing came from.
 *
 * A crest that ignited and changed nothing still gets a profile — PULSE, the
 * quietest — rather than nothing. An ignition with no picture is how a player
 * concludes a crest is broken when it merely had nothing to do.
 */
export function profileFor(ignition: {
  readonly source: TriggerSource;
  readonly effects: readonly CrestEffect[];
  readonly rejected: unknown;
}): TriggerProfile {
  if (ignition.source === 'retrigger') return 'RETRIGGER';
  if (ignition.source === 'copy') return 'COPY';

  /*
   * The LOUDEST effect decides. A crest that adds two and then multiplies by
   * three is a multiplier; showing it as a spark because the addition came
   * first would teach the player the wrong thing about their own machine.
   */
  let best: TriggerProfile | null = null;
  for (const effect of ignition.effects) {
    const profile = PROFILE_FOR_EFFECT[effect.kind];
    if (!profile) continue;
    if (!best || LOUDNESS[profile] > LOUDNESS[best]) best = profile;
  }
  return best ?? 'PULSE';
}

/** Which profile wins when a single ignition did several things. */
const LOUDNESS: Readonly<Record<TriggerProfile, number>> = {
  PULSE: 0, ROTATE: 1, TRANSFER: 2, SPARK: 3, IGNITE: 4, IMPACT: 5,
  COPY: 6, RETRIGGER: 6,
};

/** A refused ignition is shown, muted. A guard nobody sees is a guard nobody trusts. */
export interface TriggerPresentation {
  readonly slot: number;
  readonly profile: TriggerProfile;
  readonly visual: ProfileVisual;
  /** Seconds after the event started. */
  readonly at: number;
  /** Which slot the motif points at, when it is directed. */
  readonly target: number | null;
  /** A refusal: drawn dim and struck through, with its reason. */
  readonly rejected: string | null;
  readonly depth: number;
}

/**
 * The whole event, as a sequence of motifs.
 *
 * Staggered by their position in the protocol, not by slot: a chain in which
 * slot 4 retriggers slot 1 shows slot 1 firing a SECOND time, after slot 4 —
 * which is what actually happened, and is the thing the player most needs to
 * see to understand the machine they built.
 */
export const MAX_CHAIN_SECONDS = 0.9;

export function presentIgnitions(
  protocol: readonly Ignition[],
  stagger = 0.12,
): readonly TriggerPresentation[] {
  const byNr = new Map<number, Ignition>();
  for (const ignition of protocol) byNr.set(ignition.nr, ignition);

  /*
   * A long chain COMPRESSES rather than running long — the same rule the
   * salvo presentation follows, for the same reason. A rack whose crests
   * retrigger each other can produce forty ignitions, and forty times an
   * eighth of a second is five seconds of the player watching badges blink
   * before anything happens on the wall.
   */
  const step = protocol.length > 1
    ? Math.min(stagger, MAX_CHAIN_SECONDS / (protocol.length - 1))
    : 0;

  return protocol.map((ignition, i) => {
    const profile = profileFor(ignition);
    const visual = PROFILE_VISUALS[profile];
    /*
     * A directed motif points at the slot that CAUSED this ignition — for a
     * copy or a retrigger that is the instigator, and the arrow runs from it
     * to here. For a transfer there is no slot to point at; the shelf is not
     * on the rack, so the renderer takes null to mean "toward the supplies".
     */
    const cause = ignition.causedBy === null ? null : byNr.get(ignition.causedBy) ?? null;
    return {
      slot: ignition.slot,
      profile,
      visual,
      at: i * step,
      target: visual.directed && cause ? cause.slot : null,
      rejected: ignition.rejected,
      depth: ignition.depth,
    };
  });
}
