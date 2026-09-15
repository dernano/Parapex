import { KERN } from './regeln.js';
import { GATTUNG_LISTE, grundwucht, neueEinheit, verbessereEinheit } from './einheiten.js';
import { WAPPEN_LISTE, WAPPEN_PLAETZE } from '../wappen/sammlung.js';
import { LAUF, angebotAusbau, angebotKarte, angebotWappen, baueTurmAus, belohnungsRang, derLauf, entferneKarte, fuegeWappenHinzu, kampfNrJetzt } from './lauf.js';

// ---------- Begegnungen ----------
/*
 * Ereignisse sind der billigste Weg, einen Lauf ungleich zu machen: kein
 * Kampf, aber eine Entscheidung mit Folgen. Sie stehen als Daten da, damit
 * ein neues Ereignis eine Zeile ist und kein Eingriff.
 *
 * `bedingung` hält Ereignisse zurück, die gerade nichts bewirken könnten -
 * ein Wappenangebot ohne freien Platz ist kein Ereignis, sondern ein Ärgernis.
 */
export const BEGEGNUNGEN = [
  {
    id: 'waffenschmiede', titel: 'Die verlassene Waffenschmiede',
    text: 'Zwischen kalten Essen liegt brauchbarer Stahl. Die Schmiede ist leer, der Amboss nicht.',
    wahlen: [
      { text: 'Zwei Karten schleifen', wirkung: () => {
        const ziele = zufaelligeKarten(2);
        ziele.forEach(k => verbessereEinheit(k, LAUF.schliff));
        return ziele.length ? ziele.map(k => k.name).join(' und ') + ' geschliffen.' : 'Nichts zu schleifen.';
      } },
      { text: 'Den Stahl verkaufen (+70 Sold)', wirkung: () => { derLauf.sold += 70; return '70 Sold.'; } },
    ],
  },
  {
    id: 'soeldner', titel: 'Söldner am Wegrand',
    text: 'Vier Mann ohne Herrn. Sie fragen nicht, wofür gekämpft wird, sondern wofür bezahlt.',
    wahlen: [
      { text: 'Anwerben (−60 Sold, starke Karte)', bedingung: () => derLauf.sold >= 60,
        wirkung: () => {
          derLauf.sold -= 60;
          const k = neueEinheit(GATTUNG_LISTE[Math.floor(Math.random() * 4)] + '-' +
            Math.min(13, belohnungsRang(kampfNrJetzt()) + 2));
          derLauf.deck.push(k);
          return k.name + ' tritt ein.';
        } },
      { text: 'Weiterziehen', wirkung: () => 'Sie sehen euch nach.' },
    ],
  },
  {
    id: 'kartenlager', titel: 'Der überfüllte Wehrgang',
    text: 'Zu viele Hände, zu wenig Zinnen. Wer bleibt, steht im Weg.',
    wahlen: [
      { text: 'Die schwächste Karte ausmustern', bedingung: () => derLauf.deck.length > KERN.handGroesse,
        wirkung: () => {
          const schwach = derLauf.deck.slice().sort((a, b) => grundwucht(a) - grundwucht(b))[0];
          entferneKarte(schwach.uid);
          return schwach.name + ' geht.';
        } },
      { text: 'Alle behalten (+40 Sold aus dem Sold der Abgänger)', wirkung: () => { derLauf.sold += 40; return '40 Sold.'; } },
    ],
  },
  {
    id: 'banner', titel: 'Das alte Banner',
    text: 'Im Gewölbe hängt ein Wappen, das hier niemand mehr führt. Staub, aber kein Rost.',
    bedingung: () => derLauf.wappen.length < WAPPEN_PLAETZE && derLauf.wappen.length < WAPPEN_LISTE.length,
    wahlen: [
      { text: 'Aufhängen', wirkung: () => {
        const a = angebotWappen();
        if (!a) return 'Kein Platz mehr.';
        fuegeWappenHinzu(a.wappen);
        return a.name + ' hängt.';
      } },
      { text: 'Einschmelzen (+90 Sold)', wirkung: () => { derLauf.sold += 90; return '90 Sold.'; } },
    ],
  },
  {
    id: 'baumeister', titel: 'Der wandernde Baumeister',
    text: 'Er misst eure Mauern mit den Augen und schüttelt den Kopf. Dann bietet er an zu bleiben.',
    wahlen: [
      { text: 'Einen Turm ausbauen lassen', wirkung: () => {
        const a = angebotAusbau();
        if (!a) return 'Er findet nichts zu tun.';
        baueTurmAus(a.turm, a.typ);
        return a.name + '.';
      } },
      { text: 'Ihn bezahlen und ziehen lassen (+50 Sold)', wirkung: () => { derLauf.sold += 50; return '50 Sold.'; } },
    ],
  },
  {
    id: 'spaeher', titel: 'Ein gefangener Späher',
    text: 'Er weiss, wann der nächste Stoss kommt. Er weiss auch, was ein solches Wissen wert ist.',
    wahlen: [
      { text: 'Aushorchen (+100 Sold)', wirkung: () => { derLauf.sold += 100; return '100 Sold.'; } },
      { text: 'Laufen lassen und zwei Karten ziehen', wirkung: () => {
        const neu = [angebotKarte(kampfNrJetzt()), angebotKarte(kampfNrJetzt())];
        neu.forEach(a => derLauf.deck.push(a.einheit));
        return neu.map(a => a.name).join(' und ') + ' schliessen sich an.';
      } },
    ],
  },
];

export function zufaelligeKarten(n) {
  const kopie = derLauf.deck.slice();
  const raus = [];
  while (raus.length < n && kopie.length) {
    raus.push(kopie.splice(Math.floor(Math.random() * kopie.length), 1)[0]);
  }
  return raus;
}

export function ziehBegegnung() {
  const moeglich = BEGEGNUNGEN.filter(e => !e.bedingung || e.bedingung());
  const liste = moeglich.length ? moeglich : BEGEGNUNGEN;
  const e = liste[Math.floor(Math.random() * liste.length)];
  return {
    ...e,
    wahlen: e.wahlen.filter(w => !w.bedingung || w.bedingung()),
  };
}

export function waehleInBegegnung(ereignis, index) {
  const w = ereignis && ereignis.wahlen[index];
  if (!w) return { ok: false, grund: 'Diese Wahl gibt es nicht.' };
  return { ok: true, folge: w.wirkung() };
}
