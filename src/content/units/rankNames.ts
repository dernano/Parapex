import type { BranchId } from '@/core/types';

/**
 * Thirteen ranks per branch, from peasant to marshal. The rank IS the base
 * force — one number you read off the card instead of a second one you have
 * to look up.
 *
 * German throughout: these are the names on the cards.
 */
export const RANK_NAMES: Readonly<Record<BranchId, readonly string[]>> = {
  bow: ['Bauernschütze', 'Jagdschütze', 'Burgschütze', 'Waldschütze', 'Langbogenschütze',
    'Grenzschütze', 'Veteranenschütze', 'Meisterschütze', 'Falkenschütze', 'Königlicher Schütze',
    'Schützenhauptmann', 'Meister des Langbogens', 'Marschall der Schützen'],
  crossbow: ['Bolzenschütze', 'Wacharmbruster', 'Fußarmbruster', 'Burgarmbruster', 'Spannknecht',
    'Schwerer Armbruster', 'Pavese-Schütze', 'Veteranenarmbruster', 'Arbalestschütze',
    'Meisterarmbruster', 'Scharfschütze', 'Hauptmann der Armbrust', 'Meister der Arbalest'],
  artillery: ['Steinschleuderer', 'Geschützgehilfe', 'Seilspanner', 'Windenmeister',
    'Springald-Besatzung', 'Ballisten-Besatzung', 'Onager-Besatzung', 'Mangonel-Besatzung',
    'Petraria-Besatzung', 'Trebuchet-Besatzung', 'Meister der Balliste', 'Belagerungsingenieur',
    'Meister der Artillerie'],
  gunner: ['Pulverjunge', 'Luntenknecht', 'Pulverträger', 'Büchsenknecht', 'Geschützlademeister',
    'Handrohrschütze', 'Feldschlange-Schütze', 'Bombardenknecht', 'Kanonier', 'Schwerer Kanonier',
    'Bombardenmeister', 'Geschützmeister', 'Meisterkanonier'],
};
