/**
 * The vocabulary of the game.
 *
 * Identifiers and types are English. Anything the *player* reads stays German
 * and lives in `displayName` / `description` fields: those are content, not
 * code, and translating them would change the product rather than the
 * architecture. See docs/GLOSSARY.md for the German/English mapping.
 *
 * Nothing in this file knows about the DOM, a canvas, PixiJS or a timer, and
 * nothing in it ever will.
 */

/* ---------- Units ---------- */

/** The four branches of service. German: Gattung. */
export type BranchId = 'bow' | 'crossbow' | 'artillery' | 'gunner';

/** 1..13, from peasant to marshal. The rank *is* the base force. */
export type Rank = number;

export interface Branch {
  readonly id: BranchId;
  /** German, shown to the player. */
  readonly displayName: string;
  readonly shortName: string;
  readonly colour: string;
  readonly highlight: string;
  readonly glyph: string;
}

/** A card in the abstract: one of the 52 entries in the pool. */
export interface UnitPrototype {
  readonly id: string;
  readonly branch: BranchId;
  readonly rank: Rank;
  /** German, shown to the player. */
  readonly displayName: string;
  /** What the rank brings. Equal to `rank` for every pool entry. */
  readonly baseForce: number;
}

/** A card in a deck: a prototype plus what has happened to this copy. */
export interface Unit extends UnitPrototype {
  /** Distinct per copy — two identical cards are two cards. */
  readonly uid: string;
  /** Raised by polishing. Does NOT raise the rank; rank stays a formation matter. */
  readonly forceBonus: number;
  /** 0 = unpolished, 1+ = improved. */
  readonly level: number;
}

/* ---------- Towers ---------- */

export type TowerTypeId =
  | 'watchtower' | 'archerTower' | 'ballistaTower' | 'cannonTower' | 'powderTower';

export interface TowerType {
  readonly id: TowerTypeId;
  /** German, shown to the player. */
  readonly displayName: string;
  /** German, shown to the player. */
  readonly description: string;
  /** Which branch this type favours. Absent on the plain watchtower. */
  readonly branch?: BranchId;
  /** Multiplier applied to a matching unit. Absent means 1. */
  readonly factor?: number;
}

/** One of the five emplacements, as the rules see it. */
export interface Tower {
  /** 1-based, for display. */
  readonly number: number;
  readonly type: TowerTypeId;
  readonly unit: Unit | null;
}

/* ---------- Formations ---------- */

/** Formations come in families; only the highest reached in each family counts. */
export type FormationFamily = 'baseLine' | 'branch' | 'rank' | 'run';

export type FormationId =
  | 'closedFront'
  | 'regiment' | 'greatRegiment' | 'pureGuard'
  | 'doublePost' | 'doubleWatch' | 'tripletPost' | 'fourBlock'
  | 'advance' | 'greatAdvance' | 'perfectAdvance'
  | 'royalAdvance' | 'royalGuard';

/** What a pattern search returns when it matches. */
export interface FormationMatch {
  /** Tower indices the formation is made of. */
  readonly towers: readonly number[];
}

export interface FormationDefinition {
  readonly id: FormationId;
  /** German, shown to the player. */
  readonly displayName: string;
  /** German, shown to the player. */
  readonly description: string;
  readonly family: FormationFamily;
  /** Position within the family. Only the highest tier in a family survives. */
  readonly tier: number;
  /** Volleys at level 1. */
  readonly volleys: number;
  /** Volleys added per level above 1. */
  readonly perLevel: number;
  /** Families this formation dissolves entirely when it matches. */
  readonly dissolves?: readonly FormationFamily[];
  readonly crowning?: boolean;
  readonly guard?: boolean;
  /** The pattern search. Pure: it reads the tableau and returns a match or null. */
  readonly find: (tableau: Tableau) => FormationMatch | null;
}

/** A formation that actually matched, with what it is worth right now. */
export interface ActiveFormation {
  readonly id: FormationId;
  readonly displayName: string;
  readonly description: string;
  readonly family: FormationFamily;
  readonly tier: number;
  readonly crowning: boolean;
  readonly guard: boolean;
  readonly dissolves: readonly FormationFamily[];
  readonly towers: readonly number[];
  readonly level: number;
  readonly volleys: number;
}

/**
 * The occupied emplacements, prepared for pattern matching.
 *
 * Everything here works on SETS, not on adjacency: 7/3/6/12/5 is exactly the
 * same run as 5/6/7. That is deliberate and is the single most important
 * difference from the first version of the game — a player who fields five
 * archers should be rewarded for it without having to sort them first.
 */
export interface TableauCard {
  readonly tower: number;
  readonly rank: Rank;
  readonly branch: BranchId;
  /** A copy conjured by a crest. It occupies no emplacement of its own. */
  readonly copy?: boolean;
}

export interface Tableau {
  readonly cards: readonly TableauCard[];
  /** Indices of occupied towers. */
  readonly occupied: readonly number[];
  /** How many emplacements are occupied. A copy does not occupy one. */
  readonly count: number;
  /** The most common branch, if it appears at least n times. */
  sameBranch(n: number): (FormationMatch & { branch: BranchId }) | null;
  /** The highest rank appearing at least n times. */
  sameRank(n: number): (FormationMatch & { rank: Rank }) | null;
  /** Two distinct ranks that each appear twice. */
  twoPairs(): FormationMatch | null;
  /** The longest unbroken run of ranks, if it reaches n. Equal ranks count once. */
  run(n: number): (FormationMatch & { ranks: readonly Rank[] }) | null;
}

/* ---------- The result of a force calculation ---------- */

/** What one occupied emplacement contributes. */
export interface Emplacement {
  readonly tower: number;
  readonly displayName: string;
  readonly branch: BranchId;
  readonly rank: Rank;
  /** What the rank brings, before polish. */
  readonly base: number;
  /** What polish added. */
  readonly bonus: number;
  /** base + bonus, before the tower type. */
  readonly effective: number;
  readonly towerFactor: number;
  /** effective * towerFactor. */
  readonly force: number;
  /** How many shots this emplacement fires. */
  readonly shots: number;
}

/**
 * One line of the calculation, in the order it happened.
 *
 * The display reads these top to bottom instead of re-deriving the number, so
 * a player can follow how 25 became 425 without opening a wiki.
 */
export type SettlementStep =
  | { readonly kind: 'base'; readonly displayName: string; readonly value: null; readonly force: number }
  | { readonly kind: 'formation'; readonly id: FormationId; readonly displayName: string;
      readonly value: string; readonly volleys: number; readonly force: number }
  | { readonly kind: 'volleys'; readonly displayName: string; readonly value: string;
      readonly volleys: number; readonly force: number };

/** Everything a force calculation answers. German: Abrechnung. */
export interface Settlement {
  readonly emplacements: readonly Emplacement[];
  readonly formations: readonly ActiveFormation[];
  readonly steps: readonly SettlementStep[];
  /** How many shots the castle fires. Every volley is a shot the player sees. */
  readonly volleys: number;
  /** Sum of effective force before tower factors — what the cards are worth raw. */
  readonly base: number;
  /** Force of a single volley, rounded. */
  readonly perVolley: number;
  /** What actually lands, rounded. */
  readonly force: number;
}
