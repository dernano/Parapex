import { UNIT_POOL, createUnit } from '@/content/units/pool';
import { createEnemy } from '@/content/enemies/enemies';
import { createCombat } from '@/simulation/CombatEngine';
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/rendering/artRules';
import { ALL_EFFECTS, NO_DEBUG } from '@/rendering/presentation/settings';
import { MOTIF_CSS } from '@/ui/motifView';
import { CombatScreen } from '@/ui/CombatScreen';

/**
 * PARAPEX — the combat screen.
 *
 * Thin on purpose. Everything interesting lives in `src/`, and this file only
 * says which combat to start and where to put it. That is the test of whether
 * the split was real: if the entry point needed to know how a volley is drawn,
 * the presentation would not actually be a layer.
 *
 * Every module here is the same one `/visual-test/` drives. There is no second
 * implementation of anything — which is why a fault found in the workbench is
 * a fault fixed in the game.
 */

const style = document.createElement('style');
style.textContent = MOTIF_CSS;
document.head.append(style);

const canvas = document.getElementById('world') as HTMLCanvasElement;
canvas.style.width = `${STAGE_WIDTH}px`;
canvas.style.height = `${STAGE_HEIGHT}px`;

/**
 * A real deck of all fifty-two, shuffled by the seeded generator.
 *
 * The seed is fixed for now: a run picks it in Phase 8. What matters today is
 * that it EXISTS — the same seed gives the same combat, which is what makes a
 * report about one reproducible.
 */
const screen = await CombatScreen.create({
  canvas,
  hud: document.getElementById('hud') as HTMLElement,
  motifs: document.getElementById('motifs') as HTMLElement,
  initial: createCombat({
    deck: UNIT_POOL.map(u => createUnit(u.id)!),
    // The first combat of a run. Which combat a run is on is Phase 8's job.
    enemy: createEnemy(1, { id: 'vorhut', displayName: 'Spähertrupp' }),
    seed: 'parapex-1',
    towerTypes: ['archerTower', 'ballistaTower', 'watchtower', 'cannonTower', 'powderTower'],
  }).state,
  settings: {
    unitScale: 1,
    // Honours the player's own system setting rather than waiting to be asked.
    reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    effects: ALL_EFFECTS,
    debug: NO_DEBUG,
  },
});

const exchange = document.getElementById('exchange') as HTMLButtonElement;
const end = document.getElementById('end') as HTMLButtonElement;
exchange.addEventListener('click', () => screen.exchange());
end.addEventListener('click', () => screen.endRound());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  screen.advance(dt);

  // The commands say what they can do right now rather than refusing later.
  exchange.disabled = screen.busy || !screen.selected.length;
  end.disabled = screen.busy || Boolean(screen.combat.outcome);
  exchange.textContent = screen.selected.length
    ? `${screen.selected.length} tauschen`
    : 'Tauschen';

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/** For the screenshot harness and for anybody poking at a dev build. */
declare global {
  interface Window { PARAPEX: { screen: CombatScreen } }
}
window.PARAPEX = { screen };
