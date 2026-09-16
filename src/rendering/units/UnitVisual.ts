import type { BranchId } from '@/core/types';
import { UNIT_HEIGHT, heightBandForRank } from '../artRules';

/**
 * How a unit looks and how it fires — as DATA.
 *
 * Fifty-two units, four definitions. The brief is explicit that this must not
 * become fifty-two bespoke rendering functions, and the reason is not tidiness:
 * a per-unit function is a place where one soldier can quietly stop obeying
 * the anchor rule, and nobody finds out until a screenshot looks wrong.
 *
 * A unit's BRANCH decides how it fires. Its RANK decides how it is equipped.
 * Neither ever decides its scale — a rank 13 that is simply bigger is a rank 1
 * with a magnifying glass.
 */

/** A point on the sprite, relative to its own top-left, in logical pixels. */
export interface Socket {
  readonly x: number;
  readonly y: number;
}

/**
 * One beat of a firing action.
 *
 * The four families read completely differently on purpose — this is the thing
 * the player watches a thousand times, and four variations of "sprite jerks
 * backwards" is the difference between a game one enjoys and one one tolerates.
 */
export interface FiringPhase {
  readonly name: string;
  /** Seconds. The sum over all phases is the action's length. */
  readonly duration: number;
  /**
   * How far the weapon is drawn back along its own axis, 0..1. The bow bends,
   * the crossbow is spanned, the sling arm winds, the barrel sits still.
   */
  readonly draw?: number;
  /** How hard the weapon kicks in this phase, in logical pixels. */
  readonly recoil?: number;
  /** The projectile leaves during this phase, at this fraction of it. */
  readonly release?: number;
  /** Smoke, flash, dust — named, so the presentation can pick the effect. */
  readonly effect?: 'flash' | 'smoke' | 'dust' | 'splinters' | 'sparks';
}

export interface UnitVisualDefinition {
  readonly branch: BranchId;
  /** German, for the codex. */
  readonly familyName: string;
  /** Where things attach. Real positions, not the sprite's middle. */
  readonly sockets: Readonly<Record<'muzzle' | 'recoilPivot' | 'smoke' | 'banner', Socket>>;
  /** What leaves the muzzle. */
  readonly projectile: 'arrow' | 'bolt' | 'stone' | 'ball';
  /** How fast the shot travels, in tiles per second. */
  readonly projectileSpeed: number;
  /** How high it arcs, in logical pixels. A cannonball barely arcs; a stone does. */
  readonly projectileArc: number;
  readonly phases: readonly FiringPhase[];
  /** Idle: rare and small. A castle is not a screensaver. */
  readonly idleFrames: number;
}

/*
 * The four families.
 *
 * Bow aims at repetition, crossbow at force, artillery at neighbourhood,
 * gunners at escalation — and each one's firing reads that way before the
 * player has read a single number.
 */
export const UNIT_VISUALS: Readonly<Record<BranchId, UnitVisualDefinition>> = {
  bow: {
    branch: 'bow',
    familyName: 'Bogenschützen',
    sockets: {
      muzzle: { x: 13, y: 7 },        // the bowstring, out in front at shoulder height
      recoilPivot: { x: 7, y: 12 },
      smoke: { x: 13, y: 7 },
      banner: { x: 7, y: 0 },
    },
    projectile: 'arrow',
    projectileSpeed: 14,
    projectileArc: 26,
    /* Draw, hold, release, and the bow snaps straight. Light and quick. */
    phases: [
      { name: 'draw', duration: 0.18, draw: 1 },
      { name: 'hold', duration: 0.06, draw: 1 },
      { name: 'release', duration: 0.05, draw: 0, recoil: 2, release: 0.2 },
      { name: 'snap', duration: 0.10, draw: 0.15 },
    ],
    idleFrames: 2,
  },

  crossbow: {
    branch: 'crossbow',
    familyName: 'Armbrustschützen',
    sockets: {
      muzzle: { x: 14, y: 9 },
      recoilPivot: { x: 6, y: 13 },
      smoke: { x: 14, y: 9 },
      banner: { x: 7, y: 0 },
    },
    projectile: 'bolt',
    projectileSpeed: 22,
    projectileArc: 10,               // flat and fast; a bolt does not loop
    /* Raise, aim, a mechanical snap, then the long reload that costs it its
     * rate of fire. The heaviness IS the character. */
    phases: [
      { name: 'raise', duration: 0.14 },
      { name: 'aim', duration: 0.12, draw: 1 },
      { name: 'snap', duration: 0.04, draw: 0, recoil: 4, release: 0.1, effect: 'sparks' },
      { name: 'reload', duration: 0.30, draw: 0.5 },
    ],
    idleFrames: 2,
  },

  artillery: {
    branch: 'artillery',
    familyName: 'Artillerie',
    sockets: {
      muzzle: { x: 18, y: 4 },       // the sling cup, high on the arm
      recoilPivot: { x: 12, y: 22 },  // the machine's axle, low and central
      smoke: { x: 18, y: 6 },
      banner: { x: 4, y: 0 },
    },
    projectile: 'stone',
    projectileSpeed: 7,
    projectileArc: 92,               // a high, slow lob — you watch it travel
    /* The crew serves the machine. Winding takes time, the release is one
     * violent beat, and the frame rocks afterwards. */
    phases: [
      { name: 'crew', duration: 0.26 },
      { name: 'wind', duration: 0.22, draw: 1 },
      { name: 'loose', duration: 0.06, draw: 0, recoil: 7, release: 0.15, effect: 'dust' },
      { name: 'settle', duration: 0.26, draw: 0.3, effect: 'splinters' },
    ],
    idleFrames: 3,
  },

  gunner: {
    branch: 'gunner',
    familyName: 'Kanoniere',
    sockets: {
      muzzle: { x: 17, y: 11 },      // the barrel mouth
      recoilPivot: { x: 8, y: 16 },
      smoke: { x: 19, y: 11 },
      banner: { x: 6, y: 0 },
    },
    projectile: 'ball',
    projectileSpeed: 26,
    projectileArc: 16,
    /* Fuse, flash, a heavy kick, and smoke that hangs. The slowest to start
     * and by far the most violent — escalation, made visible. */
    phases: [
      { name: 'fuse', duration: 0.24, effect: 'sparks' },
      { name: 'ignite', duration: 0.05, effect: 'flash', release: 0.6, recoil: 10 },
      { name: 'recoil', duration: 0.12, recoil: 10, effect: 'smoke' },
      { name: 'settle', duration: 0.24, recoil: 2, effect: 'smoke' },
    ],
    idleFrames: 2,
  },
};

export const visualFor = (branch: BranchId): UnitVisualDefinition => UNIT_VISUALS[branch];

/** How long one firing action takes, in seconds. */
export const firingDuration = (definition: UnitVisualDefinition): number =>
  definition.phases.reduce((sum, phase) => sum + phase.duration, 0);

/**
 * How a rank is equipped. NEVER how large it is.
 *
 * Progression reads through armour, helmet, weapon craftsmanship, cloth
 * quality and heraldic detail — the things that change a silhouette's texture
 * without changing its size.
 */
export interface Equipment {
  readonly band: keyof typeof UNIT_HEIGHT;
  readonly armour: 'none' | 'padded' | 'mail' | 'plated';
  readonly helmet: 'cap' | 'kettle' | 'closed' | 'crested';
  readonly weapon: 'plain' | 'sound' | 'fine' | 'master';
  /** Whether the unit carries a heraldic mark at all. */
  readonly heraldry: boolean;
}

export function equipmentForRank(rank: number): Equipment {
  const band = heightBandForRank(rank);
  if (rank <= 3) {
    return { band, armour: 'none', helmet: 'cap', weapon: 'plain', heraldry: false };
  }
  if (rank <= 6) {
    return { band, armour: 'padded', helmet: 'kettle', weapon: 'sound', heraldry: false };
  }
  if (rank <= 9) {
    return { band, armour: 'mail', helmet: 'kettle', weapon: 'sound', heraldry: true };
  }
  if (rank <= 12) {
    return { band, armour: 'mail', helmet: 'closed', weapon: 'fine', heraldry: true };
  }
  /* Rank 13, the master. Special without becoming fantasy nonsense: the best
   * armour the period had, a crested helm and a weapon somebody was proud of. */
  return { band, armour: 'plated', helmet: 'crested', weapon: 'master', heraldry: true };
}
