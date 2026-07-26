/**
 * MUTATIONS PURES de Scène (Scene → Scene) — Node-safe, ZÉRO dépendance UI/gameIso. Extraites de
 * `ui/editor/editorState.ts` pour que le compilateur headless-editor (`state/mapSpec.buildScene`,
 * exécuté via `tsx` par le générateur d'arène en Node) puisse les rejouer sans tirer le rendu.
 *
 * Chaque fonction renvoie une NOUVELLE Scène (immuable). `editorState.ts` les RÉ-EXPORTE : les câblages
 * du canvas (couplés UI/gameIso) y restent. NE JAMAIS importer `../ui/` ni `../gameIso/` ici.
 */
import { Scene, SceneEntity, Terrain, EncounterMember, layerTiles, tileAt, WallSeg, WallSide, ArchitectureBody, ArchitectureEdgeRef, ArchitecturePart, ArchitectureRect, FacadeSection, BuildingMass, RoofDefaults } from './scene';
import { sceneZoneTiles } from './zones';
import type { FireArc, AuthoredShipPoste } from '../engine/types';
import type { Dir8 } from './dir8';
import { EMPTY_FLOW } from './flow';
import { nextEntityId } from './entityId';
import { findTrappingById, findCreatureById, creatureLabel } from '../data';
import { siegeEmplacementEntity } from './siegeEmplacement';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** Entité posée à `p` sur la couche `z` (défaut 0) — prédicat UNIQUE de picking/gomme/collision
 *  d'entités. Source unique remplaçant les comparaisons dupliquées `pos.x===p.x && pos.y===p.y`
 *  qui omettaient le filtre de couche (#835 FU-3) : `hitAt`/`eraseAt`/`addEnemyMember` et la pose
 *  directe (`entity`/`emplacement`) le partagent tous. */
export function entityAt(scene: Scene, p: Pt, z = 0): SceneEntity | undefined {
  return scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y && (e.z ?? 0) === z);
}

function boundedRect(scene: Scene, rect: Rect): Rect {
  const w = Math.max(1, Math.min(rect.w, scene.dimensions.w));
  const h = Math.max(1, Math.min(rect.h, scene.dimensions.h));
  return {
    x: Math.max(0, Math.min(scene.dimensions.w - w, rect.x)),
    y: Math.max(0, Math.min(scene.dimensions.h - h, rect.y)),
    w,
    h,
  };
}

function updateArchitectureBody(scene: Scene, bodyId: string, update: (body: ArchitectureBody) => ArchitectureBody): Scene {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return scene;
  return { ...scene, architecture: scene.architecture!.map((candidate) => (candidate.id === bodyId ? update(candidate) : candidate)) };
}

export function addArchitectureBody(scene: Scene, style: string): { scene: Scene; id: string } {
  const id = nextEntityId('architecture', (scene.architecture ?? []).map((body) => body.id));
  const body: ArchitectureBody = { id, style, storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }], facades: [], masses: [] };
  return { scene: { ...scene, architecture: [...(scene.architecture ?? []), body] }, id };
}

/** Ajoute un ÉTAGE au corps `bodyId` — comble le trou #841 FU-C : `addArchitectureBody` ne posait qu'un
 *  seul étage (`z0`) « en dur », sans aucun moyen d'en ajouter un second au clic. `id` frais (jamais `z0`,
 *  réservé au premier étage). null si le corps est introuvable. */
export function addArchitectureStorey(scene: Scene, bodyId: string, z: number): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const id = nextEntityId('etage', body.storeys.map((storey) => storey.id));
  const storey = { id, z, parts: [], roomZoneIds: [] };
  return { scene: updateArchitectureBody(scene, bodyId, (candidate) => ({ ...candidate, storeys: [...candidate.storeys, storey] })), id };
}

export function addArchitecturePart(scene: Scene, bodyId: string, storeyId: string, foot: Rect): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  const storey = body?.storeys.find((candidate) => candidate.id === storeyId);
  if (!body || !storey) return null;
  const id = nextEntityId('part', storey.parts.map((part) => part.id));
  const part: ArchitecturePart = { id, foot: boundedRect(scene, foot) };
  return {
    scene: updateArchitectureBody(scene, bodyId, (candidate) => ({
      ...candidate,
      storeys: candidate.storeys.map((current) => current.id === storeyId ? { ...current, parts: [...current.parts, part] } : current),
    })),
    id,
  };
}

export function addFacadeSection(scene: Scene, bodyId: string, edge: ArchitectureEdgeRef, appearance: string): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const id = nextEntityId('facade', body.facades.map((facade) => facade.id));
  const section: FacadeSection = { id, z: edge.z ?? 0, edges: [{ ...edge }], appearance };
  return { scene: updateArchitectureBody(scene, bodyId, (candidate) => ({ ...candidate, facades: [...candidate.facades, section] })), id };
}

export function addBuildingMass(scene: Scene, bodyId: string, foot: Rect, z: number): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const id = nextEntityId('masse', body.masses.map((mass) => mass.id));
  const mass: BuildingMass = {
    id,
    z,
    footprint: [boundedRect(scene, foot)],
    levels: 1,
    profile: 'gable',
    pitchDeg: 40,
    material: 'tuile',
  };
  return { scene: updateArchitectureBody(scene, bodyId, (candidate) => ({ ...candidate, masses: [...candidate.masses, mass] })), id };
}

/** Rectangle inclusif englobant deux cases (drag de zone/bâtiment/remplissage). */
export function rectFrom(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

/** Réécrit les tuiles de la couche `z` (immuable) — base partagée des outils de terrain. */
function withLayerTiles(scene: Scene, z: number, tiles: Terrain[]): Scene {
  return { ...scene, layers: scene.layers.map((l) => (l.z === z ? { ...l, tiles } : l)) };
}

/** Peint un carré de côté `brush` centré sur p (terrain), sur la couche `z` (défaut base). */
export function paintTiles(scene: Scene, p: Pt, terrain: Terrain, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const tiles = [...layerTiles(scene, z)];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx,
        y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
    }
  return withLayerTiles(scene, z, tiles);
}

/** Remplit un rectangle de terrain (sous-mode Rectangle), sur la couche `z` (défaut base). */
export function fillTerrainRect(scene: Scene, rect: Rect, terrain: Terrain, z = 0): Scene {
  const { w, h } = scene.dimensions;
  const tiles = [...layerTiles(scene, z)];
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
  return withLayerTiles(scene, z, tiles);
}

/** Ajoute une couche à la cote `z` (grille « vide » = transparente, à construire), triée par z. No-op si
 *  une couche `z` existe déjà. Source unique de l'ajout de couche (éditeur multi-niveaux). */
export function addLayer(scene: Scene, z: number): Scene {
  if (scene.layers.some((l) => l.z === z)) return scene;
  const tiles = new Array(scene.dimensions.w * scene.dimensions.h).fill('vide') as Terrain[];
  return { ...scene, layers: [...scene.layers, { z, tiles }].sort((a, b) => a.z - b.z) };
}

/** Retire la couche `z`. La base (z=0) et la dernière couche sont protégées (jamais de scène sans couche). */
export function removeLayer(scene: Scene, z: number): Scene {
  if (z === 0 || scene.layers.length <= 1) return scene;
  return { ...scene, layers: scene.layers.filter((l) => l.z !== z) };
}

// ── Outil MURS (arêtes + portes + diagonales). Une cloison est stockée sous forme CANONIQUE N/E : le S
//    d'une case = le N de la case du dessous, le O = le E de la case de gauche → chaque arête n'existe
//    qu'une fois, quel que soit le côté cliqué. ──
export type Edge4 = 'N' | 'E' | 'S' | 'O';

/** Arête (case, side N/E/S/O) → forme CANONIQUE (case, N|E). */
export function canonEdge(x: number, y: number, side: Edge4): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}

/** État d'une arête : 'none' | 'wall' (pleine) | 'door' (franchissable), sur l'étage `z`. */
export function edgeWallState(scene: Scene, x: number, y: number, side: Edge4, z = 0): 'none' | 'wall' | 'door' {
  const e = canonEdge(x, y, side);
  const w = (scene.walls ?? []).find((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z);
  return !w ? 'none' : w.door ? 'door' : 'wall';
}

/** Pose / change / retire l'arête à l'état `want`. Source unique de l'écriture d'une cloison cardinale.
 *  `structure` (id de `structures.json`) pose le MATÉRIAU en même temps que l'arête — l'outil de dessin
 *  porte son matériau, l'auteur n'a plus à repasser par l'inspecteur segment par segment (#830). */
export function setEdgeWall(scene: Scene, x: number, y: number, side: Edge4, z: number, want: 'none' | 'wall' | 'door', structure?: string): Scene {
  const e = canonEdge(x, y, side);
  const others = (scene.walls ?? []).filter((w) => !(w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z));
  if (want === 'none') return { ...scene, walls: others.length ? others : undefined };
  const seg: WallSeg = { x: e.x, y: e.y, side: e.side, ...(z ? { z } : {}), ...(want === 'door' ? { door: true } : {}), ...(structure ? { structure } : {}) };
  return { ...scene, walls: [...others, seg] };
}

/** Clic de l'outil : l'arête prend l'état `want`, ou disparaît si elle l'avait déjà (toggle). */
export function toggleEdgeWall(scene: Scene, x: number, y: number, side: Edge4, z: number, want: 'wall' | 'door', structure?: string): Scene {
  return setEdgeWall(scene, x, y, side, z, edgeWallState(scene, x, y, side, z) === want ? 'none' : want, structure);
}

/** Diagonale `\\`/`/` en travers de la case (x,y) — une seule par case : poser l'autre la REMPLACE,
 *  re-cliquer la même l'enlève. */
export function toggleDiagonalWall(scene: Scene, x: number, y: number, diag: '\\' | '/', z: number): Scene {
  const isDiagHere = (w: WallSeg) => w.x === x && w.y === y && (w.z ?? 0) === z && (w.side === '\\' || w.side === '/');
  const others = (scene.walls ?? []).filter((w) => !isDiagHere(w));
  const had = (scene.walls ?? []).find((w) => w.x === x && w.y === y && (w.z ?? 0) === z && w.side === diag);
  if (had) return { ...scene, walls: others.length ? others : undefined };
  return { ...scene, walls: [...others, { x, y, side: diag, ...(z ? { z } : {}) }] };
}

/** Forme CANONIQUE compacte d'un segment d'arête : on n'écrit que les champs significatifs (pas de z:0,
 *  pas de door:false, closed sans porte, structure vide) — même convention que `setEdgeWall`. */
function normWall(w: WallSeg): WallSeg {
  const out: WallSeg = { x: w.x, y: w.y, side: w.side };
  if (w.z) out.z = w.z;
  if (w.door) out.door = true;
  if (w.door && w.closed) out.closed = true;
  if (w.structure) out.structure = w.structure;
  if (w.window) out.window = true; // fenêtre décorative (champ significatif : préservé au patch)
  if (w.climb) out.climb = w.climb;
  return out;
}

/** Patche le segment-mur canonique (x,y,side,z) : applique `patch` puis re-normalise (drop des champs
 *  vides). No-op (réf préservée par `map`) si aucun segment à cette arête. PUR — calqué sur `setEdgeWall`. */
export function patchWall(scene: Scene, x: number, y: number, side: WallSide, z: number, patch: Partial<WallSeg>): Scene {
  return {
    ...scene,
    walls: (scene.walls ?? []).map((w) =>
      w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z ? normWall({ ...w, ...patch }) : w,
    ),
  };
}

/** Outil HAUTEUR : peint la hauteur métrique de la surface (`metres` : +1 estrade, +4 toit, −2 fosse,
 *  0 plat) sur un carré de côté `brush` centré sur p, sur la couche `z`. Crée le tableau `height`
 *  (rempli de 0) au besoin. Hauteur PORTEUSE (marchabilité/combat/chute, cf. `relief.ts`). */
export function paintHeight(scene: Scene, p: Pt, metres: number, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  const height = [...(layer.height ?? new Array(w * h).fill(0))];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) height[y * w + x] = metres;
    }
  return { ...scene, layers: scene.layers.map((l) => (l.z === layer.z ? { ...l, height } : l)) };
}

/** Marque un carré de côté `brush` centré sur p comme CRÉNELÉ (décoration de rendu ; id de structure
 *  crénelée = `structure`), sur la couche `z`. Miroir de `paintHeight` sur le tableau parallèle
 *  `crenellated`. `structure = null` efface. Marqueur de RENDU pur (le crest builder en dérive les merlons
 *  de périmètre) — n'affecte NI passabilité NI LdV ; orthogonal à la hauteur (`paintHeight`). */
export function paintCrenellated(scene: Scene, p: Pt, structure: string | null, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  const crenellated = [...(layer.crenellated ?? new Array(w * h).fill(null))] as (string | null)[];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) crenellated[y * w + x] = structure;
    }
  return { ...scene, layers: scene.layers.map((l) => (l.z === layer.z ? { ...l, crenellated } : l)) };
}

/** Pose un EMPLACEMENT DE SIÈGE à p via le builder PARTAGÉ `siegeEmplacementEntity` (même source que les
 *  scénarios) : une SceneEntity-personnage portant `ref` (source de l'engin → la branche siège de
 *  `spawnEnemy` construit l'affût inerte) et un poste d'artillerie (`postes:[{ trappingId, crewIds:[] }]`).
 *  AUCUN `appearance.species` : le rig d'engin est DÉRIVÉ de la `ref` au rendu (éditeur ↔ explo ↔ combat).
 *  Au combat, `applyShipPostes` sert la pièce au chef (`crewIds[0]`). Posable ⇔ l'engin a un art d'affût
 *  (`siegeRig`) ; sinon → null (pas d'entité fantôme). */
export function placeEmplacement(scene: Scene, trappingId: string, p: Pt, z = 0, facing?: Dir8): { scene: Scene; id: string } | null {
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent = siegeEmplacementEntity(id, trappingId, p, { ...(z ? { z } : {}), ...(facing ? { facing } : {}) });
  if (!ent) return null; // posable ⇔ a un art d'affût (`siegeRig`)
  return { scene: { ...scene, entities: [...scene.entities, ent] }, id };
}

/** Patche le poste UNIQUE (postes[0]) de l'emplacement `entityId` (no-op si l'entité n'en porte pas). */
function patchPoste0(scene: Scene, entityId: string, fn: (p: AuthoredShipPoste) => AuthoredShipPoste): Scene {
  return {
    ...scene,
    entities: scene.entities.map((e) => (e.id === entityId && e.postes?.length ? { ...e, postes: e.postes.map((p, i) => (i === 0 ? fn(p) : p)) } : e)),
  };
}

/** Affecte l'équipage du poste (ids d'entités, ORDRE = chef de pièce en tête → `crewIds[0]`). */
export function setPosteCrew(scene: Scene, entityId: string, crewIds: string[]): Scene {
  return patchPoste0(scene, entityId, (p) => ({ ...p, crewIds }));
}

/** Pose / retire l'arc de tir du créneau : `side` absent = tir OMNI (pivot libre) ; présent = arc relatif
 *  à l'orientation-monde du chef de pièce. */
export function setPosteSide(scene: Scene, entityId: string, side: FireArc | undefined): Scene {
  return patchPoste0(scene, entityId, (p) => {
    const next = { ...p };
    if (side) next.side = side;
    else delete next.side;
    return next;
  });
}

/** Change l'engin du poste : nouvelle réf catalogue (`trappingId`) + libellé, ET restampe la `ref` sur
 *  l'entité — le rig d'affût étant DÉRIVÉ de la `ref`, le rendu suit l'engin servi sans `appearance.species`.
 *  La base est HYDRATÉE au spawn (#222 — plus d'`ItemInstance` matérialisée ici). Équipage conservé. No-op si
 *  l'engin est inconnu ou sans art d'affût (`siegeRig`). */
export function setPosteEngine(scene: Scene, entityId: string, trappingId: string): Scene {
  const t = findTrappingById(trappingId);
  if (!t?.siegeRig) return scene;
  return {
    ...scene,
    entities: scene.entities.map((e) =>
      e.id === entityId && e.postes?.length
        ? { ...e, label: t.label, ref: trappingId, postes: e.postes.map((p, i) => (i === 0 ? { ...p, trappingId, item: undefined } : p)) }
        : e),
  };
}

/** Colle une copie de `data` (id frais) à la case p, sur la couche `z` (défaut 0 — jamais le z SOURCE
 *  de l'entité copiée, cf. #835 FU-3 : coller reprend la couche ACTIVE de l'éditeur). */
export function pasteEntity(scene: Scene, data: SceneEntity, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId(data.kind, scene.entities.map((e) => e.id));
  const ent: SceneEntity = { ...(JSON.parse(JSON.stringify(data)) as SceneEntity), id, pos: { ...p } };
  if (z) ent.z = z; else delete ent.z;
  return { scene: { ...scene, entities: [...scene.entities, ent] }, id };
}

/** Pose un point d'entrée nommé `entree-N` (premier libre) à p, sur l'étage `z` (défaut 0) — comble le
 *  manque du POC : les transitions et la carte du monde les référencent mais rien ne permettait d'en
 *  créer. Étage éditable ensuite dans l'inspecteur (#835 FU-5). */
export function placeEntry(scene: Scene, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId('entree', Object.keys(scene.entryPoints ?? {}));
  return { scene: { ...scene, entryPoints: { ...scene.entryPoints, [id]: { ...p, ...(z ? { z } : {}) } } }, id };
}

/** Renomme un point d'entrée (clé unique, non vide). Renvoie la scène inchangée si conflit. */
export function renameEntry(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  if (!next || next === from || scene.entryPoints?.[next] || !scene.entryPoints?.[from]) return scene;
  const entries: Record<string, Pt> = {};
  for (const [k, v] of Object.entries(scene.entryPoints)) entries[k === from ? next : k] = v;
  return { ...scene, entryPoints: entries };
}

/** Crée un trigger sur `rect`, à l'étage `z` (id frais). */
export function addTrigger(scene: Scene, rect: Rect, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId('trig', scene.triggers.map((t) => t.id));
  return { scene: { ...scene, triggers: [...scene.triggers, { id, rect: { ...rect, ...(z ? { z } : {}) }, once: true, flow: EMPTY_FLOW }] }, id };
}

/** Crée une zone de repos sur `rect`, à l'étage `z` (camp par défaut — lieux/qualité éditables dans l'inspecteur). */
export function addRestZone(scene: Scene, rect: Rect, z = 0): { scene: Scene; idx: number } {
  const zones = [...(scene.restZones ?? []), { rect: { ...rect, ...(z ? { z } : {}) }, places: { camp: true } }];
  return { scene: { ...scene, restZones: zones }, idx: zones.length - 1 };
}

/** Crée une ZONE D'EFFET (piège) sur `rect`, à l'étage `z` : Dégâts à la traversée par défaut —
 *  label/effet/déclencheur éditables dans l'inspecteur. id frais pour le rendu/sélection. */
export function addEffectZone(scene: Scene, rect: Rect, z = 0): { scene: Scene; idx: number } {
  const id = nextEntityId('zone', (scene.effectZones ?? []).map((ez) => ez.id));
  const zones = [
    ...(scene.effectZones ?? []),
    { id, label: 'Piège', area: { kind: 'rect' as const, ...rect }, onCross: [{ op: 'wounds' as const, amount: 5, ignoreTB: false, ignoreAP: true }], ...(z ? { z } : {}) },
  ];
  return { scene: { ...scene, effectZones: zones }, idx: zones.length - 1 };
}

/** Renomme l'id d'une ZONE D'EFFET (référencée par `FacadeSection.roomZoneIds` — lien Façade↔Pièce) et
 *  REPROPAGE la référence, pour qu'un rebaptême n'aille pas casser un lien déjà posé dans l'éditeur.
 *  Renvoie la scène inchangée si `from` absent, `to` vide/identique, ou collision d'id. */
export function renameEffectZone(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  const zones = scene.effectZones ?? [];
  if (!next || next === from || zones.some((z) => z.id === next) || !zones.some((z) => z.id === from)) return scene;
  return {
    ...scene,
    effectZones: zones.map((z) => (z.id === from ? { ...z, id: next } : z)),
    architecture: scene.architecture?.map((body) => ({
      ...body,
      facades: body.facades.map((f) => (f.roomZoneIds?.includes(from)
        ? { ...f, roomZoneIds: f.roomZoneIds.map((id) => (id === from ? next : id)) }
        : f)),
    })),
  };
}


/** Rattache une entité existante à la rencontre `encId` (créée si absente). No-op si déjà membre. */
export function addMember(scene: Scene, encId: string, entityId: string): { scene: Scene; encId: string } {
  const encs = scene.encounters.map((e) => ({ ...e, members: [...(e.members ?? [])] }));
  let target = encs.find((e) => e.id === encId);
  if (!target) {
    target = { id: encId || nextEntityId('enc', scene.encounters.map((e) => e.id)), members: [] };
    encs.push(target);
  }
  if (!target.members!.some((m) => m.entityId === entityId)) target.members!.push({ entityId });
  return { scene: { ...scene, encounters: encs }, encId: target.id };
}

/** Retire un membre (par entité) d'une rencontre — et toute monture qui le chevauchait. */
export function removeMember(scene: Scene, encId: string, entityId: string): Scene {
  return {
    ...scene,
    encounters: scene.encounters.map((e) => {
      if (e.id !== encId) return e;
      return {
        ...e,
        members: (e.members ?? [])
          .filter((m) => m.entityId !== entityId)
          .map((m) => (m.ridesEntityId === entityId ? { ...m, ridesEntityId: undefined } : m)),
      };
    }),
  };
}

/** Patche le contexte de rencontre d'un membre (camp/monture/chevauche). */
export function patchMember(scene: Scene, encId: string, entityId: string, patch: Partial<EncounterMember>): Scene {
  return {
    ...scene,
    encounters: scene.encounters.map((e) =>
      e.id === encId
        ? { ...e, members: (e.members ?? []).map((m) => (m.entityId === entityId ? { ...m, ...patch } : m)) }
        : e,
    ),
  };
}

/** Outil « combat » : POSE une entité-personnage de combat (cachée par défaut) à p, sur la couche `z`,
 *  ET l'enrôle dans la rencontre `encId` (créée si absente). `ref` = id STABLE d'une créature du
 *  bestiaire : la primitive VALIDE (fail-fast si l'id ne résout pas), elle ne normalise pas — un
 *  libellé passé à la place d'un id est une erreur d'appelant, jamais un cas à rattraper. Le libellé
 *  affiché se DÉRIVE de la créature résolue (`creatureLabel`), il ne recopie pas la clé.
 *  Une entité DÉJÀ posée à (p,z) est réutilisée (enrôlée) plutôt que dupliquée — même garde que les
 *  outils `entity`/`emplacement` (`entityAt`, #835 FU-3). */
export function addEnemyMember(scene: Scene, encId: string, ref: string, p: Pt, z = 0): { scene: Scene; encId: string; entityId: string } {
  const existing = entityAt(scene, p, z);
  if (existing) {
    const { scene: out, encId: usedEnc } = addMember(scene, encId, existing.id);
    return { scene: out, encId: usedEnc, entityId: existing.id };
  }
  if (!findCreatureById(ref))
    throw new Error(`addEnemyMember : « ${ref} » n'est pas un id de créature du bestiaire — une entité de scène se réfère par id STABLE (le libellé est de l'affichage)`);
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent: SceneEntity = {
    id,
    kind: 'personnage',
    pos: { ...p },
    ...(z ? { z } : {}),
    combat: { hiddenUntilCombat: true },
    ref,
    label: creatureLabel(ref),
  };
  const withEnt = { ...scene, entities: [...scene.entities, ent] };
  const { scene: out, encId: usedEnc } = addMember(withEnt, encId, id);
  return { scene: out, encId: usedEnc, entityId: id };
}

/** Gomme : retire l'entité posée sur p à l'étage `z` (les autres couches se suppriment via leur sélection). */
export function eraseAt(scene: Scene, p: Pt, z = 0): Scene {
  const ent = entityAt(scene, p, z);
  return ent ? { ...scene, entities: scene.entities.filter((e) => e !== ent) } : scene;
}

// ── Scalaires de scène (headless-editor) : champs sans widget SceneProps, posés par `buildScene`. Chacun
//    comble un gap identifié (échelle mer, lumière ambiante, flags initiaux). `undefined` retire le champ. ──

/** Échelle métrique d'une case (m/case). `undefined` = défaut (2 m). Pilote l'échelle MER (naval, MDG). */
export function setMetresPerTile(scene: Scene, m: number | undefined): Scene {
  const next = { ...scene };
  if (m === undefined) delete next.metresPerTile;
  else next.metresPerTile = m;
  return next;
}

/** Niveau de lumière ambiante par défaut (id). `undefined` = auto (horloge/ambiance). */
export function setAmbientLight(scene: Scene, id: string | undefined): Scene {
  const next = { ...scene };
  if (id === undefined) delete next.ambientLight;
  else next.ambientLight = id;
  return next;
}

/** Classification écologique (LDB 48 l.690, bonus de Domaine Vie/Ghyran). `undefined` = non spécifié
 *  (aucun bonus) — c'est une valeur distincte de rural/urbain/sauvage, pas un défaut caché. */
export function setEnvironment(scene: Scene, env: Scene['environment']): Scene {
  const next = { ...scene };
  if (env === undefined) delete next.environment;
  else next.environment = env;
  return next;
}

/** Fusionne des flags initiaux dans `scene.flags` (état de départ : porte ouverte, jalon posé…). */
export function setSceneFlags(scene: Scene, patch: Record<string, boolean>): Scene {
  return { ...scene, flags: { ...scene.flags, ...patch } };
}

/** Patche les champs de HAUT NIVEAU d'une entité (facing/label/crewIds/upgrades/light/statblock/foot…) —
 *  fusion superficielle. No-op si l'entité est absente. Source unique du câblage de données d'entité,
 *  partagée par `buildScene` (coque-navire : équipage/upgrades exposés, MDG 14) et l'inspecteur. */
export function patchEntity(scene: Scene, id: string, patch: Partial<SceneEntity>): Scene {
  return { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

/** Patche le sous-objet `combat` d'une entité SANS écraser l'existant (fusionne skills/spells/optionals/
 *  hiddenUntilCombat). Qualifie p.ex. un servant-ref au bon Groupe de Projectiles (AA 10 p.122). No-op si absente. */
export function patchEntityCombat(scene: Scene, id: string, patch: Partial<NonNullable<SceneEntity['combat']>>): Scene {
  return { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, combat: { ...e.combat, ...patch } } : e)) };
}

/** Pose (ou REMPLACE) la couche `z` avec des tuiles complètes + hauteurs optionnelles, triée par z. Brique
 *  d'import d'une grille ASCII entière (`buildScene`) — là où `paintTiles`/`paintHeight` posent case par case. */
export function putLayer(scene: Scene, z: number, tiles: Terrain[], height?: number[]): Scene {
  const prev = scene.layers.find((l) => l.z === z);
  const layer = { z, tiles, ...(height ? { height } : {}), ...(prev?.crenellated ? { crenellated: prev.crenellated } : {}) };
  const others = scene.layers.filter((l) => l.z !== z);
  return { ...scene, layers: [...others, layer].sort((a, b) => a.z - b.z) };
}

// ── Fenêtres du périmètre d'un bâtiment (décoratives) ──────────────────────────────────────────────
/** Pas de pose : une fenêtre toutes les WIN_STEP cases le long d'un pan. */
const WIN_STEP = 3;
/** Phase dans le pas (≈ centre) : fenêtre à l'indice intérieur `i` quand `i % WIN_STEP === WIN_PHASE`. */
const WIN_PHASE = 1;
const range = (start: number, len: number): number[] => Array.from({ length: len }, (_, i) => start + i);

/** BÂTIMENT COMPOSÉ = un `ArchitectureBody` (couverture cutaway, #822) + périmètre
 *  de murs d'ARÊTE + une arête-porte franchissable + sol repeint. Source UNIQUE de la composition (partagée
 *  éditeur ⇄ `buildScene`), généralisant l'ancien `buildingToComposite` de l'arène : la structure réelle
 *  est faite de `WallSeg`, la masse n'est que du rendu (profil/pente par défaut du corps, cf.
 *  `DEFAULT_ROOF_DEFAULTS` — ajustables ensuite dans l'inspecteur Architecture).
 *  `wallStructure` (ex. `mur-en-bois`) rend les murs pleins DESTRUCTIBLES ; la porte n'en porte pas.
 *  `id`/`label` (déclaratif) : id d'auteur préservé sur le corps (sinon frais) + libellé de survol.
 *  FENÊTRES (`windows`, défaut activé) : chaque pan reçoit des fenêtres DÉCORATIVES régulièrement espacées
 *  (toutes ~WIN_STEP cases), en SAUTANT les coins et la porte — un mur fenêtré bloque comme un mur plein. */
export function addBuilding(
  scene: Scene,
  style: string,
  foot: Rect,
  opts: { id?: string; door?: { x: number; y: number; side: Edge4 }; floor?: Terrain; wallStructure?: string; z?: number; label?: string; windows?: boolean } = {},
): { scene: Scene; id: string } {
  const { id: wantId, door, floor, wallStructure, z = 0, label, windows = true } = opts;
  const id = wantId ?? nextEntityId('architecture', (scene.architecture ?? []).map((body) => body.id));
  const body: ArchitectureBody = {
    id,
    ...(label ? { label } : {}),
    style,
    storeys: [{ id: 'z0', z, parts: [], roomZoneIds: [] }],
    facades: [],
    masses: [{ id: 'mass-0', z, footprint: [{ ...foot }], levels: 1, profile: 'hip', pitchDeg: 28, material: 'ardoise' }],
  };
  let s: Scene = { ...scene, architecture: [...(scene.architecture ?? []), body] };
  const doorCanon = door ? canonEdge(door.x, door.y, door.side) : null;
  // Les 4 PANS du périmètre, chacun DANS L'ORDRE de ses cases : les indices 0 et M−1 sont des COINS (deux
  // murs s'y croisent → jamais fenêtrés), les intérieurs portent une fenêtre un cran sur WIN_STEP.
  const sides: { x: number; y: number; side: Edge4 }[][] = [
    range(foot.x, foot.w).map((cx) => ({ x: cx, y: foot.y, side: 'N' as Edge4 })), // pan haut
    range(foot.x, foot.w).map((cx) => ({ x: cx, y: foot.y + foot.h - 1, side: 'S' as Edge4 })), // pan bas
    range(foot.y, foot.h).map((cy) => ({ x: foot.x, y: cy, side: 'O' as Edge4 })), // pan gauche
    range(foot.y, foot.h).map((cy) => ({ x: foot.x + foot.w - 1, y: cy, side: 'E' as Edge4 })), // pan droit
  ];
  for (const run of sides) {
    const M = run.length;
    run.forEach((e, i) => {
      const c = canonEdge(e.x, e.y, e.side);
      const isDoor = !!doorCanon && c.x === doorCanon.x && c.y === doorCanon.y && c.side === doorCanon.side;
      s = setEdgeWall(s, e.x, e.y, e.side, z, isDoor ? 'door' : 'wall');
      if (isDoor) return; // la porte ne porte ni structure ni fenêtre
      const isWindow = windows && i > 0 && i < M - 1 && i % WIN_STEP === WIN_PHASE;
      const patch: Partial<WallSeg> = {};
      if (wallStructure) patch.structure = wallStructure;
      if (isWindow) patch.window = true;
      if (patch.structure || patch.window) s = patchWall(s, c.x, c.y, c.side, z, patch);
    });
  }
  if (floor) s = fillTerrainRect(s, foot, floor, z);
  return { scene: s, id };
}

// ── Toiture DÉRIVÉE du plan (#829/#841) ──────────────────────────────────────────────────────────

/** Emprise RÉELLE d'un étage — RÈGLE PARTAGÉE par `validateBuildingMasses` (`state/mapSpec.ts`) et
 *  `deriveArchitectureMasses` : `z=0` se lit sur les zones INTÉRIEURES (le rez peut avoir une cour à
 *  ciel ouvert, jamais toitée) ; `z>0` sur le PLANCHER RÉEL (terrain non-vide, PAS `isWalkable` — un
 *  décor multi-cases ne change pas la structure) : un étage est BÂTI par construction, y compris
 *  au-dessus d'une cour (galerie en anneau), mesuré sur La Diligence (#825ter). */
export function realFloorAt(scene: Scene): (z: number) => ReadonlySet<string> {
  const layerZs = new Set(scene.layers.map((l) => l.z));
  const { w, h } = scene.dimensions;
  const interiorFloorAt0 = new Set<string>();
  for (const zone of scene.effectZones ?? []) {
    if (zone.presentation !== 'interior' || (zone.z ?? 0) !== 0) continue;
    for (const tile of sceneZoneTiles(zone)) interiorFloorAt0.add(`${tile.x},${tile.y}`);
  }
  const cache = new Map<number, Set<string>>();
  return (z: number): ReadonlySet<string> => {
    if (z === 0) return interiorFloorAt0;
    const cached = cache.get(z);
    if (cached) return cached;
    const out = new Set<string>();
    if (layerZs.has(z))
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tileAt(scene, x, y, z) !== 'vide') out.add(`${x},${y}`);
    cache.set(z, out);
    return out;
  };
}

/** Cases explicitement retirées de la dérivation/couverture (#829, `ArchitectureBody.roofExclusions`,
 *  cour à ciel ouvert à ÉTAGE) — indexées par étage, partagées par `validateBuildingMasses` (la
 *  couverture n'y est plus exigée) et `deriveArchitectureMasses` (le plancher réel y est ignoré). */
export function roofExclusionsByZ(body: ArchitectureBody): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const ex of body.roofExclusions ?? []) {
    const set = out.get(ex.z) ?? (out.set(ex.z, new Set()).get(ex.z)!);
    for (let y = ex.rect.y; y < ex.rect.y + ex.rect.h; y++)
      for (let x = ex.rect.x; x < ex.rect.x + ex.rect.w; x++) set.add(`${x},${y}`);
  }
  return out;
}

/** Intention de toiture appliquée à une masse dérivée quand le corps n'en déclare aucune (#829).
 *  Exportée : l'inspecteur affiche la valeur RÉELLEMENT appliquée plutôt qu'un champ vide, sinon
 *  l'auteur règle à l'aveugle. */
export const DEFAULT_ROOF_DEFAULTS: RoofDefaults = { profile: 'hip', pitchDeg: 28, material: 'ardoise' };

function vkey(x: number, y: number): string { return `${x},${y}`; }

/** Cellules d'une emprise de masse. */
function footprintCells(footprint: readonly ArchitectureRect[]): Set<string> {
  const out = new Set<string>();
  for (const rect of footprint)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) out.add(vkey(x, y));
  return out;
}

/** Composantes 4-connexes de `cells`. */
function componentsOf4(cells: ReadonlySet<string>): Set<string>[] {
  const remaining = new Set(cells);
  const out: Set<string>[] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as string;
    remaining.delete(start);
    const component = new Set<string>([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i].split(',').map(Number);
      for (const next of [vkey(x - 1, y), vkey(x + 1, y), vkey(x, y - 1), vkey(x, y + 1)]) {
        if (!remaining.delete(next)) continue;
        component.add(next);
        queue.push(next);
      }
    }
    out.push(component);
  }
  return out;
}

/** Encode `cells` en rectangles par BANDE de ligne (une case = une ligne d'1 case de haut, des x
 *  contigus fusionnés) — même granularité que les emprises authorées à la main (#823) : compact,
 *  aucune reconstruction de rectangles pleins nécessaire, l'ensemble EXACT se reconstitue quelle que
 *  soit la découpe des rects qui le composent. */
function rowRunsOf(cells: ReadonlySet<string>): ArchitectureRect[] {
  const byRow = new Map<number, number[]>();
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    (byRow.get(y) ?? byRow.set(y, []).get(y)!).push(x);
  }
  const out: ArchitectureRect[] = [];
  for (const [y, xs] of byRow) {
    xs.sort((a, b) => a - b);
    let runStart = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i];
      if (x === prev + 1) { prev = x; continue; }
      out.push({ x: runStart, y, w: prev - runStart + 1, h: 1 });
      if (i < xs.length) { runStart = x; prev = x; }
    }
  }
  return out;
}

/** DÉRIVE les masses manquantes de CHAQUE corps depuis le plancher réel (#829, corrige #822 : éditer
 *  un mur ne devait jamais exiger de re-déclarer les toitures). Les masses AUTHORÉES (sans
 *  `BuildingMass.derived`) restent des SURCHARGES — leurs cellules sont retirées du pool à dériver sur
 *  toute la plage `z-levels+1..z` qu'elles couvrent ; `roofExclusions` retire des cellules SANS les
 *  couvrir (cour à ciel ouvert). Les masses PORTANT `derived` sont jetées puis recalculées : la
 *  fonction est IDEMPOTENTE et rejouable sur une scène déjà compilée — c'est ce qui permet à
 *  l'éditeur de faire suivre la toiture quand l'intention change (#841), sans repasser par `buildScene`.
 *  Note : plusieurs corps peuvent coexister sur la MÊME scène (l'éditeur en crée un vide au passage,
 *  mesuré #829 : `architecture-0`) — `claimed` est un pool PARTAGÉ, rempli par les surcharges de TOUS
 *  les corps d'abord, puis par chaque dérivation dans l'ORDRE du tableau : un corps ne dérive JAMAIS
 *  une case déjà prise par un autre (surcharge ou dérivation précédente), sinon deux corps se
 *  disputeraient le même plancher et doubleraient le toit. Le reste du plancher réel d'un corps se
 *  regroupe par colonne `(topZ, levels)` — le sommet naturel de la colonne (première case non prise en
 *  descendant depuis le haut de la scène) et le nombre de niveaux qu'elle porte en dessous (plancher
 *  contigu, mêmes retraits) — puis chaque groupe se décompose en composantes 4-connexes : UNE masse par
 *  composante (#825, jamais une masse unique sur TOUT le bâti — mais une aile/anneau cohérent reste UNE
 *  masse, comme authoré à la main avant #829 : `hip` gère nativement croupes/noues sur du non-convexe,
 *  la fragmenter en rectangles ne ferait qu'empiler des arêtes). Profil/pente/matériau =
 *  `body.roofDefaults` ; faîtage TOUJOURS explicite pour ne jamais tomber sur le fail-fast « emprise
 *  carrée ». */
export function deriveArchitectureMasses(scene: Scene): ArchitectureBody[] {
  const floorAt = realFloorAt(scene);
  const layerZs = [...new Set(scene.layers.map((l) => l.z))].sort((a, b) => b - a);
  const { w, h } = scene.dimensions;
  const bodies = scene.architecture ?? [];

  const claimed = new Set<string>(); // `${x},${y},${z}` déjà pris (surcharge/exclusion de N'IMPORTE quel corps)
  for (const body of bodies) {
    for (const mass of body.masses) {
      if (mass.derived) continue;
      const cells = footprintCells(mass.footprint);
      for (let z = mass.z - mass.levels + 1; z <= mass.z; z++)
        for (const key of cells) claimed.add(`${key},${z}`);
    }
    for (const [z, cells] of roofExclusionsByZ(body))
      for (const key of cells) claimed.add(`${key},${z}`);
  }

  return bodies.map((body) => {
    const overrides = body.masses.filter((mass) => !mass.derived);
    const defaults = body.roofDefaults ?? DEFAULT_ROOF_DEFAULTS;

    const groups = new Map<string, Set<string>>(); // "topZ:levels" → cellules "x,y"
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let topZ: number | null = null;
        for (const z of layerZs) {
          if (claimed.has(`${x},${y},${z}`)) continue;
          if (floorAt(z).has(vkey(x, y))) { topZ = z; break; }
        }
        if (topZ === null) continue;
        let levels = 0;
        for (let z = topZ; z >= 0; z--) {
          if (claimed.has(`${x},${y},${z}`)) break;
          if (!floorAt(z).has(vkey(x, y))) break;
          levels++;
        }
        if (!levels) continue;
        const key = `${topZ}:${levels}`;
        const set = groups.get(key) ?? (groups.set(key, new Set()).get(key)!);
        set.add(vkey(x, y));
      }

    const derived: BuildingMass[] = [];
    for (const [key, cells] of groups) {
      const [topZStr, levelsStr] = key.split(':');
      const topZ = Number(topZStr);
      const levels = Number(levelsStr);
      let componentIndex = 0;
      for (const component of componentsOf4(cells)) {
        const xs = [...component].map((k) => Number(k.split(',')[0]));
        const ys = [...component].map((k) => Number(k.split(',')[1]));
        const bw = Math.max(...xs) - Math.min(...xs) + 1;
        const bh = Math.max(...ys) - Math.min(...ys) + 1;
        derived.push({
          id: `${body.id}-auto-z${topZ}-l${levels}-${componentIndex++}`,
          z: topZ,
          footprint: rowRunsOf(component),
          levels,
          profile: defaults.profile,
          pitchDeg: defaults.pitchDeg,
          material: defaults.material,
          ridge: bw >= bh ? 'x' : 'y',
          // `shed` : le côté d'égout bas vient de l'auteur (`RoofDefaults.eaveSide`) — la dérivation le
          // recopie, elle n'en invente aucun. Sans lui, la masse produite est signalée invalide
          // (`validateScene`) plutôt que repliée en silence sur un versant arbitraire.
          ...(defaults.profile === 'shed' && defaults.eaveSide ? { eaveSide: defaults.eaveSide } : {}),
          derived: true,
        });
        for (const cellKey of component)
          for (let z = topZ - levels + 1; z <= topZ; z++) claimed.add(`${cellKey},${z}`);
      }
    }
    return { ...body, masses: [...overrides, ...derived] };
  });
}

/** RE-DÉRIVE les toitures de la scène ÉDITÉE (#841) : l'intention (`roofDefaults`/`roofExclusions`) et
 *  le plan sont les entrées, `ArchitectureBody.masses` le résultat MATÉRIALISÉ que le rendu lit
 *  (`gameIso/builders/roofs.buildRoofs` ne connaît QUE les masses). Sans cet appel, régler le profil
 *  d'un corps n'aurait aucun effet hors d'une recompilation `MapSpec`. Les surcharges authorées sont
 *  préservées (cf. `deriveArchitectureMasses`). */
export function rederiveRoofMasses(scene: Scene): Scene {
  if (!scene.architecture?.length) return scene;
  return { ...scene, architecture: deriveArchitectureMasses(scene) };
}
