import type { CombatState, Tower, Unit } from '@/core/types';
import type { Particle } from './effects/particles';
import {
  ENEMY_COLUMN, GRID_COLS, GRID_ROWS, TOWER_FOOTPRINT, TOWER_ROWS, WALL_COLUMN,
  heightBandForRank, layerIndex, platformHeight, type LayerName,
} from './artRules';
import {
  groundDepth, snap, toScreen, type Camera, type ScreenPoint, type WorldPoint,
} from './WorldTransform';

/**
 * What to draw, as DATA.
 *
 * The scene is built from game state and contains no PixiJS whatsoever: no
 * sprite, no container, no texture. That buys three things.
 *
 * 1. It is testable in Node. A renderer that needs a GPU to be tested is a
 *    renderer nobody tests.
 * 2. The depth order is deterministic and inspectable — the commonest
 *    rendering bug in an isometric game is a thing drawn behind the ground it
 *    stands on, and here that is an assertion rather than a screenshot.
 * 3. Pixi becomes replaceable. It is the renderer; it is not the architecture.
 *
 * The scene READS state. It never writes any.
 */

export type SceneNodeKind =
  | 'ground' | 'wall' | 'tower' | 'unit' | 'enemy' | 'projectile' | 'shadow'
  | 'particle' | 'projectileShadow';

export interface SceneNode {
  /** Stable across frames, so the binding can reuse a sprite instead of rebuilding it. */
  readonly id: string;
  readonly kind: SceneNodeKind;
  readonly layer: LayerName;
  readonly world: WorldPoint;
  /** Where it lands, already snapped to a whole logical pixel. */
  readonly screen: ScreenPoint;
  /** Back to front within the layer. */
  readonly depth: number;
  /** Which sprite to use. The atlas resolves it; the scene only names it. */
  readonly sprite: string;
  /** Extra facts the binding may need. Never anything the rules own. */
  readonly detail?: Readonly<Record<string, string | number | boolean>>;
}

export interface Scene {
  readonly nodes: readonly SceneNode[];
  readonly camera: Camera;
}

/** Where a tower's centre sits, in tiles. */
export function towerCentre(index: number): WorldPoint {
  const row = TOWER_ROWS[index];
  if (row === undefined) throw new Error(`no such tower: ${index}`);
  return {
    col: WALL_COLUMN + TOWER_FOOTPRINT.cols / 2 - 0.5,
    row: row + TOWER_FOOTPRINT.rows / 2 - 0.5,
  };
}

/**
 * Where a unit standing on that tower has its FEET.
 *
 * On the platform, not on the ground beside it. The five towers are physical
 * defensive positions, not five card slots, and a garrison standing in the
 * dirt next to its own wall says the opposite — which is exactly what the
 * first render of this scene showed.
 */
export function towerGroundAnchor(index: number, towerType: string): WorldPoint {
  return { ...towerCentre(index), height: platformHeight(towerType) };
}

const node = (
  id: string, kind: SceneNodeKind, layer: LayerName,
  world: WorldPoint, sprite: string, camera: Camera,
  detail?: SceneNode['detail'],
): SceneNode => ({
  id, kind, layer, world,
  screen: snap(toScreen(world, camera)),
  depth: groundDepth(world),
  sprite,
  ...(detail ? { detail } : {}),
});

/**
 * The ground. One node per tile, with a deterministic variant so the terrain
 * has texture without flickering between frames.
 *
 * The grid may still exist mechanically; the player should not constantly SEE
 * it. The variant is what breaks the repetition.
 */
function groundNodes(camera: Camera): SceneNode[] {
  const out: SceneNode[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      out.push(node(`ground:${col}:${row}`, 'ground', 'GROUND',
        { col, row }, `ground/${terrainVariant(col, row)}`, camera));
    }
  }
  return out;
}

/**
 * A stable per-tile variant. Deterministic on purpose: a terrain that rerolls
 * every frame shimmers, and a terrain that rerolls every load is a terrain the
 * player can never learn.
 */
export function terrainVariant(col: number, row: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return Math.floor((n - Math.floor(n)) * 4);
}

function castleNodes(state: CombatState, camera: Camera): SceneNode[] {
  const out: SceneNode[] = [];

  // The wall runs down the column; the towers sit in it.
  for (let row = 0; row < GRID_ROWS; row++) {
    const inTower = TOWER_ROWS.some(t => row >= t && row < t + TOWER_FOOTPRINT.rows);
    if (inTower) continue;
    out.push(node(`wall:${row}`, 'wall', 'CASTLE_BACK',
      { col: WALL_COLUMN, row }, 'castle/wall', camera));
  }

  state.towers.forEach((tower, i) => {
    const centre = towerCentre(i);
    out.push(node(`tower:${i}`, 'tower', 'TOWERS', centre,
      `castle/tower-${tower.type}`, camera, { index: i, type: tower.type }));
  });

  return out;
}

/**
 * The garrison. Every unit is anchored to its tower's ground point and stays
 * there: firing moves the upper body, the weapon and the machine, never the
 * whole sprite.
 */
function unitNodes(towers: readonly Tower[], camera: Camera): SceneNode[] {
  const out: SceneNode[] = [];
  towers.forEach((tower, i) => {
    const unit: Unit | null = tower.unit;
    if (!unit) return;
    const anchor = towerGroundAnchor(i, tower.type);
    // Contact shadow first: on the ground plane, under the feet.
    out.push(node(`shadow:${i}`, 'shadow', 'TOWERS', anchor, 'fx/contact-shadow', camera));
    out.push(node(`unit:${i}`, 'unit', 'UNITS', anchor,
      `unit/${unit.branch}/${heightBandForRank(unit.rank)}`, camera,
      { tower: i, branch: unit.branch, rank: unit.rank, uid: unit.uid }));
  });
  return out;
}

/**
 * The enemy as a FORCE, not a health bar with decoration. How many figures
 * stand there follows how much strength is left, so the player sees the castle
 * destroying an army rather than reading it off a number.
 */
export function enemyFigureCount(state: CombatState): number {
  const share = state.enemy.maxHp ? state.enemy.hp / state.enemy.maxHp : 0;
  return Math.max(0, Math.min(9, Math.ceil(share * 9)));
}

function enemyNodes(state: CombatState, camera: Camera): SceneNode[] {
  const out: SceneNode[] = [];
  const figures = enemyFigureCount(state);
  const centre = Math.round(GRID_ROWS / 2);
  for (let i = 0; i < figures; i++) {
    const rank = Math.floor(i / 3);
    const inRank = i % 3;
    out.push(node(`enemy:${i}`, 'enemy', 'ENEMIES', {
      col: ENEMY_COLUMN + rank * 0.9,
      row: centre - 3 + inRank * 3 + rank,
    }, 'enemy/infantry', camera, { index: i }));
  }
  return out;
}

/** A shot in flight. Presentation owns these; the rules never see them. */
export interface FlyingProjectile {
  readonly id: string;
  readonly kind: string;
  readonly at: WorldPoint;
}

/**
 * Build the whole scene.
 *
 * Sorted once, deterministically: by layer, then back to front on the ground
 * plane, then by id. The same state always produces the same order — a
 * renderer that sorts unstably flickers, and that flicker cannot be reproduced
 * in a bug report.
 */
export function buildBattlefieldScene(
  state: CombatState,
  camera: Camera,
  projectiles: readonly FlyingProjectile[] = [],
  particles: readonly Particle[] = [],
): Scene {
  const nodes = [
    ...groundNodes(camera),
    ...castleNodes(state, camera),
    ...unitNodes(state.towers, camera),
    ...enemyNodes(state, camera),
    /*
     * A shadow on the GROUND beneath an arcing shot. In isometric pixel art
     * this communicates height better than anything else — without it a
     * trebuchet stone and a low cannonball are the same dot moving right.
     */
    ...projectiles.filter(p => (p.at.height ?? 0) > 8).map(p =>
      node(`shotShadow:${p.id}`, 'projectileShadow', 'DECORATION',
        { col: p.at.col, row: p.at.row }, 'fx/shot-shadow', camera,
        { height: p.at.height ?? 0 })),
    ...projectiles.map(p => node(`shot:${p.id}`, 'projectile', 'PROJECTILES',
      p.at, `projectile/${p.kind}`, camera)),
    ...particles.map(p => node(`fx:${p.id}`, 'particle',
      p.kind === 'dust' || p.kind === 'debris' ? 'IMPACTS' : 'WORLD_FX',
      p.at, `particle/${p.kind}`, camera,
      { size: Math.round(p.size), opacity: Math.round(p.opacity * 100) / 100,
        palette: p.palette })),
  ];

  nodes.sort((a, b) => {
    const byLayer = layerIndex(a.layer) - layerIndex(b.layer);
    if (byLayer) return byLayer;
    const byDepth = a.depth - b.depth;
    if (byDepth) return byDepth;
    const byCol = a.world.col - b.world.col;
    if (byCol) return byCol;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return { nodes, camera };
}
