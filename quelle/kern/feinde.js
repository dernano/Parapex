// ---------- Gegner ----------
/*
 * Ein Kampf hat EINEN Gegner mit einem Stärkewert. Dass auf dem Feld acht
 * Räuber stehen, ist Bild und nicht Mechanik: sie teilen sich den Wert, haben
 * keine eigenen Züge und kein eigenes Ziel. Damit fällt der lange Gegnerzug
 * weg, der die halbe Kampfzeit gefressen hat.
 *
 * `regeln` ist der Platz für Sonderregeln (Schildwall, Sturmtrupp, Nebelheer).
 * Sie sind noch nicht ausgeführt, aber der Gegner trägt sie schon, damit
 * Bosse später Entscheidungen erzeugen können statt nur mehr Stärke.
 */
/*
 * Die Staerke des n-ten KAMPFES - nicht der n-ten Station. Diese Zahlen sind
 * gemessen, nicht gesetzt: `scripts/kurve.mjs` laesst den Bot gegen einen
 * Gegner spielen, der nicht faellt, und zaehlt mit, wie viel Wucht ein
 * vernuenftig gespieltes Deck am n-ten Kampf ueber fuenf Runden zusammen-
 * bringt. Die Tabelle liegt darunter - anfangs bei knapp der Haelfte, zuletzt
 * bei drei Vierteln. Wer sie aendert, misst vorher nach.
 *
 * Mit dem vollen Blatt aus 52 Karten liegt die Wucht von Anfang an hoch und
 * steigt ueber den Akt kaum: gemessen 3270 im ersten Kampf und 3260 im
 * siebten. Der Grund steht in SPIELBESCHREIBUNG.md - die Rangachse ist ab
 * Kampf eins fast ausgereizt, und alles, was nur EINEN Turm vervielfacht,
 * verduennt sich auf ein Fuenftel und wird von den Formationen geschlagen.
 * Die Tabelle traegt deshalb den Spannungsbogen allein: von gut vierzig
 * Prozent der mittleren Wucht bis knapp darueber beim Belagerungsmeister.
 */
export const FEIND_STAERKE = [1300, 1600, 1900, 2100, 2350, 2600, 2850, 3100, 3400, 3700];
export const FEIND_BOSS_FAKTOR = 1.22;    // was der Belagerungsmeister auf seinen Platz drauflegt

export const FEIND_VORLAGEN = [
  { id: 'raeuber',   name: 'Räuberhorde',      figuren: 8, typ: 'spaeher' },
  { id: 'soeldner',  name: 'Söldnerzug',       figuren: 6, typ: 'armbrust' },
  { id: 'ritterzug', name: 'Ritterzug',        figuren: 5, typ: 'ritter' },
  { id: 'belagerer', name: 'Belagerungspark',  figuren: 4, typ: 'ritter' },
];

export function feindStaerke(kampfNr, boss) {
  const i = Math.max(1, Math.min(FEIND_STAERKE.length, kampfNr)) - 1;
  return Math.round(FEIND_STAERKE[i] * (boss ? FEIND_BOSS_FAKTOR : 1));
}

export function baueFeind(kampfNr, { boss = false, vorlage = null, zuschlag = 1 } = {}) {
  const v = vorlage
    ? FEIND_VORLAGEN.find(f => f.id === vorlage) || FEIND_VORLAGEN[0]
    : FEIND_VORLAGEN[Math.min(FEIND_VORLAGEN.length - 1, Math.floor((kampfNr - 1) / 2))];
  const hp = Math.round(feindStaerke(kampfNr, boss) * zuschlag);
  return { id: v.id, name: boss ? 'Belagerungsmeister' : v.name, figuren: v.figuren, typ: v.typ,
    hp, maxHp: hp, regeln: [] };
}
