/**
 * FONDATION PURE de l'éditeur v2 : outil actif, calques, SÉLECTION UNIFIÉE (union discriminée
 * remplaçant les 4 états exclusifs du POC) et toutes les mutations de scène déclenchées depuis
 * le canvas (peindre, poser, déplacer, redimensionner, supprimer, coller, points d'entrée).
 * Fonctions PURES (Scene → Scene) testables sans DOM — `Editor`/`EditorCanvas` ne font que les câbler.
 */
import { Scene, SceneEntity, Terrain, EntityKind, EncounterMember, layerTiles, WallSeg, WallSide, Roof, RoofParams } from '../../state/scene';
import type { FireArc, ShipPoste } from '../../engine/types';
import { EMPTY_FLOW, flowEffects } from '../../state/flow';
export { flowEffects };
import { nextEntityId } from '../../state/entityId';
import { PROPS } from '../../gameIso/catalog/decor';
import { speciesLabel } from '../../gameIso/rig/creatures';
import { itemFromTrappingById } from '../../engine/items';
import { siegeEngines, findTrappingById } from '../../data';
import { siegeEmplacementEntity } from '../../state/siegeEmplacement';
import { propRefPatch } from './propDefaults';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** Outil actif (rail de la Palette). `ref` permet la pose DIRECTE d'un décor/d'une espèce précise. */
export type Tool =
  | { mode: 'select' }
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: EntityKind; ref?: string }
  // Toit d'un bâtiment COMPOSÉ : pose une pièce de toiture (`style` = preset, cf. ROOF_STYLES) couvrant
  // l'empreinte glissée. Les MURS du bâtiment se tracent à l'outil d'arête (cloison/porte/structure).
  | { mode: 'roof'; style: string }
  | { mode: 'zone'; zone: 'trigger' | 'rest' | 'effect' }
  | { mode: 'entry' }
  | { mode: 'encounter' }
  | { mode: 'wall'; paint: WallPaint }
  // Hauteur métrique d'une surface (porteuse : marchabilité/combat/chute, cf. `relief.ts`). On peint des
  // MÈTRES ; la traversée verticale s'auto-dérive du delta de hauteur (`surfaceLink`), sans escalier.
  | { mode: 'height'; metres: number }
  // Emplacement de siège : pose une SceneEntity portant un poste d'artillerie (`trappingId` = engin du
  // catalogue `armes-de-siege`). Le créneau (arc) et l'équipage s'éditent ensuite dans l'inspecteur.
  | { mode: 'emplacement'; trappingId: string }
  | { mode: 'erase' };

/** Catalogue des pièces d'artillerie posables (engins de siège, AA/MDG) — SOURCE UNIQUE de l'outil
 *  Palette et du sélecteur d'engin de l'inspecteur. Posable ⇔ l'engin a un art d'affût (`siegeRig`) : c'est
 *  ce rig qui rend l'affût inerte en éditeur comme en combat. L'invariant ne vit qu'ici (pas dupliqué). */
export const SIEGE_ENGINES = siegeEngines; // FOYER UNIQUE du filtre = `data/siegeEngines` (partagé avec le Codex)

/** Presets de STYLE de toit (bâtiment composé) — SOURCE UNIQUE de l'outil Palette et du sélecteur de
 *  l'inspecteur (en attendant un catalogue de toits dédié). Le style pilotera le rendu de la couverture. */
export const ROOF_STYLES = ['maison', 'taverne', 'forge', 'echoppe', 'chapelle', 'tour', 'manoir'] as const;

/** Matériaux de couverture (`RoofParams.roofMaterial`) → libellé + teinte d'aperçu éditeur (alignée sur
 *  l'art du jeu, `catalog/buildings/render-helpers`). SOURCE UNIQUE partagée Inspecteur ⇄ Canvas. */
export const ROOF_MATERIALS: { id: NonNullable<RoofParams['roofMaterial']>; label: string; swatch: string }[] = [
  { id: 'tuile', label: 'Tuiles', swatch: '#8a3326' },
  { id: 'chaume', label: 'Chaume', swatch: '#9a7b3a' },
  { id: 'ardoise', label: 'Ardoise', swatch: '#4a5560' },
];

/** Sous-mode de l'outil MURS : cloison pleine, porte (arête franchissable), ou diagonale en travers. */
export type WallPaint = 'wall' | 'door' | 'diagBack' | 'diagFwd';

/** Calques masquables du canvas (masquer débloque le clic sur ce qu'il y a dessous). */
export type Layers = { triggers: boolean; spawns: boolean; roofs: boolean; entries: boolean; rest: boolean; effects: boolean };
export const DEFAULT_LAYERS: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, effects: true };

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: 'entity' | 'roof' | 'trigger' | 'entry'; id: string }
  | { type: 'restZone'; idx: number }
  | { type: 'effectZone'; idx: number }
  // Arête de mur (cloison/porte) désignée par sa forme CANONIQUE (case + N|E + couche) — éditable dans
  // l'inspecteur (type, structure destructible). Posée par l'outil murs, sélectionnée à l'outil ↖.
  | { type: 'wall'; x: number; y: number; side: WallSide; z: number };

/** Rect englobant l'aire d'une zone d'effet (disque → boîte). L'éditeur n'auteure que des rect. */
export function effectZoneRect(area: import('../../state/scene').ZoneArea): Rect {
  if (area.kind === 'disc') return { x: area.cx - area.radius, y: area.cy - area.radius, w: area.radius * 2 + 1, h: area.radius * 2 + 1 };
  return { x: area.x, y: area.y, w: area.w, h: area.h };
}

export const KIND_LABEL: Record<EntityKind, string> = {
  heroStart: 'Départ héros',
  personnage: 'Personnage',
  prop: 'Décor',
};

/** Rectangle inclusif englobant deux cases (drag de zone/bâtiment/remplissage). */
export function rectFrom(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}
const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));

/** Deux sélections désignent-elles le même élément ? */
export function sameSel(a: Sel, b: Sel): boolean {
  if (!a || !b || a.type !== b.type) return a === b;
  if (a.type === 'restZone' && b.type === 'restZone') return a.idx === b.idx;
  if (a.type === 'effectZone' && b.type === 'effectZone') return a.idx === b.idx;
  if (a.type === 'wall' && b.type === 'wall') return a.x === b.x && a.y === b.y && a.side === b.side && a.z === b.z;
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** Élément occupant la case p — priorité entité > entrée > trigger > zone repos > toit.
 *  Les calques masqués sont ignorés (cliquer « à travers »). Le calque `spawns` masque les entités
 *  de COMBAT cachées (embusqueurs) : on ne peut alors cliquer que les PNJ visibles. */
export function hitAt(scene: Scene, p: Pt, layers: Layers): Sel {
  const ent = scene.entities.find(
    (e) => e.pos.x === p.x && e.pos.y === p.y && (layers.spawns || !e.combat?.hiddenUntilCombat),
  );
  if (ent) return { type: 'entity', id: ent.id };
  if (layers.entries)
    for (const [name, pos] of Object.entries(scene.entryPoints ?? {}))
      if (pos.x === p.x && pos.y === p.y) return { type: 'entry', id: name };
  if (layers.triggers) {
    const t = scene.triggers.find((t) => inRect(p, t.rect));
    if (t) return { type: 'trigger', id: t.id };
  }
  if (layers.rest) {
    const zi = (scene.restZones ?? []).findIndex((z) => inRect(p, z.rect));
    if (zi >= 0) return { type: 'restZone', idx: zi };
  }
  if (layers.effects) {
    const ei = (scene.effectZones ?? []).findIndex((z) => inRect(p, effectZoneRect(z.area)));
    if (ei >= 0) return { type: 'effectZone', idx: ei };
  }
  if (layers.roofs) {
    const r = (scene.roofs ?? []).find((r) => inRect(p, r.foot));
    if (r) return { type: 'roof', id: r.id };
  }
  return null;
}

/** Rect occupé par la sélection (poignée de resize, surlignage) — null si la sélection est ponctuelle. */
export function selRect(scene: Scene, sel: Sel): Rect | null {
  if (sel?.type === 'trigger') return scene.triggers.find((t) => t.id === sel.id)?.rect ?? null;
  if (sel?.type === 'restZone') return scene.restZones?.[sel.idx]?.rect ?? null;
  if (sel?.type === 'effectZone') { const z = scene.effectZones?.[sel.idx]; return z ? effectZoneRect(z.area) : null; }
  if (sel?.type === 'roof') return (scene.roofs ?? []).find((r) => r.id === sel.id)?.foot ?? null;
  return null;
}

/** Position d'ancrage de la sélection (coin NW pour les rects) — cible des flèches de nudge. */
export function selPos(scene: Scene, sel: Sel): Pt | null {
  if (sel?.type === 'entity') return scene.entities.find((e) => e.id === sel.id)?.pos ?? null;
  if (sel?.type === 'entry') return scene.entryPoints?.[sel.id] ?? null;
  const r = selRect(scene, sel);
  return r ? { x: r.x, y: r.y } : null;
}

/** Déplace la sélection vers `to` (clampée dans la carte). Scene inchangée si sélection invalide. */
export function moveSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const { w, h } = scene.dimensions;
  if (sel?.type === 'entity')
    return { ...scene, entities: scene.entities.map((e) => (e.id === sel.id ? { ...e, pos: { x: clamp(to.x, w), y: clamp(to.y, h) } } : e)) };
  if (sel?.type === 'entry') {
    const pos = scene.entryPoints?.[sel.id];
    if (!pos) return scene;
    return { ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { x: clamp(to.x, w), y: clamp(to.y, h) } } };
  }
  if (sel?.type === 'trigger')
    return {
      ...scene,
      triggers: scene.triggers.map((t) =>
        t.id === sel.id ? { ...t, rect: { ...t.rect, x: clamp(to.x, w - t.rect.w + 1), y: clamp(to.y, h - t.rect.h + 1) } } : t,
      ),
    };
  if (sel?.type === 'restZone')
    return {
      ...scene,
      restZones: (scene.restZones ?? []).map((z, i) =>
        i === sel.idx ? { ...z, rect: { ...z.rect, x: clamp(to.x, w - z.rect.w + 1), y: clamp(to.y, h - z.rect.h + 1) } } : z,
      ),
    };
  if (sel?.type === 'effectZone')
    return {
      ...scene,
      effectZones: (scene.effectZones ?? []).map((z, i) => {
        if (i !== sel.idx) return z;
        const r = effectZoneRect(z.area);
        return { ...z, area: { kind: 'rect', x: clamp(to.x, w - r.w + 1), y: clamp(to.y, h - r.h + 1), w: r.w, h: r.h } };
      }),
    };
  if (sel?.type === 'roof')
    return {
      ...scene,
      roofs: (scene.roofs ?? []).map((r) =>
        r.id === sel.id ? { ...r, foot: { ...r.foot, x: clamp(to.x, w - r.foot.w + 1), y: clamp(to.y, h - r.foot.h + 1) } } : r,
      ),
    };
  return scene;
}

/** Redimensionne le rect de la sélection (trigger/zone repos) : coin NW fixe, coin SE = `to` (≥ NW, clampé). */
export function resizeSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const r = selRect(scene, sel);
  if (!r) return scene;
  const { w, h } = scene.dimensions;
  const next = rectFrom({ x: r.x, y: r.y }, { x: Math.max(r.x, clamp(to.x, w)), y: Math.max(r.y, clamp(to.y, h)) });
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.map((t) => (t.id === sel.id ? { ...t, rect: next } : t)) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === sel.idx ? { ...z, rect: next } : z)) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).map((z, i) => (i === sel.idx ? { ...z, area: { kind: 'rect', ...next } } : z)) };
  return scene;
}

/** Supprime l'élément sélectionné. Scene inchangée si rien/introuvable. Supprimer une entité retire
 *  aussi ses rattachements de rencontre (membre + toute monture qui la chevauchait). */
export function deleteSel(scene: Scene, sel: Sel): Scene {
  if (sel?.type === 'entity') {
    const encounters = scene.encounters.map((e) => {
      const members = (e.members ?? []).filter((m) => m.entityId !== sel.id);
      if (members.length === (e.members ?? []).length) return e;
      return { ...e, members: members.map((m) => (m.ridesEntityId === sel.id ? { ...m, ridesEntityId: undefined } : m)) };
    });
    return { ...scene, entities: scene.entities.filter((e) => e.id !== sel.id), encounters };
  }
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.filter((t) => t.id !== sel.id) };
  if (sel?.type === 'roof') return { ...scene, roofs: (scene.roofs ?? []).filter((r) => r.id !== sel.id) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'wall') {
    const others = (scene.walls ?? []).filter((w) => !(w.x === sel.x && w.y === sel.y && w.side === sel.side && (w.z ?? 0) === sel.z));
    return { ...scene, walls: others.length ? others : undefined };
  }
  if (sel?.type === 'entry') {
    const entries = { ...scene.entryPoints };
    delete entries[sel.id];
    return { ...scene, entryPoints: Object.keys(entries).length ? entries : undefined };
  }
  return scene;
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

/** Arête la plus proche du centre de la case, depuis l'offset (ox,oy) ∈ [-0.5,0.5] du pointeur. */
export function nearestEdge(ox: number, oy: number): Edge4 {
  const d: Record<Edge4, number> = { N: 0.5 + oy, S: 0.5 - oy, O: 0.5 + ox, E: 0.5 - ox };
  return (['N', 'E', 'S', 'O'] as Edge4[]).reduce((a, b) => (d[b] < d[a] ? b : a));
}

/** Seuil de proximité (fraction de case) en deçà duquel l'outil ↖ SÉLECTIONNE une arête-mur plutôt que la
 *  tuile sous le curseur (au-delà = clic « plein centre » → picking de tuile). */
const EDGE_PICK = 0.33;

/** Arête-mur SÉLECTIONNABLE sous le point FRACTIONNAIRE (fx,fy) au niveau z : l'arête cardinale la plus
 *  proche du centre SI elle porte un segment ET que le pointeur en est assez près ; sinon null (l'appelant
 *  retombe alors sur `hitAt`). Diagonales exclues (purement visuelles, non porteuses de structure). */
export function pickWallEdge(scene: Scene, fx: number, fy: number, z: number): { x: number; y: number; side: 'N' | 'E' } | null {
  const px = Math.round(fx), py = Math.round(fy);
  const ox = fx - px, oy = fy - py;
  const side = nearestEdge(ox, oy);
  const dist: Record<Edge4, number> = { N: 0.5 + oy, S: 0.5 - oy, O: 0.5 + ox, E: 0.5 - ox };
  if (dist[side] > EDGE_PICK) return null;
  const e = canonEdge(px, py, side);
  return edgeWallState(scene, e.x, e.y, e.side, z) === 'none' ? null : e;
}

/** Forme CANONIQUE compacte d'un segment d'arête : on n'écrit que les champs significatifs (pas de z:0,
 *  pas de door:false, closed sans porte, structure vide) — même convention que `setEdgeWall`. */
function normWall(w: WallSeg): WallSeg {
  const out: WallSeg = { x: w.x, y: w.y, side: w.side };
  if (w.z) out.z = w.z;
  if (w.door) out.door = true;
  if (w.door && w.closed) out.closed = true;
  if (w.structure) out.structure = w.structure;
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

/** Pose une entité à p (id frais) — `ref` = décor/espèce précise (pose directe depuis le catalogue).
 *  Les props appliquent leurs défauts de catalogue (empreinte, interactif si fouillable). */
export function placeEntity(scene: Scene, kind: EntityKind, ref: string | undefined, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId(kind, scene.entities.map((e) => e.id));
  let ent: SceneEntity = { id, kind, pos: { ...p }, label: KIND_LABEL[kind] };
  if (ref && kind === 'prop') ent = { ...ent, ...propRefPatch(ref, false), label: PROPS[ref]?.label };
  // Personnage d'ambiance : `ref` porte l'id d'ESPÈCE rig (sélecteur Palette) → apparence + libellé.
  else if (ref && kind === 'personnage') ent = { ...ent, appearance: { species: ref }, label: speciesLabel(ref) };
  if (z) ent = { ...ent, z }; // pose sur l'étage courant ; sol (0) = champ absent
  return { scene: { ...scene, entities: [...scene.entities, ent] }, id };
}

/** Pose un EMPLACEMENT DE SIÈGE à p via le builder PARTAGÉ `siegeEmplacementEntity` (même source que les
 *  scénarios) : une SceneEntity-personnage portant `ref` (source de l'engin → la branche siège de
 *  `spawnEnemy` construit l'affût inerte) et un poste d'artillerie (`postes:[{ item, crewIds:[] }]`).
 *  AUCUN `appearance.species` : le rig d'engin est DÉRIVÉ de la `ref` au rendu (éditeur ↔ explo ↔ combat).
 *  Au combat, `applyShipPostes` sert la pièce au chef (`crewIds[0]`). Posable ⇔ l'engin a un art d'affût
 *  (`siegeRig`) ; sinon → null (pas d'entité fantôme). */
export function placeEmplacement(scene: Scene, trappingId: string, p: Pt, z = 0): { scene: Scene; id: string } | null {
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent = siegeEmplacementEntity(id, trappingId, p, z ? { z } : {});
  if (!ent) return null; // posable ⇔ a un art d'affût (`siegeRig`)
  return { scene: { ...scene, entities: [...scene.entities, ent] }, id };
}

/** Patche le poste UNIQUE (postes[0]) de l'emplacement `entityId` (no-op si l'entité n'en porte pas). */
function patchPoste0(scene: Scene, entityId: string, fn: (p: ShipPoste) => ShipPoste): Scene {
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

/** Change l'engin du poste : nouvelle ItemInstance + libellé, ET restampe la `ref` sur l'entité — le rig
 *  d'affût étant DÉRIVÉ de la `ref`, le rendu suit l'engin servi sans `appearance.species` stocké. Équipage
 *  conservé. No-op si l'engin est inconnu ou sans art d'affût (`siegeRig`). */
export function setPosteEngine(scene: Scene, entityId: string, trappingId: string): Scene {
  const t = findTrappingById(trappingId);
  const item = itemFromTrappingById(trappingId);
  if (!t?.siegeRig || !item) return scene;
  return {
    ...scene,
    entities: scene.entities.map((e) =>
      e.id === entityId && e.postes?.length
        ? { ...e, label: t.label, ref: trappingId, postes: e.postes.map((p, i) => (i === 0 ? { ...p, item } : p)) }
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

// Le `when`(Condition) d'un trigger/choix de dialogue est édité par `ConditionEditor`/`WhenEditor`
// (algèbre flag/horaire/ET/OU/NON) — plus d'adaptateurs plats flag↔string ici.
// `flowEffects` est ré-exporté depuis `state/flow` (cf. import en tête) — source unique, pas de copie.

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

/** Outil ⚔️ : POSE une entité-personnage de combat (cachée par défaut) à p ET l'enrôle dans la
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
  const layer = { z, tiles, ...(height ? { height } : {}) };
  const others = scene.layers.filter((l) => l.z !== z);
  return { ...scene, layers: [...others, layer].sort((a, b) => a.z - b.z) };
}

/** BÂTIMENT COMPOSÉ = `Roof` (couverture cutaway) + périmètre de murs d'ARÊTE + une arête-porte franchissable
 *  + sol repeint. Source UNIQUE de la composition (partagée éditeur ⇄ `buildScene`), généralisant l'ancien
 *  `buildingToComposite` de l'arène : la structure réelle est faite de `WallSeg`, le toit n'est que du rendu.
 *  `wallStructure` (ex. `mur-en-bois`) rend les murs pleins DESTRUCTIBLES ; la porte n'en porte pas. */
export function addBuilding(
  scene: Scene,
  style: string,
  foot: Rect,
  opts: { door?: { x: number; y: number; side: Edge4 }; floor?: Terrain; wallStructure?: string; z?: number } = {},
): { scene: Scene; id: string } {
  const { door, floor, wallStructure, z = 0 } = opts;
  const roof = addRoof(scene, style, foot);
  let s = roof.scene;
  const edges: { x: number; y: number; side: Edge4 }[] = [];
  for (let cx = foot.x; cx < foot.x + foot.w; cx++) {
    edges.push({ x: cx, y: foot.y, side: 'N' }); // arête haute
    edges.push({ x: cx, y: foot.y + foot.h - 1, side: 'S' }); // arête basse
  }
  for (let cy = foot.y; cy < foot.y + foot.h; cy++) {
    edges.push({ x: foot.x, y: cy, side: 'O' }); // arête gauche
    edges.push({ x: foot.x + foot.w - 1, y: cy, side: 'E' }); // arête droite
  }
  const doorCanon = door ? canonEdge(door.x, door.y, door.side) : null;
  for (const e of edges) {
    const c = canonEdge(e.x, e.y, e.side);
    const isDoor = !!doorCanon && c.x === doorCanon.x && c.y === doorCanon.y && c.side === doorCanon.side;
    s = setEdgeWall(s, e.x, e.y, e.side, z, isDoor ? 'door' : 'wall');
    if (!isDoor && wallStructure) s = patchWall(s, c.x, c.y, c.side, z, { structure: wallStructure });
  }
  if (floor) s = fillTerrainRect(s, foot, floor, z);
  return { scene: s, id: roof.id };
}
