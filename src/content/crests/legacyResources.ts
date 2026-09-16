import type { ResourceKind } from '@/crests/types';

/**
 * German supply names as the legacy tree writes them. Supplies are in every
 * save, so this belongs with the other legacy id tables rather than in a test.
 */
export const LEGACY_RESOURCE_KINDS: Readonly<Record<string, ResourceKind>> = {
  veteran: 'veteran',
  pulver: 'powder',
  verwuestung: 'devastation',
  befehl: 'command',
};

const TO_LEGACY = Object.fromEntries(
  Object.entries(LEGACY_RESOURCE_KINDS).map(([g, e]) => [e, g]),
) as Readonly<Record<ResourceKind, string>>;

export const resourceKindToLegacy = (kind: ResourceKind): string => TO_LEGACY[kind];

/** Supply names, German, as the player reads them. */
export const RESOURCE_NAMES: Readonly<Record<ResourceKind, string>> = {
  veteran: 'Veteranenmarke',
  powder: 'Pulver',
  devastation: 'Verwüstung',
  command: 'Befehl',
};

export const RESOURCE_GLYPHS: Readonly<Record<ResourceKind, string>> = {
  veteran: '✠', powder: '✸', devastation: '☄', command: '⚑',
};

/** Which supplies survive a combat, and which survive the whole run. */
export const RESOURCE_PERSISTENCE: Readonly<Record<ResourceKind, 'combat' | 'run'>> = {
  veteran: 'run', powder: 'combat', devastation: 'run', command: 'combat',
};
