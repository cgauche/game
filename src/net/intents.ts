/**
 * Allowlist des actions de store qu'un INVITÉ peut demander (intents) — périmètre : LE COMBAT
 * (portée V1 : seule la partie combat est jouée côté invité ;
 * l'exploration est un miroir de l'hôte) + la COMPOSITION DU GROUPE (chaque joueur remplit
 * les emplacements que l'hôte lui a attribués) + les ACTIVITÉS D'INTERLUDE de SES héros
 * (audit POC→produit M7 : « Entre deux aventures » est par nature individuel — chaque joueur
 * mène les Activités de ses personnages ; ouvrir/CLORE l'interlude reste l'hôte). Tout le
 * reste (sauvegarde, voyage, marchand, éditeur…) est refusé par l'hôte.
 *
 * `COMBAT_INTENTS` a DEUX parts :
 *  - les délégués `<prefix><Verbe>` des flux de jet, DÉRIVÉS de `FLOW_VERBS` (`coopFlowIntents`) :
 *    le marqueur `coop: true` de la table EST la décision d'exposition, un flux coop ajouté n'a
 *    aucune ligne à écrire ici (`resist` reste hors surface invité) ;
 *  - `MANUAL_COMBAT_INTENTS` ci-dessous : les actions de store qui ne sont PAS des verbes de flux
 *    (gestes de tour/hotbar, paramètres pré-jet, `xConfirm`/`xCancel` métier…) — chacune est un
 *    choix conscient. Le test `rollFlowWiring.test.ts` échoue si un nom DÉRIVABLE y est recopié ;
 *    `intents.test.ts` échoue si un nom (dérivé ou manuel) n'existe pas dans le store.
 */
import { coopFlowIntents } from '../state/flowVerbs';

/** Intents qui ne sont PAS des verbes de flux (`<prefix><Verbe>` de `FLOW_VERBS`) — non dérivables. */
export const MANUAL_COMBAT_INTENTS: readonly string[] = [
  // tour, ciblage, déplacement tactique
  'battleClickEntity', 'battleClickTile', 'battleEndTurn', 'cancelMove', 'battleSelectAction',
  // actions de la hotbar
  'battleAim', 'battleDefendTotal', 'battleDisengage', 'battleRun', 'battleTrample',
  'battleFrenzy', 'battleFocusSpell', 'battleHeal', 'battleReload', 'battleRecoverState',
  'battleStandUp', 'battlePickup', 'battleUseItem', 'battleSelectSpell', 'battleSelectAmmo',
  'battleSpendResolve', 'battleTogglePushback', 'battleSwitchLoadout', 'battleMount',
  'battleDismount', 'battleResolveIgnoreCrit', 'battleResolvePsychImmune',
  'spendResolveCondition',
  // attaque : paramètres de la modale différée + jet/appliquer propres au flux d'attaque
  'attackSetLocation', 'attackSetWeapon', 'attackSetDualMode', 'attackSetIntoCrowd',
  'attackSetHeldGround', 'attackSetWithhold', 'attackSetHarpoonRopeCut', 'attackSetGrapple',
  'attackSetCritLocation', 'attackRoll', 'attackConfirm',
  // défense réactive : choix de mode/arme + appliquer
  'defenseSetMode', 'defenseSetParryWeapon', 'defenseConfirm',
  // incantation / prière : options d'incantation + jet/appliquer/annuler
  'castRoll', 'castSetCritChoice',
  'castAllocOvercast', 'castSetChosenTableRolls', 'castToggleExtraTarget', 'castPickTargets',
  'castPlaceZone', 'castConfirm', 'castCancel',
  // Contre-sort à plusieurs + Test Étendu séquentiel + Enfoncer une porte : résolutions propres
  'counterspellConfirm', 'counterspellCancel',
  'extendedTestNext', 'extendedTestCancel',
  'forceDoorConfirm', 'forceDoorCancel',
  // Cascade séquentielle (jets de nuit / voyage influençables) : avance/clôture/choix/tirage sur table
  'cascadeNext', 'cascadeResolveAll', 'cascadeFinish', 'cascadeChoose', 'cascadeTableRoll',
  // Mode table (#942 L3) : poser le dé d'une étape à table (champ ou clic sur une ligne) — autorisé par la
  // possession du siège ÉMETTEUR (`intentAllowedFor`) ; l'option « Dés fixés » est CLIENT-SIDE.
  'cascadeTableSetForcedRoll',
  // désengagement : ouverture, jet, appliquer/fuir/annuler
  'disengageConfirmA', 'disengageRoll', 'disengageConfirm', 'disengageFlee', 'disengageCancel',
  // « Au Contact » (LDB 62 l.176) : ouverture, jet, choix du vainqueur
  'battleAuContact', 'auContactRoll', 'auContactConfirm', 'auContactChoose', 'auContactCancel',
  // Empoignade (LDB 14 l.161) : ouverture, « Briser », jet, choix du vainqueur
  'battleGrapple', 'grappleBreak', 'grappleRoll', 'grappleConfirm', 'grappleChoose', 'grappleCancel',
  // Fuir : flux MULTI (coup dans le dos du frappeur + Test de Calme du fuyard) — chaque rangée est
  // routée par la possession de SON acteur (1ᵉʳ argument = son id, cf. `intentAllowedFor`).
  'fleeConfirm',
  // combat monté
  'mountTargetSelect', 'mountTargetCancel',
  // résolutions/annulations des flux de jet en combat (le verbe de jet est dérivé, pas l'appliquer)
  'trampleConfirm', 'trampleCancel',
  'maneuverConfirm', 'maneuverCancel', 'maneuverSetAvantage',
  // Tour de NAVIRE (couche Mer, MDG 13-14) : le contrôleur de la coque OUVRE + confirme ; CHAQUE
  // participant (héros à un rôle) roule SA rangée, routée par la possession de son id
  // (cf. `intentAllowedFor`, primitive multi `RollParticipant`).
  'battleShipManeuver', 'shipManeuverSetTurn', 'shipManeuverConfirm', 'shipManeuverCancel',
  'battleShipBattery', 'shipBatteryConfirm', 'shipBatteryCancel',
  'battleCrewTest', 'crewTestConfirm', 'crewTestCancel',
  'runConfirm', 'runCancel', 'focusConfirm', 'focusCancel',
  'wardConfirm', 'wardCancel',
  'frenzyConfirm', 'frenzyCancel', 'reloadConfirm', 'reloadCancel',
  'handGateConfirm', 'handGateCancel', 'recoverConfirm', 'recoverCancel',
  'healConfirm', 'healCancel',
  // Infirmerie (hors combat) : patients / actes / chirurgie + fermeture — l'hôte valide.
  // Chirurgie : openSurgeryPass POSE la passe, les verbes surgery* dérivés l'influencent,
  // surgeryNext applique, surgeryCancel annule — une passe n'a AUCUN verbe de résolution inline.
  'medicSelectPatient', 'medicAct', 'medicSetWound', 'closeMedic',
  'openSurgeryPass', 'surgeryNext', 'surgeryCancel',
  // Repos (nuit) : chacun règle SES héros (restSet vise un héros, 1er argument) + ready-check.
  'restSet', 'restReady',
  // (Psychologie de COMBAT et à la rencontre : passent par les intents `cascade*` dérivés.)
  'dismissReveal', 'fateNegate', 'fateSurvive', 'fateAccept', 'fumbleRoll', 'fumbleConfirm',
  'cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip',
  'roundStartPromote', 'confirmRoundStart', 'roundStartReady', 'renounceResolve',
  'resolveCorruption',
  // (dismissVictory volontairement ABSENT : un invité passe par victoryReady — l'hôte ferme à l'unanimité.)
  'victoryReady', 'assignVictoryGear', 'raiseHand',
];

export const COMBAT_INTENTS: ReadonlySet<string> = new Set([...MANUAL_COMBAT_INTENTS, ...coopFlowIntents()]);

/** Composition du groupe (écran d'équipe coop) : un invité remplit/retire SES emplacements.
 *  L'hôte injecte le siège autoritaire dans `partyAddHero` (netFlow) — jamais celui de l'invité.
 *  `toggleCluePin` (carnet d'enquête, #670) : état CAMPAGNE-scopé partagé par tout le groupe,
 *  hors-combat — même niveau d'autorisation que la composition du groupe. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set(['partyAddHero', 'partyRemoveHero', 'partyReplaceHero', 'toggleCluePin']);

/** Activités d'interlude (LDB 23) : chacune vise un héros (1er argument ou pending/dépôt) —
 *  l'hôte valide la possession dans `intentAllowedFor`. `startInterlude`/`interludeEnd`
 *  restent HORS allowlist (l'hôte seul ouvre et clôt la période). */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set([
  // `interludeActivity` = chemin UNIQUE de toutes les Activités à jet (Revenus/Artisanat/Apprentissage/
  // Identification + catalogue) ; `interludeCraftStart` engage l'ouvrage (setup, sans jet).
  'interludeActivity', 'interludeCraftStart',
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
