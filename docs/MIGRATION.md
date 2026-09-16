# Migration — from one 17k-line file to a real source tree

Status: **Phase 1 complete, Phase 2 begun.** The legacy game is untouched and
remains the behavioural reference. Nothing has been deleted.

---

## 1. What the repository actually is today

| Part | Size | What it is |
|---|---|---|
| `index.html` | 17,593 lines | The delivered game. Lines 779–5,944 are **generated** from `quelle/` by `scripts/baue.mjs`; lines 1–778 and 5,945–17,593 are hand-written UI, CSS and canvas rendering. |
| `quelle/` | 4,100 lines, 21 modules | The already-extracted pure core. No DOM, no canvas. Type-checked as JS+JSDoc. |
| `scripts/` | 3,900 lines, 15 scripts | Own bundler, Playwright test suites, balance bot, style checker. |
| `bilder/` | 3 PNGs (12 MB) | Card artwork. Unit sprites are **not** here — see below. |

The previous extraction went further than the brief assumed. Three findings
change the plan:

**The core is already browser-free.** `node -e "import('./quelle/kern.js')"`
runs the full combat calculation with no Chromium. Phase 2 is therefore a
*translation with a state refactor*, not an extraction.

**The crest system is already data + effect primitives.** `sammlung.js` is 50
crests as data; `wirkungen.js` is the primitive library they compose. There is
no 50-case switch to dismantle. `WappenEngine.ts` largely means *typing* what
exists.

**Rendering does not decide damage.** Grepped and confirmed: the only place a
render path mutates combat state is the developer tool. The feared
`sprite → damage → save` coupling is not present.

## 2. Where the real coupling is

### Ambient singletons — the deepest problem
Six module-level `export let` bindings **are** the game state:

```
derKampf      quelle/kern/kampf.js
derLauf       quelle/kern/lauf.js
dasBand       quelle/wappen/fliessband.js
derVorrat     quelle/wappen/vorrat.js
dieBelagerung quelle/feldzug/belagerung.js
dasLager      quelle/feldzug/heerlager.js
```

Every function reads and writes them. `performAction(state, action)` does not
exist and cannot exist until they are gone. This is the single largest piece of
work in the migration and the reason Phase 2 is split in two.

### The `probe` flag
`berechneWucht(towers, crests, probe = true)` has a flag whose entire purpose
is "do not mutate the world while I ask you a question". The flag exists
because the calculation *does* mutate — it burns powder and writes the combat
log. The new engine has no flag because it has nothing to suppress:
`computeForce()` takes towers and returns a settlement.

### Shared object identity
- `neuerKampf` receives the UI's tower objects and `Object.assign`s rule fields
  onto **the same objects**. One object, two owners.
- `k.wappen` **is** `band.reihe` — the same array instance, deliberately, so a
  drag reorders both. Two subsystems sharing a mutable array by design.

### Gameplay in the presentation layer
`index.html:17388` rolls `Math.random() < PK_BEGEGNUNG_CHANCE` to decide
whether an encounter happens. That is a game rule living in a click handler.

### Screen flow gated by animation
`pkRundeBeenden` schedules `pkZeigeEnde` / `pkSpielRundenwechsel` behind
`setTimeout(…, (duration + 0.35) * 1000)`. State mutation is synchronous and
correct; *when the next screen is entered* is decided by animation length.

### Randomness
Ten `Math.random()` calls in `quelle/` (deck shuffle, rewards, offers, tower
types, encounters) plus the one above. 28 more in `index.html` are purely
cosmetic (sparks, dust, banners) and can stay unseeded.

### Sprites
Ten figures defined as arrays of pixel strings (`FIG_BOGEN` …), painted through
98 `fillRect` sites. Not thousands — but reconstructed rather than cached, and
with no atlas, no anchors and no per-unit visual definition.

### Saves
`STAND_FASSUNG = 1`, no migrations. `sichereFeldzug` spreads the live run
object wholesale (`{...derLauf}`), so the save format is coupled to the
in-memory shape of a mutable singleton.

## 3. The ten highest-risk migration points

Ranked by *how quietly they can break*.

| # | Risk | Why it is dangerous | Mitigation |
|---|---|---|---|
| 1 | **Crest ordering** | `(s+10)×3 ≠ s×3+10`. Effects apply in place, strictly left to right. A reordering bug produces plausible-but-wrong numbers, not a crash. | Golden fixtures per crest **and per pair**, generated from legacy before any code moves. |
| 2 | **Recursion guards** ◐ *4 of 6 covered* | Depth 6 / 12 per slot / 60 per event / 24 chains / circle detection. Off-by-one here changes late-run damage by orders of magnitude. | Fixtures now trip `kreis`, `siegel`, `jePlatz` and `jeEreignis`. `tiefe` and `ketten` are **unreachable** — see below. |
| 3 | **Singleton → passed state** ◐ *combat done* | ~80 functions read an ambient binding. A missed one reads stale state and silently diverges. | `derKampf` has no counterpart in the new tree: `performAction` takes state and returns state, and a deep-frozen state survives every action. Five singletons remain in the legacy tree (`derLauf`, `dasBand`, `derVorrat`, `dieBelagerung`, `dasLager`) and fall in phases 3 and 8. |
| 4 | **Removing `probe`** ✅ *done for combat* | Every call site must be classified as ask-or-apply. Getting one wrong burns resources during a hover. | Gone without replacement. `previewDeployment` and `computeForce` cannot mutate, so there is nothing to suppress. Proved by freezing the state and asking. |
| 5 | **Shared tower objects** | Splitting rules and rendering into two objects can let them drift. | Renderer holds only `towerIndex`; it never owns tower data. |
| 6 | **`k.wappen === band.reihe`** | Copying the array breaks reordering; not copying leaks mutation. | One owner (`CombatState.crests`), pipeline receives it as a parameter. |
| 7 | **Seeded RNG** ✅ *addressed* | Seeding *changes every draw*. Run-level golden fixtures cannot be compared across the change. | Resolved differently than planned, and better: instead of comparing outcomes, `scripts/goldenDraws.mjs` feeds the legacy code a **scripted stream** and records it. The generator is then out of the question and only the algorithm is on trial. 47 fixtures, all five algorithms match. |
| 8 | **Encounter roll in the UI** | Moving it changes when it is rolled relative to the seed. | Move it with the seed (Phase 2b), not before. |
| 9 | **Animation-gated flow** | An event queue observes state at different moments than a timer chain. | `AnimationDirector` replays a finished event list; simulation completes before presentation starts. |
| 10 | **Save compatibility** | v1 refuses mismatches outright, so a shape change bricks in-flight runs. | v2 written by a migration from v1, with a fixture of a real v1 save. |

## 4. Target structure

Derived from the real repository, not the sketch. Deviations from the brief
are marked ▸ with a reason.

```
app/                       ▸ the Vite client root, separate from the legacy
  index.html                 index.html so both can exist until Phase 10
  main.ts

src/
  core/                    types.ts, constants.ts, ids.ts
  simulation/              CombatEngine, VolleyEngine, FormationEngine,
                           DeploymentEngine, ExchangeEngine, Rng
  crests/                  ▸ "wappen/" in the brief; English tree, English name
    CrestPipeline.ts, CrestContext.ts, CrestRegistry.ts, effects/
  campaign/                SiegeEngine, ThreatSystem, PreparationSystem,
                           DivisionSystem, CommanderSystem, EncounterGenerator
  content/                 units/ crests/ formations/ towers/ enemies/
                           commanders/ divisions/ encounters/
                           ▸ each with a legacyIds.ts where saves carry German ids
  app/                     GameController, SceneManager, scenes/
  rendering/               Renderer, battlefield/, castle/, units/,
                           projectiles/, effects/, particles/, campaign/,
                           WorldTransform.ts  ▸ the existing isoX/isoY, promoted
  animation/               AnimationDirector, Timeline, PresentationQueue
  ui/                      hud/ hand/ tooltips/ shops/ crests/ campaign/ codex/
  assets/ audio/ save/ input/ debug/
  tests/                   fixtures/ + *.test.ts

quelle/, index.html, scripts/   LEGACY. Untouched. Deleted subsystem by
                                subsystem in Phase 10, never before.
```

▸ **No `GameState.ts` / `RunState.ts` / `CombatState.ts` as separate files.**
They are types, and they live in `core/types.ts` with everything else the
domain vocabulary needs. Three files holding one interface each is filing, not
architecture.

## 5. Phase order and why

Dependency order, not feature order. Each phase leaves the game playable.

| Phase | Content | Gate to the next |
|---|---|---|
| **0 ✅** | Freeze at **`6b72a89`** (local tag `legacy-baseline`; this session's git proxy does not relay tags, so the commit SHA is the durable marker), golden fixtures for force + formations | 25 fixtures written |
| **1 ✅** | npm, TypeScript 7, Vite 8, Vitest 5, PixiJS 8; `dev`/`build`/`test`/`typecheck` | build + tests green, legacy untouched |
| **2a ✅** | Vertical slice: units, towers, formations, force — typed, pure, proven | 27 parity tests |
| **2b ✅** | Seeded `Rng` (sfc32, serialisable state) and the five draw algorithms, proven against the legacy inline code under a scripted stream | 47 draw fixtures; same seed deals the same hand; a saved state resumes the exact stream |
| **2b′** | Wire the draws into the migrated systems — cannot happen before those systems move (2c for the deck, 8 for rewards/offers/encounters) | no `Math.random` left in `src/` — already enforced |
| **2c ✅** | `CombatState` as data; `performAction(state, action) → {state, events}` for deploy / replace / exchange / endRound | 15 scripted combats, 55 actions, step-by-step parity; plus purity, determinism and no-card-lost properties |
| **3a ✅** | Golden fixtures for the crest system, captured before anything moves | 250 single-crest cases (50 crests × 5 combat shapes), 2450 ordered pairs, 50 guard rows; every crest ignites, 4 of 6 rejection reasons exercised |
| **3b** | The typed pipeline itself: slots, order, trigger sources, guards, protocol | the machinery, unit-tested against the guards |
| **3c** | The 50 crest definitions and the effect primitives | every fixture above reproduced |
| **4** | Pixi renderer beside the old one: terrain, castle, five towers, one unit, one projectile | both renderers from one state, visually compared |
| **5** | Unit visuals: atlas, `UnitVisualDefinition`, anchors, recoil | profile before/after |
| **6** | `AnimationDirector` consumes the event list | simulation finishes before presentation starts |
| **7** | DOM UI as typed components | |
| **8** | Campaign/siege on typed state | |
| **9** | Save v1 → v2 migration | a real v1 save loads |
| **10** | Delete legacy, subsystem by subsystem | each removal gated on tests + a manual playthrough |

## 6. What is enforced, not just intended

`src/tests/architecture.test.ts` fails the build when:

- anything under `src/` imports from `quelle/`
- `core/`, `content/` or `simulation/` imports `pixi.js`, `@/rendering`,
  `@/ui`, `@/animation` or `@/app`
- the rules touch `document`, `window`, `requestAnimationFrame`, `setTimeout`
  or `setInterval`
- the rules call `Math.random`

All four were verified to fail when deliberately violated.

## 7. On testing the tests

Every parity suite here is checked by deliberately breaking the implementation
and confirming the suite goes red. This is not ceremony — it has already caught
a suite that proved nothing.

| Break | Caught |
|---|---|
| Volley count off by 0.0001 | 25 of 27 |
| Tower factor removed | exactly the 4 tower-type cases |
| Shuffle direction reversed | 3 |
| `range` made exclusive | 5 |
| Weighted fallback removed | **nothing — the test was wrong** |
| Drawing from the wrong end of the pile | 15 |
| No immediate shot on deployment | 13 |
| A sixth round allowed | 1 |
| Exchanged cards discarded before drawing | **nothing — the test was missing** |
| Replacement charged the deployment price | **nothing — and nothing can** |
| `Math.random` in the rules | the architecture guard |

The weighted-fallback case is the instructive one. The first version of that
test chose weights where the countdown reached zero inside the loop, so the
fallback line never executed and deleting it passed. A search over 200,000
random weight sets found a case where floating-point rounding really does leave
the countdown at +1.1e-16 after the last subtraction. That case is in the test
now.

The same applies to the fixtures themselves: `goldenDraws.mjs` aborts if a case
consumed no randomness, because one silently did — `belohnungsRang` is not in
the legacy barrel, and an optional call swallowed it into a fixture that tested
nothing.

The exchange-ordering break is the other kind of lesson: the rule was right,
the test simply did not exist. The reshuffle test only ever deployed, so the
ordering it depends on never came up. A deck of eight now forces the pile dry
*during* an exchange, where discarding early would hand back the card you just
paid to lose.

**The last row is an honest limit, not a gap.** `costs.deploy` and
`costs.replace` are both 1, so no test can tell a hardcoded value from the
correct expression. What can be done is to make the distinction structural:
`deployCost()` reads both constants, so the day they differ the engine is
already right.

A green suite that has never been seen to fail is a decoration.

## 8. Two recursion guards cannot be tested, and that is the finding

A brute-force sweep — 4,000 random five-crest rows across three combat shapes,
12,000 combats — asked which of the five recursion guards any legal row can
actually trip.

| Guard | Limit | Reachable | Deepest / largest seen |
|---|---|---|---|
| `kreis` | — | **yes** | |
| `siegel` | — | **yes** (needs a commander rule) | |
| `jePlatz` | 12 per slot | **yes** | |
| `jeEreignis` | 60 per event | **yes** | 65 ignitions |
| `tiefe` | depth 6 | **no** | depth 2 |
| `ketten` | 24 sub-events | **no** | — |

The reason is structural. The only crest that generates a new event is the
Ouroboros, and the circle guard stops it re-entering its own descendant — so
every chain terminates at depth 1 or 2. `tiefe` and `ketten` are insurance
against a crest that does not exist yet.

That is not an argument for deleting them. It is an argument for saying plainly
that they are **unproven**, rather than listing them as covered. When a
future crest generates events from inside events, these two become live rules
overnight, and the fixtures will need to grow with it.

## 9. Building the crest fixtures took three attempts

Worth recording, because each attempt looked finished.

**First: a bare force calculation.** Clean, fast, and a nearly empty net — a
force calculation fires 3 of the 18 events, so **10 of 50 crests** did anything
at all. Everything listening for deployment, exchange, round start, a hit or a
victory slept, and the fixtures were green without measuring.

**Second: a scripted combat.** 47 of 50. Three crests still never ignited —
and all three were gaps in the *script*, not dead crests: `pflugschar` needs
the combat to end, `verwuester` needs overkill, and `muehlrad` never fired
because deploying onto five towers spends all five momentum, leaving none to
exchange with.

**Third: five combat shapes.** Long, victory, defeat, sealed and swapped. 50 of
50, every crest ignites, and the commander rules finally exercise `siegel`.

The lesson is the same one as the weighted fallback: a fixture that runs
without exercising the thing it names is worse than no fixture, because it
reports confidence.
