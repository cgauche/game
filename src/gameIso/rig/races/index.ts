import type { RaceDef } from './types';
import { RACE_DEFS } from './_registry.generated';
import { norm } from '../../../lib/normalize';
export type { RaceDef, RaceFeature } from './types';
export const RACES: Record<string, RaceDef> = Object.fromEntries(RACE_DEFS.map((r) => [r.id, r]));
const MATCHERS = RACE_DEFS.filter((r) => r.match)
  .map((r) => ({ id: r.id, re: new RegExp(r.match!), pr: r.matchPriority ?? 100 }))
  .sort((a, b) => a.pr - b.pr);
/** Nom → race (regex+priorité), défaut 'Humain'. Remplace detectSpecies/baseSpeciesOf. */
export function raceOf(name: string): RaceDef {
  const n = norm(name);
  for (const m of MATCHERS) if (m.re.test(n)) return RACES[m.id];
  return RACES.Humain;
}
