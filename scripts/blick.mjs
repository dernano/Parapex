/*
 * DER BLICK — reproduzierbare Aufnahmen des Sichtprüfstands.
 *
 * Zwölf benannte Zustände, jeder mit festem Ausgangswert und fester
 * Zeitmarke. Das ist die ganze Idee: "sieht anders aus als gestern" ist keine
 * Fehlermeldung, "in `kanone` haben sich 4,2 % der Bildpunkte geändert" schon.
 *
 * Die Seite rechnet die Zeit dabei SELBST weiter (`WERKBANK.settle`), in festen
 * Schritten und ohne Bildschirmtakt. Eine Aufnahme "ungefähr eine Sekunde nach
 * dem Schuss" wäre nicht reproduzierbar; eine nach genau 84 Schritten ist es.
 *
 *   node scripts/blick.mjs            # alle Sätze, nach docs/blick/
 *   node scripts/blick.mjs groesse    # nur die Größenprobe
 *   node scripts/blick.mjs --grundlage  # die Aufnahmen als Grundlage sichern
 */
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(WURZEL, 'dist');
const ZIEL = join(WURZEL, 'docs', 'blick');
const GRUNDLAGE = join(ZIEL, 'grundlage');

/* ---------- Die benannten Zustände ---------- */

const EFFEKTE_AUS = {
  smoke: false, dust: false, flash: false, debris: false, sparks: false,
  shake: false, floatingText: false, shotShadows: false,
};

/**
 * Jeder Zustand: was eingestellt wird, ob geschossen wird, und WANN das Bild
 * entsteht. Die Zeitmarken sind gewählt, nicht geraten — bei `kanone` liegt sie
 * kurz nach dem Abschuss, weil dann das Mündungsfeuer steht.
 */
const SAETZE = {
  haupt: [
    { name: 'ruhe', bench: { volleys: 1, formation: true, crests: 'none' },
      feuern: false, zeit: 0.4,
      frage: 'Steht die Burg? Sitzt die Besatzung auf den Plattformen?' },

    { name: 'bogen', bench: { family: 'bow', rank: 11, volleys: 1 },
      feuern: true, zeit: 0.30,
      frage: 'Fliegt der Pfeil, und verlässt er die Sehne statt den Bauch?' },

    { name: 'armbrust', bench: { family: 'crossbow', rank: 9, volleys: 1 },
      feuern: true, zeit: 0.34,
      frage: 'Liest sich der Bolzen flach und schnell?' },

    { name: 'artillerie', bench: { family: 'artillery', rank: 12, volleys: 1 },
      feuern: true, zeit: 0.95,
      frage: 'Steht der Stein im Scheitel seiner Bahn, mit Schatten darunter?' },

    { name: 'kanone', bench: { family: 'gunner', rank: 13, volleys: 1 },
      feuern: true, zeit: 0.33,
      frage: 'Sitzt das Mündungsfeuer am Rohr — und sieht es teuer aus?' },

    { name: 'salve-drei', bench: { family: 'gunner', rank: 13, volleys: 3 },
      feuern: true, zeit: 0.7,
      frage: 'Drei lesbare Ereignisse, nicht ein Brei.' },

    { name: 'sperrfeuer', bench: { family: 'gunner', rank: 13, volleys: 30 },
      feuern: true, zeit: 1.1,
      frage: 'Stufe C: zwei Türme zugleich, Rauch bleibt stehen.' },

    { name: 'bombardement', bench: { family: 'gunner', rank: 13, volleys: 100 },
      feuern: true, zeit: 1.3,
      frage: 'Stufe D: drei Türme, Wetter statt Ereignis.' },

    { name: 'vernichtung', bench: { family: 'gunner', rank: 13, volleys: 1000 },
      feuern: true, zeit: 1.5,
      frage: 'Stufe E: fünf Türme, und trotzdem unter drei Sekunden.' },

    { name: 'formation', bench: { formation: true, volleys: 1, crests: 'none' },
      feuern: false, zeit: 1.2,
      frage: 'Geschlossene Front auf der Mauer, ohne Fenster.' },

    { name: 'wappenkette', bench: { crests: 'chain', volleys: 1 },
      feuern: false, zeit: 0.6,
      frage: 'Fünf Fächer, eine Richtung — und die Kette steht im Messfeld.' },

    { name: 'pulver-tot', bench: { crests: 'powderDead', powder: 10, volleys: 1 },
      feuern: false, zeit: 0.6,
      frage: 'Die Warnung erscheint, wörtlich.' },
  ],

  /*
   * Die Größenprobe. Vier Aufnahmen, IM ECHTEN KAMPFBILDSCHIRM: gleiche Burg,
   * gleicher Feind, gleiche Kamera, gleiche Kachelgröße. Nur die Einheiten
   * ändern sich. Auf weißem Grund nebeneinander wäre die Frage leichter zu
   * beantworten und die Antwort wertlos.
   */
  groesse: [100, 115, 125, 135].map(prozent => ({
    name: `groesse-${prozent}`,
    bench: {
      family: 'gunner', rank: 13, volleys: 1, formation: true,
      settings: { unitScale: prozent / 100 },
    },
    feuern: false, zeit: 0.4,
    frage: `Einheiten auf ${prozent} %: lesbar, ohne die Burg zu erdrücken?`,
  })),

  diagnose: [
    { name: 'diagnose-sockel',
      bench: {
        family: 'gunner', rank: 13, volleys: 1, formation: true,
        settings: {
          effects: EFFEKTE_AUS,
          debug: {
            anchors: true, sockets: true, worldVectors: true, layers: false,
            bounds: true, fps: true, spriteCount: true, queue: true, missingArt: true,
          },
        },
      },
      feuern: false, zeit: 0.4,
      frage: 'Liegt jeder Anker auf der Plattform, jeder Sockel auf der Waffe?' },

    { name: 'diagnose-ebenen',
      bench: {
        family: 'gunner', rank: 13, volleys: 1, formation: true,
        settings: {
          debug: {
            anchors: false, sockets: false, worldVectors: false, layers: true,
            bounds: false, fps: true, spriteCount: true, queue: false, missingArt: true,
          },
        },
      },
      feuern: false, zeit: 0.4,
      frage: 'Liegt nichts in der falschen Ebene?' },
  ],
};

/* ---------- Ein winziger Dateiserver ---------- */

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function starteServer(wurzel) {
  return new Promise(fertig => {
    const server = createServer(async (anfrage, antwort) => {
      let pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
      if (pfad.endsWith('/')) pfad += 'index.html';
      const datei = join(wurzel, pfad);
      if (!datei.startsWith(wurzel)) { antwort.writeHead(403).end(); return; }
      try {
        const inhalt = await readFile(datei);
        antwort.writeHead(200, { 'content-type': TYPEN[extname(datei)] ?? 'application/octet-stream' });
        antwort.end(inhalt);
      } catch {
        antwort.writeHead(404).end('nicht da');
      }
    });
    server.listen(0, '127.0.0.1', () => fertig({ server, port: server.address().port }));
  });
}

/* ---------- Der Browser ---------- */

async function ladeChromium() {
  const orte = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs',
    '/usr/lib/node_modules/playwright/index.mjs'];
  for (const ort of orte) {
    try { return (await import(ort)).chromium; } catch { /* nächster */ }
  }
  return null;
}

async function main() {
  const argumente = process.argv.slice(2);
  const alsGrundlage = argumente.includes('--grundlage');
  const gewaehlt = argumente.filter(a => !a.startsWith('--'));
  const saetze = gewaehlt.length ? gewaehlt : Object.keys(SAETZE);

  if (!existsSync(join(DIST, 'visual-test', 'index.html'))) {
    console.error('dist/visual-test fehlt — erst `npm run build`.');
    process.exit(2);
  }
  const chromium = await ladeChromium();
  if (!chromium) {
    console.error('Playwright fehlt — ohne Browser keine Aufnahmen.');
    process.exit(2);
  }

  await mkdir(ZIEL, { recursive: true });
  const { server, port } = await starteServer(DIST);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PFAD
      || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-lcd-text', '--force-device-scale-factor=1'],
  });

  const seite = await browser.newPage({ viewport: { width: 1320, height: 800 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push(String(e)));
  seite.on('console', m => {
    if (m.type() !== 'error') return;
    const ort = m.location()?.url ?? '';
    if (ort.endsWith('favicon.ico')) return;
    fehler.push(m.text());
  });
  // Das Sinnbild in der Adresszeile ist nichts, worüber ein Prüflauf stolpern
  // soll — es steht in keiner Aufnahme.
  seite.on('requestfailed', r => {
    if (!r.url().endsWith('favicon.ico')) fehler.push(`${r.url()} ${r.failure()?.errorText}`);
  });
  seite.on('response', r => {
    if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) {
      fehler.push(`${r.status()} ${r.url()}`);
    }
  });

  await seite.goto(`http://127.0.0.1:${port}/visual-test/`, { waitUntil: 'networkidle' });
  await seite.waitForFunction(() => Boolean(window.WERKBANK), null, { timeout: 15000 });

  const bericht = [];
  for (const satz of saetze) {
    const zustaende = SAETZE[satz];
    if (!zustaende) { console.error(`Unbekannter Satz: ${satz}`); continue; }
    for (const zustand of zustaende) {
      await seite.evaluate(z => {
        window.WERKBANK.apply(z.bench);
        if (z.feuern) window.WERKBANK.fire();
        window.WERKBANK.settle(z.zeit);
      }, zustand);

      const rahmen = await seite.$('#shell');
      const datei = join(ZIEL, `${zustand.name}.png`);
      await rahmen.screenshot({ path: datei });
      const messung = await seite.evaluate(() => window.WERKBANK.report());
      bericht.push({ name: zustand.name, frage: zustand.frage, ...messung });
      console.log(`  ${zustand.name.padEnd(18)} ${messung.sprites} Sprites`
        + `  ${Math.round(messung.perf.fps)} B/s`);
      if (alsGrundlage) {
        await mkdir(GRUNDLAGE, { recursive: true });
        await copyFile(datei, join(GRUNDLAGE, `${zustand.name}.png`));
      }
    }
  }

  await browser.close();
  server.close();

  if (fehler.length) {
    console.error('\nFehler auf der Seite:');
    for (const f of new Set(fehler)) console.error(`  ${f}`);
    process.exit(1);
  }

  const fehlend = new Set(bericht.flatMap(b => b.missing ?? []));
  console.log(`\n${bericht.length} Aufnahmen in docs/blick/`);
  console.log(`${fehlend.size} Grafikplätze ohne Quellkunst.`);
  if (alsGrundlage) console.log('Als Grundlage gesichert.');
  else if (existsSync(GRUNDLAGE)) {
    const alt = await readdir(GRUNDLAGE);
    console.log(`Grundlage vorhanden (${alt.length} Bilder)`
      + ' — Vergleich: python3 scripts/art/vergleich.py');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
