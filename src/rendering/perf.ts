/**
 * WHAT THE FRAME ACTUALLY COSTS.
 *
 * A performance budget nobody measures is a wish. The workbench shows these
 * numbers permanently, next to the controls that change them, so "does a
 * thousand-volley barrage still run" stops being a matter of opinion.
 *
 * Averages are the least useful number here and are reported last. What ruins
 * a game is the WORST frame — the one where a hundred particles spawn at once
 * and the castle stutters — and an average of sixty hides it perfectly. So the
 * 95th percentile and the single worst frame are what the overlay leads with.
 */

/** The budget. A frame over this is a frame the player can feel. */
export const FRAME_BUDGET_MS = 16.7;

/**
 * How many sprites the battlefield may carry before the budget is at risk.
 *
 * MEASURED, not guessed. It started at 900 on the reasoning above — four
 * hundred tiles, five towers of two pieces each, a garrison, an enemy force,
 * shots in the air and a particle field. Then `scripts/last.mjs` drew the
 * worst case the game can produce, a million-volley annihilation, on
 * SwiftShader with no graphics card at all: 925 sprites, three hundred
 * particles, and a 95th-percentile frame under three milliseconds against a
 * budget of sixteen and a half.
 *
 * So the ceiling moved to where the evidence put it. The FRAME TIME is the
 * real gate; this number is a tripwire for a scene that has quietly started
 * building thousands of things.
 */
export const SPRITE_BUDGET = 1200;

export interface FrameSample {
  readonly ms: number;
  readonly sprites: number;
  readonly particles: number;
}

export interface PerfReport {
  readonly frames: number;
  /** Frames per second, from the median frame. */
  readonly fps: number;
  readonly averageMs: number;
  /** The frame 95 % of frames are faster than. */
  readonly p95Ms: number;
  readonly worstMs: number;
  /** How many frames missed the budget, and what share that is. */
  readonly overBudget: number;
  readonly overBudgetShare: number;
  readonly sprites: number;
  readonly peakSprites: number;
  readonly particles: number;
  readonly peakParticles: number;
  /** True when both budgets held for this window. */
  readonly withinBudget: boolean;
}

/**
 * A rolling window.
 *
 * Bounded on purpose: an unbounded meter is itself a leak, and a meter that
 * averages over the last ten minutes cannot tell you that the thing you
 * changed thirty seconds ago made it worse.
 */
export class PerfMeter {
  private readonly window: number;
  private readonly samples: FrameSample[] = [];
  private peakSpriteCount = 0;
  private peakParticleCount = 0;

  constructor(window = 120) {
    this.window = Math.max(1, window);
  }

  frame(sample: FrameSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.window) this.samples.shift();
    this.peakSpriteCount = Math.max(this.peakSpriteCount, sample.sprites);
    this.peakParticleCount = Math.max(this.peakParticleCount, sample.particles);
  }

  reset(): void {
    this.samples.length = 0;
    this.peakSpriteCount = 0;
    this.peakParticleCount = 0;
  }

  report(): PerfReport {
    const frames = this.samples.length;
    if (!frames) {
      return {
        frames: 0, fps: 0, averageMs: 0, p95Ms: 0, worstMs: 0,
        overBudget: 0, overBudgetShare: 0, sprites: 0, peakSprites: 0,
        particles: 0, peakParticles: 0, withinBudget: true,
      };
    }

    const times = this.samples.map(s => s.ms).sort((a, b) => a - b);
    const last = this.samples[frames - 1]!;
    const total = times.reduce((a, b) => a + b, 0);
    const median = times[Math.floor(frames / 2)]!;
    const p95 = times[Math.min(frames - 1, Math.floor(frames * 0.95))]!;
    const worst = times[frames - 1]!;
    const over = times.filter(t => t > FRAME_BUDGET_MS).length;

    return {
      frames,
      fps: median > 0 ? 1000 / median : 0,
      averageMs: total / frames,
      p95Ms: p95,
      worstMs: worst,
      overBudget: over,
      overBudgetShare: over / frames,
      sprites: last.sprites,
      peakSprites: this.peakSpriteCount,
      particles: last.particles,
      peakParticles: this.peakParticleCount,
      withinBudget: p95 <= FRAME_BUDGET_MS && this.peakSpriteCount <= SPRITE_BUDGET,
    };
  }
}

/** The report as one line, German, for the overlay. */
export function perfLine(report: PerfReport): string {
  if (!report.frames) return 'noch keine Messung';
  const n = (v: number): string => v.toFixed(1).replace('.', ',');
  return [
    `${Math.round(report.fps)} B/s`,
    `p95 ${n(report.p95Ms)} ms`,
    `max ${n(report.worstMs)} ms`,
    `${report.sprites} Sprites (Spitze ${report.peakSprites}/${SPRITE_BUDGET})`,
    `${report.particles} Partikel`,
    report.withinBudget ? 'im Budget' : 'ÜBER BUDGET',
  ].join(' · ');
}
