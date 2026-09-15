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
 * Vor allem anderen: stimmt die ausgelieferte Datei noch mit `quelle/`
 * ueberein? Seit der Kern aus Modulen gebaut wird, ist das die eine Frage, die
 * alles Weitere sinnlos machen kann - wer `index.html` von Hand aendert,
 * prueft sonst etwas, das beim naechsten Bau wieder verschwindet.
 */
{
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('node', [join(WURZEL, 'scripts/baue.mjs'), 'pruefen'], { stdio: 'pipe' });
  } catch (e) {
    console.error('index.html weicht von quelle/ ab. Erst `node scripts/baue.mjs`.');
    process.exit(2);
  }
}
/*
 * Vor dem Browser: eine Prüfung, die keinen braucht. Das Spiel ist EINE Datei,
 * und in einer Datei gewinnt bei zwei gleichnamigen `function`-Erklärungen die
 * spaetere - stillschweigend. Zweimal ist der neue Kern so von Altlasten
 * ueberschrieben worden, ohne dass etwas abstuerzte: die Funktion war einfach
 * die falsche. Solange alter und neuer Code nebeneinander liegen, wird das
 * hier gefunden statt im Spiel.
 */
/*
 * Ein Gegenzeichen im Stilblatt beendet es. Die CSS-Bloecke stehen in
 * Schablonen-Zeichenketten, und ein einzelnes ` in einem Kommentar darin
 * schliesst die Zeichenkette mitten im Stilblatt - der Rest der Datei wird
 * dann als Code gelesen und die Seite stuerzt beim Laden ab. Das ist hier
 * zweimal passiert, beide Male in einem Kommentar, der einen Selektor zitieren
 * wollte. Seitdem sucht die Pruefung danach.
 */
const gegenzeichen = [];
{
  const quelle = readFileSync(join(WURZEL, 'index.html'), 'utf8');
  for (const m of quelle.matchAll(/^const (PK_\w+|PX_CSS) = `/gm)) {
    const anfang = m.index + m[0].length;
    const ende = quelle.indexOf('`;', anfang);
    const block = quelle.slice(anfang, ende < 0 ? quelle.length : ende);
    if (block.includes('`')) {
      gegenzeichen.push(m[1] + ' enthält ein Gegenzeichen und bricht dort ab');
    }
  }
}

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
  /*
   * Die Stellung der Tuerme darf NICHT zaehlen. Deshalb bekommt fast jede
   * Pruefung hier auch eine gewuerfelte Variante: dieselben Einheiten, andere
   * Reihenfolge, dasselbe Ergebnis.
   */
  const blatt = (...karten) => karten.map((id, i) =>
    ({ nr: i + 1, typ: 'wachturm', einheit: id ? P.neueEinheit(id) : null }));
  const misch = (a) => { const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b.map((t, i) => ({ ...t, nr: i + 1 })); };
  const formIds = (tuerme, wappen) => P.erkenneFormationen(tuerme, wappen).map(f => f.id).sort();
  const hat = (tuerme, id) => formIds(tuerme).includes(id);

  pruefe('Fünf gleiche Gattungen sind eine Reine Garde', () => {
    const t = blatt('bogen-2', 'bogen-7', 'bogen-11', 'bogen-4', 'bogen-9');
    if (!hat(t, 'reineGarde')) return 'nicht erkannt: ' + formIds(t);
    // Und in jeder Reihenfolge.
    for (let i = 0; i < 8; i++) if (!hat(misch(t), 'reineGarde')) return 'nach dem Mischen weg';
    return true;
  });

  pruefe('Vier gleiche Gattungen sind ein Großes Regiment', () => {
    const t = blatt('armbrust-2', 'armbrust-7', 'armbrust-11', 'armbrust-4', 'bogen-9');
    if (!hat(t, 'grossesRegiment')) return formIds(t);
    return true;
  });

  pruefe('Drei gleiche Gattungen sind ein Regiment', () => {
    const t = blatt('artillerie-2', 'artillerie-7', 'artillerie-11', 'bogen-4', 'kanonier-9');
    if (!hat(t, 'regiment')) return formIds(t);
    return true;
  });

  pruefe('Die Gattungsfamilie stapelt nicht', () => {
    const t = blatt('bogen-2', 'bogen-7', 'bogen-11', 'bogen-4', 'bogen-9');
    const ids = formIds(t);
    for (const kleiner of ['regiment', 'grossesRegiment']) {
      if (ids.includes(kleiner)) return kleiner + ' gilt neben der Reinen Garde';
    }
    return true;
  });

  pruefe('Fünf fortlaufende Ränge sind ein Perfekter Vormarsch', () => {
    const t = blatt('bogen-8', 'armbrust-9', 'artillerie-10', 'kanonier-11', 'bogen-12');
    if (!hat(t, 'perfekterVormarsch')) return formIds(t);
    return true;
  });

  pruefe('Die Reihenfolge der Türme zählt für die Folge nicht', () => {
    // 12, 8, 10, 9, 11 - dieselbe Folge, anders aufgestellt.
    const t = blatt('bogen-12', 'armbrust-8', 'artillerie-10', 'kanonier-9', 'bogen-11');
    if (!hat(t, 'perfekterVormarsch')) return formIds(t);
    return true;
  });

  pruefe('Vier und drei fortlaufende Ränge', () => {
    const vier = blatt('bogen-5', 'armbrust-6', 'artillerie-7', 'kanonier-8', 'bogen-13');
    if (!hat(vier, 'grosserVormarsch')) return 'vier: ' + formIds(vier);
    const drei = blatt('bogen-5', 'armbrust-6', 'artillerie-7', 'kanonier-12', 'bogen-1');
    if (!hat(drei, 'vormarsch')) return 'drei: ' + formIds(drei);
    return true;
  });

  pruefe('Die Folgenfamilie stapelt nicht', () => {
    const t = blatt('bogen-8', 'armbrust-9', 'artillerie-10', 'kanonier-11', 'bogen-12');
    const ids = formIds(t);
    for (const kleiner of ['vormarsch', 'grosserVormarsch']) {
      if (ids.includes(kleiner)) return kleiner + ' gilt neben dem Perfekten Vormarsch';
    }
    return true;
  });

  pruefe('Gleiche Ränge zählen in einer Folge nur einmal', () => {
    // 8, 8, 9, 10 ist eine Folge von drei, keine von vier.
    const t = blatt('bogen-8', 'armbrust-8', 'artillerie-9', 'kanonier-10', null);
    const ids = formIds(t);
    if (ids.includes('grosserVormarsch')) return 'als Folge von vier gewertet';
    if (!ids.includes('vormarsch')) return 'die Folge von drei fehlt: ' + ids;
    return true;
  });

  pruefe('Paar, Doppelte Wache, Drilling, Viererblock', () => {
    const paar = blatt('bogen-8', 'armbrust-8', null, null, null);
    if (!hat(paar, 'doppelposten')) return 'Paar: ' + formIds(paar);
    const zwei = blatt('bogen-8', 'armbrust-8', 'artillerie-9', 'kanonier-9', null);
    if (!hat(zwei, 'doppelteWache')) return 'zwei Paare: ' + formIds(zwei);
    const drei = blatt('bogen-8', 'armbrust-8', 'artillerie-8', null, null);
    if (!hat(drei, 'drillingsposten')) return 'Drilling: ' + formIds(drei);
    const vier = blatt('bogen-11', 'armbrust-11', 'artillerie-11', 'kanonier-11', null);
    if (!hat(vier, 'viererblock')) return 'Viererblock: ' + formIds(vier);
    return true;
  });

  pruefe('Die Rangfamilie stapelt nicht', () => {
    const vier = blatt('bogen-11', 'armbrust-11', 'artillerie-11', 'kanonier-11', null);
    const ids = formIds(vier);
    for (const kleiner of ['doppelposten', 'doppelteWache', 'drillingsposten']) {
      if (ids.includes(kleiner)) return kleiner + ' gilt neben dem Viererblock';
    }
    return true;
  });

  pruefe('Fünf Ränge derselben Gattung in Folge: Königlicher Aufmarsch', () => {
    const t = blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12');
    const ids = formIds(t);
    if (!ids.includes('koeniglicherAufmarsch')) return ids;
    // Er loest Gattung UND Folge ab - uebrig bleibt er selbst und die Front.
    for (const weg of ['reineGarde', 'perfekterVormarsch', 'regiment', 'vormarsch']) {
      if (ids.includes(weg)) return weg + ' gilt neben dem Königlichen Aufmarsch';
    }
    if (!ids.includes('geschlosseneFront')) return 'die Geschlossene Front fehlt';
    return true;
  });

  /*
   * Die Koenigliche Garde - Neun bis Koenig in einer Gattung. Acht Pruefungen,
   * weil sie an acht Stellen mitspielen muss und nicht nur in der Leiste
   * stehen soll: Erkennung, Reihenfolge, Abgrenzung nach unten und zur Seite,
   * Ablose, Salvenlohn, Stufenausbau und Vorschau.
   */
  const gardenblatt = (g = 'bogen') => blatt(g + '-9', g + '-10', g + '-11', g + '-12', g + '-13');

  pruefe('Neun bis König in einer Gattung ist die Königliche Garde', () => {
    const ids = formIds(gardenblatt());
    if (!ids.includes('koeniglicheGarde')) return 'nicht erkannt: ' + ids;
    return true;
  });

  pruefe('Die Königliche Garde steht in jeder Reihenfolge', () => {
    for (let i = 0; i < 12; i++) {
      if (!hat(misch(gardenblatt()), 'koeniglicheGarde')) return 'nach dem Mischen weg';
    }
    return true;
  });

  pruefe('Die Königliche Garde löst den Königlichen Aufmarsch ab', () => {
    const ids = formIds(gardenblatt());
    for (const weg of ['koeniglicherAufmarsch', 'reineGarde', 'perfekterVormarsch',
                       'grossesRegiment', 'regiment', 'vormarsch']) {
      if (ids.includes(weg)) return weg + ' gilt neben der Königlichen Garde';
    }
    if (!ids.includes('geschlosseneFront')) return 'die Geschlossene Front fehlt';
    return true;
  });

  pruefe('Acht bis Dame ist nur ein Aufmarsch, keine Garde', () => {
    const t = blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12');
    if (hat(t, 'koeniglicheGarde')) return 'die Garde gilt schon ab der Acht';
    if (!hat(t, 'koeniglicherAufmarsch')) return 'der Aufmarsch fehlt';
    return true;
  });

  pruefe('Neun bis König in gemischten Gattungen ist keine Garde', () => {
    const t = blatt('bogen-9', 'armbrust-10', 'artillerie-11', 'kanonier-12', 'bogen-13');
    if (hat(t, 'koeniglicheGarde')) return 'die Gattung wird nicht geprüft';
    if (!hat(t, 'perfekterVormarsch')) return 'der Perfekte Vormarsch fehlt';
    return true;
  });

  pruefe('Die Königliche Garde zahlt ihre Salven aus', () => {
    const f = P.FORMATIONEN.find(x => x.id === 'koeniglicheGarde');
    const aufmarsch = P.FORMATIONEN.find(x => x.id === 'koeniglicherAufmarsch');
    if (!(f.salven > aufmarsch.salven)) return 'sie bringt nicht mehr als der Aufmarsch';
    const w = P.berechneWucht(gardenblatt());
    const erwartet = 1 + f.salven + 1;   // Grundsalve + Garde + Geschlossene Front
    if (w.salven !== erwartet) return 'Salven ' + w.salven + ', erwartet ' + erwartet;
    return gleich(w.wucht, (9 + 10 + 11 + 12 + 13) * w.salven, 'Königliche Garde');
  });

  pruefe('Die Königliche Garde lässt sich ausbauen', () => {
    const f = P.FORMATIONEN.find(x => x.id === 'koeniglicheGarde');
    if (!(f.jeStufe > 0)) return 'sie hat keinen Stufenzuwachs';
    const s1 = P.formationsSalven(f, 1);
    const s3 = P.formationsSalven(f, 3);
    return gleich(s3 - s1, 2 * f.jeStufe, 'Zuwachs über zwei Stufen');
  });

  pruefe('Die Königliche Garde erscheint in der Vorschau', () => {
    const deck = ['bogen-9', 'bogen-10', 'bogen-11', 'bogen-12', 'bogen-13']
      .map(id => P.neueEinheit(id));
    P.neuerKampf({ feind: P.baueFeind(1), deck });
    const tuerme = P.kampf().tuerme;
    // Vier stehen, die fuenfte haengt noch ueber dem letzten Turm.
    ['bogen-9', 'bogen-10', 'bogen-11', 'bogen-12']
      .forEach((id, i) => { tuerme[i].einheit = P.neueEinheit(id); });
    tuerme[4].einheit = null;
    const ohne = P.berechneWucht(tuerme).formationen.map(f => f.id);
    if (ohne.includes('koeniglicheGarde')) return 'die Garde gilt schon bei vier Einheiten';
    const v = P.vorschau(4, P.neueEinheit('bogen-13'));
    if (!v.formationen.some(f => f.id === 'koeniglicheGarde')) {
      return 'die Vorschau kennt sie nicht: ' + v.formationen.map(f => f.id);
    }
    if (!(v.wucht > P.berechneWucht(tuerme).wucht)) return 'die Vorschau verspricht nicht mehr Wucht';
    return true;
  });

  pruefe('Geschlossene Front nur bei fünf Einheiten', () => {
    const voll = blatt('bogen-1', 'armbrust-3', 'artillerie-5', 'kanonier-7', 'bogen-9');
    if (!hat(voll, 'geschlosseneFront')) return 'bei fünf nicht erkannt';
    const luecke = blatt('bogen-1', 'armbrust-3', 'artillerie-5', 'kanonier-7', null);
    if (hat(luecke, 'geschlosseneFront')) return 'bei vier trotzdem erkannt';
    return true;
  });

  pruefe('Jede Formation nennt ihre Familie und ihre Salven', () => {
    for (const f of P.FORMATIONEN) {
      if (!P.FORMATIONS_FAMILIEN[f.familie]) return f.id + ': Familie ' + f.familie + ' gibt es nicht';
      if (!(f.salven > 0)) return f.id + ' bringt keine Salven';
      if (typeof f.rang !== 'number') return f.id + ' hat keinen Rang in seiner Familie';
      if (!f.name || !f.text) return f.id + ' ohne Namen oder Text';
    }
    return true;
  });

  pruefe('Formationsstufen heben die Salven', () => {
    const f = P.FORMATIONEN.find(x => x.id === 'reineGarde');
    if (P.formationsSalven(f, 1) !== f.salven) return 'Stufe 1 weicht ab';
    if (P.formationsSalven(f, 3) !== f.salven + 2 * f.jeStufe) return 'Stufe 3 rechnet falsch';
    return true;
  });

  // ---------- Wucht ----------
  pruefe('leere Burg macht keine Wucht', () => {
    const w = P.berechneWucht(blatt(null, null, null, null, null));
    return gleich(w.wucht, 0, 'Wucht');
  });
  pruefe('eine Einheit feuert einmal und macht ihren Rang', () => {
    const w = P.berechneWucht(blatt('bogen-7', null, null, null, null));
    if (w.salven !== P.KERN.salvenGrund) return w.salven + ' Salven statt ' + P.KERN.salvenGrund;
    return gleich(w.wucht, 7, 'Wucht');
  });
  pruefe('Turmtyp wirkt nur auf die passende Gattung', () => {
    const passt = P.berechneWucht([{ nr: 1, typ: 'schuetzenturm', einheit: P.neueEinheit('bogen-8') }]);
    if (passt.wucht !== Math.round(8 * P.KERN.turmFaktor)) return 'Bogen auf Schützenturm: ' + passt.wucht;
    const nicht = P.berechneWucht([{ nr: 1, typ: 'schuetzenturm', einheit: P.neueEinheit('kanonier-8') }]);
    return gleich(nicht.wucht, 8, 'Kanonier auf Schützenturm');
  });

  /*
   * Die eine Rechnung, auf der jetzt alles steht: Summe der Wucht je Salve,
   * mal die Zahl der Salven. Wer sie im Kopf nachrechnen kann, kann das Spiel
   * planen - genau dafuer wurde die alte Faktorkette aufgegeben.
   */
  pruefe('Wucht ist Summe je Salve mal Salvenzahl', () => {
    const t = blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12');
    const w = P.berechneWucht(t);
    const erwartet = (8 + 9 + 10 + 11 + 12) * w.salven;
    if (w.jeSalve !== 50) return 'je Salve ' + w.jeSalve;
    return gleich(w.wucht, erwartet, 'Königlicher Aufmarsch');
  });

  pruefe('Mehr Formation heisst mehr Salven', () => {
    const salven = (t) => P.berechneWucht(t).salven;
    const nichts = salven(blatt('bogen-2', 'armbrust-5', 'artillerie-9', 'kanonier-12', null));
    const front  = salven(blatt('bogen-2', 'armbrust-5', 'artillerie-9', 'kanonier-12', 'bogen-7'));
    const garde  = salven(blatt('bogen-2', 'bogen-5', 'bogen-9', 'bogen-12', 'bogen-7'));
    const koenig = salven(blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12'));
    if (!(nichts < front && front < garde && garde < koenig)) {
      return 'Reihenfolge stimmt nicht: ' + [nichts, front, garde, koenig].join(' < ');
    }
    return true;
  });

  pruefe('Die Salvenzahl steht in jedem Posten', () => {
    const t = blatt('bogen-8', 'bogen-9', 'bogen-10', 'bogen-11', 'bogen-12');
    const w = P.berechneWucht(t);
    for (const p of w.posten) if (p.schuesse !== w.salven) return 'Posten feuert ' + p.schuesse;
    return true;
  });

  pruefe('Breakdown nennt jeden Schritt und endet auf der Endwucht', () => {
    const w = P.berechneWucht(blatt('bogen-5', 'bogen-7', 'bogen-9', 'artillerie-11', 'artillerie-13'));
    if (!w.schritte.length) return 'keine Schritte';
    if (w.schritte[0].art !== 'grund') return 'erster Schritt ist ' + w.schritte[0].art;
    if (!w.posten.length) return 'keine Posten';
    if (w.schritte[w.schritte.length - 1].wucht !== w.wucht) return 'letzter Schritt passt nicht zur Endwucht';
    if (!w.schritte.some(x => x.art === 'salven')) return 'die Salvenzeile fehlt';
    return true;
  });

  pruefe('eine starke Burg eskaliert deutlich', () => {
    const schwach = P.berechneWucht(blatt('bogen-5', 'armbrust-7', 'artillerie-9', 'kanonier-11', 'bogen-13')).wucht;
    const stark = P.berechneWucht(blatt('bogen-9', 'bogen-10', 'bogen-11', 'bogen-12', 'bogen-13')).wucht;
    if (stark < schwach * 3) return 'nur ' + schwach + ' -> ' + stark;
    return true;
  });

  // ---------- Wappen ----------
  pruefe('Wappen des Löwen hebt den Rang der Mitte', () => {
    // Rang 4 in der Mitte wird mit dem Loewen zu 12 - und bildet damit ein
    // Paar mit einer echten 12, das ohne das Wappen nicht da waere.
    const t = blatt('bogen-2', 'armbrust-5', 'artillerie-4', 'kanonier-12', 'bogen-7');
    const ohne = P.erkenneFormationen(t).map(f => f.id);
    const mit = P.erkenneFormationen(t, ['loewe']).map(f => f.id);
    if (ohne.includes('doppelposten')) return 'ohne Wappen schon ein Paar';
    if (!mit.includes('doppelposten')) return 'mit Wappen kein Paar: ' + mit;
    return true;
  });
  pruefe('Wappen des Doppeladlers zählt Turm 1 doppelt', () => {
    // Zwei Bogenschuetzen plus der Doppeladler auf Turm 1 sind drei - ein Regiment.
    const t = blatt('bogen-9', 'bogen-4', 'artillerie-5', 'kanonier-12', 'armbrust-7');
    const ohne = P.erkenneFormationen(t).map(f => f.id);
    const mit = P.erkenneFormationen(t, ['doppeladler']).map(f => f.id);
    if (ohne.includes('regiment')) return 'ohne Wappen schon ein Regiment';
    if (!mit.includes('regiment')) return 'mit Wappen kein Regiment: ' + mit;
    // Die Kopie besetzt keinen Turm: die Front braucht weiter fuenf Einheiten.
    const vier = blatt('bogen-9', 'bogen-4', 'artillerie-5', 'kanonier-12', null);
    if (P.erkenneFormationen(vier, ['doppeladler']).some(f => f.id === 'geschlosseneFront')) {
      return 'die Kopie füllt eine leere Stellung';
    }
    return true;
  });
  pruefe('Wappen des Wolfs zahlt für leere Türme', () => {
    // Nicht auf eine Zahl prüfen, sondern auf die Regel: der Zuschlag ist eine
    // Stellschraube in KERN und darf sich ändern, ohne dass die Prüfung bricht.
    const leer = 4;
    const ohne = P.berechneWucht(blatt('bogen-8', null, null, null, null)).wucht;
    const mit = P.berechneWucht(blatt('bogen-8', null, null, null, null), ['wolf']).wucht;
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
  pruefe('Wappenketten laufen nicht endlos', () => {
    /*
     * Zwei Wappen, die einander zuenden. Das ist keine ausgedachte Not: es
     * ist die Bauform, die ein Spieler frueher oder spaeter zusammensteckt,
     * und sie muss enden, ohne dass jemand ihre Namen kennt.
     */
    P.meldeWappen({
      id: 'pruefHin', name: 'Prüfhin', zeichen: '↔', seltenheit: 'gewoehnlich',
      text: 'zündet rechts.', hinweis: 'nur zum Prüfen',
      hoert: P.aufAllem((l) => { P.zuendeErneut(l, l.platz + 1); }),
    });
    P.meldeWappen({
      id: 'pruefHer', name: 'Prüfher', zeichen: '↔', seltenheit: 'gewoehnlich',
      text: 'zündet links.', hinweis: 'nur zum Prüfen',
      hoert: P.aufAllem((l) => { P.zuendeErneut(l, l.platz - 1); }),
    });
    const band = P.neuesBand(['pruefHin', 'pruefHer']);
    const t0 = Date.now();
    P.neuerKampf({ feind: P.baueFeind(9), deck: P.START_DECK.map(id => P.neueEinheit(id)),
      wappen: band.reihe.slice() });
    P.beendeRunde();
    if (Date.now() - t0 > 3000) return 'es dauerte ' + (Date.now() - t0) + ' ms';
    return P.ueberlauf() > 0 ? true : 'die Bremse hat nicht gegriffen';
  });
  pruefe('Gegnerstärke steht in einer Tabelle', () => {
    if (P.FEIND_STAERKE.length < 10) return 'nur ' + P.FEIND_STAERKE.length + ' Werte';
    for (let i = 1; i < P.FEIND_STAERKE.length; i++) {
      if (P.FEIND_STAERKE[i] <= P.FEIND_STAERKE[i - 1]) return 'Station ' + (i + 1) + ' ist nicht stärker';
    }
    return true;
  });

  // ---------- Der Feldzug ----------
  /* Eine Schlacht aus der Belagerung heraus beginnen. */
  const starteSchlacht = () => {
    const wahl = P.offeneWahlen().find(w => w.kampf);
    const r = P.waehle(wahl);
    return r.kampf ? P.beginneSchlacht(r.kampf) : null;
  };

  pruefe('Ein neuer Feldzug steht vor der ersten Ante mit dem Startdeck', () => {
    const l = P.neuerLauf();
    if (l.ante !== 1) return 'Ante ' + l.ante;
    if (l.schlachten !== 0) return 'schon ' + l.schlachten + ' Schlachten';
    if (l.deck.length !== P.START_DECK.length) return l.deck.length + ' Karten';
    if (l.wappen.length) return 'schon Wappen';
    if (l.turmTypen.length !== P.KERN.tuerme) return l.turmTypen.length + ' Turmtypen';
    return P.dieBelagerung ? true : 'keine Belagerung';
  });

  pruefe('Die Ante steht bereit, sobald der Feldzug beginnt', () => {
    P.neuerLauf();
    const lage = P.belagerungslage();
    if (!lage) return 'keine Lage';
    if (lage.abschnitt !== 'vorhut') return 'Abschnitt ' + lage.abschnitt;
    if (lage.divisionen.length !== 3) return lage.divisionen.length + ' Divisionen';
    return lage.heerfuehrer.name ? true : 'kein Heerführer';
  });

  pruefe('Ein Kampf aus dem Lauf bekommt Deck, Wappen und Turmtypen', () => {
    const l = P.neuerLauf();
    l.wappen = ['loewe'];
    l.turmTypen[2] = 'pulverturm';
    const k = starteSchlacht();
    if (!k) return 'kein Kampf';
    if (k.zug.length + k.hand.length !== l.deck.length) return 'Deckgrösse stimmt nicht';
    if (k.wappen[0] !== 'loewe') return 'Wappen fehlt';
    if (k.tuerme[2].typ !== 'pulverturm') return 'Turmtyp fehlt';
    return true;
  });

  pruefe('Der Kampf fasst das Deck des Laufs nicht an', () => {
    const l = P.neuerLauf();
    const vorher = l.deck.length;
    const k = starteSchlacht();
    // Im Kampf eine Einheit setzen und ersetzen - im Lauf darf nichts passieren.
    P.setzeEinheit(0, k.hand[0]);
    P.setzeEinheit(0, k.hand[0]);
    if (l.deck.length !== vorher) return 'Deck jetzt ' + l.deck.length;
    if (l.deck.some(c => c.einsatz)) return 'Kampfspur im Deck';
    return true;
  });

  pruefe('Ein Sieg bringt Sold und drei Angebote', () => {
    const l = P.neuerLauf();
    const k = starteSchlacht();
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
      const k = starteSchlacht();
      k.runde = runde; k.feind.hp = 0; k.ende = 'sieg';
      return P.werteKampfAus(k).sold;
    };
    const frueh = bau(2), spaet = bau(5);
    if (!(frueh > spaet)) return 'Runde 2: ' + frueh + ', Runde 5: ' + spaet;
    return true;
  });

  pruefe('Eine Niederlage beendet den Lauf', () => {
    const l = P.neuerLauf();
    const k = starteSchlacht();
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

  pruefe('Eine Ante läuft von der Vorhut bis zum Heerführer', () => {
    P.neuerLauf();
    let schutz = 0;
    while (P.dieBelagerung.abschnitt !== 'vorbei' && schutz++ < 30) {
      const wahlen = P.offeneWahlen();
      if (!wahlen.length) return 'keine Wahl in Abschnitt ' + P.dieBelagerung.abschnitt;
      const wahl = wahlen.find(w => w.kampf) || wahlen[0];
      const r = P.waehle(wahl);
      if (!r.ok) return r.grund;
      if (r.kampf) P.meldeAusgang(true);
    }
    if (schutz >= 30) return 'die Ante kam nicht zum Ende';
    const n = P.dieBelagerung.kaempfe;
    if (n < P.KAEMPFE_MIN || n > P.KAEMPFE_MAX) return n + ' Schlachten';
    return P.dieBelagerung.ende === 'sieg' ? true : 'Ausgang ' + P.dieBelagerung.ende;
  });

  pruefe('Ein Feldzug lässt sich von Anfang bis Ende durchspielen', () => {
    const l = P.neuerLauf();
    let kaempfe = 0;
    let schutz = 0;
    while (!l.ende && schutz++ < 200) {
      const b = P.dieBelagerung;
      if (b.abschnitt === 'vorbei') {
        const r = P.naechsteAnte();
        if (r.ende) break;
        continue;
      }
      const wahlen = P.offeneWahlen();
      if (!wahlen.length) return 'keine Wahl in Abschnitt ' + b.abschnitt;
      if (b.abschnitt === 'lager') {
        // Im Lager einmal umsehen, dann aufbrechen.
        P.oeffneLager(b.kaempfe);
        for (const d of P.dasLager.dienste) P.lagerAngebote(d);
        P.waehle(wahlen[0]);
        continue;
      }
      const wahl = wahlen.find(w => w.kampf);
      const erg = P.waehle(wahl);
      if (!erg.ok) return erg.grund;
      const k = P.beginneSchlacht(erg.kampf);
      if (!k) return 'kein Kampf gegen ' + wahl.name;
      kaempfe++;
      k.feind.hp = 0; k.ende = 'sieg';              // wir gewinnen ihn einfach
      const r = P.werteKampfAus(k, wahl.ziel);
      if (!r.sieg) return 'Sieg nicht gewertet gegen ' + wahl.name;
      /*
       * Jedes angenommene Angebot wird SOFORT geprueft, nicht am Ende.
       * Vorher stand hier "irgendwann muss sich das Deck bewegt haben" - und
       * das ist mit drei Anten schlicht falsch: wer eine Karte dazunimmt und
       * spaeter vier ausmustert, steht am Ende wieder bei 52, voellig zu
       * Recht. Geprueft wird jetzt die RICHTUNG jeder einzelnen Bewegung.
       */
      const a = r.belohnung.angebote[0];
      const vorher = l.deck.length;
      if (P.nimmAngebot(a).ok) {
        if (a.art === 'karte' && l.deck.length !== vorher + 1) {
          return 'eine Karte genommen, Deck ging von ' + vorher + ' auf ' + l.deck.length;
        }
        if (a.art === 'entfernen' && l.deck.length >= vorher) {
          return 'ausgemustert, Deck ging von ' + vorher + ' auf ' + l.deck.length;
        }

      }
      P.meldeAusgang(true);
    }
    if (schutz >= 200) return 'der Feldzug kam nicht zum Ende';
    if (l.ende !== 'sieg') return 'Ende ' + l.ende;
    if (kaempfe < P.KAEMPFE_MIN * l.anten) return kaempfe + ' Kämpfe in ' + l.anten + ' Anten';
    if (kaempfe > P.KAEMPFE_MAX * l.anten) return kaempfe + ' Kämpfe in ' + l.anten + ' Anten';
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

  // ---------- Der Spielstand ----------
  pruefe('Der Spielstand geht in den Speicher des Browsers und kommt zurück', () => {
    /*
     * Ohne Neuladen, aber ueber denselben Weg: schreiben, wegwerfen, lesen,
     * laden. Wenn hier etwas fehlt, fehlt es auch nach einem Neustart.
     */
    P.neuerLauf();
    P.derLauf.wappen.push('greif', 'amboss');
    P.derLauf.sold = 777;
    if (!pkSichere()) return 'es liess sich nicht speichern';
    P.neuerLauf();
    if (P.derLauf.sold === 777) return 'der neue Feldzug trug den alten Sold';
    const stand = pkLiesStand();
    if (!stand) return 'nichts im Speicher';
    const r = P.ladeFeldzug(stand);
    if (!r.ok) return r.grund;
    if (P.derLauf.sold !== 777) return 'Sold ' + P.derLauf.sold;
    if (P.derLauf.wappen.join() !== 'greif,amboss') return 'Wappen ' + P.derLauf.wappen.join();
    pkVergissStand();
    return pkLiesStand() ? 'der Stand liess sich nicht vergessen' : true;
  });

  pruefe('Die Vorratsleiste zeigt nur, was es wirklich gibt', () => {
    P.neuerLauf();
    P.neuerVorrat();
    pkVorratsleiste();
    const leiste = document.getElementById('pk-vorrat');
    if (leiste.children.length) return 'sie zeigt ' + leiste.children.length + ' Posten auf leerem Vorrat';
    P.lege('pulver', 4);
    pkVorratsleiste();
    if (leiste.children.length !== 1) return 'sie zeigt ' + leiste.children.length + ' Posten statt einem';
    return leiste.textContent.includes('4') ? true : 'die Menge fehlt: ' + leiste.textContent;
  });

  return raus;
});

await browser.close();

let schlecht = 0;
for (const e of ergebnis) {
  if (!e.ok) schlecht++;
  console.log((e.ok ? '  ok   ' : '  FEHL ') + e.name + (e.ok ? '' : '  — ' + e.hinweis));
}
if (gegenzeichen.length) {
  schlecht += gegenzeichen.length;
  for (const g of gegenzeichen) console.log('  FEHL Stilblatt bricht ab — ' + g);
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
