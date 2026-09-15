import { KERN } from './regeln.js';
import { GATTUNGEN, GATTUNG_LISTE, START_DECK, grundwucht, neueEinheit, verbessereEinheit } from './einheiten.js';
import { TURMTYPEN, TURM_START } from './tuerme.js';
import { baueFeind } from './feinde.js';
import { WAPPEN, WAPPEN_LISTE, WAPPEN_PLAETZE } from '../wappen/sammlung.js';
import { verschiebePlatz, dasBand, stelleBandHer, raeumeBand } from '../wappen/fliessband.js';
import { sichereVorrat, stelleVorratHer, neuerVorrat } from '../wappen/vorrat.js';
import { setzeStufenquelle } from './formationen.js';
import { derKampf, neuerKampf, kostetZuViel, setzeEinheit, beendeRunde, raeumeKampf, stelleKampfHer } from './kampf.js';

// ---------- Der Lauf ----------
/*
 * Ein Lauf ist die Kette aus Kämpfen, Händlern und Ereignissen, über die ein
 * Deck wächst. Der Kampf weiss davon nichts: er bekommt Deck, Wappen und
 * Turmtypen übergeben und gibt nur zurück, ob er gewonnen wurde. Alles, was
 * über einen Kampf hinaus bestehen bleibt, liegt hier - und nur hier.
 *
 * Drei Achsen wachsen mit:
 *
 *   das DECK    - neue Karten, geschliffene Karten, entfernte Karten
 *   die WAPPEN  - fünf Plätze, jedes bricht eine Regel
 *   die TÜRME   - fünf Stellungen, ihr Typ ist die dritte Achse
 *
 * Absichtlich getrennt: das Deck ist die breite Achse, die Wappen die scharfe,
 * die Türme die langsame. Wer alles in eine Gattung steckt, baut einen Turm,
 * der einmal umfällt; wer breit baut, trifft keine Formation.
 */
export const LAUF = {
  stationen: 11,
  leben: 1,                   // verlorene Kaempfe, die ein Lauf uebersteht
  sold: {
    start: 0,
    kampf: 25, elite: 45, boss: 120,
    jeRestrunde: 8,           // je Runde, die man nicht gebraucht hat
  },
  preise: { karte: 45, wappen: 130, ausbau: 95, entfernen: 60, schliff: 75 },
  belohnung: { auswahl: 3, wappenAb: 2 },
  /*
   * Wie viele Karten eine Ausmusterung nimmt. Mit einem Blatt aus 52 Karten
   * ist eine einzelne Karte kein Angebot, sondern ein Rundungsfehler: sie
   * hebt den Schnitt des Decks um zwei Hundertstel. In Schueben wird daraus
   * das, was das Verschmaelern sein soll - die Bauernschuetzen gehen, damit
   * die Marschaelle oefter kommen.
   */
  ausmustern: { belohnung: 4, haendler: 3 },
  /*
   * Der Rang, den eine Belohnungskarte im Schnitt hat: `ab` beim ersten
   * Kampf, dann `je` Rang je weiterem. Ueber acht Kaempfe reicht das von
   * Rang 3 bis an die Spitze - der Grund, warum ein Deck ueberhaupt waechst.
   */
  rangKurve: { ab: 2, je: 1.4 },
  schliff: 2,                 // was ein Schliff an Wucht bringt
  /*
   * Das Muster eines Akts. Elf Knoten: acht Kaempfe (davon zwei Elite und ein
   * Boss), zwei Haendler, zwei Ereignisse. Der erste Haendler kommt spaet
   * genug, dass man Sold hat, und frueh genug, dass er den Lauf noch dreht.
   */
  muster: ['kampf', 'kampf', 'ereignis', 'haendler', 'kampf', 'elite',
    'ereignis', 'kampf', 'haendler', 'elite', 'boss'],
};

export const KNOTEN_ARTEN = {
  kampf:    { id: 'kampf',    name: 'Angriff',      zeichen: '⚔' },
  elite:    { id: 'elite',    name: 'Sturmtrupp',   zeichen: '☠', zuschlag: 1.18 },
  boss:     { id: 'boss',     name: 'Belagerung',   zeichen: '♛' },
  haendler: { id: 'haendler', name: 'Händler',      zeichen: '⚖' },
  ereignis: { id: 'ereignis', name: 'Begegnung',    zeichen: '❖' },
};
export const KNOTEN_KAMPF = ['kampf', 'elite', 'boss'];

export let derLauf = null;

// Die Formationen fragen hier nach ihren Stufen, statt den Lauf zu kennen.
setzeStufenquelle(() => (derLauf ? derLauf.formationsStufen : null));

export function neuerLauf({ stationen = LAUF.stationen, muster = LAUF.muster } = {}) {
  /*
   * Ein neuer Feldzug hat keinen laufenden Kampf. Das klingt selbstverstaendlich
   * und war es nicht: `derKampf` zeigte noch auf die letzte Schlacht des
   * vorigen Laufs, und weil deren `ende` nicht gesetzt sein musste, hielt das
   * Spiel sich fuer mitten im Gefecht - ein Wappen umzuhaengen kostete dann
   * Tatendrang, den es gar nicht gab.
   */
  stelleKampfHer(null);
  raeumeBand();
  neuerVorrat();
  derLauf = {
    station: 1,
    stationen,
    /*
     * Jeder Knoten kennt seine Nummer IM AKT und, wenn er ein Kampf ist,
     * seine Nummer UNTER DEN KAEMPFEN. Das ist nicht dasselbe: an Station 5
     * steht der dritte Kampf, weil dazwischen ein Haendler und eine Begegnung
     * liegen. Die Staerke des Gegners haengt am dritten Kampf, nicht an der
     * fuenften Station - sonst springt sie ueber die Knoten ohne Kampf hinweg
     * und der Spieler faellt in ein Loch, das nur die Tabelle kennt.
     */
    knoten: (() => {
      let kampfNr = 0;
      return Array.from({ length: stationen }, (_, i) => {
        const art = muster[i] || 'kampf';
        const kampf = KNOTEN_KAMPF.includes(art);
        if (kampf) kampfNr++;
        return { nr: i + 1, art, kampfNr: kampf ? kampfNr : 0, erledigt: false };
      });
    })(),
    deck: START_DECK.map(id => neueEinheit(id)),
    wappen: [],
    turmTypen: TURM_START.slice(),
    /*
     * Je Formation eine Stufe. Sie steht schon hier, damit eine spaetere
     * Belohnung ("Manoever: Reine Garde") nur einen Eintrag hochzaehlen muss,
     * statt dass die Kampfrechnung dafuer umgebaut wird.
     */
    formationsStufen: {},
    sold: LAUF.sold.start,
    leben: LAUF.leben,
    ende: null,                 // null | 'sieg' | 'niederlage'
    verlauf: [],                // was an jedem Knoten geschah
  };
  return derLauf;
}

/** Der Knoten, vor dem der Lauf gerade steht. */
export function derKnoten() {
  return derLauf ? derLauf.knoten[derLauf.station - 1] || null : null;
}

/*
 * Einen Kampf aus dem Lauf heraus beginnen. Der Lauf reicht durch, was er
 * hat - der Kampf baut daraus seinen eigenen Zustand und fasst den Lauf nie
 * an. Das Deck wird kopiert: was im Kampf ersetzt wird und in der Ablage
 * landet, darf das Deck des Laufs nicht verändern.
 */
export function beginneKampfAmKnoten(stellungen = null) {
  const kn = derKnoten();
  if (!kn) return null;
  if (!KNOTEN_KAMPF.includes(kn.art)) return null;
  const boss = kn.art === 'boss';
  const feind = baueFeind(kn.kampfNr, { boss, zuschlag: KNOTEN_ARTEN[kn.art].zuschlag || 1 });
  if (kn.art === 'elite') feind.name = 'Sturmtrupp';
  return neuerKampf({
    feind,
    deck: derLauf.deck.map(k => ({ ...k })),
    wappen: derLauf.wappen.slice(),
    turmTypen: derLauf.turmTypen.slice(),
    stellungen,
  });
}

/*
 * Der Kampf ist entschieden. Hier - und nur hier - wird der Lauf fortgeschrieben:
 * Sold, Leben, Station. Die Belohnung wird nur gebaut, nicht schon vergeben;
 * welches der Angebote genommen wird, entscheidet der Spieler.
 */
export function werteKampfAus(kampf = derKampf) {
  const kn = derKnoten();
  if (!derLauf || !kn || !kampf) return null;
  const sieg = kampf.ende === 'sieg';
  if (!sieg) {
    derLauf.leben--;
    if (derLauf.leben <= 0) derLauf.ende = 'niederlage';
    derLauf.verlauf.push({ nr: kn.nr, art: kn.art, sieg: false });
    return { sieg: false, sold: 0, belohnung: null, ende: derLauf.ende };
  }
  const restrunden = Math.max(0, kampf.rundenMax - kampf.runde);
  const sold = (LAUF.sold[kn.art] || LAUF.sold.kampf) + restrunden * LAUF.sold.jeRestrunde;
  derLauf.sold += sold;
  kn.erledigt = true;
  derLauf.verlauf.push({ nr: kn.nr, art: kn.art, sieg: true, sold, runden: kampf.runde });
  const belohnung = baueBelohnung(kn);
  if (kn.art === 'boss') derLauf.ende = 'sieg';
  return { sieg: true, sold, restrunden, belohnung, ende: derLauf.ende };
}

/*
 * Die Angebote nach einem Sieg. Drei Stück, jedes von einer anderen Achse,
 * damit die Wahl wirklich eine ist: eine Karte macht das Deck breiter, ein
 * Ausbau macht einen Turm schärfer, ein Wappen bricht eine Regel.
 */
export function baueBelohnung(knoten) {
  const nr = knoten.kampfNr || 1;
  /*
   * Drei Plaetze, vier Bewerber - aus jeder Achse einer, und einer bleibt
   * jedes Mal draussen. Das ist der Grund, warum die Wahl eine ist: Ausbau,
   * Ausmustern und Wappen sind die drei Achsen, an denen ein Lauf mit vollem
   * Blatt ueberhaupt noch waechst, und man bekommt nie alle drei zugleich.
   *
   * Vorher stand hier fest "erst eine Karte, dann Ausbau, dann Ausmustern" -
   * damit war die dritte Reihe voll, bevor das Wappen an der Reihe war, und
   * der Bot kam ueber einen ganzen Akt auf 0,3 Wappen. Ein Angebot, das nie
   * erscheint, ist kein Angebot.
   */
  const bewerber = [
    angebotAusbau(),
    (derLauf.deck.length > KERN.handGroesse + 4 ? angebotAusmustern() : null),
    (knoten.nr >= LAUF.belohnung.wappenAb ? angebotWappen() : null),
    angebotKarte(nr),
  ].filter(Boolean);
  for (let i = bewerber.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bewerber[i], bewerber[j]] = [bewerber[j], bewerber[i]];
  }
  const angebote = bewerber.slice(0, LAUF.belohnung.auswahl);
  while (angebote.length < LAUF.belohnung.auswahl) angebote.push(angebotKarte(nr));
  return { angebote };
}

/*
 * Ausmustern als Belohnung. Das Ziel steht schon fest: die schwaechste Karte
 * im Deck. Eine Auswahl waere hier eine zweite Entscheidung in einer
 * Entscheidung, und die schwaechste Karte ist ohnehin fast immer die richtige.
 */
export function angebotAusmustern(zahl = LAUF.ausmustern.belohnung) {
  const schwach = schwaechsteKarten(zahl);
  if (!schwach.length) return null;
  const namen = schwach.length > 2
    ? schwach.length + ' schwächste Karten'
    : schwach.map(k => k.name).join(' und ');
  return { art: 'entfernen', karten: schwach, name: namen + ' ausmustern',
    text: schwach.map(k => k.rang + ' ' + k.name).join(', ') +
      ' verlassen das Deck. Ein dünnes Deck zieht öfter, was man will.' };
}

/** Die n schwaechsten Karten des Decks - das Ziel jeder Ausmusterung. */
export function schwaechsteKarten(n) {
  return derLauf.deck.slice()
    .sort((a, b) => grundwucht(a) - grundwucht(b))
    .slice(0, Math.max(0, Math.min(n, derLauf.deck.length - KERN.handGroesse)));
}

/*
 * Der Rang einer Belohnungskarte wächst mit der Station. Das ist die stille
 * Fortschrittskurve: an Station 2 liegen Ränge um 3, an Station 10 um 11.
 * Ohne das müsste der Spieler zwölf Runden lang mit Bauernschützen spielen.
 */
export function belohnungsRang(kampfNr) {
  const mitte = Math.min(13, Math.round(LAUF.rangKurve.ab + LAUF.rangKurve.je * kampfNr));
  const streu = Math.floor(Math.random() * 5) - 2;    // -2 .. +2
  return Math.max(1, Math.min(13, mitte + streu));
}

/*
 * Der Kampf, auf den sich eine Belohnung bezieht: der letzte gespielte. An
 * einem Haendler oder in einer Begegnung ist das der Kampf davor - dort soll
 * nicht schlechtere Ware liegen, nur weil zwischendurch nicht gekaempft wurde.
 */
export function kampfNrJetzt() {
  if (!derLauf) return 1;
  let letzte = 1;
  for (const kn of derLauf.knoten) {
    if (kn.kampfNr) letzte = kn.kampfNr;
    if (kn.nr >= derLauf.station) break;
  }
  return letzte;
}

export function angebotKarte(station) {
  const g = GATTUNG_LISTE[Math.floor(Math.random() * GATTUNG_LISTE.length)];
  const einheit = neueEinheit(g + '-' + belohnungsRang(station));
  return { art: 'karte', einheit, name: einheit.name,
    text: GATTUNGEN[g].name + ' · Rang ' + einheit.rang + ' — kommt ins Deck.' };
}

/*
 * Wie oft eine Seltenheit im Angebot auftaucht, und ab welcher Station
 * ueberhaupt. Legendaere Wappen aendern nicht eine Zahl, sondern den
 * Durchlauf - sie taugen nichts, solange nichts da ist, was sie verstaerken
 * koennten, und darum kommen sie erst spaet.
 */
/**
 * Ein Wappen an einen anderen Platz ziehen; alles dazwischen rueckt auf.
 *
 * Die Reihenfolge ist Spielzustand und nicht Anzeigezustand, darum steht das
 * hier und nicht in der Oberflaeche. Zwei Listen muessen es mitbekommen: der
 * LAUF haelt die Ordnung ueber den ganzen Feldzug, das BAND die des gerade
 * laufenden Kampfes. Wer nur eine von beiden umstellt, sieht eine neue
 * Reihenfolge und spielt die alte.
 *
 * @param {number} von @param {number} nach
 */
export function ordneWappen(von, nach) {
  if (!derLauf) return { ok: false, grund: 'Kein Feldzug.' };
  const r = derLauf.wappen;
  if (von < 0 || von >= r.length || nach < 0 || nach >= r.length) {
    return { ok: false, grund: 'Diesen Platz gibt es nicht.' };
  }
  if (von === nach) return { ok: true, kosten: 0, reihe: r.slice() };

  const k = derKampf;
  const kosten = k && !k.ende ? KERN.kosten.umhaengen : 0;
  if (kosten && kostetZuViel(kosten)) {
    return { ok: false, grund: 'Umhängen kostet ' + kosten + ' Tatendrang.' };
  }
  if (k && kosten) k.tatendrang -= kosten;

  const [w] = r.splice(von, 1);
  r.splice(nach, 0, w);
  verschiebePlatz(von, nach);
  return { ok: true, kosten, reihe: r.slice() };
}

/* ============================================================
 *  W A S   E I N   W A P P E N   H I E R   B R A E C H T E
 * ============================================================
 *
 * Ein Wappen verspricht auf der Karte etwas ("verdoppelt, was links steht").
 * Was es DEM SPIELER bringt, haengt an seinem Gestell, seinem Deck und seinen
 * Tuermen - und das laesst sich nicht aus dem Text ablesen. Der Greif ist das
 * staerkste Wappen im Spiel und auf einem leeren Gestell ein leeres Feld.
 *
 * Also wird nicht behauptet, sondern gemessen: ganze Kaempfe gegen einen
 * Pruefstein, mit und ohne das Wappen, an jedem moeglichen Platz. Das kostet
 * ein paar Millisekunden und beantwortet die einzige Frage, die der Spieler
 * an dieser Stelle hat.
 *
 * Fuenf Durchgaenge je Stellung mit fuenf verschiedenen Blaettern - aber bei
 * jedem Aufruf mit DENSELBEN fuenf. Ein gemischter Stapel streut so weit,
 * dass ein schwaches Wappen staerker aussieht als ein starkes; gemessen waere
 * dann das Blatt und nicht das Wappen.
 */
const PROBE_LAEUFE = 5;
const PROBE_STEIN = 1e12;   // hoch genug, dass niemand faellt; niedrig genug fuer genaue Gleitkomma

/** Ein ganzer Kampf mit dieser Reihe. Gibt den angerichteten Schaden. */
function probeSchaden(reihe, versatz) {
  const feind = { name: 'Prüfstein', hp: PROBE_STEIN, maxHp: PROBE_STEIN, regeln: [] };
  // Dasselbe Deck, nur anders angeschnitten: fuenf verschiedene Blaetter,
  // aber bei jedem Aufruf dieselben fuenf.
  const d = derLauf.deck.map(e => ({ ...e }));
  const deck = d.slice(versatz % d.length).concat(d.slice(0, versatz % d.length));
  const k = neuerKampf({ feind, deck, wappen: reihe, turmTypen: derLauf.turmTypen, mischen: false });
  for (let r = 0; r < KERN.runden && !k.ende; r++) {
    for (let i = 0; i < KERN.tuerme && k.hand.length && k.tatendrang > 0; i++) {
      if (!k.tuerme[i].einheit) setzeEinheit(i, k.hand[0]);
    }
    beendeRunde();
  }
  const schaden = PROBE_STEIN - k.feind.hp;
  raeumeKampf();
  return schaden;
}

/** Der Mittelwert ueber mehrere Durchgaenge - der Zugstapel ist gemischt. */
function probeMittel(reihe) {
  let summe = 0;
  for (let i = 0; i < PROBE_LAEUFE; i++) summe += probeSchaden(reihe, i * 11);
  return summe / PROBE_LAEUFE;
}

/**
 * Was dieses Wappen am jetzigen Gestell braechte - und auf welchem Platz am
 * meisten. Alles darunter ist gesichert und wird zurueckgelegt: eine Probe
 * darf weder den laufenden Kampf noch den Vorrat des Feldzugs anfassen.
 *
 * @param {string} id
 */
export function bewerteWappen(id) {
  if (!derLauf || !WAPPEN[id]) return null;
  const gemerkt = { kampf: derKampf, band: dasBand, vorrat: sichereVorrat() };
  try {
    const ohne = probeMittel(derLauf.wappen);
    let bester = { platz: 0, wucht: -1 };
    for (let p = 0; p <= derLauf.wappen.length && p < WAPPEN_PLAETZE; p++) {
      const reihe = derLauf.wappen.slice();
      reihe.splice(p, 0, id);
      const w = probeMittel(reihe);
      if (w > bester.wucht) bester = { platz: p, wucht: w };
    }
    return {
      ohne: Math.round(ohne),
      mit: Math.round(bester.wucht),
      platz: bester.platz,
      hebel: ohne > 0 ? bester.wucht / ohne : 0,
    };
  } finally {
    stelleVorratHer(gemerkt.vorrat);
    stelleBandHer(gemerkt.band);
    stelleKampfHer(gemerkt.kampf);
  }
}

export const WAPPEN_ANGEBOT = {
  gewoehnlich:   { gewicht: 60, ab: 1 },
  ungewoehnlich: { gewicht: 28, ab: 3 },
  selten:        { gewicht: 10, ab: 5 },
  legendaer:     { gewicht: 2,  ab: 8 },
};

export function angebotWappen() {
  if (derLauf.wappen.length >= WAPPEN_PLAETZE) return null;
  const station = derLauf.station;
  const offen = WAPPEN_LISTE.filter(id => {
    if (derLauf.wappen.includes(id)) return false;
    const r = WAPPEN_ANGEBOT[WAPPEN[id].seltenheit];
    return r && station >= r.ab;
  });
  if (!offen.length) return null;

  // Gewichtet ziehen: ein Zug auf die Summe, dann abzaehlen.
  const summe = offen.reduce((s, id) => s + WAPPEN_ANGEBOT[WAPPEN[id].seltenheit].gewicht, 0);
  let zug = Math.random() * summe;
  let id = offen[offen.length - 1];
  for (const k of offen) {
    zug -= WAPPEN_ANGEBOT[WAPPEN[k].seltenheit].gewicht;
    if (zug <= 0) { id = k; break; }
  }
  const w = WAPPEN[id];
  return { art: 'wappen', wappen: id, name: w.name, text: w.text,
    hinweis: w.hinweis, seltenheit: w.seltenheit, zeichen: w.zeichen, tinktur: w.tinktur };
}

/*
 * Ein Ausbau trifft einen Turm, der noch Wachturm ist - und wenn es keinen
 * mehr gibt, einen, dessen Typ sich noch ändern lässt. Ein zweites Mal
 * denselben Typ auf denselben Turm zu legen, wäre ein leeres Angebot.
 */
export function angebotAusbau() {
  if (!derLauf) return null;
  const roh = derLauf.turmTypen
    .map((t, i) => ({ i, t }))
    .filter(x => x.t === 'wachturm');
  const ziel = (roh.length ? roh : derLauf.turmTypen.map((t, i) => ({ i, t })))
    [Math.floor(Math.random() * (roh.length || derLauf.turmTypen.length))];
  if (!ziel) return null;
  const typen = Object.keys(TURMTYPEN).filter(t => t !== 'wachturm' && t !== ziel.t);
  if (!typen.length) return null;
  const typ = typen[Math.floor(Math.random() * typen.length)];
  return { art: 'ausbau', turm: ziel.i, typ, name: TURMTYPEN[typ].name + ' auf Turm ' + (ziel.i + 1),
    text: TURMTYPEN[typ].text };
}

/** Ein Angebot annehmen. Was hier hineingeht, bleibt für den ganzen Lauf. */
export function nimmAngebot(angebot) {
  if (!derLauf || !angebot) return { ok: false, grund: 'Kein Angebot.' };
  if (angebot.art === 'karte') { derLauf.deck.push(angebot.einheit); return { ok: true }; }
  if (angebot.art === 'wappen') return fuegeWappenHinzu(angebot.wappen);
  if (angebot.art === 'ausbau') return baueTurmAus(angebot.turm, angebot.typ);
  if (angebot.art === 'entfernen' && angebot.karten) {
    let n = 0;
    for (const k of angebot.karten) if (entferneKarte(k.uid).ok) n++;
    return n ? { ok: true, zahl: n } : { ok: false, grund: 'Das Deck wäre zu dünn.' };
  }
  if (angebot.art === 'sold') { derLauf.sold += angebot.sold; return { ok: true }; }
  return { ok: false, grund: 'Unbekanntes Angebot.' };
}

export function fuegeWappenHinzu(id) {
  if (!WAPPEN[id]) return { ok: false, grund: 'Dieses Wappen gibt es nicht.' };
  if (derLauf.wappen.includes(id)) return { ok: false, grund: 'Das Wappen hängt schon.' };
  if (derLauf.wappen.length >= WAPPEN_PLAETZE) return { ok: false, grund: 'Alle fünf Plätze sind belegt.' };
  derLauf.wappen.push(id);
  return { ok: true };
}

export function baueTurmAus(index, typ) {
  if (!TURMTYPEN[typ]) return { ok: false, grund: 'Diesen Turmtyp gibt es nicht.' };
  if (index < 0 || index >= derLauf.turmTypen.length) return { ok: false, grund: 'Diesen Turm gibt es nicht.' };
  derLauf.turmTypen[index] = typ;
  return { ok: true };
}

export function entferneKarte(uid) {
  const i = derLauf.deck.findIndex(k => k.uid === uid);
  if (i < 0) return { ok: false, grund: 'Diese Karte ist nicht im Deck.' };
  if (derLauf.deck.length <= KERN.handGroesse) return { ok: false, grund: 'Das Deck wäre zu dünn.' };
  const [weg] = derLauf.deck.splice(i, 1);
  return { ok: true, karte: weg };
}

export function schleifeKarte(uid) {
  const k = derLauf.deck.find(c => c.uid === uid);
  if (!k) return { ok: false, grund: 'Diese Karte ist nicht im Deck.' };
  verbessereEinheit(k, LAUF.schliff);
  return { ok: true, karte: k };
}

/** Knoten abhaken und weiterziehen. Am letzten Knoten endet der Lauf. */
export function verlasseKnoten() {
  if (!derLauf) return null;
  const kn = derKnoten();
  if (kn) kn.erledigt = true;
  derLauf.haendler = null;
  if (derLauf.station >= derLauf.stationen) {
    if (!derLauf.ende) derLauf.ende = 'sieg';
    return { ende: derLauf.ende };
  }
  derLauf.station++;
  return { ende: null, station: derLauf.station, knoten: derKnoten() };
}
