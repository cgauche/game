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
import type { ConjureForm } from '../engine/conjuredWeapons';
import {
  activeCombatant, occupied, findFreeTile, removeEntity, checkTriggers, entityPickables, fireScheduledEffects,
  applyEffects, applyEffectsLoot, runFlow, assignGearAt, harvestVictoryCreature, applySonneMeleeAdvantage, selectedAmmo, firedWeapon, resolveAttack,
  disengageOutcome, startDisengage, bestAdjacentReachable, applyAttackResult, castSpell, applyCast, castWardPenalty, domainCastBonus, applyZoneCrossings, attackWardGate,
  effectiveSpellOf, finishPlayerAction,
  applyMiscast, checkBattleOver, resumeEnemyTurn, advanceTurn, resolveRoundBoundary, maybeRunEnemyTurn, resumeSuspendedAI,
  attackerFumbled, defenderFumbled, applyOups,
  autoCleave, maybeHeroCleave, cleaveTargets, dualStrikeTargets, resolveDualSecond, overcastTargetCandidates,
  aiCreatureFreeAttacks, aiFrenzyAttack, applyFreeAttackEffects, trampleTarget, TRAMPLE_WEAPON, pushReveal, aiOvercastPlan,
  castSightBlocked, spellSightOf, castZoneSpell, zoneRadiusTilesAt, placingZoneOf, commitPlacedZone,
  counterspellCandidates, applyCounterspell, applyCounterspellOutcome, openCastOpposition,
  maybeOpenHeroPsych, displaceSmaller, applySurprise, resolveKnockdown,
  displayedReach, computeRunReach, attackPlan, fearedSourceTowards, frenzyTarget,
} from './combatFlow';
export { activeCombatant, entityPickables, trampleTarget } from './combatFlow';
import { EMPTY_FLOW } from './flow';
export { movementRemaining, canMove } from './mount';
import { pickActiveModalKey } from './modalArbiter';

/** Un flux DIFFÉRÉ tient la main (modale de jet/révélation, ciblage par carte : Frappe Mortelle,
 *  2ᵉ frappe, Surincantation +Cible, pose de zone) :
 *  toutes les actions d'INTENTION de la hotbar sont inertes — on ne change pas d'action au milieu
 *  d'un jet. La barre est masquée (ActionBar), mais ce garde-fou couvre AUSSI le clavier, les
 *  intents coop et la recette. (La PAUSE de début de Round, elle, est gatée à l'entrée UI —
 *  performClick d'IsoStage — pour rester neutre vis-à-vis des harnais de test sans UI.) */
const combatBusy = (s: Pick<GameState, 'pendingCleave' | 'pendingDualStrike' | 'pendingCast'>): boolean =>
  !!(pickActiveModalKey(s as never) || s.pendingCleave || s.pendingDualStrike || s.pendingCast);
import { mountMovement, movementRemaining, canMove, mountUp, dismount, mountOf, mountableNear } from './mount';
import { sceneZonesToBattle, type BattleZone } from './zones';
import * as interludeFlow from './interludeFlow';
import * as netFlow from './netFlow';
import type { NetState } from './netFlow';
import type { InterludeState, BankDeposit, PendingActivity } from './interludeFlow';
export type { PendingActivity } from './interludeFlow';
import { snapshotSave, saveToSlot, readSlot, importSave, type SaveSlot, type SaveGame } from './saves';

/** Charge une save (Jalon 5) : reset zéro-maintenance (état de création sans les actions — le
 *  JSON round-trip écarte les fonctions) + données de la save par-dessus, écran campagne.
 *  Le merge partiel de zustand préserve les actions du store. */
function applyLoadedSave(set: (s: Partial<GameState>) => void, save: SaveGame): void {
  const base = JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>;
  const data = { ...(save.data as Partial<GameState>) };
  // MIGRATION : les saves d'avant la carte de campagne (#T2 / Arène 2.0) portent une carte VIDE
  // (places: []) — la restaurer écraserait celle du projet courant et ferait DISPARAÎTRE le
  // bouton 🗺️ (recette : « la map n'apparaît pas »). Une carte sans lieux = pas de carte : on
  // garde celle de la base (l'état initial = campagne intégrée).
  const wm = data.worldMap as import('./worldMap').WorldMap | null | undefined;
  if (!wm || !wm.places?.length) delete data.worldMap;
  // `net` : la SESSION coop courante prime sur celle figée dans la save (ne pas ressusciter un
  // salon mort, ne pas dissoudre un salon vivant — l'hôte peut charger une save en ligne).
  set({ ...base, ...data, screen: 'campaign', net: useGame.getState().net });
  bus.emit(EVT.SCENE_DIRTY);
}
import { ev, evLines, type CombatEvent } from './combatLog';
import { rollOups } from '../engine/oups';
import {
  initiativeOrder,
  combatValue,
  rollMeleeDefender,
  resolveBackstabAttack,
  resolveMeleePassive,
  attackWeapon,
} from '../engine/combat';
import { disengageFrom, isEngaged, chargeAdvantage, meleeReachTiles } from '../engine/engagement';
import { gainAdvantage } from '../engine/advantage';
import { resolveMagicMissile, resolveCasting, isArcaneSpell, isMagicMissile, isDispellableSpell, castingValue, castBlockedBy, hasTalent, zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import { rollTest, resolveOpposed } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isFrenzyCapable, isPsychImmune, CIBLE_TYPES, spendResolveForPsychImmunity } from '../engine/psychology';
import { recomputeLoadout, itemFromTrapping, customTrapping, compatibleAmmo, loadoutSetActive } from '../engine/items';
import { attackModesFor } from '../engine/combatFeatures/dispatch';
import { craftTestDRAdjust, hasQuality, isUnbreakable, magazineSize, canPushback, strikesLast, canStrikeFirst, reloadDRTarget } from '../engine/qualities/dispatch';
import { talentInitiativeBonus, talentFearIndice, canPreemptRanged, fleeMovementBonus, reloadDRBonus, runMovementBonus } from '../engine/combatFeatures/dispatch';
import { runMultiplier } from '../engine/traits/dispatch';
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
import { gainCorruption, resolveRenounce, applyMutation } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import { spellSpecFor } from '../data/spellspecs';
import { resolveFormula } from '../engine/ops';
import * as partyFlow from './partyFlow';
import * as merchantFlow from './merchantFlow';
import type { MerchantState, MerchantStocks } from './merchantFlow';
import type {
  Money, PendingVictory, PendingLoot, PendingTest, PendingReload, PendingStateRecovery, PendingBargain,
  PendingAppraise, PendingAttack, PendingCleave, PendingDualStrike, PendingTrample, PendingRun, PendingApproach, PendingFocus,
  PendingPsych, PendingFrenzy, RevealEntry, PendingFumble, PendingKnockdown, PendingRenounce, PendingDefense,
  PendingDisengage, PendingCast, PendingCounterspell, CounterParticipant, PendingExtendedTest, PendingForceDoor, PendingHeal, PendingCorruption,
  PendingCastOpposition, OppositionParticipant, PendingCascade, ScheduledEffect,
} from './pendings';
import {
  PendingEncounterPsych,
  openEncounterPsych,
  encounterPsychRoll as encounterPsychRollFlow,
  encounterPsychReroll as encounterPsychRerollFlow,
  encounterPsychDarkPact as encounterPsychDarkPactFlow,
  encounterPsychForceSuccess as encounterPsychForceSuccessFlow,
  encounterPsychConfirm as encounterPsychConfirmFlow,
  encounterPsychResolve as encounterPsychResolveFlow,
} from './encounterPsychFlow';
import { findSpell } from '../data/index';
import { subtract as moneySub, add as moneyAdd, canAfford, toMoney } from '../engine/money';
import * as medicFlow from './medicFlow';
import type { MedicState, MedicNpc } from './medicFlow';
export type { MedicState, MedicNpc } from './medicFlow';
import * as restFlow from './restFlow';
import type { PendingRest, RestPlaces, RestLodging, RestFood } from './restFlow';
export type { PendingRest, NightEntry, RestPlaces } from './restFlow';
import { Scene, SceneEntity, Dialogue, Effect, isWalkable } from './scene';
import { doorAt } from './buildings';
import { spawnEnemy } from './spawn';
import { reachable, moveReachFor, fleeReachable, pathTo, chebyshev, Pt } from './path';
import { sizeFootprint, combatDistance } from './footprint';
import { bus, EVT } from './bus';
import { campaign, campaignWorldMap } from '../scenes/campaign';
import { dayIndex, runDailyUpkeep } from './upkeep';
import * as travelFlow from './travelFlow';
import { startCascade, advanceCascade, resolveRemainingCascade, finalizeCascade, setCascadeChoice } from './cascade';

export type Screen = 'menu' | 'party' | 'creator' | 'campaign' | 'editor' | 'test' | 'interlude' | 'coop' | 'compendium';

/** Registre des scènes (pour les transitions de campagne). */
const sceneRegistry: Record<string, Scene> = {};
for (const c of campaign) sceneRegistry[c.scene.id] = c.scene;
export function registerScene(s: Scene) {
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
  /** Mode d'action À BOUTON en cours (panneau ouvert). Le déplacement et l'attaque n'ont PAS de mode :
   *  ils sont implicites au clic (sol/ennemi) quand `action === null` — cf. battleClickTile/Entity.
   *  'teleport' = ciblage de case d'une Téléportation (op de sort) en attente. */
  action: 'cast' | 'focus' | 'use' | 'resolve' | 'pickup' | 'ammo' | 'trample' | 'tentacle' | 'heal' | 'teleport' | null;
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
  /** Zones persistantes (L11 — généralise l'ancienne fumée) : fumée du Souffle (blocksLoS),
   *  Mur de feu (onCross), Grands feux d'U'Zhul (perRound)… TTL décrémenté à chaque frontière
   *  de Round (state/zones.ts). */
  zones?: BattleZone[];
  /** « Avantages et Magie » (LDB 46 l.176) : cibles déjà visées par un Sort d'un Domaine CE Round —
   *  re-viser la même cible avec le même Vent donne +1 Avantage au lanceur. Purgé chaque Round. */
  domainCasts?: { targetId: string; domain: string }[];
  /** Instantané positionnel pris au PREMIER segment de Mouvement du Tour (R6/LOT 6) : permet
   *  d'ANNULER tout le déplacement tant qu'aucune Action n'a été prise (`cancelMove`). Restaure
   *  positions de TOUS les combattants (un grand a pu en déplacer d'autres), orientation et
   *  `movedPreAction`. Effacé à l'annulation ou écrasé au 1ᵉʳ segment du Tour suivant. */
  moveSnapshot?: { pos: Record<string, Pt>; facing: Record<string, Dir8>; movedPreAction: boolean } | null;
  /** Budget de Mouvement ÉTENDU du Tour après une Course (Marche + Course + DR, LDB 15 l.80) :
   *  le reliquat non parcouru reste dépensable en segments. Null hors Course ; purgé au Tour/Round. */
  runBudget?: number | null;
  /** Test de Calme d'APPROCHE d'une source de Peur (LDB 21 l.29) — une tentative par Tour :
   *  'passed' = approches libres ce Tour ; 'failed' = aucune approche ce Tour. Purgé au Tour/Round. */
  fearGate?: 'passed' | 'failed' | null;
  /** COOP : ✋ un joueur demande la PAUSE du prochain début de Round (fenêtre Chance « agir en
   *  premier ») — sinon les rounds s'enchaînent sans gate (arbitrage). Purgé à la pause. */
  handRaised?: boolean;
  /** Aperçu « tap 1 » du modèle de clic implicite (tap aperçu → tap confirme). Purgé au commit,
   *  à chaque changement de Tour/Round, et remplacé par tout nouveau tap. */
  preview?:
    | { kind: 'move'; tile: Pt; path: Pt[]; cost: number }
    | { kind: 'run'; tile: Pt; path: Pt[]; cost: number }
    | { kind: 'attack'; targetId: string }
    | { kind: 'charge'; targetId: string; dest: Pt; path: Pt[]; adv: 0 | 1 }
    | { kind: 'moveAttack'; targetId: string; dest: Pt; path: Pt[]; cost: number }
    | null;
}

export interface GameState {
  screen: Screen;
  /** Codex : entrée ciblée à l'ouverture (depuis un `CodexRef`), null = page d'accueil du Codex.
   *  `instance` = libellé paramétré porté par le lien (« 8 Tentacules +8 ») affiché en tête de fiche. */
  compendiumFocus: { category: string; label: string; instance?: string } | null;
  /** Écran à restaurer en quittant le Codex (capturé à l'ouverture). */
  compendiumReturn: Screen;
  /** Ouvre le Codex (optionnellement sur une entrée), en mémorisant l'écran courant pour le retour. */
  openCodex: (focus?: { category: string; label: string; instance?: string }) => void;
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
  /** Niveau de lumière de scène (Lot L, mise en scène) : 0 = noir, 1 = plein jour ; null = auto
   *  (horloge/ambiance). Posé par l'Effet `setLight`, lu par le rendu (overlay d'assombrissement). */
  lightLevel: number | null;
  flags: Record<string, boolean>;
  journal: string[];
  dialogue: { dialogue: Dialogue; nodeId: string; speakerId?: string } | null;
  /** Marchand ouvert (#2) : instantané du stock pour la visite (Disponibilité figée). */
  merchant: MerchantState | null;
  /** Stock PERSISTANT par marchand (#T3 re-stock) : déplété entre visites, re-tiré seulement après
   *  `restockDays` écoulés. `rolledAt` = gameTime du dernier tirage. `bargainLocked` = le joueur a négocié
   *  puis quitté SANS payer → plus de Marchandage avec ce marchand jusqu'au prochain réassort. Reset en nouvelle partie. */
  merchantStocks: MerchantStocks;
  battle: BattleState | null;
  campaignSceneId: string | null;
  money: Money;
  pendingTest: PendingTest | null;
  /** Exposition à une Influence corruptrice en cours (LDB 19) — Test différé par modale. */
  pendingCorruption: PendingCorruption | null;
  pendingBargain: PendingBargain | null;
  pendingAppraise: PendingAppraise | null;
  pendingAttack: PendingAttack | null;
  pendingReload: PendingReload | null;
  /** « Se libérer » (Empêtré) / « se rouler » (En flammes) en cours — modale interactive (LDB 16). */
  pendingStateRecovery: PendingStateRecovery | null;
  pendingDefense: PendingDefense | null;
  /** Déstabilisante (Aux Armes p.89) : choix du héros attaquant — dépenser des Avantages pour renverser. */
  pendingKnockdown: PendingKnockdown | null;
  /** « Je te renie ! » (LDB 17 l.71) : choix subir la mutation / la refuser (1 Résilience). */
  pendingRenounce: PendingRenounce | null;
  pendingDisengage: PendingDisengage | null;
  /** Déplacement-puis-fouille : id du décor interactif visé, déclenché à l'arrivée adjacente (P5). */
  pendingInteract: string | null;
  pendingCast: PendingCast | null;
  /** Contre-sort à PLUSIEURS (réaction au Sort d'un ENNEMI figé dans `pendingCast`) : héros
   *  contre-lanceurs, chacun son jet (flux multi `FLOWS.counterspell`). Null = pas de réaction. */
  pendingCounterspell: PendingCounterspell | null;
  /** Test Étendu en cours (LDB 12 : DR cumulé vers une cible, ex. crochetage) : flux multi
   *  SÉQUENTIEL — un Round à la fois (`FLOWS.extendedTest`), cumul dans `extendedTestNext`. */
  pendingExtendedTest: PendingExtendedTest | null;
  /** Enfoncer une porte à PLUSIEURS (EDO Appendice 2 : objet BE/B) : flux multi PARALLÈLE — chaque
   *  héros frappe (`FLOWS.forceDoor`), cumul des dégâts vs B dans `forceDoorConfirm`. */
  pendingForceDoor: PendingForceDoor | null;
  /** CASCADE séquentielle influençable (jets de NUIT / VOYAGE) : une étape à la fois (`FLOWS.cascade`),
   *  conséquence par `kind` + avancée du curseur dans `cascadeNext` (state/cascade.ts). */
  pendingCascade: PendingCascade | null;
  /** Incantation OPPOSÉE (`spec.opposed`) : chaque CIBLE oppose son Test (FM/Int) à l'incantation
   *  figée (`pendingCast.result`) — multijet DANS la modale de cast (cible IA = rangée témoin
   *  auto-roulée, cible héros = interactive). `oppositionConfirm` agrège → `pendingCast.opposedOutcome`
   *  → `castConfirm` applique (cible résistante = aucune op ; sinon ops à la marge). */
  pendingCastOpposition: PendingCastOpposition | null;
  /** Tir ENNEMI télégraphié : réticule « qui l'adversaire vise », montré ~0,7 s AVANT le tir. */
  enemyAim: { fromId: string; toId: string; melee?: boolean } | null;
  /** Coût/gain (Action/Mouvement/Avantage) de l'intention SOUS LA SOURIS (desktop) — alimente le
   *  clignotant des jauges (ActiveFrame), même source que le tap-1 (`previewResourceDelta`).
   *  Posé par IsoStage au changement de tuile survolée ; null hors survol pertinent. */
  hoverDelta: { action: number; move: number; adv: number } | null;
  /** Soin de Guérison en cours (modale interactive, combat ou hors-combat). */
  pendingHeal: PendingHeal | null;
  /** Infirmerie ouverte (modale de soins persistante, hors combat — state/medicFlow). */
  medic: MedicState | null;
  /** Modale de Repos (nuit à l'auberge / chez soi / campement — state/restFlow). */
  pendingRest: PendingRest | null;
  /** Balayage (Frappe Mortelle) d'un héros en cours : enchaînements d'attaque restants. */
  pendingCleave: PendingCleave | null;
  /** Maniement de deux armes : sélection de la 2ᵉ cible (après une 1ʳᵉ frappe réussie). */
  pendingDualStrike: PendingDualStrike | null;
  /** File de révélation témoin (jets subis/sur table/entretien montrés au joueur, FIFO). */
  pendingReveals: RevealEntry[];
  /** File d'effets PROGRAMMÉS (Lot 0 : minuteries `delayedEffect`) — déclenchés au franchissement de
   *  leur échéance dans `advanceTime`. */
  scheduledEffects: ScheduledEffect[];
  /** Piétinement en cours (modale interactive). */
  pendingTrample: PendingTrample | null;
  /** Course en cours (modale Test d'Athlétisme → déplacement étendu). */
  pendingRun: PendingRun | null;
  /** Approche d'une source de Peur en cours (Test de Calme +0 différant le clic — LDB 21 l.29). */
  pendingApproach: PendingApproach | null;
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
  pendingRoundStart: { round: number; readyBySeat?: Record<number, boolean> } | null;
  /** Coop : marque le siège PRÊT au ready-check d'ouverture (round 1) ; l'hôte lance quand tous ✓. */
  roundStartReady: (seat: number) => void;
  /** Sauvetage par le Destin en attente (LDB ch.17 l.31-35). */
  pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number } | null;
  /** Récompenses de victoire capturées (écran de fin de combat) ; null hors victoire. */
  pendingVictory: PendingVictory | null;
  /** Attribue un objet d'équipement (giveTrapping) du butin de victoire au héros choisi. */
  assignVictoryGear: (index: number, heroId: string) => void;
  /** Récolte « Précieuses Entrailles » (ZI) une créature vaincue (Test de Savoir → pièces valuées). */
  harvestCreature: (name: string) => void;
  /** Ferme l'écran de victoire et revient à l'exploration. */
  dismissVictory: () => void;
  /** Butin HORS combat (fouille/Test/dialogue/trigger) — fenêtre « qui l'emporte ? » (même brique). */
  pendingLoot: PendingLoot | null;
  /** Attribue une ligne de la fenêtre de loot au héros choisi. */
  assignLootGear: (index: number, heroId: string) => void;
  /** Ferme la fenêtre de loot ; l'équipement non attribué va au 1er héros (comme la victoire). */
  dismissLoot: () => void;
  /** Évaluation (LDB 60 l.10) ou Détection d'artefact (LDB 10) d'une ligne de butin ENCORE en
   *  fenêtre (loot ou victoire) : révéler un objet ✨ AVANT de choisir qui l'emporte. */
  appraiseGear: (scope: 'loot' | 'victory', index: number, mode?: 'evaluate' | 'detect') => void;
  /** Coop : ✓ d'un siège sur l'écran de victoire — l'hôte ferme quand tous les requis ont validé. */
  victoryReady: (seat: number) => void;
  /** Coop : ✋ demande la pause du prochain début de Round (fenêtre Chance). */
  raiseHand: () => void;
  document: { title: string; text: string } | null;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  /** Campagne publiée choisie au menu — jouée après constitution du groupe (PartyScreen).
   *  null = « Nouvelle partie » standard (campagne par défaut). */
  pendingCampaign: { name: string; scenes: Scene[]; startSceneId: string; worldMap?: import('./worldMap').WorldMap | null } | null;
  setPendingCampaign: (pc: GameState['pendingCampaign']) => void;

  setScreen: (s: Screen) => void;
  /** Interlude « Entre deux aventures » (LDB 22-23, Jalon 5) — état + dépôts bancaires + commandes. */
  interlude: InterludeState | null;
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trapping: string }[];
  /** Ouvre un interlude de N semaines (Effet d'éditeur `interlude` ou appel direct). */
  startInterlude: (weeks?: number) => void;
  /** Clôt l'interlude : « Avec le pouvoir », Argent à gaspiller, Revenus, le temps passe. */
  interludeEnd: () => void;
  /** Jet d'Activité en attente (Revenus / lancer d'Artisanat — modale, fabrique rollFlow). */
  pendingActivity: PendingActivity | null;
  activityRoll: () => void;
  activityReroll: () => void;
  activityBonusSL: () => void;
  activityDarkPact: () => void;
  activityCancel: () => void;
  activityConfirm: () => void;
  /** Activités (LDB 23) : Revenus, Artisanat (engager l'ouvrage puis lancer), banque. */
  interludeRevenus: (heroId: string) => void;
  interludeCraftStart: (heroId: string, trapping: string, atouts: string[], defauts: string[]) => void;
  interludeCraftRoll: (heroId: string) => void;
  interludeBank: (heroId: string, kind: 'invest' | 'stash', amountBrass: number, rate?: number) => void;
  interludeWithdraw: (index: number) => void;
  /** Apprentissage particulier (Talent hors carrière, Test −20) ; Passer commande (Exotique). */
  interludeLearn: (heroId: string, talent: string) => void;
  interludeOrder: (heroId: string, trapping: string) => void;
  /** Identifier un artefact magique (ADE2 ch.4) : une semaine d'étude, Test de Savoir (Magie) +0. */
  interludeIdentify: (heroId: string, itemUid: string) => void;
  /** Coop en ligne : état réseau sérialisable + actions de session — délégué à netFlow.
   *  Les objets réseau vivants (sessions, sockets du relay) restent des singletons de module. */
  net: NetState;
  /** Crée une room sur le relay → code 6 chars dans `net.roomCode`. false = service injoignable. */
  netHostStart: (name: string) => Promise<boolean>;
  /** Rejoint une room par code. Résout null si connecté, sinon le message d'erreur à afficher. */
  netJoin: (code: string, name: string) => Promise<string | null>;
  netAssign: (heroId: string, seat: number) => void;
  /** Attribue un EMPLACEMENT (0-3) de l'écran d'équipe à un siège (hôte). */
  netAssignSlot: (slot: number, seat: number) => void;
  netLeave: () => void;
  /** Composition d'équipe : ajoute un héros dans un emplacement du siège (intent côté invité ;
   *  l'hôte injecte le siège autoritaire) / retire un héros (propriétaire seul). */
  partyAddHero: (hero: Combatant, wealth?: import('../engine/money').Money, seat?: number) => void;
  partyRemoveHero: (heroId: string) => void;
  /** Sauvegarde la partie dans un slot localStorage (Jalon 5). Refusée en combat. */
  saveGame: (slot: SaveSlot) => boolean;
  /** Charge un slot : reset zéro-maintenance + données de la save (écran campagne). */
  loadGame: (slot: SaveSlot) => boolean;
  /** Applique une save importée (export/import JSON). */
  importGame: (json: string) => boolean;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  createLoadout: (heroId: string, name: string) => void;
  renameLoadout: (heroId: string, id: string, name: string) => void;
  deleteLoadout: (heroId: string, id: string) => void;
  setActiveLoadout: (heroId: string, id: string) => void;
  setLoadoutSlot: (heroId: string, id: string, slot: 'main' | 'off', uid: string | null) => void;
  /** Pose une arme dans l'un des DEUX sets fixes de la fiche (0 = Set I, 1 = Set II), créés au besoin. */
  setWeaponSetSlot: (heroId: string, setIndex: number, slot: 'main' | 'off', uid: string | null) => void;
  /** Rend actif le set fixe d'index 0/1 (créé au besoin). */
  activateWeaponSet: (heroId: string, setIndex: number) => void;
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
  /** Achète une Augmentation de Compétence (identité name+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  buySkillAdvance: (heroId: string, skillName: string, spec?: string) => void;
  /** Achète/augmente un Talent (libellé concret ; refusé hors carrière l.97 / Maxi atteint). */
  buyTalent: (heroId: string, talentName: string) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designateCareerSlot: (heroId: string, slotKey: string, label: string) => void;
  /** Apprentissage/mémorisation d'un sort (LDB 46/10) — coût PX via engine/grimoire. */
  buySpell: (heroId: string, label: string) => void;
  /** Entraîne une prothèse portée par dépense de PX (Fausse jambe → réapprendre l'Esquive, 200 PX, LDB 73). */
  trainProsthesis: (heroId: string, uid: string) => void;
  /** Change de Carrière/Niveau (validation LDB 07 l.137 / LDB 08 : complétion, +100 hors Classe). */
  changeCareer: (heroId: string, newCareer: string, newLevel: number) => void;
  /** Crédite la bourse du groupe (Richesse initiale d'un héros créé, LDB 05 l.578-583). */
  creditPartyMoney: (m: import('../engine/money').Money, note?: string) => void;
  startScene: (scene: Scene) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. `worldMap` = carte du
   *  monde du projet (#T2, projet v2) — null/absent : pas de voyage dans ce projet. */
  loadProject: (scenes: Scene[], entryId: string, worldMap?: import('./worldMap').WorldMap | null) => void;
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
  bargainDarkPact: () => void;
  bargainConfirm: () => void;
  bargainCancel: () => void;
  /** Évaluation (LDB 60 l.10) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
   *  `mode:'detect'` = Détection d'artefact (LDB 10) : Intuition au toucher, une tentative par objet. */
  appraiseItem: (uid: string, heroId: string, mode?: 'evaluate' | 'detect') => void;
  appraiseRoll: () => void;
  appraiseReroll: () => void;
  appraiseBonusSL: () => void;
  appraiseDarkPact: () => void;
  resolveAppraise: () => void;
  appraiseCancel: () => void;
  testRoll: () => void;
  testReroll: () => void;
  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => void;
  /** Sombre Pacte (LDB 19 l.41) : +1 Corruption pour relancer le Test raté (même déjà relancé). */
  testDarkPact: () => void;
  /** Détermination (LDB 17 l.62) : insensible à la Psychologie — retire le malus social
   *  (Animosité/Préjugé) du Test en cours, AVANT le jet. */
  testDetermination: () => void;
  /** Choix du LANCEUR d'un Test de scène parmi les candidats du groupe (avant le jet) — au lieu
   *  d'une désignation automatique du meilleur. Re-cible valeur/cible/malus/outil. */
  testSetActor: (id: string) => void;
  resolveTest: () => void;
  /** Exposition à une Influence corruptrice (LDB 19) : Lancer → Chance → Appliquer (gain selon DR). */
  corruptionRoll: () => void;
  /** Choisit Résistance/Calme AVANT le jet d'exposition (LDB 19 l.26 : « ou … comme déterminé par le
   *  MJ » — RAW indéterminé pour le trait de créature ; le joueur tranche, comme la Défense). Le SEUIL
   *  (l.80) reste figé sur Résistance et ignore cet appel. */
  corruptionSetSkill: (skill: 'Résistance' | 'Calme') => void;
  corruptionReroll: () => void;
  corruptionBonusSL: () => void;
  corruptionDarkPact: () => void;
  resolveCorruption: () => void;
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Effect[], opts?: { noSurprise?: boolean }) => void;
  battleSelectAction: (a: 'cast' | 'focus' | 'use' | 'resolve' | 'pickup' | 'ammo' | 'trample' | 'tentacle' | 'heal' | null) => void;
  /** Guérison (LDB 09-Compétences) — ouvre la modale de soin EN COMBAT (soi/allié adjacent). */
  battleHeal: (targetId: string, mode: HealMode) => void;
  /** INFIRMERIE (hors combat, state/medicFlow) : modale de soins persistante — patients, actes
   *  (Guérison/Hémorragie/Déchirure/Chirurgie), PNJ payant via l'effet `medicalAid`. */
  openMedic: (opts?: { patientId?: string; npc?: MedicNpc }) => void;
  medicSelectPatient: (id: string) => void;
  /** Lance un acte sur le patient courant (surgery → ARME l'opération). */
  medicAct: (act: HealMode) => void;
  /** Choisit la Blessure Critique à opérer (avant la 1re passe). */
  medicSetWound: (idx: number) => void;
  /** Une passe de Chirurgie (1d10 PB + Hémorragie, cumule le DR jusqu'à la cible). */
  medicSurgeryPass: () => void;
  /** Arrête l'opération (cumul perdu ; jamais commencée → acte remboursé). */
  medicEndSurgery: () => void;
  closeMedic: () => void;
  /** REPOS (state/restFlow) : modale de nuit — réglages PAR HÉROS (couchage + pitance,
   *  orthogonaux : on peut manger à l'auberge et dormir dehors), puis bilan globalisé. */
  openRest: (opts?: { places?: RestPlaces; quality?: 'normale' | 'pietre'; days?: number; travelHalt?: boolean }) => void;
  restSet: (heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>) => void;
  restReady: (seat: number) => void;
  restSleep: () => void;
  restCancel: () => void;
  restContinue: () => void;
  healRoll: () => void;
  healReroll: () => void;
  healBonusSL: () => void;
  healDarkPact: () => void;
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
  reloadDarkPact: () => void;
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
  recoverDarkPact: () => void;
  /** « Appliquer » : retire 1 + DR pions de l'État, consomme l'Action. */
  recoverConfirm: () => void;
  /** Ferme la modale de récupération sans coût (avant le jet). */
  recoverCancel: () => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: string) => void;
  /** Détermination (Resolve, LDB ch.17 l.66) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
  /** Détermination depuis une MODALE de jet (LDB 17 l.66) : même règle, pour n'importe quel héros
   *  (le défenseur n'est pas l'actif) et sans toucher au mode d'action. */
  spendResolveCondition: (combatantId: string, conditionName: string) => void;
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
  /** Sombre Pacte (LDB 19 l.41) : +1 Corruption pour relancer l'incantation ratée. */
  castDarkPact: () => void;
  /** Incantation CRITIQUE (LDB 46 l.52-59) : choix de l'effet bonus (modale). */
  castSetCritChoice: (choice: 'critique' | 'puissance' | 'ineluctable') => void;
  /** Arme invoquée à forme libre (Arme aethyrique) : le lanceur choisit la forme/Spé de Corps à corps. */
  castSetConjureForm: (form: ConjureForm) => void;
  /** Surincantation (LDB 47 l.29) : alloue +2 DR du surplus à un axe (Durée / Cible / Zone d'Effet). */
  castAllocOvercast: (axis: 'duration' | 'targets' | 'zone') => void;
  /** Surincantation : choisit/retire une cible SUPPLÉMENTAIRE (dans la limite allouée). */
  castToggleExtraTarget: (id: string) => void;
  /** Surincantation « +Cible » : bascule le choix SUR LE CHAMP DE BATAILLE (la modale s'efface,
   *  bandeau TargetPrompt + clic carte → castToggleExtraTarget). En combat uniquement. */
  castPickTargets: (on: boolean) => void;
  /** Sort de ZONE (flux « jet puis pose », LDB 47 l.29/44) : bascule la POSE sur la carte
   *  (la modale s'efface, le gabarit final suit le curseur, clic-case = dépose). */
  castPlaceZone: (on: boolean) => void;
  castConfirm: () => void;
  castCancel: () => void;
  /** Contre-sort à PLUSIEURS (flux multi `FLOWS.counterspell`) : chaque héros contre-lanceur a son
   *  jet + son cycle Chance/+1 DR/Pacte/Résilience (ciblé par `pid`). */
  counterspellRoll: (pid: string) => void;
  counterspellReroll: (pid: string) => void;
  counterspellBonusSL: (pid: string) => void;
  counterspellDarkPact: (pid: string) => void;
  counterspellForceSuccess: (pid: string) => void;
  counterspellSetForcedRoll: (pid: string, roll: number) => void;
  /** « Appliquer » : agrège (dissipé si UN gagne ; sinon le Sort se résout au meilleur DR net) → castConfirm. */
  counterspellConfirm: () => void;
  /** « Laisser passer » : aucun Contre-sort retenu → le Sort se résout tel quel (castConfirm). */
  counterspellCancel: () => void;
  /** Test Étendu SÉQUENTIEL (LDB 12) : ouvre le flux (ex. crocheter DR 5) ; un Round à la fois. */
  startExtendedTest: (opts: { actorId: string; label: string; skillLabel: string; target: number; targetDR: number; flag?: string }) => void;
  extendedTestRoll: (pid: string) => void;
  extendedTestReroll: (pid: string) => void;
  extendedTestBonusSL: (pid: string) => void;
  extendedTestDarkPact: (pid: string) => void;
  extendedTestForceSuccess: (pid: string) => void;
  extendedTestSetForcedRoll: (pid: string, roll: number) => void;
  /** Cumule le DR du Round courant (LDB 12 l.200) ; total < 0 → recommence ; total ≥ cible → réussite. */
  extendedTestNext: () => void;
  extendedTestCancel: () => void;
  /** Enfoncer une porte à PLUSIEURS (EDO Appendice 2) : ouvre le flux (objet BE/B) ; chacun frappe. */
  startForceDoor: (opts: { label: string; doorBE: number; doorB: number; heroIds: string[]; flag?: string }) => void;
  forceDoorRoll: (pid: string) => void;
  forceDoorReroll: (pid: string) => void;
  forceDoorBonusSL: (pid: string) => void;
  forceDoorDarkPact: (pid: string) => void;
  forceDoorForceSuccess: (pid: string) => void;
  forceDoorSetForcedRoll: (pid: string, roll: number) => void;
  /** Applique les dégâts du Round (somme) ; porte à ≤ 0 B → cède (flag posé) ; sinon nouveau Round. */
  forceDoorConfirm: () => void;
  forceDoorCancel: () => void;
  /** CASCADE séquentielle (`FLOWS.cascade`) : jet de l'étape courante + cycle Chance/+1 DR/Pacte/
   *  Résilience (ciblé par `pid` = id d'étape). */
  cascadeRoll: (pid: string) => void;
  cascadeReroll: (pid: string) => void;
  cascadeBonusSL: (pid: string) => void;
  cascadeDarkPact: (pid: string) => void;
  cascadeForceSuccess: (pid: string) => void;
  cascadeSetForcedRoll: (pid: string, roll: number) => void;
  /** « Choix » d'une étape de séquence (analogue de cascadeRoll côté jet) : pose l'option retenue. */
  cascadeChoose: (pid: string, key: string) => void;
  /** « Étape suivante » : valide l'étape courante (conséquence + insertions), avance ; à la fin,
   *  finalise selon `purpose` (reprise de voyage…). */
  cascadeNext: () => void;
  /** « Tout lancer » : résout d'office les étapes restantes (on ne peut pas dé-dormir), puis place le
   *  curseur EN FIN = BILAN — la modale RESTE ouverte pour voir toutes les conséquences. */
  cascadeResolveAll: () => void;
  /** « Terminer » du bilan : ferme la cascade et enchaîne la suite (reprise de voyage…). */
  cascadeFinish: () => void;
  /** Incantation OPPOSÉE (`FLOWS.castOpposition`) : chaque CIBLE oppose son Test (FM/Int) — son jet
   *  + cycle Chance/+1 DR/Pacte/Résilience (ciblé par `pid`). Cible IA = rangée témoin auto-roulée. */
  oppositionRoll: (pid: string) => void;
  oppositionReroll: (pid: string) => void;
  oppositionBonusSL: (pid: string) => void;
  oppositionDarkPact: (pid: string) => void;
  oppositionForceSuccess: (pid: string) => void;
  oppositionSetForcedRoll: (pid: string, roll: number) => void;
  /** « Appliquer » : agrège les oppositions → `pendingCast.opposedOutcome` (résisté + marge par cible) → castConfirm. */
  oppositionConfirm: () => void;
  /** Incantation HORS COMBAT (couture D) : un héros lanceur cible self/allié ; sorts non-offensifs. */
  oocCastSpell: (casterId: string, label: string, targetId: string, fromGrimoire?: boolean) => void;
  battleFocusSpell: (label: string) => void;
  battleClickTile: (pt: Pt, opts?: { confirm?: boolean }) => void;
  battleClickEntity: (id: string, opts?: { confirm?: boolean; skipMountChoice?: boolean }) => void;
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
  /** Perturbante (LDB 62 l.275-276) : bascule le mode « Repousser » (1 m/DR au lieu des Dégâts). */
  battleTogglePushback: () => void;
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
  /** « Je ne faillirai pas ! » (LDB 17 l.73 : « vous choisissez le résultat ») : choisit la VALEUR du dé
   *  d'un succès forcé (un double ≤ cible → Coup Critique, comme l'exemple Salundra l.75) et re-dérive
   *  l'attaque. Refusé si la valeur ne serait pas une réussite. */
  attackSetForcedRoll: (roll: number) => void;
  attackRoll: () => void;
  attackReroll: () => void;
  attackBonusSL: () => void;
  /** Sombre Pacte (LDB 19 l.41) : +1 Corruption pour relancer l'attaque ratée (même déjà relancée). */
  attackDarkPact: () => void;
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
  /** Attaque gratuite de Tentacule (trait Tentacules, LDB 85 l.354 — mutation Tentacule épais) :
   *  1/tour, 0 Avantage, ne consomme pas l'Action, Empêtré sur Dégâts. Modale d'attaque standard. */
  battleTentacle: (targetId: string) => void;
  /** Acquitte la révélation en tête de file (montre le dé du jet subi/sur table) ; reprend l'IA si vide. */
  dismissReveal: () => void;
  /** Piétinement par modale (LDB 85 l.320-321) : Lancer le jet, dépenser une Chance, appliquer (gratuit). */
  trampleRoll: () => void;
  trampleReroll: () => void;
  trampleBonusSL: () => void;
  trampleDarkPact: () => void;
  trampleForceSuccess: () => void;
  trampleConfirm: () => void;
  trampleCancel: () => void;
  /** Course (LDB 15 l.79-82) : ouvrir la modale, lancer le Test d'Athlétisme, Chance/Résilience, appliquer (déplacement étendu). */
  battleRun: (dest?: Pt) => void;
  runRoll: () => void;
  runReroll: () => void;
  runForceSuccess: () => void;
  runDarkPact: () => void;
  runConfirm: () => void;
  runCancel: () => void;
  /** Approche d'une source de Peur (LDB 21 l.29) : Test de Calme (+0) ; succès → l'intention différée est relancée. */
  approachRoll: () => void;
  approachReroll: () => void;
  approachForceSuccess: () => void;
  approachDarkPact: () => void;
  approachConfirm: () => void;
  approachCancel: () => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.28). */
  battleStandUp: () => void;
  /** Focalisation par modale (Test étendu) : Lancer, Chance, Appliquer (cumule le DR). */
  focusRoll: () => void;
  focusReroll: () => void;
  focusBonusSL: () => void;
  focusDarkPact: () => void;
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
  /** « Je ne faillirai pas ! » (LDB 17 l.73) sur une Peur : choix de la valeur du dé du Test de Calme forcé. */
  psychSetForcedRoll: (roll: number) => void;
  psychDarkPact: () => void;
  /** Détermination (LDB 17 l.62) : immunité Psychologie → passe la Peur/Terreur/trait sans risque. */
  psychResolve: () => void;
  psychConfirm: () => void;
  /** Test de Psychologie à la rencontre, hors combat (couture C, LDB 21) : Lancer, Chance, Résilience, Appliquer. */
  encounterPsychRoll: () => void;
  encounterPsychReroll: () => void;
  encounterPsychDarkPact: () => void;
  encounterPsychForceSuccess: () => void;
  encounterPsychConfirm: () => void;
  encounterPsychResolve: () => void;
  /** Entrée en Frénésie d'un héros (LDB 21 l.32) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  battleFrenzy: () => void;
  frenzyRoll: () => void;
  frenzyReroll: () => void;
  frenzyForceSuccess: () => void;
  frenzyDarkPact: () => void;
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
  /** Sombre Pacte du défenseur (LDB 19 l.41) : +1 Corruption pour relancer sa défense ratée. */
  defenseDarkPact: () => void;
  defenseConfirm: () => void;
  defenseCancel: () => void;
  /** Déstabilisante (Aux Armes p.89) : résout le choix (true = dépenser les Avantages et tenter le renversement). */
  knockdownResolve: (accept: boolean) => void;
  /** « Je te renie ! » (LDB 17 l.71) : résout le choix (true = refuser la mutation, 1 Résilience). */
  renounceResolve: (renounce: boolean) => void;
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
  /** Sombre Pacte du mover (LDB 19 l.41) : +1 Corruption pour relancer son Esquive ratée. */
  disengageDarkPact: () => void;
  // Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) : réussite garantie (opposé : DR +1).
  testForceSuccess: () => void;
  attackForceSuccess: () => void;
  defenseForceSuccess: () => void;
  castForceSuccess: () => void;
  disengageForceSuccess: () => void;
  // « vous choisissez le résultat » (l.73) : valeur du dé d'un Test forcé (11 → Critique, 01 → DR max).
  defenseSetForcedRoll: (roll: number) => void;
  castSetForcedRoll: (roll: number) => void;
  trampleSetForcedRoll: (roll: number) => void;
  disengageConfirm: () => void; // Appliquer l'issue de l'Esquive
  disengageFlee: () => void; // Fuir : attaque dans le dos + Course
  disengageFleeAck: () => void; // « Continuer » après le coup dans le dos montré INLINE
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
  // ── Voyage & nourriture (#T2) ──
  /** Carte du monde du projet courant (graphe de lieux/routes, éditable) — null si le projet n'en a pas. */
  worldMap: import('./worldMap').WorldMap | null;
  /** Overlay carte du monde ouvert (exploration). */
  worldMapOpen: boolean;
  openWorldMap: () => void;
  closeWorldMap: () => void;
  /** Voyage en cours/interrompu (progression km — « Reprendre le voyage » après une embuscade). */
  travelPlan: import('./travelFlow').TravelPlan | null;
  /** Récapitulatif du dernier segment de voyage (audit M4) — modale à l'arrivée/interruption. */
  travelRecap: import('./travelFlow').TravelRecap | null;
  dismissTravelRecap: () => void;
  /** Démarre un voyage depuis le lieu courant le long d'une route (mode + classe + allure). */
  startTravel: (routeId: string, mode: import('../engine/travel').TravelMode, opts?: { classKey?: string; hoursPerDay?: number }) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  resumeTravel: () => void;
  /** Dernier jour (index d'horloge) traité par l'entretien quotidien (rations/faim) — anti-double-comptage. */
  lastUpkeepDay: number;
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  compendiumFocus: null,
  compendiumReturn: 'menu',
  pendingCampaign: null,
  gameTime: CAMPAIGN_START,
  lastUpkeepDay: dayIndex(CAMPAIGN_START),
  worldMap: campaignWorldMap,
  worldMapOpen: false,
  travelPlan: null,
  travelRecap: null,
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
  lightLevel: null,
  flags: {},
  journal: [],
  dialogue: null,
  merchant: null,
  merchantStocks: {},
  battle: null,
  campaignSceneId: null,
  money: { gold: 0, silver: 0, brass: 0 },
  pendingTest: null,
  pendingCorruption: null,
  pendingBargain: null,
  pendingAppraise: null,
  pendingAttack: null,
  enemyAim: null,
  hoverDelta: null,
  pendingReload: null,
  pendingStateRecovery: null,
  pendingDefense: null,
  pendingKnockdown: null,
  pendingRenounce: null,
  pendingMountTarget: null,
  pendingDisengage: null,
  pendingInteract: null,
  pendingCast: null,
  pendingCounterspell: null,
  pendingExtendedTest: null,
  pendingForceDoor: null,
  pendingCascade: null,
  pendingCastOpposition: null,
  pendingHeal: null,
  medic: null,
  pendingRest: null,
  pendingCleave: null,
  pendingDualStrike: null,
  pendingReveals: [],
  scheduledEffects: [],
  pendingTrample: null,
  pendingRun: null,
  pendingApproach: null,
  pendingFocus: null,
  pendingPsych: null,
  pendingEncounterPsych: null,
  pendingFrenzy: null,
  pendingFumble: null,
  pendingRoundStart: null,
  pendingFateSave: null,
  pendingVictory: null,
  pendingLoot: null,
  document: null,
  previousScene: null,

  setScreen: (s) => set({ screen: s }),
  openCodex: (focus) => set((st) => ({ screen: 'compendium', compendiumFocus: focus ?? null, compendiumReturn: st.screen === 'compendium' ? st.compendiumReturn : st.screen })),
  setPendingCampaign: (pc) => set({ pendingCampaign: pc }),

  // ── Entre deux aventures (LDB 22-23, Jalon 5) ──
  interlude: null,
  bank: [],
  pendingOrders: [],
  startInterlude: (weeks) => interludeFlow.startInterlude(get, set, weeks),
  interludeEnd: () => interludeFlow.interludeEnd(get, set),
  pendingActivity: null,
  activityRoll: () => FLOWS.activity.roll(get, set),
  activityReroll: () => FLOWS.activity.reroll(get, set),
  activityBonusSL: () => FLOWS.activity.bonusSL(get, set),
  activityDarkPact: () => FLOWS.activity.darkPact(get, set),
  activityCancel: () => FLOWS.activity.cancel(get, set),
  activityConfirm: () => interludeFlow.confirmActivity(get, set),
  interludeRevenus: (heroId) => interludeFlow.openRevenus(get, set, heroId),
  interludeCraftStart: (heroId, trapping, atouts, defauts) => interludeFlow.craftStart(get, set, heroId, trapping, atouts, defauts),
  interludeCraftRoll: (heroId) => interludeFlow.openCraftRoll(get, set, heroId),
  interludeBank: (heroId, kind, amountBrass, rate) => interludeFlow.bankDeposit(get, set, heroId, kind, amountBrass, rate),
  interludeWithdraw: (index) => interludeFlow.bankWithdraw(get, set, index),
  interludeLearn: (heroId, talent) => interludeFlow.openLearn(get, set, heroId, talent),
  interludeOrder: (heroId, trapping) => interludeFlow.orderItem(get, set, heroId, trapping),
  interludeIdentify: (heroId, itemUid) => interludeFlow.openIdentify(get, set, heroId, itemUid),

  net: netFlow.initialNet(),
  netHostStart: (name) => netFlow.netHostStart(get, set, name),
  netJoin: (code, name) => netFlow.netJoin(get, set, code, name),
  netAssign: (heroId, seat) => netFlow.netAssign(get, set, heroId, seat),
  netAssignSlot: (slot, seat) => netFlow.netAssignSlot(get, set, slot, seat),
  netLeave: () => netFlow.netLeave(get, set),
  partyAddHero: (hero, wealth, seat) => partyFlow.partyAddHero(get, set, hero, wealth, seat),
  partyRemoveHero: (heroId) => partyFlow.partyRemoveHero(get, set, heroId),

  // ── Sauvegarde / chargement (Jalon 5) — snapshot zéro-maintenance, hors combat ──
  saveGame: (slot) => {
    const s = get();
    if (s.battle) {
      get().log('Impossible de sauvegarder en plein combat.');
      return false;
    }
    const save = snapshotSave(s as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, new Date().toISOString());
    const ok = saveToSlot(slot, save);
    get().log(ok ? `Partie sauvegardée (emplacement ${slot}).` : 'Sauvegarde impossible (stockage indisponible ou plein).');
    return ok;
  },
  loadGame: (slot) => {
    const save = readSlot(slot);
    if (!save) return false;
    applyLoadedSave(set, save);
    return true;
  },
  importGame: (json) => {
    const save = importSave(json);
    if (!save) return false;
    applyLoadedSave(set, save);
    return true;
  },

  // ── Actions GROUPE (équipement / avancement) : déléguées à partyFlow ──
  toggleEquip: (heroId, uid) => partyFlow.toggleEquip(get, set, heroId, uid),
  createLoadout: (heroId, name) => partyFlow.createLoadout(get, set, heroId, name),
  renameLoadout: (heroId, id, name) => partyFlow.renameLoadout(get, set, heroId, id, name),
  deleteLoadout: (heroId, id) => partyFlow.deleteLoadout(get, set, heroId, id),
  setActiveLoadout: (heroId, id) => partyFlow.setActiveLoadout(get, set, heroId, id),
  setLoadoutSlot: (heroId, id, slot, uid) => partyFlow.setLoadoutSlot(get, set, heroId, id, slot, uid),
  setWeaponSetSlot: (heroId, setIndex, slot, uid) => partyFlow.setWeaponSetSlot(get, set, heroId, setIndex, slot, uid),
  activateWeaponSet: (heroId, setIndex) => partyFlow.activateWeaponSet(get, set, heroId, setIndex),
  transferItem: (uid, fromHeroId, toHeroId) => partyFlow.transferItem(get, set, uid, fromHeroId, toHeroId),
  setItemSkin: (heroId, uid, patch) => partyFlow.setItemSkin(get, set, heroId, uid, patch),
  grantXp: (heroId, amount) => partyFlow.grantXp(get, set, heroId, amount),
  buyCharAdvance: (heroId, char) => partyFlow.buyCharAdvance(get, set, heroId, char),
  buySkillAdvance: (heroId, skillName, spec) => partyFlow.buySkillAdvance(get, set, heroId, skillName, spec),
  buyTalent: (heroId, talentName) => partyFlow.buyTalent(get, set, heroId, talentName),
  designateCareerSlot: (heroId, slotKey, label) => partyFlow.designateCareerSlot(get, set, heroId, slotKey, label),
  /** Mémorise un sort (PX selon le Talent, LDB 46/10) ; un sort du Chaos corrompt (+1, seuil → mutation). */
  buySpell: (heroId, label) => {
    const r = partyFlow.buySpell(get, set, heroId, label);
    if (r.ok && r.chaos) {
      const hero = get().party.find((h) => h.id === heroId);
      if (hero) {
        for (const l of gainCorruption(get, set, hero, 1)) get().log(l);
        set({ party: [...get().party] });
      }
    }
  },
  trainProsthesis: (heroId, uid) => partyFlow.trainProsthesis(get, set, heroId, uid),
  changeCareer: (heroId, newCareer, newLevel) => partyFlow.changeCareer(get, set, heroId, newCareer, newLevel),
  creditPartyMoney: (m, note) => partyFlow.creditPartyMoney(get, set, m, note),

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
    // navigation/vue (screen, caméra, zoom), le groupe (posé par `setParty`) et la SESSION COOP
    // (net : héberger une partie PUIS la lancer ne doit pas dissoudre le salon — Jalon 7).
    const { screen, party, camRot, zoom, viewMode, inspectEnabled, net } = get();
    set({
      ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>),
      screen, party, camRot, zoom, viewMode, inspectEnabled, net,
      scene: JSON.parse(JSON.stringify(scene)),
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

  loadProject: (scenes, entryId, worldMap) => {
    // Enregistre toutes les scènes du projet (pour que les portes reveal:'door'
    // résolvent leurs intérieurs), puis démarre la scène d'entrée.
    for (const s of scenes) registerScene(s);
    const entry = scenes.find((s) => s.id === entryId) ?? scenes[0];
    if (entry) get().startScene(entry);
    // La carte du PROJET remplace celle de la campagne (restaurée par le reset de startScene) ;
    // un projet sans carte n'offre pas de voyage.
    if (worldMap !== undefined) set({ worldMap });
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
      scene: JSON.parse(JSON.stringify(target)),
      mode: 'exploration',
      partyPos: { ...start },
      lightLevel: null, // nouvelle scène → lumière auto (un setLight ne se propage pas d'une scène à l'autre)
      // flags persistants : on conserve l'état narratif et on ajoute les
      // valeurs par défaut de la nouvelle scène pour les clés absentes.
      flags: { ...target.flags, ...s.flags },
      dialogue: null,
      battle: null,
      pendingTest: null,
      pendingCorruption: null,
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
      pendingApproach: null,
      pendingFocus: null,
      pendingPsych: null,
      pendingEncounterPsych: null,
      pendingFrenzy: null,
      pendingCascade: null,
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
    if (!isWalkable(scene, pt.x, pt.y, pt.z ?? 0)) return; // case de l'ÉTAGE visé (z) — une case « vide » se refuse
    const from = partyPos; // case quittée (sert de retour hors du bâtiment)
    set({ partyPos: pt });
    const leadId = get().party[0]?.id;
    if (leadId) get().faceFromPath(leadId, [from, pt]);
    bus.emit(EVT.SCENE_DIRTY);
    // Portes/intérieurs : au sol seulement (les bâtiments vivent au niveau 0).
    const door = (pt.z ?? 0) === 0 ? doorAt(scene, pt.x, pt.y) : undefined;
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
    if (!ent || ent.combat?.hiddenUntilCombat) return; // un ennemi d'embuscade n'est pas interpellable en exploration
    if (chebyshev(partyPos, ent.pos) > 1) {
      // Trop loin : le déplacement-puis-fouille (P5) est armé par l'UI (setPendingInteract) ; ici, no-op.
      return;
    }
    if (ent.dialogueId) {
      const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
      if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start, speakerId: ent.id } });
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
      // Butin → fenêtre d'attribution (« qui l'emporte ? ») au lieu d'aller en silence au 1er héros.
      applyEffectsLoot(get, set, ent.interact.effects, ent.label ?? 'Fouille');
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
    // Logique du choix (effets + branches) → runFlow ; objet/argent reçu = fenêtre d'attribution (titrée du donateur).
    if (choice.flow) {
      const speaker = st.scene?.entities.find((e) => e.id === st.dialogue?.speakerId)?.label;
      runFlow(get, set, choice.flow, speaker ?? 'Butin');
    }
    if (choice.next) set({ dialogue: { dialogue: st.dialogue.dialogue, nodeId: choice.next, speakerId: st.dialogue.speakerId } });
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
  bargainDarkPact: () => FLOWS.bargain.darkPact(get, set),
  bargainConfirm: () => merchantFlow.bargainConfirm(get, set),
  bargainCancel: () => set({ pendingBargain: null }),

  appraiseItem: (uid, heroId, mode) => merchantFlow.appraiseItem(get, set, uid, heroId, mode),
  appraiseGear: (scope, index, mode) => merchantFlow.appraiseGear(get, set, scope, index, mode),
  appraiseRoll: () => FLOWS.appraise.roll(get, set),
  appraiseReroll: () => FLOWS.appraise.reroll(get, set),
  appraiseBonusSL: () => FLOWS.appraise.bonusSL(get, set),
  appraiseDarkPact: () => FLOWS.appraise.darkPact(get, set),
  resolveAppraise: () => merchantFlow.resolveAppraise(get, set),
  appraiseCancel: () => set({ pendingAppraise: null }),

  seedRng: (seed) => {
    seedBattleRng(seed);
  },

  startCombat: (encounterId, onVictory, opts) => {
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
      c.chambered = magazineSize(rw); // À Répétition : chargeur plein au début du combat (LDB 62 l.264)
      if (rw) c.ammoUid = compatibleAmmo(c, rw)[0]?.uid;
      return c;
    });
    // Chaque membre RÉFÉRENCE une entité de la scène. L'entité PORTE le profil/apparence/arme/traits
    // — on résout (membre + entité appariés), puis
    // on spawne (id `enemy-${i}`, conservé pour les tests/recettes de combat).
    const byEntity = new Map(scene.entities.map((e) => [e.id, e]));
    const roster = (enc.members ?? [])
      .map((m) => ({ m, ent: byEntity.get(m.entityId) }))
      .filter((r): r is { m: typeof r.m; ent: SceneEntity } => !!r.ent);
    const enemies = roster.map(({ ent }, i) =>
      spawnEnemy(ent.ref, ent.statblock, `enemy-${i}`, { ...ent.pos }, {
        appearance: ent.appearance, weapon: ent.weapon,
        optionals: ent.combat?.optionals, spells: ent.combat?.spells, randomChars: ent.combat?.randomChars, // LDB 76/78
      }));
    // Combat monté (LDB 14) : marquer les montures rideables, basculer les « alliés », puis appairer
    // les couples pré-montés (ridesEntityId → la monture). Le cavalier monte SUR sa monture.
    const idxByEntity = new Map(roster.map((r, i) => [r.ent.id, i]));
    roster.forEach(({ m }, i) => {
      if (m.side === 'ally') enemies[i].kind = 'hero';
      if (m.mount) enemies[i].mountable = true;
    });
    roster.forEach(({ m }, i) => {
      if (m.ridesEntityId == null) return;
      const mi = idxByEntity.get(m.ridesEntityId);
      const mount = mi == null ? undefined : enemies[mi];
      if (!mount) return;
      mount.mountable = true;
      mountUp(enemies[i], mount); // partage la position/empreinte de la monture (LDB 14 l.215)
    });
    const all = [...heroes, ...enemies];
    // Surprise (LDB 13) : si l'encounter le déclare, le camp embusqué teste Perception vs Discrétion.
    // `noSurprise` : le voyage annule l'embuscade quand le groupe « les voit venir » (Perception réussie).
    const surpriseLines = enc.surprise && !opts?.noSurprise ? applySurprise(all, enc.surprise) : [];
    // Initiative : on fixe l'Initiative de chaque combattant (I + 1d10 simplifié).
    // Combat instinctif (LDB 10) : +10 × niveau à l'Initiative de combat.
    for (const c of all) c.initiative = c.characteristics.I + battleRng().int(1, 10) + talentInitiativeBonus(c);
    // Effrayant (LDB 10) : le porteur inspire Peur (Indice = niveau) — comme un statbloc « Peur N ».
    for (const c of all) {
      const fear = talentFearIndice(c);
      if (fear > 0) c.causesPeur = Math.max(c.causesPeur ?? 0, fear);
    }
    // Lente (LDB 63 l.25) : le porteur d'une arme Lente frappe toujours en dernier dans le Round.
    const ordered = initiativeOrder(all);
    const order = [...ordered.filter((c) => !strikesLast(c.weapons)), ...ordered.filter((c) => strikesLast(c.weapons))].map((c) => c.id);
    const battle: BattleState = {
      combatants: all,
      order,
      baseOrder: order,
      // Pause d'ouverture : PERSONNE n'est actif (turn -1) tant qu'on n'a pas « Commencé » —
      // toutes les affordances (marche/course, anneaux, visée, clics, IA) dérivent de l'actif
      // et se taisent d'elles-mêmes ; confirmRoundStart pose le vrai tour (LDB ch.17 l.27).
      turn: -1,
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
      // Pièges/hasards authorés de la scène → zones de bataille PERMANENTES (même runtime que les sorts).
      zones: sceneZonesToBattle(scene.effectZones),
    };
    // Repart d'aucune modale de jet héritée d'un combat/contexte précédent.
    // Ouverture = pause de début du Round 1 (pendingRoundStart) : champ visible, ordre d'Initiative dans la
    // frise, pré-emption « agir en premier » (Chance, #12a) — IA gelée. Un seul bouton « Commencer le combat »
    // (pas de phase « plan d'ensemble » séparée : c'était redondant avec la pause de Round).
    set({ battle, mode: 'battle', pendingRoundStart: { round: battle.round }, pendingVictory: null, pendingAttack: null, pendingReload: null, pendingStateRecovery: null, pendingDefense: null, pendingMountTarget: null, pendingDisengage: null, pendingCast: null, pendingCounterspell: null, enemyAim: null, pendingHeal: null, pendingCleave: null, pendingReveals: [], pendingTrample: null, pendingRun: null, pendingFocus: null, pendingPsych: null, pendingEncounterPsych: null, pendingFrenzy: null, pendingFumble: null });
    get().faceAtCombatStart();
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Écran de victoire : assignation du butin (même flux que le marchand) + fermeture ──
  dismissVictory: () => {
    const pv = get().pendingVictory;
    const leftoverGear = (pv?.gear ?? []).map((g) => g.effect); // équipement non attribué → 1er héros par défaut
    const cont = pv?.onContinue;
    set({ pendingVictory: null, battle: null, mode: 'exploration' });
    if (leftoverGear.length) applyEffects(get, set, leftoverGear);
    if (cont?.length) applyEffects(get, set, cont); // #9 : téléport/dialogue de onVictory APRÈS « Continuer »
  },
  /** Ferme la fenêtre de loot — même contrat que la victoire : le non-attribué va au 1er héros. */
  dismissLoot: () => {
    const pl = get().pendingLoot;
    const leftover = (pl?.gear ?? []).map((g) => g.effect);
    set({ pendingLoot: null });
    if (leftover.length) applyEffects(get, set, leftover);
  },
  assignLootGear: (index, heroId) => assignGearAt(get, set, 'pendingLoot', index, heroId),
  /** Attribue un objet d'équipement du butin de victoire au héros choisi (qualités/skin conservés). */
  assignVictoryGear: (index, heroId) => assignGearAt(get, set, 'pendingVictory', index, heroId),
  harvestCreature: (name) => harvestVictoryCreature(get, set, name),
  raiseHand: () => {
    const b = get().battle;
    if (!b || b.handRaised) return;
    set({ battle: { ...b, handRaised: true, log: [...b.log, ev('info', 'Un joueur demande la pause au prochain Round (✋).')] } });
  },
  victoryReady: (seat) => {
    const pv = get().pendingVictory;
    if (!pv) return;
    const readyBySeat = { ...(pv.readyBySeat ?? {}), [seat]: true };
    set({ pendingVictory: { ...pv, readyBySeat } });
    const s = get();
    if (s.net.mode === 'guest') return; // l'invité ne fait que marquer
    const required = new Set<number>([0]);
    for (const h of s.party) {
      if (h.dead || h.outOfRencontre) continue;
      const owner = s.net.ownership[h.id] ?? 0;
      if (s.net.seatNames[owner] != null) required.add(owner);
    }
    if ([...required].every((st) => readyBySeat[st])) get().dismissVictory();
  },

  battleSelectAction: (a) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
    // offensive. Le déplacement (fuite) passe par le clic-sol implicite (filtre dans computeMoveReach) ;
    // ici seuls « resolve » (Détermination, qui peut retirer le Brisé) et la fermeture (null) passent.
    // (« Se cacher » par Discrétion = pas de système de furtivité en combat ; approximé par « rester
    // hors de vue » → récupération en fin de Round, cf. brokenRecovery.)
    if (hasCondition(active, 'Brisé') && a !== 'resolve' && a !== null) {
      get().log(`${active.name} est Brisé : il ne peut que fuir ou puiser dans sa Détermination.`);
      return;
    }
    // Sonné : pas d'Action (attaque/incantation/soin). La Détermination ('resolve') ne coûte pas l'Action
    // et peut retirer le Sonné (LDB ch.17 l.62-66) ; les manœuvres situationnelles gratuites (Se relever,
    // Se désengager…) sont des slots DIRECTS qui n'appellent pas battleSelectAction → elles passent ce garde.
    if (a !== 'resolve' && a !== null && !canTakeAction(active)) return;
    // Quitter le mode incantation oublie le sort sélectionné. Le déplacement et l'attaque n'ont PLUS de
    // mode : ils sont implicites au clic (battleClickTile/battleClickEntity) — le reachable stocké ne
    // porte que les budgets spéciaux (Course, post-Désengagement), on ne le touche pas ici.
    const selectedSpell = a === 'cast' || a === 'focus' ? battle.selectedSpell : null;
    set({ battle: { ...battle, action: a, selectedSpell, preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Guérison (LDB 09-Compétences l.226-243) — soin de Blessures / arrêt d'Hémorragie ──

  battleHeal: (targetId, mode) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
      },
      battle: { ...battle, action: null },
    });
  },

  // ── Infirmerie (hors combat) : modale de soins PERSISTANTE — cf. state/medicFlow ──
  openMedic: (opts) => medicFlow.openMedic(get, set, opts),
  medicSelectPatient: (id) => medicFlow.medicSelectPatient(get, set, id),
  medicAct: (act) => medicFlow.medicAct(get, set, act),
  medicSetWound: (idx) => medicFlow.medicSetWound(get, set, idx),
  medicSurgeryPass: () => medicFlow.medicSurgeryPass(get, set),
  medicEndSurgery: () => medicFlow.medicEndSurgery(get, set),
  closeMedic: () => medicFlow.closeMedic(get, set),

  // ── Repos (modale de nuit) : cf. state/restFlow ──
  openRest: (opts) => restFlow.openRest(get, set, opts),
  restSet: (heroId, patch) => restFlow.restSet(get, set, heroId, patch),
  restReady: (seat) => restFlow.restReady(get, set, seat),
  restSleep: () => restFlow.restSleep(get, set),
  restCancel: () => restFlow.restCancel(get, set),
  restContinue: () => restFlow.restContinue(get, set),

  /** « Lancer » : effectue le jet de Guérison (Intermédiaire +0). */
  healRoll: () => FLOWS.heal.roll(get, set),
  /** Chance (relance / +1 DR) et Résilience : cf. spec `heal` de rollFlows. */
  healReroll: () => FLOWS.heal.reroll(get, set),
  healBonusSL: () => FLOWS.heal.bonusSL(get, set),
  healDarkPact: () => FLOWS.heal.darkPact(get, set),
  healForceSuccess: () => FLOWS.heal.forceSuccess(get, set),

  /** « Appliquer » : applique le soin (le jet est déjà figé). Coûte l'Action en combat. L'infirmerie
   *  (`medic`) n'est PAS touchée : la modale persistante reste ouverte pour l'acte suivant. */
  healConfirm: () => {
    const ph = get().pendingHeal;
    if (!ph || ph.roll == null) return;
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
        : treatTrauma(target, ph.sl, ph.success); // mode 'trauma' — l'échec consomme aussi le jet (LDB 18 l.317)
    }
    finishPlayerAction(get, set, log, 'heal'); // sortie commune combat / hors combat
  },

  /** Annule avant tout jet. Acte PAYANT d'un PNJ (infirmerie) : remboursé tant que rien n'est lancé. */
  healCancel: () => {
    const ph = get().pendingHeal;
    if (ph?.paidCost && ph.roll == null) set((s) => ({ money: moneyAdd(s.money, toMoney(ph.paidCost!)) }));
    set({ pendingHeal: null });
  },

  /** Sélectionne un sort à incanter ; le clic suivant sur une cible le lance. Un sort de ZONE
   *  ouvre la modale DIRECTEMENT (flux « jet puis pose », LDB 47 l.29) — pas de cible à désigner. */
  battleSelectSpell: (label) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || battle.acted) return;
    set({ battle: { ...battle, action: 'cast', selectedSpell: label, reachable: new Map() } });
    castZoneSpell(get, set, active, label); // no-op si le sort n'est pas une ZdE chiffrable
    bus.emit(EVT.SCENE_DIRTY);
  },

  battleUseItem: (uid) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
    const spell = effectiveSpellOf(pc); // NI ×2 si lecture au grimoire (LDB 47 l.34)
    if (!caster || !target || !spell) return;
    // ZONE non posée (flux « jet puis pose ») : pas de cible désignée au jet — pas de ward
    // individuel (« N'écoutez point » protège une CIBLE), pas de résolution Projectile (les
    // Dégâts par cible sont dérivés du même jet À LA POSE, evaluateMissile).
    const unplacedZone = !!pc.zone && !pc.zone.center;
    const sigmar = unplacedZone ? 0 : castWardPenalty(get(), target, spell); // « N'écoutez point la Sorcière »
    const aqshy = domainCastBonus(get(), caster, spell); // attribut d'Aqshy : +10/En flammes proche
    const ward = sigmar + aqshy;
    const res = pc.missile && !unplacedZone
      ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused, ward)
      : resolveCasting(caster, spell, battleRng(), 'intermediaire', pc.focused, ward);
    if (sigmar) get().log(`${caster.name} : −20 en Langue (Magick) — la cible est sous la protection de Sigmar (N'écoutez point la Sorcière).`);
    if (aqshy) get().log(`${caster.name} : +${aqshy} en Langue (Magick) — Aqshy se nourrit des flammes proches.`);
    // Lanceur ENNEMI : Surincantation automatique (LDB 47 l.28-31) — le surplus de DR alloué à
    // l'axe Cible d'un Projectile (l'IA n'a pas de modale de choix ; ZdE déjà toutes-cibles).
    const auto = caster.kind === 'enemy' && pc.missile && !pc.zone
      ? aiOvercastPlan(caster, pc.targetId, spell, res, get().battle?.combatants ?? [], pc.focused, spellSightOf(get))
      : {};
    set({ pendingCast: { ...pc, result: res, ...auto } });
    // Dissipation (LDB 46 l.201-202) : un lanceur ENNEMI éligible chante un Contre-sort contre le
    // SORT d'un héros — opposé au Test d'Incantation (déclaré pendant l'incantation : l'IA n'attend
    // pas l'issue du jet — il module les DR, donc le budget de Surincantation AVANT la pose), un
    // seul par Round. Un jet CRITIQUE n'est pas contré (« Force inéluctable », LDB 46 l.59).
    // Zone non posée : « vise un point que vous pouvez voir » n'a pas encore de point — ancre la
    // moins inventive : le LANCEUR (même clause de distance FM mètres ; le RAW est muet).
    if (caster.kind === 'hero' && isDispellableSpell(spell) && !res.isCritical) {
      const best = counterspellCandidates(get().battle, get().scene, caster, unplacedZone ? caster : target)
        .sort((a, b) => castingValue(b, 'Langue', 'Magick') - castingValue(a, 'Langue', 'Magick'))[0];
      if (best) applyCounterspell(get, set, best);
    }
  },
  /** Contre-sort d'un HÉROS contre l'incantation ennemie figée (Dissipation, LDB 46 l.201-202). */
  // Cycle Chance/Pacte/Résilience UNIFIÉ (fabrique rollFlow — spec `cast` de rollFlows.ts).
  castReroll: () => FLOWS.cast.reroll(get, set),
  castBonusSL: () => FLOWS.cast.bonusSL(get, set),
  castDarkPact: () => FLOWS.cast.darkPact(get, set),
  castConfirm: () => {
    const { pendingCast: pc } = get();
    if (!pc || !pc.result) return;
    // ZONE non posée et lançable → la confirmation EST le passage en pose (garde anti-application
    // sur l'ancre lanceur — la vraie application se fait à la pose, castCommitZone).
    if (pc.zone && !pc.zone.center && (pc.result.cast || (pc.result.isCritical && (pc.critChoice ?? 'puissance') === 'puissance'))) {
      get().castPlaceZone(true);
      return;
    }
    const caster = actorIn(get(), pc.casterId);
    const target = actorIn(get(), pc.targetId);
    const spell = effectiveSpellOf(pc); // NI ×2 si lecture au grimoire (LDB 47 l.34)
    // Surincantation : cibles supplémentaires + multiplicateur de durée (LDB 47 l.28-31).
    // ZdE : TOUTES les cibles de la zone sont visées (pas de budget de Surincantation).
    const extras = (pc.extraTargetIds ?? [])
      .map((id) => actorIn(get(), id))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(0, pc.zone ? undefined : pc.overcast?.targets ?? 0);
    // OPPOSITION (`spec.opposed`) : un Sort réussi dont la/les cible(s) opposent leur Test (FM/Int)
    // ne s'applique PAS encore — on ouvre le multijet d'opposition DANS la modale (GARDE pendingCast).
    // `oppositionConfirm` repose `opposedOutcome` puis rappelle castConfirm (ce bloc est alors sauté).
    if (caster && target && spell && pc.result.cast && !pc.opposedOutcome && get().battle
        && openCastOpposition(get, set, pc, [target, ...extras])) {
      return;
    }
    set({ pendingCast: null });
    if (caster && target && spell) {
      applyCast(get, set, caster, target, spell, pc.result, pc.missile, pc.focused, pc.critChoice, {
        durationMult: 1 + (pc.overcast?.duration ?? 0),
        extraTargets: extras,
        conjureForm: pc.conjureForm,
        opposedOutcome: pc.opposedOutcome,
      });
    }
    // Lanceur ENNEMI (modale témoin) : le tour de l'IA était suspendu → reprise. No-op si une
    // autre interaction bloquante s'est ouverte (Destin, révélations) — elle reprendra elle-même.
    if (caster?.kind === 'enemy' && get().battle) resumeEnemyTurn(get, set);
  },
  /** Incantation CRITIQUE (LDB 46 l.52-59) : le lanceur choisit l'effet bonus dans la modale. */
  castSetCritChoice: (choice) => {
    const pc = get().pendingCast;
    if (!pc || !pc.result?.isCritical) return;
    set({ pendingCast: { ...pc, critChoice: choice } });
  },
  /** Arme invoquée à forme libre (Arme aethyrique) : le lanceur choisit la forme/Spé de Corps à corps. */
  castSetConjureForm: (form) => {
    const pc = get().pendingCast;
    if (!pc) return;
    set({ pendingCast: { ...pc, conjureForm: form } });
  },
  /** Surincantation : chaque allocation consomme +2 DR du surplus — Sorts : DR − NI (LDB 47
   *  l.28-31) ; Bénédictions/Miracles : DR entier (LDB 41/42 « Degrés de Réussite » — Durée
   *  +durée initiale, Cibles +1). */
  castAllocOvercast: (axis) => {
    const pc = get().pendingCast;
    const spell = pc && findSpell(pc.spellLabel);
    if (!pc || !pc.result?.cast || !spell) return;
    const oc = pc.overcast ?? { duration: 0, targets: 0 };
    const ni = spell.cn == null ? 0 : pc.focused ? 0 : spell.cn; // Prière : pas de NI à dépasser
    const budget = Math.floor(Math.max(0, pc.result.sl - ni) / 2);
    if (oc.duration + oc.targets + (oc.zone ?? 0) >= budget) return; // surplus épuisé
    const next = { ...oc, [axis]: (oc[axis] ?? 0) + 1 };
    // « +Zone » (LDB 47 l.29) : chaque allocation ajoute la valeur INITIALE de Zone d'Effet —
    // le rayon du gabarit est recalculé (la pose et l'aperçu lisent `zone.radius`).
    const zone = axis === 'zone' && pc.zone
      ? { ...pc.zone, radius: zoneRadiusTilesAt(pc.zone.r0m ?? 0, next.zone ?? 0) }
      : pc.zone;
    set({ pendingCast: { ...pc, overcast: next, ...(zone ? { zone } : {}) } });
  },
  castToggleExtraTarget: (id) => {
    const pc = get().pendingCast;
    if (!pc || !pc.result?.cast) return;
    // Garde : seules les cibles ÉLIGIBLES (portée/éveillées, LDB 47 l.28-31) sont togglables —
    // indispensable depuis le clic carte (pickingTargets), inoffensif depuis le picker en modale.
    const pool = get().battle?.combatants ?? get().party;
    const caster = pool.find((c) => c.id === pc.casterId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !spell || !overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, spellSightOf(get)).some((c) => c.id === id)) return;
    const cur = pc.extraTargetIds ?? [];
    const next = cur.includes(id)
      ? cur.filter((x) => x !== id)
      : cur.length < (pc.overcast?.targets ?? 0) && id !== pc.targetId
        ? [...cur, id]
        : cur;
    set({ pendingCast: { ...pc, extraTargetIds: next } });
  },
  castPickTargets: (on) => {
    const pc = get().pendingCast;
    if (!pc || !pc.result?.cast || !get().battle) return; // hors combat : pas de carte tactique → picker en modale
    set({ pendingCast: { ...pc, pickingTargets: on } });
  },
  /** Pose de la ZONE (flux « jet puis pose ») : la modale s'efface, le gabarit FINAL suit le
   *  curseur, le clic-case dépose (castCommitZone) ; `false` = revenir à la modale. */
  castPlaceZone: (on) => {
    const pc = get().pendingCast;
    if (!pc?.zone || pc.zone.center || !pc.result || !get().battle) return;
    set({ pendingCast: { ...pc, zone: { ...pc.zone, placing: on } } });
  },
  castCancel: () => {
    const pc = get().pendingCast;
    const caster = pc && actorIn(get(), pc.casterId);
    set({ pendingCast: null });
    // Modale d'un lanceur ENNEMI fermée sans appliquer : reprendre le tour suspendu (anti soft-lock).
    if (caster?.kind === 'enemy' && get().battle) resumeEnemyTurn(get, set);
  },
  // Contre-sort à plusieurs (flux multi) : chaque verbe cible un participant via `pid` (fabrique unique).
  counterspellRoll: (pid) => FLOWS.counterspell.roll(get, set, pid),
  counterspellReroll: (pid) => FLOWS.counterspell.reroll(get, set, pid),
  counterspellBonusSL: (pid) => FLOWS.counterspell.bonusSL(get, set, pid),
  counterspellDarkPact: (pid) => FLOWS.counterspell.darkPact(get, set, pid),
  counterspellForceSuccess: (pid) => FLOWS.counterspell.forceSuccess(get, set, pid),
  counterspellSetForcedRoll: (pid, roll) => FLOWS.counterspell.setForcedRoll(get, set, roll, pid),
  counterspellConfirm: () => {
    const pcs = get().pendingCounterspell;
    if (!pcs) return;
    const rolled = pcs.participants.filter((p): p is CounterParticipant & { result: NonNullable<CounterParticipant['result']> } => !!p.result);
    // Dissipé si UN héros gagne ; sinon le MEILLEUR DR de Contre-sort réduit l'incantation (LDB 46 l.207).
    const disp = rolled.find((p) => p.result.dispelled);
    const best = disp ?? (rolled.length ? rolled.reduce((b, p) => (p.result.counter.sl > b.result.counter.sl ? p : b)) : undefined);
    set({ pendingCounterspell: null });
    if (best) {
      const counter = actorIn(get(), best.id);
      if (counter) applyCounterspellOutcome(get, set, counter, best.result); // mute `pendingCast.result`
    }
    get().castConfirm(); // applique le Sort (dissipé ou au DR net) + reprend le tour de l'IA
  },
  counterspellCancel: () => {
    if (!get().pendingCounterspell) return;
    set({ pendingCounterspell: null });
    get().castConfirm(); // « Laisser passer » : le Sort se résout tel quel
  },
  // Test Étendu SÉQUENTIEL (LDB 12) : chaque Round est un slot du flux multi (fabrique UNIQUE).
  startExtendedTest: (opts) => {
    set({ pendingExtendedTest: { ...opts, total: 0, rounds: [{ id: 'round-1', interactive: true, result: null }] } });
  },
  extendedTestRoll: (pid) => FLOWS.extendedTest.roll(get, set, pid),
  extendedTestReroll: (pid) => FLOWS.extendedTest.reroll(get, set, pid),
  extendedTestBonusSL: (pid) => FLOWS.extendedTest.bonusSL(get, set, pid),
  extendedTestDarkPact: (pid) => FLOWS.extendedTest.darkPact(get, set, pid),
  extendedTestForceSuccess: (pid) => FLOWS.extendedTest.forceSuccess(get, set, pid),
  extendedTestSetForcedRoll: (pid, roll) => FLOWS.extendedTest.setForcedRoll(get, set, roll, pid),
  extendedTestNext: () => {
    const p = get().pendingExtendedTest;
    if (!p) return;
    const cur = p.rounds[p.rounds.length - 1];
    if (!cur?.result) return; // le Round courant doit avoir été lancé
    // Cumul (LDB 12 l.200) : « les DR obtenus à chaque Round sont additionnés jusqu'à atteindre une
    // valeur cible. Si le DR total passe en dessous de 0, vous pouvez recommencer depuis le début. »
    let total = p.total + cur.result.sl;
    if (total < 0) total = 0;
    if (total >= p.targetDR) {
      set({ pendingExtendedTest: null });
      get().log(`${p.label} : réussi (DR cumulé ${total} / ${p.targetDR}).`);
      if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // gate la suite (porte/serrure d'éditeur)
      return;
    }
    set({ pendingExtendedTest: { ...p, total, rounds: [...p.rounds, { id: `round-${p.rounds.length + 1}`, interactive: true, result: null }] } });
  },
  extendedTestCancel: () => { set({ pendingExtendedTest: null }); },
  // Enfoncer une porte à plusieurs (EDO Appendice 2) : flux multi PARALLÈLE (objet BE/B).
  startForceDoor: (opts) => {
    set({ pendingForceDoor: { label: opts.label, doorBE: opts.doorBE, doorB: opts.doorB, doorBmax: opts.doorB, flag: opts.flag,
      participants: opts.heroIds.map((id) => ({ id, interactive: true, result: null })) } });
  },
  forceDoorRoll: (pid) => FLOWS.forceDoor.roll(get, set, pid),
  forceDoorReroll: (pid) => FLOWS.forceDoor.reroll(get, set, pid),
  forceDoorBonusSL: (pid) => FLOWS.forceDoor.bonusSL(get, set, pid),
  forceDoorDarkPact: (pid) => FLOWS.forceDoor.darkPact(get, set, pid),
  forceDoorForceSuccess: (pid) => FLOWS.forceDoor.forceSuccess(get, set, pid),
  forceDoorSetForcedRoll: (pid, roll) => FLOWS.forceDoor.setForcedRoll(get, set, roll, pid),
  forceDoorConfirm: () => {
    const p = get().pendingForceDoor;
    if (!p) return;
    // Dégâts du Round = somme des coups (chacun déjà réduit par le BE à la résolution). Objets : pas de min 1.
    const dmg = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
    const doorB = p.doorB - dmg;
    if (doorB <= 0) {
      set({ pendingForceDoor: null });
      get().log(`${p.label} cède ! (${dmg} dégât${dmg > 1 ? 's' : ''})`);
      if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // ouverture en jeu (porte d'éditeur)
    } else {
      // La porte tient : un nouveau Round s'ouvre (chacun re-frappe — jets remis à zéro).
      set({ pendingForceDoor: { ...p, doorB, participants: p.participants.map((x) => ({ ...x, result: null, rerolled: false, forced: false })) } });
      get().log(`${p.label} : ${dmg} dégât${dmg > 1 ? 's' : ''}, reste ${doorB} Blessure${doorB > 1 ? 's' : ''}.`);
    }
  },
  forceDoorCancel: () => { set({ pendingForceDoor: null }); },
  // CASCADE séquentielle (jets de NUIT / VOYAGE) : flux multi SÉQUENTIEL générique (fabrique UNIQUE).
  // L'étape courante = `participants[cursor]` ; la conséquence par `kind` + l'avancée vivent dans
  // `advanceCascade` (state/cascade.ts), la finalisation propre au `purpose` ici.
  cascadeRoll: (pid) => FLOWS.cascade.roll(get, set, pid),
  cascadeReroll: (pid) => FLOWS.cascade.reroll(get, set, pid),
  cascadeBonusSL: (pid) => FLOWS.cascade.bonusSL(get, set, pid),
  cascadeDarkPact: (pid) => FLOWS.cascade.darkPact(get, set, pid),
  cascadeForceSuccess: (pid) => FLOWS.cascade.forceSuccess(get, set, pid),
  cascadeSetForcedRoll: (pid, roll) => FLOWS.cascade.setForcedRoll(get, set, roll, pid),
  cascadeChoose: (pid, key) => setCascadeChoice(get, set, pid, key),
  cascadeNext: () => {
    const done = advanceCascade(get, set);
    if (done?.purpose === 'travel' && done.travelHalt) travelFlow.continueTravelAfterNight(get, set);
    else if (done?.purpose === 'combat') resumeSuspendedAI(get, set); // séquence de conséquences close → reprendre l'IA
  },
  cascadeResolveAll: () => resolveRemainingCascade(get, set), // → BILAN (la modale reste ouverte)
  cascadeFinish: () => {
    const done = finalizeCascade(get, set);
    if (done?.purpose === 'travel' && done.travelHalt) travelFlow.continueTravelAfterNight(get, set);
    else if (done?.purpose === 'combat') resumeSuspendedAI(get, set); // bilan clos → reprendre l'IA suspendue
  },
  // Incantation OPPOSÉE (multijet `FLOWS.castOpposition`) : chaque cible oppose son Test ; cible IA
  // = rangée témoin (jet auto-roulé à l'ouverture, cf. openCastOpposition). Mêmes 6 verbes que les autres flux.
  oppositionRoll: (pid) => FLOWS.castOpposition.roll(get, set, pid),
  oppositionReroll: (pid) => FLOWS.castOpposition.reroll(get, set, pid),
  oppositionBonusSL: (pid) => FLOWS.castOpposition.bonusSL(get, set, pid),
  oppositionDarkPact: (pid) => FLOWS.castOpposition.darkPact(get, set, pid),
  oppositionForceSuccess: (pid) => FLOWS.castOpposition.forceSuccess(get, set, pid),
  oppositionSetForcedRoll: (pid, roll) => FLOWS.castOpposition.setForcedRoll(get, set, roll, pid),
  oppositionConfirm: () => {
    const pco = get().pendingCastOpposition;
    const pc = get().pendingCast;
    if (!pco || !pc) return;
    // Issue par cible (résisté + marge de DR) → portée par `pendingCast.opposedOutcome`, lue par applyCast.
    const outcome: Record<string, { resisted: boolean; margin: number }> = {};
    for (const part of pco.participants) if (part.result) outcome[part.id] = { resisted: part.result.resisted, margin: part.result.margin };
    set({ pendingCastOpposition: null, pendingCast: { ...pc, opposedOutcome: outcome } });
    get().castConfirm(); // applique le Sort (cibles résistantes ignorées, autres à la marge)
  },
  /** Ouvre une incantation HORS COMBAT (couture D) : un héros lanceur du groupe cible self/allié.
   *  Réservé aux sorts NON-offensifs — les Projectiles magiques exigent une cible ennemie (combat). */
  oocCastSpell: (casterId, label, targetId, fromGrimoire) => {
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
    castSpell(get, set, caster, target, label, fromGrimoire); // pose `pendingCast` (missile:false, focused selon caster.focus)
  },

  /** Focalise un sort d'Arcane/Domaine (Test étendu de Focalisation). */
  battleFocusSpell: (label) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
    const { battle } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || battle.acted) return;
    const spell = findSpell(label);
    if (!spell || !isArcaneSpell(spell)) {
      get().log('Ce sort ne peut pas être focalisé.');
      return;
    }
    // Contrecoup bloquant la Focalisation (LDB 46/40), s'il y en a un d'actif.
    const fblocked = castBlockedBy(active, 'Focalisation');
    if (fblocked) {
      get().log(`${active.name} ne peut pas focaliser : ${fblocked}.`);
      return;
    }
    // OUVRE la modale (le Test étendu se fait au clic « Lancer ») — « un jet = une modale ».
    set({ pendingFocus: { casterId: active.id, spellLabel: label, result: null } });
  },
  // Focalisation COMMUNE combat/hors-combat (couture D) : acteur via `actorIn`, sortie journal hors combat.
  focusRoll: () => FLOWS.focus.roll(get, set),
  focusReroll: () => FLOWS.focus.reroll(get, set),
  focusBonusSL: () => FLOWS.focus.bonusSL(get, set),
  focusDarkPact: () => FLOWS.focus.darkPact(get, set),
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
    const logLines = [res.log];
    // Focalisation CRITIQUE (LDB 46 l.185-186) : le sort est lançable au prochain Round
    // QUEL QUE SOIT le DR accumulé — mais tant de magie si vite concentrée provoque un
    // contrecoup : Imparfaite Mineure, sauf Talent Harmonisation aethyrique.
    if (res.isCritical) {
      caster.focus = { spell: pf.spellLabel, dr: Math.max(caster.focus.dr, ni) };
      logLines.push(`${caster.name} — Focalisation CRITIQUE : ${spell.label} est lançable au prochain Round (NI 0) !`);
      if (!hasTalent(caster, 'Harmonisation aethyrique')) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
      else logLines.push(`Harmonisation aethyrique : le contrecoup est maîtrisé (pas d'Imparfaite).`);
    }
    logLines.push(caster.focus.dr >= ni ? `${caster.name} a focalisé assez de magie pour lancer ${spell.label} (NI 0).` : `Focalisation : ${caster.focus.dr}/${ni} DR.`);
    // Maladresse en Focalisation → Incantation Imparfaite Majeure (LDB l.190-191 :
    // tout double OU tout résultat en 0 au-delà de la Compétence).
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
    const fblocked = castBlockedBy(caster, 'Focalisation');
    if (fblocked) {
      get().log(`${caster.name} ne peut pas focaliser : ${fblocked}.`);
      return;
    }
    set({ pendingFocus: { casterId: caster.id, spellLabel: label, result: null } });
  },
  // ── Test de Psychologie héros (Peur/Terreur, LDB 21) ── (pas d'« Annuler » : le Test est obligatoire)
  psychRoll: () => FLOWS.psych.roll(get, set),
  psychReroll: () => FLOWS.psych.reroll(get, set),
  psychBonusSL: () => FLOWS.psych.bonusSL(get, set),
  psychForceSuccess: () => FLOWS.psych.forceSuccess(get, set),
  psychSetForcedRoll: (roll) => FLOWS.psych.setForcedRoll(get, set, roll),
  psychDarkPact: () => FLOWS.psych.darkPact(get, set),
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
  encounterPsychDarkPact: () => encounterPsychDarkPactFlow(get, set),
  encounterPsychForceSuccess: () => encounterPsychForceSuccessFlow(get, set),
  encounterPsychConfirm: () => encounterPsychConfirmFlow(get, set),
  encounterPsychResolve: () => encounterPsychResolveFlow(get, set),

  // ── Entrée en Frénésie d'un héros (LDB 21 l.31-36) : Test de FM, succès → +1 BF / immunité psy / attaque obligatoire ──
  battleFrenzy: () => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
  frenzyDarkPact: () => FLOWS.frenzy.darkPact(get, set),
  frenzyConfirm: () => {
    const { battle, pendingFrenzy: pf } = get();
    if (!battle || !pf || !pf.result) return;
    const c = battle.combatants.find((x) => x.id === pf.combatantId);
    set({ pendingFrenzy: null });
    if (!c) return;
    const log = pf.result.success
      ? [`${c.name} entre en Frénésie : +1 Bonus de Force, immunité psychologique, doit attaquer.`]
      : [`${c.name} ne parvient pas à entrer en Frénésie (Test de Force Mentale échoué).`];
    if (pf.result.success) c.frenzied = true;
    set({ battle: { ...get().battle!, acted: true, action: null, log: [...battle.log, ...evLines(log, 'frenzy', c.id)] } });
    checkBattleOver(get, set);
  },
  frenzyCancel: () => set({ pendingFrenzy: null }),

  battleClickTile: (pt, opts) => {
    const { battle, scene } = get();
    if (!battle || !scene || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // TÉLÉPORTATION (Jalon 2.6 — sort « Téléportation », LDB 47) : après l'Appliquer, le lanceur
    // choisit sa case d'arrivée parmi les cases en surbrillance (survol des obstacles).
    if (battle.action === 'teleport') {
      const k = `${pt.x},${pt.y}`;
      if (!battle.reachable.has(k)) return;
      const from = { ...active.pos! };
      const mount = mountOf(battle, active);
      active.pos = { ...pt };
      if (mount) mount.pos = { ...pt }; // couple cavalier↔monture solidaire (comme le déplacement)
      get().faceFromPath(active.id, [from, pt]);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path: [{ ...pt }] });
      if (mount) bus.emit(EVT.ANIM_MOVE, { id: mount.id, path: [{ ...pt }] });
      set({ battle: { ...battle, action: null, reachable: new Map(), preview: null, log: [...battle.log, ev('move', `${active.name} se téléporte.`, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    // POSE de zone en cours (source UNIQUE placingZoneOf — toute zone à poser librement) :
    // le clic-case dépose le gabarit FINAL (gates portée/LdV chez le consommateur).
    if (placingZoneOf(get())) {
      commitPlacedZone(get, set, pt);
      return;
    }
    // Sort de ZONE sélectionné : le clic-case (comme le clic-token) OUVRE la modale — le centre
    // se choisit APRÈS le jet (flux ci-dessus). Sort non-zone : clic-sol sans effet en mode cast.
    if (battle.action === 'cast' && battle.selectedSpell && !battle.acted && !get().pendingCast) {
      castZoneSpell(get, set, active, battle.selectedSpell);
      return;
    }
    // Mode NEUTRE = clic-sol implicite (les modes restants — heal/ammo/trample/resolve… — ne
    // déplacent pas au clic-case ; le cas cast-zone est traité plus haut).
    if (battle.action !== null) return;
    // Engagé : pas de déplacement libre (LDB 15 l.84) → le clic-sol route vers le Désengagement.
    if (isEngaged(active)) {
      startDisengage(get, set, active);
      return;
    }
    if (!canMove(battle, active)) return;
    const reach = displayedReach(get);
    const k = `${pt.x},${pt.y}`;
    const inWalk = reach.has(k);
    // Au-delà de la Marche : zone de COURSE (LDB 15 l.79-82) — le commit demande le Test d'Athlétisme,
    // et le déplacement réel s'arrêtera là où le jet porte (runConfirm).
    const runReach = inWalk ? null : computeRunReach(get);
    if (!inWalk && !runReach?.has(k)) {
      // Clic hors de toute portée : purge l'aperçu en cours (geste « annuler »).
      if (battle.preview) {
        set({ battle: { ...battle, preview: null } });
        bus.emit(EVT.SCENE_DIRTY);
      }
      return;
    }
    const stepCost = (inWalk ? reach.get(k) : runReach!.get(k)) ?? 0; // coût (cases) du segment
    // Peur (LDB 21 l.29) : se RAPPROCHER d'une source de Peur exige un Test de Calme Intermédiaire (+0)
    // — vérifié au COMMIT seulement (l'aperçu reste libre). Une tentative par Tour (battle.fearGate) :
    // succès → approches libres ce Tour ; échec → aucune approche ce Tour.
    const fearGateBlocks = (): boolean => {
      if (battle.fearGate === 'passed') return false;
      const feared = fearedSourceTowards(battle, active, pt);
      if (!feared) return false;
      if (battle.fearGate === 'failed') {
        get().log(`${active.name} ne peut pas s'approcher de ${feared.name} : la Peur le cloue (ce Tour).`);
        return true;
      }
      set({ pendingApproach: { combatantId: active.id, sourceId: feared.id, intent: { kind: 'tile', pt: { ...pt } }, result: null }, battle: { ...battle, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      return true;
    };
    // Frénésie (LDB 21 l.34) : « vous devez vous déplacer à votre maximum en direction de l'ennemi
    // le plus proche dans votre Ligne de Vue » → seules les cases qui RAPPROCHENT de cette cible.
    const frenzyBlocks = (): boolean => {
      if (!active.frenzied) return false;
      const ft = frenzyTarget(get, active);
      if (!ft?.pos || chebyshev(pt, ft.pos) < chebyshev(active.pos!, ft.pos)) return false;
      get().log(`${active.name} est en Frénésie : il doit foncer sur ${ft.name}.`);
      return true;
    };
    // Combat monté : la géométrie (empreinte/collisions) est celle de la MONTURE ; le cavalier la suit.
    const geom = mountOf(battle, active) ?? active;
    const blocked = occupied(battle, geom);
    const prev = battle.preview;
    if (!inWalk) {
      // Zone de Course : tap 1 = aperçu « Courir » ; tap 2 = Test d'Athlétisme (pendingRun + destination).
      if (!opts?.confirm && !(prev?.kind === 'run' && prev.tile.x === pt.x && prev.tile.y === pt.y)) {
        const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size)) ?? [];
        set({ battle: { ...battle, preview: { kind: 'run', tile: { ...pt }, path, cost: stepCost } } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      if (fearGateBlocks() || frenzyBlocks()) return;
      get().battleRun({ ...pt }); // ouvre la modale de Course ; le déplacement suivra le jet (runConfirm)
      return;
    }
    // Tap 1 : APERÇU (chemin + coût) — sauf confirmation directe ou re-tap de la même case.
    if (!opts?.confirm && !(prev?.kind === 'move' && prev.tile.x === pt.x && prev.tile.y === pt.y)) {
      const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size)) ?? [];
      set({ battle: { ...battle, preview: { kind: 'move', tile: { ...pt }, path, cost: stepCost } } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    // Tap 2 : COMMIT.
    if (fearGateBlocks() || frenzyBlocks()) return;
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
    const path = pathTo(scene, active.pos!, pt, blocked, sizeFootprint(geom.size));
    active.pos = { ...pt };
    if (geom !== active) geom.pos = { ...pt }; // déplace la monture sous le cavalier (couple solidaire)
    displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.308-309)
    get().faceFromPath(active.id, path);
    if (geom !== active) get().faceFromPath(geom.id, path);
    bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
    if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
    applyZoneCrossings(get, active, path ?? [{ ...pt }]); // Mur de feu & co (L11) : traverser coûte
    // Mouvement décomposable : cumule le coût du segment ; reste en mode neutre → le joueur peut
    // re-cliquer une case (s'il reste du Mouvement) OU enchaîner une Action. Si ce segment précède
    // l'Action, on marque `movedPreAction` (verrouille tout Mouvement post-Action).
    set({ battle: { ...battle, moveSnapshot: snapshot, movementUsed: (battle.movementUsed ?? 0) + stepCost, movedPreAction: battle.movedPreAction || !battle.acted, action: null, reachable: new Map(), preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  cancelMove: () => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
      battle: { ...battle, movementUsed: 0, movedPreAction: snap.movedPreAction, moveSnapshot: null, action: null, reachable: new Map(), preview: null },
    });
    bus.emit(EVT.SCENE_DIRTY);
  },

  battleClickEntity: (id, opts) => {
    const { battle, scene } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // Ciblage CHAMP DE BATAILLE des flux différés (plus de boutons-noms en modale) — AVANT le
    // verrou `battle.acted` (ces frappes surviennent après l'attaque-Action) :
    // Frappe Mortelle / 2ᵉ frappe (Deux armes) / cibles supplémentaires de Surincantation.
    if (get().pendingCleave && !get().pendingAttack) return get().cleaveAttack(id);
    if (get().pendingDualStrike && !get().pendingAttack) return get().dualStrikeAttack(id);
    if (get().pendingCast?.pickingTargets) return get().castToggleExtraTarget(id);
    // Pose de zone en cours : cliquer un combattant = poser la zone sur SA case.
    if (placingZoneOf(get())) {
      const t = battle.combatants.find((c) => c.id === id);
      if (t?.pos) get().battleClickTile({ ...t.pos });
      return;
    }
    // Piétinement : action GRATUITE (autorisée même Action consommée). Précède le verrou `battle.acted`.
    if (battle.action === 'trample') {
      get().battleTrample(id);
      return;
    }
    // Tentacule (trait Tentacules) : Attaque GRATUITE 1/tour — idem, précède le verrou `battle.acted`.
    if (battle.action === 'tentacle') {
      get().battleTentacle(id);
      return;
    }
    // Attaque GRATUITE de Frénésie (Test de CC non soumis à l'Action, LDB 21 l.34) : reste possible même
    // l'Action dépensée — y compris le tour où l'on entre en Frénésie (le Test de FM a consommé l'Action).
    const freeFrenzyAttack = battle.action === null && !!active.frenzied && !active.frenzyFreeUsed;
    if (battle.acted && !freeFrenzyAttack) return;
    const target = battle.combatants.find((c) => c.id === id);
    if (!target) return;
    if (battle.action === 'cast' && battle.selectedSpell) {
      // Sort de ZONE : un token n'est pas une cible (la zone se pose après le jet) → modale.
      if (castZoneSpell(get, set, active, battle.selectedSpell)) return;
      // L'incantation peut viser un allié, un ennemi ou soi-même.
      castSpell(get, set, active, target, battle.selectedSpell);
      return;
    }
    // Clic-ennemi IMPLICITE (mode neutre uniquement — les autres modes ont leur sémantique propre).
    if (battle.action !== null || !scene) return;
    if (target.kind === 'hero') return; // l'attaque ne vise que les ennemis (soin/sort via leurs modes)
    if (!canTakeAction(active) || hasCondition(active, 'Brisé')) return; // Sonné/Brisé : pas d'attaque (parité boutons)
    // Frénésie (LDB 21 l.34) : la cible est IMPOSÉE — l'ennemi le plus proche en Ligne de Vue.
    if (active.frenzied) {
      const ft = frenzyTarget(get, active);
      if (ft && ft.id !== id) {
        get().log(`${active.name} est en Frénésie : il doit attaquer ${ft.name} (le plus proche).`);
        if (battle.preview) set({ battle: { ...battle, preview: null } });
        return;
      }
    }
    const plan = attackPlan(get, active, target);
    // Frénésie libre post-Action : attaque DIRECTE seulement (pas de déplacement combiné).
    if (battle.acted && plan.kind !== 'attack') return;
    if (plan.kind === 'blocked') {
      get().log(plan.reason);
      if (battle.preview) set({ battle: { ...battle, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    // Tap 1 : APERÇU — sauf confirmation (tests), ré-entrée du choix cavalier/monture,
    // ou re-tap de la même cible avec le même plan.
    const prev = battle.preview;
    const samePreview = !!prev && 'targetId' in prev && prev.targetId === id && prev.kind === plan.kind;
    if (!opts?.confirm && !opts?.skipMountChoice && !samePreview) {
      set({ battle: { ...battle, preview: plan.kind === 'attack' ? { kind: 'attack', targetId: id } : { ...plan, targetId: id } } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    // Tap 2 : COMMIT. Choix cavalier/monture (LDB 14 l.219) AVANT toute résolution — on n'ouvre la
    // modale qu'une fois (skipMountChoice évite la ré-entrée après le choix).
    if (!opts?.skipMountChoice) {
      const rider = target.mountId ? target : battle.combatants.find((c) => c.id === target.riderId);
      const mount = target.riderId ? target : battle.combatants.find((c) => c.id === target.mountId);
      if (rider && mount && rider.kind !== 'hero' && mount.kind !== 'hero' && !isOutOfAction(rider) && !isOutOfAction(mount)) {
        set({ pendingMountTarget: { riderId: rider.id, mountId: mount.id } });
        return;
      }
    }
    // Peur (LDB 21 l.29) : charger / rejoindre une source de Peur = s'en RAPPROCHER → même Test de
    // Calme d'approche que le clic-sol (une tentative par Tour, battle.fearGate).
    if (plan.kind === 'charge' || plan.kind === 'moveAttack') {
      const feared = battle.fearGate === 'passed' ? null : fearedSourceTowards(battle, active, plan.dest);
      if (feared) {
        if (battle.fearGate === 'failed') {
          get().log(`${active.name} ne peut pas s'approcher de ${feared.name} : la Peur le cloue (ce Tour).`);
          return;
        }
        set({ pendingApproach: { combatantId: active.id, sourceId: feared.id, intent: { kind: 'entity', id }, result: null }, battle: { ...get().battle!, preview: null } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
    }
    if (battle.preview) set({ battle: { ...get().battle!, preview: null } });
    // Bénédiction de Protection (LDB 41 — L13) : Test de FM Accessible (+20) AVANT d'engager quoi
    // que ce soit (charge comprise) ; échec → « choisir une cible ou une Action différente » —
    // rien n'est consommé, le jet est montré (file de révélation, « un jet = une modale »).
    {
      const ward = attackWardGate(active, target);
      if (ward.lines.length) {
        const b1 = get().battle!;
        set({ battle: { ...b1, log: [...b1.log, ...evLines(ward.lines, 'info', active.id)] } });
        if (!ward.allowed) {
          pushReveal(set, { kind: 'round', title: 'Bénédiction de Protection', lines: ward.lines });
          return;
        }
      }
    }
    if (plan.kind === 'charge') {
      // Charge (LDB 15-Dépl l.74-77) : se ruer au contact (portée de Course) puis attaquer — manœuvre
      // PLEINE (consomme tout le Mouvement). Combat monté : empreinte/Course de la MONTURE.
      const geom = mountOf(battle, active) ?? active;
      const path = plan.path;
      active.pos = { ...plan.dest };
      if (geom !== active) geom.pos = { ...plan.dest }; // la monture charge sous le cavalier
      displaceSmaller(get, geom); // charge d'un grand : idem dégage les plus petits (85 l.308-309)
      get().faceFromPath(active.id, path);
      if (geom !== active) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      applyZoneCrossings(get, active, path); // Mur de feu & co (L11) : charger À TRAVERS coûte
      gainAdvantage(active, plan.adv); // +1 si « fonçant » de ≥ M mètres (l.77, lecture stricte), AVANT le jet
      if (plan.adv > 0) active.gainedAdvThisRound = true;
      active.chargedThisTurn = true; // Charge → Atouts de Dégâts d'une arme Épuisante actifs (LDB 63 l.16-17) ; consommé en fin de tour
      set({ battle: { ...get().battle!, movementUsed: mountMovement(battle, active), action: null, preview: null, log: [...battle.log, ev('charge', `${active.name} charge ${target.name}${plan.adv ? ` (+${plan.adv} Avantage)` : ''}.`, active.id, target.id)] } });
      set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true } });
      return;
    }
    if (plan.kind === 'moveAttack') {
      // Rejoindre la cible dans la Marche restante (pas une Charge → pas de bonus), puis attaquer.
      // MÊMES mutations qu'un segment de battleClickTile (snapshot d'annulation compris).
      const b = get().battle!;
      const snapshot =
        (b.movementUsed ?? 0) === 0
          ? {
              pos: Object.fromEntries(b.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
              facing: { ...get().facing },
              movedPreAction: b.movedPreAction,
            }
          : b.moveSnapshot ?? null;
      const geom = mountOf(b, active) ?? active;
      active.pos = { ...plan.dest };
      if (geom !== active) geom.pos = { ...plan.dest };
      displaceSmaller(get, geom);
      get().faceFromPath(active.id, plan.path);
      if (geom !== active) get().faceFromPath(geom.id, plan.path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path: plan.path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: plan.path });
      applyZoneCrossings(get, active, plan.path); // Mur de feu & co (L11)
      set({ battle: { ...b, moveSnapshot: snapshot, movementUsed: (b.movementUsed ?? 0) + plan.cost, movedPreAction: b.movedPreAction || !b.acted, action: null, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      // … puis on enchaîne sur la queue d'attaque (la cible est désormais à portée d'Allonge).
    }
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
    // Ouvre la SÉQUENCE de combat : le jet d'attaque est l'ÉTAPE 0 (rendu par CascadeModal via
    // useAttackJetProps), ses conséquences s'empileront APRÈS dans la MÊME fenêtre. Les données du
    // jet vivent dans pendingAttack (coexistant) ; les actions attack* restent inchangées.
    set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null } });
    startCascade(get, set, { title: 'Attaque', icon: '⚔️', purpose: 'combat', steps: [{ id: 'attack-jet', kind: 'attackJet', jet: 'attack', actorId: active.id }] });
  },

  battleEndTurn: () => {
    if (combatBusy(get())) return; // finir le tour sous un flux différé corromprait l'état
    advanceTurn(get, set);
  },

  // ── Chance, 3e usage : pré-emption d'initiative en début de Round (LDB ch.17 l.27) ──
  roundStartPromote: (heroId) => {
    const { battle, pendingRoundStart } = get();
    if (!battle || !pendingRoundStart) return;
    const hero = battle.combatants.find((c) => c.id === heroId);
    // Rapide (LDB 62 l.318-319) / Tir rapide (LDB 10, arme à distance chargée) : pré-emption
    // GRATUITE ; sinon 1 point de Chance (LDB ch.17 l.27).
    const free = !!hero && (canStrikeFirst(hero.weapons) || canPreemptRanged(hero));
    if (!hero || hero.kind !== 'hero' || (!free && (hero.fortune ?? 0) <= 0)) return;
    if (battle.order[0] === heroId) return; // déjà en tête
    if (!free) hero.fortune = (hero.fortune ?? 0) - 1;
    const order = [heroId, ...battle.order.filter((id) => id !== heroId)]; // en tête de l'ordre du Round
    set({ battle: { ...battle, order, log: [...battle.log, ev('info', `${hero.name} choisit d'agir en premier (${free ? 'arme Rapide' : 'Chance'}).`, hero.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  roundStartReady: (seat) => {
    const prs = get().pendingRoundStart;
    if (!prs) return;
    const readyBySeat = { ...(prs.readyBySeat ?? {}), [seat]: true };
    set({ pendingRoundStart: { ...prs, readyBySeat } });
    // L'HÔTE lance quand TOUS les sièges requis ont validé (sièges possédant ≥1 héros vivant + l'hôte).
    const s = get();
    if (s.net.mode === 'guest') return; // l'invité ne fait que marquer (l'intent porte son siège)
    const required = new Set<number>([0]);
    for (const h of s.party) {
      if (h.dead || h.outOfRencontre) continue;
      const owner = s.net.ownership[h.id] ?? 0;
      if (s.net.seatNames[owner] != null) required.add(owner);
    }
    if ([...required].every((st) => readyBySeat[st])) get().confirmRoundStart();
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return;
    if (!active.weapons.some((w) => w.type === 'ranged')) return; // viser = pour le tir
    active.aiming = true;
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('aim', `${active.name} vise soigneusement (+20 au prochain tir).`, active.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  // Perturbante (LDB 62 l.275-276) : arme le mode « Repousser » — la prochaine attaque réussie
  // repousse d'1 m/DR AU LIEU de causer des Dégâts. Simple bascule (pas une Action).
  battleTogglePushback: () => {
    const battle = get().battle;
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !active.weapons.some((w) => w.type === 'melee' && canPushback(w))) return;
    active.pushbackMode = !active.pushbackMode;
    set({ battle: { ...battle } });
  },

  // ── Rechargement = Test étendu de Projectiles (LDB 63-Armures l.28-29 + 12-Tests l.199-211) — par modale ──
  battleReload: () => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
        reload: reloadDRTarget(w), // Recharge ×2 si Arme d'équipe maniée seul (Aux Armes p.124)
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
  reloadDarkPact: () => FLOWS.reload.darkPact(get, set),
  reloadConfirm: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    const a = battle.combatants.find((c) => c.id === pr.actorId);
    set({ pendingReload: null });
    if (!a) return;
    a.aiming = false; // recharger est une autre action → la visée est perdue
    // Rechargement rapide / Artilleur (LDB 10) : +niveau DR au Test de rechargement (sur un jet réussi).
    const reloadTalent = pr.success ? reloadDRBonus(a, a.weapons.find((x) => x.type === 'ranged')) : 0;
    const progress = Math.max(0, pr.progressBefore + pr.sl + reloadTalent); // Test étendu : cumul des DR, plancher 0 (recommence)
    let log: string;
    if (progress >= pr.reload) {
      a.loaded = true;
      a.reloadProgress = 0;
      a.chambered = magazineSize(a.weapons.find((x) => x.type === 'ranged')); // À Répétition : chargeur rempli (LDB 62 l.264-265)
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
  recoverDarkPact: () => FLOWS.recover.darkPact(get, set),
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
  /** Détermination depuis une MODALE de jet (LDB 17 l.62-66) : même règle que `battleSpendResolve`,
   *  mais pour N'IMPORTE QUEL héros (en défense, le héros n'est pas l'actif) et sans toucher au
   *  mode d'action — le panneau pré-rempli recalcule ses modificateurs au re-rendu. */
  spendResolveCondition: (combatantId, conditionName) => {
    const s = get();
    const hero = (s.battle?.combatants ?? s.party).find((c) => c.id === combatantId);
    if (!hero || hero.kind !== 'hero' || (hero.resolve ?? 0) <= 0) return;
    if (!hero.conditions.some((c) => c.name === conditionName)) return;
    hero.resolve = (hero.resolve ?? 0) - 1;
    removeCondition(hero, conditionName, 1); // « Retirez un État » (un pion), LDB ch.17 l.66
    let extra = '';
    if (conditionName === 'À Terre') {
      hero.wounds.current = Math.min(hero.wounds.max, hero.wounds.current + 1); // +1 PB en se relevant (l.66)
      extra = ' (+1 PB en se relevant)';
    }
    if (s.battle) {
      set({ battle: { ...s.battle, log: [...s.battle.log, ev('info', `${hero.name} puise dans sa Détermination : retire l'État ${conditionName}${extra}.`, hero.id)] } });
    } else {
      set({ party: [...s.party] });
    }
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
      const it = itemFromTrapping(eff.trapping) ?? customTrapping(eff.trapping); // réel sinon objet custom
      label = it.name;
      // ajout NON équipé au combattant actif (clone battle) ET au membre party (persiste post-combat).
      active.items = [...(active.items ?? []), it];
      recomputeLoadout(active);
      set((s) => ({
        party: s.party.map((h) => {
          if (h.id !== active.id) return h;
          const clone: Combatant = JSON.parse(JSON.stringify(h));
          clone.items = [...(clone.items ?? []), JSON.parse(JSON.stringify(it))];
          recomputeLoadout(clone);
          return clone;
        }),
      }));
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
  // Cycle Chance/Pacte/Résilience UNIFIÉ (fabrique rollFlow — spec `attack` de rollFlows.ts).
  attackReroll: () => FLOWS.attack.reroll(get, set),
  attackBonusSL: () => FLOWS.attack.bonusSL(get, set),
  attackDarkPact: () => FLOWS.attack.darkPact(get, set),
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
      if (attacker.kind === 'hero' && attackerFumbled(pa.result, weapon)) {
        set({ pendingFumble: { combatantId: attacker.id, weapon, result: null }, pendingCleave: null });
      } else if (!isDualMain && !isDualSecond && !pa.freeTentacle) {
        // Frappe Mortelle (LDB 14 l.12 / 85 l.299) : démarre/poursuit le balayage d'un héros plus grand
        // (jamais en mode dual ni sur l'Attaque gratuite de Tentacule).
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
          set({ pendingDualStrike: { attackerId: attacker.id, offWeaponUid: off.uid, mainRoll, critValue } });
        }
        set({ battle: { ...get().battle! } });
      }
      // 2ᵉ frappe résolue (LDB 10 l.638) : +1 Avantage UNIQUE si LES DEUX frappes touchent (pas +1 par frappe).
      // `dualBefore` n'existe que si la 1ʳᵉ a touché ; `pa.result.hit` = la 2ᵉ touche → les deux touchent.
      if (isDualSecond) {
        if (dualBefore && pa.result.hit) { gainAdvantage(attacker); attacker.gainedAdvThisRound = true; }
        set({ pendingDualStrike: null, battle: { ...get().battle! } });
      }
      // Attaque gratuite de Tentacule (LDB 85 l.354) : l'Action est préservée, 1/tour, et sur
      // Dégâts la cible est Empêtrée (Empoignade) — effet partagé des attaques de créature.
      if (attacker.kind === 'hero' && pa.freeTentacle) {
        attacker.tentacleUsedThisTurn = true;
        applyFreeAttackEffects(get, attacker, victim, 'tentacules', pa.result);
        set({ battle: { ...get().battle!, acted: prevActed } });
      }
      // Frénésie (LDB 21 l.34) : un Test de Capacité de Combat GRATUIT chaque Round → la 1re attaque du
      // héros frénétique ne consomme PAS l'Action (il pourra réattaquer normalement ensuite).
      if (attacker.kind === 'hero' && attacker.frenzied && !attacker.frenzyFreeUsed && !wasChain && !isDualSecond && !pa.freeTentacle) {
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
    // Séquence de combat (jet = étape 0) : enchaîner sur les conséquences empilées par
    // applyAttackResult, ou clore (resume) si aucune. Uniquement l'attaque-Action NON enchaînée
    // (pendingAttack nul ici = pas de 2ᵉ frappe/balayage re-ouvert) ; les enchaînées gardent l'ancien
    // flux pour l'instant (migrées plus tard, avec recette navigateur).
    const seq = get().pendingCascade;
    if (seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack' && !get().pendingAttack) {
      get().cascadeNext();
    }
  },
  attackCancel: () => {
    const pa = get().pendingAttack;
    if (pa?.fromCharge) return; // après une Charge, l'attaque est obligatoire (LDB 15-Dépl l.75)
    if (pa?.dualSecond) return; // 2ᵉ frappe d'un dual : engagée dès que la cible est choisie (le jet est imposé)
    if (pa?.cleave) return get().cleaveEnd(); // annuler un enchaînement = terminer le balayage
    // Annuler ferme aussi la séquence-jet de combat (étape 0 non encore validée).
    const seq = get().pendingCascade;
    const closeSeq = seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack';
    set({ pendingAttack: null, ...(closeSeq ? { pendingCascade: null } : {}) });
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
    if (!dualStrikeTargets(battle, attacker, off).some((t) => t.id === targetId)) return; // cible invalide (hors d'Allonge)
    // 2ᵉ frappe : jet IMPOSÉ (inversé / valeur du Critique) + pénalité main 2nde + nouveau jet de défense (LDB 10 l.638).
    const res = resolveDualSecond(get, attacker, target, off, ds.mainRoll, { critValue: ds.critValue });
    set({ pendingAttack: { attackerId: attacker.id, targetId, location: res.location ?? null, result: res, dualSecond: true, weaponUid: off.uid } });
  },
  dualStrikeSkip: () => set({ pendingDualStrike: null }), // « peut viser » = optionnel : pas de 2ᵉ → pas d'Avantage (LDB 10 l.638)
  dismissReveal: () => {
    set((s) => ({ pendingReveals: s.pendingReveals.slice(1) }));
    resumeSuspendedAI(get, set); // file vidée alors qu'un tour d'IA était suspendu → reprendre l'avancement
  },
  battleTrample: (targetId) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
    const battle = get().battle;
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.advantage < 1) return; // exige ≥1 Avantage (LDB 85 l.320)
    const target = trampleTarget(battle, active, targetId); // adversaire adjacent plus petit
    if (!target) return;
    // OUVRE la modale (le jet se fait au clic « Lancer ») — « un jet = une modale ».
    set({ pendingTrample: { attackerId: active.id, targetId: target.id, result: null }, battle: { ...battle, action: null } });
  },
  battleTentacle: (targetId) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
    const battle = get().battle;
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.tentacleUsedThisTurn) return; // 1 tentacule (mutation) → 1 Attaque gratuite/tour
    if (!active.weapons.some((w) => w.uid === 'nat-tentacule')) return;
    if (!canTakeAction(active) || hasCondition(active, 'Brisé')) return;
    const target = battle.combatants.find((c) => c.id === targetId);
    if (!target || target.kind === active.kind || isOutOfAction(target) || !target.pos || !active.pos) return;
    if (combatDistance(active, target) > 1) {
      get().log('Cible hors de portée du tentacule.');
      return;
    }
    // OUVRE la modale d'attaque standard avec l'arme naturelle — « un jet = une modale ».
    set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null, weaponUid: 'nat-tentacule', freeTentacle: true }, battle: { ...battle, action: null } });
  },
  trampleRoll: () => FLOWS.trample.roll(get, set),
  trampleReroll: () => FLOWS.trample.reroll(get, set),
  trampleBonusSL: () => FLOWS.trample.bonusSL(get, set),
  trampleDarkPact: () => FLOWS.trample.darkPact(get, set),
  trampleForceSuccess: () => FLOWS.trample.forceSuccess(get, set),
  trampleSetForcedRoll: (roll) => FLOWS.trample.setForcedRoll(get, set, roll),
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
  //    étendu (Marche + Course + DR) vers la destination cliquée dans la zone de Course. « Un jet = une
  //    modale » : le Test passe par pendingRun. ──
  battleRun: (dest) => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
    const battle = get().battle;
    if (!battle || battle.over || battle.acted || battle.movementUsed > 0) return; // Course = Marche + Action (exige le plein Mouvement)
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || isEngaged(active) || hasCondition(active, 'À Terre') || !canTakeAction(active)) return; // Engagé/À Terre → pas de Course (LDB 16 l.37)
    set({ pendingRun: { combatantId: active.id, dest, result: null }, battle: { ...battle, action: null, preview: null } });
  },
  runRoll: () => FLOWS.run.roll(get, set),
  runReroll: () => FLOWS.run.reroll(get, set),
  runForceSuccess: () => FLOWS.run.forceSuccess(get, set),
  runDarkPact: () => FLOWS.run.darkPact(get, set),
  runConfirm: () => {
    const { battle, scene, pendingRun: pr } = get();
    if (!battle || !scene || !pr || !pr.result || !pr.dest) return;
    const c = battle.combatants.find((x) => x.id === pr.combatantId);
    set({ pendingRun: null });
    if (!c) return;
    // Combat monté : Course au Mouvement de la monture, empreinte/collisions de la monture (couple solidaire).
    const geom = mountOf(battle, c) ?? c;
    const range = mountMovement(battle, c) + pr.result.bonusCases; // Marche + (Course + DR) (LDB 15 l.80)
    const blocked = occupied(battle, geom);
    const skill = c.mountId ? 'Chevaucher' : 'Athlétisme';
    // Le jet peut porter MOINS loin que la destination demandée : on suit le chemin et on s'arrête au
    // dernier point que le budget permet (« au max qu'il puisse faire »).
    const reach = reachable(scene, c.pos!, range, blocked, sizeFootprint(geom.size));
    const path = pathTo(scene, c.pos!, pr.dest, blocked, sizeFootprint(geom.size)) ?? [];
    let stopIdx = -1;
    for (let i = path.length - 1; i >= 0; i--) {
      if (reach.has(`${path[i].x},${path[i].y}`)) { stopIdx = i; break; }
    }
    const stop = stopIdx >= 0 ? path[stopIdx] : null;
    const log = [...battle.log];
    if (!stop || (stop.x === c.pos!.x && stop.y === c.pos!.y)) {
      // Jet désastreux : aucun pas possible — l'Action est tout de même consommée (le Test a eu lieu).
      log.push(ev('move', `${c.name} trébuche dans sa Course (${skill} ${pr.result.roll === 100 ? '00' : pr.result.roll}) : sur place.`, c.id));
      set({ battle: { ...get().battle!, action: null, acted: true, runBudget: range, reachable: new Map(), preview: null, log } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
    const sub = path.slice(0, stopIdx + 1);
    const cost = reach.get(`${stop.x},${stop.y}`) ?? sub.length;
    c.pos = { ...stop };
    if (geom !== c) geom.pos = { ...stop }; // la monture court sous le cavalier
    displaceSmaller(get, geom);
    get().faceFromPath(c.id, sub);
    if (geom !== c) get().faceFromPath(geom.id, sub);
    bus.emit(EVT.ANIM_MOVE, { id: c.id, path: sub });
    if (geom !== c) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: sub });
    const short = stop.x !== pr.dest.x || stop.y !== pr.dest.y;
    log.push(ev('move', `${c.name} prend sa Course (${skill} ${pr.result.roll === 100 ? '00' : pr.result.roll}) : ${cost} cases${short ? ' — le souffle manque avant la destination' : ''}.`, c.id));
    // Budget du Tour étendu à Marche + Course + DR (l.80) : le reliquat non parcouru reste dépensable
    // en segments (A-M*) — `movementRemaining` lit `runBudget`.
    set({ battle: { ...get().battle!, action: null, acted: true, runBudget: range, movementUsed: (battle.movementUsed ?? 0) + cost, reachable: new Map(), preview: null, log } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  runCancel: () => set({ pendingRun: null }),

  // ── Approche d'une source de Peur (LDB 21 l.29) : Test de Calme Intermédiaire (+0) qui DIFFÈRE le
  //    clic d'approche. Succès → fearGate 'passed' (approches libres ce Tour) + l'intention est relancée ;
  //    échec → fearGate 'failed' (aucune approche ce Tour). « Un jet = une modale ». ──
  approachRoll: () => FLOWS.approach.roll(get, set),
  approachReroll: () => FLOWS.approach.reroll(get, set),
  approachForceSuccess: () => FLOWS.approach.forceSuccess(get, set),
  approachDarkPact: () => FLOWS.approach.darkPact(get, set),
  approachConfirm: () => {
    const { battle, pendingApproach: pa } = get();
    if (!battle || !pa || !pa.result) return;
    const c = battle.combatants.find((x) => x.id === pa.combatantId);
    const src = battle.combatants.find((x) => x.id === pa.sourceId);
    set({ pendingApproach: null });
    if (!c) return;
    const ok = pa.result.success;
    const log = [...battle.log, ev('fear', ok
      ? `${c.name} rassemble son courage : il peut approcher ${src?.name ?? 'la source de sa Peur'} ce Tour.`
      : `${c.name} n'ose pas approcher ${src?.name ?? 'la source de sa Peur'} : la Peur le cloue (ce Tour).`, c.id, src?.id)];
    set({ battle: { ...get().battle!, fearGate: ok ? 'passed' : 'failed', log } });
    if (ok) {
      // Relance l'intention différée (le gate est désormais 'passed').
      if (pa.intent.kind === 'tile') get().battleClickTile(pa.intent.pt, { confirm: true });
      else get().battleClickEntity(pa.intent.id, { confirm: true });
    }
    bus.emit(EVT.SCENE_DIRTY);
  },
  approachCancel: () => set({ pendingApproach: null }), // renonce avant le jet : aucune trace, re-cliquable

  // ── Se relever d'À Terre (LDB 16-États l.37) : utilise le Mouvement pour se mettre debout. Impossible
  //    tant qu'on n'a pas regagné ≥1 PB (LDB 18 l.28 : à 0 PB on reste au sol). Ne consomme PAS l'Action. ──
  battleStandUp: () => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
  // Cycle COMPLET unifié (fabrique rollFlow — spec `defense` de rollFlows.ts) : le jet initial
  // est une résolution pure (le jet d'attaque `atk` reste figé dans tous les cas).
  defenseRoll: () => FLOWS.defense.roll(get, set),
  defenseReroll: () => FLOWS.defense.reroll(get, set),
  defenseBonusSL: () => FLOWS.defense.bonusSL(get, set),
  defenseDarkPact: () => FLOWS.defense.darkPact(get, set),
  defenseConfirm: () => {
    // « Appliquer » : applique le résultat puis REPREND le tour de l'IA suspendu.
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || !pd.result) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    set({ pendingDefense: null }); // null AVANT la reprise → ré-entrance/double-advance impossibles
    if (attacker && defender) {
      const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, pd.result);
      if (suspended) return; // Déviation Critique du héros : l'étape 'deviation' (resolveDeviation) rejouera autoCleave/Piétinement/fumble/reprise
      if (pd.free) {
        set({ battle: { ...get().battle!, acted: pd.prevActed ?? get().battle!.acted } }); // attaque gratuite : ne consomme pas l'Action
        applyFreeAttackEffects(get, attacker, defender, pd.freeKind ?? '', pd.result); // À Terre (Attaque caudale)…
      } else autoCleave(get, set, attacker, defender, pd.result); // Frappe Mortelle (attaque principale)
    }
    // Maladresse du DÉFENSEUR héros (sa défense ratée sur un double, LDB 14 l.48-51) → modale Oups!,
    // puis reprise de l'IA APRÈS Appliquer (resumeAfter). Sinon on reprend l'IA tout de suite.
    if (defender && defender.kind === 'hero' && defenderFumbled(pd.result, pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : defender.weapons[0]) && !isOutOfAction(defender)) {
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
      if (suspended) return; // Déviation Critique du héros (même après « Subir » : la déviation d'armure est un choix distinct) — l'étape 'deviation' (resolveDeviation) reprend
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
  knockdownResolve: (accept: boolean) => resolveKnockdown(get, set, accept),
  renounceResolve: (renounce: boolean) => resolveRenounce(get, set, renounce),

  // ── Combat monté : Monter / Descendre (LDB 14 l.212-225) ──
  // Enfourcher/descendre ne demande AUCUN jet (Chevaucher sans Test si l'on a la Compétence, LDB 09 l.99)
  // → ce n'est PAS une Action (critère : tout jet = une Action) : c'est juste du MOUVEMENT (repositionnement
  // sur/hors la monture). On consomme donc le Mouvement du tour, pas l'Action — on peut enfourcher PUIS attaquer.
  battleMount: () => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
    get().battleClickEntity(id, { skipMountChoice: true });
  },
  mountTargetCancel: () => set({ pendingMountTarget: null }),

  // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15-Dépl l.84-89) ──
  battleDisengage: () => {
    if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
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
        action: null, // mouvement libre rouvert (clic-sol), sans pénalité (l.87) ; Action préservée
        reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), blocked, sizeFootprint(mover.size)),
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
  // Cycle Chance/Pacte/Résilience UNIFIÉ (fabrique rollFlow — spec `disengage` de rollFlows.ts) :
  // le jet du foe (atk) reste figé, seule l'Esquive du mover se (re)joue.
  disengageReroll: () => FLOWS.disengage.reroll(get, set),
  disengageBonusSL: () => FLOWS.disengage.bonusSL(get, set),
  disengageDarkPact: () => FLOWS.disengage.darkPact(get, set),

  // ── Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) : réussite garantie (opposé : DR +1)
  // et « vous choisissez le résultat » (dé choisi) — cycle UNIFIÉ par la fabrique rollFlow,
  // une spec par flux dans rollFlows.ts. Plus AUCUNE implémentation sur mesure ici. ──
  testForceSuccess: () => FLOWS.test.forceSuccess(get, set),
  attackForceSuccess: () => FLOWS.attack.forceSuccess(get, set),
  attackSetForcedRoll: (roll) => FLOWS.attack.setForcedRoll(get, set, roll),
  defenseForceSuccess: () => FLOWS.defense.forceSuccess(get, set),
  defenseSetForcedRoll: (roll) => FLOWS.defense.setForcedRoll(get, set, roll),
  castForceSuccess: () => FLOWS.cast.forceSuccess(get, set),
  castSetForcedRoll: (roll) => FLOWS.cast.setForcedRoll(get, set, roll),
  disengageForceSuccess: () => FLOWS.disengage.forceSuccess(get, set),

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
      gainAdvantage(mover); // +1 Avantage (l.89)
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
        battle: { ...battle, acted: true, action: null, reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), blocked, sizeFootprint(mover.size)), log },
      });
    } else if (pd.result === 'tie') {
      // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
      // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
      log.push(ev('flee', `${mover.name} : échange neutre, le désengagement échoue (personne ne prend l'avantage).`, mover.id, foe.id));
      set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
    } else {
      gainAdvantage(foe); // l'adversaire gagne +1, la fuite échoue (l.89)
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
    if (!mover || !foe) return set({ pendingDisengage: null });
    const log = [...battle.log];
    gainAdvantage(foe); // l'adversaire gagne immédiatement +1 Avantage (l.101)
    foe.gainedAdvThisRound = true;
    const res = resolveBackstabAttack(foe, mover, battleRng());
    log.push(ev('flee', `${mover.name} fuit — ${foe.name} frappe dans le dos : ${res.log}`, mover.id, foe.id));
    let calmeRoll: number | undefined;
    let broken = 0;
    if (res.hit && res.woundsLost) {
      loseWounds(mover, res.woundsLost); // perte de PB centralisée : −Avantage du fuyard + À Terre à 0 (LDB 15 l.40 / 18 l.28)
      gainAdvantage(foe); // touché → +1 Avantage de plus (l.107)
      // Test de Calme Intermédiaire (+0) ou État Brisé (+1 par DR négatif).
      const calme = effectiveChar(mover, 'FM') + (mover.skills.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0);
      const ct = rollTest(calme, 'intermediaire', battleRng());
      broken = ct.success ? 0 : 1 + Math.max(0, -ct.sl);
      calmeRoll = ct.roll;
      if (broken) {
        addCondition(mover, 'Brisé', broken);
        log.push(ev('fear', `${mover.name} panique : ${broken} État(s) Brisé.`, mover.id));
      }
    }
    const foes = (mover.engagedWith ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
    for (const f of foes) disengageFrom(mover, f);
    const blocked = occupied(battle, mover);
    // Fuite : déplacement jusqu'à la Course (2×Mouvement) MAIS dans la direction opposée à l'adversaire
    // (LDB 15-Déplacement l.109) — les cases qui rapprochent du `foe` sont exclues du déplaçable.
    // Fuite ! (LDB 10) : Mouvement +1 quand on fuit.
    set({ battle: { ...battle, action: null, reachable: fleeReachable(scene, mover.pos!, foe.pos!, (effectiveMovement(mover) + fleeMovementBonus(mover)) * 2, blocked, sizeFootprint(mover.size)), log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    // Coup dans le dos INTÉGRÉ à la modale (plus de popin RevealModal séparée) : on garde la modale
    // ouverte sur la phase 'fuir' pour MONTRER le dé subi + le Test de Calme ; « Continuer » ferme et
    // libère le déplacement de Fuite. Cas particuliers (PNJ, combat fini, mort→Destin, autre révélation
    // en attente) : on ferme tout de suite pour ne pas empiler les modales.
    const st = get();
    if (mover.kind !== 'hero' || st.battle?.over || st.pendingFateSave || st.pendingReveals.length) {
      set({ pendingDisengage: null });
      return;
    }
    set({ pendingDisengage: { ...pd, phase: 'fuir', fuir: { attackerRoll: res.attackerRoll, hit: res.hit, woundsLost: res.woundsLost ?? 0, calmeRoll, broken } } });
  },
  disengageFleeAck: () => set({ pendingDisengage: null }), // « Continuer » : ferme la modale (conséquences déjà appliquées)
  disengageCancel: () => set({ pendingDisengage: null }), // renonce avant tout jet : aucun coût

  /** Choix du lanceur (avant le jet) : re-cible le Test sur le candidat `id` du groupe. */
  testSetActor: (id) => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null) return; // seulement AVANT le jet
    const cand = pt.candidates?.find((c) => c.id === id);
    if (!cand) return;
    set({ pendingTest: { ...pt, actorId: cand.id, actorName: cand.name, skillValue: cand.value, target: cand.target, psychMod: cand.psychMod, psychDetail: cand.psychDetail, itemUid: cand.itemUid } });
  },
  /** « Lancer » : effectue le jet du test en attente (hors combat). */
  testRoll: () => FLOWS.test.roll(get, set),
  /** Chance : relance (LDB Destin) / « +1 DR » (LDB ch.17 l.26), cf. spec `test` de rollFlows. */
  testReroll: () => FLOWS.test.reroll(get, set),
  testBonusSL: () => FLOWS.test.bonusSL(get, set),
  testDarkPact: () => FLOWS.test.darkPact(get, set),
  testDetermination: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null || !pt.psychMod) return; // AVANT le jet, et seulement si un malus psy pèse
    const actor = get().party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.resolve ?? 0) <= 0) return;
    actor.resolve = (actor.resolve ?? 0) - 1;
    get().log(`${actor.name} puise dans sa Détermination : insensible à la Psychologie — malus social ignoré.`);
    // Le malus psy était intégré à skillValue/target (cf. PendingTest) : on le retranche des deux.
    set({
      pendingTest: { ...pt, skillValue: pt.skillValue - pt.psychMod, target: pt.target - pt.psychMod, psychMod: 0, psychDetail: undefined },
      party: [...get().party],
    });
  },

  /** Exposition à une Influence corruptrice (LDB 19) — flux différé, cf. spec `corruption`. */
  corruptionRoll: () => FLOWS.corruption.roll(get, set),
  corruptionSetSkill: (skill) => {
    const pc = get().pendingCorruption;
    // Pré-jet uniquement, et JAMAIS si la compétence est déterminée en amont (source ou seuil).
    if (!pc || pc.roll != null || pc.skillLocked) return;
    set({ pendingCorruption: { ...pc, skill } });
  },
  corruptionReroll: () => FLOWS.corruption.reroll(get, set),
  corruptionBonusSL: () => FLOWS.corruption.bonusSL(get, set),
  corruptionDarkPact: () => FLOWS.corruption.darkPact(get, set),
  /** Acquitte l'exposition (Points selon niveau + DR, puis seuil) OU le Test du SEUIL
   *  (kind 'seuil', LDB 19 l.80) : succès = Corruption contenue « pour cette fois » ;
   *  échec = « Je te renie ! » (Résilience) ou mutation (révélation 🧬). */
  resolveCorruption: () => {
    const pc = get().pendingCorruption;
    if (!pc || pc.roll == null) return;
    set({ pendingCorruption: null });
    const hero = actorIn(get(), pc.heroId);
    if (!hero) return;
    if (pc.kind === 'seuil') {
      if (pc.success) {
        get().log(`${hero.name} contient sa Corruption — pour cette fois (Résistance ${pc.roll}/${pc.target}).`);
      } else if ((hero.resilience ?? 0) > 0) {
        get().log(`${hero.name} échoue à contenir sa Corruption — la mutation menace…`);
        set({ pendingRenounce: { heroId: hero.id, testRoll: pc.roll, testTarget: pc.target ?? 0 } });
      } else {
        for (const l of applyMutation(set, hero, { roll: pc.roll, target: pc.target ?? 0 })) get().log(l);
      }
      set({ ...touchActors(get()) });
      return;
    }
    const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
    if (gain <= 0) {
      get().log(`${hero.name} repousse l'Influence corruptrice (${pc.skill} ${pc.roll}/${pc.target}).`);
      return;
    }
    const lines = gainCorruption(get, set, hero, gain);
    for (const l of lines) get().log(l);
    set({ ...touchActors(get()) });
  },

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
    // Branche choisie PUIS continuation (suite du `seq` parent d'un nœud `test`) — exécutées par runFlow
    // (butin de Test → fenêtre d'attribution ; if/test imbriqués gérés).
    const branch = effSuccess ? pt.onSuccess : pt.onFailure;
    runFlow(get, set, { kind: 'seq', steps: [branch ?? EMPTY_FLOW, pt.after ?? EMPTY_FLOW] }, pt.label);
  },
  closeDocument: () => set({ document: null }),

  log: (msg) => set((s) => ({ journal: [...s.journal.slice(-40), msg] })),

  advanceTime: (minutes) => {
    if (minutes <= 0) return;
    set({ gameTime: get().gameTime + minutes });
    bus.emit(EVT.TIME_ADVANCED, { minutes }); // #T3 (cascade) branchera ses déclencheurs sur les franchissements
    fireScheduledEffects(get, set); // Lot 0 : déclenche les minuteries/événements dont l'échéance vient d'être franchie

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
    // Entretien quotidien (#T2/#T3 — rations/faim, maladies, convalescence) + purge des effets à
    // durée d'horloge (contrecoups LDB 46/40) : traite les éventuels franchissements de jour.
    // VISIBLE (le journal seul ne suffit pas) : hors repos/voyage (qui affichent leurs propres
    // bilans), le franchissement de jour pousse une révélation témoin groupée.
    const upkeepLines = runDailyUpkeep(get, set);
    if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' });
  },
  // « Dormir » : sommeil de `days` journée(s) (défaut 1) — récup. (Exténué/Blessures) + cauchemars (LDB 16/18/21).
  restParty: (days = 1) => { restFlow.sleepParty(get, set, days); },

  // ── Voyage & nourriture (#T2) ──
  openWorldMap: () => { if (!get().battle && get().worldMap) set({ worldMapOpen: true }); },
  closeWorldMap: () => set({ worldMapOpen: false }),
  startTravel: (routeId, mode, opts) => travelFlow.startTravel(get, set, routeId, mode, opts),
  resumeTravel: () => travelFlow.resumeTravel(get, set),
  /** Acquitte le récit de voyage. Une EMBUSCADE différée (`recap.then`) se déclenche ICI :
   *  le joueur a lu ce qui lui arrive, le combat démarre — fermer la modale (bouton/Échap)
   *  ne l'évite pas, et `resumeTravel` refuse tant qu'elle n'est pas acquittée. */
  dismissTravelRecap: () => {
    const recap = get().travelRecap;
    set({ travelRecap: null });
    const then = recap?.then;
    if (!then || get().battle) return;
    if (then.kind === 'effects') {
      applyEffectsLoot(get, set, then.effects, 'Découverte'); // trouvaille d'étape de voyage → fenêtre aussi
    } else {
      get().transitionTo(then.scene, then.entry);
      get().startCombat(then.encounter, undefined, { noSurprise: then.noSurprise });
    }
  },
}));

// Exposition DEV-ONLY du store pour le pilotage en vérification navigateur (Playwright/Puppeteer) :
// permet d'ouvrir les flux (battleClickEntity, etc.) sans simuler la projection isométrique du clic.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as unknown as { __game?: typeof useGame }).__game = useGame;
}
