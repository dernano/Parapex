import type { BranchId, Tower } from '@/core/types';
import { Rng } from '@/simulation/Rng';
import { placeholderFor } from '../placeholderAtlas';
import {
  emit, impactEmitter, muzzleEmitter,
} from '../effects/emitters';
import {
  compress, emptyField, step, type ParticleField,
} from '../effects/particles';
import {
  impulseFor, type CameraImpulse,
} from '../effects/cameraResponse';
import {
  MAGNITUDE_STYLE, planDamageNumbers, type DamagePresentation,
} from '../effects/damagePresentation';
import {
  planSalvo, scheduleShots, type DrawnShot, type SalvoPlan,
} from '../effects/salvoPresentation';
import {
  addScar, emptyScars, stepScars, type Scar, type ScarField,
} from '../effects/groundScars';
import {
  flashAt, flashEndsAt, flashWindow, type FlashWindow,
} from '../effects/screenFlash';
import { firingDuration, visualFor, type UnitVisualDefinition } from '../units/UnitVisual';
import { poseAt, projectileAt, socketWorld, type Pose } from '../units/firing';
import { towerGroundAnchor } from '../SceneGraph';
import type { FloatingLabel, FlyingProjectile } from '../SceneGraph';
import { fireDirection, type Camera, type WorldPoint } from '../WorldTransform';
import { heightBandForRank } from '../artRules';
import type { PresentationSettings } from './settings';

/**
 * THE DIRECTOR: one salvo, played out.
 *
 * It takes a decision the simulation has ALREADY MADE — this many volleys, this
 * much damage — and turns it into firing animations, projectiles, smoke,
 * impacts, camera kicks and numbers. It cannot change any of them. By the time
 * the first frame is drawn, every value in here was fixed.
 *
 * That separation is not decoration. It is why a tier E barrage can be
 * compressed into three seconds without the castle dealing less damage, and
 * why turning every effect off changes nothing but the picture.
 *
 * Driven by `advance(dt)` and nothing else: no timers, no requestAnimationFrame,
 * no audio. Which means the whole presentation runs in Node, and a test can ask
 * what the screen looks like 1.4 seconds in.
 */

interface ActiveGun {
  readonly tower: number;
  readonly branch: BranchId;
  readonly visual: UnitVisualDefinition;
  readonly anchor: WorldPoint;
  readonly shot: DrawnShot;
  /** When its firing sequence began, in director time. */
  readonly startedAt: number;
  fired: boolean;
}

interface Flight {
  readonly id: string;
  readonly visual: UnitVisualDefinition;
  readonly from: WorldPoint;
  readonly to: WorldPoint;
  readonly force: number;
  readonly shot: DrawnShot;
  /** Where it was last frame, so the sprite can face its own travel. */
  previous: WorldPoint;
  t: number;
}

export interface DirectorOptions {
  readonly towers: readonly Tower[];
  readonly camera: Camera;
  readonly settings: PresentationSettings;
  /** Where the castle is shooting. */
  readonly target: WorldPoint;
  readonly volleys: number;
  /** What the simulation says this salvo dealt. */
  readonly damage: number;
  /** What the earth already looks like. Scars outlive the salvo that made them. */
  readonly scars?: ScarField;
  /**
   * Which emplacement speaks first, and in what order after that. Defaults to
   * left-to-right along the wall. The workbench sets it so the family being
   * examined actually fires the single volley one is watching — without it,
   * choosing "Kanone" and firing once shows a longbow on tower one.
   */
  readonly towerOrder?: readonly number[];
  readonly seed?: string;
}

export class SalvoDirector {
  readonly plan: SalvoPlan;
  readonly shots: readonly DrawnShot[];
  readonly damage: DamagePresentation;

  private readonly options: DirectorOptions;
  private readonly guns: ActiveGun[] = [];
  private readonly flights: Flight[] = [];
  private readonly labels: FloatingLabel[] = [];
  private readonly impulses: CameraImpulse[] = [];
  private field: ParticleField;
  /** Marks in the earth. The one thing here that outlives its own salvo. */
  private scarField: ScarField = emptyScars();
  private readonly window: FlashWindow | null;
  /**
   * Where each shot actually aims.
   *
   * Its own generator, separate from the particle field's: scatter and smoke
   * must not shift each other's results, or changing a particle count would
   * silently move every crater.
   */
  private readonly aim: Rng;
  private time = 0;
  private started = 0;
  private shownNumbers = 0;
  private lastImpact: string | null = null;

  constructor(options: DirectorOptions) {
    this.options = options;
    this.plan = planSalvo(options.volleys);
    const manned = options.towers
      .map((tower, i) => ({ tower, i }))
      .filter(t => t.tower.unit)
      .map(t => t.i);
    const order = options.towerOrder
      ? [...options.towerOrder.filter(i => manned.includes(i)),
        ...manned.filter(i => !options.towerOrder!.includes(i))]
      : manned;
    this.shots = scheduleShots(this.plan, order);
    this.damage = planDamageNumbers(this.plan, this.shots, options.damage);
    this.field = emptyField(options.seed ?? 'salvo');
    this.aim = Rng.fromSeed(`${options.seed ?? 'salvo'}:aim`);
    this.window = flashWindow(this.plan,
      this.shots.length ? this.shots[this.shots.length - 1]!.at : 0);
    // Scars carried over from earlier salvos: the field does not start clean
    // just because this volley is new.
    if (options.scars) this.scarField = options.scars;
  }

  /* ---------- What the renderer asks for ---------- */

  get particles(): readonly import('../effects/particles').Particle[] {
    return this.field.particles;
  }

  get projectiles(): readonly FlyingProjectile[] {
    return this.flights.map(flight => ({
      id: flight.id,
      kind: flight.visual.projectile,
      at: projectileAt(flight.visual, flight.from, flight.to, flight.t),
      from: flight.previous,
    }));
  }

  get floating(): readonly FloatingLabel[] {
    return this.labels;
  }

  get cameraImpulses(): readonly CameraImpulse[] {
    return this.impulses;
  }

  get scars(): readonly Scar[] {
    return this.scarField.scars;
  }

  /** The field as it now stands, to be carried into the next salvo. */
  get earth(): ScarField {
    return this.scarField;
  }

  /**
   * How lit the whole field is, 0..1 as an alpha.
   *
   * A sustained wash, never a strobe — see `screenFlash.ts`. Tiers A to C
   * return zero, which is what makes tier D mean something.
   */
  get flash(): number {
    return flashAt(this.window, this.time, this.options.settings);
  }

  /** The poses, so the renderer can bend the bows it is drawing. */
  poses(): ReadonlyMap<number, Pose> {
    const out = new Map<number, Pose>();
    for (const gun of this.guns) {
      out.set(gun.tower, poseAt(gun.visual, this.time - gun.startedAt, {
        from: gun.anchor, to: this.options.target, camera: this.options.camera,
      }));
    }
    return out;
  }

  get elapsed(): number { return this.time; }

  /** The queue, draining. What the workbench's overlay shows. */
  get pending(): number { return this.shots.length - this.started; }

  /**
   * Finished when the last shot has landed and the last cloud has thinned.
   * NOT when the plan's nominal duration elapsed — a stone is still in the air
   * long after the machine that threw it has settled.
   */
  get done(): boolean {
    return this.started >= this.shots.length
      && !this.guns.length && !this.flights.length
      && !this.field.particles.length && !this.labels.length
      && this.time >= flashEndsAt(this.window);
  }

  /* ---------- The one method that moves time ---------- */

  advance(dt: number): void {
    const previous = this.time;
    this.time += dt;

    this.startDueShots();
    this.runGuns(previous);
    this.runFlights(dt);
    this.runLabels(dt);

    this.field = compress(step(this.field, dt));
    this.scarField = stepScars(this.scarField, dt);
  }

  private startDueShots(): void {
    while (this.started < this.shots.length && this.shots[this.started]!.at <= this.time) {
      const shot = this.shots[this.started]!;
      this.started++;
      const tower = this.options.towers[shot.tower];
      const unit = tower?.unit;
      if (!tower || !unit) continue;
      this.guns.push({
        tower: shot.tower,
        branch: unit.branch,
        visual: visualFor(unit.branch),
        anchor: towerGroundAnchor(shot.tower, tower.type),
        shot,
        startedAt: shot.at,
        fired: false,
      });
    }
  }

  private runGuns(previousTime: number): void {
    for (let i = this.guns.length - 1; i >= 0; i--) {
      const gun = this.guns[i]!;
      const now = this.time - gun.startedAt;
      const since = previousTime - gun.startedAt;
      const pose = poseAt(gun.visual, now, {
        from: gun.anchor, to: this.options.target,
        camera: this.options.camera, since,
      });

      if (pose.released && !gun.fired) {
        gun.fired = true;
        this.release(gun, pose);
      }

      // Gone once its recovery is over. The shot it fired lives on by itself.
      if (now > firingDuration(gun.visual)) this.guns.splice(i, 1);
    }
  }

  /**
   * The moment the projectile leaves the muzzle.
   *
   * Everything here starts AT THE SOCKET: the shot, the flash, the smoke. That
   * single fact is most of what makes a cannon read as a cannon rather than as
   * a soldier with an effect near him.
   */
  private release(gun: ActiveGun, pose: Pose): void {
    const unit = this.options.towers[gun.tower]?.unit;
    const sprite = placeholderFor(
      `unit/${gun.branch}/${heightBandForRank(unit?.rank ?? 5)}`,
      { scale: this.options.settings.unitScale },
    );
    const muzzle = socketWorld(gun.anchor, gun.visual.sockets.muzzle, sprite, pose,
      this.options.settings.unitScale);

    const direction = towardTarget(gun.anchor, this.options.target);
    this.field = emit(this.field, muzzleEmitter(gun.branch), {
      at: muzzle, direction,
      force: gun.shot.force,
      // The tier's escalation buys MORE smoke, never faster smoke.
      abundance: this.plan.tier.escalation.smoke,
      settings: this.options.settings,
    });

    this.flights.push({
      id: `shot-${gun.shot.index}`,
      visual: gun.visual,
      from: muzzle,
      to: this.scatter(),
      force: gun.shot.force,
      shot: gun.shot,
      previous: muzzle,
      t: 0,
    });
  }

  private runFlights(dt: number): void {
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i]!;
      flight.previous = projectileAt(flight.visual, flight.from, flight.to, flight.t);
      flight.t += dt;
      const at = projectileAt(flight.visual, flight.from, flight.to, flight.t);
      if (!at.done) continue;

      this.flights.splice(i, 1);
      this.land(flight, at);
    }
  }

  private land(flight: Flight, at: WorldPoint): void {
    this.field = emit(this.field, impactEmitter(flight.visual.projectile), {
      at: { col: at.col, row: at.row, height: 0 },
      direction: towardTarget(flight.from, flight.to),
      force: flight.force,
      abundance: this.plan.tier.escalation.impact,
      settings: this.options.settings,
    });
    this.lastImpact = flight.visual.projectile;

    /*
     * The earth keeps the mark. From tier C upward — below that a handful of
     * shots should leave the field as they found it, or the escalation has
     * nothing left to say.
     */
    if (this.plan.tier.escalation.groundScar) {
      this.scarField = addScar(this.scarField, at,
        flight.force * this.plan.tier.escalation.impact);
    }

    const screenDirection = fireDirection(flight.from, flight.to, this.options.camera);
    const impulse = impulseFor(this.plan, flight.shot, screenDirection);
    if (impulse) this.impulses.push({ ...impulse, at: this.time });
  }

  /**
   * The numbers rise on their own schedule, not on the impacts'.
   *
   * Deliberately: at tier D three towers land in the same instant and one
   * aggregated number stands for all three, so tying a number to an impact
   * would either show three or show none.
   */
  private runLabels(dt: number): void {
    while (this.shownNumbers < this.damage.numbers.length
      && this.damage.numbers[this.shownNumbers]!.at <= this.time) {
      const number = this.damage.numbers[this.shownNumbers]!;
      this.shownNumbers++;
      const style = MAGNITUDE_STYLE[number.magnitude];
      this.labels.push({
        id: number.id,
        // Indexed by WHICH number this is, not by how many happen to be alive:
        // using the live count reuses a position the moment one expires, and a
        // tier E salvo then stacked "11,5K" on top of "7.272".
        at: labelPoint(this.options.target, this.shownNumbers - 1),
        text: number.text,
        size: style.size,
        colour: number.aggregate ? '#ffd98a' : '#e3d2a4',
        progress: 0,
      });
    }

    for (let i = this.labels.length - 1; i >= 0; i--) {
      const label = this.labels[i]!;
      const style = MAGNITUDE_STYLE[magnitudeOfSize(label.size)];
      const progress = label.progress + dt / style.life;
      if (progress >= 1) { this.labels.splice(i, 1); continue; }
      this.labels[i] = { ...label, progress };
    }
  }

  /**
   * Where this shot lands: near the aim point, not on it.
   *
   * Drawn from the seeded generator, so the same salvo scatters the same way
   * every time and a screenshot of a shelled field can be compared with
   * yesterday's. The radius is the tier's — one volley is aimed, a
   * bombardment covers ground.
   */
  private scatter(): WorldPoint {
    const radius = this.plan.tier.escalation.spread;
    const angle = this.aim.next() * Math.PI * 2;
    // Square-rooted, so the points fall evenly over the disc instead of
    // clustering in the middle — a barrage with a dense core and a thin edge
    // reads as bad aim rather than as saturation.
    const distance = Math.sqrt(this.aim.next()) * radius;
    return {
      col: this.options.target.col + Math.cos(angle) * distance,
      row: this.options.target.row + Math.sin(angle) * distance,
      height: this.options.target.height ?? 0,
    };
  }

  /** Which impact profile fired last. For the workbench's readout. */
  get lastImpactProfile(): string | null { return this.lastImpact; }
}

/** The direction of travel, in tiles, normalised. */
function towardTarget(from: WorldPoint, to: WorldPoint): { col: number; row: number } {
  const dCol = to.col - from.col;
  const dRow = to.row - from.row;
  const length = Math.hypot(dCol, dRow) || 1;
  return { col: dCol / length, row: dRow / length };
}

/**
 * Numbers fan out rather than stacking on one spot — in SCREEN terms.
 *
 * Spreading them in world tiles does not work and looked like it did: two
 * points one row apart are eleven screen pixels apart on a 2:1 diamond, which
 * is less than the type is tall, so a tier E salvo stacked "91.122" straight
 * over "9.602".
 *
 * So the grid is built out of the projection instead. Stepping one column
 * FORWARD and one row BACK moves a point horizontally and not at all
 * vertically — 44 px per unit — and height moves it vertically and not at all
 * horizontally. That gives a clean twelve-cell grid, 62 px by 24, which is
 * comfortably larger than the widest number at the largest band.
 */
const LABEL_COLUMNS = 3;
const LABEL_ROWS = 4;

function labelPoint(target: WorldPoint, index: number): WorldPoint {
  const column = index % LABEL_COLUMNS;
  const row = Math.floor(index / LABEL_COLUMNS) % LABEL_ROWS;
  // 1.4 tiles forward and back: 1.4 × 44 = 62 screen pixels of separation,
  // with no vertical component at all.
  const across = (column - (LABEL_COLUMNS - 1) / 2) * 1.4;
  return {
    col: target.col + across,
    row: target.row - across,
    height: 30 + row * 24,
  };
}

/** The band a label was built at, recovered from its type size. */
function magnitudeOfSize(size: number): keyof typeof MAGNITUDE_STYLE {
  for (const [band, style] of Object.entries(MAGNITUDE_STYLE)) {
    if (style.size === size) return band as keyof typeof MAGNITUDE_STYLE;
  }
  return 'medium';
}
