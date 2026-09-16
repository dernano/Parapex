import type { BranchId } from '@/core/types';

/**
 * The legacy tree names branches in German: `bogen-3`, `kanonier-13`. Those
 * strings are in every save file ever written, so the mapping is real content
 * knowledge and not a test detail — Phase 9 (save migration) needs exactly
 * this table.
 *
 * It lives here rather than in the tests so there is one copy of it.
 */
export const LEGACY_BRANCH_IDS: Readonly<Record<string, BranchId>> = {
  bogen: 'bow',
  armbrust: 'crossbow',
  artillerie: 'artillery',
  kanonier: 'gunner',
};

const TO_LEGACY: Readonly<Record<BranchId, string>> = {
  bow: 'bogen', crossbow: 'armbrust', artillery: 'artillerie', gunner: 'kanonier',
};

/** `bogen-3` -> `bow-3`. Returns null for anything that is not a legacy unit id. */
export function unitIdFromLegacy(legacyId: string): string | null {
  const cut = legacyId.lastIndexOf('-');
  if (cut < 0) return null;
  const branch = LEGACY_BRANCH_IDS[legacyId.slice(0, cut)];
  const rank = Number(legacyId.slice(cut + 1));
  if (!branch || !Number.isInteger(rank) || rank < 1) return null;
  return `${branch}-${rank}`;
}

/** `bow-3` -> `bogen-3`. */
export function unitIdToLegacy(id: string): string | null {
  const cut = id.lastIndexOf('-');
  if (cut < 0) return null;
  const branch = TO_LEGACY[id.slice(0, cut) as BranchId];
  return branch ? `${branch}-${id.slice(cut + 1)}` : null;
}
