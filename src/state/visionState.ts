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

/** Ensemble des cases (`"x,y,z"`) actuellement visibles par le groupe : union des alliés vivants en
 *  combat, sinon depuis la position du groupe en exploration. PUR (dérivé de l'état). */
export function computeStateVisible(s: VisionInput): Set<string> {
  const scene = s.scene;
  if (!scene) return new Set();
  const ambient = ambientScalar(scene, s.gameTime, s.lightLevel);
  const baseR = baseSightTiles(scene, s.gameTime);
  const viewers = [];
  const sources = mapLights(scene); // lumières POSÉES sur la carte (brasero, feu de camp…)
  let smoke: Pt[] = [];
  if (s.battle) {
    if (s.battle.zones) smoke = smokeOf(s.battle as never);
    for (const c of s.battle.combatants) {
      sources.push(...combatantLights(c)); // LES DEUX camps éclairent (une torche ennemie se révèle)
      if (c.kind !== 'hero' || isOutOfAction(c) || !c.pos) continue;
      viewers.push({ pos: c.pos, radiusTiles: baseR, darkTiles: darkSightTiles(c) });
    }
  } else {
    const party = s.party ?? [];
    const dark = party.reduce((m, c) => Math.max(m, darkSightTiles(c)), 0);
    viewers.push({ pos: s.partyPos, z: s.partyPos.z, radiusTiles: baseR, darkTiles: dark });
    // exploration : objets portés par le groupe, émis depuis la position du groupe
    sources.push(...combatantLights({ pos: s.partyPos, items: party.flatMap((p) => p.items ?? []) }));
  }
  const light = computeLightField(scene, ambient, sources, smoke);
  return computeVisible(scene, viewers, light, smoke);
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
