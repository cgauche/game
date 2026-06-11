/**
 * Arbitre PUR des modales de combat (R2) : quelle modale afficher MAINTENANT, par priorité
 * sémantique explicite. Déplacé hors de l'UI (module neutre) pour être partagé avec la
 * possession réseau (`netOwnership`) sans cycle d'imports. L'UI (`ui/ActiveModal`) le ré-exporte.
 */

/** Clés de modales de combat, de la PLUS prioritaire à la moins prioritaire. */
export type ModalKey =
  | 'fateSave' | 'fumble' | 'deviation' | 'bladeTrap' | 'renounce' | 'trample' | 'reveal' | 'defense'
  | 'psych' | 'encounterPsych' | 'disengage' | 'mountTarget' | 'frenzy'
  | 'approach' | 'run' | 'focus' | 'heal' | 'cast' | 'reload' | 'stateRecovery' | 'attack' | 'test' | 'corruption';

/** Sous-ensemble de l'état lu par l'arbitre (les `pending*` de combat). */
export interface ModalPendings {
  pendingFateSave?: unknown; pendingFumble?: unknown; pendingDeviation?: unknown; pendingBladeTrap?: unknown; pendingRenounce?: unknown;
  pendingCleave?: unknown; pendingDualStrike?: unknown; pendingTrample?: unknown; pendingReveals?: unknown[];
  pendingDefense?: unknown; pendingPsych?: unknown; pendingEncounterPsych?: unknown;
  pendingDisengage?: unknown; pendingMountTarget?: unknown;
  pendingFrenzy?: unknown; pendingApproach?: unknown; pendingRun?: unknown; pendingFocus?: unknown; pendingHeal?: unknown;
  pendingCast?: unknown; pendingReload?: unknown; pendingStateRecovery?: unknown;
  pendingAttack?: unknown; pendingTest?: unknown; pendingCorruption?: unknown;
}

/**
 * PURE : la modale de combat à afficher MAINTENANT (la 1ʳᵉ dont le `pending` est posé). `null` = aucune.
 * Ordre : sauvetage par Destin > Maladresse > Déviation critique > Piétinement > révélations
 * témoins > défense réactive > psychologie > manœuvres/actions du joueur > jet.
 * Frappe Mortelle / 2ᵉ frappe / Surincantation « +Cible » = ciblages CHAMP DE BATAILLE (pas de modale).
 */
export function pickActiveModalKey(s: ModalPendings): ModalKey | null {
  const castPicking = !!(s.pendingCast as { pickingTargets?: boolean } | null | undefined)?.pickingTargets;
  const order: [boolean, ModalKey][] = [
    [!!s.pendingFateSave, 'fateSave'],
    [!!s.pendingFumble, 'fumble'],
    [!!s.pendingDeviation, 'deviation'],
    [!!s.pendingBladeTrap, 'bladeTrap'],
    [!!s.pendingRenounce, 'renounce'],
    [!!s.pendingTrample, 'trample'],
    [(s.pendingReveals?.length ?? 0) > 0, 'reveal'],
    [!!s.pendingDefense, 'defense'],
    [!!s.pendingPsych, 'psych'],
    [!!s.pendingEncounterPsych, 'encounterPsych'],
    [!!s.pendingDisengage, 'disengage'],
    [!!s.pendingMountTarget, 'mountTarget'],
    [!!s.pendingFrenzy, 'frenzy'],
    [!!s.pendingApproach, 'approach'],
    [!!s.pendingRun, 'run'],
    [!!s.pendingFocus, 'focus'],
    [!!s.pendingHeal, 'heal'],
    [!!s.pendingCast && !castPicking, 'cast'],
    [!!s.pendingReload, 'reload'],
    [!!s.pendingStateRecovery, 'stateRecovery'],
    [!!s.pendingAttack, 'attack'],
    [!!s.pendingTest, 'test'],
    [!!s.pendingCorruption, 'corruption'],
  ];
  return order.find(([on]) => on)?.[1] ?? null;
}
