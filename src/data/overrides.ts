/**
 * Seam app-owned : mutation EN PLACE des datasets de la façade (`src/data/index.ts`). On remplace le
 * CONTENU des tableaux exportés sans JAMAIS réassigner le binding → les ~52 consommateurs (qui
 * gardent la même référence d'array) voient les changements en direct. Unique point de branchement :
 *  - l'éditeur de données in-app (preview live avant écriture disque) ;
 *  - la future couche de surcharges PAR CAMPAGNE (apply au chargement, reset à la sortie).
 *
 * Couvre les 19 datasets-tableaux. `details` (objet imbriqué) et `names` (record, CRLF importé) sont
 * hors v1 — à ajouter ici quand ils auront un éditeur.
 */
import {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, mutations, mutationTables, trappings, creatures, spells, maneuvers, domains, eyes, hairs, stars, locations, books, raceAppearance, gods,
} from './index';

/** Datasets-tableaux mutables (clé éditeur → MÊME référence d'array que l'export de la façade). */
const ARRAYS = {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, mutations, mutationTables, trappings, creatures, spells, maneuvers, domains, eyes, hairs, stars, locations, books, raceAppearance, gods,
} as const;

export type DatasetKey = keyof typeof ARRAYS;
export const DATASET_KEYS = Object.keys(ARRAYS) as DatasetKey[];

/** Tableau live d'un dataset (même référence que l'export façade → lecture/itération par les consommateurs). */
export function datasetArray<K extends DatasetKey>(key: K): (typeof ARRAYS)[K] {
  return ARRAYS[key];
}

/** Seeds immuables (clone du JSON d'origine), capturés à l'init du module — pour `resetData()`. */
const SEED = Object.fromEntries(
  DATASET_KEYS.map((k) => [k, structuredClone(ARRAYS[k] as unknown[])]),
) as Record<DatasetKey, unknown[]>;

/** Remplace EN PLACE le contenu d'un dataset (jamais de réassignation du binding). */
export function setDataset<K extends DatasetKey>(key: K, next: readonly (typeof ARRAYS)[K][number][]): void {
  const arr = ARRAYS[key] as unknown[];
  arr.splice(0, arr.length, ...(next as readonly unknown[]));
}

/** Réinitialise tous les datasets au seed d'origine (JSON app-owned chargé à l'init). */
export function resetData(): void {
  for (const k of DATASET_KEYS) {
    const arr = ARRAYS[k] as unknown[];
    arr.splice(0, arr.length, ...structuredClone(SEED[k]));
  }
}
