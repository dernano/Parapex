import type { BranchId, CombatState } from '@/core/types';
import { GAME_REGISTRY } from '@/content/crests/registry';
import { resolve } from '@/crests/CrestPipeline';
import type { CrestEventName, Ignition } from '@/crests/types';
import {
  buildTableau, cardsFromTowers, recogniseFormations, volleyCount,
} from '@/simulation/FormationEngine';
import { currentForce, performAction } from '@/simulation/CombatEngine';
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/rendering/artRules';
import { ArtRegister } from '@/rendering/artHooks';
import { BattlefieldRenderer } from '@/rendering/PixiRenderer';
import {
  buildBattlefieldScene, garrisonAnchors, type FloatingLabel, type FlyingProjectile,
} from '@/rendering/SceneGraph';
import {
  NO_DRAG, dragAt, dropGhost, dropTargets, type DragState,
} from '@/rendering/hud/dropTargets';
import { previewCaption, previewFormations } from '@/rendering/formations/formationPresentation';
import type { HandSort } from '@/rendering/hud/layout';
import { deployCost } from '@/simulation/CombatEngine';
import { rejectionMessage } from '@/content/combat/rejections';
import { shakenCamera } from '@/rendering/effects/cameraResponse';
import { compress, emptyField, step, type ParticleField } from '@/rendering/effects/particles';
import { emptyScars, stepScars, type ScarField } from '@/rendering/effects/groundScars';
import { presentFormation } from '@/rendering/formations/formationPresentation';
import { fieldJourney, journeyLine, replayChain, reversedOrder, valueUnderOrder }
  from '@/rendering/crests/crestChain';
import { presentIgnitions } from '@/rendering/crests/triggerProfiles';
import { DEFAULT_RACK_GEOMETRY, crestRackLayout } from '@/rendering/crests/crestRack';
import { hudLayout } from '@/rendering/hud/layout';
import { PerfMeter, perfLine } from '@/rendering/perf';
import {
  UNIT_SCALE_PROBES, withReducedMotion, type PresentationSettings,
} from '@/rendering/presentation/settings';
import { SalvoDirector } from '@/rendering/presentation/SalvoDirector';
import { originFor } from '@/rendering/WorldTransform';
import {
  CREST_PRESETS, DEFAULT_BENCH, buildState, targetPoint,
  type Bench, type CrestPreset, type TargetSide,
} from './bench';
import { benchHand as freshHand } from './bench';
import { hudSignature, renderHud } from './hudView';
import { MOTIF_CSS, playMotifs, seekMotifs } from './crestMotifs';

/**
 * THE VISUAL WORKBENCH.
 *
 * It drives the real renderer with the real scene graph, the real unit visual
 * definitions, the real firing functions, the real particle system and the
 * real salvo director. There is no second implementation on this page. If
 * something looks wrong here it looks wrong in the game, and if it is fixed
 * here it is fixed in the game.
 *
 * What it exists for is ONE distinction: art problem, presentation problem,
 * engine problem, or interaction problem. Every control narrows that question,
 * and every overlay turns "it looks wrong" into a measurement.
 */

const canvas = document.getElementById('world') as HTMLCanvasElement;
const hudHost = document.getElementById('hud') as HTMLElement;
const readout = document.getElementById('readout') as HTMLElement;

/* The eight motifs need their keyframes; they live with the code that uses them. */
const motifStyle = document.createElement('style');
motifStyle.textContent = MOTIF_CSS;
document.head.append(motifStyle);

/* The motifs draw over the rack, above the HUD and below nothing. */
const motifHost = document.createElement('div');
motifHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
hudHost.after(motifHost);
motifHost.style.zIndex = '5';

const camera = originFor(STAGE_WIDTH, STAGE_HEIGHT);
const art = new ArtRegister('development');
const meter = new PerfMeter(120);
const renderer = await BattlefieldRenderer.create({
  canvas, width: STAGE_WIDTH, height: STAGE_HEIGHT, scale: 1, art,
});
canvas.style.width = `${STAGE_WIDTH}px`;
canvas.style.height = `${STAGE_HEIGHT}px`;

let bench: Bench = DEFAULT_BENCH;
let state: CombatState = buildState(bench);
let director: SalvoDirector | null = null;
/** Idle smoke and dust, so the field is never a still life between salvos. */
let ambient: ParticleField = emptyField('ambient');
/** The earth remembers between salvos. That is the whole point of a scar. */
let earth: ScarField = emptyScars();
let formationSince = 0;
let ticker = 'Bereit.';
/** The harness drives time itself; the animation frame must not also do it. */
let manual = false;

/* The hand, the sort and the card in the air. */
let hand = freshHand();
let sort: HandSort = 'drawn';
let hovered: number | null = null;
let drag: DragState = NO_DRAG;
let dragCard: number | null = null;
let preview = '';
let hudDrawn = '';

/* ============================================================
 *  The panel
 * ============================================================ */

interface Choice<T> { readonly label: string; readonly value: T }

function group<T>(
  id: string,
  choices: readonly Choice<T>[],
  current: () => T,
  pick: (value: T) => void,
): void {
  const host = document.getElementById(id);
  if (!host) return;
  host.replaceChildren();
  for (const choice of choices) {
    const button = document.createElement('button');
    button.textContent = choice.label;
    button.setAttribute('aria-pressed', String(current() === choice.value));
    button.addEventListener('click', () => { pick(choice.value); refresh(); });
    host.append(button);
  }
}

function checks(
  id: string,
  entries: readonly { readonly key: string; readonly label: string;
    readonly on: boolean; readonly set: (on: boolean) => void }[],
): void {
  const host = document.getElementById(id);
  if (!host) return;
  host.replaceChildren();
  for (const entry of entries) {
    const label = document.createElement('label');
    label.className = 'check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = entry.on;
    box.addEventListener('change', () => { entry.set(box.checked); refresh(); });
    label.append(box, document.createTextNode(entry.label));
    host.append(label);
  }
}

const set = (patch: Partial<Bench>): void => {
  bench = { ...bench, ...patch };
  rebuild();
};

const setSettings = (patch: Partial<PresentationSettings>): void => {
  bench = { ...bench, settings: { ...bench.settings, ...patch } };
};

function rebuild(): void {
  motifHost.replaceChildren();
  state = buildState(bench);
  director = null;
  ambient = emptyField('ambient');
  earth = emptyScars();
  formationSince = performance.now() / 1000;
  ticker = 'Bereit.';
  hand = freshHand();
  drag = NO_DRAG;
  dragCard = null;
  hovered = null;
  preview = '';
  art.clear();
  meter.reset();
}

function buildPanel(): void {
  group<BranchId>('family', [
    { label: 'Bogen', value: 'bow' },
    { label: 'Armbrust', value: 'crossbow' },
    { label: 'Artillerie', value: 'artillery' },
    { label: 'Kanone', value: 'gunner' },
  ], () => bench.family, family => set({ family }));

  group<number>('tier', [
    { label: 'Rang 1', value: 1 },
    { label: 'Rang 5', value: 5 },
    { label: 'Rang 9', value: 9 },
    { label: 'Rang 13', value: 13 },
  ], () => bench.rank, rank => set({ rank }));

  group<number>('scale', UNIT_SCALE_PROBES.map(scale => ({
    label: `${Math.round(scale * 100)} %`, value: scale,
  })), () => bench.settings.unitScale, unitScale => setSettings({ unitScale }));

  group<TargetSide>('target', [
    { label: 'links', value: 'left' },
    { label: 'Mitte', value: 'centre' },
    { label: 'rechts', value: 'right' },
  ], () => bench.target, target => set({ target }));

  group<number>('volleys', [1, 3, 10, 30, 100, 1000].map(value => ({
    label: String(value), value,
  })), () => bench.volleys, volleys => { bench = { ...bench, volleys }; });

  group<boolean>('formation', [
    { label: 'fünf Stellungen', value: true },
    { label: 'zwei Stellungen', value: false },
  ], () => bench.formation, formation => set({ formation }));

  group<CrestPreset>('crests',
    (Object.keys(CREST_PRESETS) as CrestPreset[]).map(key => ({
      label: CREST_PRESETS[key].label, value: key,
    })), () => bench.crests, crests => set({ crests }));

  group<number>('powder', [0, 5, 10, 50].map(value => ({
    label: String(value), value,
  })), () => bench.powder, powder => set({ powder }));

  group<HandSort>('sortOrder', [
    { label: 'gezogen', value: 'drawn' },
    { label: 'Rang', value: 'rank' },
    { label: 'Gattung', value: 'branch' },
  ], () => sort, next => { sort = next; });

  checks('effects', [
    ['smoke', 'Rauch'], ['dust', 'Staub'], ['flash', 'Mündungsfeuer'],
    ['debris', 'Splitter'], ['sparks', 'Funken'], ['shake', 'Kamera'],
    ['floatingText', 'Zahlen'], ['shotShadows', 'Flugschatten'],
  ].map(([key, label]) => ({
    key: key!, label: label!,
    on: bench.settings.effects[key as keyof typeof bench.settings.effects],
    set: (on: boolean) => setSettings({
      effects: { ...bench.settings.effects, [key as string]: on },
    }),
  })).concat([{
    key: 'reducedMotion', label: 'reduzierte Bewegung',
    on: bench.settings.reducedMotion,
    set: (on: boolean) => setSettings({ reducedMotion: on }),
  }]));

  checks('debug', [
    ['anchors', 'Ankerpunkte'], ['sockets', 'Mündungssockel'],
    ['worldVectors', 'Weltvektoren'], ['layers', 'Ebenen'],
    ['bounds', 'Begrenzungen'], ['fps', 'Bildrate'],
    ['spriteCount', 'Sprite-Anzahl'], ['queue', 'Warteschlange'],
    ['missingArt', 'fehlende Grafik'],
  ].map(([key, label]) => ({
    key: key!, label: label!,
    on: bench.settings.debug[key as keyof typeof bench.settings.debug],
    set: (on: boolean) => setSettings({
      debug: { ...bench.settings.debug, [key as string]: on },
    }),
  })));
}

const refresh = (): void => { buildPanel(); };

document.getElementById('fire')?.addEventListener('click', () => fire());
document.getElementById('reset')?.addEventListener('click', () => { rebuild(); refresh(); });

/* ============================================================
 *  Firing
 * ============================================================ */

function fire(): void {
  const settlement = currentForce(state, { registry: GAME_REGISTRY });
  /*
   * The workbench fires the number of volleys the PANEL asks for, not the
   * number the wall currently earns — that is the point of a workbench. The
   * damage is the real per-volley force times that count, so the numbers on
   * screen are the numbers the rules would produce.
   */
  director = new SalvoDirector({
    towers: state.towers,
    camera,
    settings: withReducedMotion(bench.settings),
    target: targetPoint(bench.target),
    scars: earth,
    // Tower three carries the family under examination, so it speaks first.
    towerOrder: [2, 0, 1, 3, 4],
    volleys: bench.volleys,
    damage: Math.round(settlement.perVolley * bench.volleys),
    seed: `salvo-${bench.volleys}-${bench.family}`,
  });
  ticker = `${director.plan.caption} · Stufe ${director.plan.tier.id}`
    + ` · ${director.shots.length} gezeichnete Schüsse`;

  showCrestMotifs();
}

/**
 * The rack, firing.
 *
 * A DRY RUN of the same event the rules send: the protocol that comes back is
 * exactly what the row would do, and asking it costs the player nothing — no
 * powder spent, nothing written to the combat log. Which matters, because the
 * interface asks this question every time anybody looks at the rack.
 */
function showCrestMotifs(): void {
  const settlement = currentForce(state, { registry: GAME_REGISTRY });

  /*
   * THE WHOLE ROUND'S EVENTS, in the order the rules report them.
   *
   * The first version asked only `volleyPlanned`, and the rack stayed almost
   * dark: four of the five crests in the demonstration chain listen to
   * `tableauRead` and never heard the question. A crest that ignites and shows
   * nothing is indistinguishable from a crest that is broken — so the
   * workbench replays the sequence a real volley produces instead of the one
   * event it happened to be convenient to ask.
   */
  const protocol: Ignition[] = [];
  let session = state.crests;
  const send = (event: CrestEventName, data: Record<string, unknown>): void => {
    const result = resolve(GAME_REGISTRY, session, event, data, { dryRun: true });
    session = result.session;
    protocol.push(...result.protocol);
  };

  state.towers.forEach((tower, i) => {
    if (!tower.unit) return;
    send('tableauRead',
      { tower: i, rank: tower.unit.rank, branch: tower.unit.branch, copies: 0 });
  });
  send('formationsRecognised', { volleys: settlement.volleys, towers: state.towers });
  send('volleyPlanned', {
    perVolley: settlement.perVolley, volleys: settlement.volleys,
    factor: 1, bonus: 0, towers: state.towers,
  });
  send('volleyFired', { force: settlement.force, towers: state.towers });

  const layout = hudLayout({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
  const rack = crestRackLayout(state.crests.row, GAME_REGISTRY, state.crests, {
    ...DEFAULT_RACK_GEOMETRY,
    slotWidth: Math.floor((layout.rack.width - 4 * 14) / 5),
    slotHeight: layout.rack.height,
    gap: 14,
    originX: layout.rack.x,
    originY: layout.rack.y,
  });

  playMotifs(motifHost, rack, presentIgnitions(protocol), {
    // The supplies sit under the rack, in the ticker. A TRANSFER with no slot
    // to point at points there.
    shelf: { x: layout.ticker.x + 20, y: layout.ticker.y + 20 },
    reducedMotion: bench.settings.reducedMotion,
  });
}

/* ============================================================
 *  The frame
 * ============================================================ */

/* ============================================================
 *  Card to tower
 * ============================================================
 *
 * The interaction the player performs more than any other. Three things make
 * it feel solid rather than fiddly, and all three are decisions: the target is
 * the PLATFORM the soldier will stand on, the target is bigger than it looks,
 * and the answer — what this completes, what it displaces, what it costs —
 * arrives while the card is still in the air.
 */

/** Canvas pixels from a pointer event, at the renderer's own scale. */
function canvasPoint(event: PointerEvent): { x: number; y: number } {
  const box = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (STAGE_WIDTH / box.width),
    y: (event.clientY - box.top) * (STAGE_HEIGHT / box.height),
  };
}

function updateDrag(event: PointerEvent): void {
  const card = dragCard;
  if (card === null) return;
  const unit = hand[card];
  if (!unit) return;

  const targets = dropTargets(state.towers, camera);
  const at = canvasPoint(event);
  /*
   * The cost depends on the tower, and the tower depends on the pointer, so
   * the hit test runs first with a placeholder price and again with the real
   * one. Deploying onto an occupied emplacement REPLACES — one action, not
   * two — and `deployCost` is the only thing that knows what that costs.
   */
  const over = dragAt({ card, at, targets, cost: 0, momentum: state.momentum }).target;
  const cost = over ? deployCost(state, over.tower) : 1;
  drag = dragAt({ card, at, targets, cost, momentum: state.momentum });

  preview = drag.target
    ? previewCaption(previewFormations(state.towers,
      { unit, towerIndex: drag.target.tower }))
    : '';
}

hudHost.addEventListener('pointerdown', event => {
  const card = (event.target as HTMLElement)?.closest?.('.card') as HTMLElement | null;
  if (!card?.dataset.card) return;
  dragCard = Number(card.dataset.card);
  hovered = dragCard;
  hudHost.setPointerCapture(event.pointerId);
  updateDrag(event);
});

hudHost.addEventListener('pointermove', event => {
  if (dragCard === null) return;
  updateDrag(event);
});

hudHost.addEventListener('pointerup', event => {
  const card = dragCard;
  if (card === null) return;
  const unit = hand[card];
  updateDrag(event);
  if (unit && drag.phase === 'over' && drag.target) {
    const result = performAction(
      { ...state, hand: [...state.hand, unit] },
      { type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: drag.target.tower });
    if (result.ok) {
      state = result.state;
      hand = hand.filter((_, i) => i !== card);
      ticker = `${unit.displayName} auf Stellung ${drag.target.tower + 1}`
        + `${preview ? ` · ${preview}` : ''}`;
    } else {
      ticker = rejectionMessage(result);
    }
  }
  dragCard = null;
  hovered = null;
  drag = NO_DRAG;
  preview = '';
  try { hudHost.releasePointerCapture(event.pointerId); } catch { /* schon weg */ }
});

function drawFrame(dt: number): void {
  const settings = withReducedMotion(bench.settings);

  if (director) {
    director.advance(dt);
    // The marks in the earth survive the salvo that made them.
    earth = director.earth;
    if (director.done) director = null;
  } else {
    earth = stepScars(earth, dt);
  }
  ambient = compress(step(ambient, dt));

  const projectiles: readonly FlyingProjectile[] = director ? director.projectiles : [];
  const floating: readonly FloatingLabel[] = director ? director.floating : [];
  const particles = director
    ? [...ambient.particles, ...director.particles]
    : ambient.particles;

  const formations = recogniseFormations(buildTableau(cardsFromTowers(state.towers)));
  const anchors = garrisonAnchors(state.towers);
  const since = performance.now() / 1000 - formationSince;
  const formationNodes = formations.flatMap(f => presentFormation(f, anchors, since));

  const shaken = director
    ? shakenCamera(camera, director.cameraImpulses, director.elapsed, settings)
    : camera;

  const held = dragCard === null ? null : hand[dragCard] ?? null;
  const ghost = held ? dropGhost(drag, held, state.towers) : null;

  const scene = buildBattlefieldScene(state, shaken, projectiles, particles, {
    settings, formations: formationNodes, floating, ghost, scars: earth.scars,
  });
  renderer.render(scene, settings);
  renderer.setFlash(director ? director.flash : 0);

  const line = preview ? `${ticker}   ${preview}` : ticker;
  const hud = {
    combat: state, hand, sort, hovered,
    dragging: dragCard, ticker: line,
  };
  const signature = hudSignature(hud, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
  /*
   * Only when something changed. Rebuilding this DOM every frame killed the
   * sort animation — the element being animated was replaced sixty times a
   * second — and dropped the pointer target out from under a drag.
   */
  if (signature !== hudDrawn) {
    hudDrawn = signature;
    renderHud(hudHost, hud, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
  }

  meter.frame({
    ms: dt * 1000,
    sprites: renderer.spriteCount(),
    particles: particles.length,
  });
}

/* ============================================================
 *  The readout — where "it looks wrong" becomes a measurement
 * ============================================================ */

function writeReadout(): void {
  const debug = bench.settings.debug;
  const lines: string[] = [];
  const settlement = currentForce(state, { registry: GAME_REGISTRY });
  const formations = recogniseFormations(buildTableau(cardsFromTowers(state.towers)));

  if (debug.fps || debug.spriteCount) lines.push(perfLine(meter.report()));

  lines.push(`Wucht je Salve <b>${Math.round(settlement.perVolley)}</b>`
    + ` · Salven aus Formationen <b>${volleyCount(formations)}</b>`);
  lines.push(`Formationen: ${formations.length
    ? formations.map(f => `${f.displayName} +${f.volleys}`).join(', ')
    : '—'}`);

  if (director) {
    const plan = director.plan;
    lines.push(`Stufe <b>${plan.tier.id}</b> ${plan.tier.name}`
      + ` · ${plan.volleys} Salven → ${plan.drawn} Schüsse`
      + ` · ${plan.duration.toFixed(2)} s`);
    lines.push(`Eskalation: Rauch ×${plan.tier.escalation.smoke}`
      + ` · Wucht ×${plan.tier.escalation.impact}`
      + ` · gleichzeitig ${plan.tier.escalation.simultaneous}`
      + `${plan.tier.escalation.screenFlash ? ' · Lichtblitz' : ''}`
      + `${plan.tier.escalation.groundScar ? ' · Narben' : ''}`
      + `${plan.tier.escalation.continuousRoar ? ' · Dauerdonner' : ''}`);
    lines.push(`Erde: ${earth.scars.length} Narben`
      + ` · Feldbeleuchtung ${(director.flash * 100).toFixed(1)} %`);
    if (debug.queue) {
      lines.push(`Warteschlange <b>${director.pending}</b> von ${director.shots.length}`
        + ` · ${director.elapsed.toFixed(2)} s`
        + ` · letzter Einschlag ${director.lastImpactProfile ?? '—'}`);
    }
    const shown = director.damage.numbers.reduce((s, n) => s + n.value, 0);
    lines.push(`Schadenszahlen ${director.damage.numbers.length}`
      + ` · Summe <b>${shown.toLocaleString('de-DE')}</b>`
      + (director.damage.banner ? ` · Gesamt ${director.damage.banner.text}` : ''));
  }

  if (bench.crests !== 'none') lines.push(crestReadout());

  if (debug.missingArt) lines.push(art.line());

  readout.innerHTML = lines.join('\n');
}

/**
 * The crest chain, written out.
 *
 * `5 → 6 → 18` beside `umgekehrt 16`. That single pair of numbers is the
 * game's best idea made visible: the player is not collecting, they are
 * arranging, and the arrangement is worth two points of rank right there.
 */
function crestReadout(): string {
  const data = { tower: 2, rank: 5, branch: bench.family, copies: 0 };
  const result = resolve(GAME_REGISTRY, state.crests, 'tableauRead', { ...data },
    { dryRun: true });
  const replay = replayChain(result.protocol, data, GAME_REGISTRY);
  const journey = fieldJourney(replay, 'rank', 5);
  const reversed = valueUnderOrder(GAME_REGISTRY, state.crests, reversedOrder(),
    'tableauRead', data, 'rank');
  const profiles = presentIgnitions(result.protocol)
    .map(p => `${p.slot + 1}:${p.profile}${p.rejected ? `(${p.rejected})` : ''}`)
    .join(' ');

  return [
    `Kette (Rang 5): <b>${journeyLine(journey)}</b>`,
    `umgekehrte Reihenfolge ergäbe <b>${Number.isNaN(reversed) ? '—' : reversed}</b>`,
    `Profile: ${profiles || '—'}`,
    CREST_PRESETS[bench.crests].note,
  ].join('\n');
}

/* ============================================================
 *  Time
 * ============================================================ */

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!manual) {
    drawFrame(dt);
    writeReadout();
  }
  requestAnimationFrame(loop);
}

buildPanel();
rebuild();
refresh();
requestAnimationFrame(loop);

/* ============================================================
 *  The harness door
 * ============================================================
 *
 * The screenshot harness must be able to reproduce a named state EXACTLY, and
 * a picture taken at "about a second in" is not reproducible. So it takes time
 * over: fixed steps, no animation frame, no wall clock.
 */
declare global {
  interface Window {
    WERKBANK: {
      apply(patch: Partial<Bench>): void;
      fire(): void;
      settle(seconds: number): void;
      measure(frames: number): Record<string, unknown>;
      towerPoint(index: number): { x: number; y: number };
      cardPoint(index: number): { x: number; y: number } | null;
      report(): Record<string, unknown>;
    };
  }
}

window.WERKBANK = {
  /**
   * A named state is described relative to the DEFAULT, never to whatever the
   * last one left behind.
   *
   * The first version merged onto the current bench, and a run that took the
   * diagnostic shots first — which switch every effect off — then produced a
   * "sperrfeuer" picture with no smoke in it. The sprite count gave it away:
   * 660 in one run and 459 in the next, from the same description. A harness
   * whose output depends on the order its states were asked for is not a
   * harness.
   */
  apply(patch: Partial<Bench>): void {
    manual = true;
    bench = {
      ...DEFAULT_BENCH,
      ...patch,
      settings: {
        ...DEFAULT_BENCH.settings,
        ...patch.settings,
        effects: { ...DEFAULT_BENCH.settings.effects, ...patch.settings?.effects },
        debug: { ...DEFAULT_BENCH.settings.debug, ...patch.settings?.debug },
      },
    };
    rebuild();
    refresh();
    drawFrame(0);
    writeReadout();
  },
  fire(): void {
    manual = true;
    fire();
  },
  settle(seconds: number): void {
    manual = true;
    const dt = 1 / 60;
    // Advance without drawing: only the last frame is photographed, and
    // rendering 180 intermediate frames would make a screenshot take a second.
    for (let t = 0; t < seconds - dt; t += dt) {
      if (director) {
        director.advance(dt);
        earth = director.earth;
        if (director.done) director = null;
      } else {
        earth = stepScars(earth, dt);
      }
      ambient = compress(step(ambient, dt));
    }
    formationSince = performance.now() / 1000 - seconds;
    // The rack seeks to the same moment. Otherwise it would be the one thing
    // in the picture running on the wall clock.
    seekMotifs(motifHost, seconds);
    drawFrame(dt);
    writeReadout();
  },
  /**
   * The real cost of a frame.
   *
   * `settle` deliberately advances WITHOUT drawing, so the picture arrives in
   * one render and a screenshot does not take a second. That makes its frame
   * timings meaningless — a budget read off it would be a budget measured on
   * one frame. This draws every frame and times the draw, which is the number
   * the question was actually about.
   */
  measure(frames: number): Record<string, unknown> {
    manual = true;
    /*
     * A meter as wide as the run, so the OPENING frames are in the figures.
     * The rolling window exists for the live overlay; using it here would drop
     * exactly the frames where a salvo builds a hundred and fifty new sprites
     * at once, which are the only ones anybody is worried about.
     */
    const run = new PerfMeter(Math.max(1, frames));
    const dt = 1 / 60;
    for (let i = 0; i < frames; i++) {
      const before = performance.now();
      if (director) {
        director.advance(dt);
        earth = director.earth;
        if (director.done) director = null;
      } else {
        earth = stepScars(earth, dt);
      }
      ambient = compress(step(ambient, dt));
      const settings = withReducedMotion(bench.settings);
      const projectiles = director ? director.projectiles : [];
      const particles = director
        ? [...ambient.particles, ...director.particles] : ambient.particles;
      const formations = recogniseFormations(buildTableau(cardsFromTowers(state.towers)));
      const anchors = garrisonAnchors(state.towers);
      const nodes = formations.flatMap(f => presentFormation(f, anchors, 9, camera));
      const shaken = director
        ? shakenCamera(camera, director.cameraImpulses, director.elapsed, settings)
        : camera;
      renderer.render(buildBattlefieldScene(state, shaken, projectiles, particles, {
        settings, formations: nodes, floating: director ? director.floating : [],
        scars: earth.scars,
      }), settings);
      renderer.setFlash(director ? director.flash : 0);
      run.frame({
        ms: performance.now() - before,
        sprites: renderer.spriteCount(),
        particles: particles.length,
      });
    }
    writeReadout();
    return { ...run.report(), line: perfLine(run.report()) };
  },

  /**
   * Where a tower's platform is, in PAGE pixels.
   *
   * The harness needs this to drive a real drag: synthetic pointer events have
   * to land where a person would aim, or the test proves only that the code
   * accepts coordinates it made up itself.
   */
  towerPoint(index: number): { x: number; y: number } {
    const target = dropTargets(state.towers, camera)[index];
    const box = canvas.getBoundingClientRect();
    if (!target) return { x: box.left, y: box.top };
    return {
      x: box.left + target.screen.x * (box.width / STAGE_WIDTH),
      y: box.top + target.screen.y * (box.height / STAGE_HEIGHT),
    };
  },

  cardPoint(index: number): { x: number; y: number } | null {
    const card = hudHost.querySelector(`.card[data-card="${index}"]`);
    if (!card) return null;
    const box = card.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  },

  report(): Record<string, unknown> {
    return {
      bench,
      sprites: renderer.spriteCount(),
      missing: art.report().map(m => m.path),
      perf: meter.report(),
      plan: director ? { tier: director.plan.tier.id, drawn: director.plan.drawn } : null,
      hand: hand.map(u => u.id),
      garrison: state.towers.map(t => t.unit?.id ?? null),
      momentum: state.momentum,
      ticker,
    };
  },
};
