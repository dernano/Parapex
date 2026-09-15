/*
 * Das Heerlager.
 *
 * Zwischen zwei Schlachten steht das Lager. Vier Dienste gibt es - aber nie
 * alle vier auf einmal: bei jedem Halt sind zwei da, und welche zwei, steht
 * fest, sobald der Spieler den Kampf gewinnt. Das ist der Unterschied zwischen
 * einem Laden und einer Entscheidung. Waeren immer alle da, hiesse jeder Halt
 * "nimm das Beste"; so heisst er "mit dem hier musst du auskommen".
 *
 *   HAENDLER    Karten, Ausmusterung, Schliff - gegen Sold.
 *   HEROLD      alles, was Wappen betrifft - gegen Vorbereitung.
 *   SCHMIEDE    die Tuerme - die langsame Achse.
 *   KRIEGSRAT   die Formationen - Stufen, die den ganzen Feldzug halten.
 *
 * Bezahlt wird mit VORBEREITUNG, und die bekommt man nur, indem man etwas
 * durchlaesst. Wer jede Division stellt, kommt mit einem sauberen Heerfuehrer
 * an - und mit leeren Haenden.
 */

import { TURMTYPEN } from '../kern/tuerme.js';
import { FORMATIONEN } from '../kern/formationen.js';
import { WAPPEN, WAPPEN_PLAETZE } from '../wappen/sammlung.js';
import { derLauf, angebotWappen, baueTurmAus } from '../kern/lauf.js';
import { dieBelagerung } from './belagerung.js';

export const DIENSTE = {
  haendler: {
    id: 'haendler', name: 'Der Händler', zeichen: '⚖',
    text: 'Er folgt jedem Heer und verkauft an beide Seiten.',
    waehrung: 'sold',
  },
  herold: {
    id: 'herold', name: 'Der Herold', zeichen: '⚜',
    text: 'Er kennt jedes Wappen des Reiches und weiss, wo es hängen sollte.',
    waehrung: 'vorbereitung',
  },
  schmiede: {
    id: 'schmiede', name: 'Die Feldschmiede', zeichen: '🔨',
    text: 'Zwei Tage Arbeit an einem Turm. Mehr gibt die Zeit nicht her.',
    waehrung: 'vorbereitung',
  },
  kriegsrat: {
    id: 'kriegsrat', name: 'Der Kriegsrat', zeichen: '⚑',
    text: 'Alte Offiziere, die eine Aufstellung schon dreimal gesehen haben.',
    waehrung: 'vorbereitung',
  },
};

/*
 * Welche zwei Dienste an welchem Halt stehen. Eine feste Kette und kein
 * Zufall: der Spieler soll zwei Schlachten im Voraus wissen, wofuer er spart.
 */
export const LAGER_FOLGE = [
  ['haendler', 'herold'],
  ['schmiede', 'kriegsrat'],
  ['herold', 'kriegsrat'],
  ['haendler', 'schmiede'],
];

/* Was ein Dienst kostet, in Vorbereitung. */
export const LAGER_PREISE = {
  wappenTauschen: 2,
  wappenHolen: 3,
  turmAusbauen: 2,
  formationHeben: 3,
};

export let dasLager = null;

/** @param {number} nr der wievielte Halt dieser Ante */
export function oeffneLager(nr) {
  const paar = LAGER_FOLGE[(nr - 1) % LAGER_FOLGE.length];
  dasLager = { nr, dienste: paar.slice(), genutzt: [] };
  return dasLager;
}

export function raeumeLager() { dasLager = null; }

/** Ist dieser Dienst hier und noch frei? */
export function dienstOffen(id) {
  return Boolean(dasLager && dasLager.dienste.includes(id) && !dasLager.genutzt.includes(id));
}

/** Was in der Kasse ist - beide Waehrungen an einer Stelle. */
export function kasse() {
  return {
    sold: derLauf ? derLauf.sold : 0,
    vorbereitung: dieBelagerung ? dieBelagerung.vorbereitung : 0,
  };
}

/**
 * Was ein Dienst gerade anbietet. Jeder Posten traegt seinen Preis und, wenn
 * er zu teuer ist, den Grund - die Oberflaeche rechnet nichts nach.
 * @param {string} id
 */
export function lagerAngebote(id) {
  if (!derLauf || !dienstOffen(id)) return [];
  const k = kasse();
  const posten = [];

  if (id === 'herold') {
    /*
     * Der Herold bietet ein Wappen an - und, wenn das Gestell voll ist, den
     * Tausch. Ein volles Gestell war vorher eine Sackgasse: jedes weitere
     * Wappen im Angebot war ein toter Posten.
     */
    const a = angebotWappen();
    if (a && derLauf.wappen.length < WAPPEN_PLAETZE) {
      posten.push({ art: 'wappenHolen', wappen: a.wappen, name: a.name, zeichen: a.zeichen,
        tinktur: a.tinktur, text: a.text, hinweis: a.hinweis, seltenheit: a.seltenheit,
        preis: LAGER_PREISE.wappenHolen });
    }
    for (const w of derLauf.wappen) {
      posten.push({ art: 'wappenTauschen', wappen: w, name: WAPPEN[w].name + ' ablegen',
        zeichen: WAPPEN[w].zeichen, tinktur: WAPPEN[w].tinktur,
        text: 'Macht den Platz frei. Das Wappen ist danach weg.',
        preis: LAGER_PREISE.wappenTauschen });
    }
  }

  if (id === 'schmiede') {
    const offen = derLauf.turmTypen
      .map((t, i) => ({ t, i })).filter(x => x.t === 'wachturm');
    for (const { i } of offen) {
      for (const typ of Object.keys(TURMTYPEN)) {
        if (typ === 'wachturm') continue;
        const tt = TURMTYPEN[typ];
        posten.push({ art: 'turmAusbauen', turm: i, typ, name: 'Stellung ' + (i + 1) + ': ' + tt.name,
          zeichen: tt.zeichen || '⛫', text: tt.text || '',
          preis: LAGER_PREISE.turmAusbauen });
      }
    }
  }

  if (id === 'kriegsrat') {
    for (const f of FORMATIONEN) {
      const stufe = (derLauf.formationsStufen[f.id] || 1);
      posten.push({ art: 'formationHeben', formation: f.id,
        name: f.name + ' · Stufe ' + stufe + ' → ' + (stufe + 1),
        zeichen: '⚑', text: f.text + ' Gibt +' + (f.jeStufe || 0) + ' Salven.',
        preis: LAGER_PREISE.formationHeben });
    }
  }

  if (id === 'haendler') {
    // Der Haendler hat seine eigene Bude; hier steht nur die Tuer dorthin.
    posten.push({ art: 'haendlerOeffnen', name: 'Die Bude ansehen', zeichen: '⚖',
      text: 'Karten, Ausmusterung und Schliff - gegen Sold.', preis: 0 });
  }

  return posten.map(p => ({
    ...p,
    waehrung: DIENSTE[id].waehrung,
    zuTeuer: p.preis > (DIENSTE[id].waehrung === 'sold' ? k.sold : k.vorbereitung),
  }));
}

/**
 * Einen Posten nehmen. Ein Dienst gilt einmal je Halt - danach ist er
 * abgeraeumt, auch wenn noch Vorbereitung uebrig waere.
 * @param {string} id @param {any} posten
 */
export function nimmLagerangebot(id, posten) {
  if (!derLauf) return { ok: false, grund: 'Kein Feldzug.' };
  if (!dienstOffen(id)) return { ok: false, grund: 'Dieser Dienst ist hier nicht zu haben.' };
  if (!posten) return { ok: false, grund: 'Kein Posten.' };
  if (posten.zuTeuer) {
    return { ok: false, grund: posten.waehrung === 'sold'
      ? 'Dafür fehlt der Sold.' : 'Dafür fehlt die Vorbereitung.' };
  }

  if (posten.art === 'haendlerOeffnen') return { ok: true, haendler: true };

  const b = dieBelagerung;
  if (posten.preis > 0) {
    if (!b || b.vorbereitung < posten.preis) return { ok: false, grund: 'Dafür fehlt die Vorbereitung.' };
    b.vorbereitung -= posten.preis;
  }

  let erg = { ok: true };
  if (posten.art === 'wappenHolen') {
    if (derLauf.wappen.length >= WAPPEN_PLAETZE) erg = { ok: false, grund: 'Alle fünf Plätze sind belegt.' };
    else derLauf.wappen.push(posten.wappen);
  } else if (posten.art === 'wappenTauschen') {
    const i = derLauf.wappen.indexOf(posten.wappen);
    if (i < 0) erg = { ok: false, grund: 'Dieses Wappen hängt nicht.' };
    else derLauf.wappen.splice(i, 1);
  } else if (posten.art === 'turmAusbauen') {
    erg = baueTurmAus(posten.turm, posten.typ);
  } else if (posten.art === 'formationHeben') {
    derLauf.formationsStufen[posten.formation] = (derLauf.formationsStufen[posten.formation] || 1) + 1;
  } else {
    erg = { ok: false, grund: 'Diesen Posten gibt es nicht.' };
  }

  // Ging es schief, kommt die Vorbereitung zurueck - halb bezahlt gibt es nicht.
  if (!erg.ok && posten.preis > 0 && b) b.vorbereitung += posten.preis;
  if (erg.ok) dasLager.genutzt.push(id);
  return erg;
}
