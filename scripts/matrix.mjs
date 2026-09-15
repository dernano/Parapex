/*
 * Die Synergie-Matrix.
 *
 * Fuenfzig Wappen sind 2450 geordnete Paare. Kein Mensch spielt die durch,
 * und genau deshalb versteckt sich in einer solchen Sammlung alles, was ein
 * Wappensystem kaputt macht:
 *
 *   TOTE WAPPEN      - eines, das nirgends zuendet. Der Drache war eines,
 *                      und gefunden wurde er beim Zaehlen, nicht beim Spielen.
 *   GLEICHGUELTIGE   - ein Paar, bei dem die Reihenfolge nichts aendert. Zwei
 *   REIHENFOLGE        davon sind in Ordnung, fuenfzig waeren das Eingestaendnis,
 *                      dass das Gestell Zierde ist.
 *   SPRENGSAETZE     - ein Paar, das ins Unermessliche laeuft. Die Sperren
 *                      fangen die SCHLEIFE ab, nicht die ZAHL.
 *
 * Gemessen wird ehrlich: ein ganzer Kampf gegen einen Gegner, der nicht
 * faellt, fuenf Runden, immer dieselbe Aufstellung. Was am Ende an Schaden
 * steht, ist der Wert des Wappens - nicht, was auf der Tafel behauptet wird.
 *
 *   node scripts/matrix.mjs            # Uebersicht
 *   node scripts/matrix.mjs paare      # dazu die staerksten und schwaechsten Paare
 */
import * as P from '../quelle/kern.js';

/*
 * Gleiches Blatt fuer alle: sonst misst man das Mischen und nicht die Wappen.
 * Ein eigener Zufall, der bei jeder Messung von derselben Zahl startet.
 */
let same = 1;
const echterZufall = Math.random;
function festerZufall() {
  same = (same * 1103515245 + 12345) % 2147483648;
  return same / 2147483648;
}

const FELS = (hp) => ({ name: 'Prüfstein', hp, maxHp: hp, regeln: [] });
const DECK = () => P.START_DECK.map(id => P.neueEinheit(id));

/** Ein ganzer Kampf mit dieser Wappenreihe. Gibt zurueck, was er anrichtete. */
/*
 * 1e15 und nicht mehr. Bei 1e18 liegt die Schrittweite einer Gleitkommazahl
 * schon bei 128 - `1e18 - 640` ergibt dann 1e18 minus 640 GERUNDET auf ein
 * Vielfaches von 128, und jede Messung unter einer Runde verschwindet im
 * Rundungsfehler. Das hat diese Matrix zwei Durchgaenge lang behauptet, der
 * Stier sei wirkungslos, obwohl er die Wucht der ersten Runde verdoppelte.
 */
function messe(wappen, hp = 1e15) {
  same = 1;
  Math.random = festerZufall;
  try {
    P.neuerVorrat();
    const k = P.neuerKampf({ feind: FELS(hp), deck: DECK(), wappen });
    for (let r = 0; r < P.KERN.runden; r++) {
      /*
       * Immer dieselbe Handlung, damit nur die Wappen den Unterschied machen:
       * so voll wie moeglich stellen, mit dem Rest Karten tauschen (sonst
       * zuendet nie ein Tauschwappen), dann feuern.
       */
      for (let i = 0; i < P.KERN.tuerme && k.hand.length; i++) {
        if (k.tatendrang <= 0) break;
        if (k.tuerme[i].einheit) continue;    // Einheiten bleiben stehen
        P.setzeEinheit(i, k.hand[0]);
      }
      /*
       * Einmal je Runde eine stehende Einheit abloesen. Ohne das zuendet nie
       * ein Wappen auf `einheitErsetzt` - der Eber und der Wetzstein galten
       * zwei Durchgaenge lang als tot, weil der Messbot nie jemanden ablöste.
       */
      if (k.tatendrang > 0 && k.hand.length && k.tuerme[0].einheit) P.setzeEinheit(0, k.hand[0]);
      // Was dann noch uebrig ist, geht in die Hand.
      while (k.tatendrang > 0 && k.hand.length > 1) {
        if (!P.tauscheHandkarte(k.hand[k.hand.length - 1]).ok) break;
      }
      P.beendeRunde();
      if (k.ende) break;
    }
    /*
     * Zuendungen ueber den GANZEN Kampf, nicht nur in der Salve. Sonst hiesse
     * jedes Wappen tot, das auf `einheitGesetzt` oder `rundeEndet` hoert -
     * und das sind gerade die Quellen, an denen die Maschine haengt.
     */
    const zuendungen = P.dasBand
      ? P.dasBand.protokoll.filter((/** @type {any} */ z) => !z.abgewiesen).length : 0;
    const schaden = hp - k.feind.hp;
    P.raeumeKampf();
    return { schaden, zuendungen };
  } finally { Math.random = echterZufall; }
}

const ids = P.WAPPEN_LISTE;
const ohne = messe([]);

console.log('\nSynergie-Matrix — ' + ids.length + ' Wappen, ' + (ids.length * (ids.length - 1)) + ' geordnete Paare');
console.log('Grundwert ohne Wappen: ' + zahl(ohne.schaden) + '\n');

// ---------- Einzeln ----------
const einzeln = {};
const tot = [];
const stumm = [];
for (const id of ids) {
  const m = messe([id]);
  /*
   * Zweiter Durchgang gegen einen Gegner, der FAELLT. Sonst gibt es nie einen
   * Ueberschlag, und die Brandschatzung hiesse tot, obwohl sie nur nie an die
   * Reihe kam - genau der Messfehler, den die erste Fassung gemacht hat.
   */
  const schwach = messe([id], ohne.schaden / 2);
  einzeln[id] = m.schaden;
  if (!m.zuendungen && !schwach.zuendungen) tot.push(id);
  else if (m.schaden === ohne.schaden) stumm.push(id);
}

console.log('TOTE WAPPEN — zünden nirgends');
if (!tot.length) console.log('  keine.\n');
else { for (const id of tot) console.log('  ' + P.WAPPEN[id].name + ' (' + id + ')'); console.log(); }

/*
 * Nicht dasselbe: ein Wappen, das zuendet, aber allein keinen Schaden macht,
 * ist eine QUELLE - Pulver, Marken, Befehle. Das ist Absicht. Falsch waere
 * nur eine Quelle, fuer die es keinen Abnehmer gibt; darum steht unten, mit
 * welchem Partner sie am meisten gewinnt.
 */
console.log('ALLEIN WIRKUNGSLOS — zünden, zahlen aber erst mit einem Partner');
if (!stumm.length) console.log('  keine.\n');
else console.log('  ' + stumm.map(id => P.WAPPEN[id].name.replace('Wappen ', '')).join(', ') + '\n');

// ---------- Paare ----------
const paare = [];
let gleichgueltig = 0;
let wirksam = 0;
const explodiert = [];
for (const a of ids) {
  for (const b of ids) {
    if (a === b) continue;
    const ab = messe([a, b]).schaden;
    const ba = messe([b, a]).schaden;
    const gross = Math.max(ab, ba);
    if (gross > 1e15) explodiert.push([a, b, gross]);
    /*
     * Nur Paare zaehlen, in denen ueberhaupt etwas geschah. Zwei Wappen, die
     * beide nicht zuenden, geben zweimal denselben Grundwert - das ist keine
     * gleichgueltige Reihenfolge, das ist gar keine Messung.
     */
    if (gross > ohne.schaden) {
      wirksam++;
      if (Math.abs(ab - ba) / gross < 0.01) gleichgueltig++;
    }
    // Was das Paar mehr kann als die beiden Einzelnen zusammen.
    const erwartet = Math.max(einzeln[a], einzeln[b]);
    paare.push({ a, b, wert: ab, hebel: erwartet ? ab / erwartet : 0 });
  }
}

/* Findet eine Quelle keinen Abnehmer, ist sie kein Baustein, sondern ein Loch. */
const waise = [];
for (const id of stumm) {
  const bester = paare.filter(p => p.a === id || p.b === id)
    .reduce((m, p) => (p.wert > m.wert ? p : m), { wert: 0, a: '', b: '' });
  if (bester.wert <= ohne.schaden * 1.1) waise.push(id);
}
console.log('OHNE JEDEN PARTNER — das wären echte Löcher');
if (!waise.length) console.log('  keine — jede Quelle hat mindestens einen Partner, der sie bezahlt.\n');
else { for (const id of waise) console.log('  ' + P.WAPPEN[id].name); console.log(); }

console.log('REIHENFOLGE');
console.log('  ' + ((wirksam - gleichgueltig) / 2).toFixed(0) + ' von ' + (wirksam / 2).toFixed(0)
  + ' wirksamen Paaren ändern ihr Ergebnis, wenn man sie vertauscht ('
  + (100 - (gleichgueltig / Math.max(1, wirksam)) * 100).toFixed(0) + ' %)\n');

console.log('SPRENGSÄTZE (über 1e15 Schaden)');
if (!explodiert.length) console.log('  keine.\n');
else {
  for (const [a, b, w] of explodiert.slice(0, 12)) {
    console.log('  ' + P.WAPPEN[a].name + ' + ' + P.WAPPEN[b].name + ' → ' + zahl(w));
  }
  if (explodiert.length > 12) console.log('  … und ' + (explodiert.length - 12) + ' weitere');
  console.log();
}

if (process.argv[2] === 'paare') {
  paare.sort((x, y) => y.hebel - x.hebel);
  console.log('DIE STÄRKSTEN VERBINDUNGEN (Hebel gegenüber dem besseren Einzelwappen)');
  for (const p of paare.slice(0, 15)) {
    console.log('  ×' + p.hebel.toFixed(1).padStart(7) + '  ' + P.WAPPEN[p.a].name + ' → ' + P.WAPPEN[p.b].name);
  }
  console.log('\nDIE SCHWÄCHSTEN');
  for (const p of paare.slice(-10)) {
    console.log('  ×' + p.hebel.toFixed(2).padStart(7) + '  ' + P.WAPPEN[p.a].name + ' → ' + P.WAPPEN[p.b].name);
  }
  console.log();
}

/** Grosse Zahlen lesbar: 1,2 Mrd statt 1234567890. */
function zahl(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + ' Bio';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Mrd';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Mio';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' Tsd';
  return String(Math.round(n));
}
