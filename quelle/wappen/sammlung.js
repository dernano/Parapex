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
 * Daneben liegen `lage.feind` und `lage.runde`: Zusammenhang, den ein Wappen
 * LESEN darf, aber keine Wirkung anfassen kann. Was den Gegner trifft, geht
 * durch `feindGetroffen` - eine Tuer, nicht fuenfzig.
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
import {
  meldeWappen, aufAllem, zuendeErneut, kopiere, PLAETZE, reihe, zuendungenDavor,
} from './fliessband.js';
import {
  salvenDazu, salvenMal, wuchtDazu, wuchtMal, jeSalveMal, kostenDazu, kopienDazu,
  rangDazu, zieheDazu, gib, nimm, habe, verstaerkeDavor, verstaerkeAlleDavor, melde,
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

/*
 * Ein paar Handgriffe, die viele Wappen brauchen. Sie stehen hier oben, damit
 * ein Wappen unten eine Zeile lang bleibt - wer fuenfzig Datensaetze liest,
 * soll in jedem nur die REGEL sehen und nicht dreimal dieselbe Zaehlung.
 */
const besetzte = (l) => l.daten.tuerme.filter((/** @type {any} */ t) => t && t.einheit).length;
const leere = (l) => l.daten.tuerme.filter((/** @type {any} */ t) => !t || !t.einheit).length;
const rechtsVon = (l) => Math.max(0, reihe().length - l.platz - 1);

const alle = [

  // ======================= GEWOEHNLICH (24) =======================
  /*
   * Die gewoehnlichen Wappen sind die QUELLEN. Fast jedes von ihnen macht
   * etwas, das ein selteneres Wappen spaeter lesen kann - Pulver, Marken,
   * Verwuestung, Befehle. Ein Spieler, der nur gewoehnliche Wappen zieht,
   * hat trotzdem eine Maschine; sie laeuft nur langsamer.
   */
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
    id: 'schleifstein', name: 'Wappen des Schleifsteins', zeichen: '🪨', tinktur: '#6a6a62',
    seltenheit: 'gewoehnlich',
    text: 'Jede Stellung zählt ihren Rang um eins höher.',
    hinweis: 'Rangfolgen. Vor dem Löwen gesetzt, wächst er mit.',
    hoert: { [EREIGNIS.blattGelesen]: (lage) => { rangDazu(lage, 1, 'geschliffen'); } },
  },
  {
    /*
     * Vorher verdoppelte der Steinbock den RANG der letzten Stellung. Die
     * Synergie-Matrix hat ihn dafuer verurteilt: er halbierte den Wert fast
     * jedes Partners, weil ein verbogener Rang die Folge zerreisst, auf die
     * alles andere baut. Jetzt zaehlt er wie der Doppeladler - nur am
     * anderen Ende der Reihe.
     */
    id: 'steinbock', name: 'Wappen des Steinbocks', zeichen: '🐐', tinktur: '#5a5242',
    seltenheit: 'gewoehnlich',
    text: 'Die Einheit auf der letzten Stellung zählt für Formationen doppelt.',
    hinweis: 'Mit dem Doppeladler werden aus fünf Stellungen sieben Karten.',
    hoert: {
      [EREIGNIS.blattGelesen]: (lage) => {
        if (lage.daten.turm !== KERN.tuerme - 1) return;
        kopienDazu(lage, 1, 'auf dem Gipfel');
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
    id: 'sperber', name: 'Wappen des Sperbers', zeichen: '🪶', tinktur: '#6a5a4a',
    seltenheit: 'gewoehnlich',
    text: 'Zu jeder Runde eine Handkarte mehr.',
    hinweis: 'Mehr Auswahl heisst bessere Formationen.',
    hoert: { [EREIGNIS.rundeBeginnt]: (lage) => { zieheDazu(lage, 1, 'weiter Blick'); } },
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
    id: 'pflugschar', name: 'Wappen der Pflugschar', zeichen: '🌾', tinktur: '#7a6a3a',
    seltenheit: 'gewoehnlich',
    text: 'Ein Sieg bringt zwei Veteranenmarken.',
    hinweis: 'Wächst über den ganzen Feldzug. Braucht Zeit.',
    hoert: {
      [EREIGNIS.kampfEndet]: (lage) => {
        if (lage.daten.ende !== 'sieg') return;
        gib(lage, 'veteran', 2, 'nach der Schlacht');
      },
    },
  },
  {
    id: 'saatkorn', name: 'Wappen des Saatkorns', zeichen: '🌱', tinktur: '#4a7a3a',
    seltenheit: 'gewoehnlich',
    text: 'Je zwei Veteranenmarken +1 Salve.',
    hinweis: 'Hirsch, Pflugschar. Ohne Marken tut es nichts.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = Math.floor(habe('veteran') / 2);
        if (n) salvenDazu(lage, n, n + ' aus Marken');
      },
    },
  },
  {
    id: 'schmiedehammer', name: 'Wappen des Hammers', zeichen: '🔨', tinktur: '#5a4a42',
    seltenheit: 'gewoehnlich',
    text: 'Jede gesetzte Einheit gibt ein Pulver.',
    hinweis: 'Pulverhorn, Zunder, Brandpfeil, Hammerwerk.',
    hoert: {
      [EREIGNIS.einheitGesetzt]: (lage) => { gib(lage, 'pulver', 1, 'frisch gemahlen'); },
    },
  },
  {
    id: 'muehlrad', name: 'Wappen des Mühlrads', zeichen: '⚙', tinktur: '#4a4a44',
    seltenheit: 'gewoehnlich',
    text: 'Jeder Kartentausch gibt ein Pulver.',
    hinweis: 'Mit der Schlange wird Tauschen zur Pulvermühle.',
    hoert: {
      [EREIGNIS.kartenGetauscht]: (lage) => { gib(lage, 'pulver', 1, 'gemahlen'); },
    },
  },
  {
    id: 'wetzstein', name: 'Wappen des Wetzsteins', zeichen: '🗡', tinktur: '#52524a',
    seltenheit: 'gewoehnlich',
    text: 'Jede ersetzte Einheit gibt zwei Pulver.',
    hinweis: 'Mit dem Eber wird Ersetzen doppelt wert.',
    hoert: {
      [EREIGNIS.einheitErsetzt]: (lage) => { gib(lage, 'pulver', 2, 'abgelöst'); },
    },
  },
  {
    id: 'taube', name: 'Wappen der Taube', zeichen: '🕊', tinktur: '#8a8a82',
    seltenheit: 'gewoehnlich',
    text: 'Jede gezogene Karte über Rang 9 gibt ein Pulver.',
    hinweis: 'Ein Deck aus hohen Rängen wird zur Quelle.',
    hoert: {
      [EREIGNIS.karteGezogen]: (lage) => {
        if (!lage.daten.karte || lage.daten.karte.rang <= 9) return;
        gib(lage, 'pulver', 1, 'hoher Rang');
      },
    },
  },
  {
    id: 'zunder', name: 'Wappen des Zunders', zeichen: '🔥', tinktur: '#8a5a2a',
    seltenheit: 'gewoehnlich',
    text: 'Verbrennt ein Pulver für +20 % Wucht.',
    hinweis: 'Streitet mit dem Pulverhorn um dasselbe Pulver - wer links steht, bekommt es.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        if (!habe('pulver')) return;
        nimm(lage, 'pulver', 1, 'angezündet');
        wuchtMal(lage, 1.2, 'Zunder');
      },
    },
  },
  {
    id: 'kriegshorn', name: 'Wappen des Kriegshorns', zeichen: '📯', tinktur: '#7a6a2a',
    seltenheit: 'gewoehnlich',
    text: 'Zu Kampfbeginn zwei Befehle.',
    hinweis: 'Fahnenträger, Feldzeichen.',
    hoert: {
      [EREIGNIS.kampfBeginnt]: (lage) => { gib(lage, 'befehl', 2, 'zum Angriff'); },
    },
  },
  {
    id: 'glocke', name: 'Wappen der Glocke', zeichen: '🔔', tinktur: '#6a5a2a',
    seltenheit: 'gewoehnlich',
    text: 'Am Rundenende ein Befehl.',
    hinweis: 'Fahnenträger. Wirkt erst ab der zweiten Runde.',
    hoert: { [EREIGNIS.rundeEndet]: (lage) => { gib(lage, 'befehl', 1, 'zur Stunde'); } },
  },
  {
    id: 'fahnentraeger', name: 'Wappen des Fahnenträgers', zeichen: '⚑', tinktur: '#8a3a3a',
    seltenheit: 'gewoehnlich',
    text: 'Je Befehl +1 Salve. Befehle bleiben liegen.',
    hinweis: 'Kriegshorn, Glocke. Anders als Pulver wird nichts verbrannt.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = habe('befehl');
        if (n) salvenDazu(lage, n, n + ' Befehle');
      },
    },
  },
  {
    id: 'stier', name: 'Wappen des Stiers', zeichen: '🐂', tinktur: '#7a3a2a',
    seltenheit: 'gewoehnlich',
    text: 'Stehen alle fünf Stellungen, +3 Salven.',
    hinweis: 'Geschlossene Front, Reine Garde. Niemals mit dem Wolf.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        if (besetzte(lage) < KERN.tuerme) return;
        salvenDazu(lage, 3, 'volle Burg');
      },
    },
  },
  {
    id: 'amboss', name: 'Wappen des Ambosses', zeichen: '⛨', tinktur: '#4a4a52',
    seltenheit: 'gewoehnlich',
    text: 'Je besetzter Stellung +3 Wucht auf jede Salve.',
    hinweis: 'Klein und verlässlich - und alles, was danach multipliziert, trägt es mit.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => { wuchtDazu(lage, 3 * besetzte(lage), 'Amboss'); },
    },
  },
  {
    id: 'grenzstein', name: 'Wappen des Grenzsteins', zeichen: '🪧', tinktur: '#5a5a4a',
    seltenheit: 'gewoehnlich',
    text: 'Je leerer Stellung +6 Wucht auf jede Salve.',
    hinweis: 'Der kleine Bruder des Wolfs - und er addiert, wo der Wolf malnimmt.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => { wuchtDazu(lage, 6 * leere(lage), 'Grenzstein'); },
    },
  },
  {
    id: 'mauerkrone', name: 'Wappen der Mauerkrone', zeichen: '🏰', tinktur: '#6a6a72',
    seltenheit: 'gewoehnlich',
    text: 'Je erkannter Formation +1 Salve.',
    hinweis: 'Belohnt breite Blätter statt eines einzigen grossen Musters.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = lage.daten.formationen.length;
        if (n) salvenDazu(lage, n, n + ' Formationen');
      },
    },
  },
  {
    id: 'fackel', name: 'Wappen der Fackel', zeichen: '🕯', tinktur: '#8a6a2a',
    seltenheit: 'gewoehnlich',
    text: 'Je Salve über der fünften +4 % Wucht.',
    hinweis: 'Wächst mit allem, was Salven gibt. Ganz rechts am stärksten.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const ueber = Math.max(0, lage.daten.salven - 5);
        if (ueber) wuchtMal(lage, 1 + 0.04 * ueber, ueber + ' über fünf');
      },
    },
  },
  {
    id: 'verwuester', name: 'Wappen der Brandschatzung', zeichen: '☄', tinktur: '#8a3a1a',
    seltenheit: 'gewoehnlich',
    text: 'Was über die Stärke des Gegners hinausging, wird zu Verwüstung.',
    hinweis: 'Triumphbogen, Kerbholz. Braucht grosse Salven.',
    hoert: {
      [EREIGNIS.ueberschlag]: (lage) => {
        gib(lage, 'verwuestung', Math.round(lage.daten.ueber), 'Überschlag');
      },
    },
  },
  {
    id: 'kerbholz', name: 'Wappen des Kerbholzes', zeichen: '📏', tinktur: '#6a5a42',
    seltenheit: 'gewoehnlich',
    text: 'Je 5 Verwüstung +1 Wucht auf jede Salve.',
    hinweis: 'Brandschatzung. Wächst über den ganzen Feldzug.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = Math.floor(habe('verwuestung') / 5);
        if (n) wuchtDazu(lage, n, 'aus Asche');
      },
    },
  },

  // ======================= UNGEWOEHNLICH (15) =======================
  /*
   * Hier fangen die Wappen an, EINANDER zu lesen statt nur das Spiel. Ab
   * dieser Stufe lohnt es sich, die Reihenfolge zu ueberdenken, wenn ein
   * neues Wappen dazukommt.
   */
  {
    id: 'wolf', name: 'Wappen des Wolfs', zeichen: '🐺', tinktur: '#3c5a72',
    seltenheit: 'ungewoehnlich',
    text: 'Je leerer Stellung +60 % Gesamtwucht.',
    hinweis: 'Gegen alles, was volle Burgen belohnt. Niemals mit dem Stier.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = leere(lage);
        if (n) wuchtMal(lage, 1 + KERN.wappen.wolf * n, n + ' leere Stellungen');
      },
    },
  },
  {
    id: 'eber', name: 'Wappen des Ebers', zeichen: '🐗', tinktur: '#6b3a2a',
    seltenheit: 'ungewoehnlich',
    text: 'Eine ersetzte Einheit feuert ein letztes Mal.',
    hinweis: 'Wetzstein, Hetzhund. Alles, was Einheiten austauscht.',
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
    hinweis: 'Braucht eine Pulverquelle. Der Zunder links davon nimmt ihm eines weg.',
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
    id: 'hammerwerk', name: 'Wappen des Hammerwerks', zeichen: '🏭', tinktur: '#52463c',
    seltenheit: 'ungewoehnlich',
    text: 'Je zwei Pulver +3 Wucht auf jede Salve - ohne sie zu verbrennen.',
    hinweis: 'Lebt mit dem Pulverhorn zusammen, wenn es LINKS davon steht.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = Math.floor(habe('pulver') / 2);
        if (n) wuchtDazu(lage, 3 * n, 'gelagertes Pulver');
      },
    },
  },
  {
    id: 'brandpfeil', name: 'Wappen des Brandpfeils', zeichen: '🏹', tinktur: '#8a4a2a',
    seltenheit: 'ungewoehnlich',
    text: 'Verbrennt drei Pulver für ×1,6 Gesamtwucht.',
    hinweis: 'Teurer als der Zunder und lohnender. Beide zusammen leeren das Horn.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        if (habe('pulver') < 3) return;
        nimm(lage, 'pulver', 3, 'in Flammen');
        wuchtMal(lage, 1.6, 'Brandpfeil');
      },
    },
  },
  {
    id: 'hetzhund', name: 'Wappen des Hetzhunds', zeichen: '🐕', tinktur: '#6a4a32',
    seltenheit: 'ungewoehnlich',
    text: 'Jeder Treffer gibt ein Pulver.',
    hinweis: 'Einzelschüsse zählen mit - mit dem Eber wird jede Ablösung zur Quelle.',
    hoert: {
      [EREIGNIS.feindGetroffen]: (lage) => { gib(lage, 'pulver', 1, 'gehetzt'); },
    },
  },
  {
    id: 'natter', name: 'Wappen der Natter', zeichen: '🐍', tinktur: '#3a6a3a',
    seltenheit: 'ungewoehnlich',
    text: 'Zu Rundenbeginn werden alle Veteranenmarken zu Pulver.',
    hinweis: 'Verwandelt langsame Währung in schnelle. Vorsicht: das Saatkorn geht leer aus.',
    hoert: {
      [EREIGNIS.rundeBeginnt]: (lage) => {
        const n = habe('veteran');
        if (!n) return;
        nimm(lage, 'veteran', n, 'eingetauscht');
        gib(lage, 'pulver', n, 'aus Marken');
      },
    },
  },
  {
    id: 'kupferpfennig', name: 'Wappen des Kupferpfennigs', zeichen: '🪙', tinktur: '#7a5a3a',
    seltenheit: 'ungewoehnlich',
    text: 'Am Rundenende wird jedes Pulver zu 8 Verwüstung.',
    hinweis: 'Kerbholz, Triumphbogen - der Umweg über die Asche.',
    hoert: {
      [EREIGNIS.rundeEndet]: (lage) => {
        const n = habe('pulver');
        if (!n) return;
        nimm(lage, 'pulver', n, 'vergraben');
        gib(lage, 'verwuestung', 8 * n, 'aus Pulver');
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
  {
    id: 'luchs', name: 'Wappen des Luchses', zeichen: '🐈', tinktur: '#6a5a3a',
    seltenheit: 'ungewoehnlich',
    text: 'Verstärkt das Wappen links von ihm um die Hälfte.',
    hinweis: 'Der kleine Drache. Zwei davon hintereinander sind kein halber Drache, sondern mehr.',
    hoert: aufAllem((lage) => { verstaerkeDavor(lage, 0.5); }),
  },
  {
    id: 'kranich', name: 'Wappen des Kranichs', zeichen: '🦢', tinktur: '#5a6a7a',
    seltenheit: 'ungewoehnlich',
    text: 'Je Wappen links von ihm +2 Salven.',
    hinweis: 'Gehört nach rechts. Auf Platz 1 gibt es nichts.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        if (!lage.platz) return;
        salvenDazu(lage, 2 * lage.platz, lage.platz + ' Wappen links');
      },
    },
  },
  {
    id: 'wappenrock', name: 'Wappen des Wappenrocks', zeichen: '🧥', tinktur: '#5a3a5a',
    seltenheit: 'ungewoehnlich',
    text: 'Je Wappen rechts von ihm +12 % Wucht.',
    hinweis: 'Die Gegenrichtung zum Kranich. Gehört ganz nach links.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = rechtsVon(lage);
        if (n) wuchtMal(lage, 1 + 0.12 * n, n + ' Wappen rechts');
      },
    },
  },
  {
    id: 'steinadler', name: 'Wappen des Steinadlers', zeichen: '🦅', tinktur: '#6a6252',
    seltenheit: 'ungewoehnlich',
    text: 'Die Wucht je Salve zählt dreifach, die Salvenzahl nur zur Hälfte.',
    hinweis: 'Dreht das Verhältnis um - und macht jede weitere Salve danach dreimal so wertvoll.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        jeSalveMal(lage, 3, 'schwerer Schlag');
        salvenMal(lage, 0.5, 'wenige Schüsse');
      },
    },
  },
  {
    id: 'sanduhr', name: 'Wappen der Sanduhr', zeichen: '⏳', tinktur: '#7a6a4a',
    seltenheit: 'ungewoehnlich',
    text: 'In den ersten zwei Runden +70 % Wucht.',
    hinweis: 'Für Läufe, die früh gewinnen wollen. Der Sold steigt mit.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        if (lage.runde > 2) return;
        wuchtMal(lage, 1.7, 'früh und hart');
      },
    },
  },
  {
    id: 'eisenring', name: 'Wappen des Eisenrings', zeichen: '⭕', tinktur: '#4a5254',
    seltenheit: 'ungewoehnlich',
    text: 'Jede Formation gibt noch einmal ihre halben Salven.',
    hinweis: 'Königliche Garde. Je grösser das Muster, desto mehr.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const summe = lage.daten.formationen.reduce((/** @type {number} */ s, /** @type {any} */ f) => s + f.salven, 0);
        const n = Math.floor(summe / 2);
        if (n) salvenDazu(lage, n, 'halbe Formationen');
      },
    },
  },

  // ======================= SELTEN (8) =======================
  /*
   * Die seltenen Wappen arbeiten auf der MASCHINE selbst: sie verstaerken,
   * kopieren, zuenden nach, riegeln ab. Keines von ihnen tut etwas allein -
   * jedes verdoppelt, was der Spieler schon gebaut hat.
   */
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
    id: 'phoenix', name: 'Wappen des Phönix', zeichen: '🔆', tinktur: '#a85a1c',
    seltenheit: 'selten',
    text: 'Lässt das Wappen links von ihm noch einmal zünden.',
    hinweis: 'Anders als der Drache: das Wappen prüft seine Bedingung neu - Pulver wird also erneut verbrannt.',
    hoert: aufAllem((lage) => {
      if (lage.platz <= 0) return;
      zuendeErneut(lage, lage.platz - 1);
    }),
  },
  {
    id: 'basilisk', name: 'Wappen des Basilisken', zeichen: '🦎', tinktur: '#3a5a3a',
    seltenheit: 'selten',
    text: 'Lässt das Wappen links von ihm zweimal nachzünden.',
    hinweis: 'Der grosse Phönix. An den Sperren merkt man, wo die Kette endet.',
    hoert: aufAllem((lage) => {
      if (lage.platz <= 0) return;
      zuendeErneut(lage, lage.platz - 1);
      zuendeErneut(lage, lage.platz - 1);
    }),
  },
  {
    id: 'spiegel', name: 'Wappen des Spiegels', zeichen: '🪞', tinktur: '#6a7a8a',
    seltenheit: 'selten',
    text: 'Führt die Wirkung des Wappens RECHTS von ihm schon jetzt aus.',
    hinweis: 'Das einzige Wappen, das nach rechts sieht. Es zieht eine Wirkung vor den Verstärker.',
    hoert: aufAllem((lage) => {
      if (lage.platz + 1 >= reihe().length) return;
      kopiere(lage, lage.platz + 1);
    }),
  },
  {
    id: 'siegel', name: 'Wappen des Siegels', zeichen: '⛓', tinktur: '#52525a',
    seltenheit: 'selten',
    text: 'Wappen rechts davon zünden erst, wenn der Gegner unter der Hälfte steht.',
    hinweis: 'Ein Riegel. Was dahinter liegt, muss die zweite Hälfte wert sein.',
    hoert: aufAllem((lage) => {
      const f = lage.feind;
      if (f && f.hp * 2 <= (f.maxHp || f.hpMax || f.hp)) return;
      lage.abgebrochen = true;
    }),
  },
  {
    id: 'hydra', name: 'Wappen der Hydra', zeichen: '🐲', tinktur: '#2a5a4a',
    seltenheit: 'selten',
    text: 'Je Zündung links von ihr +2 Salven, ab der dritten +5.',
    hinweis: 'Zählt Zündungen, nicht Wappen - Nachzündungen und Kopien zählen mit.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = zuendungenDavor(lage).length;
        if (!n) return;
        salvenDazu(lage, n >= 3 ? 5 * n : 2 * n, n + ' Zündungen links');
      },
    },
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
  {
    id: 'kriegskasse', name: 'Wappen der Kriegskasse', zeichen: '💰', tinktur: '#7a6a2a',
    seltenheit: 'selten',
    text: 'Am Rundenende so viele Veteranenmarken, wie Formationen standen.',
    hinweis: 'Saatkorn, Hirsch, Natter. Die schnellste Markenquelle im Spiel.',
    hoert: {
      [EREIGNIS.rundeEndet]: (lage) => {
        const n = (lage.daten.formationen || []).length || 1;
        gib(lage, 'veteran', n, 'in die Kasse');
      },
    },
  },

  // ======================= LEGENDAER (3) =======================
  /*
   * Drei Wappen, die nicht eine Zahl aendern, sondern den DURCHLAUF selbst.
   * Sie sind der Grund, warum die Sperren in `fliessband.js` harte Zahlen
   * sind und keine Klugheit.
   */
  {
    id: 'greif', name: 'Wappen des Greifen', zeichen: '🦁‍🦅', tinktur: '#9a6a1c',
    seltenheit: 'legendaer',
    text: 'Verdoppelt alles, was links von ihm steht.',
    hinweis: 'Gehört ganz nach rechts. Auf Platz 1 ist er ein leeres Feld.',
    hoert: aufAllem((lage) => { verstaerkeAlleDavor(lage, 1); }),
  },
  {
    id: 'ouroboros', name: 'Wappen des Ouroboros', zeichen: '♾', tinktur: '#3a2a4a',
    seltenheit: 'legendaer',
    text: 'Lässt die ganze Reihe noch einmal von vorn laufen.',
    hinweis: 'Gehört ganz nach rechts. Die Kette endet an der Tiefensperre, nicht an ihm.',
    hoert: aufAllem((lage) => {
      if (lage.platz + 1 < reihe().length) return;   // erst, wenn alles andere lief
      melde(lage, lage.ereignis, lage.daten);
    }),
  },
  {
    id: 'weltenrad', name: 'Wappen des Weltenrads', zeichen: '☸', tinktur: '#6a4a7a',
    seltenheit: 'legendaer',
    text: 'Je Zündung in diesem Ereignis +6 % Wucht.',
    hinweis: 'Belohnt eine laute Maschine. Mit Ouroboros oder Basilisk wächst es ins Unermessliche.',
    hoert: {
      [EREIGNIS.salveGeplant]: (lage) => {
        const n = lage.gezuendet.filter((/** @type {any} */ z) => !z.abgewiesen).length - 1;
        if (n > 0) wuchtMal(lage, Math.pow(1.06, n), n + ' Zündungen');
      },
    },
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
