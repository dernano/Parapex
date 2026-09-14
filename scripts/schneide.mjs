/*
 * Schneiden, was `erreichbar.mjs` als unerreichbar meldet - und zwar so oft,
 * bis nichts mehr uebrig ist. Jeder Schnitt legt den naechsten frei: faellt
 * `renderRoute`, faellt danach `betreteKnoten`, und so weiter.
 *
 *   node scripts/schneide.mjs          nur zeigen
 *   node scripts/schneide.mjs tu es    wirklich schneiden
 *
 * Danach wird gemessen, nicht geglaubt: `node scripts/pruefe.mjs` und
 * `node scripts/lauftest.mjs`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATEI = join(WURZEL, 'index.html');
const ECHT = process.argv[2] === 'tu' || process.argv[2] === 'tues';

let gesamt = 0, runden = 0;
for (;;) {
  const bericht = execFileSync('node', [join(WURZEL, 'scripts/erreichbar.mjs')], { encoding: 'utf8' });
  const tot = [];
  for (const z of bericht.split('\n')) {
    const m = z.match(/^\s*(\d+)\s+(\d+) Z\.\s+(\S+)$/);
    if (m) tot.push({ zeile: +m[1], zahl: +m[2], name: m[3] });
  }
  if (!tot.length) break;
  runden++;
  const zeilen = readFileSync(DATEI, 'utf8').split('\n');
  // Von hinten schneiden, damit die Zeilennummern davor gueltig bleiben.
  for (const t of tot.sort((a, b) => b.zeile - a.zeile)) {
    console.log('  − ' + t.name + '  (' + t.zahl + ' Zeilen, ab ' + t.zeile + ')');
    zeilen.splice(t.zeile - 1, t.zahl);
    gesamt += t.zahl;
  }
  if (!ECHT) { console.log('\n(nur gezeigt - "node scripts/schneide.mjs tu" schneidet wirklich)'); break; }
  writeFileSync(DATEI, zeilen.join('\n'));
  if (runden > 40) { console.log('zu viele Runden - etwas stimmt nicht'); break; }
}
console.log('\n' + gesamt + ' Zeilen in ' + runden + ' Runden' + (ECHT ? ' geschnitten.' : ' zu schneiden.'));
