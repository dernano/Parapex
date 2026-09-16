import type { Enemy } from '@/core/types';

/**
 * The strength of the n-th COMBAT — not of the n-th station.
 *
 * These numbers are measured, not chosen: `scripts/kurve.mjs` sends the bot
 * against an enemy that never falls and counts how much force a sensibly
 * played deck brings together over five rounds. Anyone changing them measures
 * first.
 */
export const ENEMY_STRENGTH: readonly number[] =
  [1300, 1600, 1900, 2100, 2350, 2600, 2850, 3100, 3400, 3700];

/** What the final commander adds on top of their slot. */
export const COMMANDER_FACTOR = 1.22;

export function strengthForCombat(combatNumber: number): number {
  const index = Math.max(0, Math.min(ENEMY_STRENGTH.length - 1, combatNumber - 1));
  const base = ENEMY_STRENGTH[index]!;
  const beyond = Math.max(0, combatNumber - ENEMY_STRENGTH.length);
  return beyond ? Math.round(base * Math.pow(1.18, beyond)) : base;
}

export function createEnemy(
  combatNumber: number,
  options: { readonly id?: string; readonly displayName?: string; readonly hp?: number } = {},
): Enemy {
  const hp = options.hp ?? strengthForCombat(combatNumber);
  return {
    id: options.id ?? `enemy-${combatNumber}`,
    displayName: options.displayName ?? 'Angreifer',
    hp,
    maxHp: hp,
  };
}
