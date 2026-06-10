/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant, CharKey, HitLocation, DIFFICULTY_MODIFIERS } from '../engine/types';
import { battleRng, seedBattleRng } from './battleRng';
import { facingToward } from '../gameIso/rig/facing';
import type { Dir8 } from './dir8';
import {
  activeCombatant, occupied, findFreeTile, removeEntity, checkTriggers, entityPickables,
  applyEffects, bestDefenseMode, applySonneMeleeAdvantage, selectedAmmo, firedWeapon, resolveAttack,
  disengageOutcome, startDisengage, bestAdjacentReachable, applyAttackResult, castSpell, applyCast,
  finishPlayerAction, restPartyOvernight,
  applyMiscast, checkBattleOver, resumeEnemyTurn, advanceTurn, resolveRoundBoundary, maybeRunEnemyTurn,
  attackerFumbled, defenderFumbled, applyOups,
  autoCleave, maybeHeroCleave, cleaveTargets, resolveDualSecond,
  aiCreatureFreeAttacks, aiFrenzyAttack, applyFreeAttackEffects, trampleTarget, TRAMPLE_WEAPON, pushReveal,
  maybeOpenHeroPsych, displaceSmaller, applySurprise,
} from './combatFlow';
export { activeCombatant, entityPickables, trampleTarget } from './combatFlow';
export { movementRemaining, canMove } from './mount';
import { mountedDodgePenalty, mountMovement, movementRemaining, canMove, mountUp, dismount, mountOf, mountableNear } from './mount';
import { ev, evLines, type CombatEvent } from './combatLog';
import { rollOups } from '../engine/oups';
import {
  initiativeOrder,
  combatValue,
  rollMeleeDefender,
  resolveBackstabAttack,
  finishMelee,
  resolveMeleePassive,
  attackWeapon,
  rederivePassiveAttack,
  AttackResult,
} from '../engine/combat';
import { disengageFrom, isEngaged, chargeAdvantage, meleeReachTiles } from '../engine/engagement';
import { resolveMagicMissile, resolveCasting, rederiveCastSL, isArcaneSpell, isMagicMissile } from '../engine/magic';
import { rollTest, TestResult, resolveOpposed, isDoubleRoll } from '../engine/tests';
import { canReroll } from '../engine/fortune';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isFrenzyCapable, isPsychImmune, CIBLE_TYPES, spendResolveForPsychImmunity } from '../engine/psychology';
import { recomputeLoadout, itemFromTrapping, compatibleAmmo, loadoutSetActive } from '../engine/items';
import { attackModesFor } from '../engine/combatFeatures/dispatch';
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
import { itemUse, applyItemUse } from '../engine/consumables';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, addCondition, removeCondition, hasCondition, canTakeAction, loseWounds, stacks, recoveredStacks } from '../engine/conditions';
import { testValue, partyBest } from '../engine/skills';
import { hasHealSkill, hasSurgerySkill, availableHealModes, resolveWoundsHeal, resolveBleedHeal, type HealMode } from '../engine/healing';
import { treatTrauma, removeSurgicalTrauma } from '../engine/trauma';
import { rollContraction } from '../engine/disease';
import { persistentConditions } from '../engine/persistence';
import { CAMPAIGN_START } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { outOfCombatUpkeep } from './outOfCombatUpkeep';
import { actorIn, touchActors } from './combatOrParty';
import { FLOWS } from './rollFlows';
import * as partyFlow from './partyFlow';
import * as merchantFlow from './merchantFlow';
import type { MerchantState, MerchantStocks } from './merchantFlow';
import type {
  Money, PendingVictory, PendingTest, PendingReload, PendingStateRecovery, PendingBargain,
  PendingAppraise, PendingAttack, PendingCleave, PendingDualStrike, PendingTrample, PendingRun, PendingFocus,
  PendingPsych, PendingFrenzy, RevealEntry, PendingFumble, PendingDeviation, PendingDefense,
  PendingDisengage, PendingCast, PendingHeal,
} from './pendings';
import {
  PendingEncounterPsych,
  openEncounterPsych,
  encounterPsychRoll as encounterPsychRollFlow,
  encounterPsychReroll as encounterPsychRerollFlow,
  encounterPsychForceSuccess as encounterPsychForceSuccessFlow,
  encounterPsychConfirm as encounterPsychConfirmFlow,
  encounterPsychResolve as encounterPsychResolveFlow,
} from './encounterPsychFlow';
import { findSpell } from '../data/index';
import { subtract as moneySub, canAfford, toMoney } from '../engine/money';
import { Scene, Dialogue, Effect, isWalkable } from './scene';
import { migrateScene } from './sceneMigrate';
import { sceneCombatModifiers } from './sceneRules';
import { doorAt } from './buildings';
import { spawnEnemy } from './spawn';
import { reachable, fleeReachable, pathTo, chebyshev, Pt } from './path';
import { sizeFootprint, combatDistance } from './footprint';
import { bus, EVT } from './bus';
import { campaign } from '../scenes/campaign';

export type Screen = 'menu' | 'party' | 'creator' | 'campaign' | 'editor' | 'test';

/** Registre des scènes (pour les transitions de campagne). */
const sceneRegistry: Record<string, Scene> = {};
for (const c of campaign) sceneRegistry[c.scene.id] = c.scene;
function registerScene(s: Scene) {
  sceneRegistry[s.id] = s;
}

// Types des flux différés (Pending*, Money, RevealEntry…) — extraits dans ./pendings, ré-exportés
// pour la compat des imports existants (`from '../state/store'`).
export * from './pendings';


export interface BattleState {
  combatants: Combatant[];
  order: string[];
  /** Ordre d'initiative CANONIQUE (immuable) ; `order` en est dérivé chaque Round (Maladresse
   *  « agir en dernier » / pré-emption Chance = effets d'UN Round, non permanents). */
  baseOrder?: string[];
  turn: number;
  round: number;
  action: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | 'resolve' | 'pickup' | 'ammo' | 'trample' | 'heal' | 'mvt' | 'tir' | 'objets' | null;
  /** Sort sélectionné pour l'action d'incantation en cours. */
  selectedSpell: string | null;
  reachable: Map<string, number>;
  /** Cases de Mouvement déjà parcourues ce Tour. Le Mouvement est DÉCOMPOSABLE (règle maison : on peut
   *  fractionner son déplacement tant que le total ≤ Marche) MAIS non entrelacé avec l'Action : séquences
   *  permises = `Mouvement* puis Action` OU `Action puis Mouvement*` ; INTERDIT = Mouvement → Action →
   *  Mouvement. 0 en début de tour. « Mouvement restant » = `movementRemaining(battle, c)`. */
  movementUsed: number;
  /** Du Mouvement a-t-il été parcouru AVANT l'Action ce Tour ? Si oui, une fois l'Action prise, plus aucun
   *  Mouvement (pas de « Mouvement → Action → Mouvement », règle maison). Cf. `canMove`. */
  movedPreAction: boolean;
  acted: boolean;
  /** Le set d'armes a-t-il déjà été changé ce Tour ? (1 switch gratuit/tour — LDB 13 l.116). Reset au tour. */
  loadoutSwapped?: boolean;
  log: CombatEvent[];
  over: null | 'victory' | 'defeat';
  onVictory?: Effect[];
  /** Nuages de fumée transitoires (Souffle (Fumée), Traits LDB) : chaque case bloque la Ligne de
   *  Vue ; `rounds` = Rounds restants (décrémenté à chaque frontière de Round, retiré à 0). */
  smoke?: { x: number; y: number; rounds: number }[];
  /** Instantané positionnel pris au PREMIER segment de Mouvement du Tour (R6/LOT 6) : permet
   *  d'ANNULER tout le déplacement tant qu'aucune Action n'a été prise (`cancelMove`). Restaure
   *  positions de TOUS les combattants (un grand a pu en déplacer d'autres), orientation et
   *  `movedPreAction`. Effacé à l'annulation ou écrasé au 1ᵉʳ segment du Tour suivant. */
  moveSnapshot?: { pos: Record<string, Pt>; facing: Record<string, Dir8>; movedPreAction: boolean } | null;
}

export interface GameState {
  screen: Screen;
  party: Combatant[];
  scene: Scene | null;
  mode: 'exploration' | 'battle';
  camRot: 0 | 1 | 2 | 3; // orientation caméra (cran de 90° horaire) — état de vue, non sérialisé
  rotateCam: (dir: 1 | -1) => void;
  /** Orientation MONDE vivante par entité/combattant (Dir8) — projetée au rendu (camRot). */
  facing: Record<string, Dir8>;
  setFacing: (id: string, dir: Dir8) => void;
  faceToward: (id: string, from?: Pt, to?: Pt) => void;
  faceFromPath: (id: string, path?: Pt[] | null) => void;
  faceAtCombatStart: () => void;
  zoom: number; // zoom caméra du JEU (échelle), borné [1, 2.6] — état de vue, non sérialisé
  setZoom: (z: number) => void;
  /** Projection de la carte (bascule) : 'iso' losange ou 'top' grille carrée — préférence de vue. */
  viewMode: 'iso' | 'top';
  toggleViewMode: () => void;
  /** Décalage manuel de la caméra (caméra libre tactique) ; remis à zéro au refocus (changement de tour). */
  camPan: { x: number; y: number };
  panCamBy: (dx: number, dy: number) => void;
  resetCamPan: () => void;
  /** Option de jeu : INSPECTION des combattants (statbloc au clic sur la frise d'ordre). OFF par défaut
   *  (préférence du joueur — l'inspection casse un peu l'immersion) ; préférence persistante (comme la vue). */
  inspectEnabled: boolean;
  toggleInspectEnabled: () => void;
  partyPos: Pt;
  flags: Record<string, boolean>;
  journal: string[];
  dialogue: { dialogue: Dialogue; nodeId: string } | null;
  /** Marchand ouvert (#2) : instantané du stock pour la visite (Disponibilité figée). */
  merchant: MerchantState | null;
  /** Stock PERSISTANT par marchand (#T3 re-stock) : déplété entre visites, re-tiré seulement après
   *  `restockDays` écoulés. `rolledAt` = gameTime du dernier tirage. `bargainLocked` = le joueur a négocié
   *  puis quitté SANS payer → plus de Marchandage avec ce marchand jusqu'au prochain réassort. Reset en nouvelle partie. */
  merchantStocks: MerchantStocks;
  battle: BattleState | null;
  campaignSceneId: string | null;
  inventory: string[];
  money: Money;
  pendingTest: PendingTest | null;
  pendingBargain: PendingBargain | null;
  pendingAppraise: PendingAppraise | null;
  pendingAttack: PendingAttack | null;
  pendingReload: PendingReload | null;
  /** « Se libérer » (Empêtré) / « se rouler » (En flammes) en cours — modale interactive (LDB 16). */
  pendingStateRecovery: PendingStateRecovery | null;
  pendingDefense: PendingDefense | null;
  /** Déviation Critique d'un héros en attente (choix Dévier/Subir, LDB 63 l.63-66). */
  pendingDeviation: PendingDeviation | null;
  pendingDisengage: PendingDisengage | null;
  /** Déplacement-puis-fouille : id du décor interactif visé, déclenché à l'arrivée adjacente (P5). */
  pendingInteract: string | null;
  pendingCast: PendingCast | null;
  /** Tir ENNEMI télégraphié : réticule « qui l'adversaire vise », montré ~0,7 s AVANT le tir. */
  enemyAim: { fromId: string; toId: string } | null;
  /** Soin de Guérison en cours (modale interactive, combat ou hors-combat). */
  pendingHeal: PendingHeal | null;
  /** Balayage (Frappe Mortelle) d'un héros en cours : enchaînements d'attaque restants. */
  pendingCleave: PendingCleave | null;
  /** Maniement de deux armes : sélection de la 2ᵉ cible (après une 1ʳᵉ frappe réussie). */
  pendingDualStrike: PendingDualStrike | null;
  /** File de révélation témoin (jets subis/sur table/entretien montrés au joueur, FIFO). */
  pendingReveals: RevealEntry[];
  /** Piétinement en cours (modale interactive). */
  pendingTrample: PendingTrample | null;
  /** Course en cours (modale Test d'Athlétisme → déplacement étendu). */
  pendingRun: PendingRun | null;
  /** Focalisation en cours (modale interactive). */
  pendingFocus: PendingFocus | null;
  /** Test de Psychologie (Calme) d'un héros en cours (Peur/Terreur, LDB 21). */
  pendingPsych: PendingPsych | null;
  /** Test de Psychologie À LA RENCONTRE (hors combat) d'un héros : Peur/Terreur/trait ciblé
   *  déclenché à l'entrée d'une scène par les PNJ présents (couture C, LDB 21). */
  pendingEncounterPsych: PendingEncounterPsych | null;
  /** Entrée en Frénésie d'un héros en cours (Test de FM, LDB 21 l.32). */
  pendingFrenzy: PendingFrenzy | null;
  /** Maladresse d'un héros en attente (LDB 14 — Tableau des Oups !). */
  pendingFumble: PendingFumble | null;
  /** Modale d'ordre de Round en attente (Chance, 3e usage : pré-emption d'initiative). */
  pendingRoundStart: { round: number } | null;
  /** Sauvetage par le Destin en attente (LDB ch.17 l.31-35). */
  pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number } | null;
  /** Récompenses de victoire capturées (écran de fin de combat) ; null hors victoire. */
  pendingVictory: PendingVictory | null;
  /** Écran de victoire : assigne un objet de butin à l'inventaire PERSONNEL d'un héros (retire du
   *  stock de groupe). Réutilise `addItemToHero` (même flux que le marchand). */
  giveItemToHero: (label: string, heroId: string) => void;
  /** Ferme l'écran de victoire et revient à l'exploration. */
  dismissVictory: () => void;
  document: { title: string; text: string } | null;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  setScreen: (s: Screen) => void;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  createLoadout: (heroId: string, name: string) => void;
  renameLoadout: (heroId: string, id: string, name: string) => void;
  deleteLoadout: (heroId: string, id: string) => void;
  setActiveLoadout: (heroId: string, id: string) => void;
  setLoadoutSlot: (heroId: string, id: string, slot: 'main' | 'off', uid: string | null) => void;
  /** Donne un objet d'un héros à un autre (transfert d'inventaire). Arrive NON équipé chez le
   *  destinataire ; recalcule les deux loadouts. Permet de confier une arme/armure au bon porteur. */
  transferItem: (uid: string, fromHeroId: string, toHeroId: string) => void;
  /** Skin cosmétique d'un objet (override de palette token→hex ; clé à `undefined` = reset).
   *  Propagé à l'arme active via recomputeLoadout → le rendu se recolore (objet légendaire). */
  setItemSkin: (heroId: string, uid: string, patch: Record<string, string | undefined>) => void;
  // ── Avancement par PX (LDB 07-Carrières) — câblage du moteur testé ──
  /** Octroie des PX à un héros. */
  grantXp: (heroId: string, amount: number) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  buyCharAdvance: (heroId: string, char: CharKey) => void;
  /** Achète une Augmentation de Compétence ; acquiert la Compétence de carrière non connue à 0. */
  buySkillAdvance: (heroId: string, skillName: string) => void;
  /** Achète/augmente un Talent (refusé hors carrière, LDB l.97). */
  buyTalent: (heroId: string, talentName: string) => void;
  /** Entraîne une prothèse portée par dépense de PX (Fausse jambe → réapprendre l'Esquive, 200 PX, LDB 73). */
  trainProsthesis: (heroId: string, uid: string) => void;
  /** Change de Carrière/Niveau (coût 100 si Niveau actuel complété, 200 sinon). */
  changeCareer: (heroId: string, newCareer: string, newLevel: number) => void;
  startScene: (scene: Scene) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. */
  loadProject: (scenes: Scene[], entryId: string) => void;
  transitionTo: (sceneId: string, entry?: string, pos?: Pt) => void;
  moveParty: (pt: Pt) => void;
  interactEntity: (entityId: string) => void;
  setPendingInteract: (id: string | null) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  openMerchant: (entityId: string) => void;
  closeMerchant: () => void;
  /** Achat direct (#2, primitif) : débite la Bourse et crée l'objet dans le sac du héros (défaut : 1er). */
  buyItem: (label: string, heroId?: string) => void;
  /** Panier (#2) : ajoute / retire / vide. L'achat passe par le panier → `payCart` (UI). */
  addToCart: (label: string) => void;
  decFromCart: (label: string) => void;
  removeFromCart: (label: string) => void;
  clearCart: () => void;
  /** Refuse un marché NÉGOCIÉ (achat ou vente) : annule la négociation de ce côté + pose le VERROU PARTAGÉ
   *  (plus aucune négociation, achat NI vente, jusqu'au réassort). L'achat vide aussi le panier. */
  refuseBargain: (mode: 'buy' | 'sell') => void;
  /** Paye le panier : débite le Total (prix listés × Marchandage), retire du stock, et met les objets
   *  achetés EN ATTENTE DE RÉPARTITION (`pendingDistribution`) — « qui récupère quoi ». */
  payCart: () => void;
  /** Répartition : affecte l'objet acheté n°`index` à un héros, puis `confirmDistribution` les range. */
  assignDistribution: (index: number, heroId: string) => void;
  confirmDistribution: () => void;
  sellItem: (uid: string, heroId: string) => void;
  /** Panier de VENTE (#22b, parité achat) : ajoute / retire / vide / conclut toute la vente d'un coup. */
  addToSellCart: (uid: string, heroId: string) => void;
  removeFromSellCart: (uid: string) => void;
  clearSellCart: () => void;
  confirmSell: () => void;
  /** Réparation d'armure chez le marchand : remet damageTaken à 0 contre 10 %/PA perdu (LDB 63 l.97-98). */
  repairArmour: (uid: string, heroId: string) => void;
  /** Marchandage (LDB 60 l.12) : ouvre un Test opposé (1/visite) ; réduit ensuite les prix de 10-20 %. */
  startBargain: (mode: 'buy' | 'sell') => void;
  bargainRoll: () => void;
  bargainReroll: () => void;
  bargainBonusSL: () => void;
  bargainConfirm: () => void;
  bargainCancel: () => void;
  /** Évaluation (LDB 60 l.10) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix. */
  appraiseItem: (uid: string, heroId: string) => void;
  appraiseRoll: () => void;
  appraiseReroll: () => void;
  appraiseBonusSL: () => void;
  resolveAppraise: () => void;
  appraiseCancel: () => void;
  testRoll: () => void;
  testReroll: () => void;
  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => void;
  resolveTest: () => void;
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Effect[]) => void;
  battleSelectAction: (a: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | 'resolve' | 'pickup' | 'ammo' | 'trample' | 'heal' | 'mvt' | 'tir' | 'objets' | null) => void;
  /** Guérison (LDB 09-Compétences) — ouvre la modale de soin EN COMBAT (soi/allié adjacent). */
  battleHeal: (targetId: string, mode: HealMode) => void;
  /** Guérison HORS COMBAT : le meilleur soigneur du groupe soigne `targetId`. */
  healAlly: (targetId: string, mode: HealMode) => void;
  /** Soin par un PNJ : le joueur choisit la cible parmi `pendingHeal.candidateIds` (avant le jet). */
  healSetTarget: (targetId: string) => void;
  /** Chirurgie (Test étendu) : choisit la Blessure Critique à opérer avant la 1re passe. */
  surgerySetWound: (idx: number) => void;
  /** #16 : pendant la Chirurgie (Test étendu), bander les Blessures / arrêter l'Hémorragie SANS
   *  interrompre l'opération (Tests de Guérison appliqués sur le patient, n'avancent pas le DR). */
  surgeryBandage: () => void;
  surgeryStopBleed: () => void;
  /** Chirurgie (Test étendu) : effectue une passe (1d10 PB + Hémorragie, cumule le DR jusqu'à la cible). */
  surgeryPass: () => void;
  healRoll: () => void;
  healReroll: () => void;
  healBonusSL: () => void;
  healForceSuccess: () => void;
  healConfirm: () => void;
  healCancel: () => void;
  /** Recharger l'arme à distance (LDB 63-Armures l.28-29) : OUVRE la modale de Test étendu de Projectiles. */
  battleReload: () => void;
  /** Modale rechargement : « Lancer » effectue le Test de Projectiles (DR). */
  reloadRoll: () => void;
  /** Chance : relance le jet de rechargement raté (1 max). */
  reloadReroll: () => void;
  /** Chance « +1 DR » sur le jet de rechargement figé. */
  reloadBonusSL: () => void;
  /** « Appliquer » : cumule le DR (Test étendu), recharge si ≥ Indice, consomme l'Action. */
  reloadConfirm: () => void;
  /** Ferme la modale de rechargement sans coût (avant le jet). */
  reloadCancel: () => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.61/77). */
  battleRecoverState: (state: 'Empêtré' | 'En flammes') => void;
  /** Modale « se libérer/se rouler » : « Lancer » effectue le Test (DR / opposition). */
  recoverRoll: () => void;
  /** Chance : relance le jet de récupération raté (1 max). */
  recoverReroll: () => void;
  /** Chance « +1 DR » sur le jet de récupération figé. */
  recoverBonusSL: () => void;
  /** « Appliquer » : retire 1 + DR pions de l'État, consomme l'Action. */
  recoverConfirm: () => void;
  /** Ferme la modale de récupération sans coût (avant le jet). */
  recoverCancel: () => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: string) => void;
  /** Détermination (Resolve, LDB ch.17 l.66) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
  /** Détermination (LDB 17 l.62) : immunité à la Psychologie jusqu'à la fin du prochain Round. */
  battleResolvePsychImmune: () => void;
  /** Détermination (LDB 17 l.64) : ignore les modificateurs de Blessure critique ce Round. */
  battleResolveIgnoreCrit: () => void;
  /** Ramasser UN objet au sol pendant un Round (LDB ch.13 l.115-116) : applique au combattant
   *  actif un item ramassable d'un `prop` interactif adjacent. Consomme l'Action, pas d'auto-équipe.
   *  `key` = `eff:<index dans interact.effects>` (cf. entityPickables). */
  battlePickup: (entityId: string, key: string) => void;
  battleSelectSpell: (label: string) => void;
  /** Le combattant actif boit/utilise un consommable de son inventaire (coûte l'Action). */
  battleUseItem: (uid: string) => void;
  /** HORS COMBAT : un héros utilise un consommable (bandages, potion) depuis sa fiche. */
  usePartyItem: (heroId: string, uid: string) => void;
  /** Incantation par modale : « Lancer » fige le jet, Chance le relance, « Appliquer » résout. */
  castRoll: () => void;
  castReroll: () => void;
  castBonusSL: () => void;
  castConfirm: () => void;
  castCancel: () => void;
  /** Incantation HORS COMBAT (couture D) : un héros lanceur cible self/allié ; sorts non-offensifs. */
  oocCastSpell: (casterId: string, label: string, targetId: string) => void;
  battleFocusSpell: (label: string) => void;
  battleClickTile: (pt: Pt) => void;
  battleClickEntity: (id: string, skipMountChoice?: boolean) => void;
  /** Annule TOUT le déplacement décomposé du Tour (R6/LOT 6) tant qu'aucune Action n'a été prise :
   *  restaure positions/orientation depuis `battle.moveSnapshot`. No-op après l'Action. */
  cancelMove: () => void;
  battleEndTurn: () => void;
  /** Chance, 3e usage (LDB ch.17 l.27) : en début de Round, place un héros en tête de l'ordre
   *  contre 1 point de Chance (pré-emption d'initiative). */
  roundStartPromote: (heroId: string) => void;
  /** Ferme la modale d'ordre de Round et reprend le combat (active le 1er combattant valide). */
  confirmRoundStart: () => void;
  /** « Comment ça a pu rater ? » (Destin, coup létal) : annule le coup, reste en combat. */
  fateNegate: () => void;
  /** « Meurs un autre jour » (Destin) : survit mais éjecté de la rencontre. */
  fateSurvive: () => void;
  /** « Accepter le sort » : le héros meurt. */
  fateAccept: () => void;
  /** « Sur la défensive » : utilise l'Action pour +20 en défense jusqu'au prochain tour. */
  battleDefendTotal: () => void;
  /** Bascule le set d'armes actif du combattant actif (Action gratuite, 1/tour, même Engagé — LDB 13 l.116). */
  battleSwitchLoadout: (loadoutId: string) => void;
  /** Action « Viser » (sans jet) : +20 (Accessible) au prochain tir tant que c'est la dernière action. */
  battleAim: () => void;
  /** Flux d'attaque par modale : viser une localisation, lancer, dépenser une Chance, appliquer. */
  attackSetLocation: (loc: HitLocation | null) => void;
  /** Choisit l'arme d'attaque (uid d'ItemInstance du loadout actif ; null = auto) — avant le jet. */
  attackSetWeapon: (uid: string | null) => void;
  /** Maniement de deux armes (LDB 10 l.638) : (dés)active le mode « des deux armes » sur l'attaque-Action. */
  attackSetDualMode: (on: boolean) => void;
  /** « Tirer dans le tas » : bascule l'option de tir dans un groupe (cible au hasard, bonus +20/+40/+60). */
  attackSetIntoCrowd: (v: boolean) => void;
  /** Tir immobile : bascule l'option « je ne bouge pas » (annule le −10 Tir en bougeant, consomme le Mouvement). */
  attackSetHeldGround: (v: boolean) => void;
  /** « Je ne faillirai pas ! » (RAW-2, LDB 17 l.73) : choisit la Localisation d'un Coup Critique forcé. */
  attackSetCritLocation: (loc: HitLocation) => void;
  attackRoll: () => void;
  attackReroll: () => void;
  attackBonusSL: () => void;
  attackConfirm: () => void;
  attackCancel: () => void;
  /** Balayage (Frappe Mortelle, LDB 14 l.12) : enchaîne l'attaque sur une cible adjacente (ouvre une
   *  modale d'attaque standard) ; borné à BCC enchaînements. */
  cleaveAttack: (targetId: string) => void;
  /** Termine le balayage en cours (le joueur renonce aux enchaînements restants). */
  cleaveEnd: () => void;
  /** Maniement de deux armes (LDB 10 l.638) : 2ᵉ frappe (main secondaire) contre la cible choisie. */
  dualStrikeAttack: (targetId: string) => void;
  /** Renonce à la 2ᵉ frappe (« peut viser » = optionnel) → pas de 2ᵉ attaque, pas d'Avantage. */
  dualStrikeSkip: () => void;
  /** Piétinement (LDB 85 l.320-321) : action gratuite (1 Avantage) contre un adversaire adjacent
   *  plus petit. Ne consomme pas l'Action. */
  battleTrample: (targetId: string) => void;
  /** Acquitte la révélation en tête de file (montre le dé du jet subi/sur table) ; reprend l'IA si vide. */
  dismissReveal: () => void;
  /** Piétinement par modale (LDB 85 l.320-321) : Lancer le jet, dépenser une Chance, appliquer (gratuit). */
  trampleRoll: () => void;
  trampleReroll: () => void;
  trampleBonusSL: () => void;
  trampleForceSuccess: () => void;
  trampleConfirm: () => void;
  trampleCancel: () => void;
  /** Course (LDB 15 l.79-82) : ouvrir la modale, lancer le Test d'Athlétisme, Chance/Résilience, appliquer (déplacement étendu). */
  battleRun: () => void;
  runRoll: () => void;
  runReroll: () => void;
  runForceSuccess: () => void;
  runConfirm: () => void;
  runCancel: () => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.28). */
  battleStandUp: () => void;
  /** Focalisation par modale (Test étendu) : Lancer, Chance, Appliquer (cumule le DR). */
  focusRoll: () => void;
  focusReroll: () => void;
  focusBonusSL: () => void;
  focusForceSuccess: () => void;
  focusConfirm: () => void;
  focusCancel: () => void;
  /** Focalisation HORS COMBAT (couture D) : ouvre la modale de Focalisation pour un héros lanceur du groupe. */
  oocFocusSpell: (casterId: string, label: string) => void;
  /** Test de Psychologie héros (Peur/Terreur, LDB 21) : Lancer, Chance, Appliquer. */
  psychRoll: () => void;
  psychReroll: () => void;
  psychBonusSL: () => void;
  psychForceSuccess: () => void;
  /** Détermination (LDB 17 l.62) : immunité Psychologie → passe la Peur/Terreur/trait sans risque. */
  psychResolve: () => void;
  psychConfirm: () => void;
  /** Test de Psychologie à la rencontre, hors combat (couture C, LDB 21) : Lancer, Chance, Résilience, Appliquer. */
  encounterPsychRoll: () => void;
  encounterPsychReroll: () => void;
  encounterPsychForceSuccess: () => void;
  encounterPsychConfirm: () => void;
  encounterPsychResolve: () => void;
  /** Entrée en Frénésie d'un héros (LDB 21 l.32) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  battleFrenzy: () => void;
  frenzyRoll: () => void;
  frenzyReroll: () => void;
  frenzyForceSuccess: () => void;
  frenzyConfirm: () => void;
  frenzyCancel: () => void;
  /** Maladresse (modale héros, LDB 14) : lancer sur le Tableau des Oups !, puis appliquer l'effet. */
  fumbleRoll: () => void;
  fumbleConfirm: () => void;
  /** Flux de défense réactive (héros attaqué par l'IA) : choisir Parade/Esquive, défendre,
   *  dépenser une Chance, appliquer ; « Subir » = défense passive. */
  defenseSetMode: (mode: 'parade' | 'esquive') => void;
  /** Choisit l'arme de parade (uid d'ItemInstance ; null = main principale) — avant le jet de défense. */
  defenseSetParryWeapon: (uid: string | null) => void;
  defenseRoll: () => void;
  defenseReroll: () => void;
  defenseBonusSL: () => void;
  defenseConfirm: () => void;
  defenseCancel: () => void;
  /** Déviation Critique (LDB 63 l.63-66) : « Dévier » (sacrifie 1 PA, ignore le Critique) ou « Subir ». */
  deviationApply: (deviate: boolean) => void;
  /** Combat monté (LDB 14 l.212-225) : enfourcher une monture libre adjacente / en descendre. Aucun jet
   *  (Chevaucher sans Test, LDB 09 l.99) → pas une Action : consomme le MOUVEMENT (on peut ensuite attaquer). */
  battleMount: () => void;
  battleDismount: () => void;
  /** Combat monté (LDB 14 l.219) : clic sur un couple cavalier+monture (deux ennemis) → choisir lequel
   *  frapper (le cavalier −10 si l'on est plus petit que la monture ; abattre la monture désarçonne). */
  pendingMountTarget: { riderId: string; mountId: string } | null;
  mountTargetSelect: (id: string) => void;
  mountTargetCancel: () => void;
  /** Désengagement (LDB 15-Dépl l.84-109) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  battleDisengage: () => void;
  disengageConfirmA: () => void; // Sacrifier l'Avantage
  disengageRoll: () => void; // Esquiver (lance le Test opposé)
  disengageReroll: () => void;
  disengageBonusSL: () => void;
  // Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) : réussite garantie (opposé : DR +1).
  testForceSuccess: () => void;
  attackForceSuccess: () => void;
  defenseForceSuccess: () => void;
  castForceSuccess: () => void;
  disengageForceSuccess: () => void;
  disengageConfirm: () => void; // Appliquer l'issue de l'Esquive
  disengageFlee: () => void; // Fuir : attaque dans le dos + Course
  disengageCancel: () => void;
  log: (msg: string) => void;
  /** Temps de jeu : minutes depuis l'époque (Hexenstag 2512 00:00, cf. clock.ts). « Tout est horodaté ». */
  gameTime: number;
  /** Avance l'horloge in-game de `minutes` (no-op si ≤ 0) et émet TIME_ADVANCED (#T3 cascade). */
  advanceTime: (minutes: number) => void;
  /** « Dormir / Se reposer N jours » (hors combat) : repos de `days` journée(s) — retire l'Exténué,
   *  soigne des Blessures (l.380 volet a Résistance +20 → DR+BE, ET volet b +BE/jour) et déclenche les
   *  cauchemars des héros marqués (LDB 16/18/21). `days` par défaut = 1 (une nuit). */
  restParty: (days?: number) => void;
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  gameTime: CAMPAIGN_START,
  party: [],
  scene: null,
  mode: 'exploration',
  camRot: 0,
  rotateCam: (dir) => set((s) => ({ camRot: ((((s.camRot + dir) % 4) + 4) % 4) as 0 | 1 | 2 | 3 })),
  facing: {},
  setFacing: (id, dir) => set((s) => ({ facing: { ...s.facing, [id]: dir } })),
  faceToward: (id, from, to) => {
    if (!from || !to) return;
    set((s) => ({ facing: { ...s.facing, [id]: facingToward(from, to) } }));
  },
  faceFromPath: (id, path) => {
    if (!path || path.length < 2) return;
    get().faceToward(id, path[0], path[path.length - 1]);
  },
  // Orientation à l'entrée en combat : valeur authored (entité de scène) sinon vers l'ennemi le plus proche.
  faceAtCombatStart: () => {
    const { battle, scene, facing } = get();
    if (!battle) return;
    const next: Record<string, Dir8> = { ...facing };
    for (const c of battle.combatants) {
      if (!c.pos) continue;
      const authored = scene?.entities.find((e) => e.id === c.id)?.facing;
      if (authored) { next[c.id] = authored; continue; }
      const foes = battle.combatants.filter((o) => o.pos && (o.kind === 'hero') !== (c.kind === 'hero'));
      let best: Pt | undefined;
      let bd = Infinity;
      for (const o of foes) {
        const d = Math.max(Math.abs(o.pos!.x - c.pos.x), Math.abs(o.pos!.y - c.pos.y));
        if (d < bd) { bd = d; best = o.pos!; }
      }
      if (best) next[c.id] = facingToward(c.pos, best);
    }
    set({ facing: next });
  },
  zoom: 1,
  setZoom: (z) => set({ zoom: Math.min(2.6, Math.max(0.4, z)) }), // floor 0.4 : dézoom tactique large
  viewMode: 'iso',
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'iso' ? 'top' : 'iso' })),
  camPan: { x: 0, y: 0 },
  panCamBy: (dx, dy) => set((s) => ({ camPan: { x: s.camPan.x + dx, y: s.camPan.y + dy } })),
  resetCamPan: () => set((s) => (s.camPan.x === 0 && s.camPan.y === 0 ? {} : { camPan: { x: 0, y: 0 } })),
  inspectEnabled: false,
  toggleInspectEnabled: () => set((s) => ({ inspectEnabled: !s.inspectEnabled })),
  partyPos: { x: 0, y: 0 },
  flags: {},
  journal: [],
  dialogue: null,
  merchant: null,
  merchantStocks: {},
  battle: null,
  campaignSceneId: null,
  inventory: [],
  money: { gold: 0, silver: 0, brass: 0 },
  pendingTest: null,
  pendingBargain: null,
  pendingAppraise: null,
  pendingAttack: null,
  enemyAim: null,
  pendingReload: null,
  pendingStateRecovery: null,
  pendingDefense: null,
  pendingDeviation: null,
  pendingMountTarget: null,
  pendingDisengage: null,
  pendingInteract: null,
  pendingCast: null,
  pendingHeal: null,
  pendingCleave: null,
  pendingDualStrike: null,
  pendingReveals: [],
  pendingTrample: null,
  pendingRun: null,
  pendingFocus: null,
  pendingPsych: null,
  pendingEncounterPsych: null,
  pendingFrenzy: null,
  pendingFumble: null,
  pendingRoundStart: null,
  pendingFateSave: null,
  pendingVictory: null,
  document: null,
  previousScene: null,

  setScreen: (s) => set({ screen: s }),

  // ── Actions GROUPE (équipement / avancement) : déléguées à partyFlow ──
  toggleEquip: (heroId, uid) => partyFlow.toggleEquip(get, set, heroId, uid),
  createLoadout: (heroId, name) => partyFlow.createLoadout(get, set, heroId, name),
  renameLoadout: (heroId, id, name) => partyFlow.renameLoadout(get, set, heroId, id, name),
  deleteLoadout: (heroId, id) => partyFlow.deleteLoadout(get, set, heroId, id),
  setActiveLoadout: (heroId, id) => partyFlow.setActiveLoadout(get, set, heroId, id),
  setLoadoutSlot: (heroId, id, slot, uid) => partyFlow.setLoadoutSlot(get, set, heroId, id, slot, uid),
  transferItem: (uid, fromHeroId, toHeroId) => partyFlow.transferItem(get, set, uid, fromHeroId, toHeroId),
  setItemSkin: (heroId, uid, patch) => partyFlow.setItemSkin(get, set, heroId, uid, patch),
  grantXp: (heroId, amount) => partyFlow.grantXp(get, set, heroId, amount),
  buyCharAdvance: (heroId, char) => partyFlow.buyCharAdvance(get, set, heroId, char),
  buySkillAdvance: (heroId, skillName) => partyFlow.buySkillAdvance(get, set, heroId, skillName),
  buyTalent: (heroId, talentName) => partyFlow.buyTalent(get, set, heroId, talentName),
  trainProsthesis: (heroId, uid) => partyFlow.trainProsthesis(get, set, heroId, uid),
  changeCareer: (heroId, newCareer, newLevel) => partyFlow.changeCareer(get, set, heroId, newCareer, newLevel),

  setParty: (p) => set({ party: p }),

  startScene: (scene) => {
    registerScene(scene);
    const start = scene.entities.find((e) => e.kind === 'heroStart');
    const pos = start ? { ...start.pos } : findFreeTile(scene);
    // Démarrage d'une partie / d'un scénario : on repart d'un état NEUF. SOURCE UNIQUE et
    // ZÉRO-MAINTENANCE : on réinitialise à l'état de CRÉATION du store (capturé par Zustand) —
    // donc tout nouveau champ d'état ajouté à l'init (système futur) se réinitialise ici sans
    // qu'on ait à le câbler. `JSON` retire les fonctions (seules les données sont remises à
    // plat) ; `set()` (fusion superficielle) préserve les actions. On ne conserve QUE la
    // navigation/vue (screen, caméra, zoom) et le groupe (posé par `setParty`).
    const { screen, party, camRot, zoom, viewMode, inspectEnabled } = get();
    set({
      ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>),
      screen, party, camRot, zoom, viewMode, inspectEnabled,
      scene: migrateScene(JSON.parse(JSON.stringify(scene))), // dissout objet→prop + loot/search→interact au chargement
      mode: 'exploration',
      partyPos: pos,
      flags: { ...scene.flags },
      money: { gold: 0, silver: 5, brass: 0 },
      campaignSceneId: scene.id,
      journal: scene.startMessage ? [scene.startMessage] : [],
    });
    bus.emit(EVT.SCENE_DIRTY);
    openEncounterPsych(get, set); // couture C : Peur/Terreur/trait ciblé à la rencontre des PNJ présents
  },

  loadProject: (scenes, entryId) => {
    // Enregistre toutes les scènes du projet (pour que les portes reveal:'door'
    // résolvent leurs intérieurs), puis démarre la scène d'entrée.
    for (const s of scenes) registerScene(s);
    const entry = scenes.find((s) => s.id === entryId) ?? scenes[0];
    if (entry) get().startScene(entry);
  },

  /** Transition vers une autre scène (conserve groupe, flags, inventaire, argent).
   *  `pos` force la case d'arrivée (utilisé par `transitionBack`). */
  transitionTo: (sceneId, entry, pos) => {
    const target = sceneRegistry[sceneId];
    if (!target) {
      get().log(`(Scène « ${sceneId} » introuvable — transition ignorée.)`);
      return;
    }
    const start =
      pos ||
      (entry && target.entryPoints?.[entry]) ||
      target.entities.find((e) => e.kind === 'heroStart')?.pos ||
      findFreeTile(target);
    set((s) => ({
      scene: migrateScene(JSON.parse(JSON.stringify(target))), // migration au chargement (cf. startScene)
      mode: 'exploration',
      partyPos: { ...start },
      // flags persistants : on conserve l'état narratif et on ajoute les
      // valeurs par défaut de la nouvelle scène pour les clés absentes.
      flags: { ...target.flags, ...s.flags },
      dialogue: null,
      battle: null,
      pendingTest: null,
      pendingAttack: null,
      pendingReload: null,
      pendingStateRecovery: null,
      pendingDefense: null,
      pendingDisengage: null,
      pendingInteract: null,
      pendingCleave: null,
      pendingDualStrike: null,
      pendingReveals: [],
      pendingTrample: null,
      pendingRun: null,
      pendingFocus: null,
      pendingPsych: null,
      pendingEncounterPsych: null,
      pendingFrenzy: null,
      document: null,
      campaignSceneId: target.id,
      journal: target.startMessage ? [...s.journal.slice(-40), target.startMessage] : s.journal,
    }));
    get().advanceTime(TIME_COST.sceneTransition); // seam « tout est horodaté » : 0 en intérieur (paramétrable, #T2 extérieur/voyage)
    bus.emit(EVT.SCENE_DIRTY);
    openEncounterPsych(get, set); // couture C : Psychologie à la rencontre dans la nouvelle scène
  },

  moveParty: (pt) => {
    const { scene, mode, partyPos } = get();
    if (!scene || mode !== 'exploration') return;
    if (!isWalkable(scene, pt.x, pt.y)) return;
    const from = partyPos; // case quittée (sert de retour hors du bâtiment)
    set({ partyPos: pt });
    const leadId = get().party[0]?.id;
    if (leadId) get().faceFromPath(leadId, [from, pt]);
    bus.emit(EVT.SCENE_DIRTY);
    const door = doorAt(scene, pt.x, pt.y);
    if (door && door.reveal === 'door' && door.interiorScene) {
      set({ previousScene: { id: scene.id, pos: from } });
      get().transitionTo(door.interiorScene, door.entry);
      return;
    }
    checkTriggers(get, set);
    // P5 (déplacement-puis-fouille) : à l'arrivée adjacente au décor visé, déclenche l'interaction.
    const pi = get().pendingInteract;
    if (pi) {
      const target = scene.entities.find((e) => e.id === pi);
      if (!target) set({ pendingInteract: null });
      else if (chebyshev(pt, target.pos) <= 1) {
        set({ pendingInteract: null });
        get().interactEntity(pi);
      }
    }
  },

  interactEntity: (entityId) => {
    const { scene, partyPos } = get();
    if (!scene) return;
    const ent = scene.entities.find((e) => e.id === entityId);
    if (!ent) return;
    if (chebyshev(partyPos, ent.pos) > 1) {
      // Trop loin : le déplacement-puis-fouille (P5) est armé par l'UI (setPendingInteract) ; ici, no-op.
      return;
    }
    if (ent.dialogueId) {
      const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
      if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
      return;
    }
    if (ent.merchant) { get().openMerchant(ent.id); return; }
    if (ent.interact) {
      // Décor INTERACTIF (fouille/ramassage) — canal unique d'Effets (cf. SceneEntity.interact).
      if (get().flags[`__fouille_${entityId}`]) {
        get().log(`${ent.label ?? 'Déjà fouillé'} : rien de plus à trouver.`);
        return;
      }
      get().log(`Vous fouillez ${ent.label ?? 'les lieux'}…`);
      applyEffects(get, set, ent.interact.effects);
      get().advanceTime(TIME_COST.search); // « tout est horodaté » : fouiller ≈ search min
      if (ent.interact.consume) removeEntity(get, set, entityId); // butin → le décor disparaît
      else set((s) => ({ flags: { ...s.flags, [`__fouille_${entityId}`]: true } })); // reste, marqué fouillé
    }
  },

  /** Arme (ou annule via null) un déplacement-puis-fouille : l'UI le pose au clic d'un décor interactif
   *  éloigné, consommé par `moveParty` à l'arrivée adjacente ; annulé sur tout autre clic (P5). */
  setPendingInteract: (id) => set({ pendingInteract: id }),

  chooseDialogue: (choiceIndex) => {
    const st = get();
    if (!st.dialogue) return;
    const node = st.dialogue.dialogue.nodes.find((n) => n.id === st.dialogue!.nodeId);
    const choice = node?.choices[choiceIndex];
    if (!choice) return;
    // Option payante (auberge, péage, pot-de-vin) : débit AVANT les effets ; refus si insolvable.
    if (choice.cost) {
      const cost = toMoney(choice.cost);
      if (!canAfford(get().money, cost)) { get().log('Pas assez d’argent pour cette option.'); return; }
      set((s) => ({ money: moneySub(s.money, cost)! }));
    }
    if (choice.effects) applyEffects(get, set, choice.effects);
    if (choice.next) set({ dialogue: { dialogue: st.dialogue.dialogue, nodeId: choice.next } });
    else {
      if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture (no-op si un Effect a déjà fermé)
      set({ dialogue: null });
    }
  },

  closeDialogue: () => {
    if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
    set({ dialogue: null });
  },

  // ─── Marchand (#2) : délégué à merchantFlow ───
  openMerchant: (entityId) => merchantFlow.openMerchant(get, set, entityId),
  closeMerchant: () => merchantFlow.closeMerchant(get, set),
  buyItem: (label, heroId) => merchantFlow.buyItem(get, set, label, heroId),
  addToCart: (label) => merchantFlow.addToCart(get, set, label),
  decFromCart: (label) => merchantFlow.decFromCart(get, set, label),
  removeFromCart: (label) => merchantFlow.removeFromCart(get, set, label),
  clearCart: () => merchantFlow.clearCart(get, set),
  refuseBargain: (mode) => merchantFlow.refuseBargain(get, set, mode),
  payCart: () => merchantFlow.payCart(get, set),
  assignDistribution: (index, heroId) => merchantFlow.assignDistribution(get, set, index, heroId),
  confirmDistribution: () => merchantFlow.confirmDistribution(get, set),
  sellItem: (uid, heroId) => merchantFlow.sellItem(get, set, uid, heroId),
  addToSellCart: (uid, heroId) => merchantFlow.addToSellCart(get, set, uid, heroId),
  removeFromSellCart: (uid) => merchantFlow.removeFromSellCart(get, set, uid),
  clearSellCart: () => merchantFlow.clearSellCart(get, set),
  confirmSell: () => merchantFlow.confirmSell(get, set),
  repairArmour: (uid, heroId) => merchantFlow.repairArmour(get, set, uid, heroId),
  startBargain: (mode) => merchantFlow.startBargain(get, set, mode),
  bargainRoll: () => FLOWS.bargain.roll(get, set),
  bargainReroll: () => FLOWS.bargain.reroll(get, set),
  bargainBonusSL: () => FLOWS.bargain.bonusSL(get, set),
  bargainConfirm: () => merchantFlow.bargainConfirm(get, set),
  bargainCancel: () => set({ pendingBargain: null }),

  appraiseItem: (uid, heroId) => merchantFlow.appraiseItem(get, set, uid, heroId),
  appraiseRoll: () => FLOWS.appraise.roll(get, set),
  appraiseReroll: () => FLOWS.appraise.reroll(get, set),
  appraiseBonusSL: () => FLOWS.appraise.bonusSL(get, set),
  resolveAppraise: () => merchantFlow.resolveAppraise(get, set),
  appraiseCancel: () => set({ pendingAppraise: null }),

  seedRng: (seed) => {
    seedBattleRng(seed);
  },

  startCombat: (encounterId, onVictory) => {
    const { scene, party, partyPos } = get();
    if (!scene) return;
    const enc = scene.encounters.find((e) => e.id === encounterId);
    if (!enc) return;
    // Placer les héros près de leur position de groupe, les ennemis selon l'encounter.
    // Carry-in : on n'instancie pas les morts/éjectés ; on ré-importe les États PERSISTANTS du
    // groupe (Hémorragique, Empoisonné…) et on réinitialise tout l'état de combat transitoire.
    const livingParty = party.filter((h) => !h.dead && !h.outOfRencontre);
    const heroes = livingParty.map((h, i) => {
      const c = {
        ...JSON.parse(JSON.stringify(h)),
        pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i) },
        advantage: 0,
        conditions: persistentConditions(h), // États persistants seuls (le transitoire est jeté)
        activeEffects: [],                    // buffs en Rounds : ne survivent pas entre combats
        engagedWith: [], // pas d'Engagement hérité d'un combat précédent
        meleeThisRound: [],
        roundsAtZero: 0, // l'horloge de mort lente repart à neuf
        soinRencontreUtilise: false, // nouvelle rencontre → droit à un soin de Blessures (LDB 09 l.233)
        woundDressed: false, // « pansé pendant CE combat » repart à zéro (anti-Infection, LDB 18 l.382)
        tookCriticalThisFight: false, // critique « de ce combat » : repart à zéro
        wounds: { ...h.wounds },
      } as Combatant;
      // Re-dérive les armes ACTIVES depuis les items persistés : une arme usée/détruite au combat
      // précédent (damageTaken/destroyed sur l'ItemInstance) reste usée/détruite (LDB 62 l.177-180).
      if (c.items?.length) recomputeLoadout(c);
      // Munition par défaut + arme à distance chargée au début du combat (le `loaded` ne sert qu'aux armes à Recharge).
      const rw = c.weapons.find((w) => w.type === 'ranged');
      c.loaded = true;
      c.reloadProgress = 0;
      if (rw) c.ammoUid = compatibleAmmo(c, rw)[0]?.uid;
      return c;
    });
    const enemies = enc.enemies.map((e, i) => spawnEnemy(e.ref, e.statblock, `enemy-${i}`, { ...e.pos }, { appearance: e.appearance, weapon: e.weapon }));
    // Combat monté (LDB 14) : marquer les montures rideables, basculer les acteurs « alliés », puis appairer
    // les couples pré-montés (rides → index de la monture dans `enemies`). Le cavalier monte SUR sa monture.
    enc.enemies.forEach((e, i) => {
      if (e.side === 'ally') enemies[i].kind = 'hero';
      if (e.mount) enemies[i].mountable = true;
    });
    enc.enemies.forEach((e, i) => {
      if (e.rides == null) return;
      const mount = enemies[e.rides];
      if (!mount) return;
      mount.mountable = true;
      mountUp(enemies[i], mount); // partage la position/empreinte de la monture (LDB 14 l.215)
    });
    const all = [...heroes, ...enemies];
    // Surprise (LDB 13) : si l'encounter le déclare, le camp embusqué teste Perception vs Discrétion.
    const surpriseLines = enc.surprise ? applySurprise(all, enc.surprise) : [];
    // Initiative : on fixe l'Initiative de chaque combattant (I + 1d10 simplifié).
    for (const c of all) c.initiative = c.characteristics.I + battleRng().int(1, 10);
    const order = initiativeOrder(all).map((c) => c.id);
    const battle: BattleState = {
      combatants: all,
      order,
      baseOrder: order,
      turn: 0,
      round: 1,
      action: null,
      selectedSpell: null,
      reachable: new Map(),
      movementUsed: 0,
      movedPreAction: false,
      acted: false,
      log: [ev('round', `Le combat commence ! (Round 1)`), ...evLines(surpriseLines, 'info')],
      over: null,
      onVictory: onVictory ?? enc.onVictory,
    };
    // Repart d'aucune modale de jet héritée d'un combat/contexte précédent.
    // Ouverture = pause de début du Round 1 (pendingRoundStart) : champ visible, ordre d'Initiative dans la
    // frise, pré-emption « agir en premier » (Chance, #12a) — IA gelée. Un seul bouton « Commencer le combat »
    // (pas de phase « plan d'ensemble » séparée : c'était redondant avec la pause de Round).
    set({ battle, mode: 'battle', pendingRoundStart: { round: battle.round }, pendingVictory: null, pendingAttack: null, pendingReload: null, pendingStateRecovery: null, pendingDefense: null, pendingDeviation: null, pendingMountTarget: null, pendingDisengage: null, pendingCast: null, enemyAim: null, pendingHeal: null, pendingCleave: null, pendingReveals: [], pendingTrample: null, pendingRun: null, pendingFocus: null, pendingPsych: null, pendingEncounterPsych: null, pendingFrenzy: null, pendingFumble: null });
    get().faceAtCombatStart();
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Écran de victoire : assignation du butin (même flux que le marchand) + fermeture ──
  giveItemToHero: (label, heroId) => partyFlow.giveItemToHero(get, set, label, heroId),
  dismissVictory: () => {
    const cont = get().pendingVictory?.onContinue;
    set({ pendingVictory: null, battle: null, mode: 'exploration' });
    if (cont?.length) applyEffects(get, set, cont); // #9 : téléport/dialogue de onVictory APRÈS « Continuer »
  },

  battleSelectAction: (a) => {
    const { battle, scene } = get();
    if (!battle || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // Surpris (LDB 16 l.132) : ni Mouvement ni Action ce tour — seule la Détermination (resolve) peut
    // le retirer (LDB 13 l.81). Tout le reste est bloqué.
    if (hasCondition(active, 'Surpris') && a !== 'resolve' && a !== null) {
      get().log(`${active.name} est Surpris : ni Mouvement ni Action ce tour (Détermination possible).`);
      return;
    }
    // Brisé (LDB 16 l.55) : Mouvement + Action doivent servir à FUIR / se cacher — aucune action
    // offensive. Seuls « move » (fuir), « resolve » (Détermination, qui peut retirer le Brisé) et la
    // fermeture (null) sont permis. (« Se cacher » par Discrétion = pas de système de furtivité en
    // combat ; approximé par « rester hors de vue » → récupération en fin de Round, cf. brokenRecovery.)
    if (hasCondition(active, 'Brisé') && a !== 'move' && a !== 'resolve' && a !== null) {
      get().log(`${active.name} est Brisé : il ne peut que fuir (LDB 16) ou puiser dans sa Détermination.`);
      return;
    }
    // Sonné : pas d'Action (attaque/incantation/soin) ; déplacement, Détermination et l'ouverture des
    // conteneurs (Mouvement/Tir/Objets, simples panneaux dont les feuilles portent leur propre `disabled`)
    // restent possibles (la Détermination ne coûte pas l'Action et peut retirer le Sonné, LDB ch.17 l.62-66).
    const containerMode = a === 'mvt' || a === 'tir' || a === 'objets';
    if (a !== 'move' && a !== 'resolve' && !containerMode && a !== null && !canTakeAction(active)) return;
    let reach = new Map<string, number>();
    if (a === 'move' && movementRemaining(battle, active) > 0) {
      // Engagé : déplacement libre interdit (LDB 15-Dépl l.84) → on entre dans le Désengagement.
      if (isEngaged(active)) {
        // Engagé : ouvre le Désengagement MÊME si l'Action est dépensée — seule l'option A
        // « Sacrifier l'Avantage » (sans coût d'Action) reste dispo (canEsquive=false), ce qui rouvre
        // le mouvement après une attaque SANS permettre de re-tenter l'Esquive (anti-boucle).
        startDisengage(get, set, active);
        return;
      }
      // M-A-M interdit (règle maison) : pas de Mouvement libre une fois l'Action prise si on avait DÉJÀ bougé
      // avant elle. Reach reste vide → aucun déplacement (« Action puis Mouvement » reste, lui, permis).
      if (battle.acted && battle.movedPreAction) {
        set({ battle: { ...battle, action: a, reachable: new Map(), selectedSpell: null } });
        return;
      }
      // Combat monté (LDB 14 l.215) : le cavalier se déplace au Mouvement de sa MONTURE et porte
      // l'empreinte de la monture (géométrie de plateau = la monture, le cavalier la chevauche).
      // Déplacement DÉCOMPOSABLE : la portée du segment courant = Mouvement RESTANT (Marche − déjà parcouru).
      const geom = mountOf(battle, active) ?? active;
      const blocked = occupied(battle, geom);
      reach = reachable(scene, active.pos!, movementRemaining(battle, active), blocked, sizeFootprint(geom.size));
      // Brisé (LDB 16 l.55) : on ne peut FUIR que vers une case qui ne RAPPROCHE d'aucun ennemi.
      if (hasCondition(active, 'Brisé')) {
        const foes = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos);
        if (foes.length) {
          const distNow = Math.min(...foes.map((e) => chebyshev(active.pos!, e.pos!)));
          reach = new Map([...reach].filter(([k]) => {
            const [x, y] = k.split(',').map(Number);
            return Math.min(...foes.map((e) => chebyshev({ x, y }, e.pos!))) >= distNow;
          }));
        }
      }
    }
    // Charge : action COMBINÉE non décomposable → exige le PLEIN Mouvement (movementUsed === 0), pas déjà
    // Engagé, pas À Terre (LDB 16 l.37) et arme de mêlée prête ; portée = Course (2×Mouvement, LDB 15-Dépl l.61,77).
    if (a === 'charge' && battle.movementUsed === 0 && !isEngaged(active) && !hasCondition(active, 'À Terre') && active.weapons[0]?.type === 'melee') {
      const geom = mountOf(battle, active) ?? active;
      const blocked = occupied(battle, geom);
      reach = reachable(scene, active.pos!, mountMovement(battle, active) * 2, blocked, sizeFootprint(geom.size));
    }
    // Quitter le mode incantation oublie le sort sélectionné.
    const selectedSpell = a === 'cast' || a === 'focus' ? battle.selectedSpell : null;
    set({ battle: { ...battle, action: a, reachable: reach, selectedSpell } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Guérison (LDB 09-Compétences l.226-243) — soin de Blessures / arrêt d'Hémorragie ──

  battleHeal: (targetId, mode) => {
    const { battle } = get();
    if (!battle) return;
    const healer = activeCombatant(battle);
    if (!healer || healer.kind !== 'hero' || !hasHealSkill(healer) || battle.acted || !canTakeAction(healer)) return;
    const target = battle.combatants.find((c) => c.id === targetId);
    if (!target || !availableHealModes(target).includes(mode)) return;
    const skillValue = testValue(healer, 'Guérison');
    set({
      pendingHeal: {
        healerId: healer.id, healerName: healer.name, targetId: target.id, targetName: target.name,
        mode, intBonus: bonus(effectiveChar(healer, 'Int')),
        skillValue, difficulty: 'intermediaire', target: skillValue, roll: null, success: false, sl: 0,
        ...(mode === 'surgery' ? { surgeryTargetDR: 7, surgeryCumDR: 0, surgeryTraumaIdx: 0 } : {}),
      },
      battle: { ...battle, action: null },
    });
  },

  healAlly: (targetId, mode) => {
    const party = get().party;
    const target = party.find((c) => c.id === targetId);
    if (!target || !availableHealModes(target).includes(mode)) return;
    // Chirurgie : le soigneur doit AUSSI posséder le Talent Chirurgie (LDB 10) ; sinon n'importe quel soigneur.
    const pool = mode === 'surgery' ? party.filter((c) => hasHealSkill(c) && hasSurgerySkill(c)) : party.filter(hasHealSkill);
    const best = partyBest(pool, 'Guérison');
    if (!best) return;
    const healer = best.actor;
    set({
      pendingHeal: {
        healerId: healer.id, healerName: healer.name, targetId: target.id, targetName: target.name,
        mode, intBonus: bonus(effectiveChar(healer, 'Int')),
        skillValue: best.value, difficulty: 'intermediaire', target: best.value, roll: null, success: false, sl: 0,
        ...(mode === 'surgery' ? { surgeryTargetDR: 7, surgeryCumDR: 0, surgeryTraumaIdx: 0 } : {}),
      },
    });
  },

  /** « Lancer » : effectue le jet de Guérison (Intermédiaire +0). */
  healRoll: () => FLOWS.heal.roll(get, set),
  /** Chance (relance / +1 DR) et Résilience : cf. spec `heal` de rollFlows. */
  healReroll: () => FLOWS.heal.reroll(get, set),
  healBonusSL: () => FLOWS.heal.bonusSL(get, set),
  healForceSuccess: () => FLOWS.heal.forceSuccess(get, set),

  /** « Appliquer » : applique le soin (le jet est déjà figé). Coûte l'Action en combat. */
  healConfirm: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll == null) return;
    if (ph.mode === 'surgery') return; // Chirurgie = Test ÉTENDU multi-passes (surgeryPass), pas un « Appliquer » unique
    set({ pendingHeal: null });
    const st = get();
    const target = actorIn(st, ph.targetId);
    if (!target) return;
    let log: string[];
    if (ph.mode === 'wounds') {
      const r = resolveWoundsHeal(target, ph.intBonus, ph.sl, ph.success, battleRng());
      log = r.log;
      if (r.healed > 0) bus.emit(EVT.ANIM_FLOAT, { to: target.id, text: `+${r.healed}`, kind: 'heal' }); // flottant de soin (R8)
    } else {
      log = ph.mode === 'bleed'
        ? resolveBleedHeal(target, ph.sl, ph.success)
        : ph.success ? treatTrauma(target, ph.sl) : [`${target.name} : le soin du trauma échoue.`]; // mode 'trauma'
    }
    finishPlayerAction(get, set, log, 'heal'); // sortie commune combat / hors combat
  },

  /** Annule avant tout jet (aucun coût). */
  healSetTarget: (targetId) => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll != null || !(ph.candidateIds ?? []).includes(targetId)) return; // choix avant le jet seulement
    const t = get().party.find((c) => c.id === targetId);
    if (!t) return;
    set({ pendingHeal: { ...ph, targetId, targetName: t.name } });
  },

  /** Choix de la Blessure Critique à opérer (avant la 1re passe), s'il y en a plusieurs. */
  surgerySetWound: (idx) => {
    const ph = get().pendingHeal;
    if (!ph || ph.mode !== 'surgery' || (ph.surgeryCumDR ?? 0) > 0) return; // figé dès qu'on a commencé
    set({ pendingHeal: { ...ph, surgeryTraumaIdx: idx } });
  },

  /** Une PASSE de Chirurgie (Test ÉTENDU de Guérison, LDB 10 l.154 / 12 l.200) : on cumule le DR du jet
   *  (repart à 0 s'il passe sous 0) ; CHAQUE passe inflige 1d10 PB + 1 Hémorragie. À la cible atteinte :
   *  retire la Blessure Critique choisie + Test de Résistance +20 ou Infection Mineure. Patient à 0 PB →
   *  opération interrompue (« de fortes chances de tuer », LDB 10). Modale rouverte tant que ce n'est pas fini. */
  surgeryPass: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.mode !== 'surgery') return;
    const target = actorIn(get(), ph.targetId);
    if (!target) { set({ pendingHeal: null }); return; }
    const res = rollTest(ph.skillValue, ph.difficulty, battleRng());
    let cum = (ph.surgeryCumDR ?? 0) + res.sl; // additionne le DR (signé)
    if (cum < 0) cum = 0; // total < 0 → on recommence (LDB 12 l.200)
    const cible = ph.surgeryTargetDR ?? 7;
    const harm = battleRng().int(1, 10); // 1d10 PB + 1 Hémorragie PAR passe (LDB 10 l.154)
    loseWounds(target, harm);
    addCondition(target, 'Hémorragique');
    const log = [`${ph.healerName} opère ${target.name} — passe : DR ${res.sl >= 0 ? '+' : ''}${res.sl} (total ${cum}/${cible}), ${harm} PB + 1 Hémorragie.`];
    if (target.wounds.current <= 0) { // trop risqué de continuer : on interrompt
      log.push(`${target.name} sombre sur la table — l'opération est interrompue (stabilisez-le d'abord).`);
      set({ pendingHeal: null });
      finishPlayerAction(get, set, log, 'heal');
      return;
    }
    if (cum >= cible) { // cible atteinte : la Blessure Critique est réparée
      log.push(...removeSurgicalTrauma(target, ph.surgeryTraumaIdx ?? 0));
      const resVal = effectiveChar(target, 'E') + (target.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
      log.push(...rollContraction(target, 'Infection Mineure', resVal, 'accessible', battleRng())); // LDB 10 l.365
      set({ pendingHeal: null });
      finishPlayerAction(get, set, log, 'heal');
      return;
    }
    set({ pendingHeal: { ...ph, surgeryCumDR: cum, roll: res.roll, sl: res.sl, success: res.success }, ...touchActors(get()) });
    get().log(log[0]);
  },

  /** #16 : BANDER les Blessures pendant la Chirurgie (Test de Guérison Intermédiaire, +BI+DR PB) —
   *  pour empêcher le patient de sombrer à 0 PB sans interrompre l'opération. N'avance pas le DR. */
  surgeryBandage: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.mode !== 'surgery') return;
    const target = actorIn(get(), ph.targetId);
    if (!target || target.wounds.current >= target.wounds.max) return;
    const res = rollTest(ph.skillValue, ph.difficulty, battleRng());
    const { log } = resolveWoundsHeal(target, ph.intBonus, res.sl, res.success, battleRng());
    set({ pendingHeal: { ...ph }, ...touchActors(get()) });
    for (const l of log) get().log(l);
  },

  /** #16 : ARRÊTER l'Hémorragie que les passes de Chirurgie infligent (Test de Guérison, retire 1+DR
   *  pions) — sans interrompre l'opération. N'avance pas le DR. */
  surgeryStopBleed: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.mode !== 'surgery') return;
    const target = actorIn(get(), ph.targetId);
    if (!target || !(target.conditions ?? []).some((c) => c.name === 'Hémorragique' && c.value > 0)) return;
    const res = rollTest(ph.skillValue, ph.difficulty, battleRng());
    const log = resolveBleedHeal(target, res.sl, res.success);
    set({ pendingHeal: { ...ph }, ...touchActors(get()) });
    for (const l of log) get().log(l);
  },

  healCancel: () => set({ pendingHeal: null }),

  /** Sélectionne un sort à incanter ; le clic suivant sur une cible le lance. */
  battleSelectSpell: (label) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || battle.acted) return;
    set({ battle: { ...battle, action: 'cast', selectedSpell: label, reachable: new Map() } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  battleUseItem: (uid) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (battle.acted || !canTakeAction(active)) return; // boire = une Action ; Sonné = pas d'Action
    const it = (active.items ?? []).find((i) => i.uid === uid);
    if (!it) return;
    const eff = itemUse(it, active);
    if (!eff) return;
    const log = [`${active.name} utilise : ${it.name}.`, ...applyItemUse(active, eff)];
    active.items = (active.items ?? []).filter((i) => i.uid !== uid); // consommé
    active.aiming = false; // une autre action que le tir gâche la visée
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ...evLines(log, 'item', active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  usePartyItem: (heroId, uid) => partyFlow.usePartyItem(get, set, heroId, uid),

  // Le flux d'incantation est COMMUN au combat et au hors-combat (couture D) : les acteurs sont
  // résolus dans `battle.combatants` OU `party` via `actorIn` (combatOrParty). Aucune branche d'effet dupliquée.
  castRoll: () => {
    const { pendingCast: pc } = get();
    if (!pc || pc.result) return;
    const caster = actorIn(get(), pc.casterId);
    const target = actorIn(get(), pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell) return;
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused)
      : resolveCasting(caster, spell, battleRng(), 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res } });
  },
  castReroll: () => {
    const { pendingCast: pc } = get();
    if (!pc || !pc.result) return;
    // Échec d'incantation = d100 propre > cible (roll > target), 1× max.
    if (!canReroll(pc.result.roll > pc.result.target, !!pc.rerolled)) return;
    const caster = actorIn(get(), pc.casterId);
    const target = actorIn(get(), pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1; // Chance : relance le jet d'incantation
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused)
      : resolveCasting(caster, spell, battleRng(), 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res, rerolled: true }, ...touchActors(get()) });
  },
  /** Chance « +1 DR » : +1 DR à l'incantation figée (peut franchir le NI), cumulable. */
  castBonusSL: () => {
    const { pendingCast: pc } = get();
    if (!pc || !pc.result) return;
    const caster = actorIn(get(), pc.casterId);
    const target = actorIn(get(), pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1;
    const res = rederiveCastSL(caster, target, spell, pc.result, pc.missile, pc.focused, 1);
    set({ pendingCast: { ...pc, result: res }, ...touchActors(get()) });
  },
  castConfirm: () => {
    const { pendingCast: pc } = get();
    if (!pc || !pc.result) return;
    const caster = actorIn(get(), pc.casterId);
    const target = actorIn(get(), pc.targetId);
    const spell = findSpell(pc.spellLabel);
    set({ pendingCast: null });
    if (caster && target && spell) applyCast(get, set, caster, target, spell, pc.result, pc.missile, pc.focused);
  },
  castCancel: () => set({ pendingCast: null }),
  /** Ouvre une incantation HORS COMBAT (couture D) : un héros lanceur du groupe cible self/allié.
   *  Réservé aux sorts NON-offensifs — les Projectiles magiques exigent une cible ennemie (combat). */
  oocCastSpell: (casterId, label, targetId) => {
    const { battle, party } = get();
    if (battle) return; // en combat : l'incantation passe par l'action de combat
    const caster = party.find((c) => c.id === casterId);
    const spell = findSpell(label);
    if (!caster || !spell) return;
    if (isMagicMissile(spell)) {
      get().log(`${spell.label} est un Projectile magique — il faut une cible ennemie (en combat).`);
      return;
    }
    const target = party.find((c) => c.id === targetId) ?? caster;
    castSpell(get, set, caster, target, label); // pose `pendingCast` (missile:false, focused selon caster.focus)
  },

  /** Focalise un sort d'Arcane/Domaine (Test étendu de Focalisation). */
  battleFocusSpell: (label) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || battle.acted) return;
    const spell = findSpell(label);
    if (!spell || !isArcaneSpell(spell)) {
      get().log('Ce sort ne peut pas être focalisé.');
      return;
    }
    // OUVRE la modale (le Test étendu se fait au clic « Lancer ») — « un jet = une modale ».
    set({ pendingFocus: { casterId: active.id, spellLabel: label, result: null } });
  },
  // Focalisation COMMUNE combat/hors-combat (couture D) : acteur via `actorIn`, sortie journal hors combat.
  focusRoll: () => FLOWS.focus.roll(get, set),
  focusReroll: () => FLOWS.focus.reroll(get, set),
  focusBonusSL: () => FLOWS.focus.bonusSL(get, set),
  focusForceSuccess: () => FLOWS.focus.forceSuccess(get, set),
  focusConfirm: () => {
    const { pendingFocus: pf } = get();
    if (!pf || !pf.result) return;
    const caster = actorIn(get(), pf.casterId);
    const spell = findSpell(pf.spellLabel);
    set({ pendingFocus: null });
    if (!caster || !spell) return;
    const res = pf.result;
    const prev = caster.focus?.spell === pf.spellLabel ? caster.focus.dr : 0;
    caster.focus = { spell: pf.spellLabel, dr: prev + res.dr };
    const ni = spell.cn ?? 0;
    const logLines = [res.log, caster.focus.dr >= ni ? `${caster.name} a focalisé assez de magie pour lancer ${spell.label} (NI 0).` : `Focalisation : ${caster.focus.dr}/${ni} DR.`];
    // Maladresse en Focalisation → Incantation Imparfaite Majeure (LDB l.191).
    if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'majeure'));
    finishPlayerAction(get, set, logLines, 'focus'); // sortie commune combat / hors combat
  },
  focusCancel: () => set({ pendingFocus: null }),
  /** Ouvre une Focalisation HORS COMBAT (couture D) : accumule `caster.focus` pour un Sort d'Arcane/Domaine. */
  oocFocusSpell: (casterId, label) => {
    const { battle, party } = get();
    if (battle) return; // en combat : Focalisation = action de combat
    const caster = party.find((c) => c.id === casterId);
    const spell = findSpell(label);
    if (!caster || !spell) return;
    if (!isArcaneSpell(spell)) {
      get().log('Ce sort ne peut pas être focalisé.');
      return;
    }
    set({ pendingFocus: { casterId: caster.id, spellLabel: label, result: null } });
  },
  // ── Test de Psychologie héros (Peur/Terreur, LDB 21) ── (pas d'« Annuler » : le Test est obligatoire)
  psychRoll: () => FLOWS.psych.roll(get, set),
  psychReroll: () => FLOWS.psych.reroll(get, set),
  psychBonusSL: () => FLOWS.psych.bonusSL(get, set),
  psychForceSuccess: () => FLOWS.psych.forceSuccess(get, set),
  psychResolve: () => {
    // Détermination (LDB 17 l.62) : immunité TEMPORAIRE à la Psychologie (ce Round + le prochain) — elle
    // RETARDE/ignore la Peur, elle ne la SURMONTE PAS (l'Indice reste). On ferme donc le Test sans le
    // résoudre comme « vaincu » : le héros agit, immunisé, et la Peur re-testera quand l'immunité expire.
    const { battle, pendingPsych: pp } = get();
    if (!battle || !pp) return;
    const c = battle.combatants.find((x) => x.id === pp.combatantId);
    if (!c) return;
    const msg = spendResolveForPsychImmunity(c); // MÊME logique que la barre d'action (pas de duplication)
    if (!msg) return;
    set({ pendingPsych: null, battle: { ...battle, log: [...battle.log, ev('info', msg, c.id)] }, ...touchActors(get()) });
  },
  psychConfirm: () => {
    const { battle, pendingPsych: pp } = get();
    if (!battle || !pp || !pp.result) return;
    const c = battle.combatants.find((x) => x.id === pp.combatantId);
    set({ pendingPsych: null });
    if (c) {
      c.psychState ??= [];
      const r = pp.result;
      const log: string[] = [];
      if (CIBLE_TYPES.has(pp.kind)) {
        // Trait ciblé (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie) : échec → affliction active
        // (effets de combat/Soc/contrainte) ; succès → marqueur inerte (résisté, pas de re-déclenchement).
        let e = c.psychState.find((p) => p.type === pp.kind && p.cible === pp.cible);
        if (!e) { e = { type: pp.kind, cible: pp.cible, sourceId: pp.sourceId }; c.psychState.push(e); }
        e.lastTestRound = battle.round;
        e.active = !r.success;
        log.push(r.success ? `${c.name} maîtrise son ${pp.kind}.` : `${c.name} est en proie à son ${pp.kind}${pp.cible ? ` (${pp.cible})` : ''}.`);
      } else if (pp.kind === 'terreur') {
        if (!r.success && (r.brise ?? 0) > 0) {
          addCondition(c, 'Brisé', r.brise!);
          log.push(`${c.name} est terrifié : ${r.brise} État(s) Brisé.`);
        }
        // La Terreur devient une Peur d'Indice équivalent (0 si réussie → inerte).
        c.psychState.push({ type: 'peur', sourceId: pp.sourceId, indice: r.success ? 0 : (r.devientPeur ?? pp.indice), calmeDR: 0, lastTestRound: battle.round });
      } else {
        let e = c.psychState.find((p) => p.sourceId === pp.sourceId);
        if (!e) { e = { type: 'peur', sourceId: pp.sourceId, indice: pp.indice, calmeDR: 0 }; c.psychState.push(e); }
        e.calmeDR = r.calmeDR ?? 0;
        e.lastTestRound = battle.round;
        log.push(r.vaincue ? `${c.name} surmonte sa peur.` : `${c.name} reste sous l'emprise de la Peur (${e.calmeDR}/${pp.indice} DR).`);
      }
      set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'fear', c.id)] } });
    }
    maybeOpenHeroPsych(get, set); // enchaîne le Test suivant s'il en reste, sinon ferme
  },

  // ── Psychologie À LA RENCONTRE, hors combat (couture C, LDB 21) : délégué à `encounterPsychFlow`
  //    (self-contained pour limiter la collision avec la session « rig »). « Un jet = une modale ». ──
  encounterPsychRoll: () => encounterPsychRollFlow(get, set),
  encounterPsychReroll: () => encounterPsychRerollFlow(get, set),
  encounterPsychForceSuccess: () => encounterPsychForceSuccessFlow(get, set),
  encounterPsychConfirm: () => encounterPsychConfirmFlow(get, set),
  encounterPsychResolve: () => encounterPsychResolveFlow(get, set),

  // ── Entrée en Frénésie d'un héros (LDB 21 l.31-36) : Test de FM, succès → +1 BF / immunité psy / attaque obligatoire ──
  battleFrenzy: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.frenzied || !isFrenzyCapable(active)) return;
    // OUVRE la modale — le Test de FM se fait au clic « Lancer » (« un jet = une modale »).
    set({ pendingFrenzy: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
  },
  frenzyRoll: () => FLOWS.frenzy.roll(get, set),
  frenzyReroll: () => FLOWS.frenzy.reroll(get, set),
  frenzyForceSuccess: () => FLOWS.frenzy.forceSuccess(get, set),
  frenzyConfirm: () => {
    const { battle, pendingFrenzy: pf } = get();
    if (!battle || !pf || !pf.result) return;
    const c = battle.combatants.find((x) => x.id === pf.combatantId);
    set({ pendingFrenzy: null });
    if (!c) return;
    const log = pf.result.success
      ? [`${c.name} entre en Frénésie : +1 Bonus de Force, immunité psychologique, doit attaquer (LDB 21).`]
      : [`${c.name} ne parvient pas à entrer en Frénésie (Test de Force Mentale échoué).`];
    if (pf.result.success) c.frenzied = true;
    set({ battle: { ...get().battle!, acted: true, action: null, log: [...battle.log, ...evLines(log, 'frenzy', c.id)] } });
    checkBattleOver(get, set);
  },
  frenzyCancel: () => set({ pendingFrenzy: null }),

  battleClickTile: (pt) => {
    const { battle, scene } = get();
    if (!battle || !scene || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (battle.action === 'move' && canMove(battle, active)) {
      const k = `${pt.x},${pt.y}`;
      if (!battle.reachable.has(k)) return;
      const stepCost = battle.reachable.get(k) ?? 0; // coût (cases) du segment, à imputer au Mouvement du Tour
      // Peur (LDB 21 l.29) : impossible de s'APPROCHER de la source tant qu'on est sous son emprise
      // (sauf immunité à la Psychologie — trait/Frénésie/Détermination, LDB 17 l.62).
      if (!isPsychImmune(active))
        for (const p of active.psychState ?? []) {
          if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 1)) continue;
          const src = battle.combatants.find((c) => c.id === p.sourceId);
          if (src?.pos && chebyshev(pt, src.pos) < chebyshev(active.pos!, src.pos)) {
            get().log(`${active.name} ne peut pas s'approcher de ${src.name} : la Peur le paralyse.`);
            return;
          }
        }
      // Annulation (R6/LOT 6) : au PREMIER segment du Tour (movementUsed === 0), on capture l'état
      // positionnel AVANT de bouger, pour pouvoir tout annuler tant qu'aucune Action n'a été prise.
      const snapshot =
        (battle.movementUsed ?? 0) === 0
          ? {
              pos: Object.fromEntries(battle.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
              facing: { ...get().facing },
              movedPreAction: battle.movedPreAction,
            }
          : battle.moveSnapshot ?? null;
      // Combat monté : la géométrie (empreinte/collisions) est celle de la MONTURE ; le cavalier la suit.
      const geom = mountOf(battle, active) ?? active;
      const blocked = occupied(battle, geom);
      const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size));
      active.pos = { ...pt };
      if (geom !== active) geom.pos = { ...pt }; // déplace la monture sous le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.308-309)
      get().faceFromPath(active.id, path);
      if (geom !== active) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      // Mouvement décomposable : cumule le coût du segment ; on retombe en mode neutre (action: null) →
      // le joueur peut re-cliquer « Déplacer » (s'il reste du Mouvement) OU enchaîner une Action. Si ce
      // segment précède l'Action, on marque `movedPreAction` (verrouille tout Mouvement post-Action).
      set({ battle: { ...battle, moveSnapshot: snapshot, movementUsed: (battle.movementUsed ?? 0) + stepCost, movedPreAction: battle.movedPreAction || !battle.acted, action: null, reachable: new Map() } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  },

  cancelMove: () => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const snap = battle.moveSnapshot;
    const active = activeCombatant(battle);
    // Aide PRÉ-Action uniquement : on n'annule que tant qu'aucune Action n'a été prise ce Tour (sinon
    // l'Action aurait été résolue depuis une position désormais effacée). Rien à annuler sans segment.
    if (!snap || !active || active.kind !== 'hero' || battle.acted || (battle.movementUsed ?? 0) === 0) return;
    for (const c of battle.combatants) {
      const p = snap.pos[c.id];
      if (p) c.pos = { ...p }; // restaure TOUS (un grand a pu en déplacer d'autres sous son empreinte)
    }
    set({
      facing: { ...snap.facing },
      battle: { ...battle, movementUsed: 0, movedPreAction: snap.movedPreAction, moveSnapshot: null, action: null, reachable: new Map() },
    });
    bus.emit(EVT.SCENE_DIRTY);
  },

  battleClickEntity: (id, skipMountChoice) => {
    const { battle, scene } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // Piétinement : action GRATUITE (autorisée même Action consommée). Précède le verrou `battle.acted`.
    if (battle.action === 'trample') {
      get().battleTrample(id);
      return;
    }
    // Attaque GRATUITE de Frénésie (Test de CC non soumis à l'Action, LDB 21 l.34) : reste possible même
    // l'Action dépensée — y compris le tour où l'on entre en Frénésie (le Test de FM a consommé l'Action).
    const freeFrenzyAttack = battle.action === 'attack' && active.frenzied && !active.frenzyFreeUsed;
    if (battle.acted && !freeFrenzyAttack) return;
    const target = battle.combatants.find((c) => c.id === id);
    if (!target) return;
    if (battle.action === 'cast' && battle.selectedSpell) {
      // L'incantation peut viser un allié, un ennemi ou soi-même.
      castSpell(get, set, active, target, battle.selectedSpell);
      return;
    }
    // Combat monté (LDB 14 l.219) : frapper un couple cavalier+monture → choisir lequel (le cavalier OU
    // la monture). On n'ouvre la modale qu'une fois (skipMountChoice évite la ré-entrée après le choix).
    if (!skipMountChoice && (battle.action === 'attack' || battle.action === 'charge')) {
      const rider = target.mountId ? target : battle.combatants.find((c) => c.id === target.riderId);
      const mount = target.riderId ? target : battle.combatants.find((c) => c.id === target.mountId);
      if (rider && mount && rider.kind !== 'hero' && mount.kind !== 'hero' && !isOutOfAction(rider) && !isOutOfAction(mount)) {
        set({ pendingMountTarget: { riderId: rider.id, mountId: mount.id } });
        return;
      }
    }
    if (battle.action === 'charge') {
      // Charge (LDB 15-Dépl l.74-77) : se ruer au contact d'un ennemi (portée de Course) puis attaquer.
      if (!scene || target.kind === 'hero' || isEngaged(active)) return; // pas de Charge si déjà Engagé (l.74)
      // Combat monté : on charge à la portée de Course de la MONTURE, sous son empreinte (couple solidaire).
      const geom = mountOf(battle, active) ?? active;
      const blocked = occupied(battle, geom);
      const charM = mountMovement(battle, active);
      const reach = reachable(scene, active.pos!, charM * 2, blocked, sizeFootprint(geom.size)); // portée de Course
      const dest = bestAdjacentReachable(reach, target.pos!);
      if (!dest) {
        get().log('Cible hors de portée de Charge.');
        return;
      }
      const distFrom = chebyshev(active.pos!, target.pos!); // distance de combat AVANT déplacement (l.77 ; ≤ 2M+1 pour toute charge valide)
      const adv = chargeAdvantage(charM, distFrom);
      const path = pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size));
      active.pos = { ...dest };
      if (geom !== active) geom.pos = { ...dest }; // la monture charge sous le cavalier
      displaceSmaller(get, geom); // charge d'un grand : idem dégage les plus petits (85 l.308-309)
      get().faceFromPath(active.id, path);
      if (geom !== active) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      active.advantage += adv; // +1/+2 « en fonçant » (l.77,102), AVANT le jet (profite au toucher)
      active.gainedAdvThisRound = true;
      set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: 'attack', log: [...battle.log, ev('charge', `${active.name} charge ${target.name} (+${adv} Avantage).`, active.id, target.id)] } });
      set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true } });
      return;
    }
    if (battle.action !== 'attack') return;
    if (target.kind === 'hero') return; // l'attaque ne vise que les ennemis
    // Arme effectivement employée selon la distance (mêlée à portée d'Allonge, distance sinon) — PAS
    // weapons[0], sinon un héros mixte mêlée+distance ne pourrait jamais tirer une cible éloignée (LDB
    // Armes l.297-298). Portée de mêlée = Allonge de l'arme (RAW-3, LDB 62 l.211/213), footprint inclus.
    const adj = combatDistance(active, target) <= meleeReachTiles(active.weapons);
    const w = attackWeapon(active.weapons, adj);
    if (!adj && w.type === 'melee') {
      get().log('Cible hors de portée de mêlée.'); // aucune arme à distance dispo → mêlée hors de portée
      return;
    }
    // Tir héros : une munition compatible est toujours requise ; l'arme « chargée » ne concerne QUE les
    // armes à défaut Recharge (un Arc, sans Recharge, tire chaque Round sans recharger — LDB Armes).
    if (w.type === 'ranged' && active.kind === 'hero') {
      if ((w.reload ?? 0) > 0 && !active.loaded) {
        get().log(`${active.name} doit recharger ${w.name}.`);
        return;
      }
      if (!selectedAmmo(active, w)) {
        get().log(`${active.name} n'a plus de munitions pour ${w.name}.`);
        return;
      }
    }
    // Ouvre la modale d'attaque (le jet se fait après le clic « Lancer »).
    set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null } });
  },

  battleEndTurn: () => advanceTurn(get, set),

  // ── Chance, 3e usage : pré-emption d'initiative en début de Round (LDB ch.17 l.27) ──
  roundStartPromote: (heroId) => {
    const { battle, pendingRoundStart } = get();
    if (!battle || !pendingRoundStart) return;
    const hero = battle.combatants.find((c) => c.id === heroId);
    if (!hero || hero.kind !== 'hero' || (hero.fortune ?? 0) <= 0) return;
    if (battle.order[0] === heroId) return; // déjà en tête
    hero.fortune = (hero.fortune ?? 0) - 1;
    const order = [heroId, ...battle.order.filter((id) => id !== heroId)]; // en tête de l'ordre du Round
    set({ battle: { ...battle, order, log: [...battle.log, ev('info', `${hero.name} choisit d'agir en premier (Chance).`, hero.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  confirmRoundStart: () => {
    const battle = get().battle;
    set({ pendingRoundStart: null });
    if (!battle) return;
    // Premier combattant valide de l'ordre (réordonné) à partir de l'index 0.
    let turn = 0;
    for (let i = 0; i < battle.order.length; i++) {
      const c = battle.combatants.find((x) => x.id === battle.order[i]);
      if (c && !isOutOfAction(c)) {
        turn = i;
        break;
      }
    }
    const active = battle.combatants.find((c) => c.id === battle.order[turn]);
    if (active) active.defensiveStance = false;
    set({ battle: { ...battle, turn, action: null, movementUsed: 0, movedPreAction: false, acted: false, reachable: new Map() } });
    if (checkBattleOver(get, set)) return;
    bus.emit(EVT.SCENE_DIRTY);
    maybeOpenHeroPsych(get, set); // Test de Calme du héros actif (Peur/Terreur, LDB 21) avant qu'il agisse
    maybeRunEnemyTurn(get, set);
  },

  // ── Destin sacrifié (LDB ch.17 l.31-35) — résolution de la suspension pendingFateSave ──
  fateNegate: () => {
    const { battle, pendingFateSave: p } = get();
    if (!battle || !p || p.source !== 'hit') return; // « Comment ça a pu rater ? » : coup létal seulement
    const hero = battle.combatants.find((c) => c.id === p.heroId);
    set({ pendingFateSave: null });
    if (!hero) return;
    hero.fate = (hero.fate ?? 0) - 1;
    if (p.restoreWounds != null) hero.wounds.current = p.restoreWounds; // annule tout le coup (restaure les PB)
    hero.criticalWounds = Math.max(0, (hero.criticalWounds ?? 0) - 1);
    set({ battle: { ...battle, log: [...battle.log, ev('info', `${hero.name} : « Comment ça a pu rater ? » — le coup fatal est évité (Destin −1).`, hero.id)] } });
    resumeEnemyTurn(get, set);
  },
  fateSurvive: () => {
    const { battle, pendingFateSave: p } = get();
    if (!battle || !p) return;
    const hero = battle.combatants.find((c) => c.id === p.heroId);
    const source = p.source;
    set({ pendingFateSave: null });
    if (!hero) return;
    hero.fate = (hero.fate ?? 0) - 1;
    hero.outOfRencontre = true; // survit mais éjecté de la rencontre (vivant)
    if (!hero.conditions.some((c) => c.name === 'Inconscient')) addCondition(hero, 'Inconscient');
    set({ battle: { ...battle, log: [...battle.log, ev('info', `${hero.name} : « Meurs un autre jour » — survit mais quitte le combat (Destin −1).`, hero.id)] } });
    if (source === 'slow') resolveRoundBoundary(get, set);
    else resumeEnemyTurn(get, set);
  },
  fateAccept: () => {
    const { battle, pendingFateSave: p } = get();
    if (!battle || !p) return;
    const hero = battle.combatants.find((c) => c.id === p.heroId);
    const source = p.source;
    set({ pendingFateSave: null });
    if (hero) {
      hero.dead = true;
      set({ battle: { ...battle, log: [...battle.log, ev('death', `${hero.name} succombe.`, hero.id)] } });
    }
    if (source === 'slow') resolveRoundBoundary(get, set);
    else resumeEnemyTurn(get, set);
  },

  battleDefendTotal: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (!canTakeAction(active)) return; // Sonné : pas d'Action (LDB États l.123)
    active.defensiveStance = true;
    active.aiming = false; // une autre action que le tir gâche la visée
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('defensive', `${active.name} se met sur la défensive (+20 en défense).`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Changer de set d'armes en combat (Action gratuite, 1/tour, AUTORISÉ même Engagé — LDB 13 l.116) ──
  battleSwitchLoadout: (loadoutId) => {
    const battle = get().battle;
    if (!battle || battle.over || battle.loadoutSwapped) return; // 1 switch gratuit / tour
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.activeLoadoutId === loadoutId) return;
    loadoutSetActive(active, loadoutId);
    recomputeLoadout(active); // re-dérive les armes actives du combattant
    const name = active.loadouts?.find((l) => l.id === loadoutId)?.name ?? 'set';
    set({ battle: { ...battle, loadoutSwapped: true, log: [...battle.log, ev('detail', `${active.name} dégaine : ${name}.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Action Viser (LDB table des Difficultés, 14 - _GoBack.md l.90 : +20 au prochain tir, sans jet) ──
  battleAim: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
    if (!active.weapons.some((w) => w.type === 'ranged')) return; // viser = pour le tir
    active.aiming = true;
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('aim', `${active.name} vise soigneusement (+20 au prochain tir).`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Rechargement = Test étendu de Projectiles (LDB 63-Armures l.28-29 + 12-Tests l.199-211) — par modale ──
  battleReload: () => {
    const { battle } = get();
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
    const w = active.weapons.find((x) => x.type === 'ranged');
    if (!w || (w.reload ?? 0) <= 0 || active.loaded) return; // rien à recharger (Arc = pas de défaut, ou déjà chargé)
    const skillValue = combatValue(active, 'ranged', w); // CT + avances Projectiles (Spé du groupe d'arme)
    set({
      pendingReload: {
        actorId: active.id,
        actorName: active.name,
        weaponName: w.name,
        reload: w.reload ?? 0,
        progressBefore: active.reloadProgress ?? 0,
        skillValue,
        difficulty: 'intermediaire',
        roll: null,
        target: skillValue + DIFFICULTY_MODIFIERS.intermediaire,
        sl: 0,
        success: false,
      },
    });
  },
  reloadRoll: () => FLOWS.reload.roll(get, set),
  reloadReroll: () => FLOWS.reload.reroll(get, set),
  reloadBonusSL: () => FLOWS.reload.bonusSL(get, set),
  reloadConfirm: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    const a = battle.combatants.find((c) => c.id === pr.actorId);
    set({ pendingReload: null });
    if (!a) return;
    a.aiming = false; // recharger est une autre action → la visée est perdue
    const progress = Math.max(0, pr.progressBefore + pr.sl); // Test étendu : cumul des DR, plancher 0 (recommence)
    let log: string;
    if (progress >= pr.reload) {
      a.loaded = true;
      a.reloadProgress = 0;
      log = `${a.name} a rechargé ${pr.weaponName}.`;
    } else {
      a.reloadProgress = progress;
      log = `${a.name} recharge ${pr.weaponName} (${progress}/${pr.reload} DR).`;
    }
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('reload', log, a.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  reloadCancel: () => set({ pendingReload: null }), // avant le jet : aucun coût
  battleRecoverState: (state) => {
    const { battle } = get();
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
    const n = stacks(active, state);
    if (n <= 0) return; // pas porteur de l'État
    // Empêtré : Test OPPOSÉ de Force contre la source vivante (LDB 16 l.61) ; sinon Test simple.
    let opposed = false, opponentValue: number | undefined, opponentName: string | undefined;
    if (state === 'Empêtré') {
      const srcId = active.conditions.find((c) => c.name === 'Empêtré')?.sourceId;
      const src = srcId ? battle.combatants.find((c) => c.id === srcId && !isOutOfAction(c)) : undefined;
      if (src) { opposed = true; opponentValue = testValue(src, undefined, 'F'); opponentName = src.name; }
    }
    const skillValue = state === 'Empêtré' ? testValue(active, undefined, 'F') : testValue(active, 'Athlétisme');
    set({
      pendingStateRecovery: {
        actorId: active.id, actorName: active.name, state,
        skillLabel: state === 'Empêtré' ? 'Force' : 'Athlétisme',
        skillValue, difficulty: 'intermediaire',
        opposed, opponentValue, opponentName, stacks: n,
        roll: null, opponentRoll: null, netSL: 0, success: false,
      },
    });
  },
  recoverRoll: () => FLOWS.recover.roll(get, set),
  recoverReroll: () => FLOWS.recover.reroll(get, set),
  recoverBonusSL: () => FLOWS.recover.bonusSL(get, set),
  recoverConfirm: () => {
    const { battle, pendingStateRecovery: sr } = get();
    if (!battle || !sr || sr.roll == null) return;
    const a = battle.combatants.find((c) => c.id === sr.actorId);
    set({ pendingStateRecovery: null });
    if (!a) return;
    const removed = recoveredStacks(sr.netSL, stacks(a, sr.state), sr.success); // 1 + DR, borné
    const lines: string[] = [];
    if (removed > 0) {
      removeCondition(a, sr.state, removed);
      lines.push(sr.state === 'Empêtré'
        ? `${a.name} se libère (${removed} État${removed > 1 ? 's' : ''} Empêtré retiré${removed > 1 ? 's' : ''}).`
        : `${a.name} étouffe les flammes (${removed} État${removed > 1 ? 's' : ''} En flammes retiré${removed > 1 ? 's' : ''}).`);
    } else lines.push(sr.state === 'Empêtré' ? `${a.name} ne parvient pas à se libérer.` : `${a.name} ne parvient pas à éteindre les flammes.`);
    finishPlayerAction(get, set, lines, 'condition'); // consomme l'Action
  },
  recoverCancel: () => set({ pendingStateRecovery: null }), // avant le jet : aucun coût
  battleSelectAmmo: (uid) => {
    const { battle } = get();
    if (!battle) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    active.ammoUid = uid;
    set({ battle: { ...battle } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Détermination (Resolve) : retirer un État de l'actif, +1 PB si À Terre (LDB ch.17 l.62-66) ──
  battleSpendResolve: (conditionName) => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || (active.resolve ?? 0) <= 0) return;
    if (!active.conditions.some((c) => c.name === conditionName)) return;
    active.resolve = (active.resolve ?? 0) - 1;
    removeCondition(active, conditionName, 1); // « Retirez un État » (un pion), LDB ch.17 l.66
    let extra = '';
    if (conditionName === 'À Terre') {
      active.wounds.current = Math.min(active.wounds.max, active.wounds.current + 1); // +1 PB en se relevant (l.66)
      extra = ' (+1 PB en se relevant)';
    }
    set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', `${active.name} puise dans sa Détermination : retire l'État ${conditionName}${extra}.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  /** Détermination (LDB 17 l.62) : immunisé à la Psychologie jusqu'à la fin du PROCHAIN Round. */
  battleResolvePsychImmune: () => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    const msg = spendResolveForPsychImmunity(active); // SOURCE UNIQUE de l'immunité par Détermination
    if (!msg) return;
    set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', msg, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  /** Détermination (LDB 17 l.64) : ignore les modificateurs de Blessure critique jusqu'au début du prochain Round. */
  battleResolveIgnoreCrit: () => {
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || (active.resolve ?? 0) <= 0) return;
    active.resolve = (active.resolve ?? 0) - 1;
    active.ignoreCritMods = true; // effacé au début du prochain Round (passage de Round)
    set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', `${active.name} puise dans sa Détermination : ignore les modificateurs de Blessure critique ce Round.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Ramasser un objet au sol pendant un Round (un à la fois, LDB ch.13 l.115-116) ──
  battlePickup: (entityId, key) => {
    const { battle, scene } = get();
    if (!battle || battle.over || battle.acted || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return; // ramasser = une Action
    if (get().flags[`__fouille_${entityId}`]) return; // déjà entièrement fouillé en exploration
    const ent = scene.entities.find((e) => e.id === entityId && e.kind === 'prop' && !!e.interact);
    if (!ent || !ent.interact || !active.pos || chebyshev(active.pos, ent.pos) > 1) return; // doit être adjacent/sur la case
    const [tag, idxStr] = key.split(':');
    if (tag !== 'eff') return; // clé = `eff:<index dans interact.effects>` (cf. entityPickables)
    const idx = Number(idxStr);
    const eff = ent.interact.effects[idx];
    if (!eff) return;
    let label: string; // assigné dans chaque branche atteignant l'usage (le cas `else` renvoie)
    if (eff.type === 'giveTrapping') {
      const it = itemFromTrapping(eff.trapping);
      if (!it) {
        get().log(`Objet inconnu : « ${eff.trapping} ».`);
        return;
      }
      label = it.name;
      // ajout NON équipé au combattant actif (clone battle) ET au membre party (persiste post-combat).
      active.items = [...(active.items ?? []), it];
      recomputeLoadout(active);
      set((s) => ({
        party: s.party.map((h) => {
          if (h.id !== active.id) return h;
          const clone: Combatant = JSON.parse(JSON.stringify(h));
          clone.items = [...(clone.items ?? []), itemFromTrapping(eff.trapping)!];
          recomputeLoadout(clone);
          return clone;
        }),
      }));
    } else if (eff.type === 'giveItem') {
      label = eff.item;
      set((s) => ({ inventory: [...s.inventory, eff.item] })); // nom dans l'inventaire de groupe
    } else if (eff.type === 'giveMoney') {
      label = 'Argent';
      applyEffects(get, set, [eff]); // bourse party (or/argent/cuivre)
    } else return; // effet non ramassable (journal/document…) : pas grappillable en combat
    ent.interact.effects = ent.interact.effects.filter((_, j) => j !== idx); // retire du pool partagé
    // Pool de ramassables vidé : `consume` → le décor disparaît ; sinon il reste (ses Effets non-objet
    // — journal/document — restent fouillables en exploration ; pas de sens à les grappiller en combat).
    if (entityPickables(ent).length === 0 && ent.interact.consume) {
      removeEntity(get, set, entityId);
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('item', `${active.name} ramasse : ${label}.`, active.id)] } });
    } else {
      set({ scene: { ...scene }, battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('item', `${active.name} ramasse : ${label}.`, active.id)] } });
    }
    bus.emit(EVT.SCENE_DIRTY);
  },

  attackSetLocation: (loc) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // la visée ne change plus après le jet
    set({ pendingAttack: { ...pa, location: loc } });
  },
  attackSetWeapon: (uid) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // choix d'arme avant le jet seulement
    set({ pendingAttack: { ...pa, weaponUid: uid ?? undefined } });
  },
  attackSetDualMode: (on) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // choix avant le jet seulement
    // Mode « des deux armes » : l'attaque-Action utilise la MAIN DIRECTRICE (la 2ᵉ frappe suit, off-hand).
    const a = get().battle?.combatants.find((c) => c.id === pa.attackerId);
    const mainUid = a?.weapons.find((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)?.uid;
    set({ pendingAttack: { ...pa, dualMode: on, weaponUid: on ? (mainUid ?? pa.weaponUid) : pa.weaponUid } });
  },
  attackSetIntoCrowd: (v) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // choix avant le jet seulement
    set({ pendingAttack: { ...pa, intoCrowd: v } });
  },
  attackSetHeldGround: (v) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // choix avant le jet seulement
    set({ pendingAttack: { ...pa, heldGround: v } });
  },
  attackSetCritLocation: (loc) => {
    const pa = get().pendingAttack;
    // RAW-2 (LDB 17 l.73) : réservé à un Coup Critique issu d'un succès FORCÉ (« Je ne faillirai pas ! »).
    if (!pa || !pa.forced || !pa.result?.critical) return;
    set({ pendingAttack: { ...pa, result: { ...pa.result, critLocation: loc } } });
  },
  attackRoll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || pa.result) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target) return;
    applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
    const r = resolveAttack(get, attacker, target, pa.location ?? undefined, pa.fromCharge, pa.intoCrowd, pa.heldGround, pa.weaponUid); // charge montée → Force+Taille de la monture aux dégâts (LDB 14 l.223)
    if (!r) {
      get().log(firedWeapon(attacker, target, pa.weaponUid).type === 'ranged' ? 'Pas de ligne de vue (cible masquée).' : 'Cible hors de portée de mêlée.');
      set({ pendingAttack: null });
      return;
    }
    set({ pendingAttack: { ...pa, result: r.res, victimId: r.victim?.id } });
  },
  attackReroll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result) return;
    if (pa.dualSecond) return; // 2ᵉ frappe du Maniement : jet imposé (d100 inversé / tableau des Critiques) — pas de relance
    // Relance si le jet d'attaque propre est raté (succès du d100 de l'attaquant), 1× max.
    if (!canReroll(!pa.result.attackerDetail?.success, !!pa.rerolled)) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1; // Dépense d'un point de Chance : relance le jet (LDB ch.17 l.24)
    const r = resolveAttack(get, attacker, target, pa.location ?? undefined, pa.fromCharge, pa.intoCrowd, pa.heldGround, pa.weaponUid);
    if (r) set({ pendingAttack: { ...pa, result: r.res, victimId: r.victim?.id, rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » : +1 DR au jet d'attaque figé, re-dérive l'issue (sans relancer). */
  attackBonusSL: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result || !pa.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1;
    const r = pa.result;
    const ad = r.attackerDetail!;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: isDoubleRoll(ad.roll) };
    const weapon = firedWeapon(attacker, target, pa.weaponUid); // arme choisie (ou auto) + munition combinée
    let res: AttackResult;
    if (r.defenderDetail) {
      const dd = r.defenderDetail;
      const def: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl, isDouble: isDoubleRoll(dd.roll) };
      res = finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), pa.location ?? undefined);
    } else {
      res = rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', pa.location ?? undefined);
    }
    set({ pendingAttack: { ...pa, result: res }, battle: { ...battle } });
  },
  attackConfirm: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    // Tir dévié dans la mêlée (LDB 14 l.136) : la touche est appliquée à l'allié intercalé, pas à la cible.
    const victim = pa.victimId ? battle.combatants.find((c) => c.id === pa.victimId) ?? target : target;
    const wasChain = !!pa.cleave; // cette attaque faisait-elle partie d'un balayage en cours ?
    const dualBefore = get().pendingDualStrike; // données de la 1ʳᵉ frappe (présentes quand on confirme la 2ᵉ)
    set({ pendingAttack: null });
    if (attacker && target && victim) {
      const weapon = firedWeapon(attacker, target, pa.weaponUid);
      const prevActed = battle.acted; // pour la Frénésie : la 1re attaque du Round est GRATUITE
      const isDualMain = !!pa.dualMode && !pa.dualSecond && attacker.kind === 'hero'; // main directrice d'un dual
      const isDualSecond = !!pa.dualSecond; // 2ᵉ frappe (off-hand)
      // Maniement de deux armes (LDB 10 l.638) : l'Avantage des deux frappes est différé — accordé seulement
      // si LES DEUX touchent (cf. blocs isDualSecond ci-dessous).
      applyAttackResult(get, set, attacker, victim, weapon, pa.result, undefined, undefined, isDualMain || isDualSecond);
      // Maladresse d'un HÉROS (jet propre raté + double) → modale Tableau des Oups ! (LDB 14 l.53) ; elle interrompt le balayage.
      if (attacker.kind === 'hero' && attackerFumbled(pa.result)) {
        set({ pendingFumble: { combatantId: attacker.id, weapon, result: null }, pendingCleave: null });
      } else if (!isDualMain && !isDualSecond) {
        // Frappe Mortelle (LDB 14 l.12 / 85 l.299) : démarre/poursuit le balayage d'un héros plus grand
        // (jamais en mode dual : un Maniement de deux armes ne balaie pas).
        maybeHeroCleave(get, set, attacker, victim, pa.result, wasChain);
      }
      // Action « des deux armes » (LDB 10 l.638) : on a CHOISI d'attaquer des deux → −10 à toutes ses défenses
      // jusqu'à son prochain Tour ; si la main directrice TOUCHE, on ouvre la sélection de la 2ᵉ cible.
      if (isDualMain) {
        attacker.dualStrikeDefensePenalty = true;
        const off = attacker.weapons.find((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1);
        const mainRoll = pa.result.attackerDetail?.roll;
        if (pa.result.hit && mainRoll != null && off?.uid) {
          // Exception Critique : la 2ᵉ frappe utilise la valeur du tableau des Critiques (révélation poussée par applyAttackResult).
          const critValue = pa.result.critical ? get().pendingReveals.find((r) => r.kind === 'critical')?.dice : undefined;
          set({ pendingDualStrike: { attackerId: attacker.id, offWeaponUid: off.uid, mainRoll, critValue, mainAdvantage: pa.result.advantageTo === 'attacker' } });
        }
        set({ battle: { ...get().battle! } });
      }
      // 2ᵉ frappe résolue : Avantage accordé seulement si LES DEUX ont touché (dualBefore n'existe que si la 1ʳᵉ a touché).
      if (isDualSecond) {
        if (dualBefore && pa.result.hit) {
          if (dualBefore.mainAdvantage) { attacker.advantage += 1; attacker.gainedAdvThisRound = true; }
          if (pa.result.advantageTo === 'attacker') { attacker.advantage += 1; attacker.gainedAdvThisRound = true; }
        }
        set({ pendingDualStrike: null, battle: { ...get().battle! } });
      }
      // Frénésie (LDB 21 l.34) : un Test de Capacité de Combat GRATUIT chaque Round → la 1re attaque du
      // héros frénétique ne consomme PAS l'Action (il pourra réattaquer normalement ensuite).
      if (attacker.kind === 'hero' && attacker.frenzied && !attacker.frenzyFreeUsed && !wasChain && !isDualSecond) {
        attacker.frenzyFreeUsed = true;
        set({ battle: { ...get().battle!, acted: prevActed, log: [...get().battle!.log, ev('frenzy', `${attacker.name} : attaque libre de Frénésie (Action préservée).`, attacker.id)] } });
      }
      // Tir IMMOBILE (LDB 14 l.101) : le héros a renoncé à bouger pour annuler le −10 → on consomme son
      // Mouvement du Tour (il ne pourra plus se déplacer après ce tir).
      if (pa.heldGround && weapon.type === 'ranged') {
        const b2 = get().battle;
        if (b2) set({ battle: { ...b2, movementUsed: mountMovement(b2, attacker) } });
      }
    }
  },
  attackCancel: () => {
    const pa = get().pendingAttack;
    if (pa?.fromCharge) return; // après une Charge, l'attaque est obligatoire (LDB 15-Dépl l.75)
    if (pa?.dualSecond) return; // 2ᵉ frappe d'un dual : engagée dès que la cible est choisie (le jet est imposé)
    if (pa?.cleave) return get().cleaveEnd(); // annuler un enchaînement = terminer le balayage
    set({ pendingAttack: null });
  },
  cleaveAttack: (targetId) => {
    const { battle, pendingCleave: pc } = get();
    if (!battle || !pc) return;
    const attacker = battle.combatants.find((c) => c.id === pc.attackerId);
    const target = battle.combatants.find((c) => c.id === targetId);
    if (!attacker || !target) return;
    if (pc.count >= bonus(effectiveChar(attacker, 'CC'))) return; // borné à BCC enchaînements (LDB 14 l.12)
    if (!cleaveTargets(battle, attacker, pc.hitIds).some((t) => t.id === targetId)) return; // cible invalide (non adjacente / déjà frappée)
    set({ pendingAttack: { attackerId: attacker.id, targetId, location: null, result: null, cleave: true } });
  },
  cleaveEnd: () => set({ pendingCleave: null }),
  dualStrikeAttack: (targetId) => {
    const { battle, pendingDualStrike: ds } = get();
    if (!battle || !ds) return;
    const attacker = battle.combatants.find((c) => c.id === ds.attackerId);
    const target = battle.combatants.find((c) => c.id === targetId);
    if (!attacker || !target || isOutOfAction(target)) return;
    const off = attacker.weapons.find((w) => w.uid === ds.offWeaponUid);
    if (!off) { set({ pendingDualStrike: null }); return; }
    // 2ᵉ frappe : jet IMPOSÉ (inversé / valeur du Critique) + pénalité main 2nde + nouveau jet de défense (LDB 10 l.638).
    const res = resolveDualSecond(get, attacker, target, off, ds.mainRoll, { critValue: ds.critValue });
    set({ pendingAttack: { attackerId: attacker.id, targetId, location: res.location ?? null, result: res, dualSecond: true, weaponUid: off.uid } });
  },
  dualStrikeSkip: () => set({ pendingDualStrike: null }), // « peut viser » = optionnel : pas de 2ᵉ → pas d'Avantage (LDB 10 l.638)
  dismissReveal: () => {
    set((s) => ({ pendingReveals: s.pendingReveals.slice(1) }));
    // File vidée alors qu'un tour d'IA était suspendu par les révélations → reprendre l'avancement.
    const { battle, pendingReveals, pendingFateSave, pendingFumble } = get();
    if (battle && !battle.over && !pendingReveals.length && !pendingFateSave && !pendingFumble) {
      const active = activeCombatant(battle);
      if (active && active.kind === 'enemy' && !isOutOfAction(active)) {
        // Ennemi ayant déjà agi (révélation d'attaque) → fin de tour ; sinon début de tour (entretien) → lancer l'IA.
        if (battle.acted) resumeEnemyTurn(get, set);
        else maybeRunEnemyTurn(get, set);
      }
    }
  },
  battleTrample: (targetId) => {
    const battle = get().battle;
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.advantage < 1) return; // exige ≥1 Avantage (LDB 85 l.320)
    const target = trampleTarget(battle, active, targetId); // adversaire adjacent plus petit
    if (!target) return;
    // OUVRE la modale (le jet se fait au clic « Lancer ») — « un jet = une modale ».
    set({ pendingTrample: { attackerId: active.id, targetId: target.id, result: null }, battle: { ...battle, action: null } });
  },
  trampleRoll: () => FLOWS.trample.roll(get, set),
  trampleReroll: () => FLOWS.trample.reroll(get, set),
  trampleBonusSL: () => FLOWS.trample.bonusSL(get, set),
  trampleForceSuccess: () => FLOWS.trample.forceSuccess(get, set),
  trampleConfirm: () => {
    const { battle, pendingTrample: pt } = get();
    if (!battle || !pt || !pt.result) return;
    const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
    const target = battle.combatants.find((c) => c.id === pt.targetId);
    set({ pendingTrample: null });
    if (!attacker || !target) return;
    const prevActed = battle.acted; // action GRATUITE : ne consomme pas l'Action
    attacker.advantage = Math.max(0, attacker.advantage - 1); // coût : 1 Avantage (LDB 85 l.320)
    applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, pt.result);
    set({ battle: { ...get().battle!, acted: prevActed } });
  },
  trampleCancel: () => set({ pendingTrample: null }),

  // ── Course (LDB 15-Déplacement l.79-82) : utilise l'Action + un Test d'Athlétisme (+20) → déplacement
  //    étendu (Marche + Course + DR). « Un jet = une modale » : le Test passe par pendingRun. ──
  battleRun: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted || battle.movementUsed > 0) return; // Course = Marche + Action (exige le plein Mouvement)
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || isEngaged(active) || hasCondition(active, 'À Terre') || !canTakeAction(active)) return; // Engagé/À Terre → pas de Course (LDB 16 l.37)
    set({ pendingRun: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
  },
  runRoll: () => FLOWS.run.roll(get, set),
  runReroll: () => FLOWS.run.reroll(get, set),
  runForceSuccess: () => FLOWS.run.forceSuccess(get, set),
  runConfirm: () => {
    const { battle, scene, pendingRun: pr } = get();
    if (!battle || !scene || !pr || !pr.result) return;
    const c = battle.combatants.find((x) => x.id === pr.combatantId);
    set({ pendingRun: null });
    if (!c) return;
    // Combat monté : Course au Mouvement de la monture, empreinte/collisions de la monture (le couple est solidaire ; le clic de déplacement synchronise la monture).
    const geom = mountOf(battle, c) ?? c;
    const range = mountMovement(battle, c) + pr.result.bonusCases; // Marche + (Course + DR) (LDB 15 l.80)
    const blocked = occupied(battle, geom);
    const skill = c.mountId ? 'Chevaucher' : 'Athlétisme';
    const log = [...battle.log, ev('move', `${c.name} prend sa Course (${skill} ${pr.result.roll === 100 ? '00' : pr.result.roll}) : déplacement jusqu'à ${range} cases.`, c.id)];
    set({ battle: { ...get().battle!, action: 'move', acted: true, reachable: reachable(scene, c.pos!, range, blocked, sizeFootprint(geom.size)), log } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  runCancel: () => set({ pendingRun: null }),

  // ── Se relever d'À Terre (LDB 16-États l.37) : utilise le Mouvement pour se mettre debout. Impossible
  //    tant qu'on n'a pas regagné ≥1 PB (LDB 18 l.28 : à 0 PB on reste au sol). Ne consomme PAS l'Action. ──
  battleStandUp: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.movementUsed > 0) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !hasCondition(active, 'À Terre') || active.wounds.current <= 0) return;
    removeCondition(active, 'À Terre');
    set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, log: [...battle.log, ev('move', `${active.name} se relève.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  fumbleRoll: () => {
    const pf = get().pendingFumble;
    if (!pf || pf.result) return; // un seul jet sur le Tableau des Oups !
    set({ pendingFumble: { ...pf, result: rollOups(pf.weapon, battleRng()) } });
  },
  fumbleConfirm: () => {
    const { battle, pendingFumble: pf } = get();
    if (!battle || !pf || !pf.result) return;
    const c = battle.combatants.find((x) => x.id === pf.combatantId);
    const resume = pf.resumeAfter;
    set({ pendingFumble: null });
    if (c) applyOups(get, set, c, pf.weapon, pf.result);
    if (resume) resumeEnemyTurn(get, set); // Maladresse en défense réactive → l'IA reprend
  },

  // ── Défense réactive (héros attaqué par l'IA en mêlée) ──
  defenseSetMode: (mode) => {
    const pd = get().pendingDefense;
    if (!pd || pd.result) return; // le mode ne change plus après le jet
    set({ pendingDefense: { ...pd, mode } });
  },
  defenseSetParryWeapon: (uid) => {
    const pd = get().pendingDefense;
    if (!pd || pd.result) return; // choix d'arme de parade avant le jet seulement
    set({ pendingDefense: { ...pd, parryWeaponUid: uid ?? undefined } });
  },
  defenseRoll: () => {
    // « Défendre » : roule la défense du héros et résout le Test opposé (atk figé).
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || pd.result) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender) return;
    const dodgeMod = (get().scene ? sceneCombatModifiers(get().scene!, get().gameTime).dodgeMod : 0) + mountedDodgePenalty(defender); // neige −20 + cavalier −20 (LDB 14 l.115-116/225)
    const parry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : undefined; // arme de parade choisie (défaut = main principale)
    const def = rollMeleeDefender(defender, pd.mode, battleRng(), dodgeMod, parry);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined, [], dodgeMod, undefined, parry);
    set({ pendingDefense: { ...pd, def, result: res } });
  },
  defenseReroll: () => {
    // Dépense d'un point de Chance du DÉFENSEUR : relance UNIQUEMENT la défense (LDB Destin).
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result) return;
    if (!canReroll(!pd.def?.success, !!pd.rerolled)) return; // défense propre ratée, 1× max
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.fortune ?? 0) <= 0) return;
    defender.fortune = (defender.fortune ?? 0) - 1; // le jet d'attaque (pd.atk) reste figé
    const dodgeMod = (get().scene ? sceneCombatModifiers(get().scene!, get().gameTime).dodgeMod : 0) + mountedDodgePenalty(defender); // neige −20 + cavalier −20 (LDB 14 l.225)
    const parry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : undefined; // arme de parade choisie (défaut = main principale)
    const def = rollMeleeDefender(defender, pd.mode, battleRng(), dodgeMod, parry);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined, [], dodgeMod, undefined, parry);
    set({ pendingDefense: { ...pd, def, result: res, rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » du défenseur : +1 DR à SA défense figée (le jet d'attaque reste figé). */
  defenseBonusSL: () => {
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result || !pd.result.defenderDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.fortune ?? 0) <= 0) return;
    defender.fortune = (defender.fortune ?? 0) - 1;
    const dd = pd.result.defenderDetail!;
    const def2: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl + 1, isDouble: isDoubleRoll(dd.roll) };
    const parry = pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : undefined; // arme de parade choisie (défaut = main principale)
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def2, pd.mode, pd.location ?? undefined, [], 0, undefined, parry);
    set({ pendingDefense: { ...pd, def: def2, result: res }, battle: { ...battle } });
  },
  defenseConfirm: () => {
    // « Appliquer » : applique le résultat puis REPREND le tour de l'IA suspendu.
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    set({ pendingDefense: null }); // null AVANT la reprise → ré-entrance/double-advance impossibles
    if (attacker && defender) {
      const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, pd.result);
      if (suspended) return; // Déviation Critique du héros : deviationApply rejouera autoCleave/Piétinement/fumble/reprise
      if (pd.free) {
        set({ battle: { ...get().battle!, acted: pd.prevActed ?? get().battle!.acted } }); // attaque gratuite : ne consomme pas l'Action
        applyFreeAttackEffects(get, attacker, defender, pd.freeKind ?? '', pd.result); // À Terre (Attaque caudale)…
      } else autoCleave(get, set, attacker, defender, pd.result); // Frappe Mortelle (attaque principale)
    }
    // Maladresse du DÉFENSEUR héros (sa défense ratée sur un double, LDB 14 l.48-51) → modale Oups!,
    // puis reprise de l'IA APRÈS Appliquer (resumeAfter). Sinon on reprend l'IA tout de suite.
    if (defender && defender.kind === 'hero' && defenderFumbled(pd.result) && !isOutOfAction(defender)) {
      set({ pendingFumble: { combatantId: defender.id, weapon: defender.weapons[0], result: null, resumeAfter: true } });
      return;
    }
    // Frénésie : Test de CC gratuit après l'attaque PRINCIPALE (jamais après une attaque gratuite : `!pd.free`) → fire une seule fois.
    if (attacker && !pd.free) aiFrenzyAttack(get, set, attacker);
    // Attaques gratuites de créature : enchaîne la file (peut rouvrir une modale → ne pas reprendre).
    if (attacker && aiCreatureFreeAttacks(get, set, attacker)) return;
    resumeEnemyTurn(get, set);
  },
  defenseCancel: () => {
    // « Subir » : défense passive (aucune réaction), puis reprise du tour de l'IA.
    const { battle, pendingDefense: pd } = get();
    if (!pd) return;
    const attacker = battle?.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle?.combatants.find((c) => c.id === pd.defenderId);
    set({ pendingDefense: null });
    if (attacker && defender) {
      const res = resolveMeleePassive(attacker, defender, pd.weapon, pd.atk, pd.location ?? undefined);
      const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, res);
      if (suspended) return; // Déviation Critique du héros (même après « Subir » : la déviation d'armure est un choix distinct) — deviationApply reprend
      if (pd.free) {
        set({ battle: { ...get().battle!, acted: pd.prevActed ?? get().battle!.acted } }); // attaque gratuite : ne consomme pas l'Action
        applyFreeAttackEffects(get, attacker, defender, pd.freeKind ?? '', res); // À Terre (Attaque caudale)…
      } else autoCleave(get, set, attacker, defender, res); // Frappe Mortelle (attaque principale)
    }
    // Frénésie : Test de CC gratuit après l'attaque PRINCIPALE (jamais après une attaque gratuite : `!pd.free`) → fire une seule fois.
    if (attacker && !pd.free) aiFrenzyAttack(get, set, attacker);
    // Attaques gratuites de créature : enchaîne la file (peut rouvrir une modale → ne pas reprendre).
    if (attacker && aiCreatureFreeAttacks(get, set, attacker)) return;
    resumeEnemyTurn(get, set);
  },
  // « Dévier » (deviate=true) ou « Subir » (false) le Coup Critique d'un héros (LDB 63 l.63-66).
  // Rappelle applyAttackResult avec la décision (early-return de suspension sauté → application UNE
  // seule fois) puis REJOUE les post-étapes que le caller avait sautées à la suspension, dans l'ordre
  // exact de defenseConfirm/doAttack : balayage → Piétinement → Maladresse défenseur (auto-gated) → reprise IA.
  deviationApply: (deviate: boolean) => {
    const { battle, pendingDeviation: pdv } = get();
    if (!battle || !pdv) return;
    const attacker = battle.combatants.find((c) => c.id === pdv.attackerId);
    const target = battle.combatants.find((c) => c.id === pdv.targetId);
    set({ pendingDeviation: null }); // null AVANT la reprise → ré-entrance/double-advance impossibles
    if (attacker && target) {
      // « Subir » applique le Critique DÉJÀ montré (pdv.crit) sans re-tirer ni re-révéler ; « Dévier » l'ignore.
      applyAttackResult(get, set, attacker, target, pdv.weapon, pdv.res, deviate, deviate ? undefined : pdv.crit);
      autoCleave(get, set, attacker, target, pdv.res); // balayage de l'ennemi plus grand sur les AUTRES héros
      // (attaques gratuites de créature : enchaînées à la reprise ci-dessous)
      // Maladresse du défenseur héros (défense active ratée sur un double, LDB 14 l.48-51) : `defenderFumbled`
      // est FAUX sans jet de défense (doAttack / « Subir » passif) → ne se déclenche que pour la parade/esquive active.
      if (target.kind === 'hero' && defenderFumbled(pdv.res) && !isOutOfAction(target)) {
        set({ pendingFumble: { combatantId: target.id, weapon: target.weapons[0], result: null, resumeAfter: true } });
        return; // la reprise de l'IA suivra la modale de Maladresse (resumeAfter)
      }
    }
    if (pdv.resumeAfter) {
      if (attacker && aiCreatureFreeAttacks(get, set, attacker)) return; // attaques gratuites de créature (file)
      resumeEnemyTurn(get, set);
    }
  },

  // ── Combat monté : Monter / Descendre (LDB 14 l.212-225) ──
  // Enfourcher/descendre ne demande AUCUN jet (Chevaucher sans Test si l'on a la Compétence, LDB 09 l.99)
  // → ce n'est PAS une Action (critère : tout jet = une Action) : c'est juste du MOUVEMENT (repositionnement
  // sur/hors la monture). On consomme donc le Mouvement du tour, pas l'Action — on peut enfourcher PUIS attaquer.
  battleMount: () => {
    const { battle, scene } = get();
    if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.mountId) return;
    const mount = mountableNear(battle, active);
    if (!mount) return;
    mountUp(active, mount);
    set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('move', `${active.name} enfourche ${mount.name}.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  battleDismount: () => {
    const { battle, scene } = get();
    if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !active.mountId) return;
    const mountName = mountOf(battle, active)?.name ?? 'sa monture';
    dismount(battle, scene, active);
    set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('move', `${active.name} descend de ${mountName}.`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  // Combat monté (LDB 14 l.219) : applique le choix de cible (cavalier OU monture) puis relance l'attaque/charge
  // sur l'id choisi en court-circuitant la modale (skipMountChoice). Annuler ne consomme rien.
  mountTargetSelect: (id) => {
    if (!get().pendingMountTarget) return;
    set({ pendingMountTarget: null });
    get().battleClickEntity(id, true);
  },
  mountTargetCancel: () => set({ pendingMountTarget: null }),

  // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15-Dépl l.84-89) ──
  battleDisengage: () => {
    const battle = get().battle;
    if (!battle || battle.over) return; // option A (Sacrifier l'Avantage) reste possible même après avoir agi
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !isEngaged(active)) return;
    startDisengage(get, set, active);
  },
  // « Sacrifier l'Avantage » (l.87) → ramener l'Avantage à 0, partir libre. L'Action N'EST PAS consommée.
  disengageConfirmA: () => {
    const { battle, scene, pendingDisengage: pd } = get();
    if (!battle || !scene || !pd || !pd.canSacrifice) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover) return set({ pendingDisengage: null });
    const foes = (mover.engagedWith ?? [])
      .map((id) => battle.combatants.find((c) => c.id === id))
      .filter((c): c is Combatant => !!c);
    mover.advantage = 0; // « ramener votre Avantage à 0 » (l.87)
    for (const f of foes) disengageFrom(mover, f); // se place hors de portée de TOUS (l.87)
    const blocked = occupied(battle, mover);
    set({
      pendingDisengage: null,
      battle: {
        ...battle,
        action: 'move', // mouvement libre rouvert, sans pénalité (l.87) ; Action préservée
        reachable: reachable(scene, mover.pos!, effectiveMovement(mover), blocked, sizeFootprint(mover.size)),
        log: [...battle.log, ev('flee', `${mover.name} se désengage en sacrifiant son Avantage.`, mover.id)],
      },
    });
    bus.emit(EVT.SCENE_DIRTY);
  },
  // « Esquiver » → Test opposé Esquive (mover) vs Corps à corps (foe), jet du foe figé. Passe en phase 'esquive'.
  disengageRoll: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || pd.phase !== 'choice') return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover) return;
    const def = rollMeleeDefender(mover, 'esquive', battleRng());
    const opp = resolveOpposed(def, pd.atk!); // mover = « attaquant » du Test opposé
    set({ pendingDisengage: { ...pd, phase: 'esquive', def, result: disengageOutcome(opp.winner) } });
  },
  // Chance du mover : relance UNIQUEMENT son Esquive (le jet du foe reste figé).
  disengageReroll: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result) return;
    if (!canReroll(!pd.def?.success, !!pd.rerolled)) return; // Esquive propre ratée, 1× max
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.fortune ?? 0) <= 0) return;
    mover.fortune = (mover.fortune ?? 0) - 1;
    const def = rollMeleeDefender(mover, 'esquive', battleRng());
    const opp = resolveOpposed(def, pd.atk!);
    set({ pendingDisengage: { ...pd, def, result: disengageOutcome(opp.winner), rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » du mover : +1 DR à l'Esquive figée (le jet du foe reste figé). */
  disengageBonusSL: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result || !pd.def) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.fortune ?? 0) <= 0) return;
    mover.fortune = (mover.fortune ?? 0) - 1;
    const def2: TestResult = { ...pd.def, sl: pd.def.sl + 1 };
    const opp = resolveOpposed(def2, pd.atk!);
    set({ pendingDisengage: { ...pd, def: def2, result: disengageOutcome(opp.winner) }, battle: { ...battle } });
  },

  // ── Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) : réussite garantie (opposé : DR +1) ──
  testForceSuccess: () => FLOWS.test.forceSuccess(get, set),
  attackForceSuccess: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result || !pa.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.resilience ?? 0) <= 0) return;
    attacker.resilience = (attacker.resilience ?? 0) - 1;
    const r = pa.result;
    const ad = r.attackerDetail!;
    const defSL = r.defenderDetail?.sl ?? 0;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, defSL + 1, 1), isDouble: isDoubleRoll(ad.roll) };
    const weapon = firedWeapon(attacker, target, pa.weaponUid); // arme choisie (ou auto) + munition combinée
    let res: AttackResult;
    if (r.defenderDetail) {
      const dd = r.defenderDetail;
      const def: TestResult = { roll: dd.roll, target: dd.target, success: dd.success, sl: dd.sl, isDouble: isDoubleRoll(dd.roll) };
      res = finishMelee(attacker, target, weapon, atk2, def, bestDefenseMode(target), pa.location ?? undefined);
    } else {
      res = rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', pa.location ?? undefined);
    }
    // `forced` : sur un Coup Critique, le joueur pourra CHOISIR la localisation (RAW-2, LDB 17 l.73).
    set({ pendingAttack: { ...pa, result: res, forced: true }, battle: { ...battle } });
  },
  defenseForceSuccess: () => {
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result || !pd.result.defenderDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender || (defender.resilience ?? 0) <= 0) return;
    defender.resilience = (defender.resilience ?? 0) - 1;
    const dd = pd.result.defenderDetail!;
    const def2: TestResult = { roll: dd.roll, target: dd.target, success: true, sl: Math.max(dd.sl, pd.atk.sl + 1, 1), isDouble: isDoubleRoll(dd.roll) };
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def2, pd.mode, pd.location ?? undefined);
    set({ pendingDefense: { ...pd, def: def2, result: res }, battle: { ...battle } });
  },
  castForceSuccess: () => {
    const { pendingCast: pc } = get();
    if (!pc || !pc.result) return;
    const caster = actorIn(get(), pc.casterId);
    const target = actorIn(get(), pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.resilience ?? 0) <= 0) return;
    caster.resilience = (caster.resilience ?? 0) - 1;
    const ni = pc.focused ? 0 : spell.cn ?? 0;
    const cur = pc.result;
    const bonusNeeded = Math.max(1, ni - cur.sl); // au moins le NI ; on force aussi un d100 propre réussi
    const res = rederiveCastSL(caster, target, spell, { ...cur, roll: Math.min(cur.roll, cur.target) }, pc.missile, pc.focused, bonusNeeded);
    set({ pendingCast: { ...pc, result: res }, ...touchActors(get()) });
  },
  disengageForceSuccess: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result || !pd.def) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.resilience ?? 0) <= 0) return;
    mover.resilience = (mover.resilience ?? 0) - 1;
    set({ pendingDisengage: { ...pd, result: 'success' }, battle: { ...battle } }); // l'emporte (LDB ch.17 l.73)
  },

  // « Appliquer » : l'Esquive consomme l'Action dans les DEUX issues (l.89).
  disengageConfirm: () => {
    const { battle, scene, pendingDisengage: pd } = get();
    if (!battle || !scene || !pd || !pd.result) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    const foe = battle.combatants.find((c) => c.id === pd.foeId);
    set({ pendingDisengage: null });
    if (!mover || !foe) return;
    const log = [...battle.log];
    if (pd.result === 'success') {
      mover.advantage += 1; // +1 Avantage (l.89)
      mover.gainedAdvThisRound = true;
      // Esquive réussie = on s'extrait du corps à corps → libéré de TOUS les Engagements
      // (cohérent avec l'option A, qui libère aussi tous les foes).
      const foes = (mover.engagedWith ?? [])
        .map((id) => battle.combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c);
      for (const f of foes) disengageFrom(mover, f);
      const blocked = occupied(battle, mover);
      log.push(ev('flee', `${mover.name} se désengage (Esquive réussie, +1 Avantage).`, mover.id, foe.id));
      set({
        battle: { ...battle, acted: true, action: 'move', reachable: reachable(scene, mover.pos!, effectiveMovement(mover), blocked, sizeFootprint(mover.size)), log },
      });
    } else if (pd.result === 'tie') {
      // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
      // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
      log.push(ev('flee', `${mover.name} : échange neutre, le désengagement échoue (personne ne prend l'avantage).`, mover.id, foe.id));
      set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
    } else {
      foe.advantage += 1; // l'adversaire gagne +1, la fuite échoue (l.89)
      foe.gainedAdvThisRound = true;
      log.push(ev('flee', `${mover.name} échoue à se désengager ; ${foe.name} gagne +1 Avantage.`, mover.id, foe.id));
      set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
    }
    bus.emit(EVT.SCENE_DIRTY);
  },
  // « Fuir » (LDB 15-Dépl l.98-109) : l'adversaire gagne +1 Avantage + une attaque gratuite dans
  // le dos (+20) ; si elle touche, +1 Avantage de plus et Test de Calme ou État Brisé ; puis on
  // se libère de TOUS les Engagements et on peut courir (Mouvement de Course).
  disengageFlee: () => {
    const { battle, scene, pendingDisengage: pd } = get();
    if (!battle || !scene || !pd) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    const foe = battle.combatants.find((c) => c.id === pd.foeId);
    set({ pendingDisengage: null });
    if (!mover || !foe) return;
    const log = [...battle.log];
    foe.advantage += 1; // l'adversaire gagne immédiatement +1 Avantage (l.101)
    foe.gainedAdvThisRound = true;
    const res = resolveBackstabAttack(foe, mover, battleRng());
    log.push(ev('flee', `${mover.name} fuit — ${foe.name} frappe dans le dos : ${res.log}`, mover.id, foe.id));
    // « Un jet = une modale » : le héros voit le dé du coup dans le dos (jet subi).
    if (mover.kind === 'hero') pushReveal(set, { kind: 'backstab', title: 'Fuite — coup dans le dos', dice: res.attackerRoll, lines: [res.log], subjectId: mover.id });
    if (res.hit && res.woundsLost) {
      loseWounds(mover, res.woundsLost); // perte de PB centralisée : −Avantage du fuyard + À Terre à 0 (LDB 15 l.40 / 18 l.28)
      foe.advantage += 1; // touché → +1 Avantage de plus (l.107)
      // Test de Calme Intermédiaire (+0) ou État Brisé (+1 par DR négatif).
      const calme = effectiveChar(mover, 'FM') + (mover.skills.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0);
      const ct = rollTest(calme, 'intermediaire', battleRng());
      const broken = ct.success ? 0 : 1 + Math.max(0, -ct.sl);
      if (broken) {
        addCondition(mover, 'Brisé', broken);
        log.push(ev('fear', `${mover.name} panique : ${broken} État(s) Brisé.`, mover.id));
      }
      if (mover.kind === 'hero')
        pushReveal(set, { kind: 'calme', title: 'Test de Calme', dice: ct.roll, lines: [ct.success ? 'Sang-froid gardé.' : `Panique : ${broken} État(s) Brisé.`], subjectId: mover.id });
    }
    const foes = (mover.engagedWith ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
    for (const f of foes) disengageFrom(mover, f);
    const blocked = occupied(battle, mover);
    // Fuite : déplacement jusqu'à la Course (2×Mouvement) MAIS dans la direction opposée à l'adversaire
    // (LDB 15-Déplacement l.109) — les cases qui rapprochent du `foe` sont exclues du déplaçable.
    set({ battle: { ...battle, action: 'move', reachable: fleeReachable(scene, mover.pos!, foe.pos!, effectiveMovement(mover) * 2, blocked, sizeFootprint(mover.size)), log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  },
  disengageCancel: () => set({ pendingDisengage: null }), // renonce avant tout jet : aucun coût

  /** « Lancer » : effectue le jet du test en attente (hors combat). */
  testRoll: () => FLOWS.test.roll(get, set),
  /** Chance : relance (LDB Destin) / « +1 DR » (LDB ch.17 l.26), cf. spec `test` de rollFlows. */
  testReroll: () => FLOWS.test.reroll(get, set),
  testBonusSL: () => FLOWS.test.bonusSL(get, set),

  /** Acquitte un test de compétence : applique la branche réussite/échec. */
  resolveTest: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return; // pas d'acquittement avant le jet
    set({ pendingTest: null });
    const actor = get().party.find((c) => c.id === pt.actorId);
    const tool = pt.itemUid ? actor?.items?.find((i) => i.uid === pt.itemUid) : undefined;
    // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.59/88). Ne repêche qu'un échec qui a
    // réussi le d100 mais manqué le seuil requireSL (jamais un roll > cible → on ne crée pas de réussite).
    const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
    const effSuccess = drDelta !== 0 ? pt.roll <= pt.target && pt.sl + drDelta >= pt.requireSL : pt.success;
    // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
    if (tool && pt.isDouble && !pt.success && hasQuality(tool, 'Bâclé') && !isUnbreakable(tool)) {
      tool.destroyed = true;
      set({ party: [...get().party] }); // persiste la casse + re-render
      get().log(`${tool.name} (Bâclé) se brise sur la Maladresse de ${actor?.name ?? pt.actorName}.`);
    }
    const branch = effSuccess ? pt.onSuccess : pt.onFailure;
    if (branch && branch.length) applyEffects(get, set, branch);
  },
  closeDocument: () => set({ document: null }),

  log: (msg) => set((s) => ({ journal: [...s.journal.slice(-40), msg] })),

  advanceTime: (minutes) => {
    if (minutes <= 0) return;
    set({ gameTime: get().gameTime + minutes });
    bus.emit(EVT.TIME_ADVANCED, { minutes }); // #T3 (cascade) branchera ses déclencheurs sur les franchissements
    // HORS COMBAT : faire progresser les États qui tickent (Hémorragique/Poison/Flammes) et l'agonie au
    // prorata du temps écoulé (1 Round ≈ TIME_COST.combatRound min). En combat, la frontière de Round le fait.
    if (!get().battle) {
      const rounds = Math.floor(minutes / TIME_COST.combatRound);
      if (rounds > 0) {
        const party = get().party;
        const log = outOfCombatUpkeep(party, rounds, battleRng());
        if (log.length) set({ party: [...party], journal: [...get().journal.slice(-40), ...log] });
      }
    }
  },
  // « Dormir » : sommeil de `days` journée(s) (défaut 1) — récup. (Exténué/Blessures) + cauchemars (LDB 16/18/21).
  restParty: (days = 1) => restPartyOvernight(get, set, days),
}));
