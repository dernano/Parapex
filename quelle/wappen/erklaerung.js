/*
 * WARUM HAT DAS GEZUENDET - UND WARUM NICHT?
 *
 * Das Fliessband ist ein gutes System und eine schlechte Erfahrung, solange
 * es schweigt. Der Spieler sieht fuenf Schilde, sieht eine Zahl am Ende und
 * hat keine Ahnung, welcher Schild daran schuld war. Schlimmer noch: er sieht
 * ein Wappen, das er fuer stark haelt, NICHTS tun - und lernt daraus nichts,
 * weil ihm keiner sagt, woran es lag.
 *
 * Hier steht deshalb die Auskunft, und zwar in drei Stufen:
 *
 *   REGEL        Was das Wappen tut. Ein Satz, aus der Sammlung.
 *   ERKLAERUNG   WANN es das tut, in Worten, und womit es zusammenspielt.
 *                Nicht von Hand geschrieben, sondern aus `hoert` abgeleitet -
 *                so kann die Erklaerung nicht von der Regel abweichen.
 *   AKTUELL      Was es im letzten Ereignis TATSAECHLICH bewirkt hat, wer es
 *                ausgeloest hat, wen es ausgeloest hat - und wenn nichts
 *                geschah, warum nicht.
 *
 * Die dritte Stufe ist die wichtigste. Alles andere steht auch auf der Karte;
 * nur diese Stufe beantwortet die Frage, die der Spieler wirklich hat.
 */

import { EREIGNIS, VORRAT_ARTEN } from './ereignisse.js';
import { WAPPEN } from './sammlung.js';
import { dasBand, WAPPEN_REGISTER, GRENZEN } from './fliessband.js';

/*
 * Die Ereignisse in Worten. Ein Wappen hoert nicht auf "salveGeplant",
 * sondern "bevor eine Salve fliegt" - und genau so muss es dastehen.
 */
export const EREIGNIS_NAMEN = {
  [EREIGNIS.kampfBeginnt]:       'wenn die Schlacht beginnt',
  [EREIGNIS.rundeBeginnt]:       'zu Beginn jeder Runde',
  [EREIGNIS.rundeEndet]:         'am Ende jeder Runde',
  [EREIGNIS.kampfEndet]:         'wenn die Schlacht vorbei ist',
  [EREIGNIS.karteGezogen]:       'wenn du eine Karte ziehst',
  [EREIGNIS.kartenGetauscht]:    'wenn du Karten tauschst',
  [EREIGNIS.einheitGesetzt]:     'wenn du eine Einheit auf eine Stellung setzt',
  [EREIGNIS.einheitErsetzt]:     'wenn du eine Einheit ersetzt',
  [EREIGNIS.blattGelesen]:       'wenn dein Blatt gelesen wird — bevor Formationen gesucht werden',
  [EREIGNIS.formationenErkannt]: 'wenn deine Formationen feststehen',
  [EREIGNIS.salveGeplant]:       'bevor eine Salve fliegt',
  [EREIGNIS.salveGefeuert]:      'wenn eine Salve geflogen ist',
  [EREIGNIS.feindGetroffen]:     'wenn der Gegner getroffen wird',
  [EREIGNIS.ueberschlag]:        'wenn mehr Wucht auftrifft, als der Gegner aushält',
  [EREIGNIS.feindBesiegt]:       'wenn der Gegner fällt',
  [EREIGNIS.wappenZuendet]:      'wenn ein anderes Wappen zündet',
};

/*
 * Warum eine Zuendung abgewiesen wurde. Die Sperren des Bandes sind kein
 * Zufall und kein Fehler - aber wer sie nicht erklaert bekommt, haelt sie
 * dafuer.
 */
export const ABWEISUNG_NAMEN = {
  siegel:     'Der Platz ist versiegelt.',
  tiefe:      'Die Kette war schon ' + GRENZEN.tiefe + ' Wappen tief.',
  jePlatz:    'Dieser Platz hatte in demselben Ereignis schon ' + GRENZEN.jePlatz
    + '-mal gezündet.',
  jeEreignis: 'In demselben Ereignis hatten schon ' + GRENZEN.jeEreignis
    + ' Wappen gezündet.',
  kreis:      'Es hätte sich selbst ausgelöst. Ein Wappen zündet nie in einem '
    + 'Ereignis, das es selbst angestossen hat.',
};

/** Worauf ein Wappen hoert - in Worten, aus `hoert` gelesen. */
export function hoertAuf(id) {
  const def = WAPPEN_REGISTER[id] || WAPPEN[id];
  if (!def || !def.hoert) return [];
  return Object.keys(def.hoert).map(e => EREIGNIS_NAMEN[e] || e);
}

/** Was eine einzelne Wirkung bewegt hat, in wenigen Zeichen. */
export function wirkungText(wi) {
  if (wi.art === 'salven') return (wi.wert > 0 ? '+' : '') + wi.wert + ' Salven';
  if (wi.art === 'salvenFaktor') return '×' + wi.wert + ' Salven';
  if (wi.art === 'jeSalveFaktor') return '×' + wi.wert + ' je Salve';
  if (wi.art === 'zusatz') return (wi.wert > 0 ? '+' : '') + Math.round(wi.wert) + ' Wucht';
  if (wi.art === 'faktor') return '×' + (Math.round(wi.wert * 100) / 100) + ' Wucht';
  if (wi.art === 'rang') return (wi.wert > 0 ? '+' : '') + wi.wert + ' Rang';
  if (wi.art === 'tatendrang') return (wi.wert > 0 ? '+' : '') + wi.wert + ' Tatendrang';
  if (wi.art === 'wucht') return (wi.wert > 0 ? '+' : '') + Math.round(wi.wert) + ' Wucht';
  if (wi.art === 'wuchtFaktor') return '×' + wi.wert + ' Wucht';
  if (wi.art === 'ziehen') return (wi.wert > 0 ? '+' : '') + wi.wert + ' Karten ziehen';
  if (wi.art === 'kosten') return (wi.wert > 0 ? '+' : '') + wi.wert + ' Tatendrang Kosten';
  if (wi.art === 'kopien') return (wi.wert > 0 ? '+' : '') + wi.wert + ' Kopien der Einheit';
  if (wi.art === 'siegel') return 'ein Platz versiegelt';
  if (wi.art === 'tausch') return 'ein Tausch verbilligt';
  if (wi.art === 'verhuellt') return 'verhüllt';
  if (wi.art === 'daneben') return 'ging ins Leere';
  if (wi.art === 'vorrat' && wi.wert && typeof wi.wert === 'object') {
    const a = VORRAT_ARTEN[wi.wert.art];
    return (wi.wert.menge > 0 ? '+' : '') + wi.wert.menge + ' '
      + (a ? a.name : wi.wert.art);
  }
  return wi.art;
}

/*
 * DIE KETTE. Woher eine Zuendung kam und was sie nach sich zog.
 *
 * Kein Fadenkreuz aus Linien - nur zwei Listen, und beide gemessen: sie
 * kommen aus `durch`, dem Verweis jeder Zuendung auf die, die sie ausgeloest
 * hat. Was hier steht, ist also nicht behauptet, sondern passiert.
 */
function ketteUm(zuendung, protokoll) {
  const nenne = (z) => ({ platz: z.platz, name: z.name, gegner: Boolean(z.gegner) });
  const vorher = protokoll.filter(z => z.nr === zuendung.durch).map(nenne);
  const nachher = protokoll.filter(z => z.durch === zuendung.nr && !z.abgewiesen).map(nenne);
  return { vorher, nachher };
}

/**
 * Was der Platz in der ZULETZT gespielten Runde getan hat.
 *
 * Nicht im letzten Ereignis: der Spieler fragt nicht "was war beim
 * Blattlesen", er fragt "was tut dieses Wappen fuer mich". Die Runde ist die
 * Einheit, in der er denkt, also ist sie die Einheit, in der berichtet wird.
 * Die Kette dagegen wird am letzten EREIGNIS abgelesen - ueber eine Runde
 * hinweg waere sie ein Knaeuel.
 *
 * @param {number} platz
 * @param {any[]} [protokoll] wenn nicht angegeben: das laufende Band
 */
export function platzBericht(platz, protokoll) {
  const p = protokoll || (dasBand ? dasBand.protokoll : []);
  if (!p.length) return null;

  const runde = p[p.length - 1].runde;
  const ausschnitt = p.filter(z => z.runde === runde);
  const meine = ausschnitt.filter(z => z.platz === platz);
  const gezuendet = meine.filter(z => !z.abgewiesen);
  const abgewiesen = [...meine].reverse().find(z => z.abgewiesen);

  /* Dasselbe zweimal ist "2 ×", nicht zwei Zeilen. */
  const gezaehlt = [];
  for (const z of gezuendet) {
    for (const wi of z.wirkungen) {
      const t = wirkungText(wi);
      const schon = gezaehlt.find(x => x.text === t);
      if (schon) schon.mal++; else gezaehlt.push({ text: t, mal: 1 });
    }
  }
  const wirkungen = gezaehlt.map(x => (x.mal > 1 ? x.text + ' (' + x.mal + '×)' : x.text));

  /* Die Kette: nur um die LETZTE Zuendung, und nur in deren Ereignis. */
  let kette = { vorher: [], nachher: [] };
  let ereignis = null;
  if (gezuendet.length) {
    const z = gezuendet[gezuendet.length - 1];
    ereignis = z.ereignis;
    kette = ketteUm(z, ausschnitt.filter(x => x.ereignisNr === z.ereignisNr));
  }

  return {
    runde,
    ereignis,
    ereignisName: ereignis ? (EREIGNIS_NAMEN[ereignis] || ereignis) : null,
    male: gezuendet.length,
    wirkungen,
    abgewiesen: abgewiesen
      ? { grund: abgewiesen.abgewiesen,
          text: ABWEISUNG_NAMEN[abgewiesen.abgewiesen] || abgewiesen.abgewiesen }
      : null,
    ...kette,
  };
}

/**
 * Die ganze Auskunft zu einem Platz: Regel, Erklaerung, Aktuell.
 * @param {number} platz
 */
export function wappenBericht(platz) {
  const id = dasBand ? dasBand.reihe[platz] : null;
  if (!id) return null;
  const w = WAPPEN[id] || WAPPEN_REGISTER[id];
  if (!w) return null;

  const hoert = hoertAuf(id);
  const bericht = platzBericht(platz);
  const versiegelt = Boolean(dasBand && dasBand.gesiegelt.includes(platz));

  /*
   * WARUM NICHT? Drei Faelle, und nur drei - jeder mit einer eigenen Antwort.
   * Der haeufigste ist der dritte, und genau der stand bisher nirgends: das
   * Wappen hoert schlicht nicht auf das, was gerade geschehen ist.
   */
  let warumNicht = null;
  if (versiegelt) {
    /*
     * Ein Siegel gilt ab jetzt - auch fuer ein Wappen, das vorher noch
     * gezuendet hat. Wer das nicht sagt, laesst den Spieler auf eine
     * Wirkung warten, die nicht mehr kommt.
     */
    warumNicht = ABWEISUNG_NAMEN.siegel;
  } else if (!bericht) {
    warumNicht = hoert.length
      ? 'Noch nichts geschehen. Es wartet auf: ' + hoert.join(' · ') + '.'
      : 'Es hört auf kein Ereignis — dieses Wappen kann nichts tun.';
  } else if (!bericht.male) {
    if (bericht.abgewiesen) warumNicht = bericht.abgewiesen.text;
    else if (hoert.length) {
      warumNicht = 'Es wartet auf etwas, das in dieser Runde nicht eingetreten ist: '
        + hoert.join(' · ') + '.';
    } else {
      warumNicht = 'Es hört auf kein Ereignis — dieses Wappen kann nichts tun.';
    }
  } else if (bericht && bericht.male && !bericht.wirkungen.length) {
    warumNicht = 'Es hat gezündet, aber nichts verändert — die Bedingung im Wappen traf nicht zu.';
  }

  return {
    platz, id, name: w.name, zeichen: w.zeichen, seltenheit: w.seltenheit,
    versiegelt,
    regel: w.text,
    hoert,
    zusammen: w.hinweis || '',
    jetzt: bericht,
    warumNicht,
  };
}

/*
 * WOHER KOMMEN DIESE SALVEN?
 *
 * Die Salvenzahl ist die Zahl, die im Kampf am staerksten schwankt - und die
 * am wenigsten erklaert war. Formationen stehen in der Abrechnung, Wappen
 * standen nirgends. Hier steht, WELCHES Wappen wie viele Salven beigetragen
 * hat, aus demselben Protokoll, das auch der Kampf gelesen hat.
 *
 * @param {any[]} protokoll
 */
export function salvenHerkunft(protokoll) {
  const zu = [];
  for (const z of protokoll || []) {
    if (z.abgewiesen) continue;
    for (const wi of z.wirkungen) {
      if (wi.art !== 'salven' && wi.art !== 'salvenFaktor') continue;
      let e = zu.find(x => x.platz === z.platz);
      if (!e) {
        e = { platz: z.platz, name: z.name, gegner: Boolean(z.gegner), plus: 0, mal: 1 };
        zu.push(e);
      }
      if (wi.art === 'salven') e.plus += wi.wert;
      else e.mal *= wi.wert;
    }
  }
  return zu.map(e => ({
    ...e,
    text: [e.plus ? (e.plus > 0 ? '+' : '') + e.plus : '',
      e.mal !== 1 ? '×' + (Math.round(e.mal * 100) / 100) : ''].filter(Boolean).join(' '),
  }));
}

/*
 * DIE REIHENFOLGE, mit den Wappen des Spielers erklaert.
 *
 * Ein Satz ueber "links nach rechts" lernt niemand. Zwei konkrete Namen aus
 * dem eigenen Gestell schon - deshalb sucht das hier ein Paar aus der REIHE
 * DES SPIELERS heraus, bei dem die Reihenfolge wirklich etwas aendert, und
 * gibt beide Lesarten an.
 *
 * @param {string[]} [reihe] sonst: die laufende Reihe
 */
export function reihenfolgeBeispiel(reihe) {
  const r = (reihe || (dasBand ? dasBand.reihe : [])).filter(Boolean);
  if (r.length < 2) return null;

  const def = (id) => WAPPEN[id] || WAPPEN_REGISTER[id] || null;
  const istFaktor = (id) => {
    const d = def(id);
    if (!d || !d.hoert) return false;
    return /faktor|verdoppel|doppelt|dreifach|mal so|×/i.test(d.text || '');
  };

  /* Am besten ein Paar, bei dem einer draufrechnet und einer malnimmt. */
  let links = null, rechts = null;
  for (let a = 0; a < r.length && !links; a++) {
    for (let b = a + 1; b < r.length; b++) {
      if (istFaktor(r[b]) && !istFaktor(r[a])) { links = a; rechts = b; break; }
      if (istFaktor(r[a]) && !istFaktor(r[b])) { links = a; rechts = b; break; }
    }
  }
  if (links === null) { links = 0; rechts = 1; }

  const dl = def(r[links]), dr = def(r[rechts]);
  if (!dl || !dr) return null;
  return {
    links: { platz: links, name: dl.name, zeichen: dl.zeichen, text: dl.text },
    rechts: { platz: rechts, name: dr.name, zeichen: dr.zeichen, text: dr.text },
    so: dl.name + ' wirkt zuerst, dann ' + dr.name + '.',
    andersherum: 'Hängst du sie um, wirkt ' + dr.name + ' zuerst — '
      + 'und ' + dl.name + ' arbeitet dann an einem anderen Wert.',
  };
}
