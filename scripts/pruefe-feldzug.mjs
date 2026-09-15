/*
 * Der Feldzug - ohne Browser.
 *
 *   node scripts/pruefe-feldzug.mjs
 *
 * Zwei Dinge werden hier hart geprueft, weil sie nicht "meistens" stimmen
 * duerfen, sondern IMMER:
 *
 *   DAS KAMPFBUDGET   Jede Ante hat mindestens zwei und hoechstens fuenf
 *                     Schlachten. Geprueft wird nicht an einem Beispiel,
 *                     sondern an ALLEN sechzehn Wegen durch die Ante.
 *   DIE BOSSREGELN    Jede muss nachweisbar auf die Maschine des Spielers
 *                     wirken. Eine Regel, die nur behauptet, ist schlimmer
 *                     als keine - der Spieler baut um und merkt nichts.
 */
import * as P from '../quelle/kern.js';

let gut = 0, schlecht = 0;
function pruefe(was, fn) {
  let r;
  try { r = fn(); } catch (e) { r = 'Ausnahme: ' + (e && e.message); }
  if (r === true) { gut++; console.log('  ok   ' + was); }
  else { schlecht++; console.log('  FEHL ' + was + '  — ' + r); }
}
const gleich = (a, b, was) => (a === b ? true : was + ': ' + a + ' statt ' + b);
const blatt = (...ids) => ids.map((id, i) =>
  ({ nr: i + 1, typ: 'wachturm', einheit: id ? P.neueEinheit(id) : null }));
const fuenf = () => blatt('bogen-8', 'armbrust-3', 'kanonier-5', 'artillerie-7', 'bogen-2');

console.log('\nDer Feldzug — die Welt kommt zur Burg\n');

/* ---------- Das Kampfbudget ---------- */
/**
 * Eine Ante nach einem Plan durchspielen. `plan` sagt fuer jede Gelegenheit,
 * ob abgefangen (true) oder durchgelassen (false) wird - und wo das nicht
 * geht, wird eben gekaempft.
 * @param {boolean[]} plan
 */
function spieleAnte(plan) {
  P.neuerLauf();
  P.neueBelagerung(1);
  let i = 0;
  let schutz = 0;
  while (P.dieBelagerung.abschnitt !== 'vorbei' && schutz++ < 30) {
    const wahlen = P.offeneWahlen();
    if (!wahlen.length) break;
    if (P.dieBelagerung.abschnitt === 'lager') { P.waehle(wahlen[0]); continue; }
    const will = plan[i++] !== false;
    const durch = wahlen.find(w => w.art === 'durchlassen' && !w.gesperrt);
    const wahl = (!will && durch) ? durch : wahlen.find(w => w.kampf);
    const r = P.waehle(wahl);
    if (!r.ok) return { fehler: r.grund };
    if (r.kampf) P.meldeAusgang(true);
  }
  return { kaempfe: P.dieBelagerung.kaempfe, ende: P.dieBelagerung.ende,
    abschnitt: P.dieBelagerung.abschnitt, bedrohung: P.dieBelagerung.bedrohung,
    vorbereitung: P.dieBelagerung.vorbereitung };
}

pruefe('Jeder Weg durch die Ante endet beim Heerführer', () => {
  for (let m = 0; m < 16; m++) {
    const plan = [0, 1, 2, 3].map(b => Boolean(m & (1 << b)));
    const e = spieleAnte(plan);
    if (e.fehler) return 'Plan ' + plan.join(',') + ': ' + e.fehler;
    if (e.ende !== 'sieg') return 'Plan ' + plan.join(',') + ' endete als ' + e.ende;
  }
  return true;
});

pruefe('Keine Ante hat weniger als zwei Schlachten', () => {
  for (let m = 0; m < 16; m++) {
    const plan = [0, 1, 2, 3].map(b => Boolean(m & (1 << b)));
    const e = spieleAnte(plan);
    if (e.kaempfe < P.KAEMPFE_MIN) return 'Plan ' + plan.join(',') + ': ' + e.kaempfe + ' Schlachten';
  }
  return true;
});

pruefe('Keine Ante hat mehr als fünf Schlachten', () => {
  for (let m = 0; m < 16; m++) {
    const plan = [0, 1, 2, 3].map(b => Boolean(m & (1 << b)));
    const e = spieleAnte(plan);
    if (e.kaempfe > P.KAEMPFE_MAX) return 'Plan ' + plan.join(',') + ': ' + e.kaempfe + ' Schlachten';
  }
  return true;
});

pruefe('Wer alles stellt, kämpft fünfmal', () =>
  gleich(spieleAnte([true, true, true, true]).kaempfe, 5, 'Schlachten'));

pruefe('Wer alles durchlässt, kämpft trotzdem zweimal', () =>
  gleich(spieleAnte([false, false, false, false]).kaempfe, 2, 'Schlachten'));

pruefe('Vor der letzten Gelegenheit ist Durchlassen gesperrt', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  // Vorhut und zwei Divisionen durchlassen
  for (let i = 0; i < 3; i++) {
    const w = P.offeneWahlen().find(x => x.art === 'durchlassen' && !x.gesperrt);
    if (!w) return 'schon nach ' + i + ' Malen gesperrt';
    P.waehle(w);
  }
  const rest = P.offeneWahlen().filter(w => w.art === 'durchlassen');
  if (!rest.length) return 'es stand gar keine Wahl mehr offen';
  if (!rest.every(w => w.gesperrt)) return 'die letzte Division liesse sich noch durchlassen';
  return P.waehle(rest[0]).ok ? 'die Sperre liess sich übergehen' : true;
});

/* ---------- Bedrohung und Vorbereitung ---------- */
pruefe('Bedrohung und Vorbereitung sind dieselbe Münze', () => {
  const alles = spieleAnte([false, false, false, false]);
  const nichts = spieleAnte([true, true, true, true]);
  if (alles.vorbereitung <= nichts.vorbereitung) return 'Durchlassen brachte keine Vorbereitung';
  return alles.bedrohung > nichts.bedrohung ? true : 'Durchlassen kostete keine Bedrohung';
});

pruefe('Die Bedrohung bleibt in ihren Grenzen', () => {
  for (let m = 0; m < 16; m++) {
    const plan = [0, 1, 2, 3].map(b => Boolean(m & (1 << b)));
    const e = spieleAnte(plan);
    if (e.bedrohung < 0 || e.bedrohung > P.BEDROHUNG_MAX) return 'Bedrohung ' + e.bedrohung;
  }
  return true;
});

pruefe('Eine geschlagene Vorhut senkt die Bedrohung', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  const vorher = P.dieBelagerung.bedrohung;
  P.waehle(P.offeneWahlen().find(w => w.kampf));
  P.meldeAusgang(true);
  return P.dieBelagerung.bedrohung < vorher ? true : 'sie blieb bei ' + vorher;
});

/* ---------- Der Heerführer wird gebaut, nicht gewürfelt ---------- */
pruefe('Jede durchgelassene Division gibt dem Heerführer ihre Regel', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.waehle(P.offeneWahlen().find(w => w.kampf));   // Vorhut stellen
  P.meldeAusgang(true);
  P.waehle(P.offeneWahlen()[0]);                    // Lager verlassen
  const erste = P.offeneWahlen().find(w => w.art === 'durchlassen' && !w.gesperrt);
  const merkmal = P.DIVISIONEN[P.dieBelagerung.divisionen[erste.nr].id].merkmal;
  P.waehle(erste);
  const h = P.baueHeerfuehrer();
  return h.regelIds.includes(merkmal) ? true : 'der Heerführer trägt ' + h.regelIds.join(', ');
});

pruefe('Jede geschlagene Division nimmt ihm ihre Regel', () => {
  const alles = (() => { spieleAnteBisHeerfuehrer([true, true, true, true]); return P.baueHeerfuehrer(); })();
  const nichts = (() => { spieleAnteBisHeerfuehrer([false, false, false, false]); return P.baueHeerfuehrer(); })();
  if (alles.regelIds.length !== 1) return 'geschlagen: ' + alles.regelIds.join(', ');
  return nichts.regelIds.length > alles.regelIds.length
    ? true : 'durchgelassen: ' + nichts.regelIds.join(', ');
});

function spieleAnteBisHeerfuehrer(plan) {
  P.neuerLauf();
  P.neueBelagerung(1);
  let i = 0, schutz = 0;
  while (P.dieBelagerung.abschnitt !== 'heerfuehrer' && schutz++ < 30) {
    const wahlen = P.offeneWahlen();
    if (!wahlen.length) break;
    if (P.dieBelagerung.abschnitt === 'lager') { P.waehle(wahlen[0]); continue; }
    const will = plan[i++] !== false;
    const durch = wahlen.find(w => w.art === 'durchlassen' && !w.gesperrt);
    const r = P.waehle((!will && durch) ? durch : wahlen.find(w => w.kampf));
    if (r.kampf) P.meldeAusgang(true);
  }
}

pruefe('Mehr Bedrohung heisst ein stärkerer Heerführer', () => {
  spieleAnteBisHeerfuehrer([true, true, true, true]);
  const schwach = P.baueHeerfuehrer().hp;
  spieleAnteBisHeerfuehrer([false, false, false, false]);
  const stark = P.baueHeerfuehrer().hp;
  return stark > schwach ? true : 'gleich stark: ' + stark;
});

pruefe('Der Heerführer steht von Anfang an fest genug, um ihn zu lesen', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  const l = P.belagerungslage();
  if (!l.heerfuehrer.name) return 'kein Name';
  if (!l.heerfuehrer.regeln.length) return 'keine Regeln';
  return l.heerfuehrer.hp > 0 ? true : 'keine Stärke';
});

/* ---------- Die Bossregeln greifen wirklich ---------- */
const mitRegel = (id, feind = {}) => ({
  name: 'Prüfstein', hp: 1e12, maxHp: 1e12, regeln: P.baueRegeln([id]), ...feind,
});

pruefe('Der Usurpator vertauscht Platz 2 und 4', () => {
  P.neuerVorrat();
  const k = P.neuerKampf({ feind: mitRegel('usurpator'),
    deck: P.START_DECK.map(e => P.neueEinheit(e)),
    wappen: ['amboss', 'stier', 'wolf', 'drache', 'greif'] });
  return gleich(k.wappen.join(), 'amboss,drache,wolf,stier,greif', 'Reihe nach Rundenbeginn');
});

pruefe('Der Inquisitor versiegelt den lautesten Platz', () => {
  P.neuerVorrat();
  const k = P.neuerKampf({ feind: mitRegel('inquisitor'),
    deck: P.START_DECK.map(e => P.neueEinheit(e)), wappen: ['amboss', 'stier'] });
  for (let i = 0; i < P.KERN.tuerme && k.hand.length && k.tatendrang > 0; i++) P.setzeEinheit(i, k.hand[0]);
  P.beendeRunde();
  return P.dasBand.gesiegelt.length ? true : 'nichts versiegelt';
});

pruefe('Der Belagerungsmeister nimmt die stärkste Stellung aus der Salve', () => {
  P.neuerVorrat();
  const t = fuenf();
  P.neuesBand([]);
  const ohne = P.berechneWucht(t, []).jeSalve;
  const feind = mitRegel('belagerungsmeister');
  P.neuesBand([], feind);
  const mit = P.berechneWucht(t, P.dasBand.reihe, false).jeSalve;
  return mit < ohne ? true : 'Wucht je Salve blieb bei ' + mit;
});

pruefe('Die Weiße Königin verhüllt je Runde eine andere Stellung', () => {
  const feind = mitRegel('weisseKoenigin');
  const gesehen = new Set();
  for (let runde = 1; runde <= P.KERN.tuerme; runde++) {
    P.neuesBand([], feind);
    P.setzeRunde(runde);
    const b = P.baueBlatt(fuenf(), P.dasBand.reihe, false);
    const verhuellt = b.karten.filter(c => c.gattung === 'verhuellt').map(c => c.turm);
    if (verhuellt.length !== 1) return 'Runde ' + runde + ': ' + verhuellt.length + ' verhüllt';
    gesehen.add(verhuellt[0]);
  }
  return gleich(gesehen.size, P.KERN.tuerme, 'verschiedene verhüllte Stellungen');
});

pruefe('Der Rote König lässt Salven über zwölf verpuffen', () => {
  const t = fuenf();
  P.neuesBand([]);
  const ohne = P.berechneWucht(t, ['stier', 'mauerkrone', 'fahnentraeger', 'kranich', 'hydra']).salven;
  if (ohne <= P.ROTER_KOENIG_AB) return 'die Prüfreihe kam nur auf ' + ohne + ' Salven';
  const feind = mitRegel('roterKoenig');
  P.neuesBand(['stier', 'mauerkrone', 'fahnentraeger', 'kranich', 'hydra'], feind);
  const mit = P.berechneWucht(t, P.dasBand.reihe, false).salven;
  const erwartet = Math.round(P.ROTER_KOENIG_AB + (ohne - P.ROTER_KOENIG_AB) / 2);
  return Math.abs(mit - erwartet) <= 1 ? true : mit + ' Salven statt rund ' + erwartet;
});

pruefe('Die Regeln des Gegners laufen hinter den Wappen', () => {
  const feind = mitRegel('belagerungsmeister');
  P.neuesBand(['amboss'], feind);
  const r = P.berechneWucht(fuenf(), P.dasBand.reihe, false);
  const wappen = r.protokoll.findIndex(z => z.id === 'amboss');
  const gegner = r.protokoll.findIndex(z => z.id === 'belagerungsmeister');
  if (wappen < 0 || gegner < 0) return 'nicht beide im Protokoll';
  return gegner > wappen ? true : 'der Gegner zündete zuerst';
});

pruefe('Ein Siegel des Spielers hält den Gegner nicht auf', () => {
  /*
   * Das Wappen des Siegels bricht die Reihe ab, solange der Gegner ueber der
   * Haelfte steht. Wuerde es dabei auch die Regeln des Gegners aufhalten,
   * waere ein einziges Wappen die Antwort auf jeden Heerfuehrer.
   */
  const feind = mitRegel('belagerungsmeister');
  P.neuesBand(['siegel', 'amboss'], feind);
  const r = P.berechneWucht(fuenf(), P.dasBand.reihe, false);
  const amboss = r.protokoll.some(z => z.id === 'amboss' && !z.abgewiesen && z.wirkungen.length);
  const gegner = r.protokoll.some(z => z.id === 'belagerungsmeister' && !z.abgewiesen);
  if (amboss) return 'das Siegel hielt den Amboss nicht auf';
  return gegner ? true : 'das Siegel hielt auch den Gegner auf';
});

/* ---------- Speichern ---------- */
pruefe('Eine Ante lässt sich genau so wiederherstellen', () => {
  spieleAnteBisHeerfuehrer([true, false, true, false]);
  const vorher = P.belagerungslage();
  const gesichert = JSON.parse(JSON.stringify(P.sichereBelagerung()));
  P.raeumeBelagerung();
  if (P.dieBelagerung) return 'die Belagerung liess sich nicht räumen';
  P.ladeBelagerung(gesichert);
  const nachher = P.belagerungslage();
  if (nachher.bedrohung !== vorher.bedrohung) return 'Bedrohung ' + nachher.bedrohung;
  if (nachher.vorbereitung !== vorher.vorbereitung) return 'Vorbereitung ' + nachher.vorbereitung;
  if (nachher.kaempfe !== vorher.kaempfe) return 'Schlachten ' + nachher.kaempfe;
  return gleich(nachher.divisionen.map(d => d.zustand).join(),
    vorher.divisionen.map(d => d.zustand).join(), 'Zustand der Divisionen');
});

pruefe('Der wiederhergestellte Heerführer trägt dieselben Regeln', () => {
  spieleAnteBisHeerfuehrer([false, false, true, false]);
  const vorher = P.baueHeerfuehrer();
  const g = JSON.parse(JSON.stringify(P.sichereBelagerung()));
  P.ladeBelagerung(g);
  const nachher = P.baueHeerfuehrer();
  if (nachher.hp !== vorher.hp) return 'Stärke ' + nachher.hp + ' statt ' + vorher.hp;
  return gleich(nachher.regelIds.join(), vorher.regelIds.join(), 'Regeln');
});

pruefe('Das Gesicherte ist reines JSON', () => {
  spieleAnteBisHeerfuehrer([true, true, false, false]);
  const g = P.sichereBelagerung();
  const text = JSON.stringify(g);
  return text.length > 20 && JSON.parse(text) ? true : 'liess sich nicht schreiben';
});

/* ---------- Das Heerlager ---------- */
pruefe('An jedem Halt stehen zwei Dienste', () => {
  for (let nr = 1; nr <= 6; nr++) {
    const l = P.oeffneLager(nr);
    if (l.dienste.length !== 2) return 'Halt ' + nr + ': ' + l.dienste.length + ' Dienste';
    if (l.dienste[0] === l.dienste[1]) return 'Halt ' + nr + ': zweimal derselbe';
  }
  return true;
});

pruefe('Die Dienste wechseln von Halt zu Halt', () => {
  const eins = P.oeffneLager(1).dienste.join();
  const zwei = P.oeffneLager(2).dienste.join();
  return eins !== zwei ? true : 'beide Male ' + eins;
});

pruefe('Über vier Halte kommt jeder Dienst vor', () => {
  const gesehen = new Set();
  for (let nr = 1; nr <= 4; nr++) for (const d of P.oeffneLager(nr).dienste) gesehen.add(d);
  return gleich(gesehen.size, Object.keys(P.DIENSTE).length, 'verschiedene Dienste');
});

pruefe('Ein Dienst gilt einmal je Halt', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.dieBelagerung.vorbereitung = 20;
  const halt = [1, 2, 3, 4].find(nr => P.oeffneLager(nr).dienste.includes('kriegsrat'));
  P.oeffneLager(halt);
  const posten = P.lagerAngebote('kriegsrat');
  if (!posten.length) return 'der Kriegsrat bot nichts an';
  const r = P.nimmLagerangebot('kriegsrat', posten[0]);
  if (!r.ok) return r.grund;
  if (P.dienstOffen('kriegsrat')) return 'der Dienst stand noch offen';
  return P.nimmLagerangebot('kriegsrat', posten[0]).ok ? 'ein zweites Mal ging auch' : true;
});

pruefe('Ohne Vorbereitung gibt es nichts', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.dieBelagerung.vorbereitung = 0;
  const halt = [1, 2, 3, 4].find(nr => P.oeffneLager(nr).dienste.includes('kriegsrat'));
  P.oeffneLager(halt);
  const posten = P.lagerAngebote('kriegsrat');
  if (!posten.length) return 'nichts im Angebot';
  if (!posten[0].zuTeuer) return 'der Posten galt als bezahlbar';
  const r = P.nimmLagerangebot('kriegsrat', posten[0]);
  return r.ok ? 'er liess sich trotzdem nehmen' : true;
});

pruefe('Der Kriegsrat hebt eine Formationsstufe und zieht den Preis ab', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.dieBelagerung.vorbereitung = 9;
  const halt = [1, 2, 3, 4].find(nr => P.oeffneLager(nr).dienste.includes('kriegsrat'));
  P.oeffneLager(halt);
  const posten = P.lagerAngebote('kriegsrat').find(p => p.art === 'formationHeben');
  const vorher = P.dieBelagerung.vorbereitung;
  const r = P.nimmLagerangebot('kriegsrat', posten);
  if (!r.ok) return r.grund;
  if (P.derLauf.formationsStufen[posten.formation] !== 2) return 'die Stufe blieb bei eins';
  return gleich(P.dieBelagerung.vorbereitung, vorher - posten.preis, 'Vorbereitung');
});

pruefe('Der Herold holt ein Wappen und legt eines ab', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.dieBelagerung.vorbereitung = 9;
  P.derLauf.schlachten = 9;
  const halt = [1, 2, 3, 4].find(nr => P.oeffneLager(nr).dienste.includes('herold'));
  P.oeffneLager(halt);
  const holen = P.lagerAngebote('herold').find(p => p.art === 'wappenHolen');
  if (!holen) return 'der Herold bot kein Wappen an';
  const r = P.nimmLagerangebot('herold', holen);
  if (!r.ok) return r.grund;
  if (!P.derLauf.wappen.includes(holen.wappen)) return 'das Wappen hängt nicht';
  // Und wieder ablegen - dafuer braucht es einen neuen Halt.
  P.oeffneLager(halt);
  const ab = P.lagerAngebote('herold').find(p => p.art === 'wappenTauschen');
  if (!ab) return 'kein Wappen zum Ablegen';
  P.nimmLagerangebot('herold', ab);
  return P.derLauf.wappen.includes(ab.wappen) ? 'es hängt immer noch' : true;
});

pruefe('Ein misslungener Kauf kostet nichts', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.dieBelagerung.vorbereitung = 9;
  const halt = [1, 2, 3, 4].find(nr => P.oeffneLager(nr).dienste.includes('herold'));
  P.oeffneLager(halt);
  // Ein Wappen ablegen, das gar nicht hängt
  const vorher = P.dieBelagerung.vorbereitung;
  const r = P.nimmLagerangebot('herold',
    { art: 'wappenTauschen', wappen: 'gibtEsNicht', preis: 2, waehrung: 'vorbereitung', zuTeuer: false });
  if (r.ok) return 'es ging trotzdem';
  return gleich(P.dieBelagerung.vorbereitung, vorher, 'Vorbereitung nach dem Fehlschlag');
});

pruefe('Eine verlorene Schlacht beendet die Ante', () => {
  P.neuerLauf();
  P.neueBelagerung(1);
  P.waehle(P.offeneWahlen().find(w => w.kampf));
  P.meldeAusgang(false);
  if (P.dieBelagerung.ende !== 'niederlage') return 'Ausgang: ' + P.dieBelagerung.ende;
  return gleich(P.offeneWahlen().length, 0, 'offene Wahlen nach der Niederlage');
});

console.log(`\n${gut} von ${gut + schlecht} Feldzugprüfungen bestanden.\n`);
process.exit(schlecht ? 1 : 0);
