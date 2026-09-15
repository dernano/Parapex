/*
 * Die Ereignisse, auf die ein Wappen hoeren kann.
 *
 * Bisher hatte jedes Wappen seine eigene Bauform: `rangFaktor` wurde im Blatt
 * gelesen, `gesamtFaktor` in der Wucht, `tauschRabatt` beim Tauschen, `horcht`
 * am Signalbus - fuenf verschiedene Haken an fuenf verschiedenen Stellen im
 * Kern. Ein sechster (`retriggerFaktor` des Drachen) wurde ueberhaupt nicht
 * mehr gelesen: das Wappen behauptete auf der Tafel eine Wirkung, die es seit
 * dem Salvenumbau nicht mehr hatte. In einem System aus verstreuten Haken
 * faellt so etwas nicht auf.
 *
 * Jetzt gibt es EINE Liste. Ein Wappen, das auf kein Ereignis hoert, ist
 * auffindbar; ein Ereignis, das niemand meldet, auch.
 */
export const EREIGNIS = {
  // --- Rahmen ---
  kampfBeginnt:    'kampfBeginnt',
  rundeBeginnt:    'rundeBeginnt',
  rundeEndet:      'rundeEndet',
  kampfEndet:      'kampfEndet',

  // --- Hand und Tatendrang ---
  karteGezogen:    'karteGezogen',
  kartenGetauscht: 'kartenGetauscht',

  // --- Die Tuerme ---
  einheitGesetzt:  'einheitGesetzt',
  einheitErsetzt:  'einheitErsetzt',

  // --- Formationen ---
  blattGelesen:    'blattGelesen',     // bevor Muster gesucht werden: Raenge und Gattungen sind noch aenderbar
  formationenErkannt: 'formationenErkannt',

  /*
   * Das wichtigste Ereignis des ganzen Systems. Hier stehen Wucht und Salven
   * noch offen, und hier entscheidet sich, was eine Runde anrichtet. Was
   * frueher `gesamtFaktor` war, ist jetzt ein Platz in dieser Kette - mit dem
   * Unterschied, dass die REIHENFOLGE zaehlt.
   */
  salveGeplant:    'salveGeplant',
  salveGefeuert:   'salveGefeuert',

  // --- Wirkung am Gegner ---
  feindGetroffen:  'feindGetroffen',
  ueberschlag:     'ueberschlag',      // was ueber die Staerke des Gegners hinausging
  feindBesiegt:    'feindBesiegt',

  // --- Wappen ueber Wappen ---
  wappenZuendet:   'wappenZuendet',
};

export const EREIGNIS_LISTE = Object.values(EREIGNIS);

/*
 * Die Vorraete, die es nur gibt, weil Wappen sie schaffen. Kein Wappen, kein
 * Vorrat - das ist Absicht: wer das erste Pulverhorn findet, bekommt kein
 * hoeheres Zahlenband, sondern eine Regel, die es vorher nicht gab.
 */
export const VORRAT_ARTEN = {
  veteran:     { id: 'veteran',     name: 'Veteranenmarke', zeichen: '✠', bleibt: 'lauf'  },
  pulver:      { id: 'pulver',      name: 'Pulver',         zeichen: '✸', bleibt: 'kampf' },
  verwuestung: { id: 'verwuestung', name: 'Verwüstung',     zeichen: '☄', bleibt: 'lauf'  },
  befehl:      { id: 'befehl',      name: 'Befehl',         zeichen: '⚑', bleibt: 'kampf' },
};
