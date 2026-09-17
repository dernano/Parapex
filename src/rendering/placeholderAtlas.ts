import {
  LIGHT, PALETTE, TILE_HEIGHT, TILE_WIDTH, UNIT_HEIGHT,
} from './artRules';
import { scaledUnitHeight } from './presentation/settings';
import { visualForProjectile } from './effects/projectileVisual';
import { buildTerrain } from './procedural/terrain';
import { scenerySprite, type SceneryKind } from './procedural/scenery';
import {
  BANNER_RISE, PARAPET_RISE, bannerSprite, towerBody, towerCrown,
  wallSegment as curtainWall,
} from './procedural/castle';

export { BANNER_RISE };
import { weaponFor } from './procedural/weapons';

export { PARAPET_RISE };

/**
 * PLACEHOLDER ART. Explicitly, and labelled as such everywhere it appears.
 *
 * These are not the game's sprites and must never be mistaken for them. They
 * exist so the rendering system — projection, layers, anchors, depth order,
 * sockets, recoil — can be built and PROVEN before a single real asset is
 * drawn, which is the order the brief asks for.
 *
 * They obey the bible: one sun from the upper right, the ramps from the
 * palette, 2:1 diamonds, the height bands. That is deliberate too — a
 * placeholder built to the rules shows immediately whether the rules produce a
 * readable silhouette, and a placeholder that ignores them teaches nothing.
 *
 * What they are NOT is authored art. Soldiers with character, a castle with
 * believable stone mass and a commander's portrait in graphite need a person
 * who draws. This file is scaffolding and is meant to be deleted.
 */

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export const rgbToHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Mix a base colour toward another, the way the bible shades a face. */
export function mix(base: string, toward: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(toward);
  return rgbToHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

/** The three faces of a block, lit by the one sun from the upper right. */
export function facesOf(base: string): { top: string; right: string; left: string } {
  return {
    top: mix(base, LIGHT.warm, LIGHT.topMix),
    right: mix(base, LIGHT.warm, LIGHT.rightMix),
    left: mix(base, LIGHT.cool, LIGHT.leftMix),
  };
}

/** A drawing instruction. Plain data, so the atlas is testable without a GPU. */
export type Shape =
  | { readonly kind: 'diamond'; readonly cx: number; readonly cy: number;
      readonly w: number; readonly h: number; readonly fill: string;
      readonly alpha?: number }
  | { readonly kind: 'box'; readonly cx: number; readonly cy: number;
      readonly w: number; readonly h: number; readonly depth: number;
      readonly base: string }
  | { readonly kind: 'rect'; readonly x: number; readonly y: number;
      readonly w: number; readonly h: number; readonly fill: string;
      readonly alpha?: number }
  /** An arbitrary outline. Trees, rocks, roofs — anything not a box. */
  | { readonly kind: 'poly'; readonly points: readonly (readonly [number, number])[];
      readonly fill: string; readonly alpha?: number }
  /** A line. Cracks, cart ruts, mortar joints, grass blades. */
  | { readonly kind: 'line'; readonly points: readonly (readonly [number, number])[];
      readonly colour: string; readonly width?: number; readonly alpha?: number }
  | { readonly kind: 'ellipse'; readonly cx: number; readonly cy: number;
      readonly rx: number; readonly ry: number; readonly fill: string;
      readonly alpha?: number };

const ramp = (family: keyof typeof PALETTE, step: number): string =>
  PALETTE[family][Math.min(step, PALETTE[family].length - 1)]!;

export interface PlaceholderSprite {
  readonly width: number;
  readonly height: number;
  /** The point that touches the tile: bottom centre of the footprint. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly shapes: readonly Shape[];
  /**
   * Sockets, relative to the sprite's own top-left.
   *
   * Units do NOT carry them: a unit's sockets live in `UNIT_VISUALS` and
   * nowhere else, because two tables of the same fact disagreed by four
   * pixels once already.
   */
  readonly sockets?: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
}

/**
 * One tile of ground, for anything that still asks for a single one.
 *
 * The battlefield itself no longer does — it is one drawing, in
 * `procedural/terrain.ts`. This remains for previews and for the atlas test.
 */
export function groundTile(variant: number): PlaceholderSprite {
  const family = variant % 2 === 0 ? 'earth' : 'grass';
  return {
    width: TILE_WIDTH, height: TILE_HEIGHT,
    anchor: { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 },
    shapes: [{
      kind: 'diamond', cx: TILE_WIDTH / 2, cy: TILE_HEIGHT / 2,
      w: TILE_WIDTH, h: TILE_HEIGHT,
      fill: ramp(family, 1 + (variant >> 1)),
    }],
  };
}

export function unitFigure(
  branch: string,
  band: keyof typeof UNIT_HEIGHT,
  scale = 1,
): PlaceholderSprite {
  /*
   * The height comes from the SCALE PROBE, in whole pixels. This is the one
   * place the four candidate sizes actually take effect, and it is why they
   * can be compared in the real combat screen instead of on a white
   * background: everything else about the scene is untouched.
   */
  const height = scaledUnitHeight(band, scale);
  const width = Math.max(10, Math.round(14 * scale));
  /*
   * THE FIGURE FILLS ITS BOX.
   *
   * It used to be laid out with offsets measured from the bottom — helmet at
   * `height - 22`, boots at `height - 4` — which left five pixels of dead air
   * above the helmet and drew a 27-pixel soldier 22 pixels tall. The size
   * probe found it: 125 % of the placeholder came out at exactly the height
   * the bible already specifies, which is another way of saying the
   * placeholder had been undersized by a fifth all along.
   *
   * It also explains the sockets. `UNIT_VISUALS` puts a cannon's muzzle at
   * y = 11 on a 26-pixel figure — chest height on a soldier who fills his box,
   * and floating above the helmet of one who does not.
   *
   * So the proportions are fractions of the height, and the drawn extent
   * equals the declared one. `drawnBounds` asserts it.
   */
  const part = (fraction: number): number => Math.max(1, Math.round(height * fraction));
  const cloth: Record<string, string> = {
    bow: PALETTE.heraldic[2]!, crossbow: PALETTE.heraldic[1]!,
    artillery: PALETTE.heraldic[3]!, gunner: PALETTE.heraldic[0]!,
  };
  return {
    width, height,
    anchor: { x: width / 2, y: height },
    shapes: [
      /*
       * THE WEAPON COMES FIRST, and it is here for a reason the diagnostic
       * screenshot made obvious: the muzzle socket for a cannon sits at x = 17
       * on a figure fourteen pixels wide, because a barrel projects past the
       * man holding it. With no weapon drawn, the muzzle flash appeared in
       * mid-air beside a soldier and looked broken — when in fact the socket
       * was exactly right and the placeholder was missing the thing it
       * attaches to.
       *
       * So the stub is drawn: a bar from the hands to the socket. It is not
       * art and is not meant to be. It is the proof that the socket is on the
       * weapon, and it will be deleted the day a real barrel replaces it.
       */
      ...weaponFor(branch, scale),
      // Helmet, body, boots: three value clusters, strong silhouette, no
      // detail that would vanish at gameplay distance.
      { kind: 'rect', x: Math.round(width * 0.2), y: 0,
        w: Math.round(width * 0.58), h: part(0.24), fill: ramp('iron', 3) },
      { kind: 'rect', x: Math.round(width * 0.29), y: part(0.24),
        w: Math.round(width * 0.42), h: part(0.60),
        fill: cloth[branch] ?? ramp('cloth', 1) },
      { kind: 'rect', x: Math.round(width * 0.33), y: height - part(0.16),
        w: Math.round(width * 0.34), h: part(0.16), fill: ramp('iron', 1) },
    ],
    /*
     * NO SOCKETS HERE. They live in `UNIT_VISUALS` and nowhere else.
     *
     * This file used to carry a second set, computed from the placeholder's
     * own box, and the two disagreed: the atlas put a cannon's muzzle at x 13,
     * the firing data at x 17. The debug overlay drew one and the flash
     * spawned at the other, which is the kind of split nobody notices until a
     * screenshot shows an effect four pixels off its barrel. One table.
     */
  };
}



/** A formation's standard, its connector, and the caption plate. */
export function formationPiece(
  variant: string, colour: string, accent: string, span = 40,
): PlaceholderSprite {
  if (variant === 'connector') {
    // Sized to the gap it actually bridges. A fixed-length bar floating
    // between two towers reads as debris, not as a line of standards.
    const width = Math.max(4, Math.round(span));
    return {
      width, height: 4, anchor: { x: width / 2, y: 2 },
      shapes: [{ kind: 'rect', x: 0, y: 0, w: width, h: 3, fill: colour }],
    };
  }
  if (variant === 'caption') {
    return {
      width: 4, height: 4, anchor: { x: 0, y: 4 },
      shapes: [],
    };
  }
  return {
    width: 12, height: 26, anchor: { x: 6, y: 26 },
    shapes: [
      { kind: 'rect', x: 5, y: 0, w: 2, h: 26, fill: ramp('wood', 1) },
      { kind: 'rect', x: 7, y: 2, w: 5, h: 10, fill: colour },
      { kind: 'rect', x: 7, y: 2, w: 5, h: 2, fill: accent },
    ],
  };
}

/**
 * A shot, drawn to the readability rules: dark outline, light core, big enough
 * to follow. The outline is a second, larger body underneath, which is how
 * pixel art gets a one-pixel edge without a stroke.
 */
export function projectileShape(kind: string): PlaceholderSprite {
  const visual = visualForProjectile(kind);
  const w = visual.length + 2;
  const h = visual.width + 2;
  return {
    width: w, height: h, anchor: { x: w / 2, y: h / 2 },
    shapes: [
      { kind: 'rect', x: 0, y: 0, w, h, fill: visual.outline },
      { kind: 'rect', x: 1, y: 1, w: visual.length, h: visual.width, fill: visual.core },
    ],
  };
}

/**
 * One of the enemy.
 *
 * Drawn as a DARK silhouette with one lit edge, not as a little man. At eleven
 * columns away the individual is not the point — the MASS is, and a mass reads
 * through contrast against the grass rather than through detail. The first
 * version used the mid cloth ramp over mid green and the whole army came out
 * as a row of faint sticks.
 */
export function enemyFigure(): PlaceholderSprite {
  const height = 22;
  return {
    width: 12, height,
    anchor: { x: 6, y: height },
    shapes: [
      // The silhouette, near black: the enemy is what the castle is aimed at.
      { kind: 'rect', x: 2, y: height - 20, w: 8, h: 20, fill: ramp('iron', 0) },
      // One lit edge from the sun in the upper right, so it is a body and not
      // a hole in the ground.
      { kind: 'rect', x: 8, y: height - 18, w: 2, h: 16, fill: ramp('iron', 2) },
      { kind: 'rect', x: 3, y: height - 20, w: 6, h: 4, fill: ramp('cloth', 0) },
    ],
  };
}

export function contactShadow(): PlaceholderSprite {
  return {
    width: TILE_WIDTH, height: TILE_HEIGHT,
    anchor: { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 },
    // Flattened diamond on the ground plane, not a screen-space drop shadow.
    shapes: [{ kind: 'diamond', cx: TILE_WIDTH / 2 - 3, cy: TILE_HEIGHT / 2 + 1,
      w: 18, h: 9, fill: LIGHT.cool }],
  };
}

/**
 * A mark in the earth.
 *
 * A flattened diamond on the ground plane, in the darkest earth tone — turned
 * soil, not a black hole. Its size and darkness come from the scene; this is
 * the shape only.
 */
export function groundScar(size: number): PlaceholderSprite {
  const w = Math.max(6, Math.round(size * 2));
  const h = Math.max(3, Math.round(size));
  return {
    width: w, height: h,
    anchor: { x: w / 2, y: h / 2 },
    shapes: [
      { kind: 'diamond', cx: w / 2, cy: h / 2, w, h, fill: ramp('earth', 0) },
      // One lighter rim on the sunward side: thrown earth, not a stain.
      { kind: 'diamond', cx: w / 2, cy: h / 2 - 1, w: w * 0.6, h: h * 0.6,
        fill: ramp('earth', 1) },
    ],
  };
}

export function projectileDot(): PlaceholderSprite {
  return {
    width: 4, height: 4, anchor: { x: 2, y: 2 },
    shapes: [{ kind: 'rect', x: 0, y: 0, w: 4, h: 4, fill: ramp('iron', 4) }],
  };
}

export interface PlaceholderOptions {
  /** The unit scale probe. Whole pixels come out the other side. */
  readonly scale?: number;
  readonly colour?: string;
  readonly accent?: string;
  /** How far a formation connector has to reach, in screen pixels. */
  readonly span?: number;
  /** How wide a ground scar is, in logical pixels. */
  readonly size?: number;
  /** Which of a piece of scenery's three shapes to draw, and how large. */
  readonly variant?: number;
  /** The whole ground is one drawing, and it needs the camera to place it. */
  readonly camera?: { readonly originX: number; readonly originY: number };
}

/** Resolve a scene node's sprite name to a placeholder. */
export function placeholderFor(
  sprite: string,
  options: PlaceholderOptions = {},
): PlaceholderSprite {
  const [family, ...rest] = sprite.split('/');
  switch (family) {
    case 'ground': return groundTile(Number(rest[0]) || 0);
    case 'terrain':
      /*
       * The whole field in one sprite. Its anchor is the camera's origin, so
       * the shapes can be built in screen space once and then simply placed —
       * which is what makes a ground with gravel in it affordable.
       */
      return {
        width: 0, height: 0,
        anchor: { x: options.camera?.originX ?? 0, y: options.camera?.originY ?? 0 },
        shapes: buildTerrain(options.camera ?? { originX: 0, originY: 0 }),
      };
    case 'scenery':
      return scenerySprite((rest[0] ?? 'bush') as SceneryKind,
        options.variant ?? 0, options.scale ?? 1);
    case 'castle': {
      const name = rest[0] ?? '';
      if (name === 'wall') return curtainWall();
      if (name.startsWith('parapet-')) return towerCrown(name.replace('parapet-', ''));
      if (name.startsWith('banner-')) return bannerSprite(name.replace('banner-', ''));
      return towerBody(name.replace('tower-', ''));
    }
    case 'unit':
      return unitFigure(rest[0] ?? 'bow',
        bandOf(rest[1]), options.scale ?? 1);
    case 'enemy': return enemyFigure();
    case 'projectile': return projectileShape(rest[0] ?? 'arrow');
    case 'formation':
      return formationPiece(rest[0] ?? 'standardLine',
        options.colour ?? PALETTE.heraldic[0]!, options.accent ?? PALETTE.heraldic[3]!,
        options.span);
    case 'fx':
      return rest[0] === 'scar' ? groundScar(options.size ?? 8) : contactShadow();
    default: return projectileDot();
  }
}

/**
 * A unit's height band, with the ghost folded in.
 *
 * A dragged card's ghost has no rank of its own — it is the silhouette of what
 * WOULD stand there — so it borrows the professional band, the middle of the
 * three, rather than inventing a fourth size.
 */
function bandOf(name: string | undefined): keyof typeof UNIT_HEIGHT {
  if (name && name in UNIT_HEIGHT) return name as keyof typeof UNIT_HEIGHT;
  return 'professional';
}

/* ---------- What a sprite actually covers ---------- */

export interface DrawnBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The extent a placeholder REALLY occupies, computed from its shapes.
 *
 * Not from `width` and `height` — those are the declared box, and the two
 * disagreed for every block in this file. A box extrudes upward from `cy` by
 * its depth and then puts a diamond on top, so its topmost pixel sits well
 * above whatever the metadata claims. Reading the metadata is how the parapet
 * measured as covering forty per cent of a soldier while covering all of him.
 *
 * Returned relative to the sprite's own anchor, so it can be added straight to
 * a node's screen position.
 */
export function drawnBounds(sprite: PlaceholderSprite): DrawnBounds {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const take = (x0: number, y0: number, x1: number, y1: number): void => {
    left = Math.min(left, x0); top = Math.min(top, y0);
    right = Math.max(right, x1); bottom = Math.max(bottom, y1);
  };

  for (const shape of sprite.shapes) {
    switch (shape.kind) {
      case 'rect':
        take(shape.x, shape.y, shape.x + shape.w, shape.y + shape.h);
        break;
      case 'diamond':
      case 'ellipse': {
        const w = shape.kind === 'diamond' ? shape.w / 2 : shape.rx;
        const h = shape.kind === 'diamond' ? shape.h / 2 : shape.ry;
        take(shape.cx - w, shape.cy - h, shape.cx + w, shape.cy + h);
        break;
      }
      case 'poly':
      case 'line':
        for (const [x, y] of shape.points) take(x, y, x, y);
        break;
      case 'box':
        // Side faces run from cy up by depth; the lit top diamond sits above
        // that, centred at cy - depth - h/2.
        take(shape.cx - shape.w / 2, shape.cy - shape.depth - shape.h,
          shape.cx + shape.w / 2, shape.cy);
        break;
    }
  }

  if (left === Infinity) return { left: 0, top: 0, right: 0, bottom: 0 };
  return {
    left: left - sprite.anchor.x,
    top: top - sprite.anchor.y,
    right: right - sprite.anchor.x,
    bottom: bottom - sprite.anchor.y,
  };
}
