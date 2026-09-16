import type {
  Emplacement, Settlement, SettlementStep, Tower,
} from '@/core/types';
import { effectiveForce } from '@/content/units/pool';
import { towerFactor } from '@/content/towers/towerTypes';
import type { Ignition } from '@/crests/types';
import { resolve } from '@/crests/CrestPipeline';
import {
  buildTableau, cardsFromTowers, readTableau, recogniseFormations, volleyCount,
  type CrestRun, type FormationLevels,
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
  /** The crest row, if there is one. Without it the calculation is pure. */
  readonly crests?: CrestRun;
}

/** With crests, the calculation also reports what they did and where they left off. */
export interface ForceResult {
  readonly settlement: Settlement;
  readonly crests: CrestRun | undefined;
  readonly protocol: readonly Ignition[];
}

/** The plain form, for everything that has no crests to consider. */
export function computeForce(
  towers: readonly Tower[],
  options: ComputeForceOptions = {},
): Settlement {
  return computeForceWithCrests(towers, options).settlement;
}

export function computeForceWithCrests(
  towers: readonly Tower[],
  options: ComputeForceOptions = {},
): ForceResult {
  const levels = options.formationLevels ?? {};
  let run = options.crests;
  const protocol: Ignition[] = [];

  const read = run ? readTableau(towers, run) : null;
  if (read) run = read.run;
  const tableau = buildTableau(read ? read.cards : cardsFromTowers(towers));
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
   * And now through the crest row, left to right.
   *
   * `perVolley` and `bonus` are the force of ONE shot, `volleys` the number of
   * shots, `factor` what sits over everything at the end. Three screws and not
   * thirty — which is what keeps the chain readable however many crests pull
   * on it:
   *
   *     (perVolley + bonus) x volleys x factor
   */
  let plannedVolleys = fromFormations;
  let perVolleyForce = baseSum;
  let bonus = 0;
  let factor = 1;

  if (run) {
    const planned = resolve(run.registry, run.session, 'volleyPlanned', {
      towers, emplacements, formations,
      volleys: fromFormations, perVolley: baseSum, bonus: 0, factor: 1,
    }, { dryRun: run.dryRun });
    run = { ...run, session: planned.session };
    protocol.push(...planned.protocol);
    plannedVolleys = planned.data.volleys as number;
    perVolleyForce = planned.data.perVolley as number;
    bonus = planned.data.bonus as number;
    factor = planned.data.factor as number;
  }

  /*
   * As long as somebody is standing on a tower, they fire. Without this floor
   * a crest that halves the volley count and one that runs the row twice add
   * up to zero shots — measured and fixed in the legacy tree.
   */
  const volleys = Math.max(emplacements.length ? 1 : 0, Math.round(plannedVolleys));
  const perVolley = Math.max(0, perVolleyForce + bonus);

  /*
   * The factors are applied ONE AT A TIME, in protocol order, and the volley
   * count comes last. That is not pedantry: (a·f₁·f₂)·v and a·v·(f₁·f₂) are
   * the same in arithmetic and not the same in floating point, and the
   * difference showed up as a one-hit-point discrepancy in two of 2450 pair
   * fixtures — Boundary Stone beside Hourglass.
   *
   * Applying them in order is also what lets the panel show which crest on
   * which slot produced which number, instead of one opaque product.
   */
  let running = perVolley;
  const factorSteps: { ignition: Ignition; force: number }[] = [];
  for (const ignition of protocol) {
    if (ignition.rejected || !ignition.effects.length) continue;
    for (const effect of ignition.effects) {
      if (effect.kind === 'factor' && typeof effect.value === 'number') running *= effect.value;
    }
    factorSteps.push({ ignition, force: running * volleys });
  }
  const total = running * volleys;
  void factor;

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
    settlement: {
      emplacements: emplacements.map(e => ({ ...e, shots: volleys })),
      formations,
      steps,
      volleys,
      base: emplacements.reduce((sum, e) => sum + e.effective, 0),
      perVolley: Math.round(perVolley),
      force: Math.round(total),
    },
    crests: run,
    protocol,
  };
}

