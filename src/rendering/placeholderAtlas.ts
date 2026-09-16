import {
  LIGHT, PALETTE, TILE_HEIGHT, TILE_WIDTH, UNIT_HEIGHT,
} from './artRules';

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
        w: width * 0.8, h: footprint * 0.8, depth: height, base: ramp('stone', 3) },
      // Crenellations: a lighter band on the lit top.
      { kind: 'diamond', cx: width / 2, cy: footprint / 2 + 2,
        w: width * 0.86, h: footprint * 0.86, fill: mix(ramp('stone', 4), LIGHT.warm, 0.2) },
    ],
  };
}

export function unitFigure(branch: string, band: keyof typeof UNIT_HEIGHT): PlaceholderSprite {
  const [low, high] = UNIT_HEIGHT[band];
  const height = Math.round((low + high) / 2);
  const width = 14;
  const cloth: Record<string, string> = {
    bow: PALETTE.heraldic[2]!, crossbow: PALETTE.heraldic[1]!,
    artillery: PALETTE.heraldic[3]!, gunner: PALETTE.heraldic[0]!,
  };
  return {
    width, height,
    anchor: { x: width / 2, y: height },
    shapes: [
      // Body, then helmet: two value clusters, strong silhouette, no detail
      // that would vanish at gameplay distance.
      { kind: 'rect', x: 4, y: height - 16, w: 6, h: 12, fill: cloth[branch] ?? ramp('cloth', 1) },
      { kind: 'rect', x: 3, y: height - 22, w: 8, h: 6, fill: ramp('iron', 3) },
      { kind: 'rect', x: 5, y: height - 4, w: 4, h: 4, fill: ramp('iron', 1) },
    ],
    sockets: {
      // The bowstring / nut / barrel mouth sits at shoulder height, out front.
      muzzle: { x: width - 1, y: height - 17 },
      recoilPivot: { x: width / 2, y: height - 12 },
      smoke: { x: width + 1, y: height - 17 },
      banner: { x: width / 2, y: 0 },
    },
  };
}

export function enemyFigure(): PlaceholderSprite {
  const height = 22;
  return {
    width: 12, height,
    anchor: { x: 6, y: height },
    shapes: [
      { kind: 'rect', x: 3, y: height - 14, w: 6, h: 10, fill: ramp('cloth', 0) },
      { kind: 'rect', x: 3, y: height - 19, w: 6, h: 5, fill: ramp('iron', 1) },
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

/** Resolve a scene node's sprite name to a placeholder. */
export function placeholderFor(sprite: string): PlaceholderSprite {
  const [family, ...rest] = sprite.split('/');
  switch (family) {
    case 'ground': return groundTile(Number(rest[0]) || 0);
    case 'castle':
      return rest[0] === 'wall' ? wallSegment() : towerBlock((rest[0] ?? '').replace('tower-', ''));
    case 'unit':
      return unitFigure(rest[0] ?? 'bow', (rest[1] ?? 'militia') as keyof typeof UNIT_HEIGHT);
    case 'enemy': return enemyFigure();
    case 'projectile': return projectileDot();
    case 'fx': return contactShadow();
    default: return projectileDot();
  }
}
