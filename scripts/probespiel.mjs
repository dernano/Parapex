/*
 * Der Probespiel-Durchgang.
 *
 *   node scripts/probespiel.mjs
 *
 * Eine Pruefung beantwortet "stimmt es". Ein Probespiel beantwortet "taugt
 * es" - und das laesst sich zu einem guten Teil MESSEN, statt es zu fuehlen:
 * wie gross werden die Zahlen, wie lange rechnet die schlimmste Maschine, ist
 * eine Bossregel ueberhaupt zu spueren, waechst ein Vorrat ins Uferlose.
 *
 * Was hier steht, ersetzt kein Spielen. Es sagt nur, wo man hinsehen muss.
 */
import * as P from '../quelle/kern.js';

const blatt = (...ids) => ids.map((id, i) =>
  ({ nr: i + 1, typ: 'wachturm', einheit: id ? P.neueEinheit(id) : null }));
const fuenf = () => blatt('bogen-8', 'armbrust-3', 'kanonier-5', 'artillerie-7', 'bogen-2');
const stark = () => blatt('bogen-9', 'bogen-10', 'bogen-11', 'bogen-12', 'bogen-13');
const zahl = (n) => {
  const b = Math.abs(n);
  if (b >= 1e12) return (n / 1e12).toFixed(1) + ' Bio';
  if (b >= 1e9) return (n / 1e9).toFixed(1) + ' Mrd';
  if (b >= 1e6) return (n / 1e6).toFixed(1) + ' Mio';
  return Math.round(n).toLocaleString('de-DE');
};

const funde = [];
const merke = (was) => funde.push(was);

console.log('\nProbespiel\n' + '='.repeat(60));

/* ---------- A. Ohne Wappen ---------- */
console.log('\nA — Die Burg ohne ein einziges Wappen');
P.neuerVorrat();
P.neuesBand([]);
const nackt = P.berechneWucht(fuenf(), []).wucht;
const nacktStark = P.berechneWucht(stark(), []).wucht;
console.log('  gemischtes Blatt: ' + zahl(nackt) + ' · Königliche Garde: ' + zahl(nacktStark));
if (nacktStark / nackt < 3) merke('Die beste Aufstellung bringt ohne Wappen nur ×'
  + (nacktStark / nackt).toFixed(1) + ' — zu wenig Unterschied zwischen gut und schlecht gespielt.');

/* ---------- B. Jedes Wappen allein ---------- */
console.log('\nB — Jedes Wappen für sich, auf demselben Blatt');
const allein = {};
for (const id of P.WAPPEN_LISTE) {
  P.neuerVorrat();
  P.neuesBand([id]);
  allein[id] = P.berechneWucht(fuenf(), P.dasBand.reihe, false).wucht;
}
const sortiert = P.WAPPEN_LISTE.slice().sort((a, b) => allein[b] - allein[a]);
console.log('  stärkste allein:  ' + sortiert.slice(0, 3)
  .map(id => P.WAPPEN[id].name.replace('Wappen ', '') + ' ' + zahl(allein[id])).join(' · '));
console.log('  ohne Wirkung allein: ' + sortiert.filter(id => allein[id] <= nackt).length + ' von '
  + P.WAPPEN_LISTE.length + ' (Verstärker, Kopierer, Quellen — das ist Absicht)');

/*
 * Ein ganzer Kampf gegen einen Pruefstein, der nicht faellt. Alles, was auf
 * `rundeBeginnt` oder `rundeEndet` hoert, zuendet in einer blossen
 * Wuchtrechnung NIE - der Usurpator und der Inquisitor sahen in der ersten
 * Fassung dieses Skripts deshalb aus, als taeten sie nichts.
 */
/*
 * Ein Spieler, der wenigstens rechnet: die Setzung nehmen, die am meisten
 * bringt. Alles hier misst gegen IHN und nicht gegen jemanden, der die erste
 * Handkarte auf den ersten Turm legt - sonst misst man die Dummheit des Bots
 * und nicht das Spiel.
 */
function besterZug(k) {
  const jetzt = P.berechneWucht(k.tuerme, k.wappen).wucht;
  let beste = null;
  for (const karte of k.hand) {
    for (let i = 0; i < k.tuerme.length; i++) {
      const kosten = k.tuerme[i].einheit ? P.KERN.kosten.ersetzen : P.KERN.kosten.einsetzen;
      if (kosten > k.tatendrang) continue;
      const w = P.vorschau(i, karte).wucht;
      const gewinn = (w - jetzt) / kosten;
      if (!beste || gewinn > beste.gewinn) beste = { karte, turm: i, gewinn };
    }
  }
  return beste && beste.gewinn > 0 ? beste : null;
}

function spieleRunden(k, runden = P.KERN.runden) {
  for (let r = 0; r < runden && !k.ende; r++) {
    let zug;
    while ((zug = besterZug(k))) P.setzeEinheit(zug.turm, zug.karte);
    P.beendeRunde();
  }
}

function schadenImKampf(wappen, regeln = [], runden = P.KERN.runden) {
  const hp = 1e15;
  P.neuerVorrat();
  const k = P.neuerKampf({
    feind: { name: 'Prüfstein', hp, maxHp: hp, regeln: P.baueRegeln(regeln) },
    deck: P.START_DECK.map(e => P.neueEinheit(e)), wappen, mischen: false,
  });
  spieleRunden(k, runden);
  const schaden = hp - k.feind.hp;
  P.raeumeKampf();
  return schaden;
}

/* ---------- C. Eine echte Maschine ---------- */
/*
 * Fuenf Verstaerker ohne Quelle sind nichts - richtig so, und deshalb ein
 * schlechtes Probestueck. Eine Maschine braucht einen, der etwas macht, und
 * dann welche, die es vervielfachen.
 */
console.log('\nC — Eine echte Maschine: Quelle, dann Verstärker');
const maschine = ['schmiedehammer', 'pulverhorn', 'drache', 'greif', 'weltenrad'];
const t0 = Date.now();
const mitMaschine = schadenImKampf(maschine);
const dauer = Date.now() - t0;
const ohneAlles = schadenImKampf([]);
console.log('  ohne Wappen: ' + zahl(ohneAlles) + ' · mit der Maschine: ' + zahl(mitMaschine)
  + '   (×' + (mitMaschine / ohneAlles).toFixed(1) + ') · ' + dauer + ' ms für fünf Runden');
if (dauer > 120) merke('Ein Kampf mit dieser Maschine rechnet ' + dauer + ' ms — das sieht man.');
if (mitMaschine / ohneAlles < 3) merke('Hammer → Pulverhorn → Drache → Greif → Weltenrad bringt nur ×'
  + (mitMaschine / ohneAlles).toFixed(1) + '. Der Hammer macht Pulver nur beim SETZEN, und gesetzt wird'
  + ' fast nur in der ersten Runde — danach läuft das Pulverhorn leer.');

/* ---------- D. Die Reihenfolge, im echten Kampf ---------- */
console.log('\nD — Dieselbe Maschine, umgedreht');
const rueck = schadenImKampf(maschine.slice().reverse());
console.log('  ' + zahl(mitMaschine) + '  gegen  ' + zahl(rueck)
  + '   (Faktor ' + (Math.max(mitMaschine, rueck) / Math.max(1, Math.min(mitMaschine, rueck))).toFixed(1) + ')');
if (Math.abs(mitMaschine - rueck) / Math.max(mitMaschine, rueck) < 0.1) {
  merke('Die Maschine umzudrehen ändert kaum etwas — das Gestell trägt nicht.');
}

/* ---------- E. Die Bossregeln, im echten Kampf gemessen ---------- */
console.log('\nE — Was jede Bossregel eine echte Maschine kostet');
const ohneRegel = schadenImKampf(maschine);
for (const id of P.BOSSREGEL_LISTE) {
  const mit = schadenImKampf(maschine, [id]);
  const anteil = 100 * (1 - mit / ohneRegel);
  console.log('  ' + P.BOSSREGELN[id].name.padEnd(24) + (anteil >= 0 ? '−' : '+')
    + Math.abs(anteil).toFixed(0).padStart(3) + ' %');
  if (Math.abs(anteil) < 5) {
    merke(P.BOSSREGELN[id].name + ' kostet diese Maschine nur ' + anteil.toFixed(0)
      + ' % — gegen eine Reihe wie diese ist er wirkungslos.');
  }
}

/* ---------- F. Wächst ein Vorrat ins Uferlose? ---------- */
console.log('\nF — Vorräte über einen ganzen Feldzug');
P.neuerLauf();
P.derLauf.wappen.push('schmiedehammer', 'hetzhund', 'hirsch', 'verwuester', 'kriegskasse');
let schutz = 0;
while (!P.derLauf.ende && schutz++ < 200) {
  const b = P.dieBelagerung;
  if (b.abschnitt === 'vorbei') { if (P.naechsteAnte().ende) break; continue; }
  const w = P.offeneWahlen();
  if (!w.length) break;
  if (b.abschnitt === 'lager') { P.waehle(w[0]); continue; }
  const wahl = w.find(x => x.kampf);
  const erg = P.waehle(wahl);
  const k = P.beginneSchlacht(erg.kampf);
  spieleRunden(k);
  P.werteKampfAus(k, wahl.ziel);
  P.meldeAusgang(k.ende === 'sieg');
  if (k.ende !== 'sieg') break;
}
const stand = P.sichtbarerVorrat();
console.log('  nach ' + P.derLauf.schlachten + ' Schlachten: '
  + (stand.map(v => v.name + ' ' + zahl(v.menge)).join(' · ') || 'nichts'));
for (const v of stand) {
  if (v.menge > 1e6) merke(v.name + ' steht bei ' + zahl(v.menge) + ' — das wächst ins Uferlose.');
}

/* ---------- G. Wie gross werden die Zahlen? ---------- */
/*
 * Nicht geraten, sondern GESUCHT: fuenfmal hintereinander das Wappen und den
 * Platz nehmen, die am meisten bringen. Das findet nicht die beste Reihe der
 * Welt, aber eine, die ein Spieler auch fände - und sie sagt, wie weit das
 * Fliessband ueberhaupt traegt.
 */
console.log('\nG — Die stärkste Reihe, die eine gierige Suche findet');
let reiheG = [];
let bestG = schadenImKampf([]);
for (let platzZahl = 0; platzZahl < P.WAPPEN_PLAETZE; platzZahl++) {
  let bester = null;
  for (const id of P.WAPPEN_LISTE) {
    if (reiheG.includes(id)) continue;
    for (let p = 0; p <= reiheG.length; p++) {
      const probe = reiheG.slice();
      probe.splice(p, 0, id);
      const w = schadenImKampf(probe);
      if (!bester || w > bester.w) bester = { w, reihe: probe, id };
    }
  }
  if (!bester || bester.w <= bestG) break;
  reiheG = bester.reihe;
  bestG = bester.w;
  console.log('  ' + (platzZahl + 1) + '. ' + P.WAPPEN[bester.id].name.replace('Wappen ', '').padEnd(22)
    + zahl(bestG).padStart(12) + '   [' + reiheG.join(' → ') + ']');
}
console.log('  Hebel gegenüber der nackten Burg: ×' + (bestG / ohneAlles).toFixed(1));
if (bestG < 1e6) merke('Die stärkste gefundene Reihe bleibt bei ' + zahl(bestG)
  + ' — das Fliessband trägt nicht weit genug für grosse Zahlen.');

/* ---------- H. Der schwerste Heerführer ---------- */
console.log('\nH — Der Heerführer, wenn man alles durchlässt');
P.neuerLauf();
schutz = 0;
while (P.dieBelagerung.abschnitt !== 'heerfuehrer' && schutz++ < 30) {
  const w = P.offeneWahlen();
  if (!w.length) break;
  if (P.dieBelagerung.abschnitt === 'lager') { P.waehle(w[0]); continue; }
  const durch = w.find(x => x.art === 'durchlassen' && !x.gesperrt);
  const r = P.waehle(durch || w.find(x => x.kampf));
  if (r.kampf) P.meldeAusgang(true);
}
const h = P.baueHeerfuehrer();
const lage = P.belagerungslage();
console.log('  ' + h.name + ': ' + zahl(h.hp) + ' Stärke, ' + h.regelIds.length + ' Regeln ('
  + h.regelIds.join(', ') + ')');
console.log('  dafür: ' + lage.vorbereitung + ' Vorbereitung und ' + P.dieBelagerung.kaempfe
  + ' gesparte Schlachten');
if (h.regelIds.length < 3) merke('Wer alles durchlässt, bekommt nur ' + h.regelIds.length
  + ' Regeln — die Entscheidung trägt zu wenig.');

/* ---------- Was aufgefallen ist ---------- */
console.log('\n' + '='.repeat(60));
if (!funde.length) console.log('\nNichts aufgefallen.\n');
else {
  console.log('\nAUFGEFALLEN\n');
  for (const f of funde) console.log('  · ' + f);
  console.log();
}
