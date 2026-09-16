import type { RackLayout } from '@/rendering/crests/crestRack';
import { slotCentre } from '@/rendering/crests/crestRack';
import { travels, type MotifFrame } from '@/rendering/crests/motifShapes';
import type { TriggerPresentation } from '@/rendering/crests/triggerProfiles';

/**
 * THE EIGHT MOTIFS, DRAWN.
 *
 * `triggerProfiles.ts` decides WHICH motif an ignition gets, derived from what
 * the crest actually did — and it knows no crest by name. `motifShapes.ts`
 * says what each one looks like at second `t`. This file only puts that on the
 * page: it creates one element per motif and then, every frame, tells each
 * where it is.
 *
 * No CSS animation anywhere, deliberately. The first version used keyframes
 * and was the one thing on the screen running on the wall clock while the
 * battlefield ran on the director's — so the rack drifted out of step with the
 * guns whenever a frame took longer, and a screenshot of it could only be
 * taken by pausing the animations and seeking into them by hand. Now the
 * director's clock drives both, and seeking is free because the shape is a
 * function of time.
 *
 * The brief's rule is "no generic glows", and the reason is learnability. A
 * player who has seen IMPACT twice should recognise the third time and know,
 * without reading anything, that something in their rack MULTIPLIED. One
 * shared flash for all fifty crests teaches nothing; fifty bespoke animations
 * teach fifty unrelated things. Eight teaches a language.
 */

export const MOTIF_CSS = `
.motif { position: absolute; pointer-events: none; will-change: transform, opacity; }
.motif.ring { width: 34px; height: 34px; border-radius: 50%; border: 2px solid currentColor; }
.motif.burst { width: 14px; height: 14px; border-radius: 50%;
  background: currentColor; box-shadow: 0 0 6px currentColor; }
.motif.slam { width: 26px; height: 26px; background: currentColor; }
.motif.breathe { width: 30px; height: 30px; border-radius: 50%; background: currentColor; }
.motif.flame { width: 10px; height: 26px; border-radius: 5px 5px 2px 2px;
  background: linear-gradient(to top, currentColor, transparent); }
.motif.travel { width: 9px; height: 9px; border-radius: 2px; background: currentColor; }
.motif.stream { border-radius: 50%; }
.motif.echo { border: 1px solid currentColor; background: transparent; }
.motif-label { position: absolute; font-size: 8px; letter-spacing: .08em;
  transform: translate(-50%, -22px); opacity: .85; pointer-events: none; }
`;

/** Which CSS shape each profile uses. The only mapping in this file. */
const SHAPE: Readonly<Record<string, string>> = {
  ROTATE: 'ring',
  SPARK: 'burst',
  IMPACT: 'slam',
  PULSE: 'breathe',
  IGNITE: 'flame',
  TRANSFER: 'travel stream',
  COPY: 'travel echo',
  RETRIGGER: 'travel rewind',
};

export interface MotifOptions {
  /** Where the shelf sits, for a TRANSFER that has no slot to point at. */
  readonly shelf: { readonly x: number; readonly y: number };
}

interface Live {
  readonly node: HTMLElement;
  readonly here: { x: number; y: number };
  /** Where a travelling mark comes from. Zero for the ones that stay put. */
  readonly from: { x: number; y: number };
  readonly travels: boolean;
}

/**
 * Build one element per ignition, once.
 *
 * Returns what `apply` needs each frame. Creating the elements up front and
 * then only writing transforms keeps the rack out of the layout path, which
 * matters when a chain of forty ignites inside one second.
 */
export function buildMotifs(
  host: HTMLElement,
  layout: RackLayout,
  ignitions: readonly TriggerPresentation[],
  options: MotifOptions,
): readonly Live[] {
  host.replaceChildren();
  const live: Live[] = [];

  for (const ignition of ignitions) {
    const here = slotCentre(layout, ignition.slot);
    const node = document.createElement('div');
    node.className = `motif ${SHAPE[ignition.profile] ?? 'burst'}`;
    node.style.color = ignition.rejected ? '#4a4a52' : ignition.visual.colour;
    node.style.left = `${here.x}px`;
    node.style.top = `${here.y}px`;
    node.style.opacity = '0';
    host.append(node);

    // A directed motif starts where the cause was: another slot, or the
    // supplies below. That is what makes a chain legible — slot 4 firing slot
    // 1 again shows a mark travelling right to left.
    const from = ignition.target === null
      ? options.shelf
      : slotCentre(layout, ignition.target);

    live.push({ node, here, from, travels: travels(ignition.profile) });

    /*
     * A refusal is SHOWN, dim and named. A guard nobody sees is a guard
     * nobody trusts — and "why did my fifth crest do nothing" is one of the
     * questions the rack exists to answer.
     */
    if (ignition.rejected) {
      const label = document.createElement('div');
      label.className = 'motif-label';
      label.style.color = '#a8261f';
      label.style.left = `${here.x}px`;
      label.style.top = `${here.y}px`;
      label.textContent = ignition.rejected;
      host.append(label);
    }
  }
  return live;
}

/** Put every motif where it is at this moment. Called once a frame. */
export function applyMotifs(
  live: readonly Live[],
  frames: readonly { readonly frame: MotifFrame }[],
): void {
  live.forEach((entry, i) => {
    const frame = frames[i]?.frame;
    if (!frame || frame.opacity <= 0) { entry.node.style.opacity = '0'; return; }

    const x = entry.travels
      ? (entry.from.x - entry.here.x) * (1 - frame.x)
      : frame.x;
    const y = entry.travels
      ? (entry.from.y - entry.here.y) * (1 - frame.y)
      : frame.y;

    entry.node.style.opacity = String(frame.opacity);
    entry.node.style.transform =
      `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`
      + ` scale(${frame.scaleX.toFixed(3)},${frame.scaleY.toFixed(3)})`
      + (frame.rotation ? ` rotate(${frame.rotation.toFixed(3)}rad)` : '');
  });
}
