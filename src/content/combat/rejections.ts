import type { CombatFailure, CombatRejection } from '@/core/types';

/**
 * What the player reads when an action is refused.
 *
 * German, because it is content. It lives here rather than in the engine so a
 * message can be reworded without touching a rule, and so a rule can be tested
 * without asserting on prose.
 */
const GENERIC: Readonly<Record<CombatRejection, string>> = {
  COMBAT_OVER: 'Der Kampf ist vorbei.',
  NO_SUCH_TOWER: 'Diesen Turm gibt es nicht.',
  CARD_NOT_IN_HAND: 'Diese Karte liegt nicht auf der Hand.',
  NOT_ENOUGH_MOMENTUM: 'Nicht genug Tatendrang.',
  NO_CARDS_CHOSEN: 'Keine Karte gewählt.',
};

/**
 * The sentence the player sees.
 *
 * Where a shortfall is known, it is named: "Dafür fehlen 3 Tatendrang." tells
 * you what to do about it; "Nicht genug Tatendrang." only tells you that you
 * cannot. The engine supplies the number and stays out of the wording.
 */
export function rejectionMessage(failure: Pick<CombatFailure, 'reason' | 'shortfall'>): string {
  if (failure.reason === 'NOT_ENOUGH_MOMENTUM'
    && failure.shortfall !== undefined && failure.shortfall > 0) {
    return `Dafür fehlen ${failure.shortfall} Tatendrang.`;
  }
  return GENERIC[failure.reason];
}

/** The plain wording, without a shortfall. Exported for tests and for tooltips. */
export const REJECTION_MESSAGES = GENERIC;
