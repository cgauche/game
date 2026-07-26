/** Fondation pure de l’éditeur : outils, calques, sélection et mutations de scène. */
import { Scene, SceneEntity, Terrain, EntityKind, WallSide, isDescriptiveZone } from '../../state/scene';
import { flowEffects } from '../../state/flow';
export { flowEffects };
import { nextEntityId } from '../../state/entityId';
import { PROPS } from '../../gameIso/catalog/decor';
import { speciesLabel } from '../../gameIso/rig/creatures';
import { siegeEngines } from '../../data';
import { propRefPatch } from './propDefaults';
import { type Rect, type Pt, type Edge4, canonEdge, edgeWallState, rectFrom, entityAt } from '../../state/sceneEdit';

export {
  addArchitectureBody,
  addArchitectureStorey,
  addArchitecturePart,
  addFacadeSection,
  addBuildingMass,
  rectFrom,
  paintTiles,
  fillTerrainRect,
  addLayer,
  removeLayer,
  canonEdge,
  edgeWallState,
  setEdgeWall,
  toggleEdgeWall,
  toggleDiagonalWall,
  patchWall,
  paintHeight,
  paintCrenellated,
  placeEmplacement,
  setPosteCrew,
  setPosteSide,
  setPosteEngine,
  pasteEntity,
  placeEntry,
  renameEntry,
  addTrigger,
  addRestZone,
  addEffectZone,
  renameEffectZone,
  addMember,
  removeMember,
  patchMember,
  addEnemyMember,
  eraseAt,
  setMetresPerTile,
  setAmbientLight,
  setEnvironment,
  setSceneFlags,
  entityAt,
  patchEntity,
  patchEntityCombat,
  putLayer,
} from '../../state/sceneEdit';
export type { Rect, Pt, Edge4 } from '../../state/sceneEdit';

/** Outil actif (rail de la Palette). `ref` permet la pose DIRECTE d'un décor/d'une espèce précise. */
export type Tool =
  | { mode: 'select' }
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: EntityKind; ref?: string }
  | { mode: 'zone'; zone: 'trigger' | 'rest' | 'effect' }
  | { mode: 'entry' }
  | { mode: 'encounter' }
  // `structure` (id de `structures.json`) = le MATÉRIAU porté par l'outil, mémorisé entre les poses
  // (comme un outil de peinture porte sa couleur) — plus besoin de repasser par l'inspecteur (#830).
  | { mode: 'wall'; paint: WallPaint; structure?: string }
  // Hauteur métrique d'une surface (porteuse : marchabilité/combat/chute, cf. `relief.ts`). On peint des
  // MÈTRES ; la traversée verticale s'auto-dérive du delta de hauteur (`surfaceLink`), sans escalier.
  | { mode: 'height'; metres: number }
  // Emplacement de siège : pose une SceneEntity portant un poste d'artillerie (`trappingId` = engin du
  // catalogue `armes-de-siege`). Le créneau (arc) et l'équipage s'éditent ensuite dans l'inspecteur.
  | { mode: 'emplacement'; trappingId: string }
  // Crénelage (#841 FU-H) : marque le pourtour peint comme portant un PARAPET crénelé (décoration de
  // rendu — `paintCrenellated`, orthogonal à `height`). `structure` = id de `structures.json` (le rendu en
  // dérive merlons/bandes/arase) ; `null` = gomme la marque.
  | { mode: 'crenellated'; structure: string | null }
  | { mode: 'erase' };

/** Catalogue des pièces d'artillerie posables (engins de siège, AA/MDG) — SOURCE UNIQUE de l'outil
 *  Palette et du sélecteur d'engin de l'inspecteur. Posable ⇔ l'engin a un art d'affût (`siegeRig`) : c'est
 *  ce rig qui rend l'affût inerte en éditeur comme en combat. L'invariant ne vit qu'ici (pas dupliqué). */
export const SIEGE_ENGINES = siegeEngines; // FOYER UNIQUE du filtre = `data/siegeEngines` (partagé avec le Codex)

export const ROOF_MATERIALS = [
  { id: 'tuile', label: 'Tuiles' },
  { id: 'chaume', label: 'Chaume' },
  { id: 'ardoise', label: 'Ardoise' },
] as const;

/** Sous-mode de l'outil MURS : cloison pleine, porte (arête franchissable), ou diagonale en travers. */
export type WallPaint = 'wall' | 'door' | 'diagBack' | 'diagFwd';

/** Calques masquables du canvas (masquer débloque le clic sur ce qu'il y a dessous). `effects` = zones
 *  MÉCANIQUES (piège/barrière) ; `zones` = zones DESCRIPTIVES (nom de pièce, `isDescriptiveZone`) —
 *  séparés (#826) : le même remplissage plein « piège » peint sur un nom de pièce rendait la carte
 *  illisible (1215 losanges orange mesurés sur La Diligence, plus que la carte entière). */
export type Layers = { triggers: boolean; spawns: boolean; roofs: boolean; entries: boolean; rest: boolean; effects: boolean; zones: boolean };
// Défauts LISIBLES (#826, arbitrage 2026-07-26) : les 2 calques qui peuvent NAPPER toute une bâtisse
// (mecanique + descriptif) partent ÉTEINTS — l'auteur les active à la demande, l'ouverture reste lisible.
export const DEFAULT_LAYERS: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, effects: false, zones: false };

/** Sélection unifiée — une seule chose sélectionnée à la fois, sur la carte comme dans les panneaux. */
export type Sel =
  | null
  | { type: 'entity' | 'trigger' | 'entry'; id: string }
  | { type: 'restZone'; idx: number }
  | { type: 'effectZone'; idx: number }
  | { type: 'architectureBody'; id: string }
  | { type: 'architectureStorey'; bodyId: string; id: string }
  | { type: 'architecturePart'; bodyId: string; storeyId: string; id: string }
  | { type: 'facadeSection'; bodyId: string; id: string }
  | { type: 'roofSection'; bodyId: string; id: string }
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

const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));

/** Deux sélections désignent-elles le même élément ? */
export function sameSel(a: Sel, b: Sel): boolean {
  if (!a || !b || a.type !== b.type) return a === b;
  if (a.type === 'restZone' && b.type === 'restZone') return a.idx === b.idx;
  if (a.type === 'effectZone' && b.type === 'effectZone') return a.idx === b.idx;
  if (a.type === 'wall' && b.type === 'wall') return a.x === b.x && a.y === b.y && a.side === b.side && a.z === b.z;
  if (a.type === 'architecturePart' && b.type === 'architecturePart') return a.bodyId === b.bodyId && a.storeyId === b.storeyId && a.id === b.id;
  if (a.type === 'architectureBody' && b.type === 'architectureBody') return a.id === b.id;
  if (a.type === 'architectureStorey' && b.type === 'architectureStorey') return a.bodyId === b.bodyId && a.id === b.id;
  if ((a.type === 'facadeSection' && b.type === 'facadeSection') || (a.type === 'roofSection' && b.type === 'roofSection')) return a.bodyId === b.bodyId && a.id === b.id;
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** Élément occupant la case p — priorité entité > entrée > trigger > zone repos > toit.
 *  Les calques masqués sont ignorés (cliquer « à travers »). Le calque `spawns` masque les entités
 *  de COMBAT cachées (embusqueurs) : on ne peut alors cliquer que les PNJ visibles. `activeBodyId` (mode
 *  Architecture, #841 FU-C) : un clic qui ne touche aucune feuille désigne le CONTENEUR actif — l'étage
 *  à `currentLayer` s'il existe, sinon le corps lui-même (seul moyen de sélectionner/supprimer un corps
 *  ou un étage encore sans partie/masse/façade au clic). Jamais hors mode architecture (undefined). */
export function hitAt(scene: Scene, p: Pt, layers: Layers, currentLayer = 0, activeBodyId?: string): Sel {
  // `entityAt` = prédicat UNIQUE position×couche (#835 FU-3) : une entité d'une AUTRE couche ne
  // masque plus le picking des couches d'annotation/toit sous-jacentes.
  const ent = entityAt(scene, p, currentLayer);
  if (ent && (layers.spawns || !ent.combat?.hiddenUntilCombat)) return { type: 'entity', id: ent.id };
  if (layers.entries)
    for (const [name, pos] of Object.entries(scene.entryPoints ?? {}))
      if (pos.x === p.x && pos.y === p.y && (pos.z ?? 0) === currentLayer) return { type: 'entry', id: name };
  if (layers.triggers) {
    const t = scene.triggers.find((t) => (t.rect.z ?? 0) === currentLayer && inRect(p, t.rect));
    if (t) return { type: 'trigger', id: t.id };
  }
  if (layers.rest) {
    const zi = (scene.restZones ?? []).findIndex((z) => (z.rect.z ?? 0) === currentLayer && inRect(p, z.rect));
    if (zi >= 0) return { type: 'restZone', idx: zi };
  }
  {
    // Descriptive → calque `zones`, mécanique (piège/barrière) → calque `effects` (#826) — jamais le
    // même calque, sinon masquer les pièges masquerait aussi les noms de pièce et réciproquement.
    const ei = (scene.effectZones ?? []).findIndex(
      (z) => (z.z ?? 0) === currentLayer && (isDescriptiveZone(z) ? layers.zones : layers.effects) && inRect(p, effectZoneRect(z.area)),
    );
    if (ei >= 0) return { type: 'effectZone', idx: ei };
  }
  if (layers.roofs) {
    for (const body of scene.architecture ?? []) {
      for (const storey of body.storeys) {
        if (storey.z !== currentLayer) continue;
        const part = storey.parts.find((candidate) => inRect(p, candidate.foot));
        if (part) return { type: 'architecturePart', bodyId: body.id, storeyId: storey.id, id: part.id };
      }
      const mass = body.masses.find((candidate) => candidate.z === currentLayer && candidate.footprint.some((part) => inRect(p, part)));
      if (mass) return { type: 'roofSection', bodyId: body.id, id: mass.id };
    }
  }
  if (activeBodyId) {
    const body = scene.architecture?.find((candidate) => candidate.id === activeBodyId);
    if (body) {
      const storey = body.storeys.find((candidate) => candidate.z === currentLayer);
      return storey ? { type: 'architectureStorey', bodyId: body.id, id: storey.id } : { type: 'architectureBody', id: body.id };
    }
  }
  return null;
}

/** Rect occupé par la sélection (poignée de resize, surlignage) — null si la sélection est ponctuelle. */
export function selRect(scene: Scene, sel: Sel): Rect | null {
  if (sel?.type === 'trigger') return scene.triggers.find((t) => t.id === sel.id)?.rect ?? null;
  if (sel?.type === 'restZone') return scene.restZones?.[sel.idx]?.rect ?? null;
  if (sel?.type === 'effectZone') { const z = scene.effectZones?.[sel.idx]; return z ? effectZoneRect(z.area) : null; }
  if (sel?.type === 'architecturePart') return scene.architecture?.find((body) => body.id === sel.bodyId)?.storeys.find((storey) => storey.id === sel.storeyId)?.parts.find((part) => part.id === sel.id)?.foot ?? null;
  if (sel?.type === 'roofSection') {
    const parts = scene.architecture?.find((body) => body.id === sel.bodyId)?.masses.find((mass) => mass.id === sel.id)?.footprint;
    if (!parts?.length) return null;
    const x = Math.min(...parts.map((part) => part.x));
    const y = Math.min(...parts.map((part) => part.y));
    const maxX = Math.max(...parts.map((part) => part.x + part.w));
    const maxY = Math.max(...parts.map((part) => part.y + part.h));
    return { x, y, w: maxX - x, h: maxY - y };
  }
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
    return { ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...pos, x: clamp(to.x, w), y: clamp(to.y, h) } } };
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
  if (sel?.type === 'architecturePart')
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        storeys: body.storeys.map((storey) => storey.id !== sel.storeyId ? storey : {
          ...storey,
          parts: storey.parts.map((part) => part.id === sel.id ? { ...part, foot: { ...part.foot, x: clamp(to.x, w - part.foot.w + 1), y: clamp(to.y, h - part.foot.h + 1) } } : part),
        }),
      }),
    };
  if (sel?.type === 'roofSection')
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        masses: body.masses.map((mass) => {
          if (mass.id !== sel.id || mass.footprint.length === 0) return mass;
          const minX = Math.min(...mass.footprint.map((part) => part.x));
          const minY = Math.min(...mass.footprint.map((part) => part.y));
          const maxX = Math.max(...mass.footprint.map((part) => part.x + part.w));
          const maxY = Math.max(...mass.footprint.map((part) => part.y + part.h));
          const dx = clamp(to.x, w - (maxX - minX) + 1) - minX;
          const dy = clamp(to.y, h - (maxY - minY) + 1) - minY;
          return { ...mass, footprint: mass.footprint.map((part) => ({ ...part, x: part.x + dx, y: part.y + dy })) };
        }),
      }),
    };
  return scene;
}

/** Redimensionne le rect de la sélection (trigger/zone repos) : coin NW fixe, coin SE = `to` (≥ NW, clampé). */
export function resizeSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const r = selRect(scene, sel);
  if (!r) return scene;
  const { w, h } = scene.dimensions;
  const next = rectFrom({ x: r.x, y: r.y }, { x: Math.max(r.x, clamp(to.x, w)), y: Math.max(r.y, clamp(to.y, h)) });
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.map((t) => (t.id === sel.id ? { ...t, rect: { ...next, ...(t.rect.z ? { z: t.rect.z } : {}) } } : t)) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === sel.idx ? { ...z, rect: { ...next, ...(z.rect.z ? { z: z.rect.z } : {}) } } : z)) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).map((z, i) => (i === sel.idx ? { ...z, area: { kind: 'rect', ...next } } : z)) };
  if (sel?.type === 'architecturePart') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
      ...body,
      storeys: body.storeys.map((storey) => storey.id !== sel.storeyId ? storey : { ...storey, parts: storey.parts.map((part) => part.id === sel.id ? { ...part, foot: next } : part) }),
    }),
  };
  if (sel?.type === 'roofSection') {
    const mass = scene.architecture?.find((body) => body.id === sel.bodyId)?.masses.find((candidate) => candidate.id === sel.id);
    // Section à UNE seule partie : le geste n'est pas ambigu, la poignée redimensionne cette partie.
    // Masse MULTI-parties : quelle partie redimensionner ? Ambigu — no-op explicite (#837), jamais une devinette.
    if (!mass || mass.footprint.length !== 1) return scene;
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        masses: body.masses.map((candidate) => candidate.id !== sel.id ? candidate : { ...candidate, footprint: [next] }),
      }),
    };
  }
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
  // #841 FU-C : les CONTENEURS (corps/étage) étaient inatteignables (audit #835 les avait
  // signalés « feuilles seules ») — le corps entier disparaît avec ses étages/parties/façades/masses ;
  // l'étage protège le DERNIER de son corps (mirroir de `removeLayer` protégeant la base de la scène).
  if (sel?.type === 'architectureBody') return { ...scene, architecture: scene.architecture?.filter((body) => body.id !== sel.id) };
  if (sel?.type === 'architectureStorey') return {
    ...scene,
    architecture: scene.architecture?.map((body) => {
      if (body.id !== sel.bodyId || body.storeys.length <= 1) return body;
      return { ...body, storeys: body.storeys.filter((storey) => storey.id !== sel.id) };
    }),
  };
  if (sel?.type === 'facadeSection') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id === sel.bodyId ? { ...body, facades: body.facades.filter((facade) => facade.id !== sel.id) } : body),
  };
  if (sel?.type === 'roofSection') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id === sel.bodyId ? { ...body, masses: body.masses.filter((mass) => mass.id !== sel.id) } : body),
  };
  if (sel?.type === 'architecturePart') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
      ...body,
      storeys: body.storeys.map((storey) => storey.id === sel.storeyId ? { ...storey, parts: storey.parts.filter((part) => part.id !== sel.id) } : storey),
    }),
  };
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

export function pickArchitectureEdge(scene: Scene, fx: number, fy: number, z: number): Extract<Sel, { type: 'facadeSection' }> | null {
  const px = Math.round(fx), py = Math.round(fy);
  const ox = fx - px, oy = fy - py;
  const side = nearestEdge(ox, oy);
  const dist: Record<Edge4, number> = { N: 0.5 + oy, S: 0.5 - oy, O: 0.5 + ox, E: 0.5 - ox };
  if (dist[side] > EDGE_PICK) return null;
  const edge = canonEdge(px, py, side);
  for (const body of scene.architecture ?? []) {
    const facade = body.facades.find((section) => section.z === z && section.edges.some((candidate) => candidate.x === edge.x && candidate.y === edge.y && candidate.side === edge.side && (candidate.z ?? section.z) === z));
    if (facade) return { type: 'facadeSection', bodyId: body.id, id: facade.id };
  }
  return null;
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
