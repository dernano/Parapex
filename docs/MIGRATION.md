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
| 2 | **Recursion guards** | Depth 6 / 12 per slot / 60 per event / 24 chains / circle detection. Off-by-one here changes late-run damage by orders of magnitude. | Fixtures that deliberately hit every guard, asserting the rejection reason. |
| 3 | **Singleton → passed state** | ~80 functions currently read an ambient binding. A missed one reads stale state and silently diverges. | Do it mechanically per module, with the legacy suite green after each; the ambient binding stays until its last reader is gone. |
| 4 | **Removing `probe`** | Every call site must be classified as ask-or-apply. Getting one wrong burns resources during a hover. | The new engine cannot mutate at all, so a miscall is a type error, not a bug. |
| 5 | **Shared tower objects** | Splitting rules and rendering into two objects can let them drift. | Renderer holds only `towerIndex`; it never owns tower data. |
| 6 | **`k.wappen === band.reihe`** | Copying the array breaks reordering; not copying leaks mutation. | One owner (`CombatState.crests`), pipeline receives it as a parameter. |
| 7 | **Seeded RNG** | Seeding *changes every draw*. Run-level golden fixtures cannot be compared across the change. | Seed first, regenerate run-level fixtures, then migrate. Combat-level fixtures are RNG-free and stay valid. |
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
| **0 ✅** | Tag `legacy-baseline`, golden fixtures for force + formations | 25 fixtures written |
| **1 ✅** | npm, TypeScript 7, Vite 8, Vitest 5, PixiJS 8; `dev`/`build`/`test`/`typecheck` | build + tests green, legacy untouched |
| **2a ✅** | Vertical slice: units, towers, formations, force — typed, pure, proven | 27 parity tests |
| **2b** | Seeded `Rng`; deck, rewards, offers, encounters draw from it | run-level fixtures regenerated and stable across two runs of one seed |
| **2c** | `CombatState` as data; `performAction(state, action) → {state, events}` for deploy / replace / exchange / endRound | legacy combat suite reproduced against the new engine |
| **3** | Crest pipeline, typed events, recursion guards | per-crest and per-pair fixtures identical |
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
