import { createUnit } from '@/content/units/pool';
import { GAME_REGISTRY } from '@/content/crests/registry';
import type { BranchId, CombatState, Unit } from '@/core/types';
import { NO_RESOURCES, type CrestRow } from '@/crests/types';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { ENEMY_COLUMN, GRID_ROWS } from '@/rendering/artRules';
import type { WorldPoint } from '@/rendering/WorldTransform';
import {
  ALL_EFFECTS, NO_DEBUG, type PresentationSettings,
} from '@/rendering/presentation/settings';

/**
 * The workbench's own state, and the ONE place a combat is built from it.
 *
 * Everything the panel can change lives here as plain data, so a screenshot
 * can carry the exact configuration that produced it and the harness can
 * reproduce a named state without clicking anything.
 */

export type TargetSide = 'left' | 'centre' | 'right';
export type CrestPreset = 'none' | 'chain' | 'powderDead' | 'powderLive';

export interface Bench {
  readonly family: BranchId;
  /** 1, 5, 9 or 13 — one rank from each equipment step. */
  readonly rank: number;
  readonly target: TargetSide;
  readonly volleys: number;
  /** All five emplacements manned, which is what Geschlossene Front needs. */
  readonly formation: boolean;
  readonly crests: CrestPreset;
  readonly powder: number;
  readonly settings: PresentationSettings;
}

export const DEFAULT_BENCH: Bench = {
  family: 'gunner',
  rank: 13,
  target: 'centre',
  volleys: 3,
  formation: true,
  crests: 'none',
  powder: 0,
  settings: {
    unitScale: 1,
    reducedMotion: false,
    effects: ALL_EFFECTS,
    debug: { ...NO_DEBUG, fps: true, spriteCount: true, queue: true, missingArt: true },
  },
};

/**
 * The crest presets, chosen to exercise the presentation rather than the
 * balance. Between them they produce every trigger profile the renderer can
 * draw and both halves of the supply warning.
 */
export const CREST_PRESETS: Readonly<Record<CrestPreset, {
  readonly label: string; readonly slots: readonly (string | null)[];
  readonly note: string;
}>> = {
  none: { label: 'leer', slots: [null, null, null, null, null],
    note: 'Keine Wappen — die reine Rechnung.' },
  chain: {
    label: 'Kette',
    // Schleifstein → Löwe is the (s+1)×3 against s×3+1 demonstration; the Rabe
    // at the end fires the first slot a second time, so RETRIGGER appears.
    slots: ['grindstone', 'lion', 'doubleEagle', 'hammer', 'raven'],
    note: '(s+1)×3 gegen s×3+1 — und ein Wappen, das Platz 1 erneut zündet.',
  },
  powderDead: {
    label: 'Pulver tot',
    // Two producers and nothing that spends: the brief's own dead machine.
    slots: ['millwheel', 'whetstone', null, null, null],
    note: 'Zwei Quellen, keine Senke. Die Warnung muss erscheinen.',
  },
  powderLive: {
    label: 'Pulver läuft',
    slots: ['millwheel', 'whetstone', 'powderHorn', 'tinder', null],
    note: 'Dieselben Quellen, jetzt mit Verbrauchern. Keine Warnung.',
  },
};

export const crestRowFor = (preset: CrestPreset): CrestRow => ({
  slots: [...CREST_PRESETS[preset].slots],
  sealed: [], commanderRules: [],
});

/**
 * Which cards go on the wall.
 *
 * With the formation on, all five emplacements are manned with a spread of
 * families so the wall reads as a garrison rather than as five copies. With it
 * off, two are manned — enough to see a duel, not enough for any formation to
 * fire, which is what makes the toggle a clean A/B.
 */
function garrison(bench: Bench): readonly { tower: number; unit: Unit }[] {
  const pick = (branch: BranchId, rank: number): Unit | null => {
    for (let r = rank; r >= 1; r--) {
      const unit = createUnit(`${branch}-${r}`);
      if (unit) return unit;
    }
    return null;
  };

  const chosen = pick(bench.family, bench.rank);
  const out: { tower: number; unit: Unit }[] = [];
  if (chosen) out.push({ tower: 2, unit: chosen });

  const others: readonly BranchId[] = ['bow', 'crossbow', 'artillery', 'gunner'];
  const towers = bench.formation ? [0, 1, 3, 4] : [0];
  towers.forEach((tower, i) => {
    const unit = pick(others[i % others.length]!, bench.rank);
    if (unit) out.push({ tower, unit });
  });
  return out;
}

/** A fresh combat in exactly the configuration the panel describes. */
export function buildState(bench: Bench): CombatState {
  let state = createCombat({
    deck: [],
    enemy: { id: 'vorhut', displayName: 'Spähertrupp', hp: 3200, maxHp: 4000 },
    seed: 'werkbank',
    towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
    shuffle: false,
    crests: crestRowFor(bench.crests),
    resources: { ...NO_RESOURCES, powder: bench.powder },
    deps: { registry: GAME_REGISTRY },
  }).state;

  for (const { tower, unit } of garrison(bench)) {
    const result = performAction({ ...state, hand: [...state.hand, unit], momentum: 99 },
      { type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: tower });
    if (result.ok) state = { ...result.state, momentum: state.momentum };
  }
  return state;
}

/** Where the castle is shooting. Three places, so recoil can be judged. */
export function targetPoint(side: TargetSide): WorldPoint {
  const centre = Math.round(GRID_ROWS / 2);
  if (side === 'left') return { col: ENEMY_COLUMN, row: centre - 6 };
  if (side === 'right') return { col: ENEMY_COLUMN, row: centre + 6 };
  return { col: ENEMY_COLUMN, row: centre };
}

/**
 * A hand to lay out. The workbench does not play the game, so these are cards
 * to LOOK at: seven of them, mixed, which is the case the layout has to
 * survive.
 */
export function benchHand(): readonly Unit[] {
  return ['bow-3', 'gunner-13', 'crossbow-7', 'artillery-11', 'bow-11', 'gunner-2', 'crossbow-5']
    .map(id => createUnit(id))
    .filter((u): u is Unit => Boolean(u));
}
