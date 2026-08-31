/**
 * Renommage `skillId` → `id` des `SkillInstance` sérialisées (#1548 L2) — `engine/types.ts`. Les
 * Compétences d'un Combattant portent désormais l'`id` STABLE nu, comme toute référence de la
 * grammaire (`data/index.ts`, porte `byId`) ; `TalentInstance` garde son `talentId`, hors périmètre.
 *
 * SEUL consommateur : le ROSTER (`roster.ts`) — repli idempotent de `rosterLoad` (liste nue, non
 * versionnée) et `ROSTER_MIGRATIONS[3]` de l'export `EXPORT_VERSION`. Même primitive que
 * `remapCharKeysDeep` (`charKeyMigration.ts`, #311) et `remapNameToLabelDeep`
 * (`instanceIdMigration.ts`, #604) : réécriture récursive d'un document déjà cloné.
 *
 * Sans ce remap, une Compétence d'avant le lot survit avec sa graphie morte et `skillBaseValue`
 * (`engine/skills.ts`) ne la retrouve plus : le héros perd ses acquis EN SILENCE (Résistance à 20
 * d'avancement retombe à sa caractéristique nue). Le roster ne se PURGE pas pour autant — arbitrage
 * 2026-08-17 borné aux saves, cf. l'en-tête de `migrateDoc.ts`.
 *
 * Le remap est borné par la FORME, pas par un chemin : le trio `skillId`+`characteristic`+`advances`
 * n'est porté que par `SkillInstance` (aucun `GameOp` ne porte `advances`). Tous les autres `skillId`
 * sont laissés INTACTS.
 */

/** `SkillInstance` : `skillId` STRING + `characteristic` (CharKey) + `advances` NUMÉRIQUE. */
function isSkillInstanceLike(o: Record<string, unknown>): boolean {
  return typeof o.skillId === 'string' && typeof o.characteristic === 'string' && typeof o.advances === 'number';
}

/** Réécrit récursivement `{ skillId, … }` → `{ id, … }` sur les seules `SkillInstance`.
 *  IDEMPOTENT : une instance déjà migrée ne porte plus de `skillId`, donc n'est plus un porteur (2e
 *  passage = no-op) ; une instance portant les DEUX garde son `id` (la clé déjà migrée fait foi). */
export function remapSkillIdDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapSkillIdDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  if (isSkillInstanceLike(o)) {
    const { skillId, ...rest } = o;
    return 'id' in o
      ? Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, remapSkillIdDeep(v)]))
      : Object.fromEntries(Object.entries({ id: skillId, ...rest }).map(([k, v]) => [k, remapSkillIdDeep(v)]));
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remapSkillIdDeep(v)]));
}
