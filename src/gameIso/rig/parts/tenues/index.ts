import { TENUE_DEFS } from './_registry.generated';
import type { TenueSet } from './types';

export type { TenueSet, TenueDef } from './types';

/**
 * Table des tenues DÉRIVÉE des fichiers `defs/` (plus de table codée en dur).
 * Ajouter une tenue = déposer un fichier dans `defs/` (puis `npm run gen` hors dev).
 * Clé = `name` du def (nom de classe WFRP, ou 'Nu').
 */
export const TENUES: Record<string, TenueSet> = Object.fromEntries(
  TENUE_DEFS.map((d) => [d.name, d.set]),
);

/** Tenue « nue » (corps de chair) — référencée à part par careerTenueFor pour le cas 'Nu'. */
export const TENUE_NUE: TenueSet = TENUES.Nu;
