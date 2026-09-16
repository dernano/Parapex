import type { FormationId } from '@/core/types';

/**
 * German formation ids as the legacy tree writes them. Kept as content rather
 * than as a test detail: formation levels are addressed by id, so any save
 * that carries them needs this table in Phase 9.
 */
export const LEGACY_FORMATION_IDS: Readonly<Record<string, FormationId>> = {
  geschlosseneFront: 'closedFront',
  regiment: 'regiment',
  grossesRegiment: 'greatRegiment',
  reineGarde: 'pureGuard',
  doppelposten: 'doublePost',
  doppelteWache: 'doubleWatch',
  drillingsposten: 'tripletPost',
  viererblock: 'fourBlock',
  vormarsch: 'advance',
  grosserVormarsch: 'greatAdvance',
  perfekterVormarsch: 'perfectAdvance',
  koeniglicherAufmarsch: 'royalAdvance',
  koeniglicheGarde: 'royalGuard',
};

/** German family ids as the legacy tree writes them. */
export const LEGACY_FORMATION_FAMILIES: Readonly<Record<string, string>> = {
  grund: 'baseLine',
  gattung: 'branch',
  rang: 'rank',
  folge: 'run',
};
