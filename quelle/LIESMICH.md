# `quelle/` — der Kern in Modulen

Hier wird geschrieben. In `index.html` wird **geliefert**.

```
quelle/kern.js          das Dach: was der Kern nach aussen zeigt
quelle/kern/typen.js    die Formen, als JSDoc
quelle/kern/*.js        die Regeln des Kampfes
quelle/wappen/*.js      das Wappen-Fließband

  regeln → einheiten → tuerme → feinde
         → wappen/ereignisse → wappen/fliessband → wappen/vorrat
         → wappen/wirkungen → wappen/sammlung
         → formationen → wucht → kampf → lauf → haendler → begegnungen
```

## Warum überhaupt Module

Das Spiel war eine Datei mit 11.139 Zeilen in **einem** Namensraum. Dort
gewinnt bei zwei gleichnamigen `function`-Erklärungen stillschweigend die
spätere. Genau das ist zweimal passiert: der neue Kern rief eine Altlast auf,
ohne abzustürzen — die Funktion war einfach die falsche.

Module machen diese Fehlerklasse **unmöglich**, nicht nur unwahrscheinlicher.

## Warum trotzdem eine ausgelieferte Datei

Ein Artefakt rendert *eine* Seite, und man soll `index.html` doppelklicken
können — ohne Node, ohne Server, ohne Netz. Quelltext und Lieferung sind
zwei verschiedene Dinge.

```bash
node scripts/baue.mjs           # quelle/ → index.html
node scripts/baue.mjs pruefen   # nur melden, ob index.html aktuell ist
```

`scripts/pruefe.mjs` ruft die Abgleichprüfung selbst auf, bevor es den Browser
startet. Wer `index.html` von Hand ändert, bekommt es gesagt, statt etwas zu
prüfen, das beim nächsten Bau wieder verschwindet.

## Was der Bündler tut — und was nicht

Kein fremdes Werkzeug: das wäre eine Abhängigkeit für ein Problem aus zwölf
Dateien ohne npm. `scripts/baue.mjs` tut drei Dinge:

1. **Den Abhängigkeitsgraphen aus den `import`-Zeilen lesen und topologisch
   sortieren.** Ein Kreis bricht den Bau ab — statt stillschweigend zu
   funktionieren, weil Funktionen hochgezogen werden.
2. **Prüfen, dass jeder eingeführte Name auch wirklich ausgeführt wird.**
3. `import`/`export` streichen und alles in einen Geltungsbereich legen.

Punkt 1 hat beim ersten Lauf **zwei echte Kreise** gefunden, die die eine
grosse Datei vollständig verborgen hatte:

| Kreis | Was daran falsch war |
|---|---|
| `wappen → kampf` | Das Wappen des Ebers rief `schiesseEinzeln` direkt. Aber *wie* geschossen wird, weiss der Kampf, nicht das Wappen. |
| `formationen → lauf` | `formationsStufe` las `derLauf`. Damit hing die Kampfrechnung am Deckbuilder. |

Beide sind **umgedreht**, nicht erlaubt: oben meldet sich unten an
(`setzeEinzelschuss`, `setzeStufenquelle`), unten weiss nichts von oben. Der
Graph ist jetzt kreisfrei.

## Typprüfung ohne Übersetzung

Die Dateien sind und bleiben JavaScript, das jeder Browser direkt liest.
`tsc --noEmit` liest nur mit:

```bash
tsc -p tsconfig.json
```

Erster Lauf, fünf Klagen, zwei davon echt: ein **toter Import** in `wucht.js`
und ein **untypisierter Haken** im Wappenmodul. Die anderen drei waren fehlende
JSDoc-Angaben — jetzt stehen sie in `kern/typen.js`.

Der eigentliche Gewinn ist der nächste Umbau: als in dieser Sitzung die
Signatur von `batallionStellungen` von `(x, y, mitte)` auf `(turm, hoehe, mass)`
wechselte, hat nur ein `grep` und ein Augenpaar verifiziert, dass alle
Aufrufstellen stimmen.

## Prüfen ohne Browser

Der Kern enthält keine Zeile Browser. Seit er ein Modul ist, lässt er sich
darum einfach importieren:

```bash
node scripts/pruefe-kern.mjs    #  43 Prüfungen (startet keinen Browser)
node scripts/pruefe.mjs         #  78 Prüfungen (startet Chromium)
```

Gemessen, nicht geschätzt: **Faktor 22**. Reine Regelfragen gehören in die
erste Datei, das Zusammenspiel mit der Oberfläche in die zweite — das geht nur
im Browser, und deshalb bleibt es dort.

## Das Wappen-Fließband

Die Wappen hatten vorher **fünf verschiedene Hakenformen** an fünf Stellen im
Kern: `rangFaktor` im Blatt, `gesamtFaktor` in der Wucht, `tauschRabatt` beim
Tauschen, `zaehltDoppelt` beim Erkennen, `horcht` am Signalbus. Das hatte zwei
Folgen, und beide waren schlecht.

**Erstens** konnte ein Wappen wirkungslos werden, ohne dass es auffiel. Der
Drache versprach „Jeder Nachschuss zählt doppelt" und trug dafür einen
sechsten Haken, `retriggerFaktor` — der seit dem Salvenumbau **an keiner
einzigen Stelle mehr gelesen wurde**. Auf der Tafel stand die Wirkung
weiterhin. Gefunden wurde das nicht beim Spielen, sondern beim Zählen der
Haken.

**Zweitens** konnten zwei Wappen einander nichts sagen. Es gab keinen Ort, an
dem sie sich begegnet wären — also gab es auch keine Kombination, nur eine
Summe.

Jetzt gibt es **einen Weg**: ein Ereignis geht durch die fünf Plätze, **strikt
von links nach rechts**, und jeder Platz sieht die Lage so, wie der Platz vor
ihm sie hinterlassen hat.

```
  Platz 1  ──►  Platz 2  ──►  Platz 3  ──►  Platz 4  ──►  Platz 5
   +10           ×3            …             …             …
```

`(s+10)×3` ist nicht `s×3+10`. Die Anordnung am Gestell ist damit keine
Geschmacksfrage, sondern der Bauplan. Geprüft wird genau das:

    ok   Die Reihenfolge ändert das Ergebnis

| Datei | Was darin steht |
|---|---|
| `ereignisse.js` | die 16 Ereignisnamen und die Vorratsarten |
| `fliessband.js` | der Durchlauf, die Sperren, das Protokoll |
| `wirkungen.js` | was ein Wappen ändern darf — und nur das |
| `vorrat.js` | Veteranenmarken, Pulver, Verwüstung, Befehle |
| `sammlung.js` | die Wappen selbst, als Daten |

### Der Signalbus ist weg

`signale.js` hatte am Ende genau **einen** Nutzer: die `horcht`-Haken der
Wappen. Die Oberfläche hörte auf kein einziges Signal — sie liest den Zustand
direkt. Mit dem Fließband ist der Bus ersatzlos entfallen; zwei Ereignis-
systeme nebeneinander wären genau die Unordnung, die abgeschafft werden sollte.

### Warum es nicht durchdreht

Ein Spieler wird früher oder später zwei Wappen zusammenstecken, die einander
zünden. Das ist kein Fehler, das ist die Bauform. Sie muss **enden**, ohne dass
irgendwo ein Wappenname steht:

* **Tiefe** — wie tief Wappen einander noch zünden dürfen (6)
* **je Platz** — wie oft ein Platz in *einem* Ereignis zündet (12)
* **je Ereignis** — wie viele Zündungen ein Ereignis insgesamt hat (60)
* **Kreis** — ein Ereignis zündet das Wappen nicht noch einmal, über das es
  überhaupt erst entstanden ist

Der Schlüssel dazu ist ein einziger Satz in `loeseAus`: ein Ereignis, das
entsteht, **während** ein anderes noch läuft, hängt sich automatisch darunter.
Ohne ihn wäre jede Rückkehr aus dem Spiel ins Band ein frischer Anfang bei
Tiefe 0 — und die sauberste Sperre der Welt zählte bis zum Stapelüberlauf mit.

Jede abgewiesene Zündung **bleibt im Protokoll stehen**, mit ihrem Grund. Wer
sie nicht sieht, sucht sie stundenlang.

### Verstärken ohne Wissen

Jede Änderung wird als `{art, wert}` aufgezeichnet. Darum muss der Drache
nicht wissen, was sein linker Nachbar getan hat — er liest dessen
aufgezeichnete Wirkungen und wendet sie noch einmal an. **Ein Wappen, das es
morgen gibt, ist heute schon verstärkbar.**

Additiv und multiplikativ sind dabei streng getrennt: verdoppelt man `+3`,
wird daraus `+6`; verdoppelt man `×1,5`, wird daraus `×2,25` und nicht `×3`.
Nur so heisst „zählt doppelt" bei beiden Bauarten dasselbe.

### Rechnen, ohne die Welt zu berühren

Die Anzeige fragt `berechneWucht` dutzendfach je Sekunde — Vorschau, Leiste,
Tafel. Darum läuft diese Rechnung standardmässig als **Probe**: sie verbrennt
kein Pulver und schreibt nicht ins Kampfprotokoll. Nur die Salve am Rundenende
fragt echt. Der Vorgabewert steht auf `probe = true`, weil der teure Fehler in
die andere Richtung geht.

## Was NICHT in `quelle/` liegt

Die Oberfläche, die Zeichnung, der Ton — rund 9.500 Zeilen — stehen weiter
direkt in `index.html`. Dieser Umbau war ein Muster an **einem** Stück, damit
man es ansehen kann, bevor der Rest folgt.
