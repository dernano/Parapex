import type { BranchId, Tower } from '@/core/types';
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
      && !this.field.particles.length && !this.labels.length;
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
      to: this.options.target,
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
 * Numbers fan out rather than stacking on one spot.
 *
 * Three columns, and the height steps with the column as well as the row — on
 * an isometric field two points a row apart are only eleven pixels apart on
 * screen, which is less than the type is tall.
 */
function labelPoint(target: WorldPoint, index: number): WorldPoint {
  const column = index % 3;
  const row = Math.floor(index / 3) % 4;
  return {
    col: target.col + column * 1.1 - 1.1,
    row: target.row + row * 1.2 - 1.8,
    height: 34 + column * 16 + row * 9,
  };
}

/** The band a label was built at, recovered from its type size. */
function magnitudeOfSize(size: number): keyof typeof MAGNITUDE_STYLE {
  for (const [band, style] of Object.entries(MAGNITUDE_STYLE)) {
    if (style.size === size) return band as keyof typeof MAGNITUDE_STYLE;
  }
  return 'medium';
}
