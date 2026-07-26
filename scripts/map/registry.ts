/**
 * Registre des CARTES contrôlables par `npm run map:check -- <scène>`. Chaque entrée expose la Scène
 * compilée (vérité géométrique, `buildScene`) et les mêmes chaînes ASCII que celles passées à
 * `buildScene` (pour que `locate.ts` retrouve leur position exacte dans le fichier source). Ajouter
 * une carte = ajouter une entrée ici — l'outil de contrôle lui-même ne change jamais.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Scene } from '../../src/state/scene';
import { buildDiligenceFloorplan, DILIGENCE_FLOORPLAN_SPEC } from '../../src/scenes/diligence/floorplan';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { REZ_ASCII, ETAGE_ASCII } from '../../src/scenes/opera/floorplan.ascii';

const HERE = dirname(fileURLToPath(import.meta.url));
const sceneDir = (name: string) => join(HERE, '../../src/scenes', name);

export interface ZoneLegendEntry {
  label: string;
  presentation?: 'interior' | 'exterior';
}

export interface MapEntry {
  key: string;
  label: string;
  /** Dossier où chercher les `export const … = String.raw\`…\`` sources (tous les `.ts` du dossier). */
  sourceDir: string;
  build: () => Scene;
  /** Grilles `walled` (box-drawing) par étage — MÊME chaîne que `MapSpec.walled[z]`. */
  walledGrids: Record<string, string>;
  /** Grilles `zoneMap` (denses, 1 char = 1 case) par étage, si la carte en authore. */
  zoneGrids?: Record<string, string>;
  zoneLegend?: Record<string, ZoneLegendEntry>;
  /** Chars de case (grille `walled` de l'étage source) qui posent une volée d'escalier légitime
   *  (`MapSpec.cells[c].stair`) — un « trou » de plancher d'étage sur ces chars est une TRÉMIE voulue. */
  stairChars?: Set<string>;
  /** Terrains de sol NU (non bâti) — un étage qui repose dessus n'a « rien dessous ». */
  groundTerrains: Set<string>;
  /** Terrain « plancher » (bâti au rez) et « pavé » (cour/passage couvert) — pour la carte de
   *  superposition `--carte` uniquement (légende `#`/`1`/`0`/`,`/`.`). */
  floorTerrain: string;
  paveTerrain?: string;
}

/** `MapSpec.zoneMap` accepte `string | string[]` (grille pré-découpée) — nos cartes n'authorent que
 *  des `String.raw` (chaîne). Ne conserve que les entrées effectivement chaînes, jamais de coercion
 *  silencieuse d'un tableau. */
function onlyStringGrids(grids: Record<string, string | string[]> | undefined): Record<string, string> | undefined {
  if (!grids) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(grids)) if (typeof v === 'string') out[k] = v;
  return out;
}

const diligenceStairChars = new Set(
  Object.entries(DILIGENCE_FLOORPLAN_SPEC.cells ?? {})
    .filter(([, recipe]) => recipe.stair)
    .map(([char]) => char),
);

export const MAP_REGISTRY: MapEntry[] = [
  {
    key: 'diligence',
    label: 'La Diligence',
    sourceDir: sceneDir('diligence'),
    build: buildDiligenceFloorplan,
    walledGrids: DILIGENCE_FLOORPLAN_SPEC.walled ?? {},
    zoneGrids: onlyStringGrids(DILIGENCE_FLOORPLAN_SPEC.zoneMap),
    zoneLegend: DILIGENCE_FLOORPLAN_SPEC.zoneLegend,
    stairChars: diligenceStairChars,
    groundTerrains: new Set(['herbe', 'terre']),
    floorTerrain: 'plancher',
    paveTerrain: 'pave',
  },
  // `zoneGrids`/`zoneLegend` : IMPOSSIBLE sans inventer une donnée — `floorplan.ts`/`floorplan.ascii.ts`
  // n'authorent aucun `zoneMap` (aucune zone descriptive nommée). `auditFacade`/`auditZoneCoverage`
  // refusent donc de rendre un verdict pour ce plan (garde `descriptiveZoneIndex(scene).size === 0`) —
  // c'est ASSUMÉ, pas décoratif : jamais de verdict géométrique sans corroboration d'auteur (#823 défaut 1).
  // `stairChars` : IMPOSSIBLE aussi, mais pour une autre raison — l'étage se rejoint par 2 RAMPES
  // (`operaRelief`, cf. `floorplan.ts`), AUCUN escalier n'existe sur ce plan (`MapSpec.cells` n'est pas
  // authoré). Sans recette `stair`, `auditStairwells` classe donc tout trou de plancher `SUSPECT` — correct.
  {
    key: 'opera',
    label: 'Théâtre Staatsoper',
    sourceDir: sceneDir('opera'),
    build: buildOperaFloorplan,
    walledGrids: { z0: REZ_ASCII, z1: ETAGE_ASCII },
    // `terrain: 'vide'` EST le sol réel du plan (base authorée du z0, `floorplan.ts`), pas le sentinelle
    // hors-bornes de `terrainAt` (geometry.ts) — `buildScene` remplit tout le grid déclaré (aucune case
    // n'est laissée « sans donnée »), donc dans les BORNES `terrainAt` ne renvoie jamais ce sentinelle
    // pour l'opéra : 'vide' veut dire ici « aucun bâtiment », exactement le rôle de `herbe`/`terre` pour
    // La Diligence. Mesuré inerte à ce jour (0 case d'étage sans appui) — conservé pour la prochaine.
    groundTerrains: new Set(['vide']),
    floorTerrain: 'plancher',
  },
];

export function findMap(key: string): MapEntry {
  const entry = MAP_REGISTRY.find((m) => m.key === key);
  if (!entry) {
    const known = MAP_REGISTRY.map((m) => m.key).join(', ');
    throw new Error(`scène « ${key} » inconnue de scripts/map/registry.ts (connues : ${known})`);
  }
  return entry;
}
