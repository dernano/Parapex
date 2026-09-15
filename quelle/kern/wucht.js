import { bonusWucht, wirkwucht } from './einheiten.js';
import { turmFaktor } from './tuerme.js';
import { erkenneFormationen, salvenZahl } from './formationen.js';
import { EREIGNIS } from '../wappen/ereignisse.js';
import { loeseAus, mitReihe, fasseZusammen } from '../wappen/fliessband.js';

// ---------- Wucht ----------
/*
 * Die Wucht einer Salve ist einfach geworden, und das ist der Punkt:
 *
 *   je Turm:  (Rang + Schliff) x Turmtyp
 *   Summe  x  Salvenzahl  x  Wappen
 *
 * Die Salvenzahl ist eine Grundsalve plus, was die Formationen geben. Sie ist
 * KEIN Rechentrick: jede Salve ist ein Schuss, den die Anzeige auch zeigt.
 * Wer `7 Salven` liest, sieht sieben Mal feuern.
 *
 * Vorher stand hier eine Kette aus Faktoren je Turm, Nachschuessen und
 * Gesamtfaktoren. Sie rechnete richtig, aber niemand konnte sie im Kopf
 * mitfuehren - und was man nicht mitfuehren kann, kann man auch nicht planen.
 */
/**
 * @param {any[]} tuerme
 * @param {string[]} [wappen] die Reihe, in ihrer Ordnung
 * @param {boolean} [probe] rechnen, ohne die Welt zu beruehren
 *
 * `probe` steht auf WAHR, und das ist Absicht. Die Anzeige fragt diese
 * Rechnung dutzendfach je Sekunde (Vorschau, Leiste, Tafel); wuerde sie dabei
 * Pulver verbrennen und ins Kampfprotokoll schreiben, waere nach einer Runde
 * Mausbewegung nichts mehr richtig. Nur die Salve am Rundenende fragt echt.
 */
export function berechneWucht(tuerme, wappen = [], probe = true) {
  return mitReihe(wappen, () => rechneSalve(tuerme, probe));
}

/** @param {any[]} tuerme @param {boolean} probe */
function rechneSalve(tuerme, probe) {
  /*
   * `null` und nicht `[]`: das Band steht schon (`mitReihe` oben hat es
   * gesetzt), und eine leere LISTE hiesse ausdruecklich `ohne Wappen` - dann
   * faende der Loewe die mittlere Stellung nicht mehr.
   */
  const formationen = erkenneFormationen(tuerme, null, probe);
  const besetzt = tuerme.map((t, i) => (t.einheit ? i : -1)).filter(i => i >= 0);

  const posten = besetzt.map(i => {
    const t = tuerme[i];
    const basis = wirkwucht(t.einheit);
    const tf = turmFaktor(t);
    return { turm: i, name: t.einheit.name, gattung: t.einheit.gattung, rang: t.einheit.rang,
      // Beide Zahlen mitfuehren: die Anzeige soll `9 +4` schreiben koennen,
      // ohne selbst zu rechnen.
      grund: t.einheit.grundwucht, bonus: bonusWucht(t.einheit),
      basis, turmFaktor: tf, wucht: basis * tf, faktoren: [], schuesse: 0 };
  });

  const schritte = [];
  const grundsumme = posten.reduce((s, p) => s + p.wucht, 0);
  schritte.push({ art: 'grund', name: 'Wucht je Salve', wert: null, wucht: grundsumme });

  // Die Salven, die aus den Formationen kommen - noch ohne Wappen.
  const ausFormationen = salvenZahl(formationen);
  for (const f of formationen) {
    schritte.push({ art: 'formation', id: f.id, name: f.name, wert: '+' + f.salven,
      salven: f.salven, wucht: grundsumme * ausFormationen });
  }

  /*
   * Und jetzt durch die Wappenreihe, von links nach rechts.
   *
   * `jeSalve` und `zusatz` sind die Wucht EINES Schusses, `salven` die Zahl
   * der Schuesse, `faktor` was am Ende ueber allem steht. Drei Stellschrauben
   * und nicht dreissig - so bleibt die Kette lesbar, egal wie viele Wappen
   * daran ziehen:
   *
   *     (jeSalve + zusatz) x salven x faktor
   */
  const lage = loeseAus(EREIGNIS.salveGeplant, {
    tuerme, posten, formationen,
    salven: ausFormationen,
    jeSalve: grundsumme,
    zusatz: 0,
    faktor: 1,
  }, null, probe);

  /*
   * Solange jemand auf einem Turm steht, feuert er. Ein Wappen, das die
   * Salvenzahl halbiert, und eines, das die Reihe mehrfach laufen laesst,
   * kommen sonst zusammen auf null Schuesse - gemessen und behoben: der
   * Steinadler mit dem Ouroboros war eine Sackgasse ohne jeden Schaden.
   */
  const salven = Math.max(posten.length ? 1 : 0, Math.round(lage.daten.salven));
  const jeSalve = Math.max(0, lage.daten.jeSalve + lage.daten.zusatz);
  for (const p of posten) p.schuesse = salven;

  schritte.push({ art: 'salven', name: salven + ' Salven', wert: '×' + salven,
    salven, wucht: jeSalve * salven });

  /*
   * Was die Wappen getan haben, kommt als Schritte in dieselbe Liste - die
   * Tafel zeigt also nicht mehr nur `Wappen x2`, sondern welches Wappen auf
   * welchem Platz was getan hat. Genau das war vorher nicht zu sehen.
   */
  let gesamt = jeSalve * salven;
  for (const z of lage.protokoll) {
    if (z.abgewiesen || !z.wirkungen.length) continue;
    for (const w of z.wirkungen) {
      if (w.art === 'faktor') gesamt *= w.wert;
    }
    schritte.push({
      art: 'wappen', id: z.id, name: z.name, platz: z.platz, zuendart: z.art,
      wert: beschreibeWirkungen(z.wirkungen), wucht: gesamt,
    });
  }

  return {
    posten, formationen, schritte, salven,
    grund: posten.reduce((s, p) => s + p.basis, 0),
    jeSalve: Math.round(jeSalve),
    wucht: Math.round(gesamt),
    protokoll: lage.protokoll,
    kette: fasseZusammen(lage),
  };
}

/** Was ein Wappen getan hat, in einer Zeile fuer die Tafel. */
function beschreibeWirkungen(wirkungen) {
  const teile = [];
  for (const w of wirkungen) {
    if (w.art === 'salven') teile.push((w.wert > 0 ? '+' : '') + rund(w.wert) + ' Salven');
    else if (w.art === 'jeSalveFaktor') teile.push('×' + rund(w.wert) + ' je Salve');
    else if (w.art === 'salvenFaktor') teile.push('×' + rund(w.wert) + ' Salven');
    else if (w.art === 'zusatz') teile.push((w.wert > 0 ? '+' : '') + rund(w.wert));
    else if (w.art === 'faktor') teile.push('×' + rund(w.wert));
    else if (w.art === 'vorrat') teile.push((w.wert.menge > 0 ? '+' : '') + w.wert.menge + ' ' + w.wert.art);
  }
  return teile.join(' · ');
}

const rund = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));
