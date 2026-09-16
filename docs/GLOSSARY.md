# Glossary — German source, English code

The legacy tree (`quelle/`, `index.html`) is German throughout. The new tree
(`src/`, `app/`) is English throughout, **including domain vocabulary**.

One rule decides which side a word falls on:

> **Identifiers are English. Anything the player reads stays German.**

So `computeForce()` returns a `Settlement` whose formations carry
`displayName: 'Königlicher Aufmarsch'`. Translating the player-facing strings
would change the product; this migration changes the architecture.

Translate at the boundary, never in the middle. Legacy id tables live in
`src/content/*/legacyIds.ts` because save files carry the German strings and
the Phase 9 save migration needs exactly those tables.

## Combat

| German | English | Notes |
|---|---|---|
| Wucht | force | `effectiveForce`, `Settlement.force` |
| Grundwucht | baseForce | what the rank brings |
| Wuchtbonus | forceBonus | what polishing added |
| Wirkwucht | effective | what actually lands |
| Salve / Salven | volley / volleys | every volley is a visible shot |
| Abrechnung | Settlement | the result of a force calculation |
| Posten | Emplacement | one occupied tower's contribution |
| Schritt | SettlementStep | one readable line of the calculation |
| Tatendrang | momentum | the only currency inside combat |
| Turm | tower | |
| Turmtyp | TowerType | the slow progression axis |
| Turmfaktor | towerFactor | |
| Runde | round | |
| Feind | enemy | |
| Kampf | combat | |
| Zug (Stapel) | drawPile | |
| Hand | hand | |
| Ablage | discardPile | |
| Schliff / schleifen | polish | raises force, never rank |
| Stufe | level | of a unit or a formation |
| Probe | dryRun | **removed** — the new engine never mutates, so no flag |

## Units

| German | English |
|---|---|
| Einheit | Unit |
| Gattung | Branch |
| Bogen | bow |
| Armbrust | crossbow |
| Artillerie | artillery |
| Kanonier | gunner |
| Rang | rank |
| Karte | card |
| Deck | deck |

## Formations

| German | English |
|---|---|
| Formation | Formation |
| Familie | family |
| Blatt | Tableau |
| Rangfolge / Folge | run |
| Krönung | crowning |
| Geschlossene Front | closedFront |
| Regiment | regiment |
| Großes Regiment | greatRegiment |
| Reine Garde | pureGuard |
| Doppelposten | doublePost |
| Doppelte Wache | doubleWatch |
| Drillingsposten | tripletPost |
| Viererblock | fourBlock |
| Vormarsch | advance |
| Großer Vormarsch | greatAdvance |
| Perfekter Vormarsch | perfectAdvance |
| Königlicher Aufmarsch | royalAdvance |
| Königliche Garde | royalGuard |

## Crests (Phase 3)

| German | English |
|---|---|
| Wappen | Crest |
| Fließband | Pipeline |
| Platz | slot |
| Reihe / Reihenfolge | order |
| zünden | trigger / ignite |
| Zündart | TriggerSource |
| abgewiesen | rejected |
| Abweisung | rejection |
| Siegel / versiegelt | seal / sealed |
| Wirkung | effect |
| Ereignis | event |
| Lage | context |
| Vorrat | resources |
| Pulver | powder |
| Veteran | veteran |
| Verwüstung | devastation |
| Befehl | command |

## Campaign (Phase 8)

| German | English |
|---|---|
| Feldzug | campaign |
| Lauf | run |
| Belagerung | siege |
| Ante | ante |
| Vorhut | vanguard |
| Division | division |
| Heerführer | commander |
| Bedrohung | threat |
| Vorbereitung | preparation |
| Heerlager | camp |
| Dienst | service |
| Händler | merchant |
| Begegnung | encounter |
| Sold | pay |
| Bossregel | commanderRule |
| Finaler Sturm | finalAssault |
