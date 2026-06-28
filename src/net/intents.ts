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
  'attackSetHeldGround', 'attackSetWithhold', 'attackSetGrapple', 'attackSetCritLocation', 'attackSetForcedRoll', 'attackRoll',
  'attackReroll', 'attackBonusSL', 'attackDarkPact', 'attackForceSuccess', 'attackConfirm',
  'attackCancel',
  // défense réactive
  'defenseSetMode', 'defenseSetParryWeapon', 'defenseRoll', 'defenseReroll', 'defenseBonusSL',
  'defenseDarkPact', 'defenseForceSuccess', 'defenseSetForcedRoll', 'defenseConfirm', 'defenseCancel',
  // incantation / prière
  'castRoll', 'castReroll', 'castBonusSL', 'castDarkPact', 'castSetCritChoice', 'castSetForcedRoll',
  'castAllocOvercast', 'castToggleExtraTarget', 'castPickTargets', 'castPlaceZone', 'castForceSuccess',
  'castConfirm', 'castCancel',
  // Contre-sort à plusieurs (réaction au Sort ennemi, flux multi) + Test Étendu séquentiel
  'counterspellRoll', 'counterspellReroll', 'counterspellBonusSL', 'counterspellDarkPact',
  'counterspellForceSuccess', 'counterspellSetForcedRoll', 'counterspellConfirm', 'counterspellCancel',
  'extendedTestRoll', 'extendedTestReroll', 'extendedTestBonusSL', 'extendedTestDarkPact',
  'extendedTestForceSuccess', 'extendedTestSetForcedRoll', 'extendedTestNext', 'extendedTestCancel',
  'forceDoorRoll', 'forceDoorReroll', 'forceDoorBonusSL', 'forceDoorDarkPact',
  'forceDoorForceSuccess', 'forceDoorSetForcedRoll', 'forceDoorConfirm', 'forceDoorCancel',
  // Cascade séquentielle (jets de nuit / voyage influençables)
  'cascadeRoll', 'cascadeReroll', 'cascadeBonusSL', 'cascadeDarkPact',
  'cascadeForceSuccess', 'cascadeSetForcedRoll', 'cascadeNext', 'cascadeResolveAll', 'cascadeFinish', 'cascadeChoose', 'cascadeDetermine',
  // désengagement
  'disengageConfirmA', 'disengageRoll', 'disengageReroll', 'disengageBonusSL',
  'disengageDarkPact', 'disengageForceSuccess', 'disengageConfirm', 'disengageFlee',
  'disengageCancel',
  // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps + choix du vainqueur
  'battleAuContact', 'auContactRoll', 'auContactReroll', 'auContactBonusSL',
  'auContactDarkPact', 'auContactForceSuccess', 'auContactConfirm', 'auContactChoose',
  'auContactCancel',
  // Empoignade (LDB 14 l.161) : Test opposé de Force OU « Briser » + choix du vainqueur
  'battleGrapple', 'grappleBreak', 'grappleRoll', 'grappleReroll', 'grappleBonusSL',
  'grappleDarkPact', 'grappleForceSuccess', 'grappleConfirm', 'grappleChoose', 'grappleCancel',
  // Fuir : Test de Calme du fuyard (flux `flee`, calqué sur `approach`)
  'fleeRoll', 'fleeReroll', 'fleeBonusSL', 'fleeDarkPact', 'fleeForceSuccess', 'fleeConfirm',
  // combat monté
  'mountTargetSelect', 'mountTargetCancel',
  // jets divers en combat (fabrique rollFlow) + témoin/critiques/Destin
  'trampleRoll', 'trampleReroll', 'trampleBonusSL', 'trampleDarkPact', 'trampleForceSuccess',
  'trampleSetForcedRoll', 'trampleConfirm', 'trampleCancel',
  'maneuverRoll', 'maneuverReroll', 'maneuverBonusSL', 'maneuverDarkPact', 'maneuverForceSuccess',
  'maneuverSetForcedRoll', 'maneuverConfirm', 'maneuverCancel', 'maneuverSetAvantage',
  'runRoll', 'runReroll', 'runDarkPact', 'runForceSuccess',
  'runConfirm', 'runCancel', 'focusRoll', 'focusReroll', 'focusBonusSL', 'focusDarkPact',
  'focusForceSuccess', 'focusConfirm', 'focusCancel',
  // Bénédiction de Protection : Test de FM différant la déclaration d'attaque (cible bénie)
  'wardRoll', 'wardReroll', 'wardDarkPact', 'wardForceSuccess', 'wardConfirm', 'wardCancel',
  // (Psychologie de COMBAT : PLUS d'intents `psych*` — cascade de Round, via les intents `cascade*` ci-dessus.)
  'frenzyRoll', 'frenzyReroll', 'frenzyDarkPact', 'frenzyForceSuccess', 'frenzyConfirm',
  'frenzyCancel', 'reloadRoll', 'reloadReroll', 'reloadBonusSL', 'reloadDarkPact',
  'reloadConfirm', 'reloadCancel', 'recoverRoll', 'recoverReroll', 'recoverBonusSL',
  'recoverDarkPact', 'recoverConfirm', 'recoverCancel', 'healRoll', 'healReroll',
  'healBonusSL', 'healDarkPact', 'healForceSuccess', 'healConfirm', 'healCancel',
  // Infirmerie (hors combat) : patients / actes / chirurgie + fermeture — l'hôte valide.
  // Chirurgie : openSurgeryPass POSE la passe, les verbes surgery* l'influencent (fabrique rollFlow),
  // surgeryNext applique, surgeryCancel annule (remplacent l'ancien medicSurgeryPass/medicEndSurgery inline).
  'medicSelectPatient', 'medicAct', 'medicSetWound', 'closeMedic',
  'openSurgeryPass', 'surgeryRoll', 'surgeryReroll', 'surgeryBonusSL', 'surgeryDarkPact',
  'surgeryForceSuccess', 'surgeryNext', 'surgeryCancel',
  // Repos (nuit) : chacun règle SES héros (restSet vise un héros, 1er argument) + ready-check.
  'restSet', 'restReady',
  // (Psychologie à la rencontre : passe désormais par les intents `cascade*` ci-dessus.)
  'dismissReveal', 'fateNegate', 'fateSurvive', 'fateAccept', 'fumbleRoll', 'fumbleConfirm',
  'cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip',
  'roundStartPromote', 'confirmRoundStart', 'roundStartReady', 'renounceResolve', 'corruptionRoll',
  'corruptionReroll', 'corruptionBonusSL', 'corruptionDarkPact', 'resolveCorruption',
  // (dismissVictory volontairement ABSENT : un invité passe par victoryReady — l'hôte ferme à l'unanimité.)
  'victoryReady', 'assignVictoryGear', 'raiseHand',
]);

/** Composition du groupe (écran d'équipe coop) : un invité remplit/retire SES emplacements.
 *  L'hôte injecte le siège autoritaire dans `partyAddHero` (netFlow) — jamais celui de l'invité. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set(['partyAddHero', 'partyRemoveHero', 'partyReplaceHero']);

/** Activités d'interlude (LDB 23) : chacune vise un héros (1er argument ou pending/dépôt) —
 *  l'hôte valide la possession dans `intentAllowedFor`. `startInterlude`/`interludeEnd`
 *  restent HORS allowlist (l'hôte seul ouvre et clôt la période). */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set([
  'interludeRevenus', 'interludeCraftStart', 'interludeCraftRoll', 'interludeLearn',
  'interludeOrder', 'interludeBank', 'interludeWithdraw', 'interludeIdentify',
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
