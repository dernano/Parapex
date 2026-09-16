import { describe, expect, it } from 'vitest';
import { UNIT_POOL, createUnit } from '@/content/units/pool';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { LAYERS, layerIndex, platformHeight } from '@/rendering/artRules';
import { castleLayer, nearestGarrison, occludes, towerPieces } from '@/rendering/occlusion';
import { buildBattlefieldScene, towerCentre, towerGroundAnchor } from '@/rendering/SceneGraph';
import { placeholderFor } from '@/rendering/placeholderAtlas';
import { DEFAULT_CAMERA } from '@/rendering/WorldTransform';

/**
 * The garrison has to live INSIDE the castle. A soldier with the whole tower
 * behind him and nothing in front is a sticker, and the castle stops being the
 * main character the moment the player notices.
 */

function combatWithGarrison() {
  let state = createCombat({
    deck: UNIT_POOL.map(u => createUnit(u.id)!),
    enemy: { id: 'vorhut', displayName: 'Spähertrupp', hp: 2600, maxHp: 4000 },
    seed: 'occlusion',
    towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
    shuffle: false,
  }).state;
  for (const [tower, id] of [[0, 'bow-11'], [2, 'artillery-12'], [4, 'gunner-13']] as const) {
    const unit = state.hand.find(c => c.id === id) ?? createUnit(id)!;
    const withCard = state.hand.some(c => c.uid === unit.uid)
      ? state : { ...state, hand: [...state.hand, unit] };
    const result = performAction(withCard, {
      type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: tower,
    });
    if (result.ok) state = result.state;
  }
  return state;
}

describe('who stands in front of whom', () => {
  it('is decided by depth, with ties going to the figure', () => {
    const figure = { col: 7.5, row: 9.5 };
    expect(occludes({ col: 8, row: 10 }, figure)).toBe(true);
    expect(occludes({ col: 7, row: 9 }, figure)).toBe(false);
    // A piece at exactly the figure's depth is the platform he stands on, and
    // a platform that draws over its own occupant is the first thing anybody
    // notices.
    expect(occludes({ col: 7.5, row: 9.5 }, figure)).toBe(false);
  });

  it('is DERIVED, not written down: move the piece and the layer follows', () => {
    const figure = { col: 7.5, row: 9.5 };
    expect(castleLayer({ col: 8, row: 10 }, figure)).toBe('CASTLE_FRONT');
    expect(castleLayer({ col: 7, row: 9 }, figure)).toBe('CASTLE_BACK');
  });

  it('gives every tower a back that is behind and a parapet that is in front', () => {
    for (let i = 0; i < 5; i++) {
      const centre = towerCentre(i);
      const garrison = towerGroundAnchor(i, 'archerTower');
      const pieces = towerPieces(centre, garrison, 'archerTower');
      const body = pieces.find(p => p.piece === 'towerBody')!;
      const parapet = pieces.find(p => p.piece === 'towerParapet')!;

      expect(layerIndex(body.layer), `tower ${i} body`)
        .toBeLessThan(layerIndex('UNITS'));
      expect(layerIndex(parapet.layer), `tower ${i} parapet`)
        .toBeGreaterThan(layerIndex('UNITS'));
    }
  });

  /**
   * The parapet has to stand ON the platform. At ground level it would be
   * thirty pixels below the soldier's feet — correctly layered, occluding
   * nothing, and therefore pointless.
   */
  it('stands the parapet at the garrison\'s own feet', () => {
    const parapet = towerPieces(towerCentre(3), towerGroundAnchor(3, 'cannonTower'), 'cannonTower')
      .find(p => p.piece === 'towerParapet')!;
    expect(parapet.world.height).toBe(platformHeight('cannonTower'));
  });

  it('and therefore actually crosses the soldier on screen', () => {
    const state = combatWithGarrison();
    const scene = buildBattlefieldScene(state, DEFAULT_CAMERA);
    const unit = scene.nodes.find(n => n.id === 'unit:0')!;
    const parapet = scene.nodes.find(n => n.id === 'tower:0:towerParapet')!;

    const unitBox = boxOf(unit.sprite, unit.screen);
    const parapetBox = boxOf(parapet.sprite, parapet.screen);
    expect(overlaps(unitBox, parapetBox),
      `unit ${JSON.stringify(unitBox)} parapet ${JSON.stringify(parapetBox)}`).toBe(true);
    // And it is drawn after him.
    expect(scene.nodes.indexOf(parapet)).toBeGreaterThan(scene.nodes.indexOf(unit));
  });

  it('puts the curtain wall in front below a tower and behind above it', () => {
    const state = combatWithGarrison();
    const scene = buildBattlefieldScene(state, DEFAULT_CAMERA);
    const layerOf = (row: number): string =>
      scene.nodes.find(n => n.id === `wall:${row}`)!.layer;

    // Tower 0 occupies rows 1-2, its garrison sits at row 1.5.
    expect(layerOf(0)).toBe('CASTLE_BACK');   // above it: behind
    expect(layerOf(3)).toBe('CASTLE_FRONT');  // below it: in front
  });

  it('measures the wall against the emplacement it would actually cross', () => {
    const anchors = [0, 1, 2, 3, 4].map(i => towerGroundAnchor(i, 'watchtower'));
    expect(nearestGarrison({ col: 7, row: 4 }, anchors)).toEqual(anchors[1]);
    expect(nearestGarrison({ col: 7, row: 0 }, anchors)).toEqual(anchors[0]);
    expect(nearestGarrison({ col: 7, row: 19 }, anchors)).toEqual(anchors[4]);
  });

  it('never lets an enemy be hidden by castle drawn later than it', () => {
    /*
     * CASTLE_FRONT sits after ENEMIES in the layer order, which is correct for
     * the garrison and would be wrong for anything standing between the castle
     * and the camera. The enemy forms up eleven columns away, so the two never
     * share screen space - and this asserts that rather than assuming it,
     * because the day somebody moves the enemy closer, the layer order becomes
     * a bug nobody would look for.
     */
    const state = combatWithGarrison();
    const scene = buildBattlefieldScene(state, DEFAULT_CAMERA);
    const front = scene.nodes.filter(n => n.layer === 'CASTLE_FRONT');
    const enemies = scene.nodes.filter(n => n.kind === 'enemy');
    expect(front.length).toBeGreaterThan(0);
    expect(enemies.length).toBeGreaterThan(0);

    for (const piece of front) {
      for (const enemy of enemies) {
        expect(overlaps(boxOf(piece.sprite, piece.screen), boxOf(enemy.sprite, enemy.screen)),
          `${piece.id} over ${enemy.id}`).toBe(false);
      }
    }
  });

  it('keeps every node in a layer the contract actually names', () => {
    const state = combatWithGarrison();
    const scene = buildBattlefieldScene(state, DEFAULT_CAMERA);
    for (const node of scene.nodes) {
      expect(LAYERS, node.id).toContain(node.layer);
    }
  });
});

interface Box { left: number; top: number; right: number; bottom: number }

function boxOf(sprite: string, screen: { x: number; y: number }): Box {
  const placeholder = placeholderFor(sprite);
  return {
    left: screen.x - placeholder.anchor.x,
    top: screen.y - placeholder.anchor.y,
    right: screen.x - placeholder.anchor.x + placeholder.width,
    bottom: screen.y - placeholder.anchor.y + placeholder.height,
  };
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
