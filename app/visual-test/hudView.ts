import type { CombatState, Unit } from '@/core/types';
import { BRANCHES } from '@/content/units/branches';
import { GAME_REGISTRY } from '@/content/crests/registry';
import { crestRackLayout } from '@/rendering/crests/crestRack';
import { probeRow } from '@/rendering/crests/crestProbe';
import { presentSupplies, supplyWarnings } from '@/rendering/crests/resourcePresentation';
import {
  handLayout, handOrder, hudLayout, momentumMarks,
  type HandSort, type HudLayout, type Region,
} from '@/rendering/hud/layout';

/**
 * The combat interface, BATTLEFIELD-FIRST, drawn from the layout data.
 *
 * Every position in here comes out of `@/rendering/hud/layout`, which is plain
 * arithmetic asserted in Node. This file only turns those rectangles into DOM.
 * That split is what lets "the hand does not overflow" and "the battlefield
 * keeps the majority of the screen" be tests rather than opinions — and it is
 * why this file can move into `src/ui/` at Phase 7 without anything being
 * re-derived.
 *
 * The HUD is drawn OVER the canvas, at the same logical size, deliberately.
 * Panels beside the world would shrink the world; a thin frame on top of it
 * does not.
 */

export interface HudState {
  readonly combat: CombatState;
  readonly hand: readonly Unit[];
  readonly sort: HandSort;
  readonly hovered: number | null;
  /** German, one line: what just happened. */
  readonly ticker: string;
}

const el = (tag: string, className?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

const place = (node: HTMLElement, region: Region): HTMLElement => {
  node.style.left = `${region.x}px`;
  node.style.top = `${region.y}px`;
  node.style.width = `${region.width}px`;
  node.style.height = `${region.height}px`;
  return node;
};

export function renderHud(
  host: HTMLElement,
  state: HudState,
  viewport: { width: number; height: number },
): HudLayout {
  const layout = hudLayout(viewport);
  host.replaceChildren();

  host.append(
    roundView(layout, state),
    enemyView(layout, state),
    momentumView(layout, state),
    handView(layout, state),
    ...rackView(layout, state),
    tickerView(layout, state),
  );
  return layout;
}

function roundView(layout: HudLayout, state: HudState): HTMLElement {
  const node = place(el('div', 'region frame'), layout.round);
  node.style.display = 'grid';
  node.style.placeItems = 'center';
  node.style.letterSpacing = '.1em';
  node.textContent = `RUNDE ${state.combat.round} / ${state.combat.maxRounds}`;
  return node;
}

/**
 * The enemy as a FORCE the castle is destroying, not as a number.
 *
 * The bar is what is LEFT, and it is the widest thing in the top bar because
 * it is what the whole screen is aimed at.
 */
function enemyView(layout: HudLayout, state: HudState): HTMLElement {
  const node = place(el('div', 'region frame'), layout.enemy);
  node.style.position = 'absolute';
  node.style.overflow = 'hidden';

  const share = state.combat.enemy.maxHp
    ? state.combat.enemy.hp / state.combat.enemy.maxHp : 0;
  const fill = el('div');
  fill.style.cssText = `position:absolute;inset:0;width:${Math.max(0, share) * 100}%;`
    + 'background:linear-gradient(90deg,#4a1a14,#a8261f);transition:width .28s ease;';
  const label = el('div');
  label.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;'
    + 'letter-spacing:.08em;color:#e3d2a4;';
  label.textContent = `${state.combat.enemy.displayName}   `
    + `${Math.max(0, Math.round(state.combat.enemy.hp)).toLocaleString('de-DE')}`;
  node.append(fill, label);
  return node;
}

function momentumView(layout: HudLayout, state: HudState): HTMLElement {
  const node = place(el('div', 'region'), {
    ...layout.momentum, x: 0, y: 0,
  });
  node.style.left = '0';
  node.style.top = '0';
  node.style.width = '100%';
  node.style.height = '100%';

  for (const mark of momentumMarks(
    state.combat.momentum, state.combat.maxMomentum, layout.momentum)) {
    const box = el('div', `mark ${mark.state}`);
    box.style.left = `${mark.x}px`;
    box.style.top = `${mark.y}px`;
    box.style.width = `${mark.size}px`;
    box.style.height = `${mark.size}px`;
    node.append(box);
  }
  return node;
}

/**
 * Seven cards, fanned, never scrolled.
 *
 * The order shown is `handOrder`'s permutation. The hand array itself is never
 * touched — a sort button that reordered it would change what the next shuffle
 * produces, which is a display preference quietly altering the run.
 */
function handView(layout: HudLayout, state: HudState): HTMLElement {
  const node = el('div', 'region');
  node.style.cssText = 'position:absolute;inset:0;';

  const order = handOrder(state.hand, state.sort);
  for (const slot of handLayout(state.hand.length, layout.hand, order, state.hovered)) {
    const unit = state.hand[slot.card];
    if (!unit) continue;
    const card = el('div', 'card');
    card.style.left = `${slot.x}px`;
    card.style.top = `${slot.y}px`;
    card.style.width = `${slot.width}px`;
    card.style.height = `${slot.height}px`;
    card.style.zIndex = String(slot.z);

    const branch = BRANCHES[unit.branch];
    card.style.borderColor = branch.colour;

    const rank = el('div', 'rank');
    rank.textContent = String(unit.rank);
    const name = el('div');
    name.textContent = unit.displayName;
    name.style.cssText = 'font-size:9.5px;line-height:1.15;color:#a8977c;';
    const family = el('div', 'branch');
    family.textContent = branch.shortName;
    card.append(rank, name, family);
    node.append(card);
  }
  return node;
}

/** The rack: five slots, joined one way, because the order is the rule. */
function rackView(layout: HudLayout, state: HudState): HTMLElement[] {
  const rack = crestRackLayout(state.combat.crests.row, GAME_REGISTRY, state.combat.crests, {
    slotWidth: Math.floor((layout.rack.width - 4 * 14) / 5),
    slotHeight: layout.rack.height,
    gap: 14,
    originX: layout.rack.x,
    originY: layout.rack.y,
  });

  const nodes: HTMLElement[] = [];
  for (const slot of rack.slots) {
    const box = el('div', `slot${slot.crest ? '' : ' empty'}${slot.sealed ? ' sealed' : ''}`);
    box.style.left = `${slot.x}px`;
    box.style.top = `${slot.y}px`;
    box.style.width = `${slot.width}px`;
    box.style.height = `${slot.height}px`;
    if (slot.crest) {
      box.style.borderColor = slot.crest.tincture;
      const glyph = el('div', 'glyph');
      glyph.textContent = slot.crest.glyph;
      const tally = el('div', 'tally');
      tally.textContent = slot.tally ? `×${slot.tally}` : '';
      const inner = el('div');
      inner.style.cssText = 'display:grid;place-items:center;';
      inner.append(glyph, tally);
      box.append(inner);
      box.title = `${slot.crest.displayName}\n${slot.crest.text}\n${slot.crest.hint}`;
    } else {
      box.textContent = String(slot.index + 1);
      box.style.color = '#3a2f24';
    }
    nodes.push(box);
  }

  for (const flow of rack.flows) {
    const arrow = el('div', 'flow');
    arrow.style.left = `${flow.x - 4}px`;
    arrow.style.top = `${flow.y - 8}px`;
    arrow.textContent = '›';
    nodes.push(arrow);
  }
  return nodes;
}

/**
 * One line, bottom left: what just happened — and, when the rack is a dead
 * machine, that it is one.
 */
function tickerView(layout: HudLayout, state: HudState): HTMLElement {
  const node = place(el('div', 'region'), layout.ticker);
  node.style.fontSize = '10px';
  node.style.lineHeight = '1.35';

  const use = probeRow(GAME_REGISTRY, state.combat.crests.row.slots,
    state.combat.crests.row.sealed);
  const warnings = supplyWarnings(presentSupplies(state.combat.crests.resources, use));

  const line = el('div');
  line.textContent = state.ticker;
  node.append(line);

  for (const supply of presentSupplies(state.combat.crests.resources, use)) {
    const row = el('div');
    row.textContent = `${supply.glyph} ${supply.amount} ${supply.displayName}`;
    row.style.color = supply.state === 'dead' ? '#e3b552' : '#6a5f4c';
    node.append(row);
  }
  for (const warning of warnings) {
    const row = el('div');
    row.textContent = warning;
    row.style.color = '#e3b552';
    node.append(row);
  }
  return node;
}
