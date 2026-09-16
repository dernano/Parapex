import type { Enemy } from '@/core/types';

/**
 * The crest system's vocabulary.
 *
 * THE ORDER IS THE RULE. The five slots resolve strictly left to right. Slot 1
 * changes the situation, slot 2 receives the CHANGED situation, slot 3 the one
 * slot 2 left behind. A crest that doubles whatever the slot before it did is
 * therefore a completely different thing in slot 4 than in slot 2.
 *
 * That is not a side effect. It is the system: the player is not building a
 * collection, they are building a MACHINE, and the arrangement is the design.
 */

export type CrestId = string;
export type CommanderRuleId = string;

/** Everything a crest can listen to. One list, so a crest nobody triggers is findable. */
export const CREST_EVENTS = [
  // Frame
  'combatBegan', 'roundBegan', 'roundEnded', 'combatEnded',
  // Hand and momentum
  'cardDrawn', 'cardsExchanged',
  // Towers
  'unitDeployed', 'unitReplaced',
  // Formations
  'tableauRead', 'formationsRecognised',
  /**
   * The most important event in the system. Force and volleys are still open
   * here, and this is where a round's damage is decided.
   */
  'volleyPlanned', 'volleyFired',
  // Effect on the enemy
  'enemyHit', 'overkill', 'enemyDefeated',
  // Crests about crests
  'crestTriggered',
] as const;

export type CrestEventName = (typeof CREST_EVENTS)[number];

/**
 * Where an ignition came from. The system MUST tell these apart, or no crest
 * that counts "every foreign ignition" or "every own one but not a copy" can
 * be built — and without the distinction every recursion guard would fire
 * either too early or never.
 */
export const TRIGGER_SOURCES = ['original', 'retrigger', 'copy', 'generated'] as const;
export type TriggerSource = (typeof TRIGGER_SOURCES)[number];

/** Why an ignition was refused. Each reason is its own case in the game. */
export const REJECTIONS = ['sealed', 'depth', 'perSlot', 'perEvent', 'chains', 'circle'] as const;
export type Rejection = (typeof REJECTIONS)[number];

/**
 * The guards. Deliberately hard numbers rather than cleverness: a pair of
 * crests that re-ignite each other is not a bug, it is a shape a player WILL
 * find. It may do a lot and it has to end somewhere.
 */
export const LIMITS = {
  /** How deep crests may still ignite one another. */
  depth: 6,
  /** How often ONE slot may ignite within ONE event. */
  perSlot: 12,
  /** How many ignitions one event holds in total. */
  perEvent: 60,
  /** How many generated follow-up events one event withstands. */
  chains: 24,
} as const;

/* ---------- Resources ---------- */

/**
 * Supplies exist only because crests create them. No crest, no supply — that
 * is deliberate: whoever finds the first powder horn does not get a bigger
 * number, they get a rule that did not exist before.
 */
export const RESOURCE_KINDS = ['veteran', 'powder', 'devastation', 'command'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type Resources = Readonly<Record<ResourceKind, number>>;

export const NO_RESOURCES: Resources =
  { veteran: 0, powder: 0, devastation: 0, command: 0 };

/* ---------- What a crest did ---------- */

/** One change a crest made, recorded so it can be amplified, copied and read. */
export interface CrestEffect {
  readonly kind: string;
  readonly value: number | { readonly resource: ResourceKind; readonly amount: number };
  readonly note: string;
}

/** One ignition, or one refusal, exactly as it happened. */
export interface Ignition {
  readonly nr: number;
  readonly eventNumber: number;
  readonly round: number;
  /** 0..4 for the player's crests; negative for the commander's rules. */
  readonly slot: number;
  readonly id: CrestId;
  readonly displayName: string;
  readonly event: CrestEventName;
  readonly source: TriggerSource;
  readonly enemyRule: boolean;
  readonly depth: number;
  /** The nr of the ignition that caused this one. */
  readonly causedBy: number | null;
  effects: CrestEffect[];
  readonly rejected: Rejection | null;
}

/* ---------- The row ---------- */

/** The five slots, the seals on them, and the commander's rules behind them. */
export interface CrestRow {
  /** Exactly five entries; an empty slot is null. */
  readonly slots: readonly (CrestId | null)[];
  /** Slots a commander rule has closed. They stay visible but do not ignite. */
  readonly sealed: readonly number[];
  /**
   * The commander's rules run on the SAME row as the crests, only behind them.
   * That is the whole idea: a boss with more hit points is a longer wait; a
   * boss who swaps slots 2 and 4 attacks the MACHINE the player built.
   */
  readonly commanderRules: readonly CommanderRuleId[];
}

export const EMPTY_ROW: CrestRow = { slots: [null, null, null, null, null], sealed: [], commanderRules: [] };

/* ---------- The context a crest sees ---------- */

/**
 * The event while it travels through the row.
 *
 * `data` is mutable, and that is the design rather than an oversight: slot 2
 * has to see what slot 1 left behind. Purity lives one level up — `resolve()`
 * takes plain data and returns plain data, and this object exists only for the
 * duration of one call.
 */
/**
 * The fields an event carries. Heterogeneous by nature — `volleyPlanned` has
 * numbers, `unitDeployed` has a unit — so the container is deliberately loose
 * and the TYPE SAFETY SITS AT THE BOUNDARY: every effect in `effects.ts`
 * checks that the field it wants is there and is a number, and records a
 * miss instead of swallowing it. A crest that writes past its event is a
 * defect in the crest, and it shows up in the protocol rather than vanishing.
 */
export type EventData = Record<string, unknown>;

export interface CrestContext {
  readonly event: CrestEventName;
  /** What the crests may change. Which fields exist depends on the event. */
  data: EventData;
  readonly eventNumber: number;
  readonly depth: number;
  /** The crests this event came into being through. Feeds the circle guard. */
  readonly origin: readonly CrestId[];
  readonly source: TriggerSource;
  readonly round: number;
  /**
   * The enemy sits beside the data, not inside it: crests may READ him, no
   * effect may touch him. What hits the enemy goes through `enemyHit` — one
   * door, not fifty.
   */
  readonly enemy: Enemy | null;
  /** A dry run computes without touching anything. See `resolve`. */
  readonly dryRun: boolean;

  /** What has already ignited in THIS event, in order. */
  ignitions: Ignition[];
  /** Ignitions per slot within this event. */
  counts: Record<number, number>;
  /** The ignition currently running. */
  current: Ignition | null;
  slot: number;
  chains: number;
  aborted: boolean;
  /** This event's slice of the protocol, refusals included. */
  protocol: Ignition[];
}

/**
 * What a crest does when it hears an event.
 *
 * `tools` is how a crest reaches back into the pipeline — retriggering a slot,
 * copying one, raising a new event. Passing them in rather than importing them
 * is what keeps the crest content free of any dependency on the machinery, and
 * therefore testable with a stub.
 */
export interface CrestTools {
  retrigger(context: CrestContext, slot: number): Ignition | null;
  copy(context: CrestContext, slot: number): Ignition | null;
  raise(context: CrestContext, event: CrestEventName, data: EventData): CrestContext;
  /** The row as it stands right now. Commander rules reorder it mid-combat. */
  row(): readonly (CrestId | null)[];
  resources(): Resources;
  /**
   * Move a supply. Returns how much really moved — giving always succeeds,
   * taking is capped by what is on the shelf.
   *
   * On a dry run the arithmetic happens but the shelf is not touched:
   * otherwise every mouse movement over a tower would cost powder.
   */
  moveResource(context: CrestContext, kind: ResourceKind, amount: number): number;
  /** Game operations a crest may invoke — see `CrestServices`. */
  services(): { fireSingleShot(towerIndex: number, source: string): number };
}

export type CrestReaction = (
  context: CrestContext,
  ignition: Ignition,
  tools: CrestTools,
) => void;

export interface CrestDefinition {
  readonly id: CrestId;
  /** German, shown to the player. */
  readonly displayName: string;
  readonly glyph: string;
  readonly tincture: string;
  readonly rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  /** German: what it does, in one sentence. */
  readonly text: string;
  /** German: what it plays well with. */
  readonly hint: string;
  /** Event to reaction. A crest that listens to nothing is a defect. */
  readonly listens: Partial<Record<CrestEventName, CrestReaction>>;
}
