/*
 * Die Belagerung: der Ablauf einer Ante.
 *
 * Hier steht, WAS gerade zur Wahl steht und was eine Wahl kostet. Kein
 * Dokument, kein Zeichnen - die Oberflaeche fragt `offeneWahlen()` und malt,
 * was zurueckkommt.
 *
 * DAS KAMPFBUDGET ist die harte Regel, an der alles haengt. Eine Ante hat
 * mindestens zwei und hoechstens fuenf Kaempfe. Nicht ungefaehr: GENAU. Der
 * Aufbau sorgt von selbst fuer die Obergrenze (Vorhut 1 + drei Divisionen +
 * Heerfuehrer = 5), die Untergrenze muss erzwungen werden - wer alles
 * durchlaesst, kaeme sonst mit einem einzigen Kampf durch die Ante, und die
 * ganze Entscheidung waere keine.
 *
 * ZWEI WAEHRUNGEN, und sie sind dieselbe Muenze von zwei Seiten:
 *
 *   BEDROHUNG      steigt, wenn man etwas durchlaesst. Sie macht den
 *                  Heerfuehrer nicht nur groesser, sondern ANDERS - jede
 *                  durchgelassene Division gibt ihm ihre Regel.
 *   VORBEREITUNG   steigt genauso. Sie ist das, was man im Heerlager ausgibt.
 *
 * Man kauft also Vorbereitung mit Bedrohung, und beides ist sichtbar, bevor
 * man sich entscheidet. Das ist der Unterschied zwischen einer Entscheidung
 * und einem Wuerfel.
 */

import { baueRegeln } from './bossregeln.js';
import {
  DIVISIONEN, HEERFUEHRER, VORHUTEN, dieAnte, JE_BEDROHUNG, BEDROHUNG_MAX,
  bedrohungsstufe, bedrohungsRegeln,
} from './gegner.js';

/* Das Budget. Beide Zahlen sind hart und werden geprueft, nicht gehofft. */
export const KAEMPFE_MIN = 2;
export const KAEMPFE_MAX = 5;

export const ABSCHNITTE = {
  vorhut:      { id: 'vorhut',      name: 'Vorhut' },
  divisionen:  { id: 'divisionen',  name: 'Divisionen' },
  lager:       { id: 'lager',       name: 'Heerlager' },
  heerfuehrer: { id: 'heerfuehrer', name: 'Heerführer' },
  vorbei:      { id: 'vorbei',      name: 'Vorbei' },
};

export let dieBelagerung = null;

/** @param {number} [anteNr] */
export function neueBelagerung(anteNr = 1) {
  const ante = dieAnte(anteNr);
  dieBelagerung = {
    ante: ante.id,
    nr: ante.nr,
    abschnitt: ABSCHNITTE.vorhut.id,
    /*
     * Eine Bedrohung von eins zu Beginn, nicht null: ein Heer, das anrueckt,
     * ist schon eine Bedrohung. Und mit vier Gelegenheiten, sie zu erhoehen,
     * reicht die Spanne dann genau bis fuenf.
     */
    bedrohung: 1,
    vorbereitung: 0,
    /*
     * WARUM steht die Bedrohung auf drei? Ohne diese Liste ist das nicht zu
     * beantworten - und der Spieler soll es beantwortet bekommen, nicht
     * zurueckrechnen muessen. Jede Aenderung mit ihrem Grund, in der
     * Reihenfolge des Geschehens.
     */
    /** @type {{wert: number, auf: number, grund: string}[]} */
    bedrohungsWeg: [],
    vorhut: { id: ante.vorhut, zustand: 'offen' },
    divisionen: ante.divisionen.map(id => ({ id, zustand: 'offen' })),
    kaempfe: 0,
    /** @type {any} der Gegner, der gerade auf dem Feld steht */
    imKampf: null,
    /** @type {string|null} */
    ende: null,
    /** @type {string[]} was geschah, in Reihenfolge - fuer die Karte und das Speichern */
    verlauf: [],
  };
  return dieBelagerung;
}

export function raeumeBelagerung() { dieBelagerung = null; }

/* ---------- Was noch kommen kann ---------- */

/** Wie viele Kaempfe diese Ante noch MINDESTENS bringt. */
export function kaempfeNochMindestens() {
  const b = dieBelagerung;
  if (!b) return 0;
  return b.abschnitt === ABSCHNITTE.vorbei.id ? 0 : 1;   // der Heerfuehrer immer
}

/** Wie viele Kaempfe diese Ante noch HOECHSTENS bringt. */
export function kaempfeNochHoechstens() {
  const b = dieBelagerung;
  if (!b || b.abschnitt === ABSCHNITTE.vorbei.id) return 0;
  const vorhut = b.vorhut.zustand === 'offen' ? 1 : 0;
  const offen = b.divisionen.filter(d => d.zustand === 'offen').length;
  return vorhut + offen + 1;
}

/*
 * Darf hier noch etwas durchgelassen werden?
 *
 * Nur, wenn danach noch genug Gelegenheiten bleiben, um auf die Untergrenze
 * zu kommen. Das ist der Sackgassenschutz, und er wird GERECHNET: was bliebe,
 * wenn der Spieler ab hier alles durchliesse? Genau eine Schlacht, die des
 * Heerfuehrers. Wer also bei null Kaempfen vor der letzten Division steht,
 * muss sie stellen.
 */
export function darfDurchlassen() {
  const b = dieBelagerung;
  if (!b) return false;
  const offen = (b.vorhut.zustand === 'offen' ? 1 : 0)
    + b.divisionen.filter(d => d.zustand === 'offen').length;
  // Eine Gelegenheit weniger - und am Ende steht immer der Heerfuehrer.
  const hoechstensNoch = Math.max(0, offen - 1) + 1;
  return b.kaempfe + hoechstensNoch >= KAEMPFE_MIN;
}

/**
 * Was jetzt zur Wahl steht. Jede Wahl traegt ihren Preis mit - die Oberflaeche
 * soll nichts ausrechnen muessen, was hier schon bekannt ist.
 */
export function offeneWahlen() {
  const b = dieBelagerung;
  if (!b || b.ende) return [];
  const ante = dieAnte(b.nr);

  if (b.abschnitt === ABSCHNITTE.vorhut.id) {
    const v = VORHUTEN[b.vorhut.id];
    const durchlassenGeht = darfDurchlassen();
    return [
      { art: 'abfangen', ziel: 'vorhut', name: v.name, zeichen: v.zeichen,
        text: v.text, wirkung: v.abfangen, kampf: true,
        bedrohung: -1, vorbereitung: 0 },
      { art: 'durchlassen', ziel: 'vorhut', name: v.name, zeichen: '⌛',
        text: v.ziehenLassen, wirkung: 'Zwei Vorbereitung, aber das Heer weiss, was es erwartet.',
        kampf: false, bedrohung: +1, vorbereitung: +2,
        gesperrt: durchlassenGeht ? null : SPERRE },
    ];
  }

  if (b.abschnitt === ABSCHNITTE.divisionen.id) {
    const durchlassenGeht = darfDurchlassen();
    const wahlen = [];
    b.divisionen.forEach((d, i) => {
      if (d.zustand !== 'offen') return;
      const def = DIVISIONEN[d.id];
      wahlen.push({ art: 'abfangen', ziel: 'division', nr: i, name: def.name, zeichen: def.zeichen,
        text: def.text, wirkung: def.nimmt,
        kampf: true, bedrohung: 0, vorbereitung: 0 });
      wahlen.push({ art: 'durchlassen', ziel: 'division', nr: i, name: def.name,
        zeichen: '⌛',
        text: 'Sie ziehen an der Burg vorbei und stehen später neben dem Heerführer.',
        wirkung: def.gibt,
        kampf: false, bedrohung: +1, vorbereitung: +1,
        gesperrt: durchlassenGeht ? null : SPERRE });
    });
    return wahlen;
  }

  if (b.abschnitt === ABSCHNITTE.lager.id) {
    return [{ art: 'aufbrechen', ziel: 'lager', name: 'Aufbrechen', zeichen: '⚑',
      text: 'Das Lager abbrechen und weiterziehen.', wirkung: '', kampf: false,
      bedrohung: 0, vorbereitung: 0 }];
  }

  if (b.abschnitt === ABSCHNITTE.heerfuehrer.id) {
    const h = HEERFUEHRER[ante.heerfuehrer];
    return [{ art: 'stellen', ziel: 'heerfuehrer', name: h.name, zeichen: h.zeichen,
      text: h.text, wirkung: 'Die letzte Schlacht dieser Ante.', kampf: true,
      bedrohung: 0, vorbereitung: 0 }];
  }
  return [];
}

export const SPERRE = 'Weniger als zwei Schlachten lässt dieses Heer dir nicht.';

/* ---------- Eine Wahl treffen ---------- */

/**
 * @param {any} wahl eine der Rueckgaben von `offeneWahlen`
 * @returns {{ok: boolean, grund?: string, kampf?: any, weiter?: boolean}}
 */
export function waehle(wahl) {
  const b = dieBelagerung;
  if (!b || b.ende) return { ok: false, grund: 'Keine Belagerung.' };
  if (!wahl) return { ok: false, grund: 'Keine Wahl.' };
  if (wahl.gesperrt) return { ok: false, grund: wahl.gesperrt };

  if (wahl.art === 'aufbrechen') {
    b.abschnitt = naechsterAbschnitt(b);
    return { ok: true, weiter: true };
  }

  if (wahl.art === 'durchlassen') {
    if (!darfDurchlassen()) return { ok: false, grund: SPERRE };
    setzeZustand(b, wahl, 'durch');
    hebeBedrohung(b, wahl.bedrohung, wahl.name + ' ziehen lassen');
    b.vorbereitung += wahl.vorbereitung;
    b.verlauf.push(wahl.ziel + ':durch');
    b.abschnitt = naechsterAbschnitt(b);
    return { ok: true, weiter: true };
  }

  if (wahl.art === 'abfangen' || wahl.art === 'stellen') {
    const gegner = baueGegner(wahl);
    b.imKampf = { ziel: wahl.ziel, nr: wahl.nr === undefined ? -1 : wahl.nr, gegner };
    return { ok: true, kampf: gegner };
  }
  return { ok: false, grund: 'Diese Wahl gibt es nicht.' };
}

/**
 * Die Bedrohung aendern - und dabei aufschreiben, warum.
 * @param {any} b @param {number} um @param {string} grund
 */
function hebeBedrohung(b, um, grund) {
  if (!um) return;
  const vorher = b.bedrohung;
  b.bedrohung = Math.max(0, Math.min(BEDROHUNG_MAX, b.bedrohung + um));
  if (b.bedrohung === vorher) return;
  if (!b.bedrohungsWeg) b.bedrohungsWeg = [];
  b.bedrohungsWeg.push({ wert: b.bedrohung - vorher, auf: b.bedrohung, grund });
}

/** @param {any} b @param {any} wahl @param {string} zustand */
function setzeZustand(b, wahl, zustand) {
  if (wahl.ziel === 'vorhut') b.vorhut.zustand = zustand;
  else if (wahl.ziel === 'division' && b.divisionen[wahl.nr]) b.divisionen[wahl.nr].zustand = zustand;
}

/**
 * Wie der Kampf ausging. Ein Sieg raeumt den Gegner weg und schickt ins
 * Lager; eine Niederlage beendet die Ante.
 * @param {boolean} sieg
 */
export function meldeAusgang(sieg) {
  const b = dieBelagerung;
  if (!b || !b.imKampf) return { ok: false, grund: 'Es stand niemand auf dem Feld.' };
  const wer = b.imKampf;
  b.kaempfe++;
  b.imKampf = null;

  if (!sieg) {
    b.ende = 'niederlage';
    b.abschnitt = ABSCHNITTE.vorbei.id;
    return { ok: true, ende: 'niederlage' };
  }

  if (wer.ziel === 'vorhut') {
    b.vorhut.zustand = 'geschlagen';
    hebeBedrohung(b, -1, 'Die Vorhut abgefangen');
    b.verlauf.push('vorhut:geschlagen');
  } else if (wer.ziel === 'division') {
    b.divisionen[wer.nr].zustand = 'geschlagen';
    b.verlauf.push('division' + wer.nr + ':geschlagen');
  } else {
    b.ende = 'sieg';
    b.abschnitt = ABSCHNITTE.vorbei.id;
    b.verlauf.push('heerfuehrer:geschlagen');
    return { ok: true, ende: 'sieg' };
  }

  // Nach jeder gewonnenen Schlacht steht das Heerlager.
  b.abschnitt = ABSCHNITTE.lager.id;
  return { ok: true, ende: null, lager: true };
}

/** @param {any} b */
function naechsterAbschnitt(b) {
  if (b.vorhut.zustand === 'offen') return ABSCHNITTE.vorhut.id;
  if (b.divisionen.some(d => d.zustand === 'offen')) return ABSCHNITTE.divisionen.id;
  return ABSCHNITTE.heerfuehrer.id;
}

/* ---------- Die Gegner ---------- */

/** @param {any} wahl */
function baueGegner(wahl) {
  const b = dieBelagerung;
  const ante = dieAnte(b.nr);
  if (wahl.ziel === 'vorhut') {
    const v = VORHUTEN[b.vorhut.id];
    return gegnerAus(v, Math.round(ante.grund * v.staerke), [], ante);
  }
  if (wahl.ziel === 'division') {
    const d = DIVISIONEN[b.divisionen[wahl.nr].id];
    /*
     * Eine Division traegt ihr eigenes Merkmal schon im Feld. Wer sie
     * abfaengt, lernt die Regel also kennen, BEVOR sie am Heerfuehrer haengt -
     * und das ist der eigentliche Lohn des Abfangens.
     */
    return gegnerAus(d, Math.round(ante.grund * d.staerke), [d.merkmal], ante);
  }
  return baueHeerfuehrer();
}

/** Der Heerfuehrer, so wie der Spieler ihn hat werden lassen. */
export function baueHeerfuehrer() {
  const b = dieBelagerung;
  if (!b) return null;
  return gegnerAus(HEERFUEHRER[dieAnte(b.nr).heerfuehrer],
    heerfuehrerStaerke(b), heerfuehrerRegeln(b), dieAnte(b.nr));
}

/*
 * Woraus der Heerfuehrer besteht - an EINER Stelle, damit die Vorschau auf der
 * Karte und der Gegner im Kampf nicht auseinanderlaufen koennen. Genau das ist
 * der Sinn der Vorschau: dass dort steht, was kommt, und nicht etwas
 * Aehnliches.
 *
 * Doppelte Regeln fallen heraus. Wer eine Division durchlaesst, deren Merkmal
 * die Bedrohung ohnehin mitbringt, soll sie nicht zweimal abbekommen - er
 * soll gar nichts Zusaetzliches abbekommen, und das muss man auch sehen.
 */
export function heerfuehrerRegeln(b = dieBelagerung) {
  if (!b) return [];
  const ante = dieAnte(b.nr);
  const h = HEERFUEHRER[ante.heerfuehrer];
  const durch = b.divisionen.filter(d => d.zustand === 'durch').map(d => DIVISIONEN[d.id].merkmal);
  return [...new Set([h.grundregel, ...durch, ...bedrohungsRegeln(b.bedrohung),
    ...(ante.regeln || [])])];
}

/** @param {any} [b] */
export function heerfuehrerStaerke(b = dieBelagerung) {
  if (!b) return 0;
  const ante = dieAnte(b.nr);
  return Math.round(ante.grund * HEERFUEHRER[ante.heerfuehrer].staerke
    * (1 + JE_BEDROHUNG * b.bedrohung));
}

/*
 * Was DIESE Wahl am Heerfuehrer aendern wuerde - bevor sie getroffen ist.
 *
 * Der Spieler darf nie nach dem Klicken erfahren, dass er eine Schwelle
 * ueberschritten hat. Hier wird darum probeweise gerechnet: der Zustand wird
 * kurz veraendert, gefragt, und wiederhergestellt.
 *
 * @param {any} wahl eine der Rueckgaben von `offeneWahlen`
 */
export function folgenDerWahl(wahl) {
  const b = dieBelagerung;
  if (!b || !wahl) return null;
  const vorher = {
    bedrohung: b.bedrohung, vorbereitung: b.vorbereitung,
    regeln: heerfuehrerRegeln(b), hp: heerfuehrerStaerke(b),
    stufe: bedrohungsstufe(b.bedrohung),
  };
  // Probeweise anwenden ...
  const gemerkt = JSON.parse(JSON.stringify({ b: { bedrohung: b.bedrohung,
    vorbereitung: b.vorbereitung, vorhut: b.vorhut, divisionen: b.divisionen } }));
  if (wahl.art === 'durchlassen') {
    b.bedrohung = Math.min(BEDROHUNG_MAX, b.bedrohung + (wahl.bedrohung || 0));
    b.vorbereitung += wahl.vorbereitung || 0;
    setzeZustand(b, wahl, 'durch');
  } else if (wahl.art === 'abfangen') {
    // Ein Sieg wird angenommen - danach gefragt wird ohnehin nur vorher.
    b.bedrohung = Math.max(0, b.bedrohung + (wahl.bedrohung || 0));
    b.vorbereitung += wahl.vorbereitung || 0;
    setzeZustand(b, wahl, 'geschlagen');
  }
  const nachher = {
    bedrohung: b.bedrohung, vorbereitung: b.vorbereitung,
    regeln: heerfuehrerRegeln(b), hp: heerfuehrerStaerke(b),
    stufe: bedrohungsstufe(b.bedrohung),
  };
  // ... und wieder zuruecknehmen.
  b.bedrohung = gemerkt.b.bedrohung;
  b.vorbereitung = gemerkt.b.vorbereitung;
  b.vorhut = gemerkt.b.vorhut;
  b.divisionen = gemerkt.b.divisionen;

  return {
    vorher, nachher,
    neueRegeln: nachher.regeln.filter(r => !vorher.regeln.includes(r)),
    wegfallendeRegeln: vorher.regeln.filter(r => !nachher.regeln.includes(r)),
    neueStufe: nachher.stufe.stufe !== vorher.stufe.stufe ? nachher.stufe : null,
  };
}

/** @param {any} vorlage @param {number} hp @param {string[]} regelIds @param {any} ante */
function gegnerAus(vorlage, hp, regelIds, ante) {
  return {
    id: vorlage.id, name: vorlage.name, figuren: vorlage.figuren, typ: vorlage.typ,
    hp, maxHp: hp,
    regeln: baueRegeln(regelIds),
    regelIds: regelIds.slice(),
    ante: ante.id,
  };
}

/* ---------- Auskunft fuer die Anzeige ---------- */

/** Der ganze Zustand in einer lesbaren Form - fuer Karte, Tafel und Pruefung. */
export function belagerungslage() {
  const b = dieBelagerung;
  if (!b) return null;
  const ante = dieAnte(b.nr);
  const h = HEERFUEHRER[ante.heerfuehrer];
  return {
    ante: { id: ante.id, nr: ante.nr, name: ante.name, text: ante.text },
    abschnitt: b.abschnitt,
    bedrohung: b.bedrohung,
    bedrohungMax: BEDROHUNG_MAX,
    vorbereitung: b.vorbereitung,
    kaempfe: b.kaempfe,
    nochHoechstens: kaempfeNochHoechstens(),
    vorhut: { ...b.vorhut, ...VORHUTEN[b.vorhut.id] },
    divisionen: b.divisionen.map(d => ({ ...d, ...DIVISIONEN[d.id] })),
    stufe: bedrohungsstufe(b.bedrohung),
    naechsteStufe: b.bedrohung < BEDROHUNG_MAX ? bedrohungsstufe(b.bedrohung + 1) : null,
    bedrohungsWeg: (b.bedrohungsWeg || []).slice(),
    heerfuehrer: {
      ...h,
      regeln: heerfuehrerRegeln(b),
      hp: heerfuehrerStaerke(b),
    },
    ende: b.ende,
  };
}

/* ---------- Speichern ---------- */
/*
 * Eine Ante muss sich GENAU so wiederherstellen lassen, wie sie stand -
 * einschliesslich dessen, was schon durchgelassen wurde. Alles hier ist
 * reines JSON: keine Funktionen, keine Verweise, nichts, was beim Einlesen
 * aufgebaut werden muesste.
 */
export function sichereBelagerung() {
  return dieBelagerung ? JSON.parse(JSON.stringify({ ...dieBelagerung, imKampf: null })) : null;
}

/** @param {any} daten */
export function ladeBelagerung(daten) {
  if (!daten || !daten.ante) return null;
  dieBelagerung = { ...daten, imKampf: null };
  return dieBelagerung;
}
