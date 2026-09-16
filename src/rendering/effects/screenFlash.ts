import type { PresentationSettings } from '../presentation/settings';
import type { SalvoPlan } from './salvoPresentation';

/**
 * THE FIELD LIT BY ITS OWN GUNS.
 *
 * At tier D and E the escalation table promises a screen flash. The obvious
 * reading — one bright pulse per drawn shot — is both wrong and dangerous, and
 * the danger is the more important of the two.
 *
 * A tier E salvo fires a moment every 45 ms. A pulse on each of those is a
 * 22 Hz full-screen strobe, squarely inside the band that triggers
 * photosensitive seizures. `reducedMotion` would not save anybody who had not
 * found the setting first. So it is not built that way and cannot be turned
 * into that by tuning a number.
 *
 * What is built instead is what continuous gunfire actually looks like from
 * inside a fortress at night: a SUSTAINED warm wash that rises as the barrage
 * opens, holds while it runs and dies away after the last shot. No pulse, no
 * flicker, no frequency at all — the light simply comes up and goes down once.
 * It reads as heavier than a strobe would, and it is safe by construction
 * rather than by setting.
 */

/**
 * The ceiling, as alpha over the whole stage.
 *
 * Deliberately small. This is the last effect anybody should notice
 * individually — its job is to make the smoke and the impacts feel lit, not to
 * be a thing on its own.
 */
export const MAX_FLASH_ALPHA = 0.12;

/** How long the wash takes to come up, and to die away. */
export const FLASH_RISE = 0.18;
export const FLASH_FALL = 0.55;

/** The colour of the light. The bible's warm end, from the same one sun. */
export const FLASH_COLOUR = '#ffd98a';

export interface FlashWindow {
  /** When the first drawn shot fires. */
  readonly from: number;
  /** When the last one does. */
  readonly until: number;
  /** 0..1, how strongly this tier lights the field. */
  readonly strength: number;
}

/**
 * The window a plan lights, or none.
 *
 * Tiers A to C light nothing at all — that is what makes the arrival of tier D
 * mean something. A player who has seen the field go warm knows, without being
 * told, that this salvo is a different kind of event.
 */
export function flashWindow(
  plan: SalvoPlan,
  lastShotAt: number,
): FlashWindow | null {
  if (!plan.tier.escalation.screenFlash) return null;
  return {
    from: 0,
    until: lastShotAt,
    // Tier E lights harder than tier D, and a bigger salvo inside a tier
    // harder than a smaller one — through the plan's own force.
    strength: Math.min(1, plan.force / 6),
  };
}

/**
 * How lit the field is at second `t`, as an alpha.
 *
 * A pure function of time over a single window: no state, no accumulation, and
 * nothing that could still be glowing after the combat ended.
 */
export function flashAt(
  window: FlashWindow | null,
  t: number,
  settings: PresentationSettings,
): number {
  if (!window) return 0;
  /*
   * Two ways off, and both are absolute. `reducedMotion` is the accessibility
   * promise; the `flash` toggle is the same effect the muzzle flash obeys, so
   * a player who switched off muzzle flashes does not get a lit sky anyway.
   */
  if (settings.reducedMotion || !settings.effects.flash) return 0;

  if (t < window.from) return 0;
  const rise = Math.min(1, (t - window.from) / FLASH_RISE);
  const after = t - window.until;
  const fall = after <= 0 ? 1 : Math.max(0, 1 - after / FLASH_FALL);
  // Eased at both ends, so the light does not switch on.
  const shape = smooth(rise) * smooth(fall);
  return MAX_FLASH_ALPHA * window.strength * shape;
}

const smooth = (v: number): number => v * v * (3 - 2 * v);

/** When the wash is completely over. For the debug overlay. */
export const flashEndsAt = (window: FlashWindow | null): number =>
  window ? window.until + FLASH_FALL : 0;
