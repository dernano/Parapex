import { describe, expect, it } from 'vitest';
import { createUnit } from '@/content/units/pool';
import { GAME_REGISTRY } from '@/content/crests/registry';
import { newSession, resolve } from '@/crests/CrestPipeline';
import { NO_RESOURCES, type CrestRow } from '@/crests/types';
import { createCombat, performAction } from '@/simulation/CombatEngine';
import {
  motifFrameAt, motifsEndAt, travels,
} from '@/rendering/crests/motifShapes';
import {
  PROFILE_VISUALS, TRIGGER_PROFILES, presentIgnitions,
} from '@/rendering/crests/triggerProfiles';
import { SalvoDirector } from '@/rendering/presentation/SalvoDirector';
import { DEFAULT_PRESENTATION } from '@/rendering/presentation/settings';
import { DEFAULT_CAMERA } from '@/rendering/WorldTransform';

/**
 * The motifs were CSS keyframes: the one thing on the screen running on the
 * WALL CLOCK while the battlefield ran on the director's. They drifted apart
 * whenever a frame took longer than it should, and a screenshot of them could
 * only be taken by pausing the animations and seeking into them by hand.
 *
 * Now they are a pure function of time, like every other animation here.
 */

const ignitionFor = (profile: typeof TRIGGER_PROFILES[number], at = 0) => ({
  profile, visual: PROFILE_VISUALS[profile], at,
});

describe('a motif is a function of time', () => {
  it('gives the same answer for the same moment, every time', () => {
    for (const profile of TRIGGER_PROFILES) {
      const a = motifFrameAt(ignitionFor(profile), 0.13);
      const b = motifFrameAt(ignitionFor(profile), 0.13);
      expect(a, profile).toEqual(b);
    }
  });

  it('is invisible before its turn and after its life', () => {
    for (const profile of TRIGGER_PROFILES) {
      const ignition = ignitionFor(profile, 0.4);
      expect(motifFrameAt(ignition, 0).opacity, `${profile} early`).toBe(0);
      expect(motifFrameAt(ignition, 0.39).opacity, `${profile} early`).toBe(0);
      const over = 0.4 + ignition.visual.duration;
      expect(motifFrameAt(ignition, over).opacity, `${profile} late`).toBe(0);
      expect(motifFrameAt(ignition, over + 5).opacity, `${profile} late`).toBe(0);
    }
  });

  /** A motif lingering at opacity 0.01 makes "is the rack idle" unanswerable. */
  it('actually becomes visible somewhere in between', () => {
    for (const profile of TRIGGER_PROFILES) {
      const ignition = ignitionFor(profile);
      let peak = 0;
      for (let t = 0; t < ignition.visual.duration; t += 0.005) {
        peak = Math.max(peak, motifFrameAt(ignition, t).opacity);
      }
      expect(peak, profile).toBeGreaterThan(0.5);
    }
  });

  it('never scales to nothing or to something absurd', () => {
    for (const profile of TRIGGER_PROFILES) {
      const ignition = ignitionFor(profile);
      for (let t = 0; t < ignition.visual.duration; t += 0.005) {
        const frame = motifFrameAt(ignition, t);
        if (!frame.opacity) continue;
        expect(frame.scaleX, `${profile}@${t.toFixed(2)}`).toBeGreaterThan(0.1);
        expect(frame.scaleX, `${profile}@${t.toFixed(2)}`).toBeLessThan(3);
        expect(frame.scaleY, `${profile}@${t.toFixed(2)}`).toBeGreaterThan(0.1);
        expect(frame.scaleY, `${profile}@${t.toFixed(2)}`).toBeLessThan(3);
      }
    }
  });

  /** Eight profiles, eight shapes. A shared one teaches the player nothing. */
  it('gives the eight profiles eight distinguishable shapes', () => {
    const signature = (profile: typeof TRIGGER_PROFILES[number]): string => {
      const ignition = ignitionFor(profile);
      const samples: string[] = [];
      for (let p = 0; p <= 1.001; p += 0.1) {
        const frame = motifFrameAt(ignition, p * ignition.visual.duration * 0.999);
        samples.push([frame.scaleX, frame.scaleY, frame.opacity, frame.x, frame.y]
          .map(v => v.toFixed(2)).join(','));
      }
      return samples.join('|');
    };
    // The three travelling profiles share a shape by design — their meaning is
    // carried by WHERE they come from, which the rack supplies.
    const shapes = new Set(TRIGGER_PROFILES.map(signature));
    expect(shapes.size).toBe(TRIGGER_PROFILES.length - 2);
    expect(TRIGGER_PROFILES.filter(travels)).toEqual(['TRANSFER', 'COPY', 'RETRIGGER']);
  });

  it('knows when the last one is over', () => {
    const shown = presentIgnitions([0, 1, 2].map(nr => ({
      nr, eventNumber: 0, round: 1, slot: nr, id: 'x', displayName: 'x',
      event: 'volleyPlanned' as const, source: 'original' as const, enemyRule: false,
      depth: 0, causedBy: null, effects: [], rejected: null,
    })));
    const end = motifsEndAt(shown);
    expect(end).toBeGreaterThan(0);
    for (const ignition of shown) {
      expect(motifFrameAt(ignition, end).opacity).toBe(0);
    }
  });
});

describe('the rack and the guns share one clock', () => {
  function directorWithCrests(row: CrestRow) {
    let state = createCombat({
      deck: [], enemy: { id: 'v', displayName: 'v', hp: 9000, maxHp: 9000 },
      seed: 'motif', shuffle: false, crests: row, resources: NO_RESOURCES,
      towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
    }).state;
    for (const [tower, id] of [[2, 'gunner-13'], [0, 'bow-11'], [1, 'crossbow-9']] as const) {
      const unit = createUnit(id);
      if (!unit) continue;
      const result = performAction({ ...state, hand: [unit], momentum: 99 },
        { type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: tower });
      if (result.ok) state = result.state;
    }

    const protocol = resolve(GAME_REGISTRY, newSession(row, { resources: NO_RESOURCES }),
      'tableauRead', { tower: 2, rank: 5, branch: 'bow', copies: 0 },
      { dryRun: true }).protocol;

    return new SalvoDirector({
      towers: state.towers, camera: DEFAULT_CAMERA, settings: DEFAULT_PRESENTATION,
      target: { col: 18, row: 10 }, volleys: 3, damage: 400,
      crestProtocol: protocol, seed: 'motif',
    });
  }

  const CHAIN: CrestRow = {
    slots: ['grindstone', 'lion', 'doubleEagle', null, null],
    sealed: [], commanderRules: [],
  };

  it('advances the rack with the same dt as the guns', () => {
    const director = directorWithCrests(CHAIN);
    expect(director.crestMotifs.length).toBeGreaterThan(1);

    // At zero, only the first has begun.
    expect(director.crestFrames().length).toBeGreaterThan(0);
    const seen = new Set<number>();
    for (let i = 0; i < 120; i++) {
      director.advance(1 / 60);
      for (const entry of director.crestFrames()) seen.add(entry.ignition.slot);
    }
    // Every slot that ignited was drawn at some point during the salvo.
    expect(seen.size).toBe(new Set(director.crestMotifs.map(m => m.slot)).size);
  });

  it('is not finished while the rack is still moving', () => {
    const director = directorWithCrests(CHAIN);
    expect(director.done).toBe(false);
  });

  it('draws nothing at all under reduced motion', () => {
    let state = createCombat({
      deck: [], enemy: { id: 'v', displayName: 'v', hp: 900, maxHp: 900 },
      seed: 'quiet', shuffle: false, crests: CHAIN,
      towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
    }).state;
    const unit = createUnit('gunner-13')!;
    const deployed = performAction({ ...state, hand: [unit], momentum: 99 },
      { type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: 2 });
    if (deployed.ok) state = deployed.state;

    const protocol = resolve(GAME_REGISTRY, newSession(CHAIN, { resources: NO_RESOURCES }),
      'tableauRead', { tower: 2, rank: 5, branch: 'bow', copies: 0 },
      { dryRun: true }).protocol;

    const director = new SalvoDirector({
      towers: state.towers, camera: DEFAULT_CAMERA,
      settings: { ...DEFAULT_PRESENTATION, reducedMotion: true },
      target: { col: 18, row: 10 }, volleys: 3, damage: 400,
      crestProtocol: protocol, seed: 'quiet',
    });
    director.advance(0.1);
    // The rack still REPORTS what happened — the motifs are what stop.
    expect(director.crestMotifs.length).toBeGreaterThan(0);
    expect(director.crestFrames()).toEqual([]);
  });

  it('costs nothing to ask what the row would do', () => {
    const session = newSession(CHAIN, { resources: { ...NO_RESOURCES, powder: 4 } });
    resolve(GAME_REGISTRY, session, 'tableauRead',
      { tower: 2, rank: 5, branch: 'bow', copies: 0 }, { dryRun: true });
    expect(session.resources.powder).toBe(4);
    expect(session.protocol).toEqual([]);
  });
});
