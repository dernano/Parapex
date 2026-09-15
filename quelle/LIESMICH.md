# `quelle/` — der Kern in Modulen

Hier wird geschrieben. In `index.html` wird **geliefert**.

```
quelle/kern.js          das Dach: was der Kern nach aussen zeigt
quelle/kern/typen.js    die Formen, als JSDoc
quelle/kern/*.js        zwölf Module, in dieser Reihenfolge abhängig:

  regeln → einheiten → tuerme → feinde → wappen → signale
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
node scripts/pruefe-kern.mjs    #  15 Prüfungen,   59 ms
node scripts/pruefe.mjs         #  78 Prüfungen, 1305 ms (startet Chromium)
```

Gemessen, nicht geschätzt: **Faktor 22**. Reine Regelfragen gehören in die
erste Datei, das Zusammenspiel mit der Oberfläche in die zweite — das geht nur
im Browser, und deshalb bleibt es dort.

## Was NICHT in `quelle/` liegt

Die Oberfläche, die Zeichnung, der Ton — rund 9.500 Zeilen — stehen weiter
direkt in `index.html`. Dieser Umbau war ein Muster an **einem** Stück, damit
man es ansehen kann, bevor der Rest folgt.
