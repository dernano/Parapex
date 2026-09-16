import { KERN } from './regeln.js';
import { START_DECK, grundwucht, neueEinheit } from './einheiten.js';
import { TURM_START, turmFaktor } from './tuerme.js';
import { baueFeind } from './feinde.js';
import { WAPPEN_PLAETZE, setzeEinzelschuss } from '../wappen/sammlung.js';
import { EREIGNIS } from '../wappen/ereignisse.js';
import { loeseAus, neuesBand, raeumeBand, setzeRunde } from '../wappen/fliessband.js';
import { frischerKampfvorrat, neuerVorrat, derVorrat } from '../wappen/vorrat.js';
import { berechneWucht } from './wucht.js';

// ---------- Der Kampf ----------
/*
 * Fünf Runden, mehr gibt es nicht. Der Gegner hat einen Wert, der Spieler hat
 * Tatendrang, und die einzige Frage ist: reicht die Wucht, die ich in fünf
 * Runden aufbaue? Es gibt keinen Block, keine Verteidigungskarte und keinen
 * Grund, Zeit zu schinden.
 */
export let derKampf = null;

// Der Eber braucht einen Einzelschuss; hier bekommt er ihn.
setzeEinzelschuss((einheit, index, quelle) => schiesseEinzeln(einheit, index, quelle));

/** @param {import('./typen.js').Kampfauftrag} [auftrag] */
export function neuerKampf({ feind, deck, wappen = [], turmTypen = TURM_START, stellungen = null, mischen = true } = {}) {
  /*
   * `stellungen` sind die Turmobjekte, die die Anzeige ohnehin schon hat -
   * mit Feld, Modell und allem, was zum Zeichnen gehört. Der Kern hängt seine
   * eigenen Felder daran, statt eigene Objekte zu bauen: so gibt es EIN
   * Turmobjekt und nicht zwei, die auseinanderlaufen können.
   */
  /*
   * Ohne Stellungen von der Anzeige baut der Kern leere Huellen - und die sind
   * eben NOCH keine Tuerme, sondern werden gleich zu welchen gemacht. Genau
   * das sagt `Partial`; die Typpruefung hat es zu Recht angemahnt.
   */
  const roh = /** @type {Partial<import('./typen.js').Turm>[]} */ (
    stellungen || Array.from({ length: KERN.tuerme }, () => ({})));
  const tuerme = roh
    .slice(0, KERN.tuerme)
    .map((t, i) => Object.assign(t, { nr: i + 1, typ: t.typ || turmTypen[i] || 'wachturm', einheit: null }));
  const gegner = feind || baueFeind(1);
  /*
   * Das Band traegt die Reihenfolge, und `k.wappen` IST seine Liste - nicht
   * eine Kopie davon. Sonst haette der Kampf eine Ordnung und das Band eine
   * andere, und ein Zug am Gestell aenderte nur eine von beiden.
   */
  const band = neuesBand(wappen.slice(0, WAPPEN_PLAETZE), gegner);
  if (!derVorrat) neuerVorrat();
  frischerKampfvorrat();

  const k = {
    runde: 1,
    rundenMax: KERN.runden,
    tatendrang: KERN.tatendrang,
    tatendrangMax: KERN.tatendrang,
    tauschInRunde: 0,
    tuerme,
    zug: (deck || START_DECK.map(id => neueEinheit(id))).slice(),
    hand: [],
    ablage: [],
    wappen: band.reihe,
    feind: gegner,
    ende: null,           // null | 'sieg' | 'niederlage'
    log: [],              // was in dieser Runde geschah, für Anzeige und Prüfung
  };
  derKampf = k;
  /*
   * `mischen: false` ist nur fuer Proben da (siehe `bewerteWappen`). Wer
   * messen will, was ein Wappen bringt, darf nicht in Wahrheit das Blatt
   * messen - und fuenf gemischte Durchgaenge streuen so weit, dass ein
   * schwaches Wappen staerker aussieht als ein starkes.
   */
  if (mischen) mischeZug();
  loeseAus(EREIGNIS.kampfBeginnt, { feind: gegner });
  beginneRunde(1);
  return k;
}

/** Rundenanfang an einer Stelle: Wappen duerfen sagen, wie viel gezogen wird. */
function beginneRunde(runde) {
  const k = derKampf;
  setzeRunde(runde);
  /*
   * Auch der Tatendrang steht hier zur Verhandlung. Er ist die knappste
   * Waehrung des Kampfes - eine Bossregel, die ihn angreift, trifft den
   * Spieler haerter als jede Zahl am Gegner, und ein Wappen, das ihn hebt,
   * ist mehr wert als eines, das Wucht gibt.
   */
  const lage = loeseAus(EREIGNIS.rundeBeginnt,
    { runde, ziehen: KERN.handGroesse, tatendrang: k.tatendrangMax });
  k.tatendrang = Math.max(1, Math.round(lage.daten.tatendrang));
  zieheAuf(Math.max(1, Math.round(lage.daten.ziehen)));
}

/*
 * Den laufenden Kampf zuruecklegen. Nur fuer Proben: `bewerteWappen` spielt
 * ganze Kaempfe durch, um zu messen, was ein angebotenes Wappen an DIESEM
 * Gestell braechte. Danach muss der echte Kampf wieder dastehen, als waere
 * nichts gewesen.
 */
export function stelleKampfHer(k) { derKampf = k; }

export function mischeZug() {
  const k = derKampf;
  for (let i = k.zug.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [k.zug[i], k.zug[j]] = [k.zug[j], k.zug[i]];
  }
}

/** Eine Karte vom Zugstapel. Ist er leer, wird die Ablage zum neuen Stapel. */
export function ziehe() {
  const k = derKampf;
  if (!k.zug.length) {
    if (!k.ablage.length) return null;
    k.zug = k.ablage;
    k.ablage = [];
    mischeZug();
  }
  const karte = k.zug.pop();
  if (karte) { k.hand.push(karte); loeseAus(EREIGNIS.karteGezogen, { karte }); }
  return karte;
}

export function zieheAuf(anzahl) {
  let gezogen = 0;
  while (derKampf.hand.length < anzahl) {
    if (!ziehe()) break;
    gezogen++;
  }
  return gezogen;
}

/** Reicht der Tatendrang für diese Handlung? */
export function kostetZuViel(kosten) { return kosten > derKampf.tatendrang; }

/**
 * Eine Einheit auf einen Turm. Steht dort schon jemand, wird er ersetzt und
 * wandert in die Ablage - die Wahrscheinlichkeiten im Stapel verschieben sich
 * dadurch während des Kampfes, und das ist beabsichtigt.
 *
 * Die neue Einheit feuert sofort einmal. Der Rest ihrer Wucht kommt am
 * Rundenende mit der Salve.
 */
export function setzeEinheit(index, karte) {
  const k = derKampf;
  if (!k || k.ende) return { ok: false, grund: 'Der Kampf ist vorbei.' };
  const turm = k.tuerme[index];
  if (!turm) return { ok: false, grund: 'Diesen Turm gibt es nicht.' };
  const inHand = k.hand.find(c => c.uid === karte.uid);
  if (!inHand) return { ok: false, grund: 'Diese Karte liegt nicht auf der Hand.' };
  const kosten = turm.einheit ? KERN.kosten.ersetzen : KERN.kosten.einsetzen;
  if (kostetZuViel(kosten)) return { ok: false, grund: 'Nicht genug Tatendrang.' };

  k.tatendrang -= kosten;
  k.hand = k.hand.filter(c => c.uid !== karte.uid);
  const alt = turm.einheit;
  turm.einheit = inHand;
  if (alt) {
    k.ablage.push(alt);
    loeseAus(EREIGNIS.einheitErsetzt, { turm: index, alt, neu: inHand });
  }
  loeseAus(EREIGNIS.einheitGesetzt, { turm: index, einheit: inHand });
  const schaden = schiesseEinzeln(inHand, index, 'Einsatz');
  return { ok: true, kosten, ersetzt: alt, schaden };
}

/**
 * Ein einzelner Schuss - beim Einsetzen, und für Wappen, die eine Einheit
 * ausserhalb der Salve feuern lassen. Rechnet mit derselben Kette wie die
 * Salve, nur für einen Turm.
 */
export function schiesseEinzeln(einheit, index, quelle) {
  const k = derKampf;
  if (!k || k.ende) return 0;
  const turm = k.tuerme[index] || { typ: 'wachturm', einheit };
  const wucht = Math.round(grundwucht(einheit) * turmFaktor({ ...turm, einheit }));
  trefferAufFeind(wucht, quelle);
  k.log.push({ art: 'schuss', quelle, turm: index, einheit: einheit.name, wucht });
  return wucht;
}

/** Eine Handkarte gegen eine neue tauschen. Das ist der Ersatz fürs Abwerfen. */
export function tauscheHandkarte(karte) {
  const k = derKampf;
  if (!k || k.ende) return { ok: false, grund: 'Der Kampf ist vorbei.' };
  const inHand = k.hand.find(c => c.uid === karte.uid);
  if (!inHand) return { ok: false, grund: 'Diese Karte liegt nicht auf der Hand.' };
  if (kostetZuViel(tauschKostenFuer(1))) return { ok: false, grund: 'Nicht genug Tatendrang.' };

  const kosten = vollzieheTausch(k.tauschInRunde, 1);
  k.tatendrang -= kosten;
  k.tauschInRunde++;
  k.hand = k.hand.filter(c => c.uid !== karte.uid);
  k.ablage.push(inHand);
  const neu = ziehe();
  return { ok: true, kosten, neu };
}

/*
 * Mehrere Handkarten auf einmal tauschen. Jede kostet fuer sich, der Rabatt
 * der Schlange greift also nur auf die ersten.
 *
 * Die Reihenfolge ist der ganze Trick: erst kommen die getauschten Karten
 * BEISEITE, dann wird nachgezogen, und erst danach wandern sie in die Ablage.
 * Wuerde man sie sofort ablegen, koennte ein leerer Zugstapel sie mitmischen
 * und man zoege genau die Karte wieder, die man gerade loswerden wollte.
 * Dasselbe gilt fuer den Nachzug: vier Karten zu tauschen heisst vier neue,
 * auch wenn der Stapel dazwischen neu gemischt werden muss.
 */
export function tauscheHandkarten(karten) {
  const k = derKampf;
  if (!k || k.ende) return { ok: false, grund: 'Der Kampf ist vorbei.' };
  const liste = (karten || []).map(c => k.hand.find(h => h.uid === c.uid)).filter(Boolean);
  if (!liste.length) return { ok: false, grund: 'Keine Karte gewählt.' };
  const gefragt = tauschKostenFuer(liste.length);
  if (kostetZuViel(gefragt)) {
    return { ok: false, grund: 'Dafür fehlen ' + (gefragt - k.tatendrang) + ' Tatendrang.' };
  }

  const kosten = vollzieheTausch(k.tauschInRunde, liste.length);
  k.tatendrang -= kosten;
  k.tauschInRunde += liste.length;
  const weg = new Set(liste.map(c => c.uid));
  k.hand = k.hand.filter(c => !weg.has(c.uid));
  const neu = [];
  for (let i = 0; i < liste.length; i++) {
    const g = ziehe();
    if (g) neu.push(g);
  }
  k.ablage.push(...liste);          // erst JETZT, nach dem Nachziehen
  return { ok: true, kosten, alt: liste, neu };
}

/*
 * Was ein Tausch kostet, entscheidet die Wappenreihe. Vorher gab es dafuer
 * einen eigenen Haken (`tauschRabatt`), den genau ein Wappen bediente und
 * den niemand verstaerken, kopieren oder versiegeln konnte.
 *
 * Jetzt ist es ein Ereignis wie jedes andere: `kartenGetauscht` geht mit dem
 * vollen Preis hinein und kommt mit dem echten heraus. Es laeuft als PROBE -
 * die Anzeige fragt bei jedem Klick auf eine Handkarte nach dem Preis, und
 * das darf weder Pulver kosten noch im Protokoll stehen.
 */
/*
 * Zweimal dasselbe Ereignis, und der Unterschied ist wichtig: die ANFRAGE
 * (`probe`) beantwortet nur, was es kostete - die Anzeige stellt sie bei
 * jedem Klick auf eine Handkarte. Der VOLLZUG laeuft echt, verbraucht
 * Vorraete und steht im Protokoll.
 *
 * Ohne diese Trennung stand die Schlange in keinem einzigen Kampfprotokoll:
 * sie wirkte ausschliesslich in Proben, und die werden zu Recht nicht
 * aufgeschrieben. Die Synergie-Matrix hat sie deshalb als totes Wappen
 * gemeldet - zu Recht.
 *
 * @param {number} schonGetauscht @param {number} anzahl @param {boolean} probe
 */
function tauschpreis(schonGetauscht, anzahl, probe) {
  const lage = loeseAus(EREIGNIS.kartenGetauscht,
    { anzahl, schonGetauscht, kosten: KERN.kosten.tauschen }, null, probe);
  return Math.max(0, Math.round(lage.daten.kosten));
}

/** Der Vollzug: einmal je getauschter Karte, echt. Gibt den gezahlten Preis. */
function vollzieheTausch(schonGetauscht, anzahl) {
  let summe = 0;
  for (let i = 0; i < anzahl; i++) summe += tauschpreis(schonGetauscht + i, anzahl, false);
  return summe;
}

/*
 * Was n Tausche zusammen kosten. Der Rabatt gilt je Tausch und nur solange
 * er reicht - drei Karten bei zwei freien Tauschen kosten eins.
 */
export function tauschKostenFuer(n) {
  const k = derKampf;
  if (!k) return n * KERN.kosten.tauschen;
  let summe = 0;
  for (let i = 0; i < n; i++) summe += tauschpreis(k.tauschInRunde + i, n, true);
  return summe;
}

/** Wie viel der naechste einzelne Tausch kostet. */
export function tauschKosten() { return tauschKostenFuer(1); }

/*
 * Schaden am Gegner, an einer einzigen Stelle - damit der Sieg nur hier faellt
 * und damit es genau EINEN Ort gibt, an dem Wappen einen Treffer noch
 * anfassen koennen.
 *
 * Drei Ereignisse hintereinander, und die Reihenfolge ist die Geschichte des
 * Treffers: er wird gefuehrt (`feindGetroffen`, hier laesst sich die Wucht
 * noch aendern), er geht ueber das Ziel hinaus (`ueberschlag`, was die
 * Brandschatzung einsammelt), er faellt (`feindBesiegt`).
 */
export function trefferAufFeind(wucht, quelle) {
  const k = derKampf;
  if (!k || k.ende || wucht <= 0) return 0;

  const lage = loeseAus(EREIGNIS.feindGetroffen, { wucht, quelle });
  const echt = Math.max(0, Math.round(lage.daten.wucht));
  if (echt <= 0) return 0;

  const ueber = echt - k.feind.hp;
  k.feind.hp = Math.max(0, k.feind.hp - echt);
  if (ueber > 0) loeseAus(EREIGNIS.ueberschlag, { ueber, quelle });

  if (k.feind.hp <= 0 && !k.ende) {
    k.ende = 'sieg';
    loeseAus(EREIGNIS.feindBesiegt, { quelle });
    loeseAus(EREIGNIS.kampfEndet, { ende: 'sieg' });
  }
  return echt;
}

/**
 * Runde beenden: die ganze Besatzung feuert gemeinsam, dann wird abgerechnet.
 * Nach der fünften Runde ist Schluss - wer den Gegner bis dahin nicht
 * niedergerungen hat, hat verloren. Es gibt keine sechste.
 */
export function beendeRunde() {
  const k = derKampf;
  if (!k || k.ende) return { ende: k && k.ende };

  // Diese eine Rechnung ist KEINE Probe: hier wird Pulver wirklich verbrannt
  // und hier steht das Kampfprotokoll.
  const abrechnung = berechneWucht(k.tuerme, k.wappen, false);
  loeseAus(EREIGNIS.salveGefeuert, { wucht: abrechnung.wucht, salven: abrechnung.salven });
  trefferAufFeind(abrechnung.wucht, 'Salve');
  k.log.push({ art: 'salve', runde: k.runde, wucht: abrechnung.wucht,
    salven: abrechnung.salven, kette: abrechnung.kette });
  loeseAus(EREIGNIS.rundeEndet, { runde: k.runde, wucht: abrechnung.wucht });

  if (k.ende === 'sieg') return { ende: 'sieg', abrechnung };
  if (k.runde >= k.rundenMax) {
    k.ende = 'niederlage';
    loeseAus(EREIGNIS.kampfEndet, { ende: 'niederlage' });
    return { ende: 'niederlage', abrechnung };
  }

  // Nächste Runde: Hand abwerfen, neu ziehen, Tatendrang auffüllen.
  k.ablage.push(...k.hand);
  k.hand = [];
  k.runde++;
  k.tauschInRunde = 0;
  beginneRunde(k.runde);
  return { ende: null, abrechnung, runde: k.runde };
}

/**
 * Was die Burg wöge, wenn diese Karte auf diesem Turm stünde. Für die
 * Vorschau, während eine Karte über einem Turm hängt - der Spieler soll
 * Kombinationen sehen, statt sie im Kopf auszurechnen.
 */
export function vorschau(index, karte) {
  const k = derKampf;
  const probe = k.tuerme.map((t, i) => (i === index ? { ...t, einheit: karte } : { ...t }));
  return berechneWucht(probe, k.wappen, true);
}

/*
 * WAS AENDERT SICH, WENN ICH DIESES WAPPEN DORTHIN HAENGE?
 *
 * Das ist die Frage, wegen der das Gestell ueberhaupt beweglich ist - und
 * sie war bisher nur durch Ausprobieren zu beantworten, also durch Bezahlen.
 * Beide Reihen werden in der Probe gerechnet; die Welt bleibt unberuehrt.
 *
 * Verschieben, nicht tauschen: genau das tut `ordneWappen`, und eine
 * Vorschau, die etwas anderes rechnet als der Knopf tut, ist schlimmer als
 * keine.
 *
 * @param {number} von @param {number} nach
 */
export function ordnungsVorschau(von, nach) {
  const k = derKampf;
  if (!k || von === nach) return null;
  const reihe = k.wappen.slice();
  if (von < 0 || von >= reihe.length || nach < 0 || nach >= reihe.length) return null;
  if (!reihe[von]) return null;

  const jetzt = berechneWucht(k.tuerme, reihe, true);
  const andere = reihe.slice();
  const [w] = andere.splice(von, 1);
  andere.splice(nach, 0, w);
  const dann = berechneWucht(k.tuerme, andere, true);

  const a = Math.round(jetzt.wucht), b = Math.round(dann.wucht);
  return {
    von, nach,
    vorher: { wucht: a, salven: jetzt.salven },
    nachher: { wucht: b, salven: dann.salven },
    unterschied: b - a,
    gleich: a === b,
  };
}

/** Der Kampf ist vorbei: die Besatzung räumt die Türme, die Gebäude bleiben. */
export function raeumeKampf() {
  if (!derKampf) return;
  for (const t of derKampf.tuerme) t.einheit = null;
  raeumeBand();
}
