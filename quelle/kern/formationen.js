import { KERN } from './regeln.js';
import { WAPPEN } from './wappen.js';

// ---------- Formationen ----------
/*
 * Fuenf besetzte Tuerme sind ein Blatt. Was darin steckt, erkennt man wie in
 * einem Kartenspiel: gleiche Gattung, gleiche Raenge, eine Folge von Raengen -
 * und das Beste ist beides zugleich.
 *
 * DIE STELLUNG DER TUERME SPIELT KEINE ROLLE. Das ist der wichtigste
 * Unterschied zur ersten Fassung. Dort zaehlte Nachbarschaft, und damit war
 * "drei Bogenschuetzen" mal eine Formation und mal nicht, je nachdem, auf
 * welchen Tuermen sie zufaellig standen. Wer fuenf Bogenschuetzen aufstellt,
 * soll etwas Grosses bekommen - immer, ohne sie vorher sortieren zu muessen.
 *
 * FAMILIEN. Die Formationen stehen in drei Familien, und aus jeder gilt nur
 * die HOECHSTE erreichte. Fuenf gleiche Gattungen sind eine Reine Garde und
 * nicht zusaetzlich ein Regiment und ein Grosses Regiment - sonst waere jede
 * gute Aufstellung ein Stapel aus sechs Auszeichnungen, und niemand koennte
 * mehr abschaetzen, was eine davon wert ist.
 *
 * DER LOHN SIND SALVEN, keine Faktoren. Das ist das ganze Denkmodell:
 * bessere Formation, mehr Salven, und eine Salve ist ein Schuss, den man
 * sieht. Wer +7 Salven liest, weiss, was gleich passiert.
 */
export const FORMATIONS_FAMILIEN = {
  gattung: 'Gattung',
  rang: 'Rang',
  folge: 'Rangfolge',
  grund: 'Grundstellung',
};

/*
 * Jede Familie traegt ihr eigenes Zeichen, und die Marken in der Leiste
 * tragen es mit. Vorher sahen alle Formationen gleich aus - vier goldene
 * Plaettchen, die man einzeln lesen musste, um zu wissen, WORAN man gerade
 * baut. Mit dem Zeichen erkennt man die Familie, bevor man den Namen liest,
 * und weiss damit sofort, was eine bessere Karte an dieser Stelle brauchte.
 */
/*
 * Vorher stand hier ein gekreuztes Schwert fuer die Rangfamilie. Im Bild war
 * es ein duennes Kreuz - und damit kaum vom Mal-Zeichen der Salvenzahl
 * gleich daneben zu unterscheiden.
 */
export const FAMILIEN_ZEICHEN = {
  gattung: '⚑',       // eine Fahne: alle unter derselben
  rang: '‖',          // zwei gleiche, die nebeneinander stehen
  folge: '➤',         // die Spitze: Rang um Rang nach oben
  grund: '⛨',         // der Schild: alle fuenf Stellungen stehen
};

/*
 * Die Werte sind Stellschrauben und stehen bewusst hier oben beieinander.
 * `salven` ist der Grundwert, `jeStufe` was eine spaetere Aufwertung der
 * Formation dazugibt (siehe `formationsSalven`) - das Geruest dafuer steht,
 * die Ausbau-Oekonomie kommt spaeter.
 */
export const FORMATIONEN = [
  // ---- Grundstellung ----
  {
    id: 'geschlosseneFront', name: 'Geschlossene Front', familie: 'grund', rang: 1,
    salven: 1, jeStufe: 1,
    text: 'Alle fünf Stellungen besetzt.',
    finde: (h) => (h.anzahl === KERN.tuerme ? { tuerme: h.alle } : null),
  },

  // ---- Familie: gleiche Gattung ----
  {
    id: 'regiment', name: 'Regiment', familie: 'gattung', rang: 1,
    salven: 2, jeStufe: 1,
    text: 'Drei Einheiten derselben Gattung.',
    finde: (h) => h.gleicheGattung(3),
  },
  {
    id: 'grossesRegiment', name: 'Großes Regiment', familie: 'gattung', rang: 2,
    salven: 4, jeStufe: 2,
    text: 'Vier Einheiten derselben Gattung.',
    finde: (h) => h.gleicheGattung(4),
  },
  {
    id: 'reineGarde', name: 'Reine Garde', familie: 'gattung', rang: 3,
    salven: 7, jeStufe: 3,
    text: 'Alle fünf Stellungen mit derselben Gattung.',
    finde: (h) => (h.anzahl === KERN.tuerme ? h.gleicheGattung(5) : null),
  },

  // ---- Familie: gleiche Raenge ----
  {
    id: 'doppelposten', name: 'Doppelposten', familie: 'rang', rang: 1,
    salven: 1, jeStufe: 1,
    text: 'Zwei Einheiten desselben Rangs.',
    finde: (h) => h.gleicherRang(2),
  },
  {
    id: 'doppelteWache', name: 'Doppelte Wache', familie: 'rang', rang: 2,
    salven: 2, jeStufe: 1,
    text: 'Zwei verschiedene Paare.',
    finde: (h) => h.zweiPaare(),
  },
  {
    id: 'drillingsposten', name: 'Drillingsposten', familie: 'rang', rang: 3,
    salven: 3, jeStufe: 2,
    text: 'Drei Einheiten desselben Rangs.',
    finde: (h) => h.gleicherRang(3),
  },
  {
    id: 'viererblock', name: 'Viererblock', familie: 'rang', rang: 4,
    salven: 10, jeStufe: 4,
    text: 'Vier Einheiten desselben Rangs.',
    finde: (h) => h.gleicherRang(4),
  },

  // ---- Familie: Rangfolge ----
  {
    id: 'vormarsch', name: 'Vormarsch', familie: 'folge', rang: 1,
    salven: 2, jeStufe: 1,
    text: 'Drei aufeinanderfolgende Ränge.',
    finde: (h) => h.folge(3),
  },
  {
    id: 'grosserVormarsch', name: 'Großer Vormarsch', familie: 'folge', rang: 2,
    salven: 4, jeStufe: 2,
    text: 'Vier aufeinanderfolgende Ränge.',
    finde: (h) => h.folge(4),
  },
  {
    id: 'perfekterVormarsch', name: 'Perfekter Vormarsch', familie: 'folge', rang: 3,
    salven: 7, jeStufe: 3,
    text: 'Fünf aufeinanderfolgende Ränge.',
    finde: (h) => h.folge(5),
  },

  /*
   * Die Kroenung. Sie loest Gattungs- UND Rangfolgen-Familie zugleich ab -
   * darum steht sie in beiden und traegt `loest` - und ist das Seltenste, was
   * sich aus einem Blatt von 52 Karten bauen laesst: fuenf Karten einer
   * Gattung in ununterbrochener Folge.
   */
  {
    id: 'koeniglicherAufmarsch', name: 'Königlicher Aufmarsch', familie: 'gattung', rang: 9,
    loest: ['folge'], kroenung: true,
    salven: 15, jeStufe: 5,
    text: 'Fünf aufeinanderfolgende Ränge derselben Gattung.',
    finde: (h) => {
      if (h.anzahl !== KERN.tuerme) return null;
      const gattung = h.gleicheGattung(5);
      const folge = h.folge(5);
      return gattung && folge ? { tuerme: h.alle } : null;
    },
  },

  /*
   * Die Spitze. Ein Koeniglicher Aufmarsch kann bei 2 anfangen; die Garde ist
   * der eine Aufmarsch, der oben endet - 9, 10, 11, 12, 13 in einer Gattung.
   * Sie steht in derselben Familie wie der Aufmarsch und eine Stufe darueber,
   * also gilt immer nur eine von beiden, nie beide. Das ist das Seltenste, was
   * fuenf Stellungen hergeben, und es soll sich auch so anfuehlen.
   */
  {
    id: 'koeniglicheGarde', name: 'Königliche Garde', familie: 'gattung', rang: 10,
    loest: ['folge'], kroenung: true, garde: true,
    salven: 25, jeStufe: 8,
    text: 'Neun bis König in einer Gattung.',
    finde: (h) => {
      if (h.anzahl !== KERN.tuerme) return null;
      if (!h.gleicheGattung(KERN.tuerme)) return null;
      const raenge = new Set(h.karten.map(k => k.rang));
      for (const r of KOENIGSRAENGE) if (!raenge.has(r)) return null;
      return { tuerme: h.alle };
    },
  },
];

/* Die Raenge, aus denen eine Koenigliche Garde besteht - Neun bis Koenig. */
export const KOENIGSRAENGE = [9, 10, 11, 12, 13];

/*
 * Das Blatt: die besetzten Stellungen, aufbereitet zum Mustersuchen. Alles
 * hier arbeitet auf MENGEN, nicht auf Nachbarschaft - deshalb ist
 * `7 / 3 / 6 / 12 / 5` genau dieselbe Folge wie `5 / 6 / 7`.
 */
export function baueBlatt(tuerme, wappen = []) {
  const rangFaktoren = wappen.map(w => WAPPEN[w] && WAPPEN[w].rangFaktor).filter(Boolean);
  const doppelt = wappen
    .map(w => (WAPPEN[w] ? WAPPEN[w].zaehltDoppelt : undefined))
    .filter(i => i !== undefined);
  const alle = [];
  const karten = [];
  tuerme.forEach((t, i) => {
    if (!t || !t.einheit) return;
    const rang = Math.round(rangFaktoren.reduce((r, f) => r * (f(t, i) || 1), t.einheit.rang));
    alle.push(i);
    karten.push({ turm: i, rang, gattung: t.einheit.gattung });
    // Ein Wappen kann eine Stellung doppelt zaehlen lassen. Die Kopie traegt
    // denselben Turm - so leuchtet beim Zuenden die richtige Stellung auf.
    if (doppelt.includes(i)) karten.push({ turm: i, rang, gattung: t.einheit.gattung, kopie: true });
  });

  /** Die n haeufigste Gattung - wenn sie mindestens n mal vorkommt. */
  const gleicheGattung = (n) => {
    const nach = {};
    for (const k of karten) (nach[k.gattung] || (nach[k.gattung] = [])).push(k.turm);
    for (const g in nach) if (nach[g].length >= n) return { tuerme: nach[g], gattung: g };
    return null;
  };

  const nachRang = () => {
    const nach = {};
    for (const k of karten) (nach[k.rang] || (nach[k.rang] = [])).push(k.turm);
    return nach;
  };

  /** Der hoechste Rang, der mindestens n mal vorkommt. */
  const gleicherRang = (n) => {
    const nach = nachRang();
    let beste = null;
    for (const r in nach) {
      if (nach[r].length < n) continue;
      if (!beste || Number(r) > beste.rang) beste = { tuerme: nach[r].slice(0, n), rang: Number(r) };
    }
    return beste;
  };

  /** Zwei verschiedene Raenge, die je zweimal vorkommen. */
  const zweiPaare = () => {
    const nach = nachRang();
    const paare = Object.keys(nach).filter(r => nach[r].length >= 2)
      .sort((a, b) => Number(b) - Number(a));
    if (paare.length < 2) return null;
    return { tuerme: [...nach[paare[0]].slice(0, 2), ...nach[paare[1]].slice(0, 2)] };
  };

  /*
   * Die laengste ununterbrochene Rangfolge. Gleiche Raenge zaehlen einmal -
   * `8 / 8 / 9 / 10` ist eine Folge von drei, keine von vier.
   */
  const folge = (n) => {
    const raenge = [...new Set(karten.map(k => k.rang))].sort((a, b) => a - b);
    let beste = [];
    let lauf = [];
    for (let i = 0; i < raenge.length; i++) {
      if (i && raenge[i] === raenge[i - 1] + 1) lauf.push(raenge[i]);
      else lauf = [raenge[i]];
      if (lauf.length > beste.length) beste = lauf.slice();
    }
    if (beste.length < n) return null;
    // Die letzten n der Folge nehmen: die hoechsten Raenge sind die wertvollsten.
    const genommen = beste.slice(-n);
    const tuerme = genommen.map(r => karten.find(k => k.rang === r).turm);
    return { tuerme, raenge: genommen };
  };

  // `anzahl` zaehlt Stellungen, nicht Karten: eine Kopie besetzt keinen Turm.
  return { tuerme, karten, alle, anzahl: alle.length,
    gleicheGattung, gleicherRang, zweiPaare, folge };
}

/*
 * Was eine Formation an Salven bringt. Die Stufe kommt aus dem Lauf, wenn es
 * ihn gibt - so lassen sich einzelne Formationen spaeter dauerhaft aufwerten,
 * ohne dass hier etwas umgebaut werden muesste.
 */
/*
 * Dieselbe Umkehrung wie beim Eber: die Stufe einer Formation steht im LAUF,
 * aber die Formationen sollen den Lauf nicht kennen - sonst haengt die
 * Kampfrechnung am Deckbuilder. Der Lauf meldet sich hier an; ohne ihn (in
 * einer Pruefung etwa) gilt ueberall Stufe eins.
 */
let stufenquelle = () => null;
export function setzeStufenquelle(fn) { stufenquelle = fn; }

export function formationsStufe(id) {
  const stufen = stufenquelle();
  return (stufen && stufen[id]) || 1;
}

export function formationsSalven(f, stufe) {
  return f.salven + (stufe - 1) * (f.jeStufe || 0);
}

/*
 * Erkennen. Erst alles sammeln, was zutrifft, dann je Familie nur die hoechste
 * stehen lassen - und was eine Kroenung abloest, faellt mit.
 */
export function erkenneFormationen(tuerme, wappen = []) {
  const blatt = baueBlatt(tuerme, wappen);
  if (!blatt.anzahl) return [];

  const treffer = [];
  for (const f of FORMATIONEN) {
    const t = f.finde(blatt);
    if (!t) continue;
    const stufe = formationsStufe(f.id);
    treffer.push({
      id: f.id, name: f.name, text: f.text, familie: f.familie, rang: f.rang,
      kroenung: Boolean(f.kroenung), garde: Boolean(f.garde), loest: f.loest || [],
      tuerme: t.tuerme || blatt.alle,
      stufe, salven: formationsSalven(f, stufe),
    });
  }

  // Je Familie die hoechste.
  const beste = {};
  for (const t of treffer) {
    if (!beste[t.familie] || t.rang > beste[t.familie].rang) beste[t.familie] = t;
  }
  const raus = Object.values(beste);
  // Was eine Kroenung abloest, faellt heraus.
  const abgeloest = new Set();
  for (const t of raus) for (const fam of t.loest) abgeloest.add(fam);
  return raus.filter(t => !abgeloest.has(t.familie))
    .sort((a, b) => b.salven - a.salven);
}

/** Wie viele Salven die ganze Burg feuert: eine Grundsalve plus alles, was die Formationen geben. */
export function salvenZahl(formationen) {
  return KERN.salvenGrund + formationen.reduce((s, f) => s + f.salven, 0);
}
