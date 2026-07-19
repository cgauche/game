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

/** Renommage `name` → `label` des porteurs de LIBELLÉ sérialisés (#604) — `Combatant`, `ItemInstance`
 *  et `Weapon` (`engine/types.ts`). Ces trois champs sont un libellé d'AFFICHAGE : le vocabulaire du
 *  dépôt est désormais `label` partout (arbitrage 2026-07-19). Sans cette migration, un héros nommé,
 *  un objet et une arme se rechargeraient avec `label: undefined` — le nom du personnage DISPARAÎT
 *  silencieusement de la fiche, de l'inventaire et du journal.
 *
 *  Le remap est borné par la FORME, pas par un chemin : un `name` n'est réécrit que sur un objet
 *  reconnu comme l'un des trois porteurs. Tous les autres `name` d'une save sont laissés INTACTS —
 *  notamment ceux qui portent un **id** (`conditions[]`/`diseases[]` migrés en `id` par #598
 *  ci-dessous) et le champ `name` des `GameOp` authorés (`condition`, `grantNaturalWeapon`), qui est
 *  un id/libellé de DONNÉE hors du périmètre de ce renommage. */

/** Un `GameOp` sérialisé (clé `op`) n'est JAMAIS un porteur de libellé — garde-fou commun aux 3 formes. */
function isGameOp(o: Record<string, unknown>): boolean {
  return typeof o.op === 'string';
}

/** `Weapon` : discriminant `type` melee/ranged + `damage` STRUCTURÉ (`WeaponDamageSpec`, un objet). */
function isWeaponLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && (o.type === 'melee' || o.type === 'ranged')
    && !!o.damage && typeof o.damage === 'object';
}

/** `ItemInstance` : `uid` + `kind` (`ItemKind`) — l'`uid` est posé à la création de toute instance. */
function isItemLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.uid === 'string' && typeof o.kind === 'string';
}

/** `Combatant` : `id` + `kind` dans le trio de camps (`hero`/`enemy`/`npc`). */
function isCombatantLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.id === 'string'
    && (o.kind === 'hero' || o.kind === 'enemy' || o.kind === 'npc');
}

/** Réécrit récursivement `{ name, … }` → `{ label, … }` sur les seuls porteurs de libellé.
 *  IDEMPOTENT : un objet portant déjà `label` est laissé tel quel (un 2e passage est un no-op), et un
 *  objet portant les DEUX garde son `label` (la clé déjà migrée fait foi) — même contrat que
 *  `remapInstanceIdsDeep`. Applicable aussi bien à un doc de save qu'à une entrée de roster. */
export function remapNameToLabelDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapNameToLabelDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const bearer = isWeaponLike(o) || isItemLike(o) || isCombatantLike(o);
  if (bearer && typeof o.name === 'string' && !('label' in o)) {
    const { name, ...rest } = o;
    return Object.fromEntries(
      Object.entries({ label: name, ...rest }).map(([k, v]) => [k, remapNameToLabelDeep(v)]),
    );
  }
  if (bearer && o.label !== undefined && 'name' in o) {
    const { name: _drop, ...rest } = o;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, remapNameToLabelDeep(v)]));
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remapNameToLabelDeep(v)]));
}

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
