/*
 * Das Dach ueber dem Kern.
 *
 * Hier steht, was der Kern nach aussen zeigt - und nur das. Die Oberflaeche im
 * Browser greift auf dieselbe Liste zu (als `window.PARAPEX`), die Pruefungen
 * in Node importieren sie direkt. Eine Flaeche, zwei Wege darauf.
 *
 * Alles hier ist REINE RECHNUNG: kein Dokument, kein Zeichenkontext, kein
 * Ereignis des Browsers. Das ist keine Stilfrage, sondern die Bedingung dafuer,
 * dass `scripts/pruefe-kern.mjs` ohne Browser laufen kann.
 */
export { KERN } from './kern/regeln.js';
export {
  GATTUNGEN, GATTUNG_LISTE, RANG_NAMEN, EINHEITEN_POOL, START_DECK,
  neueEinheit, grundwucht, wirkwucht, bonusWucht, verbessereEinheit,
} from './kern/einheiten.js';
export { TURMTYPEN, TURM_START, turmFaktor } from './kern/tuerme.js';
export { FEIND_STAERKE, feindStaerke, baueFeind } from './kern/feinde.js';
export { WAPPEN, WAPPEN_LISTE, WAPPEN_PLAETZE } from './kern/wappen.js';
export { SIGNALE, signalUeberlauf, hoereSignal, sendeSignal, leereSignale } from './kern/signale.js';
export {
  FORMATIONEN, FORMATIONS_FAMILIEN, FAMILIEN_ZEICHEN, KOENIGSRAENGE,
  baueBlatt, erkenneFormationen, salvenZahl, formationsSalven,
} from './kern/formationen.js';
export { berechneWucht } from './kern/wucht.js';
export {
  derKampf, neuerKampf, setzeEinheit, tauscheHandkarte, tauscheHandkarten,
  tauschKosten, tauschKostenFuer, beendeRunde, ziehe, zieheAuf, vorschau,
  raeumeKampf,
} from './kern/kampf.js';
export {
  LAUF, KNOTEN_ARTEN, derLauf, neuerLauf, derKnoten, beginneKampfAmKnoten,
  werteKampfAus, baueBelohnung, nimmAngebot, fuegeWappenHinzu, baueTurmAus,
  entferneKarte, schleifeKarte, verlasseKnoten,
} from './kern/lauf.js';
export { oeffneHaendler, kaufe } from './kern/haendler.js';
export { BEGEGNUNGEN, ziehBegegnung, waehleInBegegnung } from './kern/begegnungen.js';
