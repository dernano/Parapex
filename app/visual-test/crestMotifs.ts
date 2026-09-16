import type { RackLayout } from '@/rendering/crests/crestRack';
import { slotCentre } from '@/rendering/crests/crestRack';
import type { TriggerPresentation } from '@/rendering/crests/triggerProfiles';

/**
 * THE EIGHT MOTIFS, DRAWN.
 *
 * `triggerProfiles.ts` decides WHICH motif an ignition gets, derived from what
 * the crest actually did — and it knows no crest by name. This file is the
 * other half: what each of the eight looks like. Eight shapes, one per profile,
 * and nothing here switches on a crest either.
 *
 * The brief's rule is "no generic glows", and the reason is learnability. A
 * player who has seen IMPACT twice should recognise the third time it happens
 * and know, without reading anything, that something in their rack MULTIPLIED.
 * One shared flash for all fifty crests teaches nothing at all; fifty bespoke
 * animations teach fifty unrelated things. Eight teaches a language.
 *
 * These are placeholder shapes — circles, bars, squares — and they are honest
 * about it. What they prove is that the profile assignment is legible and that
 * a chain of five reads as a sequence rather than as a firework.
 */

export const MOTIF_CSS = `
@keyframes motif-ring {
  from { transform: translate(-50%,-50%) scale(0.3); opacity: 1; }
  to   { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
}
@keyframes motif-burst {
  0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 1; }
  40%  { transform: translate(-50%,-50%) scale(1.3); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
}
@keyframes motif-slam {
  0%   { transform: translate(-50%,-50%) scale(2.4) rotate(45deg); opacity: 0; }
  35%  { transform: translate(-50%,-50%) scale(0.9) rotate(45deg); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(1.1) rotate(45deg); opacity: 0; }
}
@keyframes motif-breathe {
  0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0; }
  50%  { transform: translate(-50%,-50%) scale(1.2); opacity: 0.9; }
  100% { transform: translate(-50%,-50%) scale(0.9); opacity: 0; }
}
@keyframes motif-flame {
  0%   { transform: translate(-50%,-30%) scaleY(0.2); opacity: 1; }
  100% { transform: translate(-50%,-140%) scaleY(1.4); opacity: 0; }
}
@keyframes motif-travel {
  from { transform: translate(var(--fx), var(--fy)); opacity: 1; }
  to   { transform: translate(var(--tx), var(--ty)); opacity: 0; }
}
.motif { position: absolute; pointer-events: none;
  /* fill-mode both, so the element holds its first frame through the delay:
     the stagger is the order things happened in, and a motif that appeared
     early and then waited would show the wrong order. */
  animation-fill-mode: both; animation-delay: var(--delay, 0s); }
.motif.ring { width: 34px; height: 34px; border-radius: 50%;
  border: 2px solid currentColor; animation: motif-ring var(--dur) ease-out both; }
.motif.burst { width: 14px; height: 14px; border-radius: 50%;
  background: currentColor; box-shadow: 0 0 6px currentColor;
  animation: motif-burst var(--dur) ease-out both; }
.motif.slam { width: 26px; height: 26px; background: currentColor;
  animation: motif-slam var(--dur) cubic-bezier(.2,.9,.3,1) both; }
.motif.breathe { width: 30px; height: 30px; border-radius: 50%;
  background: currentColor; opacity: .5;
  animation: motif-breathe var(--dur) ease-in-out both; }
.motif.flame { width: 10px; height: 26px; border-radius: 5px 5px 2px 2px;
  background: linear-gradient(to top, currentColor, transparent);
  animation: motif-flame var(--dur) ease-out both; }
.motif.travel { width: 9px; height: 9px; border-radius: 2px;
  background: currentColor; animation: motif-travel var(--dur) ease-in-out both; }
.motif.stream { border-radius: 50%; }
.motif.echo { border: 1px solid currentColor; background: transparent; }
.motif.rewind { transform-origin: center; }
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
  /** Off, when the player has asked for less movement. */
  readonly reducedMotion: boolean;
}

/**
 * Put the whole event on the rack, staggered in the order it happened.
 *
 * Note what a directed motif does: it TRAVELS, from the slot that caused the
 * ignition to the slot that performed it. A chain where slot 4 fires slot 1
 * again shows a mark moving right to left — which is the single most useful
 * thing a player can be shown about a rack they built and do not yet
 * understand.
 */
export function playMotifs(
  host: HTMLElement,
  layout: RackLayout,
  ignitions: readonly TriggerPresentation[],
  options: MotifOptions,
): void {
  host.replaceChildren();
  if (options.reducedMotion) return;

  for (const ignition of ignitions) {
    const here = slotCentre(layout, ignition.slot);
    const shape = SHAPE[ignition.profile] ?? 'burst';
    const node = document.createElement('div');
    node.className = `motif ${shape}`;
    node.style.color = ignition.rejected ? '#4a4a52' : ignition.visual.colour;
    node.style.setProperty('--dur', `${ignition.visual.duration}s`);
    // Staggered by position in the protocol: the order things actually
    // happened, which is not the order of the slots.
    node.style.setProperty('--delay', `${ignition.at}s`);
    // Kept on the node so the whole rack can be SEEKED to a moment. Without
    // it these motifs would be the one thing on the page running on the wall
    // clock while everything else runs on the director's, which makes a
    // screenshot of them unreproducible by construction.
    node.dataset.at = String(ignition.at);
    node.style.left = `${here.x}px`;
    node.style.top = `${here.y}px`;

    if (shape.startsWith('travel')) {
      // From whatever caused it — another slot, or the supplies below.
      const from = ignition.target === null
        ? options.shelf
        : slotCentre(layout, ignition.target);
      node.style.setProperty('--fx', `${from.x - here.x}px`);
      node.style.setProperty('--fy', `${from.y - here.y}px`);
      node.style.setProperty('--tx', '0px');
      node.style.setProperty('--ty', '0px');
    }

    host.append(node);

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
}

/**
 * Show the rack exactly `t` seconds into the event.
 *
 * A paused CSS animation with a negative delay renders the frame at that
 * offset, so this is a genuine seek rather than an approximation — the
 * screenshot harness advances the director to a fixed moment and then puts
 * the rack at the same one.
 */
export function seekMotifs(host: HTMLElement, t: number): void {
  for (const node of Array.from(host.children) as HTMLElement[]) {
    const at = Number(node.dataset.at ?? 0);
    node.style.animationDelay = `${at - t}s`;
    node.style.animationPlayState = 'paused';
  }
}

/** Let them run again, from where the seek left them. */
export function resumeMotifs(host: HTMLElement): void {
  for (const node of Array.from(host.children) as HTMLElement[]) {
    node.style.animationPlayState = '';
  }
}
