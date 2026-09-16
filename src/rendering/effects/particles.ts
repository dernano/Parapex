import { Rng, type RngState } from '@/simulation/Rng';
import type { WorldPoint } from '../WorldTransform';

/**
 * Pixel smoke, dust and debris.
 *
 * CHUNKY CLUSTERS, FEW PARTICLES. Not hundreds of tiny alpha dots and not
 * smooth modern fog — a cannon's smoke should read as a handful of solid grey
 * blocks that grow, drift and thin out. That is what makes it look drawn
 * rather than simulated, and it is also what keeps it readable when six
 * cannons fire at once.
 *
 * The whole system is a pure step function over plain data, driven by the
 * seeded generator, so a given shot produces the same smoke every time. That
 * matters more than it sounds: an effect nobody can reproduce is an effect
 * nobody can judge, and "it looked wrong once" is not a bug report.
 */

export type ParticleKind =
  | 'smoke'      // hangs, grows, drifts up and away from the muzzle
  | 'dust'       // low, fast, settles
  | 'flash'      // one or two frames, bright, gone
  | 'debris'     // solid chips that arc and fall
  | 'spark';     // small, bright, short

export interface Particle {
  readonly id: string;
  readonly kind: ParticleKind;
  /** Where it is, in world tiles plus height in logical pixels. */
  readonly at: WorldPoint;
  /** Tiles per second, and pixels per second for height. */
  readonly velocity: { readonly col: number; readonly row: number; readonly height: number };
  /** Seconds lived, and how long it lives. */
  readonly age: number;
  readonly life: number;
  /** Edge length in logical pixels. Chunky: 2 to 7, never sub-pixel. */
  readonly size: number;
  /** 0..1, for the layered opacity that makes a cluster read as volume. */
  readonly opacity: number;
  readonly palette: number;
}

export interface ParticleField {
  readonly particles: readonly Particle[];
  readonly rng: RngState;
  readonly nextId: number;
}

export const emptyField = (seed: string | number = 'effects'): ParticleField => ({
  particles: [], rng: Rng.fromSeed(seed).state, nextId: 0,
});

/** How each kind behaves. Tuned so a cannon reads heavy and an arrow reads light. */
const BEHAVIOUR: Readonly<Record<ParticleKind, {
  life: [number, number]; size: [number, number]; rise: number; drift: number;
  gravity: number; grow: number; fade: number;
}>> = {
  //        life        size      rise  drift  gravity  grow  fade
  smoke:  { life: [0.9, 1.6], size: [3, 7], rise: 14, drift: 0.55, gravity: 0, grow: 3.2, fade: 0.8 },
  dust:   { life: [0.35, 0.6], size: [2, 4], rise: 4, drift: 1.1, gravity: 10, grow: 1.4, fade: 1.6 },
  flash:  { life: [0.06, 0.10], size: [5, 9], rise: 0, drift: 0, gravity: 0, grow: -6, fade: 8 },
  debris: { life: [0.5, 0.9], size: [2, 3], rise: 34, drift: 1.9, gravity: 120, grow: 0, fade: 1.1 },
  spark:  { life: [0.12, 0.26], size: [1, 2], rise: 18, drift: 1.4, gravity: 40, grow: 0, fade: 3 },
};

export interface Burst {
  readonly kind: ParticleKind;
  readonly at: WorldPoint;
  readonly count: number;
  /** Which way the event pushed them: the firing direction, in tiles. */
  readonly direction?: { readonly col: number; readonly row: number };
  /** Multiplies speed and size. A 100-volley barrage pushes harder than one shot. */
  readonly force?: number;
}

/**
 * Add a burst. Deliberately few particles: the counts here are single digits,
 * because eight solid blocks read as smoke and eighty read as fog.
 */
export function spawn(field: ParticleField, burst: Burst): ParticleField {
  const rng = Rng.fromState(field.rng);
  const behaviour = BEHAVIOUR[burst.kind];
  const force = burst.force ?? 1;
  const push = burst.direction ?? { col: 0, row: 0 };
  const born: Particle[] = [];
  let id = field.nextId;

  for (let i = 0; i < burst.count; i++) {
    const spread = () => (rng.next() - 0.5) * behaviour.drift;
    born.push({
      id: `p${id++}`,
      kind: burst.kind,
      at: {
        col: burst.at.col + spread() * 0.25,
        row: burst.at.row + spread() * 0.25,
        height: (burst.at.height ?? 0) + rng.next() * 3,
      },
      velocity: {
        col: push.col * force * 0.6 + spread(),
        row: push.row * force * 0.6 + spread(),
        height: behaviour.rise * force * (0.6 + rng.next() * 0.8),
      },
      age: 0,
      life: behaviour.life[0] + rng.next() * (behaviour.life[1] - behaviour.life[0]),
      size: Math.round(behaviour.size[0]
        + rng.next() * (behaviour.size[1] - behaviour.size[0])) * Math.min(2, force),
      opacity: 0.55 + rng.next() * 0.45,
      palette: Math.floor(rng.next() * 3),
    });
  }

  return { particles: [...field.particles, ...born], rng: rng.state, nextId: id };
}

/**
 * Advance the field. Pure: old field in, new field out.
 *
 * Dead particles are dropped here rather than hidden, so the count in the
 * debug overlay is the truth and a leak is visible immediately.
 */
export function step(field: ParticleField, dt: number): ParticleField {
  const alive: Particle[] = [];
  for (const p of field.particles) {
    const age = p.age + dt;
    if (age >= p.life) continue;
    const behaviour = BEHAVIOUR[p.kind];
    alive.push({
      ...p,
      age,
      at: {
        col: p.at.col + p.velocity.col * dt,
        row: p.at.row + p.velocity.row * dt,
        height: Math.max(0, (p.at.height ?? 0) + p.velocity.height * dt),
      },
      velocity: {
        // Air drag, so smoke slows and hangs instead of sailing away.
        col: p.velocity.col * (1 - dt * 1.4),
        row: p.velocity.row * (1 - dt * 1.4),
        height: p.velocity.height - behaviour.gravity * dt,
      },
      size: Math.min(MAX_PARTICLE_SIZE, Math.max(1, p.size + behaviour.grow * dt)),
      opacity: Math.max(0, p.opacity - behaviour.fade * dt * (age / p.life)),
    });
  }
  return { ...field, particles: alive };
}

/* ============================================================
 *  The four impact profiles
 * ============================================================
 *
 * An arrow and a bombard must not share an explosion. The brief is explicit,
 * and it is also the difference between a battle that reads and one where
 * everything is the same puff.
 */
export type ImpactProfile = 'arrow' | 'bolt' | 'stone' | 'ball';

export function impact(
  field: ParticleField,
  profile: ImpactProfile,
  at: WorldPoint,
  force = 1,
): ParticleField {
  switch (profile) {
    case 'arrow':
      // Tiny and sharp. Two chips of dust and nothing else.
      return spawn(field, { kind: 'dust', at, count: 2, force: force * 0.6 });
    case 'bolt':
      // Harder: dust plus a couple of sparks off the armour it punched.
      return spawn(spawn(field, { kind: 'dust', at, count: 3, force }),
        { kind: 'spark', at, count: 2, force });
    case 'stone': {
      // Earth and stone burst, with debris that arcs and falls.
      const dusted = spawn(field, { kind: 'dust', at, count: 6, force: force * 1.4 });
      return spawn(dusted, { kind: 'debris', at, count: 5, force });
    }
    case 'ball': {
      // The heaviest response: dust, debris and smoke that hangs after.
      const dusted = spawn(field, { kind: 'dust', at, count: 7, force: force * 1.6 });
      const broken = spawn(dusted, { kind: 'debris', at, count: 4, force: force * 1.2 });
      return spawn(broken, { kind: 'smoke', at, count: 3, force });
    }
  }
}

/**
 * What leaves a muzzle when it fires. The flash is one frame, the smoke hangs,
 * the dust is kicked off the platform beneath — three things at once, which is
 * what gives a cannon its weight without moving the crew ten pixels.
 */
export function muzzleBurst(
  field: ParticleField,
  weapon: 'bow' | 'crossbow' | 'artillery' | 'gunner',
  at: WorldPoint,
  direction: { readonly col: number; readonly row: number },
  force = 1,
): ParticleField {
  switch (weapon) {
    case 'bow':
      return field;                                   // a bow makes no smoke
    case 'crossbow':
      return spawn(field, { kind: 'spark', at, count: 2, direction, force });
    case 'artillery': {
      const ground: WorldPoint = { ...at, height: 0 };
      return spawn(field, { kind: 'dust', at: ground, count: 4, direction, force });
    }
    case 'gunner': {
      const flashed = spawn(field, { kind: 'flash', at, count: 2, direction, force });
      const smoked = spawn(flashed, { kind: 'smoke', at, count: 6, direction, force });
      const ground: WorldPoint = { ...at, height: 0 };
      return spawn(smoked, { kind: 'dust', at: ground, count: 4, direction, force: force * 0.8 });
    }
  }
}

/** Colours per kind, from the bible's ramps. Layered opacity does the volume. */
export const PARTICLE_COLOURS: Readonly<Record<ParticleKind, readonly string[]>> = {
  smoke: ['#6b7079', '#949aa3', '#434750'],
  dust: ['#756244', '#8a7351', '#635036'],
  flash: ['#ffd98a', '#e89a3c', '#ffffff'],
  debris: ['#4a3122', '#5f6068', '#332017'],
  spark: ['#ffd98a', '#e89a3c', '#c25a15'],
};

/* ============================================================
 *  Accumulation, and the compression that keeps it affordable
 * ============================================================
 *
 * Smoke has to BUILD UP. One cannon leaves a puff; six cannons firing four
 * times over eight seconds should leave the parapet sitting in a bank of it,
 * because that is the picture the player is paying for.
 *
 * The naive way to do that is to keep spawning, and it fails twice over: the
 * frame cost grows without bound, and a thousand small puffs read as fog
 * rather than as smoke. So the field COMPRESSES: nearby particles of the same
 * kind merge into fewer, LARGER ones, conserving area. The bank keeps growing
 * while the particle count stops.
 *
 * Deterministic on purpose — bucketed by position, no randomness anywhere, so
 * the same salvo compresses the same way every time and a screenshot of it can
 * be compared against yesterday's.
 */

/** How many particles the field may hold before it starts merging. */
export const PARTICLE_BUDGET = 220;

/** A particle's visual weight. Area, so merging can conserve it. */
const mass = (p: Particle): number => p.size * p.size;

/** The total visual weight of a field. This is what must keep growing. */
export const fieldMass = (field: ParticleField): number =>
  field.particles.reduce((sum, p) => sum + mass(p), 0);

/**
 * The biggest a block may get, merged or merely grown.
 *
 * Without a ceiling a long barrage eventually produces one enormous square,
 * which is not smoke, it is a grey rectangle. Past this size the merge stops
 * growing the block and DROPS the extra area — the bank is already opaque and
 * the player cannot tell the difference, so paying for the difference would be
 * paying for nothing.
 *
 * That is a deliberate loss, and it is the one place compression is not
 * area-preserving. It is worth naming rather than hiding: below the ceiling a
 * merge conserves area exactly, above it the field saturates.
 */
export const MAX_PARTICLE_SIZE = 14;

/** The same ceiling expressed as area, which is what merging actually adds up. */
const CEILING_AREA = MAX_PARTICLE_SIZE * MAX_PARTICLE_SIZE;

function merge(group: readonly Particle[]): Particle {
  const total = group.reduce((sum, p) => sum + mass(p), 0);
  const first = group[0]!;
  let col = 0, row = 0, height = 0, vc = 0, vr = 0, vh = 0, opacity = 0, life = 0, age = 0;
  for (const p of group) {
    const weight = mass(p) / total;
    col += p.at.col * weight;
    row += p.at.row * weight;
    height += (p.at.height ?? 0) * weight;
    vc += p.velocity.col * weight;
    vr += p.velocity.row * weight;
    vh += p.velocity.height * weight;
    opacity = Math.max(opacity, p.opacity);
    // The merged block lives as long as the longest-lived of its parts had
    // left, so compressing a cluster never makes it vanish early.
    const remaining = p.life - p.age;
    if (remaining > life - age) { life = p.life; age = p.age; }
  }
  return {
    ...first,
    at: { col, row, height },
    velocity: { col: vc, row: vr, height: vh },
    size: Math.min(MAX_PARTICLE_SIZE, Math.sqrt(total)),
    opacity,
    life, age,
  };
}

/**
 * Merge until the field fits its budget.
 *
 * The bucket grid starts fine and coarsens: first only particles practically
 * on top of each other merge, and only if that is not enough do wider
 * neighbours join. A single pass at a fixed grid would either merge too
 * eagerly at four particles or not at all at four hundred.
 */
export function compress(field: ParticleField, budget = PARTICLE_BUDGET): ParticleField {
  if (field.particles.length <= budget) return field;

  let particles = field.particles;
  // Cell size in tiles. Six coarsenings take 0.2 tiles out to 6.4 - wider than
  // a tower - which is past the point where anything visible is still separate.
  for (let step = 0; step < 6 && particles.length > budget; step++) {
    const cell = 0.2 * Math.pow(2, step);
    const buckets = new Map<string, Particle[]>();
    const order: string[] = [];
    for (const p of particles) {
      const key = [
        p.kind,
        Math.floor(p.at.col / cell),
        Math.floor(p.at.row / cell),
        Math.floor((p.at.height ?? 0) / 24),
      ].join(':');
      const bucket = buckets.get(key);
      if (bucket) bucket.push(p);
      else { buckets.set(key, [p]); order.push(key); }
    }
    /*
     * Insertion order, so the result is stable and the oldest particle in a
     * cluster keeps its id - a renderer that reuses sprites by id would
     * otherwise rebuild the whole bank every frame.
     *
     * A bucket is merged in PACKS rather than all at once. That matters more
     * than it looks: merging forty particles into one block would saturate at
     * the ceiling and silently throw the rest of the area away, and a long
     * bombardment would then end up with LESS smoke than a short one - the
     * exact opposite of what accumulation is for. Packing to the ceiling
     * conserves the area exactly and still collapses the count.
     */
    const next: Particle[] = [];
    for (const key of order) {
      const bucket = buckets.get(key)!;
      if (bucket.length === 1) { next.push(bucket[0]!); continue; }
      let pack: Particle[] = [];
      let area = 0;
      for (const p of bucket) {
        if (pack.length && area + mass(p) > CEILING_AREA) {
          next.push(pack.length === 1 ? pack[0]! : merge(pack));
          pack = [];
          area = 0;
        }
        pack.push(p);
        area += mass(p);
      }
      if (pack.length) next.push(pack.length === 1 ? pack[0]! : merge(pack));
    }
    particles = next;
  }

  /*
   * A hard floor, for the case the grid cannot help: hundreds of particles
   * genuinely spread over the whole field. Drop the faintest, because they are
   * the ones already on their way out.
   */
  if (particles.length > budget) {
    particles = [...particles]
      .sort((a, b) => b.opacity * mass(b) - a.opacity * mass(a))
      .slice(0, budget);
  }

  return { ...field, particles };
}
