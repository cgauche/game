/**
 * Seam app-owned : mutation EN PLACE des datasets de la façade (`src/data/index.ts`). On remplace le
 * CONTENU des tableaux exportés sans JAMAIS réassigner le binding → les ~52 consommateurs (qui
 * gardent la même référence d'array) voient les changements en direct. Unique point de branchement :
 *  - l'éditeur de données in-app (preview live avant écriture disque) ;
 *  - la future couche de surcharges PAR CAMPAGNE (apply au chargement, reset à la sortie).
 *
 * Couvre les datasets-TABLEAUX (`ARRAYS`) ET les datasets-OBJETS uniques (`OBJECTS`, E3b) :
 * `details` (objet de config imbriqué) et `names` (Record race → pools de noms). Tous mutés EN PLACE,
 * jamais réassignés → les consommateurs gardent la même référence et voient l'édition en direct.
 */
import {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  pregens, oups, interludeEvents, peripeties, details, names,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate, massBattleData,
} from './index';

/** Datasets-tableaux mutables (clé éditeur → MÊME référence d'array que l'export de la façade). */
const ARRAYS = {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  pregens, oups, interludeEvents, peripeties,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate,
} as const;

export type DatasetKey = keyof typeof ARRAYS;
export const DATASET_KEYS = Object.keys(ARRAYS) as DatasetKey[];

/** Datasets-OBJETS uniques (E3b) : pas un tableau d'entités mais UN objet de config (`details`) ou un
 *  Record keyé (`names`). Mutés EN PLACE (mêmes garanties que les tableaux) → preview live + écriture
 *  disque par l'éditeur du Codex. Le fichier disque est `<clé>.json` (`details.json`, `names.json`). */
const OBJECTS = { details, names } as const;
export type ObjectDatasetKey = keyof typeof OBJECTS;
export const OBJECT_DATASET_KEYS = Object.keys(OBJECTS) as ObjectDatasetKey[];

/** Tableau live d'un dataset (même référence que l'export façade → lecture/itération par les consommateurs). */
export function datasetArray<K extends DatasetKey>(key: K): (typeof ARRAYS)[K] {
  return ARRAYS[key];
}

/** Objet live d'un dataset-objet (même référence que l'export façade → vue live des consommateurs). */
export function datasetObject<K extends ObjectDatasetKey>(key: K): (typeof OBJECTS)[K] {
  return OBJECTS[key];
}

/** Seeds immuables (clone du JSON d'origine), capturés à l'init du module — pour `resetData()`. */
const SEED = Object.fromEntries(
  DATASET_KEYS.map((k) => [k, structuredClone(ARRAYS[k] as unknown[])]),
) as Record<DatasetKey, unknown[]>;
const OBJECT_SEED = Object.fromEntries(
  OBJECT_DATASET_KEYS.map((k) => [k, structuredClone(OBJECTS[k])]),
) as Record<ObjectDatasetKey, object>;

/** Remplace EN PLACE le contenu d'un dataset (jamais de réassignation du binding). */
export function setDataset<K extends DatasetKey>(key: K, next: readonly (typeof ARRAYS)[K][number][]): void {
  const arr = ARRAYS[key] as unknown[];
  arr.splice(0, arr.length, ...(next as readonly unknown[]));
}

/** Datasets-tableaux NICHÉS dans un fichier-objet PARTAGÉ : `mass-battle.json` porte 5 tableaux frères
 *  dans UN seul fichier (pas un fichier par tableau, contrairement à tous les autres `ARRAYS`). Mêmes
 *  garanties de mutation en place que `ARRAYS` (`setDataset` continue de fonctionner tel quel sur ces
 *  clés), mais le FICHIER à réécrire et le CONTENU à sérialiser au save divergent : il faut réécrire le
 *  PARENT ENTIER (`massBattleData`), sous peine d'écraser les 4 tableaux frères avec un tableau nu.
 *  `datasetFile`/`datasetSerializeRoot` (lues par `CodexEdit.save`) retombent sur le défaut historique
 *  (`<clé>.json` / le tableau lui-même) pour toute clé absente d'ici — zéro changement de comportement
 *  pour les ~40 datasets existants. */
const NESTED_ARRAY_FILE: Partial<Record<DatasetKey, { file: string; root: () => unknown }>> = {
  massBattleWarMachines: { file: 'mass-battle.json', root: () => massBattleData },
  massBattleStructures: { file: 'mass-battle.json', root: () => massBattleData },
  massBattleHazards: { file: 'mass-battle.json', root: () => massBattleData },
  massBattleMightModifiers: { file: 'mass-battle.json', root: () => massBattleData },
  massBattlePowerEstimate: { file: 'mass-battle.json', root: () => massBattleData },
};
/** Fichier disque d'un dataset-tableau (`<clé>.json` par défaut ; le fichier PARENT pour un tableau niché). */
export function datasetFile(key: DatasetKey): string {
  return NESTED_ARRAY_FILE[key]?.file ?? `${key}.json`;
}
/** Racine à SÉRIALISER au save (le tableau lui-même par défaut ; l'objet PARENT entier pour un tableau
 *  niché — ses tableaux frères doivent survivre à l'édition d'un seul). */
export function datasetSerializeRoot(key: DatasetKey): unknown {
  return NESTED_ARRAY_FILE[key]?.root() ?? datasetArray(key);
}

/** Remplace EN PLACE le contenu d'un dataset-objet : purge ses clés puis ré-assigne (réf stable). */
export function setObjectDataset<K extends ObjectDatasetKey>(key: K, next: (typeof OBJECTS)[K]): void {
  const obj = OBJECTS[key] as Record<string, unknown>;
  for (const k of Object.keys(obj)) delete obj[k];
  Object.assign(obj, next);
}

/** Réinitialise tous les datasets (tableaux ET objets) au seed d'origine (JSON app-owned). */
export function resetData(): void {
  for (const k of DATASET_KEYS) {
    const arr = ARRAYS[k] as unknown[];
    arr.splice(0, arr.length, ...structuredClone(SEED[k]));
  }
  for (const k of OBJECT_DATASET_KEYS) setObjectDataset(k, structuredClone(OBJECT_SEED[k]) as never);
}
