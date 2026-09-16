import type { ActiveFormation, FormationId, Tower, Unit } from '@/core/types';
import { FORMATIONS } from '@/content/formations/formations';
import { buildTableau, cardsFromTowers, recogniseFormations, volleyCount }
  from '@/simulation/FormationEngine';
import { toScreen, type Camera, type WorldPoint } from '../WorldTransform';

/**
 * FORMATIONS, ON THE BATTLEFIELD.
 *
 * The brief's instruction is a single word and the whole design: NO MODAL. A
 * formation is not a notification that a rule fired, it is a shape the player
 * built out of five emplacements, and it belongs on the five emplacements. The
 * moment it is a panel in the corner it becomes bookkeeping, and the castle
 * stops being where the player is looking.
 *
 * ONE formation is built completely here — Geschlossene Front — because the
 * brief asks for one done properly rather than thirteen done thinly. The other
 * twelve are listed as NOT YET PRESENTED, by name, so the gap is a fact one
 * can read rather than something one discovers in a screenshot.
 */

/** How a formation draws itself on the field. Data; the renderer switches on nothing. */
export type FormationMotif =
  /** A line of standards along the wall joining the emplacements it covers. */
  | 'standardLine'
  /** A single banner over each contributing tower. */
  | 'banners'
  /** Chevrons climbing the ranks, for the run families. */
  | 'chevrons'
  /** A crown motif over the whole wall, for the crowning formations. */
  | 'crown';

export interface FormationVisual {
  readonly id: FormationId;
  readonly motif: FormationMotif;
  /** Heraldic colour of the standard. */
  readonly colour: string;
  /** The lit edge, from the one sun. */
  readonly accent: string;
  /** How long the formation takes to assert itself when it first appears. */
  readonly formSeconds: number;
  /** German, shown on the field beside the standards. */
  readonly caption: string;
}

/**
 * The one that is finished.
 *
 * All five emplacements occupied. It is the right one to build first: it is
 * the formation every player meets, it touches every tower, and it is the only
 * one whose shape is the whole wall — so whatever presentation works for it
 * has already solved the hardest layout case.
 */
export const FORMATION_VISUALS: Readonly<Partial<Record<FormationId, FormationVisual>>> = {
  closedFront: {
    id: 'closedFront',
    motif: 'standardLine',
    colour: '#a8261f',
    accent: '#e3b552',
    formSeconds: 0.45,
    caption: 'GESCHLOSSENE FRONT',
  },
};

/**
 * Every formation that has a rule but no picture yet.
 *
 * DERIVED, never typed: adding a formation to the content file puts it on this
 * list automatically, so nobody has to remember to confess.
 */
export const FORMATIONS_NOT_YET_PRESENTED: readonly FormationId[] =
  FORMATIONS.map(f => f.id).filter(id => !FORMATION_VISUALS[id]);

/* ---------- What gets drawn ---------- */

export type FormationNodeKind = 'standard' | 'connector' | 'caption';

export interface FormationNode {
  readonly id: string;
  readonly kind: FormationNodeKind;
  readonly world: WorldPoint;
  readonly sprite: string;
  readonly colour: string;
  readonly accent: string;
  /**
   * 0..1. The standards do not all snap up together: they rise from the
   * middle outwards, which is what makes the wall read as ONE line forming
   * rather than five decorations appearing.
   */
  readonly raise: number;
  /** How far a connector has to reach, in screen pixels. Standards ignore it. */
  readonly span?: number;
  readonly text?: string;
}

/**
 * The formation, as nodes, `t` seconds after it appeared.
 *
 * A pure function of time like every other animation here. Passing `t` past
 * `formSeconds` gives the settled state, so a screenshot harness can ask for
 * the finished picture without waiting for it.
 */
export function presentFormation(
  formation: ActiveFormation,
  anchors: readonly WorldPoint[],
  t = Infinity,
  camera?: Camera,
): readonly FormationNode[] {
  const visual = FORMATION_VISUALS[formation.id];
  if (!visual) return [];

  const towers = formation.towers.filter(i => anchors[i]);
  if (!towers.length) return [];

  const middle = (towers.length - 1) / 2;
  const nodes: FormationNode[] = [];

  towers.forEach((tower, i) => {
    const anchor = anchors[tower]!;
    /*
     * Outward from the centre. The delay is a sixth of the forming time per
     * step, so the whole line is up within `formSeconds` however many towers
     * it covers.
     */
    const delay = (Math.abs(i - middle) / Math.max(1, middle)) * visual.formSeconds * 0.5;
    const raise = clamp01((t - delay) / Math.max(0.001, visual.formSeconds * 0.5));
    nodes.push({
      id: `formation:${formation.id}:standard:${tower}`,
      kind: 'standard',
      // The standard flies from the parapet, above the garrison's head.
      world: { col: anchor.col, row: anchor.row, height: (anchor.height ?? 0) + 30 },
      sprite: `formation/${visual.motif}`,
      colour: visual.colour,
      accent: visual.accent,
      raise,
    });
  });

  if (visual.motif === 'standardLine') {
    // The connectors are what turn five standards into one front.
    for (let i = 0; i < towers.length - 1; i++) {
      const a = anchors[towers[i]!]!;
      const b = anchors[towers[i + 1]!]!;
      /*
       * The connector is measured in SCREEN pixels between the two standards
       * it joins, not in tiles: the towers are four rows apart and that is a
       * different number of pixels than four columns would be. A fixed-length
       * bar floating between them reads as debris rather than as a line.
       */
      /*
       * At the FLAGS, not at the men. The standards hang from a pole whose top
       * is about fifty pixels above the platform; a line drawn at the
       * garrison's own height runs straight through the garrison.
       */
      const from = toScreen({ ...a, height: (a.height ?? 0) + LINE_HEIGHT }, camera);
      const to = toScreen({ ...b, height: (b.height ?? 0) + LINE_HEIGHT }, camera);
      nodes.push({
        id: `formation:${formation.id}:link:${i}`,
        kind: 'connector',
        world: {
          col: (a.col + b.col) / 2, row: (a.row + b.row) / 2,
          height: ((a.height ?? 0) + (b.height ?? 0)) / 2 + LINE_HEIGHT,
        },
        sprite: 'formation/connector',
        colour: visual.colour,
        accent: visual.accent,
        raise: clamp01(t / Math.max(0.001, visual.formSeconds)),
        span: Math.round(Math.hypot(to.x - from.x, to.y - from.y)),
      });
    }
  }

  const centre = anchors[towers[Math.round(middle)]!]!;
  nodes.push({
    id: `formation:${formation.id}:caption`,
    kind: 'caption',
    world: { col: centre.col - 1.4, row: centre.row, height: (centre.height ?? 0) + 46 },
    sprite: 'formation/caption',
    colour: visual.accent,
    accent: visual.colour,
    raise: clamp01((t - visual.formSeconds * 0.5) / Math.max(0.001, visual.formSeconds * 0.5)),
    text: `${visual.caption}  +${formation.volleys}`,
  });

  return nodes;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** How high the line of standards runs above the platform, in logical pixels. */
const LINE_HEIGHT = 50;

/* ============================================================
 *  The preview, while a card is in the air
 * ============================================================ */

/**
 * What would happen if this unit went on that tower.
 *
 * The player should SEE the combination rather than compute it. And because
 * formations here work on SETS rather than on adjacency, the answer is often
 * surprising — a card dropped on the far left can complete a run that looks
 * like it lives on the right — which is exactly why guessing is not good
 * enough.
 *
 * Pure. It builds a hypothetical tower row and reads it; the real one is never
 * touched, so a preview cannot cost a player anything. That is asserted.
 */
export interface FormationPreview {
  /** Formations that would appear. */
  readonly gained: readonly ActiveFormation[];
  /** Formations that would be lost — usually to a higher tier in the family. */
  readonly lost: readonly ActiveFormation[];
  readonly kept: readonly ActiveFormation[];
  readonly volleysBefore: number;
  readonly volleysAfter: number;
}

export function previewFormations(
  towers: readonly Tower[],
  drop: { readonly unit: Unit; readonly towerIndex: number },
): FormationPreview {
  const before = recogniseFormations(buildTableau(cardsFromTowers(towers)));
  const hypothetical = towers.map((tower, i) =>
    (i === drop.towerIndex ? { ...tower, unit: drop.unit } : tower));
  const after = recogniseFormations(buildTableau(cardsFromTowers(hypothetical)));

  const beforeIds = new Set(before.map(f => f.id));
  const afterIds = new Set(after.map(f => f.id));

  return {
    gained: after.filter(f => !beforeIds.has(f.id)),
    lost: before.filter(f => !afterIds.has(f.id)),
    kept: after.filter(f => beforeIds.has(f.id)),
    volleysBefore: volleyCount(before),
    volleysAfter: volleyCount(after),
  };
}

/**
 * The preview in one German line, for the card under the cursor.
 *
 * Deliberately terse: a player holding a card wants the delta, not an essay.
 */
export function previewCaption(preview: FormationPreview): string {
  const parts: string[] = [];
  for (const formation of preview.gained) parts.push(`+ ${formation.displayName}`);
  for (const formation of preview.lost) parts.push(`− ${formation.displayName}`);
  const delta = preview.volleysAfter - preview.volleysBefore;
  if (delta) parts.push(`${delta > 0 ? '+' : ''}${delta} Salven`);
  return parts.join('   ');
}
