/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant, CharKey, HitLocation } from '../engine/types';
import { extendedTestStep } from '../engine/tests';
import type { ShipMoraleState } from '../engine/crewMorale';
import { dissipateSpell } from '../engine/dispel';
import { type AttackKind } from '../engine/creatureAttacks';
import { battleRng, seedBattleRng } from './battleRng';
import { facingToward, DIR8_DELTA, rotateDir8, type Dir8 } from './dir8';
import { footprintTiles, footprintN } from './footprint';
import type { CombatCursor, ScreenDir } from './combatCursor';
import { applyShipCollision } from './shipCollision';
import type { ConjureForm } from '../engine/conjuredWeapons';
import type { OvercastAxis } from '../engine/overcast';
import { findFreeTile, removeEntity, checkTriggers, fireScheduledEffects, applyEffects, applyEffectsLoot, runFlow, assignGearAt, harvestVictoryCreature, pushReveal, activeCombatant as activeCombatantOf } from './combatFlow';
import { t } from '../i18n';
import type { Get, Set } from './flowTypes';
import { planClimb } from './climbMove';
import { planFall } from './fallMove';
import { climbMovementCost } from '../engine/movement';
import { hasAutoClimb, hasClimbFullSpeed } from '../engine/traits/dispatch';
import { controlsCombatant } from './netOwnership';
export { activeCombatant, entityPickables, trampleTarget } from './combatFlow';
import { EMPTY_FLOW, type Flow } from './flow';
import type { MoveSnapshot } from './combatGeometry';
export { movementRemaining, canMove } from './mount';

import { type BattleZone } from './zones';
import * as interludeFlow from './interludeFlow';
import * as favorFlow from './favorFlow';
import * as netFlow from './netFlow';
import type { NetState } from './netFlow';
import type { InterludeState, BankDeposit, PendingActivity } from './interludeFlow';
import type { Favor } from './favorFlow';
export type { PendingActivity } from './interludeFlow';
import * as massBattleFlow from './massBattleFlow';
import type { MassBattleState, MassBattleSpec } from './massBattleFlow';
export type { MassBattleState, MassBattleSpec } from './massBattleFlow';
import { snapshotSave, saveToSlot, readSlot, importSave, AUTO_SLOT, type SaveSlot, type AnySlot, type SaveGame } from './saves';
import { loadKeyOverrides, saveKeyOverrides } from './keybindingsPrefs';
import { initialFields, resetFields } from './stateFields';
import type { CodexFocus } from './codexFocus';

/** Onglets de la fiche de personnage (`CharacterSheet.tsx`) — id STABLE, jamais un libellé. */
export type SheetTab = 'etat' | 'possessions' | 'competences' | 'magie' | 'avancement' | 'histoire';

/** Charge une save (Jalon 5) : reset zéro-maintenance (état de création sans les actions — le
 *  JSON round-trip écarte les fonctions) + données de la save par-dessus, écran campagne.
 *  Le merge partiel de zustand préserve les actions du store. */
function applyLoadedSave(set: (s: Partial<GameState>) => void, save: SaveGame): void {
  const base = JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>;
  const data = { ...(save.data as Partial<GameState>) };
  // Le drop du worldMap vide (saves d'avant la carte de campagne) est désormais une MIGRATION
  // officielle (v1→v2, `saves.ts` MIGRATIONS[1]) — `save.data` en sort déjà nettoyé.
  // `net` : la SESSION coop courante prime sur celle figée dans la save (ne pas ressusciter un
  // salon mort, ne pas dissoudre un salon vivant — l'hôte peut charger une save en ligne).
  set({ ...base, ...data, screen: 'campaign', net: useGame.getState().net });
  // Règles maison de la save : on les applique au registre (parité avec la partie sauvegardée).
  // Save d'avant ce champ (rules absent) → on garde les règles courantes de la machine.
  if (save.rules) loadRuleOverrides(save.rules);
  bus.emit(EVT.SCENE_DIRTY);
}
import { ev, type CombatEvent, type ActorAim } from './combatLog';
import { rule, ruleOverrides, loadRuleOverrides } from '../engine/policy';
import { QUALITY_IDS } from '../engine/qualities/ids';
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
import { type HealMode } from '../engine/healing';
import type { DefenseMode } from '../engine/combat';
import { campGain } from './combat/advantagePool';
import { CAMPAIGN_START } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { outOfCombatUpkeep } from './outOfCombatUpkeep';
import { checkPartyWiped } from './partyWipe';
import { actorIn, inBattleId, touchActors } from './combatOrParty';
import { fireOwnTestFailed } from './triggeredEffects';
import { FLOWS, buildRollFlowActions, type RollFlowActionsMap } from './rollFlowSpecs';
import { gainCorruption, applyMutation } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import * as partyFlow from './partyFlow';
import * as possessionsFlow from './possessionsFlow';
import type { Possession } from '../engine/possession';
import type { PossessionInput } from './possessionsFlow';
import { usePartyItem as usePartyConsumable } from './consumableFlow';
import * as visionStateMod from './visionState';
import * as merchantFlow from './merchantFlow';
import type { MerchantState, MerchantStocks } from './merchantFlow';
import * as tavernFlow from './tavernFlow';
import type {
  PendingVictory, PendingLoot, PendingTest, PendingSteamSave, PendingReload, PendingStateRecovery, PendingBargain,
  PendingAppraise, PendingAttack, PendingHandGate, PendingSiegeAim, PendingCleave, PendingDualStrike, PendingTrample, PendingBattement, PendingDistraire, PendingManeuver, PendingRun, PendingFall, PendingShipManeuver, PendingShipBattery, PendingCrewTest, PendingShanty, PendingApproach, PendingWard, PendingFocus, PendingDispel,
  PendingFrenzy, RevealEntry, PendingRenounce, PendingDefense,
  PendingDisengage, PendingAuContact, PendingGrapple, PendingCast, PendingCounterspell, PendingExtendedTest, PendingForceDoor, PendingHeal, PendingSurgery, PendingCorruption,
  PendingCastOpposition, PendingCascade, ScheduledEffect, DialogueTransition, CascadeStepMeta,
} from './pendings';
import { openEncounterPsych } from './encounterPsychFlow';
import { toMoney } from '../engine/money';
import { payFromGroup } from './bourseFlow';
import * as medicFlow from './medicFlow';
import type { MedicState, MedicNpc } from './medicFlow';
export type { MedicState, MedicNpc } from './medicFlow';
import * as restFlow from './restFlow';
import type { PendingRest, RestPlaces, RestLodging, RestFood } from './restFlow';
export type { PendingRest, NightEntry, RestPlaces } from './restFlow';
import { councilPay as councilPayFlow, councilClose as councilCloseFlow } from './shipCrew';
import type { PendingCouncil } from './shipCrew';
export type { PendingCouncil } from './shipCrew';
import { Scene, Dialogue, isWalkable, sceneMetresPerTile, heightAt, type VictoryCondition } from './scene';
import { placeCombatant } from './spawn';
import { chebyshev, Pt } from './path';
import { exploreStepDest, povStepDest, spawnFacing } from './exploreNav';
import { bus, EVT } from './bus';
import { campaign, campaignWorldMap } from '../scenes/campaign';
import { dayIndex, runDailyUpkeep } from './upkeep';
import type { DeferredUpkeepTest } from './upkeep';
import * as travelFlow from './travelFlow';
import * as portFlow from './portFlow';
import * as landMarketFlow from './landMarketFlow';
import * as innFlow from './innFlow';
import * as seaActivities from './seaActivities';
import * as seaVoyageFlow from './seaVoyageFlow';
import { applyLandCargoRaid } from './carriers';
import { startCascade, suspendActiveCascade, resumeSuspendedCascade, extendedTestOutcomeAppliers } from './cascade';
import { resultLine, freeCons } from './rollSeam';
import { describeTest } from './flowOutcomes';
import { createCombatSlice } from './combatSlice';

/** Source unique des écrans valides — `Screen` en dérive (`typeof SCREENS[number]`) : un id absent
 *  ici échoue à la garde DEV `__wfrp.screen` (state/devtools.ts) au lieu de router silencieusement
 *  vers un écran blanc (#211). */
export const SCREENS = ['menu', 'party', 'creator', 'campaign', 'editor', 'test', 'interlude', 'coop', 'compendium', 'massBattle', 'gallery'] as const;
export type Screen = typeof SCREENS[number];

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
  /** Marins ayant déjà contribué à un Test d'équipage CE ROUND, par navire (`shipId → crewId[]`). Réinitialisé au début de
   *  chaque Round (`enterRoundStartPause`) ; un marin déjà listé qui contribue à un 2e Test (manœuvre + bordée) → cumul à
   *  +2 crans de Difficulté (Manque de bras, MDG 14 l.53). */
  crewActed?: Record<string, string[]>;
  /** Mode d'action À BOUTON en cours (panneau ouvert). Le déplacement et l'attaque n'ont PAS de mode :
   *  ils sont implicites au clic (sol/ennemi) quand `action === null` — cf. battleClickTile/Entity.
   *  'cast' = ciblage d'un sort · 'teleport' = case d'arrivée d'une Téléportation · 'resolve'/'ammo'/'heal'
   *  = panneaux (Détermination / munition / soin). La Focalisation / l'usage d'objet / le ramassage NE sont
   *  PAS des modes : ils passent par `battleFocusSpell`→`pendingFocus`, `battleUseItem`, `battlePickup`. */
  action: 'cast' | 'resolve' | 'ammo' | 'heal' | 'teleport' | 'dispel' | 'battery' | 'advantage' | 'push' | null;
  /** Sort sélectionné pour l'action d'incantation en cours (id STABLE — le libellé se résout à l'affichage). */
  selectedSpellId: string | null;
  /** Attaque ARMÉE pour le clic-ennemi (id d'`AttackOption` : 'arme' | 'morsure' | … — cf. `availableAttacks`).
   *  Défaut 'arme' ; vivante seulement quand `action===null`. Source UNIQUE qui remplace l'attaque d'arme
   *  implicite + le mode manœuvre/tentacule/trample armé. */
  selectedAttack?: string;
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
  /** Le set d'armes a-t-il déjà été changé ce Tour ? Plafond MAISON 1×/tour (dégainer = Action gratuite,
   *  cadence laissée au MJ, LDB 13 l.106). Reset au tour. */
  loadoutSwapped?: boolean;
  log: CombatEvent[];
  over: null | 'victory' | 'defeat';
  onVictory?: Flow;
  /** Objectif de victoire authorable (#197). Absent = `allEnemiesDead` (défaut historique, `checkBattleOver`). */
  victoryCondition?: VictoryCondition;
  /** Restriction d'armes à distance de la rencontre (#471, `EncounterDef.banRanged`) — copiée au
   *  démarrage du combat, lue par `resolveAttack`/`firedAttackBlock`. Absent/false = autorisées. */
  banRanged?: boolean;
  /** Zones persistantes (L11 — généralise l'ancienne fumée) : fumée du Souffle (blocksLoS),
   *  Mur de feu (onCross), Grands feux d'U'Zhul (perRound)… TTL décrémenté à chaque frontière
   *  de Round (state/zones.ts). */
  zones?: BattleZone[];
  /** « Avantages et Magie » (LDB 46 l.176) : cibles déjà visées par un Sort d'un Domaine CE Round —
   *  re-viser la même cible avec le même Vent donne +1 Avantage au lanceur. Purgé chaque Round. */
  domainCasts?: { targetId: string; domain: string }[];
  /** Option « Vents Tourbillonnants » (LDB 46 l.179-190) : force des Vents tirée pour LE combat (ou
   *  re-tirée à chaque Round en grain `round`, `state/combat/roundHooks.ts`) — `mod` s'ajoute aux
   *  Tests d'Incantation ET de Focalisation (`windsMagicModOf`). `revealed` = un porteur de Seconde
   *  vue a réussi le Test de Perception Facile (+40, l.181) : le HUD peut afficher la force. Le `mod`
   *  reste appliqué (visible au breakdown du jet) même non révélé. Absent = règle inactive. */
  windsOfMagic?: { roll: number; mod: number; revealed: boolean } | null;
  /** Réserves d'Avantage par CAMP (Aux Armes, Annexe I — mode « Avantage de groupe ») : présentes
   *  seulement quand la règle `combat-aa-avantage-groupe` est active. SOURCE DE VÉRITÉ de l'Avantage ;
   *  chaque `Combatant.advantage` en est la PROJECTION du camp (`mirrorPools`). Absent en mode Livre de base. */
  advantagePools?: import('../engine/advantagePool').AdvantagePools;
  /** Mort par Hémorragique (LDB 16 l.105) — combattants pour qui le jet de fin de Round (10 %/pion) a
   *  donné la MORT ce Round : marqués par le hook `bleed-death` (jet RNG, une fois), FINALISÉS par
   *  `resolveRoundBoundary` (qui peut SUSPENDRE pour un héros à Destin). `deathLine` = la ligne de
   *  journal pré-formée, annoncée APRÈS la décision de Destin. Purgé une fois tous finalisés. */
  bleedDoomed?: { id: string; deathLine: string }[];
  /** Instantané positionnel pris au PREMIER segment de Mouvement du Tour (R6/LOT 6) : permet
   *  d'ANNULER tout le déplacement tant qu'aucune Action n'a été prise (`cancelMove`). Restaure
   *  positions de TOUS les combattants (un grand a pu en déplacer d'autres), orientation et
   *  `movedPreAction`. Effacé à l'annulation ou écrasé au 1ᵉʳ segment du Tour suivant. */
  moveSnapshot?: MoveSnapshot | null;
  /** Budget de Mouvement ÉTENDU du Tour après une Course (Marche + Course + DR, LDB 15 l.80) :
   *  le reliquat non parcouru reste dépensable en segments. Null hors Course ; purgé au Tour/Round. */
  runBudget?: number | null;
  /** Test de Calme d'APPROCHE d'une source de Peur (LDB 21 l.29) — une tentative par Tour :
   *  'passed' = approches libres ce Tour ; 'failed' = aucune approche ce Tour. Purgé au Tour/Round. */
  fearGate?: 'passed' | 'failed' | null;
  /** COOP : un joueur demande la PAUSE du prochain début de Round (fenêtre Chance « agir en
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

/** Un objectif courant de la pile (#238) — `id` STABLE (re-poser le même = mise à jour du `text`),
 *  `text` = la consigne joueur affichée au HUD (« je fais quoi maintenant ? »). */
export interface Objective {
  id: string;
  text: string;
}

export interface GameState extends RollFlowActionsMap {
  screen: Screen;
  /** Codex : entrée ciblée à l'ouverture (depuis un `CodexRef`, keyée par `id`), null = page d'accueil. */
  compendiumFocus: CodexFocus | null;
  /** Écran à restaurer en quittant le Codex plein écran (capturé depuis le menu). */
  compendiumReturn: Screen;
  /** Drill-in d'une réf Codex EN JEU : fiche ouverte en MODALE par-dessus la partie (sans changer
   *  d'écran → musique et fiche perso intactes derrière). null = pas de modale. */
  codexOverlay: CodexFocus | null;
  /** Ouvre le Codex sur une entrée. Depuis le jeu (focus fourni) → modale ; depuis le menu (sans
   *  focus) → écran plein ; déjà ouvert → on s'y déplace en place. */
  openCodex: (focus?: CodexFocus) => void;
  /** Ferme la modale Codex (drill-in). */
  closeCodexOverlay: () => void;
  party: Combatant[];
  scene: Scene | null;
  mode: 'exploration' | 'battle';
  /** Groupe anéanti HORS COMBAT (invariant `checkPartyWiped`) → écran de défaite (CampaignView). */
  partyWiped: boolean;
  camRot: 0 | 1 | 2 | 3; // orientation caméra (cran de 90° horaire) — état de vue, non sérialisé
  camEdge: boolean; // cran impair : vue « de face » (edge-on, grille axis-alignée 3D) ; alterne avec le coin (losange) par ¼ de tour
  rotateCam: (dir: 1 | -1) => void;
  /** Orientation MONDE vivante par entité/combattant (Dir8) — projetée au rendu (camRot). */
  facing: Record<string, Dir8>;
  setFacing: (id: string, dir: Dir8) => void;
  faceToward: (id: string, from?: Pt, to?: Pt) => void;
  faceFromPath: (id: string, path?: Pt[] | null) => void;
  faceAtCombatStart: () => void;
  /** Manœuvre NAVALE (MDG 13) : vire le cap (`Dir8`) du navire `shipId` de `turnSteps` crans de 45°
   *  (>0 = tribord/droite, <0 = bâbord/gauche) → re-mappe d'un coup TOUS ses arcs de bordée. */
  shipTurn: (shipId: string, turnSteps: number) => void;
  /** Avance la coque `shipId` ET son équipage (à bord, formation rigide) de `cases` tuiles le long du cap
   *  courant `facing[shipId]` (MDG 13). Clampe aux bornes de scène. Renvoie les cases réellement parcourues. */
  shipAdvance: (shipId: string, cases: number) => number;
  zoom: number; // zoom caméra du JEU (échelle), borné [1, 2.6] — état de vue, non sérialisé
  setZoom: (z: number) => void;
  /** Projection de la carte (bascule) : 'iso' losange ou 'top' grille carrée — préférence de vue. */
  viewMode: 'iso' | 'top';
  toggleViewMode: () => void;
  /** Vue SUBJECTIVE (POV) active : l'exploration passe en cap-relatif (ZQSD = avance/recul/pas latéral,
   *  A/E = pivote le regard) au lieu du pas iso écran. Préférence de vue, préservée au reset de scène. */
  povActive: boolean;
  togglePov: () => void;
  /** DEBUG (recette `__wfrp.labels`) : overlay d'annotation de la carte sur IsoStage — coordonnées par
   *  case (+`z{n}`), teinte par étage et pastilles de rôle de structure. false par défaut (zéro coût off). */
  debugLabels: boolean;
  /** Décalage manuel de la caméra (caméra libre tactique) ; remis à zéro au refocus (changement de tour). */
  camPan: { x: number; y: number };
  panCamBy: (dx: number, dy: number) => void;
  resetCamPan: () => void;
  /** Option de jeu : INSPECTION des combattants (statbloc au clic sur la frise d'ordre). OFF par défaut
   *  (préférence du joueur — l'inspection casse un peu l'immersion) ; préférence persistante (comme la vue). */
  inspectEnabled: boolean;
  toggleInspectEnabled: () => void;
  /** Combattant dont on regarde le statbloc (InspectPanel) — porté par le STORE pour que la frise ET
   *  le token sur la carte ouvrent la même inspection (clic non-actionnable). null = panneau fermé. */
  inspectId: string | null;
  setInspectId: (id: string | null) => void;
  /** Fiche de personnage OUVERTE (`CharacterSheet.tsx`) — héros courant, partagé entre les hôtes
   *  (CampaignView/PartyScreen) pour que le switch de héros survive à leurs remontages respectifs.
   *  null = fiche fermée. UI éphémère, non sérialisée (comme `inspectId`). */
  sheetId: string | null;
  setSheetId: (id: string | null) => void;
  /** Onglet courant de la fiche — persiste à travers fermeture/réouverture (dernier onglet consulté). */
  sheetTab: SheetTab | null;
  setSheetTab: (tab: SheetTab | null) => void;
  /** Position de scroll du corps d'onglet (`.sheet-tabbody`), par onglet — restaurée à l'affichage. */
  sheetScroll: Partial<Record<SheetTab, number>>;
  setSheetScroll: (tab: SheetTab, top: number) => void;
  /** Empreinte (`alarmsFingerprint`) des alarmes DÉJÀ vues par héros — la règle d'atterrissage
   *  (`sheetAlarms.ts`) ne force l'onglet État qu'à la première ouverture depuis une alarme nouvelle.
   *  UI éphémère, non sérialisée (comme `sheetId`/`sheetTab`). */
  sheetAlarmsSeen: Record<string, string>;
  setSheetAlarmsSeen: (heroId: string, fp: string) => void;
  /** Combattant SURVOLÉ depuis un PORTRAIT (frise/dock) — pilote, à parité du survol du token,
   *  le réticule de visée sur la carte ET le « peek » caméra (recadrage temporaire). Local (jamais
   *  réseau), read-only : actif même hors de son tour. null = aucun survol de portrait. */
  hoverCombatantId: string | null;
  setHoverCombatant: (id: string | null) => void;
  /** Curseur de combat CLAVIER/MANETTE : case visée (éventuellement aimantée à une cible). Il pilote le
   *  réticule comme un survol souris et se commet via battleClickEntity/Tile. null = aucune navigation
   *  clavier en cours (la souris a la main). Vidé à l'avance de tour / fin de combat. */
  combatCursor: CombatCursor | null;
  /** Déplace le curseur d'une case dans la direction ÉCRAN poussée (le curseur « suit les yeux »). */
  moveCursor: (dir: ScreenDir) => void;
  /** Aimante le curseur sur la cible valide suivante (+1) / précédente (-1) — Tab / gâchettes. */
  snapCursorToTarget: (step: 1 | -1) => void;
  /** Commet la case visée : attaque (ennemi), inspection (allié) ou déplacement (case libre). */
  commitCursor: () => void;
  /** Efface le curseur (la souris reprend la main, ou geste « annuler »). */
  clearCursor: () => void;
  /** Combattant mis en évidence par le SURVOL (token carte OU portrait frise) — pilote le miroir
   *  réciproque sur la frise. Distinct de hoverCombatantId (frise/Tab → peek caméra). */
  hovered: string | null;
  setHovered: (id: string | null) => void;
  /** Surcharges de touches du remap clavier (id de raccourci → event.code), persistées en
   *  localStorage ; lues par `useGameKeyboard` via `effectiveCodes`. */
  keyOverrides: Record<string, string>;
  setKeyBinding: (id: string, code: string) => void;
  resetKeyBindings: () => void;
  partyPos: Pt;
  /** Niveau de lumière de scène (Lot L, mise en scène) : 0 = noir, 1 = plein jour ; null = auto
   *  (horloge/ambiance). Posé par l'Effet `setLight`, lu par le rendu (overlay d'assombrissement). */
  lightLevel: number | null;
  flags: Record<string, boolean>;
  /** PILE d'objectifs courants (« je fais quoi maintenant ? »), keyés par id STABLE — posés/mis à jour/
   *  retirés par les Effets `setObjective`/`clearObjective`. Le HUD affiche le plus récent (dernier de
   *  la pile). PERSISTE entre transitions de scène (hors `stateFields`, comme `flags`) — un objectif
   *  traverse les scènes ; vidé en nouvelle partie (`startScene`). #238. */
  objectives: Objective[];
  /** Brouillard de guerre : cases déjà explorées par scène (`sceneId` → clés "x,y,z"). PERSISTE entre
   *  transitions (hors manifeste de reset `stateFields`) ; vidé en nouvelle partie (`startScene`). */
  explored: Record<string, string[]>;
  /** Fond les cases visibles courantes dans l'ensemble exploré de la scène (appelé par le rendu). */
  markExplored: (keys: string[]) => void;
  journal: string[];
  dialogue: { dialogue: Dialogue; nodeId: string; speakerId?: string } | null;
  /** Marchand ouvert (#2) : instantané du stock pour la visite (Disponibilité figée). */
  merchant: MerchantState | null;
  /** Jeux de taverne ouverts (option `tavern-games`, NADJ 16) — null = fermé ; `result` = dernière partie. */
  tavernGames: tavernFlow.TavernGamesState | null;
  /** Stock PERSISTANT par marchand (#T3 re-stock) : déplété entre visites, re-tiré seulement après
   *  `restockDays` écoulés. `rolledAt` = gameTime du dernier tirage. `bargainLocked` = le joueur a négocié
   *  puis quitté SANS payer → plus de Marchandage avec ce marchand jusqu'au prochain réassort. Reset en nouvelle partie. */
  merchantStocks: MerchantStocks;
  battle: BattleState | null;
  campaignSceneId: string | null;
  pendingTest: PendingTest | null;
  /** Sauvegarde d'Initiative d'une « Fuite de vapeur » (MDG 12 l.326-328) — Test perso différé par modale. */
  pendingSteamSave: PendingSteamSave | null;
  /** Exposition à une Influence corruptrice en cours (LDB 19) — Test différé par modale. */
  pendingCorruption: PendingCorruption | null;
  pendingBargain: PendingBargain | null;
  pendingAppraise: PendingAppraise | null;
  pendingAttack: PendingAttack | null;
  /** Test de Dextérité PAR ACTION de « Main ensanglantée » (AA 07 l.117) — interposé AVANT l'attaque quand
   *  l'arme employée est tenue dans une main gatée (`attackHandGate`). Modale influençable, calque `reload`. */
  pendingHandGate: PendingHandGate | null;
  /** Pilonnage INDIRECT en cours (« viser une case », AA 10 p.122-123) : pièce indirecte servie en attente du
   *  point d'impact (placeur de zone source 'siege'). Clic-case → `siegeAimCommit`. */
  pendingSiegeAim: PendingSiegeAim | null;
  pendingReload: PendingReload | null;
  /** « Se libérer » (Empêtré) / « se rouler » (En flammes) en cours — modale interactive (LDB 16). */
  pendingStateRecovery: PendingStateRecovery | null;
  pendingDefense: PendingDefense | null;
  /** « Je te renie ! » (LDB 17 l.71) : choix subir la mutation / la refuser (1 Résilience). */
  pendingRenounce: PendingRenounce | null;
  pendingDisengage: PendingDisengage | null;
  /** « Au Contact » (LDB 62 l.176, Option « Longueur d'arme ») : Test opposé de Corps à corps + choix du vainqueur. */
  pendingAuContact: PendingAuContact | null;
  /** Empoignade (LDB 14 l.161) : action à son tour — Test opposé de Force OU « Briser » (Avantage supérieur). */
  pendingGrapple: PendingGrapple | null;
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
  /** Pile de cascades SUSPENDUES (`suspendActiveCascade`/`resumeSuspendedCascade`, state/cascade.ts) :
   *  quand un combat s'ouvre PENDANT une cascade active (ex. un abordage déclenché par l'applier d'une
   *  étape de voyage), la cascade active est poussée ICI (LIFO) plutôt qu'écrasée/perdue — le slot
   *  `pendingCascade` redevient disponible pour les cascades DU COMBAT. Résumée (tête de pile) au
   *  teardown de combat (`dismissVictory`/`dismissDefeat`) si le slot est libre. */
  suspendedCascades: PendingCascade[];
  /** Tests d'entretien du FRANCHISSEMENT DE JOUR mis EN FILE pendant un combat (#253) : en combat le slot
   *  de cascade appartient à l'arène → les Tests de Résistance quotidiens (Faim/Soif/maladie/convalescence/
   *  dessoûlage) ne peuvent pas s'ouvrir tout de suite. Ils sont DIFFÉRÉS ici puis CONSOMMÉS par
   *  `openCombatEndCascade` (fin de combat) — jamais roulés en silence. La garde `lastUpkeepDay` reste la
   *  référence anti-double-résolution (l'entretien lui-même n'est appliqué qu'une fois). */
  deferredUpkeepQueue: import('./pendings').CascadeStep[];
  /** POURSUITE TERRESTRE en cours (LDB 15) : Distance/adversaires persistés entre les manches (chaque
   *  manche est une cascade `purpose:'pursuite'`, cf. state/pursuitFlow). `null` hors poursuite. */
  pursuit: import('./pursuitFlow').PursuitState | null;
  /** Abandon de la poursuite terrestre (le groupe renonce à fuir/traquer). */
  pursuitAbandon: () => void;
  /** Incantation OPPOSÉE (`spec.opposed`) : chaque CIBLE oppose son Test (FM/Int) à l'incantation
   *  figée (`pendingCast.result`) — multijet DANS la modale de cast (cible IA = rangée témoin
   *  auto-roulée, cible héros = interactive). `oppositionConfirm` agrège → `pendingCast.opposedOutcome`
   *  → `castConfirm` applique (cible résistante = aucune op ; sinon ops à la marge). */
  pendingCastOpposition: PendingCastOpposition | null;
  /** Télégraphe d'intention ENNEMI : réticule « qui l'adversaire vise » + manière (`kind`), montré
   *  ~0,85 s AVANT l'action. Alimente le réticule/la ligne sur la carte ET la bannière d'annonce. */
  actorAim: ActorAim | null;
  /** Télégraphe de DÉPLACEMENT ENNEMI : chemin (+ destination = dernière case) montré ~0,4 s AVANT que
   *  l'ennemi glisse dessus, pour lire « où il va ». Tracé via movePreviewEls (rouge), comme un aim. */
  actorMove: { id: string; path: { x: number; y: number }[] } | null;
  /** Télégraphe de ZONE (ZdE) ENNEMI : disque Chebyshev (centre ± rayon) peint ~0,7 s AVANT que le
   *  sort de zone d'un lanceur IA ne se résolve, pour lire « où l'aire va tomber » (parité avec
   *  `actorAim` du missile, qui ne sait montrer qu'une ligne from→to inadaptée à une case). */
  actorAoe: { casterId: string; center: { x: number; y: number }; radius: number } | null;
  /** Coût/gain (Action/Mouvement/Avantage) de l'intention SOUS LA SOURIS (desktop) — alimente le
   *  clignotant des jauges (ActiveFrame), même source que le tap-1 (`previewResourceDelta`).
   *  Posé par IsoStage au changement de tuile survolée ; null hors survol pertinent. */
  hoverDelta: { action: number; move: number; adv: number } | null;
  /** Soin de Guérison en cours (modale interactive, combat ou hors-combat). */
  pendingHeal: PendingHeal | null;
  /** Passe de Chirurgie en cours (jet INFLUENÇABLE du chirurgien, modale embarquée dans l'infirmerie). */
  pendingSurgery: PendingSurgery | null;
  /** Infirmerie ouverte (modale de soins persistante, hors combat — state/medicFlow). */
  medic: MedicState | null;
  /** Modale de Repos (nuit à l'auberge / chez soi / campement — state/restFlow). */
  pendingRest: PendingRest | null;
  /** Conseil de bord hebdomadaire (choix de paie + recalcul de Moral joué — #229, state/shipCrew). */
  pendingCouncil: PendingCouncil | null;
  /** Balayage (Frappe Mortelle) d'un héros en cours : enchaînements d'attaque restants. */
  pendingCleave: PendingCleave | null;
  /** Maniement de deux armes : sélection de la 2ᵉ cible (après une 1ʳᵉ frappe réussie). */
  pendingDualStrike: PendingDualStrike | null;
  /** File de révélation témoin (jets subis/sur table/entretien montrés au joueur, FIFO). */
  pendingReveals: RevealEntry[];
  /** File de LIGNES de journal de combat différées (hors `battle.log`) : un hook profond (ex.
   *  `onGainCondition` ennemi/auto, déclenché AVANT le `set` final qui remplace `battle.log`) y pousse
   *  ses lignes ; `drainPendingLog` les déverse dans le MÊME `set` atomique qui réécrit `battle.log`
   *  (bon ordre, zéro clobber). `cid` = combattant concerné (couleur/portrait du feed). */
  pendingLogQueue: { line: string; cid?: string }[];
  /** File d'effets PROGRAMMÉS (Lot 0 : minuteries `delayedEffect`) — déclenchés au franchissement de
   *  leur échéance dans `advanceTime`. */
  scheduledEffects: ScheduledEffect[];
  /** Piétinement en cours (modale interactive). */
  pendingTrample: PendingTrample | null;
  /** Battement en cours (LDB 10 l.103 — modale de jet de CC non opposé retirant l'Avantage adverse). */
  pendingBattement: PendingBattement | null;
  /** Distraire en cours (LDB 10 l.364 — modale de Test opposé Athlétisme vs Calme). */
  pendingDistraire: PendingDistraire | null;
  /** Manœuvre de créature en cours (Souffle/Vomi/Langue/Regard/Étreinte — modale de jet d'attaquant). */
  pendingManeuver: PendingManeuver | null;
  /** Course en cours (modale Test d'Athlétisme → déplacement étendu). */
  pendingRun: PendingRun | null;
  /** Chute VOLONTAIRE en cours (LDB 15 l.82 — choix Sauter/Tenter, puis modale Test d'Athlétisme → chute). */
  pendingFall: PendingFall | null;
  /** Manœuvre navale en cours (MDG 13 : Test de Navigation du barreur → vire le cap + avance). */
  pendingShipManeuver: PendingShipManeuver | null;
  /** Tir de batterie en cours (MDG 14 : Test d'équipage des Artilleurs → volée sur la cible). */
  pendingShipBattery: PendingShipBattery | null;
  /** Test d'équipage GÉNÉRIQUE en cours (MDG 14 — Rude épreuve : total négatif → perte de Moral, l.110). */
  pendingCrewTest: PendingCrewTest | null;
  /** Chanson de marin en cours (Talent, MDG 09 l.32-40 : choix de la chanson + Test de Divertissement (Chant)). */
  pendingShanty: PendingShanty | null;
  /** Approche d'une source de Peur en cours (Test de Calme +0 différant le clic — LDB 21 l.29). */
  pendingApproach: PendingApproach | null;
  /** Bénédiction de Protection en cours (Test de FM +20 différant la déclaration d'attaque — LDB 41 l.105). */
  pendingWard: PendingWard | null;
  /** Focalisation en cours (modale interactive). */
  pendingFocus: PendingFocus | null;
  pendingDispel: PendingDispel | null;
  // (Psychologie de combat : cascade de Round, cf. openRoundStartPsych/openRoundEndPsych.)
  /** Entrée en Frénésie d'un héros en cours (Test de FM, LDB 21 l.32). */
  pendingFrenzy: PendingFrenzy | null;
  /** Modale d'ordre de Round en attente (Chance, 3e usage : pré-emption d'initiative). */
  pendingRoundStart: { round: number; readyBySeat?: Record<number, boolean> } | null;
  /** Tir rapide (LDB 10) : id du héros dont la visée d'interruption est ARMÉE pendant la pause (badge de la
   *  frise) — le prochain clic sur un adversaire (carte OU frise) déclenche `preemptRangedShot`. `null` = aucune. */
  preemptAiming: string | null;
  /** Arme/désarme (bascule) la visée Tir rapide d'un héros pendant la pause de début de Round. */
  armPreempt: (heroId: string | null) => void;
  /** Coop : marque le siège PRÊT au ready-check d'ouverture (round 1) ; l'hôte lance quand tous ✓. */
  roundStartReady: (seat: number) => void;
  /** Sauvetage par le Destin en attente (LDB 17 l.31-35). */
  pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number;
    /** Animosité & Haine (ADE II Annexe I, règle facultative) : Groupe (ou nom) de « l'individu ou
     *  l'élément qui l'a presque tué » — Cible de l'Animosité acquise si le héros dépense le Destin. */
    foeCible?: string } | null;
  /** Récompenses de victoire capturées (écran de fin de combat) ; null hors victoire. */
  pendingVictory: PendingVictory | null;
  /** Attribue un objet d'équipement (giveTrapping) du butin de victoire au héros choisi. */
  assignVictoryGear: (index: number, heroId: string) => void;
  /** Récolte « Précieuses Entrailles » (ZI) une créature vaincue, par id (Test de Savoir → pièces valuées). */
  harvestCreature: (creatureId: string) => void;
  /** Ferme l'écran de victoire et revient à l'exploration. */
  dismissVictory: () => void;
  /** Ferme l'écran de défaite ; dans une Scène de combat de bataille de masse, la bataille CONTINUE
   *  (défaite tactique = `combatLost`, groupe repoussé mais relevé). */
  dismissDefeat: () => void;
  /** VOL TERRESTRE en cours (#327 A5.1) : le combat courant est né d'une péripétie dangereuse terrestre —
   *  la cargaison du convoi est en jeu, dénouée au teardown de combat (`resolveCargoRaid`). */
  cargoRaid: boolean;
  /** Dénoue le vol terrestre GRADUÉ (#327 A5.1) : applique la perte d'Enc du convoi selon l'issue
   *  (`applyLandCargoRaid`, params maison) et éteint `cargoRaid`. No-op hors vol en cours. */
  resolveCargoRaid: (outcome: import('../engine/cargo').CargoRaidOutcome) => void;
  /** Butin HORS combat (fouille/Test/dialogue/trigger) — fenêtre « qui l'emporte ? » (même brique). */
  pendingLoot: PendingLoot | null;
  /** Attribue une ligne de la fenêtre de loot au héros choisi. */
  assignLootGear: (index: number, heroId: string) => void;
  /** Ferme la fenêtre de loot ; l'équipement non attribué va au 1er héros (comme la victoire). */
  dismissLoot: () => void;
  /** Évaluation (LDB 59 l.41) ou Détection d'artefact (LDB 10) d'une ligne de butin ENCORE en
   *  fenêtre (loot ou victoire) : révéler un objet AVANT de choisir qui l'emporte. */
  appraiseGear: (scope: 'loot' | 'victory', index: number, mode?: 'evaluate' | 'detect') => void;
  /** Coop : ✓ d'un siège sur l'écran de victoire — l'hôte ferme quand tous les requis ont validé. */
  victoryReady: (seat: number) => void;
  /** Coop : demande la pause du prochain début de Round (fenêtre Chance). */
  raiseHand: () => void;
  document: { title: string; text: string } | null;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  /** Campagne publiée choisie au menu — jouée après constitution du groupe (PartyScreen).
   *  null = « Nouvelle partie » standard (campagne par défaut). `id` optionnel (#608 Lot B) : plombé
   *  à la sélection (builtin/publié) pour que `PartyScreen` surligne par id, jamais par `label` ;
   *  absent sur une vieille save migrée = pas de surlignage, pas de crash. */
  pendingCampaign: { id?: string; label: string; scenes: Scene[]; startSceneId: string; worldMap?: import('./worldMap').WorldMap | null; activeAxes?: string[] } | null;
  setPendingCampaign: (pc: GameState['pendingCampaign']) => void;

  setScreen: (s: Screen) => void;
  /** Héros en cours de MODIFICATION dans le créateur (bouton « Modifier » d'un emplacement) :
   *  l'id du Combatant à mettre à jour EN PLACE ; null = création normale d'un nouveau héros. */
  editingHeroId: string | null;
  setEditingHero: (id: string | null) => void;
  /** Interlude « Entre deux aventures » (LDB 22-23, Jalon 5) — état + dépôts bancaires + commandes. */
  interlude: InterludeState | null;
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trappingId: string }[];
  /** Système de Faveurs (LDB 23 l.139-151, #509) — contrepartie future acceptée en échange d'une
   *  aide immédiate ; persistée SOURCE UNIQUE, même patron que `bank`/`pendingOrders`. */
  favors: Favor[];
  /** Accorde une Faveur (Activité à contrepartie / événement du Tableau / Effet `grantFavor`). */
  favorGrant: (heroId: string, level: import('./favorFlow').FavorLevel, owedTo: string, desc: string) => void;
  /** « Acquitter une Faveur » (LDB 23 l.147/149) : consomme une Activité d'interlude du héros. */
  favorSettle: (heroId: string, favorId: string) => void;
  /** Rompt une Faveur — Niveau de Carrière −1 (min 0) si la rumeur se répand (LDB 23 l.141). */
  favorBreak: (heroId: string, favorId: string) => void;
  /** Ouvre un interlude de N semaines (Effet d'éditeur `interlude` ou appel direct). */
  startInterlude: (weeks?: number) => void;
  /** Clôt l'interlude : « Avec le pouvoir », Argent à gaspiller, Revenus, le temps passe. */
  interludeEnd: () => void;
  /** Regagne MAINTENANT les Points de Chance du groupe (LDB 17 l.52 « Longues Séances de Jeu » —
   *  règle optionnelle `fortune-mid-session` en mode 'manual'). Réutilise l'Effet `restoreFortune`
   *  (logique partagée via `engine/fortune.restoreFortune`) — pas de duplication. */
  restoreFortuneNow: () => void;
  /** Jet d'Activité en attente (Revenus / lancer d'Artisanat — modale, fabrique rollFlow).
   *  Délégués `activity{Roll,Reroll,BonusSL,DarkPact}` : générés (RollFlowActionsMap). */
  pendingActivity: PendingActivity | null;
  activityCancel: () => void;
  activityConfirm: () => void;
  /** Combat de masse / Puissance de Bataille (ADE II 08) : état de la bataille abstraite en cours
   *  (Puissance des deux armées, Round, Scènes) — null hors bataille. */
  massBattle: MassBattleState | null;
  /** Amorce une bataille de masse et bascule sur sa vue. */
  startMassBattle: (spec: MassBattleSpec) => void;
  /** Passe de la phase pré-bataille (Discours/Planification) aux Rounds de bataille. */
  massBattleBegin: () => void;
  /** Ouvre le Test de Commandement du Discours inspirant (l.71). */
  massBattleInspire: () => void;
  /** Ouvre le Test d'une Activité de bataille pré-combat (l.79-106). */
  massBattleActivity: (activityId: string) => void;
  /** Choisit une Scène cinématique du Round (Test de Compétence ou combat tactique). */
  massBattleScene: (sceneId: string) => void;
  /** Affecte la LISTE des PJ postés à une action du Round (Scène MULTI-PJ résolue en Soutien, ou Activité
   *  SOLO ; clé = id d'action) — le POSTE que la résolution honorera à défaut de la suggestion. Liste vide =
   *  efface l'affectation. Réinitialisé à chaque Round. */
  setMassBattleHero: (actionId: string, heroIds: string[]) => void;
  /** Ouvre le Test de Résistance de guérison du Rassemblement (l.122). */
  massBattleRally: () => void;
  /** Tire/choisit le facteur environnemental du Round (l.309, 1d10). */
  massBattleHazard: (roll?: number) => void;
  /** Résout le Test spectaculaire de Puissance du Round (l.120). */
  massBattleClash: () => void;
  /** Passe au Round suivant après le Rassemblement (l.124). */
  massBattleAdvance: () => void;
  /** Ferme la bataille et revient au jeu. */
  endMassBattle: () => void;
  /** Activités (LDB 23) : `craftStart` engage l'ouvrage (matériaux ¼ prix + `st.craft`) ; le LANCER
   *  passe par `interludeActivity('craft')`. Passer commande (Exotique) + banque restent dédiés. */
  interludeCraftStart: (heroId: string, trappingId: string, atouts: string[], defauts: string[]) => void;
  interludeBank: (heroId: string, kind: 'invest' | 'stash' | 'mecenat', amountBrass: number, rate?: number) => void;
  interludeWithdraw: (index: number) => void;
  interludeOrder: (heroId: string, trappingId: string) => void;
  /** Entraînement (ch.23 l.130-136) : Compétence/Caractéristique hors carrière, PX + tuteur 1D10 sc — sans jet. */
  interludeEntrainement: (heroId: string, kind: 'skill' | 'characteristic', id: string, spec?: string) => void;
  /** Activité du CATALOGUE data-driven (`activities.json`, contexte 'interlude' + gate `where`) — LE
   *  CHEMIN UNIQUE de toutes les Activités à jet : Revenus, Artisanat, Apprentissage (`talentId`),
   *  Identification (`itemUid`), Convalescence (ADE II), Activités d'Altdorf (ACE Annexe I). Cibles
   *  éventuelles selon le résolveur : objet / sort / dépôt / Talent. */
  interludeActivity: (heroId: string, activityId: string, opts?: { itemUid?: string; spellId?: string; depositIndex?: number; talentId?: string }) => void;
  /** Coop en ligne : état réseau sérialisable + actions de session — délégué à netFlow.
   *  Les objets réseau vivants (sessions, sockets du relay) restent des singletons de module. */
  net: NetState;
  /** Crée une room sur le relay → code 6 chars dans `net.roomCode`. false = service injoignable. */
  netHostStart: (name: string) => Promise<boolean>;
  /** Rejoint une room par code. Résout null si connecté, sinon le message d'erreur à afficher. */
  netJoin: (code: string, name: string) => Promise<string | null>;
  netAssign: (heroId: string, seat: number) => void;
  /** Pose/retire le rôle MJ (bac-à-sable) : `seat` conduit les ennemis + le monde, `null` = IA. */
  setGmSeat: (seat: number | null) => void;
  /** Attribue un EMPLACEMENT (0-3) de l'écran d'équipe à un siège (hôte). */
  netAssignSlot: (slot: number, seat: number) => void;
  netLeave: () => void;
  /** Composition d'équipe : ajoute un héros dans un emplacement du siège (intent côté invité ;
   *  l'hôte injecte le siège autoritaire) / retire un héros (propriétaire seul). */
  partyAddHero: (hero: Combatant, wealth?: import('../engine/money').Money, seat?: number) => void;
  partyRemoveHero: (heroId: string) => void;
  /** Remplace EN PLACE le héros `oldId` par `hero` (substitution atomique, possession transférée au
   *  siège ; ne touche pas la bourse) — créateur (édition) et bouton « Remplacer » du slot. */
  partyReplaceHero: (oldId: string, hero: Combatant, seat?: number) => void;
  /** Sauvegarde la partie dans un slot localStorage (Jalon 5). Refusée en combat. */
  saveGame: (slot: SaveSlot) => boolean;
  /** Auto-save silencieuse vers l'emplacement AUTO (checkpoint d'entrée de scène). Hors combat,
   *  jamais l'invité coop. Réutilise le même snapshot que `saveGame`. */
  autoSave: () => boolean;
  /** Charge un slot (manuel OU auto) : reset zéro-maintenance + données de la save (écran campagne). */
  loadGame: (slot: AnySlot) => boolean;
  /** Applique une save importée (export/import JSON). */
  importGame: (json: string) => boolean;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  /** Range (`containerUid`) ou sort (null) un objet d'un héros d'un contenant (LDB 64). */
  stowItem: (heroId: string, uid: string, containerUid: string | null) => void;
  createLoadout: (heroId: string) => void;
  deleteLoadout: (heroId: string, id: string) => void;
  setActiveLoadout: (heroId: string, id: string) => void;
  setLoadoutSlot: (heroId: string, id: string, slot: 'main' | 'off', uid: string | null) => void;
  /** Donne un objet d'un héros à un autre (transfert d'inventaire). Arrive NON équipé chez le
   *  destinataire ; recalcule les deux loadouts. Permet de confier une arme/armure au bon porteur. */
  transferItem: (uid: string, fromHeroId: string, toHeroId: string) => void;
  /** Skin cosmétique d'un objet (override de palette token→hex ; clé à `undefined` = reset).
   *  Propagé à l'arme active via recomputeLoadout → le rendu se recolore (objet légendaire). */
  setItemSkin: (heroId: string, uid: string, patch: Record<string, string | undefined>) => void;
  /** Change la FORME (silhouette) d'une arme abstraite parmi ses `formChoices` (« Arme simple » →
   *  épée/hache/masse/…). Pose `ItemInstance.shape` puis recompute → l'arme tenue change de silhouette. */
  setItemShape: (heroId: string, uid: string, shape: string) => void;
  // ── Avancement par PX (LDB 07-Carrières) — câblage du moteur testé ──
  /** Octroie des PX à un héros. */
  grantXp: (heroId: string, amount: number) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  buyCharAdvance: (heroId: string, char: CharKey) => void;
  /** Achète une Augmentation de Compétence (identité skillId+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  buySkillAdvance: (heroId: string, skillId: string, spec?: string) => void;
  /** Achète/augmente un Talent (identité talentId+spec ; refusé hors carrière l.97 / Maxi atteint). */
  buyTalent: (heroId: string, talentId: string, spec?: string) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designateCareerSlot: (heroId: string, slotKey: string, optionId: string, spec?: string) => void;
  /** Apprentissage/mémorisation d'un sort (LDB 46/10) — coût PX via engine/grimoire. */
  buySpell: (heroId: string, spellId: string) => void;
  /** Achète un composant d'incantation pour un Sort d'Arcane/Domaine connu (LDB 46 l.163 — NI pistoles). */
  buySpellComponent: (heroId: string, spellId: string) => void;
  /** Retire un composant d'incantation possédé pour un Sort (sans remboursement). */
  removeSpellComponent: (heroId: string, spellId: string) => void;
  /** Édite la bio mutable d'un héros hors combat (Motivation + Ambitions court/long, LDB 05) — persisté en save + roster. */
  setHeroBackground: (heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }) => void;
  /** Fin de séance (LDB 05 Ambitions + LDB 17 Détermination) : octroie les PX d'Ambition, regagne la
   *  Détermination selon la Motivation, puis restaure la Chance. Alimenté par l'écran de fin de séance. */
  endSession: (rewards: import('./partyFlow').SessionRewards) => void;
  /** Écran de fin de séance (`SessionEndModal`) ouvert par l'Effet `sessionEnd` (#83) — le menu de jeu
   *  le pilote encore par état local ; ce flag EN PLUS permet à un beat de campagne authoré de l'ouvrir. */
  sessionEndOpen: boolean;
  openSessionEnd: () => void;
  closeSessionEnd: () => void;
  /** Entraîne une prothèse portée par dépense de PX (Fausse jambe → réapprendre l'Esquive, 200 PX, LDB 73). */
  trainProsthesis: (heroId: string, uid: string) => void;
  /** Change de Carrière/Niveau (validation LDB 07 l.137 / LDB 08 : complétion, +100 hors Classe). */
  changeCareer: (heroId: string, newCareer: string, newLevel: number) => void;
  startScene: (scene: Scene) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. `worldMap` = carte du
   *  monde du projet (#T2, projet v2) — null/absent : pas de voyage dans ce projet. */
  loadProject: (scenes: Scene[], entryId: string, worldMap?: import('./worldMap').WorldMap | null) => void;
  transitionTo: (sceneId: string, entry?: string, pos?: Pt) => void;
  moveParty: (pt: Pt) => void;
  /** ESCALADE d'une arête `WallSeg.climb` (LDB 15 l.52-57) : `from` (case basse, adjacente) → `to` (case
   *  haute). Exploration = le groupe ; combat = le héros actif. `ladder` monte d'office (pas de Test) au
   *  coût du Mouvement à ½ vitesse ; `surface` déclenche un Test d'Escalade influençable (cascade RollShell)
   *  dont l'échec fait chuter, et consomme l'Action en combat (LDB 13 l.86-88). Geste EXPLICITE (overlay). */
  climbAcross: (from: Pt, to: Pt) => void;
  /** Pas clavier d'exploration : déplace le groupe d'UNE surface voisine connectée dans la direction
   *  ÉCRAN poussée (flèches) — rampes/tabliers gérés par `exploreStepDest` (zéro ambiguïté de z). */
  stepPartyDir: (dir: ScreenDir) => void;
  /** POV : pivote le REGARD du meneur d'un cran de 45° (+1 = horaire/droite, -1 = anti-horaire/gauche) —
   *  aucun déplacement (donc pas de réorientation par `faceFromPath`). */
  pivotParty: (turn: 1 | -1) => void;
  /** POV : un pas RELATIF au cap du meneur (avance/recul/pas latéral) — cap monde = regard tourné de
   *  0/2/4/6 crans (90° par cadran), case d'arrivée via `povStepDest`. Le regard est préservé pour tout
   *  pas ≠ avant (un pas latéral/arrière ne réoriente pas le meneur). */
  stepPartyRelative: (rel: 'forward' | 'back' | 'left' | 'right') => void;
  interactEntity: (entityId: string) => void;
  setPendingInteract: (id: string | null) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  openMerchant: (entityId: string) => void;
  /** Marchand de LIEU (#369) — service de catalogue sans `SceneEntity` (forgeron du hub de ville…) : même
   *  système marchand, keyé sur `placeServiceMerchantId` (`worldMap.ts`). */
  openPlaceMerchant: (entityId: string, archetype: string, backdrop?: string) => void;
  closeMerchant: () => void;
  /** Recherche active de Disponibilité (LDB 59 l.50) : passer une journée entière + un Test de Ragot →
   *  réassort frais avec +10 % de Disponibilité si le Ragot réussit (avance l'horloge d'une journée). */
  searchAvailability: () => void;
  /** Jeux de taverne (option `tavern-games`, NADJ 16) : ouvrir la modale / jouer une partie
   *  (choisir un jeu + un adversaire, résolution par le moteur générique) / fermer. */
  openTavernGames: () => void;
  playTavernGame: (opts: { gameId: string; challengerId: string; opponent: tavernFlow.TavernOpponent; stakeBrass?: number }) => void;
  closeTavernGames: () => void;
  /** Troc (LDB 59 l.64-76) : céder N exemplaires d'un objet contre M exemplaires du stock, sans argent. */
  barterExchange: (opts: { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number }) => void;
  /** « Baisse des prix » (LDB 59 l.60) : (dé)cale d'un cran le nombre de divisions de moitié consenties
   *  à la vente d'une instance (améliore la Disponibilité de l'acheteur, réduit le gain). */
  setSellHalving: (uid: string, delta: number) => void;
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
  /** Panier de VENTE (#22b, parité achat) : ajoute / retire / vide / conclut toute la vente d'un coup. */
  addToSellCart: (uid: string, heroId: string) => void;
  removeFromSellCart: (uid: string) => void;
  clearSellCart: () => void;
  confirmSell: () => void;
  /** Réparation chez l'artisan : remet damageTaken à 0 contre le coût unifié — armure 10 %/PA (LDB 63
   *  l.97-98) ou arme 10 %/point de Dégâts (LDB 62 l.135). Arme improvisée = irréparable. */
  repairItem: (uid: string, heroId: string) => void;
  /** Marchandage (LDB 59 l.43) : ouvre un Test opposé (1/visite) ; réduit ensuite les prix de 10-20 %. */
  startBargain: (mode: 'buy' | 'sell') => void;
  // bargain{Roll,Reroll,BonusSL,DarkPact} : générés (RollFlowActionsMap).
  bargainConfirm: () => void;
  bargainCancel: () => void;
  /** Évaluation (LDB 59 l.41) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
   *  `mode:'detect'` = Détection d'artefact (LDB 10) : Intuition au toucher, une tentative par objet. */
  appraiseItem: (uid: string, heroId: string, mode?: 'evaluate' | 'detect') => void;
  // appraise{Roll,Reroll,BonusSL,DarkPact} : générés (RollFlowActionsMap).
  resolveAppraise: () => void;
  appraiseCancel: () => void;
  // test{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  /** Détermination (LDB 17 l.62) : insensible à la Psychologie — retire le malus social
   *  (Animosité/Préjugé) du Test en cours, AVANT le jet. */
  testDetermination: () => void;
  /** Choix du LANCEUR d'un Test de scène parmi les candidats du groupe (avant le jet) — au lieu
   *  d'une désignation automatique du meilleur. Re-cible valeur/cible/malus/outil. */
  testSetActor: (id: string) => void;
  resolveTest: () => void;
  /** Exposition à une Influence corruptrice (LDB 19) : Lancer → Chance → Appliquer (gain selon DR).
   *  Délégués `corruption{Roll,Reroll,BonusSL,DarkPact}` : générés (RollFlowActionsMap). */
  /** Choisit Résistance/Calme AVANT le jet d'exposition (LDB 19 l.26 : « ou … comme déterminé par le
   *  MJ » — RAW indéterminé pour le trait de créature ; le joueur tranche, comme la Défense). Le SEUIL
   *  (l.80) reste figé sur Résistance et ignore cet appel. */
  corruptionSetSkill: (skill: 'resistance' | 'calme') => void;
  resolveCorruption: () => void;
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Flow, opts?: { noSurprise?: boolean }) => void;
  battleSelectAction: (a: 'cast' | 'resolve' | 'ammo' | 'heal' | 'dispel' | 'battery' | 'advantage' | null) => void;
  /** Guérison (LDB 09-Compétences) — ouvre la modale de soin EN COMBAT (soi/allié adjacent). */
  battleHeal: (targetId: string, mode: HealMode) => void;
  /** « Asperger d'eau » (MDG 16 l.19, #497) — Action DIRECTE (aucune modale) : cible explicite ou
   *  1ᵉʳ candidat éligible adjacent (patron `battleManPoste`). */
  battleWater: (targetId?: string) => void;
  /** Pré-jet : bascule le mode de soin (Blessures ⇄ Hémorragie) dans la modale ouverte. */
  healSetMode: (mode: HealMode) => void;
  /** INFIRMERIE (hors combat, state/medicFlow) : modale de soins persistante — patients, actes
   *  (Guérison/Hémorragie/Déchirure/Chirurgie), PNJ payant via l'effet `medicalAid`. */
  openMedic: (opts?: { patientId?: string; npc?: MedicNpc }) => void;
  medicSelectPatient: (id: string) => void;
  /** Lance un acte sur le patient courant (surgery → ARME l'opération). */
  medicAct: (act: HealMode) => void;
  /** Choisit la Blessure Critique à opérer (avant la 1re passe). */
  medicSetWound: (idx: number) => void;
  /** OUVRE le jet INFLUENÇABLE d'une passe de Chirurgie (pendingSurgery) depuis l'opération armée. */
  openSurgeryPass: () => void;
  // surgery{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  /** « Appliquer » la passe : cumule le DR (Test étendu), 1d10 PB + Hémorragie ; cible atteinte → trauma
   *  réparé + infection révélée ; sinon réouvre la passe suivante (calque extendedTestNext). */
  surgeryNext: () => void;
  /** Annule la Chirurgie (cumul perdu ; jamais commencée → acte remboursé). */
  surgeryCancel: () => void;
  closeMedic: () => void;
  /** REPOS (state/restFlow) : modale de nuit — réglages PAR HÉROS (couchage + pitance,
   *  orthogonaux : on peut manger à l'auberge et dormir dehors), puis bilan globalisé. */
  openRest: (opts?: { places?: RestPlaces; quality?: 'normale' | 'pietre'; days?: number; travelHalt?: boolean }) => void;
  restSet: (heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>) => void;
  restReady: (seat: number) => void;
  restSleep: () => void;
  restCancel: () => void;
  /** CONSEIL DE BORD (#229) : arrête la paie de la semaine, puis clôt le bilan de Moral. */
  councilPay: (decision: string) => void;
  councilClose: () => void;
  // heal{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  healConfirm: () => void;
  healCancel: () => void;
  /** Recharger l'arme à distance (LDB 62 l.335) : OUVRE la modale de Test étendu de Projectiles. */
  battleReload: () => void;
  // reload{Roll,Reroll,BonusSL,DarkPact} (Lancer/Chance/+1 DR/Pacte) : générés (RollFlowActionsMap).
  /** « Appliquer » : cumule le DR (Test étendu), recharge si ≥ Indice, consomme l'Action. */
  reloadConfirm: () => void;
  /** Ferme la modale de rechargement sans coût (avant le jet). */
  reloadCancel: () => void;
  // handGate{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  /** « Appliquer » le Test de Dextérité de Main ensanglantée (AA 07 l.117) : RÉUSSITE → ouvre l'Action figée ;
   *  ÉCHEC → l'objet glisse (op `disarm`) et l'Action est consommée. */
  handGateConfirm: () => void;
  /** Annule l'Action avant le jet de Main ensanglantée (défait une charge misclic comme `attackCancel`). */
  handGateCancel: () => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.61/77). */
  battleRecoverState: (state: 'empetre' | 'en-flammes') => void;
  // recover{Roll,Reroll,BonusSL,DarkPact} (Lancer/Chance/+1 DR/Pacte) : générés (RollFlowActionsMap).
  /** « Appliquer » : retire 1 + DR pions de l'État, consomme l'Action. */
  recoverConfirm: () => void;
  /** Ferme la modale de récupération sans coût (avant le jet). */
  recoverCancel: () => void;
  // steamSave{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  /** « Appliquer » la sauvegarde d'Initiative d'une « Fuite de vapeur » (MDG 12 l.328) : ÉCHEC →
   *  ébouillanté (`scaldOps`) ; puis la boucle maritime reprend (`resolveSteamSave`). */
  steamSaveConfirm: () => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: string) => void;
  /** Détermination (Resolve, LDB 17 l.66) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
  /** Détermination depuis une MODALE de jet (LDB 17 l.66) : même règle, pour n'importe quel héros
   *  (le défenseur n'est pas l'actif) et sans toucher au mode d'action. */
  spendResolveCondition: (combatantId: string, conditionName: string) => void;
  /** Détermination (LDB 17 l.62) : immunité à la Psychologie jusqu'à la fin du prochain Round. */
  battleResolvePsychImmune: () => void;
  /** Détermination (LDB 17 l.64) : ignore les modificateurs de Blessure critique ce Round. */
  battleResolveIgnoreCrit: () => void;
  /** Ramasser UN objet au sol pendant un Round (LDB 13 l.115-116) : applique au combattant
   *  actif un item ramassable d'un `prop` interactif adjacent. Consomme l'Action, pas d'auto-équipe.
   *  `key` = `eff:<index dans interact.effects>` (cf. entityPickables). */
  battlePickup: (entityId: string, key: string) => void;
  battleSelectSpell: (spellId: string) => void;
  /** Le combattant actif boit/utilise un consommable de son inventaire (coûte l'Action). */
  battleUseItem: (uid: string) => void;
  /** HORS COMBAT : un héros utilise un consommable (bandages, potion) depuis sa fiche. */
  usePartyItem: (heroId: string, uid: string) => void;
  /** Incantation par modale : « Lancer » fige le jet, Chance le relance, « Appliquer » résout. */
  castRoll: () => void;
  // cast{Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  /** Incantation CRITIQUE (LDB 46 l.52-59) : choix de l'effet bonus (modale). */
  castSetCritChoice: (choice: 'critique' | 'puissance' | 'ineluctable') => void;
  /** Arme invoquée à forme libre (Arme aethyrique) : le lanceur choisit la forme/Spé de Corps à corps. */
  castSetConjureForm: (form: ConjureForm) => void;
  /** « Prêchez, ma sœur ! » (LDB 40 l.42, option `prayer-conviction`) : entonner la Prière discrètement
   *  (murmurée → Difficulté d'un cran plus dure) plutôt qu'à voix haute. Avant le jet uniquement. */
  castSetDiscreet: (discreet: boolean) => void;
  /** Surincantation : alloue (`delta` +1) ou rend (`delta` −1, reset) un pas de +2 DR à un axe
   *  (Portée / Zone d'Effet / Durée / Cible) ; l'effet d'un pas est source-aware (`engine/overcast.ts`). */
  castAllocOvercast: (axis: OvercastAxis, delta: number) => void;
  /** Jets sur le Tableau CHOISIS par le lanceur (EDOC 13 l.276 : « vous pouvez » — déclinable), borné
   *  [0, pas Durée alloués]. N'apparaît QUE si le sort porte un `rollTable.extraRollsPerStep`. */
  castSetChosenTableRolls: (n: number) => void;
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
   *  jet + son cycle Chance/+1 DR/Pacte/Résilience (ciblé par `pid`).
   *  Délégués `counterspell{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll}` : générés (RollFlowActionsMap, MULTI). */
  /** « Appliquer » : agrège (dissipé si UN gagne ; sinon le Sort se résout au meilleur DR net) → castConfirm. */
  counterspellConfirm: () => void;
  /** « Laisser passer » : aucun Contre-sort retenu → le Sort se résout tel quel (castConfirm). */
  counterspellCancel: () => void;
  /** Test Étendu SÉQUENTIEL (LDB 12) : ouvre le flux (ex. crocheter DR 5) ; un Round à la fois. */
  startExtendedTest: (opts: { actorId: string; label: string; skillLabel: string; target: number; targetDR: number; maxAttempts?: number; flag?: string; support?: { count: number; bonus: number }; dispel?: { spellId: string; casterId: string; label: string }; outcome?: { kind: string; meta?: CascadeStepMeta } }) => void;
  // extendedTest{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap, MULTI).
  /** Cumule le DR du Round courant (LDB 12 l.200) ; total < 0 → recommence ; total ≥ cible → réussite. */
  extendedTestNext: () => void;
  extendedTestCancel: () => void;
  /** Enfoncer une porte à PLUSIEURS (EDO Appendice 2) : ouvre le flux (objet BE/B) ; chacun frappe. */
  startForceDoor: (opts: { label: string; doorBE: number; doorB: number; heroIds: string[]; flag?: string }) => void;
  // forceDoor{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap, MULTI).
  /** Applique les dégâts du Round (somme) ; porte à ≤ 0 B → cède (flag posé) ; sinon nouveau Round. */
  forceDoorConfirm: () => void;
  forceDoorCancel: () => void;
  /** CASCADE séquentielle (`FLOWS.cascade`) : jet de l'étape courante + cycle Chance/+1 DR/Pacte/
   *  Résilience (ciblé par `pid` = id d'étape). `Resist` = Résistance (Menace, LDB 10) ; `Determine` =
   *  Détermination (immunité PSY temporaire, LDB 17 l.62) sur une étape de Psychologie.
   *  Délégués `cascade{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll,Resist,Determine}` : générés (RollFlowActionsMap, MULTI). */
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
   *  + cycle Chance/+1 DR/Pacte/Résilience (ciblé par `pid`). Cible IA = rangée témoin auto-roulée.
   *  Délégués `opposition{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll}` : générés (RollFlowActionsMap, MULTI). */
  /** « Appliquer » : agrège les oppositions → `pendingCast.opposedOutcome` (résisté + marge par cible) → castConfirm. */
  oppositionConfirm: () => void;
  /** Incantation HORS COMBAT (couture D) : un héros lanceur cible self/allié ; sorts non-offensifs. */
  oocCastSpell: (casterId: string, spellId: string, targetId: string, fromGrimoire?: boolean) => void;
  battleFocusSpell: (spellId: string) => void;
  battleClickTile: (pt: Pt, opts?: { confirm?: boolean }) => void;
  battleClickEntity: (id: string, opts?: { confirm?: boolean; skipMountChoice?: boolean; forceAttackId?: string; wardCleared?: boolean }) => void;
  /** Annule TOUT le déplacement décomposé du Tour (R6/LOT 6) tant qu'aucune Action n'a été prise :
   *  restaure positions/orientation depuis `battle.moveSnapshot`. No-op après l'Action. */
  cancelMove: () => void;
  battleEndTurn: () => void;
  /** Reprise après un changement de Cadence de combat en plein combat (passage en Auto/Rapide) :
   *  ré-entre la boucle (auto-résolution de modale + tour de l'IA). No-op en manuel / hors combat. */
  resumeCadence: () => void;
  /** Chance, 3e usage (LDB 17 l.27) : en début de Round, place un héros en tête de l'ordre
   *  contre 1 point de Chance (pré-emption d'initiative). */
  roundStartPromote: (heroId: string) => void;
  /** Tir rapide (talent, LDB 10) : INTERRUPTION à distance en début de Round (hors de l'ordre) ; le tir
   *  se résout par la modale de jet normale et épuise le tour normal du tireur (Action + Mouvement). */
  preemptRangedShot: (heroId: string, targetId: string) => void;
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
  /** Bascule le set d'armes actif du combattant actif (Action gratuite, LDB 13 l.106 ; plafond MAISON 1×/tour, même Engagé). */
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
  /** Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) : bascule le tir sans corde (Portée 60,
   *  perte de l'Atout Immobilisante) — proposé seulement si l'arme porte `ItemCapabilities.ropeMode`. */
  attackSetHarpoonRopeCut: (v: boolean) => void;
  /** « Retenir ses coups » (Aux Armes l.2503-2505) : bascule le coup non létal de mêlée (avant le jet). */
  attackSetWithhold: (v: boolean) => void;
  /** « Empoignade » (LDB 14 l.159) : bascule l'initiation d'Empoignade à mains nues (avant le jet). */
  attackSetGrapple: (v: boolean) => void;
  /** « Je ne faillirai pas ! » (RAW-2, LDB 17 l.73) : choisit la Localisation d'un Coup Critique forcé. */
  attackSetCritLocation: (loc: HitLocation) => void;
  attackRoll: () => void;
  // attack{Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll,Cancel} : générés (RollFlowActionsMap).
  // `attackSetForcedRoll(roll)` (LDB 17 l.73 « vous choisissez le résultat ») : valeur du dé d'un succès
  //  forcé (un double ≤ cible → Coup Critique, ex. Salundra l.75) ; re-dérive l'attaque, refusé si raté.
  // `attackCancel()` : « Annuler » unifié (défaire-charge via `FLOWS.attack.onCancel`) — cf. RollFlowActionsMap.
  attackConfirm: () => void;
  /** Pilonnage INDIRECT : dépose le point d'impact choisi (clic-case du placeur 'siege') et ouvre la modale
   *  de tir de la pièce indirecte servie (`pendingAttack` siège). Cf. `siegeAimCommit` (combatSlice). */
  siegeAimCommit: (pt: Pt) => void;
  /** Balayage (Frappe Mortelle, LDB 14 l.12) : enchaîne l'attaque sur une cible adjacente (ouvre une
   *  modale d'attaque standard) ; borné à BCC enchaînements. */
  cleaveAttack: (targetId: string) => void;
  /** Termine le balayage en cours (le joueur renonce aux enchaînements restants). */
  cleaveEnd: () => void;
  /** Maniement de deux armes (LDB 10 l.638) : 2ᵉ frappe (main secondaire) contre la cible choisie. `skipGate`
   *  interne : Test de Main ensanglantée déjà PASSÉ (reprise via `handGateConfirm`), ne pas re-tester. */
  dualStrikeAttack: (targetId: string, skipGate?: boolean) => void;
  /** Renonce à la 2ᵉ frappe (« peut viser » = optionnel) → pas de 2ᵉ attaque, pas d'Avantage. */
  dualStrikeSkip: () => void;
  /** Piétinement (LDB 85 l.320-321) : action gratuite (1 Avantage) contre un adversaire adjacent
   *  plus petit. Ne consomme pas l'Action. */
  battleTrample: (targetId: string) => void;
  /** Arme une ATTAQUE (id d'`AttackOption` : 'arme'/'morsure'/'tentacule'/'pietinement'…) pour le clic-ennemi
   *  — source UNIQUE qui remplace l'arme implicite + l'ancien mode manœuvre/tentacule/trample. Toggle → 'arme'.
   *  Le clic-ennemi résout l'attaque armée via l'approche-puis-frappe (battleClickEntity). */
  battleSelectAttack: (id: string) => void;
  /** Manœuvre de ZONE / soi immédiate (Souffle/Vomi/Langue/Hurlement/Regard/Étreinte) : résolution
   *  directe par le résolveur moteur partagé. L'Étreinte glaciale coûte l'Action (LDB 85 l.112). */
  battleManeuverArea: (kind: AttackKind) => void;
  /** Capacité SUR SOI octroyée par un trait (Métamorphose humain↔hybride de l'Enfant d'Ulric) : résout la
   *  manœuvre `targeting:'self'` sur l'acteur et consomme l'Action (la 2ᵉ vient du `loseTurn` de ses effets). */
  battleSelfManeuver: (maneuverId: string) => void;
  /** Acquitte la révélation en tête de file (montre le dé du jet subi/sur table) ; reprend l'IA si vide. */
  dismissReveal: () => void;
  /** Piétinement par modale (LDB 85 l.320-321) : Lancer le jet, dépenser une Chance, appliquer (gratuit). */
  // trample{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  trampleConfirm: () => void;
  trampleCancel: () => void;
  /** Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant de
   *  l'Avantage adverse. `foeId` absent = 1er éligible (picker via `battementSetFoe`). */
  battleBattement: (foeId?: string) => void;
  battementSetFoe: (foeId: string) => void;
  // battement{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  battementConfirm: () => void;
  battementCancel: () => void;
  /** Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test opposé Athlétisme vs Calme. Sur victoire,
   *  le foe est distrait (ne gagne plus d'Avantage). `foeId` absent = 1er éligible en Ligne de vue
   *  (picker via `distraireSetFoe`). */
  battleDistraire: (foeId?: string) => void;
  distraireSetFoe: (foeId: string) => void;
  // distraire{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  distraireConfirm: () => void;
  distraireCancel: () => void;
  /** Manœuvre de créature par modale (LDB 85) : Lancer le jet d'ATTAQUANT (CC/CT), Chance/Pacte/
   *  Résilience l'influencent, Appliquer roule les défenseurs et résout l'opposition au feed. */
  // maneuver{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  maneuverConfirm: () => void;
  maneuverCancel: () => void;
  /** Avantage dépensé par le Regard pétrifiant (variable, LDB 85 l.238) : 1..advantage → +N DR. */
  maneuverSetAvantage: (n: number) => void;
  /** Course (LDB 15 l.79-82) : ouvrir la modale, lancer le Test d'Athlétisme, Chance/Résilience, appliquer (déplacement étendu). */
  battleRun: (dest?: Pt) => void;
  /** Manœuvre navale (MDG 13) : ouvre la modale du Test de Navigation pour le navire que sert `crewId`. */
  battleShipManeuver: (crewId: string) => void;
  /** Choix du virage (pré-jet OptionChooser) : crans d'octant (±1 = 45°, ±2 = 90°, 0 = tout droit). */
  shipManeuverSetTurn: (steps: number) => void;
  shipManeuverConfirm: () => void;
  shipManeuverCancel: () => void;
  /** Recharge d'un poste (MDG 12 l.462) : ouvre la modale du Test étendu de Projectiles du chef de pièce + Soutien. */
  battleShipReload: (shipId: string, posteUid: string) => void;
  /** Bordée (« Tir de batterie », MDG 14 l.128) : ouvre la modale du Test d'équipage des Artilleurs sur `targetId`. */
  battleShipBattery: (shipId: string, targetId: string) => void;
  shipBatteryConfirm: () => void;
  shipBatteryCancel: () => void;
  /** Bordée HEADLESS (auto-pilote navire, couche Mer) : Test d'équipage des Artilleurs résolu sans modale → volée sur `targetId`. */
  shipAutoBattery: (shipId: string, targetId: string) => boolean;
  // shipBattery{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap, MULTI).
  /** Test d'équipage GÉNÉRIQUE (MDG 14) : ouvre la modale multi-jets du type `testTypeId` (Rude épreuve…). */
  battleCrewTest: (shipId: string, testTypeId: string) => void;
  crewTestConfirm: () => void;
  crewTestCancel: () => void;
  // crewTest{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap, MULTI).
  /** Chanson de marin (Talent, MDG 09 l.32-40) : ouvre la modale du chanteur (choix de chanson + Test de Chant). */
  battleSingShanty: (shipId: string) => void;
  /** Choix de la chanson (pré-jet, parmi les specs CONNUES du Talent). */
  shantySetSong: (shantyId: string) => void;
  shantyConfirm: () => void;
  shantyCancel: () => void;
  // shanty{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  // run{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  runConfirm: () => void;
  runCancel: () => void;
  /** Chute volontaire (LDB 15 l.82) : depuis `from` (case du sauteur) vers `to` (case cardinale plus
   *  basse), ouvre le choix pré-jet (Sauter / Tenter le Test d'Athlétisme). Refus silencieux si
   *  `planFall` ne reconnaît pas le geste (arête non-falaise/murée/grimpable). */
  fallAcross: (from: Pt, to: Pt) => void;
  /** Choix RAW pré-jet : `true` ouvre le Test (modale) ; `false` résout IMMÉDIATEMENT le saut direct
   *  (chute PLEINE, sans Test — LDB 15 l.82 « vous pouvez tenter »). */
  fallChoose: (attempt: boolean) => void;
  // fall{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  fallConfirm: () => void;
  fallCancel: () => void;
  /** Approche d'une source de Peur (LDB 21 l.29) : Test de Calme (+0) ; succès → l'intention différée est relancée. */
  // approach{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  approachConfirm: () => void;
  approachCancel: () => void;
  /** Bénédiction de Protection (LDB 41 l.105) : Test de FM Accessible (+20) ; succès → l'attaque est relancée. */
  // ward{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  wardConfirm: () => void;
  wardCancel: () => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.15). */
  battleStandUp: () => void;
  /** « Servir cette pièce » (MDG 12) : le héros actif devient chef d'un poste de siège NON servi adjacent (arme octroyée) — coûte l'Action. KIND-AGNOSTIQUE. */
  battleManPoste: (target?: { hullId: string; posteUid: string }) => void;
  /** « Quitter la pièce » (release) : libère le poste servi pour un autre — coûte l'Action. */
  battleLeavePoste: () => void;
  /** « Pousser » un engin de siège CREWÉ à roues (ADE II 8 l.258, Lot 2 #156) : ouvre le mode de
   *  ciblage-CASE 'push' (le clic-sol suivant commet la translation de formation, `targetingModes.ts`).
   *  Chef d'un poste d'engin MOBILE, Action dispo, Équipe ≥ moitié requise (sinon no-op, comme un tir
   *  sous-effectif refusé). Mouvement SIMPLE, aucun jet ; plafonné à `rule('siege-engine-push-speed')`. */
  battlePushEngine: () => void;
  /** « Diriger l'équipe » (Commandant d'équipe, AA) : Test de Commandement (+0) pour aider une équipe d'Arme
   *  d'équipe à portée de voix — sur réussite, elle tire au score de Projectiles du commandant. Coûte l'Action. */
  battleAidTeam: () => void;
  /** Focalisation par modale (Test étendu) : Lancer, Chance, Appliquer (cumule le DR). */
  // focus{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  focusConfirm: () => void;
  focusCancel: () => void;
  battleDispelSpell: (spellId: string, spellCasterId: string) => void;
  dispelConfirm: () => void;
  dispelCancel: () => void;
  /** Focalisation HORS COMBAT (couture D) : ouvre la modale de Focalisation pour un héros lanceur du groupe. */
  oocFocusSpell: (casterId: string, spellId: string) => void;
  /** Dissipation de sort permanent HORS COMBAT (couture D, LDB 46 l.160-162, #461). */
  oocDispelSpell: (casterId: string, spellId: string, spellCasterId: string) => void;
  // (Psychologie de combat (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round — Traits/Terreur au
  //  DÉBUT (openRoundStartPsych), Peur à la FIN (openRoundEndPsych) — résolue par les handlers `cascade*`,
  //  applier 'combatPsych'.)
  /** Entrée en Frénésie d'un héros (LDB 21 l.32) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  battleFrenzy: () => void;
  // frenzy{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  /** Action « cumuler l'Avantage » (LDB 09 l.305-308) : Test de la Compétence `skillId` (Intuition/
   *  Savoir/Survie/Prière) via la modale de Test standard ; sur réussite +1 Avantage plafonné. Coûte l'Action. */
  battleGainAdvantage: (skillId: string) => void;
  frenzyConfirm: () => void;
  frenzyCancel: () => void;
  /** Maladresse (modale héros, LDB 14) : lancer sur le Tableau des Oups !, puis appliquer l'effet. */
  fumbleRoll: () => void;
  fumbleConfirm: () => void;
  /** Flux de défense réactive (héros attaqué par l'IA) : choisir Parade/Esquive, défendre,
   *  dépenser une Chance, appliquer. PAS de « Subir » : le RAW n'offre aucune non-défense volontaire
   *  (mêlée = Test opposé, LDB 13 l.123) ; la résolution non opposée est réservée aux cas imposés. */
  defenseSetMode: (mode: DefenseMode, subSkillId?: string) => void;
  /** Choisit l'arme de parade (uid d'ItemInstance ; null = main principale) — avant le jet de défense. */
  defenseSetParryWeapon: (uid: string | null) => void;
  /** Déclare/efface la réaction de Porte-Bouclier (variante AA 13 l.84) pour cette défense au Bouclier. */
  defenseSetShieldReaction: (kind: 'damage' | 'push' | null) => void;
  // defense{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  defenseConfirm: () => void;
  /** « Je te renie ! » (LDB 17 l.71) : résout le choix (true = refuser la mutation, 1 Résilience). */
  renounceResolve: (renounce: boolean) => void;
  /** Peek du planificateur IA (déterministe, sans RNG ni mutation) : la meilleure action du combattant `id`
   *  est-elle de PRÉPARER un sort (cast/castArea/focus) ? Lu par le hook de Frénésie pour différer l'entrée
   *  en Frénésie tant qu'un sort prime (RAW : entrée = choix, psychologie.md l.170). */
  aiWouldCast: (id: string) => boolean;
  /** Combat monté (cadre : LDB 14 l.175-187) : enfourcher une monture libre adjacente / en descendre.
   *  Coût = MOUVEMENT sans jet ni Action — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
   *  moment », #526 ; aucune clause de coût citable, LDB 14/15/09 + AA 9 fouillés en entier) ;
   *  Chevaucher sans Test : LDB 09 l.112. */
  battleMount: () => void;
  battleDismount: () => void;
  /** Combat monté (AA 9 l.36) : clic sur un couple cavalier+monture (deux ennemis) → choisir lequel
   *  frapper (le cavalier −10 si l'on est plus petit que la monture ; abattre la monture désarçonne). */
  pendingMountTarget: { riderId: string; mountId: string } | null;
  mountTargetSelect: (id: string) => void;
  mountTargetCancel: () => void;
  /** Désengagement (LDB 15 l.43-68) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  battleDisengage: () => void;
  disengageConfirmA: () => void; // Sacrifier l'Avantage
  disengageRoll: () => void; // Esquiver (lance le Test opposé)
  // disengage{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) + « vous choisissez le résultat » (dé forcé) :
  // {test,attack,defense,cast,disengage}ForceSuccess et {defense,cast,trample}SetForcedRoll sont aussi générés.
  disengageConfirm: () => void; // Appliquer l'issue de l'Esquive
  disengageFlee: () => void; // Fuir : coup dans le dos SUBI, puis Test de Calme influençable (flux `flee`)
  disengageFleeAck: () => void; // « Continuer » (coup manqué) : ferme la modale (fuite déjà complétée)
  // flee{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap) — Test de Calme du fuyard (calqué `approach`).
  fleeConfirm: () => void; // Appliquer : État Brisé (sur échec) + libération/Course différées
  disengageCancel: () => void;
  /** « Au Contact » (LDB 62 l.176, Option « Longueur d'arme ») : Test opposé de Corps à corps + choix du vainqueur. */
  battleAuContact: (targetId: string) => void;
  auContactRoll: () => void; // Lancer le jet de Corps à corps du mover (Test opposé)
  // auContact{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  auContactConfirm: () => void; // Appliquer : le mover gagne → phase de choix ; le foe gagne (IA) → choix auto ; égalité → statu quo
  auContactChoose: (mode: 'normal' | 'contact') => void; // le vainqueur HÉROS tranche
  auContactCancel: () => void;
  /** Empoignade (LDB 14 l.161) : action à son tour entre deux Empoignés. */
  battleGrapple: (targetId: string) => void;
  grappleBreak: () => void; // Briser l'Empoignade (gratuit, Avantage supérieur)
  grappleRoll: () => void; // Lancer le Test opposé de Force de l'acteur
  // grapple{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  grappleConfirm: () => void; // Appliquer : succès → phase d'options ; échec → +1 Avantage au foe ; égalité → statu quo
  grappleChoose: (mode: 'damage' | 'entangle' | 'free') => void; // le vainqueur choisit Dégâts / Empêtrer / Se libérer
  grappleCancel: () => void;
  /** Action canonique UNIQUE composant `journal` (pousse `msg`, ou toutes les `msg[]` dans l'ordre,
   *  et plafonne à 40 lignes) — ticket #319 : tout site de `journal: [...journal.slice(-40), …]` route ICI. */
  log: (msg: string | string[]) => void;
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
  /** Menu système plein écran (pause) ouvert — commuté par Échap (binding `toggle-menu`) et le bouton ☰. */
  gameMenuOpen: boolean;
  setGameMenu: (open: boolean) => void;
  /** Voyage en cours/interrompu (progression km — « Reprendre le voyage » après une embuscade). */
  travelPlan: import('./travelFlow').TravelPlan | null;
  /** Récapitulatif du dernier segment de voyage (audit M4) — modale à l'arrivée/interruption. */
  travelRecap: import('./travelFlow').TravelRecap | null;
  dismissTravelRecap: () => void;
  /** Démarre un voyage depuis le lieu courant le long d'une route (mode + classe + allure). */
  startTravel: (routeId: string, mode: import('../engine/travel').TravelMode, opts?: { classKey?: string; hoursPerDay?: number; allure?: import('../engine/mountTravel').Allure; seaPace?: number; fast?: boolean; cadence?: import('./voyageCadence').VoyageCadence }) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  resumeTravel: () => void;
  /** Bascule la CADENCE des ordres de la traversée en cours (couche `voyageCadence`) — « Passer en
   *  jour-par-jour » de l'écran de traversée, ou retour en commandée. */
  setVoyageCadence: (cadence: import('./voyageCadence').VoyageCadence) => void;
  /** Épingle le RÔLE de marche PERSISTANT d'un héros (`travelRole`, id d'Activité de voyage EDOC 8),
   *  ou le détache (`null` ⇒ rôle inféré). Réutilisé au départ de chaque trajet (0 ré-assignation/jour). */
  setTravelRole: (heroId: string, role: string | null) => void;
  /** Épingle (`role`) ou détache (`null`) le rôle d'ÉQUIPAGE naval d'un marin (`shipRole`) — interface de gestion
   *  du navire. Patche `party` ET `battle.combatants` (l'équipage vit dans la bataille en mer). */
  setShipRole: (crewId: string, role: string | null) => void;
  /** Sélectionne la munition PERSISTANTE d'un poste d'artillerie (`ShipPoste.ammoUid` — boulet/mitraille,
   *  MDG 12 l.410-424), depuis la fiche du navire. `null` → retour au défaut (1re compatible). */
  setPosteAmmo: (shipId: string, posteUid: string, ammoUid: string | null) => void;
  /** Dernier jour (index d'horloge) traité par l'entretien quotidien (rations/faim) — anti-double-comptage. */
  lastUpkeepDay: number;
  /** Budget d'heures de voyage CONSOMMÉ le jour calendaire courant (#340) — SOURCE UNIQUE keyée sur
   *  `dayIndex(gameTime)`, remise à zéro au franchissement de jour. `foot`/`mount` = heures à pied / en
   *  selle déjà parcourues aujourd'hui (le budget RAW de 6 h se compte PAR JOUR, pas par trajet) ;
   *  `marched` = la marche forcée du jour a déjà été testée (un seul Test de Résistance/jour, l.224). */
  travelDayHours: { day: number; foot: number; mount: number; marched: boolean };
  /** Dernier jour calendaire (index d'horloge) où une NUIT a été jouée (`sleepParty`/`buildNightCascade`)
   *  — garde de la « nuit forcée » maison (#340) : un jour franchi au-delà sans sommeil coûte 1 Exténué. */
  lastNightDay: number;
  /** Départ de voyage BLOQUÉ par la porte d'heure (maison `travel-departure-gate`, #340) : terre/fleuve
   *  de nuit → « Attendre l'aube » (nuit jouée) ou annuler. `null` = pas de départ en attente. */
  pendingDeparture: { routeId: string; mode: import('../engine/travel').TravelMode; opts: { classKey?: string; hoursPerDay?: number; allure?: import('../engine/mountTravel').Allure; seaPace?: number; fast?: boolean; cadence?: import('./voyageCadence').VoyageCadence }; dawnAt: number } | null;
  /** « Attendre l'aube » : joue une nuit (repos) puis efface la porte — le groupe repart au matin. */
  departWaitDawn: () => void;
  /** « Annuler » le départ nocturne bloqué par la porte. */
  departCancel: () => void;
  /** Navire de campagne PERSISTANT (MDG 13-14) — porte son `vehicleId` et son MORAL (recalculé chaque
   *  semaine par l'entretien quotidien via `tickShipMorale`). `null` hors campagne navale. */
  vessel: CampaignVessel | null;
  /** Registre UNIQUE des Possessions (#615, SOCLE POSSESSIONS §6) — bêtes/serviteurs/véhicules/navires/
   *  immeubles, hors héros de `party`. Aucun mirroir par kind ; `possessionsFlow.ts` en est la plomberie. */
  possessions: Possession[];
  /** Ajoute une Possession au registre (`uid` attribué par scan) — renvoie l'uid. */
  addPossession: (p: PossessionInput) => string;
  /** Renomme l'instance (`label`). */
  renamePossession: (uid: string, label: string) => void;
  /** Réaffecte le propriétaire (succession, don, vente). */
  transferPossession: (uid: string, newOwnerId: string) => void;
  /** Dépose la possession sur place. */
  stablePossession: (uid: string, placeId: string) => void;
  /** Reprend une possession déposée. */
  retrievePossession: (uid: string) => void;
  /** Embarque la possession sur un hôte (véhicule/navire). */
  embark: (uid: string, hostUid: string) => void;
  /** Débarque une possession embarquée. */
  disembark: (uid: string) => void;
  /** Abandon (§6, décision №4) — pose `destroyed`, confirmation côté appelant. */
  abandonPossession: (uid: string) => void;
  /** Ajoute un trait appris (`learnedTraits`, nature `bete`). */
  learnPossessionTrait: (uid: string, traitId: string) => void;
  /** Écran PORT ouvert (services au navire à quai — MDG 15) : réparation/carénage/Améliorations +
   *  commerce (offres d'achat générées à l'escale). `null` = fermé. */
  port: import('./portFlow').PortState | null;
  /** Ouvre l'écran Port si le groupe est à un lieu portuaire de la carte avec un navire de campagne. */
  openPort: () => void;
  closePort: () => void;
  /** Achète `enc` points d'une cargaison de l'escale (Type/Taille/Marchandage, MDG 15 l.319-349). */
  portBuyCargo: (cargoId: string, enc: number) => void;
  /** Vend un lot de la cale (Trouver un acheteur/Prix d'offre/Marchandage, MDG 15 l.351-397). */
  portSellCargo: (cargoIndex: number) => void;
  /** Brade un lot invendable (¼ du prix de base, MDG 15 l.399). */
  portDumpCargo: (cargoIndex: number) => void;
  /** Répare la coque au chantier (1 CO/Blessure, MDG 13 l.643) — journalise le résultat. */
  portRepair: () => void;
  /** Carène en cale sèche (Salissures, MDG 13 l.150-159). */
  portCareen: () => void;
  /** Installe une Amélioration navale (coût par bande de Taille, MDG 12). */
  portInstallUpgrade: (traitId: string, units?: number) => void;
  /** Recrute `count` PNJ salariés au rôle `roleId` (escale-hub #228 — barème `crew-roles.json`, MDG 14 l.293-302). */
  portHireCrew: (roleId: string, count?: number) => void;
  /** Débarque `count` PNJ salariés du rôle `roleId` (#228). */
  portDismissCrew: (roleId: string, count?: number) => void;
  /** Board de RUMEURS COMMERCIALES persistant (MSRC 13 l.180) : chaque rumeur désigne un AUTRE Lieu où
   *  des biens se vendent au double. Entendues aux marchés (Ragot Complexe −10) OU à l'auberge du hub de
   *  ville (#352, Activité `recueillir-informations`, EDOC 8 l.151), consultées dans l'écran Marché/le
   *  panneau auberge, appliquées à la vente au Lieu désigné. Persiste au niveau GROUPE (sauvegardé, remis
   *  à zéro en nouvelle partie via l'état initial). */
  tradeRumours: import('../engine/landCargo').TradeRumour[];
  /** Écran MARCHÉ TERRESTRE ouvert (commerce de cargaison à un Lieu `market` de la carte — MSRC 13 l.3) :
   *  offres d'achat générées à l'arrivée. `null` = fermé. */
  landMarket: import('./landMarketFlow').LandMarketState | null;
  /** Ouvre l'écran Marché si le groupe est à un Lieu de commerce terrestre de la carte (`MapPlace.market`). */
  openLandMarket: () => void;
  closeLandMarket: () => void;
  /** Achète `enc` d'une cargaison de l'étape (disponibilité 2 temps/Marchandage/lot partiel, MSRC 13 l.129-131) —
   *  chargée sur le porteur de défaut du groupe dans la limite de sa Contenance (#327). */
  landBuyCargo: (cargoId: string, enc: number) => void;
  /** Vend un lot d'un porteur (Demande/Mise à prix/Marchandage, MSRC 13 l.133-160). */
  landSellCargo: (carrierId: string, cargoIndex: number) => void;
  /** Brade un lot invendable (½ du prix de base dans un Lieu de Commerce, MSRC 13 l.160). */
  landDumpCargo: (carrierId: string, cargoIndex: number) => void;
  /** Transfère `enc` d'une cargaison entre deux porteurs CO-LOCALISÉS (bête/véhicule/navire, #327). */
  moveCargo: (fromId: string, toId: string, cargoId: string, enc: number) => void;
  /** Évalue la qualité secrète d'un lot de Vin proposé (Test d'Évaluation, MSRC 13 l.95). */
  landEvalWine: (cargoId: string) => void;
  /** Ouvre le Test de Ragot de l'auberge du hub de ville (#352, Activité `recueillir-informations`
   *  étendue au contexte `auberge`) : succès → rumeur commerciale (`generateTradeRumour`), échec →
   *  Exténué (EDOC 8 l.133). Avance l'horloge (`inn-gather-info-minutes`) quelle que soit l'issue. */
  gatherInnInfo: () => void;
  /** ACTIVITÉS EN MER en attente (semaine de 8 jours, MDG 15 l.266-306) — modale de choix par héros. */
  pendingSeaActivities: import('./seaActivities').PendingSeaActivities | null;
  /** Résout les Activités choisies puis rend la main à la halte de nuit. */
  seaActivitiesConfirm: (picks: Record<string, import('./seaActivities').SeaActivityPick | null>) => void;
  /** ÉVÉNEMENT DE PORT « Prêtre de Manann » en attente de CHOIX (MDG 15 l.246). */
  pendingManannPriest: import('./seaVoyageFlow').PendingManannPriest | null;
  /** Résout le choix : `true` = payer la bénédiction, `false` = réduire l'Humeur de Manann de 4d10. */
  resolveManannPriest: (pay: boolean) => void;
  /** Permission de RELÂCHE À TERRE en attente de CHOIX, posée à l'accostage AVANT l'événement de
   *  port (MDG 15 l.245). */
  pendingShoreLeave: import('./seaVoyageFlow').PendingShoreLeave | null;
  /** Résout le choix : `true` = relâche accordée, `false` = refusée (gate l'Embrigadement/Fête de Manann). */
  resolveShoreLeave: (allow: boolean) => void;
}

/** Navire que le groupe possède/commande en campagne — survit aux jours et aux combats (≠ la coque
 *  transitoire d'un combat). Son Moral est recalculé hebdomadairement (`tickShipMorale`). Les champs
 *  du lot 7b sont OPTIONNELS : une save antérieure charge tel quel, chaque point de lecture porte son
 *  défaut (coque intacte, humeur neutre, cale vide) — migration par défauts, jamais de corruption. */
export interface CampaignVessel {
  vehicleId: string;
  /** #230 — Nom d'INSTANCE authoré (« Le Cormoran »…). Affichage pur (jamais une clé de logique/rendu) ;
   *  absent = le label du TYPE (`findVehicleById(vehicleId).label`). Migration par défaut. */
  label?: string;
  morale: ShipMoraleState;
  /** #30 — Blessures de COQUE persistantes (absent = coque intacte). Synchronisées par le voyage
   *  maritime (`persistHullWounds`) et les réparations ; la coque de trajet en repart. */
  wounds?: { current: number; max: number };
  /** Améliorations d'INSTANCE posées au chantier (MDG 12 — Clinfoc, Blindage, Ancre…), recopiées
   *  sur la coque au départ (`voyageShip`). */
  upgrades?: import('../engine/types').NavalTraitRef[];
  /** Salissures (MDG 13 l.144-159) : niveau 0-5 + garde hebdomadaire du Test. */
  fouling?: { level: number; lastWeek: number };
  /** Humeur de Manann (MDG 15 l.83-125) — par navire, registre des facteurs déjà appliqués. */
  manann?: import('../engine/seaVoyage').ManannMood;
  /** SABOTAGE authoré sur cette coque (MDG 14 l.45-47) — clampé [-5,0] par `shipSaboteurDR`,
   *  recopié sur la coque de trajet (`voyageShip`) comme `upgrades`/`wounds`. */
  saboteurDR?: number;
  /** Cargaison en cale (commerce maritime, MDG 15) — perdue avec le navire (abandon/capture). */
  cargo?: import('../engine/seaVoyage').CargoLot[];
  /** Critiques de navire subis EN VOYAGE (notes verbatim, MDG 13) — à purger à la remise en état. */
  criticals?: string[];
  /** Crabes boxeurs (événement ch.15) : M −1 jusqu'à ce que la coque soit raclée. */
  crabs?: boolean;
  /** Eau douce embarquée (litres — tonneau : 145 L, MDG 14 l.242). Absent = ravitaillement réputé
   *  assuré (même décision de périmètre que la Soif, cf. provisions.ts). */
  waterLitres?: number;
  /** VIVRES de l'équipage PNJ embarqués (rations de mer de la cale, en jours-homme — MDG 14 l.238/250).
   *  L'effectif nominal en consomme une/jour à `shipboardSouls().crew` ; à court → facteur de Moral
   *  `nourriture-insuffisante` (−2d10, MDG 14 l.171). Absent = ravitaillement d'équipage réputé assuré
   *  (même décision de périmètre que `waterLitres`). #245. */
  provisions?: number;
  /** Milles de la DERNIÈRE traversée accomplie — vente à un port PRODUCTEUR : « Si le bateau a
   *  parcouru plus de 100 milles » (MDG 15 l.366). Absent = navire à quai depuis sa mise à l'eau. */
  lastVoyageMilles?: number;
  /** Effectif PNJ perdu CUMULÉ (Embrigadement, MDG 15 l.245 : « Vous perdez 2d10 membres d'équipage »),
   *  plafonné au complément nominal du type (`vehicles.json` ship.crew — `applyVesselCrewLoss`). Absent
   *  = aucune perte. #150. */
  crewLost?: number;
  /** #216 — Équipage SALARIÉ embauché (barème `crew-roles.json`). Absent/vide = aucun équipage salarié
   *  = aucune paie prélevée à l'entretien hebdomadaire. */
  crew?: import('../engine/crewMorale').CrewHire[];
  /** #216 — Solde hebdomadaire NON payée cumulée (sous de cuivre) : bourse insuffisante au tick →
   *  `pas-de-paie` et dette accumulée ici. Absent = aucune dette. */
  wagesOwed?: number;
}

/** Applique une avancée de dialogue (transition vers un nœud, ou clôture) — point UNIQUE partagé par
 *  `chooseDialogue` (cas sans Test) et `resolveTest` (reprise après un Test suspendu par `choice.flow`). */
function applyDialogueTransition(get: () => GameState, set: (s: Partial<GameState>) => void, tr: DialogueTransition): void {
  if (tr === 'close') {
    if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture (no-op si un Effect a déjà fermé)
    set({ dialogue: null });
    return;
  }
  set({ dialogue: tr });
}

/**
 * Atterrissage d'une chute VOLONTAIRE (LDB 15 l.82) : place le sauteur au pied (`p.to`), applique
 * `applyFall` SAUF si `effectiveMetres <= 0` (« Si vous parvenez à réduire votre distance de chute à 0
 * ou moins, vous ne subissez aucun Dégât de chute » — bypass EXPLICITE, `applyFall(c,0,rng)` ne
 * garantit PAS 0 dégât seul, cf. son d10), journalise, ferme `pendingFall`. `actionSpent` = le Test a
 * été TENTÉ (consomme l'Action, LDB 13 l.86-88, patron `climbAcross` « surface ») ; le saut direct sans
 * Test ne coûte que le Mouvement (comme un pas normal). */
function settleFall(get: Get, set: Set, p: PendingFall, effectiveMetres: number, actionSpent: boolean): void {
  const { scene, mode, battle } = get();
  set({ pendingFall: null });
  if (!scene) return;
  const mover = mode === 'battle' ? (battle ? inBattleId(battle, p.combatantId) : undefined) : get().party.find((h) => h.id === p.combatantId);
  if (!mover) return;
  const m = Math.max(0, effectiveMetres);
  if (m > 0) {
    applyEffects(get, set, [{ type: 'fall', target: 'hero', heroId: p.combatantId, metres: m, to: p.to }]);
  } else {
    // LDB 15 l.82 : réduit à 0 m ou moins ⇒ AUCUN Dégât — bypass EXPLICITE de l'Effet `fall`
    // (`applyFall(c,0,…)` ne garantit PAS 0 seul, cf. son d10) : simple repositionnement + journal.
    placeCombatant(mover, scene, p.to);
    if (mode !== 'battle') set({ partyPos: { ...p.to } });
    get().log(t('fall.jumpSafe', { name: mover.label }));
  }
  if (mode === 'battle' && battle) {
    const bB = get().battle!;
    set({ battle: { ...bB, acted: actionSpent ? true : bB.acted, action: null, movementUsed: (bB.movementUsed ?? 0) + 1, movedPreAction: bB.movedPreAction || !bB.acted, reachable: new Map(), preview: null } });
  }
  bus.emit(EVT.SCENE_DIRTY);
}

export const useGame = create<GameState>((set, get) => ({
  // Actions de combat inline — extraites dans `combatSlice.ts`, spreadées EN TÊTE (mêmes `get`/`set`).
  // Surface IDENTIQUE : cette tranche ne porte que des ACTIONS ; l'état reste assemblé plus bas (forme à plat).
  ...createCombatSlice(get, set),
  screen: 'menu',
  compendiumFocus: null,
  compendiumReturn: 'menu',
  codexOverlay: null,
  gameTime: CAMPAIGN_START,
  lastUpkeepDay: dayIndex(CAMPAIGN_START),
  travelDayHours: { day: dayIndex(CAMPAIGN_START), foot: 0, mount: 0, marched: false },
  lastNightDay: dayIndex(CAMPAIGN_START),
  vessel: null,
  possessions: [],
  tradeRumours: [],
  landMarket: null,
  worldMap: campaignWorldMap,
  worldMapOpen: false,
  gameMenuOpen: false,
  travelPlan: null,
  travelRecap: null,
  party: [],
  scene: null,
  mode: 'exploration',
  partyWiped: false,
  camRot: 0,
  camEdge: false, // défaut = vue de COIN (losange, la plus lisible) ; la rotation 8 crans alterne coin ↔ face par 45°
  // 8 crans (45°) : +1 fait coin→face (même rot) puis face→coin (rot+1) ; -1 l'inverse.
  rotateCam: (dir) =>
    set((s) => {
      const next =
        dir === 1
          ? s.camEdge
            ? { camEdge: false, camRot: (((s.camRot + 1) % 4) as 0 | 1 | 2 | 3) }
            : { camEdge: true }
          : s.camEdge
            ? { camEdge: false }
            : { camEdge: true, camRot: (((s.camRot + 3) % 4) as 0 | 1 | 2 | 3) };
      // Re-centre sur le point focal à chaque cran : sinon le décalage manuel (camPan) persiste à
      // travers le changement de projection (coin↔face, origines très différentes) → vue « téléportée ».
      return { ...next, camPan: { x: 0, y: 0 } };
    }),
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
  shipTurn: (shipId, turnSteps) => {
    const { facing, battle } = get();
    const cur = facing[shipId];
    if (!cur) return; // navire sans cap initial → rien à virer
    const next = rotateDir8(cur, turnSteps);
    set({ facing: { ...facing, [shipId]: next } });
    // Re-mappe TOUS les arcs de bordée d'un coup : firedAttackBlock / targeting relisent facing[shipId].
    const ship = inBattleId(battle, shipId);
    get().log(`${ship?.label ?? shipId} vire de bord — nouveau cap : ${next}.`);
    bus.emit(EVT.SCENE_DIRTY);
  },
  shipAdvance: (shipId, cases) => {
    const { facing, battle, scene } = get();
    const dir = facing[shipId];
    const hull = inBattleId(battle, shipId);
    if (!battle || !hull?.pos || !dir) return 0;
    const d = DIR8_DELTA[dir];
    const w = scene?.dimensions.w ?? Infinity, h = scene?.dimensions.h ?? Infinity;
    // Autres COQUES (jetons-navires) percutables (≠ self, pos connue) : une tuile occupée par une coque arrête
    // l'avance ADJACENT (pas de chevauchement) et déclenche la collision (MDG 13).
    const otherHulls = battle.combatants.filter((c) => c.id !== shipId && c.bodyShape === 'vehicule' && c.pos);
    const hullAt = (x: number, y: number) => otherHulls.find((c) => footprintTiles(c.pos!, footprintN(c)).some((t) => t.x === x && t.y === y));
    // Avance PAS-À-PAS le long du cap (coque 1×1) : on s'arrête au dernier pas libre — sortie de scène OU coque devant.
    let moved = 0;
    let victim: Combatant | undefined;
    for (let step = 1; step <= Math.max(0, cases); step++) {
      const nx = hull.pos.x + d.gx * step, ny = hull.pos.y + d.gy * step;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) break; // hors bornes de scène
      const hit = hullAt(nx, ny);
      if (hit) { victim = hit; break; } // coque devant → stop adjacent (moved = step − 1)
      moved = step;
    }
    if (moved > 0) {
      const delta = { x: d.gx * moved, y: d.gy * moved };
      // Coque + équipage À BORD translatés du MÊME delta (formation rigide) ; les postes (sans `pos`) suivent la
      // coque. MÊME patron de commit que le mouvement de combat (combatSlice : ANIM_MOVE).
      const movers = [hull, ...(hull.crewIds ?? [])
        .map((id) => inBattleId(battle, id))
        .filter((c): c is Combatant => !!c?.pos)];
      for (const m of movers) {
        const from = { ...m.pos! };
        placeCombatant(m, scene, { x: from.x + delta.x, y: from.y + delta.y });
        bus.emit(EVT.ANIM_MOVE, { id: m.id, path: [from, { ...m.pos }] });
      }
      get().log(`${hull.label} avance de ${moved} case${moved > 1 ? 's' : ''} (cap ${dir}).`);
    }
    // Éperonnage (MDG 13) : on percute de la PROUE (avance vers l'avant) ; FRONTAL si la victime tient un cap
    // ~opposé (octant opposé ±1). Dégâts sur les DEUX coques par la langue unique (`applyShipCollision`→`applyOps`).
    if (victim) {
      const opp = rotateDir8(dir, 4);
      const vf = facing[victim.id];
      const frontal = vf === opp || vf === rotateDir8(opp, 1) || vf === rotateDir8(opp, -1);
      for (const line of applyShipCollision(hull, victim, { ramProue: true, frontal }).lines) get().log(line);
    }
    if (moved > 0 || victim) { set({ battle: { ...battle } }); bus.emit(EVT.SCENE_DIRTY); }
    return moved;
  },
  zoom: 1,
  setZoom: (z) => set({ zoom: Math.min(2.6, Math.max(0.4, z)) }), // floor 0.4 : dézoom tactique large
  viewMode: 'iso',
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'iso' ? 'top' : 'iso' })),
  povActive: false,
  togglePov: () => set((s) => ({ povActive: !s.povActive })),
  debugLabels: false,
  camPan: { x: 0, y: 0 },
  panCamBy: (dx, dy) => set((s) => ({ camPan: { x: s.camPan.x + dx, y: s.camPan.y + dy } })),
  resetCamPan: () => set((s) => (s.camPan.x === 0 && s.camPan.y === 0 ? {} : { camPan: { x: 0, y: 0 } })),
  inspectEnabled: false,
  toggleInspectEnabled: () => set((s) => ({ inspectEnabled: !s.inspectEnabled })),
  inspectId: null,
  setInspectId: (id) => set((s) => (s.inspectId === id ? {} : { inspectId: id })),
  sheetId: null,
  setSheetId: (id) => set((s) => (s.sheetId === id ? {} : { sheetId: id })),
  sheetTab: null,
  setSheetTab: (tab) => set((s) => (s.sheetTab === tab ? {} : { sheetTab: tab })),
  sheetScroll: {},
  setSheetScroll: (tab, top) => set((s) => (s.sheetScroll[tab] === top ? {} : { sheetScroll: { ...s.sheetScroll, [tab]: top } })),
  sheetAlarmsSeen: {},
  setSheetAlarmsSeen: (heroId, fp) => set((s) => (s.sheetAlarmsSeen[heroId] === fp ? {} : { sheetAlarmsSeen: { ...s.sheetAlarmsSeen, [heroId]: fp } })),
  hoverCombatantId: null,
  setHoverCombatant: (id) => set((s) => (s.hoverCombatantId === id ? {} : { hoverCombatantId: id })),
  combatCursor: null,
  hovered: null,
  setHovered: (id) => set((s) => (s.hovered === id ? {} : { hovered: id })),
  keyOverrides: loadKeyOverrides(),
  setKeyBinding: (id, code) => set((s) => { const o = { ...s.keyOverrides, [id]: code }; saveKeyOverrides(o); return { keyOverrides: o }; }),
  resetKeyBindings: () => { saveKeyOverrides({}); set({ keyOverrides: {} }); },
  partyPos: { x: 0, y: 0 },
  lightLevel: null,
  flags: {},
  objectives: [],
  explored: {},
  markExplored: (keys) => visionStateMod.recordExplored(get, set, keys),
  journal: [],
  dialogue: null,
  merchant: null,
  merchantStocks: {},
  tavernGames: null,
  battle: null,
  campaignSceneId: null,
  // Champs transitoires (pendings, modales de jet, files de révélation, vue éphémère) : valeurs
  // initiales issues du manifeste UNIQUE (stateFields.ts) — même source que les patchs de reset
  // (`resetFields`). Forme à plat IDENTIQUE (snapshotSave/coop itèrent les clés, ordre indifférent).
  ...initialFields(),

  setScreen: (s) => set({ screen: s }),
  editingHeroId: null,
  setEditingHero: (id) => set({ editingHeroId: id }),
  openCodex: (focus) =>
    set((st) => {
      // Déjà sur l'écran Codex (parcours plein écran) : on se déplace sur l'entrée en place.
      if (st.screen === 'compendium') return { compendiumFocus: focus ?? null };
      // Déjà dans la modale Codex : une cross-réf plonge DANS la modale (pas de nouvel écran).
      if (st.codexOverlay) return { codexOverlay: focus ?? st.codexOverlay };
      // Drill-in depuis le jeu (réf cliquée) : modale focalisée — écran, musique et fiche intacts.
      if (focus) return { codexOverlay: focus };
      // Parcours complet (depuis le menu) : écran plein, retour à l'écran courant.
      return { screen: 'compendium', compendiumFocus: null, compendiumReturn: st.screen };
    }),
  closeCodexOverlay: () => set({ codexOverlay: null }),
  setPendingCampaign: (pc) => set({ pendingCampaign: pc }),

  // ── Entre deux aventures (LDB 22-23, Jalon 5) ──
  interlude: null,
  bank: [],
  favors: [],
  startInterlude: (weeks) => interludeFlow.startInterlude(get, set, weeks),
  interludeEnd: () => interludeFlow.interludeEnd(get, set),
  // Longues Séances de Jeu (LDB 17 l.52) : réutilise l'Effet `restoreFortune` (NE DUPLIQUE PAS la
  // logique — même case que le début de session, qui appelle `engine/fortune.restoreFortune`).
  restoreFortuneNow: () => applyEffects(get, set, [{ type: 'restoreFortune' }]),
  // TOUS les délégués de jet (mono+multi, 36 flux) en UN spread — dérivés de FLOW_WIRING (fin des 40 spreads épars).
  ...buildRollFlowActions(get, set),
  activityCancel: () => FLOWS.activity.cancel(get, set),
  activityConfirm: () => interludeFlow.confirmActivity(get, set),
  // Combat de masse / Puissance de Bataille (ADE II 08) — flux d'orchestration + jet de PJ différé.
  massBattle: null,
  startMassBattle: (spec) => massBattleFlow.startMassBattle(get, set, spec),
  massBattleBegin: () => massBattleFlow.massBattleBegin(get, set),
  massBattleInspire: () => massBattleFlow.openMassBattleInspire(get, set),
  massBattleActivity: (activityId) => massBattleFlow.openMassBattleActivity(get, set, activityId),
  massBattleScene: (sceneId) => massBattleFlow.openMassBattleScene(get, set, sceneId),
  setMassBattleHero: (actionId, heroIds) => massBattleFlow.setMassBattleHero(get, set, actionId, heroIds),
  massBattleRally: () => massBattleFlow.openMassBattleRally(get, set),
  massBattleHazard: (roll) => massBattleFlow.massBattleSetHazard(get, set, roll),
  massBattleClash: () => massBattleFlow.massBattleClash(get, set),
  massBattleAdvance: () => massBattleFlow.massBattleAdvance(get, set),
  endMassBattle: () => massBattleFlow.endMassBattle(get, set),
  interludeCraftStart: (heroId, trapping, atouts, defauts) => interludeFlow.craftStart(get, set, heroId, trapping, atouts, defauts),
  interludeBank: (heroId, kind, amountBrass, rate) => interludeFlow.bankDeposit(get, set, heroId, kind, amountBrass, rate),
  interludeWithdraw: (index) => interludeFlow.bankWithdraw(get, set, index),
  interludeOrder: (heroId, trapping) => interludeFlow.orderItem(get, set, heroId, trapping),
  interludeEntrainement: (heroId, kind, id, spec) => interludeFlow.entrainementStart(get, set, heroId, kind, id, spec),
  interludeActivity: (heroId, activityId, opts) => interludeFlow.openCatalogActivity(get, set, heroId, activityId, opts),
  favorGrant: (heroId, level, owedTo, desc) => favorFlow.grantFavor(get, set, heroId, level, owedTo, desc),
  favorSettle: (heroId, favorId) => favorFlow.settleFavorActivity(get, set, heroId, favorId),
  favorBreak: (heroId, favorId) => favorFlow.breakFavor(get, set, heroId, favorId),

  net: netFlow.initialNet(),
  netHostStart: (name) => netFlow.netHostStart(get, set, name),
  netJoin: (code, name) => netFlow.netJoin(get, set, code, name),
  netAssign: (heroId, seat) => netFlow.netAssign(get, set, heroId, seat),
  setGmSeat: (seat) => netFlow.setGmSeat(get, set, seat),
  netAssignSlot: (slot, seat) => netFlow.netAssignSlot(get, set, slot, seat),
  netLeave: () => netFlow.netLeave(get, set),
  partyAddHero: (hero, wealth, seat) => partyFlow.partyAddHero(get, set, hero, wealth, seat),
  partyRemoveHero: (heroId) => partyFlow.partyRemoveHero(get, set, heroId),
  partyReplaceHero: (oldId, hero, seat) => partyFlow.partyReplaceHero(get, set, oldId, hero, seat),

  // ── Possessions (#615) : délégué à possessionsFlow ───
  addPossession: (p) => possessionsFlow.addPossession(get, set, p),
  renamePossession: (uid, label) => possessionsFlow.renamePossession(get, set, uid, label),
  transferPossession: (uid, newOwnerId) => possessionsFlow.transferPossession(get, set, uid, newOwnerId),
  stablePossession: (uid, placeId) => possessionsFlow.stablePossession(get, set, uid, placeId),
  retrievePossession: (uid) => possessionsFlow.retrievePossession(get, set, uid),
  embark: (uid, hostUid) => possessionsFlow.embark(get, set, uid, hostUid),
  disembark: (uid) => possessionsFlow.disembark(get, set, uid),
  abandonPossession: (uid) => possessionsFlow.abandonPossession(get, set, uid),
  learnPossessionTrait: (uid, traitId) => possessionsFlow.learnPossessionTrait(get, set, uid, traitId),

  // ── Sauvegarde / chargement (Jalon 5) — snapshot zéro-maintenance, hors combat ──
  saveGame: (slot) => {
    const s = get();
    if (s.battle) {
      get().log('Impossible de sauvegarder en plein combat.');
      return false;
    }
    const save = snapshotSave(s as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, new Date().toISOString(), ruleOverrides());
    const ok = saveToSlot(slot, save);
    get().log(ok ? `Partie sauvegardée (emplacement ${slot}).` : 'Sauvegarde impossible (stockage indisponible ou plein).');
    return ok;
  },
  autoSave: () => {
    const s = get();
    if (s.battle || s.net.mode === 'guest') return false; // hors combat ; jamais l'invité (la save vit chez l'hôte)
    const save = snapshotSave(s as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, new Date().toISOString(), ruleOverrides());
    return saveToSlot(AUTO_SLOT, save);
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
  stowItem: (heroId, uid, containerUid) => partyFlow.stowItem(get, set, heroId, uid, containerUid),
  createLoadout: (heroId) => partyFlow.createLoadout(get, set, heroId),
  deleteLoadout: (heroId, id) => partyFlow.deleteLoadout(get, set, heroId, id),
  setActiveLoadout: (heroId, id) => partyFlow.setActiveLoadout(get, set, heroId, id),
  setLoadoutSlot: (heroId, id, slot, uid) => partyFlow.setLoadoutSlot(get, set, heroId, id, slot, uid),
  transferItem: (uid, fromHeroId, toHeroId) => partyFlow.transferItem(get, set, uid, fromHeroId, toHeroId),
  setItemSkin: (heroId, uid, patch) => partyFlow.setItemSkin(get, set, heroId, uid, patch),
  setItemShape: (heroId, uid, shape) => partyFlow.setItemShape(get, set, heroId, uid, shape),
  grantXp: (heroId, amount) => partyFlow.grantXp(get, set, heroId, amount),
  buyCharAdvance: (heroId, char) => partyFlow.buyCharAdvance(get, set, heroId, char),
  buySkillAdvance: (heroId, skillId, spec) => partyFlow.buySkillAdvance(get, set, heroId, skillId, spec),
  buyTalent: (heroId, talentId, spec) => partyFlow.buyTalent(get, set, heroId, talentId, spec),
  designateCareerSlot: (heroId, slotKey, optionId, spec) => partyFlow.designateCareerSlot(get, set, heroId, slotKey, optionId, spec),
  /** Mémorise un sort (PX selon le Talent, LDB 46/10) ; un sort du Chaos corrompt (+1, seuil → mutation). */
  buySpell: (heroId, spellId) => {
    const r = partyFlow.buySpell(get, set, heroId, spellId);
    if (r.ok && r.chaos) {
      const hero = get().party.find((h) => h.id === heroId);
      if (hero) {
        for (const l of gainCorruption(get, set, hero, 1)) get().log(l);
        set({ party: [...get().party] });
      }
    }
  },
  buySpellComponent: (heroId, spellId) => partyFlow.buySpellComponent(get, set, heroId, spellId),
  removeSpellComponent: (heroId, spellId) => partyFlow.removeSpellComponent(get, set, heroId, spellId),
  setHeroBackground: (heroId, patch) => partyFlow.setHeroBackground(get, set, heroId, patch),
  endSession: (rewards) => partyFlow.endSession(get, set, rewards),
  openSessionEnd: () => set({ sessionEndOpen: true }),
  closeSessionEnd: () => set({ sessionEndOpen: false }),
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
    // navigation/vue (screen, caméra, zoom), le groupe (posé par `setParty`) et la SESSION COOP
    // (net : héberger une partie PUIS la lancer ne doit pas dissoudre le salon — Jalon 7).
    const { screen, party, camRot, zoom, viewMode, povActive, inspectEnabled, net } = get();
    set({
      ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>),
      screen, party, camRot, zoom, viewMode, povActive, inspectEnabled, net,
      scene: JSON.parse(JSON.stringify(scene)),
      mode: 'exploration',
      partyPos: pos,
      // Orientation d'ENTRÉE du meneur : authorée (facing du heroStart) sinon vers le CONTENU
      // (spawnFacing — en POV, un spawn au bord sud ne doit pas contempler le vide hors-carte).
      facing: party[0] ? { [party[0].id]: start?.facing ?? spawnFacing(pos, scene.dimensions) } : {},
      flags: { ...scene.flags },
      campaignSceneId: scene.id,
      journal: scene.startMessage ? [scene.startMessage] : [],
      // N1 : l'entrée de zone remonte en MODALE (« le Journal n'est pas lu ») — reveal sceneEntry
      // skippable ; le Journal garde l'archive consultable.
      pendingReveals: scene.startMessage ? [{ kind: 'sceneEntry' as const, title: scene.nom, lines: [scene.startMessage] }] : [],
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
    const heroStart = target.entities.find((e) => e.kind === 'heroStart');
    const start = pos || (entry && target.entryPoints?.[entry]) || heroStart?.pos || findFreeTile(target);
    // Orientation d'ENTRÉE : authorée SEULEMENT si on spawne réellement au heroStart (ni `pos` forcé
    // ni point d'entrée nommé) ; sinon vers le CONTENU de la NOUVELLE carte (le cap hérité de
    // l'ancienne scène n'a aucun sens ici — en POV il peut regarder le vide hors-carte).
    const authored = !pos && !(entry && target.entryPoints?.[entry]) ? heroStart?.facing : undefined;
    // Couture UNIVERSELLE de suspension (state/cascade.ts) : une cascade active PARQUÉE au lieu d'être
    // perdue par `resetFields('scene')` ci-dessous (ex. un abordage ouvre `startCombat` PUIS transitionne
    // vers sa scène — l'ORDRE des deux appels varie selon l'appelant, cette couture protège les deux).
    suspendActiveCascade(get, set);
    set((s) => ({
      scene: JSON.parse(JSON.stringify(target)),
      mode: 'exploration',
      partyPos: { ...start },
      facing: s.party[0] ? { ...s.facing, [s.party[0].id]: authored ?? spawnFacing(start, target.dimensions) } : s.facing,
      lightLevel: null, // nouvelle scène → lumière auto (un setLight ne se propage pas d'une scène à l'autre)
      // flags persistants : on conserve l'état narratif et on ajoute les
      // valeurs par défaut de la nouvelle scène pour les clés absentes.
      flags: { ...target.flags, ...s.flags },
      // Reset des champs transitoires du changement de scène (manifeste UNIQUE, scope 'scene') :
      // tous les pending* d'exploration/combat + `document`. `dialogue`/`battle` (état coeur) et
      // `pendingReveals` (calculé, ≠ init) restent explicites ci-dessous.
      ...resetFields('scene'),
      dialogue: null,
      battle: null,
      // N1 : entrée de zone (transition) en MODALE — reveal sceneEntry skippable (Journal = archive).
      pendingReveals: target.startMessage ? [{ kind: 'sceneEntry' as const, title: target.nom, lines: [target.startMessage] }] : [],
      campaignSceneId: target.id,
    }));
    if (target.startMessage) get().log(target.startMessage);
    get().advanceTime(TIME_COST.sceneTransition); // seam « tout est horodaté » : 0 en intérieur (paramétrable, #T2 extérieur/voyage)
    bus.emit(EVT.SCENE_DIRTY);
    get().autoSave(); // checkpoint d'ENTRÉE de scène (hors combat) — avant qu'une rencontre ne démarre le combat
    openEncounterPsych(get, set); // couture C : Psychologie à la rencontre dans la nouvelle scène
  },

  moveParty: (pt) => {
    const { scene, mode, partyPos } = get();
    if (!scene || mode !== 'exploration') return;
    if (!isWalkable(scene, pt.x, pt.y, pt.z ?? 0)) return; // case de l'ÉTAGE visé (z) — une case « vide » se refuse
    const from = partyPos; // case quittée → oriente le meneur le long du pas
    set({ partyPos: pt });
    const leadId = get().party[0]?.id;
    if (leadId) get().faceFromPath(leadId, [from, pt]);
    bus.emit(EVT.SCENE_DIRTY);
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

  climbAcross: (from, to) => {
    const { scene, mode, battle } = get();
    if (!scene) return;
    // Grimpeur (LDB 15 l.57) : porté par le meneur (exploration) ou le héros actif (combat). Grimpant
    // (LDB 85 l.160-162, créature, combat seulement) : `autoClimb` dispense de tout Test — et de la garde
    // `requiresGrimpeur`, réservée au Talent joueur (`planClimb` arbitre `autoSucceed`, réf ci-dessous).
    const mover = mode === 'battle' ? (battle ? activeCombatantOf(battle) : undefined) : get().party.find((h) => !h.dead && h.wounds.current > 0);
    const hasGrimpeur = !!mover?.talents?.some((tl) => tl.talentId === 'grimpeur' && tl.times > 0);
    const autoClimb = mode === 'battle' && hasAutoClimb(mover?.traits);
    const plan = planClimb(scene, from, to, hasGrimpeur, mode === 'battle' ? mover?.id : undefined, autoClimb);
    if (!plan) return; // arête non grimpable → refus silencieux (aucun marqueur ne s'y affiche)
    if (plan.kind === 'impossible') {
      get().log(t('climb.tooHard', { name: mover?.label ?? 'Le grimpeur' }));
      return;
    }
    if (mode === 'exploration') {
      if (!isWalkable(scene, to.x, to.y, to.z ?? 0)) return;
      get().moveParty(to); // monte (optimiste) ; l'échec du Test fera chuter au pied via l'Effet `fall`
      if (plan.kind === 'test') runFlow(get, set, plan.flow);
      return;
    }
    if (mode === 'battle') {
      if (!battle || battle.over || !mover || !controlsCombatant(get(), mover)) return;
      const metres = Math.abs(heightAt(scene, to.x, to.y, to.z ?? 0) - heightAt(scene, from.x, from.y, from.z ?? 0));
      // Grimpant `climbFullSpeed` (LDB 85 l.161) : coût NORMAL (1 case), pas la ½ vitesse du Talent
      // Grimpeur joueur (LDB 15 l.53, `climbMovementCost`) — chemin joueur strictement inchangé.
      const cost = hasClimbFullSpeed(mover.traits) ? 1 : climbMovementCost(metres, sceneMetresPerTile(scene));
      placeCombatant(mover, scene, to); // hisse (optimiste) ; échec du Test → `fall` au pied
      // `surface` = Test requis → consomme l'Action (LDB 13 l.86-88) ; `ladder`/`auto` = sans Test → Mouvement seul.
      const acted = plan.kind === 'test' ? true : battle.acted;
      // Résolution directe (Grimpant) : PAS un jet silencieux — il n'y a PAS de jet du tout, journalisé.
      const log = plan.kind === 'free' && plan.auto
        ? [...battle.log, ev('move', t('climb.auto', { name: mover.label }), mover.id)]
        : battle.log;
      set({ battle: { ...battle, log, acted, action: null, movementUsed: (battle.movementUsed ?? 0) + cost, movedPreAction: battle.movedPreAction || !battle.acted, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      if (plan.kind === 'test') runFlow(get, set, plan.flow);
    }
  },

  /** Chute VOLONTAIRE (LDB 15 l.82) : depuis `from` (case du sauteur) vers `to` (case cardinale plus
   *  basse, `planFall`) — geste JOUEUR seulement (IA hors périmètre : elle ne saute jamais). Ouvre le
   *  choix pré-jet `pendingFall` (Sauter / Tenter), résolu par `fallChoose`. */
  fallAcross: (from, to) => {
    const { scene, mode, battle } = get();
    if (!scene) return;
    const mover = mode === 'battle' ? (battle ? activeCombatantOf(battle) : undefined) : get().party.find((h) => !h.dead && h.wounds.current > 0);
    if (!mover) return;
    if (mode === 'battle' && (!battle || battle.over || !controlsCombatant(get(), mover))) return;
    const plan = planFall(scene, from, to);
    if (plan.kind !== 'fall') return; // pas une falaise DESCENDANTE → refus silencieux (aucun marqueur ne s'y affiche)
    set({
      pendingFall: { combatantId: mover.id, to, metres: plan.metres, attempt: null, result: null },
      ...(mode === 'battle' && battle ? { battle: { ...battle, action: null, preview: null } } : {}),
    });
  },
  fallChoose: (attempt) => {
    const p = get().pendingFall;
    if (!p || p.result) return;
    if (attempt) { set({ pendingFall: { ...p, attempt: true } }); return; }
    // Saut direct SANS Test (RAW « vous pouvez tenter » — le Test est un CHOIX) : chute PLEINE.
    settleFall(get, set, p, p.metres, false);
  },
  fallConfirm: () => {
    const p = get().pendingFall;
    if (!p || !p.result) return;
    settleFall(get, set, p, p.result.effectiveMetres, true); // Test tenté → consomme l'Action (LDB 13 l.86-88)
  },
  fallCancel: () => set({ pendingFall: null }),

  stepPartyDir: (dir) => {
    const { scene, mode, partyPos, dialogue, camRot, viewMode, camEdge, party } = get();
    if (!scene || mode !== 'exploration' || dialogue) return;
    const dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: camRot, view: viewMode, edge: camEdge };
    const dest = exploreStepDest(scene, partyPos, dir, dims);
    if (!dest) return;
    // Glisse d'1 case via l'anim de marche EXISTANTE (ANIM_MOVE → walkPosOf), puis `moveParty` (z-aware :
    // facing, triggers, déplacement-puis-fouille) — le leader VISIBLE est le même qu'IsoStage.
    const leader = party.find((h) => !h.dead && h.wounds.current > 0) ?? party[0];
    if (leader) bus.emit(EVT.ANIM_MOVE, { id: leader.id, path: [partyPos, dest] });
    get().moveParty(dest);
  },

  pivotParty: (turn) => {
    const lead = get().party[0]?.id;
    if (!lead) return;
    // Pivot du regard SEUL (aucun déplacement → pas de réorientation par `faceFromPath`). ±1 cran = 45°.
    get().setFacing(lead, rotateDir8(get().facing[lead] ?? 'S', turn));
  },

  stepPartyRelative: (rel) => {
    const s = get();
    if (s.mode !== 'exploration') return;
    const scene = s.scene;
    const lead = s.party[0]?.id;
    if (!scene || !lead) return;
    const cur = s.facing[lead] ?? 'S';
    // Cap MONDE du pas = regard tourné de 0/2/4/6 crans (2 crans = 90° par cadran relatif).
    const worldDir = rotateDir8(cur, { forward: 0, right: 2, back: 4, left: 6 }[rel]);
    const dest = povStepDest(scene, s.partyPos, worldDir);
    if (!dest) return;
    // Glisse d'1 case via l'anim de marche EXISTANTE (même forme d'émission que stepPartyDir).
    const leader = s.party.find((h) => !h.dead && h.wounds.current > 0) ?? s.party[0];
    if (leader) bus.emit(EVT.ANIM_MOVE, { id: leader.id, path: [s.partyPos, dest] });
    s.moveParty(dest);
    // Un pas ≠ avant ne doit pas tourner le regard : `moveParty`→`faceFromPath` l'a réorienté le long du
    // pas → on restaure le cap d'origine (l'avance, elle, aligne naturellement regard et déplacement).
    if (rel !== 'forward') get().setFacing(lead, cur);
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
      // Logique de fouille (Flow) : butin → fenêtre d'attribution, test → fouille à risque (modale).
      runFlow(get, set, ent.interact.flow, ent.label ?? 'Fouille');
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
    // Option payante (auberge, péage, pot-de-vin) : dépense de groupe (aucun bénéficiaire héros
    // unique) débitée AVANT les effets ; refus si le total du groupe ne couvre pas.
    if (choice.cost) {
      const cost = toMoney(choice.cost);
      if (!payFromGroup(get, set, cost, { purpose: 'Dialogue' })) { get().log('Pas assez d’argent pour cette option.'); return; }
    }
    const transition: DialogueTransition = choice.next
      ? { dialogue: st.dialogue.dialogue, nodeId: choice.next, speakerId: st.dialogue.speakerId }
      : 'close';
    // Logique du choix (effets + branches) → runFlow ; objet/argent reçu = fenêtre d'attribution (titrée du donateur).
    if (choice.flow) {
      const speaker = st.scene?.entities.find((e) => e.id === st.dialogue?.speakerId)?.label;
      const suspended = get().pendingTest;
      runFlow(get, set, choice.flow, speaker ?? 'Butin');
      // Le Flow a SUSPENDU sur un Test (`openSkillTest`) : l'avancée du dialogue est portée par le
      // pending et appliquée par `resolveTest` — sinon le nœud suivant coexiste sous la modale de jet.
      const pt = get().pendingTest;
      if (pt && pt !== suspended) { set({ pendingTest: { ...pt, dialogueNext: transition } }); return; }
    }
    applyDialogueTransition(get, set, transition);
  },

  closeDialogue: () => {
    if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
    set({ dialogue: null });
  },

  // ─── Marchand (#2) : délégué à merchantFlow ───
  openMerchant: (entityId) => merchantFlow.openMerchant(get, set, entityId),
  openPlaceMerchant: (entityId, archetype, backdrop) => merchantFlow.openPlaceMerchant(get, set, entityId, archetype, backdrop),
  closeMerchant: () => merchantFlow.closeMerchant(get, set),
  searchAvailability: () => merchantFlow.searchAvailability(get, set),
  buyItem: (label, heroId) => merchantFlow.buyItem(get, set, label, heroId),
  addToCart: (label) => merchantFlow.addToCart(get, set, label),
  decFromCart: (label) => merchantFlow.decFromCart(get, set, label),
  removeFromCart: (label) => merchantFlow.removeFromCart(get, set, label),
  clearCart: () => merchantFlow.clearCart(get, set),
  refuseBargain: (mode) => merchantFlow.refuseBargain(get, set, mode),
  payCart: () => merchantFlow.payCart(get, set),
  assignDistribution: (index, heroId) => merchantFlow.assignDistribution(get, set, index, heroId),
  confirmDistribution: () => merchantFlow.confirmDistribution(get, set),
  addToSellCart: (uid, heroId) => merchantFlow.addToSellCart(get, set, uid, heroId),
  removeFromSellCart: (uid) => merchantFlow.removeFromSellCart(get, set, uid),
  clearSellCart: () => merchantFlow.clearSellCart(get, set),
  confirmSell: () => merchantFlow.confirmSell(get, set),
  repairItem: (uid, heroId) => merchantFlow.repairItem(get, set, uid, heroId),
  startBargain: (mode) => merchantFlow.startBargain(get, set, mode),
  bargainConfirm: () => merchantFlow.bargainConfirm(get, set),
  bargainCancel: () => set({ pendingBargain: null }),

  appraiseItem: (uid, heroId, mode) => merchantFlow.appraiseItem(get, set, uid, heroId, mode),
  appraiseGear: (scope, index, mode) => merchantFlow.appraiseGear(get, set, scope, index, mode),
  resolveAppraise: () => merchantFlow.resolveAppraise(get, set),
  appraiseCancel: () => set({ pendingAppraise: null }),

  openTavernGames: () => tavernFlow.openTavernGames(get, set),
  playTavernGame: (opts) => tavernFlow.playTavernGame(get, set, opts),
  closeTavernGames: () => tavernFlow.closeTavernGames(get, set),
  barterExchange: (opts) => merchantFlow.barterExchange(get, set, opts),
  setSellHalving: (uid, delta) => merchantFlow.setSellHalving(get, set, uid, delta),

  seedRng: (seed) => {
    seedBattleRng(seed);
  },

  resolveCargoRaid: (outcome) => {
    if (!get().cargoRaid) return;
    const { patch, pct, losses } = applyLandCargoRaid(get(), outcome);
    const total = losses.reduce((n, l) => n + l.removed, 0);
    set({ ...patch, cargoRaid: false });
    if (total > 0) {
      // Consequence structurée (#295) — issue en donnée + total, jamais un jet silencieux.
      get().log(`Vol terrestre — ${outcome === 'fled' ? 'le convoi fuit' : 'le convoi est enfoncé'} : ${total} Enc de cargaison pillée (${pct} %${losses.length > 1 ? `, ${losses.length} porteurs` : ''}).`);
    } else if (outcome !== 'victory' && pct > 0) {
      get().log('Vol terrestre : les assaillants ne trouvent aucune cargaison à piller sur le convoi.');
    }
  },
  dismissVictory: () => {
    get().resolveCargoRaid('victory'); // combat gagné = le convoi est sauf (0 %), le flag s'éteint (#327 A5.1)
    const pv = get().pendingVictory;
    const leftoverGear = (pv?.gear ?? []).map((g) => g.effect); // équipement non attribué → 1er héros par défaut
    const cont = pv?.onContinue;
    // Scène de COMBAT d'une bataille de masse (ADE II 08) : la victoire tactique nourrit la réduction
    // de Puissance ennemie (l.139 : ennemis neutralisés), puis on reprend la vue de bataille.
    const kills = (pv?.defeated ?? []).reduce((n, d) => n + d.count, 0);
    const inMassBattleCombat = !!get().massBattle?.combatScene;
    set({ pendingVictory: null, battle: null, mode: 'exploration' });
    if (leftoverGear.length) applyEffects(get, set, leftoverGear);
    if (cont?.length) applyEffects(get, set, cont); // #9 : téléport/dialogue de onVictory APRÈS « Continuer »
    if (inMassBattleCombat) massBattleFlow.massBattleResumeCombat(get, set, kills);
    // Teardown de combat (couture UNIVERSELLE, state/cascade.ts) : résume la cascade SUSPENDUE (ex. le
    // reste d'une journée de voyage interrompue par un abordage) — APRÈS l'écran de victoire, jamais devant.
    resumeSuspendedCascade(get, set);
  },
  /** Ferme l'écran de DÉFAITE. Dans une Scène de COMBAT de bataille de masse (ADE II 08), la défaite
   *  tactique ne met PAS fin à la partie : les héros sont repoussés (soignés, le combat de scène est une
   *  abstraction), l'issue `combatLost` alimente le camp allié (Duel l.223 : −20 ; Percée l.175 : Charge),
   *  et la bataille CONTINUE. Hors bataille de masse : reprise standard (retour à la scène / redémarrage). */
  dismissDefeat: () => {
    get().resolveCargoRaid('defeat'); // combat perdu = le convoi est pillé (landRobberyLossPct, #327 A5.1)
    // Anéantissement HORS COMBAT (`checkPartyWiped`) : pas de bataille à reprendre — retour au menu.
    if (get().partyWiped) { set({ partyWiped: false, battle: null, screen: 'menu' }); return; }
    const inMassBattleCombat = !!get().massBattle?.combatScene;
    if (inMassBattleCombat) {
      // Repoussés, pas anéantis : on relève le groupe (le combat de scène ne tue pas définitivement).
      const heal = (c: import('../engine/types').Combatant): import('../engine/types').Combatant => ({
        ...c, wounds: { ...c.wounds, current: c.wounds.max }, conditions: [], criticalWounds: 0, dead: false, outOfRencontre: false,
      });
      set({ party: get().party.map(heal), battle: null, mode: 'exploration' });
      massBattleFlow.massBattleResumeCombat(get, set, 0, 'lost');
      resumeSuspendedCascade(get, set); // teardown de combat (couture universelle) — cf. dismissVictory
      return;
    }
    const cur = get().scene;
    if (cur) set({ mode: 'exploration', battle: null });
    resumeSuspendedCascade(get, set); // teardown de combat (couture universelle) — cf. dismissVictory
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
  harvestCreature: (creatureId) => harvestVictoryCreature(get, set, creatureId),
  raiseHand: () => {
    const b = get().battle;
    if (!b || b.handRaised) return;
    set({ battle: { ...b, handRaised: true, log: [...b.log, ev('info', 'Un joueur demande la pause au prochain Round.')] } });
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

  openMedic: (opts) => medicFlow.openMedic(get, set, opts),
  medicSelectPatient: (id) => medicFlow.medicSelectPatient(get, set, id),
  medicAct: (act) => medicFlow.medicAct(get, set, act),
  medicSetWound: (idx) => medicFlow.medicSetWound(get, set, idx),
  openSurgeryPass: () => medicFlow.openSurgeryPass(get, set),
  surgeryNext: () => medicFlow.surgeryNext(get, set),
  surgeryCancel: () => medicFlow.surgeryCancel(get, set),
  closeMedic: () => medicFlow.closeMedic(get, set),

  // ── Repos (modale de nuit) : cf. state/restFlow ──
  openRest: (opts) => restFlow.openRest(get, set, opts),
  restSet: (heroId, patch) => restFlow.restSet(get, set, heroId, patch),
  restReady: (seat) => restFlow.restReady(get, set, seat),
  restSleep: () => restFlow.restSleep(get, set),
  restCancel: () => restFlow.restCancel(get, set),

  // ── Conseil de bord (paie hebdomadaire + Moral) : cf. state/shipCrew ──
  councilPay: (decision) => councilPayFlow(get, set, decision),
  councilClose: () => councilCloseFlow(get, set),

  usePartyItem: (heroId, uid) => usePartyConsumable(get, set, heroId, uid),

  startExtendedTest: (opts) => {
    set({ pendingExtendedTest: { ...opts, total: 0, rounds: [{ id: 'round-1', interactive: true, result: null }] } });
    startCascade(get, set, { title: opts.label, icon: 'ui/key', purpose: 'test', steps: [{ id: 'ext-jet', kind: 'extendedJet', jet: 'extended', actorId: opts.actorId }] });
  },
  extendedTestNext: () => {
    const p = get().pendingExtendedTest;
    if (!p) return;
    const cur = p.rounds[p.rounds.length - 1];
    if (!cur?.result) return; // le Round courant doit avoir été lancé
    // Cumul LDB 12 mutualisé (`extendedTestStep`) : un Round réussi ajoute son DR, un raté le retire
    // (planché à 0) ; règle opt. l.208 « DR 0 = ±1 min » via `test-extended-min-sl`.
    const { total, done } = extendedTestStep(p.total, cur.result, p.targetDR, !!rule('test-extended-min-sl'));
    // BORNE d'essais (Commerce d'opportunité, MDG 15 l.274-286 : « ≤ 3 tentatives ») — cible non
    // atteinte à la DERNIÈRE tentative permise = une ISSUE (résolue par `outcome`), pas une boucle infinie.
    const exhausted = !done && p.maxAttempts != null && p.rounds.length >= p.maxAttempts;
    if (done || exhausted) {
      set({ pendingExtendedTest: null, pendingCascade: null }); // ferme la cascade-hôte aussi
      get().log(`${p.label} : ${done ? 'réussi' : 'échoué'} (DR cumulé ${total} / ${p.targetDR}).`);
      if (done && p.dispel) {
        // DISSIPATION réussie (LDB 46 l.160) : retire tous les effets du Sort de tous ses porteurs.
        const b = get().battle;
        const n = b ? dissipateSpell(b.combatants, p.dispel.spellId, p.dispel.casterId) : 0;
        if (b) set({ battle: { ...b, combatants: [...b.combatants] } });
        get().log(`${p.dispel.label} est dissipé${n > 1 ? ` (${n} cibles libérées)` : ''}.`);
      }
      if (done && p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // gate la suite (porte/serrure d'éditeur)
      // Issue de DOMAINE en donnée (kind-agnostique) : appliée qu'elle ait réussi ou buté sur `maxAttempts`.
      if (p.outcome) {
        const applier = extendedTestOutcomeAppliers[p.outcome.kind];
        const out = applier?.(get, set, p, total, done);
        const line = out?.consequences ? resultLine(out.consequences) : '';
        if (line) get().log(line);
      }
      return;
    }
    // Round suivant : la cascade-hôte (1 étape) reste, seul `pendingExtendedTest` gagne un Round (re-rendu).
    set({ pendingExtendedTest: { ...p, total, rounds: [...p.rounds, { id: `round-${p.rounds.length + 1}`, interactive: true, result: null }] } });
  },
  extendedTestCancel: () => { set({ pendingExtendedTest: null, pendingCascade: null }); },
  // Enfoncer une porte à plusieurs (EDO Appendice 2) : flux multi PARALLÈLE (objet BE/B).
  startForceDoor: (opts) => {
    set({ pendingForceDoor: { label: opts.label, doorBE: opts.doorBE, doorB: opts.doorB, doorBmax: opts.doorB, flag: opts.flag,
      participants: opts.heroIds.map((id) => ({ id, interactive: true, result: null })) } });
    // « Une situation = une modale » : l'enfoncement est hôté dans la cascade (rendu par CascadeModal
    // via l'étape `jet:'forceDoor'`). `pendingForceDoor` reste le porteur des données/participants ;
    // ses résolveurs ferment LES DEUX quand la porte cède. `groupOwner` → l'arbitre coop met l'owner à
    // '*' (action de GROUPE : chacun pilote ses héros), faute d'acteur unique sur l'étape.
    startCascade(get, set, { title: 'Enfoncer la porte', icon: 'action/force', purpose: 'combat', steps: [{ id: 'forceDoor', kind: 'forceDoorStep', jet: 'forceDoor', groupOwner: true }] });
  },
  forceDoorConfirm: () => {
    const p = get().pendingForceDoor;
    if (!p) return;
    // Dégâts du Round = somme des coups (chacun déjà réduit par le BE à la résolution). Objets : pas de min 1.
    const dmg = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
    const doorB = p.doorB - dmg;
    if (doorB <= 0) {
      set({ pendingForceDoor: null, pendingCascade: null }); // la porte cède → ferme la situation (data + cascade hôte)
      get().log(`${p.label} cède ! (${dmg} dégât${dmg > 1 ? 's' : ''})`);
      if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // ouverture en jeu (porte d'éditeur)
    } else {
      // La porte tient : un nouveau Round s'ouvre (chacun re-frappe — jets remis à zéro).
      set({ pendingForceDoor: { ...p, doorB, participants: p.participants.map((x) => ({ ...x, result: null, rerolled: false, forced: false })) } });
      get().log(`${p.label} : ${dmg} dégât${dmg > 1 ? 's' : ''}, reste ${doorB} Blessure${doorB > 1 ? 's' : ''}.`);
    }
  },
  forceDoorCancel: () => { set({ pendingForceDoor: null, pendingCascade: null }); }, // renonce : ferme data + cascade hôte

  // Résilience « Je ne faillirai pas ! » (LDB 17 l.73) sur un Test de scène (hors combat) — cycle
  // UNIFIÉ par la fabrique rollFlow (les variantes combat attack/defense/cast vivent dans combatSlice).

  /** Choix du lanceur (avant le jet) : re-cible le Test sur le candidat `id` du groupe. */
  testSetActor: (id) => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null) return; // seulement AVANT le jet
    const cand = pt.candidates?.find((c) => c.id === id);
    if (!cand) return;
    // La cascade-hôte porte l'`actorId` de l'étape (gating coop « chacun ses jets ») : re-cibler le
    // lanceur le met à jour aussi, pour que la modale reste chez le bon propriétaire.
    const pc = get().pendingCascade;
    set({
      pendingTest: { ...pt, actorId: cand.id, actorName: cand.label, skillValue: cand.value, target: cand.target, psychMod: cand.psychMod, psychDetail: cand.psychDetail, itemUid: cand.itemUid },
      ...(pc ? { pendingCascade: { ...pc, participants: pc.participants.map((st, k) => (k === pc.cursor ? { ...st, actorId: cand.id } : st)) } } : {}),
    });
  },
  // Test de scène (hors combat) : Lancer / Chance (relance / +1 DR) / Pacte — Résilience plus haut.
  // `cancel` : referme la cascade quand le test est annulable (action de combat, `pendingTest.cancellable`).
  testDetermination: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null || !pt.psychMod) return; // AVANT le jet, et seulement si un malus psy pèse
    const actor = get().party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.resolve ?? 0) <= 0) return;
    actor.resolve = (actor.resolve ?? 0) - 1;
    get().log(`${actor.label} puise dans sa Détermination : insensible à la Psychologie — malus social ignoré.`);
    // Le malus psy était intégré à skillValue/target (cf. PendingTest) : on le retranche des deux.
    set({
      pendingTest: { ...pt, skillValue: pt.skillValue - pt.psychMod, target: pt.target - pt.psychMod, psychMod: 0, psychDetail: undefined },
      party: [...get().party],
    });
  },

  /** Exposition à une Influence corruptrice (LDB 19) — flux différé, cf. spec `corruption`. */
  corruptionSetSkill: (skill) => {
    const pc = get().pendingCorruption;
    // Pré-jet uniquement, et JAMAIS si la compétence est déterminée en amont (source ou seuil).
    if (!pc || pc.roll != null || pc.skillLocked) return;
    set({ pendingCorruption: { ...pc, skill } });
  },
  /** Acquitte l'exposition (Points selon niveau + DR, puis seuil) OU le Test du SEUIL
   *  (kind 'seuil', LDB 19 l.80) : succès = Corruption contenue « pour cette fois » ;
   *  échec = « Je te renie ! » (Résilience) ou mutation (révélation). */
  resolveCorruption: () => {
    const pc = get().pendingCorruption;
    if (!pc || pc.roll == null) return;
    set({ pendingCorruption: null });
    const hero = actorIn(get(), pc.heroId);
    if (!hero) return;
    if (pc.kind === 'seuil') {
      // Le jet (roll/target) est DÉJÀ affiché par la rangée de la modale de Corruption — pas de
      // re-print au journal (#295 Lot 4).
      if (pc.success) {
        get().log(resultLine(freeCons([`${hero.label} contient sa Corruption — pour cette fois.`])));
      } else if ((hero.resilience ?? 0) > 0) {
        get().log(resultLine(freeCons([`${hero.label} échoue à contenir sa Corruption — la mutation menace…`])));
        set({ pendingRenounce: { heroId: hero.id, testRoll: pc.roll, testTarget: pc.target ?? 0, align: pc.align } });
      } else {
        for (const l of applyMutation(get, set, hero, { roll: pc.roll, target: pc.target ?? 0 }, pc.align)) get().log(l);
      }
      set({ ...touchActors(get()) });
      return;
    }
    const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
    if (gain <= 0) {
      // Le jet est DÉJÀ affiché par la rangée de la modale de Corruption — pas de re-print (#295 Lot 5).
      get().log(resultLine(freeCons([`${hero.label} repousse l'Influence corruptrice.`])));
      return;
    }
    const lines = gainCorruption(get, set, hero, gain, pc.align);
    for (const l of lines) get().log(l);
    set({ ...touchActors(get()) });
  },

  /** Acquitte un test de compétence : applique la branche réussite/échec. */
  resolveTest: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return; // pas d'acquittement avant le jet
    // Le Test EST une cascade-hôte à une étape (rendu par CascadeModal) : on ferme LES DEUX avant de
    // lancer la branche (qui peut ouvrir d'autres pendings — combat, autre Test…).
    set({ pendingTest: null, pendingCascade: null });
    get().log(describeTest(pt)); // issue du jet journalisée (source UNIQUE avec la popin), puis la conséquence
    const actor = get().party.find((c) => c.id === pt.actorId);
    const tool = pt.itemUid ? actor?.items?.find((i) => i.uid === pt.itemUid) : undefined;
    // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.22/58). Ne repêche qu'un échec qui a
    // réussi le d100 mais manqué le seuil requireSL (jamais un roll > cible → on ne crée pas de réussite).
    const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
    const effSuccess = drDelta !== 0 ? pt.roll <= pt.target && pt.sl + drDelta >= pt.requireSL : pt.success;
    // SEAM d'observation pure (recette navigateur, #514) — jamais lu par du code de règles.
    bus.emit(EVT.TEST_RESOLVED, { actorId: pt.actorId, success: effSuccess, sl: pt.sl, roll: pt.roll, target: pt.target });
    // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
    if (tool && pt.isDouble && !pt.success && hasQuality(tool, QUALITY_IDS.Bacle) && !isUnbreakable(tool)) {
      tool.destroyed = true;
      set({ party: [...get().party] }); // persiste la casse + re-render
      get().log(`${tool.label} (Bâclé) se brise sur la Maladresse de ${actor?.label ?? pt.actorName}.`);
    }
    // Action de combat « cumuler l'Avantage » (LDB 09 l.305-308) : sur réussite, +1 Avantage plafonné au
    // `cap` de la Compétence (via `gainAdvantage`, qui respecte aussi le plafond général) ; l'Action est
    // consommée qu'on réussisse ou non (on a « passé son tour » à s'observer/prier — LDB 09 l.308/419).
    const ca = pt.combatAdvantage;
    const battle = ca ? get().battle : null;
    if (ca && battle) {
      const c = inBattleId(battle, ca.combatantId);
      if (c && effSuccess && (c.advantage ?? 0) < ca.cap) campGain(get, c, 1);
      set({ battle: { ...battle, acted: true, action: null } });
    }
    // Branche choisie PUIS continuation (suite du `seq` parent d'un nœud `test`) — exécutées par runFlow
    // (butin de Test → fenêtre d'attribution ; if/test imbriqués gérés).
    const branch = effSuccess ? pt.onSuccess : pt.onFailure;
    runFlow(get, set, { kind: 'seq', steps: [branch ?? EMPTY_FLOW, pt.after ?? EMPTY_FLOW] }, pt.label, pt.sl);
    // SEAM `onOwnTestFailed` (chemin modal JOUEUR — convergence des Tests de scène/compétence/combat, réf
    // memory « JAMAIS rollTest inline chemin joueur ») : un Test RATÉ émet le trigger (Crampes abdominales
    // → Sonné/À Terre/Inconscient par paliers de DR, MSRC 16 l.152). Réussite forcée (Résilience) exclue.
    // RÉ-ENTRANCE : ce Test EST le sous-Test d'un `onOwnTestFailed` (FM de palier 2) → il ne RÉ-ÉMET PAS.
    // CADENCE-AWARE : sans modale déjà ouverte, on threade `set` → le FM de palier 2 d'un HÉROS devient une
    // étape de cascade (combat) OU une modale de jet scène (interlude, `routeTriggeredTest`) ; PNJ → inline.
    if (!effSuccess && !pt.noOwnTestFailed) {
      const cascadeSet = !get().pendingCascade && !get().pendingTest ? set : undefined;
      const fired = fireOwnTestFailed(get, pt.actorId, { sl: pt.sl, rng: battleRng(), set: cascadeSet });
      if (fired.length) fired.forEach((l) => get().log(l));
      set({ ...touchActors(get()) });
    }
    // Avancée de dialogue différée (un `choice.flow` avait suspendu ICI) : appliquée une fois la
    // branche + continuation résolue. Si celles-ci ré-ouvrent un Test, on la reporte sur le nouveau
    // pending (le dialogue n'avance jamais sous une modale de jet).
    if (pt.dialogueNext) {
      const nextPt = get().pendingTest;
      if (nextPt) set({ pendingTest: { ...nextPt, dialogueNext: pt.dialogueNext } });
      else applyDialogueTransition(get, set, pt.dialogueNext);
    }
  },
  closeDocument: () => set({ document: null }),

  log: (msg) => set((s) => ({ journal: [...s.journal.slice(-40), ...(Array.isArray(msg) ? msg : [msg])] })),

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
        if (log.length) { set({ party: [...party] }); get().log(log); }
      }
    }
    // Entretien quotidien (#T2/#T3 — rations/faim, maladies, convalescence) + purge des effets à
    // durée d'horloge (contrecoups LDB 46/40) : traite les éventuels franchissements de jour.
    // VISIBLE (le journal seul ne suffit pas). HORS COMBAT, tout Test de Résistance d'entretien est
    // DIFFÉRÉ dans la MÊME cascade influençable que le repos (LDB 17 : Chance sur tout Test raté ; « aucun
    // jet silencieux ») via `deferredUpkeepSteps` ; les lignes SANS jet (rations, dissipations…) restent
    // le témoin groupé. En combat, le slot de cascade appartient à l'arène → jets roulés (témoin pré-résolu).
    if (get().battle) {
      // EN COMBAT (#253) : le slot de cascade appartient à l'arène → les Tests de Résistance d'entretien ne
      // s'ouvrent pas ici. On les DIFFÈRE dans `pendingUpkeepSteps` (consommé par `openCombatEndCascade` à la
      // fin du combat) au lieu de les rouler en SILENCE ; les lignes SANS jet (rations, dissipations) restent
      // le témoin. `lastUpkeepDay` (posé par `runDailyUpkeep`) garde l'anti-double-résolution.
      const deferred: DeferredUpkeepTest[] = [];
      const upkeepLines = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
      if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' });
      const steps = restFlow.deferredUpkeepSteps(get().party, deferred);
      if (steps.length) set({ deferredUpkeepQueue: [...get().deferredUpkeepQueue, ...steps] });
    } else {
      const deferred: DeferredUpkeepTest[] = [];
      const upkeepLines = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
      const steps = restFlow.deferredUpkeepSteps(get().party, deferred);
      if (steps.length) startCascade(get, set, { title: 'Entretien quotidien', icon: 'time/night', purpose: 'upkeep', steps, log: upkeepLines });
      else if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' });
    }
    checkPartyWiped(get, set); // faim/agonie/maladie a-t-elle anéanti tout le groupe hors combat ? → défaite (recheck à la clôture de cascade)
  },
  // « Dormir » : sommeil de `days` journée(s) (défaut 1) — récup. (Exténué/Blessures) + cauchemars (LDB 16/18/21).
  restParty: (days = 1) => { restFlow.sleepParty(get, set, days); },

  // ── Voyage & nourriture (#T2) ──
  openWorldMap: () => { if (!get().battle && get().worldMap) set({ worldMapOpen: true }); },
  closeWorldMap: () => set({ worldMapOpen: false }),
  setGameMenu: (open) => set({ gameMenuOpen: open }),
  startTravel: (routeId, mode, opts) => travelFlow.startTravel(get, set, routeId, mode, opts),
  resumeTravel: () => travelFlow.resumeTravel(get, set),
  departWaitDawn: () => travelFlow.departWaitDawn(get, set),
  departCancel: () => set({ pendingDeparture: null }),
  setVoyageCadence: (cadence) => { const p = get().travelPlan; if (p) set({ travelPlan: { ...p, orders: { ...(p.orders ?? { cadence: 'jour-par-jour' }), cadence } } }); },
  openPort: () => portFlow.openPort(get, set),
  closePort: () => portFlow.closePort(get, set),
  portBuyCargo: (cargoId, enc) => portFlow.portBuyCargo(get, set, cargoId, enc),
  portSellCargo: (cargoIndex) => portFlow.portSellCargo(get, set, cargoIndex),
  portDumpCargo: (cargoIndex) => portFlow.portDumpCargo(get, set, cargoIndex),
  portRepair: () => portFlow.portRepairVessel(get, set).forEach((l) => get().log(l)),
  portCareen: () => portFlow.portCareenVessel(get, set).forEach((l) => get().log(l)),
  portInstallUpgrade: (traitId, units) => portFlow.portInstallUpgrade(get, set, traitId, units).forEach((l) => get().log(l)),
  portHireCrew: (roleId, count) => portFlow.portHireCrew(get, set, roleId, count),
  portDismissCrew: (roleId, count) => portFlow.portDismissCrew(get, set, roleId, count),
  openLandMarket: () => landMarketFlow.openLandMarket(get, set),
  closeLandMarket: () => landMarketFlow.closeLandMarket(get, set),
  landBuyCargo: (cargoId, enc) => landMarketFlow.landBuyCargo(get, set, cargoId, enc),
  landSellCargo: (carrierId, cargoIndex) => landMarketFlow.landSellCargo(get, set, carrierId, cargoIndex),
  landDumpCargo: (carrierId, cargoIndex) => landMarketFlow.landDumpCargo(get, set, carrierId, cargoIndex),
  moveCargo: (fromId, toId, cargoId, enc) => landMarketFlow.moveCargo(get, set, fromId, toId, cargoId, enc),
  gatherInnInfo: () => innFlow.gatherInnInfo(get, set),
  landEvalWine: (cargoId) => landMarketFlow.landEvalWine(get, set, cargoId),
  seaActivitiesConfirm: (picks) => seaActivities.seaActivitiesConfirm(get, set, picks),
  resolveManannPriest: (pay) => seaVoyageFlow.resolveManannPriest(get, set, pay),
  resolveShoreLeave: (allow) => seaVoyageFlow.resolveShoreLeave(get, set, allow),
  setTravelRole: (heroId, role) => set({
    party: get().party.map((h) => h.id === heroId ? { ...h, ...(role ? { travelRole: role } : { travelRole: undefined }) } : h),
  }),
  setShipRole: (crewId, role) => {
    const b = get().battle;
    const patch = (c: Combatant) => c.id === crewId ? { ...c, ...(role ? { shipRole: role } : { shipRole: undefined }) } : c;
    set({
      party: get().party.map(patch),
      ...(b ? { battle: { ...b, combatants: b.combatants.map(patch) } } : {}),
    });
  },
  setPosteAmmo: (shipId, posteUid, ammoUid) => {
    const b = get().battle;
    const ship = inBattleId(b, shipId);
    const poste = ship?.postes?.find((p) => p.item.uid === posteUid);
    if (!b || !poste) return;
    // Le poste est PARTAGÉ par référence avec `mannedPoste` du chef (serveChef) → muter la même instance
    // suffit ; le `set` re-render (pattern combat : mutation + refresh).
    poste.ammoUid = ammoUid ?? undefined;
    set({ battle: { ...b } });
  },
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
      // Vol terrestre (#327 A5.1) : cette embuscade terrestre met la cargaison du convoi en jeu — la
      // perte GRADUÉE se dénoue au teardown de combat. Posé APRÈS startCombat (le reset `combatStart`
      // n'efface donc pas le marqueur).
      if (get().battle) set({ cargoRaid: true });
    }
  },
}));
