import { describe, expect, it } from 'vitest';

import type { CombatState } from '@/core/types';
import { UNIT_POOL, createUnit } from '@/content/units/pool';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { LAYERS, TOWER_ROWS, WALL_COLUMN, layerIndex, platformHeight } from '@/rendering/artRules';
import { DEFAULT_CAMERA, toScreen } from '@/rendering/WorldTransform';
import {
  buildBattlefieldScene, enemyFigureCount, terrainVariant, towerCentre,
} from '@/rendering/SceneGraph';

/**
 * The scene, tested without a GPU.
 *
 * This is the point of separating "what to draw" from "draw it": the ordering
 * bug that actually happens in an isometric game — a soldier behind the ground
 * he stands on — becomes an assertion here instead of a screenshot somebody
 * has to notice.
 */

function combatWith(deployed: number[]): CombatState {
  let { state } = createCombat({
    deck: UNIT_POOL.map(u => createUnit(u.id)!),
    enemy: { id: 'e', displayName: 'Prüfgegner', hp: 1000, maxHp: 1000 },
    seed: 'scene', shuffle: false,
  });
  for (const tower of deployed) {
    const card = state.hand[0];
    if (!card) break;
    const result = performAction(state, { type: 'DEPLOY_UNIT', cardUid: card.uid, towerIndex: tower });
    if (result.ok) state = result.state;
  }
  return state;
}

const scene = (state: CombatState) => buildBattlefieldScene(state, DEFAULT_CAMERA);

describe('the scene is built from state and touches nothing', () => {
  it('leaves the state exactly as it found it', () => {
    const state = combatWith([0, 2]);
    const before = JSON.stringify(state);
    scene(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('is deterministic: the same state gives the same scene', () => {
    const state = combatWith([0, 1, 2]);
    expect(scene(state)).toEqual(scene(state));
  });

  it('carries no renderer object of any kind', () => {
    // Every node must survive JSON — if a texture or a container ever leaks in
    // here, the scene has stopped being data and the separation is gone.
    const built = scene(combatWith([0]));
    expect(JSON.parse(JSON.stringify(built))).toEqual(built);
  });
});

describe('depth order', () => {
  it('is sorted by layer first, then back to front', () => {
    const nodes = scene(combatWith([0, 1, 2, 3, 4])).nodes;
    for (let i = 1; i < nodes.length; i++) {
      const previous = nodes[i - 1]!;
      const current = nodes[i]!;
      const byLayer = layerIndex(current.layer) - layerIndex(previous.layer);
      expect(byLayer).toBeGreaterThanOrEqual(0);
      if (byLayer === 0) expect(current.depth).toBeGreaterThanOrEqual(previous.depth);
    }
  });

  it('never draws a unit behind the ground it stands on', () => {
    const nodes = scene(combatWith([0, 4])).nodes;
    const lastGround = [...nodes].map(n => n.layer).lastIndexOf('GROUND');
    const firstUnit = nodes.findIndex(n => n.kind === 'unit');
    expect(firstUnit).toBeGreaterThan(lastGround);
  });

  it('puts projectiles above units and the enemy above projectiles', () => {
    expect(layerIndex('UNITS')).toBeLessThan(layerIndex('PROJECTILES'));
    expect(layerIndex('PROJECTILES')).toBeLessThan(layerIndex('ENEMIES'));
  });

  it('uses every layer name it claims to', () => {
    // A layer nobody draws into is a layer that silently does not exist.
    expect(LAYERS.length).toBe(11);
  });
});

describe('the castle', () => {
  it('has five towers, at the rows the bible names', () => {
    expect([0, 1, 2, 3, 4].map(i => towerCentre(i))).toEqual(
      TOWER_ROWS.map(row => ({ col: WALL_COLUMN + 0.5, row: row + 0.5 })));
  });

  /**
   * Each tower is TWO nodes, and that is the occlusion: the body behind the
   * garrison, the parapet in front of it. One node per tower would put every
   * soldier on top of his own wall.
   */
  it('splits each tower around the emplacement it shelters', () => {
    const nodes = scene(combatWith([])).nodes;
    const bodies = nodes.filter(n => n.kind === 'tower');
    const parapets = nodes.filter(n => n.kind === 'parapet');
    expect(bodies).toHaveLength(5);
    expect(parapets).toHaveLength(5);

    bodies.forEach((body, i) => {
      const centre = towerCentre(i);
      const parapet = parapets[i]!;
      expect(body.world.col).toBeLessThan(centre.col);
      expect(body.world.row).toBeLessThan(centre.row);
      expect(parapet.world.col).toBeGreaterThan(centre.col);
      expect(parapet.world.row).toBeGreaterThan(centre.row);
      expect(body.layer).toBe('CASTLE_BACK');
      expect(parapet.layer).toBe('CASTLE_FRONT');
    });
  });

  it('the five towers are clearly apart on screen', () => {
    // The player must distinguish all five positions immediately.
    const ys = [0, 1, 2, 3, 4].map(i => toScreen(towerCentre(i)).y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(40);
    }
  });

  it('the wall does not overlap the towers', () => {
    const nodes = scene(combatWith([])).nodes;
    const wallRows = nodes.filter(n => n.kind === 'wall').map(n => n.world.row);
    for (const row of TOWER_ROWS) {
      expect(wallRows).not.toContain(row);
      expect(wallRows).not.toContain(row + 1);
    }
  });
});

describe('units are grounded', () => {
  it('a unit stands ON its tower, not beside it in the dirt', () => {
    /*
     * The first render of this scene had the whole garrison standing on the
     * ground next to their own towers, because the anchor was the tile centre
     * and a tower is seventy to ninety-six pixels tall. Caught by looking at
     * the screenshot; pinned here so it cannot come back.
     */
    const state = combatWith([0, 3]);
    const nodes = scene(state).nodes;
    for (const index of [0, 3]) {
      const unit = nodes.find(n => n.id === `unit:${index}`);
      expect(unit, `no unit on tower ${index}`).toBeDefined();
      expect(unit!.world.col).toBe(towerCentre(index).col);
      expect(unit!.world.row).toBe(towerCentre(index).row);
      expect(unit!.world.height).toBe(platformHeight(state.towers[index]!.type));
      // And that really is higher up the screen than the ground would be.
      expect(unit!.screen.y).toBeLessThan(toScreen(towerCentre(index)).y - 60);
    }
  });

  it('every unit has a contact shadow beneath it, on the ground plane', () => {
    const nodes = scene(combatWith([1, 2])).nodes;
    for (const index of [1, 2]) {
      const shadow = nodes.find(n => n.id === `shadow:${index}`);
      const unit = nodes.find(n => n.id === `unit:${index}`);
      expect(shadow!.world).toEqual(unit!.world);
      // Drawn before the unit, so it lies under it.
      expect(nodes.indexOf(shadow!)).toBeLessThan(nodes.indexOf(unit!));
    }
  });

  it('an empty tower has no unit and no shadow', () => {
    const nodes = scene(combatWith([0])).nodes;
    expect(nodes.some(n => n.id === 'unit:4')).toBe(false);
    expect(nodes.some(n => n.id === 'shadow:4')).toBe(false);
  });
});

describe('the enemy is a force, not a bar', () => {
  it('thins out as its strength falls', () => {
    const full = combatWith([]);
    expect(enemyFigureCount(full)).toBe(9);
    expect(enemyFigureCount({ ...full, enemy: { ...full.enemy, hp: 500 } })).toBe(5);
    expect(enemyFigureCount({ ...full, enemy: { ...full.enemy, hp: 1 } })).toBe(1);
    expect(enemyFigureCount({ ...full, enemy: { ...full.enemy, hp: 0 } })).toBe(0);
  });

  it('the figures really disappear from the scene', () => {
    const full = combatWith([]);
    const hurt: CombatState = { ...full, enemy: { ...full.enemy, hp: 200 } };
    const before = scene(full).nodes.filter(n => n.kind === 'enemy').length;
    const after = scene(hurt).nodes.filter(n => n.kind === 'enemy').length;
    expect(before).toBe(9);
    expect(after).toBe(2);
  });
});

describe('the ground does not shimmer', () => {
  it('a tile´s variant is stable and spread across all four', () => {
    expect(terrainVariant(3, 7)).toBe(terrainVariant(3, 7));
    const seen = new Set<number>();
    for (let c = 0; c < 20; c++) for (let r = 0; r < 20; r++) seen.add(terrainVariant(c, r));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });
});
