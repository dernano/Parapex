/**
 * THE INTERFACE, BUILT BATTLEFIELD-FIRST.
 *
 * The castle is the main character. That is not a slogan, it is a constraint
 * with a number attached: the battlefield gets the majority of the screen and
 * everything else is fitted around what is left, rather than the reverse. A
 * test asserts the share, so the day somebody adds a panel the build tells
 * them what it cost.
 *
 * The layout is computed as DATA, in logical pixels, before any DOM exists.
 * That is what lets the regions be asserted in Node — "the hand does not
 * overflow", "the battlefield is at least this large" — instead of being
 * checked by eye at one window size and broken at every other.
 */

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HudLayout {
  /** The world. Everything else is a border around it. */
  readonly battlefield: Region;
  /** Round, and how many are left. */
  readonly round: Region;
  /** The enemy force, as a force and not as a number. */
  readonly enemy: Region;
  /** Five compact markers, never a mana bar. */
  readonly momentum: Region;
  /** Seven cards, fanned, never scrolled. */
  readonly hand: Region;
  /** The five crest slots. */
  readonly rack: Region;
  /** What just happened, in one line. */
  readonly ticker: Region;
  /** How much of the viewport the world actually gets. */
  readonly battlefieldShare: number;
}

/**
 * The floor. Below this the castle has stopped being the main character and
 * the game has become a card manager with a diorama attached.
 */
export const MIN_BATTLEFIELD_SHARE = 0.62;

const TOP_BAR = 36;
const BOTTOM_BAR = 118;
const PAD = 8;

export function hudLayout(viewport: Viewport): HudLayout {
  const { width, height } = viewport;
  const top = Math.min(TOP_BAR, Math.round(height * 0.06));
  const bottom = Math.min(BOTTOM_BAR, Math.round(height * 0.2));

  const battlefield: Region = {
    x: 0, y: top, width, height: Math.max(0, height - top - bottom),
  };

  /*
   * The top bar carries the two facts that must never require a click: which
   * round it is, and how much enemy is left. The enemy takes the middle and
   * most of the width, because it is the thing the whole screen is aimed at.
   */
  const roundWidth = Math.min(150, Math.round(width * 0.16));
  const round: Region = { x: PAD, y: 0, width: roundWidth, height: top };
  const enemy: Region = {
    x: roundWidth + PAD * 2, y: 0,
    width: Math.max(0, width - roundWidth - PAD * 3), height: top,
  };

  /*
   * The bottom carries the player's two machines: the hand they play from and
   * the rack they built. Momentum sits against the left edge of the hand,
   * because it is what the hand COSTS — putting it in a corner far away is how
   * a resource becomes something people forget they have.
   */
  const momentumWidth = 96;
  const rackWidth = Math.min(330, Math.round(width * 0.34));
  const handX = momentumWidth + PAD * 2;
  const handWidth = Math.max(0, width - momentumWidth - rackWidth - PAD * 4);

  const barY = top + battlefield.height;
  const momentum: Region = { x: PAD, y: barY + PAD, width: momentumWidth, height: 28 };
  const hand: Region = { x: handX, y: barY + PAD, width: handWidth, height: bottom - PAD * 2 };
  const rack: Region = {
    x: width - rackWidth - PAD, y: barY + PAD, width: rackWidth, height: 58,
  };
  const ticker: Region = {
    x: PAD, y: barY + PAD + 34, width: momentumWidth, height: bottom - PAD * 2 - 34,
  };

  return {
    battlefield, round, enemy, momentum, hand, rack, ticker,
    battlefieldShare: (battlefield.width * battlefield.height) / (width * height),
  };
}

/* ============================================================
 *  Tatendrang: five marks, not a bar
 * ============================================================
 *
 * A bar says "a quantity of stuff". Momentum is not a quantity of stuff, it is
 * FIVE ACTIONS, and every one of them is a decision the player is about to
 * make. Five discrete marks say that; a sliding bar actively hides it.
 */

export type MomentumMarkState = 'held' | 'spending' | 'spent';

export interface MomentumMark {
  readonly index: number;
  readonly state: MomentumMarkState;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export const MARK_SIZE = 12;
export const MARK_GAP = 5;

/**
 * `pending` is what an action about to be taken would cost. Those marks read
 * as SPENDING — dimmed but still present — so the player sees the price
 * before they pay it rather than after.
 */
export function momentumMarks(
  current: number,
  max: number,
  region: Region,
  pending = 0,
): readonly MomentumMark[] {
  const marks: MomentumMark[] = [];
  const total = Math.max(0, Math.round(max));
  for (let index = 0; index < total; index++) {
    const state: MomentumMarkState =
      index < current - pending ? 'held'
        : index < current ? 'spending'
          : 'spent';
    marks.push({
      index, state,
      x: region.x + index * (MARK_SIZE + MARK_GAP),
      y: region.y + Math.round((region.height - MARK_SIZE) / 2),
      size: MARK_SIZE,
    });
  }
  return marks;
}

/* ============================================================
 *  The hand
 * ============================================================ */

export const CARD_WIDTH = 74;
export const CARD_HEIGHT = 102;
/** How far a card lifts when it is the one under the cursor. */
export const CARD_LIFT = 14;

export interface CardSlot {
  /** Index into the hand array the CALLER owns. Never a reordering of it. */
  readonly card: number;
  /** Where it sits, left to right. */
  readonly position: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Later cards draw over earlier ones, so the fan overlaps correctly. */
  readonly z: number;
}

/**
 * Seven cards in the space there is, ALWAYS.
 *
 * The rule is absolute: no horizontal scrollbar, ever. A hand one has to
 * scroll is a hand one cannot compare, and comparing is the entire activity.
 * So when the cards do not fit side by side they FAN — each one overlapping
 * the last, the way one holds cards — and the maths guarantees the last
 * card's right edge lands inside the region.
 */
export function handLayout(
  count: number,
  region: Region,
  order: readonly number[] = [],
  hovered: number | null = null,
): readonly CardSlot[] {
  if (count <= 0) return [];
  const width = Math.min(CARD_WIDTH, region.width);
  const ideal = width + 10;
  const spacing = count > 1
    ? Math.min(ideal, (region.width - width) / (count - 1))
    : 0;
  const used = width + spacing * (count - 1);
  const left = region.x + Math.max(0, (region.width - used) / 2);
  const top = region.y + Math.max(0, region.height - CARD_HEIGHT);

  const slots: CardSlot[] = [];
  for (let position = 0; position < count; position++) {
    const card = order[position] ?? position;
    const lifted = hovered === card;
    slots.push({
      card, position,
      x: Math.round(left + position * spacing),
      y: Math.round(top - (lifted ? CARD_LIFT : 0)),
      width, height: CARD_HEIGHT,
      z: lifted ? count + 1 : position,
    });
  }
  return slots;
}

/**
 * How the hand is SHOWN, which is not how the deck is stored.
 *
 * This returns a permutation of indices and nothing else. The brief is
 * explicit and it matters more than it sounds: the draw pile, the discard and
 * the hand are game state with a defined order that the seeded generator
 * depends on. A sort button that reordered the array would change what the
 * next shuffle produces — a display preference silently altering the run.
 *
 * So sorting produces POSITIONS. The cards never move.
 */
export type HandSort = 'drawn' | 'rank' | 'branch';

export interface SortableCard {
  readonly rank: number;
  readonly branch: string;
}

const BRANCH_ORDER = ['bow', 'crossbow', 'artillery', 'gunner'];

export function handOrder(
  cards: readonly SortableCard[],
  sort: HandSort,
): readonly number[] {
  const indices = cards.map((_, i) => i);
  if (sort === 'drawn') return indices;
  if (sort === 'rank') {
    // Stable: equal ranks keep the order they were drawn in, so a sort never
    // shuffles cards the player had already located.
    return [...indices].sort((a, b) =>
      cards[b]!.rank - cards[a]!.rank || a - b);
  }
  return [...indices].sort((a, b) =>
    BRANCH_ORDER.indexOf(cards[a]!.branch) - BRANCH_ORDER.indexOf(cards[b]!.branch)
    || cards[b]!.rank - cards[a]!.rank
    || a - b);
}

/**
 * Where each card travels when the sort changes.
 *
 * Returned as pairs rather than applied, so the move can be ANIMATED. Cards
 * that teleport between sorts destroy the player's track of which card is
 * which, which is the one thing sorting was supposed to help with.
 */
export function sortTransition(
  from: readonly CardSlot[],
  to: readonly CardSlot[],
): readonly { readonly card: number; readonly fromX: number; readonly toX: number;
  readonly distance: number }[] {
  const byCard = new Map(from.map(slot => [slot.card, slot]));
  return to
    .map(slot => {
      const previous = byCard.get(slot.card);
      const fromX = previous ? previous.x : slot.x;
      return { card: slot.card, fromX, toX: slot.x, distance: Math.abs(slot.x - fromX) };
    })
    .filter(move => move.distance > 0);
}
