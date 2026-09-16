/**
 * The pixel art bible, as code.
 *
 * `docs/ART_BIBLE.md` is the prose; this is the same set of numbers in a
 * form assets can import. `src/tests/artRules.test.ts` reads the document and
 * fails if the two drift apart — a specification nobody can violate silently
 * is worth more than one everybody agrees with.
 */

/* ---------- Camera ---------- */

/**
 * The projection is UNCHANGED from the legacy tree, deliberately. It is the one
 * part of the look that already works, and every new asset is built to fit it.
 *
 * A 2:1 diamond is the classic isometric ratio: a tile edge steps two pixels
 * across for every one down, so a one-pixel diagonal is exact and never has to
 * be dithered.
 */
export const TILE_WIDTH = 44;
export const TILE_HEIGHT = 22;
export const GRID_COLS = 20;
export const GRID_ROWS = 20;

/** The stage at 1×. It grows with the window; the pixels do not. */
export const STAGE_WIDTH = 960;
export const STAGE_HEIGHT = 768;

/** Integer scales only. 1.5× is what turns pixel art into mush. */
export const ALLOWED_SCALES: readonly number[] = [1, 2, 3];

/* ---------- The castle ---------- */

/** The wall runs down this column; the five towers stand in it. */
export const WALL_COLUMN = 7;
/** The five emplacements, mirrored about the axis. */
export const TOWER_ROWS: readonly number[] = [1, 5, 9, 13, 17];
/** Each tower covers two tiles by two. */
export const TOWER_FOOTPRINT = { cols: 2, rows: 2 } as const;
/** Where the enemy army forms up. */
export const ENEMY_COLUMN = 18;

/**
 * How high each tower's platform stands above the ground plane, in logical
 * pixels. Within the bible's 70–96 band.
 *
 * This is a RENDERING fact, and it belongs here rather than in the atlas,
 * because the scene needs it to stand a soldier on the platform instead of at
 * its foot — the first screenshot of the Pixi battlefield had the whole
 * garrison standing in the dirt beside their towers.
 */
export const TOWER_PLATFORM_HEIGHT: Readonly<Record<string, number>> = {
  watchtower: 70, archerTower: 78, ballistaTower: 82, cannonTower: 88, powderTower: 96,
};

export const platformHeight = (type: string): number =>
  TOWER_PLATFORM_HEIGHT[type] ?? TOWER_PLATFORM_HEIGHT.watchtower!;

/* ---------- Light ---------- */

/**
 * One sun, from the upper right. It never moves, and no asset is ever lit from
 * anywhere else.
 */
export const LIGHT = {
  warm: '#fff4d4',
  cool: '#3b3566',
  /** How far a face is mixed toward the warm or cool end. */
  topMix: 0.30,
  rightMix: 0.06,
  leftMix: 0.36,
} as const;

/** Contact shadows fall opposite the sun: to the lower left, on the ground plane. */
export const SHADOW_DIRECTION = { x: -1, y: 1 } as const;

/* ---------- Sizes ---------- */

export const UNIT_HEIGHT = {
  militia: [22, 24],
  professional: [24, 26],
  elite: [26, 28],
  engine: [30, 44],
} as const;

/**
 * Which band a rank reads as. A unit is NEVER scaled to signal rank — rank
 * reads through armour, helmet, weapon craftsmanship, cloth and stance.
 */
export function heightBandForRank(rank: number): keyof typeof UNIT_HEIGHT {
  if (rank <= 3) return 'militia';
  if (rank <= 9) return 'professional';
  return 'elite';
}

/* ---------- Palette ---------- */

export const PALETTE = {
  earth: ['#3a2e20', '#4d3d2a', '#635036', '#756244', '#8a7351'],
  grass: ['#2f3a22', '#43512e', '#58663a', '#6d7a45'],
  stone: ['#4a4a52', '#5f6068', '#7a7a80', '#928f8a', '#a8a49a'],
  wood: ['#332017', '#4a3122', '#6a4d30', '#8a6a42'],
  iron: ['#2a2d33', '#434750', '#6b7079', '#949aa3', '#b9bec6'],
  cloth: ['#5a3a3a', '#5a4a3a', '#6a5a3a'],
  heraldic: ['#a8261f', '#2f5fa8', '#4f7a3a', '#e3b552'],
  fire: ['#5a1a08', '#8a2f0c', '#c25a15', '#e89a3c', '#ffd98a'],
} as const;

/** A single sprite uses at most this many colours; fewer values read further. */
export const MAX_COLOURS_PER_SPRITE = 12;
export const MAX_COLOURS_PER_MATERIAL = 5;

/* ---------- Animation ---------- */

export const FRAME_RATE = { idle: 8, fire: 12 } as const;
export const FRAME_COUNT = {
  idle: [2, 4],
  fire: [4, 8],
  recovery: [2, 4],
} as const;

/* ---------- Layers ---------- */

/**
 * Explicit and ordered. Never creation order — a renderer whose z-order depends
 * on the sequence of calls is a renderer that will one day draw a soldier
 * behind the ground he stands on.
 */
export const LAYERS = [
  'GROUND', 'DECORATION', 'CASTLE_BACK', 'TOWERS', 'UNITS',
  'PROJECTILES', 'ENEMIES', 'IMPACTS', 'CASTLE_FRONT', 'WORLD_FX', 'FLOATING_TEXT',
] as const;

export type LayerName = (typeof LAYERS)[number];

export const layerIndex = (layer: LayerName): number => LAYERS.indexOf(layer);

/* ---------- Sockets ---------- */

/** What a unit visual declares beyond its ground anchor. */
export const SOCKETS = ['muzzle', 'recoilPivot', 'smoke', 'banner'] as const;
export type SocketName = (typeof SOCKETS)[number];
