import type { CombatOutcome, Settlement, Unit } from './types';

/**
 * WHAT HAPPENED, GROUPED FOR TELLING.
 *
 * An act is one thing a player watches: a card arriving and taking its free
 * shot, a round's volley, a hand being exchanged. It is derived from the
 * events the rules report and it carries no German — the wording lives in
 * `content/combat/log.ts`.
 *
 * It sits in `core/` next to `CombatEvent` for the same reason that does: it
 * is VOCABULARY, shared between the side that produces it and the sides that
 * read it. The architecture guard is what settled that — the combat log, which
 * is content and therefore a rule layer, wanted to describe an act, and
 * reaching into `ui/` for the word would have made the rules depend on the
 * screen.
 *
 * Nothing here knows how an act is DRAWN. `ui/acts.ts` builds them from
 * events; the presentation decides what to do with them.
 */

export type Act =
  /** A card went on a tower and the garrison took its free shot. */
  | {
    readonly kind: 'deployment';
    readonly tower: number;
    readonly unit: Unit;
    /** The unit it pushed off the wall, if any. */
    readonly replaced: Unit | null;
    readonly force: number;
    readonly damage: number;
    readonly overkill: number;
  }
  /** The round's volley: everything the wall fires at once. */
  | {
    readonly kind: 'volley';
    readonly settlement: Settlement;
    readonly damage: number;
    readonly overkill: number;
  }
  | { readonly kind: 'exchanged'; readonly removed: number; readonly drawn: number;
    readonly cost: number }
  | { readonly kind: 'reshuffled'; readonly count: number }
  | { readonly kind: 'roundEnded'; readonly round: number; readonly force: number }
  | { readonly kind: 'roundBegan'; readonly round: number }
  | { readonly kind: 'ended'; readonly outcome: CombatOutcome };

/** How long the screen should hold an act that has no animation of its own. */
export const NOTE_SECONDS = 0.9;

/** The acts that have a presentation of their own. */
export type Spectacle = Extract<Act, { kind: 'deployment' | 'volley' }>;

/**
 * Whether an act is something to WATCH, or only something to read.
 *
 * A type guard rather than a predicate: the screen asks this and then
 * immediately wants the damage, and a boolean would leave it casting.
 */
export const isSpectacle = (act: Act): act is Spectacle =>
  act.kind === 'deployment' || act.kind === 'volley';
