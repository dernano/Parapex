/*
 * Ein ganzer Lauf durch die Oberflaeche: klicken, was da ist, bis der Akt
 * vorbei ist. Das faengt genau die Fehler, die der Kern nicht sehen kann -
 * ein Knopf, der nirgends hinfuehrt, eine Tafel, die nicht aufgeht.
 */
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fehler = [];
p.on('pageerror', e => fehler.push('' + (e.stack || e)));
await p.goto('file:///home/user/parapex/index.html');
await p.waitForTimeout(1800);

const lauf = () => p.evaluate(() => {
  const l = window.PARAPEX.lauf();
  const k = window.PARAPEX.kampf();
  return { station: l.station, art: window.PARAPEX.derKnoten() && window.PARAPEX.derKnoten().art,
    sold: l.sold, deck: l.deck.length, wappen: l.wappen.length, ende: l.ende,
    tuerme: l.turmTypen.join(','), hp: k ? k.feind.hp : null };
});

const knopf = async (sel) => { const e = await p.$(sel); if (e) { await e.click(); await p.waitForTimeout(120); return true; } return false; };

for (let schritt = 0; schritt < 400; schritt++) {
  const z = await lauf();
  if (z.ende && await p.$('#pk-neu')) { console.log('LAUFENDE', JSON.stringify(z)); break; }

  // Eine Tafel offen? Dann dort handeln.
  if (await p.$('.pk-tafel')) {
    if (await knopf('.pk-tafel .pk-angebot:not(.aus)')) continue;   // Belohnung / Kauf
    if (await knopf('.pk-tafel .pk-wahl')) continue;                // Begegnung
    if (await knopf('#pk-weiter')) continue;
    if (await knopf('#pk-zurueck')) continue;
    if (await knopf('#pk-nichts')) continue;
    console.log('TAFEL OHNE AUSWEG bei', JSON.stringify(z));
    console.log(await p.$eval('.pk-tafel', e => e.innerHTML.slice(0, 400)));
    break;
  }

  /*
   * Sonst: Kampf. Gespielt wird ueber die Oberflaeche - Karte anklicken, Turm
   * anklicken - aber ueberlegt wird im Kern: welche Karte auf welchen Turm die
   * Salve am staerksten hebt. Ein zufaellig klickender Bot verliert an Station
   * zwei und sieht Haendler, Begegnung und Belohnung nie.
   */
  for (let zug = 0; zug < 8; zug++) {
    const beste = await p.evaluate(() => {
      const P = window.PARAPEX, k = P.kampf();
      if (!k || k.ende) return null;
      const jetzt = P.berechneWucht(k.tuerme, k.wappen).wucht;
      let be = null;
      for (let h = 0; h < k.hand.length; h++) for (let i = 0; i < k.tuerme.length; i++) {
        const kosten = k.tuerme[i].einheit ? P.KERN.kosten.ersetzen : P.KERN.kosten.einsetzen;
        if (kosten > k.tatendrang) continue;
        const g = (P.vorschau(i, k.hand[h]).wucht - jetzt) / kosten;
        if (!be || g > be.g) be = { h, i, g };
      }
      return be && be.g > 0 ? be : null;
    });
    if (!beste) break;
    const karten = await p.$$('.pk-hand .pk-karte');
    if (!karten[beste.h]) break;
    await karten[beste.h].click();
    const t = await p.$$('.pk-turm');
    await t[beste.i].click();
    await p.waitForTimeout(20);
  }
  await knopf('#pk-ende');
  await p.waitForTimeout(250);
}

const z = await lauf();
console.log('ZUSTAND', JSON.stringify(z));
await p.screenshot({ path: '/tmp/claude-0/x/lauf.png' });
if (fehler.length) { console.log('SEITENFEHLER:'); fehler.forEach(f => console.log(f)); }
console.log(fehler.length ? 'FEHLER: ' + fehler.length : 'ohne Seitenfehler');
await browser.close();
process.exit(fehler.length ? 1 : 0);
