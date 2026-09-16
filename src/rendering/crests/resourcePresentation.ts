import { RESOURCE_GLYPHS, RESOURCE_NAMES } from '@/content/crests/legacyResources';
import { RESOURCE_KINDS, type ResourceKind, type Resources } from '@/crests/types';
import { rowUses, type ResourceUse } from './crestProbe';

/**
 * SUPPLIES, SHOWN IN CONTEXT.
 *
 * Supplies exist only because crests create them: no crest, no powder. It
 * follows that showing a powder counter to a player whose rack has nothing to
 * do with powder is worse than showing nothing — it is a number that looks
 * like progress and is not.
 *
 * So the display is contextual in three steps:
 *
 *  · A supply nobody on the rack touches is not shown at all.
 *  · A supply something MAKES is shown, with what makes it.
 *  · A supply something makes and NOTHING uses is shown with a warning, in
 *    those words, because that is a broken machine and the player deserves to
 *    be told rather than left to wonder why their pile never does anything.
 *
 * The brief names the warning outright, and it is one of the sharpest things
 * in the whole specification: two crests that both produce powder and none
 * that spends it is the commonest dead engine in the game.
 */

export type SupplyState =
  /** Made and used. The machine works. */
  | 'flowing'
  /** Made, and nothing on the rack uses it. The warning case. */
  | 'dead'
  /** Used but not made. The rack will run dry. */
  | 'starved'
  /** On the shelf from an earlier round, with nothing touching it now. */
  | 'dormant';

export interface SupplyDisplay {
  readonly kind: ResourceKind;
  /** German, shown to the player. */
  readonly displayName: string;
  readonly glyph: string;
  readonly amount: number;
  readonly state: SupplyState;
  /** German. The one line the player reads when something is wrong. */
  readonly note: string | null;
  /** Emphasis, 0..1 — how loudly the interface should point at this. */
  readonly urgency: number;
}

/** The exact wording the brief asks for. */
export const NOBODY_USES_POWDER = '⚠ Kein aktives Wappen nutzt Pulver.';

const noteFor = (kind: ResourceKind, state: SupplyState): string | null => {
  const name = RESOURCE_NAMES[kind];
  switch (state) {
    case 'dead':
      return kind === 'powder'
        ? NOBODY_USES_POWDER
        : `⚠ Kein aktives Wappen nutzt ${name}.`;
    case 'starved':
      return `Kein aktives Wappen erzeugt ${name}.`;
    case 'dormant':
      return null;
    case 'flowing':
      return null;
  }
};

/**
 * What to show, for one rack and one shelf.
 *
 * Kinds nobody produces, consumes, reads or holds are absent from the result
 * entirely — not present-and-zero. A zero that never moves is clutter, and the
 * rack is already the densest thing on the screen.
 */
export function presentSupplies(
  resources: Resources,
  use: ResourceUse,
): readonly SupplyDisplay[] {
  const out: SupplyDisplay[] = [];

  for (const kind of RESOURCE_KINDS) {
    const amount = resources[kind] ?? 0;
    const produced = use.produces.includes(kind);
    const used = rowUses(use, kind);
    if (!produced && !used && amount === 0) continue;

    const state: SupplyState =
      produced && used ? 'flowing'
        : produced ? 'dead'
          : used ? 'starved'
            : 'dormant';

    out.push({
      kind,
      displayName: RESOURCE_NAMES[kind],
      glyph: RESOURCE_GLYPHS[kind],
      amount,
      state,
      note: noteFor(kind, state),
      /*
       * Urgency rises with the size of the pile that is going nowhere. One
       * stray powder is a curiosity; thirty is the player's whole round being
       * wasted, and the interface should say so more loudly.
       */
      urgency: state === 'dead' ? Math.min(1, 0.4 + amount / 20)
        : state === 'starved' ? 0.5
          : 0,
    });
  }

  return out;
}

/** Everything currently wrong with the rack, in German, for the workbench. */
export const supplyWarnings = (displays: readonly SupplyDisplay[]): readonly string[] =>
  displays.map(d => d.note).filter((n): n is string => Boolean(n));
