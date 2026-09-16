import { describe, expect, it } from 'vitest';
import { createUnit } from '@/content/units/pool';
import type { Tower } from '@/core/types';
import {
  CARD_HEIGHT, CARD_WIDTH, MIN_BATTLEFIELD_SHARE, handLayout, handOrder,
  hudLayout, momentumMarks, sortTransition,
} from '@/rendering/hud/layout';
import {
  NO_DRAG, SNAP_RADIUS, dragAt, dropGhost, dropTargets, targetAt,
} from '@/rendering/hud/dropTargets';
import { DEFAULT_CAMERA } from '@/rendering/WorldTransform';

const VIEWPORTS = [
  { width: 960, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 800, height: 600 },
];

describe('the castle is the main character', () => {
  /** Not a slogan. A number, asserted at every window size. */
  it('gives the battlefield the majority of the screen, at every size', () => {
    for (const viewport of VIEWPORTS) {
      const layout = hudLayout(viewport);
      expect(layout.battlefieldShare, `${viewport.width}×${viewport.height}`)
        .toBeGreaterThanOrEqual(MIN_BATTLEFIELD_SHARE);
    }
  });

  it('never lets a region hang off the edge', () => {
    for (const viewport of VIEWPORTS) {
      const layout = hudLayout(viewport);
      for (const [name, region] of Object.entries(layout)) {
        if (typeof region === 'number') continue;
        expect(region.x, `${name}.x`).toBeGreaterThanOrEqual(0);
        expect(region.x + region.width, `${name} right`)
          .toBeLessThanOrEqual(viewport.width);
        expect(region.y + region.height, `${name} bottom`)
          .toBeLessThanOrEqual(viewport.height + 1);
      }
    }
  });

  it('puts the two facts that must never need a click at the top', () => {
    const layout = hudLayout({ width: 960, height: 768 });
    expect(layout.round.y).toBe(0);
    expect(layout.enemy.y).toBe(0);
    expect(layout.enemy.width).toBeGreaterThan(layout.round.width);
  });

  it('puts momentum beside the hand, because it is what the hand costs', () => {
    const layout = hudLayout({ width: 960, height: 768 });
    expect(layout.momentum.x).toBeLessThan(layout.hand.x);
    expect(Math.abs(layout.momentum.y - layout.hand.y)).toBeLessThan(40);
  });
});

describe('Tatendrang is five decisions, not a quantity of stuff', () => {
  const region = hudLayout({ width: 960, height: 768 }).momentum;

  it('is five discrete marks', () => {
    expect(momentumMarks(5, 5, region)).toHaveLength(5);
    expect(momentumMarks(2, 5, region).filter(m => m.state === 'held')).toHaveLength(2);
    expect(momentumMarks(2, 5, region).filter(m => m.state === 'spent')).toHaveLength(3);
  });

  it('shows the price before it is paid', () => {
    const marks = momentumMarks(4, 5, region, 2);
    expect(marks.filter(m => m.state === 'held')).toHaveLength(2);
    expect(marks.filter(m => m.state === 'spending')).toHaveLength(2);
    expect(marks.filter(m => m.state === 'spent')).toHaveLength(1);
  });

  it('fits inside the space it was given', () => {
    const marks = momentumMarks(5, 5, region);
    const last = marks[marks.length - 1]!;
    expect(last.x + last.size).toBeLessThanOrEqual(region.x + region.width);
  });
});

describe('the hand never scrolls', () => {
  const region = hudLayout({ width: 960, height: 768 }).hand;

  it('fits seven cards inside its region', () => {
    const slots = handLayout(7, region);
    expect(slots).toHaveLength(7);
    const last = slots[slots.length - 1]!;
    expect(slots[0]!.x).toBeGreaterThanOrEqual(region.x - 1);
    expect(last.x + last.width).toBeLessThanOrEqual(region.x + region.width + 1);
  });

  it('fits an absurd hand too, by fanning harder', () => {
    for (const count of [7, 10, 16, 26]) {
      const slots = handLayout(count, region);
      const last = slots[slots.length - 1]!;
      expect(last.x + last.width, `${count} cards`)
        .toBeLessThanOrEqual(region.x + region.width + 1);
    }
  });

  it('fits in a narrow window as well as a wide one', () => {
    for (const viewport of VIEWPORTS) {
      const hand = hudLayout(viewport).hand;
      const slots = handLayout(7, hand);
      const last = slots[slots.length - 1]!;
      expect(last.x + last.width, `${viewport.width}`)
        .toBeLessThanOrEqual(hand.x + hand.width + 1);
    }
  });

  it('never overlaps a card by more than the card is wide', () => {
    const slots = handLayout(7, region);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.x).toBeGreaterThan(slots[i - 1]!.x);
    }
    expect(slots[0]!.width).toBeLessThanOrEqual(CARD_WIDTH);
    expect(slots[0]!.height).toBe(CARD_HEIGHT);
  });

  it('lifts the card under the cursor above the rest', () => {
    const slots = handLayout(7, region, [], 3);
    const lifted = slots.find(s => s.card === 3)!;
    expect(lifted.y).toBeLessThan(slots[0]!.y);
    expect(lifted.z).toBeGreaterThan(Math.max(...slots.filter(s => s.card !== 3).map(s => s.z)));
  });

  it('shows nothing rather than crashing on an empty hand', () => {
    expect(handLayout(0, region)).toEqual([]);
  });
});

describe('sorting is a view, never a move', () => {
  const cards = [
    { rank: 3, branch: 'gunner' },
    { rank: 11, branch: 'bow' },
    { rank: 7, branch: 'crossbow' },
    { rank: 11, branch: 'artillery' },
  ];

  /**
   * THE RULE THAT MATTERS. The draw pile, the discard and the hand have a
   * defined order the seeded generator depends on. A sort button that
   * reordered the array would change what the next shuffle produces — a
   * display preference silently altering the run.
   */
  it('never touches the array it was given', () => {
    const snapshot = JSON.stringify(cards);
    handOrder(cards, 'rank');
    handOrder(cards, 'branch');
    expect(JSON.stringify(cards)).toBe(snapshot);
  });

  it('returns a permutation of positions, losing and inventing nothing', () => {
    for (const sort of ['drawn', 'rank', 'branch'] as const) {
      const order = handOrder(cards, sort);
      expect([...order].sort((a, b) => a - b), sort).toEqual([0, 1, 2, 3]);
    }
  });

  it('sorts by rank, highest first', () => {
    expect(handOrder(cards, 'rank').map(i => cards[i]!.rank)).toEqual([11, 11, 7, 3]);
  });

  it('is stable, so equal cards do not shuffle under the player', () => {
    // Two elevens: the one drawn first stays first.
    expect(handOrder(cards, 'rank').slice(0, 2)).toEqual([1, 3]);
  });

  it('leaves the drawn order alone when that is what was asked for', () => {
    expect(handOrder(cards, 'drawn')).toEqual([0, 1, 2, 3]);
  });

  /** Cards that teleport between sorts destroy the thing sorting is for. */
  it('reports where every card has to travel, so it can be animated', () => {
    const region = hudLayout({ width: 960, height: 768 }).hand;
    const before = handLayout(4, region, handOrder(cards, 'drawn'));
    const after = handLayout(4, region, handOrder(cards, 'rank'));
    const moves = sortTransition(before, after);
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      expect(move.distance).toBe(Math.abs(move.toX - move.fromX));
    }
  });
});

describe('putting a card on a tower', () => {
  const towers: Tower[] = [
    { number: 1, type: 'archerTower', unit: null },
    { number: 2, type: 'ballistaTower', unit: createUnit('crossbow-9')! },
    { number: 3, type: 'watchtower', unit: null },
    { number: 4, type: 'cannonTower', unit: null },
    { number: 5, type: 'powderTower', unit: null },
  ];
  const targets = dropTargets(towers, DEFAULT_CAMERA);

  /** The player is aiming at where the soldier will STAND. */
  it('targets the platform, not the ground beside it', () => {
    for (let i = 0; i < 5; i++) {
      expect(targets[i]!.world.height, `tower ${i}`).toBeGreaterThan(60);
    }
  });

  it('hits dead centre', () => {
    for (const target of targets) {
      expect(targetAt(target.screen, targets)!.tower).toBe(target.tower);
    }
  });

  /** Generous, because the five targets are far apart and aiming is not fun. */
  it('still hits from outside the platform', () => {
    const target = targets[2]!;
    const near = { x: target.screen.x + SNAP_RADIUS * 0.6, y: target.screen.y };
    expect(targetAt(near, targets)!.tower).toBe(2);
  });

  it('refuses a point that is genuinely nowhere near', () => {
    expect(targetAt({ x: 10, y: 700 }, targets)).toBeNull();
  });

  it('never claims two towers for one point', () => {
    // Walk the wall and confirm no point is ambiguous.
    for (let y = 100; y < 700; y += 3) {
      const hit = targetAt({ x: targets[0]!.screen.x, y }, targets);
      if (!hit) continue;
      const others = targets.filter(t => t.tower !== hit.tower)
        .filter(t => Math.abs(t.screen.y - y) < 4
          && Math.abs(t.screen.x - targets[0]!.screen.x) < 4);
      expect(others, `y=${y}`).toEqual([]);
    }
  });

  it('knows which platform is already occupied', () => {
    expect(targets[1]!.occupied).toBe(true);
    expect(targets[0]!.occupied).toBe(false);
  });
});

describe('the answer arrives before the drop, not after', () => {
  const towers: Tower[] = [
    { number: 1, type: 'archerTower', unit: null },
    { number: 2, type: 'ballistaTower', unit: createUnit('crossbow-9')! },
    { number: 3, type: 'watchtower', unit: null },
    { number: 4, type: 'cannonTower', unit: null },
    { number: 5, type: 'powderTower', unit: null },
  ];
  const targets = dropTargets(towers, DEFAULT_CAMERA);
  const unit = createUnit('bow-11')!;

  it('says nothing is being dragged when nothing is', () => {
    expect(NO_DRAG.phase).toBe('idle');
    expect(dropGhost(NO_DRAG, unit, towers)).toBeNull();
  });

  it('lifts, then settles over a target', () => {
    expect(dragAt({ card: 0, at: { x: 20, y: 700 }, targets, cost: 1, momentum: 5 }).phase)
      .toBe('lifted');
    expect(dragAt({ card: 0, at: targets[0]!.screen, targets, cost: 1, momentum: 5 }).phase)
      .toBe('over');
  });

  it('refuses in advance when the player cannot afford it', () => {
    const drag = dragAt({ card: 0, at: targets[0]!.screen, targets, cost: 2, momentum: 1 });
    expect(drag.phase).toBe('refused');
    expect(drag.affordable).toBe(false);
    expect(drag.cost).toBe(2);
  });

  it('stands the real silhouette in the real place', () => {
    const drag = dragAt({ card: 0, at: targets[3]!.screen, targets, cost: 1, momentum: 5 });
    const ghost = dropGhost(drag, unit, towers)!;
    expect(ghost.world).toEqual(targets[3]!.world);
    expect(ghost.sprite).toContain(unit.branch);
    expect(ghost.opacity).toBeGreaterThan(0.4);
    expect(ghost.displaces).toBeNull();
  });

  it('names the unit that would be pushed off the wall', () => {
    const drag = dragAt({ card: 0, at: targets[1]!.screen, targets, cost: 1, momentum: 5 });
    expect(dropGhost(drag, unit, towers)!.displaces!.id).toBe('crossbow-9');
  });

  it('dims the ghost when the drop would be refused', () => {
    const ok = dragAt({ card: 0, at: targets[0]!.screen, targets, cost: 1, momentum: 5 });
    const no = dragAt({ card: 0, at: targets[0]!.screen, targets, cost: 3, momentum: 1 });
    expect(dropGhost(no, unit, towers)!.opacity)
      .toBeLessThan(dropGhost(ok, unit, towers)!.opacity);
  });
});
