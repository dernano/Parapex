import { describe, expect, it, vi } from 'vitest';
import { FRAME_BUDGET_MS, PerfMeter, SPRITE_BUDGET, perfLine } from '@/rendering/perf';
import { ArtRegister, fallbackFor, missingArtPath } from '@/rendering/artHooks';

describe('the frame budget is measured, not wished for', () => {
  const meter = (times: readonly number[], sprites = 100): PerfMeter => {
    const m = new PerfMeter(200);
    for (const ms of times) m.frame({ ms, sprites, particles: 10 });
    return m;
  };

  it('reports nothing rather than lying about an empty window', () => {
    const report = new PerfMeter().report();
    expect(report.frames).toBe(0);
    expect(report.fps).toBe(0);
    expect(perfLine(report)).toBe('noch keine Messung');
  });

  /**
   * An average of sixty hides the one frame where a hundred particles spawned
   * at once — which is the frame the player actually feels.
   */
  it('leads with the worst frame, which an average would hide', () => {
    const times = [...Array.from({ length: 99 }, () => 8), 90];
    const report = meter(times).report();
    expect(report.averageMs).toBeLessThan(10);
    expect(report.worstMs).toBe(90);
    expect(report.overBudget).toBe(1);
  });

  it('computes the percentile over the sorted window', () => {
    const report = meter(Array.from({ length: 100 }, (_, i) => i + 1)).report();
    expect(report.p95Ms).toBe(96);
    expect(report.worstMs).toBe(100);
  });

  it('takes the frame rate from the median, not the mean', () => {
    const report = meter([16, 16, 16, 16, 200]).report();
    expect(Math.round(report.fps)).toBe(63);
  });

  it('rolls: what happened two minutes ago stops counting', () => {
    const m = new PerfMeter(10);
    for (let i = 0; i < 10; i++) m.frame({ ms: 100, sprites: 10, particles: 0 });
    for (let i = 0; i < 10; i++) m.frame({ ms: 8, sprites: 10, particles: 0 });
    expect(m.report().worstMs).toBe(8);
    expect(m.report().frames).toBe(10);
  });

  it('remembers the peak even after the window has moved on', () => {
    const m = new PerfMeter(4);
    m.frame({ ms: 8, sprites: 800, particles: 300 });
    for (let i = 0; i < 6; i++) m.frame({ ms: 8, sprites: 40, particles: 5 });
    expect(m.report().peakSprites).toBe(800);
    expect(m.report().peakParticles).toBe(300);
    expect(m.report().sprites).toBe(40);
  });

  it('calls a budget missed when either budget is missed', () => {
    expect(meter(Array(100).fill(8)).report().withinBudget).toBe(true);
    expect(meter(Array(100).fill(FRAME_BUDGET_MS + 1)).report().withinBudget).toBe(false);
    expect(meter(Array(100).fill(8), SPRITE_BUDGET + 1).report().withinBudget).toBe(false);
  });

  /**
   * The sprite ceiling is a TRIPWIRE, not the gate. It has to sit above the
   * worst case the game can actually produce — a million-volley annihilation
   * measured at 925 sprites — or it fires on correct behaviour and everyone
   * learns to ignore it.
   */
  it('leaves room above the heaviest scene the game can build', () => {
    expect(SPRITE_BUDGET).toBeGreaterThan(925);
  });

  it('resets when the thing being measured changes', () => {
    const m = meter(Array(50).fill(40));
    m.reset();
    expect(m.report().frames).toBe(0);
    expect(m.report().peakSprites).toBe(0);
  });

  it('writes one line a person can read', () => {
    const line = perfLine(meter(Array(60).fill(8)).report());
    expect(line).toContain('B/s');
    expect(line).toContain('im Budget');
  });
});

/**
 * A silent fallback is a bug that hides itself: the placeholder looks plausible
 * in motion, and six weeks later the rank 13 gunner has been a grey box the
 * whole time.
 */
describe('missing art is loud in development and defined in production', () => {
  it('names the exact file somebody has to draw', () => {
    expect(missingArtPath('unit/bow/veteran', 'fire-02'))
      .toBe('assets/source/unit/bow/veteran/fire-02.png');
    expect(missingArtPath('castle/tower-cannonTower'))
      .toBe('assets/source/castle/tower-cannonTower.png');
  });

  it('falls back to a sibling, not to a grey box', () => {
    expect(fallbackFor('unit/bow/elite')).toBe('unit/bow/professional');
    expect(fallbackFor('unit/gunner/professional')).toBe('unit/gunner/militia');
    expect(fallbackFor('castle/parapet-powderTower')).toBe('castle/parapet-watchtower');
    expect(fallbackFor('castle/tower-powderTower')).toBe('castle/tower-watchtower');
  });

  it('gives up honestly when there is no sibling left', () => {
    expect(fallbackFor('unit/bow/militia')).toBe('unit/placeholder');
    expect(fallbackFor('enemy/infantry')).toBe('enemy/placeholder');
  });

  it('announces a slot once, not sixty times a second', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = new ArtRegister('development');
    for (let i = 0; i < 100; i++) register.miss('unit/bow/elite');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('MISSING: assets/source/unit/bow/elite.png');
    warn.mockRestore();
  });

  it('says nothing at all in production, and still falls back', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = new ArtRegister('production');
    expect(register.miss('unit/bow/elite')).toBe('unit/bow/professional');
    expect(warn).not.toHaveBeenCalled();
    // Still counted, so the list is complete wherever it is read.
    expect(register.report()).toHaveLength(1);
    warn.mockRestore();
  });

  /** Frequency is priority: draw the one the renderer asks for forty times a second. */
  it('ranks what is outstanding by how often it is asked for', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = new ArtRegister('production');
    register.miss('unit/bow/elite');
    for (let i = 0; i < 10; i++) register.miss('ground/0');
    expect(register.report().map(m => m.slot)).toEqual(['ground/0', 'unit/bow/elite']);
    expect(register.report()[0]!.requests).toBe(10);
    expect(register.line()).toContain('assets/source/ground/0.png');
    warn.mockRestore();
  });

  it('says so plainly when nothing is outstanding', () => {
    expect(new ArtRegister('production').line()).toBe('Kunst vollständig');
  });
});
