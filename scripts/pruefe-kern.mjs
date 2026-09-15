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


/* ============================================================
 *  D A S   W A P P E N - F L I E S S B A N D
 * ============================================================
 *
 * Die eine Frage, an der dieses System haengt: AENDERT DIE REIHENFOLGE DAS
 * ERGEBNIS? Wenn nicht, ist das Gestell nur Zierde und der ganze Umbau war
 * umsonst. Alles Weitere prueft, dass die Maschine dabei nicht durchdreht.
 */
console.log('\nDas Wappen-Fließband\n');

/* Zwei Pruefwappen, die es im Spiel nicht gibt: das billigste Paar, an dem
 * sich Reihenfolge zeigen laesst - eines addiert, eines multipliziert. */
const PLUS = P.meldeWappen({
  id: 'pruefPlus', name: 'Prüfplus', zeichen: '+', seltenheit: 'gewoehnlich',
  text: '+10 Salven.', hinweis: 'nur zum Prüfen',
  hoert: { [P.EREIGNIS.salveGeplant]: (l) => { l.daten.salven += 10; l.ich.wirkungen.push({ art: 'salven', wert: 10, text: '' }); } },
});
const MAL = P.meldeWappen({
  id: 'pruefMal', name: 'Prüfmal', zeichen: '×', seltenheit: 'gewoehnlich',
  text: '×3 Salven.', hinweis: 'nur zum Prüfen',
  hoert: { [P.EREIGNIS.salveGeplant]: (l) => { l.daten.salven *= 3; l.ich.wirkungen.push({ art: 'salvenFaktor', wert: 3, text: '' }); } },
});

const fuenf = () => blatt('bogen-8', 'armbrust-3', 'kanonier-5', 'artillerie-7', 'bogen-2');
const salvenMit = (...w) => P.berechneWucht(fuenf(), w).salven;

pruefe('Die Reihenfolge ändert das Ergebnis', () => {
  const links = salvenMit(PLUS.id, MAL.id);   // (s+10) x3
  const rechts = salvenMit(MAL.id, PLUS.id);  // s x3 +10
  if (links === rechts) return 'beide Anordnungen geben ' + links;
  return links > rechts ? true : 'die addierende Reihenfolge müsste mehr geben';
});

pruefe('Dieselben Wappen, dieselbe Reihenfolge, dasselbe Ergebnis', () =>
  gleich(salvenMit(PLUS.id, MAL.id), salvenMit(PLUS.id, MAL.id), 'Salven'));

pruefe('Ein Platz mehr rechts sieht, was links geschah', () => {
  const ohne = salvenMit(PLUS.id);
  const mit = salvenMit(PLUS.id, 'drache');   // der Drache verdoppelt den linken Nachbarn
  return mit === ohne + 10 ? true : 'Drache gab ' + (mit - ohne) + ' statt 10 dazu';
});

pruefe('Der Drache verstärkt nur seinen linken Nachbarn', () => {
  const ohne = salvenMit(PLUS.id);
  const davor = salvenMit('drache', PLUS.id);  // Drache auf Platz 1 findet nichts
  return gleich(davor, ohne, 'Salven mit Drache links');
});

pruefe('Verstärken potenziert, was multipliziert', () => {
  const ohne = salvenMit(MAL.id);              // s x3
  const mit = salvenMit(MAL.id, 'drache');     // s x3 x3
  return gleich(mit, ohne * 3, 'Salven');
});

pruefe('Der Greif verstärkt alles links von sich', () => {
  const ohne = salvenMit(PLUS.id, PLUS.id);
  const mit = salvenMit(PLUS.id, PLUS.id, 'greif');
  return gleich(mit, ohne + 20, 'Salven');
});

pruefe('Der Greif auf Platz 1 ist ein leeres Feld', () =>
  gleich(salvenMit('greif', PLUS.id), salvenMit(PLUS.id), 'Salven'));

pruefe('Der Rabe führt das erste Wappen ein zweites Mal aus', () => {
  const ohne = salvenMit(PLUS.id);
  const mit = salvenMit(PLUS.id, 'rabe');
  return gleich(mit, ohne + 10, 'Salven');
});

pruefe('Der Phönix zündet den Platz links noch einmal', () => {
  const ohne = salvenMit(PLUS.id);
  const mit = salvenMit(PLUS.id, 'phoenix');
  return gleich(mit, ohne + 10, 'Salven');
});

/* ---------- Die Sperren ---------- */
/*
 * Der Fall, an dem jedes solche System stirbt: A zuendet B, B zuendet A.
 * Beide sind fuer sich sinnvoll. Zusammen muessen sie ENDEN - und zwar nicht,
 * weil jemand ihre Namen kennt, sondern weil die Maschine zaehlt.
 */
const PING = P.meldeWappen({
  id: 'pruefPing', name: 'Prüfping', zeichen: '↔', seltenheit: 'gewoehnlich',
  text: 'zündet den Nachbarn rechts.', hinweis: 'nur zum Prüfen',
  hoert: P.aufAllem((l) => { P.zuendeErneut(l, l.platz + 1); }),
});
const PONG = P.meldeWappen({
  id: 'pruefPong', name: 'Prüfpong', zeichen: '↔', seltenheit: 'gewoehnlich',
  text: 'zündet den Nachbarn links.', hinweis: 'nur zum Prüfen',
  hoert: P.aufAllem((l) => { P.zuendeErneut(l, l.platz - 1); }),
});

pruefe('Zwei Wappen, die einander zünden, kommen zum Halt', () => {
  const t0 = Date.now();
  const r = P.berechneWucht(fuenf(), [PING.id, PONG.id], false);
  if (Date.now() - t0 > 2000) return 'es dauerte ' + (Date.now() - t0) + ' ms';
  if (!r.protokoll.length) return 'nichts gezündet';
  if (!r.protokoll.some(z => z.abgewiesen)) return 'keine einzige Abweisung - die Sperre griff nicht';
  return true;
});

const KOPIERER = P.meldeWappen({
  id: 'pruefKopie', name: 'Prüfkopie', zeichen: '⧉', seltenheit: 'gewoehnlich',
  text: 'kopiert den Nachbarn.', hinweis: 'nur zum Prüfen',
  hoert: P.aufAllem((l) => { P.kopiere(l, l.platz === 0 ? 1 : 0); }),
});

pruefe('Zwei Wappen, die einander kopieren, kommen zum Halt', () => {
  const t0 = Date.now();
  P.berechneWucht(fuenf(), [KOPIERER.id, KOPIERER.id], false);
  return Date.now() - t0 < 2000 ? true : 'es dauerte ' + (Date.now() - t0) + ' ms';
});

pruefe('Ein Wappen zündet nicht öfter als erlaubt', () => {
  const band = P.neuesBand([PING.id, PONG.id]);
  P.berechneWucht(fuenf(), band.reihe, false);
  const nach = P.abweisungen();
  const summe = Object.values(nach).reduce((a, b) => a + b, 0);
  if (!summe) return 'die Sperren haben nie gegriffen';
  // Und sie greifen aus den GENANNTEN Gruenden, nicht irgendwie.
  const gruende = Object.keys(nach).join(',');
  return /tiefe|jePlatz|jeEreignis|kreis|ketten/.test(gruende) ? true : 'Gründe: ' + gruende;
});

pruefe('Ein versiegelter Platz zündet nicht', () => {
  const band = P.neuesBand([PLUS.id, PLUS.id]);
  const voll = P.berechneWucht(fuenf(), band.reihe).salven;
  P.siegelePlatz(1);
  const halb = P.berechneWucht(fuenf(), band.reihe).salven;
  P.entsiegle();
  return gleich(halb, voll - 10, 'Salven mit Siegel');
});

pruefe('Der lauteste Platz ist der meistgezündete', () => {
  const band = P.neuesBand([MAL.id, PLUS.id]);
  for (let i = 0; i < 3; i++) P.berechneWucht(fuenf(), band.reihe, false);
  // Beide zünden gleich oft - also entscheidet der frühere Platz.
  return P.lautesterPlatz() === 0 ? true : 'lautester Platz war ' + P.lautesterPlatz();
});

/* ---------- Vorräte ---------- */
pruefe('Ohne Pulver tut das Pulverhorn nichts', () => {
  P.neuerVorrat();
  const ohne = salvenMit();
  return gleich(salvenMit('pulverhorn'), ohne, 'Salven');
});

pruefe('Der Hammer macht Pulver, das Pulverhorn verbrennt es', () => {
  const k = P.neuerKampf({ feind: P.baueFeind(9), deck: P.START_DECK.map(id => P.neueEinheit(id)),
    wappen: ['schmiedehammer', 'pulverhorn'] });
  P.neuerVorrat();
  P.setzeEinheit(0, k.hand[0]);
  P.setzeEinheit(1, k.hand[0]);
  if (P.bestand('pulver') !== 2) return 'Pulver: ' + P.bestand('pulver');
  const r = P.berechneWucht(k.tuerme, k.wappen, false);
  if (P.bestand('pulver') !== 0) return 'das Pulver wurde nicht verbrannt';
  return r.salven >= 2 ? true : 'nur ' + r.salven + ' Salven';
});

pruefe('Eine Probe verbrennt kein Pulver', () => {
  const k = P.neuerKampf({ feind: P.baueFeind(9), deck: P.START_DECK.map(id => P.neueEinheit(id)),
    wappen: ['schmiedehammer', 'pulverhorn'] });
  P.neuerVorrat();
  P.setzeEinheit(0, k.hand[0]);
  const vorher = P.bestand('pulver');
  for (let i = 0; i < 5; i++) P.berechneWucht(k.tuerme, k.wappen);   // Vorschau
  return gleich(P.bestand('pulver'), vorher, 'Pulver nach fünf Vorschauen');
});

pruefe('Was nur für den Kampf gilt, ist danach verbraucht', () => {
  P.neuerVorrat();
  P.lege('pulver', 5);
  P.lege('veteran', 5);
  P.frischerKampfvorrat();
  if (P.bestand('pulver') !== 0) return 'Pulver überlebte den Kampf';
  return gleich(P.bestand('veteran'), 5, 'Veteranen nach dem Kampf');
});

/* ---------- Die alten Wappen, neu gebaut ---------- */
pruefe('Der Löwe verdreifacht den Rang der mittleren Stellung', () => {
  const t = blatt('bogen-2', 'bogen-2', 'bogen-4', 'bogen-2', 'bogen-2');
  // Rang 4 in der Mitte, dreifach = 12; damit gibt es keinen Vierling mehr.
  const ohne = P.baueBlatt(t).karten.map(c => c.rang).sort((a, b) => a - b).join(',');
  const mit = P.baueBlatt(t, ['loewe']).karten.map(c => c.rang).sort((a, b) => a - b).join(',');
  if (ohne === mit) return 'der Löwe änderte nichts';
  return mit.includes('12') ? true : 'Ränge mit Löwe: ' + mit;
});

pruefe('Der Doppeladler macht aus Stellung 1 zwei Karten', () => {
  const t = blatt('bogen-2', 'ritter-5', null, null, null);
  const ohne = P.baueBlatt(t).karten.length;
  const mit = P.baueBlatt(t, ['doppeladler']).karten.length;
  return gleich(mit, ohne + 1, 'Karten im Blatt');
});

pruefe('Die Schlange macht die ersten zwei Tausche frei', () => {
  P.neuerKampf({ feind: P.baueFeind(1), deck: P.START_DECK.map(id => P.neueEinheit(id)), wappen: ['schlange'] });
  const frei = P.KERN.wappen.schlange;
  if (P.tauschKostenFuer(frei) !== 0) return frei + ' Tausche kosteten ' + P.tauschKostenFuer(frei);
  return gleich(P.tauschKostenFuer(frei + 1), P.KERN.kosten.tauschen, 'Preis des dritten Tauschs');
});

pruefe('Der Wolf zahlt für leere Stellungen', () => {
  const t = blatt('bogen-8', null, null, null, null);
  const ohne = P.berechneWucht(t).wucht;
  const mit = P.berechneWucht(t, ['wolf']).wucht;
  return gleich(mit, Math.round(ohne * (1 + P.KERN.wappen.wolf * 4)), 'Wucht mit Wolf');
});

pruefe('Der Stier will alle fünf Stellungen', () => {
  const vier = blatt('bogen-8', 'armbrust-3', 'kanonier-5', 'artillerie-7', null);
  if (P.berechneWucht(vier, ['stier']).salven !== P.berechneWucht(vier).salven) {
    return 'der Stier zündete bei vier Stellungen';
  }
  return gleich(P.berechneWucht(fuenf(), ['stier']).salven,
    P.berechneWucht(fuenf()).salven + 3, 'Salven mit Stier');
});

/* ---------- Die Bauform selbst ---------- */
pruefe('Kein Wappen hört auf ein Ereignis, das es nicht gibt', () => {
  // `meldeWappen` prueft das beim Anmelden - hier muss es also nur scheitern.
  try {
    P.meldeWappen({ id: 'pruefFalsch', name: 'x', hoert: { gibtEsNicht: () => {} } });
    return 'ein Wappen mit erfundenem Ereignis wurde angenommen';
  } catch (e) { return true; }
});

pruefe('Ein Wappen ohne Wirkung wird nicht angenommen', () => {
  try {
    P.meldeWappen({ id: 'pruefLeer', name: 'x', hoert: {} });
    return 'ein wirkungsloses Wappen wurde angenommen';
  } catch (e) { return true; }
});

pruefe('Jedes Wappen der Sammlung trägt Text, Hinweis und Seltenheit', () => {
  for (const id of P.WAPPEN_LISTE) {
    const w = P.WAPPEN[id];
    if (!w.text) return id + ' hat keinen Text';
    if (!w.hinweis) return id + ' hat keinen Hinweis';
    if (!P.SELTENHEITEN[w.seltenheit]) return id + ' hat die Seltenheit ' + w.seltenheit;
  }
  return true;
});

pruefe('Jede Wirkung steht im Protokoll', () => {
  const r = P.berechneWucht(fuenf(), ['stier', 'drache'], false);
  const stier = r.protokoll.find(z => z.id === 'stier');
  const drache = r.protokoll.find(z => z.id === 'drache');
  if (!stier || !stier.wirkungen.length) return 'der Stier steht nicht im Protokoll';
  if (!drache || !drache.wirkungen.length) return 'der Drache steht nicht im Protokoll';
  return gleich(drache.wirkungen[0].wert, 3, 'was der Drache verstärkte');
});

pruefe('Die Tafel zeigt, welcher Platz was tat', () => {
  // Der Wolf braucht leere Stellungen, sonst hat er nichts zu melden.
  const r = P.berechneWucht(blatt('bogen-8', null, null, null, null), ['wolf'], false);
  const zeile = r.schritte.find(s => s.art === 'wappen');
  if (!zeile) return 'keine Wappenzeile in der Abrechnung';
  return zeile.platz === 0 ? true : 'Platz stand als ' + zeile.platz;
});


/* ---------- Die Sammlung ---------- */
pruefe('Fünfzig Wappen in vier Seltenheiten', () => {
  const nach = {};
  for (const id of P.WAPPEN_LISTE) {
    const s = P.WAPPEN[id].seltenheit;
    nach[s] = (nach[s] || 0) + 1;
  }
  const soll = { gewoehnlich: 24, ungewoehnlich: 15, selten: 8, legendaer: 3 };
  for (const k in soll) if (nach[k] !== soll[k]) return k + ': ' + nach[k] + ' statt ' + soll[k];
  return gleich(P.WAPPEN_LISTE.length, 50, 'Wappen insgesamt');
});

pruefe('Jedes Wappen trägt Zeichen und Tinktur', () => {
  for (const id of P.WAPPEN_LISTE) {
    const w = P.WAPPEN[id];
    if (!w.zeichen) return id + ' hat kein Zeichen';
    if (!/^#[0-9a-f]{6}$/i.test(w.tinktur)) return id + ' hat die Tinktur ' + w.tinktur;
  }
  return true;
});

pruefe('Seltene Wappen kommen nicht auf der ersten Station', () => {
  P.neuerLauf();
  for (let i = 0; i < 80; i++) {
    const a = P.angebotWappen ? P.angebotWappen() : null;
    if (!a) break;
    if (P.WAPPEN_ANGEBOT[a.seltenheit].ab > 1) return a.name + ' auf Station 1';
  }
  return true;
});

pruefe('Ein Wappenangebot bringt seinen Hinweis mit', () => {
  P.neuerLauf();
  const a = P.angebotWappen ? P.angebotWappen() : null;
  if (!a) return 'kein Angebot';
  return a.hinweis ? true : a.name + ' kam ohne Hinweis';
});

/*
 * Die teuerste Pruefung der Datei, und die einzige, die ihren Preis wert ist:
 * jedes einzelne Wappen muss in einem echten Kampf mindestens EINMAL zuenden.
 * Genau das hat beim Drachen jahrelang niemand geprueft.
 */
pruefe('Jedes der fünfzig Wappen zündet in einem echten Kampf', () => {
  const stumm = [];
  for (const id of P.WAPPEN_LISTE) {
    if (!zuendetIrgendwo(id)) stumm.push(id);
  }
  return stumm.length ? 'stumm: ' + stumm.join(', ') : true;
});

/** Ein kurzer Kampf mit genau diesem Wappen - zündet es irgendwo? */
function zuendetIrgendwo(id) {
  for (const hp of [1e12, 300]) {
    P.neuerVorrat();
    const k = P.neuerKampf({ feind: { name: 'Prüfstein', hp, maxHp: hp, regeln: [] },
      deck: P.START_DECK.map(e => P.neueEinheit(e)), wappen: [id] });
    for (let r = 0; r < P.KERN.runden && !k.ende; r++) {
      for (let i = 0; i < P.KERN.tuerme && k.hand.length && k.tatendrang > 0; i++) {
        if (!k.tuerme[i].einheit) P.setzeEinheit(i, k.hand[0]);
      }
      if (k.tatendrang > 0 && k.hand.length) P.setzeEinheit(0, k.hand[0]);   // ablösen
      while (k.tatendrang > 0 && k.hand.length > 1) {
        if (!P.tauscheHandkarte(k.hand[k.hand.length - 1]).ok) break;
      }
      P.beendeRunde();
    }
    const gezuendet = P.dasBand
      && P.dasBand.protokoll.some(z => !z.abgewiesen && z.id === id);
    P.raeumeKampf();
    if (gezuendet) return true;
  }
  return false;
}

console.log(`\n${gut} von ${gut + schlecht} Kernprüfungen bestanden.\n`);
process.exit(schlecht ? 1 : 0);
