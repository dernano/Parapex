/*
 * DIE LASTPROBE.
 *
 * Wie teuer ist ein Bild wirklich? `blick.mjs` rechnet die Zeit ohne zu
 * zeichnen weiter, damit eine Aufnahme nicht eine Sekunde dauert — seine
 * Bildraten sagen deshalb nichts. Hier wird jedes Bild GEZEICHNET und gemessen.
 *
 * Gemessen wird in SwiftShader, also ohne Grafikkarte. Das ist absichtlich der
 * ungünstigste Fall: was hier durchkommt, kommt überall durch.
 *
 *   node scripts/last.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(WURZEL, 'dist');

const FAELLE = [
  { name: 'Ruhe', bench: { volleys: 1, formation: true }, feuern: false, bilder: 120 },
  { name: 'Salve (Stufe A)', bench: { volleys: 3 }, feuern: true, bilder: 120 },
  { name: 'Sperrfeuer (Stufe C)', bench: { volleys: 30 }, feuern: true, bilder: 150 },
  { name: 'Bombardement (Stufe D)', bench: { volleys: 100 }, feuern: true, bilder: 150 },
  { name: 'Vernichtung (Stufe E)', bench: { volleys: 1000 }, feuern: true, bilder: 180 },
  { name: 'Vernichtung, eine Million', bench: { volleys: 1_000_000 }, feuern: true, bilder: 220 },
];

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

const zahl = v => v.toFixed(1).replace('.', ',');

async function main() {
  if (!existsSync(join(DIST, 'visual-test', 'index.html'))) {
    console.error('dist/visual-test fehlt — erst `npm run build`.');
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
  const seite = await browser.newPage({ viewport: { width: 1320, height: 800 } });
  await seite.goto(`http://127.0.0.1:${port}/visual-test/`, { waitUntil: 'networkidle' });
  await seite.waitForFunction(() => Boolean(window.WERKBANK), null, { timeout: 15000 });

  console.log('Fall                          Bilder   B/s   p95     max    Sprites  Partikel');
  let ueber = 0;
  for (const fall of FAELLE) {
    const bericht = await seite.evaluate(f => {
      window.WERKBANK.apply(f.bench);
      if (f.feuern) window.WERKBANK.fire();
      return window.WERKBANK.measure(f.bilder);
    }, fall);
    console.log(
      `${fall.name.padEnd(28)} ${String(bericht.frames).padStart(4)}`
      + `  ${String(Math.round(bericht.fps)).padStart(4)}`
      + `  ${zahl(bericht.p95Ms).padStart(6)}`
      + `  ${zahl(bericht.worstMs).padStart(6)}`
      + `  ${String(bericht.peakSprites).padStart(7)}`
      + `  ${String(bericht.peakParticles).padStart(8)}`
      + `  ${bericht.withinBudget ? '' : 'ÜBER BUDGET'}`);
    if (!bericht.withinBudget) ueber++;
  }

  await browser.close();
  server.close();
  console.log(ueber ? `\n${ueber} Fall/Fälle über Budget.` : '\nAlle Fälle im Budget.');
}

main().catch(e => { console.error(e); process.exit(1); });
