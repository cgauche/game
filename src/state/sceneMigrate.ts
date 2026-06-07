/**
 * Migration des scènes (chargement) — PUR & testé.
 *
 * Dissout les anciens kinds (`objet` → `prop`, `pnj`/`ennemi` → `personnage`) et absorbe les
 * anciens canaux de butin (`loot: string[]` + `search: Effect[]`) dans le canal unique
 * `interact: { effects, consume }`. Appliqué à TOUTE scène entrant dans le runtime
 * (startScene / transitionTo), pour que les scènes anciennes (et les projets sauvés par
 * l'éditeur) restent jouables sans réécriture.
 */
import type { Scene, SceneEntity, EntityKind, Effect } from './scene';

/** Normalise le kind (compat) + `objet` → `prop`. PUR. */
export function migrateEntityKind(k: string): EntityKind {
  if (k === 'pnj' || k === 'ennemi') return 'personnage';
  if (k === 'objet') return 'prop';
  if (k === 'heroStart' || k === 'personnage' || k === 'prop') return k;
  return 'personnage';
}

/** Migre une entité (scène ancienne) : kind + ancien loot/search → `interact`. PUR.
 *  Fidèle à l'ancien comportement : `loot` disparaissait quand pris (consume) ; `search` restait
 *  (fouillé une fois). Si l'entité avait les deux, on reste (search prime → consume false). */
export function migrateSceneEntity(raw: any): SceneEntity {
  const { loot, search, kind, ...rest } = raw;
  const out: SceneEntity = { ...rest, kind: migrateEntityKind(kind) };
  const effects: Effect[] = [
    ...((search ?? []) as Effect[]),
    ...((loot ?? []) as string[]).map((item: string): Effect => ({ type: 'giveItem', item })),
  ];
  if (effects.length) out.interact = { effects, consume: !!loot && !search };
  return out;
}

/** Migre toutes les entités d'une scène. PUR (ne mute pas l'entrée). */
export function migrateScene(scene: Scene): Scene {
  return { ...scene, entities: (scene.entities ?? []).map(migrateSceneEntity) };
}
