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
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, lightTones, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  pregens, oups, interludeEvents, peripeties, details, names, allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate, massBattleData,
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, NAVAL_TRAITS,
  WATER_EXPOSURE, navalPorts,
  navalProgression, seaNavigation, seaPerils, seaWeather, shipConstruction,
  disponibilite, riverNavigation,
  GRAPPLE, NIGHT_STAKES, VOYAGE_STAKES, FLOW_STAKES, COMBAT_STAKES,
} from './index';
// #157 : catalogues de CONTENU déjà chargés par un module dédié (`src/data/*.ts` ou `src/engine/*.ts`,
// pas la façade `index.ts`) — importés DIRECTEMENT ici (même patron que `massBattle*` ci-dessus, qui
// vient déjà d'`engine/massBattle.ts`). Le module JSON est un singleton ESM : cette référence EST la
// même que celle lue par le moteur → l'édition Codex (splice en place) reste visible en jeu.
import { ACTIVITIES } from '../engine/activities';
import { MOUNT_PROFILES } from '../engine/mountTravel';
import { MOUNT_INCIDENTS, VEHICLE_PROBLEMS, encounterTable } from '../engine/travelTables';
import { TAVERN_GAMES } from '../engine/tavernGame';
import { OBSESSIONS } from './obsessions';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import { LAND_CARGOES } from '../engine/landCargo';
import { CARGOES, MANANN_FACTORS, BOARD_EVENTS, PORT_EVENTS } from '../engine/seaVoyage';
import { RIVER_PERILS } from '../engine/riverNavigation';
import { MORALE_FACTORS, MORALE_BANDS } from '../engine/crewMorale';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';
import { CRITICAL_TABLES } from './criticals';
import { SHIP_CRITICAL_TABLES, RIVER_CRIT_SET } from './shipCriticals';
import type { GameOp } from '../engine/ops';
import type { Difficulty } from '../engine/types';
import type { SourceRef } from './schemas/common';
import criticalsRawJson from './criticals.json';
import aaCriticalsRawJson from './aa-criticals.json';
import traumasRawJson from './traumas.json';
import shipCriticalsRawJson from './ship-criticals.json';
import riverCriticalsRawJson from './river-criticals.json';
import rencontresRawJson from './rencontres-edoc.json';
import seaEventsRawJson from './sea-events.json';
// LOT 1 #422 : famille RÈGLES LDB — Coût des Augmentations (07), % de Disponibilité (59), Accidents de
// Conduite d'attelage (09) et Ivresse (09) NICHÉS dans un objet `{table,source}` (même patron que
// `incidents-monture.json`/`problemes-vehicule.json`), Surchargé par palier (61).
import advancementCostsRawJson from './advancementCosts.json';
import drivingMishapRawJson from './driving-mishap.json';
import drunkennessRawJson from './drunkenness.json';
import encumbranceTiersRawJson from './encumbranceTiers.json';
import type { MishapEntry } from '../engine/drivingMishap';
import type { DrunkEntry } from '../engine/drunkenness';
// LOT 3 #422 (FINAL) : dernières 3 exemptions AUDIT — Empoignade (LDB 14, fiche de règle UNIQUE, même
// patron que `disponibilite`/`riverNavigation`), Incantations Imparfaites/Colère des dieux (LDB 46/40,
// 3 tables NICHÉES dans `miscast.json`, même patron que `criticalsTete`/`aaCriticalsTete`), enjeux de
// la cascade de nuit (`night-stakes.json`, tableau RACINE, nom de fichier kebab-case divergent).
import miscastRawJson from './miscast.json';
// Tailles (`sizes.json`) : ses 3 tables sont lues par `engine/size.ts` (dont deux via une référence
// capturée sur la table NICHÉE) — d'où la fusion EN PLACE récursive de `setObjectDataset`.
import sizesRawJson from './sizes.json';
// #851 : Magie environnementale (VDM 14, `arcane-phenomena.json`) — fiche de règle UNIQUE portant 4
// tableaux frères NICHÉS (`saturationLevels`/`windSaturationEffects`/`phenomena`/`tables`, même patron
// que `sizes`/`waterExposure`). Importé RAW (comme `sizesRawJson`) : `data/arcanePhenomena.ts` (lu par
// `engine/magicEnvironment.ts`) importe le MÊME module JSON singleton, sans index précalculé — une
// édition Compendium reste visible en direct, sans rechargement de page.
import arcanePhenomenaRawJson from './arcane-phenomena.json';
import type { SaturationLevel, WindSaturationEffects, ArcanePhenomenon, ArcaneTable } from './arcanePhenomena';

/** Entrée d'une table de miscast (`minor`/`major`/`wrath`, `miscast.json`) — DIALECTE compilé (PAS
 *  des `GameOp` standard, cf. `engine/miscast.ts::JsonRow`) : `ops`/`test` restent au format JSON brut
 *  du dialecte (sin-paramétrage), projetés par un renderer DÉDIÉ côté Codex (jamais `passiveSection`,
 *  qui suppose de vrais `GameOp`). */
export interface MiscastRowEntry {
  id: string; min: number; max: number; label: string;
  ops?: Record<string, unknown>[];
  test?: { skill?: string; characteristic?: string; difficulty: string; onFail: Record<string, unknown>[]; onFailHard?: { dr: number; ops: Record<string, unknown>[] } };
  reroll?: 'majeure' | 'mineure-x2';
  source?: SourceRef;
}
const miscastRoot = miscastRawJson as unknown as { minor: MiscastRowEntry[]; major: MiscastRowEntry[]; wrath: MiscastRowEntry[] };

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
  id: string; min: number; max: number; label: string;
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

/** 3 catégories de Rencontres de voyage (EDOC 8, `rencontres-edoc.json`) — `encounterTable` retourne
 *  la table LIVE (accès de propriété sur le JSON importé par `engine/travelTables.ts`, jamais une copie). */
const rencontresPositives = encounterTable('positives');
const rencontresFortuites = encounterTable('fortuites');
const rencontresDangereuses = encounterTable('dangereuses');

/** Datasets-tableaux mutables (clé éditeur → MÊME référence d'array que l'export de la façade). */
const ARRAYS = {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, lightTones, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  pregens, oups, interludeEvents, peripeties,
  // Axes de forces/faiblesses (#409) — mécanique MAISON, éditable au Codex comme tout catalogue.
  axes: allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate,
  // #168 : catalogue UNIQUE des Activités (interlude/voyage/mer/bataille de masse) exposé au Codex —
  // MÊME référence d'array que le moteur (`engine/activities.ts::ACTIVITIES`, singleton JSON) → l'édition
  // Codex (splice en place) reste visible en jeu. Fichier `activities.json` (défaut), racine = le tableau.
  activities: ACTIVITIES,
  // #157 : catalogues de CONTENU app-owned (façade `index.ts` ou module dédié), exposés au Codex.
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, navalTraits: NAVAL_TRAITS,
  montures: MOUNT_PROFILES, incidentsMonture: MOUNT_INCIDENTS, problemesVehicule: VEHICLE_PROBLEMS,
  tavernGames: TAVERN_GAMES, obsessions: OBSESSIONS as unknown as { min: number; max: number; label: string }[],
  structureCriticals: STRUCTURE_CRITICALS, traumas,
  landCargo: LAND_CARGOES, seaCargo: CARGOES, riverPerils: RIVER_PERILS,
  crewMoraleFactors: MORALE_FACTORS, crewMoraleBands: MORALE_BANDS, steamBreakdowns: STEAM_BREAKDOWNS,
  criticalsTete, criticalsBras, criticalsCorps, criticalsJambe,
  aaCriticalsTete, aaCriticalsBras, aaCriticalsCorps, aaCriticalsJambe,
  // #157 (suite) : jeux de Critiques de coque — MDG 13 (navire) / MSRC 7 (fluvial) — nichés PAR
  // Localisation dans LEUR fichier (même patron que criticals.json/aa-criticals.json ci-dessus).
  shipCriticalsCargaison: SHIP_CRITICAL_TABLES.cargaison,
  shipCriticalsGreement: SHIP_CRITICAL_TABLES.greement,
  shipCriticalsCoque: SHIP_CRITICAL_TABLES.coque,
  shipCriticalsAvirons: SHIP_CRITICAL_TABLES.avirons,
  shipCriticalsEquipements: SHIP_CRITICAL_TABLES.equipements,
  riverCriticalsGreement: RIVER_CRIT_SET.tables.greement!,
  riverCriticalsAvirons: RIVER_CRIT_SET.tables.avirons!,
  riverCriticalsGouvernail: RIVER_CRIT_SET.tables.gouvernail!,
  riverCriticalsCoque: RIVER_CRIT_SET.tables.coque!,
  riverCriticalsSuperstructure: RIVER_CRIT_SET.tables.superstructure!,
  // Rencontres de voyage (EDOC 8) : 3 catégories NICHÉES dans `rencontres-edoc.json`.
  rencontresPositives, rencontresFortuites, rencontresDangereuses,
  // Longs voyages en mer (MDG 15) : Humeur de Manann (facteurs) + Événements de bord/de port —
  // 3 tableaux frères NICHÉS dans `sea-events.json`.
  seaManannFactors: MANANN_FACTORS, seaBoardEvents: BOARD_EVENTS, seaPortEvents: PORT_EVENTS,
  // LOT 1 #422 : Ports (MDG 15), Progression de navire (MDG 13) et 3 sous-tableaux de
  // Construction navale (MDG 12) — `navalPorts` est DÉJÀ un tableau racine ; les 4 autres sont des
  // sous-tableaux NICHÉS dans un objet-config parent (`navalProgression.table`, `shipConstruction.*`,
  // même patron que `seaManannFactors`/`seaBoardEvents`/`seaPortEvents` ci-dessus) — `NESTED_ARRAY_FILE`
  // réécrit le PARENT entier au save.
  navalPorts,
  navalProgression: navalProgression.table,
  shipHullSizes: shipConstruction.standard,
  shipSpeedTraits: shipConstruction.speedTraits,
  shipConstructionTraits: shipConstruction.constructionTraits,
  // LOT 1 #422 : famille RÈGLES LDB — Coût des Augmentations (tableau RACINE) ; Accidents de Conduite
  // d'attelage / Ivresse (tableaux NICHÉS dans `{table,source}`, MÊME référence que le moteur — accès de
  // propriété, jamais une copie) ; Surchargé par palier (tableau RACINE).
  advancementCosts: advancementCostsRawJson,
  drivingMishap: drivingMishapRawJson.table as MishapEntry[],
  drunkenness: drunkennessRawJson.table as DrunkEntry[],
  encumbranceTiers: encumbranceTiersRawJson,
  // LOT 3 #422 (FINAL) : Incantations Imparfaites Mineures/Majeures (LDB 46) + Colère des dieux (LDB 40)
  // — 3 tables frères NICHÉES dans `miscast.json` (même patron que `criticalsTete`/`aaCriticalsTete`).
  miscastMinor: miscastRoot.minor,
  miscastMajor: miscastRoot.major,
  miscastWrath: miscastRoot.wrath,
  // LOT 3 #422 (FINAL) : enjeux VERBATIM de la cascade de nuit — tableau RACINE, nom de fichier
  // kebab-case divergent (même besoin que `navalPorts`).
  nightStakes: NIGHT_STAKES,
  voyageStakes: VOYAGE_STAKES,
  flowStakes: FLOW_STAKES,
  combatStakes: COMBAT_STAKES,
} as const;

export type DatasetKey = keyof typeof ARRAYS;
export const DATASET_KEYS = Object.keys(ARRAYS) as DatasetKey[];

/** `arcane-phenomena.json` (#851) : 4 tableaux frères NICHÉS — mêmes types que `data/arcanePhenomena.ts`. */
interface ArcanePhenomenaFile {
  saturationLevels: SaturationLevel[]; windSaturationEffects: WindSaturationEffects[];
  phenomena: ArcanePhenomenon[]; tables: ArcaneTable[];
}
const arcanePhenomenaFile = arcanePhenomenaRawJson as unknown as ArcanePhenomenaFile;

/** Datasets-OBJETS uniques (E3b) : pas un tableau d'entités mais UN objet de config (`details`), un
 *  Record keyé (`names`), ou une fiche de règle UNIQUE (`waterExposure`, MSRC 16 — #157 suite). Mutés
 *  EN PLACE (mêmes garanties que les tableaux) → preview live + écriture disque par l'éditeur du Codex.
 *  Le fichier disque est `<clé>.json` par défaut (`details.json`, `names.json`) ou l'override
 *  `OBJECT_FILE` pour une clé dont le nom diverge du fichier (`waterExposure` → `water-exposure.json`). */
const OBJECTS = {
  details, names, waterExposure: WATER_EXPOSURE,
  // LOT 1 #422 : 3 fiches de règle UNIQUES (MDG 13) — même patron que `waterExposure` (MSRC 16).
  seaNavigation, seaPerils, seaWeather,
  // LOT 1 #422 (suite) : Disponibilité & Troc (LDB 59) — fiche de règle UNIQUE, même patron.
  disponibilite,
  // LOT 2 #422 : Navigation fluviale (MSRC 7) — fiche de règle UNIQUE, même patron.
  riverNavigation,
  // LOT 3 #422 (FINAL) : Empoignade (LDB 14) — fiche de règle UNIQUE, même patron.
  grapple: GRAPPLE,
  // Barres par catégorie de Taille (mod de tir LDB 14, Enc à bord MDG 12, empreinte de grille MAISON) —
  // fiche de règle UNIQUE, même patron ; les 3 tables sont NICHÉES (cf. la fusion en place ci-dessous).
  sizes: sizesRawJson,
  // #851 : Magie environnementale (VDM 14) — fiche de règle UNIQUE, même patron, 4 tableaux NICHÉS.
  arcanePhenomena: arcanePhenomenaFile,
} as const;
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

/** Fichier disque d'un dataset-OBJET dont la clé JS diverge du nom de fichier (tout fichier de
 *  `src/data` est kebab-case) — même idée que `NESTED_ARRAY_FILE` côté tableaux, mais pour `OBJECTS`.
 *  Absente d'ici → `<clé>.json` (défaut historique, zéro changement pour `details`/`names`). */
const OBJECT_FILE: Partial<Record<ObjectDatasetKey, string>> = {
  waterExposure: 'water-exposure.json',
  seaNavigation: 'sea-navigation.json',
  seaPerils: 'sea-perils.json',
  seaWeather: 'sea-weather.json',
  riverNavigation: 'river-navigation.json',
  arcanePhenomena: 'arcane-phenomena.json',
};
/** Fichier disque d'un dataset-objet (`<clé>.json` par défaut, ou l'override `OBJECT_FILE`). */
export function datasetObjectFile(key: ObjectDatasetKey): string {
  return OBJECT_FILE[key] ?? `${key}.json`;
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
  // Critiques de coque (MDG 13, navire) : 5 Localisations NICHÉES dans `ship-criticals.json`.
  shipCriticalsCargaison: { file: 'ship-criticals.json', root: () => shipCriticalsRawJson },
  shipCriticalsGreement: { file: 'ship-criticals.json', root: () => shipCriticalsRawJson },
  shipCriticalsCoque: { file: 'ship-criticals.json', root: () => shipCriticalsRawJson },
  shipCriticalsAvirons: { file: 'ship-criticals.json', root: () => shipCriticalsRawJson },
  shipCriticalsEquipements: { file: 'ship-criticals.json', root: () => shipCriticalsRawJson },
  // Critiques de coque (MSRC 7, fluvial) : 5 Localisations NICHÉES dans `river-criticals.json`.
  riverCriticalsGreement: { file: 'river-criticals.json', root: () => riverCriticalsRawJson },
  riverCriticalsAvirons: { file: 'river-criticals.json', root: () => riverCriticalsRawJson },
  riverCriticalsGouvernail: { file: 'river-criticals.json', root: () => riverCriticalsRawJson },
  riverCriticalsCoque: { file: 'river-criticals.json', root: () => riverCriticalsRawJson },
  riverCriticalsSuperstructure: { file: 'river-criticals.json', root: () => riverCriticalsRawJson },
  // Rencontres de voyage (EDOC 8) : 3 catégories NICHÉES dans `rencontres-edoc.json`.
  rencontresPositives: { file: 'rencontres-edoc.json', root: () => rencontresRawJson },
  rencontresFortuites: { file: 'rencontres-edoc.json', root: () => rencontresRawJson },
  rencontresDangereuses: { file: 'rencontres-edoc.json', root: () => rencontresRawJson },
  // Longs voyages en mer (MDG 15) : 3 tableaux frères NICHÉS dans `sea-events.json`.
  seaManannFactors: { file: 'sea-events.json', root: () => seaEventsRawJson },
  seaBoardEvents: { file: 'sea-events.json', root: () => seaEventsRawJson },
  seaPortEvents: { file: 'sea-events.json', root: () => seaEventsRawJson },
  // LOT 1 #422 : `navalPorts` (tableau racine, nom de fichier kebab-case divergent — même besoin que
  // `file` ci-dessous sans nichage) ; Progression de navire (1 tableau NICHÉ dans `naval-progression.json`)
  // et 3 sous-tableaux de Construction navale NICHÉS dans `ship-construction.json` — réécrire le PARENT
  // entier au save.
  navalPorts: { file: 'naval-ports.json', root: () => navalPorts },
  navalProgression: { file: 'naval-progression.json', root: () => navalProgression },
  shipHullSizes: { file: 'ship-construction.json', root: () => shipConstruction },
  shipSpeedTraits: { file: 'ship-construction.json', root: () => shipConstruction },
  shipConstructionTraits: { file: 'ship-construction.json', root: () => shipConstruction },
  // LOT 1 #422 : Accidents de Conduite d'attelage / Ivresse — tableau NICHÉ dans `driving-mishap.json`/
  // `drunkenness.json` (`{table,source}`), réécrire le PARENT entier au save (le `source` de table doit survivre).
  drivingMishap: { file: 'driving-mishap.json', root: () => drivingMishapRawJson },
  drunkenness: { file: 'drunkenness.json', root: () => drunkennessRawJson },
  // LOT 3 #422 (FINAL) : miscast — 3 tables NICHÉES dans `miscast.json`, réécrire le PARENT entier au save.
  miscastMinor: { file: 'miscast.json', root: () => miscastRoot },
  miscastMajor: { file: 'miscast.json', root: () => miscastRoot },
  miscastWrath: { file: 'miscast.json', root: () => miscastRoot },
  // LOT 3 #422 (FINAL) : `nightStakes` (tableau racine, nom de fichier kebab-case divergent).
  nightStakes: { file: 'night-stakes.json', root: () => NIGHT_STAKES },
  voyageStakes: { file: 'voyage-stakes.json', root: () => VOYAGE_STAKES },
  flowStakes: { file: 'flow-stakes.json', root: () => FLOW_STAKES },
  combatStakes: { file: 'combat-stakes.json', root: () => COMBAT_STAKES },
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

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Fusion EN PLACE RÉCURSIVE : les sous-objets et sous-tableaux gardent leur identité (mutés par
 *  `mergeInPlace`/`splice`), seules les feuilles sont réassignées ; une clé absente de `next` est
 *  supprimée. Nécessaire parce qu'un consommateur peut capturer une table NICHÉE (`engine/size.ts`
 *  garde `sizesJson.rangedMod`) : une réassignation du parent lui laisserait une référence morte. */
function mergeInPlace(target: Record<string, unknown>, next: Record<string, unknown>): void {
  for (const k of Object.keys(target)) if (!(k in next)) delete target[k];
  for (const [k, v] of Object.entries(next)) {
    const cur = target[k];
    if (Array.isArray(cur) && Array.isArray(v)) cur.splice(0, cur.length, ...v);
    else if (isPlainObject(cur) && isPlainObject(v)) mergeInPlace(cur, v);
    else target[k] = v;
  }
}

/** Remplace EN PLACE le contenu d'un dataset-objet (réf stable, jusqu'aux tables nichées). */
export function setObjectDataset<K extends ObjectDatasetKey>(key: K, next: (typeof OBJECTS)[K]): void {
  mergeInPlace(OBJECTS[key] as Record<string, unknown>, next as Record<string, unknown>);
}

/** Réinitialise tous les datasets (tableaux ET objets) au seed d'origine (JSON app-owned). */
export function resetData(): void {
  for (const k of DATASET_KEYS) {
    const arr = ARRAYS[k] as unknown[];
    arr.splice(0, arr.length, ...structuredClone(SEED[k]));
  }
  for (const k of OBJECT_DATASET_KEYS) setObjectDataset(k, structuredClone(OBJECT_SEED[k]) as never);
}
