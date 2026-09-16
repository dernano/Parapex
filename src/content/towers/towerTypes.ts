import type { Tower, TowerType, TowerTypeId } from '@/core/types';
import { RULES } from '@/core/constants';

/**
 * The five emplacements persist across a run; their TYPE is the long-term
 * progression axis. A type is deliberately more than a percentage — `factor`
 * is only the simplest form it can take.
 *
 * Display names and descriptions are German.
 */
export const TOWER_TYPES: Readonly<Record<TowerTypeId, TowerType>> = {
  watchtower: {
    id: 'watchtower', displayName: 'Wachturm', description: 'Keine Sonderregel.',
  },
  archerTower: {
    id: 'archerTower', displayName: 'Schützenturm', description: 'Bogenschützen +40 % Wucht.',
    branch: 'bow', factor: RULES.towerFactor,
  },
  ballistaTower: {
    id: 'ballistaTower', displayName: 'Ballistenturm', description: 'Armbrustschützen +40 % Wucht.',
    branch: 'crossbow', factor: RULES.towerFactor,
  },
  cannonTower: {
    id: 'cannonTower', displayName: 'Geschützturm', description: 'Artillerie +40 % Wucht.',
    branch: 'artillery', factor: RULES.towerFactor,
  },
  powderTower: {
    id: 'powderTower', displayName: 'Pulverturm', description: 'Kanoniere +40 % Wucht.',
    branch: 'gunner', factor: RULES.towerFactor,
  },
};

export const STARTING_TOWER_TYPES: readonly TowerTypeId[] =
  Array.from({ length: RULES.towers }, () => 'watchtower' as const);

/** What the tower type does to the force of the unit standing on it. */
export function towerFactor(tower: Tower): number {
  const type = TOWER_TYPES[tower.type] ?? TOWER_TYPES.watchtower;
  if (!tower.unit || !type.branch) return 1;
  return tower.unit.branch === type.branch ? (type.factor ?? 1) : 1;
}

/** The legacy tree names tower types in German; save files carry those strings. */
export const LEGACY_TOWER_TYPE_IDS: Readonly<Record<string, TowerTypeId>> = {
  wachturm: 'watchtower',
  schuetzenturm: 'archerTower',
  ballistenturm: 'ballistaTower',
  geschuetzturm: 'cannonTower',
  pulverturm: 'powderTower',
};
