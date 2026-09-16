/*
 * PHASE 0 — the golden fixtures.
 *
 * Before a single rule moves to TypeScript, the legacy implementation writes
 * down what it currently answers. Every case here is deterministic: fixed
 * tower setups, no shuffling, no RNG, no crests. The new engine has to
 * reproduce these numbers exactly, or the migration is a rewrite in disguise.
 *
 * Crests stay out on purpose. The pipeline is Phase 3; this slice proves the
 * force/formation calculation, which is the part every other number in the
 * game is built on.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(join(ROOT, 'quelle/kern.js'));

/** A tower row from a compact description: "bogen-3" or null for an empty slot. */
const bauen = (einheiten, typen = []) => einheiten.map((id, i) => ({
  nr: i + 1,
  typ: typen[i] || 'wachturm',
  einheit: id ? P.neueEinheit(id) : null,
}));

const faelle = [];
const fall = (name, einheiten, { typen = [], schliffe = {} } = {}) => {
  const tuerme = bauen(einheiten, typen);
  // Schliffe: Turmindex -> wie oft geschliffen. Hebt wuchtBonus, nicht den Rang.
  for (const [i, male] of Object.entries(schliffe)) {
    for (let n = 0; n < male; n++) P.verbessereEinheit(tuerme[i].einheit);
  }
  const a = P.berechneWucht(tuerme, [], true);
  faelle.push({
    name,
    eingabe: {
      tuerme: tuerme.map(t => (t.einheit
        ? { typ: t.typ, einheit: t.einheit.id, wuchtBonus: t.einheit.wuchtBonus, stufe: t.einheit.stufe }
        : { typ: t.typ, einheit: null })),
    },
    erwartet: {
      wucht: a.wucht,
      salven: a.salven,
      grund: a.grund,
      jeSalve: a.jeSalve,
      formationen: a.formationen.map(f => ({ id: f.id, familie: f.familie, salven: f.salven,
        stufe: f.stufe, tuerme: f.tuerme.slice().sort((x, y) => x - y) })),
      posten: a.posten.map(p => ({ turm: p.turm, basis: p.basis, turmFaktor: p.turmFaktor,
        wucht: p.wucht, grund: p.grund, bonus: p.bonus, schuesse: p.schuesse })),
      schritte: a.schritte.map(s => ({ art: s.art, name: s.name, wert: s.wert,
        wucht: Math.round(s.wucht * 1e6) / 1e6 })),
    },
  });
};

/* ---------- leer und einzeln ---------- */
fall('kein Turm besetzt', [null, null, null, null, null]);
fall('eine Einheit', ['bogen-1', null, null, null, null]);
fall('eine Einheit, hoechster Rang', [null, null, 'kanonier-13', null, null]);

/* ---------- Familie Grundstellung ---------- */
fall('Geschlossene Front, gemischt', ['bogen-1', 'armbrust-4', 'artillerie-7', 'kanonier-10', 'bogen-12']);

/* ---------- Familie Gattung ---------- */
fall('Regiment: drei Bogen', ['bogen-2', 'bogen-5', 'bogen-9', null, null]);
fall('Grosses Regiment: vier Armbrust', ['armbrust-1', 'armbrust-4', 'armbrust-7', 'armbrust-11', null]);
fall('Reine Garde: fuenf Artillerie', ['artillerie-1', 'artillerie-3', 'artillerie-6', 'artillerie-9', 'artillerie-12']);

/* ---------- Familie Rang ---------- */
fall('Doppelposten', ['bogen-6', 'armbrust-6', null, null, null]);
fall('Doppelte Wache', ['bogen-6', 'armbrust-6', 'bogen-9', 'kanonier-9', null]);
fall('Drillingsposten', ['bogen-8', 'armbrust-8', 'artillerie-8', null, null]);
fall('Viererblock', ['bogen-11', 'armbrust-11', 'artillerie-11', 'kanonier-11', null]);

/* ---------- Familie Rangfolge ---------- */
fall('Vormarsch', ['bogen-3', 'armbrust-4', 'artillerie-5', null, null]);
fall('Grosser Vormarsch', ['bogen-3', 'armbrust-4', 'artillerie-5', 'kanonier-6', null]);
fall('Perfekter Vormarsch, gemischt', ['bogen-2', 'armbrust-3', 'artillerie-4', 'kanonier-5', 'bogen-6']);
fall('Folge mit Wiederholung zaehlt einmal', ['bogen-8', 'armbrust-8', 'artillerie-9', 'kanonier-10', null]);

/* ---------- Kroenungen ---------- */
fall('Koeniglicher Aufmarsch', ['bogen-2', 'bogen-3', 'bogen-4', 'bogen-5', 'bogen-6']);
fall('Koenigliche Garde', ['kanonier-9', 'kanonier-10', 'kanonier-11', 'kanonier-12', 'kanonier-13']);
fall('Garde in ungeordneter Stellung', ['bogen-12', 'bogen-9', 'bogen-13', 'bogen-10', 'bogen-11']);

/* ---------- Turmtypen ---------- */
fall('Schuetzenturm traegt Bogen', ['bogen-10', null, null, null, null], { typen: ['schuetzenturm'] });
fall('Schuetzenturm traegt keine Armbrust', ['armbrust-10', null, null, null, null], { typen: ['schuetzenturm'] });
fall('fuenf passende Tuerme', ['kanonier-9', 'kanonier-10', 'kanonier-11', 'kanonier-12', 'kanonier-13'],
  { typen: ['pulverturm', 'pulverturm', 'pulverturm', 'pulverturm', 'pulverturm'] });
fall('gemischte Tuerme, gemischte Gattungen',
  ['bogen-13', 'armbrust-13', 'artillerie-13', 'kanonier-13', 'bogen-12'],
  { typen: ['schuetzenturm', 'ballistenturm', 'geschuetzturm', 'pulverturm', 'wachturm'] });

/* ---------- Schliffe: Wucht steigt, Rang nicht ---------- */
fall('geschliffener Bogen behaelt seinen Rang',
  ['bogen-9', 'armbrust-9', 'artillerie-9', null, null], { schliffe: { 0: 2 } });
fall('Schliff auf passendem Turm',
  ['bogen-9', null, null, null, null], { typen: ['schuetzenturm'], schliffe: { 0: 3 } });

/* ---------- Loecher in der Reihe ---------- */
fall('Luecken zwischen den Stellungen', ['bogen-5', null, 'bogen-6', null, 'bogen-7']);

const raus = {
  _hinweis: 'Generated from the legacy implementation by scripts/golden.mjs. '
    + 'The TypeScript engine must reproduce these values exactly. Do not hand-edit.',
  _quelle: 'quelle/kern/wucht.js + quelle/kern/formationen.js',
  faelle,
};
const ziel = join(ROOT, 'src/tests/fixtures/volley.golden.json');
writeFileSync(ziel, JSON.stringify(raus, null, 2) + '\n');
console.log(faelle.length + ' Goldproben geschrieben: ' + ziel);
