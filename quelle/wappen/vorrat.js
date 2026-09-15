/*
 * Die Vorraete, die es nur gibt, weil Wappen sie schaffen.
 *
 * Ein Wappen, das +20 % Wucht gibt, macht die Zahl groesser. Ein Wappen, das
 * Veteranenmarken einfuehrt, macht das SPIEL groesser: ab jetzt gibt es eine
 * Waehrung, die vorher nicht existierte, und jedes andere Wappen, das sie
 * liest, wird dadurch interessanter. Darum liegt hier kein Zahlenband,
 * sondern ein Regalbrett, das erst durch Wappen Faecher bekommt.
 *
 * Zwei Haltbarkeiten: `kampf` wird zu jedem Kampf geleert (Pulver, Befehle -
 * Dinge, die man in dieser Schlacht verbraucht), `lauf` bleibt ueber den
 * ganzen Feldzug (Veteranenmarken, Verwuestung - Dinge, die man ansammelt).
 */

import { VORRAT_ARTEN } from './ereignisse.js';

/** @type {Record<string, number> | null} */
export let derVorrat = null;

/** Ein neuer Feldzug: alles auf null. */
export function neuerVorrat() {
  derVorrat = {};
  for (const id in VORRAT_ARTEN) derVorrat[id] = 0;
  return derVorrat;
}

/** Ein neuer Kampf: was nur fuer den Kampf galt, ist verbraucht. */
export function frischerKampfvorrat() {
  if (!derVorrat) return neuerVorrat();
  for (const id in VORRAT_ARTEN) {
    if (VORRAT_ARTEN[id].bleibt === 'kampf') derVorrat[id] = 0;
  }
  return derVorrat;
}

/*
 * Sichern und zuruecklegen. Das Spiel RECHNET zwischendurch Proben - was ein
 * Wappen an diesem Gestell brächte, misst die Belohnung, indem sie ganze
 * Kaempfe durchspielt. Die duerfen den echten Vorrat nicht anfassen.
 */
export function sichereVorrat() { return derVorrat ? { ...derVorrat } : null; }
/** @param {Record<string, number> | null} v */
export function stelleVorratHer(v) { derVorrat = v ? { ...v } : null; }

/** @param {string} art */
export function bestand(art) { return (derVorrat && derVorrat[art]) || 0; }

/**
 * Dazulegen. Gibt zurueck, wie viel tatsaechlich dazukam - das ist nicht
 * dasselbe wie das Gewuenschte, sobald eine Art einmal eine Obergrenze
 * bekommt, und ein Wappen, das "je dazugelegter Marke" zaehlt, muss die
 * echte Zahl sehen.
 * @param {string} art @param {number} menge
 */
export function lege(art, menge) {
  if (!derVorrat || !VORRAT_ARTEN[art] || menge <= 0) return 0;
  derVorrat[art] += menge;
  return menge;
}

/**
 * Wegnehmen. Nimmt nur, was da ist, und meldet die genommene Menge - ein
 * Wappen, das Pulver verbrennt, soll nicht ins Minus rutschen und auch nicht
 * so tun, als haette es gezuendet.
 * @param {string} art @param {number} menge
 */
export function zehre(art, menge) {
  if (!derVorrat || !VORRAT_ARTEN[art] || menge <= 0) return 0;
  const echt = Math.min(derVorrat[art], menge);
  derVorrat[art] -= echt;
  return echt;
}

/** Reicht der Vorrat? Fuer Wappen, die eine Bedingung stellen statt zu zahlen. */
export function reicht(art, menge) { return bestand(art) >= menge; }

/** Was im Regal steht, fuer die Anzeige - nur die Faecher, die nicht leer sind. */
export function sichtbarerVorrat() {
  if (!derVorrat) return [];
  return Object.keys(VORRAT_ARTEN)
    .filter(id => derVorrat && derVorrat[id] > 0)
    .map(id => ({ ...VORRAT_ARTEN[id], menge: (derVorrat && derVorrat[id]) || 0 }));
}
