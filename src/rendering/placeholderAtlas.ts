import {
  LIGHT, PALETTE, TILE_HEIGHT, TILE_WIDTH, UNIT_HEIGHT,
} from './artRules';
import { scaledUnitHeight } from './presentation/settings';
import { visualForProjectile } from './effects/projectileVisual';
import { UNIT_VISUALS } from './units/UnitVisual';
import type { BranchId } from '@/core/types';

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
      readonly w: number; readonly h: number; readonly fill: string }
  | { readonly kind: 'box'; readonly cx: number; readonly cy: number;
      readonly w: number; readonly h: number; readonly depth: number;
      readonly base: string }
  | { readonly kind: 'rect'; readonly x: number; readonly y: number;
      readonly w: number; readonly h: number; readonly fill: string };

export interface PlaceholderSprite {
  readonly width: number;
  readonly height: number;
  /** The point that touches the tile: bottom centre of the footprint. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly shapes: readonly Shape[];
  /** Sockets, relative to the sprite's own top-left. */
  readonly sockets?: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
}

/** Round a design pixel through the scale probe. Whole pixels only, always. */
const scaleBy = (value: number, scale: number): number => Math.max(1, Math.round(value * scale));

const ramp = (family: keyof typeof PALETTE, step: number): string =>
  PALETTE[family][Math.min(step, PALETTE[family].length - 1)]!;

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

export function wallSegment(): PlaceholderSprite {
  const height = 34;
  return {
    width: TILE_WIDTH, height: height + TILE_HEIGHT,
    anchor: { x: TILE_WIDTH / 2, y: height + TILE_HEIGHT / 2 },
    shapes: [{
      kind: 'box', cx: TILE_WIDTH / 2, cy: height + TILE_HEIGHT / 2,
      w: TILE_WIDTH, h: TILE_HEIGHT, depth: height, base: ramp('stone', 2),
    }],
  };
}

/** Tower heights by type, within the bible's 70–96 band. */
const TOWER_HEIGHT: Readonly<Record<string, number>> = {
  watchtower: 70, archerTower: 78, ballistaTower: 82, cannonTower: 88, powderTower: 96,
};

export function towerBlock(type: string): PlaceholderSprite {
  const height = TOWER_HEIGHT[type] ?? 70;
  const width = TILE_WIDTH * 2;
  const footprint = TILE_HEIGHT * 2;
  return {
    width, height: height + footprint,
    anchor: { x: width / 2, y: height + footprint / 2 },
    shapes: [
      { kind: 'box', cx: width / 2, cy: height + footprint / 2,
        /*
         * A DARKER stone than the bible's mid tone, deliberately. At ramp 3
         * the placeholder tower is so pale that a soldier standing on it
         * disappears, and the whole point of the workbench is to judge the
         * soldier. Still inside the palette; still one sun.
         */
        w: width * 0.8, h: footprint * 0.8, depth: height, base: ramp('stone', 1) },
      // Crenellations: a lighter band on the lit top.
      { kind: 'diamond', cx: width / 2, cy: footprint / 2 + 2,
        w: width * 0.86, h: footprint * 0.86, fill: mix(ramp('stone', 2), LIGHT.warm, 0.18) },
    ],
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
      weaponStub(branch, height, scale),
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

/**
 * The parapet: the near merlons the garrison stands BEHIND.
 *
 * THE PROPORTIONS ARE THE WHOLE POINT, and the first version of this got them
 * badly wrong: a full-height block in front of the soldier occludes him
 * perfectly and hides him completely, which solves the layering and loses the
 * garrison. A screenshot found that in one glance; the test that was supposed
 * to catch it only asserted the two OVERLAPPED.
 *
 * So the rim is deliberately low. It sits eleven pixels down-screen of the
 * figure's feet, and its total height is set so its top lands around the
 * soldier's knee — enough that he is standing in the architecture, far too
 * little to swallow him. `PARAPET_RISE` is that number, and the visibility
 * test reads it rather than trusting it.
 */
export const PARAPET_RISE = 9;

/**
 * A bar from the hands to the muzzle socket, in the family's own proportions.
 *
 * Scaffolding, explicitly. What it buys is that every socket in
 * `UNIT_VISUALS` becomes visibly right or visibly wrong instead of being a
 * number nobody can check.
 */
function weaponStub(branch: string, height: number, scale: number): Shape {
  const visual = UNIT_VISUALS[branch as BranchId];
  if (!visual) return { kind: 'rect', x: 0, y: 0, w: 1, h: 1, fill: ramp('iron', 1) };
  const muzzle = visual.sockets.muzzle;
  const pivot = visual.sockets.recoilPivot;
  const x = Math.round(Math.min(pivot.x, muzzle.x) * scale);
  // Straight from the socket: the figure fills its box, so socket y IS the
  // distance from the top of the sprite. The shim that used to sit here was
  // compensating for a soldier who did not.
  const y = Math.round(Math.min(pivot.y, muzzle.y) * scale);
  return {
    kind: 'rect',
    x, y,
    w: Math.max(2, Math.round(Math.abs(muzzle.x - pivot.x) * scale)),
    h: Math.max(2, Math.round(Math.abs(muzzle.y - pivot.y) * scale)),
    // Artillery and guns are wood and iron; bows are wood.
    fill: branch === 'gunner' ? ramp('iron', 1) : ramp('wood', 2),
  };
}

export function parapetBlock(_type: string): PlaceholderSprite {
  const width = TILE_WIDTH * 2;
  // A thin diamond, not the tower's whole two-by-two footprint: a rim has
  // depth, not volume.
  const thickness = Math.round(TILE_HEIGHT * 0.55);
  const height = PARAPET_RISE + thickness;
  return {
    width, height,
    anchor: { x: width / 2, y: height },
    shapes: [
      /*
       * `cy` is the BOTTOM of the block, not its middle.
       *
       * A box draws from `cy` upward by `depth` plus the thickness of its top
       * diamond, so putting `cy` half a thickness up puts the whole rim six
       * pixels higher than the declared box says. That is exactly how a
       * parapet measured at "forty per cent of the soldier" ended up hiding
       * all of him except his helmet: the metadata and the drawing disagreed,
       * and the test read the metadata. `drawnBounds` now settles it.
       */
      { kind: 'box', cx: width / 2, cy: height,
        w: width * 0.8, h: thickness, depth: PARAPET_RISE, base: ramp('stone', 3) },
    ],
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
}

/** Resolve a scene node's sprite name to a placeholder. */
export function placeholderFor(
  sprite: string,
  options: PlaceholderOptions = {},
): PlaceholderSprite {
  const [family, ...rest] = sprite.split('/');
  switch (family) {
    case 'ground': return groundTile(Number(rest[0]) || 0);
    case 'castle': {
      const name = rest[0] ?? '';
      if (name === 'wall') return wallSegment();
      if (name.startsWith('parapet-')) return parapetBlock(name.replace('parapet-', ''));
      return towerBlock(name.replace('tower-', ''));
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
    case 'fx': return contactShadow();
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
    if (shape.kind === 'rect') {
      take(shape.x, shape.y, shape.x + shape.w, shape.y + shape.h);
    } else if (shape.kind === 'diamond') {
      take(shape.cx - shape.w / 2, shape.cy - shape.h / 2,
        shape.cx + shape.w / 2, shape.cy + shape.h / 2);
    } else {
      // Side faces run from cy up by depth; the lit top diamond sits above
      // that, centred at cy - depth - h/2.
      take(shape.cx - shape.w / 2, shape.cy - shape.depth - shape.h,
        shape.cx + shape.w / 2, shape.cy);
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
