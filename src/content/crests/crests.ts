import { RULES } from '@/core/constants';
import type {
  CrestContext, CrestDefinition, CrestEventName, CrestReaction, CrestTools,
} from '@/crests/types';
import { CREST_EVENTS } from '@/crests/types';
import {
  addCopies, addCost, addDraw, addForce, addRank, addVolleys, amplifyAllBefore,
  amplifyPrevious, give, held, ignitionsBefore, multiplyForce, multiplyPerVolley,
  multiplyVolleys, take,
} from '@/crests/effects';

/**
 * The fifty crests, as DATA rather than as code in the rules.
 *
 * The rules know not one crest name. They report events; crests listen. Anyone
 * inventing a crest touches this file and nothing else.
 *
 * WHERE THE NUMBERS LIVE. Combat balance lives in RULES and stays there. A
 * single crest's own number lives with that crest: at fifty crests a central
 * table would only be a second place holding the same figure, and the second
 * place is always the stale one. What a crest is worth is read where it says
 * what it does.
 *
 * Display names, texts and hints are German — they are what the player reads.
 */

/* ---------- Handles many crests need ----------
 * Up here so a crest below stays one line: whoever reads fifty records should
 * see only the RULE, not the same counting three times.
 */

type Towers = readonly ({ unit: unknown | null } | null)[];

const towersOf = (context: CrestContext): Towers =>
  (context.data.towers as Towers | undefined) ?? [];
const occupied = (context: CrestContext): number =>
  towersOf(context).filter(t => t && t.unit).length;
const vacant = (context: CrestContext): number =>
  towersOf(context).filter(t => !t || !t.unit).length;
/** How many crests stand to the right of the running slot. */
const toTheRight = (context: CrestContext, tools: CrestTools): number =>
  Math.max(0, tools.row().length - context.slot - 1);

/**
 * A crest that listens to EVERY event. Amplifiers and counters need it: what
 * the slot to the left did may have happened in any event, and an amplifier
 * that only watches volleys would be half a crest.
 */
function onEveryEvent(reaction: CrestReaction): CrestDefinition['listens'] {
  const listens: Partial<Record<CrestEventName, CrestReaction>> = {};
  for (const event of CREST_EVENTS) listens[event] = reaction;
  return listens;
}

const define = (
  id: string,
  displayName: string,
  glyph: string,
  tincture: string,
  rarity: CrestDefinition['rarity'],
  text: string,
  hint: string,
  listens: CrestDefinition['listens'],
): CrestDefinition => ({ id, displayName, glyph, tincture, rarity, text, hint, listens });

export const CRESTS: readonly CrestDefinition[] = [

  /* ======================= COMMON (24) =======================
   * The common crests are the SOURCES. Almost every one of them does something
   * a rarer crest can later read — powder, marks, devastation, commands. A
   * player who only ever draws common crests still has a machine; it just runs
   * more slowly.
   */

  define('lion', 'Wappen des Löwen', '🦁', '#a8791c', 'common',
    'Die mittlere Stellung zählt ihren Rang dreifach.',
    'Gleiche Ränge, Rangfolgen.', {
      tableauRead: (context) => {
        if (context.data.tower !== Math.floor(RULES.towers / 2)) return;
        addRank(context, (context.data.rank as number) * (RULES.crests.lion - 1), 'dreifacher Rang');
      },
    }),

  define('doubleEagle', 'Wappen des Doppeladlers', '🦅', '#4a4f5c', 'common',
    'Die Einheit auf Stellung 1 zählt für Formationen doppelt.',
    'Regiment, Doppelposten, Rangfolge.', {
      tableauRead: (context) => {
        if (context.data.tower !== 0) return;
        addCopies(context, 1, 'zwei Köpfe');
      },
    }),

  define('grindstone', 'Wappen des Schleifsteins', '🪨', '#6a6a62', 'common',
    'Jede Stellung zählt ihren Rang um eins höher.',
    'Rangfolgen. Vor dem Löwen gesetzt, wächst er mit.', {
      tableauRead: (context) => { addRank(context, 1, 'geschliffen'); },
    }),

  define('ibex', 'Wappen des Steinbocks', '🐐', '#5a5242', 'common',
    'Die Einheit auf der letzten Stellung zählt für Formationen doppelt.',
    'Mit dem Doppeladler werden aus fünf Stellungen sieben Karten.', {
      tableauRead: (context) => {
        if (context.data.tower !== RULES.towers - 1) return;
        addCopies(context, 1, 'auf dem Gipfel');
      },
    }),

  define('serpent', 'Wappen der Schlange', '🐍', '#2f6a4a', 'common',
    'Die ersten zwei Kartentausche jeder Runde kosten nichts.',
    'Alles, was viele Karten sehen will.', {
      cardsExchanged: (context) => {
        if ((context.data.alreadyExchanged as number) >= RULES.crests.serpent) return;
        addCost(context, -RULES.costs.exchange, 'freier Tausch');
      },
    }),

  define('sparrowhawk', 'Wappen des Sperbers', '🪶', '#6a5a4a', 'common',
    'Zu jeder Runde eine Handkarte mehr.',
    'Mehr Auswahl heisst bessere Formationen.', {
      roundBegan: (context) => { addDraw(context, 1, 'weiter Blick'); },
    }),

  define('stag', 'Wappen des Hirschen', '🦌', '#6a5a3a', 'common',
    'Jede Runde eine Veteranenmarke. Je Marke +3 % Wucht.',
    'Alles, was Veteranenmarken liest.', {
      roundEnded: (context, _i, tools) => { give(context, tools, 'veteran', 1, 'überlebte Runde'); },
      volleyPlanned: (context, _i, tools) => {
        const n = held(tools, 'veteran');
        if (n) multiplyForce(context, 1 + 0.03 * n, `${n} Veteranen`);
      },
    }),

  define('ploughshare', 'Wappen der Pflugschar', '🌾', '#7a6a3a', 'common',
    'Ein Sieg bringt zwei Veteranenmarken.',
    'Wächst über den ganzen Feldzug. Braucht Zeit.', {
      combatEnded: (context, _i, tools) => {
        if (context.data.outcome !== 'victory') return;
        give(context, tools, 'veteran', 2, 'nach der Schlacht');
      },
    }),

  define('seedcorn', 'Wappen des Saatkorns', '🌱', '#4a7a3a', 'common',
    'Je zwei Veteranenmarken +1 Salve.',
    'Hirsch, Pflugschar. Ohne Marken tut es nichts.', {
      volleyPlanned: (context, _i, tools) => {
        const n = Math.floor(held(tools, 'veteran') / 2);
        if (n) addVolleys(context, n, `${n} aus Marken`);
      },
    }),

  define('hammer', 'Wappen des Hammers', '🔨', '#5a4a42', 'common',
    'Jede gesetzte Einheit gibt ein Pulver.',
    'Pulverhorn, Zunder, Brandpfeil, Hammerwerk.', {
      unitDeployed: (context, _i, tools) => { give(context, tools, 'powder', 1, 'frisch gemahlen'); },
    }),

  define('millwheel', 'Wappen des Mühlrads', '⚙', '#4a4a44', 'common',
    'Jeder Kartentausch gibt ein Pulver.',
    'Mit der Schlange wird Tauschen zur Pulvermühle.', {
      cardsExchanged: (context, _i, tools) => { give(context, tools, 'powder', 1, 'gemahlen'); },
    }),

  define('whetstone', 'Wappen des Wetzsteins', '🗡', '#52524a', 'common',
    'Jede ersetzte Einheit gibt zwei Pulver.',
    'Mit dem Eber wird Ersetzen doppelt wert.', {
      unitReplaced: (context, _i, tools) => { give(context, tools, 'powder', 2, 'abgelöst'); },
    }),

  define('dove', 'Wappen der Taube', '🕊', '#8a8a82', 'common',
    'Jede gezogene Karte über Rang 9 gibt ein Pulver.',
    'Ein Deck aus hohen Rängen wird zur Quelle.', {
      cardDrawn: (context, _i, tools) => {
        const rank = (context.data.card as { rank?: number } | undefined)?.rank;
        if (typeof rank !== 'number' || rank <= 9) return;
        give(context, tools, 'powder', 1, 'hoher Rang');
      },
    }),

  define('tinder', 'Wappen des Zunders', '🔥', '#8a5a2a', 'common',
    'Verbrennt ein Pulver für +20 % Wucht.',
    'Streitet mit dem Pulverhorn um dasselbe Pulver — wer links steht, bekommt es.', {
      volleyPlanned: (context, _i, tools) => {
        if (!held(tools, 'powder')) return;
        take(context, tools, 'powder', 1, 'angezündet');
        multiplyForce(context, 1.2, 'Zunder');
      },
    }),

  define('warhorn', 'Wappen des Kriegshorns', '📯', '#7a6a2a', 'common',
    'Zu Kampfbeginn zwei Befehle.',
    'Fahnenträger, Feldzeichen.', {
      combatBegan: (context, _i, tools) => { give(context, tools, 'command', 2, 'zum Angriff'); },
    }),

  define('bell', 'Wappen der Glocke', '🔔', '#6a5a2a', 'common',
    'Am Rundenende ein Befehl.',
    'Fahnenträger. Wirkt erst ab der zweiten Runde.', {
      roundEnded: (context, _i, tools) => { give(context, tools, 'command', 1, 'zur Stunde'); },
    }),

  define('standardBearer', 'Wappen des Fahnenträgers', '⚑', '#8a3a3a', 'common',
    'Je Befehl +1 Salve. Befehle bleiben liegen.',
    'Kriegshorn, Glocke. Anders als Pulver wird nichts verbrannt.', {
      volleyPlanned: (context, _i, tools) => {
        const n = held(tools, 'command');
        if (n) addVolleys(context, n, `${n} Befehle`);
      },
    }),

  define('bull', 'Wappen des Stiers', '🐂', '#7a3a2a', 'common',
    'Stehen alle fünf Stellungen, +3 Salven.',
    'Geschlossene Front, Reine Garde. Niemals mit dem Wolf.', {
      volleyPlanned: (context) => {
        if (occupied(context) < RULES.towers) return;
        addVolleys(context, 3, 'volle Burg');
      },
    }),

  define('anvil', 'Wappen des Ambosses', '⛨', '#4a4a52', 'common',
    'Je besetzter Stellung +3 Wucht auf jede Salve.',
    'Klein und verlässlich — und alles, was danach multipliziert, trägt es mit.', {
      volleyPlanned: (context) => { addForce(context, 3 * occupied(context), 'Amboss'); },
    }),

  define('boundaryStone', 'Wappen des Grenzsteins', '🪧', '#5a5a4a', 'common',
    'Je leerer Stellung +6 Wucht auf jede Salve.',
    'Der kleine Bruder des Wolfs — und er addiert, wo der Wolf malnimmt.', {
      volleyPlanned: (context) => { addForce(context, 6 * vacant(context), 'Grenzstein'); },
    }),

  define('muralCrown', 'Wappen der Mauerkrone', '🏰', '#6a6a72', 'common',
    'Je erkannter Formation +1 Salve.',
    'Belohnt breite Blätter statt eines einzigen grossen Musters.', {
      volleyPlanned: (context) => {
        const n = (context.data.formations as readonly unknown[] | undefined)?.length ?? 0;
        if (n) addVolleys(context, n, `${n} Formationen`);
      },
    }),

  define('torch', 'Wappen der Fackel', '🕯', '#8a6a2a', 'common',
    'Je Salve über der fünften +4 % Wucht.',
    'Wächst mit allem, was Salven gibt. Ganz rechts am stärksten.', {
      volleyPlanned: (context) => {
        const over = Math.max(0, (context.data.volleys as number) - 5);
        if (over) multiplyForce(context, 1 + 0.04 * over, `${over} über fünf`);
      },
    }),

  define('pillager', 'Wappen der Brandschatzung', '☄', '#8a3a1a', 'common',
    'Was über die Stärke des Gegners hinausging, wird zu Verwüstung.',
    'Triumphbogen, Kerbholz. Braucht grosse Salven.', {
      overkill: (context, _i, tools) => {
        give(context, tools, 'devastation', Math.round(context.data.over as number), 'Überschlag');
      },
    }),

  define('tallyStick', 'Wappen des Kerbholzes', '📏', '#6a5a42', 'common',
    'Je 5 Verwüstung +1 Wucht auf jede Salve.',
    'Brandschatzung. Wächst über den ganzen Feldzug.', {
      volleyPlanned: (context, _i, tools) => {
        const n = Math.floor(held(tools, 'devastation') / 5);
        if (n) addForce(context, n, 'aus Asche');
      },
    }),

  /* ======================= UNCOMMON (15) ======================= */

  define('wolf', 'Wappen des Wolfs', '🐺', '#3c5a72', 'uncommon',
    'Je leerer Stellung +60 % Gesamtwucht.',
    'Gegen alles, was volle Burgen belohnt. Niemals mit dem Stier.', {
      volleyPlanned: (context) => {
        const n = vacant(context);
        if (n) multiplyForce(context, 1 + RULES.crests.wolf * n, `${n} leere Stellungen`);
      },
    }),

  define('boar', 'Wappen des Ebers', '🐗', '#6b3a2a', 'uncommon',
    'Eine ersetzte Einheit feuert ein letztes Mal.',
    'Wetzstein, Hetzhund. Alles, was Einheiten austauscht.', {
      unitReplaced: (context, _i, tools) => {
        if (context.dryRun) return;
        tools.services().fireSingleShot(context.data.tower as number, 'Wappen des Ebers');
      },
    }),

  define('powderHorn', 'Wappen des Pulverhorns', '✸', '#4a4a52', 'uncommon',
    'Verbrennt alles Pulver: je Pulver +1 Salve.',
    'Braucht eine Pulverquelle. Der Zunder links davon nimmt ihm eines weg.', {
      volleyPlanned: (context, _i, tools) => {
        const n = held(tools, 'powder');
        if (!n) return;
        take(context, tools, 'powder', n, 'verbrannt');
        addVolleys(context, n, `${n} Pulver`);
      },
    }),

  define('ironworks', 'Wappen des Hammerwerks', '🏭', '#52463c', 'uncommon',
    'Je zwei Pulver +3 Wucht auf jede Salve — ohne sie zu verbrennen.',
    'Lebt mit dem Pulverhorn zusammen, wenn es LINKS davon steht.', {
      volleyPlanned: (context, _i, tools) => {
        const n = Math.floor(held(tools, 'powder') / 2);
        if (n) addForce(context, 3 * n, 'gelagertes Pulver');
      },
    }),

  define('fireArrow', 'Wappen des Brandpfeils', '🏹', '#8a4a2a', 'uncommon',
    'Verbrennt drei Pulver für ×1,6 Gesamtwucht.',
    'Teurer als der Zunder und lohnender. Beide zusammen leeren das Horn.', {
      volleyPlanned: (context, _i, tools) => {
        if (held(tools, 'powder') < 3) return;
        take(context, tools, 'powder', 3, 'in Flammen');
        multiplyForce(context, 1.6, 'Brandpfeil');
      },
    }),

  define('hound', 'Wappen des Hetzhunds', '🐕', '#6a4a32', 'uncommon',
    'Jeder Treffer gibt ein Pulver.',
    'Einzelschüsse zählen mit — mit dem Eber wird jede Ablösung zur Quelle.', {
      enemyHit: (context, _i, tools) => { give(context, tools, 'powder', 1, 'gehetzt'); },
    }),

  define('adder', 'Wappen der Natter', '🦎', '#3a6a3a', 'uncommon',
    'Zu Rundenbeginn werden alle Veteranenmarken zu Pulver.',
    'Verwandelt langsame Währung in schnelle. Vorsicht: das Saatkorn geht leer aus.', {
      roundBegan: (context, _i, tools) => {
        const n = held(tools, 'veteran');
        if (!n) return;
        take(context, tools, 'veteran', n, 'eingetauscht');
        give(context, tools, 'powder', n, 'aus Marken');
      },
    }),

  define('copperPenny', 'Wappen des Kupferpfennigs', '🪙', '#7a5a3a', 'uncommon',
    'Am Rundenende wird jedes Pulver zu 8 Verwüstung.',
    'Kerbholz, Triumphbogen — der Umweg über die Asche.', {
      roundEnded: (context, _i, tools) => {
        const n = held(tools, 'powder');
        if (!n) return;
        take(context, tools, 'powder', n, 'vergraben');
        give(context, tools, 'devastation', 8 * n, 'aus Pulver');
      },
    }),

  define('raven', 'Wappen des Raben', '🐦', '#2a2a32', 'uncommon',
    'Führt die Wirkung des ersten Wappens ein zweites Mal aus.',
    'Wertlos auf Platz 1. Setze links, was du doppelt willst.',
    onEveryEvent((context, _i, tools) => {
      if (context.slot === 0) return;
      tools.copy(context, 0);
    })),

  define('lynx', 'Wappen des Luchses', '🐈', '#6a5a3a', 'uncommon',
    'Verstärkt das Wappen links von ihm um die Hälfte.',
    'Der kleine Drache. Zwei davon hintereinander sind kein halber Drache, sondern mehr.',
    onEveryEvent((context, _i, tools) => { amplifyPrevious(context, tools, 0.5); })),

  define('crane', 'Wappen des Kranichs', '🦢', '#5a6a7a', 'uncommon',
    'Je Wappen links von ihm +2 Salven.',
    'Gehört nach rechts. Auf Platz 1 gibt es nichts.', {
      volleyPlanned: (context) => {
        if (!context.slot) return;
        addVolleys(context, 2 * context.slot, `${context.slot} Wappen links`);
      },
    }),

  define('surcoat', 'Wappen des Wappenrocks', '🧥', '#5a3a5a', 'uncommon',
    'Je Wappen rechts von ihm +12 % Wucht.',
    'Die Gegenrichtung zum Kranich. Gehört ganz nach links.', {
      volleyPlanned: (context, _i, tools) => {
        const n = toTheRight(context, tools);
        if (n) multiplyForce(context, 1 + 0.12 * n, `${n} Wappen rechts`);
      },
    }),

  define('goldenEagle', 'Wappen des Steinadlers', '🪽', '#6a6252', 'uncommon',
    'Die Wucht je Salve zählt dreifach, die Salvenzahl nur zur Hälfte.',
    'Dreht das Verhältnis um — und macht jede weitere Salve danach dreimal so wertvoll.', {
      volleyPlanned: (context) => {
        multiplyPerVolley(context, 3, 'schwerer Schlag');
        multiplyVolleys(context, 0.5, 'wenige Schüsse');
      },
    }),

  define('hourglass', 'Wappen der Sanduhr', '⏳', '#7a6a4a', 'uncommon',
    'In den ersten zwei Runden +70 % Wucht.',
    'Für Läufe, die früh gewinnen wollen. Der Sold steigt mit.', {
      volleyPlanned: (context) => {
        if (context.round > 2) return;
        multiplyForce(context, 1.7, 'früh und hart');
      },
    }),

  define('ironRing', 'Wappen des Eisenrings', '⭕', '#4a5254', 'uncommon',
    'Jede Formation gibt noch einmal ihre halben Salven.',
    'Königliche Garde. Je grösser das Muster, desto mehr.', {
      volleyPlanned: (context) => {
        const formations = (context.data.formations as readonly { volleys: number }[]) ?? [];
        const sum = formations.reduce((s, f) => s + f.volleys, 0);
        const n = Math.floor(sum / 2);
        if (n) addVolleys(context, n, 'halbe Formationen');
      },
    }),

  /* ======================= RARE (8) ======================= */

  define('dragon', 'Wappen des Drachen', '🐉', '#7a2a3a', 'rare',
    'Verdoppelt, was das Wappen links von ihm bewirkt hat.',
    'Je stärker der linke Nachbar, desto stärker der Drache.',
    onEveryEvent((context, _i, tools) => { amplifyPrevious(context, tools, 1); })),

  define('phoenix', 'Wappen des Phönix', '🔆', '#a85a1c', 'rare',
    'Lässt das Wappen links von ihm noch einmal zünden.',
    'Anders als der Drache: das Wappen prüft seine Bedingung neu — Pulver wird also erneut verbrannt.',
    onEveryEvent((context, _i, tools) => {
      if (context.slot <= 0) return;
      tools.retrigger(context, context.slot - 1);
    })),

  define('basilisk', 'Wappen des Basilisken', '👁', '#3a5a3a', 'rare',
    'Lässt das Wappen links von ihm zweimal nachzünden.',
    'Der grosse Phönix. An den Sperren merkt man, wo die Kette endet.',
    onEveryEvent((context, _i, tools) => {
      if (context.slot <= 0) return;
      tools.retrigger(context, context.slot - 1);
      tools.retrigger(context, context.slot - 1);
    })),

  define('mirror', 'Wappen des Spiegels', '🪞', '#6a7a8a', 'rare',
    'Führt die Wirkung des Wappens RECHTS von ihm schon jetzt aus.',
    'Das einzige Wappen, das nach rechts sieht. Es zieht eine Wirkung vor den Verstärker.',
    onEveryEvent((context, _i, tools) => {
      if (context.slot + 1 >= tools.row().length) return;
      tools.copy(context, context.slot + 1);
    })),

  define('seal', 'Wappen des Siegels', '⛓', '#52525a', 'rare',
    'Wappen rechts davon zünden erst, wenn der Gegner unter der Hälfte steht.',
    'Ein Riegel. Was dahinter liegt, muss die zweite Hälfte wert sein.',
    onEveryEvent((context) => {
      const enemy = context.enemy;
      if (enemy && enemy.hp * 2 <= (enemy.maxHp || enemy.hp)) return;
      context.aborted = true;
    })),

  define('hydra', 'Wappen der Hydra', '🐲', '#2a5a4a', 'rare',
    'Je Zündung links von ihr +2 Salven, ab der dritten +5.',
    'Zählt Zündungen, nicht Wappen — Nachzündungen und Kopien zählen mit.', {
      volleyPlanned: (context) => {
        const n = ignitionsBefore(context).length;
        if (!n) return;
        addVolleys(context, n >= 3 ? 5 * n : 2 * n, `${n} Zündungen links`);
      },
    }),

  define('triumphalArch', 'Wappen des Triumphbogens', '⛫', '#8a7a4a', 'rare',
    'Je 100 Verwüstung +1 Salve.',
    'Braucht die Brandschatzung. Wächst über den ganzen Feldzug.', {
      volleyPlanned: (context, _i, tools) => {
        const n = Math.floor(held(tools, 'devastation') / 100);
        if (n) addVolleys(context, n, `${n}00 Verwüstung`);
      },
    }),

  define('warChest', 'Wappen der Kriegskasse', '💰', '#7a6a2a', 'rare',
    'Am Rundenende so viele Veteranenmarken, wie Formationen standen.',
    'Saatkorn, Hirsch, Natter. Die schnellste Markenquelle im Spiel.', {
      roundEnded: (context, _i, tools) => {
        const n = (context.data.formations as readonly unknown[] | undefined)?.length || 1;
        give(context, tools, 'veteran', n, 'in die Kasse');
      },
    }),

  /* ======================= LEGENDARY (3) ======================= */

  define('griffin', 'Wappen des Greifen', '🦬', '#9a6a1c', 'legendary',
    'Verdoppelt alles, was links von ihm steht.',
    'Gehört ganz nach rechts. Auf Platz 1 ist er ein leeres Feld.',
    onEveryEvent((context, _i, tools) => { amplifyAllBefore(context, tools, 1); })),

  define('ouroboros', 'Wappen des Ouroboros', '♾', '#3a2a4a', 'legendary',
    'Lässt die ganze Reihe noch einmal von vorn laufen.',
    'Gehört ganz nach rechts. Die Kette endet an der Tiefensperre, nicht an ihm.',
    onEveryEvent((context, _i, tools) => {
      // Only once everything else has run.
      if (context.slot + 1 < tools.row().length) return;
      tools.raise(context, context.event, context.data);
    })),

  define('worldWheel', 'Wappen des Weltenrads', '☸', '#6a4a7a', 'legendary',
    'Je Zündung in diesem Ereignis +6 % Wucht.',
    'Belohnt eine laute Maschine. Mit Ouroboros oder Basilisk wächst es ins Unermessliche.', {
      volleyPlanned: (context) => {
        const n = context.ignitions.filter(i => !i.rejected).length - 1;
        if (n > 0) multiplyForce(context, Math.pow(1.06, n), `${n} Zündungen`);
      },
    }),
];

export const CREST_BY_ID: ReadonlyMap<string, CrestDefinition> =
  new Map(CRESTS.map(c => [c.id, c]));

export const CREST_IDS: readonly string[] = CRESTS.map(c => c.id);

/** Rarity names, German, as the player reads them on an offer. */
export const RARITIES: Readonly<Record<CrestDefinition['rarity'], string>> = {
  common: 'gewöhnlich', uncommon: 'ungewöhnlich', rare: 'selten', legendary: 'legendär',
};

export const crestsByRarity = (rarity: CrestDefinition['rarity']): readonly string[] =>
  CRESTS.filter(c => c.rarity === rarity).map(c => c.id);
