import { UNIT_POOL, createUnit } from '@/content/units/pool';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/rendering/artRules';
import { originFor } from '@/rendering/WorldTransform';
import { buildBattlefieldScene, towerGroundAnchor } from '@/rendering/SceneGraph';
import { BattlefieldRenderer } from '@/rendering/PixiRenderer';

/*
 * PHASE 4 — the Pixi battlefield, beside the old renderer, from the same state.
 *
 * Terrain, castle, five towers, deployed units, the enemy force and one
 * projectile — all of it built by `buildBattlefieldScene` from a real
 * `CombatState` that the real engine produced. No parallel truth.
 *
 * The art is PLACEHOLDER and says so on the page. What is being proven here is
 * the system: projection, layers, anchors, depth order. Real sprites drop into
 * the same sockets.
 */

const canvas = document.getElementById('world') as HTMLCanvasElement;

let state = createCombat({
  deck: UNIT_POOL.map(u => createUnit(u.id)!),
  enemy: { id: 'vorhut', displayName: 'Spähertrupp', hp: 2600, maxHp: 4000 },
  seed: 'phase-4',
  towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
  shuffle: false,
}).state;

// One unit from each military family, so all four read side by side.
for (const [tower, id] of [[0, 'bow-11'], [1, 'crossbow-9'], [3, 'artillery-12'], [4, 'gunner-13']] as const) {
  const unit = state.hand.find(c => c.id === id) ?? createUnit(id)!;
  const withCard = state.hand.some(c => c.uid === unit.uid)
    ? state
    : { ...state, hand: [...state.hand, unit] };
  const result = performAction(withCard, {
    type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: tower,
  });
  if (result.ok) state = result.state;
}

const camera = originFor(STAGE_WIDTH, STAGE_HEIGHT);
const renderer = await BattlefieldRenderer.create({
  canvas, width: STAGE_WIDTH, height: STAGE_HEIGHT, scale: 1,
});

/*
 * One shot in flight, leaving the archer tower's PLATFORM — not its foot and
 * not the tower's centre. The real muzzle socket arrives with the unit visuals
 * in Phase 5; the platform is already the right order of magnitude.
 */
const from = towerGroundAnchor(0, state.towers[0]!.type);
let travel = 0;

function frame(): void {
  travel = (travel + 0.012) % 1;
  const shot = {
    id: 'demo', kind: 'arrow',
    at: {
      col: from.col + (18 - from.col) * travel,
      row: from.row + (7 - from.row) * travel,
      height: (from.height ?? 0) * (1 - travel) + Math.sin(travel * Math.PI) * 34,
    },
  };
  renderer.render(buildBattlefieldScene(state, camera, [shot]));
  requestAnimationFrame(frame);
}
frame();

const note = document.getElementById('note');
if (note) {
  note.textContent =
    `Phase 4 · ${buildBattlefieldScene(state, camera).nodes.length} Knoten · `
    + `Gegner ${state.enemy.hp} von ${state.enemy.maxHp} · Platzhaltergrafik`;
}
