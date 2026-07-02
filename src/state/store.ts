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
import { facingToward, DIR8_DELTA } from '../gameIso/rig/facing';
import { rotateDir8, type Dir8 } from './dir8';
import { footprintTiles, footprintN } from './footprint';
import type { CombatCursor, ScreenDir } from './combatCursor';
import { applyShipCollision } from './shipCollision';
import type { ConjureForm } from '../engine/conjuredWeapons';
import type { OvercastAxis } from '../engine/overcast';
import { findFreeTile, removeEntity, checkTriggers, fireScheduledEffects, applyEffects, applyEffectsLoot, runFlow, assignGearAt, harvestVictoryCreature, pushReveal } from './combatFlow';
export { activeCombatant, entityPickables, trampleTarget } from './combatFlow';
import { EMPTY_FLOW, type Flow } from './flow';
export { movementRemaining, canMove } from './mount';

import { type BattleZone } from './zones';
import * as interludeFlow from './interludeFlow';
import * as netFlow from './netFlow';
import type { NetState } from './netFlow';
import type { InterludeState, BankDeposit, PendingActivity } from './interludeFlow';
export type { PendingActivity } from './interludeFlow';
import { snapshotSave, saveToSlot, readSlot, importSave, AUTO_SLOT, type SaveSlot, type AnySlot, type SaveGame } from './saves';
import { loadKeyOverrides, saveKeyOverrides } from './keybindingsPrefs';
import { initialFields, resetFields } from './stateFields';

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
import { CAMPAIGN_START } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { outOfCombatUpkeep } from './outOfCombatUpkeep';
import { actorIn, touchActors } from './combatOrParty';
import { FLOWS, rollFlowActions, rollFlowActionsMulti, type RollFlowActionsMap } from './rollFlows';
import { gainCorruption, applyMutation } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import * as partyFlow from './partyFlow';
import * as visionStateMod from './visionState';
import * as merchantFlow from './merchantFlow';
import type { MerchantState, MerchantStocks } from './merchantFlow';
import type {
  Money, PendingVictory, PendingLoot, PendingTest, PendingReload, PendingStateRecovery, PendingBargain,
  PendingAppraise, PendingAttack, PendingSiegeAim, PendingCleave, PendingDualStrike, PendingTrample, PendingManeuver, PendingRun, PendingShipManeuver, PendingShipBattery, PendingApproach, PendingWard, PendingFocus, PendingDispel,
  PendingFrenzy, RevealEntry, PendingRenounce, PendingDefense,
  PendingDisengage, PendingAuContact, PendingGrapple, PendingCast, PendingCounterspell, PendingExtendedTest, PendingForceDoor, PendingHeal, PendingSurgery, PendingCorruption,
  PendingCastOpposition, PendingCascade, ScheduledEffect,
} from './pendings';
import { openEncounterPsych } from './encounterPsychFlow';
import { subtract as moneySub, canAfford, toMoney } from '../engine/money';
import * as medicFlow from './medicFlow';
import type { MedicState, MedicNpc } from './medicFlow';
export type { MedicState, MedicNpc } from './medicFlow';
import * as restFlow from './restFlow';
import type { PendingRest, RestPlaces, RestLodging, RestFood } from './restFlow';
export type { PendingRest, NightEntry, RestPlaces } from './restFlow';
import { Scene, Dialogue, Effect, isWalkable } from './scene';
import { placeCombatant } from './spawn';
import { chebyshev, Pt } from './path';
import { exploreStepDest, povStepDest, spawnFacing } from './exploreNav';
import { bus, EVT } from './bus';
import { campaign, campaignWorldMap } from '../scenes/campaign';
import { dayIndex, runDailyUpkeep } from './upkeep';
import * as travelFlow from './travelFlow';
import { startCascade } from './cascade';
import { describeTest } from './flowOutcomes';
import { createCombatSlice } from './combatSlice';

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
  /** Marins ayant déjà contribué à un Test d'équipage CE ROUND, par navire (`shipId → crewId[]`). Réinitialisé au début de
   *  chaque Round (`enterRoundStartPause`) ; un marin déjà listé qui contribue à un 2e Test (manœuvre + bordée) → cumul à
   *  +2 crans de Difficulté (Manque de bras, MDG ch.14 l.53). */
  crewActed?: Record<string, string[]>;
  /** Mode d'action À BOUTON en cours (panneau ouvert). Le déplacement et l'attaque n'ont PAS de mode :
   *  ils sont implicites au clic (sol/ennemi) quand `action === null` — cf. battleClickTile/Entity.
   *  'cast' = ciblage d'un sort · 'teleport' = case d'arrivée d'une Téléportation · 'resolve'/'ammo'/'heal'
   *  = panneaux (Détermination / munition / soin). La Focalisation / l'usage d'objet / le ramassage NE sont
   *  PAS des modes : ils passent par `battleFocusSpell`→`pendingFocus`, `battleUseItem`, `battlePickup`. */
  action: 'cast' | 'resolve' | 'ammo' | 'heal' | 'teleport' | 'dispel' | 'battery' | null;
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
  /** Le set d'armes a-t-il déjà été changé ce Tour ? (1 switch gratuit/tour — LDB 13 l.116). Reset au tour. */
  loadoutSwapped?: boolean;
  log: CombatEvent[];
  over: null | 'victory' | 'defeat';
  onVictory?: Flow;
  /** Zones persistantes (L11 — généralise l'ancienne fumée) : fumée du Souffle (blocksLoS),
   *  Mur de feu (onCross), Grands feux d'U'Zhul (perRound)… TTL décrémenté à chaque frontière
   *  de Round (state/zones.ts). */
  zones?: BattleZone[];
  /** « Avantages et Magie » (LDB 46 l.176) : cibles déjà visées par un Sort d'un Domaine CE Round —
   *  re-viser la même cible avec le même Vent donne +1 Avantage au lanceur. Purgé chaque Round. */
  domainCasts?: { targetId: string; domain: string }[];
  /** Mort par Hémorragique (LDB 16 l.105) — combattants pour qui le jet de fin de Round (10 %/pion) a
   *  donné la MORT ce Round : marqués par le hook `bleed-death` (jet RNG, une fois), FINALISÉS par
   *  `resolveRoundBoundary` (qui peut SUSPENDRE pour un héros à Destin). `deathLine` = la ligne de
   *  journal pré-formée, annoncée APRÈS la décision de Destin. Purgé une fois tous finalisés. */
  bleedDoomed?: { id: string; deathLine: string }[];
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

export interface GameState extends RollFlowActionsMap {
  screen: Screen;
  /** Codex : entrée ciblée à l'ouverture (depuis un `CodexRef`), null = page d'accueil du Codex.
   *  `instance` = libellé paramétré porté par le lien (« 8 Tentacules +8 ») affiché en tête de fiche. */
  compendiumFocus: { category: string; label: string; instance?: string } | null;
  /** Écran à restaurer en quittant le Codex plein écran (capturé depuis le menu). */
  compendiumReturn: Screen;
  /** Drill-in d'une réf Codex EN JEU : fiche ouverte en MODALE par-dessus la partie (sans changer
   *  d'écran → musique et fiche perso intactes derrière). null = pas de modale. */
  codexOverlay: { category: string; label: string; instance?: string } | null;
  /** Ouvre le Codex sur une entrée. Depuis le jeu (focus fourni) → modale ; depuis le menu (sans
   *  focus) → écran plein ; déjà ouvert → on s'y déplace en place. */
  openCodex: (focus?: { category: string; label: string; instance?: string }) => void;
  /** Ferme la modale Codex (drill-in). */
  closeCodexOverlay: () => void;
  party: Combatant[];
  scene: Scene | null;
  mode: 'exploration' | 'battle';
  camRot: 0 | 1 | 2 | 3; // orientation caméra (cran de 90° horaire) — état de vue, non sérialisé
  camEdge: boolean; // cran impair : vue « de face » (edge-on, grille axis-alignée 3D) ; alterne avec le coin (losange) par ¼ de tour
  rotateCam: (dir: 1 | -1) => void;
  /** Orientation MONDE vivante par entité/combattant (Dir8) — projetée au rendu (camRot). */
  facing: Record<string, Dir8>;
  setFacing: (id: string, dir: Dir8) => void;
  faceToward: (id: string, from?: Pt, to?: Pt) => void;
  faceFromPath: (id: string, path?: Pt[] | null) => void;
  faceAtCombatStart: () => void;
  /** Manœuvre NAVALE (MDG ch.13) : vire le cap (`Dir8`) du navire `shipId` de `turnSteps` crans de 45°
   *  (>0 = tribord/droite, <0 = bâbord/gauche) → re-mappe d'un coup TOUS ses arcs de bordée. */
  shipTurn: (shipId: string, turnSteps: number) => void;
  /** Avance la coque `shipId` ET son équipage (à bord, formation rigide) de `cases` tuiles le long du cap
   *  courant `facing[shipId]` (MDG ch.13). Clampe aux bornes de scène. Renvoie les cases réellement parcourues. */
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
  /** Brouillard de guerre : cases déjà explorées par scène (`sceneId` → clés "x,y,z"). PERSISTE entre
   *  transitions (hors manifeste de reset `stateFields`) ; vidé en nouvelle partie (`startScene`). */
  explored: Record<string, string[]>;
  /** Fond les cases visibles courantes dans l'ensemble exploré de la scène (appelé par le rendu). */
  markExplored: (keys: string[]) => void;
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
  /** Pilonnage INDIRECT en cours (« viser une case », AA p.122-123) : pièce indirecte servie en attente du
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
  /** Manœuvre de créature en cours (Souffle/Vomi/Langue/Regard/Étreinte — modale de jet d'attaquant). */
  pendingManeuver: PendingManeuver | null;
  /** Course en cours (modale Test d'Athlétisme → déplacement étendu). */
  pendingRun: PendingRun | null;
  /** Manœuvre navale en cours (MDG ch.13 : Test de Navigation du barreur → vire le cap + avance). */
  pendingShipManeuver: PendingShipManeuver | null;
  /** Tir de batterie en cours (MDG ch.14 : Test d'équipage des Artilleurs → volée sur la cible). */
  pendingShipBattery: PendingShipBattery | null;
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
  /** Coop : marque le siège PRÊT au ready-check d'ouverture (round 1) ; l'hôte lance quand tous ✓. */
  roundStartReady: (seat: number) => void;
  /** Sauvetage par le Destin en attente (LDB ch.17 l.31-35). */
  pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number } | null;
  /** Récompenses de victoire capturées (écran de fin de combat) ; null hors victoire. */
  pendingVictory: PendingVictory | null;
  /** Attribue un objet d'équipement (giveTrapping) du butin de victoire au héros choisi. */
  assignVictoryGear: (index: number, heroId: string) => void;
  /** Récolte « Précieuses Entrailles » (ZI) une créature vaincue, par id (Test de Savoir → pièces valuées). */
  harvestCreature: (creatureId: string) => void;
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
  /** Héros en cours de MODIFICATION dans le créateur (bouton « Modifier » d'un emplacement) :
   *  l'id du Combatant à mettre à jour EN PLACE ; null = création normale d'un nouveau héros. */
  editingHeroId: string | null;
  setEditingHero: (id: string | null) => void;
  /** Interlude « Entre deux aventures » (LDB 22-23, Jalon 5) — état + dépôts bancaires + commandes. */
  interlude: InterludeState | null;
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trappingId: string }[];
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
  /** Activités (LDB 23) : Revenus, Artisanat (engager l'ouvrage puis lancer), banque. */
  interludeRevenus: (heroId: string) => void;
  interludeCraftStart: (heroId: string, trappingId: string, atouts: string[], defauts: string[]) => void;
  interludeCraftRoll: (heroId: string) => void;
  interludeBank: (heroId: string, kind: 'invest' | 'stash', amountBrass: number, rate?: number) => void;
  interludeWithdraw: (index: number) => void;
  /** Apprentissage particulier (Talent hors carrière, Test −20) — `talent` = `id` STABLE ;
   *  Passer commande (Exotique). */
  interludeLearn: (heroId: string, talentId: string) => void;
  interludeOrder: (heroId: string, trappingId: string) => void;
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
  /** Achète une Augmentation de Compétence (identité name+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  buySkillAdvance: (heroId: string, skillName: string, spec?: string) => void;
  /** Achète/augmente un Talent (libellé concret ; refusé hors carrière l.97 / Maxi atteint). */
  buyTalent: (heroId: string, talentName: string) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designateCareerSlot: (heroId: string, slotKey: string, label: string) => void;
  /** Apprentissage/mémorisation d'un sort (LDB 46/10) — coût PX via engine/grimoire. */
  buySpell: (heroId: string, spellId: string) => void;
  /** Achète un composant d'incantation pour un Sort d'Arcane/Domaine connu (LDB 46 l.163 — NI pistoles). */
  buySpellComponent: (heroId: string, spellId: string) => void;
  /** Retire un composant d'incantation possédé pour un Sort (sans remboursement). */
  removeSpellComponent: (heroId: string, spellId: string) => void;
  /** Édite la bio mutable d'un héros hors combat (Motivation + Ambitions court/long, LDB 05) — persisté en save + roster. */
  setHeroBackground: (heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }) => void;
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
  // bargain{Roll,Reroll,BonusSL,DarkPact} : générés (RollFlowActionsMap).
  bargainConfirm: () => void;
  bargainCancel: () => void;
  /** Évaluation (LDB 60 l.10) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
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
  battleSelectAction: (a: 'cast' | 'resolve' | 'ammo' | 'heal' | 'dispel' | 'battery' | null) => void;
  /** Guérison (LDB 09-Compétences) — ouvre la modale de soin EN COMBAT (soi/allié adjacent). */
  battleHeal: (targetId: string, mode: HealMode) => void;
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
  restContinue: () => void;
  // heal{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  healConfirm: () => void;
  healCancel: () => void;
  /** Recharger l'arme à distance (LDB 63-Armures l.28-29) : OUVRE la modale de Test étendu de Projectiles. */
  battleReload: () => void;
  // reload{Roll,Reroll,BonusSL,DarkPact} (Lancer/Chance/+1 DR/Pacte) : générés (RollFlowActionsMap).
  /** « Appliquer » : cumule le DR (Test étendu), recharge si ≥ Indice, consomme l'Action. */
  reloadConfirm: () => void;
  /** Ferme la modale de rechargement sans coût (avant le jet). */
  reloadCancel: () => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.61/77). */
  battleRecoverState: (state: 'empetre' | 'en-flammes') => void;
  // recover{Roll,Reroll,BonusSL,DarkPact} (Lancer/Chance/+1 DR/Pacte) : générés (RollFlowActionsMap).
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
  /** Surincantation : alloue (`delta` +1) ou rend (`delta` −1, reset) un pas de +2 DR à un axe
   *  (Portée / Zone d'Effet / Durée / Cible) ; l'effet d'un pas est source-aware (`engine/overcast.ts`). */
  castAllocOvercast: (axis: OvercastAxis, delta: number) => void;
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
  startExtendedTest: (opts: { actorId: string; label: string; skillLabel: string; target: number; targetDR: number; flag?: string; support?: { count: number; bonus: number }; dispel?: { spellId: string; casterId: string; label: string } }) => void;
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
   *  Résilience (ciblé par `pid` = id d'étape).
   *  Délégués `cascade{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll}` : générés (RollFlowActionsMap, MULTI). */
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
  /** Détermination (LDB 17 l.62) : immunité Psychologie sur l'étape `pid` (dépense 1 Détermination). */
  cascadeDetermine: (pid: string) => void;
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
  /** « Retenir ses coups » (Aux Armes l.2503-2505) : bascule le coup non létal de mêlée (avant le jet). */
  attackSetWithhold: (v: boolean) => void;
  /** « Empoignade » (LDB 14 l.159) : bascule l'initiation d'Empoignade à mains nues (avant le jet). */
  attackSetGrapple: (v: boolean) => void;
  /** « Je ne faillirai pas ! » (RAW-2, LDB 17 l.73) : choisit la Localisation d'un Coup Critique forcé. */
  attackSetCritLocation: (loc: HitLocation) => void;
  attackRoll: () => void;
  // attack{Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  // `attackSetForcedRoll(roll)` (LDB 17 l.73 « vous choisissez le résultat ») : valeur du dé d'un succès
  //  forcé (un double ≤ cible → Coup Critique, ex. Salundra l.75) ; re-dérive l'attaque, refusé si raté.
  attackConfirm: () => void;
  attackCancel: () => void;
  /** Pilonnage INDIRECT : dépose le point d'impact choisi (clic-case du placeur 'siege') et ouvre la modale
   *  de tir de la pièce indirecte servie (`pendingAttack` siège). Cf. `siegeAimCommit` (combatSlice). */
  siegeAimCommit: (pt: Pt) => void;
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
  /** Arme une ATTAQUE (id d'`AttackOption` : 'arme'/'morsure'/'tentacule'/'pietinement'…) pour le clic-ennemi
   *  — source UNIQUE qui remplace l'arme implicite + l'ancien mode manœuvre/tentacule/trample. Toggle → 'arme'.
   *  Le clic-ennemi résout l'attaque armée via l'approche-puis-frappe (battleClickEntity). */
  battleSelectAttack: (id: string) => void;
  /** Manœuvre de ZONE / soi immédiate (Souffle/Vomi/Langue/Hurlement/Regard/Étreinte) : résolution
   *  directe par le résolveur moteur partagé. L'Étreinte glaciale coûte l'Action (LDB 85 l.112). */
  battleManeuverArea: (kind: AttackKind) => void;
  /** Acquitte la révélation en tête de file (montre le dé du jet subi/sur table) ; reprend l'IA si vide. */
  dismissReveal: () => void;
  /** Piétinement par modale (LDB 85 l.320-321) : Lancer le jet, dépenser une Chance, appliquer (gratuit). */
  // trample{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  trampleConfirm: () => void;
  trampleCancel: () => void;
  /** Manœuvre de créature par modale (LDB 85) : Lancer le jet d'ATTAQUANT (CC/CT), Chance/Pacte/
   *  Résilience l'influencent, Appliquer roule les défenseurs et résout l'opposition au feed. */
  // maneuver{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  maneuverConfirm: () => void;
  maneuverCancel: () => void;
  /** Avantage dépensé par le Regard pétrifiant (variable, LDB 85 l.238) : 1..advantage → +N DR. */
  maneuverSetAvantage: (n: number) => void;
  /** Course (LDB 15 l.79-82) : ouvrir la modale, lancer le Test d'Athlétisme, Chance/Résilience, appliquer (déplacement étendu). */
  battleRun: (dest?: Pt) => void;
  /** Manœuvre navale (MDG ch.13) : ouvre la modale du Test de Navigation pour le navire que sert `crewId`. */
  battleShipManeuver: (crewId: string) => void;
  /** Choix du virage (pré-jet OptionChooser) : crans d'octant (±1 = 45°, ±2 = 90°, 0 = tout droit). */
  shipManeuverSetTurn: (steps: number) => void;
  shipManeuverConfirm: () => void;
  shipManeuverCancel: () => void;
  /** Recharge d'un poste (MDG ch.12 l.462) : ouvre la modale du Test étendu de Projectiles du chef de pièce + Soutien. */
  battleShipReload: (shipId: string, posteUid: string) => void;
  /** Bordée (« Tir de batterie », MDG ch.14 l.128) : ouvre la modale du Test d'équipage des Artilleurs sur `targetId`. */
  battleShipBattery: (shipId: string, targetId: string) => void;
  shipBatteryConfirm: () => void;
  shipBatteryCancel: () => void;
  // shipBattery{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap, MULTI).
  // run{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  runConfirm: () => void;
  runCancel: () => void;
  /** Approche d'une source de Peur (LDB 21 l.29) : Test de Calme (+0) ; succès → l'intention différée est relancée. */
  // approach{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  approachConfirm: () => void;
  approachCancel: () => void;
  /** Bénédiction de Protection (LDB 41 l.105) : Test de FM Accessible (+20) ; succès → l'attaque est relancée. */
  // ward{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  wardConfirm: () => void;
  wardCancel: () => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.28). */
  battleStandUp: () => void;
  /** « Servir cette pièce » (MDG ch.12) : le héros actif devient chef d'un poste de siège NON servi adjacent (arme octroyée) — coûte l'Action. KIND-AGNOSTIQUE. */
  battleManPoste: (target?: { hullId: string; posteUid: string }) => void;
  /** « Quitter la pièce » (release) : libère le poste servi pour un autre — coûte l'Action. */
  battleLeavePoste: () => void;
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
  // (Psychologie de combat (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round — Traits/Terreur au
  //  DÉBUT (openRoundStartPsych), Peur à la FIN (openRoundEndPsych) — résolue par les handlers `cascade*`,
  //  applier 'combatPsych'.)
  /** Entrée en Frénésie d'un héros (LDB 21 l.32) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  battleFrenzy: () => void;
  // frenzy{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
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
  // defense{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  defenseConfirm: () => void;
  defenseCancel: () => void;
  /** « Je te renie ! » (LDB 17 l.71) : résout le choix (true = refuser la mutation, 1 Résilience). */
  renounceResolve: (renounce: boolean) => void;
  /** Peek du planificateur IA (déterministe, sans RNG ni mutation) : la meilleure action du combattant `id`
   *  est-elle de PRÉPARER un sort (cast/castArea/focus) ? Lu par le hook de Frénésie pour différer l'entrée
   *  en Frénésie tant qu'un sort prime (RAW : entrée = choix, psychologie.md l.170). */
  aiWouldCast: (id: string) => boolean;
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
  // disengage{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  // Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) + « vous choisissez le résultat » (dé forcé) :
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
  startTravel: (routeId: string, mode: import('../engine/travel').TravelMode, opts?: { classKey?: string; hoursPerDay?: number; allure?: import('../engine/mountTravel').Allure }) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  resumeTravel: () => void;
  /** Épingle le RÔLE de marche PERSISTANT d'un héros (`travelRole`, id d'Activité de voyage EDOC ch.5),
   *  ou le détache (`null` ⇒ rôle inféré). Réutilisé au départ de chaque trajet (0 ré-assignation/jour). */
  setTravelRole: (heroId: string, role: string | null) => void;
  /** Épingle (`role`) ou détache (`null`) le rôle d'ÉQUIPAGE naval d'un marin (`shipRole`) — interface de gestion
   *  du navire. Patche `party` ET `battle.combatants` (l'équipage vit dans la bataille en mer). */
  setShipRole: (crewId: string, role: string | null) => void;
  /** Dernier jour (index d'horloge) traité par l'entretien quotidien (rations/faim) — anti-double-comptage. */
  lastUpkeepDay: number;
  /** Navire de campagne PERSISTANT (MDG ch.13-14) — porte son `vehicleId` et son MORAL (recalculé chaque
   *  semaine par l'entretien quotidien via `tickShipMorale`). `null` hors campagne navale. */
  vessel: CampaignVessel | null;
}

/** Navire que le groupe possède/commande en campagne — survit aux jours et aux combats (≠ la coque
 *  transitoire d'un combat). Son Moral est recalculé hebdomadairement (`tickShipMorale`). */
export interface CampaignVessel {
  vehicleId: string;
  morale: ShipMoraleState;
}

export const useGame = create<GameState>((set, get) => ({
  // Actions de combat inline — extraites dans `combatSlice.ts`, spreadées EN TÊTE (mêmes `get`/`set`).
  // Surface IDENTIQUE : cette tranche ne porte que des ACTIONS ; l'état reste assemblé plus bas (forme à plat).
  ...createCombatSlice(get, set),
  screen: 'menu',
  compendiumFocus: null,
  compendiumReturn: 'menu',
  codexOverlay: null,
  pendingCampaign: null,
  gameTime: CAMPAIGN_START,
  lastUpkeepDay: dayIndex(CAMPAIGN_START),
  vessel: null,
  worldMap: campaignWorldMap,
  worldMapOpen: false,
  travelPlan: null,
  travelRecap: null,
  party: [],
  scene: null,
  mode: 'exploration',
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
    const ship = battle?.combatants.find((c) => c.id === shipId);
    get().log(`${ship?.name ?? shipId} vire de bord — nouveau cap : ${next}.`);
    bus.emit(EVT.SCENE_DIRTY);
  },
  shipAdvance: (shipId, cases) => {
    const { facing, battle, scene } = get();
    const dir = facing[shipId];
    const hull = battle?.combatants.find((c) => c.id === shipId);
    if (!battle || !hull?.pos || !dir) return 0;
    const d = DIR8_DELTA[dir];
    const w = scene?.dimensions.w ?? Infinity, h = scene?.dimensions.h ?? Infinity;
    // Autres COQUES (jetons-navires) percutables (≠ self, pos connue) : une tuile occupée par une coque arrête
    // l'avance ADJACENT (pas de chevauchement) et déclenche la collision (MDG ch.13).
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
        .map((id) => battle.combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c?.pos)];
      for (const m of movers) {
        const from = { ...m.pos! };
        placeCombatant(m, scene, { x: from.x + delta.x, y: from.y + delta.y });
        bus.emit(EVT.ANIM_MOVE, { id: m.id, path: [from, { ...m.pos }] });
      }
      get().log(`${hull.name} avance de ${moved} case${moved > 1 ? 's' : ''} (cap ${dir}).`);
    }
    // Éperonnage (MDG ch.13) : on percute de la PROUE (avance vers l'avant) ; FRONTAL si la victime tient un cap
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
  explored: {},
  markExplored: (keys) => visionStateMod.recordExplored(get, set, keys),
  journal: [],
  dialogue: null,
  merchant: null,
  merchantStocks: {},
  battle: null,
  campaignSceneId: null,
  money: { gold: 0, silver: 0, brass: 0 },
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
  pendingOrders: [],
  startInterlude: (weeks) => interludeFlow.startInterlude(get, set, weeks),
  interludeEnd: () => interludeFlow.interludeEnd(get, set),
  // Longues Séances de Jeu (LDB 17 l.52) : réutilise l'Effet `restoreFortune` (NE DUPLIQUE PAS la
  // logique — même case que le début de session, qui appelle `engine/fortune.restoreFortune`).
  restoreFortuneNow: () => applyEffects(get, set, [{ type: 'restoreFortune' }]),
  pendingActivity: null,
  ...rollFlowActions('activity', FLOWS.activity, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
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
  partyReplaceHero: (oldId, hero, seat) => partyFlow.partyReplaceHero(get, set, oldId, hero, seat),

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
  buySkillAdvance: (heroId, skillName, spec) => partyFlow.buySkillAdvance(get, set, heroId, skillName, spec),
  buyTalent: (heroId, talentName) => partyFlow.buyTalent(get, set, heroId, talentName),
  designateCareerSlot: (heroId, slotKey, label) => partyFlow.designateCareerSlot(get, set, heroId, slotKey, label),
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
      money: { gold: 0, silver: 5, brass: 0 },
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
      journal: target.startMessage ? [...s.journal.slice(-40), target.startMessage] : s.journal,
    }));
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
  ...rollFlowActions('bargain', FLOWS.bargain, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
  bargainConfirm: () => merchantFlow.bargainConfirm(get, set),
  bargainCancel: () => set({ pendingBargain: null }),

  appraiseItem: (uid, heroId, mode) => merchantFlow.appraiseItem(get, set, uid, heroId, mode),
  appraiseGear: (scope, index, mode) => merchantFlow.appraiseGear(get, set, scope, index, mode),
  ...rollFlowActions('appraise', FLOWS.appraise, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
  resolveAppraise: () => merchantFlow.resolveAppraise(get, set),
  appraiseCancel: () => set({ pendingAppraise: null }),

  seedRng: (seed) => {
    seedBattleRng(seed);
  },

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
  harvestCreature: (creatureId) => harvestVictoryCreature(get, set, creatureId),
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
  restContinue: () => restFlow.restContinue(get, set),

  usePartyItem: (heroId, uid) => partyFlow.usePartyItem(get, set, heroId, uid),

  startExtendedTest: (opts) => {
    set({ pendingExtendedTest: { ...opts, total: 0, rounds: [{ id: 'round-1', interactive: true, result: null }] } });
    startCascade(get, set, { title: opts.label, icon: '🗝️', purpose: 'test', steps: [{ id: 'ext-jet', kind: 'extendedJet', jet: 'extended', actorId: opts.actorId }] });
  },
  ...rollFlowActionsMulti('extendedTest', FLOWS.extendedTest, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
  extendedTestNext: () => {
    const p = get().pendingExtendedTest;
    if (!p) return;
    const cur = p.rounds[p.rounds.length - 1];
    if (!cur?.result) return; // le Round courant doit avoir été lancé
    // Cumul LDB 12 mutualisé (`extendedTestStep`) : un Round réussi ajoute son DR, un raté le retire
    // (planché à 0) ; règle opt. l.208 « DR 0 = ±1 min » via `test-extended-min-sl`.
    const { total, done } = extendedTestStep(p.total, cur.result, p.targetDR, !!rule('test-extended-min-sl'));
    if (done) {
      set({ pendingExtendedTest: null, pendingCascade: null }); // ferme la cascade-hôte aussi
      get().log(`${p.label} : réussi (DR cumulé ${total} / ${p.targetDR}).`);
      if (p.dispel) {
        // DISSIPATION réussie (LDB 46 l.205) : retire tous les effets du Sort de tous ses porteurs.
        const b = get().battle;
        const n = b ? dissipateSpell(b.combatants, p.dispel.spellId, p.dispel.casterId) : 0;
        if (b) set({ battle: { ...b, combatants: [...b.combatants] } });
        get().log(`✨ ${p.dispel.label} est dissipé${n > 1 ? ` (${n} cibles libérées)` : ''}.`);
      }
      if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // gate la suite (porte/serrure d'éditeur)
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
    startCascade(get, set, { title: 'Enfoncer la porte', icon: '🔨', purpose: 'combat', steps: [{ id: 'forceDoor', kind: 'forceDoorStep', jet: 'forceDoor', groupOwner: true }] });
  },
  ...rollFlowActionsMulti('forceDoor', FLOWS.forceDoor, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll']),
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

  // Résilience « Je ne faillirai pas ! » (LDB ch.17 l.73) sur un Test de scène (hors combat) — cycle
  // UNIFIÉ par la fabrique rollFlow (les variantes combat attack/defense/cast vivent dans combatSlice).
  ...rollFlowActions('test', FLOWS.test, get, set, ['forceSuccess']),

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
      pendingTest: { ...pt, actorId: cand.id, actorName: cand.name, skillValue: cand.value, target: cand.target, psychMod: cand.psychMod, psychDetail: cand.psychDetail, itemUid: cand.itemUid },
      ...(pc ? { pendingCascade: { ...pc, participants: pc.participants.map((st, k) => (k === pc.cursor ? { ...st, actorId: cand.id } : st)) } } : {}),
    });
  },
  // Test de scène (hors combat) : Lancer / Chance (relance / +1 DR) / Pacte — Résilience plus haut.
  ...rollFlowActions('test', FLOWS.test, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact']),
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
  ...rollFlowActions('corruption', FLOWS.corruption, get, set, ['roll', 'reroll', 'bonusSL', 'darkPact', 'resist']),
  corruptionSetSkill: (skill) => {
    const pc = get().pendingCorruption;
    // Pré-jet uniquement, et JAMAIS si la compétence est déterminée en amont (source ou seuil).
    if (!pc || pc.roll != null || pc.skillLocked) return;
    set({ pendingCorruption: { ...pc, skill } });
  },
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
        set({ pendingRenounce: { heroId: hero.id, testRoll: pc.roll, testTarget: pc.target ?? 0, align: pc.align } });
      } else {
        for (const l of applyMutation(set, hero, { roll: pc.roll, target: pc.target ?? 0 }, pc.align)) get().log(l);
      }
      set({ ...touchActors(get()) });
      return;
    }
    const gain = corruptionGain(pc.level ?? 'mineure', !!pc.success, pc.sl ?? 0);
    if (gain <= 0) {
      get().log(`${hero.name} repousse l'Influence corruptrice (${pc.skill} ${pc.roll}/${pc.target}).`);
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
    // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.59/88). Ne repêche qu'un échec qui a
    // réussi le d100 mais manqué le seuil requireSL (jamais un roll > cible → on ne crée pas de réussite).
    const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
    const effSuccess = drDelta !== 0 ? pt.roll <= pt.target && pt.sl + drDelta >= pt.requireSL : pt.success;
    // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
    if (tool && pt.isDouble && !pt.success && hasQuality(tool, QUALITY_IDS.Bacle) && !isUnbreakable(tool)) {
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
