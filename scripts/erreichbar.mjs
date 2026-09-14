/*
 * Was wird noch gebraucht?
 *
 * Das Spiel ist EINE Datei mit ueber dreizehntausend Zeilen, und die Haelfte
 * davon gehoert zum alten Kampf. Von Hand loeschen heisst raten. Also wird
 * gerechnet: alle Erklaerungen auf oberster Ebene einsammeln, nachsehen, wer
 * wen nennt, und vom Einstieg aus markieren, was erreichbar ist. Was uebrig
 * bleibt, ruft niemand mehr.
 *
 *   node scripts/erreichbar.mjs          was tot ist
 *   node scripts/erreichbar.mjs lebend   was lebt
 *
 * Die Antwort ist ein Vorschlag, kein Befehl: Namen, die nur in einer
 * Zeichenkette stehen (`getElementById`-Namen, `onclick` im HTML), sieht das
 * hier nicht. Deshalb wird nach jedem Loeschen gemessen, nicht geglaubt.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(WURZEL, 'index.html'), 'utf8');
const a = html.lastIndexOf('<script>');
const quelle = html.slice(a + 8, html.indexOf('</script>', a));
const zeilenVersatz = html.slice(0, a + 8).split('\n').length - 1;

/*
 * Vorher Kommentare und Zeichenketten leeren. Ein Name in einem Kommentar ist
 * kein Aufruf - genau daran hat sich diese Pruefung zuerst verschluckt und
 * `neuerFeldzug` fuer lebendig gehalten, weil der Satz "frueher stand hier
 * neuerFeldzug" darueber steht. Die Zeilenzahl bleibt gleich, nur der Inhalt
 * geht weg, damit alle Zeilennummern weiter stimmen.
 */
function entkerne(text) {
  let raus = '';
  let i = 0;
  const halteZeilen = (st) => st.replace(/[^\n]/g, ' ');
  while (i < text.length) {
    const z = text[i], zwei = text.slice(i, i + 2);
    if (zwei === '/*') { const e = text.indexOf('*/', i + 2); const bis = e < 0 ? text.length : e + 2;
      raus += halteZeilen(text.slice(i, bis)); i = bis; continue; }
    if (zwei === '//') { const e = text.indexOf('\n', i); const bis = e < 0 ? text.length : e;
      raus += halteZeilen(text.slice(i, bis)); i = bis; continue; }
    if (z === '"' || z === "'" || z === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== z) { if (text[j] === '\\') j++; j++; }
      raus += z + halteZeilen(text.slice(i + 1, j)) + (text[j] || ''); i = j + 1; continue;
    }
    raus += z; i++;
  }
  return raus;
}

/* Erklaerungen auf oberster Ebene: sie beginnen in Spalte 0. */
const stuecke = [];
const zeilen = entkerne(quelle).split('\n');
const anfang = /^(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/;
for (let i = 0; i < zeilen.length; i++) {
  const m = zeilen[i].match(anfang);
  if (!m) continue;
  // Bis zur naechsten Zeile in Spalte 0, die eine schliessende Klammer ist.
  let j = i;
  let tiefe = 0, begonnen = false;
  for (; j < zeilen.length; j++) {
    for (const z of zeilen[j]) {
      if ('{(['.includes(z)) { tiefe++; begonnen = true; }
      else if ('})]'.includes(z)) tiefe--;
    }
    if (begonnen && tiefe <= 0) break;
    // Eine Erklaerung ohne Klammern endet erst am Strichpunkt. `const f = (x) =>`
    // geht ueber zwei Zeilen; wer nach der ersten aufhoert, schneidet den Kopf
    // ab und laesst den Rumpf als Ausdruck im Nichts stehen.
    if (!begonnen && /;\s*$/.test(zeilen[j])) break;
    if (begonnen && tiefe > 0) continue;
  }
  stuecke.push({ name: m[1] || m[2], von: i, bis: Math.min(j, zeilen.length - 1) });
  i = j;
}

/*
 * Eigenschaftsnamen sind keine Aufrufe. `state.draw` ist ein Stapel Karten und
 * nicht die Funktion `draw`; `kampf: () => ...` ist ein Schluessel und nicht
 * die Funktion `kampf`. Ohne diesen Schnitt haelt die Pruefung den halben
 * alten Zeichenweg fuer lebendig, weil irgendwo ein Feld genauso heisst.
 */
function nurAufrufe(text) {
  return text
    .replace(/\.\s*[A-Za-z_$][\w$]*/g, ' ')            // .name
    // Kein Leerzeichen vor dem Doppelpunkt: `draw: []` ist ein Schluessel,
    // `boss ? FEIND_BOSS_FAKTOR : 1` ist keiner. Ohne diese Unterscheidung
    // haelt die Pruefung jeden mittleren Zweig einer Bedingung fuer tot.
    .replace(/(^|[{,(\s])([A-Za-z_$][\w$]*):/g, '$1 ');
}

const nachName = new Map(stuecke.map(s => [s.name, s]));
for (const s of stuecke) {
  s.text = zeilen.slice(s.von, s.bis + 1).join('\n');
  s.nennt = new Set();
  for (const m of nurAufrufe(s.text).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    if (m[1] !== s.name && nachName.has(m[1])) s.nennt.add(m[1]);
  }
}

/*
 * Die Wurzeln: was von aussen angestossen wird. Alles, was nicht in einer
 * Erklaerung steht - Aufrufe auf oberster Ebene, `addEventListener` am Fenster -
 * zaehlt mit, denn das laeuft beim Laden.
 */
const inStueck = new Set();
for (const s of stuecke) for (let i = s.von; i <= s.bis; i++) inStueck.add(i);
const wurzeln = new Set();
for (let i = 0; i < zeilen.length; i++) {
  if (inStueck.has(i)) continue;
  for (const m of nurAufrufe(zeilen[i]).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) if (nachName.has(m[1])) wurzeln.add(m[1]);
}

const lebt = new Set();
const stapel = [...wurzeln];
while (stapel.length) {
  const n = stapel.pop();
  if (lebt.has(n)) continue;
  lebt.add(n);
  const s = nachName.get(n);
  if (s) for (const k of s.nennt) if (!lebt.has(k)) stapel.push(k);
}

/* Die Zeilen ausserhalb jeder Erklaerung - das ist die Verdrahtung. */
if (process.argv[2] === 'oben') {
  for (let i = 0; i < zeilen.length; i++) {
    if (inStueck.has(i) || !zeilen[i].trim()) continue;
    const n = [...zeilen[i].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].map(m => m[1]).filter(x => nachName.has(x));
    if (n.length) console.log((i + 1 + zeilenVersatz + '').padStart(6) + '  ' + zeilen[i].trim().slice(0, 90));
  }
  process.exit(0);
}
if (process.argv[2] === 'wurzeln') {
  console.log([...wurzeln].sort().join('\n'));
  process.exit(0);
}
/* Warum lebt X? Der kuerzeste Weg von einer Wurzel dorthin. */
if (process.argv[2] === 'warum') {
  const ziel = process.argv[3];
  const vorher = new Map();
  const schlange = [...wurzeln];
  const gesehen = new Set(schlange);
  while (schlange.length) {
    const n = schlange.shift();
    if (n === ziel) break;
    for (const k of (nachName.get(n) || { nennt: [] }).nennt) {
      if (gesehen.has(k)) continue;
      gesehen.add(k); vorher.set(k, n); schlange.push(k);
    }
  }
  const weg = [];
  for (let n = ziel; n; n = vorher.get(n)) { weg.unshift(n); if (wurzeln.has(n)) break; }
  console.log(weg.join(' → '));
  process.exit(0);
}

const tot = stuecke.filter(s => !lebt.has(s.name));
const wasZeigen = process.argv[2] === 'lebend' ? stuecke.filter(s => lebt.has(s.name)) : tot;
const zeilenZahl = wasZeigen.reduce((n, s) => n + (s.bis - s.von + 1), 0);

console.log(stuecke.length + ' Erklärungen, ' + lebt.size + ' erreichbar, ' + tot.length + ' nicht.');
console.log((process.argv[2] === 'lebend' ? 'Erreichbar' : 'Nicht erreichbar') +
  ': ' + wasZeigen.length + ' Stück, ' + zeilenZahl + ' Zeilen\n');
for (const s of wasZeigen.sort((x, y) => x.von - y.von)) {
  console.log((s.von + 1 + zeilenVersatz + '').padStart(6) + '  ' +
    (s.bis - s.von + 1 + ' Z.').padStart(8) + '  ' + s.name);
}
