/**
 * Cartes contrôlables par `npm run map:check -- <clé|chemin/projet.json>`. Deux PROVENANCES, une
 * seule interface (`MapEntry`) :
 *  - carte CODÉE (`MAP_REGISTRY`) : Scène compilée par `buildScene`, plus les mêmes chaînes ASCII que
 *    celles passées à `buildScene` (`source`) pour que `locate.ts` retrouve leur position exacte dans
 *    le fichier — le rapport donne alors `fichier:ligne:colonne` ;
 *  - PROJET exporté par l'éditeur (`.json`) : la Scène y est DÉJÀ compilée, `parseProject` la relit
 *    telle quelle (aucune recompilation). Aucune grille ASCII n'existe derrière ces cases, donc aucun
 *    `source` : le rapport donne des COORDONNÉES de case et le dit (`check.mts`).
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scene } from '../../src/state/scene';
import { TERRAIN_DEFS } from '../../src/state/terrain';
import { parseProject } from '../../src/state/worldMap';
import { buildDiligenceFloorplan, DILIGENCE_FLOORPLAN_SPEC } from '../../src/scenes/diligence/floorplan';
import { buildOperaFloorplan } from '../../src/scenes/opera/floorplan';
import { REZ_ASCII, ETAGE_ASCII } from '../../src/scenes/opera/floorplan.ascii';

const HERE = dirname(fileURLToPath(import.meta.url));
const sceneDir = (name: string) => join(HERE, '../../src/scenes', name);

/** Grilles ASCII SOURCE d'une carte codée — la seule chose qu'un projet exporté n'a pas. */
export interface MapSource {
  /** Dossier où chercher les `export const … = String.raw\`…\`` sources (tous les `.ts` du dossier). */
  sourceDir: string;
  /** Grilles `walled` (box-drawing) par étage — MÊME chaîne que `MapSpec.walled[z]`. */
  walledGrids: Record<string, string>;
  /** Grilles `zoneMap` (denses, 1 char = 1 case) par étage, si la carte en authore. */
  zoneGrids?: Record<string, string>;
  /** Chars de case (grille `walled` de l'étage source) qui posent une volée d'escalier légitime
   *  (`MapSpec.cells[c].stair`) — un « trou » de plancher d'étage sur ces chars est une TRÉMIE voulue. */
  stairChars?: Set<string>;
}

export interface MapEntry {
  key: string;
  label: string;
  build: () => Scene;
  /** Absent = aucune grille ASCII derrière la Scène (projet exporté) : positions en coordonnées de case. */
  source?: MapSource;
  /** Terrain « plancher » (bâti au rez) et « pavé » (cour/passage couvert) — pour la carte de
   *  superposition `--carte` uniquement (légende `#`/`1`/`0`/`,`/`.`). Absents (projet exporté) = la
   *  carte classe le rez par `BUILT_TERRAINS`. */
  floorTerrain?: string;
  paveTerrain?: string;
}

/** Terrains BÂTIS : ceux dont la def porte `built` (`TerrainDef.built`) — surface construite qui PORTE
 *  l'étage posé dessus (plancher, dallage, pavage, bloc de maçonnerie). */
export const BUILT_TERRAINS = new Set(TERRAIN_DEFS.filter((t) => t.built).map((t) => t.id));

/** Sols NUS = complément de `BUILT_TERRAINS` sur le registre des terrains (famille 5, toutes cartes) :
 *  sol naturel (`herbe`, `terre`, `route`, `sable`…) comme `vide` (rien du tout). Un terrain déposé
 *  demain sans `built` tombe donc ICI, et un étage posé dessus se signale au lieu de passer en silence. */
export const GROUND_TERRAINS = new Set(TERRAIN_DEFS.filter((t) => !t.built).map((t) => t.id));

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
    build: buildDiligenceFloorplan,
    source: {
      sourceDir: sceneDir('diligence'),
      walledGrids: DILIGENCE_FLOORPLAN_SPEC.walled ?? {},
      zoneGrids: onlyStringGrids(DILIGENCE_FLOORPLAN_SPEC.zoneMap),
      stairChars: diligenceStairChars,
    },
    floorTerrain: 'plancher',
    paveTerrain: 'pave',
  },
  // `zoneGrids` : IMPOSSIBLE sans inventer une donnée — `floorplan.ts`/`floorplan.ascii.ts`
  // n'authorent aucun `zoneMap` (aucune zone descriptive nommée). `auditFacade`/`auditZoneCoverage`
  // refusent donc de rendre un verdict pour ce plan (garde `descriptiveZoneIndex(scene).size === 0`) —
  // c'est ASSUMÉ, pas décoratif : jamais de verdict géométrique sans corroboration d'auteur (#823 défaut 1).
  // `stairChars` : IMPOSSIBLE aussi, mais pour une autre raison — l'étage se rejoint par 2 RAMPES
  // (`operaRelief`, cf. `floorplan.ts`), AUCUN escalier n'existe sur ce plan (`MapSpec.cells` n'est pas
  // authoré). Sans recette `stair`, `auditStairwells` classe donc tout trou de plancher `SUSPECT` — correct.
  {
    key: 'opera',
    label: 'Théâtre Staatsoper',
    build: buildOperaFloorplan,
    source: { sourceDir: sceneDir('opera'), walledGrids: { z0: REZ_ASCII, z1: ETAGE_ASCII } },
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

/** Scènes d'un PROJET exporté (`.json` de l'éditeur), une entrée par scène du document. La Scène est
 *  relue par `parseProject` (migrations de schéma + `normalizeScene`, le MÊME chemin que le jeu) : elle
 *  est déjà compilée dans le document, rien n'est rebâti. */
export function loadProjectMaps(path: string): MapEntry[] {
  const doc = parseProject(JSON.parse(readFileSync(path, 'utf8')));
  if (!doc.scenes.length) throw new Error(`projet « ${path} » : aucune scène dans le document.`);
  const file = basename(path);
  return doc.scenes.map((scene) => ({
    key: `${path}#${scene.id}`,
    label: `${scene.nom || scene.id} — ${file}`,
    build: () => scene,
  }));
}

/** Cartes désignées par l'argument de ligne de commande : soit une clé du registre, soit le CHEMIN
 *  d'un projet exporté (`.json`) — dans ce cas TOUTES ses scènes, une par une. */
export function findMaps(arg: string): MapEntry[] {
  return arg.toLowerCase().endsWith('.json') ? loadProjectMaps(arg) : [findMap(arg)];
}
