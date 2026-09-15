import { KERN } from './regeln.js';

// ---------- Signale ----------
/*
 * Ein kleiner Ereignisbus. Wappen, Turmtypen und später Karten hängen sich
 * hier ein, statt dass der Kampf ihre Namen kennt - sonst steht am Ende ein
 * if/else-Block mit fünfzig Wappen-Kennungen mitten in der Regel.
 *
 * `signalTiefe` ist der Schutz gegen Ketten, die sich selbst auslösen: ein
 * Wappen, das auf `einheitFeuert` hört und dabei feuern lässt, würde sonst
 * das Blatt bis zum Stapelüberlauf beschäftigen.
 */
export const SIGNALE = ['rundeBeginnt', 'karteGezogen', 'karteGetauscht', 'einheitGesetzt',
  'einheitErsetzt', 'einheitEntfernt', 'formationAktiv', 'einheitFeuert', 'nachschuss',
  'salve', 'rundeEndet', 'feindBesiegt', 'kampfEndet'];

export let signalHoerer = {};
export let signalTiefe = 0;
export let signalUeberlauf = 0;

export function hoereSignal(name, was) {
  if (!signalHoerer[name]) signalHoerer[name] = [];
  signalHoerer[name].push(was);
}

export function sendeSignal(name, daten = {}) {
  if (signalTiefe >= KERN.signalMaxTiefe) { signalUeberlauf++; return; }
  signalTiefe++;
  try {
    for (const was of signalHoerer[name] || []) was(daten);
  } finally { signalTiefe--; }
}

export function leereSignale() { signalHoerer = {}; signalTiefe = 0; signalUeberlauf = 0; }
