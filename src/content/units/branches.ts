import type { Branch, BranchId } from '@/core/types';

/**
 * Four branches, not card suits. They are meant to differ mechanically, not
 * just by colour: bow aims at repetition, crossbow at force, artillery at
 * neighbourhood, gunners at escalation.
 *
 * Display names are German — they are what the player reads.
 */
export const BRANCHES: Readonly<Record<BranchId, Branch>> = {
  bow: {
    id: 'bow', displayName: 'Bogenschützen', shortName: 'Bogen',
    colour: '#4f7a3a', highlight: '#86b05c', glyph: '🏹',
  },
  crossbow: {
    id: 'crossbow', displayName: 'Armbrustschützen', shortName: 'Armbrust',
    colour: '#2f5fa8', highlight: '#6d9ede', glyph: '🎯',
  },
  artillery: {
    id: 'artillery', displayName: 'Artillerie', shortName: 'Artillerie',
    colour: '#8a6a2a', highlight: '#c9a04a', glyph: '⚙',
  },
  gunner: {
    id: 'gunner', displayName: 'Kanoniere', shortName: 'Kanonier',
    colour: '#a0392a', highlight: '#d96b42', glyph: '💥',
  },
};

export const BRANCH_IDS: readonly BranchId[] = ['bow', 'crossbow', 'artillery', 'gunner'];
