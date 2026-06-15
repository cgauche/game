/**
 * FONDATION PURE de l'éditeur v2 : outil actif, calques, SÉLECTION UNIFIÉE (union discriminée
 * remplaçant les 4 états exclusifs du POC) et toutes les mutations de scène déclenchées depuis
 * le canvas (peindre, poser, déplacer, redimensionner, supprimer, coller, points d'entrée).
 * Fonctions PURES (Scene → Scene) testables sans DOM — `Editor`/`EditorCanvas` ne font que les câbler.
 */
import { Scene, SceneEntity, Terrain, EntityKind, BuildingFeature, EncounterMember, levelTiles } from '../../state/scene';
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
  | { mode: 'zone'; zone: 'trigger' | 'rest' | 'effect' }
  | { mode: 'entry' }
  | { mode: 'encounter' }
  | { mode: 'stair' }
  | { mode: 'erase' };

/** Calques masquables du canvas (masquer débloque le clic sur ce qu'il y a dessous). */
export type Layers = { triggers: boolean; spawns: boolean; buildings: boolean; entries: boolean; rest: boolean; effects: boolean };
export const DEFAULT_LAYERS: Layers = { triggers: true, spawns: true, buildings: true, entries: true, rest: true, effects: true };

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: 'entity' | 'building' | 'trigger' | 'entry'; id: string }
  | { type: 'restZone'; idx: number }
  | { type: 'effectZone'; idx: number };

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
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** Élément occupant la case p — priorité entité > entrée > trigger > zone repos > bâtiment.
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
  if (sel?.type === 'effectZone') { const z = scene.effectZones?.[sel.idx]; return z ? effectZoneRect(z.area) : null; }
  if (sel?.type === 'building') return (scene.buildings ?? []).find((b) => b.id === sel.id)?.foot ?? null;
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
  if (sel?.type === 'building') return { ...scene, buildings: (scene.buildings ?? []).filter((b) => b.id !== sel.id) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'entry') {
    const entries = { ...scene.entryPoints };
    delete entries[sel.id];
    return { ...scene, entryPoints: Object.keys(entries).length ? entries : undefined };
  }
  return scene;
}

/** Réécrit les tuiles du niveau `z` (immuable) — base partagée des outils de terrain. */
function withLevelTiles(scene: Scene, z: number, tiles: Terrain[]): Scene {
  return { ...scene, levels: scene.levels.map((l) => (l.z === z ? { ...l, tiles } : l)) };
}

/** Peint un carré de côté `brush` centré sur p (terrain), sur le niveau `z` (défaut sol). */
export function paintTiles(scene: Scene, p: Pt, terrain: Terrain, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const tiles = [...levelTiles(scene, z)];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx,
        y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
    }
  return withLevelTiles(scene, z, tiles);
}

/** Remplit un rectangle de terrain (sous-mode Rectangle), sur le niveau `z` (défaut sol). */
export function fillTerrainRect(scene: Scene, rect: Rect, terrain: Terrain, z = 0): Scene {
  const { w, h } = scene.dimensions;
  const tiles = [...levelTiles(scene, z)];
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
  return withLevelTiles(scene, z, tiles);
}

/** Ajoute un étage à la cote `z` (grille « vide » = transparente, à construire), trié par z. No-op si
 *  un étage `z` existe déjà. Source unique de l'ajout d'étage (éditeur multi-niveaux). */
export function addLevel(scene: Scene, z: number): Scene {
  if (scene.levels.some((l) => l.z === z)) return scene;
  const tiles = new Array(scene.dimensions.w * scene.dimensions.h).fill('vide') as Terrain[];
  return { ...scene, levels: [...scene.levels, { z, tiles }].sort((a, b) => a.z - b.z) };
}

/** Pose un escalier (franchissement vertical) reliant la case `p` de l'étage `z` à la même case de
 *  l'étage AU-DESSUS (z+1). No-op si ce niveau n'existe pas ou si l'escalier est déjà présent. */
export function addStair(scene: Scene, p: Pt, z: number): Scene {
  if (!scene.levels.some((l) => l.z === z + 1)) return scene;
  const from = { x: p.x, y: p.y, z }, to = { x: p.x, y: p.y, z: z + 1 };
  if ((scene.stairs ?? []).some((s) => s.from.x === from.x && s.from.y === from.y && s.from.z === z && s.to.z === to.z)) return scene;
  return { ...scene, stairs: [...(scene.stairs ?? []), { from, to }] };
}

/** Retire l'étage `z`. Le SOL (z=0) et le dernier étage sont protégés (jamais de scène sans niveau). */
export function removeLevel(scene: Scene, z: number): Scene {
  if (z === 0 || scene.levels.length <= 1) return scene;
  return { ...scene, levels: scene.levels.filter((l) => l.z !== z) };
}

/** Pose une entité à p (id frais) — `ref` = décor/espèce précise (pose directe depuis le catalogue).
 *  Les props appliquent leurs défauts de catalogue (empreinte, interactif si fouillable). */
export function placeEntity(scene: Scene, kind: EntityKind, ref: string | undefined, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId(kind, scene.entities.map((e) => e.id));
  let ent: SceneEntity = { id, kind, pos: { ...p }, label: KIND_LABEL[kind] };
  if (ref && kind === 'prop') ent = { ...ent, ...propRefPatch(ref, false), label: PROPS[ref]?.label };
  else if (ref && kind === 'personnage' && ref !== 'Villageois') ent = { ...ent, ref, label: ref };
  if (z) ent = { ...ent, z }; // pose sur l'étage courant ; sol (0) = champ absent
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

/** Crée une ZONE D'EFFET (piège) sur `rect` : Dégâts à la traversée par défaut — label/effet/déclencheur
 *  éditables dans l'inspecteur. id frais pour le rendu/sélection. */
export function addEffectZone(scene: Scene, rect: Rect): { scene: Scene; idx: number } {
  const id = nextEntityId('zone', (scene.effectZones ?? []).map((z) => z.id));
  const zones = [
    ...(scene.effectZones ?? []),
    { id, label: 'Piège', area: { kind: 'rect' as const, ...rect }, onCross: { damage: { amount: 5, ignoreAP: true } } },
  ];
  return { scene: { ...scene, effectZones: zones }, idx: zones.length - 1 };
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
