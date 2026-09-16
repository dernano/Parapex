/*
 * PHASE 2b — golden fixtures for the DRAW ALGORITHMS.
 *
 * Seeding changes every draw, so run-level outcomes cannot be compared across
 * the migration. What can — and must — be compared is the algorithms: given
 * the SAME stream of uniform doubles, does the new helper pick what the legacy
 * inline code picked?
 *
 * So this script replaces `Math.random` with a scripted stream, runs the REAL
 * legacy functions, and writes down both the stream it fed them and what came
 * back. The TypeScript test replays that exact stream through Rng's draw
 * helpers and compares. The generator is thereby taken out of the question and
 * only the algorithm is under test — which is the only honest way to prove
 * this particular equivalence.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* A stream that is arbitrary but fixed, and records what was consumed. */
let stream = [];
let consumed = [];
let cursor = 0;
const echteZufallsquelle = Math.random;
Math.random = () => {
  if (cursor >= stream.length) throw new Error('scripted stream exhausted');
  const value = stream[cursor++];
  consumed.push(value);
  return value;
};

/*
 * Values chosen to hit the edges on purpose: exact 0, values just under a
 * bucket boundary, and values close to 1 - the places where `floor` and the
 * weighted countdown's `<= 0` decide differently if the algorithm is off by a
 * hair.
 */
const ZAHLEN = [
  0, 0.999999, 0.5, 0.25, 0.75, 0.0001, 0.333333, 0.666667, 0.125, 0.875,
  0.4, 0.6, 0.2, 0.8, 0.05, 0.95, 0.49999, 0.50001, 0.1, 0.9,
  0.7, 0.3, 0.15, 0.85, 0.45, 0.55, 0.65, 0.35, 0.02, 0.98,
  0.123456, 0.654321, 0.111111, 0.888888, 0.271828, 0.314159, 0.577215, 0.618033,
  0.707106, 0.866025, 0.414213, 0.161803, 0.693147, 0.301029, 0.434294, 0.5,
];

const P = await import(join(ROOT, 'quelle/kern.js'));
const BEG = await import(join(ROOT, 'quelle/kern/begegnungen.js'));
// Direkt aus dem Modul: `belohnungsRang` steht nicht im Barrel, und ein
// `P.belohnungsRang?.()` haette still `null` geliefert - eine Goldprobe, die
// nichts verbraucht und nichts beweist.
const LAUF = await import(join(ROOT, 'quelle/kern/lauf.js'));

const faelle = [];

/**
 * Run `was` against a stream and record what it consumed and produced.
 *
 * `ab` rotates the stream's starting point. Without it every case began at the
 * same value, so a single-draw algorithm always saw 0 - thirteen fixtures that
 * between them exercised exactly one number, and the carefully chosen edge
 * values were never reached. Rotating gives each case a different slice.
 */
function messe(name, algorithmus, eingabe, was, ab = 0) {
  stream = ZAHLEN.slice(ab).concat(ZAHLEN.slice(0, ab));
  consumed = [];
  cursor = 0;
  const ergebnis = was();
  /*
   * Eine Probe, die keine einzige Zufallszahl verbraucht hat, misst nichts -
   * und sieht in der Prüfung trotzdem gruen aus. Genau das ist hier einmal
   * passiert (`belohnungsRang` stand nicht im Barrel, das optionale `?.()`
   * schluckte es). Seitdem bricht der Lauf ab.
   */
  if (!consumed.length) {
    throw new Error('Goldprobe "' + name + '" hat keinen Zufall verbraucht - sie prueft nichts.');
  }
  faelle.push({ name, algorithmus, eingabe, stream: consumed.slice(), ergebnis });
}

/* ---------- shuffle: das Mischen des Zugstapels ---------- */
/*
 * `ziehe` nimmt vom ENDE des Stapels, deshalb ist die gemischte Reihenfolge
 * `[...zug, ...hand umgedreht]`. Ohne diese Umkehrung misst man die Ziehung
 * und nicht die Mischung.
 */
let drehung = 0;
for (const groesse of [2, 5, 13, 13]) {
  const ids = P.EINHEITEN_POOL.slice(0, groesse).map(k => k.id);
  messe('Mischen von ' + groesse + ' Karten, Strom ab ' + drehung, 'shuffle', { items: ids }, () => {
    const k = P.neuerKampf({ deck: ids.map(id => P.neueEinheit(id)), wappen: [], mischen: true });
    const ganz = [...k.zug, ...k.hand.slice().reverse()];
    P.raeumeKampf();
    return ganz.map(c => c.id);
  }, drehung);
  drehung += 7;
}

/* ---------- pick: eine Begegnung aus der Liste ---------- */
for (const ab of [0, 1, 2, 8, 16, 24]) {
  messe('Begegnung ziehen, Strom ab ' + ab, 'pick',
    { items: BEG.BEGEGNUNGEN.map(e => e.id) },
    () => {
      P.neuerLauf();
      // Ohne Bedingungspruefung ist die Liste die ganze Liste - genau das misst
      // den reinen Griff, nicht die Vorauswahl.
      const e = BEG.BEGEGNUNGEN[Math.floor(Math.random() * BEG.BEGEGNUNGEN.length)];
      return e.id;
    }, ab);
}

/* ---------- range: die Streuung des Belohnungsrangs ---------- */
for (const station of [1, 5, 10]) {
  /*
   * Die Probe traegt `mitte` mit, damit die Pruefung sie ohne die alte
   * Rangkurve nachrechnen kann. Eine Goldprobe, die zum Nachrechnen noch
   * eine Quelle braucht, ist keine.
   */
  const mitte = Math.min(13,
    Math.round(P.LAUF.rangKurve.ab + P.LAUF.rangKurve.je * station));
  for (const ab of [0, 1, 3, 9, 17]) {
    messe('Belohnungsrang an Station ' + station + ', Strom ab ' + ab, 'range',
      { min: -2, max: 2, station, mitte, clampMin: 1, clampMax: 13 },
      () => {
        P.neuerLauf();
        return LAUF.belohnungsRang(station);
      }, ab);
  }
}

/* ---------- weighted: das Wappenangebot ---------- */
for (const schlachten of [3, 8, 14]) {
  // Die Bewerber samt Gewicht mit in die Probe: sonst braeuchte die Pruefung
  // die Wappensammlung, und die zieht erst in Phase 3 um.
  const bewerber = P.WAPPEN_LISTE
    .filter(id => {
      const r = P.WAPPEN_ANGEBOT[P.WAPPEN[id].seltenheit];
      return r && schlachten >= r.ab;
    })
    .map(id => ({ id, weight: P.WAPPEN_ANGEBOT[P.WAPPEN[id].seltenheit].gewicht }));
  for (const ab of [0, 1, 2, 4, 11, 19]) {
    messe('Wappenangebot nach ' + schlachten + ' Schlachten, Strom ab ' + ab, 'weighted',
      { schlachten, candidates: bewerber },
      () => {
        P.neuerLauf();
        P.derLauf.schlachten = schlachten;
        const a = P.angebotWappen();
        return a ? a.wappen : null;
      }, ab);
  }
}

/* ---------- sample: zufaellige Karten aus dem Deck ---------- */
let sammelDrehung = 0;
for (const n of [1, 3, 7, 10]) {
  messe(n + ' Karten ohne Zuruecklegen, Strom ab ' + sammelDrehung, 'sample', { count: n }, () => {
    P.neuerLauf();
    P.derLauf.deck = P.EINHEITEN_POOL.slice(0, 10).map(k => P.neueEinheit(k.id));
    const ids = P.derLauf.deck.map(c => c.id);
    const raus = BEG.zufaelligeKarten(n);
    return { pool: ids, drawn: raus.map(c => c.id) };
  }, sammelDrehung);
  sammelDrehung += 5;
}

Math.random = echteZufallsquelle;

const raus = {
  _hinweis: 'Generated from the legacy implementation by scripts/goldenDraws.mjs, '
    + 'with Math.random replaced by a scripted stream. Each case records the exact '
    + 'stream the legacy code consumed and what it produced. Do not hand-edit.',
  _quelle: 'quelle/kern/kampf.js, quelle/kern/lauf.js, quelle/kern/begegnungen.js',
  faelle,
};
const ziel = join(ROOT, 'src/tests/fixtures/draws.golden.json');
writeFileSync(ziel, JSON.stringify(raus, null, 2) + '\n');
console.log(faelle.length + ' Zieh-Goldproben geschrieben: ' + ziel);
for (const f of faelle) {
  console.log('  ' + f.algorithmus.padEnd(9) + ' ' + f.name.padEnd(38)
    + ' ' + f.stream.length + ' Zufallszahlen verbraucht');
}
