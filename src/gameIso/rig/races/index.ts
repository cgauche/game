import type { RaceDef } from './types';
import type { StoredPalette } from '../palette';
import { RACE_DEFS } from './_registry.generated';
export type { RaceDef, RaceFeature } from './types';
export const RACES: Record<string, RaceDef> = Object.fromEntries(RACE_DEFS.map((r) => [r.id, r]));
/** Race par id canonique (sortie de baseSpeciesOf), défaut 'Humain'. */
export function raceById(id: string): RaceDef { return RACES[id] ?? RACES.Humain; }
/** Palette de peau/cheveux d'une race pour un sexe (variante F si définie, sinon la palette commune). */
export function racePalette(id: string, sex: 'M' | 'F'): StoredPalette {
  const r = raceById(id);
  return sex === 'F' && r.paletteF ? r.paletteF : (r.palette ?? {});
}
