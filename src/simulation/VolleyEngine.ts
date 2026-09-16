import type {
  Emplacement, Settlement, SettlementStep, Tower,
} from '@/core/types';
import { effectiveForce } from '@/content/units/pool';
import { towerFactor } from '@/content/towers/towerTypes';
import {
  buildTableau, cardsFromTowers, recogniseFormations, volleyCount,
  type FormationLevels,
} from './FormationEngine';

/**
 * The force of a volley:
 *
 *   per tower:  (rank + polish) x tower type
 *   sum       x  volleys        x  crests
 *
 * The volley count is not an arithmetic trick: every volley is a shot the
 * renderer actually draws. Someone reading "7 Volleys" sees it fire seven
 * times.
 *
 * WHAT THIS FUNCTION IS NOT ALLOWED TO DO: touch anything. It takes towers and
 * returns a settlement. The display asks it dozens of times a second — for the
 * preview, for the bar, for the panel — and a calculation that burned powder
 * or wrote to a combat log while being asked would leave nothing correct after
 * a second of mouse movement.
 *
 * In the legacy tree this was `berechneWucht(tuerme, wappen, probe)`, and the
 * `probe` flag existed precisely because the function DID touch things. There
 * is no flag here. Crests enter in Phase 3 as an explicit pipeline that
 * returns effects rather than applying them.
 */
export interface ComputeForceOptions {
  /** Formation levels the run has bought. Missing entries mean level 1. */
  readonly formationLevels?: FormationLevels;
}

export function computeForce(
  towers: readonly Tower[],
  options: ComputeForceOptions = {},
): Settlement {
  const levels = options.formationLevels ?? {};

  const tableau = buildTableau(cardsFromTowers(towers));
  const formations = recogniseFormations(tableau, levels);

  const emplacements: Emplacement[] = [];
  towers.forEach((tower, i) => {
    const unit = tower?.unit;
    if (!unit) return;
    const effective = effectiveForce(unit);
    const factor = towerFactor(tower);
    emplacements.push({
      tower: i,
      displayName: unit.displayName,
      branch: unit.branch,
      rank: unit.rank,
      base: unit.baseForce,
      bonus: unit.forceBonus,
      effective,
      towerFactor: factor,
      force: effective * factor,
      // Filled in below, once the volley count is known.
      shots: 0,
    });
  });

  const baseSum = emplacements.reduce((sum, e) => sum + e.force, 0);
  const fromFormations = volleyCount(formations);

  /*
   * As long as somebody is standing on a tower, they fire. Without this floor
   * a crest that halves the volley count and one that runs the row twice add
   * up to zero shots — measured and fixed in the legacy tree, and the floor
   * comes across with the rule.
   */
  const volleys = Math.max(emplacements.length ? 1 : 0, Math.round(fromFormations));
  const perVolley = Math.max(0, baseSum);
  const total = perVolley * volleys;

  const steps: SettlementStep[] = [
    { kind: 'base', displayName: 'Wucht je Salve', value: null, force: baseSum },
  ];
  for (const formation of formations) {
    steps.push({
      kind: 'formation', id: formation.id, displayName: formation.displayName,
      value: `+${formation.volleys}`, volleys: formation.volleys,
      force: baseSum * fromFormations,
    });
  }
  steps.push({
    kind: 'volleys', displayName: `${volleys} Salven`, value: `×${volleys}`,
    volleys, force: total,
  });

  return {
    emplacements: emplacements.map(e => ({ ...e, shots: volleys })),
    formations,
    steps,
    volleys,
    base: emplacements.reduce((sum, e) => sum + e.effective, 0),
    perVolley: Math.round(perVolley),
    force: Math.round(total),
  };
}

