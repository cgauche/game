/**
 * Allowlist des actions de store qu'un INVITÉ peut demander (intents) — périmètre V1 : LE
 * COMBAT uniquement (arbitrage utilisateur : « pour le moment on ne gère que la partie
 * combat » ; l'exploration est un miroir de l'hôte). Tout le reste (sauvegarde, voyage,
 * marchand, interlude, éditeur…) est refusé par l'hôte.
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
  'healSetTarget', 'encounterPsychRoll', 'encounterPsychReroll', 'encounterPsychDarkPact',
  'encounterPsychForceSuccess', 'encounterPsychConfirm', 'encounterPsychResolve',
  'dismissReveal', 'fateNegate', 'fateSurvive', 'fateAccept', 'fumbleRoll', 'fumbleConfirm',
  'deviationApply', 'cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip',
  'roundStartPromote', 'confirmRoundStart', 'roundStartReady', 'renounceResolve', 'corruptionRoll',
  'corruptionReroll', 'corruptionBonusSL', 'corruptionDarkPact', 'resolveCorruption',
  'bladeTrapResolve', 'dismissVictory',
]);
