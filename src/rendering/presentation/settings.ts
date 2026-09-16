import { UNIT_HEIGHT } from '../artRules';

/**
 * Everything the PRESENTATION may be told, and nothing the rules may read.
 *
 * This object is the seam the brief asks for: the simulation decided the
 * outcome long before any of these values were consulted, so a player who
 * turns every effect off gets the same damage, the same formations and the
 * same crest protocol as one who leaves them on. If that ever stops being
 * true, the toggle was wired into the wrong layer.
 *
 * It is plain data on purpose — it saves, it appears in a screenshot's
 * metadata, and `/visual-test` drives the whole workbench by handing a
 * different one of these to the same renderer.
 */

/* ---------- The unit scale question ---------- */

/**
 * The four sizes the brief asks to be tested: 100 / 115 / 125 / 135 %.
 *
 * READ THIS BEFORE USING IT AT RUNTIME. A pixel sprite multiplied by 1.15 is
 * mush; the bible allows integer stage scales only and that rule is not
 * negotiable. So this is a DESIGN PROBE, not a rendering feature: it decides
 * how tall a unit is AUTHORED, and the answer is baked into the height bands
 * before a single sprite is drawn. `scaledBand` therefore always returns whole
 * pixels, and shipping code reads the bands, never the probe.
 */
export const UNIT_SCALE_PROBES: readonly number[] = [1, 1.15, 1.25, 1.35];

export type HeightBand = keyof typeof UNIT_HEIGHT;

/**
 * A height band at a given probe scale, in whole logical pixels.
 *
 * Rounded, never fractional: 24 × 1.15 is 27.6, and a 27.6-pixel soldier does
 * not exist. The point of measuring the four sizes is to choose which of the
 * whole numbers a person should draw.
 */
export function scaledBand(band: HeightBand, scale: number): readonly [number, number] {
  const [low, high] = UNIT_HEIGHT[band];
  return [Math.round(low * scale), Math.round(high * scale)];
}

/** The single height a placeholder of that band is drawn at. */
export function scaledUnitHeight(band: HeightBand, scale: number): number {
  const [low, high] = scaledBand(band, scale);
  return Math.round((low + high) / 2);
}

/* ---------- Effects ---------- */

/**
 * Which effects run at all.
 *
 * Every one of these is a REPRESENTATION of something the simulation already
 * decided. Turning smoke off hides the smoke; it does not make the cannon
 * quieter, cheaper or weaker.
 */
export interface EffectSettings {
  readonly smoke: boolean;
  readonly dust: boolean;
  readonly flash: boolean;
  readonly debris: boolean;
  readonly sparks: boolean;
  /** The camera's answer to a heavy hit. Also governed by `reducedMotion`. */
  readonly shake: boolean;
  /** Damage numbers and captions rising off the field. */
  readonly floatingText: boolean;
  /** The shadow on the ground under an arcing shot. */
  readonly shotShadows: boolean;
}

/** What the workbench draws on top so a rendering fault has a name. */
export interface DebugSettings {
  /** A cross at every sprite's ground anchor. */
  readonly anchors: boolean;
  /** A dot at every muzzle socket, where projectiles are born. */
  readonly sockets: boolean;
  /** The firing vector and the recoil vector, in world direction. */
  readonly worldVectors: boolean;
  /** Tint each render layer, so a thing in the wrong one is obvious. */
  readonly layers: boolean;
  /** The box each sprite occupies. */
  readonly bounds: boolean;
  readonly fps: boolean;
  readonly spriteCount: boolean;
  /** The salvo presentation's schedule, as it drains. */
  readonly queue: boolean;
  /** Name every sprite slot that has no source art yet. */
  readonly missingArt: boolean;
}

export interface PresentationSettings {
  /** The probe above. 1 in shipping code. */
  readonly unitScale: number;
  /**
   * Accessibility, and not an afterthought: shake, screen flash and the
   * fastest compressions are switched off together, and everything that
   * remains still communicates the same facts.
   */
  readonly reducedMotion: boolean;
  readonly effects: EffectSettings;
  readonly debug: DebugSettings;
}

export const ALL_EFFECTS: EffectSettings = {
  smoke: true, dust: true, flash: true, debris: true, sparks: true,
  shake: true, floatingText: true, shotShadows: true,
};

export const NO_EFFECTS: EffectSettings = {
  smoke: false, dust: false, flash: false, debris: false, sparks: false,
  shake: false, floatingText: false, shotShadows: false,
};

export const NO_DEBUG: DebugSettings = {
  anchors: false, sockets: false, worldVectors: false, layers: false,
  bounds: false, fps: false, spriteCount: false, queue: false, missingArt: false,
};

export const DEFAULT_PRESENTATION: PresentationSettings = {
  unitScale: 1,
  reducedMotion: false,
  effects: ALL_EFFECTS,
  debug: NO_DEBUG,
};

/**
 * Reduced motion, applied.
 *
 * It is not "all effects off" — a player who needs it should still see that
 * the cannon fired, that it hit, and how hard. What goes is the MOVEMENT the
 * player did not ask for: the camera kick. Smoke still billows, numbers still
 * rise, the shot still flies.
 */
export function withReducedMotion(settings: PresentationSettings): PresentationSettings {
  if (!settings.reducedMotion) return settings;
  return { ...settings, effects: { ...settings.effects, shake: false } };
}

/** Whether a particle kind may be emitted at all under these settings. */
export function effectEnabled(settings: PresentationSettings, kind: string): boolean {
  const effects = settings.effects;
  switch (kind) {
    case 'smoke': return effects.smoke;
    case 'dust': return effects.dust;
    case 'flash': return effects.flash;
    case 'debris': return effects.debris;
    case 'spark': return effects.sparks;
    default: return true;
  }
}
