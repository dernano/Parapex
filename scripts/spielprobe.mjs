/*
 * DIE SPIELPROBE.
 *
 * Nicht "baut die Seite", sondern: lässt sich eine RUNDE SPIELEN? Karten auf
 * Türme ziehen, Runde beenden, sehen was passiert — mit echten
 * Zeigerereignissen an den Stellen, an die ein Mensch zielen würde.
 *
 * Eine Oberfläche, die nur in Tests läuft, ist keine Oberfläche. Das hier ist
 * der einzige Prüfstein, der das Gegenteil zeigt.
 *
 *   node scripts/spielprobe.mjs
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(WURZEL, 'dist');
const ZIEL = join(WURZEL, 'docs', 'blick');

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

function starteServer(wurzel) {
  return new Promise(fertig => {
    const server = createServer(async (a, b) => {
      let pfad = decodeURIComponent(new URL(a.url, 'http://x').pathname);
      if (pfad.endsWith('/')) pfad += 'index.html';
      try {
        const inhalt = await readFile(join(wurzel, pfad));
        b.writeHead(200, { 'content-type': TYPEN[extname(pfad)] ?? 'application/octet-stream' });
        b.end(inhalt);
      } catch { b.writeHead(404).end(); }
    });
    server.listen(0, '127.0.0.1', () => fertig({ server, port: server.address().port }));
  });
}

async function ladeChromium() {
  for (const ort of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return (await import(ort)).chromium; } catch { /* nächster */ }
  }
  return null;
}

/** Warten, bis der Bildschirm nichts mehr abspielt. */
const ruhe = seite => seite.waitForFunction(
  () => !window.PARAPEX.screen.busy, null, { timeout: 15000 });

const zustand = seite => seite.evaluate(() => {
  const k = window.PARAPEX.screen.combat;
  return {
    runde: k.round, tatendrang: k.momentum, feind: Math.round(k.enemy.hp),
    besatzung: k.towers.map(t => t.unit?.id ?? null),
    hand: k.hand.length, ausgang: k.outcome, schrift: window.PARAPEX.screen.log,
  };
});

async function ziehe(seite, karte, turm) {
  const von = await seite.evaluate(i => {
    const el = document.querySelector(`.card[data-card="${i}"]`);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, karte);
  if (!von) return false;

  const nach = await seite.evaluate(i => {
    // Die Plattform, auf der der Soldat stehen wird — dorthin zielt ein Mensch.
    const canvas = document.getElementById('world');
    const b = canvas.getBoundingClientRect();
    const reihen = [1, 5, 9, 13, 17];
    const hoehen = { archerTower: 78, ballistaTower: 82, watchtower: 70,
      cannonTower: 88, powderTower: 96 };
    const typen = window.PARAPEX.screen.combat.towers.map(t => t.type);
    const col = 7.5, row = reihen[i] + 0.5;
    const x = (col - row) * 22 + 480;
    const y = (col + row) * 11 + 102 - hoehen[typen[i]];
    return { x: b.left + x * (b.width / 960), y: b.top + y * (b.height / 768) };
  }, turm);

  await seite.mouse.move(von.x, von.y);
  await seite.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await seite.mouse.move(von.x + (nach.x - von.x) * i / 8,
      von.y + (nach.y - von.y) * i / 8);
  }
  await seite.mouse.up();
  await ruhe(seite);
  return true;
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('dist fehlt — erst `npm run build`.');
    process.exit(2);
  }
  const chromium = await ladeChromium();
  if (!chromium) { console.error('Playwright fehlt.'); process.exit(2); }

  const { server, port } = await starteServer(DIST);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PFAD
      || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const seite = await browser.newPage({ viewport: { width: 1000, height: 820 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push(String(e)));
  seite.on('console', m => {
    if (m.type() !== 'error') return;
    if ((m.location()?.url ?? '').endsWith('favicon.ico')) return;
    fehler.push(m.text());
  });

  await seite.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await seite.waitForFunction(() => Boolean(window.PARAPEX), null, { timeout: 15000 });
  await ruhe(seite);

  const schritte = [];
  schritte.push(['Start', await zustand(seite)]);

  // Fünf Karten auf fünf Stellungen — so weit der Tatendrang reicht.
  for (let turm = 0; turm < 5; turm++) {
    const vorher = await zustand(seite);
    if (vorher.tatendrang <= 0) break;
    if (!await ziehe(seite, 0, turm)) break;
    schritte.push([`Karte auf Stellung ${turm + 1}`, await zustand(seite)]);
  }

  await mkdir(ZIEL, { recursive: true });
  await seite.locator('#shell').screenshot({ path: join(ZIEL, 'kampf-besetzt.png') });

  await seite.click('#end');
  await ruhe(seite);
  schritte.push(['Runde beendet', await zustand(seite)]);
  await seite.locator('#shell').screenshot({ path: join(ZIEL, 'kampf-nach-salve.png') });

  await browser.close();
  server.close();

  for (const [was, z] of schritte) {
    console.log(`${was.padEnd(24)} Runde ${z.runde} · Drang ${z.tatendrang}`
      + ` · Feind ${String(z.feind).padStart(6)} · Hand ${z.hand}`
      + ` · ${z.besatzung.filter(Boolean).length} besetzt`);
  }
  console.log(`\nLetzte Meldung: ${schritte[schritte.length - 1][1].schrift}`);

  const letzte = schritte[schritte.length - 1][1];
  const erste = schritte[0][1];
  const probleme = [];
  if (letzte.feind >= erste.feind) probleme.push('Der Feind hat keinen Schaden genommen.');
  if (letzte.runde <= erste.runde && !letzte.ausgang) {
    probleme.push('Die Runde ist nicht weitergegangen.');
  }
  if (fehler.length) probleme.push(...new Set(fehler));

  if (probleme.length) {
    console.error('\nProbleme:');
    for (const p of probleme) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('\nEine Runde gespielt, ohne Fehler.');
}

main().catch(e => { console.error(e); process.exit(1); });
