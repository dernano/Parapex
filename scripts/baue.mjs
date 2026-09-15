/*
 * Der Buendler.
 *
 * Quelltext und Lieferung sind zwei verschiedene Dinge. Geschrieben wird in
 * Modulen unter `quelle/`, ausgeliefert wird EINE Datei - weil ein Artefakt
 * eine Seite rendert und weil man `index.html` doppelklicken koennen soll,
 * ohne Node und ohne Server.
 *
 * Darum kein fremder Buendler: er waere eine Abhaengigkeit fuer ein Problem,
 * das aus zwoelf Dateien ohne npm besteht. Dieser hier tut genau drei Dinge:
 *
 *   1. den Abhaengigkeitsgraphen aus den `import`-Zeilen lesen und topologisch
 *      sortieren - ein KREIS ist ein Fehler und bricht den Bau ab, statt
 *      stillschweigend zu funktionieren, weil Funktionen hochgezogen werden
 *   2. pruefen, dass jeder eingefuehrte Name auch wirklich ausgefuehrt wird
 *   3. `import`/`export` streichen und alles in EINEN Geltungsbereich legen
 *
 * Punkt 2 ist der eigentliche Gewinn gegenueber der einen grossen Datei: dort
 * gewann bei zwei gleichnamigen Funktionen stillschweigend die spaetere.
 *
 *   node scripts/baue.mjs          bauen
 *   node scripts/baue.mjs pruefen  nur melden, ob index.html aktuell ist
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EINSTIEG = 'quelle/kern.js';
const ZIEL = join(WURZEL, 'index.html');
const ANFANG = '  /* ---- gebaut aus quelle/ · nicht von Hand aendern ---- */';
const ENDE = '  /* ---- Ende des gebauten Kerns ---- */';
const NUR_PRUEFEN = process.argv[2] === 'pruefen';

/*
 * Nur die Kommentare stillegen, und zwar laengentreu - die Zeichenketten
 * MUESSEN stehen bleiben, denn in ihnen steht der Pfad, den wir suchen. Ein
 * erster Versuch hat auch sie ausgeblankt und dann nach der Datei
 * `quelle/                ` gesucht.
 */
const nackt = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

/** Ein Modul einlesen: was es holt, was es hergibt, und sein nackter Rumpf. */
function lies(pfad) {
  const roh = readFileSync(join(WURZEL, pfad), 'utf8');
  const sicht = nackt(roh);
  const holt = [];
  const gibt = new Set();

  // import { a, b } from './x.js';
  for (const m of sicht.matchAll(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm)) {
    holt.push({ namen: m[1].split(',').map(s => s.trim()).filter(Boolean), von: m[2] });
  }
  // export { a, b } from './x.js';  - das Dach reicht nur durch
  for (const m of sicht.matchAll(/^export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]\s*;?/gm)) {
    holt.push({ namen: m[1].split(',').map(s => s.trim()).filter(Boolean), von: m[2], durch: true });
  }
  // export const|let|var|function NAME
  for (const m of sicht.matchAll(/^export\s+(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)) {
    gibt.add(m[1]);
  }
  return { pfad, roh, holt, gibt };
}

/** Alle Module ab dem Einstieg einsammeln. */
const module = new Map();
(function sammle(pfad) {
  if (module.has(pfad)) return;
  const m = lies(pfad);
  module.set(pfad, m);
  for (const h of m.holt) sammle(join(dirname(pfad), h.von));
})(EINSTIEG);

/** Topologisch sortieren. Ein Kreis bricht den Bau ab. */
const folge = [];
const stand = new Map();   // 'laeuft' | 'fertig'
(function ordne(pfad, weg) {
  if (stand.get(pfad) === 'fertig') return;
  if (stand.get(pfad) === 'laeuft') {
    console.error('KREIS im Abhaengigkeitsgraphen:\n  ' + [...weg, pfad].join('\n  → '));
    process.exit(1);
  }
  stand.set(pfad, 'laeuft');
  for (const h of module.get(pfad).holt) ordne(join(dirname(pfad), h.von), [...weg, pfad]);
  stand.set(pfad, 'fertig');
  folge.push(pfad);
})(EINSTIEG, []);

/** Jeder geholte Name muss auch wirklich hergegeben werden. */
let klagen = 0;
for (const m of module.values()) {
  for (const h of m.holt) {
    const quelle = module.get(join(dirname(m.pfad), h.von));
    for (const n of h.namen) {
      if (quelle.gibt.has(n)) continue;
      // Durchgereichtes darf auch aus einem weiteren Dach kommen
      if (quelle.holt.some(x => x.durch && x.namen.includes(n))) continue;
      console.error(`${m.pfad} holt "${n}" aus ${h.von} - das gibt es dort nicht.`);
      klagen++;
    }
  }
}
if (klagen) process.exit(1);

/** Die Flaeche nach aussen: genau das, was das Dach hergibt. */
const dach = module.get(EINSTIEG);
const flaeche = [...new Set(dach.holt.flatMap(h => h.namen))].sort();

/** Streichen, was nur zwischen Modulen gilt, und alles hintereinanderlegen. */
const teile = [];
for (const pfad of folge) {
  const m = module.get(pfad);
  if (pfad === EINSTIEG) continue;      // das Dach ist nur eine Liste
  const rumpf = m.roh
    .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?[ \t]*\n/gm, '')
    .replace(/^export\s+(const|let|var|function)\b/gm, '$1')
    .trim();
  teile.push(`  // ===== ${pfad} =====\n` + rumpf.split('\n').map(z => (z ? '  ' + z : '')).join('\n'));
}

const kern = teile.join('\n\n') + `

  /*
   * Der Kern von aussen: dieselbe Flaeche, die \`${EINSTIEG}\` hergibt. Sie wird
   * beim Bauen aus dem Dach abgeleitet und kann deshalb nicht davon abweichen.
   */
  if (typeof window !== 'undefined') {
    window.PARAPEX = {
      ${flaeche.join(', ').replace(/(.{72}) /g, '$1\n      ')},
      kampf: () => derKampf,
      lauf: () => derLauf,
      ueberlauf: () => abgewiesene(),
    };
  }`;

const ziel = readFileSync(ZIEL, 'utf8');
const a = ziel.indexOf(ANFANG), b = ziel.indexOf(ENDE);
if (a < 0 || b < 0) { console.error('In index.html fehlen die Baumarken.'); process.exit(1); }
const neu = ziel.slice(0, a + ANFANG.length) + '\n' + kern + '\n' + ziel.slice(b);

if (NUR_PRUEFEN) {
  const gleich = neu === ziel;
  console.log(gleich
    ? 'index.html ist auf dem Stand von quelle/.'
    : 'index.html weicht von quelle/ ab - `node scripts/baue.mjs` laeuft nicht.');
  process.exit(gleich ? 0 : 1);
}

writeFileSync(ZIEL, neu);
console.log(`Gebaut: ${folge.length - 1} Module, ${kern.split('\n').length} Zeilen Kern, ` +
  `${flaeche.length} Namen nach aussen.`);
console.log('Reihenfolge: ' + folge.slice(0, -1).map(p => p.replace('quelle/kern/', '').replace('.js', '')).join(' → '));
