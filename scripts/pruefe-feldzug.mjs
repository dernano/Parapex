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


/* ---------- Keine Regel darf eine Sackgasse bauen ---------- */
/*
 * Die teuerste Lektion dieser Sitzung, als Pruefung.
 *
 * Der Belagerungsmeister nahm "die Wucht der staerksten Stellung" - bei EINER
 * besetzten Stellung also alles. Damit brachte die erste gesetzte Einheit
 * genau null, ein rechnender Spieler setzte gar nichts, und die Burg verlor
 * mit fuenf leeren Tuermen. Gemessen: 80 von 80 Laeufen, null Schaden.
 *
 * Eine Regel darf wehtun. Sie darf keinen Zustand herstellen, aus dem heraus
 * kein Zug mehr besser ist als kein Zug.
 */
pruefe('Unter keiner Bossregel ist eine Einheit mehr wertlos', () => {
  for (const id of P.BOSSREGEL_LISTE) {
    const feind = mitRegel(id);
    for (let n = 1; n <= P.KERN.tuerme; n++) {
      P.neuerVorrat();
      P.neuesBand([], feind);
      const weniger = P.berechneWucht(stellungen(n - 1), P.dasBand.reihe).wucht;
      P.neuesBand([], feind);
      const mehr = P.berechneWucht(stellungen(n), P.dasBand.reihe).wucht;
      if (mehr <= weniger) {
        return id + ': die ' + n + '. Einheit bringt ' + mehr + ' statt mehr als ' + weniger;
      }
    }
  }
  return true;
});

/** Ein Blatt mit genau n besetzten Stellungen, alle gleich stark. */
function stellungen(n) {
  const ids = ['bogen-8', 'armbrust-8', 'kanonier-8', 'artillerie-8', 'bogen-7'];
  return blatt(...ids.map((id, i) => (i < n ? id : null)));
}

pruefe('Unter keiner Bossregel fällt eine besetzte Burg auf null', () => {
  for (const id of P.BOSSREGEL_LISTE) {
    P.neuerVorrat();
    P.neuesBand([], mitRegel(id));
    const w = P.berechneWucht(fuenf(), P.dasBand.reihe, false).wucht;
    if (w <= 0) return id + ': volle Burg macht ' + w + ' Wucht';
  }
  return true;
});

pruefe('Auch mit allen Regeln zugleich bleibt Wucht übrig', () => {
  P.neuerVorrat();
  P.neuesBand([], { name: 'Alles', hp: 1e9, maxHp: 1e9, regeln: P.baueRegeln(P.BOSSREGEL_LISTE) });
  const w = P.berechneWucht(fuenf(), P.dasBand.reihe, false).wucht;
  return w > 0 ? true : 'die Burg macht ' + w + ' Wucht';
});

/* ---------- Der Spielstand ---------- */
pruefe('Ein Feldzug lässt sich sichern und genau so zurückholen', () => {
  P.neuerLauf();
  P.derLauf.wappen.push('greif', 'drache', 'amboss');
  P.derLauf.sold = 333;
  P.derLauf.formationsStufen.regiment = 3;
  P.lege('veteran', 9);
  P.waehle(P.offeneWahlen().find(w => w.art === 'durchlassen' && !w.gesperrt));
  const stand = JSON.parse(JSON.stringify(P.sichereFeldzug()));

  P.neuerLauf();                       // alles wegwerfen
  if (P.derLauf.sold === 333) return 'der neue Feldzug trug den alten Sold';

  const r = P.ladeFeldzug(stand);
  if (!r.ok) return r.grund;
  if (P.derLauf.sold !== 333) return 'Sold ' + P.derLauf.sold;
  if (P.bestand('veteran') !== 9) return 'Veteranen ' + P.bestand('veteran');
  if (P.derLauf.formationsStufen.regiment !== 3) return 'Formationsstufe verloren';
  if (P.dieBelagerung.vorhut.zustand !== 'durch') return 'die Vorhut steht auf ' + P.dieBelagerung.vorhut.zustand;
  return gleich(P.derLauf.wappen.join(), 'greif,drache,amboss', 'Wappen in ihrer Ordnung');
});

pruefe('Die REIHENFOLGE der Wappen überlebt das Speichern', () => {
  /*
   * Die Ordnung ist der Bauplan der Maschine. Ein Stand, der sie verliert,
   * hat das Wichtigste verloren - und man merkt es erst am Ergebnis.
   */
  P.neuerLauf();
  P.derLauf.wappen.push('amboss', 'drache', 'stier', 'greif');
  P.ordneWappen(0, 3);                 // amboss nach hinten
  const vorher = P.derLauf.wappen.join();
  const stand = JSON.parse(JSON.stringify(P.sichereFeldzug()));
  P.neuerLauf();
  P.ladeFeldzug(stand);
  return gleich(P.derLauf.wappen.join(), vorher, 'Reihenfolge');
});

pruefe('Ein Stand aus einer anderen Fassung wird abgelehnt', () => {
  P.neuerLauf();
  const stand = P.sichereFeldzug();
  stand.fassung = P.STAND_FASSUNG + 1;
  const r = P.ladeFeldzug(stand);
  return r.ok ? 'er wurde trotzdem geladen' : true;
});

pruefe('Ein unvollständiger Stand wird abgelehnt', () => {
  const r = P.ladeFeldzug({ fassung: P.STAND_FASSUNG, lauf: {} });
  if (r.ok) return 'er wurde trotzdem geladen';
  return P.ladeFeldzug(null).ok ? 'null wurde geladen' : true;
});

pruefe('Der Stand ist reines JSON und nicht zu gross', () => {
  P.neuerLauf();
  spieleAnteBisHeerfuehrer([true, false, true, false]);
  const text = JSON.stringify(P.sichereFeldzug());
  if (!JSON.parse(text)) return 'liess sich nicht lesen';
  return text.length < 200000 ? true : 'der Stand ist ' + text.length + ' Zeichen gross';
});

pruefe('Der geladene Feldzug lässt sich weiterspielen', () => {
  P.neuerLauf();
  spieleAnteBisHeerfuehrer([true, true, false, false]);
  const stand = JSON.parse(JSON.stringify(P.sichereFeldzug()));
  P.neuerLauf();
  P.ladeFeldzug(stand);
  const wahl = P.offeneWahlen().find(w => w.kampf);
  if (!wahl) return 'keine Schlacht offen';
  const erg = P.waehle(wahl);
  if (!erg.ok) return erg.grund;
  const k = P.beginneSchlacht(erg.kampf);
  if (!k) return 'kein Kampf';
  if (k.wappen.join() !== P.derLauf.wappen.join()) return 'der Kampf bekam andere Wappen';
  P.meldeAusgang(true);
  return gleich(P.dieBelagerung.ende, 'sieg', 'Ausgang');
});

/* ---------- Bedrohung, Vorbereitung, Erklaerungen ---------- */
/*
 * Was die Oberflaeche behauptet, muss im Kern nachweisbar sein. Die drei
 * Auskuenfte hier - Stufe, Folge einer Wahl, wofuer die Vorbereitung reicht -
 * sind der ganze Sinn der neuen Ante-Seite. Stimmen sie nicht, luegt die Seite.
 */

pruefe('Jede Bedrohungsstufe hat einen Namen und eine Folge', () => {
  for (let n = 0; n <= P.BEDROHUNG_MAX; n++) {
    const st = P.bedrohungsstufe(n);
    if (!st || !st.name || !st.text) return 'Stufe ' + n + ' ist leer';
    if (st.stufe !== n) return 'Stufe ' + n + ' nennt sich ' + st.stufe;
  }
  return P.bedrohungsstufe(P.BEDROHUNG_MAX + 9).stufe === P.BEDROHUNG_MAX
    ? true : 'ueber dem Hoechstwert gibt es noch eine Stufe';
});

pruefe('Höhere Bedrohung nimmt keine Regel weg', () => {
  let vorher = [];
  for (let n = 0; n <= P.BEDROHUNG_MAX; n++) {
    const jetzt = P.bedrohungsRegeln(n);
    for (const id of vorher) if (!jetzt.includes(id)) return 'Stufe ' + n + ' verliert ' + id;
    vorher = jetzt;
  }
  return true;
});

/* Der Zeitstempel im Stand tickt von selbst; alles andere darf es nicht. */
const standOhneZeit = () => {
  const st = P.sichereFeldzug();
  return JSON.stringify({ ...st, zeit: 0 });
};

pruefe('Die Vorschau einer Wahl ändert den Feldzug nicht', () => {
  P.neuerLauf();
  const vorher = standOhneZeit();
  for (const w of P.offeneWahlen()) {
    const f = P.folgenDerWahl(w);
    if (!f) return 'keine Folge fuer ' + w.name;
    if (typeof f.nachher.hp !== 'number') return 'keine Staerke fuer ' + w.name;
  }
  return standOhneZeit() === vorher ? true : 'der Stand hat sich verschoben';
});

pruefe('Die Vorschau sagt dieselbe Stärke wie der Feldzug danach', () => {
  P.neuerLauf();
  const w = P.offeneWahlen().find(x => x.art === 'durchlassen' && !x.gesperrt);
  if (!w) return 'nichts zum Durchlassen';
  const f = P.folgenDerWahl(w);
  P.waehle(w);
  return gleich(P.belagerungslage().heerfuehrer.hp, f.nachher.hp, 'Staerke');
});

pruefe('Die Vorbereitung sagt, wofür sie reicht', () => {
  P.neuerLauf();
  const leer = P.vorbereitungslage();
  if (!leer) return 'keine Lage';
  if (leer.punkte !== 0) return 'der Feldzug beginnt mit ' + leer.punkte;
  if (leer.reicht.length) return 'null Vorbereitung reicht angeblich fuer etwas';
  const w = P.offeneWahlen().find(x => x.art === 'durchlassen' && !x.gesperrt);
  P.waehle(w);
  const v = P.vorbereitungslage();
  if (v.punkte !== 2) return 'nach dem Durchlassen: ' + v.punkte;
  for (const d of v.dienste) {
    for (const po of d.posten) {
      if (po.reicht !== (v.punkte >= po.preis)) return po.name + ' rechnet falsch';
    }
  }
  return true;
});

pruefe('Was zu teuer ist, sagt genau, wie viel fehlt', () => {
  P.neuerLauf();
  const v = P.vorbereitungslage();
  if (!v.naechstes) return 'bei null Vorbereitung fehlt angeblich nichts';
  return gleich(v.naechstes.fehlt, v.naechstes.preis - v.punkte, 'Fehlbetrag');
});

pruefe('Jeder Begriff hat einen Satz, ein Kapitel und eine Erklärung', () => {
  for (const id of P.BEGRIFF_LISTE) {
    const b = P.begriff(id);
    if (!b) return id + ' gibt es nicht';
    if (b.id !== id) return id + ' nennt sich ' + b.id;
    if (!b.name) return id + ' hat keinen Namen';
    if (!b.satz) return id + ' hat keinen Satz';
    if (!b.lang) return id + ' hat keine Erklaerung';
    if (!P.KAPITEL[b.kapitel]) return id + ' zeigt auf das Kapitel ' + b.kapitel;
    if (b.satz.length > 160) return id + ': der Satz ist ' + b.satz.length + ' Zeichen lang';
  }
  return P.BEGRIFF_LISTE.length >= 15 ? true : 'nur ' + P.BEGRIFF_LISTE.length + ' Begriffe';
});

pruefe('Jeder Begriff beantwortet auch "wie steht es gerade?"', () => {
  P.neuerLauf();
  P.waehle(P.offeneWahlen().find(x => x.kampf));
  for (const id of P.BEGRIFF_LISTE) {
    let j;
    try { j = P.begriffJetzt(id); }
    catch (e) { return id + ' wirft: ' + (e && e.message); }
    if (j && j.zeilen && !Array.isArray(j.zeilen)) return id + ' liefert keine Zeilen';
  }
  return true;
});

console.log(`\n${gut} von ${gut + schlecht} Feldzugprüfungen bestanden.\n`);
process.exit(schlecht ? 1 : 0);
