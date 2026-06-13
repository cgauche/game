/**
 * Migration des scènes (chargement) — PUR & testé.
 *
 * Dissout les anciens kinds (`objet` → `prop`, `pnj`/`ennemi` → `personnage`) et absorbe les
 * anciens canaux de butin (`loot: string[]` + `search: Effect[]`) dans le canal unique
 * `interact: { effects, consume }`. Appliqué à TOUTE scène entrant dans le runtime
 * (startScene / transitionTo), pour que les scènes anciennes (et les projets sauvés par
 * l'éditeur) restent jouables sans réécriture.
 */
import type { Scene, SceneEntity, EntityKind, Effect, EncounterDef, EncounterMember } from './scene';

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
    ...((loot ?? []) as string[]).map((trapping: string): Effect => ({ type: 'giveTrapping', trapping })),
  ];
  if (effects.length) out.interact = { effects, consume: !!loot && !search };
  return out;
}

/** Normalise les rencontres : tout ennemi LEGACY inline (`enemies[]`) devient une `SceneEntity`
 *  cachée (kind 'personnage', `combat.hiddenUntilCombat:true`) injectée dans `scene.entities`, plus
 *  un `EncounterMember` qui la référence. Le profil/apparence/arme/traits/sorts migrent sur l'entité.
 *  IDEMPOTENT : une rencontre déjà en `members` passe inchangée. PUR (ne mute pas l'entrée). */
export function migrateEncounters(scene: Scene): Scene {
  const encounters = scene.encounters ?? [];
  if (!encounters.some((e) => e.enemies && !e.members)) return scene; // rien de legacy → no-op
  const injected: SceneEntity[] = [];
  const used = new Set((scene.entities ?? []).map((e) => e.id));
  const out: EncounterDef[] = encounters.map((enc) => {
    if (enc.members || !enc.enemies) return enc; // déjà normalisée (ou vide)
    const ids = enc.enemies.map((_, i) => {
      let id = `enemy-${enc.id}-${i}`;
      while (used.has(id)) id += '_'; // unicité défensive (préfixe réservé, collision improbable)
      used.add(id);
      return id;
    });
    const members: EncounterMember[] = enc.enemies.map((e, i) => {
      const ent: SceneEntity = { id: ids[i], kind: 'personnage', pos: { ...e.pos } };
      if (e.ref) ent.ref = e.ref;
      if (e.statblock) ent.statblock = e.statblock;
      if (e.appearance) ent.appearance = e.appearance;
      if (e.weapon) ent.weapon = e.weapon;
      const combat: NonNullable<SceneEntity['combat']> = { hiddenUntilCombat: true };
      if (e.optionals) combat.optionals = e.optionals;
      if (e.spells) combat.spells = e.spells;
      if (e.randomChars) combat.randomChars = e.randomChars;
      ent.combat = combat;
      injected.push(ent);
      const m: EncounterMember = { entityId: ids[i] };
      if (e.side) m.side = e.side;
      if (e.mount) m.mount = e.mount;
      if (e.rides != null && ids[e.rides]) m.ridesEntityId = ids[e.rides];
      return m;
    });
    const { enemies: _legacy, ...rest } = enc; // on retire la forme legacy après conversion
    return { ...rest, members };
  });
  return { ...scene, entities: [...(scene.entities ?? []), ...injected], encounters: out };
}

/** Migre toutes les entités d'une scène PUIS normalise les rencontres. PUR (ne mute pas l'entrée). */
export function migrateScene(scene: Scene): Scene {
  const withEntities = { ...scene, entities: (scene.entities ?? []).map(migrateSceneEntity) };
  return migrateEncounters(withEntities);
}
