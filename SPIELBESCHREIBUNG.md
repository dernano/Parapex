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

### Das Startdeck ist das ganze Blatt

Alle **52 Karten** liegen von Anfang an im Deck. Das dreht die Richtung des
Spiels um: ein Lauf lässt das Deck nicht wachsen, er **verschmälert** es. Die
Bauernschützen werden ausgemustert, damit die Marschälle öfter kommen.

Daraus folgt alles Weitere:

- **Ausmustern ist die schärfste Belohnung**, eine hinzugefügte Karte die
  schwächste. Eine Karte von 52 hebt den Schnitt um zwei Hundertstel.
- Ausgemustert wird deshalb in **Schüben**: vier Karten als Belohnung, drei
  beim Händler — immer die schwächsten.
- Ein **Schliff** ist im 52-Karten-Deck fast wirkungslos und damit eher ein
  Notkauf als eine Achse.

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

### Sammeltausch

Mehrere Handkarten werden **zusammen** getauscht: anklicken, was weg soll, dann
einmal auf `Austauschen ×n`. Jede Karte kostet für sich, die Punkte, die der
Klick kosten wird, glühen vorher rot.

Die Reihenfolge im Kern ist dabei entscheidend: die getauschten Karten kommen
erst **beiseite**, dann wird nachgezogen, und erst danach wandern sie in die
Ablage. Würde man sie sofort ablegen, könnte ein leerer Zugstapel sie
mitmischen — und man zöge genau die Karte wieder, die man loswerden wollte.

### Sortierung

Die Hand lässt sich nach **Farbe** (Gattung, darin Rang) oder nach **Rang**
(darin Gattung) ordnen; die Wahl bleibt im Browser gemerkt. Sie ist reine
Anzeige und fasst `k.hand` nicht an — sie entscheidet nur, in welcher Folge die
bestehenden Kartenelemente hängen. Deshalb kann man beliebig oft umschalten,
ohne dass eine Karte verschwindet, sich verdoppelt oder eine
Ziehwahrscheinlichkeit sich verschiebt.

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

Die fünf besetzten Stellungen sind ein **Blatt**. Was darin steckt, erkennt man
wie in einem Kartenspiel: gleiche Gattung, gleiche Ränge, eine Folge von Rängen.

**Die Stellung der Türme zählt nicht.** `7 / 3 / 6 / 12 / 5` enthält dieselbe
Folge `5 / 6 / 7` wie jede andere Anordnung. Niemand muss vor dem Ausspielen
sortieren.

Zwölf Formationen in drei **Familien**. Aus jeder Familie gilt nur die **höchste**
erreichte — fünf gleiche Gattungen sind eine Reine Garde und nicht zusätzlich
ein Regiment und ein Großes Regiment.

| Familie | Formation | Bedingung | Salven |
|---|---|---|---|
| Grundstellung | Geschlossene Front | alle fünf Stellungen besetzt | +1 |
| Gattung | Regiment | 3 derselben Gattung | +2 |
| Gattung | Großes Regiment | 4 derselben Gattung | +4 |
| Gattung | Reine Garde | **alle 5** derselben Gattung | +7 |
| Rang | Doppelposten | 2 desselben Rangs | +1 |
| Rang | Doppelte Wache | zwei verschiedene Paare | +2 |
| Rang | Drillingsposten | 3 desselben Rangs | +3 |
| Rang | Viererblock | 4 desselben Rangs | +10 |
| Rangfolge | Vormarsch | 3 aufeinanderfolgende Ränge | +2 |
| Rangfolge | Großer Vormarsch | 4 aufeinanderfolgende Ränge | +4 |
| Rangfolge | Perfekter Vormarsch | 5 aufeinanderfolgende Ränge | +7 |

### Die beiden Krönungen

| Formation | Bedingung | Salven |
|---|---|---|
| Königlicher Aufmarsch | 5 aufeinanderfolgende Ränge derselben Gattung | +15 |
| **Königliche Garde** | **Neun bis König** in einer Gattung | **+25** |

Beide stehen in der Familie *Gattung* und lösen zusätzlich die Familie
*Rangfolge* ab. Weil die Garde in derselben Familie eine Stufe höher steht,
gilt nie beides: `Bogen 9/10/11/12/13` ist eine Garde und **kein** Aufmarsch.

Der Aufmarsch kann bei der Zwei anfangen. Die Garde ist der eine Aufmarsch,
der oben endet — das Seltenste, was fünf Stellungen hergeben. Sie bekommt
darum einen eigenen Auftritt: heller als der Aufmarsch, länger, mit einem
zweiten Schlag nach kurzer Pause.

Was das ausmacht, gemessen: fünf beliebige Einheiten bringen **70 Wucht**, ein
Königlicher Aufmarsch **850**, eine Königliche Garde **1 566**.

Gleiche Ränge zählen in einer Folge nur einmal — `8 / 8 / 9 / 10` ist eine Folge
von drei, keine von vier.

### Formationsstufen

Jede Formation trägt `salven` und `jeStufe`, der Lauf hält `formationsStufen`.
Das Gerüst für spätere Aufwertungen einzelner Formationen steht damit; die
Belohnungsökonomie dazu kommt später.

---

## 5. Die Wuchtkette

```
je Turm:   (Rang + Schliff) × Turmtyp
Summe   ×  Salvenzahl  ×  Wappen
```

Die **Salvenzahl** ist eine Grundsalve plus, was die Formationen geben. Sie ist
kein Rechentrick: **jede Salve ist ein Schuss, den man sieht.** Wer `+7 Salven`
liest, sieht sieben Mal feuern.

`berechneWucht` gibt `{ posten, formationen, schritte, salven, jeSalve, wucht }`
zurück. `vorschau(turm, karte)` rechnet dieselbe Kette für eine hypothetische
Aufstellung — daher die Live-Vorschau, die neue *und* brechende Formationen zeigt.

### Salven abspielen

`pkSpielSalve` löst die Salvenzahl in sichtbares Feuern auf. Bis fünf Salven
bekommt jeder Schuss seinen eigenen Auftritt, darüber wird gebündelt.

Die **Zielzeit steht zuerst fest** (`mindestens` + `jeSalve` je Salve, gedeckelt
durch `hoechstens`), und dann wird sie mit so vielen Sichtschüssen gefüllt, wie
im straffen Takt der Stufe hineinpassen. Diese Richtung ist wichtig: der erste
Entwurf hielt die Bündelgröße fest und leitete den Takt aus der Zeit ab — und
lief damit genau falsch, nämlich 27 Salven als sieben Schüsse mit 0,19 s Pause,
also **langsamer** als fünf Einzelschüsse. Mehr Salven müssen dichter feuern.

| Salven | Sichtschüsse | je | Dauer |
|---|---|---|---|
| 3 | 3 | 1 | 0,32 s |
| 10 | 10 | 1 | 0,83 s |
| 27 | 20 | 2 | 1,31 s |
| 80 | 40 | 2 | 2,20 s |
| **2 000** | 44 | 46 | **2,20 s** |

Ab fünf Salven läuft ein **Salvenzähler** über der Bühne mit (`0 / 27 Salven`).
Darunter wäre er eine Anzeige für etwas, das man ohnehin zählen kann.

Die Schwellen stehen in `SALVEN_TAKT`. Die Spielrechnung bleibt unberührt —
zweitausend Salven sind zweitausend Salven, nur die Vorstellung wird verdichtet.

---

## 6. Wappen

Fünf Plätze. Wappen brechen Regeln, statt Zahlen zu heben.

| Wappen | Wirkung | gemessener Wert |
|---|---|---|
| Löwe | der mittlere Turm zählt seinen Rang **dreifach** | ×1,31 (bis ×2,71) |
| Drache | jeder Nachschuss zählt **doppelt** | ×1,08 (bis ×1,55) |
| Doppeladler | Turm 1 und Turm 5 gelten als **benachbart** (die Reihe wird zum Ring) | ×1,03 (bis ×1,72) |
| Wolf | je leerem Turm **+60 %** Gesamtwucht | ×1,00 voll, **×3,06** mit leeren Türmen |
| Eber | eine **ersetzte** Einheit feuert ein letztes Mal | wirkt außerhalb der Salve |
| Schlange | die ersten **zwei** Kartentausche jeder Runde kosten nichts | reine Handarbeit |

Die Spalte rechts kommt aus `scripts/wappen.mjs`: 2000 zufällige Aufstellungen
aus hohen Rängen, jeweils mit und ohne das Wappen gerechnet. Drei der sechs
fassen die Wucht der Salve gar nicht an — Wolf ist ein eigener Bauplan (leere
Türme), Eber schießt außerhalb der Abrechnung, Schlange ist Handarbeit. Wer
einen vierten Multiplikator sucht, findet hier keinen.

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
| Schützenturm | Bogenschützen +40 % |
| Ballistenturm | Armbrustschützen +40 % |
| Geschützturm | Artillerie +40 % |
| Pulverturm | Kanoniere +40 % |

Fünf Türme stehen fest auf dem Riegel, gleichmäßig verteilt und
spiegelsymmetrisch zur Mittelachse (Zeilen 1, 5, 9, 13, 17 eines 20 Zeilen
tiefen Feldes). Sie werden nicht mehr gesucht, sondern stehen, wo der
Baumeister sie hingestellt hat — die Anlage ist bei jedem Lauf dieselbe.

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

## 7a. Die 52 Einheiten

Jede Einheit hat ein **Profil**, das aus Gattung und Rang folgt — nicht 52
Zeichnungen, sondern zwei Achsen:

**Die Gattung bestimmt die Sprache des Schusses.**

| Gattung | Wie sie feuert |
|---|---|
| Bogenschützen | spannen sichtbar, hoher Bogen, leichter Einschlag |
| Armbrustschützen | mechanisch, flacher schneller Bolzen, harter Treffer |
| Artillerie | hoher langsamer Steinwurf, schwerer Aufschlag, starkes Beben |
| Kanoniere | Mündungsfeuer, kräftiger Rückstoß, Kugel mit Rauchfahne, Detonation |

**Der Rang bestimmt die Stufe** — Figur, Maßstab, Staub, Beben, Blitz:

| Ränge | Stufe | Maßstab |
|---|---|---|
| 1–3 | Aufgebot | 3,0 |
| 4–6 | Besatzung | 3,4 |
| 7–9 | Veteranen | 3,8 |
| 10–12 | Elite | 4,2 |
| 13 | Meister | 4,7 (und eine zweite Fahne) |

Auf den Türmen steht die **Einheit**, nicht die Karte. Die Karte bleibt die
Karte — sie liegt im Deck, nicht auf der Mauer.

### Das Bildergesetz der Besatzung

Fünf Regeln, aus denen alles Übrige folgt. Sie stehen hier, weil jede von ihnen
einmal *gefehlt* hat und das Ergebnis jedes Mal dasselbe war: eine Burg, die
beschriftet aussah statt bemannt.

**1. Die Figur zeigt den Rang, die Farbe zeigt die Gattung.** Nur der
Waffenrock wird eingefärbt (`b/B`, `r/R`, `n/N` in der Palette); Haut, Stahl,
Holz und Gold bleiben, wie sie sind — sonst verliert die Figur ihre Plastik und
wird zum Scherenschnitt. Vorher trug ein Bogenschütze Rang 1 dasselbe Blau wie
ein Armbruster Rang 5.

**2. Drei Mann, eine Einheit.** Sie stehen eng genug, dass sie sich
überschneiden. Drei überschneidende Silhouetten lesen sich als *eine* Einheit —
genau das sollen sie sein. (`BATALLION_ABSTAND`, Faktor 3,1.)

**3. Wer steht, hat einen Schatten und steht hinter der Brüstung.** Der Schatten
hängt am Boden, nicht an der Figur: beim Atmen und beim Einzug bleibt er liegen,
und genau daran sieht man, dass die Figur sich bewegt und der Turm nicht. Alles
unterhalb der Kronenkante wird weggeschnitten.

**4. Wer steht, atmet.** Ein Pixel auf und ab, je Mann und Turm anders gestimmt,
damit die drei nicht im Gleichschritt wippen.

**5. Wer feuert, wird zurückgeworfen.** Die Besatzung bekommt ihren eigenen
Stoß, dem Rücklauf des Geräts nach — nicht nur der Turm sackt ab.

Der **Einzug**: eine Einheit erscheint nicht, sie *bezieht eine Stellung*. Von
oben herunter, Flanken zuerst, Mitte zuletzt, dann staubt die Krone. Leichte
Einheiten sind in 0,37 s oben, schwere brauchen 0,61 — man sieht am Tempo, was
aufzieht. Das Rangschild kommt erst, wenn die Besatzung steht.

### Blitz, Rauch und Staub verblassen verschieden

| Art | Deckung über die Zeit | wozu |
|---|---|---|
| Blitz | `1 − f³` | bleibt hell und geht dann aus |
| Rauch | `√(1 − f)` | hält seine Deckung lange und steigt |
| Staub | `1 − f` | verblasst gleichmäßig und fällt |

Das Mündungsfeuer sitzt **vor** der Besatzung auf Rohrhöhe, nicht in der Mitte
der Kachel — dort war es im Bild ein heller Fleck auf der Brust des Kanoniers.
Der Pulverrauch ist **hell**; die dunkle Wolke, die zuerst dort stand, war vor
der Mauer schlicht unsichtbar. Bei dichtem Feuer qualmt nur jeder dritte
Schuss: eine Wolke, die steht, sagt mehr als vierzig, die sich überlagern.

---

## 8a. Die Oberfläche

Eine Regel trägt alles: **die Knoten bleiben**. Ein Kartenelement entsteht genau
einmal — beim Ziehen — und wird danach nur noch bewegt, nie neu gebaut. Ohne das
ist jede Animation unmöglich, weil das animierte Element im nächsten Bild ein
anderes wäre. Umsortiert wird über FLIP: vorher messen, umhängen, nachher
messen, die Differenz als Transform setzen und auf null laufen lassen.

Bewegt wird ausschließlich über `transform` und `opacity` — beides läuft im
Compositor und löst kein Neu-Layout aus.

**Die Rückmeldungsschicht** (`pkSpiel*`, `pkRuf*`) *spielt* Ereignisse, sie
entscheidet keines. Der Kern hat schon gerechnet, wenn eine dieser Funktionen
läuft; fällt eine ganz aus — bei `prefers-reduced-motion` etwa — bleibt der
Spielstand exakt derselbe.

| Was | Wie es sich meldet |
|---|---|
| Karte gewählt | hebt sich, kippt leicht, goldener Rahmen, Haken |
| Karte über einem Turm | Tafel und Turm im Bild glühen, Vorschau rechnet mit |
| Formation **neu** | grüne Marke mit `+`, Lichtband über die beteiligten Türme |
| Formation **bricht** | durchgestrichene Marke mit `−` |
| Einheit gesetzt | Karte fliegt zum Turm, Schild federt ein, Turm zuckt |
| Salve | Türme feuern versetzt, dann Treffer, dann die Kette |
| Wappen zündet | das Schild pulst und leuchtet auf |
| Schaden | Zahl wächst mit dem **Anteil** der gegnerischen Stärke |
| Salve läuft | Zähler über der Bühne, `n / N Salven` |

**Die Wappenleiste** steht dauerhaft oben rechts: fünf Schilde, auch die leeren.
Jedes Wappen trägt sein eigenes Bild und seine eigene Tinktur — vorher trugen
alle sechs dasselbe ⚜, man sah also, *dass* man Wappen hat, nie *welche*.

**Die Formationsleiste** trägt je Familie ein Zeichen (⚑ Gattung, ⚔ Rang,
➤ Rangfolge, ⛨ Grundstellung, ♛ Garde) und die Stufe als Striche. Wer eine
Marke überfährt, sieht genau die Stellungen aufleuchten, die diese Formation
tragen — das beantwortet die Frage, die man beim Planen wirklich hat: nicht
*was gilt*, sondern *welche meiner fünf Türme hängen daran*.

Beides benutzt dieselbe **Hinweisschicht** (`pkHefteHinweis`). Sie ersetzt den
`title` des Betriebssystems, der erst nach einer Sekunde erscheint, nicht
gestaltet werden kann und abbricht, sobald die Maus zuckt.

Gemessen bei voll besetzter Burg mit fünf Wappen: Zeichnen 4,5 ms je Bild,
Auffrischen 1,7 ms, Rechnen 0,04 ms, 184 DOM-Knoten.

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

**300 Läufe** mit dem Bot, der in jeder Runde die Setzung nimmt, die die Salve
am stärksten hebt — also ein Spieler, der die Vorschau liest und sonst nichts
weiter denkt:

| Station | Art | gespielt | gewonnen |
|---|---|---|---|
| 1 | Kampf | 300 | 100 % |
| 2 | Kampf | 300 | 99 % |
| 5 | Kampf | 297 | 94 % |
| 6 | Sturmtrupp | 280 | 80 % |
| 8 | Kampf | 223 | 88 % |
| 10 | Sturmtrupp | 197 | 77 % |
| 11 | Belagerungsmeister | 151 | **66 %** |

**Akt geschafft: 33 %.** Die Mitte liegt bei Station 11 — die meisten Läufe
sterben am Boss oder kurz davor, und der Boss ist mit Abstand die schwerste
Hürde. Das ist die Form, die ein Akt haben soll.

### Warum hier 300 Läufe stehen und nicht 40

Weil vierzig zu wenig sind, um irgendetwas zu behaupten. Zwei Durchgänge
derselben, unveränderten Fassung ergaben **40 %** und **18 %** Aktabschluss.
Die früher hier stehenden 21 % waren eine solche Stichprobe.

Deshalb wurde die Königliche Garde auch gegen ihre eigene Vorversion gemessen,
beide Male mit 300 Läufen: **31 % ohne sie, 33 % mit ihr.** Das ist der
erwartete Befund — Neun bis König in einer Gattung auf fünf Stellungen in fünf
Runden ist so selten, dass sie in der Breite kaum vorkommt. Sie ist ein Gipfel,
den man anstrebt, kein Hebel, der die Kurve verschiebt.

### Die Kurve ist flach — und warum

Wucht über fünf Runden, nach Kampfnummer (Mitte von 25 Läufen):

```
Kampf     1       2       3       4       5       6       7
Wucht   3.822   3.510   3.150   3.230   3.522   3.180   3.374
```

Sie steigt nicht. **Das ist die Folge des vollen Blatts**, und es ist eine
Rechnung, keine Meinung:

1. **Die Rangachse ist ab Kampf 1 fast ausgereizt.** Ein 52-Karten-Deck hat
   Rangschnitt 7; die besten fünf einer Hand von sieben liegen um 9. Die
   Obergrenze ist 13. Über den ganzen Akt bringt Verschmälern den Schnitt von
   8,5 auf 10,4 — Faktor 1,2, nicht Faktor 10.
2. **Die Formationen feuern von Anfang an fast voll.** Das Vielfache liegt im
   ersten Kampf bei 17 und bleibt dort, weil ein volles Blatt jede Formation
   erreichen kann. Es gibt nichts mehr freizuschalten.
3. **Alles, was nur EINEN Turm vervielfacht, verdünnt sich auf ein Fünftel.**
   Der Turmtyp gibt +40 %, auf die Gesamtwucht also +8 % — und die
   Formationen, die ganze Gruppen verdoppeln, schlagen ihn. Gemessen: ein Bot,
   der konsequent ausbaute und am Ende 4,5 spezialisierte Türme hatte, kam auf
   **6 % mehr Wucht** als einer, der nie ausbaute.
4. **Von sechs Wappen fasst nur eines die Wucht spürbar an** (Löwe ×1,31,
   siehe Abschnitt 6).

Der Spannungsbogen liegt deshalb allein in der Gegnertabelle: sie steigt von
gut vierzig Prozent der mittleren Wucht bis knapp darüber beim
Belagerungsmeister. Die Spannung kommt aus der Streuung der Hand und aus den
Entscheidungen, nicht aus wachsender Macht.

**Wer die Zahlen wachsen lassen will**, muss an `gesamt`-Faktoren ansetzen —
alles andere verdünnt sich. Konkret: ein Ausbau, der die ganze Burg
vervielfacht statt einen Turm; Wappen mit `gesamtFaktor`, die sich gegenseitig
verstärken; oder Formationen, die ein volles Blatt gerade **nicht** trifft,
sondern erst ein verschmälertes.

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
