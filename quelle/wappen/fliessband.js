/*
 * Das Fliessband: EIN Weg, auf dem jedes Wappen zuendet.
 *
 * Vorher hatte jedes Wappen seinen eigenen Haken an seiner eigenen Stelle im
 * Kern. Das hatte zwei Folgen, und beide waren schlecht: ein Wappen konnte
 * wirkungslos werden, ohne dass es auffiel (der Drache), und zwei Wappen
 * konnten einander nichts sagen - es gab keinen Ort, an dem sie sich
 * begegnet waeren.
 *
 * DIE REIHENFOLGE IST DIE REGEL. Die fuenf Plaetze werden strikt von links
 * nach rechts abgearbeitet. Platz 1 aendert die Lage, Platz 2 bekommt die
 * GEAENDERTE Lage, Platz 3 die von Platz 2 geaenderte, und so weiter. Ein
 * Wappen, das verdoppelt, was der Platz vor ihm getan hat, ist damit auf
 * Platz 4 etwas voellig anderes als auf Platz 2. Das ist kein Nebeneffekt,
 * das ist der Kern des Systems: der Spieler baut keine Sammlung, er baut
 * eine MASCHINE, und die Anordnung ist die Konstruktion.
 *
 * Darum ist hier auch nichts nebenlaeufig und nichts gesammelt-am-Ende. Jede
 * Zuendung liegt im Protokoll mit ihrem Platz, ihrer Art und ihrer Tiefe -
 * wer wissen will, warum eine Runde 4,2 Millionen Wucht hatte, liest die
 * Kette nach, statt sie zu erraten.
 */

import { EREIGNIS_LISTE } from './ereignisse.js';

/** So viele Wappen kann die Burg zugleich fuehren. */
export const PLAETZE = 5;

/*
 * Woher eine Zuendung kommt. Das System MUSS das unterscheiden koennen,
 * sonst laesst sich kein Wappen bauen, das "jede fremde Zuendung" oder "jede
 * eigene, aber keine Kopie" zaehlt - und ohne die Unterscheidung wuerde jede
 * Rekursionssperre entweder zu frueh oder gar nicht greifen.
 */
export const ZUENDART = {
  urspruenglich: 'urspruenglich',   // der Durchlauf der Reihe selbst
  nachzuendung:  'nachzuendung',    // ein Wappen laesst einen frueheren Platz noch einmal zuenden
  kopie:         'kopie',           // ein Wappen fuehrt die Wirkung eines anderen aus
  erzeugt:       'erzeugt',         // ein Wappen loest ein ganz neues Ereignis aus
};

/*
 * Die Sperren. Sie sind absichtlich harte Zahlen und keine Klugheit: ein
 * Wappenpaar, das sich gegenseitig nachzuendet, ist kein Fehler im Spiel,
 * sondern eine Bauform, die ein Spieler frueher oder spaeter finden WIRD.
 * Sie darf viel duerfen und muss irgendwo enden.
 */
export const GRENZEN = {
  tiefe: 6,          // so tief duerfen Wappen einander noch zuenden
  jePlatz: 12,       // so oft darf EIN Platz in EINEM Ereignis hoechstens zuenden
  jeEreignis: 60,    // so viele Zuendungen hat ein Ereignis hoechstens insgesamt
  ketten: 24,        // so viele erzeugte Folgeereignisse haelt ein Ereignis aus
};

/*
 * Alle gemeldeten Wappen. Die Sammlung meldet sich hier an, statt dass das
 * Fliessband sie kennt - sonst haenge das Band an den Daten und die Daten am
 * Band, und der Bau braeche mit einem Kreis ab (siehe scripts/baue.mjs).
 */
/** @type {Record<string, any>} */
export const WAPPEN_REGISTER = {};

/**
 * Ein Wappen anmelden. Prueft beim Anmelden, was sonst niemand prueft: dass
 * die Ereignisse, auf die es hoert, ueberhaupt existieren. Genau der Fehler,
 * an dem der Drache jahrelang wirkungslos hing, faellt hier beim Start auf.
 * @param {any} def
 */
export function meldeWappen(def) {
  if (!def || !def.id) throw new Error('Ein Wappen ohne Kennung.');
  if (WAPPEN_REGISTER[def.id]) throw new Error('Wappen doppelt gemeldet: ' + def.id);
  const hoert = def.hoert || {};
  const namen = Object.keys(hoert);
  if (!namen.length) throw new Error('Wappen ohne Wirkung: ' + def.id + ' hoert auf kein Ereignis.');
  for (const name of namen) {
    if (!EREIGNIS_LISTE.includes(name)) {
      throw new Error('Wappen ' + def.id + ' hoert auf ein Ereignis, das es nicht gibt: ' + name);
    }
    if (typeof hoert[name] !== 'function') {
      throw new Error('Wappen ' + def.id + ': ' + name + ' ist keine Wirkung.');
    }
  }
  WAPPEN_REGISTER[def.id] = def;
  return def;
}

/**
 * Ein Wappen, das auf JEDES Ereignis hoert. Verstaerker und Zaehler brauchen
 * das: was der Platz links getan hat, kann in jedem Ereignis geschehen sein,
 * und ein Verstaerker, der nur bei Salven hinsieht, waere ein halber.
 * @param {(lage: any, zuendung: any) => void} fn
 */
export function aufAllem(fn) {
  /** @type {Record<string, typeof fn>} */
  const hoert = {};
  for (const name of EREIGNIS_LISTE) hoert[name] = fn;
  return hoert;
}

/** Nur fuer Pruefungen: alles wieder abmelden. */
export function leereRegister() {
  for (const id in WAPPEN_REGISTER) delete WAPPEN_REGISTER[id];
}

// ---------- Das Band ----------
/*
 * Ein Band je Kampf. Es haelt die Reihenfolge, die Siegel (Bossregeln
 * verschliessen Plaetze), die Zaehlung und das Protokoll.
 */
export let dasBand = null;

/**
 * @param {string[]} [reihe] Wappenkennungen in ihrer Platzfolge
 * @param {any} [feind] der Gegner dieses Kampfes - Wappen duerfen ihn LESEN
 */
export function neuesBand(reihe = [], feind = null) {
  dasBand = {
    reihe: reihe.slice(0, PLAETZE),
    feind,
    runde: 1,
    /** @type {number[]} Plaetze, die eine Bossregel verschlossen hat */
    gesiegelt: [],
    /** @type {any[]} jede Zuendung des ganzen Kampfes, in der Reihenfolge des Geschehens */
    protokoll: [],
    /** @type {Record<number, number>} wie oft ein Platz im ganzen Kampf gezuendet hat */
    zaehlung: {},
    nr: 0,
  };
  return dasBand;
}

export function raeumeBand() { dasBand = null; laufende = null; }

/**
 * Etwas mit einer bestimmten Reihenfolge rechnen, ohne das laufende Band zu
 * stoeren. Die Pruefungen und die Vorschau rufen `berechneWucht` mit einer
 * Liste von Wappen statt mit einem Kampf; dann steht hier kurz ein Band, und
 * danach steht wieder das echte da.
 *
 * Die Pruefung ist auf IDENTITAET, nicht auf Inhalt: der Kampf reicht seine
 * eigene Reihe herein (`k.wappen` IST `dasBand.reihe`), und nur dann soll
 * gerechnet werden, was wirklich laeuft.
 *
 * @param {string[] | null} reihe @param {() => any} fn
 */
export function mitReihe(reihe, fn) {
  const vorher = dasBand;
  // `null` heisst: das Band, das ohnehin laeuft. Eine leere LISTE heisst
  // dagegen ausdruecklich `ohne Wappen` - die beiden zu verwechseln kostet
  // stumm jede Wappenwirkung, und man sucht sie in der Wucht statt hier.
  const eigen = reihe != null && (!vorher || reihe !== vorher.reihe);
  if (eigen) neuesBand(Array.isArray(reihe) ? reihe : [], vorher ? vorher.feind : null);
  try { return fn(); } finally { if (eigen) dasBand = vorher; }
}

/** Die Wappen in ihrer jetzigen Ordnung. */
export function reihe() { return dasBand ? dasBand.reihe.slice() : []; }

/**
 * Zwei Plaetze tauschen. Der Spieler tut das am Gestell, DER USURPATOR tut es
 * ihm an - fuer das Band ist es dasselbe, und genau deshalb kann die Bossregel
 * spaeter zwei Zeilen lang sein.
 * @param {number} a @param {number} b
 */
export function vertauschePlaetze(a, b) {
  if (!dasBand) return false;
  const r = dasBand.reihe;
  if (a < 0 || b < 0 || a >= r.length || b >= r.length || a === b) return false;
  [r[a], r[b]] = [r[b], r[a]];
  return true;
}

/**
 * Ein Wappen an einen anderen Platz ziehen; alles dazwischen rueckt auf.
 * Das ist das Schieben am Gestell - nicht dasselbe wie Vertauschen, denn es
 * haelt die uebrige Ordnung.
 * @param {number} von @param {number} nach
 */
export function verschiebePlatz(von, nach) {
  if (!dasBand) return false;
  const r = dasBand.reihe;
  if (von < 0 || von >= r.length || nach < 0 || nach >= r.length || von === nach) return false;
  const [w] = r.splice(von, 1);
  r.splice(nach, 0, w);
  return true;
}

/** Einen Platz verschliessen - er zuendet nicht mehr, bleibt aber sichtbar. */
export function siegelePlatz(platz) {
  if (!dasBand || dasBand.gesiegelt.includes(platz)) return false;
  dasBand.gesiegelt.push(platz);
  return true;
}

export function entsiegle() { if (dasBand) dasBand.gesiegelt = []; }

/** Die laufende Runde. Wappen duerfen sie lesen, aendern koennen sie sie nicht. */
export function setzeRunde(runde) { if (dasBand) dasBand.runde = runde; }

/**
 * Der Platz, der im ganzen Kampf am haeufigsten gezuendet hat. DER INQUISITOR
 * versiegelt genau ihn - er trifft also nicht das teuerste Wappen, sondern
 * das, um das der Spieler seine Maschine gebaut hat.
 */
export function lautesterPlatz() {
  if (!dasBand) return -1;
  let bester = -1;
  let hoechste = 0;
  for (let i = 0; i < dasBand.reihe.length; i++) {
    const n = dasBand.zaehlung[i] || 0;
    if (n > hoechste) { hoechste = n; bester = i; }
  }
  return bester;
}

// ---------- Die Lage ----------
/*
 * Die Lage ist das Ereignis, waehrend es durch die Reihe laeuft. `daten` ist
 * der Inhalt, den die Wappen aendern duerfen - eine Salve mit ihrer Wucht,
 * eine gezogene Karte, ein gefallener Gegner. Alles andere ist Buchhaltung.
 */

/**
 * @param {string} ereignis
 * @param {any} daten
 * @param {any} [eltern] die Lage, aus der diese hier erzeugt wurde
 */
export function neueLage(ereignis, daten = {}, eltern = null, probe = false) {
  return {
    ereignis,
    daten,
    /*
     * Eine Probe rechnet, ohne die Welt zu beruehren. Die Anzeige fragt bei
     * jedem Schweben einer Karte ueber einem Turm, was die Burg dann woege -
     * wuerde diese Frage Vorraete verbrauchen oder ins Kampfprotokoll
     * schreiben, kaeme das Protokoll nach einer Runde Mausbewegung auf
     * zweitausend Zeilen und der Spieler haette Pulver verloren, ohne je
     * eine Karte gelegt zu haben.
     */
    probe: probe || (eltern ? eltern.probe : false),
    /*
     * Der Gegner liegt neben den Daten, nicht darin: Wappen duerfen ihn
     * lesen (`Siegel` sieht nach, ob er unter der Haelfte steht), aber keine
     * Wirkung darf ihn anfassen. Was den Gegner trifft, geht durch
     * `feindGetroffen` - eine Tuer, nicht fuenfzig.
     */
    feind: dasBand ? dasBand.feind : null,
    runde: dasBand ? dasBand.runde : 1,
    /** @type {any[]} was in DIESEM Ereignis schon gezuendet hat, in Reihenfolge */
    gezuendet: [],
    /** @type {Record<number, number>} Zuendungen je Platz in diesem Ereignis */
    zaehler: {},
    /** @type {any} die Zuendung, die gerade laeuft */
    ich: null,
    platz: -1,
    tiefe: eltern ? eltern.tiefe + 1 : 0,
    /** @type {string[]} die Wappen, ueber die dieses Ereignis zustande kam */
    herkunft: eltern ? eltern.herkunft.concat(eltern.ich ? [eltern.ich.id] : []) : [],
    art: eltern ? ZUENDART.erzeugt : ZUENDART.urspruenglich,
    eltern,
    ketten: 0,
    abgebrochen: false,
    /** @type {any[]} Ausschnitt des Bandprotokolls, der zu dieser Lage gehoert */
    protokoll: [],
  };
}

/**
 * Ein Ereignis durch die Reihe schicken. Das ist die EINE Tuer; der Kampf
 * ruft sie, die Wappen kennen den Kampf nicht.
 *
 * @param {string} ereignis
 * @param {any} [daten]
 * @param {any} [eltern]
 * @returns {any} die Lage mit den geaenderten Daten und dem Protokoll
 */
export function loeseAus(ereignis, daten = {}, eltern = null, probe = false) {
  /*
   * DER WICHTIGSTE SATZ DES GANZEN SYSTEMS.
   *
   * Ein Ereignis, das entsteht, WAEHREND ein anderes noch durch die Reihe
   * laeuft, haengt sich automatisch darunter. Der Kampf muss dafuer nichts
   * wissen und nichts weiterreichen: laesst ein Wappen auf `feindGetroffen`
   * eine Einheit feuern, und die trifft wieder, dann ist der zweite Treffer
   * ein Kind des ersten - und die Tiefensperre greift.
   *
   * Ohne diesen Satz waere jede Rueckkehr aus dem Spiel in das Band ein
   * frischer Anfang bei Tiefe 0, und die sauberste Sperre der Welt zaehlte
   * bis zum Stapelueberlauf mit.
   */
  const vater = eltern || laufende;
  if (!vater) return fuehreAus(ereignis, daten, null, probe);
  if (vater.tiefe + 1 > GRENZEN.tiefe) {
    halteFest(vater, -1, ereignis, ZUENDART.erzeugt, 'tiefe');
    return neueLage(ereignis, daten, vater, probe);
  }
  if (++vater.ketten > GRENZEN.ketten) {
    halteFest(vater, -1, ereignis, ZUENDART.erzeugt, 'ketten');
    return neueLage(ereignis, daten, vater, probe);
  }
  const kind = fuehreAus(ereignis, daten, vater, probe);
  vater.protokoll.push(...kind.protokoll);
  return kind;
}

/** Die Lage, die gerade durch die Reihe laeuft - oder null. */
let laufende = null;

/** Der Durchlauf selbst: von links nach rechts, Platz fuer Platz. */
function fuehreAus(ereignis, daten, eltern, probe) {
  const lage = neueLage(ereignis, daten, eltern, probe);
  if (!dasBand) return lage;
  const vorher = laufende;
  laufende = lage;
  try {
    for (let platz = 0; platz < dasBand.reihe.length; platz++) {
      if (lage.abgebrochen) break;
      zuendePlatz(lage, platz, ZUENDART.urspruenglich);
    }
  } finally { laufende = vorher; }
  return lage;
}

/**
 * Ein neues Ereignis MITTEN aus einem Wappen heraus. Seit `loeseAus` sich
 * selbst einhaengt, ist das nur noch die ausdrueckliche Schreibweise davon.
 * @param {any} lage @param {string} ereignis @param {any} [daten]
 */
export function loeseAusIn(lage, ereignis, daten = {}) {
  return loeseAus(ereignis, daten, lage, lage.probe);
}

/**
 * Einen frueheren Platz noch einmal zuenden lassen - das, was ein
 * Nachzuendungs-Wappen tut. Der Platz sieht die Lage, wie sie JETZT ist,
 * nicht wie sie beim ersten Mal war.
 * @param {any} lage @param {number} platz
 */
export function zuendeErneut(lage, platz) {
  return zuendePlatz(lage, platz, ZUENDART.nachzuendung, lage.ich);
}

/**
 * Die Wirkung eines anderen Platzes ausfuehren, aber unter eigenem Namen.
 * Der Unterschied zur Nachzuendung ist nicht kosmetisch: eine Kopie zaehlt
 * fuer den kopierten Platz NICHT als eigene Zuendung, also treibt ein
 * Kopierwappen die Grenze des kopierten Wappens nicht voll.
 * @param {any} lage @param {number} platz
 */
export function kopiere(lage, platz) {
  return zuendePlatz(lage, platz, ZUENDART.kopie, lage.ich);
}

/**
 * Der eigentliche Vorgang. Alle Sperren sitzen hier und nur hier - es gibt
 * keinen zweiten Weg, ein Wappen zum Zuenden zu bringen.
 *
 * @param {any} lage
 * @param {number} platz
 * @param {string} art
 * @param {any} [durch] die Zuendung, die diese hier ausgeloest hat
 */
function zuendePlatz(lage, platz, art, durch = null) {
  if (!dasBand) return null;
  const id = dasBand.reihe[platz];
  const def = id && WAPPEN_REGISTER[id];
  if (!def) return null;
  const wirkung = (def.hoert || {})[lage.ereignis];
  if (!wirkung) return null;

  const grund = warumNicht(lage, platz, id, art);
  if (grund) { halteFest(lage, platz, id, art, grund); return null; }

  const zuendung = {
    nr: ++dasBand.nr,
    platz, id, name: def.name, ereignis: lage.ereignis, art,
    tiefe: lage.tiefe,
    durch: durch ? durch.nr : null,
    /** @type {any[]} was dieses Wappen an der Lage geaendert hat */
    wirkungen: [],
    abgewiesen: null,
  };

  // Buchfuehrung VOR der Wirkung: ein Wappen, das sich selbst nachzuendet,
  // muss sich beim zweiten Betreten schon gezaehlt vorfinden.
  if (art !== ZUENDART.kopie) {
    lage.zaehler[platz] = (lage.zaehler[platz] || 0) + 1;
    if (!lage.probe) dasBand.zaehlung[platz] = (dasBand.zaehlung[platz] || 0) + 1;
  }
  lage.gezuendet.push(zuendung);
  lage.protokoll.push(zuendung);
  if (!lage.probe) dasBand.protokoll.push(zuendung);

  const vorher = lage.ich;
  const vorherPlatz = lage.platz;
  lage.ich = zuendung;
  lage.platz = platz;
  try {
    wirkung(lage, zuendung);
  } finally {
    lage.ich = vorher;
    lage.platz = vorherPlatz;
  }
  return zuendung;
}

/**
 * Warum ein Platz gerade NICHT zuenden darf - oder null, wenn er darf.
 * Jeder Grund ist eine eigene Zeile, weil jeder einen eigenen Fall im Spiel
 * hat und im Protokoll auch so stehen soll.
 * @param {any} lage @param {number} platz @param {string} id @param {string} art
 */
function warumNicht(lage, platz, id, art) {
  if (dasBand.gesiegelt.includes(platz)) return 'siegel';
  if (lage.tiefe > GRENZEN.tiefe) return 'tiefe';
  if ((lage.zaehler[platz] || 0) >= GRENZEN.jePlatz) return 'jePlatz';
  if (lage.gezuendet.length >= GRENZEN.jeEreignis) return 'jeEreignis';
  /*
   * Der Kreis: A zuendet B nach, B zuendet A nach. Beide sind fuer sich
   * sinnvolle Wappen, zusammen sind sie eine Schleife. Sie wird nicht
   * verboten - sie darf ihre Tiefe ausschoepfen -, aber ein Ereignis, das
   * ueber dieses Wappen erst entstanden ist, zuendet es nicht ein zweites
   * Mal. Sonst waechst die Kette in der Breite statt in der Tiefe und die
   * Tiefensperre greift nie.
   */
  if (art === ZUENDART.erzeugt && lage.herkunft.includes(id)) return 'kreis';
  return null;
}

/** Eine abgewiesene Zuendung bleibt im Protokoll stehen. Wer sie nicht sieht, sucht sie stundenlang. */
function halteFest(lage, platz, id, art, grund) {
  const eintrag = {
    nr: ++dasBand.nr,
    platz, id, name: (WAPPEN_REGISTER[id] || {}).name || id,
    ereignis: lage.ereignis, art, tiefe: lage.tiefe,
    durch: lage.ich ? lage.ich.nr : null,
    wirkungen: [],
    abgewiesen: grund,
  };
  lage.protokoll.push(eintrag);
  if (!lage.probe) dasBand.protokoll.push(eintrag);
  return eintrag;
}

// ---------- Was die Wappen zurueckmelden ----------
/**
 * Jede Aenderung an der Lage wird hier vermerkt. Die Wirkungen in
 * `wirkungen.js` rufen das; ein Wappen, das die Lage direkt anfasst, taucht
 * im Protokoll mit leerer Wirkung auf und ist damit als Schlamperei
 * erkennbar.
 * @param {any} lage @param {string} art @param {any} wert @param {string} [text]
 */
export function notiere(lage, art, wert, text = '') {
  if (!lage.ich) return null;
  const w = { art, wert, text };
  lage.ich.wirkungen.push(w);
  return w;
}

/**
 * Die letzte Zuendung VOR dem laufenden Platz - das, woran ein
 * Verstaerker-Wappen ansetzt. Genau hier haengt die Reihenfolge: auf Platz 2
 * findet es nur Platz 1, auf Platz 5 findet es alles davor.
 * @param {any} lage
 */
export function vorherigeZuendung(lage) {
  const alle = lage.gezuendet.filter(z => !z.abgewiesen && z !== lage.ich);
  return alle.length ? alle[alle.length - 1] : null;
}

/** Alle Zuendungen aus frueheren Plaetzen dieses Ereignisses. */
export function zuendungenDavor(lage) {
  const platz = lage.platz;
  return lage.gezuendet.filter(z => z !== lage.ich && z.platz < platz && !z.abgewiesen);
}

/**
 * Wie oft in diesem Kampf eine Zuendung abgewiesen wurde - und warum.
 * Nicht nur fuer die Pruefung: eine Reihe, die staendig an die Tiefensperre
 * stoesst, ist eine Reihe, die anders gedacht ist als sie gebaut wurde, und
 * das soll man sehen koennen.
 */
export function abgewiesene() {
  if (!dasBand) return 0;
  return dasBand.protokoll.filter((/** @type {any} */ z) => z.abgewiesen).length;
}

/** Dasselbe, nach Grund aufgeschluesselt. */
export function abweisungen() {
  /** @type {Record<string, number>} */
  const nach = {};
  if (!dasBand) return nach;
  for (const z of dasBand.protokoll) {
    if (z.abgewiesen) nach[z.abgewiesen] = (nach[z.abgewiesen] || 0) + 1;
  }
  return nach;
}

/** Was ein Ereignis insgesamt bewegt hat - fuer das Kampfprotokoll. */
export function fasseZusammen(lage) {
  const echt = lage.protokoll.filter(z => !z.abgewiesen);
  return {
    ereignis: lage.ereignis,
    zuendungen: echt.length,
    abgewiesen: lage.protokoll.length - echt.length,
    tiefste: lage.protokoll.reduce((m, z) => Math.max(m, z.tiefe), 0),
    plaetze: echt.map(z => z.platz),
  };
}
