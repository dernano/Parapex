import { KERN } from './regeln.js';

// ---------- Wappen ----------
/*
 * Wappen sind keine Karten. Sie liegen neben dem Kampf und brechen Regeln -
 * darum geben sie bewusst keine kleinen Prozentboni, sondern ändern, wie
 * gerechnet wird. Jedes Wappen ist ein Datensatz mit Haken; der Kampf kennt
 * keinen einzigen Wappennamen.
 */
/*
 * Der Eber laesst eine abgeloeste Einheit ein letztes Mal feuern - aber WIE
 * geschossen wird, weiss der Kampf und nicht das Wappen. Frueher rief das
 * Wappen `schiesseEinzeln` direkt; in einer Datei faellt so etwas nicht auf,
 * als Modul ist es ein Kreis: die Wappen haengen am Kampf, der Kampf an den
 * Wappen. Jetzt reicht der Kampf seinen Schuss hier herein, und die Richtung
 * stimmt wieder - unten weiss nichts von oben.
 */
/** @type {(einheit: import('./typen.js').Einheit, turm: number, quelle: string) => number} */
let feuerEinzeln = () => 0;
/** @param {typeof feuerEinzeln} fn */
export function setzeEinzelschuss(fn) { feuerEinzeln = fn; }

export const WAPPEN = {
  loewe: {
    id: 'loewe', name: 'Wappen des Löwen', zeichen: '🦁', tinktur: '#a8791c',
    text: 'Der mittlere Turm zählt seinen Rang dreifach.',
    rangFaktor: (turm, i) => (i === Math.floor(KERN.tuerme / 2) ? KERN.wappen.loewe : 1),
  },
  doppeladler: {
    /*
     * Frueher schloss dieses Wappen die Turmreihe zum Ring - sinnvoll,
     * solange Formationen an Nachbarschaft haengen. Seit sie ueber die MENGE
     * der besetzten Stellungen gehen, gibt es keine Nachbarn mehr, und der
     * Doppeladler waere ein Wappen ohne Wirkung geworden.
     *
     * Er behaelt sein Bild und bekommt eine Wirkung, die dazu passt: zwei
     * Koepfe, eine Einheit. Die Einheit auf der ersten Stellung zaehlt beim
     * Erkennen doppelt - sie kann also mit sich selbst ein Paar bilden, ein
     * Regiment vervollstaendigen oder eine Luecke in einer Folge fuellen.
     */
    id: 'doppeladler', name: 'Wappen des Doppeladlers', zeichen: '🦅', tinktur: '#4a4f5c',
    text: 'Die Einheit auf Turm 1 zählt für Formationen doppelt.',
    zaehltDoppelt: 0,
  },
  wolf: {
    id: 'wolf', name: 'Wappen des Wolfs', zeichen: '🐺', tinktur: '#3c5a72',
    text: 'Je leerem Turm +60 % Gesamtwucht.',
    gesamtFaktor: (ctx) => 1 + KERN.wappen.wolf * ctx.tuerme.filter(t => !t.einheit).length,
  },
  eber: {
    id: 'eber', name: 'Wappen des Ebers', zeichen: '🐗', tinktur: '#6b3a2a',
    text: 'Eine ersetzte Einheit feuert ein letztes Mal.',
    horcht: { einheitErsetzt: (daten) => { if (daten.alt) feuerEinzeln(daten.alt, daten.turm, 'Wappen des Ebers'); } },
  },
  schlange: {
    id: 'schlange', name: 'Wappen der Schlange', zeichen: '🐍', tinktur: '#2f6a4a',
    text: 'Die ersten zwei Kartentausche jeder Runde kosten nichts.',
    tauschRabatt: (kampf) => (kampf.tauschInRunde < KERN.wappen.schlange ? KERN.kosten.tauschen : 0),
  },
  drache: {
    id: 'drache', name: 'Wappen des Drachen', zeichen: '🐉', tinktur: '#7a2a3a',
    text: 'Jeder Nachschuss zählt doppelt.',
    retriggerFaktor: (nummer) => (nummer % KERN.wappen.drache.jeder === 0 ? KERN.wappen.drache.faktor : 1),
  },
};
export const WAPPEN_LISTE = Object.keys(WAPPEN);
export const WAPPEN_PLAETZE = 5;
