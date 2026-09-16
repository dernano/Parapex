import type { BranchId } from '@/core/types';
import type { PresentationSettings } from '../presentation/settings';
import { effectEnabled } from '../presentation/settings';
import type { WorldPoint } from '../WorldTransform';
import { spawn, type ParticleField, type ParticleKind } from './particles';

/**
 * THE PIXEL FX EMITTER, as data.
 *
 * One emitter is a named recipe: a handful of bursts, each with a kind, a
 * count, a place and a force. Smoke, dust, flash, debris and sparks are all
 * the same machine — what differs between a longbow's release and a bombard's
 * is four numbers, not four functions.
 *
 * That matters beyond tidiness. The workbench can list every emitter by name
 * and fire it in isolation, which is how one tells "the smoke is wrong" from
 * "the smoke is right and the cannon is firing at the wrong moment". A
 * hand-written effect per weapon cannot be enumerated, so it cannot be
 * compared, so it never gets tuned.
 */

/** Where a burst originates, relative to the emitter's own point. */
export type BurstOrigin =
  /** At the point itself — the muzzle socket, the impact. */
  | 'origin'
  /**
   * On the ground directly beneath it. This is the tower-and-machine CONTACT
   * POINT: a bombard does not kick dust off thin air, it kicks it off the
   * planking the carriage is bolted to, and the difference between those two
   * is whether the machine has weight.
   */
  | 'contact';

export interface BurstSpec {
  readonly kind: ParticleKind;
  readonly count: number;
  readonly from: BurstOrigin;
  /** Multiplies the burst's speed and size. */
  readonly force: number;
  /** Whether the firing direction pushes it. Smoke yes, settling dust no. */
  readonly directed: boolean;
}

export interface EmitterSpec {
  readonly id: string;
  /** German, for the workbench list. */
  readonly displayName: string;
  readonly bursts: readonly BurstSpec[];
}

const burst = (
  kind: ParticleKind, count: number, force = 1,
  from: BurstOrigin = 'origin', directed = true,
): BurstSpec => ({ kind, count, from, force, directed });

/**
 * THE MUZZLE EMITTERS.
 *
 * Note what separates them. It is not "more particles for the big gun" — it is
 * WHICH KINDS appear at all. A bow has no flash and no smoke and never will,
 * because a bow does not burn anything; a bombard has all five, and the flash
 * is the loudest thing on the screen for two frames.
 */
export const MUZZLE_EMITTERS: Readonly<Record<BranchId, EmitterSpec>> = {
  bow: {
    id: 'muzzle/bow', displayName: 'Bogen · Abschuss',
    // Nothing burns, nothing smokes. The release reads through the bow itself.
    bursts: [],
  },
  crossbow: {
    id: 'muzzle/crossbow', displayName: 'Armbrust · Abschuss',
    // The nut releasing off steel: two sparks, no more.
    bursts: [burst('spark', 2, 1)],
  },
  artillery: {
    id: 'muzzle/artillery', displayName: 'Artillerie · Auslösung',
    // No powder, so no flash — but the frame slams, and the platform answers.
    bursts: [
      burst('dust', 5, 1.2, 'contact', false),
      burst('debris', 2, 0.7, 'contact', false),
    ],
  },
  gunner: {
    id: 'muzzle/gunner', displayName: 'Kanone · Mündungsfeuer',
    /*
     * The one that has to look expensive. The flash is bright, brief and lives
     * exactly at the muzzle socket — not near the gunner, not at the tower's
     * middle. That single fact is most of what makes a cannon read as a
     * cannon, and it is why the socket exists at all.
     */
    bursts: [
      burst('flash', 3, 1.8),
      burst('smoke', 7, 1.2),
      burst('spark', 3, 1.4),
      burst('dust', 4, 0.9, 'contact', false),
    ],
  },
};

/**
 * THE FOUR IMPACT PROFILES.
 *
 * An arrow and a bombard must not share an explosion. Each of these has a
 * signature a player can name without being told: the arrow is a tick, the
 * bolt sparks off armour, the stone throws earth, the ball leaves a cloud that
 * is still there when the next shot arrives.
 */
export const IMPACT_EMITTERS: Readonly<Record<string, EmitterSpec>> = {
  arrow: {
    id: 'impact/arrow', displayName: 'Pfeil · Einschlag',
    bursts: [burst('dust', 2, 0.6, 'origin', false)],
  },
  bolt: {
    id: 'impact/bolt', displayName: 'Bolzen · Einschlag',
    bursts: [
      burst('dust', 3, 0.8, 'origin', false),
      burst('spark', 3, 1.2),
    ],
  },
  stone: {
    id: 'impact/stone', displayName: 'Stein · Einschlag',
    bursts: [
      burst('dust', 7, 1.5, 'origin', false),
      burst('debris', 6, 1.2),
    ],
  },
  ball: {
    id: 'impact/ball', displayName: 'Kugel · Einschlag',
    bursts: [
      burst('dust', 8, 1.7, 'origin', false),
      burst('debris', 5, 1.3),
      // The only profile that leaves anything behind. That is its signature.
      burst('smoke', 4, 1.1),
    ],
  },
};

/** Everything a workbench can fire on its own, by name. */
export const ALL_EMITTERS: readonly EmitterSpec[] = [
  ...Object.values(MUZZLE_EMITTERS),
  ...Object.values(IMPACT_EMITTERS),
];

export interface EmitOptions {
  readonly at: WorldPoint;
  /** Which way the event pushed things, in tiles. */
  readonly direction?: { readonly col: number; readonly row: number };
  /** The salvo's escalation. One shot is 1; a barrage is several. */
  readonly force?: number;
  /** Nothing an effect toggle has switched off is emitted at all. */
  readonly settings?: PresentationSettings;
}

/**
 * Run an emitter into a field.
 *
 * Pure: field in, field out. A disabled effect is not spawned-and-hidden, it
 * is never spawned, so turning smoke off actually costs nothing — which is the
 * difference between an accessibility option and a decoration.
 */
export function emit(
  field: ParticleField,
  emitter: EmitterSpec,
  options: EmitOptions,
): ParticleField {
  const force = options.force ?? 1;
  const direction = options.direction ?? { col: 0, row: 0 };
  let next = field;
  for (const spec of emitter.bursts) {
    if (options.settings && !effectEnabled(options.settings, spec.kind)) continue;
    const at: WorldPoint = spec.from === 'contact'
      ? { col: options.at.col, row: options.at.row, height: 0 }
      : options.at;
    next = spawn(next, {
      kind: spec.kind,
      at,
      count: Math.max(1, Math.round(spec.count * Math.min(2, Math.max(0.5, force)))),
      ...(spec.directed ? { direction } : {}),
      force: spec.force * force,
    });
  }
  return next;
}

/** The muzzle effect for a branch. */
export const muzzleEmitter = (branch: BranchId): EmitterSpec => MUZZLE_EMITTERS[branch];

/** The impact effect for a projectile kind. */
export const impactEmitter = (projectile: string): EmitterSpec =>
  IMPACT_EMITTERS[projectile] ?? IMPACT_EMITTERS.arrow!;

/**
 * How many particles an emitter asks for at a given force. The workbench shows
 * this beside the toggle, so "the cannon is too quiet" becomes a number.
 */
export function particleCost(emitter: EmitterSpec, force = 1): number {
  return emitter.bursts.reduce(
    (sum, b) => sum + Math.max(1, Math.round(b.count * Math.min(2, Math.max(0.5, force)))), 0);
}
