import type { CombatState, Tower, Unit } from '@/core/types';
import type { Particle } from './effects/particles';
import type { FormationNode } from './formations/formationPresentation';
import type { DropGhost } from './hud/dropTargets';
import type { PresentationSettings } from './presentation/settings';
import {
  ENEMY_COLUMN, GRID_COLS, GRID_ROWS, TILE_HEIGHT, TILE_WIDTH, TOWER_FOOTPRINT,
  TOWER_ROWS, WALL_COLUMN, heightBandForRank, layerIndex, platformHeight,
  type LayerName,
} from './artRules';
import { castleLayer, nearestGarrison, towerPieces } from './occlusion';
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
  | 'ground' | 'wall' | 'tower' | 'parapet' | 'unit' | 'enemy' | 'projectile'
  | 'shadow' | 'particle' | 'projectileShadow' | 'formation' | 'floating' | 'ghost';

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
  /** Text, for the few nodes that carry any. */
  readonly text?: string;
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

/** Every emplacement's standing point, for the occlusion decisions. */
export function garrisonAnchors(towers: readonly Tower[]): readonly WorldPoint[] {
  return towers.map((tower, i) => towerGroundAnchor(i, tower.type));
}

const node = (
  id: string, kind: SceneNodeKind, layer: LayerName,
  world: WorldPoint, sprite: string, camera: Camera,
  detail?: SceneNode['detail'],
  text?: string,
): SceneNode => ({
  id, kind, layer, world,
  screen: snap(toScreen(world, camera)),
  depth: groundDepth(world),
  sprite,
  ...(detail ? { detail } : {}),
  ...(text !== undefined ? { text } : {}),
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

/**
 * The castle, in pieces, each in the layer its POSITION earns.
 *
 * Nothing here says "the parapet goes in front". It says where the parapet is,
 * and `castleLayer` answers. That is the difference between occlusion that
 * stays right when the camera or the footprint changes and occlusion that was
 * right once.
 */
function castleNodes(state: CombatState, camera: Camera): SceneNode[] {
  const out: SceneNode[] = [];
  const anchors = garrisonAnchors(state.towers);

  // The curtain wall between the towers.
  for (let row = 0; row < GRID_ROWS; row++) {
    const inTower = TOWER_ROWS.some(t => row >= t && row < t + TOWER_FOOTPRINT.rows);
    if (inTower) continue;
    const world: WorldPoint = { col: WALL_COLUMN, row };
    const garrison = nearestGarrison(world, anchors);
    out.push(node(`wall:${row}`, 'wall',
      garrison ? castleLayer(world, garrison) : 'CASTLE_BACK',
      world, 'castle/wall', camera));
  }

  state.towers.forEach((tower, i) => {
    const centre = towerCentre(i);
    const garrison = anchors[i]!;
    for (const piece of towerPieces(centre, garrison, tower.type)) {
      out.push(node(`tower:${i}:${piece.piece}`,
        piece.piece === 'towerParapet' ? 'parapet' : 'tower',
        piece.layer, piece.world, piece.sprite, camera,
        { index: i, type: tower.type, piece: piece.piece }));
    }
  });

  return out;
}

/**
 * The garrison. Every unit is anchored to its tower's ground point and stays
 * there: firing moves the upper body, the weapon and the machine, never the
 * whole sprite.
 */
function unitNodes(
  towers: readonly Tower[], camera: Camera, settings?: PresentationSettings,
): SceneNode[] {
  const out: SceneNode[] = [];
  const scale = settings?.unitScale ?? 1;
  towers.forEach((tower, i) => {
    const unit: Unit | null = tower.unit;
    if (!unit) return;
    const anchor = towerGroundAnchor(i, tower.type);
    // Contact shadow first: on the ground plane, under the feet.
    out.push(node(`shadow:${i}`, 'shadow', 'TOWERS', anchor, 'fx/contact-shadow', camera));
    out.push(node(`unit:${i}`, 'unit', 'UNITS', anchor,
      `unit/${unit.branch}/${heightBandForRank(unit.rank)}`, camera,
      { tower: i, branch: unit.branch, rank: unit.rank, uid: unit.uid, scale }));
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
  /**
   * Where it was a moment ago. An oriented shot faces the line between the
   * two, so it points along its real screen velocity rather than at its
   * launch point.
   */
  readonly from?: WorldPoint;
}

/** Something written over the field: damage, a caption, a refusal. */
export interface FloatingLabel {
  readonly id: string;
  readonly at: WorldPoint;
  readonly text: string;
  /** How large, from the damage magnitude bands. */
  readonly size: number;
  readonly colour: string;
  /** 0..1 through its life, for the rise and the fade. */
  readonly progress: number;
}

export interface SceneOptions {
  readonly settings?: PresentationSettings;
  /** Formation standards, already posed by `presentFormation`. */
  readonly formations?: readonly FormationNode[];
  readonly floating?: readonly FloatingLabel[];
  /** The unit as it would stand, while a card is in the air. */
  readonly ghost?: DropGhost | null;
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
  options: SceneOptions = {},
): Scene {
  const settings = options.settings;
  const shotShadows = settings?.effects.shotShadows ?? true;

  const nodes = [
    ...groundNodes(camera),
    ...castleNodes(state, camera),
    ...unitNodes(state.towers, camera, settings),
    ...enemyNodes(state, camera),
    /*
     * A shadow on the GROUND beneath an arcing shot. In isometric pixel art
     * this communicates height better than anything else — without it a
     * trebuchet stone and a low cannonball are the same dot moving right.
     */
    ...(shotShadows ? projectiles.filter(p => (p.at.height ?? 0) > 8).map(p =>
      node(`shotShadow:${p.id}`, 'projectileShadow', 'DECORATION',
        { col: p.at.col, row: p.at.row }, 'fx/shot-shadow', camera,
        { height: p.at.height ?? 0, kind: p.kind })) : []),
    ...projectiles.map(p => node(`shot:${p.id}`, 'projectile', 'PROJECTILES',
      p.at, `projectile/${p.kind}`, camera, angleDetail(p))),
    ...particles.map(p => node(`fx:${p.id}`, 'particle',
      p.kind === 'dust' || p.kind === 'debris' ? 'IMPACTS' : 'WORLD_FX',
      p.at, `particle/${p.kind}`, camera,
      { size: Math.round(p.size), opacity: Math.round(p.opacity * 100) / 100,
        palette: p.palette })),
    /*
     * The formation stands ABOVE the wall it describes, in the world layer:
     * it belongs to the castle, not to a panel. That is the whole point of
     * refusing the modal.
     */
    ...(options.formations ?? []).map(f =>
      node(f.id, 'formation', 'WORLD_FX', f.world, f.sprite, camera,
        { colour: f.colour, accent: f.accent, raise: Math.round(f.raise * 100) / 100,
          variant: f.kind },
        f.text)),
    ...(options.ghost ? [node('ghost', 'ghost', 'UNITS', options.ghost.world,
      options.ghost.sprite, camera,
      { opacity: options.ghost.opacity, scale: settings?.unitScale ?? 1 })] : []),
    ...((settings?.effects.floatingText ?? true) ? (options.floating ?? []).map(label =>
      node(label.id, 'floating', 'FLOATING_TEXT', label.at, 'text/floating', camera,
        { size: label.size, colour: label.colour,
          progress: Math.round(label.progress * 100) / 100 },
        label.text)) : []),
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

/**
 * The angle an oriented shot is drawn at, in SCREEN space.
 *
 * Taken from the projection rather than from the world heading, and with the
 * height change included. Both matter. An arrow travelling due east on the
 * ground plane travels down and to the right on the screen, so a sprite
 * rotated by the world angle points somewhere the arrow is not going. And an
 * arrow at the top of its arc is climbing in world terms but level on screen —
 * without the height term it would point upward through the whole flight and
 * the arc would vanish from the one object that should express it.
 */
function angleDetail(p: FlyingProjectile): SceneNode['detail'] {
  if (!p.from) return { kind: p.kind };
  const dCol = p.at.col - p.from.col;
  const dRow = p.at.row - p.from.row;
  const dHeight = (p.at.height ?? 0) - (p.from.height ?? 0);
  const x = (dCol - dRow) * (TILE_WIDTH / 2);
  const y = (dCol + dRow) * (TILE_HEIGHT / 2) - dHeight;
  if (!x && !y) return { kind: p.kind };
  return { kind: p.kind, angle: Math.round(Math.atan2(y, x) * 1000) / 1000 };
}
