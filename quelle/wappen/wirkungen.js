/*
 * Die Wirkungen: alles, was ein Wappen an der Lage aendern kann.
 *
 * Ein Wappen fasst die Lage NIE selbst an. Es ruft eine Wirkung, und die
 * Wirkung schreibt ihre Aenderung ins Protokoll. Das kostet eine Zeile mehr
 * und kauft zwei Dinge, die anders nicht zu haben sind:
 *
 * 1. Das Kampfprotokoll ist vollstaendig. Jede Zahl, die sich bewegt hat,
 *    steht mit ihrem Urheber da.
 * 2. VERSTAERKEN UND KOPIEREN GEHEN OHNE WISSEN. `verstaerke` muss nicht
 *    kennen, was der Platz davor getan hat - es liest dessen aufgezeichnete
 *    Wirkungen und wendet sie noch einmal an. Ein Wappen, das es morgen gibt,
 *    ist damit heute schon verstaerkbar.
 *
 * Deshalb sind additive und multiplikative Wirkungen streng getrennt. Wer
 * eine Wirkung verdoppelt, verdoppelt bei `+3 Salven` die Drei und bei
 * `x1,5 Wucht` den Exponenten - `x2,25`, nicht `x3`. Das ist der einzige
 * Weg, auf dem "zaehlt doppelt" bei beiden Bauarten dasselbe bedeutet.
 */

import { notiere, vorherigeZuendung, zuendungenDavor, loeseAusIn } from './fliessband.js';
import { EREIGNIS } from './ereignisse.js';
import { lege, zehre, bestand } from './vorrat.js';

/*
 * Welches Feld der Lage eine Wirkung anfasst und wie. Mehr Arten gibt es
 * nicht - wer eine neue braucht, traegt sie hier ein, und sie ist damit in
 * demselben Zug verstaerkbar, kopierbar und protokolliert.
 */
export const WIRKUNGSARTEN = {
  salven:       { feld: 'salven',      rechnung: 'plus' },
  salvenFaktor: { feld: 'salven',      rechnung: 'mal'  },
  zusatz:       { feld: 'zusatz',      rechnung: 'plus' },
  faktor:       { feld: 'faktor',      rechnung: 'mal'  },
  wucht:        { feld: 'wucht',       rechnung: 'plus' },
  wuchtFaktor:  { feld: 'wucht',       rechnung: 'mal'  },
  tatendrang:   { feld: 'tatendrang',  rechnung: 'plus' },
  rang:         { feld: 'rang',        rechnung: 'plus' },
  ziehen:       { feld: 'ziehen',      rechnung: 'plus' },
  kosten:       { feld: 'kosten',      rechnung: 'plus' },
  kopien:       { feld: 'kopien',      rechnung: 'plus' },
};

/**
 * Die eine Stelle, an der sich etwas aendert.
 *
 * @param {any} lage
 * @param {string} art eine Kennung aus WIRKUNGSARTEN, oder 'vorrat'
 * @param {any} wert Zahl - bei 'vorrat' ein {art, menge}
 * @param {string} [text] was im Protokoll stehen soll
 */
export function wirke(lage, art, wert, text = '') {
  if (art === 'vorrat') return wirkeVorrat(lage, wert, text);
  const regel = WIRKUNGSARTEN[art];
  if (!regel) return null;
  const feld = regel.feld;
  /*
   * Ein Wappen, das auf ein Ereignis ohne dieses Feld wirkt, ist ein Fehler
   * im Wappen und keiner in der Lage. Er wird festgehalten statt still
   * geschluckt - sonst haben wir wieder einen Drachen, der nichts tut.
   */
  if (!(feld in lage.daten)) {
    return notiere(lage, 'daneben', 0, art + ' geht auf ' + lage.ereignis + ' ins Leere');
  }
  if (regel.rechnung === 'plus') {
    if (!wert) return null;
    lage.daten[feld] += wert;
  } else {
    if (wert === 1) return null;
    lage.daten[feld] *= wert;
  }
  return notiere(lage, art, wert, text);
}

/** @param {any} lage @param {{art: string, menge: number}} wert @param {string} text */
function wirkeVorrat(lage, wert, text) {
  if (!wert || !wert.art || !wert.menge) return null;
  /*
   * In der Probe wird gerechnet, als haette es geklappt - aber das Regal
   * bleibt unberuehrt. Sonst kostete jede Mausbewegung ueber einem Turm
   * Pulver.
   */
  let echt;
  if (wert.menge > 0) {
    echt = lage.probe ? wert.menge : lege(wert.art, wert.menge);
  } else {
    echt = -(lage.probe ? Math.min(bestand(wert.art), -wert.menge) : zehre(wert.art, -wert.menge));
  }
  if (!echt) return null;
  return notiere(lage, 'vorrat', { art: wert.art, menge: echt }, text);
}

// ---------- Die handlichen Formen ----------
/* Damit ein Wappen `salvenDazu(lage, 3)` schreibt und nicht die Tabelle kennt. */

/** @param {any} l @param {number} n @param {string} [t] */
export function salvenDazu(l, n, t = '') { return wirke(l, 'salven', n, t); }
/** @param {any} l @param {number} f @param {string} [t] */
export function salvenMal(l, f, t = '') { return wirke(l, 'salvenFaktor', f, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function wuchtDazu(l, n, t = '') { return wirke(l, 'zusatz', n, t); }
/** @param {any} l @param {number} f @param {string} [t] */
export function wuchtMal(l, f, t = '') { return wirke(l, 'faktor', f, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function trefferDazu(l, n, t = '') { return wirke(l, 'wucht', n, t); }
/** @param {any} l @param {number} f @param {string} [t] */
export function trefferMal(l, f, t = '') { return wirke(l, 'wuchtFaktor', f, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function tatendrangDazu(l, n, t = '') { return wirke(l, 'tatendrang', n, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function rangDazu(l, n, t = '') { return wirke(l, 'rang', n, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function zieheDazu(l, n, t = '') { return wirke(l, 'ziehen', n, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function kostenDazu(l, n, t = '') { return wirke(l, 'kosten', n, t); }
/** @param {any} l @param {number} n @param {string} [t] */
export function kopienDazu(l, n, t = '') { return wirke(l, 'kopien', n, t); }
/** @param {any} l @param {string} art @param {number} menge @param {string} [t] */
export function gib(l, art, menge, t = '') { return wirke(l, 'vorrat', { art, menge }, t); }
/** @param {any} l @param {string} art @param {number} menge @param {string} [t] */
export function nimm(l, art, menge, t = '') { return wirke(l, 'vorrat', { art, menge: -menge }, t); }
/** @param {string} art */
export function habe(art) { return bestand(art); }

// ---------- Wirkungen auf Wirkungen ----------
/*
 * Hier wird aus einer Sammlung eine Maschine. Diese drei kennen keinen
 * einzigen Wappennamen - sie arbeiten auf dem, was die Plaetze LINKS von
 * ihnen aufgezeichnet haben. Darum ist die Reihenfolge am Gestell nicht
 * Geschmack, sondern Bauplan.
 */

/**
 * Was ein Platz getan hat, ein weiteres Mal anwenden.
 *
 * `mal = 1` heisst: noch einmal, also insgesamt doppelt. Additive Wirkungen
 * werden mit `mal` multipliziert, multiplikative potenziert - `x1,5` ein
 * weiteres Mal ist `x1,5`, nicht `x0,5`.
 *
 * @param {any} lage @param {any} zuendung die zu verstaerkende Zuendung
 * @param {number} [mal] wie oft zusaetzlich
 */
export function wendeNochmalAn(lage, zuendung, mal = 1) {
  if (!zuendung || mal <= 0) return 0;
  let getan = 0;
  // Die Liste kopieren: die eigenen Wirkungen landen sonst in derselben
  // Schleife und verstaerken sich selbst, bis der Stapel voll ist.
  for (const w of zuendung.wirkungen.slice()) {
    if (w.art === 'daneben') continue;
    if (w.art === 'vorrat') {
      const v = /** @type {{art: string, menge: number}} */ (w.wert);
      if (wirke(lage, 'vorrat', { art: v.art, menge: v.menge * mal }, 'verstärkt')) getan++;
      continue;
    }
    const regel = WIRKUNGSARTEN[w.art];
    if (!regel) continue;
    const wert = regel.rechnung === 'plus' ? w.wert * mal : Math.pow(w.wert, mal);
    if (wirke(lage, w.art, wert, 'verstärkt')) getan++;
  }
  return getan;
}

/**
 * Den Platz unmittelbar davor verstaerken. Das gewoehnlichste
 * Zusammenspiel-Wappen ueberhaupt - und das, an dem ein Spieler zum ersten
 * Mal merkt, dass er seine Wappen umsortieren kann.
 * @param {any} lage @param {number} [mal]
 */
export function verstaerkeDavor(lage, mal = 1) {
  return wendeNochmalAn(lage, vorherigeZuendung(lage), mal);
}

/**
 * Alles verstaerken, was links steht. Teuer, selten, und der Grund, warum
 * ein solches Wappen auf Platz 5 gehoert und auf Platz 1 nichts tut.
 * @param {any} lage @param {number} [mal]
 */
export function verstaerkeAlleDavor(lage, mal = 1) {
  let getan = 0;
  for (const z of zuendungenDavor(lage)) getan += wendeNochmalAn(lage, z, mal);
  return getan;
}

/**
 * Ein neues Ereignis aus einem Wappen heraus. Geht durch die ganze Reihe,
 * kostet eine Stufe Tiefe und ist damit gesichert.
 * @param {any} lage @param {string} ereignis @param {any} [daten]
 */
export function melde(lage, ereignis, daten = {}) {
  return loeseAusIn(lage, ereignis, daten);
}

/**
 * Melden, dass ein Wappen gezuendet hat - fuer Wappen, die andere Wappen
 * zaehlen. Getrennt von `melde`, weil es das einzige Ereignis ist, das aus
 * dem Fliessband selbst kommt und nicht aus dem Spiel.
 * @param {any} lage @param {any} zuendung
 */
export function meldeZuendung(lage, zuendung) {
  return loeseAusIn(lage, EREIGNIS.wappenZuendet, {
    platz: zuendung.platz, id: zuendung.id, art: zuendung.art,
  });
}
