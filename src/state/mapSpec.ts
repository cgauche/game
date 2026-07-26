/**
 * `MapSpec` — format DÉCLARATIF d'une carte, compilé en `Scene` par `buildScene` (headless-editor).
 *
 * PUR et Node-safe (ZÉRO import ui/gameIso) : le générateur d'arène (`scripts/arene`, `tsx` en Node)
 * l'exécute sans tirer le rendu. `buildScene` ne fait que REJOUER les primitives pures de l'éditeur
 * (`state/sceneEdit`) dans un ORDRE FIXE — aucune logique ad hoc, chaque section = un appel de primitive.
 *
 * ORDRE DE COMPILATION (verrouillé par `mapSpec.test.ts`) :
 *   1. base       : `emptyScene(w,h)` + scalaires directs (id/nom/… comme les SceneProps de l'éditeur),
 *                   `metresPerTile`/`ambientLight`/`flags` via leurs primitives.
 *   2. terrain    : scan des marqueurs (`scanMarkers`) puis parse ASCII (`parseAsciiRows`) par étage,
 *                   posé via `putLayer`. Marqueurs nettoyés → base propre. Les grilles `walled` (box-drawing)
 *                   parsent tuiles + murs d'arête (`parseWalledAscii`) — les murs sont posés à l'étape 4.
 *   3. relief     : hauteurs métriques (`paintHeight`) par cellule — rect / cell / ramp (interpolation), puis
 *                   `cells` (enceinte/tunnel/départ) et `cells.stair` (volées : rampe interpolée entre deux
 *                   surfaces + trémie, #780 — connexité verticale DÉRIVÉE, pas d'escalier au
 *                   pathfinding).
 *   4. walls      : murs d'arête (`setEdgeWall` + `patchWall` structure) / diagonales (`toggleDiagonalWall`).
 *   5. architecture : `spec.architecture` copié tel quel (masses/façades) — non encore validé.
 *   6. entities   : `spec.entities` bruts + heroStart + interprétation du `bind` aux positions scannées.
 *   7. zones      : entryPoints / restZones / effectZones / triggers / dialogues.
 *   8. encounters : `buildEncounters` (terse → entités cachées + members).
 *   8bis. masses  : `deriveArchitectureMasses` COMPLÈTE les masses déclarées (surcharges, #829) avec
 *                   celles dérivées du plancher réel — plus d'obligation de tout couvrir à la main.
 *   9. validation : masses de bâtiment (`validateBuildingMasses`, garde-fou des SURCHARGES) + support
 *                    de plancher (`validateFloorSupport`) — fail-fast, une fois zones/plancher réel connus.
 */
import type {
  Scene,
  SceneEntity,
  Terrain,
  SceneEffectZone,
  Trigger,
  Dialogue,
  EncounterMember,
  EncounterDef,
  SceneStationAnchor,
  VictoryCondition,
  WallClimb,
  ArchitectureBody,
  ArchitectureRect,
} from './scene';
import { emptyScene, tileAt } from './scene';
import { planStairFlight, applyStairFlight } from './stairFlight';
import type { Flow } from './flow';
import type { FireArc } from '../engine/types';
import type { ThreatTier } from '../engine/advantagePool';
import type { Dir8 } from './dir8';
import { parseAsciiRows, parseWalledAscii, scanMarkers } from './asciiMap';
import { buildEncounter, type AuthoredEnemy } from './encounterAuthoring';
import {
  type Pt,
  type Edge4,
  canonEdge,
  setEdgeWall,
  edgeWallState,
  patchWall,
  toggleDiagonalWall,
  paintHeight,
  paintCrenellated,
  paintTiles,
  fillTerrainRect,
  addLayer,
  putLayer,
  placeEmplacement,
  setPosteCrew,
  setPosteSide,
  pasteEntity,
  addRestZone,
  setMetresPerTile,
  setAmbientLight,
  setSceneFlags,
  realFloorAt,
  roofExclusionsByZ,
  deriveArchitectureMasses,
} from './sceneEdit';

/** Hauteur (m) par défaut d'une ENCEINTE `cells` sans `height` explicite — chemin de ronde à ~4 m (un
 *  « niveau » de relief, cf. `METRES_PER_LEVEL`). */
const CELL_WALL_HEIGHT_M = 4;
/** Terrain MARCHABLE du chemin de ronde auto-posé par une `cells` d'enceinte (dessus du mur plein). */
const CELL_WALKWAY: Terrain = 'pierre';
/** Terrain de la MASSE d'un mur plein `cells` : BLOC PLEIN `mur` (4 m = un étage, échelle unifiée) posé au
 *  sol. Le moteur en dérive TOUTES ses faces (relief existant), y compris la PAROI du tunnel qu'il borde. */
const CELL_MASS: Terrain = 'mur';

/** Un segment de mur DÉCLARATIF : arête cardinale N/E/S/O (canonisée avant écriture) + door/structure,
 *  ou diagonale `\\`/`/` en travers de la case. Plus large que `scene.WallSeg` (qui n'admet que la forme
 *  CANONIQUE N/E) pour laisser l'auteur nommer n'importe quel côté d'une case. */
export interface WallSpec {
  x: number;
  y: number;
  side: Edge4 | '\\' | '/';
  z?: number;
  door?: boolean;
  /** Structure destructible posée sur l'arête (id de `structures.json`, ex. `porte-de-ville`). */
  structure?: string;
  /** DÉCORATIF : l'arête porte une fenêtre au rendu (mur plein serti d'une vitre — ne change pas le combat). */
  window?: boolean;
  /** ESCALADABLE (LDB 15 l.52-57, cf. `WallSeg.climb`) : l'arête sépare deux surfaces de hauteurs
   *  différentes, franchissable en grimpant plutôt qu'à pied. */
  climb?: WallClimb;
}

/** Spec de relief EN COORDONNÉES (repli bas niveau ; préférer `elevate` piloté par l'ASCII) : boîte
 *  inclusive `rect`, cellule unique `cell` (UNE case [x,y]), ou rampe interpolée `ramp`. */
export type ReliefSpec =
  | { rect: [number, number, number, number]; height: number; z?: number }
  | { cell: [number, number]; height: number; z?: number }
  | { ramp: [number, number, number, number]; from: number; to: number; z?: number };

/** Une liaison de marqueur ASCII → pose. `'heroStart'` (départ héros), `{entry}` (point d'entrée),
 *  `{emplacement}` (poste d'artillerie), ou un TEMPLATE partiel de `SceneEntity` (posé par `pasteEntity`). */
/** Enrôle l'entité posée par un marqueur bind dans la rencontre `enc` (côté/IA/monture) — l'id étant
 *  GÉNÉRÉ à la pose (positions venant de l'ASCII), c'est le SEUL moyen de l'ajouter au roster. */
export type BindMember = { enc: string; side?: 'ally' | 'enemy'; ai?: boolean; mount?: boolean };

export type BindSpec =
  | 'heroStart'
  | { entry: string }
  /** `emplacement` (id d'engin) posé au marqueur : `crew` = id d'équipage servant, `side` = arc de tir naval
   *  (FireArc, absent = pivot libre), `facing` = orientation-monde de l'affût (Dir8), `z` HÉRITÉ de l'étage du
   *  marqueur (grille z1 → affût sur le chemin de ronde). `member` = enrôlement dans la rencontre. */
  | { emplacement: string; crew?: string; side?: FireArc; facing?: Dir8; member?: BindMember }
  | { entity: Partial<SceneEntity>; member?: BindMember }
  | Partial<SceneEntity>;

/** Une rencontre DÉCLARATIVE. `enemies` (terse) → entités FRAÎCHES cachées + members (`buildEncounter`) ;
 *  `members` → enrôle des entités DÉJÀ posées (via `entities`/`bind`) par leur id (PNJ visibles, alliés-IA,
 *  affûts inertes). Les deux fusionnent dans un même roster — plus besoin de `scene.encounters.push` impératif. */
export interface EncounterSpec {
  id: string;
  enemies?: AuthoredEnemy[];
  members?: EncounterMember[];
  surprise?: 'party' | 'enemies';
  onVictory?: Flow;
  /** Rencontre invisible en exploration jusqu'au combat (embuscade visuelle) — pose `combat.hiddenUntilCombat`
   *  sur les entités enrôlées via `enemies`. Défaut false (visibles, RAW). */
  hidden?: boolean;
  /** Avantage initial — Manœuvrabilité (AA 11 l.53-65), cf. `EncounterDef.maneuverability`. */
  maneuverability?: 'party' | 'enemies';
  /** Avantage initial — Menace (AA 11 l.53-65), cf. `EncounterDef.threat`. */
  threat?: { camp: 'party' | 'enemies'; tier: ThreatTier };
  /** Avantage initial — Terrain (AA 11 l.53-65), cf. `EncounterDef.terrain`. */
  terrain?: { camp: 'party' | 'enemies'; heavy?: boolean };
  /** Objectif de victoire (#197), cf. `EncounterDef.victoryCondition`. Absent = `allEnemiesDead`. */
  victoryCondition?: VictoryCondition;
}

/** RECETTE par LETTRE d'une CASE COMPLÈTE (sol + AU PLUS un rôle/structure dessus) — l'authoring unifié
 *  d'une enceinte : une lettre = la case entière, self-documentée (plus d'éparpillement `elevate`+`edgeWalls`).
 *  - `wall` : ENCEINTE PLEINE. Auto-pose une ZONE REMPART sur la couche z+1 (bloc solide `height` m + chemin
 *    de ronde marchable + crénelure) → le z0 devient impassable (MASSE DE MUR) et le rendu (falaise + merlons)
 *    suit. `structure` = apparence crénelée (id `structureAppearance`). Le sol z0 = `terrain` (fondation).
 *  - `gate` : TUNNEL brèchable. Comme `wall` (chemin de ronde CONTINU au-dessus, gatehouse) MAIS le z0 reste
 *    PASSABLE et une structure-porte (`structure`, herse) est posée sur l'arête EXTÉRIEURE (`facing`) = la
 *    BOUCHE du périmètre. Intacte elle bloque le passage (`wallBetween`) ; abattue → brèche ouverte.
 *  - `hero` : départ du groupe à cette case.
 *  - `stair` : VOLÉE d'escalier (#780). Voir doc du champ ci-dessous. */
export interface CellRecipe {
  /** Sol / FONDATION de la case (défaut = base de l'étage — évite l'herbe surprise sous une enceinte). */
  terrain?: Terrain;
  wall?: { structure: string; facing?: Edge4; height?: number };
  gate?: { structure: string; facing?: Edge4 };
  hero?: boolean;
  /** VOLÉE d'escalier : relie la surface de l'étage du run (couche z où la lettre est peinte) au
   *  plancher de l'étage `to`, par une rampe de hauteurs interpolées (Δ≤STEP_MAX_M). Connexité
   *  verticale DÉRIVÉE des hauteurs (surfaceLink) — aucun escalier au pathfinding. */
  stair?: { to: string };
}

export interface MapSpec {
  size: [number, number];
  id: string;
  nom: string;
  description?: string;
  ambiance?: Scene['ambiance'];
  weather?: Scene['weather'];
  ambientLight?: string;
  metresPerTile?: number;
  music?: Scene['music'];
  startMessage?: string;
  rest?: Scene['rest'];
  flags?: Record<string, boolean>;
  /** Terrain de base (z0 / couche unique). Défaut 'herbe'. */
  terrain?: Terrain;
  /** Légende ASCII (char → terrain) partagée par tous les étages. */
  legend?: Record<string, Terrain>;
  /** Char LAISSÉ sous un marqueur nettoyé (marqueur → char de LÉGENDE, ex. `{ B:'W' }` pour poser une pièce
   *  SUR le chemin de ronde 'W' sans y percer un trou). Le char résout ensuite via `legend`. Défaut : `'.'`
   *  → base de l'étage (herbe z0 / vide z1). */
  markerFill?: Record<string, string>;
  /** Grilles ASCII par étage (`z0`/`z1`/…). Sinon une couche pleine de `terrain`. */
  levels?: Record<string, string>;
  /** Grilles BOX-DRAWING par étage (`z0`/`z1`/…) : arêtes DANS l'ASCII (`parseWalledAscii`, (2W+1)×(2H+1)).
   *  Chaque étage → `putLayer(z, tiles)` + les murs d'arête/portes RETOURNÉS (avec `z`). Coexiste avec `levels`
   *  (étages différents) ; MÊME base que `levels` (z0 = `terrain`, z>0 = `'vide'`). Traité à l'étape 2 (terrain). */
  walled?: Record<string, string>;
  /** Char d'arête → id de `structures.json` (structure destructible sur l'arête d'un étage `walled`, ex. herse). */
  wallStructures?: Record<string, string>;
  /** HAUTEUR (relief) pilotée par l'ASCII (coordonnée-free) : char de LÉGENDE → hauteur métrique, `number` seul
   *  (`{ '4': 4, '3': 3 }` pour une rampe), OU `{ height, parapet }` pour une ZONE REMPART solide crénelée
   *  (`{ W: { height: 4, parapet: 'mur-en-pierre' } }` → face de maçonnerie + crénelure de périmètre au rendu).
   *  Toute case portant le char (n'importe quel étage) prend cette hauteur — remplace les `relief` en coordonnées. */
  elevate?: Record<string, number | { height: number; parapet: string }>;
  /** MUR D'ARÊTE posé sur une case d'une grille `levels` (coordonnée-free, sans passer au `walled` box-drawing) :
   *  char de LÉGENDE → arête d'une case. `side` = l'arête portée (N/E/S/O, canonicalisée). Ex.
   *  `{ M: { side: 'N', structure: 'mur-en-pierre' }, D: { side: 'N', structure: 'porte-de-ville' } }` pose une
   *  ligne d'enceinte + porte en marquant la rangée du mur. Pour un plan complet (arêtes tous côtés) → `walled`. */
  edgeWalls?: Record<string, { side: Edge4; structure?: string; door?: boolean }>;
  /** RECETTE par LETTRE de CASE COMPLÈTE (`CellRecipe`) : `wall` (enceinte pleine), `gate` (tunnel brèchable),
   *  `hero` (départ), `stair` (volée d'escalier, #780). Une lettre `cells` résout son `terrain` dans la
   *  légende ASCII, puis auto-pose sa structure/rôle (zone rempart z+1, herse, heroStart, rampe interpolée
   *  reliant deux surfaces). Point d'entrée UNIFIÉ d'une muraille (remplace le couple `elevate`+`edgeWalls`)
   *  — mécanisme GÉNÉRAL, toute forme/épaisseur. */
  cells?: Record<string, CellRecipe>;
  walls?: WallSpec[];
  relief?: ReliefSpec[];
  terrainRects?: { rect: [number, number, number, number]; terrain: Terrain; z?: number }[];
  architecture?: ArchitectureBody[];
  /** Cases d'étage dont le plancher NE REPOSE PAS sur quelque chose (vide/terre nue au-dessous) —
   *  défaut de plan MESURÉ et déjà signalé, toléré ICI par la case NOMMÉE (jamais un contournement
   *  silencieux) le temps du lot de correction du plan qui les traite (`validateFloorSupport`). */
  knownUnsupportedFloor?: { x: number; y: number; z: number }[];
  /** Table des marqueurs ASCII (char → pose). Les chars scannés sont nettoyés avant le parse terrain. */
  bind?: Record<string, BindSpec>;
  /** Entités BRUTES (SceneEntity complètes, ids préservés). */
  entities?: SceneEntity[];
  /** Départ héros : `[x,y]` ou `{x,y,z}`. */
  heroStart?: [number, number] | { x: number; y: number; z?: number };
  entryPoints?: Record<string, [number, number]>;
  restZones?: { rect: { x: number; y: number; w: number; h: number }; places?: Scene['rest']; quality?: 'normale' | 'pietre' }[];
  effectZones?: SceneEffectZone[];
  /** Calque de ZONES DESCRIPTIVES par étage : grille de chars aux dimensions de l'étage (` `/`.` = aucune
   *  zone), compilée en `SceneEffectZone` purement descriptives (nom de pièce, sans effet mécanique). Recale
   *  les noms de pièces DANS la source. Un char = UNE zone contiguë (deux régions du même char = une zone
   *  fusionnée par bounding-box). */
  zoneMap?: Record<string, string | string[]>;
  /** Légende du calque `zoneMap` : char → libellé de zone. Un char de `zoneMap` absent d'ici = échec fail-fast. */
  zoneLegend?: Record<string, { id?: string; label: string; presentation?: 'interior' | 'exterior' }>;
  triggers?: Trigger[];
  dialogues?: Dialogue[];
  encounters?: EncounterSpec[];
  /** Ancres AUTHORÉES des Scènes de bataille sur le plan (S2, Puissance de Bataille) — passées telles
   *  quelles sur la Scène construite (`Scene.stations`), consommées par `battleScenesToStations`. */
  stations?: SceneStationAnchor[];
}

/** Découpe une chaîne ASCII en lignes, en ne retirant QUE les lignes vides de tête/queue (une chaîne
 *  `String.raw` bordée de `\n` ne perd pas ses lignes internes ; une chaîne inline reste intacte). */
function rowsOf(str: string | string[]): string[] {
  if (Array.isArray(str)) return [...str];
  const rows = str.split('\n');
  while (rows.length && rows[0].trim() === '') rows.shift();
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  return rows;
}

function copyArchitecture(bodies: ArchitectureBody[]): ArchitectureBody[] {
  return bodies.map((body) => ({
    ...body,
    storeys: body.storeys.map((storey) => ({
      ...storey,
      parts: storey.parts.map((part) => ({ ...part, foot: { ...part.foot } })),
      roomZoneIds: [...storey.roomZoneIds],
    })),
    facades: body.facades.map((facade) => ({
      ...facade,
      edges: facade.edges.map((edge) => ({ ...edge })),
      ...(facade.roomZoneIds ? { roomZoneIds: [...facade.roomZoneIds] } : {}),
      ...(facade.features ? { features: facade.features.map((feature) => ({ ...feature, edge: { ...feature.edge } })) } : {}),
    })),
    masses: body.masses.map((mass) => ({
      ...mass,
      footprint: mass.footprint.map((rect) => ({ ...rect })),
    })),
  }));
}

/** Découpe une grille BOX-DRAWING (`walled`) en lignes, en ne retirant QUE l'ARTEFACT de littéral de gabarit
 *  (une seule ligne vide de tête + une seule de queue autour du `String.raw`). Contrairement à `rowsOf`, les
 *  lignes vides INTERNES (bord `vide` inséré d'un bâti, cf. l'opéra) sont des rangées de grille SIGNIFICATIVES
 *  et PRÉSERVÉES : une grille (2H+1)×(2W+1) ne doit jamais perdre de rangée. */
function walledRowsOf(str: string): string[] {
  const rows = str.split('\n');
  if (rows.length && rows[0].trim() === '') rows.shift();
  if (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  return rows;
}

/** Applique une `ReliefSpec` (cellule par cellule) via `paintHeight`. */
function applyRelief(s: Scene, r: ReliefSpec): Scene {
  const z = ('z' in r ? r.z : undefined) ?? 0;
  if ('cell' in r) {
    return paintHeight(s, { x: r.cell[0], y: r.cell[1] }, r.height, 1, z);
  }
  if ('rect' in r) {
    const [x0, y0, x1, y1] = r.rect;
    let out = s;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out = paintHeight(out, { x, y }, r.height, 1, z);
    return out;
  }
  // ramp : interpolation linéaire axiale du (from) au (to) le long de la ligne (x0,y0)→(x1,y1).
  const [x0, y0, x1, y1] = r.ramp;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  let out = s;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x0 + Math.round((x1 - x0) * t);
    const y = y0 + Math.round((y1 - y0) * t);
    const height = r.from + (r.to - r.from) * t;
    out = paintHeight(out, { x, y }, height, 1, z);
  }
  return out;
}

/** Compile les recettes `cells.stair` (#780) : chaque composante connexe 4-connexe (même couche z) de
 *  cases `stair` est une VOLÉE — une file LINÉAIRE (jamais ramifiée/cyclique) reliant DEUX surfaces déjà
 *  posées (le sol de l'étage du run et le plancher de l'étage `to`) par une rampe de hauteurs interpolées
 *  (Δ par contremarche ≤ STEP_MAX_M). La connexité verticale est ensuite DÉRIVÉE des hauteurs par
 *  `surfaceLink`/`walkNeighbors` — AUCUN escalier au pathfinding, la volée n'est qu'un relief. Chaque garde
 *  échoue vite plutôt que de compiler une carte incohérente (run mélangé, ramifié, trop court, trémie
 *  bouchée, étage absent, orientation ambiguë). */
function applyStairs(s: Scene, spec: MapSpec, cellCells: { char: string; x: number; y: number; z: number }[]): Scene {
  type Cell = { char: string; x: number; y: number; z: number };
  const stairCells = cellCells.filter((c) => spec.cells![c.char].stair);
  if (!stairCells.length) return s;

  const key = (c: { x: number; y: number; z: number }) => `${c.x},${c.y},${c.z}`;
  const byKey = new Map(stairCells.map((c) => [key(c), c]));

  // Composantes connexes 4-connexes PAR couche z (une volée vit sur une seule couche) — BFS.
  const seen = new Set<string>();
  const runs: Cell[][] = [];
  for (const start of stairCells) {
    const k0 = key(start);
    if (seen.has(k0)) continue;
    seen.add(k0);
    const comp: Cell[] = [];
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nk = `${cur.x + dx},${cur.y + dy},${cur.z}`;
        const n = byKey.get(nk);
        if (n && !seen.has(nk)) { seen.add(nk); queue.push(n); }
      }
    }
    runs.push(comp);
  }

  let out = s;
  for (const run of runs) {
    const first = run[0];
    const label = `stair (${first.x},${first.y})`;
    const recs = run.map((c) => spec.cells![c.char].stair!);
    const to = recs[0].to;
    if (recs.some((r) => r.to !== to)) throw new Error(`${label} : volée mélange plusieurs \`to\``);

    const z = first.z;
    const plan = planStairFlight(out, run, z, parseInt(to.replace('z', ''), 10));
    if (!plan.ok) throw new Error(`${label} : ${plan.reason}`);
    out = applyStairFlight(out, plan.steps, z);
  }

  return out;
}

/** Les règles FAIL-FAST d'une masse de bâtiment (#823) — l'auteur est un agent qui ne peut pas juger
 *  son résultat à l'œil : `buildScene` REFUSE une masse incohérente plutôt que de compiler un bâtiment
 *  troué. Chaque message nomme la case/masse fautive et dit QUOI corriger. Une masse à `levels` niveaux
 *  COUVRE tous les étages depuis `z − levels + 1` jusqu'à `z` : c'est sur CETTE PLAGE que les règles
 *  comparent, pas seulement l'étage `z` de la masse — sinon un étage entièrement couvert par une masse
 *  à étage serait accusé à tort d'un « plancher sans masse ».
 *  Note #829 : cette fonction tourne sur les masses FINALES (surcharges déclarées + dérivées par
 *  `deriveArchitectureMasses`, cf. `buildScene`) — la couverture complète est garantie PAR CONSTRUCTION ;
 *  ce garde-fou reste utile pour les SURCHARGES elles-mêmes (contiguïté, ridge ambigu, chevauchement). */
function validateBuildingMasses(scene: Scene): void {
  const massCells = (footprint: readonly ArchitectureRect[]): Set<string> => {
    const out = new Set<string>();
    for (const rect of footprint)
      for (let y = rect.y; y < rect.y + rect.h; y++)
        for (let x = rect.x; x < rect.x + rect.w; x++) out.add(`${x},${y}`);
    return out;
  };
  const isContiguous = (cells: ReadonlySet<string>): boolean => {
    if (cells.size <= 1) return true;
    const start = [...cells][0];
    const seen = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i].split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const key = `${x + dx},${y + dy}`;
        if (cells.has(key) && !seen.has(key)) { seen.add(key); queue.push(key); }
      }
    }
    return seen.size === cells.size;
  };
  const layerZs = new Set(scene.layers.map((l) => l.z));
  const floorAt = realFloorAt(scene);

  for (const body of scene.architecture ?? []) {
    const exclusions = roofExclusionsByZ(body);
    for (const mass of body.masses) {
      if (!Number.isInteger(mass.levels) || mass.levels < 1)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : \`levels\` invalide (${mass.levels}) — entier ≥ 1 attendu`);
      if (!Number.isFinite(mass.pitchDeg) || mass.pitchDeg < 5 || mass.pitchDeg > 75)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : pente ${mass.pitchDeg}° hors plage sensée [5°, 75°] — corrige \`pitchDeg\``);
      const cells = massCells(mass.footprint);
      if (!cells.size)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : emprise vide — \`footprint\` doit contenir au moins un rectangle`);
      if (!isContiguous(cells))
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : emprise NON CONTIGUË — une masse est un seul bloc connexe (4-adjacence) ; scinde-la en plusieurs masses`);
      if ((mass.profile === 'gable' || mass.profile === 'hip') && !mass.ridge) {
        const xs = [...cells].map((k) => Number(k.split(',')[0]));
        const ys = [...cells].map((k) => Number(k.split(',')[1]));
        const bw = Math.max(...xs) - Math.min(...xs) + 1;
        const bh = Math.max(...ys) - Math.min(...ys) + 1;
        if (bw === bh)
          throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : emprise carrée (${bw}×${bh}) — l'axe de faîtage (\`ridge\`) est ambigu, déclare-le ('x' ou 'y')`);
      }
      if (mass.profile === 'shed' && !mass.eaveSide)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : profil \`shed\` sans \`eaveSide\` déclaré — précise le côté d'égout bas ('N'|'E'|'S'|'O')`);
      if (mass.z !== 0 && !layerZs.has(mass.z))
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : étage ${mass.z} inexistant — ajoute la couche ou corrige \`z\``);
    }

    // Règle 1 (silhouette assertée) : au sommet `mass.z` d'une masse — le SEUL étage où son empreinte
    // est une AFFIRMATION explicite de l'auteur — toute case doit être une case de plancher réelle.
    // Règle 2/3 (couverture/chevauchement) : sur TOUTE la plage `z − levels + 1 … z`, PAS seulement le
    // sommet — une masse à étage COUVRE structurellement ses niveaux inférieurs par construction (les
    // murs vont jusqu'en bas), donc son empreinte y compte comme couverture SANS devoir coïncider
    // exactement avec le plancher intérieur du dessous (une pièce du rez peut être plus subdivisée /
    // moins étiquetée que la silhouette de l'étage qui la coiffe — mesuré sur La Diligence : 48 cases
    // d'étage sans étiquette de zone au rez, légitimes). Chevaucher DEUX masses au même étage reste
    // toujours une erreur, à N'IMPORTE quel niveau de la plage.
    const coverage = new Map<number, Map<string, string>>(); // z → (cellKey → massId propriétaire)
    for (const mass of body.masses) {
      const cells = massCells(mass.footprint);
      const floorTop = floorAt(mass.z);
      for (const key of cells)
        if (!floorTop.has(key)) {
          const [x, y] = key.split(',').map(Number);
          throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : case (${x},${y}) hors du plancher réel de l'étage ${mass.z} — retire-la de l'emprise, ou étends/déclare la zone/le plancher qui la justifie`);
        }
      for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) {
        const at = coverage.get(z) ?? (coverage.set(z, new Map()).get(z)!);
        for (const key of cells) {
          const owner = at.get(key);
          if (owner && owner !== mass.id) {
            const [x, y] = key.split(',').map(Number);
            throw new Error(`corps « ${body.id} » : case (${x},${y}) à l'étage ${z} CHEVAUCHÉE par les masses « ${owner} » et « ${mass.id} » — les masses doivent partitionner le plancher sans recouvrement`);
          }
          at.set(key, mass.id);
        }
      }
    }
    for (const [z, at] of coverage) {
      const floor = floorAt(z);
      const excluded = exclusions.get(z);
      for (const key of floor) {
        if (excluded?.has(key)) continue; // #829 : cour à ciel ouvert déclarée — aucune masse n'est due
        if (!at.has(key)) {
          const [x, y] = key.split(',').map(Number);
          throw new Error(`corps « ${body.id} » : case de plancher (${x},${y}) à l'étage ${z} n'appartient à AUCUNE masse — ajoute-la à une masse existante ou crée une masse qui la couvre`);
        }
      }
    }
  }
}


const BARE_GROUND: ReadonlySet<Terrain> = new Set(['herbe', 'terre', 'vide'] as Terrain[]);

/** Une case d'étage (z>0) doit REPOSER sur quelque chose — plancher/pavé au sol, ou une masse de
 *  l'étage inférieur — jamais du vide ni de la terre nue (#825ter, mesuré : 5 cases de La Diligence
 *  posées sur l'herbe, rien ne le détectait). Portée aux SEULS étages qui portent une masse de
 *  bâtiment (`ArchitectureBody.masses`) : un chemin de ronde (`elevate`+parapet, hors masses) est un
 *  système DÉJÀ validé à part (#818) — sa surface porte sur la maçonnerie du rempart, jamais un
 *  plancher/pavé, et ce n'est pas ce que cette règle vérifie. `tolerated` = cases DÉJÀ mesurées
 *  fautives sur un plan EXISTANT (`MapSpec.knownUnsupportedFloor`), tolérées ICI le temps du lot de
 *  correction du plan qui les traite — jamais un contournement silencieux : chaque case tolérée est
 *  NOMMÉE par son auteur. */
function validateFloorSupport(scene: Scene, tolerated: ReadonlySet<string>): void {
  if (!(scene.architecture ?? []).some((body) => body.masses.length)) return; // aucun bâtiment authoré
  const { w, h } = scene.dimensions;
  for (const layer of scene.layers) {
    if (layer.z <= 0) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (tileAt(scene, x, y, layer.z) === 'vide') continue;
        if (tolerated.has(`${x},${y},${layer.z}`)) continue;
        const belowZ = layer.z - 1;
        const belowTerrain = tileAt(scene, x, y, belowZ);
        if (!BARE_GROUND.has(belowTerrain)) continue;
        const built = (scene.architecture ?? []).some((body) =>
          body.masses.some((mass) => belowZ >= mass.z - mass.levels + 1 && belowZ <= mass.z
            && mass.footprint.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)));
        if (built) continue;
        throw new Error(`case d'étage (${x},${y},z${layer.z}) posée sur « ${belowTerrain} » — un plancher d'étage doit reposer sur un plancher/pavé ou une masse de l'étage inférieur, jamais du vide/de la terre nue (\`MapSpec.knownUnsupportedFloor\` pour tolérer un défaut de plan déjà mesuré)`);
      }
  }
}

/** Compile un `MapSpec` en `Scene` — PUR, rejoue les primitives de `sceneEdit` dans l'ordre figé (cf. header). */
export function buildScene(spec: MapSpec): Scene {
  const [w, h] = spec.size;

  // 1. base + scalaires
  let s = emptyScene(w, h);
  s.id = spec.id;
  s.nom = spec.nom;
  if (spec.description !== undefined) s.description = spec.description;
  if (spec.ambiance !== undefined) s.ambiance = spec.ambiance;
  if (spec.weather !== undefined) s.weather = spec.weather;
  if (spec.music !== undefined) s.music = spec.music;
  if (spec.rest !== undefined) s.rest = spec.rest;
  if (spec.startMessage !== undefined) s.startMessage = spec.startMessage;
  if (spec.metresPerTile !== undefined) s = setMetresPerTile(s, spec.metresPerTile);
  if (spec.ambientLight !== undefined) s = setAmbientLight(s, spec.ambientLight);
  s = setSceneFlags(s, spec.flags ?? {});

  // 2. terrain + scan des marqueurs
  const bindChars = Object.keys(spec.bind ?? {}).join('');
  const scanned: { char: string; pos: Pt; z: number }[] = [];
  const walledWalls: WallSpec[] = [];
  // LÉGENDE EFFECTIVE : les lettres `cells` résolvent leur `terrain` (fondation ; défaut = base d'étage) dans
  // l'ASCII, en surchargeant `legend`/BASE_LEGEND → un `#` d'enceinte tombe en 'pierre', pas en 'mur' ni 'herbe'.
  const cellTerrains: Record<string, Terrain> = {};
  for (const [ch, rec] of Object.entries(spec.cells ?? {})) cellTerrains[ch] = rec.terrain ?? spec.terrain ?? 'herbe';
  const effLegend = { ...spec.legend, ...cellTerrains };
  // Cases repérées dans l'ASCII pour les char-maps coordonnée-free (`elevate` hauteur/rempart, `edgeWalls`
  // mur d'arête, `cells` recette de case) — le char est de LÉGENDE (marqueurs déjà nettoyés → markerFill).
  // `elevate` est appliqué à l'étape 3bis (APRÈS le relief) ; `cells` à l'étape 3ter ; `edgeWalls`/`cells`
  // génèrent des `WallSpec` posés à l'étape 4.
  const elevateCells: { char: string; x: number; y: number; z: number }[] = [];
  const edgeWallCells: { char: string; x: number; y: number; z: number }[] = [];
  const cellCells: { char: string; x: number; y: number; z: number }[] = [];
  const scanChars = (rows: string[], z: number, colAt: (r: string, x: number) => string) => {
    if (!spec.elevate && !spec.edgeWalls && !spec.cells) return;
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < w; x++) {
        const ch = colAt(rows[y], x);
        if (spec.elevate?.[ch] !== undefined) elevateCells.push({ char: ch, x, y, z });
        if (spec.edgeWalls?.[ch]) edgeWallCells.push({ char: ch, x, y, z });
        if (spec.cells?.[ch]) cellCells.push({ char: ch, x, y, z });
      }
  };
  if (spec.levels) {
    for (const [key, rows] of Object.entries(spec.levels)) {
      const z = parseInt(key.replace('z', ''), 10);
      const { positions, cleaned } = scanMarkers(rowsOf(rows), bindChars, spec.markerFill);
      for (const [ch, list] of Object.entries(positions)) for (const p of list) scanned.push({ char: ch, pos: p, z });
      const base: Terrain = z === 0 ? (spec.terrain ?? 'herbe') : 'vide';
      const tiles = parseAsciiRows(cleaned, base, effLegend).tiles;
      s = putLayer(s, z, tiles);
      scanChars(cleaned, z, (r, x) => r[x] ?? ' ');
    }
  }
  if (spec.walled) {
    // Grille BOX-DRAWING par étage : `parseWalledAscii` extrait tuiles + murs d'arête/portes. Chaque rangée est
    // recomplétée à 2W+1 (les ASCII éditables retirent les espaces de fin) ; les murs héritent du `z` de l'étage.
    for (const [key, rows] of Object.entries(spec.walled)) {
      const z = parseInt(key.replace('z', ''), 10);
      const base: Terrain = z === 0 ? (spec.terrain ?? 'herbe') : 'vide';
      const padded = walledRowsOf(rows).map((r) => r.padEnd(2 * w + 1, ' '));
      const parsed = parseWalledAscii(padded, base, effLegend, { structures: spec.wallStructures });
      s = putLayer(s, z, parsed.tiles);
      for (const seg of parsed.walls) walledWalls.push({ x: seg.x, y: seg.y, side: seg.side, ...(z ? { z } : {}), ...(seg.door ? { door: true } : {}), ...(seg.window ? { window: true } : {}), ...(seg.structure ? { structure: seg.structure } : {}) });
      scanChars(padded.filter((_, i) => i % 2 === 1), z, (r, x) => r[2 * x + 1] ?? ' '); // tuiles aux slots impairs
    }
  }
  if (!spec.levels && !spec.walled) {
    s = putLayer(s, 0, new Array(w * h).fill(spec.terrain ?? 'herbe') as Terrain[]);
  }
  for (const { rect: [x, y, rw, rh], terrain, z = 0 } of spec.terrainRects ?? []) {
    s = fillTerrainRect(s, { x, y, w: rw, h: rh }, terrain, z);
  }

  // 3. relief (coordonnées, repli) PUIS 3bis les hauteurs pilotées par l'ASCII (`elevate`) : nombre = pente/
  //    palier ; objet `{height, parapet}` = hauteur + marquage CRÉNELÉ (décoration de crête sur le pourtour).
  for (const r of spec.relief ?? []) s = applyRelief(s, r);
  for (const c of elevateCells) {
    const cfg = spec.elevate![c.char];
    s = paintHeight(s, { x: c.x, y: c.y }, typeof cfg === 'number' ? cfg : cfg.height, 1, c.z);
    if (typeof cfg === 'object') s = paintCrenellated(s, { x: c.x, y: c.y }, cfg.parapet, 1, c.z);
  }

  // 3ter. cells : recette par LETTRE de case complète. Une lettre-mur/porte AUTO-POSE une ZONE REMPART sur
  //   la couche z+1 (bloc solide de `height` m + chemin de ronde marchable + crénelure `structure`) → le z0
  //   devient impassable (MASSE DE MUR, `isWalkable`) et le rendu (falaise + merlons) suit tout seul. Une
  //   porte laisse EN PLUS le z0 en TUNNEL (via `gateTunnelAt`) et pose sa herse (`WallSpec structure`) sur la
  //   BOUCHE = l'arête `facing` UNIQUEMENT là où elle borde l'EXTÉRIEUR de la bande (voisin hors bande) ; les
  //   arêtes internes d'une bande épaisse n'en portent pas (une seule herse à abattre). GÉNÉRAL, toute forme.
  const bandSet = new Set(cellCells.filter((c) => spec.cells![c.char].wall || spec.cells![c.char].gate).map((c) => `${c.x},${c.y},${c.z}`));
  // Apparence de CRÉNELURE de la bande = la structure du mur plein (`#`) — merlons de PÉRIMÈTRE dérivés par
  // `crestGeometry` (décoration de rendu, ne coupe pas la LdV plongeante). Toute la bande la porte (crête continue).
  const crestApp = Object.values(spec.cells ?? {}).find((r) => r.wall)?.wall?.structure;
  const cellWalls: WallSpec[] = [];
  for (const c of cellCells) {
    const rec = spec.cells![c.char];
    const build = rec.wall ?? rec.gate;
    if (build) {
      const zz = c.z + 1;
      const height = rec.wall?.height ?? CELL_WALL_HEIGHT_M;
      // MASSE : un mur plein → BLOC `mur` posé au SOL (le moteur en dérive toutes les faces, dont la PAROI
      // du tunnel qu'il borde, comme un bâtiment). Une PORTE laisse le sol z0 tel quel → passable = le TUNNEL.
      if (rec.wall) s = paintTiles(s, { x: c.x, y: c.y }, CELL_MASS, 1, c.z);
      // CHEMIN DE RONDE : une COUCHE DE SOL marchable posée par-dessus, à `height` m (dessus du bloc / toit
      // du tunnel). Sur une porte, ce sol coiffe un vide → SURPLOMB → son dessous = le plafond (règle générale).
      s = addLayer(s, zz);
      s = paintTiles(s, { x: c.x, y: c.y }, CELL_WALKWAY, 1, zz);
      s = paintHeight(s, { x: c.x, y: c.y }, height, 1, zz);
      // CRÉNELURE (décoration) : marque le chemin de ronde → merlons sur le PÉRIMÈTRE de la bande.
      if (crestApp) s = paintCrenellated(s, { x: c.x, y: c.y }, crestApp, 1, zz);
    }
    if (rec.gate) {
      const facing = rec.gate.facing ?? 'N';
      const [nx, ny] = facing === 'N' ? [c.x, c.y - 1] : facing === 'E' ? [c.x + 1, c.y] : facing === 'S' ? [c.x, c.y + 1] : [c.x - 1, c.y];
      if (!bandSet.has(`${nx},${ny},${c.z}`)) // arête de BOUCHE (borde l'extérieur), pas une arête interne
        cellWalls.push({ x: c.x, y: c.y, side: facing, ...(c.z ? { z: c.z } : {}), structure: rec.gate.structure });
    }
    if (rec.hero) {
      const pos = { x: c.x, y: c.y };
      s = pasteEntity(s, { id: '', kind: 'heroStart', pos, ...(c.z ? { z: c.z } : {}) }, pos, c.z).scene;
    }
  }

  // 3quater. stair : volées d'escalier — rampe interpolée entre deux surfaces + trémie (#780).
  s = applyStairs(s, spec, cellCells);

  // 4. walls : arêtes extraites de `walled`, PUIS `edgeWalls` (chars posés dans une grille `levels`,
  //    canonicalisés N/E), PUIS les herses de `cells`, PUIS les `walls` déclaratifs en coordonnées.
  const asciiWalls: WallSpec[] = edgeWallCells.map((c) => {
    const cfg = spec.edgeWalls![c.char];
    const e = canonEdge(c.x, c.y, cfg.side);
    return { x: e.x, y: e.y, side: e.side, ...(c.z ? { z: c.z } : {}), ...(cfg.door ? { door: true } : {}), ...(cfg.structure ? { structure: cfg.structure } : {}) };
  });
  const allWalls = [...walledWalls, ...asciiWalls, ...cellWalls, ...(spec.walls ?? [])];
  // Passe 1 : murs orthogonaux (N/E/S/O) — les diagonales lisent l'état des arêtes voisines pour leur
  // garde de coin (ci-dessous), elles doivent donc être TOUTES posées d'abord.
  for (const wall of allWalls) {
    if (wall.side === '\\' || wall.side === '/') continue;
    const z = wall.z ?? 0;
    s = setEdgeWall(s, wall.x, wall.y, wall.side, z, wall.door ? 'door' : 'wall');
    if (wall.structure || wall.window || wall.climb) {
      const c = canonEdge(wall.x, wall.y, wall.side);
      s = patchWall(s, c.x, c.y, c.side, z, { ...(wall.structure ? { structure: wall.structure } : {}), ...(wall.window ? { window: true } : {}), ...(wall.climb ? { climb: wall.climb } : {}) });
    }
  }
  // Passe 2 : diagonales — arête PUREMENT VISUELLE (scene.ts:698-700) : déplacement/vision/grimpe restent
  // orthogonaux (`edgeOf`/`wallBetween`/`vision.ts` ne résolvent QUE N/E) → `climb`/`structure`/`door`
  // ne bloqueraient/ouvriraient jamais rien : les poser mentirait silencieusement sur leur effet.
  // `window` reste décoratif pur (aucune règle mécanique ne le lit) → seul attribut propageable.
  for (const wall of allWalls) {
    if (wall.side !== '\\' && wall.side !== '/') continue;
    const z = wall.z ?? 0;
    if (wall.climb || wall.structure || wall.door) {
      throw new Error(
        `buildScene: WallSpec diagonal (${wall.x},${wall.y}) ne peut pas porter climb/structure/door — arête oblique purement visuelle (mouvement/vision/grimpe restent orthogonaux, cf. scene.ts WallSide)`,
      );
    }
    // Garde #781 : un pan diagonal BISEAUTE deux coins opposés — il n'est légal que s'il adosse au
    // moins un coin FERMÉ (ses deux arêtes orthogonales murées), sinon c'est un pan flottant qui ferait
    // croire à une séparation/un blocage inexistants (le pan reste un habillage, jamais une frontière).
    const closed = (edgeA: Edge4, edgeB: Edge4) =>
      edgeWallState(s, wall.x, wall.y, edgeA, z) === 'wall' && edgeWallState(s, wall.x, wall.y, edgeB, z) === 'wall';
    const legal = wall.side === '\\' ? closed('N', 'O') || closed('S', 'E') : closed('N', 'E') || closed('S', 'O');
    if (!legal) {
      throw new Error(
        `buildScene: pan diagonal (${wall.x},${wall.y}) sans coin orthogonal muré — orthogonalise l'enveloppe ou adosse le pan à deux murs pleins formant le coin qu'il adoucit (mouvement/vision restent orthogonaux, cf. scene.ts WallSide)`,
      );
    }
    s = toggleDiagonalWall(s, wall.x, wall.y, wall.side, z);
    if (wall.window) s = patchWall(s, wall.x, wall.y, wall.side, z, { window: true });
  }

  // 5. architecture (copie non validée — la validation tourne en fin de fonction, §9, une fois les
  //    zones connues : les masses se valident contre le plancher RÉEL, pas contre elles-mêmes).
  if (spec.architecture?.length) s = { ...s, architecture: copyArchitecture(spec.architecture) };

  // 6. entities brutes + heroStart + bind
  if (spec.entities?.length) s = { ...s, entities: [...s.entities, ...spec.entities] };
  if (spec.heroStart) {
    const hs = Array.isArray(spec.heroStart) ? { x: spec.heroStart[0], y: spec.heroStart[1] } : spec.heroStart;
    const z = (Array.isArray(spec.heroStart) ? undefined : spec.heroStart.z) ?? 0;
    s = pasteEntity(s, { id: '', kind: 'heroStart', pos: { x: hs.x, y: hs.y }, ...(z ? { z } : {}) }, { x: hs.x, y: hs.y }, z).scene;
  }
  const boundMembers: { enc: string; member: EncounterMember }[] = [];
  const mkMember = (entityId: string, m: BindMember): EncounterMember => {
    const mem: EncounterMember = { entityId };
    if (m.side) mem.side = m.side;
    if (m.ai) mem.ai = m.ai;
    if (m.mount) mem.mount = m.mount;
    return mem;
  };
  for (const { char, pos, z: markerZ } of scanned) {
    const bind = spec.bind?.[char];
    if (!bind) continue;
    if (bind === 'heroStart') {
      s = pasteEntity(s, { id: '', kind: 'heroStart', pos }, pos).scene;
    } else if ('entry' in bind && typeof (bind as { entry: string }).entry === 'string') {
      const name = (bind as { entry: string }).entry;
      s = { ...s, entryPoints: { ...s.entryPoints, [name]: { x: pos.x, y: pos.y } } };
    } else if ('emplacement' in bind && typeof (bind as { emplacement: string }).emplacement === 'string') {
      const b = bind as { emplacement: string; crew?: string; side?: FireArc; facing?: Dir8; member?: BindMember };
      // z HÉRITÉ de l'étage du marqueur (grille z1 → affût sur le chemin de ronde) ; `facing` = orientation-monde.
      const placed = placeEmplacement(s, b.emplacement, pos, markerZ, b.facing);
      if (placed) {
        s = placed.scene;
        if (b.crew) s = setPosteCrew(s, placed.id, [b.crew]);
        if (b.side) s = setPosteSide(s, placed.id, b.side);
        if (b.member) boundMembers.push({ enc: b.member.enc, member: mkMember(placed.id, b.member) });
      }
    } else if ('entity' in bind && (bind as { entity: Partial<SceneEntity> }).entity) {
      const b = bind as { entity: Partial<SceneEntity>; member?: BindMember };
      const z = b.entity.z ?? 0;
      const placed = pasteEntity(s, { ...(b.entity as SceneEntity), id: '', kind: b.entity.kind ?? 'personnage', pos, ...(z ? { z } : {}) }, pos, z);
      s = placed.scene;
      if (b.member) boundMembers.push({ enc: b.member.enc, member: mkMember(placed.id, b.member) });
    } else {
      const tmpl = bind as Partial<SceneEntity>;
      const z = tmpl.z ?? 0;
      s = pasteEntity(s, { ...(tmpl as SceneEntity), id: '', kind: tmpl.kind ?? 'personnage', pos, ...(z ? { z } : {}) }, pos, z).scene;
    }
  }

  // 7. zones
  if (spec.entryPoints) {
    const pts: Record<string, { x: number; y: number }> = { ...s.entryPoints };
    for (const [name, [x, y]] of Object.entries(spec.entryPoints)) pts[name] = { x, y };
    s = { ...s, entryPoints: pts };
  }
  for (const rz of spec.restZones ?? []) {
    const added = addRestZone(s, rz.rect);
    s = added.scene;
    if (rz.places || rz.quality) {
      s = {
        ...s,
        restZones: (s.restZones ?? []).map((z, i) =>
          i === added.idx ? { ...z, ...(rz.places ? { places: rz.places } : {}), ...(rz.quality ? { quality: rz.quality } : {}) } : z,
        ),
      };
    }
  }
  if (spec.effectZones?.length) s = { ...s, effectZones: [...(s.effectZones ?? []), ...spec.effectZones] };
  if (spec.zoneMap) {
    // Calque de ZONES DESCRIPTIVES (#782) : un char = une zone contiguë par étage, bounding-box de ses
    // cellules. Char hors légende → fail-fast (même doctrine que `parseAsciiRows`).
    const zoneCells: { char: string; x: number; y: number; z: number }[] = [];
    for (const [key, rows] of Object.entries(spec.zoneMap)) {
      const z = parseInt(key.replace('z', ''), 10);
      const lines = rowsOf(rows);
      for (let y = 0; y < lines.length; y++) {
        for (let x = 0; x < lines[y].length; x++) {
          const ch = lines[y][x];
          if (ch === ' ' || ch === '.') continue;
          if (!spec.zoneLegend?.[ch]) throw new Error(`zoneMap: char inconnu « ${ch} » (étage ${key}, ligne ${y})`);
          zoneCells.push({ char: ch, x, y, z });
        }
      }
    }
    const byCharZ = new Map<string, {
      char: string;
      z: number;
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      tiles: { x: number; y: number; z: number }[];
    }>();
    for (const c of zoneCells) {
      const k = `${c.char}|${c.z}`;
      const cur = byCharZ.get(k);
      if (!cur) byCharZ.set(k, {
        char: c.char,
        z: c.z,
        minX: c.x,
        minY: c.y,
        maxX: c.x,
        maxY: c.y,
        tiles: [{ x: c.x, y: c.y, z: c.z }],
      });
      else {
        cur.tiles.push({ x: c.x, y: c.y, z: c.z });
        cur.minX = Math.min(cur.minX, c.x);
        cur.minY = Math.min(cur.minY, c.y);
        cur.maxX = Math.max(cur.maxX, c.x);
        cur.maxY = Math.max(cur.maxY, c.y);
      }
    }
    const namedZones: SceneEffectZone[] = [...byCharZ.values()].map((b) => ({
      id: spec.zoneLegend![b.char].id ?? `zone-${b.char}-z${b.z}`,
      label: spec.zoneLegend![b.char].label,
      presentation: spec.zoneLegend![b.char].presentation,
      area: { kind: 'rect', x: b.minX, y: b.minY, w: b.maxX - b.minX + 1, h: b.maxY - b.minY + 1 },
      tiles: b.tiles,
      z: b.z,
    }));
    const zoneIds = new Set<string>();
    for (const zone of [...(s.effectZones ?? []), ...namedZones]) {
      if (zoneIds.has(zone.id)) throw new Error(`buildScene: zone id dupliqué « ${zone.id} »`);
      zoneIds.add(zone.id);
    }
    if (namedZones.length) s = { ...s, effectZones: [...(s.effectZones ?? []), ...namedZones] };
  }
  if (spec.triggers?.length) s = { ...s, triggers: [...s.triggers, ...spec.triggers] };
  if (spec.dialogues?.length) s = { ...s, dialogues: [...s.dialogues, ...spec.dialogues] };

  // 8. encounters : terse (`enemies` → entités fraîches cachées) FUSIONNÉ avec `members` (entités déjà
  //    posées) ET les membres enrôlés par bind (`boundMembers`, ids générés aux marqueurs ASCII).
  const encEntities: SceneEntity[] = [];
  const encDefs: EncounterDef[] = [];
  for (const e of spec.encounters ?? []) {
    const built = buildEncounter({
      id: e.id, enemies: e.enemies ?? [], surprise: e.surprise, onVictory: e.onVictory, hidden: e.hidden,
      maneuverability: e.maneuverability, threat: e.threat, terrain: e.terrain, victoryCondition: e.victoryCondition,
    });
    encEntities.push(...built.entities);
    const bound = boundMembers.filter((b) => b.enc === e.id).map((b) => b.member);
    encDefs.push({ ...built.encounter, members: [...(built.encounter.members ?? []), ...(e.members ?? []), ...bound] });
  }
  // Marqueurs bind vers une rencontre NON déclarée dans `encounters` → on la crée (roster = ces membres).
  const declared = new Set(encDefs.map((e) => e.id));
  const orphans = new Map<string, EncounterMember[]>();
  for (const b of boundMembers) {
    if (declared.has(b.enc)) continue;
    if (!orphans.has(b.enc)) orphans.set(b.enc, []);
    orphans.get(b.enc)!.push(b.member);
  }
  for (const [id, members] of orphans) encDefs.push({ id, members });
  s = { ...s, entities: [...s.entities, ...encEntities], encounters: encDefs };

  // Ancres de Scènes de bataille (S2) : posées telles quelles sur la Scène (repli sur les postes navals).
  if (spec.stations) s = { ...s, stations: spec.stations };

  // 8bis. masses de bâtiment DÉRIVÉES par défaut depuis le plancher réel (#829, corrige #822) — les
  // masses de `spec.architecture` deviennent des SURCHARGES ; le reste du plancher les reçoit sans
  // déclaration. Après les zones (`interiorFloorAt0` en dépend) et avant la validation, qui tourne sur
  // ce résultat combiné.
  if (spec.architecture?.length) s = { ...s, architecture: deriveArchitectureMasses(s) };

  // 9. validation : les 6 règles fail-fast d'une masse (#823) tournent ICI, une fois le plancher réel
  //    et les zones connus — une masse se valide contre le bâtiment RÉEL, jamais contre elle-même.
  if (spec.architecture?.length) validateBuildingMasses(s);
  validateFloorSupport(s, new Set((spec.knownUnsupportedFloor ?? []).map((c) => `${c.x},${c.y},${c.z}`)));

  return s;
}
