/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant, CharKey, CHAR_LABELS, CHAR_BY_LABEL, HitLocation, Weapon, Difficulty, DIFFICULTY_MODIFIERS } from '../engine/types';
import { battleRng, seedBattleRng } from './battleRng';
import { facingToward } from '../gameIso/rig/facing';
import type { Dir8 } from './dir8';
import {
  activeCombatant, occupied, findFreeTile, removeEntity, checkTriggers,
  applyEffects, bestDefenseMode, applySonneMeleeAdvantage, selectedAmmo, firedWeapon, resolveAttack,
  disengageOutcome, startDisengage, bestAdjacentReachable, applyAttackResult, castSpell, applyCast,
  applyMiscast, checkBattleOver, resumeEnemyTurn, advanceTurn, resolveRoundBoundary, maybeRunEnemyTurn,
  attackerFumbled, defenderFumbled, applyOups,
  autoCleave, maybeHeroCleave, cleaveTargets,
  aiMaybeTrample, aiCreatureFreeAttacks, aiFrenzyAttack, applyFreeAttackEffects, trampleTarget, TRAMPLE_WEAPON, pushReveal,
  maybeOpenHeroPsych,
} from './combatFlow';
export { activeCombatant, entityPickables, trampleTarget } from './combatFlow';
import { rollOups, type OupsResolved } from '../engine/oups';
import {
  initiativeOrder,
  combatValue,
  rollMeleeDefender,
  resolveBackstabAttack,
  finishMelee,
  resolveMeleePassive,
  attackWeapon,
  rederivePassiveAttack,
  resolveTrample,
  AttackResult,
} from '../engine/combat';
import { disengageFrom, isEngaged, chargeAdvantage } from '../engine/engagement';
import { resolveMagicMissile, resolveCasting, rederiveCastSL, resolveFocus, isArcaneSpell, type CastResult, type MissileResult, type FocusResult } from '../engine/magic';
import { rollTest, TestResult, resolveOpposed, isDoubleRoll } from '../engine/tests';
import { canReroll } from '../engine/fortune';
import { effectiveChar, maxWounds, bonus } from '../engine/characteristics';
import { resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, resolveFrenzyEntry, resolveCalmeSimple, CIBLE_TYPES, type PsychType } from '../engine/psychology';
import {
  buyCharAdvance as engineBuyCharAdvance,
  buySkillAdvance as engineBuySkillAdvance,
  buyTalent as engineBuyTalent,
  changeCareer as engineChangeCareer,
  isCareerLevelComplete,
  inCareerChar,
  inCareerSkill,
  inCareerTalent,
} from '../engine/advancement';
import { recomputeLoadout, itemFromTrapping, compatibleAmmo } from '../engine/items';
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
import { itemUse } from '../engine/consumables';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, addCondition, removeCondition, hasCondition, canTakeAction, loseWounds } from '../engine/conditions';
import { testValue } from '../engine/skills';
import { resolveRun } from '../engine/movement';
import { persistentConditions } from '../engine/persistence';
import { CAMPAIGN_START } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { findSpell, levelsForCareer, findSkill } from '../data/index';
import { Scene, Dialogue, Effect, isWalkable } from './scene';
import { sceneCombatModifiers } from './sceneRules';
import { doorAt } from './buildings';
import { spawnEnemy } from './spawn';
import { reachable, fleeReachable, pathTo, chebyshev, Pt } from './path';
import { bus, EVT } from './bus';
import { campaign } from '../scenes/campaign';

export type Screen = 'menu' | 'party' | 'creator' | 'campaign' | 'editor' | 'test';

/** Registre des scènes (pour les transitions de campagne). */
const sceneRegistry: Record<string, Scene> = {};
for (const c of campaign) sceneRegistry[c.scene.id] = c.scene;
function registerScene(s: Scene) {
  sceneRegistry[s.id] = s;
}

/** Données du Niveau de Carrière COURANT d'un héros (depuis careerLevels.json), pour la
 *  détection in-carrière et la complétion. `undefined` si la carrière est hors base. */
function currentCareerLevel(hero: Combatant) {
  return levelsForCareer(hero.career ?? '').find((l) => l.level === (hero.careerLevel ?? 1));
}

/** Recalcule les Blessures max (BF + 2·BE + BFM, LDB Attributs) après une Augmentation de
 *  Caractéristique ; un gain de max augmente aussi le courant d'autant (mute le héros). */
function recomputeWounds(hero: Combatant) {
  // Augmentation permanente de Caractéristique → recalcul de la BASE (formule × Taille de l'espèce).
  const newMax = maxWounds(hero.characteristics, hero.size ?? 'moyenne');
  const delta = newMax - hero.wounds.max;
  hero.wounds.base = newMax;
  hero.wounds.max = newMax;
  if (delta > 0) hero.wounds.current += delta;
  if (hero.wounds.current > newMax) hero.wounds.current = newMax;
}

export interface Money {
  gold: number;
  silver: number;
  brass: number;
}
/** Test de compétence interactif en attente d'acquittement par le joueur. */
export interface PendingTest {
  actorId: string;
  actorName: string;
  label: string;
  skillValue: number;
  difficulty: Difficulty;
  requireSL: number;
  target: number;
  /** Malus psy de Sociabilité de l'acteur (Animosité −20 / Préjugé −10 envers l'interlocuteur, LDB 21) —
   *  déjà intégré à `skillValue`/`target` ; conservé pour l'affichage en modale. */
  psychMod?: number;
  /** Libellé lisible du malus psy social (« Animosité −20 envers Elfe ») pour la modale de Test. */
  psychDetail?: string;
  /** Outil utilisé (uid résolu sur l'acteur) : sa qualité d'artisanat module l'issue / casse l'objet (Phase C2a). */
  itemUid?: string;
  /** Jet double (Maladresse si en plus c'est un échec) — pour casser un outil Bâclé hors combat. */
  isDouble?: boolean;
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Relance par Chance déjà effectuée (LDB ch.12 l.56 : 1 relance max par Test). */
  rerolled?: boolean;
  onSuccess?: Effect[];
  onFailure?: Effect[];
}
/** Rechargement en attente (LDB 63-Armures l.28-29 : Test étendu de Projectiles, Indice DR).
 *  La modale affiche « Lancer », le DR, puis Chance avant d'acquitter (cumul vers `reload`). */
export interface PendingReload {
  actorId: string;
  actorName: string;
  weaponName: string;
  reload: number; // Indice DR cible
  progressBefore: number; // DR déjà cumulés (Test étendu)
  skillValue: number; // combatValue(active, 'ranged')
  difficulty: Difficulty; // 'intermediaire' (le canon ne spécifie pas → défaut)
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  target: number; // cible effective après difficulté
  sl: number; // DR du jet
  success: boolean;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}
/** Attaque en attente : la modale affiche « Lancer », puis le résultat + Chance. */
export interface PendingAttack {
  attackerId: string;
  targetId: string;
  location: HitLocation | null;
  result: AttackResult | null; // null = pas encore lancé
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  fromCharge?: boolean; // issue d'une Charge → l'attaque est OBLIGATOIRE (LDB 15-Dépl l.75), Annuler interdit
  /** Victime réelle si le tir a dévié dans la mêlée vers un allié (LDB 14 l.136) — sinon = targetId. */
  victimId?: string;
  /** Attaque d'enchaînement d'un balayage (Frappe Mortelle) : son acquittement fait avancer le `pendingCleave`. */
  cleave?: boolean;
}
/** Balayage en attente (Frappe Mortelle d'un HÉROS plus grand, LDB 14 l.12 / 85 l.299) : après une
 *  touche de mêlée, le joueur enchaîne sur d'autres adversaires adjacents (jusqu'à BCC), via le flux
 *  `pendingAttack` standard. `count` = enchaînements déjà résolus ; `hitIds` = cibles déjà frappées ce balayage. */
export interface PendingCleave {
  attackerId: string;
  hitIds: string[];
  count: number;
}
/** Piétinement en attente (LDB 85 l.320-321) : modale interactive — Lancer (resolveTrample) →
 *  Chance → Appliquer (dépense 1 Avantage, action gratuite). */
export interface PendingTrample {
  attackerId: string;
  targetId: string;
  result: AttackResult | null; // null = pas encore lancé
  rerolled?: boolean;
}
/** Course en attente (LDB 15-Déplacement l.79-82) : Test d'Athlétisme (+20) ; succès → déplacement
 *  étendu (Marche + Course + DR). Lancer → Chance/Résilience → Appliquer (ouvre le déplacement étendu). */
export interface PendingRun {
  combatantId: string;
  result: { success: boolean; roll: number; dr: number; bonusCases: number } | null;
  rerolled?: boolean;
}
/** Focalisation en attente (LDB — Test étendu) : Lancer (resolveFocus) → Chance → Appliquer (cumule le DR). */
export interface PendingFocus {
  casterId: string;
  spellLabel: string;
  result: FocusResult | null;
  rerolled?: boolean;
}
/** Test de Psychologie (Calme) en attente d'un HÉROS (LDB 21) : Peur (Test étendu) ou Terreur (1ʳᵉ
 *  rencontre). Lancer → Chance → Appliquer. */
export interface PendingPsych {
  combatantId: string;
  kind: PsychType;
  sourceId: string;
  indice: number;
  prevDR: number;
  /** Trait CIBLÉ : groupe-Cible visé (Animosité (Elfes)…). Absent pour Peur/Terreur. */
  cible?: string;
  result: { roll: number; dr?: number; calmeDR?: number; vaincue?: boolean; success?: boolean; brise?: number; devientPeur?: number } | null;
  rerolled?: boolean;
}
/** Entrée en Frénésie en attente (LDB 21 l.32) : Test de FM. Lancer → Chance → Appliquer (entre si succès). */
export interface PendingFrenzy {
  combatantId: string;
  result: { success: boolean; roll: number } | null;
  rerolled?: boolean;
}
/** Entrée de la file de RÉVÉLATION témoin : un jet SUBI / sur table / d'entretien dont le résultat
 *  (graine fixe) est montré au joueur après coup — il MONTRE le dé puis acquitte (pas de Chance). */
export interface RevealEntry {
  kind: 'miscast' | 'critical' | 'assommante' | 'backstab' | 'calme' | 'round';
  title: string;
  dice?: number; // d100/d10 à afficher (le jet), si pertinent
  lines: string[]; // détail (résultat, effets)
}
/** Maladresse d'un HÉROS (LDB 14 — Tableau des Oups !) : son Test de combat a échoué sur un double.
 *  Flux modale : Lancer (rollOups → result) → Appliquer (applyOups). Pas de Chance (elle agit AVANT). */
export interface PendingFumble {
  combatantId: string;
  weapon: Weapon; // arme utilisée (pour Dégâts d'arme / Incident de Tir)
  result: OupsResolved | null; // null = pas encore lancé sur le Tableau des Oups !
  /** Vrai si la Maladresse survient pendant une défense réactive : reprendre le tour de l'IA après Appliquer. */
  resumeAfter?: boolean;
}
/** Déviation Critique en attente (LDB 63 l.63-66) : un HÉROS a subi un Coup Critique à une
 *  localisation où il porte de la PA ; il choisit Dévier (sacrifie 1 PA, ignore le Critique mais
 *  subit les Blessures recalculées PA−1) ou Subir (prend le Critique). `res`/`weapon` sont figés
 *  pour rejouer `applyAttackResult` avec la décision (une seule application, cf. combatFlow). */
export interface PendingDeviation {
  attackerId: string;
  targetId: string; // héros qui subit le Critique (= la cible réelle, victime d'un tir dévié comprise)
  weapon: Weapon;
  res: AttackResult;
  /** Reprendre le tour de l'IA après application (toujours vrai ici : la déviation survient pendant le tour ennemi). */
  resumeAfter: boolean;
}
/** Défense réactive : un ennemi (IA) a figé son jet d'attaque (`atk`) contre un héros ;
 *  le joueur choisit le mode, lance SA défense (`def`), peut la relancer (Chance = défense
 *  uniquement), puis applique. `atk` est figé et n'est JAMAIS relancé. Le tour de l'IA est
 *  suspendu tant que `pendingDefense` est non-null. */
export interface PendingDefense {
  attackerId: string; // ennemi
  defenderId: string; // héros
  weapon: Weapon; // arme active de l'attaquant, figée
  location: HitLocation | null; // visée par l'IA (aucune pour l'instant → null)
  atk: TestResult; // jet d'attaque figé (rollMeleeAttacker)
  mode: 'parade' | 'esquive'; // réaction choisie (défaut = bestDefenseMode)
  def: TestResult | null; // null = pas encore défendu ; écrasé par Chance
  result: AttackResult | null; // calculé par finishMelee après « Défendre »
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  /** Attaque GRATUITE de créature (Morsure/Caudale/Piétinement) : ne consomme pas l'Action, applique
   *  ses effets RAW et enchaîne la file au resolve (cf. aiCreatureFreeAttacks). */
  free?: boolean;
  freeKind?: string;
  prevActed?: boolean;
}
/** Désengagement en attente (LDB 15-Dépl l.84-109) : un MENU de choix (phase 'choice') —
 *  Sacrifier l'Avantage / Esquiver / Fuir / Renoncer — puis le Test d'Esquive (phase 'esquive'). */
export interface PendingDisengage {
  moverId: string; // héros qui se désengage (actif)
  foeId: string; // adversaire de référence (meilleure CC) pour l'Esquive et la Fuite
  canSacrifice: boolean; // Avantage > tous les foes Engagés → option « Sacrifier l'Avantage » dispo
  phase: 'choice' | 'esquive'; // 'choice' = menu d'options ; 'esquive' = Test d'Esquive en cours
  atk: TestResult | null; // Esquive : jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // Esquive : jet d'Esquive du mover
  result: 'success' | 'failure' | 'tie' | null; // 'tie' = égalité parfaite du Test opposé → statu quo
  /** Relance par Chance de l'Esquive déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** Incantation en attente : flux par modale (sélection → « Lancer » jet figé → Chance → appliquer),
 *  comme l'attaque. Tous les jets méritent leur modale. */
export interface PendingCast {
  casterId: string;
  targetId: string;
  spellLabel: string;
  /** Projectile magique (résolution façon attaque) vs autre sort / prière. */
  missile: boolean;
  /** Sort focalisé à NI 0 (consommé à l'application). */
  focused: boolean;
  /** Résultat figé du jet d'incantation (null = pas encore lancé). */
  result: (CastResult & Partial<MissileResult>) | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

export interface BattleState {
  combatants: Combatant[];
  order: string[];
  /** Ordre d'initiative CANONIQUE (immuable) ; `order` en est dérivé chaque Round (Maladresse
   *  « agir en dernier » / pré-emption Chance = effets d'UN Round, non permanents). */
  baseOrder?: string[];
  turn: number;
  round: number;
  action: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | 'resolve' | 'pickup' | 'ammo' | 'trample' | null;
  /** Sort sélectionné pour l'action d'incantation en cours. */
  selectedSpell: string | null;
  reachable: Map<string, number>;
  moved: boolean;
  acted: boolean;
  log: string[];
  over: null | 'victory' | 'defeat';
  onVictory?: Effect[];
  /** Nuages de fumée transitoires (Souffle (Fumée), Traits LDB) : chaque case bloque la Ligne de
   *  Vue ; `rounds` = Rounds restants (décrémenté à chaque frontière de Round, retiré à 0). */
  smoke?: { x: number; y: number; rounds: number }[];
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
  partyPos: Pt;
  flags: Record<string, boolean>;
  journal: string[];
  dialogue: { dialogue: Dialogue; nodeId: string } | null;
  battle: BattleState | null;
  campaignSceneId: string | null;
  inventory: string[];
  money: Money;
  pendingTest: PendingTest | null;
  pendingAttack: PendingAttack | null;
  pendingReload: PendingReload | null;
  pendingDefense: PendingDefense | null;
  /** Déviation Critique d'un héros en attente (choix Dévier/Subir, LDB 63 l.63-66). */
  pendingDeviation: PendingDeviation | null;
  pendingDisengage: PendingDisengage | null;
  pendingCast: PendingCast | null;
  /** Balayage (Frappe Mortelle) d'un héros en cours : enchaînements d'attaque restants. */
  pendingCleave: PendingCleave | null;
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
  /** Entrée en Frénésie d'un héros en cours (Test de FM, LDB 21 l.32). */
  pendingFrenzy: PendingFrenzy | null;
  /** Maladresse d'un héros en attente (LDB 14 — Tableau des Oups !). */
  pendingFumble: PendingFumble | null;
  /** Modale d'ordre de Round en attente (Chance, 3e usage : pré-emption d'initiative). */
  pendingRoundStart: { round: number } | null;
  /** Sauvetage par le Destin en attente (LDB ch.17 l.31-35). */
  pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number } | null;
  document: { title: string; text: string } | null;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  setScreen: (s: Screen) => void;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
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
  /** Change de Carrière/Niveau (coût 100 si Niveau actuel complété, 200 sinon). */
  changeCareer: (heroId: string, newCareer: string, newLevel: number) => void;
  startScene: (scene: Scene) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. */
  loadProject: (scenes: Scene[], entryId: string) => void;
  transitionTo: (sceneId: string, entry?: string, pos?: Pt) => void;
  moveParty: (pt: Pt) => void;
  interactEntity: (entityId: string) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  testRoll: () => void;
  testReroll: () => void;
  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => void;
  resolveTest: () => void;
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Effect[]) => void;
  battleSelectAction: (a: 'move' | 'attack' | 'cast' | 'focus' | 'charge' | 'use' | 'resolve' | 'pickup' | 'ammo' | 'trample' | null) => void;
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
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: string) => void;
  /** Détermination (Resolve, LDB ch.17 l.62-66) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
  /** Ramasser UN objet au sol pendant un Round (LDB ch.13 l.115-116) : applique au combattant
   *  actif un item ramassable d'une entité `objet` adjacente. Consomme l'Action, pas d'auto-équipe.
   *  `key` = `trap:<index dans search>` ou `loot:<index dans loot>`. */
  battlePickup: (entityId: string, key: string) => void;
  battleSelectSpell: (label: string) => void;
  /** Le combattant actif boit/utilise un consommable de son inventaire (coûte l'Action). */
  battleUseItem: (uid: string) => void;
  /** Incantation par modale : « Lancer » fige le jet, Chance le relance, « Appliquer » résout. */
  castRoll: () => void;
  castReroll: () => void;
  castBonusSL: () => void;
  castConfirm: () => void;
  castCancel: () => void;
  battleFocusSpell: (label: string) => void;
  battleClickTile: (pt: Pt) => void;
  battleClickEntity: (id: string) => void;
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
  /** Action « Viser » (sans jet) : +20 (Accessible) au prochain tir tant que c'est la dernière action. */
  battleAim: () => void;
  /** Flux d'attaque par modale : viser une localisation, lancer, dépenser une Chance, appliquer. */
  attackSetLocation: (loc: HitLocation | null) => void;
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
  /** Test de Psychologie héros (Peur/Terreur, LDB 21) : Lancer, Chance, Appliquer. */
  psychRoll: () => void;
  psychReroll: () => void;
  psychBonusSL: () => void;
  psychForceSuccess: () => void;
  psychConfirm: () => void;
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
  defenseRoll: () => void;
  defenseReroll: () => void;
  defenseBonusSL: () => void;
  defenseConfirm: () => void;
  defenseCancel: () => void;
  /** Déviation Critique (LDB 63 l.63-66) : « Dévier » (sacrifie 1 PA, ignore le Critique) ou « Subir ». */
  deviationApply: (deviate: boolean) => void;
  /** Désengagement (LDB 15-Dépl l.84-109) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  battleDisengage: () => void;
  disengageConfirmA: () => void; // Sacrifier l'Avantage
  disengageRoll: () => void; // Esquiver (lance le Test opposé)
  disengageReroll: () => void;
  disengageBonusSL: () => void;
  // Résilience « Je ne faillirai pas ! » (LDB ch.17 l.72) : réussite garantie (opposé : DR +1).
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
  setZoom: (z) => set({ zoom: Math.min(2.6, Math.max(1, z)) }),
  partyPos: { x: 0, y: 0 },
  flags: {},
  journal: [],
  dialogue: null,
  battle: null,
  campaignSceneId: null,
  inventory: [],
  money: { gold: 0, silver: 0, brass: 0 },
  pendingTest: null,
  pendingAttack: null,
  pendingReload: null,
  pendingDefense: null,
  pendingDeviation: null,
  pendingDisengage: null,
  pendingCast: null,
  pendingCleave: null,
  pendingReveals: [],
  pendingTrample: null,
  pendingRun: null,
  pendingFocus: null,
  pendingPsych: null,
  pendingFrenzy: null,
  pendingFumble: null,
  pendingRoundStart: null,
  pendingFateSave: null,
  document: null,
  previousScene: null,

  setScreen: (s) => set({ screen: s }),

  /** Équipe/déséquipe un objet d'un héros et recalcule ses armes/armure actives. */
  toggleEquip: (heroId, uid) =>
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const it = (clone.items ?? []).find((i) => i.uid === uid);
        if (it) {
          it.equipped = !it.equipped;
          recomputeLoadout(clone);
        }
        return clone;
      }),
    })),
  setItemSkin: (heroId, uid, patch) =>
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const it = (clone.items ?? []).find((i) => i.uid === uid);
        if (it) {
          const next: Record<string, string> = { ...(it.skin ?? {}) };
          for (const [k, v] of Object.entries(patch)) { if (v == null) delete next[k]; else next[k] = v; }
          it.skin = Object.keys(next).length ? next : undefined;
          recomputeLoadout(clone); // propage skin → Weapon.skin actif
        }
        return clone;
      }),
    })),
  grantXp: (heroId, amount) => {
    let name = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        name = h.name;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        clone.xp = (clone.xp ?? 0) + amount;
        return clone;
      }),
    }));
    if (name) get().log(`${name} : ${amount >= 0 ? '+' : ''}${amount} PX.`);
  },

  buyCharAdvance: (heroId, char) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const inC = inCareerChar(currentCareerLevel(clone)?.characteristics ?? [], char);
        const r = engineBuyCharAdvance(clone, char, inC);
        if (!r.ok) {
          msg = `${clone.name} : ${CHAR_LABELS[char]} — ${r.reason}.`;
          return h;
        }
        recomputeWounds(clone);
        msg = `${clone.name} : ${CHAR_LABELS[char]} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

  buySkillAdvance: (heroId, skillName) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const known = clone.skills.some((sk) => sk.name === skillName);
        const inC = inCareerSkill(currentCareerLevel(clone)?.skills ?? [], skillName);
        if (!known) {
          if (!inC) {
            msg = `${clone.name} : « ${skillName} » hors carrière, non acquérable.`;
            return h;
          }
          // Acquérir la Compétence de carrière à advances 0, puis l'augmenter (l'Augmentation est payée).
          const characteristic = CHAR_BY_LABEL[findSkill(skillName)?.characteristic ?? ''] ?? 'Int';
          clone.skills.push({ name: skillName, characteristic, advances: 0 });
        }
        const r = engineBuySkillAdvance(clone, skillName, inC);
        if (!r.ok) {
          msg = `${clone.name} : ${skillName} — ${r.reason}.`;
          return h;
        }
        msg = `${clone.name} : ${skillName} +1 (−${r.cost} PX${inC ? '' : ', hors carrière'}).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

  buyTalent: (heroId, talentName) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const inC = inCareerTalent(currentCareerLevel(clone)?.talents ?? [], talentName);
        if (!inC) {
          msg = `${clone.name} : Talent « ${talentName} » hors carrière (LDB l.97).`;
          return h;
        }
        const r = engineBuyTalent(clone, talentName);
        if (!r.ok) {
          msg = `${clone.name} : ${talentName} — ${r.reason}.`;
          return h;
        }
        msg = `${clone.name} : Talent ${talentName} (−${r.cost} PX).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

  changeCareer: (heroId, newCareer, newLevel) => {
    let msg = '';
    set((s) => ({
      party: s.party.map((h) => {
        if (h.id !== heroId) return h;
        const clone: Combatant = JSON.parse(JSON.stringify(h));
        const lvl = currentCareerLevel(clone);
        const completed = lvl ? isCareerLevelComplete(clone, clone.careerLevel ?? 1, lvl.skills, lvl.talents) : false;
        const r = engineChangeCareer(clone, newCareer, newLevel, completed);
        if (!r.ok) {
          msg = `${clone.name} : changement de carrière refusé (${r.reason}).`;
          return h;
        }
        msg = `${clone.name} : carrière → ${newCareer} (niv. ${newLevel}, −${r.cost} PX).`;
        return clone;
      }),
    }));
    if (msg) get().log(msg);
  },

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
    const { screen, party, camRot, zoom } = get();
    set({
      ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>),
      screen, party, camRot, zoom,
      scene: JSON.parse(JSON.stringify(scene)),
      mode: 'exploration',
      partyPos: pos,
      flags: { ...scene.flags },
      money: { gold: 0, silver: 5, brass: 0 },
      campaignSceneId: scene.id,
      journal: scene.startMessage ? [scene.startMessage] : [],
    });
    bus.emit(EVT.SCENE_DIRTY);
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
      scene: JSON.parse(JSON.stringify(target)),
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
      pendingDefense: null,
      pendingDisengage: null,
      pendingCleave: null,
      pendingReveals: [],
      pendingTrample: null,
      pendingRun: null,
      pendingFocus: null,
      pendingPsych: null,
      pendingFrenzy: null,
      document: null,
      campaignSceneId: target.id,
      journal: target.startMessage ? [...s.journal.slice(-40), target.startMessage] : s.journal,
    }));
    get().advanceTime(TIME_COST.sceneTransition); // seam « tout est horodaté » : 0 en intérieur (paramétrable, #T2 extérieur/voyage)
    bus.emit(EVT.SCENE_DIRTY);
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
  },

  interactEntity: (entityId) => {
    const { scene, partyPos } = get();
    if (!scene) return;
    const ent = scene.entities.find((e) => e.id === entityId);
    if (!ent) return;
    if (chebyshev(partyPos, ent.pos) > 1) {
      get().log('Trop loin pour interagir.');
      return;
    }
    if (ent.dialogueId) {
      const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
      if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
    } else if (ent.kind === 'objet') {
      // Fouille à Effets (corps, coffre…) : le corps RESTE, marqué « fouillé » une seule fois.
      if (ent.search && ent.search.length) {
        if (get().flags[`__fouille_${entityId}`]) {
          get().log(`${ent.label ?? 'Déjà fouillé'} : rien de plus à trouver.`);
          return;
        }
        get().log(`Vous fouillez ${ent.label ?? 'les lieux'}…`);
        applyEffects(get, set, ent.search);
        get().advanceTime(TIME_COST.search); // « tout est horodaté » : fouiller ≈ search min
        set((s) => ({ flags: { ...s.flags, [`__fouille_${entityId}`]: true } }));
        return;
      }
      // Ramassage simple (legacy) : ajout à l'inventaire de groupe, l'objet disparaît.
      const loot = ent.loot ?? [];
      if (loot.length) set((s) => ({ inventory: [...s.inventory, ...loot] }));
      get().log(`Vous récupérez : ${loot.join(', ') || ent.label || 'un objet'}.`);
      removeEntity(get, set, entityId);
    }
  },

  chooseDialogue: (choiceIndex) => {
    const st = get();
    if (!st.dialogue) return;
    const node = st.dialogue.dialogue.nodes.find((n) => n.id === st.dialogue!.nodeId);
    const choice = node?.choices[choiceIndex];
    if (!choice) return;
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
    const all = [...heroes, ...enemies];
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
      moved: false,
      acted: false,
      log: [`Le combat commence ! (Round 1)`],
      over: null,
      onVictory: onVictory ?? enc.onVictory,
    };
    // Repart d'aucune modale de jet héritée d'un combat/contexte précédent.
    set({ battle, mode: 'battle', pendingAttack: null, pendingReload: null, pendingDefense: null, pendingDeviation: null, pendingDisengage: null, pendingCast: null, pendingCleave: null, pendingReveals: [], pendingTrample: null, pendingRun: null, pendingFocus: null, pendingPsych: null, pendingFrenzy: null, pendingFumble: null });
    get().faceAtCombatStart();
    // « Un jet = une modale » : l'ordre d'Initiative (I + 1d10) est révélé au joueur (après le reset des modales).
    pushReveal(set, {
      kind: 'round',
      title: 'Initiative',
      lines: order.map((id, i) => {
        const c = all.find((x) => x.id === id)!;
        return `${i + 1}. ${c.name} (${c.initiative})`;
      }),
    });
    bus.emit(EVT.SCENE_DIRTY);
    maybeRunEnemyTurn(get, set);
  },

  battleSelectAction: (a) => {
    const { battle, scene } = get();
    if (!battle || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // Sonné : pas d'Action (attaque/incantation) ; déplacement ET Détermination restent possibles
    // (la Détermination ne coûte pas l'Action et peut retirer le Sonné lui-même, LDB ch.17 l.62-66).
    if (a !== 'move' && a !== 'resolve' && a !== null && !canTakeAction(active)) return;
    let reach = new Map<string, number>();
    if (a === 'move' && !battle.moved) {
      // Engagé : déplacement libre interdit (LDB 15-Dépl l.84) → on entre dans le Désengagement.
      if (isEngaged(active)) {
        // Si l'Action est déjà consommée (Esquive de Désengagement ratée/neutre, l.89), on ne
        // peut pas retenter ce tour → no-op (sinon boucle infinie de Tests d'Esquive).
        if (battle.acted) return;
        startDisengage(get, set, active);
        return;
      }
      const blocked = occupied(battle, active);
      reach = reachable(scene, active.pos!, effectiveMovement(active), blocked);
    }
    // Charge : seulement si pas déjà Engagé, pas À Terre (LDB 16 l.37) et arme de mêlée prête ; portée = Course (2×Mouvement, LDB 15-Dépl l.61,77).
    if (a === 'charge' && !battle.moved && !isEngaged(active) && !hasCondition(active, 'À Terre') && active.weapons[0]?.type === 'melee') {
      const blocked = occupied(battle, active);
      reach = reachable(scene, active.pos!, effectiveMovement(active) * 2, blocked);
    }
    // Quitter le mode incantation oublie le sort sélectionné.
    const selectedSpell = a === 'cast' || a === 'focus' ? battle.selectedSpell : null;
    set({ battle: { ...battle, action: a, reachable: reach, selectedSpell } });
    bus.emit(EVT.SCENE_DIRTY);
  },

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
    const log: string[] = [`${active.name} utilise : ${it.name}.`];
    if (eff.heal != null && eff.heal > 0) {
      const before = active.wounds.current;
      active.wounds.current = Math.min(active.wounds.max, active.wounds.current + eff.heal);
      log.push(`${active.name} regagne ${active.wounds.current - before} Blessure(s).`);
    }
    if (eff.removeCondition) {
      const cond = active.conditions.find((c) => c.name === eff.removeCondition);
      if (cond) {
        removeCondition(active, eff.removeCondition, cond.value); // retire toutes les piles de l'État
        log.push(`${active.name} n'est plus ${eff.removeCondition}.`);
      } else {
        log.push(`${active.name} n'a pas l'État ${eff.removeCondition}.`);
      }
    }
    active.items = (active.items ?? []).filter((i) => i.uid !== uid); // consommé
    active.aiming = false; // une autre action que le tir gâche la visée
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ...log] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  castRoll: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell) return;
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused)
      : resolveCasting(caster, spell, battleRng(), 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res } });
  },
  castReroll: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    // Échec d'incantation = d100 propre > cible (roll > target), 1× max.
    if (!canReroll(pc.result.roll > pc.result.target, !!pc.rerolled)) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1; // Chance : relance le jet d'incantation
    const res = pc.missile
      ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused)
      : resolveCasting(caster, spell, battleRng(), 'intermediaire', pc.focused);
    set({ pendingCast: { ...pc, result: res, rerolled: true }, battle: { ...battle } });
  },
  /** Chance « +1 DR » : +1 DR à l'incantation figée (peut franchir le NI), cumulable. */
  castBonusSL: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1;
    const res = rederiveCastSL(caster, target, spell, pc.result, pc.missile, pc.focused, 1);
    set({ pendingCast: { ...pc, result: res }, battle: { ...battle } });
  },
  castConfirm: () => {
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    set({ pendingCast: null });
    if (caster && target && spell) applyCast(get, set, caster, target, spell, pc.result, pc.missile, pc.focused);
  },
  castCancel: () => set({ pendingCast: null }),

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
  focusRoll: () => {
    const { battle, pendingFocus: pf } = get();
    if (!battle || !pf || pf.result) return;
    const caster = battle.combatants.find((c) => c.id === pf.casterId);
    const spell = findSpell(pf.spellLabel);
    if (!caster || !spell) return;
    set({ pendingFocus: { ...pf, result: resolveFocus(caster, spell, battleRng()) } });
  },
  focusReroll: () => {
    const { battle, pendingFocus: pf } = get();
    if (!battle || !pf || !pf.result) return;
    if (!canReroll(pf.result.dr === 0, !!pf.rerolled)) return; // aucun DR gagné → rejouable, 1× max
    const caster = battle.combatants.find((c) => c.id === pf.casterId);
    const spell = findSpell(pf.spellLabel);
    if (!caster || !spell || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1;
    set({ pendingFocus: { ...pf, result: resolveFocus(caster, spell, battleRng()), rerolled: true }, battle: { ...battle } });
  },
  focusBonusSL: () => {
    const { battle, pendingFocus: pf } = get();
    if (!battle || !pf || !pf.result) return;
    const caster = battle.combatants.find((c) => c.id === pf.casterId);
    if (!caster || (caster.fortune ?? 0) <= 0) return;
    caster.fortune = (caster.fortune ?? 0) - 1;
    set({ pendingFocus: { ...pf, result: { ...pf.result, dr: pf.result.dr + 1, log: `${pf.result.log} (+1 DR)` } }, battle: { ...battle } });
  },
  focusForceSuccess: () => {
    const { battle, pendingFocus: pf } = get();
    if (!battle || !pf || !pf.result) return;
    const caster = battle.combatants.find((c) => c.id === pf.casterId);
    if (!caster || (caster.resilience ?? 0) <= 0) return;
    caster.resilience = (caster.resilience ?? 0) - 1;
    set({ pendingFocus: { ...pf, result: { ...pf.result, dr: Math.max(pf.result.dr, 1), isFumble: false, log: `${caster.name} force la focalisation (Résilience).` } }, battle: { ...battle } });
  },
  focusConfirm: () => {
    const { battle, pendingFocus: pf } = get();
    if (!battle || !pf || !pf.result) return;
    const caster = battle.combatants.find((c) => c.id === pf.casterId);
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
    set({ battle: { ...get().battle!, acted: true, action: null, selectedSpell: null, log: [...battle.log, ...logLines] } });
    checkBattleOver(get, set);
  },
  focusCancel: () => set({ pendingFocus: null }),
  // ── Test de Psychologie héros (Peur/Terreur, LDB 21) ── (pas d'« Annuler » : le Test est obligatoire)
  psychRoll: () => {
    const { battle, pendingPsych: pp } = get();
    if (!battle || !pp || pp.result) return;
    const c = battle.combatants.find((x) => x.id === pp.combatantId);
    if (!c) return;
    let result;
    if (CIBLE_TYPES.has(pp.kind)) { const t = resolveCalmeSimple(calmeValue(c), battleRng()); result = { roll: t.roll, success: t.success }; }
    else if (pp.kind === 'terreur') result = resolveTerreurTest(calmeValue(c), pp.indice, battleRng());
    else result = resolvePeurTest(calmeValue(c), pp.indice, pp.prevDR, battleRng());
    set({ pendingPsych: { ...pp, result } });
  },
  psychReroll: () => {
    const { battle, pendingPsych: pp } = get();
    if (!battle || !pp || !pp.result) return;
    const isCible = CIBLE_TYPES.has(pp.kind);
    const failed = isCible || pp.kind === 'terreur' ? !pp.result.success : (pp.result.dr ?? 0) === 0;
    if (!canReroll(failed, !!pp.rerolled)) return;
    const c = battle.combatants.find((x) => x.id === pp.combatantId);
    if (!c || (c.fortune ?? 0) <= 0) return;
    c.fortune = (c.fortune ?? 0) - 1;
    let result;
    if (isCible) { const t = resolveCalmeSimple(calmeValue(c), battleRng()); result = { roll: t.roll, success: t.success }; }
    else if (pp.kind === 'terreur') result = resolveTerreurTest(calmeValue(c), pp.indice, battleRng());
    else result = resolvePeurTest(calmeValue(c), pp.indice, pp.prevDR, battleRng());
    set({ pendingPsych: { ...pp, result, rerolled: true }, battle: { ...battle } });
  },
  psychBonusSL: () => {
    const { battle, pendingPsych: pp } = get();
    if (!battle || !pp || !pp.result || CIBLE_TYPES.has(pp.kind)) return; // ciblé = Test binaire (pas de « +1 DR »)
    const c = battle.combatants.find((x) => x.id === pp.combatantId);
    if (!c || (c.fortune ?? 0) <= 0) return;
    c.fortune = (c.fortune ?? 0) - 1;
    const r = pp.result;
    const result =
      pp.kind === 'terreur'
        ? { ...r, brise: Math.max(pp.indice, (r.brise ?? 0) - 1) } // +1 DR réduit le Brisé (plancher = Indice)
        : { ...r, calmeDR: (r.calmeDR ?? 0) + 1, vaincue: (r.calmeDR ?? 0) + 1 >= pp.indice };
    set({ pendingPsych: { ...pp, result }, battle: { ...battle } });
  },
  psychForceSuccess: () => {
    const { battle, pendingPsych: pp } = get();
    if (!battle || !pp || !pp.result) return;
    const c = battle.combatants.find((x) => x.id === pp.combatantId);
    if (!c || (c.resilience ?? 0) <= 0) return;
    c.resilience = (c.resilience ?? 0) - 1;
    const r = pp.result;
    const result =
      CIBLE_TYPES.has(pp.kind)
        ? { ...r, success: true }
        : pp.kind === 'terreur'
          ? { ...r, success: true, brise: 0 }
          : { ...r, calmeDR: pp.indice, vaincue: true };
    set({ pendingPsych: { ...pp, result }, battle: { ...battle } });
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
      set({ battle: { ...get().battle!, log: [...get().battle!.log, ...log] } });
    }
    maybeOpenHeroPsych(get, set); // enchaîne le Test suivant s'il en reste, sinon ferme
  },

  // ── Entrée en Frénésie d'un héros (LDB 21 l.31-36) : Test de FM, succès → +1 BF / immunité psy / attaque obligatoire ──
  battleFrenzy: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || active.frenzied || !isFrenzyCapable(active)) return;
    // OUVRE la modale — le Test de FM se fait au clic « Lancer » (« un jet = une modale »).
    set({ pendingFrenzy: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
  },
  frenzyRoll: () => {
    const { battle, pendingFrenzy: pf } = get();
    if (!battle || !pf || pf.result) return;
    const c = battle.combatants.find((x) => x.id === pf.combatantId);
    if (!c) return;
    set({ pendingFrenzy: { ...pf, result: resolveFrenzyEntry(effectiveChar(c, 'FM'), battleRng()) } });
  },
  frenzyReroll: () => {
    const { battle, pendingFrenzy: pf } = get();
    if (!battle || !pf || !pf.result) return;
    if (!canReroll(!pf.result.success, !!pf.rerolled)) return; // Test raté, 1× max
    const c = battle.combatants.find((x) => x.id === pf.combatantId);
    if (!c || (c.fortune ?? 0) <= 0) return;
    c.fortune = (c.fortune ?? 0) - 1;
    set({ pendingFrenzy: { ...pf, result: resolveFrenzyEntry(effectiveChar(c, 'FM'), battleRng()), rerolled: true }, battle: { ...battle } });
  },
  frenzyForceSuccess: () => {
    const { battle, pendingFrenzy: pf } = get();
    if (!battle || !pf || !pf.result || pf.result.success) return;
    const c = battle.combatants.find((x) => x.id === pf.combatantId);
    if (!c || (c.resilience ?? 0) <= 0) return;
    c.resilience = (c.resilience ?? 0) - 1;
    set({ pendingFrenzy: { ...pf, result: { ...pf.result, success: true } }, battle: { ...battle } });
  },
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
    set({ battle: { ...get().battle!, acted: true, action: null, log: [...battle.log, ...log] } });
    checkBattleOver(get, set);
  },
  frenzyCancel: () => set({ pendingFrenzy: null }),

  battleClickTile: (pt) => {
    const { battle, scene } = get();
    if (!battle || !scene || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    if (battle.action === 'move' && !battle.moved) {
      const k = `${pt.x},${pt.y}`;
      if (!battle.reachable.has(k)) return;
      // Peur (LDB 21 l.29) : impossible de s'APPROCHER de la source tant qu'on est sous son emprise.
      for (const p of active.psychState ?? []) {
        if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 1)) continue;
        const src = battle.combatants.find((c) => c.id === p.sourceId);
        if (src?.pos && chebyshev(pt, src.pos) < chebyshev(active.pos!, src.pos)) {
          get().log(`${active.name} ne peut pas s'approcher de ${src.name} : la Peur le paralyse.`);
          return;
        }
      }
      const blocked = occupied(battle, active);
      const path = pathTo(scene, active.pos!, pt, blocked);
      active.pos = { ...pt };
      get().faceFromPath(active.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      set({ battle: { ...battle, moved: true, action: null, reachable: new Map() } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  },

  battleClickEntity: (id) => {
    const { battle, scene } = get();
    if (!battle || battle.over) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero') return;
    // Piétinement : action GRATUITE (autorisée même Action consommée). Précède le verrou `battle.acted`.
    if (battle.action === 'trample') {
      get().battleTrample(id);
      return;
    }
    if (battle.acted) return;
    const target = battle.combatants.find((c) => c.id === id);
    if (!target) return;
    if (battle.action === 'cast' && battle.selectedSpell) {
      // L'incantation peut viser un allié, un ennemi ou soi-même.
      castSpell(get, set, active, target, battle.selectedSpell);
      return;
    }
    if (battle.action === 'charge') {
      // Charge (LDB 15-Dépl l.74-77) : se ruer au contact d'un ennemi (portée de Course) puis attaquer.
      if (!scene || target.kind === 'hero' || isEngaged(active)) return; // pas de Charge si déjà Engagé (l.74)
      const blocked = occupied(battle, active);
      const reach = reachable(scene, active.pos!, effectiveMovement(active) * 2, blocked); // portée de Course
      const dest = bestAdjacentReachable(reach, target.pos!);
      if (!dest) {
        get().log('Cible hors de portée de Charge.');
        return;
      }
      const distFrom = chebyshev(active.pos!, target.pos!); // distance de combat AVANT déplacement (l.77 ; ≤ 2M+1 pour toute charge valide)
      const adv = chargeAdvantage(effectiveMovement(active), distFrom);
      const path = pathTo(scene, active.pos!, dest, blocked);
      active.pos = { ...dest };
      get().faceFromPath(active.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      active.advantage += adv; // +1/+2 « en fonçant » (l.77,102), AVANT le jet (profite au toucher)
      active.gainedAdvThisRound = true;
      set({ battle: { ...battle, moved: true, action: 'attack', log: [...battle.log, `${active.name} charge ${target.name} (+${adv} Avantage).`] } });
      set({ pendingAttack: { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true } });
      return;
    }
    if (battle.action !== 'attack') return;
    if (target.kind === 'hero') return; // l'attaque ne vise que les ennemis
    // Arme effectivement employée selon la distance (mêlée au contact, distance sinon) — PAS weapons[0],
    // sinon un héros mixte mêlée+distance ne pourrait jamais tirer une cible éloignée (LDB Armes l.297-298).
    const adj = chebyshev(active.pos!, target.pos!) <= 1;
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
    set({ battle: { ...battle, order, log: [...battle.log, `${hero.name} choisit d'agir en premier (Chance).`] } });
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
    set({ battle: { ...battle, turn, action: null, moved: false, acted: false, reachable: new Map() } });
    if (checkBattleOver(get, set)) return;
    bus.emit(EVT.SCENE_DIRTY);
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
    set({ battle: { ...battle, log: [...battle.log, `${hero.name} : « Comment ça a pu rater ? » — le coup fatal est évité (Destin −1).`] } });
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
    set({ battle: { ...battle, log: [...battle.log, `${hero.name} : « Meurs un autre jour » — survit mais quitte le combat (Destin −1).`] } });
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
      set({ battle: { ...battle, log: [...battle.log, `${hero.name} succombe.`] } });
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
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, `${active.name} se met sur la défensive (+20 en défense).`] } });
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
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, `${active.name} vise soigneusement (+20 au prochain tir).`] } });
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
    const skillValue = combatValue(active, 'ranged'); // CT + avances Projectiles (groupe d'arme)
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
  reloadRoll: () => {
    const pr = get().pendingReload;
    if (!pr || pr.roll != null) return; // déjà lancé
    const res = rollTest(pr.skillValue, pr.difficulty, battleRng());
    set({ pendingReload: { ...pr, roll: res.roll, target: res.target, sl: res.sl, success: res.success } });
  },
  reloadReroll: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    if (!canReroll(pr.roll > pr.target, !!pr.rerolled)) return; // jet raté, 1× max
    const a = battle.combatants.find((c) => c.id === pr.actorId);
    if (!a || (a.fortune ?? 0) <= 0) return;
    a.fortune = (a.fortune ?? 0) - 1;
    const res = rollTest(pr.skillValue, pr.difficulty, battleRng());
    set({ pendingReload: { ...pr, roll: res.roll, target: res.target, sl: res.sl, success: res.success, rerolled: true }, battle: { ...battle } });
  },
  reloadBonusSL: () => {
    const { battle, pendingReload: pr } = get();
    if (!battle || !pr || pr.roll == null) return;
    const a = battle.combatants.find((c) => c.id === pr.actorId);
    if (!a || (a.fortune ?? 0) <= 0) return;
    a.fortune = (a.fortune ?? 0) - 1;
    set({ pendingReload: { ...pr, sl: pr.sl + 1 }, battle: { ...battle } });
  },
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
    set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, log] } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  reloadCancel: () => set({ pendingReload: null }), // avant le jet : aucun coût
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
    removeCondition(active, conditionName, 1); // « Retirez un État » (un pion), LDB ch.17 l.64
    let extra = '';
    if (conditionName === 'À Terre') {
      active.wounds.current = Math.min(active.wounds.max, active.wounds.current + 1); // +1 PB en se relevant (l.66)
      extra = ' (+1 PB en se relevant)';
    }
    set({ battle: { ...battle, action: null, log: [...battle.log, `${active.name} puise dans sa Détermination : retire l'État ${conditionName}${extra}.`] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  // ── Ramasser un objet au sol pendant un Round (un à la fois, LDB ch.13 l.115-116) ──
  battlePickup: (entityId, key) => {
    const { battle, scene } = get();
    if (!battle || battle.over || battle.acted || !scene) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !canTakeAction(active)) return; // ramasser = une Action
    if (get().flags[`__fouille_${entityId}`]) return; // déjà entièrement fouillé en exploration
    const ent = scene.entities.find((e) => e.id === entityId && e.kind === 'objet');
    if (!ent || !active.pos || chebyshev(active.pos, ent.pos) > 1) return; // doit être adjacent/sur la case
    const [kind, idxStr] = key.split(':');
    const idx = Number(idxStr);
    let label: string; // assigné dans chaque branche atteignant l'usage (le cas `else` renvoie)
    if (kind === 'loot') {
      const name = (ent.loot ?? [])[idx];
      if (!name) return;
      label = name;
      ent.loot = (ent.loot ?? []).filter((_, i) => i !== idx); // consommé du pool
      set((s) => ({ inventory: [...s.inventory, name] }));
    } else if (kind === 'trap') {
      const eff = (ent.search ?? [])[idx];
      if (!eff || eff.type !== 'giveTrapping') return;
      const it = itemFromTrapping(eff.trapping);
      if (!it) {
        get().log(`Objet inconnu : « ${eff.trapping} ».`);
        return;
      }
      label = it.name;
      // ajout NON équipé au combattant actif (clone battle) ET au membre party (persiste post-combat).
      active.items = [...(active.items ?? []), it];
      recomputeLoadout(active);
      ent.search = (ent.search ?? []).filter((_, i) => i !== idx); // retire du pool partagé
      set((s) => ({
        party: s.party.map((h) => {
          if (h.id !== active.id) return h;
          const clone: Combatant = JSON.parse(JSON.stringify(h));
          clone.items = [...(clone.items ?? []), itemFromTrapping(eff.trapping)!];
          recomputeLoadout(clone);
          return clone;
        }),
      }));
    } else return;
    set({ scene: { ...scene }, battle: { ...battle, acted: true, action: null, log: [...battle.log, `${active.name} ramasse : ${label}.`] } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  attackSetLocation: (loc) => {
    const pa = get().pendingAttack;
    if (!pa || pa.result) return; // la visée ne change plus après le jet
    set({ pendingAttack: { ...pa, location: loc } });
  },
  attackRoll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || pa.result) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target) return;
    applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
    const r = resolveAttack(get, attacker, target, pa.location ?? undefined);
    if (!r) {
      get().log(firedWeapon(attacker, target).type === 'ranged' ? 'Pas de ligne de vue (cible masquée).' : 'Cible hors de portée de mêlée.');
      set({ pendingAttack: null });
      return;
    }
    set({ pendingAttack: { ...pa, result: r.res, victimId: r.victim?.id } });
  },
  attackReroll: () => {
    const { battle, pendingAttack: pa } = get();
    if (!battle || !pa || !pa.result) return;
    // Relance si le jet d'attaque propre est raté (succès du d100 de l'attaquant), 1× max.
    if (!canReroll(!pa.result.attackerDetail?.success, !!pa.rerolled)) return;
    const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
    const target = battle.combatants.find((c) => c.id === pa.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1; // Dépense d'un point de Chance : relance le jet (LDB ch.17 l.24)
    const r = resolveAttack(get, attacker, target, pa.location ?? undefined);
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
    const weapon = firedWeapon(attacker, target); // arme tirée (munition combinée) — pas weapons[0]
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
    set({ pendingAttack: null });
    if (attacker && target && victim) {
      const weapon = firedWeapon(attacker, target);
      const prevActed = battle.acted; // pour la Frénésie : la 1re attaque du Round est GRATUITE
      applyAttackResult(get, set, attacker, victim, weapon, pa.result);
      // Maladresse d'un HÉROS (jet propre raté + double) → modale Tableau des Oups ! (LDB 14 l.53) ; elle interrompt le balayage.
      if (attacker.kind === 'hero' && attackerFumbled(pa.result)) {
        set({ pendingFumble: { combatantId: attacker.id, weapon, result: null }, pendingCleave: null });
      } else {
        // Frappe Mortelle (LDB 14 l.12 / 85 l.299) : démarre/poursuit le balayage d'un héros plus grand.
        maybeHeroCleave(get, set, attacker, victim, pa.result, wasChain);
      }
      // Frénésie (LDB 21 l.34) : un Test de Capacité de Combat GRATUIT chaque Round → la 1re attaque du
      // héros frénétique ne consomme PAS l'Action (il pourra réattaquer normalement ensuite).
      if (attacker.kind === 'hero' && attacker.frenzied && !attacker.frenzyFreeUsed && !wasChain) {
        attacker.frenzyFreeUsed = true;
        set({ battle: { ...get().battle!, acted: prevActed, log: [...get().battle!.log, `${attacker.name} : attaque libre de Frénésie (Action préservée).`] } });
      }
    }
  },
  attackCancel: () => {
    const pa = get().pendingAttack;
    if (pa?.fromCharge) return; // après une Charge, l'attaque est obligatoire (LDB 15-Dépl l.75)
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
  trampleRoll: () => {
    const { battle, pendingTrample: pt } = get();
    if (!battle || !pt || pt.result) return;
    const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
    const target = battle.combatants.find((c) => c.id === pt.targetId);
    if (!attacker || !target) return;
    set({ pendingTrample: { ...pt, result: resolveTrample(attacker, target, battleRng()) } });
  },
  trampleReroll: () => {
    const { battle, pendingTrample: pt } = get();
    if (!battle || !pt || !pt.result) return;
    if (!canReroll(!pt.result.attackerDetail?.success, !!pt.rerolled)) return; // jet propre raté, 1× max
    const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
    const target = battle.combatants.find((c) => c.id === pt.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1;
    set({ pendingTrample: { ...pt, result: resolveTrample(attacker, target, battleRng()), rerolled: true }, battle: { ...battle } });
  },
  trampleBonusSL: () => {
    const { battle, pendingTrample: pt } = get();
    if (!battle || !pt || !pt.result || !pt.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
    const target = battle.combatants.find((c) => c.id === pt.targetId);
    if (!attacker || !target || (attacker.fortune ?? 0) <= 0) return;
    attacker.fortune = (attacker.fortune ?? 0) - 1;
    const ad = pt.result.attackerDetail;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: ad.success, sl: ad.sl + 1, isDouble: isDoubleRoll(ad.roll) };
    set({ pendingTrample: { ...pt, result: rederivePassiveAttack(attacker, target, TRAMPLE_WEAPON, atk2, 'melee') }, battle: { ...battle } });
  },
  trampleForceSuccess: () => {
    const { battle, pendingTrample: pt } = get();
    if (!battle || !pt || !pt.result || !pt.result.attackerDetail) return;
    const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
    const target = battle.combatants.find((c) => c.id === pt.targetId);
    if (!attacker || !target || (attacker.resilience ?? 0) <= 0) return;
    attacker.resilience = (attacker.resilience ?? 0) - 1;
    const ad = pt.result.attackerDetail;
    const atk2: TestResult = { roll: ad.roll, target: ad.target, success: true, sl: Math.max(ad.sl, 1), isDouble: isDoubleRoll(ad.roll) };
    set({ pendingTrample: { ...pt, result: rederivePassiveAttack(attacker, target, TRAMPLE_WEAPON, atk2, 'melee') }, battle: { ...battle } });
  },
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
    if (!battle || battle.over || battle.acted || battle.moved) return; // Course = Marche + Action
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || isEngaged(active) || hasCondition(active, 'À Terre') || !canTakeAction(active)) return; // Engagé/À Terre → pas de Course (LDB 16 l.37)
    set({ pendingRun: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
  },
  runRoll: () => {
    const { battle, pendingRun: pr } = get();
    if (!battle || !pr || pr.result) return;
    const c = battle.combatants.find((x) => x.id === pr.combatantId);
    if (!c) return;
    set({ pendingRun: { ...pr, result: resolveRun(testValue(c, 'Athlétisme'), effectiveMovement(c), battleRng()) } });
  },
  runReroll: () => {
    const { battle, pendingRun: pr } = get();
    if (!battle || !pr || !pr.result) return;
    if (!canReroll(!pr.result.success, !!pr.rerolled)) return; // Test raté, 1× max
    const c = battle.combatants.find((x) => x.id === pr.combatantId);
    if (!c || (c.fortune ?? 0) <= 0) return;
    c.fortune = (c.fortune ?? 0) - 1;
    set({ pendingRun: { ...pr, result: resolveRun(testValue(c, 'Athlétisme'), effectiveMovement(c), battleRng()), rerolled: true }, battle: { ...battle } });
  },
  runForceSuccess: () => {
    const { battle, pendingRun: pr } = get();
    if (!battle || !pr || !pr.result || pr.result.success) return;
    const c = battle.combatants.find((x) => x.id === pr.combatantId);
    if (!c || (c.resilience ?? 0) <= 0) return;
    c.resilience = (c.resilience ?? 0) - 1;
    const m = effectiveMovement(c);
    set({ pendingRun: { ...pr, result: { ...pr.result, success: true, dr: Math.max(0, pr.result.dr), bonusCases: Math.max(pr.result.bonusCases, 2 * m) } }, battle: { ...battle } });
  },
  runConfirm: () => {
    const { battle, scene, pendingRun: pr } = get();
    if (!battle || !scene || !pr || !pr.result) return;
    const c = battle.combatants.find((x) => x.id === pr.combatantId);
    set({ pendingRun: null });
    if (!c) return;
    const range = effectiveMovement(c) + pr.result.bonusCases; // Marche + (Course + DR) (LDB 15 l.80)
    const blocked = occupied(battle, c);
    const log = [...battle.log, `${c.name} prend sa Course (Athlétisme ${pr.result.roll === 100 ? '00' : pr.result.roll}) : déplacement jusqu'à ${range} cases.`];
    set({ battle: { ...get().battle!, action: 'move', acted: true, reachable: reachable(scene, c.pos!, range, blocked), log } });
    bus.emit(EVT.SCENE_DIRTY);
  },
  runCancel: () => set({ pendingRun: null }),

  // ── Se relever d'À Terre (LDB 16-États l.37) : utilise le Mouvement pour se mettre debout. Impossible
  //    tant qu'on n'a pas regagné ≥1 PB (LDB 18 l.28 : à 0 PB on reste au sol). Ne consomme PAS l'Action. ──
  battleStandUp: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.moved) return;
    const active = activeCombatant(battle);
    if (!active || active.kind !== 'hero' || !hasCondition(active, 'À Terre') || active.wounds.current <= 0) return;
    removeCondition(active, 'À Terre');
    set({ battle: { ...battle, moved: true, action: null, log: [...battle.log, `${active.name} se relève.`] } });
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
  defenseRoll: () => {
    // « Défendre » : roule la défense du héros et résout le Test opposé (atk figé).
    const { battle, pendingDefense: pd } = get();
    if (!battle || !pd || pd.result) return;
    const attacker = battle.combatants.find((c) => c.id === pd.attackerId);
    const defender = battle.combatants.find((c) => c.id === pd.defenderId);
    if (!attacker || !defender) return;
    const dodgeMod = get().scene ? sceneCombatModifiers(get().scene!, get().gameTime).dodgeMod : 0; // neige : −20 à l'esquive (LDB 14 l.115-116)
    const def = rollMeleeDefender(defender, pd.mode, battleRng(), dodgeMod);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined, [], dodgeMod);
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
    const dodgeMod = get().scene ? sceneCombatModifiers(get().scene!, get().gameTime).dodgeMod : 0;
    const def = rollMeleeDefender(defender, pd.mode, battleRng(), dodgeMod);
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def, pd.mode, pd.location ?? undefined, [], dodgeMod);
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
    const res = finishMelee(attacker, defender, pd.weapon, pd.atk, def2, pd.mode, pd.location ?? undefined);
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
      applyAttackResult(get, set, attacker, target, pdv.weapon, pdv.res, deviate);
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

  // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15-Dépl l.84-89) ──
  battleDisengage: () => {
    const battle = get().battle;
    if (!battle || battle.over || battle.acted) return;
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
        reachable: reachable(scene, mover.pos!, effectiveMovement(mover), blocked),
        log: [...battle.log, `${mover.name} se désengage en sacrifiant son Avantage.`],
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

  // ── Résilience « Je ne faillirai pas ! » (LDB ch.17 l.72) : réussite garantie (opposé : DR +1) ──
  testForceSuccess: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.resilience ?? 0) <= 0) return;
    actor.resilience = (actor.resilience ?? 0) - 1;
    const sl = Math.max(pt.sl, pt.requireSL, 1);
    set({ pendingTest: { ...pt, success: true, sl }, party: [...party] });
  },
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
    const weapon = firedWeapon(attacker, target); // arme tirée (munition combinée) — pas weapons[0]
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
    const { battle, pendingCast: pc } = get();
    if (!battle || !pc || !pc.result) return;
    const caster = battle.combatants.find((c) => c.id === pc.casterId);
    const target = battle.combatants.find((c) => c.id === pc.targetId);
    const spell = findSpell(pc.spellLabel);
    if (!caster || !target || !spell || (caster.resilience ?? 0) <= 0) return;
    caster.resilience = (caster.resilience ?? 0) - 1;
    const ni = pc.focused ? 0 : spell.cn ?? 0;
    const cur = pc.result;
    const bonusNeeded = Math.max(1, ni - cur.sl); // au moins le NI ; on force aussi un d100 propre réussi
    const res = rederiveCastSL(caster, target, spell, { ...cur, roll: Math.min(cur.roll, cur.target) }, pc.missile, pc.focused, bonusNeeded);
    set({ pendingCast: { ...pc, result: res }, battle: { ...battle } });
  },
  disengageForceSuccess: () => {
    const { battle, pendingDisengage: pd } = get();
    if (!battle || !pd || !pd.result || !pd.def) return;
    const mover = battle.combatants.find((c) => c.id === pd.moverId);
    if (!mover || (mover.resilience ?? 0) <= 0) return;
    mover.resilience = (mover.resilience ?? 0) - 1;
    set({ pendingDisengage: { ...pd, result: 'success' }, battle: { ...battle } }); // l'emporte (LDB ch.17 l.72)
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
      log.push(`${mover.name} se désengage (Esquive réussie, +1 Avantage).`);
      set({
        battle: { ...battle, acted: true, action: 'move', reachable: reachable(scene, mover.pos!, effectiveMovement(mover), blocked), log },
      });
    } else if (pd.result === 'tie') {
      // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
      // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
      log.push(`${mover.name} : échange neutre, le désengagement échoue (personne ne prend l'avantage).`);
      set({ battle: { ...battle, acted: true, action: null, reachable: new Map(), log } });
    } else {
      foe.advantage += 1; // l'adversaire gagne +1, la fuite échoue (l.89)
      foe.gainedAdvThisRound = true;
      log.push(`${mover.name} échoue à se désengager ; ${foe.name} gagne +1 Avantage.`);
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
    log.push(`${mover.name} fuit — ${foe.name} frappe dans le dos : ${res.log}`);
    // « Un jet = une modale » : le héros voit le dé du coup dans le dos (jet subi).
    if (mover.kind === 'hero') pushReveal(set, { kind: 'backstab', title: 'Fuite — coup dans le dos', dice: res.attackerRoll, lines: [res.log] });
    if (res.hit && res.woundsLost) {
      loseWounds(mover, res.woundsLost); // perte de PB centralisée : −Avantage du fuyard + À Terre à 0 (LDB 15 l.40 / 18 l.28)
      foe.advantage += 1; // touché → +1 Avantage de plus (l.107)
      // Test de Calme Intermédiaire (+0) ou État Brisé (+1 par DR négatif).
      const calme = effectiveChar(mover, 'FM') + (mover.skills.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0);
      const ct = rollTest(calme, 'intermediaire', battleRng());
      const broken = ct.success ? 0 : 1 + Math.max(0, -ct.sl);
      if (broken) {
        addCondition(mover, 'Brisé', broken);
        log.push(`${mover.name} panique : ${broken} État(s) Brisé.`);
      }
      if (mover.kind === 'hero')
        pushReveal(set, { kind: 'calme', title: 'Test de Calme', dice: ct.roll, lines: [ct.success ? 'Sang-froid gardé.' : `Panique : ${broken} État(s) Brisé.`] });
    }
    const foes = (mover.engagedWith ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
    for (const f of foes) disengageFrom(mover, f);
    const blocked = occupied(battle, mover);
    // Fuite : déplacement jusqu'à la Course (2×Mouvement) MAIS dans la direction opposée à l'adversaire
    // (LDB 15-Déplacement l.109) — les cases qui rapprochent du `foe` sont exclues du déplaçable.
    set({ battle: { ...battle, action: 'move', reachable: fleeReachable(scene, mover.pos!, foe.pos!, effectiveMovement(mover) * 2, blocked), log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  },
  disengageCancel: () => set({ pendingDisengage: null }), // renonce avant tout jet : aucun coût

  /** « Lancer » : effectue le jet du test en attente (hors combat). */
  testRoll: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null) return; // déjà lancé
    const res: TestResult = rollTest(pt.skillValue, pt.difficulty);
    set({ pendingTest: { ...pt, roll: res.roll, sl: res.sl, isDouble: res.isDouble, success: res.success && res.sl >= pt.requireSL } });
  },

  /** Dépense un point de Chance du testeur pour relancer le jet (LDB Destin). */
  testReroll: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    // Relance réservée à un d100 propre RATÉ (roll > cible), une seule fois (LDB ch.12 l.56 + l.29-31).
    if (!canReroll(pt.roll > pt.target, !!pt.rerolled)) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.fortune ?? 0) <= 0) return;
    actor.fortune = (actor.fortune ?? 0) - 1;
    const res: TestResult = rollTest(pt.skillValue, pt.difficulty);
    set({
      pendingTest: { ...pt, roll: res.roll, sl: res.sl, isDouble: res.isDouble, success: res.success && res.sl >= pt.requireSL, rerolled: true },
      party: [...party],
    });
  },

  /** Chance « +1 DR » (LDB ch.17 l.26) : ajoute un Degré de Réussite au Test figé, cumulable. */
  testBonusSL: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return;
    const party = get().party;
    const actor = party.find((c) => c.id === pt.actorId);
    if (!actor || (actor.fortune ?? 0) <= 0) return;
    actor.fortune = (actor.fortune ?? 0) - 1;
    const sl = pt.sl + 1;
    set({ pendingTest: { ...pt, sl, success: pt.roll <= pt.target && sl >= pt.requireSL }, party: [...party] });
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
    const branch = effSuccess ? pt.onSuccess : pt.onFailure;
    if (branch && branch.length) applyEffects(get, set, branch);
  },
  closeDocument: () => set({ document: null }),

  log: (msg) => set((s) => ({ journal: [...s.journal.slice(-40), msg] })),

  advanceTime: (minutes) => {
    if (minutes <= 0) return;
    set({ gameTime: get().gameTime + minutes });
    bus.emit(EVT.TIME_ADVANCED, { minutes }); // #T3 (cascade) branchera ses déclencheurs sur les franchissements
  },
}));
