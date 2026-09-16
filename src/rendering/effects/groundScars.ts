import type { WorldPoint } from '../WorldTransform';

/**
 * WHAT THE BOMBARDMENT LEAVES BEHIND.
 *
 * From tier C upward the escalation table promises that impacts scar the
 * ground. Until now that was a boolean nobody drew — the data said the barrage
 * escalated and the screen did not agree, which is the worst kind of
 * specification: one that is checked and still false.
 *
 * A scar is the only effect here that OUTLIVES its salvo. That is its whole
 * job: when the smoke has cleared, the field in front of the castle should
 * show that something happened to it. Without that, every round starts on
 * clean grass and the player's last thirty volleys left no trace at all.
 *
 * Scars MERGE rather than accumulate, for the same reason smoke does. Two
 * hundred separate craters is a rash; one churned patch that keeps getting
 * darker is a bombardment. And because merging is by position rather than by
 * chance, the same salvo scars the same ground every time.
 */

export interface Scar {
  readonly id: string;
  /** On the ground plane. Height is always zero: a scar is IN the earth. */
  readonly at: WorldPoint;
  /** Radius across the tile, in logical pixels. */
  readonly size: number;
  /** 0..1 — how churned. Deepens as more lands in the same place. */
  readonly depth: number;
  readonly age: number;
  readonly life: number;
}

export interface ScarField {
  readonly scars: readonly Scar[];
  readonly nextId: number;
}

export const emptyScars = (): ScarField => ({ scars: [], nextId: 0 });

/**
 * How long a scar lasts.
 *
 * Long enough to outlive the salvo that made it and still be there while the
 * player decides what to do next — and short enough that a five-round combat
 * does not end with the whole field black.
 */
export const SCAR_LIFE = 14;

/** Beyond this the field is a rash rather than a battlefield. */
export const SCAR_BUDGET = 40;

/** Impacts closer together than this deepen one scar instead of making two. */
const MERGE_DISTANCE = 0.7;

/** A single crater never grows past this, however much lands in it. */
const MAX_SIZE = 26;

export function addScar(field: ScarField, at: WorldPoint, force = 1): ScarField {
  const size = Math.min(MAX_SIZE, 6 + Math.min(3, force) * 3);

  /*
   * Nearest first. Merging into the nearest rather than the first found keeps
   * the result independent of the order impacts arrived in — two shots either
   * side of an existing crater must not produce a different field depending on
   * which landed first.
   */
  let nearest = -1;
  let best = MERGE_DISTANCE;
  field.scars.forEach((scar, i) => {
    const distance = Math.hypot(scar.at.col - at.col, scar.at.row - at.row);
    if (distance < best) { best = distance; nearest = i; }
  });

  if (nearest >= 0) {
    const scar = field.scars[nearest]!;
    const scars = [...field.scars];
    scars[nearest] = {
      ...scar,
      // Area-preserving up to the ceiling, like smoke: twice the earth thrown
      // is not twice the crater width.
      size: Math.min(MAX_SIZE, Math.hypot(scar.size, size)),
      depth: Math.min(1, scar.depth + 0.22),
      // A fresh hit renews the whole patch: the ground has just been turned
      // over again, so it should not be halfway to healed.
      age: 0,
    };
    return { ...field, scars };
  }

  const scars = [...field.scars, {
    id: `scar${field.nextId}`,
    at: { col: at.col, row: at.row, height: 0 },
    size,
    depth: 0.35 + Math.min(0.3, force * 0.08),
    age: 0,
    life: SCAR_LIFE,
  }];
  return { scars: trim(scars), nextId: field.nextId + 1 };
}

/** Over budget: the shallowest go, because they are the least of the story. */
function trim(scars: readonly Scar[]): readonly Scar[] {
  if (scars.length <= SCAR_BUDGET) return scars;
  return [...scars]
    .sort((a, b) => b.depth * b.size - a.depth * a.size)
    .slice(0, SCAR_BUDGET);
}

export function stepScars(field: ScarField, dt: number): ScarField {
  const alive: Scar[] = [];
  for (const scar of field.scars) {
    const age = scar.age + dt;
    if (age >= scar.life) continue;
    alive.push({ ...scar, age });
  }
  return { ...field, scars: alive };
}

/**
 * How dark a scar draws right now.
 *
 * It holds for most of its life and then fades — earth does not lighten
 * steadily, it stays turned over and then the grass comes back.
 */
export function scarOpacity(scar: Scar): number {
  const left = 1 - scar.age / scar.life;
  const fade = left > 0.3 ? 1 : left / 0.3;
  return Math.max(0, Math.min(1, scar.depth * fade));
}

/** The total churned area. What "the field has been worked over" means. */
export const scarredArea = (field: ScarField): number =>
  field.scars.reduce((sum, s) => sum + s.size * s.size * s.depth, 0);
