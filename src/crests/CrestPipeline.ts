import type { Enemy } from '@/core/types';
import type {
  CommanderRuleId, CrestContext, CrestDefinition, CrestEventName, CrestId, CrestRow,
  CrestTools, EventData, Ignition, Rejection, ResourceKind, Resources, TriggerSource,
} from './types';
import { LIMITS } from './types';

/**
 * ONE road on which every crest ignites.
 *
 * Before this existed each crest had its own hook in its own place in the
 * rules. That had two consequences and both were bad: a crest could quietly
 * become ineffective without anyone noticing, and two crests could say nothing
 * to each other because there was nowhere they would have met.
 *
 * PURITY. The legacy version kept the row, the counters and the protocol in a
 * module-level binding. Here `resolve()` takes a session and returns a new one;
 * the mutable context lives only for the length of one call. Two resolutions
 * of the same session cannot influence one another, which is what makes 2450
 * pair fixtures a test rather than a lottery.
 */

/**
 * Operations a crest may ask the game to perform.
 *
 * The Boar lets a replaced unit fire one last time — but HOW a shot is fired
 * is the combat's business, not the crest's. The combat hands its shot in
 * here, so the crests do not depend on the combat and the pipeline does not
 * either. The default does nothing, which is what a test or a preview wants.
 */
export interface CrestServices {
  /** Fire one shot from a tower. Returns the force that landed. */
  fireSingleShot(towerIndex: number, source: string): number;
}

export const NO_SERVICES: CrestServices = { fireSingleShot: () => 0 };

/** Everything the pipeline needs to know between events. Plain data. */
export interface CrestSession {
  readonly row: CrestRow;
  readonly resources: Resources;
  readonly round: number;
  readonly enemy: Enemy | null;
  /** How often each slot has ignited in the whole combat. */
  readonly tally: Readonly<Record<number, number>>;
  /** Every ignition of the whole combat, in the order it happened. */
  readonly protocol: readonly Ignition[];
  /** Running numbers, so ignitions stay orderable across events. */
  readonly nextNr: number;
  readonly nextEventNumber: number;
  /** Not data — the game operations crests may invoke. Never serialised. */
  readonly services: CrestServices;
}

export function newSession(
  row: CrestRow,
  options: {
    resources: Resources; enemy?: Enemy | null; round?: number; services?: CrestServices;
  },
): CrestSession {
  return {
    row,
    resources: options.resources,
    round: options.round ?? 1,
    enemy: options.enemy ?? null,
    tally: {},
    protocol: [],
    nextNr: 0,
    nextEventNumber: 0,
    services: options.services ?? NO_SERVICES,
  };
}

/** What a crest and a commander rule are looked up in. */
export interface CrestRegistry {
  crest(id: CrestId): CrestDefinition | undefined;
  commanderRule(id: CommanderRuleId): CrestDefinition | undefined;
}

export interface ResolveOptions {
  /**
   * Compute without touching anything: no supplies spent, nothing written to
   * the combat protocol. The display asks what the castle would weigh dozens
   * of times a second, and that question must not cost powder.
   */
  readonly dryRun?: boolean;
}

export interface ResolveResult {
  /** The data as the row left it. */
  readonly data: EventData;
  /** This event's ignitions and refusals, in order. */
  readonly protocol: readonly Ignition[];
  /** The session afterwards. Unchanged except for bookkeeping on a dry run. */
  readonly session: CrestSession;
}

/**
 * Send one event through the row. This is THE door; the rules call it, the
 * crests do not know the rules.
 */
export function resolve(
  registry: CrestRegistry,
  session: CrestSession,
  event: CrestEventName,
  data: EventData,
  options: ResolveOptions = {},
): ResolveResult {
  const run = new Run(registry, session, Boolean(options.dryRun));
  const context = run.makeContext(event, data, null, 'original');
  run.walkRow(context);
  return { data: context.data, protocol: context.protocol, session: run.session() };
}

/* ============================================================
 *  The machinery
 * ============================================================
 *
 * A Run is one call to `resolve`. It carries the bookkeeping that the legacy
 * tree kept in module scope, and it dies when the call returns — which is why
 * two resolutions cannot leak into each other.
 */
class Run {
  private readonly registry: CrestRegistry;
  private readonly row: CrestRow;
  /**
   * The supply shelf, as a working copy. Crests put powder on it and take
   * powder off it during a resolution; `session()` hands the result back as
   * data. The session passed in is never touched.
   */
  private readonly pool: Record<ResourceKind, number>;
  private readonly round: number;
  private readonly enemy: Enemy | null;
  private readonly dryRun: boolean;

  private tally: Record<number, number>;
  private protocol: Ignition[];
  private nr: number;
  private eventNumber: number;
  /** The context currently travelling through the row, if any. */
  private running: CrestContext | null = null;

  constructor(registry: CrestRegistry, session: CrestSession, dryRun: boolean) {
    this.registry = registry;
    this.row = session.row;
    this.pool = { ...session.resources };
    this.round = session.round;
    this.enemy = session.enemy;
    this.dryRun = dryRun;
    this.tally = { ...session.tally };
    this.protocol = [...session.protocol];
    this.nr = session.nextNr;
    this.eventNumber = session.nextEventNumber;
    this.base = session;
  }

  private readonly base: CrestSession;

  session(): CrestSession {
    return {
      ...this.base,
      resources: this.pool,
      tally: this.tally,
      protocol: this.protocol,
      nextNr: this.nr,
      nextEventNumber: this.eventNumber,
    };
  }

  makeContext(
    event: CrestEventName,
    data: EventData,
    parent: CrestContext | null,
    source: TriggerSource,
  ): CrestContext {
    return {
      event,
      data,
      // A trigger gets a new number; whatever arises beneath it inherits one.
      eventNumber: parent ? parent.eventNumber : ++this.eventNumber,
      depth: parent ? parent.depth + 1 : 0,
      origin: parent
        ? [...parent.origin, ...(parent.current ? [parent.current.id] : [])]
        : [],
      source,
      round: this.round,
      enemy: this.enemy,
      dryRun: this.dryRun || Boolean(parent?.dryRun),
      ignitions: [],
      counts: {},
      current: null,
      slot: -1,
      chains: 0,
      aborted: false,
      protocol: [],
    };
  }

  /** The walk itself: left to right, slot by slot, then the commander. */
  walkRow(context: CrestContext): void {
    const previous = this.running;
    this.running = context;
    try {
      for (let slot = 0; slot < this.row.slots.length; slot++) {
        if (context.aborted) break;
        this.ignite(context, slot, 'original', null);
      }
      // And then the enemy.
      for (let i = 0; i < this.row.commanderRules.length; i++) {
        this.ignite(context, -1 - i, 'original', null);
      }
    } finally {
      this.running = previous;
    }
  }

  /**
   * A new event from inside a crest.
   *
   * An event arising WHILE another is still travelling hangs itself beneath it
   * automatically. Without that, every return from the rules into the pipeline
   * would be a fresh start at depth 0, and the cleanest guard in the world
   * would count to a stack overflow.
   */
  trigger(
    event: CrestEventName,
    data: EventData,
    parent: CrestContext | null,
  ): CrestContext {
    const father = parent ?? this.running;
    if (!father) {
      const fresh = this.makeContext(event, data, null, 'original');
      this.walkRow(fresh as CrestContext);
      return fresh;
    }
    if (father.depth + 1 > LIMITS.depth) {
      this.record(father, -1, event, 'generated', 'depth');
      return this.makeContext(event, data, father, 'generated');
    }
    if (++father.chains > LIMITS.chains) {
      this.record(father, -1, event, 'generated', 'chains');
      return this.makeContext(event, data, father, 'generated');
    }
    const child = this.makeContext(event, data, father, 'generated');
    this.walkRow(child as CrestContext);
    father.protocol.push(...child.protocol);
    return child;
  }

  /**
   * The actual act. Every guard sits here and only here — there is no second
   * way to make a crest ignite.
   */
  ignite(
    context: CrestContext,
    slot: number,
    source: TriggerSource,
    causedBy: Ignition | null,
  ): Ignition | null {
    const definition = this.atSlot(slot);
    if (!definition) return null;
    const reaction = definition.listens[context.event];
    if (!reaction) return null;

    const refusal = this.refuse(context, slot, definition.id);
    if (refusal) {
      this.record(context, slot, definition.id, source, refusal);
      return null;
    }

    const ignition: Ignition = {
      nr: ++this.nr,
      eventNumber: context.eventNumber,
      round: context.round,
      slot,
      id: definition.id,
      displayName: definition.displayName,
      event: context.event,
      source,
      enemyRule: slot < 0,
      depth: context.depth,
      causedBy: causedBy ? causedBy.nr : null,
      effects: [],
      rejected: null,
    };

    /*
     * Bookkeeping BEFORE the reaction: a crest that re-ignites itself has to
     * find itself already counted when it enters the second time.
     *
     * A copy does not count for the copied slot — so a copying crest does not
     * drive the copied crest's own limit.
     */
    if (source !== 'copy') {
      context.counts[slot] = (context.counts[slot] ?? 0) + 1;
      if (!context.dryRun) this.tally[slot] = (this.tally[slot] ?? 0) + 1;
    }
    context.ignitions.push(ignition);
    context.protocol.push(ignition);
    if (!context.dryRun) this.protocol.push(ignition);

    const previousIgnition = context.current;
    const previousSlot = context.slot;
    context.current = ignition;
    context.slot = slot;
    try {
      reaction(context, ignition, this.tools());
    } finally {
      context.current = previousIgnition;
      context.slot = previousSlot;
    }
    return ignition;
  }

  /** Let an earlier slot ignite again. It sees the situation as it is NOW. */
  retrigger(context: CrestContext, slot: number): Ignition | null {
    return this.ignite(context, slot, 'retrigger', context.current);
  }

  /**
   * Carry out another slot's reaction under one's own name. The difference to
   * a retrigger is not cosmetic: a copy does NOT count as the copied slot's
   * own ignition.
   */
  copy(context: CrestContext, slot: number): Ignition | null {
    return this.ignite(context, slot, 'copy', context.current);
  }

  /** Why a slot may NOT ignite right now — or null. */
  private refuse(context: CrestContext, slot: number, id: CrestId): Rejection | null {
    // A seal hits crests only. Nobody seals the commander's rules.
    if (slot >= 0 && this.row.sealed.includes(slot)) return 'sealed';
    if (context.depth > LIMITS.depth) return 'depth';
    if ((context.counts[slot] ?? 0) >= LIMITS.perSlot) return 'perSlot';
    if (context.ignitions.length >= LIMITS.perEvent) return 'perEvent';
    /*
     * The circle: a crest does not ignite in an event it triggered ITSELF.
     * Not as a retrigger, not as a copy, and not in the ordinary walk either.
     *
     * The last part is deliberately that hard, and it was paid for by
     * measurement: the Ouroboros runs the whole row again — and used to run
     * itself again inside it. Every turn of the wheel multiplied the next, and
     * a greedy search found a volley of 10^15 against a commander with four
     * thousand. The guards held; the GAME did not. "The row runs again" now
     * means exactly that: once more.
     */
    if (context.origin.includes(id)) return 'circle';
    return null;
  }

  /** A refused ignition stays in the protocol. Whoever cannot see it searches for hours. */
  private record(
    context: CrestContext,
    slot: number,
    id: CrestId,
    source: TriggerSource,
    reason: Rejection,
  ): Ignition {
    const entry: Ignition = {
      nr: ++this.nr,
      eventNumber: context.eventNumber,
      round: context.round,
      slot,
      id,
      displayName: this.registry.crest(id)?.displayName ?? id,
      event: context.event,
      source,
      enemyRule: slot < 0,
      depth: context.depth,
      causedBy: context.current ? context.current.nr : null,
      effects: [],
      rejected: reason,
    };
    context.protocol.push(entry);
    if (!context.dryRun) this.protocol.push(entry);
    return entry;
  }

  /**
   * Move a supply, and say how much really moved.
   *
   * Giving always succeeds. Taking is capped by the shelf — a crest that wants
   * five powder and finds two spends two, and the protocol says two, because a
   * log that claimed five would send the player looking for the missing three.
   */
  private moveResource(context: CrestContext, kind: ResourceKind, amount: number): number {
    if (!amount) return 0;
    if (amount > 0) {
      if (!context.dryRun) this.pool[kind] += amount;
      return amount;
    }
    const wanted = -amount;
    const taken = Math.min(this.pool[kind], wanted);
    if (!taken) return 0;
    if (!context.dryRun) this.pool[kind] -= taken;
    return -taken;
  }

  /**
   * What stands on a slot. Non-negative slots are the player's crests,
   * negative ones the commander's rules — so both run through the same door
   * and land in the same protocol.
   */
  private atSlot(slot: number): CrestDefinition | undefined {
    if (slot >= 0) {
      const id = this.row.slots[slot];
      return id ? this.registry.crest(id) : undefined;
    }
    const id = this.row.commanderRules[-slot - 1];
    return id ? this.registry.commanderRule(id) : undefined;
  }

  /** The handle a crest reaches the pipeline through. */
  tools(): CrestTools {
    return {
      retrigger: (context, slot) => this.retrigger(context, slot),
      copy: (context, slot) => this.copy(context, slot),
      raise: (context, event, data) => this.trigger(event, data, context),
      row: () => this.row.slots,
      resources: () => this.pool,
      moveResource: (context, kind, amount) => this.moveResource(context, kind, amount),
      services: () => this.base.services,
    };
  }
}
