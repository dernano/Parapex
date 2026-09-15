/*
 * Die Formen, mit denen der Kern rechnet - als JSDoc, nicht als TypeScript.
 *
 * Der Unterschied ist wichtig: hier entsteht KEIN Uebersetzungsschritt. Die
 * Dateien in `quelle/` sind und bleiben JavaScript, das jeder Browser direkt
 * liest. `tsc --noEmit` liest nur mit und meldet, was nicht zusammenpasst.
 * Man bekommt also die Pruefung, ohne sich eine Werkzeugkette einzuhandeln.
 */

/**
 * Eine Einheit auf der Hand oder auf einem Turm. `rang` zaehlt fuer
 * Formationen, `grundwucht` plus `wuchtBonus` fuer den Schaden - siehe
 * `wirkwucht`.
 * @typedef {object} Einheit
 * @property {string} id            Kennung der Grundkarte, etwa 'bogen-9'
 * @property {string} uid           Kennung DIESES Abzugs - zwei gleiche Karten sind zwei
 * @property {string} gattung
 * @property {number} rang          1 bis 13
 * @property {string} name
 * @property {number} grundwucht    was der Rang mitbringt
 * @property {number} wuchtBonus    was Schliffe dazugelegt haben
 * @property {number} stufe         0 = ungeschliffen
 */

/**
 * Eine Stellung auf der Mauer. Feld und Modell traegt die Anzeige bei, der
 * Kern haengt nur `nr`, `typ` und `einheit` daran - es gibt EIN Turmobjekt
 * und nicht zwei, die auseinanderlaufen koennen.
 * @typedef {object} Turm
 * @property {number} nr
 * @property {string} typ
 * @property {Einheit|null} einheit
 * @property {number} [col]
 * @property {number} [row]
 * @property {number} [w]
 * @property {number} [h]
 */

/**
 * Was ein einzelner Turm zu einer Salve beitraegt.
 * @typedef {object} Posten
 * @property {number} turm
 * @property {string} name
 * @property {string} gattung
 * @property {number} rang
 * @property {number} grund        Rang allein
 * @property {number} bonus        was die Schmiede dazugelegt hat
 * @property {number} basis        grund + bonus
 * @property {number} turmFaktor
 * @property {number} wucht        was EIN Schuss anrichtet
 * @property {number} schuesse     wie oft geschossen wird
 */

/**
 * Eine erkannte Formation.
 * @typedef {object} Formation
 * @property {string} id
 * @property {string} name
 * @property {string} text
 * @property {string} familie
 * @property {number} rang         Rang INNERHALB der Familie
 * @property {boolean} kroenung
 * @property {boolean} garde
 * @property {string[]} loest
 * @property {number[]} tuerme
 * @property {number} stufe
 * @property {number} salven
 */

/** Was `neuerKampf` mitbekommt. */
/**
 * @typedef {object} Kampfauftrag
 * @property {any} [feind]
 * @property {Einheit[]} [deck]
 * @property {string[]} [wappen]
 * @property {string[]} [turmTypen]
 * @property {Turm[]|null} [stellungen]
 */

export {};
