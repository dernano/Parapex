import { LAUF, angebotAusbau, angebotAusmustern, angebotKarte, angebotWappen, derLauf, entferneKarte, kampfNrJetzt, nimmAngebot, schleifeKarte } from './lauf.js';

// ---------- Der Händler ----------
/*
 * Der Händler ist der Ort, an dem Sold wieder zu Entscheidung wird. Sein
 * Bestand wird einmal gebaut und bleibt dann stehen - wer nicht kauft, soll
 * nicht neu würfeln dürfen, bis ihm etwas passt.
 */
export function oeffneHaendler() {
  if (!derLauf) return null;
  const nr = kampfNrJetzt();
  const posten = [];
  for (let i = 0; i < 3; i++) {
    const a = angebotKarte(nr);
    posten.push({ ...a, preis: Math.round(LAUF.preise.karte * (0.6 + a.einheit.rang / 10)) });
  }
  const w = angebotWappen();
  if (w) posten.push({ ...w, preis: LAUF.preise.wappen });
  const aus = angebotAusbau();
  if (aus) posten.push({ ...aus, preis: LAUF.preise.ausbau });
  const weg = angebotAusmustern(LAUF.ausmustern.haendler);
  if (weg) posten.push({ ...weg, name: 'Ausmustern', preis: LAUF.preise.entfernen });
  posten.push({ art: 'schliff', name: 'Eine Karte schleifen',
    text: '+' + LAUF.schliff + ' Wucht, dauerhaft.', preis: LAUF.preise.schliff });
  derLauf.haendler = { posten, gekauft: [] };
  return derLauf.haendler;
}

/*
 * Kaufen. `wahl` ist die Karte, auf die sich der Posten bezieht, wenn er eine
 * braucht - Ausmustern und Schleifen ohne Ziel wäre ein Kauf ins Leere.
 */
export function kaufe(index, wahl = null) {
  const h = derLauf && derLauf.haendler;
  if (!h) return { ok: false, grund: 'Kein Händler offen.' };
  const p = h.posten[index];
  if (!p) return { ok: false, grund: 'Diesen Posten gibt es nicht.' };
  if (h.gekauft.includes(index)) return { ok: false, grund: 'Schon gekauft.' };
  if (derLauf.sold < p.preis) return { ok: false, grund: 'Nicht genug Sold.' };

  let r;
  if (p.art === 'entfernen') r = entferneKarte(wahl && wahl.uid);
  else if (p.art === 'schliff') r = schleifeKarte(wahl && wahl.uid);
  else r = nimmAngebot(p);
  if (!r.ok) return r;

  derLauf.sold -= p.preis;
  h.gekauft.push(index);
  return { ok: true, posten: p, sold: derLauf.sold };
}
