/**
 * FONDATION PURE de l'éditeur v2 : outil actif, calques, SÉLECTION UNIFIÉE (union discriminée
 * remplaçant les 4 états exclusifs du POC) et toutes les mutations de scène déclenchées depuis
 * le canvas (peindre, poser, déplacer, redimensionner, supprimer, coller, points d'entrée).
 * Fonctions PURES (Scene → Scene) testables sans DOM — `Editor`/`EditorCanvas` ne font que les câbler.
 */
import { Scene, SceneEntity, Terrain, EntityKind, BuildingFeature } from '../../state/scene';
import { nextEntityId } from '../../state/entityId';
import { defaultDoor } from '../../state/buildings';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { PROPS } from '../../gameIso/catalog/decor';
import { propRefPatch } from './propDefaults';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** Outil actif (rail de la Palette). `ref` permet la pose DIRECTE d'un décor/d'une espèce précise. */
export type Tool =
  | { mode: 'select' }
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: EntityKind; ref?: string }
  | { mode: 'building'; type: string }
  | { mode: 'zone'; zone: 'trigger' | 'rest' }
  | { mode: 'entry' }
  | { mode: 'encounter' }
  | { mode: 'erase' };

/** Calques masquables du canvas (masquer débloque le clic sur ce qu'il y a dessous). */
export type Layers = { triggers: boolean; spawns: boolean; buildings: boolean; entries: boolean; rest: boolean };
export const DEFAULT_LAYERS: Layers = { triggers: true, spawns: true, buildings: true, entries: true, rest: true };

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: 'entity' | 'building' | 'trigger' | 'entry'; id: string }
  | { type: 'restZone'; idx: number }
  | { type: 'spawn'; enc: number; idx: number };

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
  if (a.type === 'spawn' && b.type === 'spawn') return a.enc === b.enc && a.idx === b.idx;
  if (a.type === 'restZone' && b.type === 'restZone') return a.idx === b.idx;
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** Élément occupant la case p — priorité spawn > entité > entrée > trigger > zone repos > bâtiment.
 *  Les calques masqués sont ignorés (cliquer « à travers »). */
export function hitAt(scene: Scene, p: Pt, layers: Layers): Sel {
  if (layers.spawns)
    for (let ei = 0; ei < scene.encounters.length; ei++) {
      const ii = (scene.encounters[ei].enemies ?? []).findIndex((en) => en.pos.x === p.x && en.pos.y === p.y);
      if (ii >= 0) return { type: 'spawn', enc: ei, idx: ii };
    }
  const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
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
  if (layers.buildings) {
    const b = (scene.buildings ?? []).find((b) => inRect(p, b.foot));
    if (b) return { type: 'building', id: b.id };
  }
  return null;
}

/** Rect occupé par la sélection (poignée de resize, surlignage) — null si la sélection est ponctuelle. */
export function selRect(scene: Scene, sel: Sel): Rect | null {
  if (sel?.type === 'trigger') return scene.triggers.find((t) => t.id === sel.id)?.rect ?? null;
  if (sel?.type === 'restZone') return scene.restZones?.[sel.idx]?.rect ?? null;
  if (sel?.type === 'building') return (scene.buildings ?? []).find((b) => b.id === sel.id)?.foot ?? null;
  return null;
}

/** Position d'ancrage de la sélection (coin NW pour les rects) — cible des flèches de nudge. */
export function selPos(scene: Scene, sel: Sel): Pt | null {
  if (sel?.type === 'entity') return scene.entities.find((e) => e.id === sel.id)?.pos ?? null;
  if (sel?.type === 'spawn') return (scene.encounters[sel.enc]?.enemies ?? [])[sel.idx]?.pos ?? null;
  if (sel?.type === 'entry') return scene.entryPoints?.[sel.id] ?? null;
  const r = selRect(scene, sel);
  return r ? { x: r.x, y: r.y } : null;
}

/** Déplace la sélection vers `to` (clampée dans la carte). Scene inchangée si sélection invalide. */
export function moveSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const { w, h } = scene.dimensions;
  if (sel?.type === 'entity')
    return { ...scene, entities: scene.entities.map((e) => (e.id === sel.id ? { ...e, pos: { x: clamp(to.x, w), y: clamp(to.y, h) } } : e)) };
  if (sel?.type === 'spawn') {
    const encs = scene.encounters.map((e) => ({ ...e, enemies: [...(e.enemies ?? [])] }));
    const en = (encs[sel.enc]?.enemies ?? [])[sel.idx];
    if (!en) return scene;
    encs[sel.enc].enemies![sel.idx] = { ...en, pos: { x: clamp(to.x, w), y: clamp(to.y, h) } };
    return { ...scene, encounters: encs };
  }
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
  if (sel?.type === 'building')
    return {
      ...scene,
      buildings: (scene.buildings ?? []).map((b) =>
        b.id === sel.id ? { ...b, foot: { ...b.foot, x: clamp(to.x, w - b.foot.w + 1), y: clamp(to.y, h - b.foot.h + 1) } } : b,
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
  return scene;
}

/** Supprime l'élément sélectionné. Scene inchangée si rien/introuvable. */
export function deleteSel(scene: Scene, sel: Sel): Scene {
  if (sel?.type === 'entity') return { ...scene, entities: scene.entities.filter((e) => e.id !== sel.id) };
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.filter((t) => t.id !== sel.id) };
  if (sel?.type === 'building') return { ...scene, buildings: (scene.buildings ?? []).filter((b) => b.id !== sel.id) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'spawn')
    return {
      ...scene,
      encounters: scene.encounters.map((e, ei) => (ei === sel.enc ? { ...e, enemies: (e.enemies ?? []).filter((_, ni) => ni !== sel.idx) } : e)),
    };
  if (sel?.type === 'entry') {
    const entries = { ...scene.entryPoints };
    delete entries[sel.id];
    return { ...scene, entryPoints: Object.keys(entries).length ? entries : undefined };
  }
  return scene;
}

/** Peint un carré de côté `brush` centré sur p (terrain). */
export function paintTiles(scene: Scene, p: Pt, terrain: Terrain, brush: number): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const tiles = [...scene.tiles];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx,
        y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
    }
  return { ...scene, tiles };
}

/** Remplit un rectangle de terrain (sous-mode Rectangle). */
export function fillTerrainRect(scene: Scene, rect: Rect, terrain: Terrain): Scene {
  const { w, h } = scene.dimensions;
  const tiles = [...scene.tiles];
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
  return { ...scene, tiles };
}

/** Pose une entité à p (id frais) — `ref` = décor/espèce précise (pose directe depuis le catalogue).
 *  Les props appliquent leurs défauts de catalogue (empreinte, interactif si fouillable). */
export function placeEntity(scene: Scene, kind: EntityKind, ref: string | undefined, p: Pt): { scene: Scene; id: string } {
  const id = nextEntityId(kind, scene.entities.map((e) => e.id));
  let ent: SceneEntity = { id, kind, pos: { ...p }, label: KIND_LABEL[kind] };
  if (ref && kind === 'prop') ent = { ...ent, ...propRefPatch(ref, false), label: PROPS[ref]?.label };
  else if (ref && kind === 'personnage' && ref !== 'Villageois') ent = { ...ent, ref, label: ref };
  return { scene: { ...scene, entities: [...scene.entities, ent] }, id };
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
  return { scene: { ...scene, triggers: [...scene.triggers, { id, rect, once: true, effects: [] }] }, id };
}

/** Crée une zone de repos sur `rect` (camp par défaut — lieux/qualité éditables dans l'inspecteur). */
export function addRestZone(scene: Scene, rect: Rect): { scene: Scene; idx: number } {
  const zones = [...(scene.restZones ?? []), { rect, places: { camp: true } }];
  return { scene: { ...scene, restZones: zones }, idx: zones.length - 1 };
}

/** Pose un bâtiment du catalogue sur `rect` (porte au Sud par défaut).
 *  Clic simple (rect 1×1) : empreinte par défaut du catalogue, ancrée sur la case, clampée. */
export function addBuilding(scene: Scene, type: string, rect: Rect): { scene: Scene; id: string } | null {
  const meta = BUILDINGS_META[type];
  if (!meta) return null;
  if (rect.w === 1 && rect.h === 1) {
    const { w, h } = scene.dimensions;
    const fw = Math.min(meta.defaultFoot.w, w);
    const fh = Math.min(meta.defaultFoot.h, h);
    rect = { x: clamp(rect.x, w - fw + 1), y: clamp(rect.y, h - fh + 1), w: fw, h: fh };
  }
  const b: BuildingFeature = {
    id: nextEntityId('b', (scene.buildings ?? []).map((b) => b.id)),
    type: meta.id,
    foot: rect,
    facing: 'S',
    reveal: meta.defaultReveal,
    door: defaultDoor(rect, 'S'),
    params: {},
    label: meta.label,
  };
  return { scene: { ...scene, buildings: [...(scene.buildings ?? []), b] }, id: b.id };
}

/** Ajoute un ennemi `ref` à la rencontre `encId` (créée si absente/vide) à la case p. */
export function addSpawn(scene: Scene, encId: string, ref: string, p: Pt): { scene: Scene; encId: string } {
  const encs = scene.encounters.map((e) => ({ ...e, enemies: [...(e.enemies ?? [])] }));
  let target = encs.find((e) => e.id === encId);
  if (!target) {
    target = { id: encId || nextEntityId('enc', scene.encounters.map((e) => e.id)), enemies: [] };
    encs.push(target);
  }
  target.enemies.push({ ref, pos: { ...p } });
  return { scene: { ...scene, encounters: encs }, encId: target.id };
}

/** Gomme : retire l'entité posée sur p (les autres couches se suppriment via leur sélection). */
export function eraseAt(scene: Scene, p: Pt): Scene {
  const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
  return ent ? { ...scene, entities: scene.entities.filter((e) => e !== ent) } : scene;
}
