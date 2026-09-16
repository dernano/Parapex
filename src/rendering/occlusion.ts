import { TOWER_FOOTPRINT, platformHeight, type LayerName } from './artRules';
import { groundDepth, type WorldPoint } from './WorldTransform';

/**
 * WHO STANDS IN FRONT OF WHOM.
 *
 * The garrison must live INSIDE the architecture, not on top of a picture of
 * it. A soldier on a tower has stone behind his back and a parapet in front of
 * his knees; if both halves of the tower draw behind him he is a sticker, and
 * the castle stops being the main character the moment the player notices.
 *
 * So a tower is not one sprite. It is pieces, each with its own position on
 * the ground plane, and which layer a piece lands in is DERIVED from that
 * position — never written down by hand. Hand-assigned layers are how an
 * isometric game ends up with a wall in front of a man who is standing on it,
 * and the bug survives for months because the assignment looked deliberate.
 *
 * The rule is one line: a piece nearer the camera than the figure draws in
 * front of it. Everything else in this file is that line, applied.
 */

/** The parts a castle is made of. */
export const CASTLE_PIECES = [
  'towerBody',     // the stone mass: shaft, footing, the far half of the crown
  'towerParapet',  // the near merlons the garrison stands behind
  'wall',          // a curtain segment between the towers
  'wallCap',       // its near edge
] as const;

export type CastlePiece = (typeof CASTLE_PIECES)[number];

/**
 * Is `piece` between the camera and `figure`?
 *
 * Ties go to the figure. A piece at exactly the soldier's own depth is the
 * platform he is standing on, and a platform that draws over its own occupant
 * is the first thing anybody notices.
 */
export function occludes(piece: WorldPoint, figure: WorldPoint): boolean {
  return groundDepth(piece) > groundDepth(figure);
}

/**
 * Which layer a castle piece belongs in, given the garrison line it shelters.
 *
 * Two layers, one question. If more castle detail arrives later — a gatehouse,
 * a hoarding, a bridge — it gets a position and this answers for it too,
 * without anybody editing a list.
 */
export function castleLayer(piece: WorldPoint, garrison: WorldPoint): LayerName {
  return occludes(piece, garrison) ? 'CASTLE_FRONT' : 'CASTLE_BACK';
}

/**
 * Where a tower's pieces sit relative to its centre, in tiles.
 *
 * Half the footprint forward and half back: the body occupies the far half of
 * the two-by-two, the parapet the near half. The numbers are deliberately
 * derived from the footprint rather than typed, so a three-by-three tower
 * would still split correctly.
 */
const HALF = TOWER_FOOTPRINT.cols / 4;

export interface TowerPieceSpec {
  readonly piece: CastlePiece;
  /** Offset from the tower's centre, on the ground plane. */
  readonly offset: { readonly col: number; readonly row: number };
  /**
   * How far off the ground the piece STANDS, given the tower's platform.
   *
   * The body grows out of the earth, so zero. The parapet stands ON the
   * platform, at the garrison's own feet — which is the difference between
   * merlons the soldier is behind and a low wall thirty pixels below him,
   * doing nothing and occluding nothing.
   */
  readonly height: (platform: number) => number;
  /** Where in the atlas. */
  readonly sprite: (type: string) => string;
}

export const TOWER_PIECES: readonly TowerPieceSpec[] = [
  { piece: 'towerBody', offset: { col: -HALF, row: -HALF }, height: () => 0,
    sprite: type => `castle/tower-${type}` },
  { piece: 'towerParapet', offset: { col: HALF, row: HALF }, height: platform => platform,
    sprite: type => `castle/parapet-${type}` },
];

/** A tower's pieces, positioned and layered, for one garrison anchor. */
export function towerPieces(
  centre: WorldPoint,
  garrison: WorldPoint,
  type: string,
): readonly { piece: CastlePiece; world: WorldPoint; sprite: string; layer: LayerName }[] {
  const platform = platformHeight(type);
  return TOWER_PIECES.map(spec => {
    const world: WorldPoint = {
      col: centre.col + spec.offset.col,
      row: centre.row + spec.offset.row,
      height: spec.height(platform),
    };
    return {
      piece: spec.piece,
      world,
      sprite: spec.sprite(type),
      layer: castleLayer(world, garrison),
    };
  });
}

/**
 * The garrison line: the depth every castle piece is judged against.
 *
 * A curtain wall between two towers has no occupant of its own, so it is
 * measured against the nearest emplacement — which is the figure a player
 * would actually see it cross.
 */
export function nearestGarrison(
  point: WorldPoint,
  garrisons: readonly WorldPoint[],
): WorldPoint | null {
  let best: WorldPoint | null = null;
  let bestDistance = Infinity;
  for (const garrison of garrisons) {
    const distance = Math.hypot(garrison.col - point.col, garrison.row - point.row);
    if (distance < bestDistance) { bestDistance = distance; best = garrison; }
  }
  return best;
}
