/*
 * Die Wappen selbst - als Daten, nicht als Code im Kern.
 *
 * Der Kern kennt keinen einzigen Wappennamen mehr. Er meldet Ereignisse, die
 * Wappen hoeren zu. Wer ein Wappen dazuerfindet, fasst diese Datei an und
 * sonst nichts.
 *
 * WAS IN EINEM WAPPEN STEHT
 *   id, name, zeichen, tinktur  - wer es ist
 *   seltenheit                   - gewoehnlich | ungewoehnlich | selten | legendaer
 *   text                         - was es tut, in einem Satz
 *   hinweis                      - womit es zusammenspielt (Tafel und Belohnung)
 *   hoert                        - Ereignis -> Wirkung
 *
 * DIE LAGE, DIE EIN WAPPEN BEKOMMT
 * `lage.daten` traegt je Ereignis andere Felder. Nur diese darf ein Wappen
 * anfassen, und nur ueber die Wirkungen aus `wirkungen.js`:
 *
 *   blattGelesen        turm, rang, gattung, kopien
 *   formationenErkannt  formationen, salven
 *   salveGeplant        tuerme, posten, formationen, salven, jeSalve, zusatz, faktor
 *   salveGefeuert       wucht, salven
 *   feindGetroffen      wucht, quelle
 *   ueberschlag         ueber, quelle
 *   kartenGetauscht     anzahl, kosten
 *   einheitGesetzt      turm, einheit
 *   einheitErsetzt      turm, alt, neu
 *   rundeBeginnt        runde, ziehen
 *   rundeEndet          runde, wucht
 *   wappenZuendet       platz, id, art
 *
 * WO DIE ZAHLEN STEHEN
 * Die Balance des Kampfes steht in KERN, und das bleibt so. Die Zahl EINES
 * Wappens steht bei diesem Wappen - bei fuenfzig Wappen waere eine zentrale
 * Tabelle nur ein zweiter Ort, an dem dieselbe Zahl steht, und der zweite Ort
 * ist immer der veraltete. Was ein Wappen wert ist, liest man da, wo steht,
 * was es tut.
 */

import { KERN } from '../kern/regeln.js';
import { EREIGNIS } from './ereignisse.js';
import { meldeWappen, aufAllem, zuendeErneut, kopiere, PLAETZE } from './fliessband.js';
import {
  salvenDazu, wuchtMal, kostenDazu, kopienDazu, rangDazu, gib, nimm, habe,
  verstaerkeDavor, verstaerkeAlleDavor,
} from './wirkungen.js';

/*
 * Der Eber laesst eine abgeloeste Einheit ein letztes Mal feuern - aber WIE
 * geschossen wird, weiss der Kampf und nicht das Wappen. Der Kampf reicht
 * seinen Schuss hier herein; so haengen die Wappen nicht am Kampf.
 */
/** @type {(einheit: any, turm: number, quelle: string) => number} */
let feuerEinzeln = () => 0;
/** @param {typeof feuerEinzeln} fn */
export function setzeEinzelschuss(fn) { feuerEinzeln = fn; }

export const SELTENHEITEN = {
  gewoehnlich:   { id: 'gewoehnlich',   name: 'gewöhnlich',   tinktur: '#8a8478' },
  ungewoehnlich: { id: 'ungewoehnlich', name: 'ungewöhnlich', tinktur: '#3c7a6a' },
  selten:        { id: 'selten',        name: 'selten',       tinktur: '#3c5a9a' },
  legendaer:     { id: 'legendaer',     name: 'legendär',     tinktur: '#9a6a1c' },
};

const alle = [

  // ======================= GEWOEHNLICH =======================
  {
    id: 'loewe', name: 'Wappen des Löwen', zeichen: '🦁', tinktur: '#a8791c',
    seltenheit: 'gewoehnlich',
    text: 'Die mittlere Stellung zählt ihren Rang dreifach.',
    hinweis: 'Gleiche Ränge, Rangfolgen.',
    hoert: {
      [EREIGNIS.blattGelesen]: (lage) => {
        if (lage.daten.turm !== Math.floor(KERN.tuerme / 2)) return;
        rangDazu(lage, lage.daten.rang * (KERN.wappen.loewe - 1), 'dreifacher Rang');
      },
    },
  },
  {
    /*
     * Frueher schloss der Doppeladler die Turmreihe zum Ring - sinnvoll,
     * solange Formationen an Nachbarschaft haengen. Seit sie ueber die MENGE
     * gehen, gibt es keine Nachbarn mehr. Er behaelt sein Bild und bekommt
     * die Wirkung, die dazu passt: zwei Koepfe, eine Einheit.
     */
    id: 'doppeladler', name: 'Wappen des Doppeladlers', zeichen: '🦅', tinktur: '#4a4f5c',
    seltenheit: 'gewoehnlich',
    text: 'Die Einheit auf Stellung 1 zählt für Formationen doppelt.',
    hinweis: 'Regiment, Doppelposten, Rangfolge.',
    hoert: {
      [EREIGNIS.blattGelesen]: (lage) => {
        if (lage.daten.turm !== 0) return;
        kopienDazu(lage, 1, 'zwei Köpfe');
      },
    },
  },
  {
    id: 'schlange', name: 'Wappen der Schlange', zeichen: '🐍', tinktur: '#2f6a4a',
    seltenheit: 'gewoehnlich',
    text: 'Die ersten zwei Kartentausche jeder Runde kosten nichts.',
    hinweis: 'Alles, was viele Karten sehen will.',
    hoert: {
      [EREIGNIS.kartenGetauscht]: (lage) => {
        if (lage.daten.schonGetauscht >= KERN.wappen.schlange) return;
        kostenDazu(lage, -KERN.kosten.tauschen, 'freier Tausch');
      },
    },
  },
  {
    id: 'hirsch', name: 'Wappen des Hirschen', zeichen: '🦌', tinktur: '#6a5a3a',
    seltenheit: 'gewoehnlich',
    text: 'Jede Runde eine Veteranenmarke. Je Marke +3 % Wucht.',
    hinweis: 'Alles, was Veteranenmarken liest.',
    hoert: {
      [EREIGNIS.rundeEndet]: (lage) => { gib(lage, 'veteran', 1, 'überlebte Runde'); },
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = habe('veteran');
        if (n) wuchtMal(lage, 1 + 0.03 * n, n + ' Veteranen');
      },
    },
  },
  {
    id: 'schmiedehammer', name: 'Wappen des Hammers', zeichen: '🔨', tinktur: '#5a4a42',
    seltenheit: 'gewoehnlich',
    text: 'Jede gesetzte Einheit gibt ein Pulver.',
    hinweis: 'Pulverhorn, Brandpfeil.',
    hoert: {
      [EREIGNIS.einheitGesetzt]: (lage) => { gib(lage, 'pulver', 1, 'frisch gemahlen'); },
    },
  },
  {
    id: 'stier', name: 'Wappen des Stiers', zeichen: '🐂', tinktur: '#7a3a2a',
    seltenheit: 'gewoehnlich',
    text: 'Stehen alle fünf Stellungen, +3 Salven.',
    hinweis: 'Geschlossene Front, Reine Garde.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const besetzt = lage.daten.tuerme.filter((/** @type {any} */ t) => t && t.einheit).length;
        if (besetzt < KERN.tuerme) return;
        salvenDazu(lage, 3, 'volle Burg');
      },
    },
  },
  {
    id: 'verwuester', name: 'Wappen der Brandschatzung', zeichen: '☄', tinktur: '#8a3a1a',
    seltenheit: 'gewoehnlich',
    text: 'Was über die Stärke des Gegners hinausging, wird zu Verwüstung.',
    hinweis: 'Triumphbogen. Braucht große Salven.',
    hoert: {
      [EREIGNIS.ueberschlag]: (lage) => {
        gib(lage, 'verwuestung', Math.round(lage.daten.ueber), 'Überschlag');
      },
    },
  },

  // ======================= UNGEWOEHNLICH =======================
  {
    id: 'wolf', name: 'Wappen des Wolfs', zeichen: '🐺', tinktur: '#3c5a72',
    seltenheit: 'ungewoehnlich',
    text: 'Je leerer Stellung +60 % Gesamtwucht.',
    hinweis: 'Gegen alles, was volle Burgen belohnt. Niemals mit dem Stier.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const leer = lage.daten.tuerme.filter((/** @type {any} */ t) => !t || !t.einheit).length;
        if (!leer) return;
        wuchtMal(lage, 1 + KERN.wappen.wolf * leer, leer + ' leere Stellungen');
      },
    },
  },
  {
    id: 'eber', name: 'Wappen des Ebers', zeichen: '🐗', tinktur: '#6b3a2a',
    seltenheit: 'ungewoehnlich',
    text: 'Eine ersetzte Einheit feuert ein letztes Mal.',
    hinweis: 'Alles, was Einheiten austauscht.',
    hoert: {
      [EREIGNIS.einheitErsetzt]: (lage) => {
        if (lage.probe || !lage.daten.alt) return;
        feuerEinzeln(lage.daten.alt, lage.daten.turm, 'Wappen des Ebers');
      },
    },
  },
  {
    id: 'pulverhorn', name: 'Wappen des Pulverhorns', zeichen: '✸', tinktur: '#4a4a52',
    seltenheit: 'ungewoehnlich',
    text: 'Verbrennt alles Pulver: je Pulver +1 Salve.',
    hinweis: 'Braucht ein Wappen, das Pulver macht. Ohne eines tut es nichts.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = habe('pulver');
        if (!n) return;
        nimm(lage, 'pulver', n, 'verbrannt');
        salvenDazu(lage, n, n + ' Pulver');
      },
    },
  },
  {
    id: 'rabe', name: 'Wappen des Raben', zeichen: '🐦‍⬛', tinktur: '#2a2a32',
    seltenheit: 'ungewoehnlich',
    text: 'Führt die Wirkung des ersten Wappens ein zweites Mal aus.',
    hinweis: 'Wertlos auf Platz 1. Setze links, was du doppelt willst.',
    hoert: aufAllem((lage) => {
      if (lage.platz === 0) return;
      kopiere(lage, 0);
    }),
  },

  // ======================= SELTEN =======================
  {
    /*
     * Der Drache behauptete seit dem Salvenumbau eine Wirkung, die es nicht
     * mehr gab: `retriggerFaktor` wurde nirgends gelesen. Er bekommt jetzt,
     * was er immer versprochen hat - Verdopplung -, nur an einer Stelle, die
     * es wirklich gibt.
     */
    id: 'drache', name: 'Wappen des Drachen', zeichen: '🐉', tinktur: '#7a2a3a',
    seltenheit: 'selten',
    text: 'Verdoppelt, was das Wappen links von ihm bewirkt hat.',
    hinweis: 'Je stärker der linke Nachbar, desto stärker der Drache.',
    hoert: aufAllem((lage) => { verstaerkeDavor(lage, 1); }),
  },
  {
    id: 'phoenix', name: 'Wappen des Phönix', zeichen: '🔥', tinktur: '#a85a1c',
    seltenheit: 'selten',
    text: 'Lässt das Wappen links von ihm noch einmal zünden.',
    hinweis: 'Anders als der Drache: das Wappen prüft seine Bedingung neu.',
    hoert: aufAllem((lage) => {
      if (lage.platz <= 0) return;
      zuendeErneut(lage, lage.platz - 1);
    }),
  },
  {
    id: 'siegel', name: 'Wappen des Siegels', zeichen: '⛓', tinktur: '#52525a',
    seltenheit: 'selten',
    text: 'Wappen rechts davon zünden erst, wenn der Gegner unter der Hälfte steht.',
    hinweis: 'Ein Riegel. Was dahinter liegt, muss die zweite Hälfte wert sein.',
    hoert: aufAllem((lage) => {
      const f = lage.feind;
      if (f && f.hp * 2 <= f.hpMax) return;
      lage.abgebrochen = true;
    }),
  },
  {
    id: 'triumphbogen', name: 'Wappen des Triumphbogens', zeichen: '⛫', tinktur: '#8a7a4a',
    seltenheit: 'selten',
    text: 'Je 100 Verwüstung +1 Salve.',
    hinweis: 'Braucht die Brandschatzung. Wächst über den ganzen Feldzug.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = Math.floor(habe('verwuestung') / 100);
        if (n) salvenDazu(lage, n, n + '00 Verwüstung');
      },
    },
  },

  // ======================= LEGENDAER =======================
  {
    id: 'greif', name: 'Wappen des Greifen', zeichen: '🦁‍🦅', tinktur: '#9a6a1c',
    seltenheit: 'legendaer',
    text: 'Verdoppelt alles, was links von ihm steht.',
    hinweis: 'Gehört ganz nach rechts. Auf Platz 1 ist er ein leeres Feld.',
    hoert: aufAllem((lage) => { verstaerkeAlleDavor(lage, 1); }),
  },
];

for (const w of alle) meldeWappen(w);

/** @type {Record<string, any>} */
export const WAPPEN = {};
for (const w of alle) WAPPEN[w.id] = w;

export const WAPPEN_LISTE = alle.map(w => w.id);
export const WAPPEN_PLAETZE = PLAETZE;

/** Alle Wappen einer Seltenheit - fuer das Angebot nach einem Kampf. */
export function wappenNach(seltenheit) {
  return alle.filter(w => w.seltenheit === seltenheit).map(w => w.id);
}
