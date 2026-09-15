/*
 * Die Regeln der Heerfuehrer.
 *
 * Ein Boss, der mehr Trefferpunkte hat, ist kein Gegner - er ist eine laengere
 * Wartezeit. Man spielt gegen ihn genau so wie gegen den Kampf davor, nur
 * oefter. Das ist die Stelle, an der ein Deckbauer aufhoert, interessant zu
 * sein: wenn das, was der Spieler gebaut hat, nie in Frage gestellt wird.
 *
 * Diese Regeln zielen deshalb nicht auf seine Zahlen, sondern auf seine
 * MASCHINE. Der Usurpator vertauscht zwei Wappenplaetze - wer seine Reihe auf
 * "links gibt, rechts verdoppelt" gebaut hat, steht plötzlich falsch herum da.
 * Der Inquisitor versiegelt genau das Wappen, um das der Spieler alles gebaut
 * hat. Der Rote Koenig laesst Salven ins Leere laufen, sobald es zu viele
 * werden.
 *
 * Gegen jede dieser Regeln gibt es eine ANTWORT, und sie liegt in derselben
 * Waehrung: umhaengen kostet einen Tatendrang. Die Frage ist nie "kann ich
 * das ueberleben", sondern "was ist es mir wert".
 *
 * Technisch sind sie Wappen ohne Gestell: dieselbe Bauform, dasselbe
 * Fliessband, dasselbe Protokoll - nur laufen sie hinter den fuenf Plaetzen
 * des Spielers. Er rechnet zuerst, der Gegner antwortet.
 */

import { KERN } from '../kern/regeln.js';
import { EREIGNIS } from '../wappen/ereignisse.js';
import {
  vertauschePlaetze, siegelePlatz, entsiegle, lautesterPlatz, notiere, reihe,
} from '../wappen/fliessband.js';
import { wirke } from '../wappen/wirkungen.js';

export const BOSSREGELN = {

  usurpator: {
    id: 'usurpator', name: 'Der Usurpator', zeichen: '♜', tinktur: '#6a2a3a',
    text: 'Vertauscht zu jeder Runde den zweiten und den vierten Wappenplatz.',
    antwort: 'Häng um — oder bau eine Reihe, der die Mitte egal ist.',
    hoert: {
      [EREIGNIS.rundeBeginnt]: (lage) => {
        if (reihe().length < 4) return;
        if (!vertauschePlaetze(1, 3)) return;
        notiere(lage, 'tausch', [1, 3], 'Platz 2 und 4 vertauscht');
      },
    },
  },

  inquisitor: {
    id: 'inquisitor', name: 'Der Inquisitor', zeichen: '⛓', tinktur: '#3a3a4a',
    text: 'Versiegelt zu jeder Runde das Wappen, das bisher am häufigsten zündete.',
    antwort: 'Zieh es aus der Reihe, oder verteile die Last auf mehrere Plätze.',
    hoert: {
      [EREIGNIS.rundeBeginnt]: (lage) => {
        /*
         * Erst loesen, dann neu versiegeln. Sonst haette er nach fuenf Runden
         * das ganze Gestell zu - und das waere kein Gegner mehr, sondern eine
         * Ansage, dass der Spieler diesen Kampf nicht gewinnen soll.
         */
        entsiegle();
        const platz = lautesterPlatz();
        if (platz < 0) return;
        siegelePlatz(platz);
        notiere(lage, 'siegel', platz, 'Platz ' + (platz + 1) + ' versiegelt');
      },
    },
  },

  belagerungsmeister: {
    id: 'belagerungsmeister', name: 'Der Belagerungsmeister', zeichen: '☄', tinktur: '#6a4a2a',
    text: 'Beschiesst die stärkste Stellung — ihre Wucht zählt nicht.',
    antwort: 'Verteile die Wucht. Fünf mittlere Stellungen verlieren weniger als eine grosse.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const posten = lage.daten.posten || [];
        if (!posten.length) return;
        const stark = posten.reduce((/** @type {any} */ m, /** @type {any} */ p) =>
          (p.wucht > m.wucht ? p : m), posten[0]);
        if (!stark.wucht) return;
        wirke(lage, 'zusatz', -stark.wucht, 'Stellung ' + (stark.turm + 1) + ' beschossen');
      },
    },
  },

  weisseKoenigin: {
    id: 'weisseKoenigin', name: 'Die Weiße Königin', zeichen: '♕', tinktur: '#5a5a72',
    text: 'Verhüllt jede Runde eine andere Stellung — ihre Gattung zählt für keine Formation.',
    antwort: 'Bau auf Ränge statt auf Gattungen, oder besetze die verhüllte Stellung gar nicht.',
    hoert: {
      [EREIGNIS.blattGelesen]: (lage) => {
        /*
         * Eine ANDERE je Runde, und berechenbar welche: der Spieler soll
         * umbauen koennen, nicht raten muessen. Zufall an dieser Stelle waere
         * keine Schwierigkeit, sondern eine Steuer.
         */
        const verhuellt = (lage.runde - 1) % KERN.tuerme;
        if (lage.daten.turm !== verhuellt) return;
        lage.daten.gattung = 'verhuellt';
        notiere(lage, 'verhuellt', lage.daten.turm, 'Stellung ' + (lage.daten.turm + 1) + ' verhüllt');
      },
    },
  },

  roterKoenig: {
    id: 'roterKoenig', name: 'Der Rote König', zeichen: '♔', tinktur: '#7a2a2a',
    text: 'Über zwölf Salven zählt jede weitere nur halb.',
    antwort: 'Nicht mehr Salven — schwerere. Alles, was die Wucht je Salve hebt, trifft ihn voll.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const ueber = lage.daten.salven - ROTER_KOENIG_AB;
        if (ueber <= 0) return;
        wirke(lage, 'salven', -ueber / 2, ueber.toFixed(0) + ' Salven verpuffen');
      },
    },
  },
};

export const ROTER_KOENIG_AB = 12;

export const BOSSREGEL_LISTE = Object.keys(BOSSREGELN);

/** @param {string[]} ids */
export function baueRegeln(ids) {
  return (ids || []).map(id => BOSSREGELN[id]).filter(Boolean);
}
