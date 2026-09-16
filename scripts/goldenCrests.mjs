/*
 * PHASE 3 — golden fixtures for the CREST PIPELINE.
 *
 * The riskiest system in the game, and the one that fails most quietly:
 * (s+10)x3 is not s*3+10, so a mistake in ordering produces a plausible wrong
 * number rather than a crash. Nothing about the pipeline moves until the old
 * one has written down what it answers.
 *
 * Three kinds of fixture:
 *
 *   SINGLE   each crest alone on a fixed board — what does it do by itself?
 *   PAIR     every ORDERED pair, both ways round. 50 x 49 = 2450 cases, and
 *            the ones where A,B differs from B,A are the whole point.
 *   GUARD    rows built to trip each recursion guard on purpose, recording
 *            which guard fired and how often.
 *
 * Everything runs with probe = false: that is the real salvo path, the one
 * that burns powder and writes the log. Supplies are reset between cases so
 * one fixture cannot leak into the next.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(join(ROOT, 'quelle/kern.js'));

/*
 * EIN Brett fuer alle Proben, und zwar eines, auf dem moeglichst viel
 * greift: fuenf besetzte Stellungen, vier Gattungen, eine Rangfolge, ein
 * Paar, gemischte Turmtypen. Ein leeres Brett wuerde die halben Wappen
 * schlafen lassen und die Proben waeren gruen, ohne etwas zu messen.
 */
const BRETT = [
  { id: 'bogen-9', typ: 'schuetzenturm' },
  { id: 'armbrust-10', typ: 'ballistenturm' },
  { id: 'artillerie-11', typ: 'wachturm' },
  { id: 'kanonier-12', typ: 'pulverturm' },
  { id: 'bogen-12', typ: 'geschuetzturm' },
];

function baueTuerme() {
  return BRETT.map((b, i) => ({
    nr: i + 1, typ: b.typ, einheit: P.neueEinheit(b.id),
  }));
}

/*
 * EINEN GANZEN KAMPF, nicht eine Wuchtrechnung.
 *
 * Die erste Fassung rief nur `berechneWucht`. Das fuehlte sich sauber an und
 * war ein fast leeres Netz: von fuenfzig Wappen wirkten ZEHN, weil eine
 * Wuchtrechnung nur drei der achtzehn Ereignisse ausloest. Alles, was auf
 * Setzen, Tauschen, Rundenbeginn, Treffer oder Sieg hoert - also die grosse
 * Mehrheit - schlief, und die Proben waren gruen, ohne etwas zu messen.
 *
 * Auch die Sperren: nur `kreis` griff, weil der Kreis alles andere vorher
 * abfaengt. Tiefe, jePlatz, jeEreignis und ketten blieben ungeprueft.
 *
 * Jetzt laeuft ein geskripteter Kampf ueber drei Runden mit Setzen, Ersetzen
 * und Tauschen. Das ist langsamer und misst dafuer das System.
 */
const DECK = P.EINHEITEN_POOL.slice(0, 30).map(k => k.id);

function rechne(reihe, { hp = 500000, setzen = 3, regeln = [] } = {}) {
  P.neuerVorrat();
  const tuerme = baueTuerme();
  /*
   * Die Regeln des Heerfuehrers laufen auf DEMSELBEN Band wie die Wappen, nur
   * dahinter. Ohne sie bleibt die Abweisung `siegel` ungeprueft - es gibt
   * niemanden, der einen Platz verschliessen koennte.
   */
  const feind = { hp, maxHp: hp, name: 'Prüfgegner',
    regeln: regeln.map(id => P.BOSSREGELN[id]).filter(Boolean) };
  const k = P.neuerKampf({
    deck: DECK.map(id => P.neueEinheit(id)),
    feind, wappen: reihe, turmTypen: BRETT.map(b => b.typ),
    stellungen: tuerme, mischen: false,
  });

  const handlungen = [];
  for (let runde = 0; runde < 3 && !k.ende; runde++) {
    /*
     * NICHT alle fuenf Stellungen: setzen kostet je einen Tatendrang, und
     * fuenf Setzungen lassen null fuer den Tausch uebrig. Genau daran hat das
     * Muehlrad in der ersten Fassung nie gezuendet - es hoert auf
     * `kartenGetauscht`, und getauscht wurde nie.
     */
    for (let turm = 0; turm < setzen && k.hand.length && !k.ende; turm++) {
      const r = P.setzeEinheit(turm, k.hand[0]);
      handlungen.push({ art: 'setzen', turm, ok: r.ok === true });
    }
    if (!k.ende && k.hand.length >= 2) {
      const r = P.tauscheHandkarten(k.hand.slice(0, 2));
      handlungen.push({ art: 'tauschen', ok: r.ok === true });
    }
    if (!k.ende) P.beendeRunde();
  }

  const abrechnung = P.berechneWucht(k.tuerme, k.wappen, true);
  const protokoll = P.dasBand ? P.dasBand.protokoll : [];
  const nachGrund = {};
  const nachEreignis = {};
  let tiefste = 0;
  for (const z of protokoll) {
    if (z.abgewiesen) nachGrund[z.abgewiesen] = (nachGrund[z.abgewiesen] || 0) + 1;
    else nachEreignis[z.ereignis] = (nachEreignis[z.ereignis] || 0) + 1;
    tiefste = Math.max(tiefste, z.tiefe);
  }
  const ergebnis = {
    feindHp: k.feind.hp,
    runde: k.runde,
    ende: k.ende,
    wucht: abrechnung.wucht,
    salven: abrechnung.salven,
    formationen: abrechnung.formationen.map(f => f.id).sort(),
    zuendungen: protokoll.filter(z => !z.abgewiesen).length,
    jeEreignis: nachEreignis,
    abgewiesen: nachGrund,
    tiefste,
    handlungen,
    vorrat: Object.fromEntries(Object.keys(P.VORRAT_ARTEN)
      .map(a2 => [a2, P.bestand(a2)]).filter(([, n]) => n)),
  };
  P.raeumeKampf();
  return ergebnis;
}

const IDS = P.WAPPEN_LISTE.slice();

/*
 * DREI KAMPFFORMEN, nicht eine.
 *
 * `lang` laeuft drei Runden gegen einen Gegner, der nicht faellt - dort
 * zuendet alles Laufende. `sieg` laesst ihn in der ersten Salve fallen, mit
 * kraeftigem Ueberschlag: nur so kommen `ueberschlag`, `feindBesiegt` und
 * `kampfEndet` ueberhaupt vor. `niederlage` spielt alle fuenf Runden durch
 * und endet als Verlust - dasselbe Ereignis, der andere Ausgang.
 *
 * Ohne die zweite und dritte Form schwiegen Pflugschar (kampfEndet) und
 * Verwuester (ueberschlag) in jeder einzelnen Probe.
 */
const FORMEN = [
  { name: 'lang', aufbau: { hp: 500000, setzen: 3 } },
  { name: 'sieg', aufbau: { hp: 40, setzen: 3 } },
  { name: 'niederlage', aufbau: { hp: 2000000, setzen: 5 } },
  /* Der Inquisitor versiegelt jede Runde den lautesten Platz. */
  { name: 'versiegelt', aufbau: { hp: 500000, setzen: 3, regeln: ['inquisitor'] } },
  /* Der Usurpator vertauscht Plaetze - die Maschine selbst wird angegriffen. */
  { name: 'vertauscht', aufbau: { hp: 500000, setzen: 3, regeln: ['usurpator'] } },
];

const inAllenFormen = (reihe) =>
  Object.fromEntries(FORMEN.map(f => [f.name, rechne(reihe, f.aufbau)]));

/* ---------- Ohne Wappen: der Bezugspunkt ---------- */
const leerAlle = inAllenFormen([]);
const leer = leerAlle.lang;

/* ---------- Einzeln, in jeder Form ---------- */
const einzeln = IDS.map(id => ({ id, formen: inAllenFormen([id]) }));

/* ---------- Paare, beide Richtungen ---------- */
const paare = [];
let verschieden = 0;
for (const a of IDS) {
  for (const b of IDS) {
    if (a === b) continue;
    const vorwaerts = rechne([a, b]);
    paare.push({ a, b, feindHp: vorwaerts.feindHp, wucht: vorwaerts.wucht,
      salven: vorwaerts.salven, zuendungen: vorwaerts.zuendungen });
  }
}
/* Wie viele Paare haengen wirklich an der Reihenfolge? Das ist die Zahl, die
 * sagt, ob diese 2450 Proben etwas messen oder nur Platz brauchen. */
const nachPaar = new Map(paare.map(p => [p.a + '>' + p.b, p]));
for (const a of IDS) {
  for (const b of IDS) {
    if (a >= b) continue;
    const hin = nachPaar.get(a + '>' + b);
    const her = nachPaar.get(b + '>' + a);
    if (hin && her && (hin.wucht !== her.wucht || hin.salven !== her.salven
      || hin.feindHp !== her.feindHp)) verschieden++;
  }
}

/* ---------- Die Sperren, absichtlich ausgeloest ---------- */
/*
 * Fuenf gleiche Wappen gibt es im Spiel nicht - aber das Band verbietet es
 * nicht, und genau darum ist es der kuerzeste Weg, `jePlatz` und `kreis` zu
 * treiben. Die Reihen hier sind keine Spielsituationen, sondern Proben an
 * den Sperren, und sie sollen es auch sein.
 */
/*
 * Phoenix und Basilisk zuenden den Platz LINKS von sich nach, der Spiegel
 * kopiert den Platz rechts. Eine Kette aus ihnen treibt `jePlatz` und
 * `tiefe`, ohne ein Kreis zu sein - der Kreis faengt sonst alles vorher ab
 * und die anderen vier Sperren blieben ungeprueft.
 */
const sperrReihen = [
  { name: 'Ouroboros dreifach', reihe: ['ouroboros', 'ouroboros', 'ouroboros'] },
  { name: 'Ouroboros mit Fackel', reihe: ['ouroboros', 'fackel', 'ouroboros', 'fackel'] },
  { name: 'Fuenf Ouroboros', reihe: ['ouroboros', 'ouroboros', 'ouroboros', 'ouroboros', 'ouroboros'] },
  { name: 'Phoenixkette', reihe: ['fackel', 'phoenix', 'phoenix', 'phoenix', 'phoenix'] },
  { name: 'Basiliskenkette', reihe: ['fackel', 'basilisk', 'basilisk', 'basilisk', 'basilisk'] },
  { name: 'Basilisk auf Phoenix', reihe: ['fackel', 'phoenix', 'basilisk', 'phoenix', 'basilisk'] },
  { name: 'Spiegelkette', reihe: ['spiegel', 'spiegel', 'spiegel', 'spiegel', 'fackel'] },
  { name: 'Spiegel und Basilisk', reihe: ['spiegel', 'basilisk', 'spiegel', 'basilisk', 'fackel'] },
  { name: 'Drache und Ouroboros', reihe: ['drache', 'ouroboros', 'drache', 'ouroboros', 'drache'] },
  /*
   * Diese Reihe treibt `jeEreignis` - gefunden durch Suche ueber viertausend
   * Reihen, nicht durch Nachdenken. Fuenf laute Wappen ohne Nachzuendung
   * kommen auf 65 Zuendungen in EINEM Ereignis; die Sperre steht bei 60.
   */
  { name: 'Lautes Ereignis', reihe: ['spiegel', 'rabe', 'glocke', 'stier', 'kriegshorn'] },
].filter(r => r.reihe.every(id => IDS.includes(id)));

const sperren = sperrReihen.flatMap(r => FORMEN.map(f => ({
  name: r.name + ' / ' + f.name, reihe: r.reihe, form: f.name,
  ergebnis: rechne(r.reihe, f.aufbau),
})));

const raus = {
  _hinweis: 'Generated from the legacy implementation by scripts/goldenCrests.mjs. '
    + 'Single crests, every ordered pair, and rows built to trip each recursion '
    + 'guard. Do not hand-edit.',
  _quelle: 'quelle/wappen/fliessband.js, sammlung.js, wirkungen.js',
  brett: BRETT,
  ohneWappen: leer,
  formen: FORMEN,
  ohneWappenAlle: leerAlle,
  einzeln,
  paare,
  sperren,
};
const ziel = join(ROOT, 'src/tests/fixtures/crests.golden.json');
writeFileSync(ziel, JSON.stringify(raus, null, 1) + '\n');

console.log(IDS.length + ' Wappen, ' + paare.length + ' geordnete Paare, '
  + sperren.length + ' Sperrproben.');
console.log('Ohne Wappen: ' + leer.wucht + ' Wucht, ' + leer.salven + ' Salven, Gegner bei '
  + leer.feindHp + '.');
const zuendungenGesamt = (e) => FORMEN.reduce((n, f) => n + e.formen[f.name].zuendungen, 0);
const wirksam = einzeln.filter(e => FORMEN.some(f =>
  JSON.stringify(e.formen[f.name]) !== JSON.stringify(leerAlle[f.name]))).length;
console.log('Einzeln wirksam im Kampf: ' + wirksam + ' von ' + IDS.length + '.');
const tot = einzeln.filter(e => zuendungenGesamt(e) === 0).map(e => e.id);
console.log(tot.length
  ? 'OHNE EINE EINZIGE ZUENDUNG: ' + tot.join(', ')
  : 'Jedes Wappen zuendet in mindestens einer Form.');
console.log('Paare, bei denen die REIHENFOLGE das Ergebnis aendert: ' + verschieden
  + ' von ' + (IDS.length * (IDS.length - 1) / 2) + '.');
const gruende = {};
for (const s of sperren) for (const [g, n] of Object.entries(s.ergebnis.abgewiesen)) {
  gruende[g] = (gruende[g] || 0) + n;
}
console.log('Ausgeloeste Sperren: ' + JSON.stringify(gruende));
/*
 * UND WELCHE NICHT. Eine Sperre, die keine Probe ausloest, ist nicht
 * "abgedeckt" - sie ist ungeprueft, und das gehoert in die Ausgabe und nicht
 * in eine Fussnote. Gemessen ueber 4000 zufaellige Reihen in drei
 * Kampfformen: `tiefe` und `ketten` sind mit dem heutigen Wappensatz
 * UNERREICHBAR, weil der Kreiswaechter jede Verkettung bei Tiefe 1 abfaengt.
 */
const OFFEN = ['siegel', 'tiefe', 'jePlatz', 'jeEreignis', 'ketten', 'kreis']
  .filter(g => !gruende[g]);
if (OFFEN.length) console.log('NICHT AUSGELOEST (ungeprueft): ' + OFFEN.join(', '));
