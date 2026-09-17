import { GRID_COLS, GRID_ROWS, LIGHT, PALETTE, TILE_HEIGHT, TILE_WIDTH } from '../artRules';
import { mix, type Shape } from '../placeholderAtlas';
import { toScreen, type Camera } from '../WorldTransform';
import { noise, smoothNoise } from './noise';

/**
 * THE GROUND THE CASTLE STANDS ON.
 *
 * The legacy renderer has a comment in its own ground builder that says this
 * better than I can:
 *
 *   "Der Boden bekommt Kies, Risse, Grasbueschel und Wagenspuren. Ohne das
 *    steht die gemauerte Burg auf einer leeren Farbflaeche, und genau dieser
 *    Bruch liess das Bild billig aussehen."
 *
 * That lesson was learned, written down in the repository, and then thrown
 * away when I rebuilt the renderer: four hundred flat diamonds, two colour
 * ramps, no gravel, no cracks, no grass. The castle stood on an empty colour
 * field and the picture looked cheap — exactly as predicted.
 *
 * Two things make it ground rather than a checkerboard.
 *
 * FIRST, TERRAIN COMES IN PATCHES. Earth and grass want to appear in areas
 * several tiles across, so the kind of a tile comes from SMOOTH noise. A
 * per-tile roll gives the checkerboard the first version had — and it is a
 * checkerboard even when every individual tile is the right colour.
 *
 * SECOND, EVERY TILE CARRIES DEBRIS. Gravel with its own small shadow, dry
 * cracks in trodden earth, tufts of grass, ruts where carts have passed. None
 * of it is individually visible; together it is the difference between a
 * surface and a fill.
 *
 * It is all deterministic, and it is all ONE drawing. Four hundred separate
 * sprites for a ground that never moves is four hundred things the renderer
 * sorts, uploads and transforms every frame for no reason — the legacy baked
 * it into a single image and was right to.
 */

export type TerrainKind = 'earth' | 'grass' | 'trodden' | 'scrub';

/**
 * What kind of ground a tile is.
 *
 * From smooth noise, so the kinds form patches. The thresholds are chosen so
 * grass dominates, earth answers it, and the two worn kinds are rare enough to
 * read as incident rather than as pattern.
 */
export function terrainKind(col: number, row: number): TerrainKind {
  const field = smoothNoise(col, row, 5.5);
  if (field > 0.62) return 'grass';
  if (field > 0.40) return 'earth';
  if (field > 0.28) return 'trodden';
  return 'scrub';
}

const BASE: Readonly<Record<TerrainKind, string>> = {
  grass: PALETTE.grass[1]!,
  earth: PALETTE.earth[2]!,
  trodden: PALETTE.earth[1]!,
  scrub: PALETTE.grass[0]!,
};

/**
 * The colour of a tile, under the one sun.
 *
 * The same light order as the buildings: warm on the rises, cool in the
 * hollows. Without it the ground lies flat under masoned stone, which is the
 * other half of why a bare fill looks wrong next to a wall.
 */
export function terrainColour(col: number, row: number): string {
  const base = BASE[terrainKind(col, row)];
  const height = smoothNoise(col * 1.4 + 9, row * 1.4 + 3, 2.5);
  return mix(base, height > 0.5 ? LIGHT.warm : LIGHT.cool, Math.abs(height - 0.5) * 0.34);
}

/** How visible a tile outside the field still is: the land runs out rather than stopping. */
export function edgeCover(col: number, row: number, margin: number): number {
  const dx = col < 0 ? -col : (col >= GRID_COLS ? col - GRID_COLS + 1 : 0);
  const dy = row < 0 ? -row : (row >= GRID_ROWS ? row - GRID_ROWS + 1 : 0);
  const distance = Math.max(dx, dy);
  if (distance <= 0) return 1;
  return Math.max(0, 1 - distance / (margin + 0.5));
}

/** How far past the playing field the land keeps going. */
export const TERRAIN_MARGIN = 5;

/**
 * Everything on one tile beyond its base colour.
 *
 * Exported separately so the amount of debris can be counted in a test — "the
 * ground has texture" is otherwise a matter of opinion, and opinions do not
 * fail a build.
 */
export function tileDetail(col: number, row: number, x: number, y: number): Shape[] {
  const out: Shape[] = [];
  const kind = terrainKind(col, row);
  const a = noise(col, row);
  const b = noise(col * 1.7 + 31, row * 2.9 + 13);
  const c = noise(col * 5.3 + 7, row * 3.1 + 41);

  /*
   * Sand ripples. Position and length differ per tile, or they line up into
   * regular stripes across the whole field — which reads as a texture bug
   * rather than as sand.
   */
  if (kind !== 'grass' && b > 0.42) {
    const count = c > 0.6 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const centre = (noise(col * 2.3 + i * 9.1, row * 4.7 + i * 3.3) - 0.5) * (TILE_HEIGHT - 4);
      const half = (TILE_WIDTH / 2 - 6) * (0.45 + noise(col + i * 17, row * 1.3) * 0.5);
      const side = noise(col * 0.7 + i, row * 1.9) > 0.5 ? 1 : -1;
      const mx = x + side * (TILE_WIDTH / 4) * noise(col * 3.1, row + i) * 0.8;
      out.push({
        kind: 'line',
        points: [[mx - half, y + centre], [mx, y + centre - 2], [mx + half, y + centre]],
        colour: PALETTE.earth[4]!, width: 1, alpha: 0.12 + b * 0.16,
      });
    }
  }

  // Dry cracks in trodden earth.
  if (kind === 'trodden' && c > 0.5) {
    out.push({
      kind: 'line',
      points: [[x - 7, y - 2], [x - 1, y + 1], [x + 6, y - 2]],
      colour: PALETTE.earth[0]!, width: 1, alpha: 0.42,
    });
  }

  // Gravel, each stone with its own small shadow and lit top edge. This is the
  // single cheapest thing that stops a fill looking like a fill.
  if (a > 0.82) {
    const gx = x - 6 + b * 12;
    const gy = y - 3 + c * 6;
    const size = 1 + Math.round(c * 2);
    out.push({ kind: 'rect', x: gx - size + 1, y: gy + 1, w: size * 2, h: size,
      fill: PALETTE.earth[0]!, alpha: 0.3 });
    out.push({ kind: 'rect', x: gx - size, y: gy, w: size * 2, h: size,
      fill: b > 0.5 ? PALETTE.earth[4]! : PALETTE.earth[3]! });
    out.push({ kind: 'rect', x: gx - size, y: gy, w: size, h: 1,
      fill: LIGHT.warm, alpha: 0.45 });
  }

  // Tufts of grass: three blades, leaning the same way as their neighbours.
  if ((kind === 'grass' || kind === 'scrub') && b > 0.55) {
    const tx = x - 8 + a * 16;
    const ty = y - 2 + c * 5;
    const lean = (noise(col * 3.7, row * 1.1) - 0.5) * 3;
    for (let i = -1; i <= 1; i++) {
      out.push({
        kind: 'line',
        points: [[tx + i * 2, ty], [tx + i * 2 + lean, ty - 3 - Math.abs(i)]],
        colour: PALETTE.grass[3]!, width: 1, alpha: 0.55,
      });
    }
  }

  // Cart ruts, where the ground has been worked over often.
  if (kind === 'trodden' && b > 0.7) {
    out.push({
      kind: 'line',
      points: [[x - TILE_WIDTH / 2 + 4, y + 2], [x, y - 1], [x + TILE_WIDTH / 2 - 4, y + 2]],
      colour: PALETTE.earth[0]!, width: 2, alpha: 0.22,
    });
  }

  return out;
}

/**
 * The whole ground, as ONE list of drawing instructions in screen space.
 *
 * Back to front, so a tile's debris never lands under its neighbour. The
 * caller draws this into a single object: the ground does not move, so it
 * should cost one sprite rather than four hundred.
 */
export function buildTerrain(camera: Camera): readonly Shape[] {
  const shapes: Shape[] = [];
  const margin = TERRAIN_MARGIN;

  for (let row = -margin; row < GRID_ROWS + margin; row++) {
    for (let col = -margin; col < GRID_COLS + margin; col++) {
      const cover = edgeCover(col, row, margin);
      if (cover <= 0.02) continue;

      const screen = toScreen({ col, row }, camera);
      const x = screen.x;
      const y = screen.y;

      /*
       * Outside the playing field the land falls back into cool shadow, so the
       * stage lies in the light and the rest lies beside it. That single mix
       * is most of why the legacy battlefield has a focus and mine had none.
       */
      const colour = cover >= 1
        ? terrainColour(col, row)
        : mix(terrainColour(col, row), LIGHT.cool, 0.26);

      shapes.push({
        kind: 'diamond', cx: x, cy: y,
        w: TILE_WIDTH, h: TILE_HEIGHT, fill: colour, alpha: cover,
      });

      // No gravel and no grass out in the margin: it would only be noise at
      // the edge of vision, and it costs as much as the field does.
      if (cover >= 1) shapes.push(...tileDetail(col, row, x, y));
    }
  }

  return shapes;
}
