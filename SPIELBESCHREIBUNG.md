# Parapex — vollständige Spielbeschreibung

Stand: nach dem fundamentalen Umbau. Das Repository `dernano/Parapex` setzt
`dernano/CastleMaster` mit vollständiger Geschichte fort; der Stand des alten
Spiels liegt dort auf dem Zweig `stand/castle-master`.

Dieses Dokument beschreibt den **Ist-Zustand** so, dass ein Modell ohne Zugriff
auf den Quelltext daran weiterarbeiten oder darüber urteilen kann. Es beschreibt
keine Pläne. Wo Zahlen stehen, stammen sie aus dem Code; wo Messwerte stehen,
stammen sie aus Bot-Läufen (Abschnitt 11).

Das Entwicklungstagebuch mit den Begründungen steht in `README.md`.

---

## 1. Was es ist

Ein **Deckbuilder-Roguelike** im Browser. Fünf Türme, fünf Runden, ein Gegner
mit einer einzigen Zahl. Die Frage ist jedes Mal dieselbe: reicht die Wucht, die
man in fünf Runden aufbaut?

Der nächste Verwandte ist Balatro, nicht Slay the Spire: es gibt keinen
Schlagabtausch, keine Verteidigung und keinen Gegnerzug. Es gibt eine
Aufstellung, ein Muster darin, und eine Zahl, die aus dem Muster folgt.

- Ein Akt führt über **11 Stationen** zum Belagerungsmeister.
- An jeder Kampfstation steht dieselbe Burg mit **genau fünf Türmen**.
- Auf jedem Turm steht **genau eine Einheit**.
- Welche Einheiten nebeneinander stehen, ergibt **Formationen**; Formationen
  überlappen und vervielfachen sich miteinander.
- Darstellung: isometrische Pixelgrafik, **vollständig im Code gezeichnet**
  (Canvas 2D), keine Bilddateien.
- Sprache der Oberfläche und des Quelltextes: **Deutsch**, auch Bezeichner,
  Kommentare und Commit-Nachrichten.

**Das Ganze ist eine einzige Datei**: `index.html`, rund 380 kB, kein
Build-Schritt, keine Abhängigkeiten zur Laufzeit.

---

## 2. Die Karten: 52 Einheiten

Vier **Gattungen** mal dreizehn **Ränge**, wie ein Kartenspiel:

| Gattung | Zeichen | Farbe | Ränge (Beispiele) |
|---|---|---|---|
| Bogenschützen | 🏹 | grün | Bauernschütze (1) … Marschall der Schützen (13) |
| Armbrustschützen | 🎯 | blau | Bolzenschütze (1) … Meister der Arbalest (13) |
| Artillerie | ⚙ | ocker | Steinschleuderer (1) … Meister der Artillerie (13) |
| Kanoniere | 💥 | rot | Pulverjunge (1) … Meisterkanonier (13) |

**Der Rang ist die Grundwucht.** Die große Zahl auf der Karte ist beides — eine
Zahl, die man liest, statt einer zweiten, die man nachschlägt.

Ein **Schliff** hebt die Wucht (`+2`), nicht den Rang: der Rang bleibt
Formationssache, damit ein Schliff eine Formation nicht kaputtmacht.

Das **Startdeck** sind zwölf Karten, alle vier Gattungen, Ränge 2–5:
`bogen-2/3/4`, `armbrust-2/4/5`, `artillerie-2/3/5`, `kanonier-2/3/4`.

---

## 3. Der Kampf

- **Fünf Runden**, mehr gibt es nicht.
- **Sieben Karten** auf der Hand zu Rundenbeginn. Am Rundenende wandert die
  ganze Hand in die Ablage und es wird neu gezogen.
- **Fünf Tatendrang** je Runde, voll aufgefüllt, nicht übertragbar.

Der Tatendrang ist die einzige Währung im Kampf:

| Handlung | Kosten |
|---|---|
| Einheit auf einen leeren Turm | 1 |
| Einheit auf einen besetzten Turm (ersetzt) | 1 |
| Eine Handkarte austauschen | 1 |

**Es gibt kein freies Abwerfen.** Wer eine Karte loswerden will, zahlt dafür.
Das ist der Grund, warum eine mittelmäßige Hand eine Entscheidung ist.

Eine gesetzte Einheit **feuert sofort einen Einzelschuss**. Der Rest ihrer Wucht
kommt am Rundenende mit der **Salve** — dann rechnet die ganze Aufstellung
gemeinsam ab.

Wird eine Einheit ersetzt, wandert die alte in die **Ablage**. Die
Wahrscheinlichkeiten im Stapel verschieben sich dadurch während des Kampfes, und
das ist beabsichtigt.

Kein Block, keine Verteidigungskarte, kein Gegnerzug. Der Gegner hat einen
einzigen Stärkewert; dass acht Räuber auf dem Feld stehen, ist Bild und nicht
Mechanik.

---

## 4. Formationen

Zehn Muster. Sie **überlappen** — eine Einheit kann in mehreren gleichzeitig
stehen — und sie **vervielfachen sich miteinander**. Es gibt keine Obergrenze.

| Formation | Bedingung | Wirkung |
|---|---|---|
| Schützenlinie | 3 benachbarte Bogenschützen | die drei feuern ein zweites Mal |
| Bolzenwall | 3 Armbrustschützen (irgendwo) | ihre Wucht ×2 |
| Schwere Batterie | 2 benachbarte Artillerie | ihre Wucht ×2 |
| Pulverlinie | 3/4/5 Kanoniere (irgendwo) | ihre Wucht ×2 / ×3 / ×5 |
| Wechselfeuer | 4 benachbarte Türme, Gattungen abwechselnd | ihre Wucht ×2 |
| Zangenstellung | gleiche Gattung an beiden Enden einer Reihe | beide Enden feuern erneut |
| Vorrückende Salve | 3/4/5 benachbarte Türme, steigende Ränge | ×1,5 / ×2 / ×3 |
| Fallende Salve | 3/4/5 benachbarte Türme, fallende Ränge | ×1,75 / ×2,5 / ×4 |
| Königshügel | mittlerer Turm trägt den höchsten Rang | sein Rang ×2 |
| Geschlossene Front | alle fünf Türme besetzt | **Gesamtwucht** ×1,5 |

Die Namen sind absichtlich **keine Pokerbegriffe**: die Sprache soll von einer
Burg erzählen, nicht von einem Blatt.

Eine Formation liefert eines von drei Dingen:

- `proTurm` — ein Faktor auf die Wucht der genannten Türme,
- `nachschuss` — die genannten Türme feuern noch einmal,
- `gesamt` — ein Faktor auf die Summe am Ende.

Neue Formationen sind ein Eintrag in `FORMATIONEN`, keine Änderung am Code.

---

## 5. Die Wuchtkette

Die Reihenfolge steht fest und wird als Protokoll zurückgegeben, damit der
Spieler sehen kann, **wo** die Zahl herkommt:

```
je Turm:   (Rang + Ausbau)  ×  Turmtyp  ×  Formationen(proTurm)  ×  (1 + Nachschüsse)
danach:    Summe  ×  Formationen(gesamt)  ×  Wappen(gesamt)
```

`berechneWucht` gibt `{ posten, formationen, schritte, grund, wucht }` zurück.
`schritte` ist die lesbare Kette; die Oberfläche zeigt sie nach jeder Salve und
im Werkzeug.

`vorschau(turm, karte)` rechnet dieselbe Kette für eine **hypothetische**
Aufstellung — daher die Live-Vorschau, während eine Karte über einer Tafel
hängt.

---

## 6. Wappen

Fünf Plätze. Wappen brechen Regeln, statt Zahlen zu heben.

| Wappen | Wirkung |
|---|---|
| Löwe | der mittlere Turm zählt seinen Rang **dreifach** |
| Doppeladler | Turm 1 und Turm 5 gelten als **benachbart** (die Reihe wird zum Ring) |
| Wolf | je leerem Turm **+60 %** Gesamtwucht |
| Eber | eine **ersetzte** Einheit feuert ein letztes Mal |
| Schlange | die ersten **zwei** Kartentausche jeder Runde kosten nichts |
| Drache | jeder **zweite** Nachschuss einer Runde zählt ×2,5 |

Technisch hängt ein Wappen an einem von fünf Griffen: `rangFaktor`, `ring`,
`gesamtFaktor`, `horcht` (Ereignisse), `tauschRabatt`, `retriggerFaktor`. Ein
neues Wappen ist ein Eintrag in `WAPPEN`.

Der Wolf ist absichtlich gegenläufig: leere Türme kosten Grundwucht **und**
verhindern die Geschlossene Front. Er ist ein Angebot, kein Geschenk.

---

## 7. Türme

Fünf Stellungen auf dem Wall, von oben nach unten durchnummeriert. Ihr **Typ**
ist die langsame Fortschrittsachse und bleibt über den ganzen Akt.

| Typ | Wirkung |
|---|---|
| Wachturm | keine Sonderregel (Startzustand aller fünf) |
| Schützenturm | Bogenschützen +25 % |
| Ballistenturm | Armbrustschützen +25 % |
| Geschützturm | Artillerie +25 % |
| Pulverturm | Kanoniere +25 % |

---

## 8. Der Akt

Elf Knoten in fester Reihenfolge:

```
1 Kampf · 2 Kampf · 3 Begegnung · 4 Händler · 5 Kampf · 6 Sturmtrupp
7 Begegnung · 8 Kampf · 9 Händler · 10 Sturmtrupp · 11 Belagerungsmeister
```

Sieben Kämpfe, zwei Händler, zwei Begegnungen. **Ein verlorener Kampf beendet
den Akt** (`LAUF.leben = 1`).

Die Stärke des Gegners hängt an der **Kampfnummer**, nicht an der Station — an
Station 5 steht der dritte Kampf:

```
FEIND_STAERKE = [300, 340, 470, 520, 700, 880, 1150, 1400, 1700, 2050]
Sturmtrupp ×1,3     Belagerungsmeister ×1,25
```

**Sold** gibt es für jeden Sieg (25 / 45 / 120) plus 8 je Runde, die man nicht
gebraucht hat. Wer in Runde zwei fertig ist, kauft mehr als wer in Runde fünf
gerade so durchkommt.

### Belohnung nach einem Sieg

Drei Angebote, eines wird genommen. Eine Einheit steht immer dabei; die anderen
zwei kommen aus Wappen, Turmausbau, Ausmustern und einer zweiten Einheit. Der
Rang einer Belohnungskarte wächst mit der Kampfnummer
(`rangKurve: ab 2, je 1.4` → vom dritten Rang bis an die Spitze).

### Händler

Drei Einheiten (Preis nach Rang), ein Wappen (130), ein Turmausbau (95),
Ausmustern (60), Schleifen (75). Der Bestand wird einmal gebaut und bleibt
stehen — wer nicht kauft, darf nicht neu würfeln.

### Begegnungen

Sechs, jede mit zwei Wahlen und einer Bedingung, die sie zurückhält, wenn sie
gerade nichts bewirken könnte. Ein Wappenangebot ohne freien Platz ist kein
Ereignis, sondern ein Ärgernis.

---

## 9. Aufbau des Quelltextes

`index.html`, rund 8.900 Zeilen, in dieser Reihenfolge:

| Block | Inhalt |
|---|---|
| Stilblatt | 145 Regeln, die Oberfläche von Parapex |
| **Kern** | `KERN`, Gattungen, Ränge, Pool, Turmtypen, Gegner, Wappen, Signale, Formationen, Wuchtkette, Kampf |
| **Lauf** | `LAUF`, Knoten, Belohnung, Händler, Begegnungen |
| Bühne | Bildgröße, Auflösung, Bedienelemente |
| Bauwerks-Engine, Modelle, Wall, Himmel | die Zeichenmaschine |
| Sinnbilder, Ton, Musik | |
| Werkstatt, Einstellungen | Werkzeuge |
| **Kampfoberfläche** | `pk*` — Zeichnen, Tafeln, Hand, Ziehen |
| **Lauf-Oberfläche** | Belohnung, Händler, Begegnung, Laufende |
| **Werkzeug** | `PX`, Strg+D |

Der Kern hat **keine Verbindung zur Anzeige**. Er kennt kein Dokument, keinen
Zeichenkontext und keine Browser-Ereignisse — er rechnet nur. Das ist der Grund,
warum er von außen prüfbar ist.

Alles, was Balance ist, steht in `KERN` und `LAUF`. Wer eine Zahl sucht, findet
sie an einer Stelle.

### Ereignisse

Ein kleiner Signalbus (`SIGNALE`, `hoereSignal`, `sendeSignal`) mit
Tiefenschutz (`signalMaxTiefe: 8`): `rundeBeginnt`, `karteGezogen`,
`karteGetauscht`, `einheitGesetzt`, `einheitErsetzt`, `salve`, `rundeEndet`,
`feindBesiegt`, `kampfEndet`. Wappen hängen sich daran ein.

---

## 10. Werkzeuge

| Befehl | Was er tut |
|---|---|
| `node scripts/pruefe.mjs` | 61 Prüfungen im echten Browser gegen `window.PARAPEX` |
| `node scripts/bot.mjs [n] [strategie]` | n Akte durchspielen, Gewinnquote je Station |
| `node scripts/kurve.mjs [n]` | wie viel Wucht ein Deck am n-ten Kampf bringt |
| `node scripts/lauftest.mjs` | ein ganzer Akt **über die Oberfläche**, mit Klicks |
| `node scripts/erreichbar.mjs` | welche Erklärungen niemand mehr ruft |
| `node scripts/schneide.mjs tu` | die schneiden |
| `node scripts/stil.mjs [tu]` | Stilregeln, die auf nichts greifen |

Im Spiel: **Strg+D** öffnet das Werkzeug (Zustand, Wuchtkette, Eingriffe).
In der Konsole: `PX.station(9)` springt an Station 9 mit passendem Deck,
`PX.probe(['bogen-9', ...])` wiegt eine Aufstellung, ohne sie zu spielen.

---

## 11. Gemessene Balance

60 Läufe mit dem Bot, der in jeder Runde die Setzung nimmt, die die Salve am
stärksten hebt — also ein Spieler, der die Vorschau liest und sonst nichts
weiter denkt:

| Station | Art | gewonnen |
|---|---|---|
| 1 | Kampf | 100 % |
| 2 | Kampf | 100 % |
| 5 | Kampf | 92 % |
| 6 | Sturmtrupp | 76 % |
| 8 | Kampf | 83 % |
| 10 | Sturmtrupp | 77 % |
| 11 | Belagerungsmeister | 59 % |

**Akt geschafft: 27 %.** Die Mitte liegt bei Station 10 — die meisten Läufe
sterben am Boss oder kurz davor.

Wucht über fünf Runden, nach Kampfnummer (Mittelwert):

```
Kampf   1     2     3     4     5     6     7
Wucht  645   662   798   735   799  1219  1181
```

**Das ist die wichtigste offene Frage am Spiel.** Das Deck wächst über einen Akt
etwa auf das Doppelte, nicht auf das Hundertfache. Der Grund: das Vielfache aus
den Formationen liegt schon im ersten Kampf bei etwa 14 und steigt kaum, weil
die Formationen mit einem beliebigen Deck erreichbar sind. Die einzige Achse,
die wirklich wächst, ist der Rang — und der reicht von 3 bis 13, also knapp das
Vierfache.

Wer die Zahlen explodieren lassen will, muss dort ansetzen: Formationen, die
ein Startdeck **nicht** treffen kann, oder Wappen, die sich gegenseitig
verstärken.

---

## 12. Was es nicht gibt

Absichtlich nicht, damit niemand danach sucht:

- keine Verteidigung, kein Block, keine Zinnen als Vorrat
- kein Gegnerzug, keine Wegsuche, keine Reichweite
- kein Zielen, kein Klick aufs Spielfeld — das Bild ist Kulisse
- keine Befehlskarten, keine Karten außer Einheiten
- kein freies Abwerfen
- keine verzweigte Route — elf Knoten in fester Reihenfolge
- nur ein Akt

Der gesamte alte Kampf (Castle Master) ist entfernt. Sein Stand liegt auf dem
Zweig `stand/castle-master` und im Repository `dernano/CastleMaster`.
