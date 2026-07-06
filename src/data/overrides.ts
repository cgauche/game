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
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, NAVAL_TRAITS,
} from './index';
// #157 : catalogues de CONTENU déjà chargés par un module dédié (`src/data/*.ts` ou `src/engine/*.ts`,
// pas la façade `index.ts`) — importés DIRECTEMENT ici (même patron que `massBattle*` ci-dessus, qui
// vient déjà d'`engine/massBattle.ts`). Le module JSON est un singleton ESM : cette référence EST la
// même que celle lue par le moteur → l'édition Codex (splice en place) reste visible en jeu.
import { MOUNT_PROFILES } from '../engine/mountTravel';
import { MOUNT_INCIDENTS, VEHICLE_PROBLEMS } from '../engine/travelTables';
import { TAVERN_GAMES } from '../engine/tavernGame';
import { OBSESSIONS } from './obsessions';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import { LAND_CARGOES } from '../engine/landCargo';
import { CARGOES } from '../engine/seaVoyage';
import { RIVER_PERILS } from '../engine/riverNavigation';
import { MORALE_FACTORS, MORALE_BANDS } from '../engine/crewMorale';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';
import { CRITICAL_TABLES } from './criticals';
import type { GameOp } from '../engine/ops';
import type { Difficulty } from '../engine/types';
import criticalsRawJson from './criticals.json';
import aaCriticalsRawJson from './aa-criticals.json';
import traumasRawJson from './traumas.json';

/** Fiche de Traumatisme (`traumas.json`, #157) — MÊME schéma que `engine/trauma.ts::TraumaFiche`
 *  (module-privé là-bas, redéclaré ici a minima pour le seam d'édition ; `traumaFicheById` reste la
 *  SOURCE de vérité runtime, ce type ne sert qu'au dataset éditable). */
export interface TraumaFicheEntry {
  id: string; label: string; desc: string; ops?: GameOp[];
  kind?: 'dechirure' | 'fracture'; severity?: 'mineur' | 'majeur';
  prosthesis?: { trappingId: string; cancels: 'all' | 'movement' }[];
}
const traumas = traumasRawJson as TraumaFicheEntry[];

/** Entrée de table de Blessures Critiques par Localisation (LDB 18 « Traumatisme » ET AA « approche
 *  alternative ») — MÊME schéma pour les 2 familles (l'AA ajoute `blessures`/`trivial`, jamais retiré). */
export interface CritTableEntry {
  id: string; min: number; max: number; name: string;
  blessures?: number; trivial?: boolean; lethal?: boolean;
  ops?: GameOp[]; resist?: { difficulty: Difficulty; onFail: GameOp[]; skill?: string };
  amputation?: { difficulty: Difficulty; sequels: string[] }; traumas?: string[]; desc: string;
}
// LDB 18 : 4 tables UNIQUES (bras gauche = bras droit, jambe gauche = jambe droite) — réutilise
// `CRITICAL_TABLES` (typé, `data/criticals.ts`) pour les tableaux LIVE (même référence que le moteur).
const criticalsTete = CRITICAL_TABLES.tete as unknown as CritTableEntry[];
const criticalsBras = CRITICAL_TABLES.brasG as unknown as CritTableEntry[];
const criticalsCorps = CRITICAL_TABLES.corps as unknown as CritTableEntry[];
const criticalsJambe = CRITICAL_TABLES.jambeG as unknown as CritTableEntry[];
// AA (Aux Armes, système alternatif) : aucun export tableau (seules des fonctions PURES sortent
// d'`aaCritical.ts`) — importé RAW ici (singleton ESM, même fichier que le moteur relit).
const aaCriticalsRoot = aaCriticalsRawJson as unknown as { tete: CritTableEntry[]; bras: CritTableEntry[]; corps: CritTableEntry[]; jambe: CritTableEntry[] };
const aaCriticalsTete = aaCriticalsRoot.tete;
const aaCriticalsBras = aaCriticalsRoot.bras;
const aaCriticalsCorps = aaCriticalsRoot.corps;
const aaCriticalsJambe = aaCriticalsRoot.jambe;

/** Datasets-tableaux mutables (clé éditeur → MÊME référence d'array que l'export de la façade). */
const ARRAYS = {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  pregens, oups, interludeEvents, peripeties,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate,
  // #157 : catalogues de CONTENU app-owned (façade `index.ts` ou module dédié), exposés au Codex.
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, navalTraits: NAVAL_TRAITS,
  montures: MOUNT_PROFILES, incidentsMonture: MOUNT_INCIDENTS, problemesVehicule: VEHICLE_PROBLEMS,
  tavernGames: TAVERN_GAMES, obsessions: OBSESSIONS as unknown as { min: number; max: number; label: string }[],
  structureCriticals: STRUCTURE_CRITICALS, traumas,
  landCargo: LAND_CARGOES, seaCargo: CARGOES, riverPerils: RIVER_PERILS,
  crewMoraleFactors: MORALE_FACTORS, crewMoraleBands: MORALE_BANDS, steamBreakdowns: STEAM_BREAKDOWNS,
  criticalsTete, criticalsBras, criticalsCorps, criticalsJambe,
  aaCriticalsTete, aaCriticalsBras, aaCriticalsCorps, aaCriticalsJambe,
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
  // Blessures critiques (LDB 18 « Traumatisme ») : 4 tables (Tête/Bras/Corps/Jambe) NICHÉES dans
  // `criticals.json` — même patron que mass-battle (réécrire le PARENT entier au save).
  criticalsTete: { file: 'criticals.json', root: () => criticalsRawJson },
  criticalsBras: { file: 'criticals.json', root: () => criticalsRawJson },
  criticalsCorps: { file: 'criticals.json', root: () => criticalsRawJson },
  criticalsJambe: { file: 'criticals.json', root: () => criticalsRawJson },
  // Blessures critiques AA (« approche alternative ») : mêmes 4 familles, NICHÉES dans `aa-criticals.json`.
  aaCriticalsTete: { file: 'aa-criticals.json', root: () => aaCriticalsRawJson },
  aaCriticalsBras: { file: 'aa-criticals.json', root: () => aaCriticalsRawJson },
  aaCriticalsCorps: { file: 'aa-criticals.json', root: () => aaCriticalsRawJson },
  aaCriticalsJambe: { file: 'aa-criticals.json', root: () => aaCriticalsRawJson },
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
