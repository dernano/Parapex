/*
 * Das Kriegsbuch: EINE Stelle, an der jeder Begriff erklaert wird.
 *
 * Der teuerste Fehler, den eine Oberflaeche machen kann, ist eine Zahl ohne
 * Bedeutung. `BEDROHUNG 3` ist keine Auskunft - es ist eine Vokabel, die der
 * Spieler auswendig lernen soll, und wer sie nicht auswendig kann, klickt
 * eben irgendwas. Dasselbe gilt fuer Vorbereitung, Salven, Tatendrang und
 * jedes Wappen.
 *
 * Darum hat hier jeder Begriff drei Stufen, und die dritte ist die wichtigste:
 *
 *   SATZ    was es ist, in einem Satz
 *   LANG    warum es so ist, in drei bis vier Zeilen
 *   JETZT   was es GERADE BEI DIESEM SPIELER bedeutet
 *
 * Die dritte Stufe ist der Grund, warum das hier im Kern steht und nicht in
 * der Oberflaeche: nur der Kern weiss, was ein Heerfuehrer bei Bedrohung 4
 * dazubekommt, wie viele Salven diese Aufstellung gerade schiesst und welches
 * Wappen in der letzten Runde nichts getan hat. Die Oberflaeche malt, was
 * hier herauskommt; sie rechnet nichts nach.
 *
 * Und es steht an EINER Stelle, weil derselbe Begriff an fuenf Stellen
 * auftaucht - in der Kopfleiste, im Hinweis, auf der Belagerungskarte, im
 * Heerlager, im Kriegsbuch. Fuenf Erklaerungen desselben Wortes sind vier zu
 * viel, und drei davon sind nach dem naechsten Umbau falsch.
 */

import { KERN } from './regeln.js';
import { FORMATIONEN, formationsSalven } from './formationen.js';
import { berechneWucht } from './wucht.js';
import { derKampf } from './kampf.js';
import { derLauf } from './lauf.js';
import { WAPPEN, WAPPEN_PLAETZE } from '../wappen/sammlung.js';
import { VORRAT_ARTEN } from '../wappen/ereignisse.js';
import { bestand, sichtbarerVorrat } from '../wappen/vorrat.js';
import { vorbereitungslage } from '../feldzug/heerlager.js';
import { dieBelagerung, belagerungslage, heerfuehrerRegeln } from '../feldzug/belagerung.js';
import { BOSSREGELN } from '../feldzug/bossregeln.js';
import { DIVISIONEN, BEDROHUNG_MAX, bedrohungsstufe, JE_BEDROHUNG } from '../feldzug/gegner.js';

/** Die Kapitel des Kriegsbuchs. Mehr als vier waeren ein Nachschlagewerk. */
export const KAPITEL = {
  kampf:      { id: 'kampf',      name: 'Kampf',      zeichen: '⚔' },
  wappen:     { id: 'wappen',     name: 'Wappen',     zeichen: '⚜' },
  belagerung: { id: 'belagerung', name: 'Belagerung', zeichen: '⛫' },
  vorraete:   { id: 'vorraete',   name: 'Vorräte',    zeichen: '✸' },
};

/** Wie viel Wucht die Burg gerade schiesst, ohne etwas zu veraendern. */
function jetzigeSalve() {
  const k = derKampf;
  if (!k || k.ende) return null;
  return berechneWucht(k.tuerme, k.wappen);
}

export const BEGRIFFE = {

  /* ---------------- Kampf ---------------- */
  wucht: {
    id: 'wucht', name: 'Wucht', kapitel: 'kampf',
    satz: 'Die Zahl, mit der du den Gegner niederringst.',
    lang: 'Jede Einheit hat einen Rang, und der Rang IST ihre Wucht. Was auf '
      + 'deinen fünf Türmen steht, wird zusammengezählt, mit der Salvenzahl '
      + 'vervielfacht und von der Stärke des Gegners abgezogen. Es gibt keine '
      + 'Verteidigung und keine Obergrenze — nur die Frage, ob es in fünf '
      + 'Runden reicht.',
    jetzt: () => {
      const r = jetzigeSalve();
      if (!r) return null;
      return {
        wert: String(r.wucht),
        zeilen: [r.jeSalve + ' Wucht je Salve × ' + r.salven + ' Salven'],
      };
    },
  },

  salven: {
    id: 'salven', name: 'Salven', kapitel: 'kampf',
    satz: 'Wie oft deine Burg feuert. Jede Salve ist ein Schuss, den du siehst.',
    lang: 'Eine Grundsalve hat jede besetzte Stellung. Alles Weitere kommt aus '
      + 'Formationen und Wappen. Salven sind kein Rechentrick: wer «7 Salven» '
      + 'liest, sieht sieben Mal feuern.',
    jetzt: () => {
      const r = jetzigeSalve();
      if (!r) return null;
      const aus = r.formationen.map(f => f.name + ' +' + f.salven);
      return { wert: String(r.salven), zeilen: aus.length ? aus : ['Nur die Grundsalve.'] };
    },
  },

  tatendrang: {
    id: 'tatendrang', name: 'Tatendrang', kapitel: 'kampf',
    satz: 'Die einzige Währung im Kampf. Fünf je Runde, und was übrig bleibt, verfällt.',
    lang: 'Eine Einheit setzen kostet 1, eine ersetzen kostet 1, eine Handkarte '
      + 'tauschen kostet 1, ein Wappen umhängen kostet 1. Es gibt kein freies '
      + 'Abwerfen — genau deshalb ist eine mittelmäßige Hand eine Entscheidung '
      + 'und kein Ärgernis.',
    jetzt: () => {
      const k = derKampf;
      if (!k || k.ende) return null;
      return {
        wert: k.tatendrang + ' / ' + k.tatendrangMax,
        zeilen: [
          'Einsetzen ' + KERN.kosten.einsetzen + ' · Ersetzen ' + KERN.kosten.ersetzen
            + ' · Tauschen ' + KERN.kosten.tauschen + ' · Umhängen ' + KERN.kosten.umhaengen,
        ],
      };
    },
  },

  formation: {
    id: 'formation', name: 'Formation', kapitel: 'kampf',
    satz: 'Ein Muster in deinen fünf Stellungen. Formationen geben Salven.',
    lang: 'Gleiche Gattungen, gleiche Ränge, eine Rangfolge. DIE STELLUNG DER '
      + 'TÜRME ZÄHLT NICHT — 7/3/6/12/5 ist dieselbe Folge wie 5/6/7. Aus jeder '
      + 'der drei Familien gilt nur die höchste erreichte; fünf gleiche '
      + 'Gattungen sind eine Reine Garde und nicht zusätzlich ein Regiment.',
    jetzt: () => {
      const r = jetzigeSalve();
      if (!r) return null;
      if (!r.formationen.length) return { wert: 'keine', zeilen: ['Noch kein Muster steht.'] };
      return {
        wert: r.formationen.length + ' erkannt',
        zeilen: r.formationen.map(f => f.name + ' · +' + f.salven + ' Salven'),
      };
    },
  },

  formationsstufe: {
    id: 'formationsstufe', name: 'Formationsstufe', kapitel: 'kampf',
    satz: 'Wie weit eine Formation ausgebaut ist. Jede Stufe gibt ihr mehr Salven.',
    lang: 'Der Kriegsrat im Heerlager hebt Stufen, und sie halten den ganzen '
      + 'Feldzug. Das ist die langsame Achse: eine Stufe auf einer Formation, '
      + 'die du ohnehin jede Runde triffst, ist mehr wert als eine bessere Karte.',
    jetzt: () => {
      if (!derLauf) return null;
      const erhoben = FORMATIONEN
        .filter(f => (derLauf.formationsStufen[f.id] || 1) > 1)
        .map(f => f.name + ' · Stufe ' + derLauf.formationsStufen[f.id]
          + ' (+' + (formationsSalven(f, derLauf.formationsStufen[f.id]) - f.salven) + ' Salven)');
      return {
        wert: erhoben.length ? erhoben.length + ' erhoben' : 'alle auf Stufe 1',
        zeilen: erhoben.length ? erhoben : ['Der Kriegsrat im Heerlager hebt Stufen.'],
      };
    },
  },

  /* ---------------- Wappen ---------------- */
  wappen: {
    id: 'wappen', name: 'Wappen', kapitel: 'wappen',
    satz: 'Fünf Plätze. Wappen brechen Regeln, statt Zahlen zu heben.',
    lang: 'Ein Wappen gibt selten einfach mehr Wucht. Es schafft Vorräte, es '
      + 'verdoppelt, was ein anderes tut, es zündet einen Platz noch einmal. '
      + 'Ein einzelnes Wappen ist deshalb oft schwach — fünf, die ineinander '
      + 'greifen, sind eine Maschine.',
    jetzt: () => {
      if (!derLauf) return null;
      const w = derLauf.wappen;
      return {
        wert: w.length + ' / ' + WAPPEN_PLAETZE,
        zeilen: w.length
          ? w.map((id, i) => 'Platz ' + (i + 1) + ': ' + WAPPEN[id].name.replace('Wappen ', ''))
          : ['Noch keines. Wappen kommen als Belohnung nach einem Kampf.'],
      };
    },
  },

  wappenreihe: {
    id: 'wappenreihe', name: 'Wappenreihenfolge', kapitel: 'wappen',
    satz: 'Wappen wirken von links nach rechts. Ihre Reihenfolge ändert ihre Wirkung.',
    lang: 'Ein Ereignis läuft durch die fünf Plätze, einen nach dem anderen. '
      + 'Jeder Platz sieht die Lage so, wie der Platz vor ihm sie hinterlassen '
      + 'hat. Ein Wappen, das verdoppelt, was links von ihm geschah, ist auf '
      + 'Platz 4 etwas ganz anderes als auf Platz 2 — (s+10)×3 ist nicht '
      + 's×3+10. Zieh die Schilde, um sie umzuhängen.',
    jetzt: () => {
      if (!derLauf || derLauf.wappen.length < 2) return null;
      const w = derLauf.wappen;
      return {
        wert: w.map((_, i) => i + 1).join(' → '),
        zeilen: [w.map(id => WAPPEN[id].name.replace('Wappen ', '')).join('  →  ')],
      };
    },
  },

  /* ---------------- Belagerung ---------------- */
  bedrohung: {
    id: 'bedrohung', name: 'Bedrohung', kapitel: 'belagerung',
    satz: 'Wie gut sich der Heerführer auf den finalen Sturm vorbereiten konnte.',
    lang: 'Je mehr Teile des feindlichen Heeres du abfängst, desto weniger '
      + 'erreicht ihn — aber desto weniger Zeit hast du selbst. Jede Truppe, '
      + 'die du ziehen lässt, hebt die Bedrohung: der Heerführer wird stärker, '
      + 'und ab einer gewissen Stufe bekommt er zusätzliche Regeln.',
    jetzt: () => {
      const b = dieBelagerung;
      if (!b) return null;
      const st = bedrohungsstufe(b.bedrohung);
      const naechst = b.bedrohung < BEDROHUNG_MAX ? bedrohungsstufe(b.bedrohung + 1) : null;
      const zeilen = [st.text,
        'Der Heerführer schlägt um ' + Math.round(JE_BEDROHUNG * b.bedrohung * 100)
          + ' % härter zu.'];
      for (const id of heerfuehrerRegeln(b)) {
        if (BOSSREGELN[id]) zeilen.push('☠ ' + BOSSREGELN[id].name + ': ' + BOSSREGELN[id].text);
      }
      return {
        wert: b.bedrohung + ' / ' + BEDROHUNG_MAX,
        titel: st.name,
        zeilen,
        naechste: naechst ? {
          titel: 'Nächste Stufe — ' + naechst.stufe + ' · ' + naechst.name,
          zeilen: [naechst.text].concat(naechst.regel && BOSSREGELN[naechst.regel]
            ? ['☠ Der Heerführer erhält: ' + BOSSREGELN[naechst.regel].name]
            : []),
        } : null,
      };
    },
  },

  vorbereitung: {
    id: 'vorbereitung', name: 'Vorbereitung', kapitel: 'belagerung',
    satz: 'Zeit, die du gewinnst, wenn du nicht jede feindliche Truppe angreifst.',
    lang: 'Du gibst sie im Heerlager aus — beim Herold für Wappen, in der '
      + 'Feldschmiede für Türme, beim Kriegsrat für Formationsstufen. '
      + 'Vorbereitung und Bedrohung sind dieselbe Münze von zwei Seiten: du '
      + 'kaufst die eine mit der anderen.',
    jetzt: () => {
      const v = vorbereitungslage();
      if (!v) return null;
      const zeilen = [];
      if (v.dienste.length) {
        zeilen.push('Am nächsten Halt: ' + v.dienste.map(d => d.name).join(' und ') + '.');
      } else if (v.haendler) {
        zeilen.push('Am nächsten Halt steht nur der Händler — der nimmt Sold, keine Vorbereitung.');
      }
      if (v.reicht.length) {
        zeilen.push('Reicht für: ' + v.reicht.map(p => p.name + ' (' + p.preis + ')').join(', ') + '.');
      } else {
        zeilen.push('Reicht noch für nichts davon.');
      }
      return {
        wert: String(v.punkte),
        zeilen,
        naechste: v.naechstes ? { titel: 'Noch ' + v.naechstes.fehlt + ' mehr',
          zeilen: [v.naechstes.name + ' kostet ' + v.naechstes.preis + '.'] } : null,
      };
    },
  },

  division: {
    id: 'division', name: 'Division', kapitel: 'belagerung',
    satz: 'Eine Abteilung des anrückenden Heeres. Jede trägt ein Merkmal.',
    lang: 'Schlägst du sie, nimmt das dem Heerführer ihr Merkmal. Lässt du sie '
      + 'durch, gibt es ihm — dafür gewinnst du Vorbereitung und sparst eine '
      + 'Schlacht. Was du ziehen lässt, kämpft später an seiner Seite.',
    jetzt: () => {
      const l = belagerungslage();
      if (!l) return null;
      return {
        wert: l.divisionen.filter(d => d.zustand === 'offen').length + ' offen',
        zeilen: l.divisionen.map(d => d.name + ' — '
          + (d.zustand === 'geschlagen' ? 'geschlagen'
            : d.zustand === 'durch' ? 'durchgekommen: ' + DIVISIONEN[d.id].gibt
            : 'rückt an')),
      };
    },
  },

  heerfuehrer: {
    id: 'heerfuehrer', name: 'Heerführer', kapitel: 'belagerung',
    satz: 'Der Anführer des Heeres. Die letzte Schlacht dieser Ante.',
    lang: 'Er wird nicht gewürfelt, er wird GEBAUT — von dir. Er hat eine eigene '
      + 'Regel, dazu jede Division, die du hast durchkommen lassen, und was die '
      + 'Bedrohung ihm mitbringt. Er steht vom ersten Augenblick an sichtbar da.',
    jetzt: () => {
      const l = belagerungslage();
      if (!l) return null;
      return {
        wert: l.heerfuehrer.name,
        zeilen: l.heerfuehrer.regeln
          .map(id => (BOSSREGELN[id] ? '☠ ' + BOSSREGELN[id].name + ': ' + BOSSREGELN[id].text : id)),
      };
    },
  },

  finalerSturm: {
    id: 'finalerSturm', name: 'Finaler Sturm', kapitel: 'belagerung',
    satz: 'Die letzte Schlacht einer Ante — gegen alles, was du hast durchkommen lassen.',
    lang: 'Was in der Vorschau steht, ist kein Ausblick, sondern der Gegner. '
      + 'Jede Wahl auf der Belagerungskarte schreibt ihn um, und zwar sofort.',
    jetzt: () => {
      const l = belagerungslage();
      if (!l) return null;
      return {
        wert: l.heerfuehrer.name + ' · ' + l.heerfuehrer.hp + ' Stärke',
        zeilen: [l.heerfuehrer.regeln.length + ' Regeln · Bedrohung ' + l.bedrohung
          + ' von ' + l.bedrohungMax],
      };
    },
  },

  /* ---------------- Vorräte ---------------- */
  veteran: vorratBegriff('veteran',
    'Marken für überlebte Runden und geschlagene Heere. Sie bleiben den ganzen Feldzug.',
    'Es gibt sie nur, weil ein Wappen sie schafft — der Hirsch, die Kriegskasse, '
    + 'die Pflugschar. Und sie nützen nur, weil ein anderes sie liest.'),
  pulver: vorratBegriff('pulver',
    'Wird im Kampf gemacht und im Kampf verbraucht. Nach dem Kampf ist es weg.',
    'Der Hammer macht Pulver beim Setzen, das Mühlrad beim Tauschen, der '
    + 'Hetzhund bei jedem Treffer. Das Pulverhorn verbrennt alles auf einmal.'),
  verwuestung: vorratBegriff('verwuestung',
    'Was über die Stärke des Gegners hinausging. Sie wächst über den ganzen Feldzug.',
    'Nur die Brandschatzung sammelt sie ein, und nur Kerbholz und Triumphbogen '
    + 'lesen sie. Ohne die Brandschatzung verpufft jeder Überschlag.'),
  befehl: vorratBegriff('befehl',
    'Wird zu Kampfbeginn und am Rundenende ausgegeben und nicht verbraucht.',
    'Kriegshorn und Glocke geben Befehle, der Fahnenträger macht Salven daraus. '
    + 'Anders als Pulver bleiben sie den Kampf über liegen.'),
};

/** Die vier Vorraete sind gleich gebaut - also auch gleich erklaert. */
function vorratBegriff(art, satz, lang) {
  const v = VORRAT_ARTEN[art];
  return {
    id: art, name: v.name, kapitel: 'vorraete', zeichen: v.zeichen,
    satz, lang,
    jetzt: () => {
      const n = bestand(art);
      const leser = derLauf
        ? derLauf.wappen.filter(id => liestVorrat(id, art)).map(id => WAPPEN[id].name.replace('Wappen ', ''))
        : [];
      return {
        wert: String(n),
        zeilen: leser.length
          ? ['In deinem Gestell: ' + leser.join(', ') + '.']
          : ['Kein Wappen in deinem Gestell liest das gerade.'],
      };
    },
  };
}

/*
 * Welche Wappen einen Vorrat ueberhaupt anfassen. Gelesen wird aus Text und
 * Hinweis - die stehen ohnehin da, und sie sind die einzige Beschreibung, die
 * garantiert mit der Wirkung mitwandert. Eine zweite Liste von Hand gepflegt
 * waere nach dem naechsten neuen Wappen falsch.
 */
export function liestVorrat(wappenId, art) {
  const w = WAPPEN[wappenId];
  if (!w) return false;
  const name = VORRAT_ARTEN[art].name.toLowerCase();
  const stamm = name.slice(0, Math.min(6, name.length));
  return (w.text + ' ' + (w.hinweis || '')).toLowerCase().includes(stamm);
}

export const BEGRIFF_LISTE = Object.keys(BEGRIFFE);

/** @param {string} id */
export function begriff(id) { return BEGRIFFE[id] || null; }

/**
 * Was ein Begriff GERADE bedeutet - oder null, wenn er hier nichts zu sagen
 * hat (kein Kampf, kein Feldzug, kein Vorrat).
 * @param {string} id
 */
export function begriffJetzt(id) {
  const b = BEGRIFFE[id];
  if (!b || !b.jetzt) return null;
  try { return b.jetzt(); } catch (e) { return null; }
}

/** Alle Begriffe eines Kapitels - fuer das Kriegsbuch. */
export function kapitelBegriffe(kapitel) {
  return BEGRIFF_LISTE.filter(id => BEGRIFFE[id].kapitel === kapitel).map(id => BEGRIFFE[id]);
}

/** Was gerade an Vorraeten dasteht, mit Erklaerung - fuer die Leiste. */
export function vorratsBegriffe() {
  return sichtbarerVorrat().map(v => ({ ...v, begriff: BEGRIFFE[v.id] || null }));
}


