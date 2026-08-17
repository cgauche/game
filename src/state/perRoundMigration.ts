/**
 * Migration #1318 E4/C-γ — l'escalade PÉRIODIQUE d'une plaie n'est plus un booléen NOMMANT sa séquelle
 * (`Trauma.fingerLossPerRound`) mais un axe PARAMÉTRÉ qui la DÉCLARE (`Trauma.perRound`, `engine/types.ts` :
 * `{versTraumaId, unites?}`), joué par `tickTraumaEscalation` (`engine/trauma.ts`).
 *
 * Ce champ est PERSISTÉ (`Trauma`, « Persisté entre combats ») : une save prise pendant un combat où une
 * « Main ouverte » (LDB 18 / AA 07 l.127 « Pour chaque Round au cours duquel vous ne recevez pas d'Aide
 * Médicale, vous perdez un autre doigt ») s'aggrave en porte l'ancienne forme. Sans remise en
 * correspondance, le nouveau tick ne voit plus rien : l'escalade s'ARRÊTE en silence au rechargement —
 * la main mutilée cesse de perdre ses doigts, et le drapeau `awaitingMedicalAid` reste seul, orphelin.
 * D'où `MIGRATIONS[26]` : le booléen devient l'escalade déclarée équivalente, une fois pour toutes.
 *
 * Valeur posée = celle que le moteur d'avant ce lot appliquait, mesurée à son site (`tickFingerLossEscalation`
 * instanciait `doigt-ampute` avec `count = 1` par Round) : `{versTraumaId: 'doigt-ampute', unites: 1}`.
 * `false`/absent → la clé disparaît sans rien poser (aucune escalade n'était en cours).
 *
 * AUCUN autre champ n'est touché — `awaitingMedicalAid` (le gate de soin), `amputateAfterDays` et
 * `amputateSequel` (l'escalade à ÉCHÉANCE, dont les noms PERSISTÉS n'ont pas changé : seule leur
 * DÉCLARATION côté table de Critiques est passée à `escalation.apresDelai`) restent tels quels.
 *
 * Même primitive que `remapPassiveKindDeep` (`passiveKindMigration.ts`) et `flagRespiteEffectsDeep`
 * (`respiteEffectMigration.ts`) : réécriture RÉCURSIVE d'un document déjà cloné par `migrateDoc`,
 * idempotente — donc valable pour TOUT porteur de `traumas` sérialisé (`party[]`, les combattants d'un
 * combat en vol `battle.combatants[]`, roster, PNJ de scène) sans énumérer les emplacements.
 */

/** Séquelle que l'escalade « Main ouverte » ajoutait à chaque Round AVANT le lot (`traumas.json`). */
const LEGACY_PER_ROUND = { versTraumaId: 'doigt-ampute', unites: 1 };

/** Remplace tout `fingerLossPerRound` par l'escalade `perRound` équivalente. Ne mute pas l'entrée. */
export function remapPerRoundDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapPerRoundDeep);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    let legacy = false;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'fingerLossPerRound') { legacy = v === true; continue; } // la clé ancienne ne survit pas
      out[k] = remapPerRoundDeep(v);
    }
    if (legacy && out.perRound === undefined) out.perRound = { ...LEGACY_PER_ROUND };
    return out;
  }
  return node;
}
