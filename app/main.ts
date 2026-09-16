import { UNIT_POOL, createUnit } from '@/content/units/pool';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/rendering/artRules';
import { originFor } from '@/rendering/WorldTransform';
import { buildBattlefieldScene, towerGroundAnchor } from '@/rendering/SceneGraph';
import { BattlefieldRenderer } from '@/rendering/PixiRenderer';
import { firingDuration, visualFor } from '@/rendering/units/UnitVisual';
import { poseAt, projectileAt, releaseTime } from '@/rendering/units/firing';

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
 * ALL FOUR FAMILIES FIRING, side by side.
 *
 * Each tower runs its own firing sequence at its own pace, releases at its own
 * moment, from its own muzzle socket, with its own arc. Watching the four
 * together is the point — if a bow and a bombard read the same, the system has
 * failed regardless of what the numbers say.
 *
 * Every pose comes from `poseAt`: a pure function of time. Nothing here can
 * influence the simulation, because the simulation finished before the first
 * frame was drawn.
 */
interface Gunner {
  readonly tower: number;
  readonly from: ReturnType<typeof towerGroundAnchor>;
  t: number;
  previous: number;
  shot: { t: number } | null;
}

const gunners: Gunner[] = state.towers
  .map((tower, index) => ({ tower: index, unit: tower.unit }))
  .filter(t => t.unit)
  .map(({ tower }, i) => ({
    tower,
    from: towerGroundAnchor(tower, state.towers[tower]!.type),
    // Staggered, so the four are legible instead of simultaneous.
    t: -i * 0.35,
    previous: -i * 0.35,
    shot: null,
  }));

const TARGET = { col: 18, row: 9 };
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const flying = [];
  for (const gunner of gunners) {
    const unit = state.towers[gunner.tower]!.unit!;
    const visual = visualFor(unit.branch);
    gunner.previous = gunner.t;
    gunner.t += dt;
    if (gunner.t > firingDuration(visual) + 0.5) { gunner.t = 0; gunner.previous = 0; }

    const pose = poseAt(visual, Math.max(0, gunner.t), {
      from: gunner.from, to: TARGET, camera, since: Math.max(0, gunner.previous),
    });
    if (pose.released) gunner.shot = { t: 0 };

    if (gunner.shot) {
      gunner.shot.t += dt;
      const at = projectileAt(visual, gunner.from, TARGET, gunner.shot.t);
      if (at.done) gunner.shot = null;
      else flying.push({ id: `shot-${gunner.tower}`, kind: visual.projectile, at });
    }
  }

  renderer.render(buildBattlefieldScene(state, camera, flying));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const note = document.getElementById('note');
if (note) {
  const families = gunners
    .map(g => {
      const visual = visualFor(state.towers[g.tower]!.unit!.branch);
      return `${visual.familyName} ${Math.round(firingDuration(visual) * 1000)} ms`
        + ` · Abschuss bei ${Math.round(releaseTime(visual)! * 1000)} ms`;
    })
    .join('   |   ');
  note.textContent = `Phase 5 · ${families} · Platzhaltergrafik`;
}
