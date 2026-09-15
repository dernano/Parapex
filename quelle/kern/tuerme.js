import { KERN } from './regeln.js';

// ---------- Turmtypen ----------
/*
 * Die fünf Stellungen bleiben über den Lauf; ihr TYP ist die langfristige
 * Fortschrittsachse. Ein Typ ist bewusst kein blosser Prozentsatz: `faktor`
 * ist nur die einfachste Form, `proTurm` darf jede Regel sein.
 */
export const TURMTYPEN = {
  wachturm:      { id: 'wachturm',      name: 'Wachturm',      modell: 'wachturm',   text: 'Keine Sonderregel.' },
  schuetzenturm: { id: 'schuetzenturm', name: 'Schützenturm',  modell: 'turmwache',  gattung: 'bogen',      faktor: KERN.turmFaktor, text: 'Bogenschützen +40 % Wucht.' },
  ballistenturm: { id: 'ballistenturm', name: 'Ballistenturm', modell: 'steinturm',  gattung: 'armbrust',   faktor: KERN.turmFaktor, text: 'Armbrustschützen +40 % Wucht.' },
  geschuetzturm: { id: 'geschuetzturm', name: 'Geschützturm',  modell: 'doppelturm', gattung: 'artillerie', faktor: KERN.turmFaktor, text: 'Artillerie +40 % Wucht.' },
  pulverturm:    { id: 'pulverturm',    name: 'Pulverturm',    modell: 'bergfried',  gattung: 'kanonier',   faktor: KERN.turmFaktor, text: 'Kanoniere +40 % Wucht.' },
};
export const TURM_START = ['wachturm', 'wachturm', 'wachturm', 'wachturm', 'wachturm'];

/** Was der Turmtyp mit der Wucht seiner Einheit macht. */
export function turmFaktor(turm) {
  const typ = TURMTYPEN[turm.typ] || TURMTYPEN.wachturm;
  if (!turm.einheit || !typ.gattung) return 1;
  return turm.einheit.gattung === typ.gattung ? (typ.faktor || 1) : 1;
}
