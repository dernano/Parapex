import { bonusWucht, wirkwucht } from './einheiten.js';
import { turmFaktor } from './tuerme.js';
import { WAPPEN } from './wappen.js';
import { erkenneFormationen, salvenZahl } from './formationen.js';

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
export function berechneWucht(tuerme, wappen = []) {
  const formationen = erkenneFormationen(tuerme, wappen);
  const besetzt = tuerme.map((t, i) => (t.einheit ? i : -1)).filter(i => i >= 0);
  const salven = salvenZahl(formationen);

  const posten = besetzt.map(i => {
    const t = tuerme[i];
    const basis = wirkwucht(t.einheit);
    const tf = turmFaktor(t);
    return { turm: i, name: t.einheit.name, gattung: t.einheit.gattung, rang: t.einheit.rang,
      // Beide Zahlen mitfuehren: die Anzeige soll `9 +4` schreiben koennen,
      // ohne selbst zu rechnen.
      grund: t.einheit.grundwucht, bonus: bonusWucht(t.einheit),
      basis, turmFaktor: tf, wucht: basis * tf, faktoren: [], schuesse: salven };
  });

  const schritte = [];
  const grundsumme = posten.reduce((s, p) => s + p.wucht, 0);
  schritte.push({ art: 'grund', name: 'Wucht je Salve', wert: null, wucht: grundsumme });

  for (const f of formationen) {
    schritte.push({ art: 'formation', id: f.id, name: f.name, wert: '+' + f.salven,
      salven: f.salven, wucht: grundsumme * salven });
  }
  schritte.push({ art: 'salven', name: salven + ' Salven', wert: '×' + salven,
    salven, wucht: grundsumme * salven });

  let gesamt = grundsumme * salven;
  const ctx = { tuerme, wappen };
  for (const w of wappen) {
    const fn = WAPPEN[w] && WAPPEN[w].gesamtFaktor;
    if (!fn) continue;
    const faktor = fn(ctx) || 1;
    if (faktor === 1) continue;
    gesamt *= faktor;
    schritte.push({ art: 'wappen', id: w, name: WAPPEN[w].name, wert: '×' + faktor, wucht: gesamt });
  }

  return {
    posten, formationen, schritte, salven,
    grund: posten.reduce((s, p) => s + p.basis, 0),
    jeSalve: Math.round(grundsumme),
    wucht: Math.round(gesamt),
  };
}
