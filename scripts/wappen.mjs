/*
 * Was ist ein Wappen wert?
 *
 * Gemessen wird gegen die Frage, die beim Spielen zaehlt: um wie viel steigt
 * die Wucht einer typischen Aufstellung, wenn dieses Wappen dabei ist? Ein
 * Wappen, das die Wucht nicht anfasst, ist deshalb nicht wertlos - Schlange
 * und Eber wirken woanders -, aber es muss dann anderswo tragen.
 *
 * Verglichen wird ueber viele zufaellige Aufstellungen aus hohen Raengen, also
 * das, was gegen Ende eines Akts auf den Tuermen steht.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let chromium = null;
for (const o of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'])
  { try { ({ chromium } = await import(o)); break; } catch (e) { /* naechster */ } }
const pfad = process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(pfad) ? { executablePath: pfad } : {});
const seite = await browser.newPage();
await seite.goto('file://' + join(WURZEL, 'index.html'), { waitUntil: 'load' });

const PROBEN = Number(process.argv[2]) || 3000;
const daten = await seite.evaluate(({ PROBEN }) => {
  const P = window.PARAPEX;
  const zufall = (n) => Math.floor(Math.random() * n);
  const gattungen = P.GATTUNG_LISTE;

  /* Eine Aufstellung, wie sie spaet im Akt aussieht: hohe Raenge, gemischt. */
  const stellung = () => Array.from({ length: P.KERN.tuerme }, (_, i) => ({
    nr: i + 1, typ: 'wachturm',
    einheit: P.neueEinheit(gattungen[zufall(4)] + '-' + (6 + zufall(8))),
  }));

  const raus = {};
  for (const id of P.WAPPEN_LISTE) raus[id] = { summe: 0, n: 0, hoechstens: 1 };
  for (let i = 0; i < PROBEN; i++) {
    const s = stellung();
    const ohne = P.berechneWucht(s, []).wucht;
    if (!ohne) continue;
    for (const id of P.WAPPEN_LISTE) {
      const mit = P.berechneWucht(s.map(t => ({ ...t })), [id]).wucht;
      const v = mit / ohne;
      raus[id].summe += v;
      raus[id].n++;
      if (v > raus[id].hoechstens) raus[id].hoechstens = v;
    }
  }
  /* Der Wolf will leere Tuerme - er wird auf seiner eigenen Buehne gemessen. */
  let wolfBest = 0, wolfN = 0;
  for (let i = 0; i < PROBEN; i++) {
    const s = stellung();
    const voll = P.berechneWucht(s.map(t => ({ ...t })), []).wucht;
    if (!voll) continue;
    for (let leer = 1; leer <= 2; leer++) {
      const p = s.map((t, k) => ({ ...t, einheit: k < leer ? null : t.einheit }));
      wolfBest = Math.max(wolfBest, P.berechneWucht(p, ['wolf']).wucht / voll);
    }
    wolfN++;
  }
  return { raus, wolfBest, namen: Object.fromEntries(P.WAPPEN_LISTE.map(id => [id, P.WAPPEN[id].name])) };
}, { PROBEN });
await browser.close();

console.log('Wert eines Wappens auf einer vollen Burg, ' + PROBEN + ' Aufstellungen\n');
console.log('Wappen                        im Mittel     im besten Fall');
const zeilen = Object.entries(daten.raus)
  .map(([id, e]) => ({ id, name: daten.namen[id], m: e.summe / e.n, h: e.hoechstens }))
  .sort((a, b) => b.m - a.m);
for (const z of zeilen) {
  console.log('  ' + z.name.padEnd(26) + ('×' + z.m.toFixed(2)).padStart(10) +
    ('×' + z.h.toFixed(2)).padStart(18));
}
console.log('\nWappen des Wolfs mit ein bis zwei leeren Türmen, bester Fall: ×' +
  daten.wolfBest.toFixed(2));
