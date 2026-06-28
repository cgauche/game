/**
 * Brouillard de guerre — couche STORE : assemble les `Viewer`/sources de lumière depuis l'état (groupe
 * en exploration, alliés vivants en combat) et délègue au moteur PUR `vision.ts`. Accumule l'ensemble
 * EXPLORÉ par scène (`explored[sceneId]`, persistant). `visible` est DÉRIVÉ au bord rendu (memo
 * d'IsoStage via `computeStateVisible`) — pas stocké, donc rien à invalider pendant la marche.
 */
import { Scene } from './scene';
import { Pt } from './path';
import { computeVisible, computeLightField, ambientScalar, baseSightTiles, darkSightTiles, mapLights, combatantLights } from './vision';
import { smokeOf } from './combatGeometry';
import { isOutOfAction } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { Get, Set as SetFn } from './flowTypes';

/** Tranche d'état nécessaire au calcul de visibilité (passée par IsoStage → deps de memo explicites). */
export interface VisionInput {
  scene: Scene | null;
  battle: { combatants: Combatant[]; zones?: unknown } | null;
  party?: Combatant[];
  partyPos: Pt;
  gameTime: number;
  lightLevel: number | null;
}

/** Champ de lumière + fumée de la scène (SOURCE UNIQUE pour la vue du groupe ET la perception ennemie) :
 *  ambiant + lumières posées (carte) + lumières portées (les deux camps en combat, le groupe en
 *  exploration — une torche révèle son porteur). */
function sceneLightField(s: VisionInput): { light: ReturnType<typeof computeLightField>; smoke: Pt[] } {
  const scene = s.scene!;
  const ambient = ambientScalar(scene, s.gameTime, s.lightLevel);
  const sources = mapLights(scene);
  let smoke: Pt[] = [];
  if (s.battle) {
    if (s.battle.zones) smoke = smokeOf(s.battle as never);
    for (const c of s.battle.combatants) sources.push(...combatantLights(c));
  } else {
    // Combattant SYNTHÉTIQUE du groupe : items + armes tenues + effets actifs agrégés → `combatantLights`
    // applique LE MÊME gate de port qu'en combat (un objet rangé n'éclaire pas ; une lanterne portée /
    // un sort Lumière oui). Le gate vit en UN seul endroit (combatantLights), pas redupliqué ici.
    const party = s.party ?? [];
    sources.push(...combatantLights({
      pos: s.partyPos,
      items: party.flatMap((p) => p.items ?? []),
      weapons: party.flatMap((p) => p.weapons ?? []),
      activeEffects: party.flatMap((p) => p.activeEffects ?? []),
    }));
  }
  return { light: computeLightField(scene, ambient, sources, smoke), smoke };
}

/** Ensemble des cases (`"x,y,z"`) actuellement visibles par le groupe : union des alliés vivants en
 *  combat, sinon depuis la position du groupe en exploration. PUR (dérivé de l'état). */
export function computeStateVisible(s: VisionInput): Set<string> {
  const scene = s.scene;
  if (!scene) return new Set();
  const baseR = baseSightTiles(scene, s.gameTime);
  const { light, smoke } = sceneLightField(s);
  const viewers = [];
  if (s.battle) {
    for (const c of s.battle.combatants) {
      if (c.kind !== 'hero' || isOutOfAction(c) || !c.pos) continue;
      viewers.push({ pos: c.pos, radiusTiles: baseR, darkTiles: darkSightTiles(c) });
    }
  } else {
    const dark = (s.party ?? []).reduce((m, c) => Math.max(m, darkSightTiles(c)), 0);
    viewers.push({ pos: s.partyPos, z: s.partyPos.z, radiusTiles: baseR, darkTiles: dark });
  }
  return computeVisible(scene, viewers, light, smoke);
}

/** Cases qu'un combattant donné PERÇOIT (Ligne de Vue + lumière, vision nocturne incluse), avec le MÊME
 *  champ de lumière que le groupe → vision réciproque de l'IA. PUR. */
export function perceivedTiles(s: VisionInput, viewer: Combatant): Set<string> {
  if (!s.scene || !viewer.pos) return new Set();
  const { light, smoke } = sceneLightField(s);
  return computeVisible(
    s.scene,
    [{ pos: viewer.pos, radiusTiles: baseSightTiles(s.scene, s.gameTime), darkTiles: darkSightTiles(viewer) }],
    light,
    smoke,
  );
}

/** Fond les cases `keys` dans l'ensemble exploré de la scène courante (accumulation persistante, ne
 *  perd jamais l'ancien). No-op si rien de neuf (évite une boucle de rendu). */
export function recordExplored(get: Get, set: SetFn, keys: string[]): void {
  const { scene, explored } = get();
  if (!scene) return;
  const prev = explored[scene.id];
  const merged = prev ? new Set(prev) : new Set<string>();
  let changed = false;
  for (const k of keys) if (!merged.has(k)) { merged.add(k); changed = true; }
  if (!changed) return;
  set({ explored: { ...explored, [scene.id]: [...merged] } });
}
