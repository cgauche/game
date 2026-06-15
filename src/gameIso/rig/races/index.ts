import type { RaceDef } from './types';
import type { StoredPalette } from '../palette';
import { raceAppearance, type RaceAppearanceData } from '../../../data';
import { feat } from '../parts/elements';

/**
 * Apparence d'espèce = DONNÉE app-owned éditable (`src/data/raceAppearance.json`, lu live via la
 * façade) résolue ICI en `RaceDef` : `featureKeys` → `feat()` (overlays du catalogue), le reste en
 * passe-plat. Plus de race-defs code : éditer une espèce dans le Compendium se reflète en jeu.
 */
const cache = new WeakMap<RaceAppearanceData, RaceDef>();
function resolve(rec: RaceAppearanceData): RaceDef {
  const hit = cache.get(rec);
  if (hit) return hit;
  const { featureKeys, ...rest } = rec;
  const def = { ...rest, ...(featureKeys?.length ? { features: feat(...featureKeys) } : {}) } as unknown as RaceDef;
  cache.set(rec, def);
  return def;
}

export type { RaceDef, RaceFeature } from './types';
/** Toutes les races résolues, par id (instantané — relu à chaque accès pour suivre les éditions live). */
export const RACES: Record<string, RaceDef> = new Proxy({} as Record<string, RaceDef>, {
  get: (_t, id: string) => { const r = raceAppearance.find((x) => x.id === id); return r ? resolve(r) : undefined; },
  ownKeys: () => raceAppearance.map((r) => r.id),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
/** Race par id canonique (sortie de baseSpeciesOf), défaut 'Humain'. */
export function raceById(id: string): RaceDef {
  const rec = raceAppearance.find((r) => r.id === id) ?? raceAppearance.find((r) => r.id === 'Humain')!;
  return resolve(rec);
}
/** Palette de peau/cheveux d'une race pour un sexe (variante F si définie, sinon la palette commune). */
export function racePalette(id: string, sex: 'M' | 'F'): StoredPalette {
  const r = raceById(id);
  return sex === 'F' && r.paletteF ? r.paletteF : (r.palette ?? {});
}
