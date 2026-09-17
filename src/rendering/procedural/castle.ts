import { LIGHT, PALETTE, TILE_HEIGHT, TILE_WIDTH } from '../artRules';
import { mix, type PlaceholderSprite, type Shape } from '../placeholderAtlas';
import { noise } from './noise';

/**
 * THE CASTLE, AS MASONRY.
 *
 * A tower is not a grey cube. What makes stone read as stone at this size is
 * three things, and all three are cheap:
 *
 *  1. COURSES. Horizontal joints, every few pixels, each course a shade off
 *     its neighbours. Without them a wall is a gradient; with them it is
 *     built. This is the single highest-value line in the file.
 *  2. A BATTER. The base is wider than the top. A vertical box reads as a
 *     crate; a wall that leans in reads as something that has to hold itself
 *     up.
 *  3. A CROWN THAT IS NOT THE WALL. Merlons with gaps between them, and a
 *     wooden deck behind them for the garrison to stand on. The change of
 *     material at the top is what tells the eye where the tower ends.
 *
 * Everything is lit by the one sun from the upper right, like every other
 * asset: left face cool, right face barely warmed, top face warm.
 */

const STONE = PALETTE.stone;
const WOOD = PALETTE.wood;

/** How tall one course of stone is. Small enough to read as courses, not steps. */
const COURSE = 5;

/**
 * A face of masonry: the base colour, then the joints, then a few stones
 * picked out lighter or darker so the courses do not march.
 */
function masonry(
  x: number, y: number, w: number, h: number,
  base: string, seed: number,
): Shape[] {
  const out: Shape[] = [
    { kind: 'rect', x, y, w, h, fill: base },
  ];

  const joint = mix(base, '#1a1510', 0.45);
  let course = 0;
  for (let cy = y + COURSE; cy < y + h; cy += COURSE, course++) {
    out.push({ kind: 'rect', x, y: cy, w, h: 1, fill: joint, alpha: 0.55 });

    /*
     * Vertical joints, offset every other course — the bond. Running them in
     * line would produce a grid, which reads as tiling rather than as
     * stonework.
     */
    const offset = course % 2 === 0 ? 0 : COURSE;
    for (let jx = x + offset + COURSE; jx < x + w - 1; jx += COURSE * 2) {
      out.push({
        kind: 'rect', x: jx, y: cy - COURSE + 1, w: 1, h: COURSE - 1,
        fill: joint, alpha: 0.38,
      });
    }

    // One stone in six catches the light differently.
    const roll = noise(seed + course * 3.1, course * 7.7);
    if (roll > 0.62) {
      const sx = x + Math.floor(roll * (w - COURSE * 2));
      out.push({
        kind: 'rect', x: sx, y: cy - COURSE + 1, w: COURSE * 2 - 1, h: COURSE - 1,
        fill: roll > 0.85 ? mix(base, LIGHT.warm, 0.14) : mix(base, LIGHT.cool, 0.12),
      });
    }
  }
  return out;
}

/** Merlons with the gaps between them: the shape that says "castle" fastest. */
function crenellation(
  x: number, y: number, w: number, height: number, base: string,
): Shape[] {
  const out: Shape[] = [];
  const merlon = 7;
  const gap = 5;
  for (let mx = x; mx < x + w - 2; mx += merlon + gap) {
    const width = Math.min(merlon, x + w - mx);
    out.push({ kind: 'rect', x: mx, y, w: width, h: height, fill: base });
    // The lit top edge of each merlon.
    out.push({ kind: 'rect', x: mx, y, w: width, h: 1, fill: mix(base, LIGHT.warm, 0.3) });
    // And its shadowed left cheek.
    out.push({ kind: 'rect', x: mx, y, w: 1, h: height, fill: mix(base, LIGHT.cool, 0.3) });
  }
  return out;
}

/** Heights by type, within the bible's 70–96 band. */
const TOWER_HEIGHT: Readonly<Record<string, number>> = {
  watchtower: 70, archerTower: 78, ballistaTower: 82, cannonTower: 88, powderTower: 96,
};

/** A banner colour per tower type, so five towers are five places. */
const BANNER: Readonly<Record<string, string>> = {
  watchtower: PALETTE.heraldic[1]!,
  archerTower: PALETTE.heraldic[2]!,
  ballistaTower: PALETTE.heraldic[3]!,
  cannonTower: PALETTE.heraldic[0]!,
  powderTower: PALETTE.heraldic[0]!,
};

/**
 * The tower's body: everything BELOW the garrison's feet.
 *
 * Drawn as a front face and one visible side, both battered, both coursed,
 * with a lit top edge where the deck will sit. The parapet in front of the
 * garrison is a separate sprite — see `parapetBlock` — because the soldier
 * stands between them.
 */
export function towerBody(type: string): PlaceholderSprite {
  const height = TOWER_HEIGHT[type] ?? 70;
  const width = TILE_WIDTH * 2;
  const footprint = TILE_HEIGHT * 2;
  const seed = width + height;

  const faceWidth = Math.round(width * 0.46);
  const sideWidth = Math.round(width * 0.22);
  const cx = width / 2;
  // The batter: three pixels narrower at the top than at the base.
  const batter = 3;

  const front = mix(STONE[2]!, LIGHT.warm, LIGHT.rightMix);
  const side = mix(STONE[1]!, LIGHT.cool, LIGHT.leftMix);
  const top = mix(STONE[3]!, LIGHT.warm, LIGHT.topMix);

  const baseY = height + footprint / 2;
  const shapes: Shape[] = [
    // The shadow the mass throws on the ground, toward the lower left.
    { kind: 'ellipse', cx: cx - 6, cy: baseY + 2, rx: width * 0.34, ry: footprint * 0.28,
      fill: '#141009', alpha: 0.4 },

    // The left face, in shadow.
    { kind: 'poly', fill: side, points: [
      [cx - faceWidth / 2 - sideWidth, baseY - footprint * 0.28],
      [cx - faceWidth / 2, baseY],
      [cx - faceWidth / 2 + batter, baseY - height],
      [cx - faceWidth / 2 - sideWidth + batter, baseY - height - footprint * 0.28],
    ] },
    ...masonry(cx - faceWidth / 2 - sideWidth + batter, baseY - height,
      sideWidth - batter, height - footprint * 0.28, side, seed + 11)
      .slice(1),

    // The right face, toward the light.
    ...masonry(cx - faceWidth / 2 + batter, baseY - height,
      faceWidth - batter * 2, height, front, seed),
  ];

  // The lit rim where the deck meets the stone.
  shapes.push({
    kind: 'rect', x: cx - faceWidth / 2 + batter - 2, y: baseY - height - 2,
    w: faceWidth - batter * 2 + 4, h: 3, fill: top,
  });

  return { width, height: height + footprint, anchor: { x: cx, y: baseY }, shapes };
}

/**
 * The crown: the wooden deck the garrison stands on, its merlons, and the
 * banner.
 *
 * It is a SEPARATE sprite from the body and sits in front of the soldier —
 * that is the occlusion the whole castle is built around. It is deliberately
 * low: a parapet that hides the garrison solves the layering and loses the
 * garrison, which is what the first version did.
 */
export const PARAPET_RISE = 9;

export function towerCrown(_type: string): PlaceholderSprite {
  const width = TILE_WIDTH * 2;
  const thickness = Math.round(TILE_HEIGHT * 0.55);
  const height = PARAPET_RISE + thickness;
  const deckWidth = Math.round(width * 0.62);
  const x = (width - deckWidth) / 2;

  const stone = mix(STONE[2]!, LIGHT.warm, LIGHT.rightMix);
  const deck = mix(WOOD[2]!, LIGHT.warm, 0.1);

  const shapes: Shape[] = [
    // The planked deck, seen edge-on: a band of wood with its boards.
    { kind: 'rect', x, y: height - thickness, w: deckWidth, h: thickness, fill: deck },
  ];
  for (let bx = x + 4; bx < x + deckWidth; bx += 5) {
    shapes.push({
      kind: 'rect', x: bx, y: height - thickness, w: 1, h: thickness,
      fill: mix(WOOD[0]!, '#000000', 0), alpha: 0.35,
    });
  }
  // The lit upper edge of the planking.
  shapes.push({ kind: 'rect', x, y: height - thickness, w: deckWidth, h: 1,
    fill: mix(deck, LIGHT.warm, 0.3) });

  // The merlons in front of it.
  shapes.push(...crenellation(x, height - thickness - PARAPET_RISE, deckWidth,
    PARAPET_RISE, stone));

  return { width, height, anchor: { x: width / 2, y: height }, shapes };
}

/**
 * A curtain wall segment: lower than a tower, coursed, with a walkway on top
 * and its own small merlons.
 */
export function wallSegment(): PlaceholderSprite {
  const height = 38;
  const width = TILE_WIDTH;
  const footprint = TILE_HEIGHT;
  const baseY = height + footprint / 2;
  const face = mix(STONE[1]!, LIGHT.warm, LIGHT.rightMix);
  const seed = 7;

  return {
    width, height: height + footprint,
    anchor: { x: width / 2, y: baseY },
    shapes: [
      { kind: 'ellipse', cx: width / 2 - 4, cy: baseY + 1, rx: width * 0.4, ry: 4,
        fill: '#141009', alpha: 0.35 },
      ...masonry(4, baseY - height, width - 8, height, face, seed),
      // The walkway behind the merlons.
      { kind: 'rect', x: 4, y: baseY - height - 3, w: width - 8, h: 3,
        fill: mix(WOOD[2]!, LIGHT.warm, 0.12) },
      ...crenellation(4, baseY - height - 9, width - 8, 6,
        mix(STONE[2]!, LIGHT.warm, LIGHT.rightMix)),
    ],
  };
}

/**
 * The banner, as its OWN sprite.
 *
 * It was part of the crown, and that broke the occlusion measurement: a pole
 * rising twenty-two pixels above the merlons made the parapet's drawn bounds
 * cover the soldier from the knee to well over his head, so the test that
 * checks the garrison stays visible failed on a change that had not touched
 * the garrison at all.
 *
 * Separating it is not a workaround. A banner IS a separate object: it stands
 * at a different height, it belongs above everything rather than in front of
 * one soldier, and one day it will move in a wind the stone does not feel.
 */
export function bannerSprite(type: string): PlaceholderSprite {
  const flag = BANNER[type] ?? PALETTE.heraldic[0]!;
  const height = 30;
  const width = 12;
  return {
    width, height,
    anchor: { x: 1, y: height },
    shapes: [
      { kind: 'rect', x: 0, y: 0, w: 1, h: height, fill: WOOD[1]! },
      { kind: 'poly', fill: flag, points: [
        [1, 1], [11, 4], [8, 9], [11, 14], [1, 13],
      ] },
      { kind: 'rect', x: 1, y: 1, w: 9, h: 1, fill: mix(flag, LIGHT.warm, 0.35) },
      // The dark fold where the cloth turns away from the sun.
      { kind: 'poly', fill: mix(flag, LIGHT.cool, 0.3), points: [
        [8, 9], [11, 14], [6, 12],
      ] },
    ],
  };
}

/** How far above the platform a banner flies. */
export const BANNER_RISE = 30;
