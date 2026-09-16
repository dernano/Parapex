import type { BranchId, Unit, UnitPrototype } from '@/core/types';
import { BRANCH_IDS } from './branches';
import { RANK_NAMES } from './rankNames';

/** The 52 base cards: four branches times thirteen ranks. */
function buildPool(): readonly UnitPrototype[] {
  const pool: UnitPrototype[] = [];
  for (const branch of BRANCH_IDS) {
    RANK_NAMES[branch].forEach((displayName, i) => {
      const rank = i + 1;
      pool.push({ id: `${branch}-${rank}`, branch, rank, displayName, baseForce: rank });
    });
  }
  return pool;
}

export const UNIT_POOL: readonly UnitPrototype[] = buildPool();

const BY_ID = new Map(UNIT_POOL.map(u => [u.id, u]));

export function unitPrototype(id: string): UnitPrototype | undefined {
  return BY_ID.get(id);
}

/**
 * A fresh copy out of the pool, with its own uid — two identical cards are two
 * cards.
 *
 * The counter is module-local and deliberately not part of game state: a uid
 * identifies a card *within a session*, nothing more. Anything that has to
 * survive a save refers to the prototype id.
 */
let uidCounter = 0;

export function createUnit(id: string): Unit | null {
  const proto = BY_ID.get(id);
  if (!proto) return null;
  return { ...proto, uid: `u${++uidCounter}`, forceBonus: 0, level: 0 };
}

/** Polishing raises force, never rank: the rank stays a formation matter. */
export function polish(unit: Unit, by = 2): Unit {
  return { ...unit, level: unit.level + 1, forceBonus: unit.forceBonus + by };
}

/**
 * What actually lands. Three names exist and confusing them is the single most
 * common source of "where did my upgrade go":
 *
 *   baseForce    what the rank brings         (bow 9 -> 9)
 *   forceBonus   what polishing added         (+4)
 *   effective    what hits the enemy          (13)
 *
 * Every calculation, everywhere, uses `effectiveForce`.
 */
export function effectiveForce(unit: Unit | null): number {
  if (!unit) return 0;
  return Math.max(0, unit.baseForce + unit.forceBonus);
}

/** The starting deck is the whole sheet: all 52 cards. */
export const STARTING_DECK: readonly string[] = UNIT_POOL.map(u => u.id);

/** The branch order used wherever branches are listed. */
export type { BranchId };
