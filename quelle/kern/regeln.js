/* ============================================================
 *  P A R A P E X  —  K E R N
 * ============================================================
 *
 * Der neue Kampf. Fünf Türme, fünf Runden, ein Gegner mit einem einzigen
 * Stärkewert. Karten sind Einheiten, Einheiten stehen auf Türmen, die
 * Stellung der Türme zueinander ergibt Formationen, Formationen vervielfachen
 * die Wucht.
 *
 * Dieser Block hat KEINE Verbindung zur Anzeige. Er kennt kein Dokument,
 * keinen Zeichenkontext und keine Ereignisse des Browsers - er rechnet nur.
 * Die Oberfläche liest hinterher `derKampf` und die Rückgabe von
 * `berechneWucht`. Das ist Absicht: nur so lässt sich der Kern von aussen
 * prüfen (siehe `scripts/pruefe.mjs`), und nur so kann die Anzeige später
 * ausgetauscht werden, ohne die Regeln anzufassen.
 *
 * Alles, was Balance ist, steht in KERN. Nichts davon gehört in den Code
 * darunter; wer eine Zahl sucht, soll sie an einer Stelle finden.
 */

export const KERN = {
  tuerme: 5,                  // so viele Stellungen hat die Burg
  runden: 5,                  // so viele Runden hat ein Kampf
  tatendrang: 5,              // je Runde, wird voll aufgefuellt
  handGroesse: 7,             // so viele Karten liegen zu Rundenbeginn
  kosten: {
    einsetzen: 1,             // Einheit auf einen leeren Turm
    ersetzen: 1,              // Einheit auf einen besetzten Turm
    tauschen: 1,              // eine Handkarte gegen eine neue
  },
  /*
   * Der Turmtyp ist mit dem vollen Blatt die eigentliche Fortschrittsachse.
   * Vorher war er eine Nebensache: ein Deck aus zwoelf Karten hatte selten
   * die passende Gattung zur Hand. Mit allen 52 Karten liegt immer ein
   * Bogenschuetze fuer den Schuetzenturm bereit - der Ausbau wirkt also
   * verlaesslich, und das macht ihn zur Achse, die den Akt traegt.
   * Fuenf passende Tuerme sind 1,4^5, also gut das Fuenffache.
   */
  turmFaktor: 1.4,            // Turmtyp passt zur Gattung
  /*
   * Die Grundsalve. Jede besetzte Stellung feuert einmal, auch ohne jede
   * Formation - alles Weitere kommt aus FORMATIONEN dazu.
   */
  salvenGrund: 1,

  /*
   * Die Wappen. Ihre Werte sind gemessen gegen die Frage: ist ein Wappen so
   * viel wert wie die beste Karte, die statt seiner im Angebot laege? In der
   * ersten Fassung war es das nicht - der Bot, der nie ein Wappen nahm, kam
   * in der Haelfte der Laeufe durch, der, der immer eines nahm, in einem
   * Siebtel. Ein regelbrechendes Wappen darf keine Falle sein.
   *
   * Hier stehen nur noch die Zahlen der Wappen, die AUF DEN KAMPF greifen -
   * der Loewe auf den Rang, der Wolf auf die Gesamtwucht. Was ein Wappen
   * ganz fuer sich macht, steht bei ihm in `quelle/wappen/sammlung.js`; bei
   * fuenfzig Wappen waere eine zweite Tabelle hier nur der Ort, an dem die
   * veraltete Zahl steht.
   */
  wappen: {
    loewe: 3,                 // Rang des mittleren Turms mal drei
    wolf: 0.6,                // je leerem Turm
    schlange: 2,              // so viele Tauesche je Runde sind frei
  },
};
