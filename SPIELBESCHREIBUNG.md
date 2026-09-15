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

- Ein Feldzug führt über **drei Anten** — drei Heere, die anrücken. Jede Ante
  hat mindestens zwei und höchstens fünf Schlachten, und **wie viele es sind,
  entscheidet der Spieler**.
- In jeder Schlacht steht dieselbe Burg mit **genau fünf Türmen**.
- Auf jedem Turm steht **genau eine Einheit**.
- Welche Einheiten zusammen stehen, ergibt **Formationen**; Formationen geben
  Salven, und jede Salve ist ein Schuss, den man sieht.
- Daneben hängen **fünf Wappen in einer Reihe**, und die Reihenfolge ist eine
  Regel: ein Ereignis läuft von links nach rechts durch sie hindurch.
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

## 6. Wappen — das Fließband

Fünf Plätze, und **die Reihenfolge ist die Regel**.

Ein Ereignis läuft strikt von links nach rechts durch die fünf Plätze. Jeder
Platz sieht die Lage so, wie der Platz vor ihm sie hinterlassen hat.

```
  Platz 1  ──►  Platz 2  ──►  Platz 3  ──►  Platz 4  ──►  Platz 5
   +10           ×3            …             …             …
```

`(s+10)×3` ist nicht `s×3+10`. Der Spieler baut also keine Sammlung, sondern
eine **Maschine**, und die Anordnung ist ihre Konstruktion. Die Schilde lassen
sich am Gestell ziehen; im Kampf kostet das einen Tatendrang, davor nichts.

### Fünfzig Wappen

| Seltenheit | Anzahl | Wofür sie da sind |
|---|---|---|
| gewöhnlich | 24 | **Quellen**: Pulver, Veteranenmarken, Verwüstung, Befehle |
| ungewöhnlich | 15 | sie lesen einander und die Vorräte |
| selten | 8 | sie arbeiten auf der Maschine: verstärken, kopieren, nachzünden, abriegeln |
| legendär | 3 | sie ändern den Durchlauf selbst |

Angebote sind nach Seltenheit gewichtet und haben eine Schlacht, ab der sie
überhaupt erscheinen — ein legendäres Wappen verstärkt nur, was schon da ist,
und taugt in der ersten Schlacht nichts.

### Die Vorräte

Es gibt sie **nur, weil ein Wappen sie schafft**. Kein Hammer, kein Pulver;
ohne Pulver ist das Pulverhorn ein leeres Feld. Die Leiste neben dem Gestell
zeigt nur, was wirklich da ist.

| Vorrat | bleibt | woher |
|---|---|---|
| Pulver ✸ | für den Kampf | Hammer (je Einheit), Mühlrad (je Tausch), Hetzhund (je Treffer) |
| Veteranenmarke ✠ | den ganzen Feldzug | Hirsch (je Runde), Kriegskasse (je Formation), Pflugschar (je Sieg) |
| Verwüstung ☄ | den ganzen Feldzug | Brandschatzung (was über die Stärke des Gegners hinausging) |
| Befehl ⚑ | für den Kampf | Kriegshorn, Glocke |

### Was ein Wappen anfassen darf

Nichts direkt. Es ruft eine **Wirkung**, und die schreibt ihre Änderung ins
Protokoll. Das kostet eine Zeile mehr und kauft zwei Dinge:

1. Das Kampfprotokoll ist vollständig — jede Zahl, die sich bewegt hat, steht
   mit ihrem Urheber da.
2. **Verstärken und Kopieren gehen ohne Wissen.** Der Drache muss nicht
   kennen, was sein linker Nachbar getan hat; er liest dessen aufgezeichnete
   Wirkungen und wendet sie noch einmal an. Ein Wappen, das es morgen gibt,
   ist heute schon verstärkbar.

Additiv und multiplikativ sind streng getrennt: verdoppelt man `+3`, wird
daraus `+6`; verdoppelt man `×1,5`, wird daraus `×2,25` und nicht `×3`.

### Warum es nicht durchdreht

Ein Spieler wird zwei Wappen zusammenstecken, die einander zünden. Das ist
kein Fehler, das ist die Bauform. Sie muss enden, ohne dass irgendwo ein
Wappenname steht:

* **Tiefe** — wie tief Wappen einander noch zünden dürfen (6)
* **je Platz** — wie oft ein Platz in *einem* Ereignis zündet (12)
* **je Ereignis** — wie viele Zündungen ein Ereignis insgesamt hat (60)
* **Kreis** — ein Wappen zündet nicht in einem Ereignis, das es selbst
  ausgelöst hat

Jede abgewiesene Zündung bleibt mit ihrem Grund im Kampfprotokoll stehen.

### Wie weit es trägt

Gemessen (`npm run probe`), gegen einen Prüfstein über fünf Runden:

```
leeres Gestell                                          7.480
Eisenring → Fackel → Basilisk → Greif → Ouroboros    6,9 Mrd
```

Sechs Zehnerpotenzen zwischen einer nackten Burg und einer Maschine, die ein
Spieler über einen ganzen Feldzug baut. Dieselbe Maschine umgedreht bringt
ungefähr die Hälfte.

`npm run matrix` misst alle 2450 geordneten Paare und meldet tote Wappen,
Quellen ohne Abnehmer und Sprengsätze. Derzeit ändern **37 %** der wirksamen
Paare ihr Ergebnis, wenn man sie vertauscht.

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

## 8. Der Feldzug — die Welt kommt zur Burg

Eine Burg läuft nicht, sie **steht**. Es gibt keine Karte, die man abläuft;
es gibt Heere, die anrücken.

Eine **Ante** ist ein Heer, in drei Wellen:

```
  VORHUT          stellen  ──► −1 Bedrohung
                  oder ziehen lassen ──► +1 Bedrohung, +2 Vorbereitung

  DIVISIONEN ×3   stellen  ──► ihr Merkmal fällt beim Heerführer weg
                  oder durchlassen   ──► +1 Bedrohung, +1 Vorbereitung,
                                         und der Heerführer bekommt es

  HEERFÜHRER      Grundregel + jede durchgelassene Division + Bedrohung
```

Der Boss wird also **gebaut, nicht gewürfelt** — vom Spieler. Er ist vom ersten
Augenblick an sichtbar, mit Stärke und mit jeder Regel, die er gerade trägt.

### Zwei Währungen, dieselbe Münze

**Bedrohung** (0–5) steigt, wenn man etwas durchlässt; sie macht den
Heerführer nicht nur stärker, sondern **anders**. **Vorbereitung** steigt
genauso und ist das, was man im Heerlager ausgibt. Man kauft also das eine
mit dem anderen, und beides steht auf dem Tisch, bevor man wählt.

### Das Kampfbudget

**Mindestens zwei, höchstens fünf** Schlachten je Ante. Nicht ungefähr,
sondern geprüft — an allen sechzehn Wegen durch die Ante. Die Obergrenze ergibt
sich aus dem Aufbau (1 + 3 + 1), die Untergrenze wird gerechnet: wer bei null
Schlachten vor der letzten Division steht, muss sie stellen.

### Die Bossregeln

Ein Boss mit mehr Trefferpunkten ist kein Gegner, sondern eine längere
Wartezeit. Diese Regeln zielen auf die **Maschine**:

| Regel | Was sie angreift | gemessen |
|---|---|---|
| Der Usurpator | vertauscht jede Runde Wappenplatz 2 und 4 | −30 % |
| Der Inquisitor | versiegelt das Wappen, das am häufigsten zündet | −32 % |
| Der Belagerungsmeister | nimmt die stärkste Stellung aus der Salve (höchstens die halbe Salve) | −24 % |
| Die Weiße Königin | verhüllt je Runde eine andere Gattung | −32 % |
| Der Rote König | über zwölf Salven zählt jede weitere nur halb | −35 % |

Technisch sind sie **Wappen ohne Gestell**: dasselbe Fließband, dasselbe
Protokoll — nur laufen sie *hinter* den fünf Plätzen des Spielers. Ein Siegel
des Spielers hält sie nicht auf; sonst wäre ein einziges Wappen die Antwort auf
jeden Heerführer. Die Antwort liegt in derselben Währung wie der Angriff:
Umhängen kostet einen Tatendrang.

### Das Heerlager

Nach jeder gewonnenen Schlacht. Vier Dienste — **Händler**, **Herold**
(Wappen), **Feldschmiede** (Türme), **Kriegsrat** (Formationsstufen) —, aber
nie alle vier: bei jedem Halt stehen zwei da, in fester Folge. Wären immer
alle da, hieße jeder Halt „nimm das Beste"; so heißt er „damit musst du
auskommen". Bezahlt wird mit Vorbereitung, beim Händler mit Sold.

### Sold und Belohnung

Sold für jeden Sieg (Vorhut 25 / Division 45 / Heerführer 120) plus 8 je Runde,
die man nicht gebraucht hat. Nach jedem Sieg drei Angebote, eines wird
genommen. Bei einem Wappenangebot steht dabei, was es **an deinem Gestell**
bringt — gemessen, nicht behauptet: der Kern spielt dafür dreißig kurze Kämpfe
durch (rund 30 ms) und schreibt das Ergebnis auf die Karte.

### Speichern

Der Stand geht nach jedem Abschnitt in den Speicher des Browsers; beim Start
wird gefragt. **Die Reihenfolge der Wappen ist Teil des Spielstands** — sie ist
der Bauplan der Maschine.

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

**Der Rang bestimmt die Stufe** — Ausrüstung, Staub, Beben, Blitz:

| Ränge | Stufe | Wirkung (`fx`) |
|---|---|---|
| 1–3 | Aufgebot | 0,55 |
| 4–6 | Besatzung | 0,75 |
| 7–9 | Veteranen | 1,0 |
| 10–12 | Elite | 1,3 |
| 13 | Meister | 1,75 (und eine zweite, goldene Fahne) |

**Die Figur wächst nicht mit dem Rang.** Alle Besatzungen stehen im selben
Maßstab (`BESATZUNG_MASS`, 3,2). Vorher wuchsen sie von 3,0 auf 4,7 — das
klingt richtig und ist es nicht, denn die Turmkrone wächst nicht mit. Ein
Meisterbataillon stand über seine Krone hinaus, und weil die Flanken
zusätzlich am Maßstab hingen (siehe unten), schwebten sie umso höher, je höher
der Rang war. Der Fortschritt war also genau dort am schlechtesten zu sehen,
wo er am größten sein soll.

Ablesbar bleibt der Rang an drei Stellen, die nichts mit Größe zu tun haben:
am **Schild über dem Kopf**, an der **Ausrüstung** (die Figur wechselt mit der
Stufe) und beim Meister an der **zweiten Fahne**.

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

**2. Drei Mann, eine Einheit — und sie stehen auf der Krone, nicht daneben.**
Die drei Standorte sind **Kachelkoordinaten auf der Turmkrone**
(`BATALLION_ORTE`), und wo ihre Füße aufsetzen, rechnet dieselbe Projektion
aus, die auch den Turm malt. Vorher bekam die Funktion einen Bildpunkt und hob
die beiden Flanken um `Maßstab × 1,5` an — keine Projektion, sondern eine
Faustregel, und sie hing am falschen Wert: nicht am Ort, sondern an der Größe.
Sie stehen eng genug, dass sie sich überschneiden; drei überschneidende
Silhouetten lesen sich als *eine* Einheit, und genau das sollen sie sein.

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

**Die Formationsleiste** trägt je Familie ein Zeichen (⚑ Gattung, ‖ Rang,
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

Geschrieben wird in `quelle/` — **neunzehn Module**. Geliefert wird
`index.html`, eine einzige Datei ohne Build-Schritt und ohne Abhängigkeiten.
Beides hält `scripts/baue.mjs` zusammen; wer `index.html` von Hand ändert,
bekommt es gesagt.

```
quelle/kern.js          das Dach: was der Kern nach aussen zeigt
quelle/kern/*.js        die Regeln des Kampfes
quelle/wappen/*.js      das Wappen-Fließband
quelle/feldzug/*.js     die Welt, die zur Burg kommt
```

| Modul | Inhalt |
|---|---|
| `kern/regeln.js` | `KERN` — alles, was Balance des Kampfes ist |
| `kern/einheiten.js` | Gattungen, Ränge, das Blatt aus 52 Karten |
| `kern/tuerme.js`, `kern/feinde.js` | Turmtypen, Gegnervorlagen |
| `wappen/ereignisse.js` | 16 Ereignisnamen, die Vorratsarten |
| `wappen/fliessband.js` | der Durchlauf von links nach rechts, die Sperren, das Protokoll |
| `wappen/wirkungen.js` | was ein Wappen ändern darf — und nur das |
| `wappen/vorrat.js` | Pulver, Veteranenmarken, Verwüstung, Befehle |
| `wappen/sammlung.js` | die fünfzig Wappen, als Daten |
| `kern/formationen.js`, `kern/wucht.js` | Muster erkennen, Salve rechnen |
| `kern/kampf.js` | fünf Runden, Tatendrang, Treffer |
| `feldzug/bossregeln.js` | die fünf Regeln, die auf die Maschine zielen |
| `feldzug/gegner.js` | Vorhuten, Divisionen, Heerführer, Anten |
| `feldzug/belagerung.js` | der Ablauf, das Kampfbudget |
| `feldzug/heerlager.js` | die vier Dienste |
| `feldzug/speicher.js` | Speichern und Laden |
| `kern/lauf.js` | Deck, Wappen, Türme, Sold — was über die Anten hinaus bleibt |

Der Kern hat **keine Verbindung zur Anzeige**. Er kennt kein Dokument, keinen
Zeichenkontext und keine Browser-Ereignisse — er rechnet nur. Das ist der Grund,
warum `scripts/pruefe-kern.mjs` ohne Browser laufen kann.

Die Oberfläche (rund 9.500 Zeilen, `pk*`) steht weiterhin direkt in
`index.html`.

### Ein Ereignisbus, nicht zwei

Der alte Signalbus ist ersatzlos entfallen. Er hatte am Ende genau einen
Nutzer — die Wappen —, und die laufen jetzt über das Fließband. Die Oberfläche
hörte auf kein einziges Signal; sie liest den Zustand direkt.

---

## 10. Werkzeuge

| Befehl | Was er tut |
|---|---|
| `npm test` | bauen, Typen prüfen, alle drei Prüfsuiten |
| `npm run kern` | 55 Prüfungen, **ohne Browser** |
| `npm run feldzug` | 41 Prüfungen zum Feldzug, ohne Browser |
| `node scripts/pruefe.mjs` | 80 Prüfungen im echten Browser gegen `window.PARAPEX` |
| `npm run matrix` | die Synergie-Matrix: 2450 geordnete Wappenpaare |
| `npm run probe` | das Probespiel: acht Fragen, gemessen |
| `npm run bot [n]` | n Feldzüge durchspielen, Gewinnquote je Schlacht |
| `npm run kurve [n]` | wie viel Wucht ein Deck in der n-ten Schlacht bringt |
| `npm run lauftest` | ein ganzer Feldzug **über die Oberfläche**, mit Klicks |

Im Spiel: **Strg+D** öffnet das Werkzeug (Ante, Bedrohung, Vorbereitung,
Heerführer, Wuchtkette, Eingriffe, Kampfprotokoll). In der Konsole:
`PX.station(9)` springt an die neunte Schlacht mit passendem Deck,
`PX.heerfuehrer(false)` winkt eine Ante bis zum Endkampf durch,
`PX.probe(['bogen-9', ...])` wiegt eine Aufstellung, ohne sie zu spielen.

---

## 11. Gemessene Balance

**80 Läufe** mit dem Bot, der in jeder Runde die Setzung nimmt, die die Salve
am stärksten hebt — also ein Spieler, der die Vorschau liest und sonst nichts
weiter denkt. Er stellt jedes Mal jeden Gegner, hält die Bedrohung damit klein
und bekommt den saubersten Heerführer:

| Ante | Vorhut | Division 1 | Division 2 | Division 3 | Heerführer |
|---|---|---|---|---|---|
| 1 | 80/80 | 78/80 | 78/78 | 78/78 | **65/78** |
| 2 | 65/65 | 59/65 | 59/59 | 59/59 | **51/59** |
| 3 | 51/51 | 51/51 | 51/51 | 51/51 | **46/51** |

**Feldzug geschafft: 58 %.** Der Heerführer ist der Filter — 80 → 65 → 51 → 46.
Genau das soll er sein.

Wer stattdessen Vorbereitung sammelt, steht vor einem anderen Gegner: drei
durchgelassene Divisionen heißen drei zusätzliche Bossregeln und vierzehn
Prozent mehr Stärke je Bedrohungsstufe.

### Warum hier 80 Läufe stehen und nicht 40

Weil vierzig zu wenig sind, um irgendetwas zu behaupten. Zwei Durchgänge
derselben, unveränderten Fassung ergaben einmal **40 %** und einmal **18 %**
Abschluss. Jede Zahl in diesem Abschnitt trägt deshalb ihre Stichprobengröße.

### Die Kurve war flach — und was daraus wurde

Vor dem Wappen-Fließband stieg die Wucht über einen Akt nicht:

```
Kampf     1       2       3       4       5       6       7
Wucht   3.822   3.510   3.150   3.230   3.522   3.180   3.374
```

Der Grund war eine Rechnung, keine Meinung:

1. **Die Rangachse ist ab Kampf 1 fast ausgereizt.** Ein 52-Karten-Deck hat
   Rangschnitt 7; die besten fünf einer Hand von sieben liegen um 9. Die
   Obergrenze ist 13. Über einen ganzen Akt bringt Verschmälern den Schnitt von
   8,5 auf 10,4 — Faktor 1,2, nicht Faktor 10.
2. **Die Formationen feuern von Anfang an fast voll.** Ein volles Blatt kann
   jede Formation erreichen; es gibt nichts mehr freizuschalten.
3. **Alles, was nur EINEN Turm vervielfacht, verdünnt sich auf ein Fünftel.**
   Der Turmtyp gibt +40 %, auf die Gesamtwucht also +8 %. Gemessen: ein Bot,
   der konsequent ausbaute und am Ende 4,5 spezialisierte Türme hatte, kam auf
   **6 % mehr Wucht** als einer, der nie ausbaute.
4. **Von sechs Wappen fasste nur eines die Wucht spürbar an.**

Damals stand hier der Satz: *„Wer die Zahlen wachsen lassen will, muss an
Gesamtfaktoren ansetzen — Wappen, die sich gegenseitig verstärken."*

Genau das ist das Fließband. Gemessen (`npm run probe`), über fünf Runden gegen
einen Prüfstein:

```
leeres Gestell                                          7.480
Eisenring → Fackel → Basilisk → Greif → Ouroboros    6,9 Mrd
```

Die vierte Achse trägt jetzt, und sie trägt weiter als alle drei anderen
zusammen. Deck, Türme und Formationen bleiben trotzdem nötig: das Fließband
vervielfacht, was sie liefern, und multipliziert mit null bleibt null.

### Was die Bossregeln kosten

Gemessen an einer Maschine aus fünf Wappen, ganzer Kampf über fünf Runden:

```
Der Usurpator          −30 %      Die Weiße Königin      −32 %
Der Inquisitor         −32 %      Der Rote König         −35 %
Der Belagerungsmeister −24 %
```

### Eine Regel darf wehtun, aber keine Sackgasse bauen

Der Belagerungsmeister nahm anfangs *„die Wucht der stärksten Stellung"*. Bei
einer besetzten Stellung ist das alles — und damit war die erste gesetzte
Einheit wertlos. Ein Spieler, der rechnet, setzt dann gar nichts und verliert
mit fünf leeren Türmen. Gemessen: **80 von 80 Läufen, null Schaden.**

Der Abzug ist seitdem auf die halbe Salve gedeckelt. Bei fünf besetzten
Stellungen greift die Deckelung gar nicht; sie greift nur in dem Zustand, den
es nicht geben darf.

Drei Prüfungen halten das fest — für jede Bossregel, auch für die, die es noch
nicht gibt.

### Wenn die Sperren greifen, aber das Spiel nicht

Eine gierige Suche über alle fünfzig Wappen fand eine Reihe aus **drei**
Wappen, die 10^15 Schaden machte — gegen einen Heerführer mit viertausend. Die
Sperren hatten das im Griff: endlich, zwei Millisekunden. Das Spiel hatte es
nicht im Griff.

Der Grund: der Ouroboros ließ die Reihe noch einmal laufen — und lief darin
selbst wieder mit. Der Kreisschutz gilt jetzt für jede Zündungsart: ein Wappen
zündet nicht in einem Ereignis, das es selbst ausgelöst hat.

---

## 12. Was es nicht gibt

Absichtlich nicht, damit niemand danach sucht:

- keine Verteidigung, kein Block, keine Zinnen als Vorrat
- kein Gegnerzug, keine Wegsuche, keine Reichweite
- kein Zielen, kein Klick aufs Spielfeld — das Bild ist Kulisse
- keine Befehlskarten, keine Karten außer Einheiten
- kein freies Abwerfen
- **keine Karte, die man abläuft.** Die Burg steht; die Heere kommen zu ihr.
- keine zufällig gewürfelten Bosse — der Heerführer wird gebaut, und zwar vom
  Spieler
- bisher **ein ausgeschriebenes Heer**: Anten zwei und drei rücken mit
  demselben an, nur schwerer. Der Platz für die nächsten steht in
  `quelle/feldzug/gegner.js`.

Der gesamte alte Kampf (Castle Master) ist entfernt. Sein Stand liegt auf dem
Zweig `stand/castle-master` und im Repository `dernano/CastleMaster`.
