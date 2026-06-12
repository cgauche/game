/**
 * Allowlist des actions de store qu'un INVITÉ peut demander (intents) — périmètre : LE COMBAT
 * (arbitrage utilisateur V1 : « pour le moment on ne gère que la partie combat » ;
 * l'exploration est un miroir de l'hôte) + la COMPOSITION DU GROUPE (chaque joueur remplit
 * les emplacements que l'hôte lui a attribués) + les ACTIVITÉS D'INTERLUDE de SES héros
 * (audit POC→produit M7 : « Entre deux aventures » est par nature individuel — chaque joueur
 * mène les Activités de ses personnages ; ouvrir/CLORE l'interlude reste l'hôte). Tout le
 * reste (sauvegarde, voyage, marchand, éditeur…) est refusé par l'hôte.
 *
 * La liste est VOLONTAIREMENT explicite (pas de regex sur les noms d'actions) : ajouter une
 * action réseau = un choix conscient ici. Le test `intents.test.ts` vérifie que chaque nom
 * existe dans le store (anti-dérive de renommage).
 */
export const COMBAT_INTENTS: ReadonlySet<string> = new Set([
  // tour, ciblage, déplacement tactique
  'battleClickEntity', 'battleClickTile', 'battleEndTurn', 'cancelMove', 'battleSelectAction',
  // actions de la hotbar
  'battleAim', 'battleDefendTotal', 'battleDisengage', 'battleRun', 'battleTrample',
  'battleFrenzy', 'battleFocusSpell', 'battleHeal', 'battleReload', 'battleRecoverState',
  'battleStandUp', 'battlePickup', 'battleUseItem', 'battleSelectSpell', 'battleSelectAmmo',
  'battleSpendResolve', 'battleTogglePushback', 'battleSwitchLoadout', 'battleMount',
  'battleDismount', 'battleResolveIgnoreCrit', 'battleResolvePsychImmune',
  'spendResolveCondition',
  // attaque (modale différée)
  'attackSetLocation', 'attackSetWeapon', 'attackSetDualMode', 'attackSetIntoCrowd',
  'attackSetHeldGround', 'attackSetCritLocation', 'attackSetForcedRoll', 'attackRoll',
  'attackReroll', 'attackBonusSL', 'attackDarkPact', 'attackForceSuccess', 'attackConfirm',
  'attackCancel',
  // défense réactive
  'defenseSetMode', 'defenseSetParryWeapon', 'defenseRoll', 'defenseReroll', 'defenseBonusSL',
  'defenseDarkPact', 'defenseForceSuccess', 'defenseConfirm', 'defenseCancel',
  // incantation / prière
  'castRoll', 'castReroll', 'castBonusSL', 'castDarkPact', 'castSetCritChoice',
  'castAllocOvercast', 'castToggleExtraTarget', 'castPickTargets', 'castForceSuccess',
  'castCounterspell', 'castConfirm', 'castCancel',
  // désengagement
  'disengageConfirmA', 'disengageRoll', 'disengageReroll', 'disengageBonusSL',
  'disengageDarkPact', 'disengageForceSuccess', 'disengageConfirm', 'disengageFlee',
  'disengageCancel',
  // combat monté
  'mountTargetSelect', 'mountTargetCancel',
  // jets divers en combat (fabrique rollFlow) + témoin/critiques/Destin
  'trampleRoll', 'trampleReroll', 'trampleBonusSL', 'trampleDarkPact', 'trampleForceSuccess',
  'trampleConfirm', 'trampleCancel', 'runRoll', 'runReroll', 'runDarkPact', 'runForceSuccess',
  'runConfirm', 'runCancel', 'focusRoll', 'focusReroll', 'focusBonusSL', 'focusDarkPact',
  'focusForceSuccess', 'focusConfirm', 'focusCancel', 'psychRoll', 'psychReroll',
  'psychBonusSL', 'psychDarkPact', 'psychForceSuccess', 'psychConfirm', 'psychResolve',
  'frenzyRoll', 'frenzyReroll', 'frenzyDarkPact', 'frenzyForceSuccess', 'frenzyConfirm',
  'frenzyCancel', 'reloadRoll', 'reloadReroll', 'reloadBonusSL', 'reloadDarkPact',
  'reloadConfirm', 'reloadCancel', 'recoverRoll', 'recoverReroll', 'recoverBonusSL',
  'recoverDarkPact', 'recoverConfirm', 'recoverCancel', 'healRoll', 'healReroll',
  'healBonusSL', 'healDarkPact', 'healForceSuccess', 'healConfirm', 'healCancel',
  // Infirmerie (hors combat) : patients / actes / chirurgie + fermeture — l'hôte valide.
  'medicSelectPatient', 'medicAct', 'medicSetWound', 'medicSurgeryPass', 'medicEndSurgery', 'closeMedic',
  'encounterPsychRoll', 'encounterPsychReroll', 'encounterPsychDarkPact',
  'encounterPsychForceSuccess', 'encounterPsychConfirm', 'encounterPsychResolve',
  'dismissReveal', 'fateNegate', 'fateSurvive', 'fateAccept', 'fumbleRoll', 'fumbleConfirm',
  'deviationApply', 'cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip',
  'roundStartPromote', 'confirmRoundStart', 'roundStartReady', 'renounceResolve', 'corruptionRoll',
  'corruptionReroll', 'corruptionBonusSL', 'corruptionDarkPact', 'resolveCorruption',
  // (dismissVictory volontairement ABSENT : un invité passe par victoryReady — l'hôte ferme à l'unanimité.)
  'bladeTrapResolve', 'victoryReady', 'assignVictoryGear', 'raiseHand',
]);

/** Composition du groupe (écran d'équipe coop) : un invité remplit/retire SES emplacements.
 *  L'hôte injecte le siège autoritaire dans `partyAddHero` (netFlow) — jamais celui de l'invité. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set(['partyAddHero', 'partyRemoveHero']);

/** Activités d'interlude (LDB 23) : chacune vise un héros (1er argument ou pending/dépôt) —
 *  l'hôte valide la possession dans `intentAllowedFor`. `startInterlude`/`interludeEnd`
 *  restent HORS allowlist (l'hôte seul ouvre et clôt la période). */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set([
  'interludeRevenus', 'interludeCraftStart', 'interludeCraftRoll', 'interludeLearn',
  'interludeOrder', 'interludeBank', 'interludeWithdraw',
  'activityRoll', 'activityReroll', 'activityBonusSL', 'activityDarkPact',
  'activityConfirm', 'activityCancel',
]);

/** Allowlist complète côté hôte / interception côté invité. */
export const GUEST_INTENTS: ReadonlySet<string> = new Set([...COMBAT_INTENTS, ...PARTY_INTENTS, ...INTERLUDE_INTENTS]);

/** Args JSON-sûrs pour un intent : les handlers React passent parfois l'ÉVÉNEMENT en argument
 *  (`onClick={action}`) — circulaire, il ferait échouer la sérialisation et PERDRAIT l'intent
 *  (bug trouvé à l'audit coop : « Appliquer » d'invité muet). On TRONQUE la queue non
 *  sérialisable (l'événement est toujours en dernier) sans toucher aux vrais arguments. */
export function sanitizeIntentArgs(args: unknown[]): unknown[] {
  const jsonSafe = (v: unknown) => {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  };
  const out = [...args];
  while (out.length && (!jsonSafe(out[out.length - 1]) || typeof out[out.length - 1] === 'function')) out.pop();
  return out;
}
