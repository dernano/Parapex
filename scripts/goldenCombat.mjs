/*
 * PHASE 2c — golden fixtures for the COMBAT ACTIONS.
 *
 * Both implementations are told NOT to shuffle, so both deal the deck in the
 * order given and the draws are comparable without the generator entering into
 * it. Everything else — momentum, costs, the immediate shot, replacement,
 * exchange ordering, volleys, damage, victory, defeat — is then directly
 * comparable step by step.
 *
 * Actions address cards by HAND INDEX, not by uid: uids differ between the two
 * trees, hand positions do not.
 *
 * Decks are kept large enough that the draw pile never empties. Reshuffling
 * uses randomness, and the two trees draw it from different places; that is
 * covered by behavioural tests instead, where the property ("no card lost, no
 * card duplicated") holds regardless of order.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(join(ROOT, 'quelle/kern.js'));

const faelle = [];

/** A snapshot of everything an action can move. */
function stand(k) {
  return {
    runde: k.runde,
    tatendrang: k.tatendrang,
    tauschInRunde: k.tauschInRunde,
    hand: k.hand.map(c => c.id),
    zug: k.zug.map(c => c.id),
    ablage: k.ablage.map(c => c.id),
    tuerme: k.tuerme.map(t => (t.einheit ? t.einheit.id : null)),
    feindHp: k.feind.hp,
    ende: k.ende,
  };
}

function spiele(name, { deckIds, feindHp, turmTypen, handlungen }) {
  const deck = deckIds.map(id => P.neueEinheit(id));
  const feind = { hp: feindHp, maxHp: feindHp, name: 'Prüfgegner', regeln: [] };
  const k = P.neuerKampf({ deck, feind, wappen: [], turmTypen, mischen: false });

  const schritte = [{ handlung: null, stand: stand(k) }];
  for (const h of handlungen) {
    let antwort;
    if (h.art === 'setzen') {
      const karte = k.hand[h.handIndex];
      antwort = karte
        ? P.setzeEinheit(h.turmIndex, karte)
        : { ok: false, grund: 'Diese Karte liegt nicht auf der Hand.' };
    } else if (h.art === 'tauschen') {
      const karten = h.handIndizes.map(i => k.hand[i]).filter(Boolean);
      antwort = karten.length
        ? P.tauscheHandkarten(karten)
        : { ok: false, grund: 'Keine Karte gewählt.' };
    } else {
      const r = P.beendeRunde();
      antwort = { ok: true, ende: r.ende };
    }
    schritte.push({
      handlung: h,
      antwort: { ok: antwort.ok !== false, grund: antwort.grund ?? null },
      stand: stand(k),
    });
  }
  P.raeumeKampf();
  faelle.push({ name, aufbau: { deckIds, feindHp, turmTypen }, schritte });
}

const WACH = ['wachturm', 'wachturm', 'wachturm', 'wachturm', 'wachturm'];
/* Ein Deck, das nie ausgeht: 40 Karten reichen fuer fuenf Runden reichlich. */
const GROSS = P.EINHEITEN_POOL.slice(0, 40).map(k => k.id);

/* ---------- Setzen, Ersetzen, Tatendrang ---------- */
spiele('Eine Einheit setzen', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [{ art: 'setzen', handIndex: 0, turmIndex: 0 }],
});

spiele('Fuenf setzen leert den Tatendrang', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [0, 1, 2, 3, 4].map(i => ({ art: 'setzen', handIndex: 0, turmIndex: i })),
});

spiele('Der sechste Zug wird abgewiesen', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [
    ...[0, 1, 2, 3, 4].map(i => ({ art: 'setzen', handIndex: 0, turmIndex: i })),
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
  ],
});

spiele('Ersetzen legt den Vorgaenger ab', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 2 },
    { art: 'setzen', handIndex: 0, turmIndex: 2 },
  ],
});

spiele('Ein Turm, den es nicht gibt', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [{ art: 'setzen', handIndex: 0, turmIndex: 9 }],
});

/* ---------- Der Sofortschuss ---------- */
spiele('Der Sofortschuss trifft, Turmtyp zaehlt mit', {
  deckIds: GROSS, feindHp: 100000,
  turmTypen: ['schuetzenturm', 'wachturm', 'wachturm', 'wachturm', 'wachturm'],
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 0, turmIndex: 1 },
  ],
});

/* ---------- Tauschen ---------- */
spiele('Eine Karte tauschen', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [{ art: 'tauschen', handIndizes: [0] }],
});

spiele('Drei auf einmal tauschen', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [{ art: 'tauschen', handIndizes: [1, 3, 5] }],
});

spiele('Tauschen ueber den Tatendrang hinaus', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [{ art: 'tauschen', handIndizes: [0, 1, 2, 3, 4, 5] }],
});

spiele('Erst setzen, dann tauschen', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 0, turmIndex: 1 },
    { art: 'tauschen', handIndizes: [0, 1] },
  ],
});

/* ---------- Runden ---------- */
spiele('Eine Runde beenden', {
  deckIds: GROSS, feindHp: 100000, turmTypen: WACH,
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 0, turmIndex: 1 },
    { art: 'runde' },
  ],
});

spiele('Fuenf Runden ohne Sieg sind eine Niederlage', {
  deckIds: GROSS, feindHp: 100000000, turmTypen: WACH,
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 }, { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 1 }, { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 2 }, { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 3 }, { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 4 }, { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
  ],
});

/* ---------- Sieg ---------- */
spiele('Der Sofortschuss allein entscheidet', {
  deckIds: P.EINHEITEN_POOL.slice(0, 40).map(k => k.id), feindHp: 1, turmTypen: WACH,
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 0, turmIndex: 1 },
  ],
});

spiele('Die Salve entscheidet', {
  deckIds: GROSS, feindHp: 30, turmTypen: WACH,
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 1, turmIndex: 1 },
    { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 2 },
  ],
});

/* ---------- Eine ganze Partie ---------- */
spiele('Eine ganze Partie mit gemischten Zuegen', {
  deckIds: GROSS, feindHp: 4000,
  turmTypen: ['schuetzenturm', 'ballistenturm', 'wachturm', 'geschuetzturm', 'pulverturm'],
  handlungen: [
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 2, turmIndex: 1 },
    { art: 'tauschen', handIndizes: [0] },
    { art: 'setzen', handIndex: 1, turmIndex: 2 },
    { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 3 },
    { art: 'setzen', handIndex: 0, turmIndex: 4 },
    { art: 'tauschen', handIndizes: [0, 1] },
    { art: 'runde' },
    { art: 'setzen', handIndex: 0, turmIndex: 0 },
    { art: 'setzen', handIndex: 0, turmIndex: 1 },
    { art: 'runde' },
  ],
});

const raus = {
  _hinweis: 'Generated from the legacy implementation by scripts/goldenCombat.mjs. '
    + 'Both trees run with shuffling switched off so draws are comparable. '
    + 'Actions address cards by hand index. Do not hand-edit.',
  _quelle: 'quelle/kern/kampf.js',
  faelle,
};
const ziel = join(ROOT, 'src/tests/fixtures/combat.golden.json');
writeFileSync(ziel, JSON.stringify(raus, null, 2) + '\n');
console.log(faelle.length + ' Kampf-Goldproben, '
  + faelle.reduce((s, f) => s + f.schritte.length - 1, 0) + ' Handlungen: ' + ziel);
