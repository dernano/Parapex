import type { BranchId } from '@/core/types';
import { LIGHT, PALETTE } from '../artRules';
import { mix, type Shape } from '../placeholderAtlas';
import { UNIT_VISUALS } from '../units/UnitVisual';

/**
 * THE FOUR WEAPONS.
 *
 * A soldier is a silhouette; what tells the player WHICH soldier is the thing
 * in his hands. At twenty-seven pixels the face is two pixels and the armour
 * is three — the bow, the lever, the sling arm and the barrel are the only
 * features with room to be recognised, so they carry the whole distinction.
 *
 * Each is drawn between the unit's own `recoilPivot` and `muzzle` sockets, so
 * the drawing and the firing system cannot disagree: if a barrel points
 * somewhere the shot does not come from, that is now visible rather than
 * merely true.
 *
 * The bombard's shape is taken from the legacy renderer's own reasoning —
 * thicker at the breech than at the mouth, two bands, a muzzle swell, and the
 * dark hole at the end, "daran erkennt man ein Rohr auf Anhieb": the one
 * feature that makes a tube read as a tube at a glance.
 */

const IRON = PALETTE.iron;
const WOOD = PALETTE.wood;

const lit = (colour: string): string => mix(colour, LIGHT.warm, 0.28);
const shade = (colour: string): string => mix(colour, LIGHT.cool, 0.3);

/**
 * A bow: a limb curving forward and a string across it.
 *
 * Drawn as a polyline rather than a rectangle, because the CURVE is the whole
 * recognition — a straight stick in a man's hand is a spear.
 */
function bow(px: (v: number) => number, x0: number, y0: number, x1: number, y1: number): Shape[] {
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;
  const bulge = px(4);
  return [
    {
      kind: 'line',
      points: [
        [x1 - px(1), y1 - px(6)],
        [midX + bulge, midY - px(3)],
        [midX + bulge, midY + px(3)],
        [x1 - px(1), y1 + px(6)],
      ],
      colour: WOOD[2]!, width: Math.max(1, px(1.6)),
    },
    // The string, taut between the tips.
    {
      kind: 'line',
      points: [[x1 - px(1), y1 - px(6)], [x0, midY], [x1 - px(1), y1 + px(6)]],
      colour: lit(WOOD[3]!), width: 1, alpha: 0.85,
    },
  ];
}

/** A crossbow: a stock along the arm and a short steel prod across its nose. */
function crossbow(px: (v: number) => number, x0: number, y0: number, x1: number, y1: number): Shape[] {
  return [
    { kind: 'rect', x: x0, y: y0 - px(1), w: x1 - x0, h: px(2.2), fill: WOOD[2]! },
    { kind: 'rect', x: x0, y: y0 - px(1), w: x1 - x0, h: 1, fill: lit(WOOD[3]!) },
    // The prod: short, steel, and unmistakably crosswise.
    {
      kind: 'line',
      points: [[x1 - px(1), y1 - px(5)], [x1 + px(1), y1], [x1 - px(1), y1 + px(5)]],
      colour: IRON[3]!, width: Math.max(1, px(1.4)),
    },
    // The stirrup at the nose, which is what a crossbow has and a bow has not.
    { kind: 'rect', x: x1 - px(1), y: y1 + px(3), w: px(2), h: px(2), fill: IRON[2]! },
  ];
}

/**
 * A sling engine: an arm over a frame, with the cup at its tip.
 *
 * The frame stays put and the ARM moves — that is the character of the
 * family, and it is why the pivot is low and central while the muzzle is high
 * and forward.
 */
function engine(px: (v: number) => number, x0: number, y0: number, x1: number, y1: number): Shape[] {
  return [
    // The frame: two legs meeting at the axle.
    {
      kind: 'line',
      points: [[x0 - px(3), y0 + px(6)], [x0, y0], [x0 + px(3), y0 + px(6)]],
      colour: WOOD[1]!, width: Math.max(1, px(1.8)),
    },
    // The throwing arm.
    { kind: 'line', points: [[x0, y0], [x1, y1]], colour: WOOD[2]!,
      width: Math.max(1, px(2)) },
    // The cup at its tip.
    { kind: 'ellipse', cx: x1, cy: y1, rx: px(2), ry: px(1.6), fill: shade(WOOD[0]!) },
    // The counterweight behind the axle: the mass that does the work.
    { kind: 'rect', x: x0 - px(4), y: y0 - px(1), w: px(3), h: px(3), fill: IRON[1]! },
  ];
}

/**
 * A bombard on its bed.
 *
 * Thicker at the breech than at the mouth — the chamber holds the pressure —
 * with two bands, a muzzle swell, and the dark hole at the end.
 */
function bombard(px: (v: number) => number, x0: number, y0: number, x1: number, y1: number): Shape[] {
  const half = px(2.2);
  const thin = px(1.6);
  return [
    // The bed, wedged to the tower. It does not move; the barrel does.
    { kind: 'rect', x: x0 - px(2), y: y0 + px(2), w: (x1 - x0) + px(3), h: px(2),
      fill: WOOD[1]! },
    { kind: 'ellipse', cx: x0 + px(1), cy: y0 + px(4), rx: px(1.6), ry: px(1.6),
      fill: IRON[0]! },
    { kind: 'ellipse', cx: x1 - px(3), cy: y0 + px(4), rx: px(1.6), ry: px(1.6),
      fill: IRON[0]! },
    // The barrel, tapering forward.
    { kind: 'poly', fill: IRON[2]!, points: [
      [x0, y0 - half], [x1, y1 - thin], [x1, y1 + thin], [x0, y0 + half],
    ] },
    // The lit upper line of the tube — without it the barrel is a grey wedge.
    { kind: 'line', points: [[x0, y0 - half], [x1, y1 - thin]],
      colour: lit(IRON[4]!), width: 1 },
    // Two bands and the muzzle swell.
    { kind: 'rect', x: x0 + px(2), y: y0 - half, w: px(1), h: half * 2, fill: IRON[4]! },
    { kind: 'rect', x: x1 - px(3), y: y1 - thin, w: px(1), h: thin * 2, fill: IRON[4]! },
    { kind: 'rect', x: x1 - px(1), y: y1 - thin - 1, w: px(1.4), h: thin * 2 + 2,
      fill: IRON[3]! },
    // The dark mouth. The one feature that makes a tube read as a tube.
    { kind: 'ellipse', cx: x1, cy: y1, rx: px(0.8), ry: thin, fill: '#12100c' },
  ];
}

const DRAWINGS: Readonly<Record<BranchId, typeof bow>> = {
  bow, crossbow, artillery: engine, gunner: bombard,
};

/**
 * The weapon a branch carries, drawn between its own two sockets.
 *
 * `scale` is the unit-size probe; every coordinate goes through it, so a
 * weapon stays on its soldier at any authored height.
 */
export function weaponFor(branch: string, scale: number): Shape[] {
  const visual = UNIT_VISUALS[branch as BranchId];
  if (!visual) return [];
  const px = (v: number): number => v * scale;
  const pivot = visual.sockets.recoilPivot;
  const muzzle = visual.sockets.muzzle;
  return DRAWINGS[visual.branch](
    px, px(pivot.x), px(pivot.y), px(muzzle.x), px(muzzle.y),
  );
}
