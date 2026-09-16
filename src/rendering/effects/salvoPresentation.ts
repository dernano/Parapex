/**
 * HOW MANY VOLLEYS BECOME HOW MUCH SPECTACLE.
 *
 * The simulation is allowed to become absurd — a late engine fires a thousand
 * volleys and that is the point of the game. The PRESENTATION compresses that
 * absurdity into increasingly powerful feedback instead of into increasingly
 * long waiting.
 *
 * Two rules govern everything below.
 *
 *  1. A hundred volleys must feel far more powerful than five WITHOUT being
 *     twenty times slower. So the number of drawn shots grows roughly
 *     logarithmically while the force behind each one grows.
 *
 *  2. ESCALATION IS NOT SPEED. Running the same animation faster is what a
 *     spreadsheet does. A bigger salvo has to become a DIFFERENT EVENT: more
 *     towers firing at once, smoke that never clears between shots, the ground
 *     scarred, the screen lit, a roar that does not stop. Those are the fields
 *     below, and they are what separates tier D from tier B — not the interval.
 *
 * The tiers are the brief's own: 1–5, 6–15, 16–50, 51–250, 251+.
 */

export type SalvoTierId = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * What a tier ADDS, beyond going faster.
 *
 * Every field here is monotonic across A → E, and a test asserts exactly that:
 * a tier that escalated in no visible way would be a tier the player cannot
 * tell from the one below it.
 */
export interface SalvoEscalation {
  /** Particle counts, multiplied. Smoke stops clearing between shots. */
  readonly smoke: number;
  /** How hard each drawn impact lands. */
  readonly impact: number;
  /** Camera kick in logical pixels. Zero below tier C: a single shot is quiet. */
  readonly shake: number;
  /** How many towers fire in the same instant. One is a duel; five is a wall. */
  readonly simultaneous: number;
  /** A brief warm wash over the whole field on each drawn shot. */
  readonly screenFlash: boolean;
  /** Impacts leave marks on the ground that outlive the salvo. */
  readonly groundScar: boolean;
  /** The shots stop being separate sounds and become one. */
  readonly continuousRoar: boolean;
}

export interface SalvoTier {
  readonly id: SalvoTierId;
  /** German, for the codex and the workbench. */
  readonly name: string;
  /** Inclusive lower bound of volleys. */
  readonly from: number;
  /** Inclusive upper bound, or null for the top tier. */
  readonly to: number | null;
  /** Seconds between drawn shots. */
  readonly interval: number;
  /** Multiplies particle counts and impact strength at the emitter. */
  readonly force: number;
  /** Whether the damage is shown per shot or aggregated. */
  readonly aggregateDamage: boolean;
  readonly escalation: SalvoEscalation;
}

/**
 * The five tiers.
 *
 * Read down the escalation columns rather than across the rows: that is where
 * the design is. Nothing new appears until C, because sixteen volleys is the
 * first count a player cannot follow individually — before that, adding
 * spectacle would only be noise over an event they can already read.
 */
export const SALVO_TIERS: readonly SalvoTier[] = [
  {
    id: 'A', name: 'Salve', from: 1, to: 5,
    interval: 0.16, force: 1, aggregateDamage: false,
    escalation: {
      smoke: 1, impact: 1, shake: 0, simultaneous: 1,
      screenFlash: false, groundScar: false, continuousRoar: false,
    },
  },
  {
    id: 'B', name: 'Trommelfeuer', from: 6, to: 15,
    // Still one drawn shot per volley — the count is small enough to follow —
    // but they overlap, so the row reads as coordinated rather than patient.
    interval: 0.075, force: 1.3, aggregateDamage: false,
    escalation: {
      smoke: 1.3, impact: 1.2, shake: 0, simultaneous: 1,
      screenFlash: false, groundScar: false, continuousRoar: false,
    },
  },
  {
    id: 'C', name: 'Sperrfeuer', from: 16, to: 50,
    // The first tier that stops being literal. Shots are sampled, two towers
    // speak at once, the earth starts keeping the marks.
    interval: 0.060, force: 2, aggregateDamage: true,
    escalation: {
      smoke: 1.8, impact: 1.6, shake: 1.2, simultaneous: 2,
      screenFlash: false, groundScar: true, continuousRoar: false,
    },
  },
  {
    id: 'D', name: 'Bombardement', from: 51, to: 250,
    // Now it is weather. Three towers at a time, the field lit by the muzzles,
    // and the separate reports run together into one sound.
    interval: 0.050, force: 3.2, aggregateDamage: true,
    escalation: {
      smoke: 2.6, impact: 2.4, shake: 2, simultaneous: 3,
      screenFlash: true, groundScar: true, continuousRoar: true,
    },
  },
  {
    id: 'E', name: 'Vernichtung', from: 251, to: null,
    /*
     * Beyond two hundred and fifty the number stops meaning anything one could
     * follow, so the presentation stops trying. A thousand volleys and a
     * million look the same on screen — and they should. What differs is the
     * damage, and damage is a number, not an animation.
     */
    interval: 0.042, force: 5, aggregateDamage: true,
    escalation: {
      smoke: 3.5, impact: 3.2, shake: 3, simultaneous: 5,
      screenFlash: true, groundScar: true, continuousRoar: true,
    },
  },
];

export function tierFor(volleys: number): SalvoTier {
  const n = Math.max(1, Math.round(volleys));
  for (const tier of SALVO_TIERS) {
    if (n >= tier.from && (tier.to === null || n <= tier.to)) return tier;
  }
  return SALVO_TIERS[SALVO_TIERS.length - 1]!;
}

export interface SalvoPlan {
  readonly tier: SalvoTier;
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

/**
 * How many shots are worth drawing.
 *
 * Literal up to fifteen, logarithmic after: twelve shots at sixteen volleys,
 * about thirty at a million. The curve is deliberately flat at the top, so the
 * player learns that past a point the castle simply ANNIHILATES and stops
 * counting.
 */
function drawnShots(tier: SalvoTier, n: number): number {
  if (tier.id === 'A' || tier.id === 'B') return n;
  return Math.round(10 + Math.log10(n) * 6);
}

export function planSalvo(volleys: number): SalvoPlan {
  const n = Math.max(0, Math.round(volleys));
  if (n === 0) {
    const tier = SALVO_TIERS[0]!;
    return {
      tier, volleys: 0, drawn: 0, interval: 0, duration: 0,
      force: tier.force, aggregateDamage: false, caption: 'Keine Salve',
    };
  }

  const tier = tierFor(n);
  const drawn = drawnShots(tier, n);
  /*
   * Force grows with the COUNT inside a tier as well as between tiers, so
   * ninety volleys land visibly harder than fifty-one without needing a sixth
   * tier. Capped, because at some point more force is just a white screen.
   */
  const force = Math.min(6, tier.force * (1 + Math.log10(Math.max(1, n / tier.from)) * 0.35));
  const duration = Math.min(
    MAX_PRESENTATION_SECONDS,
    Math.max(0, drawn - 1) * tier.interval + 0.5,
  );

  return {
    tier, volleys: n, drawn, interval: tier.interval, duration, force,
    aggregateDamage: tier.aggregateDamage,
    caption: n === 1 ? 'Salve' : `${formatBig(n)} ${tier.name}`,
  };
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

/**
 * Which drawn shot happens when, from which tower, and how hard.
 *
 * Returned as a list rather than driven by a timer, so the whole presentation
 * can be inspected — and asserted on — before anything is drawn. It is also
 * what the workbench's queue overlay shows draining.
 */
export interface DrawnShot {
  readonly index: number;
  /** Seconds after the presentation starts. */
  readonly at: number;
  /** Which tower fires it. */
  readonly tower: number;
  readonly force: number;
  /** True for the last shot: the one the impact and the number belong to. */
  readonly last: boolean;
}

export function scheduleShots(plan: SalvoPlan, towers: readonly number[]): readonly DrawnShot[] {
  if (!towers.length || plan.drawn <= 0) return [];
  const shots: DrawnShot[] = [];
  const simultaneous = Math.min(plan.tier.escalation.simultaneous, towers.length);
  let cursor = 0;

  for (let i = 0; i < plan.drawn; i++) {
    /*
     * At tier C and above several towers speak in the same instant. That is
     * the escalation the brief asks for: the castle stops taking turns.
     */
    const group = Math.floor(i / simultaneous);
    shots.push({
      index: i,
      at: group * plan.interval,
      tower: towers[cursor % towers.length]!,
      /* The last shots of a barrage hit hardest: the sequence builds. */
      force: plan.force * (0.8 + 0.4 * (plan.drawn > 1 ? i / (plan.drawn - 1) : 1)),
      last: i === plan.drawn - 1,
    });
    cursor++;
  }
  return shots;
}

/** How long the schedule actually runs. Never longer than the plan promised. */
export const scheduleLength = (shots: readonly DrawnShot[]): number =>
  shots.length ? shots[shots.length - 1]!.at : 0;
