import type {
  ActiveFormation, BranchId, FormationFamily, FormationId, Rank,
  Tableau, TableauCard, Tower,
} from '@/core/types';
import { RULES } from '@/core/constants';
import { FORMATIONS } from '@/content/formations/formations';

/**
 * Reading the tableau and recognising formations.
 *
 * Pure: towers in, formations out. No module-level state, no ambient
 * singleton, no browser. The crest pipeline will hook in here in Phase 3 by
 * transforming the cards BEFORE matching — that is where rank-changing and
 * copy-making crests belong — which is why `buildTableau` takes its cards as
 * an argument instead of reading towers directly.
 */

/** How much a formation is worth at a given level. */
export function formationVolleys(
  definition: { volleys: number; perLevel: number },
  level: number,
): number {
  return definition.volleys + (level - 1) * definition.perLevel;
}

/** Levels per formation, as the run has raised them. Missing means level 1. */
export type FormationLevels = Readonly<Partial<Record<FormationId, number>>>;

export function formationLevel(levels: FormationLevels, id: FormationId): number {
  return levels[id] ?? 1;
}

/** The cards a set of towers puts on the table, before any crest touches them. */
export function cardsFromTowers(towers: readonly Tower[]): readonly TableauCard[] {
  const cards: TableauCard[] = [];
  towers.forEach((tower, i) => {
    if (!tower?.unit) return;
    cards.push({ tower: i, rank: tower.unit.rank, branch: tower.unit.branch });
  });
  return cards;
}

export function buildTableau(cards: readonly TableauCard[]): Tableau {
  // A copy occupies no emplacement, so it does not count towards `count`.
  const occupied = cards.filter(c => !c.copy).map(c => c.tower);

  const byBranch = (): Map<BranchId, number[]> => {
    const map = new Map<BranchId, number[]>();
    for (const c of cards) {
      const list = map.get(c.branch);
      if (list) list.push(c.tower);
      else map.set(c.branch, [c.tower]);
    }
    return map;
  };

  const byRank = (): Map<Rank, number[]> => {
    const map = new Map<Rank, number[]>();
    for (const c of cards) {
      const list = map.get(c.rank);
      if (list) list.push(c.tower);
      else map.set(c.rank, [c.tower]);
    }
    return map;
  };

  return {
    cards,
    occupied,
    count: occupied.length,

    sameBranch(n) {
      for (const [branch, towers] of byBranch()) {
        if (towers.length >= n) return { towers, branch };
      }
      return null;
    },

    sameRank(n) {
      let best: { towers: number[]; rank: Rank } | null = null;
      for (const [rank, towers] of byRank()) {
        if (towers.length < n) continue;
        if (!best || rank > best.rank) best = { towers: towers.slice(0, n), rank };
      }
      return best;
    },

    twoPairs() {
      const ranks = byRank();
      const paired = [...ranks.entries()]
        .filter(([, towers]) => towers.length >= 2)
        .map(([rank]) => rank)
        .sort((a, b) => b - a);
      const [first, second] = paired;
      if (first === undefined || second === undefined) return null;
      return { towers: [...ranks.get(first)!.slice(0, 2), ...ranks.get(second)!.slice(0, 2)] };
    },

    /*
     * The longest unbroken run. Equal ranks count once — 8/8/9/10 is a run of
     * three, not of four.
     */
    run(n) {
      const ranks = [...new Set(cards.map(c => c.rank))].sort((a, b) => a - b);
      let best: Rank[] = [];
      let current: Rank[] = [];
      ranks.forEach((rank, i) => {
        const previous = ranks[i - 1];
        if (i > 0 && previous !== undefined && rank === previous + 1) current.push(rank);
        else current = [rank];
        if (current.length > best.length) best = current.slice();
      });
      if (best.length < n) return null;
      // Take the last n: the highest ranks are the valuable ones.
      const taken = best.slice(-n);
      const towers = taken.map(rank => cards.find(c => c.rank === rank)!.tower);
      return { towers, ranks: taken };
    },
  };
}

/**
 * Recognise. Collect everything that matches, then keep only the highest tier
 * per family — and whatever a crowning dissolves falls with it.
 */
export function recogniseFormations(
  tableau: Tableau,
  levels: FormationLevels = {},
): readonly ActiveFormation[] {
  if (!tableau.count) return [];

  const matched: ActiveFormation[] = [];
  for (const definition of FORMATIONS) {
    const hit = definition.find(tableau);
    if (!hit) continue;
    const level = formationLevel(levels, definition.id);
    matched.push({
      id: definition.id,
      displayName: definition.displayName,
      description: definition.description,
      family: definition.family,
      tier: definition.tier,
      crowning: Boolean(definition.crowning),
      guard: Boolean(definition.guard),
      dissolves: definition.dissolves ?? [],
      towers: hit.towers.length ? hit.towers : tableau.occupied,
      level,
      volleys: formationVolleys(definition, level),
    });
  }

  // Highest tier per family.
  const best = new Map<FormationFamily, ActiveFormation>();
  for (const formation of matched) {
    const held = best.get(formation.family);
    if (!held || formation.tier > held.tier) best.set(formation.family, formation);
  }

  const survivors = [...best.values()];
  const dissolved = new Set<FormationFamily>();
  for (const formation of survivors) {
    for (const family of formation.dissolves) dissolved.add(family);
  }
  return survivors
    .filter(f => !dissolved.has(f.family))
    .sort((a, b) => b.volleys - a.volleys);
}

/**
 * How many volleys the whole castle fires: one base volley plus everything the
 * formations add.
 */
export function volleyCount(formations: readonly ActiveFormation[]): number {
  return RULES.baseVolley + formations.reduce((sum, f) => sum + f.volleys, 0);
}
