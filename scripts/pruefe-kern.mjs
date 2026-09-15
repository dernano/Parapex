/*
 * Die Kernpruefungen - ohne Browser.
 *
 * Das ist der Gewinn aus dem Modulschnitt, und er ist messbar: `pruefe.mjs`
 * startet Chromium, laedt `index.html` und spricht ueber `window.PARAPEX` mit
 * dem Kern. Das dauert Sekunden und braucht Playwright. Hier wird derselbe
 * Kern einfach IMPORTIERT - weil er keine Zeile Browser enthaelt.
 *
 * Die Pruefungen in `pruefe.mjs` bleiben: sie pruefen das ZUSAMMENSPIEL mit
 * der Oberflaeche, und das geht nur im Browser. Reine Regelfragen gehoeren
 * hierher.
 *
 *   node scripts/pruefe-kern.mjs
 */
import * as P from '../quelle/kern.js';

let gut = 0, schlecht = 0;
function pruefe(was, fn) {
  let r;
  try { r = fn(); } catch (e) { r = 'Ausnahme: ' + (e && e.message); }
  if (r === true) { gut++; console.log('  ok   ' + was); }
  else { schlecht++; console.log('  FEHL ' + was + '  — ' + r); }
}
const gleich = (a, b, was) => (a === b ? true : was + ': ' + a + ' statt ' + b);

const blatt = (...ids) => ids.map((id, i) =>
  ({ nr: i + 1, typ: 'wachturm', einheit: id ? P.neueEinheit(id) : null }));
const formIds = (t, w) => P.erkenneFormationen(t, w).map(f => f.id).sort();
const hat = (t, id) => formIds(t).includes(id);
const misch = (a) => { const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b.map((t, i) => ({ ...t, nr: i + 1 })); };

console.log('\nKern ohne Browser\n');

// ---------- Wucht ----------
pruefe('Rang ist Wucht, Schliff kommt dazu', () => {
  const k = P.neueEinheit('bogen-9');
  if (P.wirkwucht(k) !== 9) return 'ungeschliffen ' + P.wirkwucht(k);
  P.verbessereEinheit(k, 4);
  return gleich(P.wirkwucht(k), 13, 'geschliffen') === true &&
    gleich(P.bonusWucht(k), 4, 'Bonus') === true ? true : 'Schliff kommt nicht an';
});

pruefe('Der Posten trennt Grund und Bonus', () => {
  const k = P.neueEinheit('bogen-9');
  P.verbessereEinheit(k, 4);
  const p = P.berechneWucht([{ nr: 1, typ: 'wachturm', einheit: k }]).posten[0];
  if (p.grund !== 9) return 'grund ' + p.grund;
  if (p.bonus !== 4) return 'bonus ' + p.bonus;
  return gleich(p.basis, 13, 'basis');
});

pruefe('Wucht ist Summe je Salve mal Salvenzahl', () => {
  const t = blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12');
  const w = P.berechneWucht(t);
  if (w.jeSalve !== 50) return 'je Salve ' + w.jeSalve;
  return gleich(w.wucht, 50 * w.salven, 'Gesamtwucht');
});

pruefe('Der passende Turmtyp hebt nur seine Gattung', () => {
  const einheit = () => P.neueEinheit('bogen-10');
  const auf = (typ) => P.berechneWucht([{ nr: 1, typ, einheit: einheit() }]).posten[0].wucht;
  if (auf('wachturm') !== 10) return 'Wachturm ' + auf('wachturm');
  if (Math.round(auf('schuetzenturm')) !== 14) return 'Schützenturm ' + auf('schuetzenturm');
  return gleich(auf('pulverturm'), 10, 'Pulverturm für Bogen');
});

// ---------- Formationen ----------
pruefe('Die Stellung der Türme zählt nicht', () => {
  const t = blatt('bogen-5', 'armbrust-6', 'kanonier-7', 'artillerie-12', 'bogen-2');
  for (let i = 0; i < 20; i++) {
    if (!hat(misch(t), 'vormarsch')) return 'nach dem Mischen weg';
  }
  return true;
});

pruefe('Je Familie gilt nur die höchste', () => {
  const ids = formIds(blatt('bogen-2', 'bogen-7', 'bogen-11', 'bogen-4', 'bogen-9'));
  if (!ids.includes('reineGarde')) return 'Reine Garde fehlt';
  for (const weg of ['regiment', 'grossesRegiment']) {
    if (ids.includes(weg)) return weg + ' gilt daneben';
  }
  return true;
});

// ---------- Die Königliche Garde ----------
const garde = (g = 'bogen') => blatt(g + '-9', g + '-10', g + '-11', g + '-12', g + '-13');

pruefe('Neun bis König in einer Gattung ist die Königliche Garde', () =>
  hat(garde(), 'koeniglicheGarde') || 'nicht erkannt: ' + formIds(garde()));

pruefe('Die Garde gilt in jeder Gattung', () => {
  for (const g of P.GATTUNG_LISTE) if (!hat(garde(g), 'koeniglicheGarde')) return g + ' nicht';
  return true;
});

pruefe('Die Garde löst den Königlichen Aufmarsch ab', () => {
  const ids = formIds(garde());
  for (const weg of ['koeniglicherAufmarsch', 'reineGarde', 'perfekterVormarsch']) {
    if (ids.includes(weg)) return weg + ' gilt daneben';
  }
  return true;
});

pruefe('Acht bis Dame ist nur ein Aufmarsch', () => {
  const t = blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12');
  if (hat(t, 'koeniglicheGarde')) return 'die Garde gilt schon ab der Acht';
  return hat(t, 'koeniglicherAufmarsch') || 'der Aufmarsch fehlt';
});

pruefe('Die Garde zahlt ihre Salven aus', () => {
  const f = P.FORMATIONEN.find(x => x.id === 'koeniglicheGarde');
  const w = P.berechneWucht(garde());
  return gleich(w.salven, 1 + f.salven + 1, 'Salven');
});

// ---------- Ohne Lauf gilt Stufe eins ----------
pruefe('Ohne Lauf tragen alle Formationen Stufe eins', () => {
  for (const f of P.erkenneFormationen(garde())) {
    if (f.stufe !== 1) return f.id + ' hat Stufe ' + f.stufe;
  }
  return true;
});

pruefe('Formationsstufen heben die Salven', () => {
  const f = P.FORMATIONEN.find(x => x.id === 'koeniglicheGarde');
  return gleich(P.formationsSalven(f, 3) - P.formationsSalven(f, 1), 2 * f.jeStufe, 'Zuwachs');
});

// ---------- Ein Kampf, ohne jede Anzeige ----------
pruefe('Ein Kampf läuft von Anfang bis Ende durch', () => {
  const k = P.neuerKampf({ feind: P.baueFeind(1), deck: P.START_DECK.map(id => P.neueEinheit(id)) });
  if (k.hand.length !== P.KERN.handGroesse) return 'Hand ' + k.hand.length;
  let runden = 0;
  while (!k.ende && runden < 20) {
    P.setzeEinheit(runden % P.KERN.tuerme, k.hand[0]);
    P.beendeRunde();
    runden++;
  }
  if (!k.ende) return 'der Kampf endete nie';
  if (runden > P.KERN.runden) return runden + ' Runden gespielt';
  return true;
});

pruefe('Fünf Runden, dann ist Schluss', () => {
  // Ein Gegner, der nicht faellt: der Kampf muss trotzdem enden.
  const k = P.neuerKampf({ feind: { name: 'Fels', hp: 1e9, maxHp: 1e9, regeln: [] },
    deck: P.START_DECK.map(id => P.neueEinheit(id)) });
  for (let r = 0; r < P.KERN.runden; r++) P.beendeRunde();
  return gleich(k.ende, 'niederlage', 'Ausgang nach fünf Runden');
});

console.log(`\n${gut} von ${gut + schlecht} Kernprüfungen bestanden.\n`);
process.exit(schlecht ? 1 : 0);
