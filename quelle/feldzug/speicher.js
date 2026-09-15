/*
 * Speichern und Laden.
 *
 * Ein Feldzug dauert lange genug, dass man ihn unterbrechen koennen muss -
 * und ein Roguelike, das beim Schliessen des Fensters alles vergisst, ist
 * kein Feldzug, sondern eine Sitzung.
 *
 * DIE REGEL: gespeichert wird NUR, was der Spieler erarbeitet hat. Alles, was
 * sich daraus ableiten laesst, wird beim Laden neu gebaut - die Wappen aus
 * ihren Kennungen, die Regeln des Heerfuehrers aus den Divisionen, die man
 * durchgelassen hat. Was man ableiten kann und trotzdem speichert, hat man
 * zweimal, und beim naechsten Umbau stimmt eine der beiden Fassungen nicht
 * mehr.
 *
 * Deshalb ist hier alles REINES JSON: keine Funktionen, keine Verweise,
 * nichts, was beim Einlesen lebendig gemacht werden muesste.
 *
 * DIE REIHENFOLGE DER WAPPEN IST TEIL DES SPIELSTANDS. Sie ist der Bauplan
 * der Maschine; ein Stand, der sie verliert, hat das Wichtigste verloren.
 */

import { derLauf, setzeLauf } from '../kern/lauf.js';
import { sichereBelagerung, ladeBelagerung, dieBelagerung } from './belagerung.js';
import { sichereVorrat, stelleVorratHer, derVorrat } from '../wappen/vorrat.js';
import { stelleKampfHer } from '../kern/kampf.js';
import { raeumeBand } from '../wappen/fliessband.js';

/*
 * Die Fassung des Standes. Sie steht hier, damit ein alter Stand nach einem
 * Umbau nicht halb geladen wird und das Spiel in einem Zustand steht, den es
 * nicht mehr gibt. Lieber ehrlich ablehnen als heimlich falsch laden.
 */
export const STAND_FASSUNG = 1;

/** Der ganze Feldzug als JSON-faehiges Objekt - oder null. */
export function sichereFeldzug() {
  if (!derLauf) return null;
  return JSON.parse(JSON.stringify({
    fassung: STAND_FASSUNG,
    zeit: Date.now(),
    lauf: { ...derLauf, haendler: null },   // der Haendler wird neu gemischt
    belagerung: sichereBelagerung(),
    vorrat: sichereVorrat(),
  }));
}

/**
 * Einen Stand zurueckholen. Gibt zurueck, ob es ging - und warum nicht.
 * @param {any} stand
 */
export function ladeFeldzug(stand) {
  if (!stand || typeof stand !== 'object') return { ok: false, grund: 'Kein Spielstand.' };
  if (stand.fassung !== STAND_FASSUNG) {
    return { ok: false, grund: 'Der Spielstand ist aus einer älteren Fassung.' };
  }
  if (!stand.lauf || !Array.isArray(stand.lauf.deck)) {
    return { ok: false, grund: 'Der Spielstand ist unvollständig.' };
  }
  /*
   * Erst abraeumen, dann aufbauen. Ein halb geladener Stand auf einem
   * laufenden Kampf ist der schlimmste aller Zustaende: nichts stuerzt ab,
   * und alles ist falsch.
   */
  stelleKampfHer(null);
  raeumeBand();
  setzeLauf({ ...stand.lauf, haendler: null });
  stelleVorratHer(stand.vorrat);
  ladeBelagerung(stand.belagerung);
  if (!dieBelagerung) return { ok: false, grund: 'Die Belagerung fehlte im Spielstand.' };
  return { ok: true, lauf: derLauf };
}

/** Was in einem Stand steht, ohne ihn zu laden - fuer den Knopf im Menue. */
export function beschreibeStand(stand) {
  if (!stand || stand.fassung !== STAND_FASSUNG || !stand.lauf) return null;
  const l = stand.lauf;
  return {
    ante: l.ante, anten: l.anten, schlachten: l.schlachten,
    deck: l.deck.length, wappen: l.wappen.length, sold: l.sold,
    bedrohung: stand.belagerung ? stand.belagerung.bedrohung : 0,
    zeit: stand.zeit || 0,
  };
}

/** Nur fuer Pruefungen: steht der Vorrat? */
export function vorratSteht() { return Boolean(derVorrat); }
