import type { RaceDef } from './types';
import { RACE_DEFS } from './_registry.generated';
export type { RaceDef, RaceFeature } from './types';
export const RACES: Record<string, RaceDef> = Object.fromEntries(RACE_DEFS.map((r) => [r.id, r]));
/** Race par id canonique (sortie de baseSpeciesOf), défaut 'Humain'. */
export function raceById(id: string): RaceDef { return RACES[id] ?? RACES.Humain; }
