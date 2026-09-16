import type { CrestId } from '@/crests/types';

/**
 * German crest ids as the legacy tree writes them. Crest ids are in every save
 * file and in the rack's stored order, so this is content knowledge and Phase
 * 9 needs exactly this table.
 */
export const LEGACY_CREST_IDS: Readonly<Record<string, CrestId>> = {
  // common
  loewe: 'lion', doppeladler: 'doubleEagle', schleifstein: 'grindstone',
  steinbock: 'ibex', schlange: 'serpent', sperber: 'sparrowhawk',
  hirsch: 'stag', pflugschar: 'ploughshare', saatkorn: 'seedcorn',
  schmiedehammer: 'hammer', muehlrad: 'millwheel', wetzstein: 'whetstone',
  taube: 'dove', zunder: 'tinder', kriegshorn: 'warhorn', glocke: 'bell',
  fahnentraeger: 'standardBearer', stier: 'bull', amboss: 'anvil',
  grenzstein: 'boundaryStone', mauerkrone: 'muralCrown', fackel: 'torch',
  verwuester: 'pillager', kerbholz: 'tallyStick',
  // uncommon
  wolf: 'wolf', eber: 'boar', pulverhorn: 'powderHorn', hammerwerk: 'ironworks',
  brandpfeil: 'fireArrow', hetzhund: 'hound', natter: 'adder',
  kupferpfennig: 'copperPenny', rabe: 'raven', luchs: 'lynx', kranich: 'crane',
  wappenrock: 'surcoat', steinadler: 'goldenEagle', sanduhr: 'hourglass',
  eisenring: 'ironRing',
  // rare
  drache: 'dragon', phoenix: 'phoenix', basilisk: 'basilisk', spiegel: 'mirror',
  siegel: 'seal', hydra: 'hydra', triumphbogen: 'triumphalArch',
  kriegskasse: 'warChest',
  // legendary
  greif: 'griffin', ouroboros: 'ouroboros', weltenrad: 'worldWheel',
};

const TO_LEGACY = Object.fromEntries(
  Object.entries(LEGACY_CREST_IDS).map(([german, english]) => [english, german]),
) as Readonly<Record<CrestId, string>>;

export const crestIdFromLegacy = (id: string): CrestId | undefined => LEGACY_CREST_IDS[id];
export const crestIdToLegacy = (id: CrestId): string | undefined => TO_LEGACY[id];
