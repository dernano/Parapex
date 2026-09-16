import { PALETTE } from '../artRules';
import { hexToRgb } from '../placeholderAtlas';

/**
 * WHAT A SHOT LOOKS LIKE AT THE ZOOM PEOPLE ACTUALLY PLAY AT.
 *
 * A four-pixel grey square was fine while the question was "does the
 * projectile system work". It is not fine as a picture: on a 44 × 22 tile,
 * over earth and grass ramps that are themselves mid-grey, it disappears — and
 * a shot the player cannot follow is a shot that did not happen.
 *
 * So readability is specified rather than hoped for, and the specification is
 * measurable:
 *
 *  1. EVERY projectile has a dark outline AND a light core. Between them they
 *     straddle the terrain's own brightness, so the silhouette survives over
 *     any tile without anybody hand-checking combinations.
 *  2. EVERY projectile covers a minimum area. Below about a dozen pixels a
 *     moving object reads as dirt on the monitor.
 *  3. Shape carries meaning. An arrow is a streak along its own flight; a
 *     bombard's ball is round and slow and dark. The player should be able to
 *     name the weapon from the shot alone.
 */

export type ProjectileKind = 'arrow' | 'bolt' | 'stone' | 'ball';

export interface ProjectileVisual {
  readonly kind: ProjectileKind;
  /** German, for the workbench. */
  readonly displayName: string;
  /** Along the direction of travel, in logical pixels. */
  readonly length: number;
  /** Across it. */
  readonly width: number;
  /** The bright inner mass. */
  readonly core: string;
  /** The dark edge that keeps it legible over pale ground. */
  readonly outline: string;
  /** Whether the sprite turns to face its flight. A ball does not. */
  readonly oriented: boolean;
  /** How many fading afterimages follow it. Zero is allowed and means none. */
  readonly trail: number;
  /** Seconds between afterimages. */
  readonly trailSpacing: number;
  /** How wide the ground shadow is relative to the shot. */
  readonly shadowScale: number;
}

export const PROJECTILE_VISUALS: Readonly<Record<ProjectileKind, ProjectileVisual>> = {
  arrow: {
    kind: 'arrow', displayName: 'Pfeil',
    // Long and thin, and it turns: at the top of its arc it is nearly
    // horizontal, coming down it is nearly vertical. That IS the arc, read off
    // the projectile itself rather than off its path.
    length: 9, width: 2,
    core: '#e3d2a4', outline: '#2a2116',
    oriented: true, trail: 2, trailSpacing: 0.035, shadowScale: 0.7,
  },
  bolt: {
    kind: 'bolt', displayName: 'Bolzen',
    // Shorter, blunter, and fast enough that the trail does the work.
    length: 7, width: 2,
    core: '#c9c4bb', outline: '#23262c',
    oriented: true, trail: 3, trailSpacing: 0.022, shadowScale: 0.6,
  },
  stone: {
    kind: 'stone', displayName: 'Wurfstein',
    // Big, irregular, tumbling. It is in the air long enough to be watched, so
    // it is the one projectile that can afford real mass.
    length: 7, width: 6,
    core: '#a8a49a', outline: '#2c2c33',
    oriented: false, trail: 0, trailSpacing: 0, shadowScale: 1.4,
  },
  ball: {
    kind: 'ball', displayName: 'Kugel',
    // Dark iron with one lit edge from the sun, and a faint hot trail from the
    // charge. Small, round, and it does not tumble — it is cast metal.
    length: 6, width: 6,
    core: '#6b7079', outline: '#1a1c20',
    oriented: false, trail: 2, trailSpacing: 0.018, shadowScale: 1.0,
  },
};

export const visualForProjectile = (kind: string): ProjectileVisual =>
  PROJECTILE_VISUALS[kind as ProjectileKind] ?? PROJECTILE_VISUALS.arrow;

/* ---------- The measurements the rules above are checked against ---------- */

/** Perceived brightness, 0..1. The sRGB relative-luminance formula. */
export function luminance(hex: string): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG ratio between two colours: 1 is identical, 21 is black on white. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [high, low] = la > lb ? [la, lb] : [lb, la];
  return (high + 0.05) / (low + 0.05);
}

/** Every colour a shot can be seen against. */
export const TERRAIN_COLOURS: readonly string[] = [...PALETTE.earth, ...PALETTE.grass];

/**
 * The area a shot covers, in logical pixels.
 *
 * An oriented shot is a rectangle; a round one is an ellipse. Approximate and
 * deliberately so — what is being asserted is "this is not a speck", not the
 * third decimal.
 */
export function silhouetteArea(visual: ProjectileVisual): number {
  return visual.oriented
    ? visual.length * visual.width
    : Math.round(Math.PI * (visual.length / 2) * (visual.width / 2));
}

/** Below this, a moving object reads as a dead pixel rather than as a shot. */
export const MIN_SILHOUETTE_AREA = 12;

/**
 * Does this shot straddle the terrain?
 *
 * True when the outline is darker than every ground colour and the core is
 * lighter than at least the dark half of them — the pairing that makes a
 * silhouette survive whatever it flies over. It is checked in a test rather
 * than trusted, because "it looked fine on grass" is how a projectile ends up
 * invisible over ploughed earth.
 */
export function straddlesTerrain(visual: ProjectileVisual): boolean {
  const outline = luminance(visual.outline);
  const core = luminance(visual.core);
  const terrain = TERRAIN_COLOURS.map(luminance);
  const darkestGround = Math.min(...terrain);
  const brightestGround = Math.max(...terrain);
  return outline < darkestGround && core > (darkestGround + brightestGround) / 2;
}
