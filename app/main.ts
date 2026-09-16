import type { Tower } from '@/core/types';
import { createUnit } from '@/content/units/pool';
import { computeForce } from '@/simulation/VolleyEngine';

/*
 * PHASE 1 PROOF, and nothing more.
 *
 * No renderer, no scene manager, no game loop. This file exists to show that
 * the engine which the Node tests exercise is the very same module the browser
 * loads - one implementation, two hosts. Everything visible here is thrown
 * away in Phase 4.
 */
const towers: Tower[] = ['gunner-9', 'gunner-10', 'gunner-11', 'gunner-12', 'gunner-13']
  .map((id, i): Tower => ({ number: i + 1, type: 'powderTower', unit: createUnit(id) }));

const settlement = computeForce(towers);

const root = document.getElementById('app');
if (root) {
  root.innerHTML = `
    <h1>Parapex — Phase 1</h1>
    <p>Fünf Kanoniere, neun bis König, auf fünf Pulvertürmen.</p>
    <p><strong>${settlement.force.toLocaleString('de-DE')} Wucht</strong>
       aus ${settlement.volleys} Salven.</p>
    <ul>${settlement.formations
      .map(f => `<li>${f.displayName} — +${f.volleys} Salven</li>`).join('')}</ul>
    <p><small>Gerechnet von <code>src/simulation/VolleyEngine.ts</code> —
       demselben Modul, gegen das <code>npm test</code> läuft.</small></p>`;
}
