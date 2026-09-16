import { GAME_REGISTRY } from '@/content/crests/registry';
import { logLine } from '@/content/combat/log';
import { rejectionMessage } from '@/content/combat/rejections';
import type { Act } from '@/core/acts';
import { isSpectacle } from '@/core/acts';
import type { CombatEvent, CombatState, Unit } from '@/core/types';
import { resolve } from '@/crests/CrestPipeline';
import type { CrestEventName, Ignition } from '@/crests/types';
import { currentForce, deployCost, performAction } from '@/simulation/CombatEngine';
import {
  buildTableau, cardsFromTowers, recogniseFormations,
} from '@/simulation/FormationEngine';
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/rendering/artRules';
import { ArtRegister } from '@/rendering/artHooks';
import { BattlefieldRenderer } from '@/rendering/PixiRenderer';
import {
  buildBattlefieldScene, garrisonAnchors, type FloatingLabel, type FlyingProjectile,
} from '@/rendering/SceneGraph';
import { shakenCamera } from '@/rendering/effects/cameraResponse';
import { compress, emptyField, step, type ParticleField } from '@/rendering/effects/particles';
import { emptyScars, stepScars, type ScarField } from '@/rendering/effects/groundScars';
import { presentFormation } from '@/rendering/formations/formationPresentation';
import { crestRackLayout, DEFAULT_RACK_GEOMETRY } from '@/rendering/crests/crestRack';
import { hudLayout, type HandSort } from '@/rendering/hud/layout';
import {
  NO_DRAG, dragAt, dropGhost, dropTargets, type DragState,
} from '@/rendering/hud/dropTargets';
import { PerfMeter } from '@/rendering/perf';
import { withReducedMotion, type PresentationSettings } from '@/rendering/presentation/settings';
import { SalvoDirector } from '@/rendering/presentation/SalvoDirector';
import { originFor } from '@/rendering/WorldTransform';
import { actsFor } from './acts';
import { hudSignature, renderHud } from './hudView';
import { applyMotifs, buildMotifs } from './motifView';

/**
 * THE COMBAT SCREEN.
 *
 * One state, one renderer, one queue of acts. The whole arrangement is a
 * loop with three beats:
 *
 *   input → `performAction` → events → acts → the director plays them
 *
 * and the only arrow that ever points backwards is the player's next click.
 * The screen never reaches into the state to decide what to show, and nothing
 * it shows can change what happened: by the time an act is played, the
 * outcome it describes already exists.
 *
 * WHILE AN ACT IS PLAYING, INPUT IS LOCKED. Not because the rules need it —
 * they finished long ago — but because a player who deploys a second card
 * while the first is still arriving has lost track of which shot belonged to
 * which decision, and the game becomes a slot machine.
 */

export interface CombatScreenOptions {
  readonly canvas: HTMLCanvasElement;
  readonly hud: HTMLElement;
  readonly motifs: HTMLElement;
  readonly initial: CombatState;
  readonly settings: PresentationSettings;
}

export class CombatScreen {
  private state: CombatState;
  private settings: PresentationSettings;

  private readonly canvas: HTMLCanvasElement;
  private readonly hudHost: HTMLElement;
  private readonly motifHost: HTMLElement;
  private readonly renderer: BattlefieldRenderer;
  private readonly art = new ArtRegister('development');
  private readonly meter = new PerfMeter(120);
  private readonly camera = originFor(STAGE_WIDTH, STAGE_HEIGHT);

  /** Acts waiting to be played, oldest first. */
  private queue: Act[] = [];
  private director: SalvoDirector | null = null;
  private motifs: ReturnType<typeof buildMotifs> = [];
  private noteUntil = 0;
  private clock = 0;

  private ambient: ParticleField = emptyField('ambient');
  private earth: ScarField = emptyScars();
  private formationSince = 0;

  private sort: HandSort = 'drawn';
  private hovered: number | null = null;
  private dragCard: number | null = null;
  private drag: DragState = NO_DRAG;
  private preview = '';
  private ticker = '';
  private hudDrawn = '';
  private selection = new Set<string>();

  private constructor(options: CombatScreenOptions, renderer: BattlefieldRenderer) {
    this.canvas = options.canvas;
    this.hudHost = options.hud;
    this.motifHost = options.motifs;
    this.state = options.initial;
    this.settings = options.settings;
    this.renderer = renderer;
    this.ticker = `Runde ${this.state.round}`;
  }

  static async create(options: CombatScreenOptions): Promise<CombatScreen> {
    const renderer = await BattlefieldRenderer.create({
      canvas: options.canvas, width: STAGE_WIDTH, height: STAGE_HEIGHT, scale: 1,
    });
    const screen = new CombatScreen(options, renderer);
    screen.bindPointer();
    return screen;
  }

  /* ---------- What the outside may ask ---------- */

  get combat(): CombatState { return this.state; }
  /** True while something is being played and input is refused. */
  get busy(): boolean { return Boolean(this.director) || this.clock < this.noteUntil; }
  get log(): string { return this.ticker; }

  setSort(sort: HandSort): void { this.sort = sort; }
  setSettings(settings: PresentationSettings): void { this.settings = settings; }

  /** Whether a card is picked out for exchanging. */
  toggleSelection(uid: string): void {
    if (this.busy) return;
    if (this.selection.has(uid)) this.selection.delete(uid);
    else this.selection.add(uid);
  }

  get selected(): readonly string[] { return [...this.selection]; }

  exchange(): void {
    if (this.busy || !this.selection.size) return;
    this.dispatch({ type: 'EXCHANGE_CARDS', cardUids: [...this.selection] });
    this.selection.clear();
  }

  endRound(): void {
    if (this.busy) return;
    this.dispatch({ type: 'END_ROUND' });
  }

  /* ---------- The one door into the rules ---------- */

  /**
   * Every action goes through here, and every action produces acts.
   *
   * A refusal is shown as a sentence and changes nothing — the state is not
   * replaced, so a refused move cannot half-happen.
   */
  private dispatch(action: Parameters<typeof performAction>[1]): void {
    const result = performAction(this.state, action);
    if (!result.ok) {
      this.ticker = rejectionMessage(result);
      return;
    }
    this.state = result.state;
    this.queue.push(...actsFor(result.events));
    this.playNext();
  }

  private playNext(): void {
    if (this.director) return;
    const act = this.queue.shift();
    if (!act) return;

    this.ticker = logLine(act);
    if (!isSpectacle(act)) {
      // Something to read, not to watch. It still takes a beat, so a burst of
      // them does not flash past.
      this.noteUntil = this.clock + 0.45;
      return;
    }

    /*
     * A deployment is a one-volley salvo from one emplacement; a round's
     * volley is the whole wall. Both go through the same director, which is
     * why a free shot and a bombardment share their smoke, their impacts and
     * their numbers instead of being two systems that drift apart.
     */
    const volleys = act.kind === 'volley' ? act.settlement.volleys : 1;
    const towerOrder = act.kind === 'deployment'
      ? [act.tower]
      : this.state.towers.map((_, i) => i);

    this.director = new SalvoDirector({
      towers: this.state.towers,
      camera: this.camera,
      settings: withReducedMotion(this.settings),
      target: { col: 18, row: 10 },
      scars: this.earth,
      towerOrder,
      volleys,
      damage: act.damage,
      seed: `r${this.state.round}-${this.queue.length}-${volleys}`,
      crestProtocol: act.kind === 'volley' ? this.crestProtocol() : [],
    });

    this.motifs = buildMotifs(this.motifHost, this.rack(), this.director.crestMotifs, {
      shelf: { x: this.layout().ticker.x + 20, y: this.layout().ticker.y + 20 },
    });
  }

  /* ---------- Input ---------- */

  private bindPointer(): void {
    this.hudHost.addEventListener('pointerdown', event => {
      if (this.busy) return;
      const card = (event.target as HTMLElement)?.closest?.('.card') as HTMLElement | null;
      if (!card?.dataset.card) return;
      this.dragCard = Number(card.dataset.card);
      this.hovered = this.dragCard;
      this.hudHost.setPointerCapture(event.pointerId);
      this.updateDrag(event);
    });

    this.hudHost.addEventListener('pointermove', event => {
      if (this.dragCard === null) return;
      this.updateDrag(event);
    });

    this.hudHost.addEventListener('pointerup', event => {
      const card = this.dragCard;
      if (card === null) return;
      const unit = this.state.hand[card];
      this.updateDrag(event);

      if (unit && this.drag.phase === 'over' && this.drag.target) {
        this.dispatch({
          type: 'DEPLOY_UNIT', cardUid: unit.uid, towerIndex: this.drag.target.tower,
        });
      } else if (unit && this.drag.phase === 'lifted') {
        // Picked up and put back: treat it as choosing the card for exchange.
        this.toggleSelection(unit.uid);
      }

      this.dragCard = null;
      this.hovered = null;
      this.drag = NO_DRAG;
      this.preview = '';
      try { this.hudHost.releasePointerCapture(event.pointerId); } catch { /* schon weg */ }
    });
  }

  private updateDrag(event: PointerEvent): void {
    const card = this.dragCard;
    if (card === null) return;
    const unit = this.state.hand[card];
    if (!unit) return;

    const targets = dropTargets(this.state.towers, this.camera);
    const box = this.canvas.getBoundingClientRect();
    const at = {
      x: (event.clientX - box.left) * (STAGE_WIDTH / box.width),
      y: (event.clientY - box.top) * (STAGE_HEIGHT / box.height),
    };
    const over = dragAt({ card, at, targets, cost: 0, momentum: this.state.momentum }).target;
    const cost = over ? deployCost(this.state, over.tower) : 1;
    this.drag = dragAt({ card, at, targets, cost, momentum: this.state.momentum });
    this.preview = this.drag.target ? this.previewFor(unit, this.drag.target.tower) : '';
  }

  /**
   * What the drop would be worth — with the CRESTS in it.
   *
   * `previewDeployment` runs the whole calculation as a dry run, so the number
   * the player sees while the card is in the air is the number they will get,
   * not an estimate that ignores half their rack.
   */
  private previewFor(unit: Unit, tower: number): string {
    const now = currentForce(this.state, { registry: GAME_REGISTRY });
    const hypothetical = this.state.towers.map((t, i) => (i === tower ? { ...t, unit } : t));
    const after = recogniseFormations(buildTableau(cardsFromTowers(hypothetical)));
    const gained = after
      .filter(f => !now.formations.some(g => g.id === f.id))
      .map(f => `+ ${f.displayName}`);
    const lost = now.formations
      .filter(f => !after.some(g => g.id === f.id))
      .map(f => `− ${f.displayName}`);
    return [...gained, ...lost].join('   ');
  }

  /* ---------- Time ---------- */

  advance(dt: number): void {
    this.clock += dt;
    const settings = withReducedMotion(this.settings);

    if (this.director) {
      this.director.advance(dt);
      this.earth = this.director.earth;
      if (this.director.done) {
        this.director = null;
        this.motifHost.replaceChildren();
        this.motifs = [];
        this.playNext();
      }
    } else {
      this.earth = stepScars(this.earth, dt);
      if (this.clock >= this.noteUntil) this.playNext();
    }
    this.ambient = compress(step(this.ambient, dt));

    const projectiles: readonly FlyingProjectile[] = this.director
      ? this.director.projectiles : [];
    const floating: readonly FloatingLabel[] = this.director ? this.director.floating : [];
    const particles = this.director
      ? [...this.ambient.particles, ...this.director.particles]
      : this.ambient.particles;

    const formations = recogniseFormations(buildTableau(cardsFromTowers(this.state.towers)));
    if (formations.length && !this.formationSince) this.formationSince = this.clock;
    if (!formations.length) this.formationSince = 0;
    const anchors = garrisonAnchors(this.state.towers);
    const formationNodes = formations.flatMap(f =>
      presentFormation(f, anchors, this.clock - this.formationSince, this.camera));

    const held = this.dragCard === null ? null : this.state.hand[this.dragCard] ?? null;
    const ghost = held ? dropGhost(this.drag, held, this.state.towers) : null;

    const camera = this.director
      ? shakenCamera(this.camera, this.director.cameraImpulses, this.director.elapsed, settings)
      : this.camera;

    this.renderer.render(buildBattlefieldScene(
      this.state, camera, projectiles, particles,
      { settings, formations: formationNodes, floating, ghost, scars: this.earth.scars },
    ), settings);
    this.renderer.setFlash(this.director ? this.director.flash : 0);
    applyMotifs(this.motifs, this.director ? this.director.crestFrames() : []);

    this.drawHud();
    this.meter.frame({
      ms: dt * 1000, sprites: this.renderer.spriteCount(), particles: particles.length,
    });
  }

  private drawHud(): void {
    const hud = {
      combat: this.state,
      hand: this.state.hand,
      sort: this.sort,
      hovered: this.hovered,
      dragging: this.dragCard,
      ticker: this.preview ? `${this.ticker}   ${this.preview}` : this.ticker,
    };
    const signature = hudSignature(hud, { width: STAGE_WIDTH, height: STAGE_HEIGHT })
      + `|${[...this.selection].sort().join(',')}|${this.busy}`;
    if (signature === this.hudDrawn) return;
    this.hudDrawn = signature;
    renderHud(this.hudHost, hud, { width: STAGE_WIDTH, height: STAGE_HEIGHT });

    // Chosen cards read as chosen, and everything is inert while an act runs.
    for (const node of Array.from(this.hudHost.querySelectorAll('.card'))) {
      const element = node as HTMLElement;
      const index = Number(element.dataset.card);
      const unit = this.state.hand[index];
      if (unit && this.selection.has(unit.uid)) element.classList.add('chosen');
      if (this.busy) element.classList.add('locked');
    }
  }

  /* ---------- Bits both the screen and the rack need ---------- */

  private layout() {
    return hudLayout({ width: STAGE_WIDTH, height: STAGE_HEIGHT });
  }

  private rack() {
    const layout = this.layout();
    return crestRackLayout(this.state.crests.row, GAME_REGISTRY, this.state.crests, {
      ...DEFAULT_RACK_GEOMETRY,
      slotWidth: Math.floor((layout.rack.width - 4 * 14) / 5),
      slotHeight: layout.rack.height,
      gap: 14,
      originX: layout.rack.x,
      originY: layout.rack.y,
    });
  }

  /**
   * What the rack does for this volley, as a DRY RUN.
   *
   * The real resolution already happened inside `performAction`; this asks the
   * same question again only to find out what to draw. It costs nothing — no
   * powder, no protocol entry — which is why the screen may ask it freely.
   */
  private crestProtocol(): readonly Ignition[] {
    const settlement = currentForce(this.state, { registry: GAME_REGISTRY });
    const protocol: Ignition[] = [];
    let session = this.state.crests;
    const send = (event: CrestEventName, data: Record<string, unknown>): void => {
      const result = resolve(GAME_REGISTRY, session, event, data, { dryRun: true });
      session = result.session;
      protocol.push(...result.protocol);
    };

    this.state.towers.forEach((tower, i) => {
      if (!tower.unit) return;
      send('tableauRead',
        { tower: i, rank: tower.unit.rank, branch: tower.unit.branch, copies: 0 });
    });
    send('volleyPlanned', {
      perVolley: settlement.perVolley, volleys: settlement.volleys,
      factor: 1, bonus: 0, towers: this.state.towers,
    });
    return protocol;
  }

  /** Everything still owed a drawing. For the corner of a development build. */
  missingArt(): readonly string[] {
    return this.art.report().map(m => m.path);
  }

  destroy(): void {
    this.renderer.destroy();
  }
}

export type { CombatEvent };
