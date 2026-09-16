import type { FormationDefinition } from '@/core/types';
import { GUARD_RANKS, RULES } from '@/core/constants';

/**
 * Five occupied towers are a tableau. What is in it is read the way a card
 * hand is read: same branch, same ranks, a run of ranks — and the best of them
 * is both at once.
 *
 * THE POSITION OF THE TOWERS DOES NOT MATTER. Everything below works on sets.
 *
 * FAMILIES. Only the highest formation reached in each family counts. Five
 * identical branches are a Pure Guard and not additionally a Regiment and a
 * Great Regiment — otherwise every good line-up would be a stack of six
 * medals and nobody could judge what one of them is worth.
 *
 * THE REWARD IS VOLLEYS, not multipliers. Better formation, more volleys, and
 * a volley is a shot you can see.
 *
 * Display names and descriptions are German: they are what the player reads.
 */
export const FORMATIONS: readonly FormationDefinition[] = [
  /* ---- Base line ---- */
  {
    id: 'closedFront', displayName: 'Geschlossene Front',
    description: 'Alle fünf Stellungen besetzt.',
    family: 'baseLine', tier: 1, volleys: 1, perLevel: 1,
    find: (t) => (t.count === RULES.towers ? { towers: t.occupied } : null),
  },

  /* ---- Family: same branch ---- */
  {
    id: 'regiment', displayName: 'Regiment',
    description: 'Drei Einheiten derselben Gattung.',
    family: 'branch', tier: 1, volleys: 2, perLevel: 1,
    find: (t) => t.sameBranch(3),
  },
  {
    id: 'greatRegiment', displayName: 'Großes Regiment',
    description: 'Vier Einheiten derselben Gattung.',
    family: 'branch', tier: 2, volleys: 4, perLevel: 2,
    find: (t) => t.sameBranch(4),
  },
  {
    id: 'pureGuard', displayName: 'Reine Garde',
    description: 'Alle fünf Stellungen mit derselben Gattung.',
    family: 'branch', tier: 3, volleys: 7, perLevel: 3,
    find: (t) => (t.count === RULES.towers ? t.sameBranch(5) : null),
  },

  /* ---- Family: same ranks ---- */
  {
    id: 'doublePost', displayName: 'Doppelposten',
    description: 'Zwei Einheiten desselben Rangs.',
    family: 'rank', tier: 1, volleys: 1, perLevel: 1,
    find: (t) => t.sameRank(2),
  },
  {
    id: 'doubleWatch', displayName: 'Doppelte Wache',
    description: 'Zwei verschiedene Paare.',
    family: 'rank', tier: 2, volleys: 2, perLevel: 1,
    find: (t) => t.twoPairs(),
  },
  {
    id: 'tripletPost', displayName: 'Drillingsposten',
    description: 'Drei Einheiten desselben Rangs.',
    family: 'rank', tier: 3, volleys: 3, perLevel: 2,
    find: (t) => t.sameRank(3),
  },
  {
    id: 'fourBlock', displayName: 'Viererblock',
    description: 'Vier Einheiten desselben Rangs.',
    family: 'rank', tier: 4, volleys: 10, perLevel: 4,
    find: (t) => t.sameRank(4),
  },

  /* ---- Family: run of ranks ---- */
  {
    id: 'advance', displayName: 'Vormarsch',
    description: 'Drei aufeinanderfolgende Ränge.',
    family: 'run', tier: 1, volleys: 2, perLevel: 1,
    find: (t) => t.run(3),
  },
  {
    id: 'greatAdvance', displayName: 'Großer Vormarsch',
    description: 'Vier aufeinanderfolgende Ränge.',
    family: 'run', tier: 2, volleys: 4, perLevel: 2,
    find: (t) => t.run(4),
  },
  {
    id: 'perfectAdvance', displayName: 'Perfekter Vormarsch',
    description: 'Fünf aufeinanderfolgende Ränge.',
    family: 'run', tier: 3, volleys: 7, perLevel: 3,
    find: (t) => t.run(5),
  },

  /*
   * The crowning. It supersedes the branch AND the run family at once — hence
   * `dissolves` — and is the rarest thing a sheet of 52 cards can produce:
   * five cards of one branch in an unbroken run.
   */
  {
    id: 'royalAdvance', displayName: 'Königlicher Aufmarsch',
    description: 'Fünf aufeinanderfolgende Ränge derselben Gattung.',
    family: 'branch', tier: 9, dissolves: ['run'], crowning: true,
    volleys: 15, perLevel: 5,
    find: (t) => {
      if (t.count !== RULES.towers) return null;
      return t.sameBranch(5) && t.run(5) ? { towers: t.occupied } : null;
    },
  },

  /*
   * The peak. A Royal Advance may start at 2; the Guard is the one advance
   * that ends at the top — 9, 10, 11, 12, 13 in a single branch. It sits in
   * the same family one tier above, so only ever one of the two counts.
   */
  {
    id: 'royalGuard', displayName: 'Königliche Garde',
    description: 'Neun bis König in einer Gattung.',
    family: 'branch', tier: 10, dissolves: ['run'], crowning: true, guard: true,
    volleys: 25, perLevel: 8,
    find: (t) => {
      if (t.count !== RULES.towers) return null;
      if (!t.sameBranch(RULES.towers)) return null;
      const ranks = new Set(t.cards.map(c => c.rank));
      for (const r of GUARD_RANKS) if (!ranks.has(r)) return null;
      return { towers: t.occupied };
    },
  },
];
