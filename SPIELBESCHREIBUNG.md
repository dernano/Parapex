# Castle Master — vollständige Spielbeschreibung

Stand: Version 68 des veröffentlichten Artifacts; erster Stand im Repository
`dernano/Parapex`, das `dernano/CastleMaster` mit vollständiger Geschichte
fortsetzt.

Dieses Dokument beschreibt den **Ist-Zustand** des Spiels so, dass ein Modell
ohne Zugriff auf den Quelltext daran weiterarbeiten oder darüber urteilen kann.
Es beschreibt keine Pläne. Wo Zahlen stehen, stammen sie aus dem Code, nicht aus
der Erinnerung; wo Messwerte stehen, stammen sie aus Bot-Läufen (siehe
Abschnitt 14).

Das ausführliche Entwicklungstagebuch mit den Begründungen hinter fast jeder
Entscheidung steht in `README.md` (rund 2300 Zeilen, deutsch). Dieses Dokument
ist die Kurzfassung der Regeln und der Technik.

---

## 1. Was es ist

Ein **rundenbasiertes Deckbuilding-Burgverteidigungsspiel** im Browser, im
Aufbau an Slay the Spire angelehnt, thematisch eine Grenzburg im Spätmittelalter.

- Eine Partie („Feldzug") führt über **11 Stationen** auf einer verzweigten
  Route zum Endgegner.
- An jeder Kampfstation verteidigst du **dieselbe Burg**, an der du den ganzen
  Feldzug baust, gegen ein Aufgebot von Belagerern.
- Gespielt wird mit einem Deck aus Karten, das über den Feldzug wächst.
- Darstellung: isometrische Pixelgrafik, **vollständig im Code gezeichnet**
  (Canvas 2D), keine Bilddateien außer drei Kartenblättern.
- Sprache der Oberfläche und des Quelltextes: **Deutsch** (auch Bezeichner,
  Kommentare, Commit-Nachrichten).

**Das Ganze ist eine einzige Datei**: `index.html`, rund 680 KB, kein
Build-Schritt, keine Abhängigkeiten zur Laufzeit. Sie wird direkt im Browser
geöffnet oder als Artifact veröffentlicht; die veröffentlichte Seite darf nichts
von außen nachladen, deshalb sind auch Bilder als Datenadressen eingebettet.

---

## 2. Technischer Rahmen

| | |
| --- | --- |
| Datei | `index.html` (HTML + CSS + JS in einem Stück) |
| Zeichnung | ein `<canvas id="field">`, 2D-Kontext, alles selbst gemalt |
| Oberfläche | HTML/CSS über dem Canvas (Kopfzeile, Hand, Tafeln) |
| Zustand | ein globales Objekt `state` |
| Speicher | `localStorage` für Einstellungen, Bestwert, eigene Figuren |
| Musik | `musik/soundtrack.mp3`, als Beiwerk-Datei veröffentlicht |
| Ton | Web Audio, synthetisiert, keine Samples |
| Weiteres | `README.md` (Tagebuch), `scripts/kartenbilder.mjs` (Werkzeug), `bilder/` (drei Kartenvorlagen + Zuschnitt) |

Die Schleife ist ein `requestAnimationFrame`-Takt: `tick(dt)` bewegt Animationen,
`zeichne()` malt das Feld, `renderAll()` baut die HTML-Oberfläche neu auf.
Spielregeln laufen synchron im Zustand; Animationen sind reiner Schmuck und
dürfen den Zustand nie verändern (`spaeter(sek, fn)` führt Schmuck verzögert
aus und bei eingestellter „wenig Bewegung" sofort).

---

## 3. Das Spielfeld

- Raster **20 Spalten × 19 Zeilen** (`COLS`, `ROWS`), isometrisch projiziert
  (`TW = 44`, `TH = 22` Punkte je Raute).
- Links (Spalte 0) steht die **Burg** (`CASTLE`): 2 × 5 Felder, **50
  Lebenspunkte**, heilt nicht von selbst.
- Rechts neben dem Feld liegt das **Lager der Belagerer** (`LAGER_COL = COLS`):
  dort warten Gegner unangreifbar, bis sie aufs Feld treten.
- Dazwischen der **Wall**: eine U-förmige Befestigung, zwei Felder dick.
  - Ein **Riegel** quer über die Karte (Spalte je Zeile leicht verschieden, vier
    Grundformen: `gerade`, `erker`, `bug`, `bucht`, dazu eine gewürfelte
    Grundspalte 6–8).
  - Zwei **Flanken** auf den äußersten Zeilen, die nach hinten laufen.
  - **Hinten keine Mauer** — dort steht die Burg und schließt selbst ab.
  - Mittig im Riegel das **Torhaus** (2 × 3 Felder) mit einer Durchfahrt.
  - Jedes Mauerfeld hat **24 Lebenspunkte** (`WALL_HP`). Fällt eines, entsteht
    eine Bresche, durch die Gegner laufen können.
  - Zinnen werden nur auf die **Außenkanten** gezeichnet (Riegel nach Osten,
    obere Flanke nach Norden, untere nach Süden).
- Bewegung und Abstände rechnen in **Chebyshev-Distanz** (Diagonalen zählen
  einfach). Wege werden mit einer Dijkstra-Suche über Feldkosten bestimmt und
  in `wegCache` gehalten, bis sich die Welt ändert (`weltStand`).

---

## 4. Der Feldzug

`baueRoute()` erzeugt eine Karte aus 11 Ebenen mit je bis zu 5 Spalten,
verbunden durch 5 gewürfelte Pfade (rund 35 Knoten je Route). Nach jeder Station
wählst du unter den erreichbaren Nachfolgern.

Knotenarten:

| Art | Kampf | Bemerkung |
| --- | --- | --- |
| `gegner` (Angriff) | ja | der Normalfall |
| `elite` (Vorhut) | ja | Budget × 1,3, bevorzugt schwere Typen, +25 % LP, ab Station 8 zusätzlich +1 Schaden; mehr Sold |
| `meister` (Belagerungsmeister) | ja | nur die **letzte** Ebene, alle Wege münden dort |
| `haendler` (Marketender) | nein | Karten kaufen, streichen (70 Sold), schärfen (60 Sold) |
| `lager` (Lager) | nein | **eine** Handlung je Nacht: Burg heilen, Karte schärfen, Karte streichen, **Anlage ausbessern** |
| `ereignis` (Begegnung) | nein | 8 verschiedene, meist Entscheidungen mit Preis |

Feste Punkte: Ebene 0 ist immer `gegner`, Ebene 1 `gegner` oder `ereignis`, die
vorletzte Ebene ist immer `lager` (Atem vor dem Endkampf), die letzte der
Meister. Die Vorhut schaltet sich nach dem ersten Drittel der Route frei.
Mindestens zwei Marketender liegen auf der Karte.

Der Feldzug endet, wenn die Burg auf 0 Lebenspunkte fällt (Niederlage) oder der
Belagerungsmeister fällt (Sieg). Nach einem Sieg beginnt der nächste Feldzug
eine **Härtestufe** höher (`feldzugHaerte = 1 + 0,18 × (Stufe − 1)`, wirkt auf
Budget, Lebenspunkte und Wucht der Gegner).

Was über den Feldzug mitwandert: Burg-Lebenspunkte, Deck, Sold, **die ganze
Anlage samt Besatzung**. Was nicht: die Hand (wird an jeder Station frisch
gezogen), die Mächte (gelten nur für eine Station), der Sonderzug-Stapel.

---

## 5. Der Kampf

### Ablauf eines Zuges

1. **Spielerzug.** Du hast `Tatendrang` (Energie) und eine Hand. Du spielst
   Karten, baust, besetzt, schießt — in beliebiger Reihenfolge.
2. **Zug beenden.** Dann handeln die Gegner **einer nach dem anderen**
   (`gegnerzug`, im Takt `TAKT`: Vorlauf 0,3 s, Bewegung 0,3 s, Schlag 0,44 s,
   Fall 0,62 s, Nachlauf 0,42 s).
3. **Nachschub** tritt aus dem Lager aufs Feld (`einsatzProZug`).
4. **Zinnen verfallen** (siehe unten), die Hand wird abgeworfen und neu gezogen,
   Tatendrang füllt sich auf, `zugBeginn`-Auslöser feuern.

### Die Frist und der Sturm

Jede Kampfstation hat eine **Frist**: `9 + ⌊Härtestufe / 4⌋` Züge, Vorhut +1,
Meister +3. Verstreicht sie, kommt **der Sturm**: alles, was noch steht — auf
dem Feld *und* im Lager — rennt gemeinsam ins Tor und bringt seinen vollen
Schaden auf die Burg. Wer das übersteht, hat die Station gehalten, aber teuer
bezahlt. Gemessen endet gut die Hälfte aller Kämpfe so.

Gewonnen ist eine Station, wenn Feld **und** Lager leer sind.

### Schießen

- **Ein Schuss je Turm und Zug**, unabhängig von der Besatzung.
- Ein Turm schießt nur, wenn mindestens eine Einheit darauf einen **Befehl** hat
  (siehe „Befehlskarten"). Es feuern alle Einheiten mit Befehl, die weit genug
  reichen; ihr Schaden summiert sich zu einer Salve.
- Reichweite einer Einheit = `Einheit.range + Turm.rangeBonus +
  Mächte.alleReichweite`. Die Reichweite eines Turms ist das Maximum seiner
  Einheiten.
- Schaden einer Einheit = `Einheit.dmg + Mächte.alleSchaden`.
- `durchschlag` lässt die Salve auf weitere Ziele überreißen (halber Schaden).
- Ablauf im Bild: Aufziehen (0,2 s) → Loslassen (Rückstoß, Ton, Pfeile fliegen)
  → Einschlag nach 0,28 s Flug (Zahl, Staub, steckender Pfeil). Nur Darstellung;
  der Schaden ist vorher verrechnet.

### Wer wen trifft

- **Fernkämpfer** (Reichweite ≥ 3) schießen auf die **Männer** auf dem Turm,
  nicht auf den Stein. Steht keiner oben, nehmen sie das Mauerwerk.
- **Nahkämpfer** (Reichweite ≤ 2) gehen bevorzugt aufs **Torhaus**, sonst auf den
  nächstgelegenen Turm, sonst auf die Burg.
- **Bewegen und Angreifen schließen sich aus**: wer heranrücken muss, schlägt im
  selben Zug nicht mehr. Du hast also immer einen Zug Vorwarnung, und unter jedem
  Gegner steht, was er als Nächstes vorhat.
- Trifft ein Schlag einen Turm, fangen zuerst seine **Zinnen** den Schaden ab.

---

## 6. Die Anlage (das Kernstück)

Die Befestigung wird **einmal je Feldzug** gezogen (`legeAnlageAn`) und bleibt
dann dieselbe — Form, Wall, Torhaus und jeder Turm, den du gebaut hast.
Station 1 beginnt nur mit dem Torhaus.

### Bauen

- Türme sind **2 × 2 Felder** groß und dürfen **überall am Wall** stehen, wo
  mindestens zwei ihrer vier Felder auf Mauerwerk liegen. Feste Bauplätze gibt es
  nicht; die Vorschau zeigt grün, wo es geht.
- Mauerfelder unter einem Turm werden nur **verdeckt**, nicht gelöscht: fällt der
  Turm, ist die Stelle wieder bebaubar.
- Jeder Turm hat **Plätze** für Einheiten (`slots`), höchstens **drei**
  (`MAX_PLAETZE`). Das Torhaus hat genau einen. Die Macht „Krone der Belagerung"
  gibt jedem Gebäude einen Platz dazu, bis zum Deckel.
- Der Wachturm im Startdeck ist ein **Sonderzug** (siehe unten), also wächst die
  Anlage in der Regel um **einen Turm je Station**.

### Zwischen zwei Stationen (`richteAnlageHer`)

| | |
| --- | --- |
| Breschen im Wall | werden geschlossen, Risse verputzt |
| Türme | bekommen 40 % ihrer Lebenspunkte zurück (`ANLAGE_HEILUNG`) |
| Die Besatzung | bleibt oben und steht **voll** wieder da |
| Ein gefallener Turm, ein gefallener Mann | bleibt gefallen |

Die Begründungen, weil sie das Spielgefühl tragen:

- **Der Wall wird ganz hergestellt**, weil eine bleibende Bresche das Tor für den
  Rest des Feldzugs zur Zierde machen würde — und das Tor ist der Engpass, auf
  den das ganze Spiel gebaut ist.
- **Türme nur teilweise**, damit eine teuer gehaltene Station der Anlage
  anzusehen ist.
- **Männer ganz**, weil ein Mann mit einem Lebenspunkt seinen Platz blockiert und
  sich nicht ersetzen lässt. Gemessen war die 40-Prozent-Variante für Männer
  schlechter als gar keine bleibende Besatzung (Station 6,9 gegen 8,5).
- Im **Lager** gibt es „Anlage ausbessern": eine Nacht, und Mauerwerk wie
  Besatzung stehen wieder voll.

---

## 7. Karten

### Datenmodell

Karten sind Datenobjekte in `CARD_POOL`; Wirkungen sind **deklarativ**, nicht
Code. Ein Prototyp sieht so aus:

```js
{ id: 'zinnen', name: 'Zinnen', type: 'Fähigkeit', suit: '🍃', cost: 1,
  sofort: { zinnen: 5 }, art: 'mauer', sel: 'gewoehnlich',
  text: 'Stein vor dem Mann. Was hier zerspringt, trifft ihn nicht.' }
```

Felder:

| Feld | Bedeutung |
| --- | --- |
| `type` | `Gebäude` · `Einheit` · `Fähigkeit` · `Macht` |
| `suit` | Kartenfarbe des doppeldeutschen Blatts: 🌰 Eichel = Gebäude, ❤ Herz = Einheit, 🍃 Grün/Laub = Fähigkeit, 🔔 Schelle = Macht |
| `cost` | Tatendrang |
| `sel` | Seltenheit: `gewoehnlich` · `selten` · `kostbar` (steuert Auftreten und Preis) |
| `hp`, `rangeBonus`, `plaetze` | Gebäudewerte |
| `dmg`, `range`, `zaeh`, `durchschlag` | Einheitenwerte |
| `sofort` | einmalige Wirkung beim Ausspielen |
| `macht` | anhaltende Wirkung für die Station |
| `plus` | Aufwertung einer bestehenden Einheit |
| `je` | skalierende Wirkung: `{ zaehler, wirkung }` |
| `wenn` | Auslöser: `{ ausloeser, dann, jeZug?, gesamt? }` |
| `einmalJeKampf` | Schlagwort **Sonderzug** |
| `nichtImHandel` | nie kaufbar, nie als Belohnung (nur Befehlskarten) |
| `fixiert` | Schlagwort **Fixiert** (nur Befehlskarten) |
| `art` | welches Motiv gezeichnet wird |

**Wirkungsschlüssel** (`sofort`/`macht`/`dann`): `schaden`, `flaeche`, `fessel`,
`stoss`, `zinnen`, `flicke`, `flickeAlle`, `turmSchild`, `heileBurg`, `ziehe`,
`tatendrang`, `sold`, `alleSchaden`, `alleReichweite`, `allePlaetze`,
`turmLeben`, `handKarten`, `tatendrangDauer`, `dornen`.

**Zähler** für `je`: `proTurm`, `proEinheit`, `proGegner`, `proGefallenen`,
`proHandkarte`, `proWunde`.

**Auslöser** für `wenn`: `gegnerFaellt`, `turmGebaut`, `turmFaellt`,
`burgGetroffen`, `salve`, `zugBeginn`. Auslöser haben Obergrenzen (`jeZug`,
`gesamt`), damit sich nichts aufschaukelt.

Der Regeltext auf der Karte wird aus diesen Feldern **abgeleitet**
(`karteRegel`), nie abgeschrieben — so kann er nach dem Schärfen nicht lügen.

### Der Stapel

76 Karten: 16 Gebäude, 18 Einheiten, 23 Fähigkeiten, 19 Mächte;
31 gewöhnlich, 30 selten, 15 kostbar. Alle sind in einem Lauf erreichbar.

**Startdeck (7 Karten):** 1 × Wachturm, 1 × Waldläufer, 4 × Zinnen,
1 × Krone der Belagerung. Es liegt also nur **eine** Einheitenkarte im Deck, und
die ist ein Sonderzug — die Mannschaft wächst über Käufe und Belohnungen.

**Hand:** 5 gezogene Karten (`HAND_SIZE`, plus `Mächte.handKarten`) **plus** die
fixierten Befehlskarten. Am Zugende wandert die Hand in die Ablage; ist der
Zugstapel leer, wird die Ablage gemischt.

### Die drei Schlagworte

Sie stehen gedruckt auf der Karte, nicht nur im Kleintext:

- **Sonderzug** (`einmalJeKampf`): einmal je Kampf. Danach ist die **ganze Art**
  aus dem Spiel — die gespielte Karte und jede weitere desselben Namens wandern
  beiseite, aus Hand, Zugstapel und Ablage. Zur nächsten Station kommen alle
  zurück. Betrifft **Wachturm** und **Waldläufer**.
- **Fixiert**: liegt nicht im Deck, wird nie gemischt, kommt zu **jeder Runde
  zusätzlich** in die Hand. Nur Befehlskarten.
- **Deckung**: Zinnen halten genau einen Zug (siehe unten). Nur die Zinnen-Karte.

Dazu ein viertes Band auf Einheitenkarten: „Ziehe die Karte Angriff X" — der
Hinweis auf ihr Mitbringsel.

### Zinnen = Block

Die Karte gibt einem Turm 5 Zinnen. Sie liegen als eigener Vorrat **oben auf**
den Lebenspunkten und fangen jeden Treffer zuerst ab. **Sie verfallen am
Rundenende** (`verfalleZinnen`, nach dem Gegnerzug, vor der neuen Hand) — Block
wie in Slay the Spire. Damit ist die Karte eine Antwort auf den Angriff, der
jetzt kommt, keine Anlage für später.

### Befehlskarten (das zentrale Nebensystem)

Jede Einheit, die Stellung bezieht, bringt eine eigene Karte mit:
**„Angriff ⟨Name⟩"**, Kosten 1, Status *Fixiert*, `nichtImHandel`.

- Ohne Befehl schießt niemand. Man **zieht die Karte auf die Figur** (Maus-Drag
  oder anklicken-anklicken); danach ist der Turm ausgewählt.
- Bezahlt wird **der Schuss, nicht der Befehl**. Steht niemand in Reichweite,
  geht die Karte zurück und kostet nichts; mit `Esc` oder am Zugende ebenso.
- Fällt die Einheit, geht ihre Karte mit. Einmal je Station wird der Vorrat
  gegen die Besatzung abgeglichen (`richteBefehlskartenAus`): genau eine Karte je
  lebendem Mann, keine ohne.
- **Gleiche Befehlskarten liegen als ein Stapel in der Hand** — „Angriff
  Waldläufer ×6" ist ein Blatt mit einer Zahl, jedes Ausspielen nimmt eines
  davon. Ohne das würde die Hand mit der bleibenden Besatzung überlaufen.
  Gestapelt wird nur, was austauschbar ist (gleiche Kennung **und**
  Befehlskarte); zwei Zinnen bleiben zwei Blätter.

Warum es das gibt: ein Schuss war früher die einzige Handlung im Spiel, die
nichts kostete und nie ausblieb.

### Kartenbilder

Drei Karten tragen ein echtes Blatt statt eines gezeichneten Motivs: **Wachturm,
Waldläufer, Zinnen** (`bilder/*.ganz.png`, per `scripts/kartenbilder.mjs`
verkleinert und als JPEG-Datenadresse in `KARTEN_BILDER` geschrieben, zusammen
135 KB). So ein Blatt füllt die Karte von Kante zu Kante und behält sein
Seitenverhältnis; was unten übrig bleibt, trägt die Werte. Der Zuschnitt in
`bilder/zuschnitt.json` nimmt nur weg, was außerhalb der gedruckten Rahmenlinie
liegt.

---

## 8. Gegner

Grundwerte, bevor die Station sie hochrechnet:

| Gegner | LP | Schaden | Bewegung | Reichweite | Punkte | Ab Station |
| --- | --- | --- | --- | --- | --- | --- |
| Späher | 4 | 1 | 5 | 1 | 2 | 1 |
| Armbrustschütze | 7 | 2 | 3 | 4 | 3 | 2 |
| Ritter | 20 | 5 | 3 | 1 | 6 | 3 |
| Ramme | 36 | 11 | 2 | 2 | 12 | 4 |
| Katapult | 18 | 9 | 1 | 7 | 9 | 5 |
| Belagerungsmeister | 80 | 14 | 2 | 2 | — | nur die letzte Station |

Ramme und Katapult sind **Gerät** (bronzene Plakette), zeichnerisch eigene
Modelle. Höchstens **16** Gegner stehen gleichzeitig auf dem Feld, der Rest
wartet im Lager.

Das Aufgebot wird aus einem **Punktebudget** zusammengestellt (`buildRoster`).
Kein Typ stellt mehr als `max(2, Budget/6)` Mann — außer wenn nur ein einziger
Typ freigeschaltet ist, dann fällt die Grenze weg (sonst wäre Station 1 auf zwei
Späher gedeckelt).

---

## 9. Die Schwierigkeitskurve

Alles, was mit der Station wächst, rechnet über eine **Härtestufe**, die die
11 Stationen auf die alte Skala von 17 abbildet:

```js
const HAERTE_SKALA = 17;
const haerteStufe = (runde) =>
  1 + (runde - 1) * (HAERTE_SKALA - 1) / (STATIONEN - 1);   // 1 … 17
```

Damit ist Station 11 so schwer, wie Station 17 es war; der Aufstieg ist nur
steiler. Die Formeln (`h` = Härtestufe, `f` = Feldzugshärte):

| Größe | Formel |
| --- | --- |
| Punktebudget | `round((6,5 + h × 1,35) × f)` |
| Gegner-LP | `(1,5 + 0,048 × (h − 1)) × f` |
| Gegner-Wucht | `(1 + 0,085 × (h − 1)) × f` |
| Nachschub je Zug | `2 + ⌊h / 3⌋` |
| Tatendrang | `min(8, 3 + ⌊(h − 1) / 2⌋)` |
| Frist | `9 + ⌊h / 4⌋` |
| Sold nach dem Kampf | `(28 + Vorhut 55) × (1 + Station × 0,05)` |
| Typ freigeschaltet | `h ≥ Typ.abRunde` |

Der Anfang wurde bewusst angehoben: Station 1 hatte zwei Späher mit 10
Lebenspunkten zusammen, jetzt sind es vier mit 24. Ab Station 12 der alten Skala
ist der Unterschied Rauschen.

---

## 10. Bedienung

- **Karten spielen:** ziehen (Maus-Drag auf Feld, Turm oder Figur) **oder**
  klicken und dann das Ziel klicken. Beides geht immer.
- Beim Ziehen hängt ein verkleinertes, durchscheinendes Abbild am Zeiger; die
  Karte selbst bleibt blass liegen.
- Ein Ziehen beginnt erst ab 11 Punkten Weg; wer über der Hand loslässt, behält
  die Karte angewählt (die Geste war ein Klick). Ein verlorenes Loslassen
  (Fensterwechsel) bricht das Ziehen ab.
- **Zielen:** Turm anklicken → Reichweite wird markiert → Gegner anklicken.
- `Esc` hebt jede Auswahl auf und nimmt vorgemerkte Befehle zurück.
- Oben rechts: Einstellungen (Bildgröße, Auflösung, Kantenglättung,
  Bedienelement-Größe, Himmel, Vignette, Bewegung, Röntgenblick, Lautstärke),
  Hilfe, Werkstatt (eigene Figuren zeichnen, in `localStorage`).

---

## 11. Darstellung

- **Bühne statt fester Größe:** `baueBuehne()` rechnet Fenstergröße und
  Einstellungen in eine logische Bildgröße (`SZENE_B`/`SZENE_H`), eine
  Geräteauflösung (`SKALA`) und einen Bedienzoom für die HTML-Schicht um.
- **Zeichenreihenfolge topologisch:** was vorn steht, wird später gemalt
  (`zeichenReihenfolge`), sonst schneidet ein Turm seinen Nachbarn an.
- Modelle und Blöcke werden **einmal auf Nebenleinwände gemalt** und dann nur
  gestempelt (`modellBilder`, `blockBilder`), das hält die Bildrate.
- Figuren sind Pixelraster aus Buchstaben (`PAL` bildet Buchstaben auf Farben
  ab), 11 × 13 Felder. Ein Turm zeigt bis zu drei Stellungen — jede Einheit hat
  ihre eigene, mit einem Streifen zu ihren Füßen (Leben, goldener Winkel bei
  Befehl).
- Über jedem Turm ein Stapel aus Turmbalken, Zinnen und Besatzungsschilden.
- **Röntgenblick:** hohe Türme werden durchscheinend, wenn etwas dahinter steht.

---

## 12. Ton

Kein Sample außer der Musik. Alles synthetisiert, auf einer **d-moll-Leiter**
(äolisch, Grundton D3 = 146,83 Hz), damit die Geräusche zueinander klingen:

- Angeschlagene Töne: Dreieck/Sinus durch einen Tiefpass, dessen Grenzfrequenz
  über die Lebensdauer fällt — wie eine gezupfte Saite.
- Rauschen nur, wo es etwas bedeutet: Einschlag, Einsturz, Schlag gegen die Burg.
- Der Bogenschuss in drei Schichten: Sehne schnalzt (Bandpass-Rauschen, fällt),
  Wurfarme schlagen an (Ton auf der Leiter), Pfeil zischt ab (leises Rauschen,
  30 ms später). Dazu ein Einschlag-Tock beim Treffer.
- Eine Salve steigt die Leiter hinauf: je mehr Türme in einem Zug feuern, desto
  höher der Ton.

---

## 13. Der Zustand

Das Objekt `state` hält alles, was eine Partie ausmacht. Die wichtigsten Felder:

```
feldzug, route, runde, zug, phase        'kampf' | 'route' | 'station' |
                                         'belohnung' | 'sieg' | 'ende'
castleHp, sold, tatendrang, maxTatendrang, frist
anlage            der Bauplan der Burg (einmal je Feldzug)
wall              Map "col:row" -> Mauerfeld (hp, maxHp, wachsen, riss, verdeckt)
tor               die Durchfahrt
towers[]          Bauwerke: col,row,w,h, hp, maxHp, rangeBonus, zinnen,
                  slots[] (Einheiten oder null), modell, torhaus?
enemies[], lager[]  Gegner auf dem Feld und im Lager
draw[], hand[], discard[], beiseite[], fixiert[]   die fünf Kartenorte
maechte{}         anhaltende Wirkungen der Station
ausloeser[]       eingetragene wenn-Karten
einmalGenutzt{}   Sonderzug-Buchführung der Station
gefallene         Zähler für proGefallenen
```

Eine Einheit: `{ uid, kartenId, name, dmg, range, durchschlag, hp, maxHp, art,
befehlZug, befehlKarte }`.

---

## 14. Werkzeuge und Messungen

Es gibt keine Testsuite im üblichen Sinn. Geprüft wird mit **Playwright-Skripten,
die das echte Spiel im echten Browser fahren** — und mit einem **Bot**, der
ganze Feldzüge spielt (`lauf.mjs`: bauen, besetzen, Befehle geben, auf das
gefährlichste erreichbare Ziel schießen, Zug beenden). Er meldet je Lauf die
erreichte Station, Sturmquote, Züge je Kampf und aufgetretene Fehler.

Gemessene Kennzahlen des aktuellen Standes (16 Bot-Feldzüge):

| | |
| --- | --- |
| Station im Schnitt | **8,5 von 11** |
| Siege | 2 von 16 |
| Sturmquote | 55 % aller Kämpfe |
| Züge je Kampf | 10,4 |

**Wichtig für jede weitere Arbeit:** die Streuung ist groß. Zwei Stichproben
derselben Fassung ergaben 0/8 und 3/8 Siege. Acht Läufe können einen Unterschied
von einer Station nicht auflösen; wer balancieren will, braucht sechzehn und
sollte Unterschiede unter einer Station als Rauschen behandeln.

Zwei Messungen, die Annahmen widerlegt haben:

- **Die Frist ist nicht der Engpass.** Ein Zug mehr änderte nichts (57 % statt
  52 % Stürme) — er bringt nur einen weiteren Schwung Nachschub mit.
- **Bleibende Einheiten kosten nichts.** 8,5 mit, 8,5 ohne.

---

## 15. Bekannte Schwächen

Gemessen, nicht vermutet:

- **Der Gegnerzug ist träge.** Er dauert 1,5 s bei zwei Gegnern und 3,4 s bei
  acht, streng nacheinander. **47 %** aller Gegner-Takte sind reines „rückt vor".
- **Der Anmarsch ist lang.** Vom Lager zum Tor sind es 12 Felder. Züge bis zum
  ersten Schlag: Späher 3, Armbrustschütze 3, Ritter 4, **Ramme 6, Katapult 6,
  Belagerungsmeister 6** — bei einer Frist von 9 bis 13.
- **Gegner haben wenig Absicht.** Alle laufen zum Tor; nur die Reichweite
  unterscheidet sie.
- **Mächte gelten nur für eine Station**, die Anlage dagegen für den ganzen
  Feldzug — ein Bruch im Modell.
- **Kein Fortschritt zwischen den Läufen.** Keine Freischaltungen; alle 76 Karten
  ab Lauf eins.
- **Nur ein Endgegner.**
- **Gegner weichen Mauern nur einfach aus**, sie suchen keinen Weg um eine lange
  Mauer herum.

---

## 16. Arbeitsweise am Projekt

Wer hier weiterarbeitet, sollte drei Gewohnheiten übernehmen:

1. **Messen statt schätzen.** Balanceänderungen werden mit Bot-Läufen belegt,
   Layoutänderungen mit Bildschirmfotos aus dem echten Spiel, Tonänderungen mit
   offline gerendertem Pegel. Mehrere Annahmen dieses Projekts sind an der
   Messung gescheitert.
2. **Der Kommentar erklärt das Warum.** Der Quelltext ist dicht kommentiert, und
   die Kommentare begründen Entscheidungen („vorher war X, gemessen war das
   schlechter, weil …") statt zu wiederholen, was der Code tut.
3. **Deutsch, durchgehend.** Bezeichner, Kommentare, Oberfläche, README,
   Commit-Nachrichten.
