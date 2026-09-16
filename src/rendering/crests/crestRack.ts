import type { CrestRegistry, CrestSession } from '@/crests/CrestPipeline';
import type { CrestId, CrestRow } from '@/crests/types';

/**
 * THE RACK: five slots, and the fact that their ORDER is the rule.
 *
 * Everything about this layout exists to say one thing before the player has
 * read any text: these five are not a collection, they are a SEQUENCE. Slot 1
 * changes the situation, slot 2 receives what slot 1 left behind, and a crest
 * that doubles the slot before it is a different crest in position 4 than in
 * position 2.
 *
 * So the rack has direction — the slots are joined by flow marks that run one
 * way — and an empty slot is drawn as an empty SOCKET in the sequence rather
 * than as absence. A rack that looked like five independent badges would teach
 * the player the opposite of the game's central idea, and no amount of
 * tooltip would undo it.
 */

export interface RackSlotView {
  readonly index: number;
  /** Null for an empty socket. */
  readonly crest: {
    readonly id: CrestId;
    readonly displayName: string;
    readonly glyph: string;
    readonly tincture: string;
    readonly rarity: string;
    /** German, what it does. */
    readonly text: string;
    /** German, what it plays well with. */
    readonly hint: string;
  } | null;
  /**
   * A commander has closed this slot. It stays VISIBLE and in place — that is
   * the whole attack: the player's machine is still there and one gear of it
   * has stopped, which is far worse than losing a crest outright.
   */
  readonly sealed: boolean;
  /** How often this slot has ignited in the whole combat. */
  readonly tally: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** The slot the situation flows on to, or null at the end of the row. */
  readonly flowsTo: number | null;
}

export interface RackLayout {
  readonly slots: readonly RackSlotView[];
  /** The flow marks between the slots, as positions. */
  readonly flows: readonly { readonly from: number; readonly to: number;
    readonly x: number; readonly y: number }[];
  readonly width: number;
  readonly height: number;
  /** German, over the rack. */
  readonly caption: string;
}

export interface RackGeometry {
  readonly slotWidth: number;
  readonly slotHeight: number;
  /** Space between slots. The flow mark lives in it. */
  readonly gap: number;
  readonly originX: number;
  readonly originY: number;
}

export const DEFAULT_RACK_GEOMETRY: RackGeometry = {
  slotWidth: 46, slotHeight: 54, gap: 16, originX: 0, originY: 0,
};

export function crestRackLayout(
  row: CrestRow,
  registry: CrestRegistry,
  session: Pick<CrestSession, 'tally'> | null = null,
  geometry: RackGeometry = DEFAULT_RACK_GEOMETRY,
): RackLayout {
  const { slotWidth, slotHeight, gap, originX, originY } = geometry;
  const slots: RackSlotView[] = [];
  const flows: RackLayout['flows'] = [];

  /*
   * Exactly five, always. A row that renders three slots because three are
   * filled would move the fourth crest's box the moment the second is removed,
   * and the player's spatial memory of their own machine is worth more than
   * the horizontal space.
   */
  const count = 5;
  for (let index = 0; index < count; index++) {
    const id = row.slots[index] ?? null;
    const definition = id ? registry.crest(id) : undefined;
    slots.push({
      index,
      crest: definition ? {
        id: definition.id,
        displayName: definition.displayName,
        glyph: definition.glyph,
        tincture: definition.tincture,
        rarity: definition.rarity,
        text: definition.text,
        hint: definition.hint,
      } : null,
      sealed: row.sealed.includes(index),
      tally: session?.tally[index] ?? 0,
      x: originX + index * (slotWidth + gap),
      y: originY,
      width: slotWidth,
      height: slotHeight,
      flowsTo: index < count - 1 ? index + 1 : null,
    });

    if (index < count - 1) {
      (flows as { from: number; to: number; x: number; y: number }[]).push({
        from: index, to: index + 1,
        x: originX + index * (slotWidth + gap) + slotWidth + gap / 2,
        y: originY + slotHeight / 2,
      });
    }
  }

  return {
    slots,
    flows,
    width: count * slotWidth + (count - 1) * gap,
    height: slotHeight,
    caption: 'Die Reihenfolge ist die Regel',
  };
}

/** Where a slot's motif is centred, for the trigger presentation. */
export function slotCentre(layout: RackLayout, index: number): { x: number; y: number } {
  const slot = layout.slots[index];
  if (!slot) return { x: 0, y: 0 };
  return { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
}
