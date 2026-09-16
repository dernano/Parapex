import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '@/content/formations/formations';
import { createUnit } from '@/content/units/pool';
import type { Tower, Unit } from '@/core/types';
import { buildTableau, cardsFromTowers, recogniseFormations } from '@/simulation/FormationEngine';
import {
  FORMATIONS_NOT_YET_PRESENTED, FORMATION_VISUALS, presentFormation,
  previewCaption, previewFormations,
} from '@/rendering/formations/formationPresentation';
import { towerGroundAnchor } from '@/rendering/SceneGraph';

const ANCHORS = [0, 1, 2, 3, 4].map(i => towerGroundAnchor(i, 'watchtower'));

const tower = (n: number, unit: Unit | null): Tower =>
  ({ number: n + 1, type: 'watchtower', unit });

/** Five towers, the first `filled` of them occupied by distinct bow units. */
function wall(ids: readonly (string | null)[]): Tower[] {
  return ids.map((id, i) => tower(i, id ? createUnit(id)! : null));
}

describe('one formation, built properly', () => {
  const full = wall(['bow-2', 'crossbow-4', 'artillery-6', 'gunner-8', 'bow-10']);
  const active = recogniseFormations(buildTableau(cardsFromTowers(full)))
    .find(f => f.id === 'closedFront')!;

  it('recognises the formation it is presenting', () => {
    expect(active).toBeDefined();
    expect(active.towers).toEqual([0, 1, 2, 3, 4]);
  });

  it('puts a standard over every tower it covers, and joins them', () => {
    const nodes = presentFormation(active, ANCHORS);
    expect(nodes.filter(n => n.kind === 'standard')).toHaveLength(5);
    // Four links turn five standards into one front.
    expect(nodes.filter(n => n.kind === 'connector')).toHaveLength(4);
    expect(nodes.filter(n => n.kind === 'caption')).toHaveLength(1);
  });

  /** No modal. The formation lives where the towers are. */
  it('stands the standards above the garrison, on the wall', () => {
    for (const node of presentFormation(active, ANCHORS)) {
      const anchor = ANCHORS.find(a => a.col === node.world.col && a.row === node.world.row);
      if (!anchor) continue;
      expect(node.world.height!).toBeGreaterThan(anchor.height!);
    }
  });

  it('says how much it is worth, in the caption, on the field', () => {
    const caption = presentFormation(active, ANCHORS).find(n => n.kind === 'caption')!;
    expect(caption.text).toContain('GESCHLOSSENE FRONT');
    expect(caption.text).toContain(`+${active.volleys}`);
  });

  it('rises from the middle outwards rather than snapping up together', () => {
    const early = presentFormation(active, ANCHORS, 0.08)
      .filter(n => n.kind === 'standard');
    const middle = early.find(n => n.id.endsWith(':2'))!;
    const edge = early.find(n => n.id.endsWith(':0'))!;
    expect(middle.raise).toBeGreaterThan(edge.raise);
  });

  it('is fully settled if you ask for the finished picture', () => {
    for (const node of presentFormation(active, ANCHORS)) {
      expect(node.raise, node.id).toBe(1);
    }
  });

  it('draws nothing for a formation nobody has designed a picture for', () => {
    const regiment = recogniseFormations(buildTableau(cardsFromTowers(
      wall(['bow-2', 'bow-4', 'bow-6', null, null]))))
      .find(f => f.id === 'regiment')!;
    expect(regiment).toBeDefined();
    expect(presentFormation(regiment, ANCHORS)).toEqual([]);
  });

  /**
   * The confession, DERIVED. Adding a formation to the content file puts it on
   * this list automatically, so nobody has to remember to own up.
   */
  it('names every formation that still has no picture', () => {
    expect(FORMATIONS_NOT_YET_PRESENTED).toHaveLength(FORMATIONS.length - 1);
    expect(FORMATIONS_NOT_YET_PRESENTED).not.toContain('closedFront');
    expect(Object.keys(FORMATION_VISUALS)).toEqual(['closedFront']);
    for (const id of FORMATIONS_NOT_YET_PRESENTED) {
      expect(FORMATIONS.some(f => f.id === id), id).toBe(true);
    }
  });
});

describe('the preview, while the card is still in the air', () => {
  it('sees the formation the drop would complete', () => {
    const almost = wall(['bow-2', 'crossbow-4', 'artillery-6', 'gunner-8', null]);
    const preview = previewFormations(almost, { unit: createUnit('bow-10')!, towerIndex: 4 });
    expect(preview.gained.map(f => f.id)).toContain('closedFront');
    expect(preview.volleysAfter).toBeGreaterThan(preview.volleysBefore);
  });

  /**
   * Formations work on SETS, not on adjacency, so a card dropped on the far
   * left completes a run that looks like it lives on the right. That is
   * exactly why guessing is not good enough.
   */
  it('sees a run completed from the wrong end of the wall', () => {
    const scattered = wall(['bow-9', 'bow-7', 'bow-6', 'bow-5', null]);
    const preview = previewFormations(scattered, { unit: createUnit('bow-8')!, towerIndex: 4 });
    expect(preview.gained.length).toBeGreaterThan(0);
    expect(preview.volleysAfter).toBeGreaterThan(preview.volleysBefore);
  });

  it('sees what the drop would COST as well as what it gains', () => {
    // Four of a rank is a Viererblock; replacing one of them loses it.
    const block = wall(['bow-5', 'crossbow-5', 'artillery-5', 'gunner-5', null]);
    const before = recogniseFormations(buildTableau(cardsFromTowers(block)));
    expect(before.map(f => f.id)).toContain('fourBlock');

    const preview = previewFormations(block, { unit: createUnit('bow-2')!, towerIndex: 0 });
    expect(preview.lost.map(f => f.id)).toContain('fourBlock');
  });

  it('never touches the row it is asked about', () => {
    const before = wall(['bow-2', 'crossbow-4', 'artillery-6', 'gunner-8', null]);
    const snapshot = JSON.stringify(before);
    previewFormations(before, { unit: createUnit('bow-10')!, towerIndex: 4 });
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(before[4]!.unit).toBeNull();
  });

  it('answers in one line the player can read while dragging', () => {
    const almost = wall(['bow-2', 'crossbow-4', 'artillery-6', 'gunner-8', null]);
    const caption = previewCaption(
      previewFormations(almost, { unit: createUnit('bow-10')!, towerIndex: 4 }));
    expect(caption).toContain('+ Geschlossene Front');
    expect(caption).toMatch(/\+\d+ Salven/);
  });

  it('says nothing when the drop changes nothing', () => {
    const one = wall(['bow-2', null, null, null, null]);
    const preview = previewFormations(one, { unit: createUnit('bow-3')!, towerIndex: 0 });
    expect(previewCaption(preview)).toBe('');
  });
});
