/**
 * Instance runtime d'une Scène (#707) — le document `Scene` de `sceneRegistry` reste AUTHORED,
 * jamais muté ; ce qui change en jeu (entités retirées, portes/structures/tuiles) est un DELTA
 * capturé au départ d'une scène et réappliqué au clone frais lors du revisit.
 */
import type { Scene } from './scene';

/** Mutation runtime d'une scène (delta vs le document authored), persistée par `sceneId`. */
export interface SceneMutation {
  /** ids d'entités authored ABSENTES de la scène courante (retirées : décor consommé, PNJ tué). */
  removedEntityIds: string[];
  /** flags de l'OBJET Scene dont la valeur runtime diffère de l'authored (portes/structures/tuiles). */
  flags: Record<string, boolean>;
}

/** Dérive le delta de `current` vs `authored` (le document de `sceneRegistry`). Renvoie `undefined`
 *  si aucun changement (ne pas stocker une instance vide — garde `sceneInstances` propre). */
export function captureMutation(current: Scene, authored: Scene): SceneMutation | undefined {
  const authoredIds = new Set(authored.entities.map((e) => e.id));
  const currentIds = new Set(current.entities.map((e) => e.id));
  const removedEntityIds = [...authoredIds].filter((id) => !currentIds.has(id));
  const flags: Record<string, boolean> = {};
  for (const k of Object.keys(current.flags ?? {})) {
    if (current.flags[k] !== authored.flags?.[k]) flags[k] = current.flags[k];
  }
  if (!removedEntityIds.length && !Object.keys(flags).length) return undefined;
  return { removedEntityIds, flags };
}

/** Superpose une mutation sur une scène FRAÎCHEMENT clonée (filtre les entités retirées + fusionne
 *  les flags delta). PUR (nouvelle Scène). No-op si `mutation` absente. */
export function applyMutation(cloned: Scene, mutation: SceneMutation | undefined): Scene {
  if (!mutation) return cloned;
  const entities = cloned.entities.filter((e) => !mutation.removedEntityIds.includes(e.id));
  const flags = { ...cloned.flags, ...mutation.flags };
  return { ...cloned, entities, flags };
}
