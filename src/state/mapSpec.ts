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
 *   3. relief     : hauteurs métriques (`paintHeight`) par cellule — rect / cell / ramp (interpolation).
 *   4. walls      : murs d'arête (`setEdgeWall` + `patchWall` structure) / diagonales (`toggleDiagonalWall`).
 *   5. rooms      : bâtiments composés (`addBuilding` : toit + périmètre + porte + sol).
 *   6. entities   : `spec.entities` bruts + heroStart + interprétation du `bind` aux positions scannées.
 *   7. zones      : entryPoints / restZones / effectZones / triggers / dialogues.
 *   8. encounters : `buildEncounters` (terse → entités cachées + members).
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
} from './scene';
import { emptyScene } from './scene';
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
  patchWall,
  toggleDiagonalWall,
  paintHeight,
  paintCrenellated,
  paintTiles,
  addLayer,
  putLayer,
  placeEmplacement,
  setPosteCrew,
  setPosteSide,
  pasteEntity,
  addBuilding,
  addRestZone,
  setMetresPerTile,
  setAmbientLight,
  setSceneFlags,
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
}

/** Spec de relief EN COORDONNÉES (repli bas niveau ; préférer `elevate` piloté par l'ASCII) : boîte
 *  inclusive `rect`, cellule unique `cell` (UNE case [x,y]), ou rampe interpolée `ramp`. */
export type ReliefSpec =
  | { rect: [number, number, number, number]; height: number; z?: number }
  | { cell: [number, number]; height: number; z?: number }
  | { ramp: [number, number, number, number]; from: number; to: number; z?: number };

/** Un bâtiment composé DÉCLARATIF (empreinte + preset de toit + porte/sol/structure). */
export interface RoomSpec {
  foot: [number, number, number, number];
  style: string;
  door?: { x: number; y: number; side: Edge4 };
  floor?: Terrain;
  wallStructure?: string;
  z?: number;
  /** Id d'auteur préservé sur le toit (sinon frais `roof-N`) — stabilité des réfs (ex. `taverne`). */
  id?: string;
  /** Libellé du toit (affiché au survol/cutaway), posé sur `roof.label`. */
  label?: string;
}

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
  /** Avantage initial — Manœuvrabilité (AA l.4149-4167), cf. `EncounterDef.maneuverability`. */
  maneuverability?: 'party' | 'enemies';
  /** Avantage initial — Menace (AA l.4149-4167), cf. `EncounterDef.threat`. */
  threat?: { camp: 'party' | 'enemies'; tier: ThreatTier };
  /** Avantage initial — Terrain (AA l.4149-4167), cf. `EncounterDef.terrain`. */
  terrain?: { camp: 'party' | 'enemies'; heavy?: boolean };
}

/** RECETTE par LETTRE d'une CASE COMPLÈTE (sol + AU PLUS un rôle/structure dessus) — l'authoring unifié
 *  d'une enceinte : une lettre = la case entière, self-documentée (plus d'éparpillement `elevate`+`edgeWalls`).
 *  - `wall` : ENCEINTE PLEINE. Auto-pose une ZONE REMPART sur la couche z+1 (bloc solide `height` m + chemin
 *    de ronde marchable + crénelure) → le z0 devient impassable (MASSE DE MUR) et le rendu (falaise + merlons)
 *    suit. `structure` = apparence crénelée (id `structureAppearance`). Le sol z0 = `terrain` (fondation).
 *  - `gate` : TUNNEL brèchable. Comme `wall` (chemin de ronde CONTINU au-dessus, gatehouse) MAIS le z0 reste
 *    PASSABLE et une structure-porte (`structure`, herse) est posée sur l'arête EXTÉRIEURE (`facing`) = la
 *    BOUCHE du périmètre. Intacte elle bloque le passage (`wallBetween`) ; abattue → brèche ouverte.
 *  - `hero` : départ du groupe à cette case. */
export interface CellRecipe {
  /** Sol / FONDATION de la case (défaut = base de l'étage — évite l'herbe surprise sous une enceinte). */
  terrain?: Terrain;
  wall?: { structure: string; facing?: Edge4; height?: number };
  gate?: { structure: string; facing?: Edge4 };
  hero?: boolean;
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
   *  `hero` (départ). Une lettre `cells` résout son `terrain` dans la légende ASCII, puis auto-pose sa
   *  structure/rôle (zone rempart z+1, herse, heroStart). Point d'entrée UNIFIÉ d'une muraille (remplace le
   *  couple `elevate`+`edgeWalls`) — mécanisme GÉNÉRAL, toute forme/épaisseur. */
  cells?: Record<string, CellRecipe>;
  walls?: WallSpec[];
  relief?: ReliefSpec[];
  rooms?: RoomSpec[];
  /** Table des marqueurs ASCII (char → pose). Les chars scannés sont nettoyés avant le parse terrain. */
  bind?: Record<string, BindSpec>;
  /** Entités BRUTES (SceneEntity complètes, ids préservés). */
  entities?: SceneEntity[];
  /** Départ héros : `[x,y]` ou `{x,y,z}`. */
  heroStart?: [number, number] | { x: number; y: number; z?: number };
  entryPoints?: Record<string, [number, number]>;
  restZones?: { rect: { x: number; y: number; w: number; h: number }; places?: Scene['rest']; quality?: 'normale' | 'pietre' }[];
  effectZones?: SceneEffectZone[];
  triggers?: Trigger[];
  dialogues?: Dialogue[];
  encounters?: EncounterSpec[];
  /** Ancres AUTHORÉES des Scènes de bataille sur le plan (S2, Puissance de Bataille) — passées telles
   *  quelles sur la Scène construite (`Scene.stations`), consommées par `battleScenesToStations`. */
  stations?: SceneStationAnchor[];
}

/** Découpe une chaîne ASCII en lignes, en ne retirant QUE les lignes vides de tête/queue (une chaîne
 *  `String.raw` bordée de `\n` ne perd pas ses lignes internes ; une chaîne inline reste intacte). */
function rowsOf(str: string): string[] {
  const rows = str.split('\n');
  while (rows.length && rows[0].trim() === '') rows.shift();
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  return rows;
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
      for (const seg of parsed.walls) walledWalls.push({ x: seg.x, y: seg.y, side: seg.side, ...(z ? { z } : {}), ...(seg.door ? { door: true } : {}), ...(seg.structure ? { structure: seg.structure } : {}) });
      scanChars(padded.filter((_, i) => i % 2 === 1), z, (r, x) => r[2 * x + 1] ?? ' '); // tuiles aux slots impairs
    }
  }
  if (!spec.levels && !spec.walled) {
    s = putLayer(s, 0, new Array(w * h).fill(spec.terrain ?? 'herbe') as Terrain[]);
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
  // `crestEls` (décoration de rendu, ne coupe pas la LdV plongeante). Toute la bande la porte (crête continue).
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
      s = pasteEntity(s, { id: '', kind: 'heroStart', pos, ...(c.z ? { z: c.z } : {}) }, pos).scene;
    }
  }

  // 4. walls : arêtes extraites de `walled`, PUIS `edgeWalls` (chars posés dans une grille `levels`,
  //    canonicalisés N/E), PUIS les herses de `cells`, PUIS les `walls` déclaratifs en coordonnées.
  const asciiWalls: WallSpec[] = edgeWallCells.map((c) => {
    const cfg = spec.edgeWalls![c.char];
    const e = canonEdge(c.x, c.y, cfg.side);
    return { x: e.x, y: e.y, side: e.side, ...(c.z ? { z: c.z } : {}), ...(cfg.door ? { door: true } : {}), ...(cfg.structure ? { structure: cfg.structure } : {}) };
  });
  for (const wall of [...walledWalls, ...asciiWalls, ...cellWalls, ...(spec.walls ?? [])]) {
    const z = wall.z ?? 0;
    if (wall.side === '\\' || wall.side === '/') {
      s = toggleDiagonalWall(s, wall.x, wall.y, wall.side, z);
    } else {
      s = setEdgeWall(s, wall.x, wall.y, wall.side, z, wall.door ? 'door' : 'wall');
      if (wall.structure || wall.window) {
        const c = canonEdge(wall.x, wall.y, wall.side);
        s = patchWall(s, c.x, c.y, c.side, z, { ...(wall.structure ? { structure: wall.structure } : {}), ...(wall.window ? { window: true } : {}) });
      }
    }
  }

  // 5. rooms
  for (const room of spec.rooms ?? []) {
    const [x, y, rw, rh] = room.foot;
    s = addBuilding(s, room.style, { x, y, w: rw, h: rh }, {
      id: room.id,
      door: room.door,
      floor: room.floor,
      wallStructure: room.wallStructure,
      z: room.z,
      label: room.label,
    }).scene;
  }

  // 6. entities brutes + heroStart + bind
  if (spec.entities?.length) s = { ...s, entities: [...s.entities, ...spec.entities] };
  if (spec.heroStart) {
    const hs = Array.isArray(spec.heroStart) ? { x: spec.heroStart[0], y: spec.heroStart[1] } : spec.heroStart;
    const z = (Array.isArray(spec.heroStart) ? undefined : spec.heroStart.z) ?? 0;
    s = pasteEntity(s, { id: '', kind: 'heroStart', pos: { x: hs.x, y: hs.y }, ...(z ? { z } : {}) }, { x: hs.x, y: hs.y }).scene;
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
      const placed = pasteEntity(s, { ...(b.entity as SceneEntity), id: '', kind: b.entity.kind ?? 'personnage', pos, ...(z ? { z } : {}) }, pos);
      s = placed.scene;
      if (b.member) boundMembers.push({ enc: b.member.enc, member: mkMember(placed.id, b.member) });
    } else {
      const tmpl = bind as Partial<SceneEntity>;
      const z = tmpl.z ?? 0;
      s = pasteEntity(s, { ...(tmpl as SceneEntity), id: '', kind: tmpl.kind ?? 'personnage', pos, ...(z ? { z } : {}) }, pos).scene;
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
  if (spec.triggers?.length) s = { ...s, triggers: [...s.triggers, ...spec.triggers] };
  if (spec.dialogues?.length) s = { ...s, dialogues: [...s.dialogues, ...spec.dialogues] };

  // 8. encounters : terse (`enemies` → entités fraîches cachées) FUSIONNÉ avec `members` (entités déjà
  //    posées) ET les membres enrôlés par bind (`boundMembers`, ids générés aux marqueurs ASCII).
  const encEntities: SceneEntity[] = [];
  const encDefs: EncounterDef[] = [];
  for (const e of spec.encounters ?? []) {
    const built = buildEncounter({
      id: e.id, enemies: e.enemies ?? [], surprise: e.surprise, onVictory: e.onVictory, hidden: e.hidden,
      maneuverability: e.maneuverability, threat: e.threat, terrain: e.terrain,
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

  return s;
}
