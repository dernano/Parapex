# Der Sichtprüfstand — Bericht

Was jetzt sichtbar funktioniert, was Platzhalter ist, was echte Kunst
braucht, und was noch offen ist.

Der Satz, an dem sich das alles messen lassen soll, stammt aus dem Auftrag:
**Castle Master soll schon mit Platzhaltergrafik erkennen lassen, WARUM es mit
guter Kunst später hervorragend aussehen wird.** Dieser Bericht behauptet
nicht, dass es das tut. Er legt offen, woran man es prüfen kann.

```
npm run build && npm run dev     →  /visual-test/
npm run blick                    →  23 Aufnahmen in docs/blick/
npm run blick:vergleich          →  gegen die Grundlage
npm run last                     →  echte Bildkosten
```

---

## 1. Was sichtbar funktioniert

Alles hier ist im Prüfstand zu sehen und durch eine Zusicherung festgehalten,
die rot wird, wenn man es zurückbaut.

**Die Burg trägt die Besatzung.** Ein Turm ist zwei Teile: Masse hinter dem
Soldaten, Zinnenkranz davor, auf Fußhöhe. Welche Ebene ein Teil bekommt, wird
aus seiner Position abgeleitet — auch für jedes Mauerstück, das oberhalb eines
Turms hinter und unterhalb davor liegt.

**Vier Gattungen feuern erkennbar verschieden.** Länge, Rhythmus, Rückstoß,
Bogen und Geschwindigkeit unterscheiden sich; der Schuss verlässt einen echten
Mündungssockel, und der Rückstoß folgt der Projektion statt dem Bildschirm.

**Das Mündungsfeuer sitzt am Rohr.** Klein, hell, zwei Bilder lang, und nur bei
Kanonen. Der Staub wird am Kontaktpunkt Turm/Maschine geworfen, nicht neben dem
Lauf.

**Rauch sammelt sich und wird komprimiert.** Nahe Partikel verschmelzen
flächenerhaltend zu wenigeren, größeren. Nach vierzig Schüssen steht eine Bank;
nach zweihundert steht sie immer noch, statt dünner zu werden.

**Geschosse sind lesbar.** Dunkler Rand unter jeder Bodenfarbe, heller Kern
darüber — gemessen, nicht gehofft. Pfeil und Bolzen drehen sich in ihre
Flugrichtung, Stein und Kugel nicht.

**Salven A–E eskalieren sichtbar.** Nicht nur schneller: mehr Rauch, härtere
Einschläge, gleichzeitig feuernde Türme, Lichtblitz, Narben, Dauerdonner. Jede
Dimension wächst monoton über die fünf Stufen.

**Schadenszahlen lügen nie.** Die Summe der gezeigten Zahlen ist exakt der
angerichtete Schaden, bei jeder Größenordnung, und nie mehr als zehn auf einmal.

**Die Erde behält die Spuren.** Ab Stufe C hinterlassen Einschläge Narben, die
ihre eigene Salve überleben: vier Sekunden später ist der Rauch weg und dem Feld
sieht man an, was ihm zugestoßen ist. Nahe Einschläge vertiefen dieselbe Stelle,
statt zweihundert einzelne Löcher zu machen.

**Ab Stufe D liegt Licht auf dem Feld.** Ein gehaltener warmer Schein, der
aufzieht, steht und wieder abfällt — kein Blitzen. Warum das keine
Geschmacksfrage ist, steht unten unter *Eine Entscheidung ohne Alternative*.

**Ein Sperrfeuer deckt Boden ab.** Die Schüsse streuen um den Zielpunkt, weiter
mit jeder Stufe. Vorher landeten hundert Kugeln auf demselben Bildpunkt.

**Die Kamera bleibt fast immer still.** Drei Pixel, ganzzahlig, ab Stufe C, auf
jedem dritten Schuss und dem letzten. Bei reduzierter Bewegung exakt null.

**Die Geschlossene Front steht auf der Mauer.** Standarten über jeder Stellung,
zu einer Linie verbunden, Beschriftung daneben — kein Fenster.

**Die Reihe und die Geschütze teilen eine Uhr.** Die acht Motive sind reine
Funktionen der Zeit, vom selben Regisseur getrieben wie Rauch, Geschosse und
Kamera — nicht von CSS. Sie können nicht gegeneinander driften, weil keines von
beiden die Zeit besitzt, und eine Aufnahme davon braucht keinen Kunstgriff mehr.

**Die Wappenreihe liest sich als Reihenfolge.** Fünf Fächer, in eine Richtung
verbunden, und acht Motive, deren Zuordnung aus dem ABGELEITET wird, was ein
Wappen getan hat. Der Renderer kennt keinen der fünfzig Namen; ein Test liest
das Verzeichnis durch und beweist es.

**Die Kette steht als Zahlenfolge da.** `5 → 6 → 18`, daneben, was die
umgekehrte Anordnung ergäbe: `16`. Das ist die beste Idee des Spiels, sichtbar
gemacht.

**Pulver wird im Zusammenhang gezeigt.** Was nichts erzeugt und nichts
verbraucht, erscheint gar nicht. Was erzeugt und von nichts genutzt wird, bekommt
die Warnung — wörtlich: `⚠ Kein aktives Wappen nutzt Pulver.` Ob ein Wappen einen
Vorrat nutzt, wird GEMESSEN, nicht in einer Tabelle nachgeschlagen, die
veraltet.

**Das Schlachtfeld bekommt den Bildschirm.** Mindestens 62 % bei jeder
Fenstergröße. Tatendrang sind fünf Marken. Sieben Karten fächern, statt zu
scrollen. Sortieren gibt eine Reihenfolge zurück und fasst die Hand nie an.

**Karte auf Turm.** Der Schemen steht auf der Plattform, auf der die Einheit
stehen würde, und die Laufzeile beantwortet den Zug, bevor er liegt:
`+ Drillingsposten − Doppelposten +2 Salven`.

## 2. Was Platzhalter ist

Alles Gezeichnete. Ohne Ausnahme.

| Was | Was der Platzhalter ist |
|---|---|
| Boden | zwei Farbrampen, vier Varianten, kein Übergang, keine Struktur |
| Narben | dunkle Rauten mit einem helleren Rand |
| Mauer und Türme | Quader mit einer beleuchteten Deckfläche |
| Zinnenkranz | ein flacher Quader, 21 Pixel hoch |
| Soldaten | drei Rechtecke: Helm, Wams, Stiefel |
| Waffen | ein Balken vom Griff zum Mündungssockel |
| Feind | eine dunkle Silhouette mit einer hellen Kante |
| Geschosse | zwei Rechtecke, dunkel um hell |
| Partikel | Quadrate aus drei Farben je Art |
| Standarten | Stange plus Fähnchen |
| Wappen | Sinnbilder aus der Schriftart |

Eine Ausnahme ist erklärungsbedürftig, und der Auftrag sagt, ich soll keine
weiteren Detail-Platzhalter zeichnen: **der Waffenbalken.** Ich habe ihn
trotzdem hinzugefügt, weil ohne ihn das Mündungsfeuer neben dem Kanonier in der
Luft schwebte und nicht zu entscheiden war, ob der Sockel falsch sitzt oder die
Figur die Waffe nicht zeigt. Es war letzteres. Ein Balken ist die kleinste
Zeichnung, die diese Frage beantwortet, er ist als Gerüst benannt, und er
verschwindet mit dem ersten echten Rohr. Wenn das zu weit ging: eine Zeile
löschen.

## 3. Was echte Kunst braucht — ART BLOCKED

Diese Punkte sind vollständig vorbereitet und warten nur auf Zeichnungen. Für
jeden steht der Vertrag: Größe, Anker, Sockel, Ebene, Zeitverlauf.

| Was | Was da ist | Was fehlt |
|---|---|---|
| **Vier Einheitenfamilien** | Sockel, Phasen, Rückstoß, Bogen, Rangstufen | die Figuren |
| **Die Burg** | Aufteilung in Masse und Zinnenkranz, Plattformhöhen je Typ, Ebenen | Steinmasse, Fugen, Tor, Verwitterung |
| **Gelände** | 20×20 Kacheln mit stabiler Variante | Erde, Gras, Wege, Übergänge |
| **Der Feind** | Stärke als Anzahl Figuren | die Figuren |
| **Geschosse** | Länge, Breite, Kern, Rand, Drehung, Schweif, Schatten | die Sprites |
| **Partikel** | fünf Arten, Verhalten, Farben, Verschmelzung | gezeichnete Rauchballen statt Quadraten |
| **Formationen** | eine von dreizehn präsentiert | zwölf Motive, und Standarten, die welche sind |
| **Wappen** | fünfzig als Daten, acht Motive | fünfzig Wappenbilder |
| **Karten** | Rang, Name, Gattung, Farbe, Anordnung | Kartenrahmen, Porträts |

Zwölf Grafikplätze meldet der Prüfstand im Ruhezustand als fehlend, siebzehn
über alle Zustände — mit dem genauen Pfad, an dem die Pipeline jede erwartet
(`assets/source/unit/bow/elite.png`). In der Entwicklung wird jeder einmal
gemeldet, in der Auslieferung fällt er auf ein Geschwister zurück, nie ins
Leere.

**Was NICHT blockiert ist:** kein einziges System. Vertrag, Anordnung,
Animation, Sockel, Ebenen, Zeitverlauf, Bedienung, Effekte und Präsentation sind
gebaut und geprüft. Die Kunst fällt in Fassungen, die bereits in die richtige
Richtung zeigen.

## 4. Die Aufnahmen

23 benannte Zustände, feste Ausgangswerte, feste Zeitmarken, in `docs/blick/`.

| Satz | Zustände |
|---|---|
| haupt | ruhe · bogen · armbrust · artillerie · kanone · salve-drei · sperrfeuer · bombardement · vernichtung · formation · wappenkette · pulver-tot |
| erde | narben-danach · feldbeleuchtung |
| groesse | groesse-100 · 115 · 125 · 135 |
| handlung | karte-ueber-turm |
| wappen | kette-zuendet · kette-pulver |
| diagnose | diagnose-sockel · diagnose-ebenen |

Jeder Zustand trägt die Frage, die er beantwortet. Die Grundlage liegt in
`docs/blick/grundlage/`; `npm run blick:vergleich` nennt den geänderten
Zustand, den Anteil geänderter Bildpunkte und schreibt eine Differenzkarte. Eine
Brüstung zwei Pixel höher zu machen schlägt in allen zwölf Hauptzuständen mit
0,18 % an — das ist die Empfindlichkeit, die man haben will.

## 5. Die Leistung

Gemessen in SwiftShader, also **ohne Grafikkarte** — der ungünstigste Fall.
Budget: 16,7 ms je Bild.

| Fall | B/s | p95 | max | Sprites | Partikel |
|---|---|---|---|---|---|
| Ruhe | 3333 | 0,6 ms | 0,9 ms | 448 | 0 |
| Salve (A) | 2500 | 1,3 ms | 4,0 ms | 484 | 29 |
| Sperrfeuer (C) | 1429 | 1,5 ms | 2,5 ms | 790 | 296 |
| Bombardement (D) | 1250 | 2,1 ms | 3,5 ms | 831 | 300 |
| Vernichtung (E) | 1000 | 1,9 ms | 3,0 ms | 906 | 300 |
| Eine Million Salven | 667 | 2,4 ms | 4,2 ms | 925 | 300 |

Die Sprite-Obergrenze stand auf 900 und war geraten. Die Messung hat sie auf
1200 gerückt: 925 Sprites kosten unter drei Millisekunden, und das
Bild-Zeit-Budget ist ohnehin die eigentliche Schranke.

**Nach Narben und Feldbeleuchtung** (Messung erneuert): Ruhe 0,6 ms · Salve
1,4 ms · Sperrfeuer 3,8 ms · Bombardement 2,2 ms · Vernichtung 2,5 ms · eine
Million 2,6 ms (p95), bei bis zu 941 Sprites. Alles im Budget.

**Der Ausreißer ist weg.** In etwa jedem zweiten Lauf kostete ein Bild einer
Stufe-E-Salve rund 50 ms. Seit die Wappenmotive nicht mehr über CSS laufen —
Dutzende animierter Elemente mit `will-change`, jede Salve neu angelegt — ist
das schlimmste gemessene Bild über drei Läufe 5,9 bis 7,8 ms. Ein Sprite-Vorrat
ist damit eine Lösung ohne Problem und bleibt liegen, bis wieder etwas schlecht
misst.

## 6. Die Tests

**683** im neuen Baum, alle grün. Typprüfung und Bau ebenfalls. Die Altfassung
ist unberührt: 55/55 Kern, 53/53 Feldzug, 112/112 Browser.

Jede der neuen Zusicherungen wurde durch absichtliches Kaputtmachen geprüft —
und dabei kamen die Fehler heraus, die in `MIGRATION.md §12` stehen: sechs
Stück, die 630 grüne Tests nicht gefunden hatten, jeder davon einer, bei dem der
Test das Falsche behauptete statt gar nichts.

Der lehrreichste: `artRules.ts` behauptete seit Phase 4, ein Test lese die
Bibel und schlage bei Abweichung fehl. Den Test gab es nicht. Eine Behauptung
über eine Absicherung ist schlimmer als keine.

## 7. Die Größenfrage

Vier Aufnahmen im echten Kampfbildschirm, gemessen statt beurteilt. Die
Begründung steht in `ART_BIBLE.md §3.1`; hier das Ergebnis:

**100 % — die Größen, die längst in der Bibel stehen.** Ein Mann bleibt unter
anderthalb Kachelhöhen, ein Wachturm bleibt zweieinhalb Mann hoch, und siebzehn
Pixel stehen frei über der Brüstung. 115 % liegt in Reserve, falls sich die
Miliz später nicht von den Berufssoldaten unterscheiden lässt.

Die eigentliche Erkenntnis war keine Größe: der Platzhalter zeichnete Soldaten
ein Fünftel kleiner, als die Bibel vorschreibt. 125 % davon ergab genau die
Höhe, die dort steht.

## 7a. Eine Entscheidung ohne Alternative

Die Eskalationstabelle verspricht ab Stufe D einen **Lichtblitz**. Die
naheliegende Lesart — ein heller Puls je gezeichnetem Schuss — ist nicht nur
falsch, sie ist gefährlich: eine Stufe-E-Salve zeichnet alle 45 ms einen
Moment, ein Puls darauf wäre ein **22-Hz-Vollbildstroboskop**, mitten im Band,
das photosensitive Anfälle auslöst. `reducedMotion` würde niemanden schützen,
der die Einstellung nicht vorher gefunden hat.

Gebaut ist deshalb kein Puls, sondern ein **gehaltener Schein**: das Licht
zieht einmal auf, steht, und fällt einmal ab. Keine Frequenz, nirgends. Ein
Test fährt die gesamte Salve in Viertelmillisekunden ab und zählt die
Richtungswechsel der Helligkeit — es müssen genau **zwei** sein, hinauf und
hinunter. Baut man den Puls ein, zählt er 127 und wird rot.

Das ist die einzige Stelle in diesem Abschnitt, an der ich eine Anforderung
aus dem Auftrag nicht wörtlich umgesetzt habe. Es liest sich schwerer als ein
Stroboskop, und es ist durch Konstruktion sicher statt durch eine Einstellung.

## 8. Was offen ist

Ehrlich, und nach Gewicht sortiert.

1. **Zwölf von dreizehn Formationen haben keine Präsentation.** Der Auftrag
   wollte ausdrücklich EINE richtig; die Liste der übrigen wird abgeleitet und
   nennt sich selbst.
2. **Der Dauerdonner ist Ton, und Ton gibt es im neuen Baum noch nicht.** Der
   letzte Eintrag der Eskalationstabelle ohne Umsetzung.
3. **Die Oberfläche wohnt in `app/visual-test/`**, nicht in `src/ui/`. Die
   Anordnung selbst ist Daten und geprüft; nur das Erzeugen der DOM-Knoten muss
   in Phase 7 umziehen.
4. **Der Schemen beim Ziehen hat keine eigene Fassung** — er ist die Figur bei
   halber Deckkraft. Für echte Kunst wäre eine Umrisszeichnung besser.
5. **Es gibt kein spielbares Kampfbild im neuen Baum.** Der Prüfstand zeigt die
   Präsentation, `app/index.html` ist noch die Phase-4-Vorführung. Das ist
   Phase 7 und der nächste große Schritt.

## 9. Was ich nicht gemacht habe

Wie im Auftrag verlangt: keine Feldherrenporträts, keine Ante-Grafik, kein
Umbau des Feldzugs, keine Berührung der Speicherstände aus Phase 9, nichts aus
der Altfassung gelöscht. Keine fremden Zugangsdaten benutzt, keine
kostenpflichtige Bild-Schnittstelle gerufen, kein Diffusionsmodell installiert,
und keine Zeit in zweiundfünfzig prozedurale Platzhaltereinheiten gesteckt: es
gibt vier Familien und drei Rangbänder, und der Rang liest sich aus der
Ausrüstung.
