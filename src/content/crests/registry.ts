import type { CrestDefinition, CrestId } from '@/crests/types';
import type { CrestRegistry } from '@/crests/CrestPipeline';
import { CREST_BY_ID } from './crests';

/**
 * Where a crest and a commander rule are looked up.
 *
 * Commander rules arrive in Phase 8; until then the lookup is honest about
 * returning nothing rather than pretending an empty table is complete.
 */
export const COMMANDER_RULES: ReadonlyMap<string, CrestDefinition> = new Map();

export const GAME_REGISTRY: CrestRegistry = {
  crest: (id: CrestId) => CREST_BY_ID.get(id),
  commanderRule: (id: string) => COMMANDER_RULES.get(id),
};
