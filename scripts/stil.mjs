/*
 * Welche Stilregeln greifen auf nichts mehr?
 *
 * Mit dem alten Kampf sind seine Bauteile gegangen - die Kopfleiste, die
 * Route, die Belohnungstafel. Ihre Regeln stehen noch im Stilblatt und
 * kosten nichts als Verwirrung beim Lesen.
 *
 * Gesucht wird nach Kennungen (#name) und Klassen (.name), die weder im HTML
 * noch im Skript vorkommen. Das ist eine Naeherung: was das Skript zur
 * Laufzeit zusammensetzt, sieht diese Pruefung nicht. Darum wird nach dem
 * Loeschen angesehen, nicht geglaubt.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const s = readFileSync(join(WURZEL, 'index.html'), 'utf8');
const stilA = s.indexOf('<style>'), stilB = s.indexOf('</style>');
const stil = s.slice(stilA + 7, stilB);
const rest = s.slice(0, stilA) + s.slice(stilB);

/* Alles, was irgendwo als Name auftaucht - im HTML, in Zeichenketten, im Code. */
const bekannt = new Set();
for (const m of rest.matchAll(/[\w-]+/g)) bekannt.add(m[0]);

/* Regeln grob zerlegen: Wahl { ... } */
const regeln = [];
let tiefe = 0, anfang = 0;
for (let i = 0; i < stil.length; i++) {
  if (stil[i] === '{') { if (tiefe === 0) regeln.push({ wahl: stil.slice(anfang, i), von: anfang, kopfBis: i }); tiefe++; }
  else if (stil[i] === '}') { tiefe--; if (tiefe === 0) { regeln[regeln.length - 1].bis = i + 1; anfang = i + 1; } }
}

const tot = [];
for (const r of regeln) {
  const wahl = r.wahl.trim();
  if (!wahl || wahl.startsWith('@') || wahl.startsWith(':root')) continue;
  const namen = [...wahl.matchAll(/[#.]([A-Za-z][\w-]*)/g)].map(m => m[1]);
  if (!namen.length) continue;
  // Tot ist eine Regel nur, wenn KEINER ihrer Namen irgendwo vorkommt.
  if (namen.some(n => bekannt.has(n))) continue;
  tot.push({ ...r, namen });
}

if (process.argv[2] === 'tu') {
  let neu = stil;
  for (const r of tot.sort((a, b) => b.von - a.von)) neu = neu.slice(0, r.von) + neu.slice(r.bis);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(WURZEL, 'index.html'), s.slice(0, stilA + 7) + neu + s.slice(stilB));
}
const zeilen = tot.reduce((n, r) => n + stil.slice(r.von, r.bis).split('\n').length, 0);
console.log(regeln.length + ' Regeln, ' + tot.length + ' greifen auf nichts (' + zeilen + ' Zeilen)' +
  (process.argv[2] === 'tu' ? ' - geschnitten.' : '.'));
for (const r of tot) console.log('  ' + r.wahl.trim().replace(/\s+/g, ' ').slice(0, 88));
