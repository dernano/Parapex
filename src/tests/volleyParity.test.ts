import { describe, expect, it } from 'vitest';

import type { Tower, TowerTypeId } from '@/core/types';
import { createUnit, polish } from '@/content/units/pool';
import { unitIdFromLegacy } from '@/content/units/legacyIds';
import { LEGACY_TOWER_TYPE_IDS } from '@/content/towers/towerTypes';
import {
  LEGACY_FORMATION_FAMILIES, LEGACY_FORMATION_IDS,
} from '@/content/formations/legacyIds';
import { computeForce } from '@/simulation/VolleyEngine';

import golden from './fixtures/volley.golden.json' with { type: 'json' };

/**
 * PARITY.
 *
 * `volley.golden.json` was written by the LEGACY implementation
 * (quelle/kern/wucht.js + formationen.js) via scripts/golden.mjs. These tests
 * are the contract of the migration: the new engine answers the same numbers,
 * or the migration is a rewrite wearing a migration's clothes.
 *
 * This is also the only place in src/ that knows the legacy vocabulary exists,
 * and it knows it through the published id tables, not through imports from
 * quelle/. Nothing under src/ imports the legacy tree.
 *
 * When the legacy tree is deleted in Phase 10 these fixtures stay: by then
 * they are no longer "what the old code did" but "what the game does", and
 * they are the regression net for everything built on top of force.
 */

interface GoldenTower {
  typ: string;
  einheit: string | null;
  wuchtBonus?: number;
  stufe?: number;
}

function towersFromGolden(rows: readonly GoldenTower[]): Tower[] {
  return rows.map((row, i): Tower => {
    const type = LEGACY_TOWER_TYPE_IDS[row.typ];
    if (!type) throw new Error(`unknown legacy tower type: ${row.typ}`);
    if (!row.einheit) return { number: i + 1, type: type as TowerTypeId, unit: null };

    const id = unitIdFromLegacy(row.einheit);
    if (!id) throw new Error(`unknown legacy unit id: ${row.einheit}`);
    let unit = createUnit(id);
    if (!unit) throw new Error(`unit not in pool: ${id}`);
    // The fixture records polish as a bonus; reproduce it through the real
    // operation so the test exercises `polish`, not an object literal.
    for (let n = 0; n < (row.stufe ?? 0); n++) unit = polish(unit);
    expect(unit.forceBonus).toBe(row.wuchtBonus ?? 0);
    return { number: i + 1, type: type as TowerTypeId, unit };
  });
}

describe('computeForce reproduces the legacy calculation', () => {
  for (const testCase of golden.faelle) {
    it(testCase.name, () => {
      const towers = towersFromGolden(testCase.eingabe.tuerme as GoldenTower[]);
      const settlement = computeForce(towers);
      const expected = testCase.erwartet;

      expect(settlement.force).toBe(expected.wucht);
      expect(settlement.volleys).toBe(expected.salven);
      expect(settlement.base).toBe(expected.grund);
      expect(settlement.perVolley).toBe(expected.jeSalve);

      // Formations: same set, same order, same worth, same towers.
      expect(settlement.formations.map(f => ({
        id: f.id,
        family: f.family,
        volleys: f.volleys,
        level: f.level,
        towers: [...f.towers].sort((a, b) => a - b),
      }))).toEqual(expected.formationen.map(f => ({
        id: LEGACY_FORMATION_IDS[f.id],
        family: LEGACY_FORMATION_FAMILIES[f.familie],
        volleys: f.salven,
        level: f.stufe,
        towers: f.tuerme,
      })));

      // Emplacements: the per-tower breakdown the display reads.
      expect(settlement.emplacements.map(e => ({
        tower: e.tower, effective: e.effective, towerFactor: e.towerFactor,
        force: e.force, base: e.base, bonus: e.bonus, shots: e.shots,
      }))).toEqual(expected.posten.map(p => ({
        tower: p.turm, effective: p.basis, towerFactor: p.turmFaktor,
        force: p.wucht, base: p.grund, bonus: p.bonus, shots: p.schuesse,
      })));

      // Steps: the readable chain, line for line.
      const KIND: Record<string, string> = {
        grund: 'base', formation: 'formation', salven: 'volleys',
      };
      expect(settlement.steps.map(s => ({
        kind: s.kind, displayName: s.displayName, value: s.value,
        force: Math.round(s.force * 1e6) / 1e6,
      }))).toEqual(expected.schritte.map(s => ({
        kind: KIND[s.art], displayName: s.name, value: s.wert, force: s.wucht,
      })));
    });
  }
});

describe('the fixtures cover what they claim to cover', () => {
  it('exercises every formation at least once', () => {
    const seen = new Set<string>();
    for (const testCase of golden.faelle) {
      for (const f of testCase.erwartet.formationen) seen.add(LEGACY_FORMATION_IDS[f.id]!);
    }
    const missing = Object.values(LEGACY_FORMATION_IDS).filter(id => !seen.has(id));
    expect(missing).toEqual([]);
  });

  it('runs entirely without a browser', () => {
    expect(typeof globalThis.document).toBe('undefined');
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
  });
});
