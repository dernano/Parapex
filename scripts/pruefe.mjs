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
import { existsSync, readFileSync } from 'node:fs';
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
/*
 * Vor dem Browser: eine Prüfung, die keinen braucht. Das Spiel ist EINE Datei,
 * und in einer Datei gewinnt bei zwei gleichnamigen `function`-Erklärungen die
 * spaetere - stillschweigend. Zweimal ist der neue Kern so von Altlasten
 * ueberschrieben worden, ohne dass etwas abstuerzte: die Funktion war einfach
 * die falsche. Solange alter und neuer Code nebeneinander liegen, wird das
 * hier gefunden statt im Spiel.
 */
const doppelt = [];
{
  const quelle = readFileSync(join(WURZEL, 'index.html'), 'utf8');
  const gesehen = new Map();
  for (const m of quelle.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const zeile = quelle.slice(0, m.index).split('\n').length;
    if (gesehen.has(m[1])) doppelt.push(m[1] + ' (Zeile ' + gesehen.get(m[1]) + ' und ' + zeile + ')');
    else gesehen.set(m[1], zeile);
  }
}

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
  pruefe('Startdeck ist das ganze Blatt: 52 Karten, jede genau einmal', () => {
    if (P.START_DECK.length !== P.EINHEITEN_POOL.length) return 'Startdeck hat ' + P.START_DECK.length;
    const gesehen = new Set(P.START_DECK);
    if (gesehen.size !== P.START_DECK.length) return 'eine Karte liegt doppelt darin';
    for (const k of P.EINHEITEN_POOL) if (!gesehen.has(k.id)) return k.id + ' fehlt';
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
    // Auf die Regel pruefen, nicht auf die Zahl: der Faktor ist eine
    // Stellschraube in KERN und darf sich aendern.
    const passt = P.berechneWucht([{ nr: 1, typ: 'schuetzenturm', einheit: P.neueEinheit('bogen-8') }]);
    if (passt.wucht !== Math.round(8 * P.KERN.turmFaktor)) return 'Bogen auf Schützenturm: ' + passt.wucht;
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
    // Nicht auf eine Zahl prüfen, sondern auf die Regel: der Zuschlag ist eine
    // Stellschraube in KERN und darf sich ändern, ohne dass die Prüfung bricht.
    const leer = 4;
    const ohne = P.berechneWucht(burg('bogen-8', null, null, null, null)).wucht;
    const mit = P.berechneWucht(burg('bogen-8', null, null, null, null), ['wolf']).wucht;
    if (mit <= ohne) return 'kein Unterschied';
    return gleich(mit, Math.round(ohne * (1 + P.KERN.wappen.wolf * leer)), 'Wucht mit Wolf');
  });
  pruefe('Wappen der Schlange macht die ersten Tausche frei', () => {
    const frei = P.KERN.wappen.schlange;
    const k = P.neuerKampf({ feind: P.baueFeind(1), deck: P.START_DECK.map(id => P.neueEinheit(id)), wappen: ['schlange'] });
    const vorher = k.tatendrang;
    for (let i = 0; i < frei; i++) {
      P.tauscheHandkarte(k.hand[0]);
      if (k.tatendrang !== vorher) return 'Tausch ' + (i + 1) + ' kostete etwas';
    }
    P.tauscheHandkarte(k.hand[0]);
    return gleich(k.tatendrang, vorher - 1, 'nach dem Tausch danach');
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

  // ---------- Der Lauf ----------
  pruefe('Ein neuer Lauf steht auf Station 1 mit dem Startdeck', () => {
    const l = P.neuerLauf();
    if (l.station !== 1) return 'Station ' + l.station;
    if (l.deck.length !== P.START_DECK.length) return l.deck.length + ' Karten';
    if (l.wappen.length) return 'schon Wappen';
    if (l.turmTypen.length !== P.KERN.tuerme) return l.turmTypen.length + ' Turmtypen';
    if (l.knoten.length !== l.stationen) return l.knoten.length + ' Knoten';
    return true;
  });

  pruefe('Jeder Knoten hat eine bekannte Art, der letzte ist der Boss', () => {
    const l = P.neuerLauf();
    for (const k of l.knoten) if (!P.KNOTEN_ARTEN[k.art]) return 'Knoten ' + k.nr + ': ' + k.art;
    if (l.knoten[l.knoten.length - 1].art !== 'boss') return 'letzter ist ' + l.knoten[l.knoten.length - 1].art;
    return true;
  });

  pruefe('Ein Kampf aus dem Lauf bekommt Deck, Wappen und Turmtypen', () => {
    const l = P.neuerLauf();
    l.wappen = ['loewe'];
    l.turmTypen[2] = 'pulverturm';
    const k = P.beginneKampfAmKnoten();
    if (!k) return 'kein Kampf';
    if (k.zug.length + k.hand.length !== l.deck.length) return 'Deckgrösse stimmt nicht';
    if (k.wappen[0] !== 'loewe') return 'Wappen fehlt';
    if (k.tuerme[2].typ !== 'pulverturm') return 'Turmtyp fehlt';
    return true;
  });

  pruefe('Der Kampf fasst das Deck des Laufs nicht an', () => {
    const l = P.neuerLauf();
    const vorher = l.deck.length;
    const k = P.beginneKampfAmKnoten();
    // Im Kampf eine Einheit setzen und ersetzen - im Lauf darf nichts passieren.
    P.setzeEinheit(0, k.hand[0]);
    P.setzeEinheit(0, k.hand[0]);
    if (l.deck.length !== vorher) return 'Deck jetzt ' + l.deck.length;
    if (l.deck.some(c => c.einsatz)) return 'Kampfspur im Deck';
    return true;
  });

  pruefe('Ein Sieg bringt Sold und drei Angebote', () => {
    const l = P.neuerLauf();
    const k = P.beginneKampfAmKnoten();
    k.feind.hp = 0; k.ende = 'sieg';
    const r = P.werteKampfAus(k);
    if (!r.sieg) return 'kein Sieg';
    if (r.sold <= 0) return 'Sold ' + r.sold;
    if (l.sold !== r.sold) return 'Lauf hat ' + l.sold;
    if (r.belohnung.angebote.length !== P.LAUF.belohnung.auswahl) return r.belohnung.angebote.length + ' Angebote';
    for (const a of r.belohnung.angebote) if (!a.name || !a.art) return 'Angebot ohne Namen';
    return true;
  });

  pruefe('Wer früher gewinnt, bekommt mehr Sold', () => {
    const bau = (runde) => {
      const l = P.neuerLauf();
      const k = P.beginneKampfAmKnoten();
      k.runde = runde; k.feind.hp = 0; k.ende = 'sieg';
      return P.werteKampfAus(k).sold;
    };
    const frueh = bau(2), spaet = bau(5);
    if (!(frueh > spaet)) return 'Runde 2: ' + frueh + ', Runde 5: ' + spaet;
    return true;
  });

  pruefe('Eine Niederlage beendet den Lauf', () => {
    const l = P.neuerLauf();
    const k = P.beginneKampfAmKnoten();
    k.ende = 'niederlage';
    const r = P.werteKampfAus(k);
    if (r.sieg) return 'als Sieg gewertet';
    if (l.ende !== 'niederlage') return 'Lauf läuft weiter: ' + l.ende;
    return true;
  });

  pruefe('Ein Angebot annehmen verändert genau eine Achse', () => {
    const l = P.neuerLauf();
    const karten = l.deck.length, wappen = l.wappen.length;
    P.nimmAngebot({ art: 'karte', einheit: P.neueEinheit('bogen-7') });
    if (l.deck.length !== karten + 1) return 'Deck ' + l.deck.length;
    if (l.wappen.length !== wappen) return 'Wappen mitverändert';
    P.nimmAngebot({ art: 'wappen', wappen: 'drache' });
    if (!l.wappen.includes('drache')) return 'Wappen nicht angenommen';
    P.nimmAngebot({ art: 'ausbau', turm: 1, typ: 'schuetzenturm' });
    if (l.turmTypen[1] !== 'schuetzenturm') return 'Turm nicht ausgebaut';
    return true;
  });

  pruefe('Mehr als fünf Wappen gehen nicht', () => {
    const l = P.neuerLauf();
    for (const id of P.WAPPEN_LISTE) P.fuegeWappenHinzu(id);
    if (l.wappen.length !== P.WAPPEN_PLAETZE) return l.wappen.length + ' Wappen';
    // Dasselbe Wappen zweimal ebensowenig.
    const r = P.fuegeWappenHinzu(l.wappen[0]);
    if (r.ok) return 'doppelt angenommen';
    return true;
  });

  pruefe('Ausmustern dünnt das Deck nicht unter die Handgrösse aus', () => {
    const l = P.neuerLauf();
    let versuche = 0;
    while (P.entferneKarte(l.deck[0].uid).ok && versuche++ < 50) { /* weiter */ }
    if (l.deck.length < P.KERN.handGroesse) return 'nur noch ' + l.deck.length;
    return true;
  });

  pruefe('Schleifen hebt die Wucht, nicht den Rang', () => {
    const l = P.neuerLauf();
    const k = l.deck[0];
    const rang = k.rang, wucht = P.grundwucht(k);
    P.schleifeKarte(k.uid);
    if (k.rang !== rang) return 'Rang geändert';
    if (P.grundwucht(k) !== wucht + P.LAUF.schliff) return 'Wucht ' + P.grundwucht(k);
    return true;
  });

  pruefe('Der Händler verkauft nichts ohne Sold', () => {
    const l = P.neuerLauf();
    l.sold = 0;
    const h = P.oeffneHaendler();
    if (!h.posten.length) return 'leerer Bestand';
    const r = P.kaufe(0);
    if (r.ok) return 'trotzdem verkauft';
    return true;
  });

  pruefe('Ein Kauf zieht genau den Preis ab und gilt nur einmal', () => {
    const l = P.neuerLauf();
    l.sold = 1000;
    const h = P.oeffneHaendler();
    const i = h.posten.findIndex(p => p.art === 'karte');
    const preis = h.posten[i].preis, karten = l.deck.length;
    const r = P.kaufe(i);
    if (!r.ok) return r.grund;
    if (l.sold !== 1000 - preis) return 'Sold ' + l.sold;
    if (l.deck.length !== karten + 1) return 'Deck ' + l.deck.length;
    if (P.kaufe(i).ok) return 'zweimal gekauft';
    return true;
  });

  pruefe('Ausmustern beim Händler braucht eine Karte', () => {
    const l = P.neuerLauf();
    l.sold = 1000;
    const h = P.oeffneHaendler();
    const i = h.posten.findIndex(p => p.art === 'entfernen');
    if (P.kaufe(i).ok) return 'ohne Ziel verkauft';
    if (l.sold !== 1000) return 'Sold trotzdem abgezogen: ' + l.sold;
    const r = P.kaufe(i, l.deck[0]);
    if (!r.ok) return r.grund;
    return true;
  });

  pruefe('Jede Begegnung hat Titel, Text und mindestens zwei Wahlen', () => {
    for (const e of P.BEGEGNUNGEN) {
      if (!e.titel || !e.text) return e.id + ' ohne Text';
      if (e.wahlen.length < 2) return e.id + ' hat ' + e.wahlen.length + ' Wahlen';
      for (const w of e.wahlen) if (!w.text || typeof w.wirkung !== 'function') return e.id + ': kaputte Wahl';
    }
    return true;
  });

  pruefe('Eine Begegnung wirkt und meldet, was sie tat', () => {
    P.neuerLauf();
    for (let i = 0; i < 40; i++) {
      const e = P.ziehBegegnung();
      if (!e.wahlen.length) return e.id + ' hat keine mögliche Wahl';
      const r = P.waehleInBegegnung(e, Math.floor(Math.random() * e.wahlen.length));
      if (!r.ok) return r.grund;
      if (typeof r.folge !== 'string' || !r.folge) return e.id + ' meldet nichts';
    }
    return true;
  });

  pruefe('Der Lauf zieht Knoten für Knoten bis zum Ende', () => {
    const l = P.neuerLauf();
    for (let i = 1; i < l.stationen; i++) {
      const r = P.verlasseKnoten();
      if (r.ende) return 'zu früh vorbei bei ' + i;
      if (l.station !== i + 1) return 'Station ' + l.station;
    }
    const r = P.verlasseKnoten();
    if (r.ende !== 'sieg') return 'Ende ist ' + r.ende;
    return true;
  });

  pruefe('Ein Lauf lässt sich von Anfang bis Ende durchspielen', () => {
    const l = P.neuerLauf();
    let kaempfe = 0;
    while (!l.ende) {
      const kn = P.derKnoten();
      if (['kampf', 'elite', 'boss'].includes(kn.art)) {
        const k = P.beginneKampfAmKnoten();
        if (!k) return 'kein Kampf an Knoten ' + kn.nr;
        kaempfe++;
        k.feind.hp = 0; k.ende = 'sieg';              // wir gewinnen ihn einfach
        const r = P.werteKampfAus(k);
        if (!r.sieg) return 'Sieg nicht gewertet an ' + kn.nr;
        P.nimmAngebot(r.belohnung.angebote[0]);
      } else if (kn.art === 'haendler') {
        P.oeffneHaendler();
      } else {
        const e = P.ziehBegegnung();
        P.waehleInBegegnung(e, 0);
      }
      P.verlasseKnoten();
    }
    if (l.ende !== 'sieg') return 'Ende ' + l.ende;
    if (kaempfe !== l.knoten.filter(k => ['kampf', 'elite', 'boss'].includes(k.art)).length)
      return kaempfe + ' Kämpfe';
    // Mit dem vollen Blatt waechst ein Deck nicht mehr, es wird geschmaelert.
    // Geprueft wird also, dass es sich ueberhaupt bewegt hat - und dass keine
    // Ausmusterung es unter die Handgroesse gedrueckt hat.
    if (l.deck.length === P.START_DECK.length) return 'Deck hat sich nicht bewegt';
    if (l.deck.length < P.KERN.handGroesse) return 'Deck ist auf ' + l.deck.length + ' geschrumpft';
    return true;
  });

  // ---------- Sammeltausch ----------
  const kampfMit = (tatendrang, wappen = []) => {
    const k = P.neuerKampf({ feind: P.baueFeind(1), deck: P.START_DECK.map(id => P.neueEinheit(id)), wappen });
    k.tatendrang = tatendrang;
    return k;
  };

  pruefe('Fünf Karten tauschen kostet fünf Tatendrang', () => {
    const k = kampfMit(5);
    const r = P.tauscheHandkarten(k.hand.slice(0, 5));
    if (!r.ok) return r.grund;
    if (k.tatendrang !== 0) return 'Tatendrang ' + k.tatendrang;
    if (k.hand.length !== P.KERN.handGroesse) return 'Hand hat ' + k.hand.length;
    if (r.neu.length !== 5) return r.neu.length + ' nachgezogen';
    return true;
  });

  pruefe('Mit zwei Tatendrang lassen sich keine drei Karten tauschen', () => {
    const k = kampfMit(2);
    const vorher = k.hand.map(c => c.uid).join();
    const r = P.tauscheHandkarten(k.hand.slice(0, 3));
    if (r.ok) return 'trotzdem getauscht';
    if (k.tatendrang !== 2) return 'Tatendrang angefasst: ' + k.tatendrang;
    if (k.hand.map(c => c.uid).join() !== vorher) return 'Hand angefasst';
    return true;
  });

  pruefe('Getauschte Karten kommen nicht als Ersatz zurück', () => {
    const k = kampfMit(5);
    // Zugstapel bis auf eine Karte leeren - der Rest muss aus der Ablage kommen.
    k.ablage.push(...k.zug.splice(0, k.zug.length - 1));
    const weg = k.hand.slice(0, 4);
    const wegUid = new Set(weg.map(c => c.uid));
    const r = P.tauscheHandkarten(weg);
    if (!r.ok) return r.grund;
    if (r.neu.length !== 4) return 'nur ' + r.neu.length + ' nachgezogen';
    for (const c of r.neu) if (wegUid.has(c.uid)) return c.name + ' kam sofort zurück';
    if (k.hand.length !== P.KERN.handGroesse) return 'Hand hat ' + k.hand.length;
    return true;
  });

  pruefe('Der Sammeltausch verliert und verdoppelt keine Karte', () => {
    const k = kampfMit(5);
    const zaehle = () => k.zug.length + k.hand.length + k.ablage.length +
      k.tuerme.filter(t => t.einheit).length;
    const vorher = zaehle();
    P.tauscheHandkarten(k.hand.slice(0, 3));
    if (zaehle() !== vorher) return 'aus ' + vorher + ' wurden ' + zaehle();
    const alle = [...k.zug, ...k.hand, ...k.ablage].map(c => c.uid);
    if (new Set(alle).size !== alle.length) return 'eine Karte liegt doppelt';
    return true;
  });

  pruefe('Die Schlange verbilligt nur die ersten Tausche einer Runde', () => {
    const frei = P.KERN.wappen.schlange;
    const k = kampfMit(5, ['schlange']);
    if (P.tauschKostenFuer(frei) !== 0) return frei + ' Tausche kosten ' + P.tauschKostenFuer(frei);
    if (P.tauschKostenFuer(frei + 2) !== 2) return (frei + 2) + ' Tausche kosten ' + P.tauschKostenFuer(frei + 2);
    return true;
  });

  pruefe('Tauschen ohne Wappen kostet einen je Karte', () => {
    kampfMit(5);
    for (let n = 1; n <= 5; n++) if (P.tauschKostenFuer(n) !== n) return n + ' Karten kosten ' + P.tauschKostenFuer(n);
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
if (doppelt.length) {
  schlecht += doppelt.length;
  for (const d of doppelt) console.log('  FEHL Funktion doppelt erklärt — ' + d);
}
if (fehlerAufDerSeite.length) {
  schlecht += fehlerAufDerSeite.length;
  for (const f of fehlerAufDerSeite) console.log('  FEHL Seitenfehler — ' + f);
}
console.log('\n' + (ergebnis.length - schlecht) + ' von ' + ergebnis.length + ' Prüfungen bestanden.');
process.exit(schlecht ? 1 : 0);
