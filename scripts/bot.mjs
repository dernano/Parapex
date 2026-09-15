/*
 * Der Feldzugbot.
 *
 * Er spielt nicht gut, er spielt VERNUENFTIG: in jeder Runde setzt er so
 * lange die Karte auf den Turm, der die Salve am staerksten hebt, bis der
 * Tatendrang alle ist. Genau das tut ein Spieler, der die Vorschau liest und
 * sonst nichts weiter denkt - und damit ist er der richtige Massstab.
 *
 * Er laeuft im Kern, nicht in der Oberflaeche: keine Klicks, kein Zeichnen,
 * hundert Laeufe in Sekunden.
 *
 *   node scripts/bot.mjs [laeufe] [strategie]
 *
 * Ausgegeben wird, wie weit er kommt. Das ist die einzige Zahl, an der sich
 * Balance messen laesst - alles andere ist Meinung.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const orte = ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs',
  '/usr/lib/node_modules/playwright/index.mjs'];
let chromium = null;
for (const ort of orte) { try { ({ chromium } = await import(ort)); break; } catch (e) { /* naechster */ } }
if (!chromium) { console.error('Playwright fehlt.'); process.exit(2); }

const LAEUFE = Number(process.argv[2]) || 40;
const STRATEGIE = process.argv[3] || 'gemischt';

const pfad = process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(pfad) ? { executablePath: pfad } : {});
const seite = await browser.newPage();
await seite.goto('file://' + join(WURZEL, 'index.html'), { waitUntil: 'load' });

const ergebnis = await seite.evaluate(({ LAEUFE, STRATEGIE }) => {
  const P = window.PARAPEX;

  /* Die beste Setzung, die der Tatendrang noch hergibt - oder nichts. */
  const besterZug = (k) => {
    const jetzt = P.berechneWucht(k.tuerme, k.wappen).wucht;
    let beste = null;
    for (const karte of k.hand) {
      for (let i = 0; i < k.tuerme.length; i++) {
        const kosten = k.tuerme[i].einheit ? P.KERN.kosten.ersetzen : P.KERN.kosten.einsetzen;
        if (kosten > k.tatendrang) continue;
        const w = P.vorschau(i, karte).wucht;
        const gewinn = (w - jetzt) / kosten;
        if (!beste || gewinn > beste.gewinn) beste = { karte, turm: i, gewinn, wucht: w };
      }
    }
    return beste && beste.gewinn > 0 ? beste : null;
  };

  const spieleKampf = (k) => {
    while (!k.ende) {
      let zug;
      while ((zug = besterZug(k))) P.setzeEinheit(zug.turm, zug.karte);
      P.beendeRunde();
    }
    return k.ende === 'sieg';
  };

  /*
   * Die Belohnung waehlen. Die Reihenfolge ist gemessen, nicht geraten:
   * Wappen vervielfachen und sind selten, Ausmustern hebt den Schnitt des
   * Decks staerker als eine weitere mittlere Karte, und eine Karte lohnt nur,
   * wenn sie besser ist als das, was ohnehin schon gezogen wird.
   */
  const waehleBelohnung = (angebote, l) => {
    const schnitt = l.deck.reduce((s, c) => s + P.grundwucht(c), 0) / l.deck.length;
    const w = angebote.find(a => a.art === 'wappen');
    if (w && STRATEGIE !== 'karten') return w;
    // Ausmustern nimmt jetzt einen Schub. Es lohnt, solange die Karten, die
    // gehen, deutlich unter dem Schnitt liegen - und das Deck es vertraegt.
    const weg = angebote.find(a => a.art === 'entfernen');
    if (weg && weg.karten.length) {
      const wegSchnitt = weg.karten.reduce((s, c) => s + P.grundwucht(c), 0) / weg.karten.length;
      if (wegSchnitt < schnitt * 0.8 && l.deck.length > P.KERN.handGroesse + weg.karten.length) return weg;
    }
    const karten = angebote.filter(a => a.art === 'karte')
      .sort((a, b) => P.grundwucht(b.einheit) - P.grundwucht(a.einheit));
    if (karten.length && P.grundwucht(karten[0].einheit) > schnitt) return karten[0];
    return angebote.find(a => a.art === 'ausbau') || weg || karten[0] || angebote[0];
  };

  const laeufe = [];
  for (let n = 0; n < LAEUFE; n++) {
    const l = P.neuerLauf();
    const proStation = [];
    let schutz = 0;
    while (!l.ende && schutz++ < 300) {
      const b = P.dieBelagerung;
      if (!b || b.abschnitt === 'vorbei') {
        const r = P.naechsteAnte();
        if (r && r.ende) break;
        continue;
      }
      const wahlen = P.offeneWahlen();
      if (!wahlen.length) break;

      if (b.abschnitt === 'lager') {
        /*
         * Im Lager: was der Haendler hat, wird gekauft; die anderen Dienste
         * nimmt der Bot in der Reihenfolge, in der sie liegen. Er handelt
         * nicht klug, er handelt GLEICH - nur so misst der Lauf die Balance
         * und nicht die Laune des Bots.
         */
        P.oeffneLager(b.kaempfe);
        for (const dienst of P.dasLager.dienste) {
          const posten = P.lagerAngebote(dienst).filter(p => !p.zuTeuer);
          if (!posten.length) continue;
          if (posten[0].art === 'haendlerOeffnen') { kaufeBeimHaendler(l); continue; }
          P.nimmLagerangebot(dienst, posten[0]);
        }
        P.waehle(wahlen[0]);
        continue;
      }

      /*
       * STRATEGIE `durchlassen`: alles ziehen lassen, was geht - das misst
       * den schwersten Heerfuehrer. Sonst wird gestellt.
       */
      const durch = wahlen.find(w => w.art === 'durchlassen' && !w.gesperrt);
      const wahl = (STRATEGIE === 'durchlassen' && durch) ? durch : wahlen.find(w => w.kampf);
      const erg = P.waehle(wahl);
      if (!erg.ok) break;
      if (!erg.kampf) continue;

      const k = P.beginneSchlacht(erg.kampf);
      const sieg = spieleKampf(k);
      proStation.push({ nr: l.schlachten + 1, art: wahl.ziel, sieg, runden: k.runde,
        rest: Math.round(100 * k.feind.hp / k.feind.maxHp) });
      const r = P.werteKampfAus(k, wahl.ziel);
      if (r.sieg) P.nimmAngebot(waehleBelohnung(r.belohnung.angebote, l));
      P.meldeAusgang(sieg);
    }
    laeufe.push({ ende: l.ende, weit: l.schlachten, deck: l.deck.length,
      wappen: l.wappen.length, sold: l.sold, stationen: proStation });
  }

  function kaufeBeimHaendler(l) {
    const h = P.oeffneHaendler();
    h.posten.forEach((posten, i) => {
      if (l.sold < posten.preis) return;
      const schwach = l.deck.slice().sort((a, b) => P.grundwucht(a) - P.grundwucht(b))[0];
      P.kaufe(i, schwach);
    });
  }

  return laeufe;
}, { LAEUFE, STRATEGIE });

await browser.close();

const siege = ergebnis.filter(l => l.ende === 'sieg').length;
const weit = ergebnis.map(l => l.weit).sort((a, b) => a - b);
const mittel = (a) => a.reduce((s, x) => s + x, 0) / a.length;

console.log('Strategie: ' + STRATEGIE + ' · ' + LAEUFE + ' Läufe');
console.log('Akt geschafft: ' + siege + '/' + LAEUFE + ' (' + Math.round(100 * siege / LAEUFE) + ' %)');
console.log('Weit gekommen: im Mittel Station ' + mittel(weit).toFixed(1) +
  ', Mitte ' + weit[Math.floor(weit.length / 2)] + ', schlechtester ' + weit[0] + ', bester ' + weit[weit.length - 1]);

// Wo es scheitert, Station fuer Station.
const proNr = {};
for (const l of ergebnis) for (const s of l.stationen) {
  const e = proNr[s.nr] || (proNr[s.nr] = { art: s.art, n: 0, siege: 0, runden: [], rest: [] });
  e.n++; if (s.sieg) { e.siege++; e.runden.push(s.runden); } else e.rest.push(s.rest);
}
console.log('\nStation   Art        gespielt  gewonnen  Runden  Rest bei Niederlage');
for (const nr of Object.keys(proNr).sort((a, b) => a - b)) {
  const e = proNr[nr];
  console.log(('  ' + nr).slice(-3) + '     ' + e.art.padEnd(10) +
    String(e.n).padStart(6) + String(e.siege).padStart(10) +
    (e.runden.length ? mittel(e.runden).toFixed(1) : '  —').padStart(8) +
    (e.rest.length ? mittel(e.rest).toFixed(0) + ' %' : '  —').padStart(10));
}
