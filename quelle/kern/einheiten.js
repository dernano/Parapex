// ---------- Gattungen ----------
/*
 * Vier Gattungen, keine Kartenfarben. Sie sollen sich später mechanisch
 * unterscheiden, nicht nur farblich - die Formationen unten sind der Anfang
 * davon: Bogen zielt auf Wiederholung, Armbrust auf Wucht, Artillerie auf
 * Nachbarschaft, Kanonier auf Eskalation.
 */
export const GATTUNGEN = {
  bogen:      { id: 'bogen',      name: 'Bogenschützen',    kurz: 'Bogen',      farbe: '#4f7a3a', hell: '#86b05c', zeichen: '🏹' },
  armbrust:   { id: 'armbrust',   name: 'Armbrustschützen', kurz: 'Armbrust',   farbe: '#2f5fa8', hell: '#6d9ede', zeichen: '🎯' },
  artillerie: { id: 'artillerie', name: 'Artillerie',       kurz: 'Artillerie', farbe: '#8a6a2a', hell: '#c9a04a', zeichen: '⚙' },
  kanonier:   { id: 'kanonier',   name: 'Kanoniere',        kurz: 'Kanonier',   farbe: '#a0392a', hell: '#d96b42', zeichen: '💥' },
};
export const GATTUNG_LISTE = Object.keys(GATTUNGEN);

// ---------- Die Ränge ----------
/*
 * Dreizehn Ränge je Gattung, vom Bauernjungen bis zum Marschall. Der Rang IST
 * die Grundwucht (siehe `grundwucht`) - eine Zahl, die man auf der Karte
 * liest, statt einer zweiten, die man nachschlagen muss.
 */
export const RANG_NAMEN = {
  bogen: ['Bauernschütze', 'Jagdschütze', 'Burgschütze', 'Waldschütze', 'Langbogenschütze',
    'Grenzschütze', 'Veteranenschütze', 'Meisterschütze', 'Falkenschütze', 'Königlicher Schütze',
    'Schützenhauptmann', 'Meister des Langbogens', 'Marschall der Schützen'],
  armbrust: ['Bolzenschütze', 'Wacharmbruster', 'Fußarmbruster', 'Burgarmbruster', 'Spannknecht',
    'Schwerer Armbruster', 'Pavese-Schütze', 'Veteranenarmbruster', 'Arbalestschütze',
    'Meisterarmbruster', 'Scharfschütze', 'Hauptmann der Armbrust', 'Meister der Arbalest'],
  artillerie: ['Steinschleuderer', 'Geschützgehilfe', 'Seilspanner', 'Windenmeister',
    'Springald-Besatzung', 'Ballisten-Besatzung', 'Onager-Besatzung', 'Mangonel-Besatzung',
    'Petraria-Besatzung', 'Trebuchet-Besatzung', 'Meister der Balliste', 'Belagerungsingenieur',
    'Meister der Artillerie'],
  kanonier: ['Pulverjunge', 'Luntenknecht', 'Pulverträger', 'Büchsenknecht', 'Geschützlademeister',
    'Handrohrschütze', 'Feldschlange-Schütze', 'Bombardenknecht', 'Kanonier', 'Schwerer Kanonier',
    'Bombardenmeister', 'Geschützmeister', 'Meisterkanonier'],
};

/** Die 52 Grundkarten: vier Gattungen mal dreizehn Ränge. */
export function baueEinheitenPool() {
  const pool = [];
  for (const g of GATTUNG_LISTE) {
    RANG_NAMEN[g].forEach((name, i) => {
      const rang = i + 1;
      pool.push({
        id: g + '-' + rang,
        gattung: g,
        rang,
        name,
        grundwucht: rang,        // Rang ist Wucht. Steht so in der Spezifikation.
        wuchtBonus: 0,           // hebt ein Ausbau (siehe `verbessereEinheit`)
        stufe: 0,                // 0 = ungeschliffen, 1+ = verbessert
        schlagwort: null,        // später: eigene Regeln je Karte
        text: '',
      });
    });
  }
  return pool;
}
export const EINHEITEN_POOL = baueEinheitenPool();

/** Ein Abzug aus dem Pool, mit eigener Kennung - zwei gleiche Karten sind zwei. */
export let kernUid = 0;
export function neueEinheit(proto) {
  const p = typeof proto === 'string' ? EINHEITEN_POOL.find(k => k.id === proto) : proto;
  if (!p) return null;
  return { ...p, uid: 'k' + (++kernUid) };
}

/*
 * Die Wucht einer Einheit hat drei Namen, und der Unterschied zwischen ihnen
 * ist der haeufigste Anlass fuer Verwirrung:
 *
 *   grundwucht   was der Rang mitbringt        (Bogen 9 -> 9)
 *   wuchtBonus   was Schliffe dazugelegt haben (+4)
 *   wirkwucht    was tatsaechlich einschlaegt  (13)
 *
 * GERECHNET WIRD IMMER MIT DER WIRKWUCHT, an jeder Stelle, in jeder Salve.
 * Geprueft: ein geschliffener Bogen-9 schlaegt auf dem Turm mit 13 ein, und
 * der Schliff ueberlebt den Weg Deck - Kampf - Hand - Turm. Was fehlte, war
 * die Anzeige: auf der Karte stand nur die 9, und darum sah es aus, als ginge
 * der Schliff verloren. Deshalb heissen die Dinge jetzt, was sie sind.
 */
export function wirkwucht(karte) {
  if (!karte) return 0;
  return Math.max(0, karte.grundwucht + (karte.wuchtBonus || 0));
}
export const grundwucht = wirkwucht;        // alter Name, damit nichts bricht
export function bonusWucht(karte) { return (karte && karte.wuchtBonus) || 0; }

/** Verbessern hebt die Wucht, nicht den Rang: der Rang bleibt Formationssache. */
export function verbessereEinheit(karte, um = 2) {
  karte.stufe = (karte.stufe || 0) + 1;
  karte.wuchtBonus = (karte.wuchtBonus || 0) + um;
  return karte;
}

/*
 * Das Startdeck ist das ganze Blatt: alle 52 Karten, vier Gattungen mal
 * dreizehn Ränge.
 *
 * Das dreht die Richtung des Spiels um. Vorher wuchs ein Deck aus zwölf
 * mageren Karten nach oben; jetzt liegt alles von Anfang an da, und der Lauf
 * besteht darin, es zu VERSCHMÄLERN - die Bauernschützen auszumustern, damit
 * die Marschälle öfter kommen. Ein Deck aus 52 Karten zieht sieben davon, und
 * welche sieben das sind, entscheidet die Zusammensetzung.
 *
 * Damit ist Ausmustern kein Trostpreis mehr, sondern die schärfste Belohnung
 * im Spiel, und eine hinzugefügte Karte die schwächste. Die Preise und
 * Angebote in LAUF tragen dem Rechnung.
 */
export const START_DECK = EINHEITEN_POOL.map(k => k.id);
