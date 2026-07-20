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

/** `Combatant` : `id` + `kind` dans le trio de camps (`hero`/`enemy`/`npc`). Couvre AUSSI
 *  `ScheduledRespawn.caster` (#608 Lot 6, `{id,name,kind,pos}` — même trio de camps, aucun bearer dédié
 *  requis). */
function isCombatantLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.id === 'string'
    && (o.kind === 'hero' || o.kind === 'enemy' || o.kind === 'npc');
}

/** `CampaignVessel` (#608 Lot 6) : `vehicleId` + `morale` STRUCTURÉ (objet — distingue du `SceneOp`
 *  d'auteur `setVessel`/`adjustVessel` dont `morale?` reste un nombre plat, jamais renommé). */
function isVesselLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.vehicleId === 'string' && !!o.morale && typeof o.morale === 'object';
}

/** `CustomStatblock` (#608 Lot 6, `state/scene.ts`) : `char` STRUCTURÉ (objet de Caractéristiques) —
 *  aucun autre porteur de ce dépôt ne porte ce champ. */
function isStatblockLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && !!o.char && typeof o.char === 'object' && !Array.isArray(o.char);
}

/** `MedicNpc` (#608 Lot 6, `state/medicFlow.ts`) : `skill`+`intBonus` numériques + `acts` tableau —
 *  soigneur PNJ tarifé de l'infirmerie. */
function isMedicNpcLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.skill === 'number' && typeof o.intBonus === 'number' && Array.isArray(o.acts);
}

/** `MassBattleArmy` (#608 Lot 6, `state/massBattleFlow.ts`) : `combatant` STRUCTURÉ (le Combattant
 *  inanimé porteur de Puissance, `{label, combatant}`). */
function isArmyLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && !!o.combatant && typeof o.combatant === 'object';
}

/** `PendingVictory.defeated[]` (#608 Lot 6, `state/pendings.ts`) : `count` numérique, jamais d'`id` —
 *  regroupement PAR nom/identité bestiaire de l'écran de victoire. */
function isDefeatedLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.count === 'number' && !('id' in o);
}

/** `PendingTest.candidates[]` (#608 Lot 6, `state/pendings.ts`) : `id`+`value`+`target` numériques —
 *  candidat de Test hors combat (le joueur choisit qui lance). */
function isCandidateLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.id === 'string' && typeof o.value === 'number' && typeof o.target === 'number';
}

/** `CreatorDraft` (#608 Lot B, `ui/creator/draft.ts`) : `speciesId`+`careerId` STRING (concept
 *  exclusif au créateur — `RosterEntry.draft`, aucun autre porteur de ce dépôt ne co-porte ces deux
 *  champs). Sans ce bearer, le brouillon roulerait avec `label: undefined` — le nom du personnage
 *  disparaît silencieusement à la réouverture du créateur. */
function isDraftLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && typeof o.speciesId === 'string' && typeof o.careerId === 'string';
}

/** `pendingCampaign` (#608 Lot B, `state/store.ts`) : `scenes` TABLEAU + `startSceneId` STRING — le
 *  couple exact du champ persisté (`BuiltinCampaign`/`SavedProject`, qui portent la MÊME forme, sont
 *  déjà en `label` — aucune collision). */
function isPendingCampaignLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && Array.isArray(o.scenes) && typeof o.startSceneId === 'string';
}

/** `SceneOp` `setVessel`/`adjustVessel` (#608 Lot B, `state/scene.ts`) : discriminant `type` EXACT —
 *  aucun autre porteur de ce dépôt ne porte ce `type` (le `GameOp` équivalent utilise `op`, jamais
 *  `type`). La scène VIVANTE (mutée, `state.scene`) voyage dans la save — un dialogue/trigger encore
 *  non déclenché au moment de la sauvegarde y garde son effet d'auteur intact. */
function isSceneVesselOpLike(o: Record<string, unknown>): boolean {
  return !isGameOp(o) && (o.type === 'setVessel' || o.type === 'adjustVessel');
}

/** Réécrit récursivement `{ name, … }` → `{ label, … }` sur les seuls porteurs de libellé.
 *  IDEMPOTENT : un objet portant déjà `label` est laissé tel quel (un 2e passage est un no-op), et un
 *  objet portant les DEUX garde son `label` (la clé déjà migrée fait foi) — même contrat que
 *  `remapInstanceIdsDeep`. Applicable aussi bien à un doc de save qu'à une entrée de roster. */
export function remapNameToLabelDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapNameToLabelDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const bearer = isWeaponLike(o) || isItemLike(o) || isCombatantLike(o)
    || isVesselLike(o) || isStatblockLike(o) || isMedicNpcLike(o) || isArmyLike(o)
    || isDefeatedLike(o) || isCandidateLike(o) || isDraftLike(o) || isSceneVesselOpLike(o)
    || isPendingCampaignLike(o);
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

/** Ops `GameOp` dont le `name` porte un **id** d'État (`etats.json`) — `condition`/`removeCondition`
 *  (#608, ref #603). */
const GAMEOP_ID_OPS = new Set(['condition', 'removeCondition']);
/** Ops `GameOp` dont le `name` porte le **label** de l'arme créée — `grantWeapon`/`grantNaturalWeapon`
 *  (#608, ref #603). */
const GAMEOP_LABEL_OPS = new Set(['grantWeapon', 'grantNaturalWeapon']);

/** Réécrit récursivement le `name` d'un `GameOp` SÉRIALISÉ (`Combatant.activeEffects[].opsPerRound`/
 *  `.auraMods`/`recoveryPenalty`/`critTrigger.resist.onFail`…) — `id` pour `condition`/
 *  `removeCondition` (index d'État), `label` pour `grantWeapon`/`grantNaturalWeapon` (nom de l'arme
 *  invoquée). Bornée par la FORME de l'op (`op` + son appartenance à l'un des deux vocabulaires
 *  ci-dessus), jamais par un chemin — le SEUL cas où ce module vise un `name` d'op (`isGameOp` les
 *  PROTÉGEAIT jusqu'ici dans `remapNameToLabelDeep`). Idempotent (un op déjà migré n'a plus `name`). */
export function remapGameOpNameDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapGameOpNameDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  if (typeof o.op === 'string' && typeof o.name === 'string') {
    if (GAMEOP_ID_OPS.has(o.op)) {
      const { name, ...rest } = o;
      return Object.fromEntries(Object.entries({ ...rest, id: name }).map(([k, v]) => [k, remapGameOpNameDeep(v)]));
    }
    if (GAMEOP_LABEL_OPS.has(o.op)) {
      const { name, ...rest } = o;
      return Object.fromEntries(Object.entries({ ...rest, label: name }).map(([k, v]) => [k, remapGameOpNameDeep(v)]));
    }
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remapGameOpNameDeep(v)]));
}
