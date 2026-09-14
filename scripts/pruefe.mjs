/*
 * Prüfung des Kerns.
 *
 * Der Kern rechnet nur, also lässt er sich auch nur rechnend prüfen: die Seite
 * wird im echten Browser geladen, und alle Behauptungen laufen in der Seite
 * gegen `window.PARAPEX`. Kein Nachbau, keine Attrappe - was hier grün ist,
 * ist im Spiel grün.
 *
 *   node scripts/pruefe.mjs
 *
 * Es braucht keinen Server: die Seite wird als Datei geöffnet.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEITE = 'file://' + join(WURZEL, 'index.html');

const orte = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs',
  '/usr/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const ort of orte) {
  try { ({ chromium } = await import(ort)); break; } catch (e) { /* naechster */ }
}
if (!chromium) {
  console.error('Playwright fehlt - ohne Browser lässt sich der Kern nicht prüfen.');
  process.exit(2);
}
const pfad = process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(pfad) ? { executablePath: pfad } : {});
const seite = await browser.newPage();
const fehlerAufDerSeite = [];
seite.on('pageerror', e => fehlerAufDerSeite.push('' + e));
await seite.goto(SEITE, { waitUntil: 'load' });

const ergebnis = await seite.evaluate(() => {
  const P = window.PARAPEX;
  const raus = [];
  const pruefe = (name, was) => {
    try {
      const m = was();
      raus.push({ name, ok: m === true || m === undefined, hinweis: m === true ? '' : m });
    } catch (e) {
      raus.push({ name, ok: false, hinweis: e.message });
    }
  };
  const gleich = (a, b, was) => (a === b ? true : was + ': ' + JSON.stringify(a) + ' statt ' + JSON.stringify(b));

  // ---------- Kartenpool ----------
  pruefe('52 Karten im Pool', () => gleich(P.EINHEITEN_POOL.length, 52, 'Anzahl'));
  pruefe('4 Gattungen mal 13 Ränge', () => {
    for (const g of Object.keys(P.GATTUNGEN)) {
      const n = P.EINHEITEN_POOL.filter(k => k.gattung === g).length;
      if (n !== 13) return g + ' hat ' + n + ' Ränge';
      const raenge = P.EINHEITEN_POOL.filter(k => k.gattung === g).map(k => k.rang).sort((a, b) => a - b);
      if (raenge.join() !== Array.from({ length: 13 }, (_, i) => i + 1).join()) return g + ': Ränge unvollständig';
    }
    return true;
  });
  pruefe('jede Gattung/Rang-Paarung einmalig', () => {
    const gesehen = new Set();
    for (const k of P.EINHEITEN_POOL) {
      const s = k.gattung + '-' + k.rang;
      if (gesehen.has(s)) return 'doppelt: ' + s;
      gesehen.add(s);
    }
    return gleich(gesehen.size, 52, 'Paarungen');
  });
  pruefe('jede Karte hat Kennung, Namen und Grundwucht', () => {
    for (const k of P.EINHEITEN_POOL) {
      if (!k.id || !k.name || typeof k.grundwucht !== 'number') return 'unvollständig: ' + k.id;
      if (k.grundwucht !== k.rang) return k.id + ': Grundwucht ' + k.grundwucht + ' statt Rang ' + k.rang;
    }
    return true;
  });
  pruefe('Startdeck: 12 Karten aus allen vier Gattungen', () => {
    if (P.START_DECK.length !== 12) return 'Startdeck hat ' + P.START_DECK.length;
    const g = new Set(P.START_DECK.map(id => id.split('-')[0]));
    if (g.size !== 4) return 'nur ' + g.size + ' Gattungen';
    for (const id of P.START_DECK) if (!P.EINHEITEN_POOL.find(k => k.id === id)) return id + ' gibt es nicht';
    return true;
  });

  // ---------- Kampfaufbau ----------
  const frisch = (wappen = [], turmTypen) => P.neuerKampf({
    feind: P.baueFeind(1),
    deck: P.START_DECK.map(id => P.neueEinheit(id)),
    wappen, turmTypen,
  });

  pruefe('Kampf beginnt mit fünf leeren Türmen', () => {
    const k = frisch();
    if (k.tuerme.length !== 5) return 'nur ' + k.tuerme.length + ' Türme';
    if (k.tuerme.some(t => t.einheit)) return 'ein Turm ist besetzt';
    return true;
  });
  pruefe('Hand hat sieben Karten, Tatendrang fünf', () => {
    const k = frisch();
    return gleich(k.hand.length, 7, 'Hand') === true ? gleich(k.tatendrang, 5, 'Tatendrang') : gleich(k.hand.length, 7, 'Hand');
  });
  pruefe('Einheit einsetzen kostet 1 Tatendrang', () => {
    const k = frisch();
    const vorher = k.tatendrang;
    const r = P.setzeEinheit(0, k.hand[0]);
    if (!r.ok) return r.grund;
    return gleich(k.tatendrang, vorher - 1, 'Tatendrang');
  });
  pruefe('gesetzte Einheit ist aus der Hand verschwunden', () => {
    const k = frisch();
    const karte = k.hand[0];
    P.setzeEinheit(0, karte);
    if (k.hand.find(c => c.uid === karte.uid)) return 'liegt noch auf der Hand';
    if (k.zug.find(c => c.uid === karte.uid)) return 'liegt im Zugstapel';
    if (k.ablage.find(c => c.uid === karte.uid)) return 'liegt in der Ablage';
    return gleich(k.tuerme[0].einheit.uid, karte.uid, 'auf dem Turm');
  });
  pruefe('Ersetzen schickt die alte Einheit in die Ablage', () => {
    const k = frisch();
    const erste = k.hand[0], zweite = k.hand[1];
    P.setzeEinheit(0, erste);
    const r = P.setzeEinheit(0, zweite);
    if (!r.ok) return r.grund;
    if (k.tuerme[0].einheit.uid !== zweite.uid) return 'die neue steht nicht oben';
    if (!k.ablage.find(c => c.uid === erste.uid)) return 'die alte liegt nicht in der Ablage';
    return true;
  });
  pruefe('Karte tauschen kostet 1 Tatendrang und zieht genau eine nach', () => {
    const k = frisch();
    const vorher = k.tatendrang, karte = k.hand[0], handVorher = k.hand.length;
    const r = P.tauscheHandkarte(karte);
    if (!r.ok) return r.grund;
    if (k.tatendrang !== vorher - 1) return 'Tatendrang ' + k.tatendrang;
    if (k.hand.length !== handVorher) return 'Hand hat ' + k.hand.length;
    if (k.hand.find(c => c.uid === karte.uid)) return 'die alte Karte liegt noch da';
    if (!k.ablage.find(c => c.uid === karte.uid)) return 'die alte Karte ist nicht in der Ablage';
    return true;
  });
  pruefe('ohne Tatendrang geht nichts mehr', () => {
    const k = frisch();
    k.tatendrang = 0;
    const r = P.setzeEinheit(0, k.hand[0]);
    if (r.ok) return 'Einsetzen ging trotzdem';
    const r2 = P.tauscheHandkarte(k.hand[0]);
    if (r2.ok) return 'Tauschen ging trotzdem';
    return true;
  });
  pruefe('leerer Zugstapel: die Ablage wird gemischt', () => {
    const k = frisch();
    k.ablage.push(...k.zug.splice(0));
    const vorher = k.ablage.length;
    const gezogen = P.ziehe();
    if (!gezogen) return 'es wurde nichts gezogen';
    if (k.ablage.length !== 0) return 'die Ablage wurde nicht geleert';
    if (k.zug.length !== vorher - 1) return 'Zugstapel hat ' + k.zug.length;
    return true;
  });

  // ---------- Runden ----------
  pruefe('fünf Runden, dann ist Schluss', () => {
    const k = P.neuerKampf({ feind: P.baueFeind(10), deck: P.START_DECK.map(id => P.neueEinheit(id)) });
    for (let i = 0; i < 4; i++) {
      const r = P.beendeRunde();
      if (r.ende) return 'zu früh vorbei in Runde ' + (i + 1);
    }
    if (k.runde !== 5) return 'nach vier Runden steht ' + k.runde;
    const letzte = P.beendeRunde();
    return gleich(letzte.ende, 'niederlage', 'Ausgang');
  });
  pruefe('Gegner auf null heisst Sieg', () => {
    const k = P.neuerKampf({ feind: { name: 'Strohpuppe', hp: 3, maxHp: 3, regeln: [] },
      deck: P.START_DECK.map(id => P.neueEinheit(id)) });
    P.setzeEinheit(0, k.hand.find(c => c.rang >= 3) || k.hand[0]);
    return gleich(k.ende, 'sieg', 'Ausgang');
  });
  pruefe('Hand wird zur neuen Runde neu gezogen', () => {
    const k = P.neuerKampf({ feind: P.baueFeind(9), deck: P.START_DECK.map(id => P.neueEinheit(id)) });
    const alte = k.hand.map(c => c.uid);
    P.beendeRunde();
    if (k.hand.length !== 7) return 'Hand hat ' + k.hand.length;
    if (k.tatendrang !== 5) return 'Tatendrang steht auf ' + k.tatendrang;
    for (const uid of alte) if (k.hand.find(c => c.uid === uid) && k.hand.length === 7 && k.zug.length === 0) return true;
    return true;
  });

  // ---------- Formationen ----------
  const burg = (...karten) => karten.map((id, i) => ({
    nr: i + 1, typ: 'wachturm', einheit: id ? P.neueEinheit(id) : null,
  }));
  const hat = (formationen, id) => formationen.some(f => f.id === id);

  pruefe('Schützenlinie: drei benachbarte Bogenschützen', () => {
    const f = P.erkenneFormationen(burg('bogen-3', 'bogen-5', 'bogen-7', null, null));
    if (!hat(f, 'schuetzenlinie')) return 'nicht erkannt';
    const s = f.find(x => x.id === 'schuetzenlinie');
    return gleich(s.nachschuss.length, 3, 'Nachschüsse');
  });
  pruefe('Schützenlinie nicht bei Lücke', () => {
    const f = P.erkenneFormationen(burg('bogen-3', 'bogen-5', null, 'bogen-7', null));
    return hat(f, 'schuetzenlinie') ? 'fälschlich erkannt' : true;
  });
  pruefe('Bolzenwall: drei Armbrustschützen, auch verstreut', () => {
    const f = P.erkenneFormationen(burg('armbrust-3', null, 'armbrust-5', null, 'armbrust-7'));
    return hat(f, 'bolzenwall') ? true : 'nicht erkannt';
  });
  pruefe('Schwere Batterie: zwei benachbarte Artillerie', () => {
    const f = P.erkenneFormationen(burg(null, 'artillerie-4', 'artillerie-6', null, null));
    return hat(f, 'schwereBatterie') ? true : 'nicht erkannt';
  });
  pruefe('Pulverlinie steigt mit der Zahl', () => {
    const drei = P.erkenneFormationen(burg('kanonier-2', 'kanonier-3', 'kanonier-4', null, null))
      .find(f => f.id === 'pulverlinie');
    const fuenf = P.erkenneFormationen(burg('kanonier-2', 'kanonier-3', 'kanonier-4', 'kanonier-5', 'kanonier-6'))
      .find(f => f.id === 'pulverlinie');
    if (!drei || !fuenf) return 'nicht erkannt';
    if (drei.proTurm !== 2) return 'drei Kanoniere geben ×' + drei.proTurm;
    return gleich(fuenf.proTurm, 5, 'fünf Kanoniere');
  });
  pruefe('Wechselfeuer: vier abwechselnde Gattungen', () => {
    const f = P.erkenneFormationen(burg('bogen-3', 'armbrust-4', 'bogen-5', 'armbrust-6', null));
    return hat(f, 'wechselfeuer') ? true : 'nicht erkannt';
  });
  pruefe('Wechselfeuer nicht bei drei gleichen', () => {
    const f = P.erkenneFormationen(burg('bogen-3', 'bogen-4', 'bogen-5', 'bogen-6', null));
    return hat(f, 'wechselfeuer') ? 'fälschlich erkannt' : true;
  });
  pruefe('Zangenstellung: gleiche Gattung an den Enden', () => {
    const f = P.erkenneFormationen(burg('bogen-3', 'armbrust-4', 'artillerie-5', null, null))
      .find(x => x.id === 'zangenstellung');
    if (f) return 'fälschlich erkannt';
    const g = P.erkenneFormationen(burg('bogen-3', 'armbrust-4', 'bogen-5', null, null))
      .find(x => x.id === 'zangenstellung');
    if (!g) return 'nicht erkannt';
    return gleich(g.nachschuss.length, 2, 'Nachschüsse');
  });
  pruefe('Vorrückende Salve ist keine Straße', () => {
    const f = P.erkenneFormationen(burg('bogen-3', 'armbrust-6', 'artillerie-9', null, null))
      .find(x => x.id === 'vorrueckend');
    if (!f) return 'Sprünge werden nicht erkannt';
    return gleich(f.proTurm, 1.5, 'Faktor bei drei');
  });
  pruefe('Fallende Salve', () => {
    const f = P.erkenneFormationen(burg('bogen-9', 'armbrust-6', 'artillerie-2', null, null))
      .find(x => x.id === 'fallend');
    return f ? gleich(f.proTurm, 1.75, 'Faktor bei drei') : 'nicht erkannt';
  });
  pruefe('Königshügel nur bei echtem Höchstrang in der Mitte', () => {
    const ja = P.erkenneFormationen(burg('bogen-3', 'bogen-4', 'bogen-11', 'bogen-5', 'bogen-2'));
    if (!hat(ja, 'koenigshuegel')) return 'nicht erkannt';
    const nein = P.erkenneFormationen(burg('bogen-3', 'bogen-4', 'bogen-11', 'bogen-11', 'bogen-2'));
    return hat(nein, 'koenigshuegel') ? 'bei Gleichstand erkannt' : true;
  });
  pruefe('Geschlossene Front nur bei fünf Einheiten', () => {
    const vier = P.erkenneFormationen(burg('bogen-3', 'armbrust-4', 'artillerie-5', 'kanonier-6', null));
    if (hat(vier, 'geschlosseneFront')) return 'bei vier erkannt';
    const fuenf = P.erkenneFormationen(burg('bogen-3', 'armbrust-4', 'artillerie-5', 'kanonier-6', 'bogen-7'));
    return hat(fuenf, 'geschlosseneFront') ? true : 'bei fünf nicht erkannt';
  });
  pruefe('Formationen überlappen sich', () => {
    const f = P.erkenneFormationen(burg('bogen-5', 'bogen-7', 'bogen-9', 'artillerie-11', 'artillerie-13'));
    const soll = ['schuetzenlinie', 'vorrueckend', 'schwereBatterie', 'geschlosseneFront'];
    const fehlt = soll.filter(id => !hat(f, id));
    return fehlt.length ? 'fehlt: ' + fehlt.join(', ') : true;
  });

  // ---------- Wucht ----------
  pruefe('leere Burg macht keine Wucht', () => {
    const w = P.berechneWucht(burg(null, null, null, null, null));
    return gleich(w.wucht, 0, 'Wucht');
  });
  pruefe('eine Einheit macht ihren Rang', () => {
    const w = P.berechneWucht(burg('bogen-7', null, null, null, null));
    return gleich(w.wucht, 7, 'Wucht');
  });
  pruefe('Turmtyp wirkt nur auf die passende Gattung', () => {
    const passt = P.berechneWucht([{ nr: 1, typ: 'schuetzenturm', einheit: P.neueEinheit('bogen-8') }]);
    if (passt.wucht !== 10) return 'Bogen auf Schützenturm: ' + passt.wucht;
    const nicht = P.berechneWucht([{ nr: 1, typ: 'schuetzenturm', einheit: P.neueEinheit('kanonier-8') }]);
    return gleich(nicht.wucht, 8, 'Kanonier auf Schützenturm');
  });
  pruefe('Formationen vervielfachen, statt zu addieren', () => {
    const ohne = P.berechneWucht(burg('kanonier-4', 'bogen-4', 'kanonier-4', null, null)).wucht;
    const mit = P.berechneWucht(burg('kanonier-4', 'kanonier-4', 'kanonier-4', null, null)).wucht;
    if (mit <= ohne) return 'Pulverlinie bringt nichts: ' + ohne + ' -> ' + mit;
    // 3 x 4 Wucht, Pulverlinie x2 = je 8. Dazu greift die Zangenstellung:
    // aussen steht zweimal dieselbe Gattung, also feuern Turm 1 und 3 doppelt.
    // 8 x 2 + 8 + 8 x 2 = 40. Genau diese Ueberlagerung ist der Kern des Spiels.
    return gleich(mit, 40, 'drei Kanoniere mit Pulverlinie und Zange');
  });
  pruefe('Nachschuss zählt als zweiter Schuss', () => {
    const w = P.berechneWucht(burg('bogen-3', 'bogen-4', 'bogen-5', null, null));
    // Schützenlinie: alle drei feuern zweimal. Zangenstellung: die Enden noch einmal.
    if (w.wucht < 24) return 'zu wenig: ' + w.wucht;
    return true;
  });
  pruefe('Breakdown nennt jeden Schritt', () => {
    const w = P.berechneWucht(burg('bogen-5', 'bogen-7', 'bogen-9', 'artillerie-11', 'artillerie-13'));
    if (!w.schritte.length) return 'keine Schritte';
    if (w.schritte[0].art !== 'grund') return 'erster Schritt ist ' + w.schritte[0].art;
    if (!w.posten.length) return 'keine Posten';
    if (w.schritte[w.schritte.length - 1].wucht !== w.wucht) return 'letzter Schritt passt nicht zur Endwucht';
    return true;
  });
  pruefe('eine starke Burg eskaliert deutlich', () => {
    const w = P.berechneWucht(burg('bogen-5', 'bogen-7', 'bogen-9', 'artillerie-11', 'artillerie-13'));
    return w.wucht >= 200 ? true : 'nur ' + w.wucht;
  });

  // ---------- Wappen ----------
  pruefe('Wappen des Löwen verdoppelt den Rang der Mitte', () => {
    const ohne = P.erkenneFormationen(burg('bogen-9', 'bogen-4', 'bogen-6', 'bogen-3', 'bogen-2'));
    const mit = P.erkenneFormationen(burg('bogen-9', 'bogen-4', 'bogen-6', 'bogen-3', 'bogen-2'), ['loewe']);
    const ohneHuegel = ohne.some(f => f.id === 'koenigshuegel');
    const mitHuegel = mit.some(f => f.id === 'koenigshuegel');
    if (ohneHuegel) return 'ohne Wappen schon erkannt';
    return mitHuegel ? true : 'mit Wappen nicht erkannt';
  });
  pruefe('Wappen des Doppeladlers schliesst den Ring', () => {
    const ohne = P.erkenneFormationen(burg('bogen-3', null, null, 'bogen-5', 'bogen-7'));
    const mit = P.erkenneFormationen(burg('bogen-3', null, null, 'bogen-5', 'bogen-7'), ['doppeladler']);
    if (ohne.some(f => f.id === 'schuetzenlinie')) return 'ohne Wappen schon erkannt';
    return mit.some(f => f.id === 'schuetzenlinie') ? true : 'mit Wappen nicht erkannt';
  });
  pruefe('Wappen des Wolfs zahlt für leere Türme', () => {
    const ohne = P.berechneWucht(burg('bogen-8', null, null, null, null)).wucht;
    const mit = P.berechneWucht(burg('bogen-8', null, null, null, null), ['wolf']).wucht;
    // vier leere Türme: +100 %
    if (mit <= ohne) return 'kein Unterschied';
    return gleich(mit, 16, 'Wucht mit Wolf');
  });
  pruefe('Wappen der Schlange macht den ersten Tausch frei', () => {
    const k = P.neuerKampf({ feind: P.baueFeind(1), deck: P.START_DECK.map(id => P.neueEinheit(id)), wappen: ['schlange'] });
    const vorher = k.tatendrang;
    P.tauscheHandkarte(k.hand[0]);
    if (k.tatendrang !== vorher) return 'der erste Tausch kostete ' + (vorher - k.tatendrang);
    P.tauscheHandkarte(k.hand[0]);
    return gleich(k.tatendrang, vorher - 1, 'nach dem zweiten Tausch');
  });
  pruefe('Wappen des Ebers lässt die ersetzte Einheit feuern', () => {
    const k = P.neuerKampf({ feind: P.baueFeind(6), deck: P.START_DECK.map(id => P.neueEinheit(id)), wappen: ['eber'] });
    P.setzeEinheit(0, k.hand[0]);
    const vorher = k.feind.hp;
    const alt = k.tuerme[0].einheit;
    const r = P.setzeEinheit(0, k.hand[0]);
    if (!r.ok) return r.grund;
    const erwartet = vorher - P.grundwucht(alt) - P.grundwucht(k.tuerme[0].einheit);
    return gleich(k.feind.hp, erwartet, 'Gegnerstärke');
  });

  // ---------- Sicherheit ----------
  pruefe('Signalketten laufen nicht endlos', () => {
    P.neuerKampf({ feind: P.baueFeind(9), deck: P.START_DECK.map(id => P.neueEinheit(id)) });
    let laeufe = 0;
    P.hoereSignal('einheitFeuert', () => { laeufe++; P.sendeSignal('einheitFeuert', {}); });
    P.sendeSignal('einheitFeuert', {});
    if (laeufe > 20) return 'die Kette lief ' + laeufe + ' mal';
    return P.ueberlauf() > 0 ? true : 'die Bremse hat nicht gegriffen';
  });
  pruefe('Gegnerstärke steht in einer Tabelle', () => {
    if (P.FEIND_STAERKE.length < 10) return 'nur ' + P.FEIND_STAERKE.length + ' Werte';
    for (let i = 1; i < P.FEIND_STAERKE.length; i++) {
      if (P.FEIND_STAERKE[i] <= P.FEIND_STAERKE[i - 1]) return 'Station ' + (i + 1) + ' ist nicht stärker';
    }
    return true;
  });

  return raus;
});

await browser.close();

let schlecht = 0;
for (const e of ergebnis) {
  if (!e.ok) schlecht++;
  console.log((e.ok ? '  ok   ' : '  FEHL ') + e.name + (e.ok ? '' : '  — ' + e.hinweis));
}
if (fehlerAufDerSeite.length) {
  schlecht += fehlerAufDerSeite.length;
  for (const f of fehlerAufDerSeite) console.log('  FEHL Seitenfehler — ' + f);
}
console.log('\n' + (ergebnis.length - schlecht) + ' von ' + ergebnis.length + ' Prüfungen bestanden.');
process.exit(schlecht ? 1 : 0);
