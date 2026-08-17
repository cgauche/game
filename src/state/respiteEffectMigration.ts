/**
 * Migration #1318 E4/C4-δ1 — la dissipation au répit des pénalités d'Exposition (LDB 18 l.330/334)
 * n'est plus reconnue à l'identité de l'effet mais DÉCLARÉE sur lui : `ActiveEffect.expiresOnRespite`
 * (`engine/types.ts`), lu par `expireOnRespite` (`engine/exposure.ts`).
 *
 * Un effet écrit AVANT ce lot est persisté (`Combatant.activeEffects`) sans le drapeau : le répit ne
 * l'atteindrait plus JAMAIS et son −10 par caractéristique deviendrait perpétuel. D'où `MIGRATIONS[25]` :
 * les ids d'effet d'Exposition, qui ne vivent QUE dans les saves d'avant le lot, sont convertis une fois
 * pour toutes en drapeau. Ce module est le seul endroit du dépôt où ces deux ids restent nommés — un
 * FOSSILE borné à la lecture des vieilles saves, jamais un chemin de jeu.
 *
 * Même primitive que `remapPassiveKindDeep` (`passiveKindMigration.ts`) et `remapCharKeysDeep`
 * (`charKeyMigration.ts`) : réécriture RÉCURSIVE d'un document déjà cloné par `migrateDoc`, idempotente,
 * donc valable pour TOUT porteur d'`activeEffects` sérialisé (groupe, combat en vol, roster, PNJ de
 * scène) sans énumérer les emplacements.
 */

/** ids d'effet posés par `applyExposureFailure` avant le drapeau (`engine/exposure.ts`). */
const EXPOSURE_LEGACY_IDS = new Set(['exposition-froid', 'exposition-chaleur']);

/** Un nœud sérialisé est-il une pénalité d'Exposition PERMANENTE d'avant le drapeau ? */
function estExpositionPermanenteLegacy(n: Record<string, unknown>): boolean {
  if (typeof n.effectId !== 'string' || !EXPOSURE_LEGACY_IDS.has(n.effectId)) return false;
  const d = n.duration as { scale?: unknown } | undefined;
  return !!d && d.scale === 'permanent';
}

/** Pose `expiresOnRespite: true` sur tout effet d'Exposition permanent du document. Ne mute pas l'entrée. */
export function flagRespiteEffectsDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(flagRespiteEffectsDeep);
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    const out = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, flagRespiteEffectsDeep(v)]));
    return estExpositionPermanenteLegacy(n) ? { ...out, expiresOnRespite: true } : out;
  }
  return node;
}
