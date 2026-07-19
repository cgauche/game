/**
 * Migration de RENOMMAGE `name` → `id` des INSTANCES portées par un `Combatant` (#598) —
 * `ConditionInstance` (`conditions[]`) et `Disease` (`diseases[]`) — portée sur l'état RUNTIME
 * sérialisé (save `SAVE_VERSION` MIGRATIONS[7], export roster). Même primitive que
 * `remapCharKeysDeep` (`charKeyMigration.ts`, #311) : réécriture récursive d'un document déjà cloné
 * par `migrateDoc`.
 *
 * Ces deux champs portaient un **id** de catalogue (slug d'`etats.json` / de `maladies.json`) sous un
 * nom de libellé, à rebours de la doctrine « la logique est keyée par id, `label`/`name` = affichage ».
 * La VALEUR est inchangée : seule la clé est renommée — aucune remise en correspondance à faire.
 */

/** Champs dont la valeur est un tableau d'instances keyées par id (`Combatant.conditions`/`.diseases`).
 *  Recensés par NOM de champ, comme `charKeyMigration` — un `name` rencontré HORS de ces tableaux est
 *  un vrai libellé (`Combatant.name`, `ItemInstance.name`, `Weapon.name`) et n'est jamais touché. */
const INSTANCE_ARRAY_FIELDS = new Set(['conditions', 'diseases']);

/** Réécrit récursivement `{ name, … }` → `{ id, … }` pour tout élément des tableaux recensés.
 *  Idempotent : un élément portant déjà `id` (doc migré) est laissé tel quel — un second passage est
 *  donc un no-op, et un élément portant les DEUX garde son `id` (la clé déjà migrée fait foi). */
export function remapInstanceIdsDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapInstanceIdsDeep);
  if (node && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>).map(([k, v]) => {
      if (INSTANCE_ARRAY_FIELDS.has(k) && Array.isArray(v)) {
        return [k, v.map((el) => {
          if (!el || typeof el !== 'object' || Array.isArray(el)) return remapInstanceIdsDeep(el);
          const { name, ...rest } = el as Record<string, unknown>;
          if (name === undefined) return remapInstanceIdsDeep(el);
          const migrated = 'id' in rest ? rest : { id: name, ...rest };
          return remapInstanceIdsDeep(migrated);
        })];
      }
      return [k, remapInstanceIdsDeep(v)];
    });
    return Object.fromEntries(entries);
  }
  return node;
}
