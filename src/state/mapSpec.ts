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
} from './scene';
import { emptyScene } from './scene';
import type { Flow } from './flow';
import type { FireArc } from '../engine/types';
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
}

/** Spec de relief : boîte inclusive `rect`, cellule unique `cell`, ou rampe interpolée `ramp`. */
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
  if (spec.levels) {
    for (const [key, rows] of Object.entries(spec.levels)) {
      const z = parseInt(key.replace('z', ''), 10);
      const { positions, cleaned } = scanMarkers(rowsOf(rows), bindChars, spec.markerFill);
      for (const [ch, list] of Object.entries(positions)) for (const p of list) scanned.push({ char: ch, pos: p, z });
      const base: Terrain = z === 0 ? (spec.terrain ?? 'herbe') : 'vide';
      const tiles = parseAsciiRows(cleaned, base, spec.legend).tiles;
      s = putLayer(s, z, tiles);
    }
  }
  if (spec.walled) {
    // Grille BOX-DRAWING par étage : `parseWalledAscii` extrait tuiles + murs d'arête/portes. Chaque rangée est
    // recomplétée à 2W+1 (les ASCII éditables retirent les espaces de fin) ; les murs héritent du `z` de l'étage.
    for (const [key, rows] of Object.entries(spec.walled)) {
      const z = parseInt(key.replace('z', ''), 10);
      const base: Terrain = z === 0 ? (spec.terrain ?? 'herbe') : 'vide';
      const padded = walledRowsOf(rows).map((r) => r.padEnd(2 * w + 1, ' '));
      const parsed = parseWalledAscii(padded, base, spec.legend, { structures: spec.wallStructures });
      s = putLayer(s, z, parsed.tiles);
      for (const seg of parsed.walls) walledWalls.push({ x: seg.x, y: seg.y, side: seg.side, ...(z ? { z } : {}), ...(seg.door ? { door: true } : {}), ...(seg.structure ? { structure: seg.structure } : {}) });
    }
  }
  if (!spec.levels && !spec.walled) {
    s = putLayer(s, 0, new Array(w * h).fill(spec.terrain ?? 'herbe') as Terrain[]);
  }

  // 3. relief
  for (const r of spec.relief ?? []) s = applyRelief(s, r);

  // 4. walls : ceux extraits des grilles `walled` (arêtes DANS l'ASCII) PUIS les `walls` déclaratifs.
  for (const wall of [...walledWalls, ...(spec.walls ?? [])]) {
    const z = wall.z ?? 0;
    if (wall.side === '\\' || wall.side === '/') {
      s = toggleDiagonalWall(s, wall.x, wall.y, wall.side, z);
    } else {
      s = setEdgeWall(s, wall.x, wall.y, wall.side, z, wall.door ? 'door' : 'wall');
      if (wall.structure) {
        const c = canonEdge(wall.x, wall.y, wall.side);
        s = patchWall(s, c.x, c.y, c.side, z, { structure: wall.structure });
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
    const built = buildEncounter({ id: e.id, enemies: e.enemies ?? [], surprise: e.surprise, onVictory: e.onVictory, hidden: e.hidden });
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

  return s;
}
