/**
 * How many volleys become how much spectacle.
 *
 * The simulation is allowed to become absurd — a late engine fires a million
 * volleys and that is the point of the game. The PRESENTATION compresses that
 * absurdity into increasingly powerful feedback instead of into increasingly
 * long waiting.
 *
 * The rule the brief sets: a hundred-volley engine must feel far more powerful
 * than five, WITHOUT being twenty times slower. So the number of drawn shots
 * grows logarithmically while the force behind each one grows — more smoke,
 * more shake, heavier impacts, all of it overlapping.
 */

export type PresentationLevel = 'single' | 'readable' | 'accelerated' | 'barrage' | 'catastrophe';

export interface SalvoPlan {
  readonly level: PresentationLevel;
  /** How many volleys the simulation produced. */
  readonly volleys: number;
  /** How many firing events are actually DRAWN. */
  readonly drawn: number;
  /** Seconds between drawn shots. */
  readonly interval: number;
  /** Total length of the presentation, in seconds. */
  readonly duration: number;
  /** Multiplies particle counts, shake and impact. */
  readonly force: number;
  /** Whether each drawn shot shows its own damage number, or one total. */
  readonly aggregateDamage: boolean;
  /** German, for the HUD. */
  readonly caption: string;
}

/** The ceiling. A volley presentation never exceeds this, whatever the number. */
export const MAX_PRESENTATION_SECONDS = 3.2;

export function planSalvo(volleys: number): SalvoPlan {
  const n = Math.max(0, Math.round(volleys));

  if (n <= 1) {
    return build('single', n, n, 0, 1, false, 'Salve');
  }
  if (n <= 5) {
    // Literal. Five shots, each one its own readable event.
    return build('readable', n, n, 0.16, 1, false, `${n} Salven`);
  }
  if (n <= 15) {
    // Accelerated and overlapping: still one shot per volley, but they run
    // into each other so the row reads as coordinated rather than patient.
    return build('accelerated', n, n, 0.075, 1.2, false, `${n} Salven`);
  }
  if (n <= 50) {
    // Barrage. Shots are sampled; the ones drawn hit harder.
    const drawn = Math.round(12 + (n - 15) * 0.18);
    return build('barrage', n, drawn, 0.06, 1 + n / 60, true, `${n} SALVEN`);
  }

  /*
   * Catastrophe. Beyond fifty the count stops meaning anything one could
   * follow, so the presentation stops trying: about twenty drawn shots,
   * enormous force behind each, one aggregated number. A million volleys and
   * a thousand look the same on screen, and they should — what differs is the
   * damage, and that is a number, not an animation.
   */
  const drawn = Math.round(18 + Math.log10(n) * 4);
  const force = Math.min(6, 2 + Math.log10(n));
  return build('catastrophe', n, drawn, 0.045, force, true, formatVolleys(n));
}

function build(
  level: PresentationLevel, volleys: number, drawn: number, interval: number,
  force: number, aggregateDamage: boolean, caption: string,
): SalvoPlan {
  const duration = Math.min(MAX_PRESENTATION_SECONDS, Math.max(0, drawn - 1) * interval + 0.5);
  return { level, volleys, drawn, interval, duration, force, aggregateDamage, caption };
}

/**
 * Big numbers, the way a player can read them.
 *
 * Stop treating every point of damage as equally important: 84, then 1,2K,
 * then 18,4K, then 2,7M. German decimal comma, because that is what the rest
 * of the game speaks.
 */
export function formatBig(value: number): string {
  const n = Math.round(value);
  if (n < 10_000) return n.toLocaleString('de-DE');
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace('.', ',')}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n < 1_000_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')}B`;
  return `${(n / 1_000_000_000_000).toFixed(1).replace('.', ',')}T`;
}

const formatVolleys = (n: number): string => `${formatBig(n)} SALVEN`;

/**
 * Which drawn shot happens when, and how hard.
 *
 * Returned as a list rather than driven by a timer, so the whole presentation
 * can be inspected — and asserted on — before anything is drawn.
 */
export interface DrawnShot {
  readonly index: number;
  /** Seconds after the presentation starts. */
  readonly at: number;
  /** Which tower fires it. Cycles, so the castle fires as a whole. */
  readonly tower: number;
  readonly force: number;
}

export function scheduleShots(plan: SalvoPlan, towers: readonly number[]): readonly DrawnShot[] {
  if (!towers.length || plan.drawn <= 0) return [];
  const shots: DrawnShot[] = [];
  for (let i = 0; i < plan.drawn; i++) {
    shots.push({
      index: i,
      at: i * plan.interval,
      tower: towers[i % towers.length]!,
      /* The last shots of a barrage hit hardest: the sequence builds. */
      force: plan.force * (0.8 + 0.4 * (plan.drawn > 1 ? i / (plan.drawn - 1) : 1)),
    });
  }
  return shots;
}
