/**
 * WHERE THE ART IS MISSING, SAID OUT LOUD.
 *
 * The failure mode this exists to prevent: a slot quietly falls back to a
 * placeholder, the placeholder looks plausible enough in motion, and six weeks
 * later somebody notices that the rank 13 gunner has been a grey box the whole
 * time. A silent fallback is a bug that hides itself.
 *
 * So a missing slot is LOUD in development — it names the exact file somebody
 * has to draw, in the exact place the pipeline expects it — and DEFINED in
 * production, falling back to a known sibling rather than to nothing. Never
 * silent in development, never a hole in front of a player.
 */

export type ArtMode = 'development' | 'production';

export interface MissingArt {
  /** The slot the renderer asked for, e.g. `unit/bow/elite`. */
  readonly slot: string;
  /** The file somebody has to produce. Exactly where the pipeline looks. */
  readonly path: string;
  /** What was drawn instead. */
  readonly fallback: string;
  /** How often it has been asked for. Frequency is priority. */
  readonly requests: number;
}

/** Where `scripts/art/pipeline.py` reads source art from. */
export const SOURCE_ROOT = 'assets/source';

/**
 * The file a slot expects.
 *
 * `unit/bow/veteran` with the state `fire-02` becomes
 * `assets/source/unit/bow/veteran/fire-02.png` — which is the line the brief
 * asks to see in the console, and is a path somebody can act on without
 * asking anybody how the pipeline is laid out.
 */
export function missingArtPath(slot: string, state?: string): string {
  const clean = slot.replace(/^\/+/, '');
  return state
    ? `${SOURCE_ROOT}/${clean}/${state}.png`
    : `${SOURCE_ROOT}/${clean}.png`;
}

/**
 * A slot's defined fallback.
 *
 * Deliberately a SIBLING, not a generic box: a missing elite archer falls back
 * to the professional archer, so a production build shows a plausible soldier
 * of the right family in the right place. Only when there is no sibling does
 * it fall back to the labelled placeholder — and that is still reported.
 */
export function fallbackFor(slot: string): string {
  const parts = slot.split('/');
  if (parts[0] === 'unit' && parts.length >= 3) {
    // Drop one band toward the militia; the family and the pose survive.
    const bands = ['militia', 'professional', 'elite'];
    const index = bands.indexOf(parts[2]!);
    if (index > 0) return [parts[0], parts[1], bands[index - 1]].join('/');
  }
  if (parts[0] === 'castle' && parts[1]?.startsWith('parapet-')) {
    // A tower without its own parapet borrows the watchtower's.
    return 'castle/parapet-watchtower';
  }
  if (parts[0] === 'castle' && parts[1]?.startsWith('tower-')) {
    return 'castle/tower-watchtower';
  }
  return parts[0] ? `${parts[0]}/placeholder` : 'placeholder';
}

/**
 * The register.
 *
 * It counts rather than merely listing, because the slot asked for forty times
 * a second is a different problem from the one asked for once at the end of a
 * combat — and a person with a limited number of hours should draw the first
 * one first.
 */
export class ArtRegister {
  private readonly mode: ArtMode;
  private readonly seen = new Map<string, MissingArt>();
  private readonly announced = new Set<string>();

  constructor(mode: ArtMode = 'development') {
    this.mode = mode;
  }

  /**
   * Report a slot with no source art, and get back what to draw instead.
   *
   * In development the first sighting is announced once, with its path. Once,
   * not every frame: a console printing sixty lines a second is a console
   * nobody reads, which is the same as silence with extra steps.
   */
  miss(slot: string, state?: string): string {
    const fallback = fallbackFor(slot);
    const existing = this.seen.get(slot);
    if (existing) {
      this.seen.set(slot, { ...existing, requests: existing.requests + 1 });
    } else {
      this.seen.set(slot, { slot, path: missingArtPath(slot, state), fallback, requests: 1 });
    }

    if (this.mode === 'development' && !this.announced.has(slot)) {
      this.announced.add(slot);
      // eslint-disable-next-line no-console
      console.warn(`MISSING: ${missingArtPath(slot, state)}`);
    }
    return fallback;
  }

  /** Everything outstanding, the most-asked-for first. */
  report(): readonly MissingArt[] {
    return [...this.seen.values()].sort((a, b) => b.requests - a.requests);
  }

  /** The one line the debug overlay shows. */
  line(): string {
    const missing = this.report();
    if (!missing.length) return 'Kunst vollständig';
    const first = missing[0]!;
    return missing.length === 1
      ? `1 fehlende Grafik: ${first.path}`
      : `${missing.length} fehlende Grafiken, meistgefragt: ${first.path}`;
  }

  clear(): void {
    this.seen.clear();
    this.announced.clear();
  }
}
