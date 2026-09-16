/**
 * Every balance number the combat rules depend on, in one place.
 *
 * This is the direct successor of `KERN` in the legacy tree. The rule it
 * carries over is the important part: if a number decides how hard the game
 * is, it lives here and nowhere else. A number that appears twice is a number
 * where one of the two copies is already out of date.
 */
export const RULES = {
  /** Emplacements the castle has. */
  towers: 5,
  /** Rounds a combat lasts. Not negotiable, not extendable by stalling. */
  rounds: 5,
  /** Momentum per round, fully refilled, never carried over. */
  momentum: 5,
  /** Cards on hand at the start of a round. */
  handSize: 7,

  costs: {
    /** Place a unit on an empty tower. */
    deploy: 1,
    /** Place a unit on an occupied tower. */
    replace: 1,
    /** Swap one card on hand for a fresh one. */
    exchange: 1,
    /**
     * Move a crest during combat. Outside combat reordering is free, because
     * there it is planning. Inside combat it has to cost something, or every
     * commander rule that seals or swaps a slot would be undone by one drag.
     */
    reorder: 1,
  },

  /**
   * What a tower type does for a unit of its matching branch. With the full
   * 52-card deck a matching unit is reliably available, which is what makes
   * tower upgrades the slow progression axis rather than a side note.
   * Five matching towers are 1.4^5 — about five times the force.
   */
  towerFactor: 1.4,

  /**
   * The base volley. Every occupied emplacement fires once even with no
   * formation at all; everything beyond that comes from formations.
   */
  baseVolley: 1,
} as const;

/** The ranks a Royal Guard is made of — nine through king. */
export const GUARD_RANKS: readonly number[] = [9, 10, 11, 12, 13];
