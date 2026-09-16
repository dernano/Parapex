/*
 * Wer da kommt.
 *
 * Die alte Karte war ein Baum aus elf Knoten, den man von links nach rechts
 * ablief. Sie hat nie erzaehlt, WARUM man laeuft - und sie hat der Burg
 * widersprochen, die man die ganze Zeit ansieht: eine Burg laeuft nicht, sie
 * STEHT. Wer sie verteidigt, geht nirgendwohin; die Welt kommt zu ihm.
 *
 * Eine ANTE ist darum ein Heer, das anrueckt. Es hat einen Namen, einen
 * Anfuehrer, und es kommt in drei Wellen:
 *
 *   VORHUT       ein Spaehertrupp. Abfangen - oder ihn ziehen lassen und
 *                die gewonnene Zeit in Vorbereitung stecken.
 *   DIVISIONEN   drei Abteilungen. Jede, die man schlaegt, nimmt dem
 *                Heerfuehrer ihr Merkmal. Jede, die durchkommt, gibt es ihm.
 *   HEERFUEHRER  am Ende steht er da - und zwar genau so, wie man ihn
 *                hat werden lassen.
 *
 * Das ist der ganze Trick: der Boss wird nicht gewuerfelt, er wird GEBAUT,
 * und zwar von den Entscheidungen des Spielers. Wer alles durchlaesst, hat
 * fuenf Kaempfe gespart und steht vor einem Heerfuehrer mit vier Regeln.
 *
 * Alles hier sind Daten. Wer eine Ante dazuerfindet, fasst diese Datei an.
 */

import { FEIND_STAERKE } from '../kern/feinde.js';

/* ---------- Vorhuten ---------- */
export const VORHUTEN = {
  spaehertrupp: {
    id: 'spaehertrupp', name: 'Späher am Waldrand', zeichen: '👁', typ: 'spaeher', figuren: 4,
    staerke: 0.7,
    text: 'Vier Reiter am Waldrand. Sie zählen deine Türme und reiten zurück.',
    abfangen: 'Sie kommen nicht durch — das Heer weiss nicht, was es erwartet.',
    ziehenLassen: 'Zwei Tage Zeit. Zeit ist Vorbereitung.',
  },
};

/* ---------- Divisionen ---------- */
/*
 * Jede Division traegt EIN Merkmal, und dieses Merkmal ist eine Bossregel.
 * Der Zusammenhang ist damit vollstaendig sichtbar, bevor man sich
 * entscheidet: was man durchlaesst, steht am Ende auf dem Heerfuehrer.
 */
export const DIVISIONEN = {
  brandstifter: {
    id: 'brandstifter', name: 'Die Brandstifter', zeichen: '🔥', typ: 'spaeher', figuren: 7,
    staerke: 1.0, merkmal: 'belagerungsmeister',
    text: 'Sie zünden die Dörfer an, um deine stärkste Stellung auszumachen.',
    gibt: 'Der Heerführer beschiesst deine stärkste Stellung.',
    nimmt: 'Geschlagen — der Heerführer beschiesst nichts.',
  },
  schildwall: {
    id: 'schildwall', name: 'Der Schildwall', zeichen: '⛨', typ: 'ritter', figuren: 6,
    staerke: 1.1, merkmal: 'roterKoenig',
    text: 'Eine geschlossene Wand aus Schilden. Viele kleine Schüsse prallen ab.',
    gibt: 'Über zwölf Salven zählt beim Heerführer jede weitere nur halb.',
    nimmt: 'Geschlagen — beim Heerführer zählt jede Salve voll.',
  },
  hofkaplan: {
    id: 'hofkaplan', name: 'Der Hofkaplan', zeichen: '⛓', typ: 'armbrust', figuren: 5,
    staerke: 1.2, merkmal: 'inquisitor',
    text: 'Er führt Buch über deine Wappen. Er weiss schon, welches dir am meisten gilt.',
    gibt: 'Der Heerführer versiegelt jede Runde dein lautestes Wappen.',
    nimmt: 'Geschlagen — deine Wappen bleiben offen.',
  },
};

/* ---------- Heerfuehrer ---------- */
export const HEERFUEHRER = {
  markgrafOthar: {
    id: 'markgrafOthar', name: 'Markgraf Othar', zeichen: '♜', typ: 'ritter', figuren: 5,
    staerke: 2.0,
    grundregel: 'usurpator',
    text: 'Er hat sich die Mark genommen, indem er die Ordnung verdrehte. Er wird es wieder tun.',
  },
};

/* ---------- Anten ---------- */
export const ANTEN = [
  {
    nr: 1, id: 'roteBanner', name: 'Das Rote Banner',
    text: 'Ein Heer aus dem Süden, unter rotem Banner. Es ist drei Tagesmärsche entfernt.',
    grund: FEIND_STAERKE[0],
    vorhut: 'spaehertrupp',
    divisionen: ['brandstifter', 'schildwall', 'hofkaplan'],
    heerfuehrer: 'markgrafOthar',
    regeln: [],                 // Regeln, die in JEDEM Kampf dieser Ante gelten
  },
];

/* ============================================================
 *  D I E   B E D R O H U N G
 * ============================================================
 *
 * Eine Zahl von null bis fuenf sagt einem Spieler nichts. `BEDROHUNG 3` ist
 * keine Auskunft - es ist eine Vokabel, die man auswendig lernen soll.
 *
 * Darum hat jede Stufe einen NAMEN, einen SATZ und, ab vier, eine REGEL, die
 * der Heerfuehrer dazubekommt. Damit laesst sich immer sagen:
 *
 *   was gilt JETZT
 *   was kommt bei der NAECHSTEN Stufe
 *
 * Und der Spieler entscheidet mit offenen Karten, statt eine Anzeige zu
 * beobachten, deren Bedeutung er nicht kennt.
 *
 * Die Regeln der Bedrohung sind bewusst ANDERE als die der Divisionen. Wer
 * alles durchlaesst, soll nicht dieselbe Regel doppelt bekommen, sondern eine
 * MEHR - sonst waere die hoechste Stufe nur eine groessere Zahl.
 */
export const BEDROHUNGSSTUFEN = [
  { stufe: 0, name: 'Unbemerkt', regel: null,
    text: 'Das Heer weiss nicht, was es erwartet.' },
  { stufe: 1, name: 'Gemeldet', regel: null,
    text: 'Die Späher haben deine Türme gezählt.' },
  { stufe: 2, name: 'Alarmiert', regel: null,
    text: 'Im Lager wird gerüstet. Der Heerführer schlägt härter zu.' },
  { stufe: 3, name: 'Gerüstet', regel: null,
    text: 'Belagerungsgerät wird aufgefahren. Der Heerführer schlägt deutlich härter zu.' },
  { stufe: 4, name: 'Entschlossen', regel: 'weisseKoenigin',
    text: 'Der Heerführer führt selbst und bringt seine Herolde mit.' },
  { stufe: 5, name: 'Totaler Sturm', regel: 'sturmlauf',
    text: 'Alles, was marschieren kann, marschiert. Es gibt keine Schonung mehr.' },
];

/** @param {number} n */
export function bedrohungsstufe(n) {
  return BEDROHUNGSSTUFEN[Math.max(0, Math.min(BEDROHUNGSSTUFEN.length - 1, Math.round(n)))];
}

/** Welche Regeln eine Bedrohung von n dem Heerfuehrer mitgibt. */
export function bedrohungsRegeln(n) {
  return BEDROHUNGSSTUFEN.filter(st => st.stufe <= n && st.regel).map(st => st.regel);
}

/*
 * Was die Bedrohung dem Heerfuehrer an Staerke zulegt. Sie aendert vor allem
 * seine ZUSAMMENSETZUNG - jede durchgelassene Division gibt ihm eine Regel -,
 * aber ganz ohne Zahl waere sie zu billig: wer alles durchlaesst, spart vier
 * Kaempfe und soll das auch spueren.
 */
export const JE_BEDROHUNG = 0.14;
export const BEDROHUNG_MAX = 5;

/*
 * Wie viel staerker jede weitere Ante ist. Solange es nur EIN ausgeschriebenes
 * Heer gibt, ruecken Ante zwei und drei mit demselben an - aber schwerer. Das
 * ist eine Notloesung und steht hier, damit sie als solche sichtbar ist: der
 * Platz fuer die naechsten Heere ist `ANTEN`, nicht diese Zahl.
 */
export const JE_ANTE = 1.45;

/** @param {number} nr */
export function dieAnte(nr) {
  const i = Math.max(0, Math.min(ANTEN.length - 1, nr - 1));
  const ante = ANTEN[i];
  const ueber = Math.max(0, nr - ANTEN.length);
  if (!ueber) return ante;
  return { ...ante, nr, grund: Math.round(ante.grund * Math.pow(JE_ANTE, ueber)) };
}
