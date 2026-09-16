import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CRESTS } from '@/content/crests/crests';
import { GAME_REGISTRY } from '@/content/crests/registry';
import { newSession, resolve } from '@/crests/CrestPipeline';
import { EFFECT_KINDS } from '@/crests/effects';
import { NO_RESOURCES, type CrestId, type CrestRow } from '@/crests/types';
import {
  MAX_CHAIN_SECONDS, PROFILE_FOR_EFFECT, PROFILE_VISUALS, TRIGGER_PROFILES,
  presentIgnitions, profileFor,
} from '@/rendering/crests/triggerProfiles';
import { crestRackLayout, slotCentre } from '@/rendering/crests/crestRack';
import {
  fieldJourney, journeyLine, replayChain, reversedOrder, valueUnderOrder,
} from '@/rendering/crests/crestChain';
import { probeCrest, probeRow, rowUses } from '@/rendering/crests/crestProbe';
import {
  NOBODY_USES_POWDER, presentSupplies, supplyWarnings,
} from '@/rendering/crests/resourcePresentation';

const row = (...ids: (CrestId | null)[]): CrestRow => ({
  slots: [...ids, null, null, null, null, null].slice(0, 5),
  sealed: [], commanderRules: [],
});

const session = (r: CrestRow, resources = NO_RESOURCES) =>
  newSession(r, { resources });

/* ============================================================
 *  The profiles
 * ============================================================ */

describe('a crest looks like what it DID', () => {
  /**
   * The brief's rule, and the reason this is derived rather than tabulated:
   * a fifty-first crest needs no work at all, and a crest whose look is wrong
   * is telling you its EFFECT is wrong.
   */
  it('has a profile for every effect kind the rules can record', () => {
    for (const kind of Object.keys(EFFECT_KINDS)) {
      expect(PROFILE_FOR_EFFECT[kind], kind).toBeDefined();
      expect(TRIGGER_PROFILES, kind).toContain(PROFILE_FOR_EFFECT[kind]!);
    }
    expect(PROFILE_FOR_EFFECT.resource).toBe('TRANSFER');
  });

  it('gives every profile a distinct motif rather than a shared glow', () => {
    const motifs = TRIGGER_PROFILES.map(p => PROFILE_VISUALS[p].motif);
    expect(new Set(motifs).size).toBe(TRIGGER_PROFILES.length);
  });

  it('reads addition as a spark and multiplication as a blow', () => {
    expect(profileFor({
      source: 'original', rejected: null,
      effects: [{ kind: 'bonus', value: 4, note: '' }],
    })).toBe('SPARK');
    expect(profileFor({
      source: 'original', rejected: null,
      effects: [{ kind: 'factor', value: 1.5, note: '' }],
    })).toBe('IMPACT');
  });

  it('lets the loudest effect decide when one crest did several things', () => {
    expect(profileFor({
      source: 'original', rejected: null,
      effects: [
        { kind: 'bonus', value: 2, note: '' },
        { kind: 'factor', value: 3, note: '' },
      ],
    })).toBe('IMPACT');
  });

  it('lets the SOURCE win over the effect', () => {
    expect(profileFor({
      source: 'retrigger', rejected: null,
      effects: [{ kind: 'factor', value: 3, note: '' }],
    })).toBe('RETRIGGER');
    expect(profileFor({
      source: 'copy', rejected: null,
      effects: [{ kind: 'factor', value: 3, note: '' }],
    })).toBe('COPY');
  });

  /**
   * An ignition with no picture is how a player concludes a crest is broken
   * when it merely had nothing to do.
   */
  it('still shows a crest that fired and changed nothing', () => {
    expect(profileFor({ source: 'original', rejected: null, effects: [] })).toBe('PULSE');
  });

  it('points a directed motif at the slot that caused it', () => {
    const r = row('raven', 'lion');
    const result = resolve(GAME_REGISTRY, session(r), 'tableauRead',
      { tower: 2, rank: 5, branch: 'bow', copies: 0 });
    const shown = presentIgnitions(result.protocol);
    const directed = shown.filter(s => s.visual.directed);
    for (const motif of directed) {
      expect(motif.target === null || motif.target >= 0).toBe(true);
    }
    // And the stagger is in protocol order, which is the order things happened.
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]!.at).toBeGreaterThan(shown[i - 1]!.at);
    }
  });

  /**
   * A rack whose crests retrigger each other can produce forty ignitions, and
   * forty times an eighth of a second is five seconds of badges blinking
   * before anything happens on the wall. The chain compresses, like the salvo.
   */
  it('never runs long, however deep the chain', () => {
    const long = Array.from({ length: 60 }, (_, nr) => ({
      nr, eventNumber: 0, round: 1, slot: nr % 5, id: 'x', displayName: 'x',
      event: 'volleyPlanned' as const, source: 'original' as const, enemyRule: false,
      depth: 0, causedBy: null, effects: [], rejected: null,
    }));
    const shown = presentIgnitions(long);
    expect(shown[shown.length - 1]!.at).toBeLessThanOrEqual(MAX_CHAIN_SECONDS);
    // Still in order, and still one motif per ignition.
    expect(shown).toHaveLength(60);
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i]!.at).toBeGreaterThan(shown[i - 1]!.at);
    }
  });

  it('shows a single ignition immediately rather than after a delay', () => {
    const one = presentIgnitions([{
      nr: 0, eventNumber: 0, round: 1, slot: 2, id: 'x', displayName: 'x',
      event: 'volleyPlanned', source: 'original', enemyRule: false,
      depth: 0, causedBy: null, effects: [], rejected: null,
    }]);
    expect(one[0]!.at).toBe(0);
  });
});

/**
 * The architectural half of the same rule. A test that only checked the table
 * would not stop somebody writing `if (crest.id === 'lion')` in the renderer
 * next week.
 */
describe('the renderer knows no crest by name', () => {
  const RENDERING = fileURLToPath(new URL('../rendering', import.meta.url));

  function files(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...files(full));
      else if (entry.endsWith('.ts')) out.push(full);
    }
    return out;
  }

  it('mentions not one of the fifty crest ids anywhere under rendering/', () => {
    /*
     * Comments stripped first. The rule is about CODE: the paragraph in
     * `triggerProfiles.ts` that states the rule by quoting the forbidden line
     * is the documentation working, not a violation of itself.
     */
    const sources = files(RENDERING).map(path => ({
      path,
      text: readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    }));
    expect(sources.length).toBeGreaterThan(10);

    const offenders: string[] = [];
    for (const crest of CRESTS) {
      // Quoted, so a crest called `mirror` does not trip on the word mirror.
      const pattern = new RegExp(`['"\`]${crest.id}['"\`]`);
      for (const source of sources) {
        if (pattern.test(source.text)) offenders.push(`${source.path} -> ${crest.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ============================================================
 *  The rack
 * ============================================================ */

describe('the rack says the order is the rule', () => {
  it('always shows exactly five slots, filled or not', () => {
    const layout = crestRackLayout(row('lion'), GAME_REGISTRY);
    expect(layout.slots).toHaveLength(5);
    expect(layout.slots[0]!.crest!.displayName).toBe('Wappen des Löwen');
    expect(layout.slots[1]!.crest).toBeNull();
  });

  it('joins the slots one way, so the sequence is visible before any text', () => {
    const layout = crestRackLayout(row('lion', 'grindstone'), GAME_REGISTRY);
    expect(layout.flows).toHaveLength(4);
    expect(layout.flows.map(f => [f.from, f.to]))
      .toEqual([[0, 1], [1, 2], [2, 3], [3, 4]]);
    expect(layout.slots[4]!.flowsTo).toBeNull();
  });

  it('never moves a crest because a neighbour was removed', () => {
    const full = crestRackLayout(row('lion', 'grindstone', 'wolf'), GAME_REGISTRY);
    const gapped = crestRackLayout(row('lion', null, 'wolf'), GAME_REGISTRY);
    expect(gapped.slots[2]!.x).toBe(full.slots[2]!.x);
  });

  it('keeps a sealed slot visible and in place', () => {
    const sealed: CrestRow = { ...row('lion', 'wolf'), sealed: [1] };
    const layout = crestRackLayout(sealed, GAME_REGISTRY);
    expect(layout.slots[1]!.sealed).toBe(true);
    expect(layout.slots[1]!.crest!.displayName).toBe('Wappen des Wolfs');
  });

  it('places the motifs where the slots are', () => {
    const layout = crestRackLayout(row('lion'), GAME_REGISTRY);
    expect(slotCentre(layout, 0).x).toBeLessThan(slotCentre(layout, 4).x);
  });
});

/* ============================================================
 *  The chain
 * ============================================================ */

describe('the chain, made visible', () => {
  const DATA = { tower: 2, rank: 5, branch: 'bow', copies: 0 };

  /**
   * THE TEST THAT KEEPS THE DISPLAY HONEST. If the replay and the pipeline
   * ever disagree, this display is lying to the player about their own
   * machine.
   */
  it('replays exactly what the pipeline actually did', () => {
    const r = row('grindstone', 'lion', 'whetstone');
    const result = resolve(GAME_REGISTRY, session(r), 'tableauRead', { ...DATA });
    const replay = replayChain(result.protocol, DATA, GAME_REGISTRY);
    expect(replay.final.rank).toBe(result.data.rank);
    expect(replay.final.copies).toBe(result.data.copies);
  });

  /** (s + 1) × 3 and s × 3 + 1 are different numbers. That is the game. */
  it('shows the arrangement changing the answer', () => {
    const grindstoneFirst = resolve(GAME_REGISTRY, session(row('grindstone', 'lion')),
      'tableauRead', { ...DATA });
    const lionFirst = resolve(GAME_REGISTRY, session(row('lion', 'grindstone')),
      'tableauRead', { ...DATA });

    expect(grindstoneFirst.data.rank).toBe(18);   // (5 + 1) × 3
    expect(lionFirst.data.rank).toBe(16);         // 5 × 3 + 1
  });

  it('writes the journey out step by step', () => {
    const r = row('grindstone', 'lion');
    const result = resolve(GAME_REGISTRY, session(r), 'tableauRead', { ...DATA });
    const journey = fieldJourney(replayChain(result.protocol, DATA, GAME_REGISTRY), 'rank', 5);
    expect(journeyLine(journey)).toBe('5 → 6 → 18');
    expect(journey[1]!.displayName).toBe('Wappen des Schleifsteins');
    expect(journey[2]!.displayName).toBe('Wappen des Löwen');
  });

  /**
   * And what the other arrangement would have been worth. It has to be a
   * second RESOLUTION: replaying the recorded `+10` after the Grindstone would
   * answer 18 for both and quietly tell the player the order does not matter.
   */
  it('answers what reversing the rack would have given', () => {
    const r = row('grindstone', 'lion');
    expect(valueUnderOrder(GAME_REGISTRY, session(r), [0, 1, 2, 3, 4],
      'tableauRead', DATA, 'rank')).toBe(18);
    expect(valueUnderOrder(GAME_REGISTRY, session(r), [1, 0, 2, 3, 4],
      'tableauRead', DATA, 'rank')).toBe(16);
    expect(reversedOrder()).toEqual([4, 3, 2, 1, 0]);
  });

  it('costs the player nothing to ask', () => {
    const s = session(row('millwheel'), { ...NO_RESOURCES, powder: 4 });
    valueUnderOrder(GAME_REGISTRY, s, reversedOrder(), 'cardsExchanged',
      { count: 2, cost: 1 }, 'cost');
    expect(s.resources.powder).toBe(4);
  });

  it('records a supply move as a supply move, not as a field change', () => {
    const r = row('millwheel');
    const result = resolve(GAME_REGISTRY, session(r), 'cardsExchanged', { count: 1, cost: 1 });
    const replay = replayChain(result.protocol, { count: 1, cost: 1 }, GAME_REGISTRY);
    const step = replay.steps[0]!;
    expect(step.changes).toEqual([]);
    expect(step.supplies).toEqual([{ kind: 'powder', amount: 1, note: 'gemahlen' }]);
    expect(step.profile).toBe('TRANSFER');
  });
});

/* ============================================================
 *  Supplies, in context
 * ============================================================ */

describe('what the rack actually does with supplies', () => {
  it('measures a crest rather than looking it up in a table', () => {
    expect(probeCrest(GAME_REGISTRY, 'millwheel').produces).toContain('powder');
    expect(probeCrest(GAME_REGISTRY, 'whetstone').produces).toContain('powder');
    expect(probeCrest(GAME_REGISTRY, 'powderHorn').consumes).toContain('powder');
    expect(probeCrest(GAME_REGISTRY, 'tinder').consumes).toContain('powder');
  });

  /** The Hammerwerk reads powder without burning any. It still USES it. */
  it('counts reading a supply as using it', () => {
    const use = probeCrest(GAME_REGISTRY, 'ironworks');
    expect(use.consumes).not.toContain('powder');
    expect(use.reads).toContain('powder');
    expect(rowUses(use, 'powder')).toBe(true);
  });

  it('says nothing about a crest that has nothing to do with supplies', () => {
    const use = probeCrest(GAME_REGISTRY, 'lion');
    expect(use.produces).toEqual([]);
    expect(use.consumes).toEqual([]);
  });

  it('ignores a slot a commander has sealed, because it does nothing', () => {
    const sealed: CrestRow = { ...row('millwheel', 'powderHorn'), sealed: [1] };
    const use = probeRow(GAME_REGISTRY, sealed.slots, sealed.sealed);
    expect(use.produces).toContain('powder');
    expect(rowUses(use, 'powder')).toBe(false);
  });

  /**
   * THE BRIEF'S OWN CASE. Two crests that both make powder and none that
   * spends it — the commonest dead engine a player can build, and the game
   * currently lets them build it in silence.
   */
  it('warns, in those words, when the Mühlrad and the Wetzstein feed nothing', () => {
    const r = row('millwheel', 'whetstone');
    const use = probeRow(GAME_REGISTRY, r.slots);
    const displays = presentSupplies({ ...NO_RESOURCES, powder: 7 }, use);
    const powder = displays.find(d => d.kind === 'powder')!;

    expect(powder.state).toBe('dead');
    expect(powder.note).toBe(NOBODY_USES_POWDER);
    expect(supplyWarnings(displays)).toContain(NOBODY_USES_POWDER);
  });

  it('stops warning the moment something downstream burns it', () => {
    const r = row('millwheel', 'whetstone', 'powderHorn');
    const displays = presentSupplies({ ...NO_RESOURCES, powder: 7 },
      probeRow(GAME_REGISTRY, r.slots));
    const powder = displays.find(d => d.kind === 'powder')!;
    expect(powder.state).toBe('flowing');
    expect(powder.note).toBeNull();
  });

  it('says the opposite when the rack burns what nothing makes', () => {
    const displays = presentSupplies(NO_RESOURCES,
      probeRow(GAME_REGISTRY, row('powderHorn').slots));
    const powder = displays.find(d => d.kind === 'powder')!;
    expect(powder.state).toBe('starved');
    expect(powder.note).toContain('erzeugt');
  });

  it('shows no counter at all for a supply the rack never touches', () => {
    const displays = presentSupplies(NO_RESOURCES,
      probeRow(GAME_REGISTRY, row('lion').slots));
    expect(displays).toEqual([]);
  });

  it('points more loudly the bigger the wasted pile gets', () => {
    const use = probeRow(GAME_REGISTRY, row('millwheel').slots);
    const small = presentSupplies({ ...NO_RESOURCES, powder: 1 }, use)[0]!;
    const large = presentSupplies({ ...NO_RESOURCES, powder: 30 }, use)[0]!;
    expect(large.urgency).toBeGreaterThan(small.urgency);
  });
});
