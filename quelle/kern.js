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
export { EREIGNIS, EREIGNIS_LISTE, VORRAT_ARTEN } from './wappen/ereignisse.js';
export {
  PLAETZE, ZUENDART, GRENZEN, WAPPEN_REGISTER, dasBand, neuesBand, raeumeBand,
  reihe, vertauschePlaetze, verschiebePlatz, siegelePlatz, entsiegle, lautesterPlatz, setzeRunde,
  loeseAus, zuendeErneut, kopiere, fasseZusammen, abgewiesene, abweisungen,
  meldeWappen, mitReihe, aufAllem,
} from './wappen/fliessband.js';
export {
  derVorrat, neuerVorrat, frischerKampfvorrat, bestand, lege, zehre, reicht,
  sichtbarerVorrat,
} from './wappen/vorrat.js';
export { WAPPEN, WAPPEN_LISTE, WAPPEN_PLAETZE, SELTENHEITEN, wappenNach } from './wappen/sammlung.js';
export {
  EREIGNIS_NAMEN, ABWEISUNG_NAMEN, hoertAuf, wirkungText,
  platzBericht, wappenBericht, reihenfolgeBeispiel, salvenHerkunft,
} from './wappen/erklaerung.js';
export {
  FORMATIONEN, FORMATIONS_FAMILIEN, FAMILIEN_ZEICHEN, KOENIGSRAENGE,
  baueBlatt, erkenneFormationen, salvenZahl, formationsSalven,
} from './kern/formationen.js';
export { berechneWucht } from './kern/wucht.js';
export {
  derKampf, neuerKampf, setzeEinheit, tauscheHandkarte, tauscheHandkarten,
  tauschKosten, tauschKostenFuer, beendeRunde, ziehe, zieheAuf, vorschau,
  ordnungsVorschau,
  raeumeKampf,
} from './kern/kampf.js';
export {
  LAUF, SCHLACHT_ARTEN, WAPPEN_ANGEBOT, derLauf, neuerLauf, beginneSchlacht,
  werteKampfAus, naechsteAnte, baueBelohnung, nimmAngebot, fuegeWappenHinzu, baueTurmAus,
  entferneKarte, schleifeKarte, angebotWappen, angebotKarte, ordneWappen, bewerteWappen,
  kampfNrJetzt, setzeLauf,
} from './kern/lauf.js';
export { oeffneHaendler, kaufe } from './kern/haendler.js';
export { BEGEGNUNGEN, ziehBegegnung, waehleInBegegnung } from './kern/begegnungen.js';

/* ---------- Der Feldzug: die Welt kommt zur Burg ---------- */
export { BOSSREGELN, BOSSREGEL_LISTE, ROTER_KOENIG_AB, baueRegeln } from './feldzug/bossregeln.js';
export {
  ANTEN, VORHUTEN, DIVISIONEN, HEERFUEHRER, JE_BEDROHUNG, JE_ANTE, BEDROHUNG_MAX, dieAnte,
  BEDROHUNGSSTUFEN, bedrohungsstufe, bedrohungsRegeln,
} from './feldzug/gegner.js';
export {
  KAEMPFE_MIN, KAEMPFE_MAX, ABSCHNITTE, SPERRE, dieBelagerung, neueBelagerung,
  raeumeBelagerung, darfDurchlassen, kaempfeNochHoechstens, kaempfeNochMindestens,
  offeneWahlen, waehle, meldeAusgang, baueHeerfuehrer, belagerungslage,
  heerfuehrerRegeln, heerfuehrerStaerke, folgenDerWahl,
  sichereBelagerung, ladeBelagerung,
} from './feldzug/belagerung.js';
export {
  DIENSTE, LAGER_FOLGE, LAGER_PREISE, dasLager, oeffneLager, raeumeLager,
  VORBEREITUNGSPOSTEN, vorbereitungslage,
  dienstOffen, kasse, lagerAngebote, nimmLagerangebot,
} from './feldzug/heerlager.js';
export {
  STAND_FASSUNG, sichereFeldzug, ladeFeldzug, beschreibeStand,
} from './feldzug/speicher.js';

/* ---------- Das Kriegsbuch: ein Ort fuer jede Erklaerung ---------- */
export {
  KAPITEL, BEGRIFFE, BEGRIFF_LISTE, begriff, begriffJetzt, kapitelBegriffe,
  vorratsBegriffe, liestVorrat,
} from './kern/begriffe.js';
