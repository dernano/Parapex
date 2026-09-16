import { describe, expect, it } from 'vitest';

import { CREST_EVENTS, type CrestEventName } from '@/crests/types';
import { CRESTS, CREST_BY_ID, CREST_IDS, crestsByRarity } from '@/content/crests/crests';
import { LEGACY_CREST_IDS, crestIdFromLegacy } from '@/content/crests/legacyIds';

import golden from './fixtures/crestShapes.golden.json' with { type: 'json' };

/**
 * PARITY OF CREST CONTENT.
 *
 * The 2450 pair fixtures cannot run until the combat engine and the pipeline
 * are wired together (Phase 3d). This check can run today, and it catches the
 * most likely translation error by far: a crest that quietly lost an event, or
 * gained one it never had.
 *
 * It is the check legacy `meldeWappen` performs at startup, turned into a test.
 */

/** German event names to the English ones. */
const EVENT_FROM_LEGACY: Readonly<Record<string, CrestEventName>> = {
  kampfBeginnt: 'combatBegan', rundeBeginnt: 'roundBegan', rundeEndet: 'roundEnded',
  kampfEndet: 'combatEnded', karteGezogen: 'cardDrawn', kartenGetauscht: 'cardsExchanged',
  einheitGesetzt: 'unitDeployed', einheitErsetzt: 'unitReplaced',
  blattGelesen: 'tableauRead', formationenErkannt: 'formationsRecognised',
  salveGeplant: 'volleyPlanned', salveGefeuert: 'volleyFired',
  feindGetroffen: 'enemyHit', ueberschlag: 'overkill', feindBesiegt: 'enemyDefeated',
  wappenZuendet: 'crestTriggered',
};

const RARITY_FROM_LEGACY: Readonly<Record<string, string>> = {
  gewoehnlich: 'common', ungewoehnlich: 'uncommon', selten: 'rare', legendaer: 'legendary',
};

describe('all fifty crests are present and named the same', () => {
  it('has exactly the fifty crests the legacy tree has', () => {
    expect(CRESTS).toHaveLength(golden.faelle.length);
    expect([...CREST_IDS].sort())
      .toEqual(golden.faelle.map(f => crestIdFromLegacy(f.id)!).sort());
  });

  it('the legacy id table covers every crest, both ways', () => {
    expect(Object.keys(LEGACY_CREST_IDS)).toHaveLength(50);
    expect(new Set(Object.values(LEGACY_CREST_IDS)).size).toBe(50);
  });

  it('no id appears twice', () => {
    expect(new Set(CREST_IDS).size).toBe(CREST_IDS.length);
  });

  it('the event vocabulary matches the legacy one in size', () => {
    expect(CREST_EVENTS).toHaveLength(Object.keys(EVENT_FROM_LEGACY).length);
    expect([...CREST_EVENTS].sort())
      .toEqual(Object.values(EVENT_FROM_LEGACY).sort());
  });
});

describe('every crest listens to exactly what it listened to before', () => {
  for (const legacy of golden.faelle) {
    it(`${legacy.id} → ${crestIdFromLegacy(legacy.id)}`, () => {
      const crest = CREST_BY_ID.get(crestIdFromLegacy(legacy.id)!);
      expect(crest, `crest missing: ${legacy.id}`).toBeDefined();
      if (!crest) return;

      const expected = legacy.hoert.map(e => EVENT_FROM_LEGACY[e]!).sort();
      const actual = Object.keys(crest.listens).sort();
      expect(actual).toEqual(expected);

      // Card text and heraldry are content the player reads; they travel
      // untranslated, so any drift here is a transcription slip.
      expect(crest.displayName).toBe(legacy.name);
      expect(crest.glyph).toBe(legacy.zeichen);
      expect(crest.tincture).toBe(legacy.tinktur);
      expect(crest.rarity).toBe(RARITY_FROM_LEGACY[legacy.seltenheit]);
      // Typographic dashes were tidied on the way across; compare the words.
      expect(crest.text.replace(/[—–-]/g, '-')).toBe(legacy.text.replace(/[—–-]/g, '-'));
      expect(crest.hint.replace(/[—–-]/g, '-')).toBe(legacy.hinweis.replace(/[—–-]/g, '-'));
    });
  }
});

describe('the shape of the collection', () => {
  it('a crest that listens to nothing is a defect', () => {
    for (const crest of CRESTS) {
      expect(Object.keys(crest.listens).length, crest.id).toBeGreaterThan(0);
    }
  });

  it('keeps the rarity distribution', () => {
    expect(crestsByRarity('common')).toHaveLength(24);
    expect(crestsByRarity('uncommon')).toHaveLength(15);
    expect(crestsByRarity('rare')).toHaveLength(8);
    expect(crestsByRarity('legendary')).toHaveLength(3);
  });

  it('nine crests listen to every event', () => {
    // The amplifiers and counters: what the slot to the left did may have
    // happened in any event at all.
    const universal = CRESTS.filter(c => Object.keys(c.listens).length === CREST_EVENTS.length);
    expect(universal).toHaveLength(9);
  });
});
