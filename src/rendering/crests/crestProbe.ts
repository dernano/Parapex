import type { CrestRegistry } from '@/crests/CrestPipeline';
import type {
  CrestContext, CrestEventName, CrestId, CrestTools, Ignition, ResourceKind, Resources,
} from '@/crests/types';
import { CREST_EVENTS, NO_RESOURCES, RESOURCE_KINDS } from '@/crests/types';

/**
 * WHAT DOES THIS ROW ACTUALLY DO WITH SUPPLIES?
 *
 * The interface has to answer that, because the player is looking at a number
 * going up and is entitled to know whether it means anything. Two crests that
 * both MAKE powder and none that spends it is one of the commonest dead
 * machines a player can build, and the game currently lets them build it in
 * silence.
 *
 * The tempting way to answer is a table: crest id → "produces powder". It
 * would be wrong within a month. A table is a second statement of what a crest
 * does, and the second statement is always the stale one — change what a crest
 * spends and the table still cheerfully says the old thing.
 *
 * So this MEASURES instead. Each crest's own reaction is run against a stub
 * context and a stocked, watched shelf, and what it reaches for is recorded.
 * The answer cannot go stale, because the answer IS the crest.
 *
 * Nothing here can touch a real combat: the context, the tools and the shelf
 * are all throwaway objects made on the spot.
 */

export interface ResourceUse {
  /** Kinds this crest puts on the shelf. */
  readonly produces: readonly ResourceKind[];
  /** Kinds it takes off. */
  readonly consumes: readonly ResourceKind[];
  /**
   * Kinds it merely READS. The Hammerwerk turns powder into force without
   * burning any, and a player told "nothing uses your powder" while it is
   * quietly doubling their volleys would be told a lie.
   */
  readonly reads: readonly ResourceKind[];
}

const NOTHING: ResourceUse = { produces: [], consumes: [], reads: [] };

/** A shelf deep enough that every gated reaction opens. */
const STOCKED: Resources =
  Object.fromEntries(RESOURCE_KINDS.map(k => [k, 99])) as unknown as Resources;

/**
 * A data bag with every field the effect table knows, all numeric and all
 * plausible, so a reaction that guards on one finds it.
 *
 * It is deliberately generous. A false "uses powder" is a harmless extra line
 * in the interface; a false "nothing uses powder" is the game telling the
 * player their machine is broken when it is not.
 */
function probeData(): Record<string, unknown> {
  return {
    volleys: 3, perVolley: 40, factor: 1, force: 120, bonus: 0, momentum: 3,
    rank: 7, draw: 2, cost: 1, copies: 0, tower: 2, branch: 'bow',
    towers: [{ unit: {} }, { unit: {} }, { unit: {} }, { unit: null }, { unit: null }],
    card: { rank: 11, branch: 'bow' }, count: 2, amount: 10, exchanges: 1,
    removed: [{ rank: 5 }], drawn: [{ rank: 9 }], round: 2, hp: 1000,
  };
}

function stubIgnition(id: CrestId, slot: number): Ignition {
  return {
    nr: 0, eventNumber: 0, round: 1, slot, id, displayName: id,
    event: 'volleyPlanned', source: 'original', enemyRule: false,
    depth: 0, causedBy: null, effects: [], rejected: null,
  };
}

/**
 * Run one crest against every event it listens to and watch the shelf.
 *
 * Reads are caught with a proxy, because `tools.resources()` hands back the
 * whole record and there is otherwise no way to tell which kind was consulted.
 */
export function probeCrest(registry: CrestRegistry, id: CrestId): ResourceUse {
  const definition = registry.crest(id);
  if (!definition) return NOTHING;

  const produces = new Set<ResourceKind>();
  const consumes = new Set<ResourceKind>();
  const reads = new Set<ResourceKind>();

  const watchedShelf = new Proxy({ ...STOCKED } as Record<string, number>, {
    get(target, key: string) {
      if ((RESOURCE_KINDS as readonly string[]).includes(key)) reads.add(key as ResourceKind);
      return target[key];
    },
  }) as unknown as Resources;

  const tools: CrestTools = {
    retrigger: () => null,
    copy: () => null,
    raise: (context) => context,
    row: () => [null, null, null, null, null],
    resources: () => watchedShelf,
    moveResource: (_context, kind, amount) => {
      if (amount > 0) produces.add(kind);
      if (amount < 0) consumes.add(kind);
      // Report the full amount as moved, so a reaction that branches on the
      // result keeps going instead of bailing out half-probed.
      return amount;
    },
    services: () => ({ fireSingleShot: () => 0 }),
  };

  for (const event of CREST_EVENTS) {
    const reaction = definition.listens[event as CrestEventName];
    if (!reaction) continue;
    const context: CrestContext = {
      event, data: probeData(), eventNumber: 0, depth: 0, origin: [],
      source: 'original', round: 2, enemy: null, dryRun: true,
      ignitions: [], counts: {}, current: null, slot: 2, chains: 0,
      aborted: false, protocol: [],
    };
    const ignition = stubIgnition(id, 2);
    context.current = ignition;
    try {
      reaction(context, ignition, tools);
    } catch {
      /*
       * A reaction that needs a field this bag does not carry throws, and that
       * is fine: it has already told us everything it was going to about
       * supplies before it reached the missing field, and the alternative —
       * letting the probe take the interface down — is far worse.
       */
    }
  }

  return {
    produces: [...produces],
    consumes: [...consumes],
    reads: [...reads].filter(k => !produces.has(k) && !consumes.has(k)),
  };
}

/** The same question for a whole rack. Sealed slots do not count: they do nothing. */
export function probeRow(
  registry: CrestRegistry,
  slots: readonly (CrestId | null)[],
  sealed: readonly number[] = [],
): ResourceUse {
  const produces = new Set<ResourceKind>();
  const consumes = new Set<ResourceKind>();
  const reads = new Set<ResourceKind>();
  slots.forEach((id, slot) => {
    if (!id || sealed.includes(slot)) return;
    const use = probeCrest(registry, id);
    for (const k of use.produces) produces.add(k);
    for (const k of use.consumes) consumes.add(k);
    for (const k of use.reads) reads.add(k);
  });
  return {
    produces: [...produces],
    consumes: [...consumes],
    reads: [...reads].filter(k => !consumes.has(k)),
  };
}

/** Does anything on this rack actually USE that supply — spend it or read it? */
export function rowUses(use: ResourceUse, kind: ResourceKind): boolean {
  return use.consumes.includes(kind) || use.reads.includes(kind);
}

export { NO_RESOURCES };
