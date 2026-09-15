/*
 * Die Wuchtkurve.
 *
 * Wie viel Wucht bringt ein vernuenftig gespieltes Deck am n-ten Kampf ueber
 * fuenf Runden zusammen? Ohne diese Zahl ist jede Gegnertabelle geraten. Der
 * Bot spielt dafuer gegen einen Gegner, der nicht faellt, und wir zaehlen mit.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let chromium = null;
for (const ort of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'])
  { try { ({ chromium } = await import(ort)); break; } catch (e) {} }
const pfad = process.env.CHROMIUM_PFAD || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(pfad) ? { executablePath: pfad } : {});
const seite = await browser.newPage();
await seite.goto('file://' + join(WURZEL, 'index.html'), { waitUntil: 'load' });

const LAEUFE = Number(process.argv[2]) || 40;
const daten = await seite.evaluate(({ LAEUFE }) => {
  const P = window.PARAPEX;
  const besterZug = (k) => {
    const jetzt = P.berechneWucht(k.tuerme, k.wappen).wucht;
    let beste = null;
    for (const karte of k.hand) for (let i = 0; i < k.tuerme.length; i++) {
      const kosten = k.tuerme[i].einheit ? P.KERN.kosten.ersetzen : P.KERN.kosten.einsetzen;
      if (kosten > k.tatendrang) continue;
      const g = (P.vorschau(i, karte).wucht - jetzt) / kosten;
      if (!beste || g > beste.gewinn) beste = { karte, turm: i, gewinn: g };
    }
    return beste && beste.gewinn > 0 ? beste : null;
  };
  const STRATEGIE = 'gemischt';
  /*
   * Die Belohnung waehlen. Die Reihenfolge ist gemessen, nicht geraten:
   * Wappen vervielfachen und sind selten, Ausmustern hebt den Schnitt des
   * Decks staerker als eine weitere mittlere Karte, und eine Karte lohnt nur,
   * wenn sie besser ist als das, was ohnehin schon gezogen wird.
   */
  const waehle = (angebote, l) => {
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


  const proKampf = [];
  for (let n = 0; n < LAEUFE; n++) {
    const l = P.neuerLauf();
    let nr = 0;
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
        P.oeffneLager(b.kaempfe);
        for (const dienst of P.dasLager.dienste) {
          const posten = P.lagerAngebote(dienst).filter(x => !x.zuTeuer);
          if (!posten.length) continue;
          if (posten[0].art === 'haendlerOeffnen') {
            const h = P.oeffneHaendler();
            h.posten.forEach((x, i) => {
              if (l.sold >= x.preis) P.kaufe(i, l.deck.slice().sort((a2, b2) => P.grundwucht(a2) - P.grundwucht(b2))[0]);
            });
            continue;
          }
          P.nimmLagerangebot(dienst, posten[0]);
        }
        P.waehle(wahlen[0]);
        continue;
      }
      // Immer stellen: gemessen wird die Wucht je Schlacht, nicht die Taktik.
      const wahl = wahlen.find(w => w.kampf);
      const erg = P.waehle(wahl);
      if (!erg.ok || !erg.kampf) break;
      const k = P.beginneSchlacht(erg.kampf);
      k.feind.hp = 1e12; k.feind.maxHp = 1e12;       // faellt nicht um
      const vorher = k.feind.hp;
      while (!k.ende) { let z; while ((z = besterZug(k))) P.setzeEinheit(z.turm, z.karte); P.beendeRunde(); }
      nr++;
      (proKampf[nr] || (proKampf[nr] = [])).push(vorher - k.feind.hp);
      k.ende = 'sieg'; k.feind.hp = 0;               // wir zaehlen nur, wir spielen nicht
      const r = P.werteKampfAus(k, wahl.ziel);
      if (r.belohnung) P.nimmAngebot(waehle(r.belohnung.angebote, l));
      P.meldeAusgang(true);
    }
  }
  return proKampf;
}, { LAEUFE });
await browser.close();

const tabelle = await seite.evaluate?.(() => null).catch?.(() => null);
const mittel = a => a.reduce((s, x) => s + x, 0) / a.length;
const sort = a => a.slice().sort((x, y) => x - y);
console.log('Wucht über fünf Runden, ' + LAEUFE + ' Läufe\n');
console.log('Kampf   unteres Viertel      Mitte     oberes Viertel');
for (let i = 1; i < daten.length; i++) {
  const s = sort(daten[i]);
  const q = (t) => Math.round(s[Math.floor(t * (s.length - 1))]).toLocaleString('de-DE');
  console.log(('  ' + i).slice(-3) + '  ' + q(0.25).padStart(16) + q(0.5).padStart(14) + q(0.75).padStart(16));
}
