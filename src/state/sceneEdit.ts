/**
 * MUTATIONS PURES de Scène (Scene → Scene) — Node-safe, ZÉRO dépendance UI/gameIso. Extraites de
 * `ui/editor/editorState.ts` pour que le compilateur headless-editor (`state/mapSpec.buildScene`,
 * exécuté via `tsx` par le générateur d'arène en Node) puisse les rejouer sans tirer le rendu.
 *
 * Chaque fonction renvoie une NOUVELLE Scène (immuable). `editorState.ts` les RÉ-EXPORTE : les câblages
 * du canvas (couplés UI/gameIso) y restent. NE JAMAIS importer `../ui/` ni `../gameIso/` ici.
 */
import { Scene, SceneEntity, Terrain, EncounterMember, layerTiles, WallSeg, WallSide, Roof } from './scene';
import type { FireArc, AuthoredShipPoste } from '../engine/types';
import type { Dir8 } from './dir8';
import { EMPTY_FLOW } from './flow';
import { nextEntityId } from './entityId';
import { findTrappingById } from '../data';
import { siegeEmplacementEntity } from './siegeEmplacement';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

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

/** Pose / change / retire l'arête à l'état `want`. Source unique de l'écriture d'une cloison cardinale. */
export function setEdgeWall(scene: Scene, x: number, y: number, side: Edge4, z: number, want: 'none' | 'wall' | 'door'): Scene {
  const e = canonEdge(x, y, side);
  const others = (scene.walls ?? []).filter((w) => !(w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z));
  if (want === 'none') return { ...scene, walls: others.length ? others : undefined };
  const seg: WallSeg = { x: e.x, y: e.y, side: e.side, ...(z ? { z } : {}), ...(want === 'door' ? { door: true } : {}) };
  return { ...scene, walls: [...others, seg] };
}

/** Clic de l'outil : l'arête prend l'état `want`, ou disparaît si elle l'avait déjà (toggle). */
export function toggleEdgeWall(scene: Scene, x: number, y: number, side: Edge4, z: number, want: 'wall' | 'door'): Scene {
  return setEdgeWall(scene, x, y, side, z, edgeWallState(scene, x, y, side, z) === want ? 'none' : want);
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

/** Colle une copie de `data` (id frais) à la case p. */
export function pasteEntity(scene: Scene, data: SceneEntity, p: Pt): { scene: Scene; id: string } {
  const id = nextEntityId(data.kind, scene.entities.map((e) => e.id));
  const ent: SceneEntity = { ...(JSON.parse(JSON.stringify(data)) as SceneEntity), id, pos: { ...p } };
  return { scene: { ...scene, entities: [...scene.entities, ent] }, id };
}

/** Pose un point d'entrée nommé `entree-N` (premier libre) à p — comble le manque du POC :
 *  les transitions et la carte du monde les référencent mais rien ne permettait d'en créer. */
export function placeEntry(scene: Scene, p: Pt): { scene: Scene; name: string } {
  const name = nextEntityId('entree', Object.keys(scene.entryPoints ?? {}));
  return { scene: { ...scene, entryPoints: { ...scene.entryPoints, [name]: { ...p } } }, name };
}

/** Renomme un point d'entrée (clé unique, non vide). Renvoie la scène inchangée si conflit. */
export function renameEntry(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  if (!next || next === from || scene.entryPoints?.[next] || !scene.entryPoints?.[from]) return scene;
  const entries: Record<string, Pt> = {};
  for (const [k, v] of Object.entries(scene.entryPoints)) entries[k === from ? next : k] = v;
  return { ...scene, entryPoints: entries };
}

/** Crée un trigger sur `rect` (id frais). */
export function addTrigger(scene: Scene, rect: Rect): { scene: Scene; id: string } {
  const id = nextEntityId('trig', scene.triggers.map((t) => t.id));
  return { scene: { ...scene, triggers: [...scene.triggers, { id, rect, once: true, flow: EMPTY_FLOW }] }, id };
}

/** Crée une zone de repos sur `rect` (camp par défaut — lieux/qualité éditables dans l'inspecteur). */
export function addRestZone(scene: Scene, rect: Rect): { scene: Scene; idx: number } {
  const zones = [...(scene.restZones ?? []), { rect, places: { camp: true } }];
  return { scene: { ...scene, restZones: zones }, idx: zones.length - 1 };
}

/** Crée une ZONE D'EFFET (piège) sur `rect` : Dégâts à la traversée par défaut — label/effet/déclencheur
 *  éditables dans l'inspecteur. id frais pour le rendu/sélection. */
export function addEffectZone(scene: Scene, rect: Rect): { scene: Scene; idx: number } {
  const id = nextEntityId('zone', (scene.effectZones ?? []).map((z) => z.id));
  const zones = [
    ...(scene.effectZones ?? []),
    { id, label: 'Piège', area: { kind: 'rect' as const, ...rect }, onCross: [{ op: 'wounds' as const, amount: 5, ignoreTB: false, ignoreAP: true }] },
  ];
  return { scene: { ...scene, effectZones: zones }, idx: zones.length - 1 };
}

/** Pose le TOIT d'un bâtiment COMPOSÉ sur `rect` (la couverture ; les MURS se tracent à l'outil d'arête,
 *  cf. `setEdgeWall`/`patchWall`). `style` = preset de toiture (cf. `ROOF_STYLES`). L'empreinte vient du
 *  glissé ; matériau/couleurs/étages s'éditent ensuite dans l'inspecteur. id frais pour le rendu/sélection. */
export function addRoof(scene: Scene, style: string, rect: Rect): { scene: Scene; id: string } {
  const id = nextEntityId('roof', (scene.roofs ?? []).map((r) => r.id));
  const roof: Roof = { id, foot: rect, style };
  return { scene: { ...scene, roofs: [...(scene.roofs ?? []), roof] }, id };
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

/** Outil « combat » : POSE une entité-personnage de combat (cachée par défaut) à p ET l'enrôle dans la
 *  rencontre `encId` (créée si absente). `ref` = créature du bestiaire (profil). */
export function addEnemyMember(scene: Scene, encId: string, ref: string, p: Pt): { scene: Scene; encId: string; entityId: string } {
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent: SceneEntity = { id, kind: 'personnage', pos: { ...p }, combat: { hiddenUntilCombat: true } };
  if (ref && ref !== 'Villageois') { ent.ref = ref; ent.label = ref; }
  const withEnt = { ...scene, entities: [...scene.entities, ent] };
  const { scene: out, encId: usedEnc } = addMember(withEnt, encId, id);
  return { scene: out, encId: usedEnc, entityId: id };
}

/** Gomme : retire l'entité posée sur p (les autres couches se suppriment via leur sélection). */
export function eraseAt(scene: Scene, p: Pt): Scene {
  const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
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

/** Fusionne des flags initiaux dans `scene.flags` (état de départ : porte ouverte, jalon posé…). */
export function setSceneFlags(scene: Scene, patch: Record<string, boolean>): Scene {
  return { ...scene, flags: { ...scene.flags, ...patch } };
}

/** Patche les champs de HAUT NIVEAU d'une entité (facing/label/crewIds/upgrades/light/statblock/foot…) —
 *  fusion superficielle. No-op si l'entité est absente. Source unique du câblage de données d'entité par
 *  `buildScene` (coque-navire : équipage/upgrades exposés, MDG ch.14 — sans widget d'inspecteur). */
export function patchEntity(scene: Scene, id: string, patch: Partial<SceneEntity>): Scene {
  return { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

/** Patche le sous-objet `combat` d'une entité SANS écraser l'existant (fusionne skills/spells/optionals/
 *  hiddenUntilCombat). Qualifie p.ex. un servant-ref au bon Groupe de Projectiles (AA p.122). No-op si absente. */
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

/** BÂTIMENT COMPOSÉ = `Roof` (couverture cutaway) + périmètre de murs d'ARÊTE + une arête-porte franchissable
 *  + sol repeint. Source UNIQUE de la composition (partagée éditeur ⇄ `buildScene`), généralisant l'ancien
 *  `buildingToComposite` de l'arène : la structure réelle est faite de `WallSeg`, le toit n'est que du rendu.
 *  `wallStructure` (ex. `mur-en-bois`) rend les murs pleins DESTRUCTIBLES ; la porte n'en porte pas.
 *  `id`/`label` (déclaratif) : id d'auteur préservé sur le toit (sinon frais) + libellé de survol.
 *  FENÊTRES (`windows`, défaut activé) : chaque pan reçoit des fenêtres DÉCORATIVES régulièrement espacées
 *  (toutes ~WIN_STEP cases), en SAUTANT les coins et la porte — un mur fenêtré bloque comme un mur plein. */
export function addBuilding(
  scene: Scene,
  style: string,
  foot: Rect,
  opts: { id?: string; door?: { x: number; y: number; side: Edge4 }; floor?: Terrain; wallStructure?: string; z?: number; label?: string; windows?: boolean } = {},
): { scene: Scene; id: string } {
  const { id: wantId, door, floor, wallStructure, z = 0, label, windows = true } = opts;
  const roof = addRoof(scene, style, foot);
  const id = wantId ?? roof.id; // id d'auteur préservé (déclaratif) sinon frais (édition interactive)
  let s = (wantId || label)
    ? { ...roof.scene, roofs: (roof.scene.roofs ?? []).map((r) => (r.id === roof.id ? { ...r, id, ...(label ? { label } : {}) } : r)) }
    : roof.scene;
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
