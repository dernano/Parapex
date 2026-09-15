import { KERN } from './regeln.js';
import { START_DECK, grundwucht, neueEinheit } from './einheiten.js';
import { TURM_START, turmFaktor } from './tuerme.js';
import { baueFeind } from './feinde.js';
import { WAPPEN, WAPPEN_PLAETZE, setzeEinzelschuss } from './wappen.js';
import { hoereSignal, leereSignale, sendeSignal } from './signale.js';
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
export function neuerKampf({ feind, deck, wappen = [], turmTypen = TURM_START, stellungen = null } = {}) {
  leereSignale();
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
    wappen: wappen.slice(0, WAPPEN_PLAETZE),
    feind: feind || baueFeind(1),
    ende: null,           // null | 'sieg' | 'niederlage'
    log: [],              // was in dieser Runde geschah, für Anzeige und Prüfung
  };
  derKampf = k;
  mischeZug();
  // Wappen hängen sich ein, sobald der Kampf steht - nicht der Kampf kennt sie.
  for (const w of k.wappen) {
    const horcht = WAPPEN[w] && WAPPEN[w].horcht;
    for (const name in horcht || {}) hoereSignal(name, horcht[name]);
  }
  sendeSignal('rundeBeginnt', { runde: 1 });
  zieheAuf(KERN.handGroesse);
  return k;
}

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
  if (karte) { k.hand.push(karte); sendeSignal('karteGezogen', { karte }); }
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
    sendeSignal('einheitErsetzt', { turm: index, alt, neu: inHand });
    sendeSignal('einheitEntfernt', { turm: index, einheit: alt });
  }
  sendeSignal('einheitGesetzt', { turm: index, einheit: inHand });
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
  sendeSignal('einheitFeuert', { turm: index, einheit, wucht, quelle });
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
  const kosten = Math.max(0, KERN.kosten.tauschen - tauschRabatt());
  if (kostetZuViel(kosten)) return { ok: false, grund: 'Nicht genug Tatendrang.' };

  k.tatendrang -= kosten;
  k.tauschInRunde++;
  k.hand = k.hand.filter(c => c.uid !== karte.uid);
  k.ablage.push(inHand);
  const neu = ziehe();
  sendeSignal('karteGetauscht', { alt: inHand, neu });
  return { ok: true, kosten, neu };
}

/** Was der Tausch gerade billiger ist - das Schlangenwappen zahlt den ersten. */
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
  const kosten = tauschKostenFuer(liste.length);
  if (kostetZuViel(kosten)) {
    return { ok: false, grund: 'Dafür fehlen ' + (kosten - k.tatendrang) + ' Tatendrang.' };
  }

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
  sendeSignal('karteGetauscht', { alt: liste, neu });
  return { ok: true, kosten, alt: liste, neu };
}

/*
 * Was n Tausche zusammen kosten. Der Rabatt der Schlange gilt je Tausch und
 * nur solange er reicht - drei Karten bei zwei freien Tauschen kosten eins.
 */
export function tauschKostenFuer(n) {
  const k = derKampf;
  if (!k) return n * KERN.kosten.tauschen;
  let summe = 0;
  const gemerkt = k.tauschInRunde;
  for (let i = 0; i < n; i++) {
    k.tauschInRunde = gemerkt + i;
    summe += Math.max(0, KERN.kosten.tauschen - tauschRabatt());
  }
  k.tauschInRunde = gemerkt;
  return summe;
}

export function tauschRabatt() {
  const k = derKampf;
  return k.wappen.reduce((r, w) => {
    const fn = WAPPEN[w] && WAPPEN[w].tauschRabatt;
    return Math.max(r, fn ? fn(k) : 0);
  }, 0);
}

export function tauschKosten() { return Math.max(0, KERN.kosten.tauschen - tauschRabatt()); }

/** Schaden am Gegner, an einer einzigen Stelle - damit der Sieg nur hier fällt. */
export function trefferAufFeind(wucht, quelle) {
  const k = derKampf;
  if (!k || k.ende || wucht <= 0) return;
  k.feind.hp = Math.max(0, k.feind.hp - wucht);
  if (k.feind.hp <= 0 && !k.ende) {
    k.ende = 'sieg';
    sendeSignal('feindBesiegt', { quelle });
    sendeSignal('kampfEndet', { ende: 'sieg' });
  }
}

/**
 * Runde beenden: die ganze Besatzung feuert gemeinsam, dann wird abgerechnet.
 * Nach der fünften Runde ist Schluss - wer den Gegner bis dahin nicht
 * niedergerungen hat, hat verloren. Es gibt keine sechste.
 */
export function beendeRunde() {
  const k = derKampf;
  if (!k || k.ende) return { ende: k && k.ende };

  const abrechnung = berechneWucht(k.tuerme, k.wappen);
  sendeSignal('salve', { wucht: abrechnung.wucht });
  trefferAufFeind(abrechnung.wucht, 'Salve');
  k.log.push({ art: 'salve', runde: k.runde, wucht: abrechnung.wucht });
  sendeSignal('rundeEndet', { runde: k.runde, wucht: abrechnung.wucht });

  if (k.ende === 'sieg') return { ende: 'sieg', abrechnung };
  if (k.runde >= k.rundenMax) {
    k.ende = 'niederlage';
    sendeSignal('kampfEndet', { ende: 'niederlage' });
    return { ende: 'niederlage', abrechnung };
  }

  // Nächste Runde: Hand abwerfen, neu ziehen, Tatendrang auffüllen.
  k.ablage.push(...k.hand);
  k.hand = [];
  k.runde++;
  k.tatendrang = k.tatendrangMax;
  k.tauschInRunde = 0;
  sendeSignal('rundeBeginnt', { runde: k.runde });
  zieheAuf(KERN.handGroesse);
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
  return berechneWucht(probe, k.wappen);
}

/** Der Kampf ist vorbei: die Besatzung räumt die Türme, die Gebäude bleiben. */
export function raeumeKampf() {
  if (!derKampf) return;
  for (const t of derKampf.tuerme) t.einheit = null;
  leereSignale();
}
