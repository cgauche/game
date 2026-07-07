/**
 * Flux de combat (tour par tour) extrait de store.ts pour le garder navigable.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 * Refacto pure -- comportement preserve.
 */
import type { GameState, BattleState, RevealEntry } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { LootGear, PendingCast, PendingDeviation, DeviationCtx, PendingBladeTrap, FreeAttackFreeze, BladeTrapFreeze, ScheduledRespawn, PendingReload } from './pendings';
import { describeReload } from './flowOutcomes';
import { Combatant, ItemInstance, HitLocation, Weapon, Difficulty, DIFFICULTY_MODIFIERS } from '../engine/types';
import { rule } from '../engine/policy';
import { battleRng } from './battleRng';
import { ev, evLines, type CombatEventKind } from './combatLog';
import { t as tr } from '../i18n'; // alias : `t` est un identifiant local très fréquent ici (cibles/jets)
import { TEMPO } from './tempo';
import { beatHold, approachMs, afterApproach } from './combatDirector';
import { facingToward, type Dir8 } from './dir8';
import { d10 } from '../engine/dice';
import {
  resolveMelee,
  resolveRanged,
  bestRangedDefense,
  rangedDefenseModes,
  rollRangedAttacker,
  defenseValue,
  combatValue,
  hasWeaponGroupSkill,
  attackModifiers,
  combineMods,
  rollMeleeAttacker,
  rollDisengageAttack,
  rollGrappleForce,
  attackWeapon,
  hitLocationByShape,
  locationLabel,
  reverseRoll,
  woundsFromHit,
  woundsAtCritLocation,
  rangeBandModifier,
  rangeBandName,
  belowMinRangeBand,
  resolveStrayRangedHit,
  resolveTrample,
  resolveMeleePassive,
  finishMelee,
  rollMeleeDefender,
  AttackResult,
  ModLine,
  outnumberMod,
  crowdMod,
  defenseModifiers,
  DEFENSE_LABEL,
} from '../engine/combat';
import { engage, isEngaged, decayEngagement, chargeAdvantage, disengageFrom, clearEngagementOf, areInContact, reachTiles, meleeReachTiles } from '../engine/engagement';
import { areGrappling, clearGrapple, grappleEnvMod } from '../engine/grapple';
import { gainAdvantage } from '../engine/advantage';
import { groupAdvantage } from '../engine/advantagePool';
import { campGain, campSpend, spendableAdvantage, reversalStealOne, roundEndAdvantageTransfer } from './combat/advantagePool';
import { sizeGap } from '../engine/size';
import { footprintTiles, combatDistance, sizeFootprint, footprintN, footprintChebyshev, occupiesTile } from './footprint';
import { isUnbreakable, resolveQualities, hasQuality, dangerousNine, magazineSize, hasBladeTrap, strikesLast, isFirearmQuality, reloadDRTarget } from '../engine/qualities/dispatch';
import { fireTriggers, applyTriggeredEffects, maneuverEffectsOf, freeAttackSourcesOf, triggerEffectOps } from './triggeredEffects';
import { hasStealAdvantage, stealsOneAdvantage, shieldAdvantageLevel, canCounterOnDefenseWin, talentCritExtraWounds, talentMagicResistance, hasBraveheart, outnumberCountBonus, reloadDRBonus, talentFearIndice, fleeMovementBonus, hasFocusHarmony, arcaneDomainIdOf, retreatAdvantageCost, canDisengageWithLessAdvantage, hasBattement, hasDistraire, canPreemptRanged } from '../engine/combatFeatures/dispatch';
import { QUALITY_IDS } from '../engine/qualities/ids';
import {
  isStupid,
  traitSeesInDark, bellicosePsychImmune, magicResistanceOf, flyMeters, runMultiplier,
  isSkittishMount, immuneToSpellDomain,
} from '../engine/traits/dispatch';
import {
  isMagicMissile,
  prayerWrathTriggered,
  castBlockedBy,
  prayerSinLock,
  hasTalent,
  evaluateMissile,
  spellRangeTiles, effectiveSpellRangeTiles,
  durationClockMinutes,
  castInfo,
  castingValue,
  castPenaltyMod,
  knowsCastingSkill,
  isDispellableSpell,
  resolveCounterspell,
  castTestOf,
  rederiveCastSL,
  zdeDiameterMeters,
  zdeRadiusTiles,
  isArcaneSpell,
  focusSkillFor,
  castLandProbability,
  magicDeviationEligible,
  ruleOfEightSeverity,
  sorceryMandatoryMiscast,
  type CastResult,
  type MissileResult,
  type CounterspellOutcome,
  type SpellLike,
} from '../engine/magic';
import { type OvercastSource, overcastSourceOf, overcastDurationParts } from '../engine/overcast';
import type { SpellRange } from '../engine/spellRange';
import { applyOps, resolveFormula, skillDRBonus, type GameOp, type OpsCtx, type Formula } from '../engine/ops';
import { applySummon, purgeExpiredSummons } from './summonFlow';
import type { ConjureForm } from '../engine/conjuredWeapons';
import { gainCorruption, corruptionTarget } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import { eligibleTalent, canCastFromGrimoire } from '../engine/grimoire';
import { rollMiscast, componentDowngrade, type MiscastSeverity } from '../engine/miscast';
import { opposedTest, rollTest, evaluateTest, resolveOpposed, isDoubleRoll, extendedTestStep, easeDifficulty } from '../engine/tests';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { partyBest, isSocialTest, socialPsychMod, socialPsychLabel, testValue, skillBaseValue } from '../engine/skills';
import { findManeuverById, findDomainById, findTalentById, diseaseLabel, psychologyLabel, refLabel, findPsychologyById, findVehicleById, findTrappingById, GRAPPLE, type SpellData, type ManeuverDef } from '../data';
import { applyHullCritical, exposedCrew } from '../engine/shipCritical';
import { endShanty, resolveShipUnits } from './shipCrew';
import { isInanimate, isStructure, structureAimCell, ramVsNonDoor } from '../engine/structures';
import { rollStructureCritical, structureCollapseLog, type StructureCriticalResolved } from '../engine/structureCritical';
import { actorIn } from './combatOrParty';
import { followsCharacterRules } from '../engine/relations';
import type { ShipRig } from '../engine/combat';
import { norm } from '../lib/normalize';
import { recomputeLoadout, weaponWithAmmo, selectedAmmo, consumeAmmo, ammoFamily, damageArmour, deviatableArmourAt, buildWeapon } from '../engine/items';
import { hasCapability } from '../engine/capabilities';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, hasCondition, cannotDefend, canTakeAction, applyZeroWounds, loseWounds, tickDeath, usesSuddenDeath, inDeathCondition, stacks, recoveredStacks, combatTestPenalty, incomingMeleeAdvantage, COND } from '../engine/conditions';
import { creatureAttacks, selfManeuversOf, selfManeuverApplicable, type CreatureAttack, type AttackKind } from '../engine/creatureAttacks';
import { hasActiveFlag } from '../engine/activeFlags';
import { suffocationTick } from '../engine/suffocation';
import { domainOnHitEffects, domainMissileMods, domainCasterOps, hasArcaneTalent, isSorceryDomain } from '../engine/domainAttributes';
import { losBlockingTiles, decayZones, zonesRoundTick, crossZones, discTiles, wallTiles, metersToTiles, resolveZoneMeters, type BattleZone } from './zones';
import { carryOverState } from '../engine/persistence';
import { rollContraction, contractDisease, contractionDue, applyContraction, hasActiveCapability, contagiousDiseases, DISEASE_DEFS } from '../engine/disease';
import { hasHealSkill, type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { openRest, placesOfKind } from './restFlow';
import { rollCritical, critWoundLocation, permanentAmputations, critImmediateSummary, type CriticalResolved } from '../engine/critical';
import { aaCriticalIsTrivial } from '../engine/aaCritical';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { traumaById, dechirureFractureFicheId, escalateSensoryLoss, consolidateAmputations, maxFingersLostForWeapon } from '../engine/trauma';
import { effectiveWeaponDamage, effectiveWeaponRange, isThrownWeapon, damageWeapon, destroyWeapon, isImprovised, solideSaveThreshold, effectiveWeapon, type WeaponContext } from '../engine/weaponDamage';
import { scatter } from '../engine/scatter';
import { TIME_COST } from '../engine/timeCost';
import { DAY_PHASES, minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { restRecovery } from '../engine/rest';
import { feedFromMeal } from '../engine/provisions';
import { runDailyUpkeep } from './upkeep';
import { findSpell, findSpellById } from '../data/index';

/** Résout un sort par ID STABLE. SOURCE UNIQUE de la résolution de sort dans le flux de combat.
 *  `Combatant.spells` = ids au runtime (créatures via spawn, héros via pregens) → AUCUN repli libellé
 *  (un fallback id→libellé = rétro-compatibilité, proscrite). Les libellés restent au seul niveau AUTHORING. */
const resolveSpell = (id: string) => findSpellById(id);
import { toBrass, fromBrass } from '../engine/money';
import { Scene, Effect, isWalkable, sceneMetresPerTile, isMerScene, setStructureDown, setTileCollapsed, parapetTilesAbove, heightAt } from './scene';
import { STEP_MAX_M } from './relief';
import { placeCombatant } from './spawn';
import { rollInitiative, combatOrder } from './combatSetup'; // relance d'Initiative par Round (LDB 13 l.43)
import { sweepDismountDeaths, mountedAttackMods, mountedDodgePenalty, mountMovement, mountOf, mountedCombatDistance, mountUp, mountableNear, movementRemaining, canMove, riderFearSize } from './mount';
import { lineOfSightCover, losClear, coverModifier, tilesBetween, tileSeenByFoe } from './lineOfSight';
import { shipOfCrew, mountedWeaponBears, servingCrewPresent, servablePostes, serveAtPoste } from './shipPostes';
import { crewedFireWeapon } from '../engine/crewedWeapon';
import { warMachineFireWeapon, warMachineCrewRequired, warMachineCrewPenalty } from '../engine/warMachineCrew';
import { fearSourceFor, sansPeurVs, failConditionAmount, isPsychImmune, isFrenzied, clearPsychOf, targetedTrigger, suppressSupersededPsych, psychResolution, gainPhobieIfThreshold, CIBLE_TYPES, CIBLE_LABEL, PsychType } from '../engine/psychology';
import { groupMatch } from '../engine/groups';
import { sceneCombatModifiers } from './sceneRules';
import { reachable, moveReachFor, flyReachable, pushAway, pullToward, pathTo, chebyshev, tileKey, Pt } from './path';
import { chooseEnemyAction, consumeAiRanking, type EnemyAction, type EnemyTurnInput, type CastableSpell, type AiCandTrace } from './ai';
import { resolveRun } from '../engine/movement';
import type { RNG } from '../engine/dice';
import { bus, EVT } from './bus';
import { emitCombatEvent } from './combatEvents';
import { massBattleTrackHit } from './massBattleFlow';
// Géométrie de combat extraite (placement/déplacement/zones/flanc-dos/vision) — importée pour
// l'usage interne ET ré-exportée (baril) pour les importeurs de combatFlow.
import {
  occupied, cannotStopOn, moveEnv, findFreeTile, displaceSmaller, removeEntity, removeEntities, inRect,
  applyZoneCrossings, isFlankOrRear, seesInDark, smokeOf,
} from './combatGeometry';
export * from './combatGeometry';
// --- Résolveur d'aire des munitions/armes à effet de zone (Tir de zone / Explosion) extrait → combatArea.ts (baril) ---
export * from './combatArea';
import { resolveWeaponArea, areaTargets, blastRadiusTiles, type AreaTargets } from './combatArea';
// --- Garde de reprise unique (« une modale / une pause bloque l'IA ? ») extraite → combatGate.ts (baril) ---
export * from './combatGate';
import { combatAdvanceBlocked, aiDriven } from './combatGate';
import { perceivedTiles } from './visionState';
import { cadenceAutoCombat } from '../engine/cadence';


// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

export function activeCombatant(battle: BattleState): Combatant | undefined {
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]);
}

// --- Effets de scène/campagne extraits → combatEffects.ts (baril) ---
export * from './combatEffects';
import { pushReveal, pushCombatStep, applyEffects, gearFromEffects, drainPendingLog, applyFall } from './combatEffects';
import { teamCommandMod } from './commandTeam';
// --- Manœuvres de créature (énumération + résolveurs roll/apply) extraites → combatManeuvers.ts (baril) ---
export * from './combatManeuvers';
// --- Refonte par coutures : registre de hooks de cycle de vie + mise en place (barils, modules FEUILLES) ---
export * from './combatHooks';
export * from './combatSetup';
import { runCombatHooks } from './combatHooks';
import { collectHeroRoundEndUpkeep } from './combat/roundHooks';
import { pilotedByHuman, humanControlled, controlsCombatant } from './netOwnership';
import { resolveRecoverTest } from './combat/recover';
import { fireTurnStartTriggers, fireTurnEndTriggers, resolveActGates } from './combat/turnHooks'; // effets de bord de tour (onTurnStart/onTurnEnd, dont la sortie de Frénésie en données) + gate d'action (Mandragore)
export { collectHeroRoundEndUpkeep } from './combat/roundHooks'; // baril : enregistre les hooks de franchissement de Round (effet de bord) + ré-export pour la cascade d'upkeep
export * from './combat/triggeredTest'; // baril : enregistre l'applier de cascade `triggeredTest` + installe le routeur de Test des triggers (effet de bord)
import { runCombatFlow } from './combat/triggeredTest'; // usage interne (applyCast : exécuteur de Flow de sort EN COMBAT, after-aware → canal de journal unifié + voie nested cast↔test)
export { aiMaybeFrenzy, resolvePsychAI, fireTurnStartTriggers, fireTurnEndTriggers, resolveActGates } from './combat/turnHooks'; // baril : enregistre les hooks de début de tour ennemi (effet de bord) + ré-export pour frenzy*.test / psych*.test + effets de bord de tour + gate d'action
// Sauvegardes post-touche en registre `HitModifier` ordonné (state/combat/hitModifiers, module FEUILLE).
import { runHitModifiers, martyrGuardOf, wardedAgainst } from './combat/hitModifiers'; // usage interne (applyAttackResult + applyCast)
export { runHitModifiers, registerHitModifier, martyrGuardOf, wardedAgainst, organicProjectile } from './combat/hitModifiers'; // baril : enregistre les modifiers (effet de bord) + ré-export pour applyCast / les tests (l11-sorts-zones, etc.)
import {
  emitCreatureAttackAnim, trampleTarget, bestDefenseMode,
  rollManeuverAttacker, maneuverAttackerDifficulty, resolveManeuver, hasFreeWeaponAttack, availableFreeAttackOps,
  resolveBattement, battementEligible, resolveDistraire, distraireEligible, distraireAttackValue, distraireDefenseValue,
  setManeuverPostHitHook,
} from './combatManeuvers';
import { spellFlowFor, spellOps, testFlow, flowHasFreeAttack, flattenFlow, conditionCtx, EMPTY_FLOW, type Flow, type EffectTrigger } from './flow';
import { startCascade, registerCascadeApplier } from './cascade';

/** L'État du défenseur accorde-t-il un Avantage à l'assaillant en mêlée ? Lu en DONNÉES
 *  (`incomingMeleeAdvantage` → `passive` `incomingAdvantage`, kind `etat`). Sonné : « +1 Avantage avant
 *  l'attaque » (LDB 16 l.123) — ce gain profite déjà au jet en cours puis persiste. À appeler une seule
 *  fois par attaque (avant le 1er jet ; pas sur une relance). Plus de branche par-nom de l'État. */
export function applyIncomingMeleeAdvantage(get: Get, attacker: Combatant, target: Combatant): void {
  const adv = attacker.weapons[0]?.type === 'melee' ? incomingMeleeAdvantage(target) : 0;
  if (adv > 0) {
    campGain(get, attacker, adv);
    attacker.gainedAdvThisRound = true;
  }
}

/** Arme effectivement tirée : mêlée au contact, distance sinon (Atout Pistolet pour tirer en Combat
 *  rapproché — LDB Armes l.297-298), AUGMENTÉE de la munition pour un héros (Dégâts + Atouts combinés).
 *  Centralisé pour que résolution / Chance / application voient la MÊME arme (munition, Empaleuse, reload). */
export function firedWeapon(attacker: Combatant, target: Combatant, weaponUid?: string, combatants?: Combatant[]): Weapon {
  // Adjacence depuis la MONTURE (cavalier/cible monté) quand la liste est fournie — un cavalier au contact
  // par sa monture doit choisir la mêlée, pas basculer en tir (LDB 14). Sans `combatants` → géométrie propre.
  const geom = (c: Combatant) => (combatants && c.mountId ? combatants.find((x) => x.id === c.mountId) ?? c : c);
  const adj = combatDistance(geom(attacker), geom(target)) <= meleeReachTiles(attacker.weapons); // Allonge incluse (RAW-3)
  // Choix explicite du joueur : l'arme du loadout actif portant cet uid (si présente) ; sinon auto-choix.
  const chosen = weaponUid ? attacker.weapons.find((w) => w.uid === weaponUid) : undefined;
  const base = chosen ?? attackWeapon(attacker.weapons, adj);
  const ammo = base.type === 'ranged' && attacker.kind === 'hero' ? selectedAmmo(attacker, base) : undefined;
  let w = ammo ? weaponWithAmmo(base, ammo) : base;
  // Pièce SERVIE en sous-effectif (poste) : bake les Défauts d'Arme d'équipe selon les servants APTES présents
  // (MDG ch.12 l.448-460) — recharge ×2 / Imprécise / Dangereuse, effectif COMPLET → tir net. `combatants` n'est
  // fourni QUE par les chemins de tir réels (résolution / aperçu / modale / re-jet) ; un chef sans poste → inchangé.
  if (combatants && attacker.mannedPoste) {
    const present = servingCrewPresent(attacker, combatants);
    if (present != null) w = crewedFireWeapon(w, present);
    // Machine de guerre ADE II (Qualité `equipe`, ch.08 l.233) : effectif BRUT du poste — le RAW ne pose
    // ICI aucune exigence de Compétence pour compter dans l'Équipe (≠ AA/MDG l.3900 ci-dessus) — 3ᵉ courbe,
    // jamais mêlée à celle d'AA (`warMachineFireWeapon` ne touche QUE `crewTeamPenalty`, pas la Recharge).
    if (warMachineCrewRequired(w) > 0) {
      const crew = (attacker.mannedPoste.crewIds ?? [])
        .map((id) => combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c);
      w = warMachineFireWeapon(w, exposedCrew(crew).length);
    }
  }
  // Règles d'arme CONTEXTUELLES de Groupe (LDB 62) repliées sur le profil : Lance de cavalerie hors Charge
  // → improvisée (l.59) ; Fléau sans la Spécialisation → Dangereuse + aucun Atout (l.146-147). Liées ICI —
  // funnel UNIQUE attaquant ⊕ arme ⊕ contexte — donc la MÊME arme transformée sert la touche/les Dégâts
  // (`resolveAttack` → `applyHit`) ET la Maladresse sur un RATÉ : `attackConfirm` et l'IA RE-DÉRIVENT l'arme
  // par `firedWeapon`, si bien que `dangerousNine` voit la Dangereuse du Fléau sans compétence.
  return effectiveWeapon(w, weaponContextOf(attacker, w, target));
}

/** Contexte d'usage d'une arme (règles d'arme CONTEXTUELLES de Groupe, LDB 62) dérivé de l'attaquant.
 *  SOURCE UNIQUE de la dérivation : `firedWeapon` (attaque principale) ET `resolveDualSecond` (2ᵉ frappe du
 *  Maniement de deux armes) l'appellent — aucune duplication de l'inférence `charged`/`mounted`/`hasGroupSkill`.
 *  `target` (optionnel — rétro-compat) sert le combat « au contact » (LDB 62 l.176) : une arme plus longue
 *  que Courte devient improvisée quand attaquant et cible sont entrés dans la longueur d'arme l'un de l'autre. */
export function weaponContextOf(attacker: Combatant, w: Weapon, target?: Combatant): WeaponContext {
  return {
    charged: !!attacker.chargedThisTurn,
    mounted: !!attacker.mountId,
    hasGroupSkill: hasWeaponGroupSkill(attacker, w, w.type === 'ranged' ? 'ranged' : 'melee'),
    auContact: !!target && areInContact(attacker, target),
    improvised: !!target && ramVsNonDoor(w, target), // Bélier hors-porte → improvisée (ADE II ch.08 l.249)
  };
}

/** Tir héros refusé faute de RESSOURCE : arme à défaut Recharge non chargée (LDB 63 l.28-29) ou plus
 *  de munition compatible — `null` si le tir peut partir. Concern ORTHOGONAL à la géométrie (`attackPlan`),
 *  rejoué À L'IDENTIQUE par le clic (`battleClickEntity`) ET le survol (`hoverTargeting`) pour que
 *  l'affordance ne mente jamais : un réticule de tir sur une arbalète vide DOIT dire « recharger », pas
 *  proposer une attaque qui se solderait par un log silencieux. Mêlée / pas d'arme à distance → `null`
 *  (la Recharge ne concerne que l'arme effectivement tirée, `firedWeapon`). */
export function firedAttackBlock(get: Get, active: Combatant, target: Combatant, weaponUid?: string): { reason: 'unloaded' | 'noammo' | 'arc' | 'sous-effectif' | 'portee-min'; detail: string } | null {
  if (active.kind !== 'hero') return null;
  const b = get().battle;
  const distanceTiles = b ? mountedCombatDistance(b, active, target) : combatDistance(active, target); // géométrie monture
  const adj = distanceTiles <= meleeReachTiles(active.weapons); // même arbitrage d'arme que firedWeapon
  // Arme effectivement testée : choix EXPLICITE (poste servi → `weaponUid`) sinon auto selon la distance —
  // MÊME arbitrage que `firedWeapon` (le gate ne doit pas mentir sur une AUTRE arme que celle qui tirera).
  const w = (weaponUid ? active.weapons.find((x) => x.uid === weaponUid) : undefined) ?? attackWeapon(active.weapons, adj);
  // Machine de guerre ADE II (Qualité `equipe`, ch.08 l.233) sous LA MOITIÉ de l'Équipe requise : INUTILISABLE
  // — mêlée (bélier, Force) ET distance, donc AVANT le early-return ranged-only ci-dessous.
  const required = warMachineCrewRequired(w);
  if (required > 0 && active.mannedPoste) {
    const crew = (active.mannedPoste.crewIds ?? []).map((id) => b?.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c);
    if (warMachineCrewPenalty(exposedCrew(crew).length, required).unusable)
      return { reason: 'sous-effectif', detail: `${active.name} : Équipe trop réduite pour servir ${w.name}.` };
  }
  if (w.type !== 'ranged') return null;
  if ((w.reload ?? 0) > 0 && !active.loaded) return { reason: 'unloaded', detail: `${active.name} doit recharger ${w.name}.` };
  // Munition requise UNIQUEMENT si l'arme en consomme (famille de munition) ; un tir sans munition suivie
  // (ex. arme sans Groupe) reste possible. `ammoFamily` falsy ⇒ pas de suivi de munition (cf. compatibleAmmo).
  if (ammoFamily(w.subType) && !selectedAmmo(active, w)) return { reason: 'noammo', detail: `${active.name} n'a plus de munitions pour ${w.name}.` };
  // PORTÉE MINIMALE d'une machine de siège (ADE II ch.08 l.251/253) : REFUS (pas un malus) si la cible est
  // plus PROCHE que la bande minimale de l'arme — machines à distance : pas de Bout Portant (l.253) ;
  // trébuchet/mortier : rien sous la Portée Courte (l.251). DONNÉE générique `w.minRangeBand` (pas un flag par-machine).
  if (w.minRangeBand) {
    const rangeM = effectiveWeaponRange(w, selectedAmmo(active, w)?.ammoRangeMod, () => bonus(effectiveChar(active, 'F')));
    if (rangeM != null && belowMinRangeBand(distanceTiles, rangeM, w.minRangeBand))
      return { reason: 'portee-min', detail: `${w.name} ne peut pas tirer d'aussi près (${rangeBandName(distanceTiles, rangeM) ?? 'trop proche'}).` };
  }
  // Pièce d'artillerie à ARC (poste) : ne porte que dans son arc. NAVAL = relatif au cap de la coque support
  // (`shipOfCrew` → `facing[ship.id]`, `ship.pos`). EMPLACEMENT AU SOL (siège) : pas de coque (`shipOfCrew`
  // → undefined) → l'arc pivote avec l'orientation-monde ET la position DU CHEF lui-même. KIND-AGNOSTIQUE.
  // `mountSide` absent (arme non montée / pivot libre) → aucune contrainte. NB : l'IA aura le MÊME prédicat.
  if (w.mountSide && target.pos) {
    const battle = get().battle;
    const ship = battle ? shipOfCrew(battle.combatants, active.id) : undefined;
    const heading = ship ? get().facing[ship.id] : get().facing[active.id];
    const pos = ship?.pos ?? active.pos;
    if (!mountedWeaponBears(w, heading, pos, target.pos))
      return { reason: 'arc', detail: `${w.name} ne porte pas dans cet arc (${w.mountSide}).` };
  }
  return null;
}

/** Résout une attaque (le JET) SANS l'appliquer — pour le flux par modale (« Lancer »
 *  puis éventuel point de Chance). Retourne null si la cible est hors de portée de mêlée. */
/** Tir dans la mêlée (LDB 14 l.136) : si la pénalité de −20 a transformé une réussite en échec, le
 *  tir touche un allié intercalé de la cible. Retourne l'allié (le 1er Engagé côté tireur, « au
 *  hasard » approximé — le cas courant n'a qu'un allié au contact), ou null si non applicable. */
export function strayShotVictim(res: AttackResult, attacker: Combatant, target: Combatant, battle: BattleState): Combatant | null {
  if (res.hit || !res.attackerDetail) return null;
  if (res.attackerRoll > res.attackerDetail.target + 20) return null; // n'aurait pas touché même sans le −20
  const allies = (target.engagedWith ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && c.kind === attacker.kind && !isOutOfAction(c));
  return allies[0] ?? null;
}

/** Cibles éligibles d'un « Tir dans le tas » (LDB 14 l.136/146) : TOUT le monde serré autour de la
 *  cible (au contact, Chebyshev — diagonale incluse), vivant et positionné, LE TIREUR EXCLU — les
 *  DEUX camps : « vous touchez l'un des adversaires de la cible au hasard » → ça peut être un de vos
 *  PROPRES alliés engagés dans la mêlée (tir fratricide), pas forcément un ennemi. Un tir réussi en
 *  touche UNE au hasard. Base partagée avec le futur surlignage des zones d'effet (Explosion / sorts). */
export function crowdEligible(battle: BattleState, attacker: Combatant, target: Combatant): Combatant[] {
  return battle.combatants.filter(
    (c) => c.id !== attacker.id && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1,
  );
}

// smokeOf → combatGeometry.ts

/** Bénédiction de Protection (LDB 41 — L13) : si la cible est bénie, l'attaquant doit réussir un
 *  Test de FM Accessible (+20) pour OSER attaquer — joué à la DÉCLARATION ; sur un échec, « ils
 *  doivent choisir une cible ou une Action différente » (rien n'est consommé). */
export function attackWardGate(attacker: Combatant, target: Combatant, rng: RNG = battleRng()): { allowed: boolean; lines: string[] } {
  if (!hasActiveFlag(target, 'attackWardFM')) return { allowed: true, lines: [] };
  const t = rollTest(effectiveChar(attacker, 'FM'), 'accessible', rng);
  if (t.success) {
    return { allowed: true, lines: [tr('cs.shameOvercome', { name: attacker.name, roll: t.roll, target: t.target, foe: target.name })] };
  }
  return {
    allowed: false,
    lines: [
      tr('cf.wardTestFail', { name: attacker.name, roll: t.roll, target: t.target }),
      tr('cs.shameBlocked', { name: attacker.name, foe: target.name }),
    ],
  };
}

// applyZoneCrossings → combatGeometry.ts

/** Surprise au début du combat (LDB 13 l.52-81) : le camp pris en EMBUSCADE (`surprisedSide`) fait, pour
 *  chaque combattant, un Test opposé de Perception vs la Discrétion la plus FAIBLE des embusqueurs (l.77).
 *  Le Test (héros-atteignable) est ROUTÉ par l'exécuteur de Flow CADENCE-AWARE (`runCombatFlow`) : héros en
 *  cadence MANUELLE → étape de cascade INFLUENÇABLE (Chance/Résilience) ; embusqué ennemi / héros auto → jet
 *  inline. L'embusqueur (`sneak`) est le `caster` → l'opposition jette SA Discrétion (figée), Furtif (LDB 85)
 *  baké en `attackerBonusSL`. Sur défaite du guetteur (branche `fail`) : Vigilance (talent, LDB 10) tente un
 *  Test de Perception (+0) pour ignorer la Surprise, sinon l'État `Surpris`. Appelée APRÈS la pose du `battle`
 *  (sujet HORS-TOUR : Round 1 pas encore commencé) ; à la fermeture de la cascade, `resumeSuspendedAI` est un
 *  no-op (turn -1 = aucun acteur). Plusieurs guetteurs testent : chaque `runCombatFlow` APPEND son étape à la
 *  MÊME cascade `purpose:'combat'`. Les lignes inline (ennemi/auto) partent dans la file différée → drainées ici. */
export function applySurprise(get: Get, set: SetFn, surprisedSide: 'party' | 'enemies'): void {
  const battle = get().battle;
  if (!battle) return;
  const surprisedKind = surprisedSide === 'party' ? 'hero' : 'enemy';
  const surprised = battle.combatants.filter((c) => (surprisedKind === 'hero' ? c.kind === 'hero' : c.kind !== 'hero') && !isOutOfAction(c));
  const ambushers = battle.combatants.filter((c) => (surprisedKind === 'hero' ? c.kind !== 'hero' : c.kind === 'hero') && !isOutOfAction(c));
  if (!surprised.length || !ambushers.length) return;
  // L'embusqueur de référence = la Discrétion la plus FAIBLE du groupe (l.77). Furtif (LDB 85
  // p.339) : « Ajoutez son bonus d'Agilité au DR de tous ses Tests de Discrétion » → attackerBonusSL.
  const sneak = ambushers.reduce((a, b) => (testValue(b, 'discretion') < testValue(a, 'discretion') ? b : a));
  const sneakDR = skillDRBonus(sneak, 'discretion'); // Furtif : +Bonus d'Agilité au DR (donnée : passive skillDRBonus)
  // Conséquence d'une défaite du guetteur : l'État Surpris. Vigilance (talent `vigilance`) interpose AVANT un
  // Test de Perception (+0) cadence-aware — réussite = pas de Surprise, échec = Surpris.
  // `sense` NON posé sur les deux Tests ci-dessous (Surprise ET Vigilance) — DÉCISION, pas un oubli : LDB 13
  // l.53-59 mélange des déclencheurs visuels ET auditifs (dans le noir/sous un épais brouillard = la vue est
  // spécifiquement défaite, l'ouïe reste le dernier recours ; détonations/rixe = indices sonores). Un guetteur
  // Sourd reste donc VULNÉRABLE par défaut (`senseMatches`, trauma.ts : sens du Test inconnu → pénalité
  // appliquée, conservateur) plutôt qu'exempté en bloc — cohérent avec les scénarios d'embuscade cités.
  const surprise: Flow = { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', name: COND.surpris, value: 1 }] } };
  const onLose: Flow = {
    kind: 'if', cond: { kind: 'has', who: 'target', what: 'talent', value: 'vigilance' },
    then: testFlow({ skill: 'perception', difficulty: 'intermediaire', label: 'Vigilance' }, EMPTY_FLOW, surprise),
    else: surprise,
  };
  for (const c of surprised) {
    // Embusqueur (Discrétion, FIGÉE comme attaquant opposé) vs guetteur (Perception, le défenseur qui jette).
    const flow = testFlow(
      { skill: 'perception', difficulty: 'intermediaire', label: 'Surprise',
        opposed: { attacker: 'Ag', attackerSkill: 'discretion', attackerLabel: 'Discrétion', attackerBonusSL: sneakDR } },
      EMPTY_FLOW, // le guetteur résiste → pas de Surprise
      onLose,
    );
    runCombatFlow({ mode: 'combat', get, set, target: c, caster: sneak, label: 'Surprise' }, flow);
  }
  // Inline (embusqué ennemi / héros auto) : les lignes partent dans la file différée → on les folde dans le
  // journal de combat. Le héros manuel suspend (cascade) et n'en pousse aucune.
  const drained = drainPendingLog(get, set);
  if (drained.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...drained] } });
}

// DIR8_RING / isFlankOrRear → combatGeometry.ts

/** Environnement d'attaque (LdV/couvert/météo/mouvement/tir-mêlée/surnombre/monture) — SOURCE UNIQUE
 *  des modificateurs positionnels/scéniques, partagée par la RÉSOLUTION (`resolveAttack`) ET l'APERÇU
 *  (`previewAttack`), pour que l'aperçu affiche EXACTEMENT ce que le jet appliquera (R4). Pur (lit l'état).
 *  `blocked` = tir sans Ligne de Vue ; `inMelee`/`crowd`/`cm`/`sc` servent à la résolution (tir dévié,
 *  « Tirer dans le tas », dodge météo) — l'aperçu n'utilise que `env`/`blocked`. */
// seesInDark → combatGeometry.ts

export interface AttackEnv { env: ModLine[]; blocked: boolean; inMelee: boolean; crowd: Combatant[]; cm: ModLine | null; sc: ReturnType<typeof sceneCombatModifiers>; flankRear?: boolean; }
export function attackEnv(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  opts?: { intoCrowd?: boolean; heldGround?: boolean },
): AttackEnv {
  const scene = get().scene!;
  const battle = get().battle!;
  const sc = sceneCombatModifiers(scene, get().gameTime);
  const env: ModLine[] = [];
  // Empoignade (LDB 14 l.169) : un attaquant NON partie à l'Empoignade gagne +20 (cible au plus FAIBLE
  // Avantage des deux Empoignés) ou +10 (au plus FORT) pour la toucher — mêlée comme tir.
  const gm = grappleEnvMod(attacker, target, battle.combatants);
  if (gm) env.push(gm);
  if (weapon.type === 'ranged') {
    const occupants = battle.combatants
      .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
      .map((c) => c.pos!);
    // Tir sur une STRUCTURE : on vise sa FACE exposée (la case côté tireur) — sinon l'arête de la structure
    // elle-même coupe la LdV vers la case DERRIÈRE elle (un canon ne « voit pas à travers » la porte qu'il vise).
    const losTo = isStructure(target) ? structureAimCell(attacker.pos!, target) : target.pos!;
    const los = lineOfSightCover(scene, attacker.pos!, losTo, occupants, smokeOf(battle));
    if (los.blocked) return { env, blocked: true, inMelee: false, crowd: [], cm: null, sc }; // pas de LdV (LDB 13 l.123)
    // Commandant d'équipe (AA l.4373-4379) : un chef de pièce dirigé tire au score de Projectiles de son
    // commandant — re-validé ICI (vivant + à portée de voix) → un delta sur la base du chef (aperçu ET résolution).
    const tcMod = teamCommandMod(attacker, weapon, battle.combatants);
    if (tcMod) env.push(tcMod);
    if (los.cover !== 'none') env.push({ label: tr('cf.coverLabel', { cover: los.cover }), value: coverModifier(los.cover) });
    // Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne : annule la pénalité d'obscurité.
    if (sc.concealed && !seesInDark(attacker)) env.push({ label: sc.label || 'Obscurité', value: -10 }); // cible dissimulée : Complexe (LDB 14 l.75)
    else if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod }); // tempête/neige (l.108-116)
    // Tir en bougeant (LDB 14 l.101) : −10 si l'on bouge ET tire au même Round. Le Mouvement étant
    // DÉCOMPOSABLE (on peut bouger APRÈS le tir), un HÉROS qui garde sa mobilité encaisse le −10 par défaut ;
    // il ne l'évite qu'en décidant de tirer IMMOBILE (heldGround → consomme son Mouvement, cf. attackConfirm)
    // — ou s'il NE PEUT PAS bouger (Mouvement effectif 0 : Empêtré/Surpris…), il est immobile d'office.
    // L'IA/ennemi (pas d'option) : −10 seulement s'il a effectivement bougé ce Tour.
    const mobileShot = attacker.kind === 'hero'
      ? (battle.movementUsed > 0 || (mountMovement(battle, attacker) > 0 && !opts?.heldGround))
      : battle.movementUsed > 0;
    if (mobileShot) env.push({ label: 'Tir en bougeant', value: -10 });
    // Tir dans la mêlée (LDB 14 l.134) : la cible est Engagée avec un allié du tireur. Règle optionnelle
    // « Tir dans un corps à corps » (LDB 14 l.133) : si désactivée, pas de −20 NI d'artefact d'aperçu
    // (`inMelee` reste false → pas de tir égaré non plus).
    const inMelee = !!rule('combat-ranged-melee-penalty') && (target.engagedWith ?? []).some((id) => {
      const ally = battle.combatants.find((c) => c.id === id);
      return !!ally && ally.kind === attacker.kind;
    });
    if (inMelee && !opts?.intoCrowd) env.push({ label: 'Tir dans la mêlée', value: -20 }); // « Tirer dans le tas » REMPLACE ce −20 par le bonus (l.136)
    env.push(...mountedAttackMods(battle, attacker, target, 'ranged')); // Combat monté : +20 cible plus petite que la monture (LDB 14 l.217)
    // « Tirer dans le tas » (LDB 14 l.136/146) : bonus +20/+40/+60 selon la taille du groupe serré.
    const crowd = opts?.intoCrowd ? crowdEligible(battle, attacker, target) : [];
    const cm = opts?.intoCrowd ? crowdMod(crowd.length) : null;
    if (cm) env.push(cm);
    return { env, blocked: false, inMelee, crowd, cm, sc };
  }
  // Mêlée : la météo (tempête/neige) pénalise l'attaque ; la neige pénalise aussi l'esquive (dodgeMod).
  if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod });
  // Flanc/dos (LDB 14 l.91) : +20 pour attaquer un adversaire ENGAGÉ dans le dos ou sur les côtés —
  // orientation du défenseur AVANT cette attaque (il se retourne vers l'attaquant ENSUITE, applyAttackResult).
  const tFacing = get().facing?.[target.id]; // `facing` peut être absent (état épars / contexte sans orientation)
  const flankRear = !!(tFacing && isEngaged(target) && attacker.pos && target.pos && isFlankOrRear(tFacing, facingToward(target.pos, attacker.pos)));
  if (flankRear) env.push({ label: 'Flanc/dos', value: 20 });
  // En contrebas (Difficultés de Combat) : l'attaquant le PLUS BAS subit −10 (la hauteur ne donne AUCUN
  // bonus « high-ground » — RAW : seul ce malus existe). Comparaison de la hauteur métrique des surfaces.
  if ((target.pos?.h ?? 0) - (attacker.pos?.h ?? 0) > STEP_MAX_M) env.push({ label: 'En contrebas de la cible', value: -10 });
  // Surnombre (LDB 14 l.85/92) : attaquants du camp de l'attaquant au contact de la cible (2 → +20, 3+ → +40).
  const onm = outnumberMod(battle.combatants.filter((c) => c.kind === attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1).length);
  if (onm) env.push(onm);
  env.push(...mountedAttackMods(battle, attacker, target, 'melee')); // Combat monté : +20 cible < monture / −10 viser le cavalier (LDB 14 l.217/219)
  return { env, blocked: false, inMelee: false, crowd: [], cm: null, sc, flankRear };
}

export function resolveAttack(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  fromCharge?: boolean,
  intoCrowd?: boolean,
  heldGround?: boolean,
  weaponUid?: string,
  withhold?: boolean, // « Retenir ses coups » (Aux Armes l.2503-2505) — déclaré avant le jet, mêlée seule
): { res: AttackResult; weapon: Weapon; victim?: Combatant } | null {
  const battle = get().battle!;
  // Distance de COMBAT depuis la géométrie de la MONTURE (cavalier/cible monté, LDB 14) : sinon une attaque
  // de charge qui rapproche la MONTURE au contact serait jugée hors d'allonge sur le cavalier 1×1 → `null`,
  // et la cascade d'attaque déjà ouverte resterait ORPHELINE (soft-lock de fin de tour).
  const dist = mountedCombatDistance(battle, attacker, target);
  const weapon = firedWeapon(attacker, target, weaponUid, battle.combatants); // arme choisie + munition + sous-effectif du poste servi
  if (dist > reachTiles(weapon) && weapon.type === 'melee') return null; // hors de portée de mêlée (Allonge incluse, RAW-3)
  // (Sonné → +1 Avantage à l'attaquant en mêlée, LDB 16 l.123 : DÉJÀ géré par le flux d'attaque existant.)
  const { env, blocked, inMelee, crowd, cm, sc, flankRear } = attackEnv(get, attacker, target, weapon, { intoCrowd, heldGround });
  if (blocked) return null; // pas de Ligne de Vue (mur/décor/fumée) → pas de tir (LDB 13-Combat l.123)
  if (weapon.type === 'ranged') {
    // « Tirer dans le tas » (LDB 14 l.136/146) : un ennemi AU HASARD est touché ; succès dû au seul bonus = 0 DR.
    if (intoCrowd) {
      const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env);
      if (res.hit && crowd.length) {
        const victim = crowd[battleRng().int(0, crowd.length - 1)]; // « appliqué au hasard parmi les cibles éligibles »
        const ad = res.attackerDetail!;
        const rescued = res.attackerRoll > ad.target - (cm?.value ?? 0); // aurait échoué sans le bonus → 0 DR (l.146)
        const stray = resolveStrayRangedHit(attacker, victim, weapon, res.attackerRoll, rescued ? res.attackerRoll : ad.target);
        stray.log = tr('cf.strayHit', { name: victim.name, rescued: rescued ? tr('cf.fragRescued') : '' });
        return { res: stray, weapon, victim };
      }
      return { res, weapon };
    }
    // Défense RAW contre le tir (Protectrice 2+ / Bout Portant / tireur Engagé) : un défenseur NON-héros
    // oppose AUTOMATIQUEMENT sa meilleure défense (la Ligne de Vue est acquise — `blocked` a déjà rendu
    // null). Un héros défenseur passera par la modale réactive (étape T3) → pas d'auto-défense ici.
    const rd = target.kind === 'hero' ? undefined : bestRangedDefense(attacker, target, weapon, dist);
    const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env, rd);
    // Tir dans la mêlée (LDB 14 l.136) : si le −20 a transformé une réussite en échec, le tir dévie
    // et frappe un allié intercalé (touche acquise, dégâts recalculés sur l'allié).
    if (inMelee && !res.hit) {
      const ally = strayShotVictim(res, attacker, target, battle);
      if (ally) return { res: resolveStrayRangedHit(attacker, ally, weapon, res.attackerRoll, res.attackerDetail!.target + 20), weapon, victim: ally };
    }
    return { res, weapon };
  }
  // Charge montée (LDB 14 l.223) : pour les DÉGÂTS, on substitue la Force (Bonus) et la Taille de la monture.
  // Combat monté (l.225) : un défenseur à cheval subit −20 à l'Esquive (sauf Acrobaties équestres) → dodgeMod.
  const chargeMount = fromCharge ? mountOf(battle, attacker) : undefined;
  const dmgProxy = chargeMount ? { sb: bonus(effectiveChar(chargeMount, 'F')), size: chargeMount.size } : undefined;
  return { res: resolveMelee(attacker, target, weapon, battleRng(), { defense: bestDefenseMode(target), location, env, dodgeMod: sc.dodgeMod + mountedDodgePenalty(target), dmgProxy, withhold, flankRear }), weapon };
}

/** 2ᵉ attaque du Maniement de deux armes (LDB 10 l.638). Jet d'attaquant IMPOSÉ : `reverseRoll(mainRoll)`,
 *  ou `critValue` (valeur du tableau des Critiques) si la 1ʳᵉ frappe était un Critique. Le `target` (valeur à
 *  toucher) inclut déjà la pénalité de main secondaire (l'arme `off` porte `hand:'off'`, cf. plan #1). Le
 *  défenseur fait un NOUVEAU jet de défense (l.638 « opposée à un nouveau lancer de défense »). */
export function resolveDualSecond(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  offWeapon: Weapon,
  mainRoll: number,
  opts?: { critValue?: number; location?: HitLocation },
): AttackResult {
  // Règles d'arme contextuelles de Groupe (LDB 62) AUSSI pour la 2ᵉ frappe : Fléau sans Spé → Dangereuse +
  // aucun Atout, Lance hors Charge → improvisée. Replié AVANT touche/Dégâts (même `weaponContextOf` que
  // `firedWeapon` — source unique du ctx) car `applyAttackResult` fait confiance au `res` pré-calculé.
  offWeapon = effectiveWeapon(offWeapon, weaponContextOf(attacker, offWeapon, target));
  const { env } = attackEnv(get, attacker, target, offWeapon, {});
  const mods = attackModifiers(attacker, target, offWeapon, { kind: 'melee', location: opts?.location, env });
  const toHit = combatValue(attacker, 'melee', offWeapon) + combineMods(mods);
  const atkRoll = opts?.critValue != null ? opts.critValue : reverseRoll(mainRoll);
  const atk = evaluateTest(atkRoll, toHit); // { roll, target, success, sl, isDouble }
  const mode = (cannotDefend(target) || isInanimate(target)) ? 'none' : bestDefenseMode(target); // OBJET INANIMÉ (structure/véhicule/affût) : jamais de défense
  if (mode === 'none') return resolveMeleePassive(attacker, target, offWeapon, atk, opts?.location, env);
  const def = rollMeleeDefender(target, mode, battleRng(), 0, target.weapons[0], offWeapon); // NOUVEAU jet de défense (LDB 10 l.638)
  return finishMelee(attacker, target, offWeapon, atk, def, mode, opts?.location, env);
}

/** Cibles VALIDES de la 2ᵉ frappe du Maniement de deux armes (LDB 10 l.638 : « un adversaire disponible de
 *  votre choix ») : adversaires encore actifs, à portée de l'arme secondaire (Allonge). Sans position connue
 *  (tests purs) → non filtré sur la distance. */
export function dualStrikeTargets(battle: BattleState, attacker: Combatant, offWeapon: Weapon): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c)) return false;
    if (!attacker.pos || !c.pos) return true;
    return combatDistance(attacker, c) <= reachTiles(offWeapon);
  });
}

/** Aperçu d'attaque (R4) : la valeur de toucher (cible du d100) et sa décomposition de modificateurs, SANS
 *  tirer le dé. Rejoue le MÊME `attackEnv` + `attackModifiers` que la résolution → l'aperçu ne ment jamais.
 *  `inRange` = cible atteignable (mêlée : Allonge ; tir : dans une bande de portée) ; `blocked` = tir sans LdV. */
export interface AttackPreview {
  weapon: Weapon; kind: 'melee' | 'ranged'; inRange: boolean; blocked: boolean; target: number; mods: ModLine[];
  /** Valeur de compétence NUE (combatValue) — décomposition `target = base + Σmods` pour l'affichage. */
  base: number;
  /** Dégâts d'arme (Force incluse) AVANT le DR du jet. La Blessure réelle = `dmg` + DR − `soak` (plancher 1). */
  dmg: number;
  /** Encaissé par la cible à la localisation visée (Bonus d'Endurance + PA, réduction d'armure des Atouts déduite). */
  soak: number;
}
export function previewAttack(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  opts?: { intoCrowd?: boolean; heldGround?: boolean; weaponUid?: string },
): AttackPreview {
  // Distance de COMBAT depuis la géométrie de la MONTURE pour un cavalier/cible monté (LDB 14) — le reach
  // de mêlée et la bande de portée se mesurent du couple (empreinte de la monture), pas du cavalier 1×1.
  const battle = get().battle;
  const dist = combatDistance((battle && mountOf(battle, attacker)) || attacker, (battle && mountOf(battle, target)) || target);
  const weapon = firedWeapon(attacker, target, opts?.weaponUid, get().battle?.combatants);
  const kind: 'melee' | 'ranged' = weapon.type === 'ranged' ? 'ranged' : 'melee';
  // Estimation de dégâts (R4) : dégâts d'arme (Force incluse) et encaissé de la cible. Le `soak` est dérivé
  // de `woundsFromHit` (oracle) avec un dégât large → capture exactement PA + réduction d'armure (Perforante…).
  const dmg = effectiveWeaponDamage(weapon, bonus(effectiveChar(attacker, 'F')));
  const base = combatValue(attacker, kind, weapon);
  const loc = location ?? 'corps';
  const soak = (dmg + 20) - woundsFromHit(weapon, target, loc, dmg + 20);
  if (kind === 'melee' && dist > reachTiles(weapon)) return { weapon, kind, inRange: false, blocked: false, target: 0, base, mods: [], dmg, soak };
  const { env, blocked } = attackEnv(get, attacker, target, weapon, opts);
  if (blocked) return { weapon, kind, inRange: true, blocked: true, target: 0, base, mods: [], dmg, soak };
  const distanceTiles = kind === 'ranged' ? dist : undefined;
  const mods = attackModifiers(attacker, target, weapon, { kind, location, distanceTiles, env });
  const target0 = base + combineMods(mods);
  const rangeM = effectiveWeaponRange(weapon, selectedAmmo(attacker, weapon)?.ammoRangeMod, () => bonus(effectiveChar(attacker, 'F'))); // Portée résolue (jet `{bf}` → BF×N) + modificateur de la munition sélectionnée ; null = hors bande
  const inRange = kind === 'ranged' ? (rangeM != null && rangeBandModifier(dist, rangeM) != null) : dist <= reachTiles(weapon);
  return { weapon, kind, inRange, blocked: false, target: target0, base, mods, dmg, soak };
}

/** Ligne ADVERSE du panneau de jet pré-rempli (modale d'attaque) : ce que le joueur est en droit
 *  de savoir de la défense à venir — la compétence probable (« Parade » / « Esquive ») et ses
 *  bonus/malus visibles (Avantage, États, Sur la défensive…), SANS la valeur de compétence ni
 *  l'encaissé. Compétence = meilleure défense (`bestDefenseMode`) ; Bestial → Esquive seule. */
export function previewDefense(defender: Combatant): { label: string; mods: ModLine[] } {
  const mode = bestDefenseMode(defender);
  return { label: DEFENSE_LABEL[mode], mods: defenseModifiers(defender, mode, 0, defender.weapons[0]) };
}

/** Pré-jet d'INCANTATION pour le panneau de jet (même rôle que previewAttack/previewDefense) : valeur
 *  du Test = compétence nue + Avantage (LDB 46 l.176) / Contrecoup actif en chips = cible. La CastModal
 *  ne fait que poser cette ligne `pending` dans le RollPanel partagé (pas de calcul inline). */
export function previewCast(
  caster: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  opts?: { missile?: boolean; focused?: boolean },
): { label: string; base: number; target: number; mods: ModLine[] } {
  const ci = castInfo(spell);
  const target = castingValue(caster, ci.skill, ci.spec);
  const advMod = 10 * (caster.advantage ?? 0); // l'Avantage s'applique aux Tests d'Incantation
  const penMod = castPenaltyMod(caster, ci.skill); // contrecoups actifs (Imparfaite/Colère)
  const isPrayer = spell.cn == null;
  const ni = opts?.focused ? 0 : spell.cn ?? 0;
  const mods: ModLine[] = [
    ...(advMod ? [{ label: 'Avantage', value: advMod }] : []),
    ...(penMod ? [{ label: 'Contrecoup', value: penMod }] : []),
  ];
  return {
    label: isPrayer ? tr('cf.prayerLabel') : tr('cf.castLabel', { ni }), // le test reste Langue (Magick) — « Projectile magique » ne change QUE Localisation/Dégâts après réussite (LDB 46 l.155-156)
    base: target - advMod - penMod,
    target,
    mods,
  };
}

/** Delta de RESSOURCES de l'aperçu de clic (tap 1, `battle.preview`) — pour le retour « clignotant »
 *  de l'ActiveFrame : ce qu'une opération en attente va COÛTER (Action / Mouvement en cases) et
 *  RAPPORTER (Avantage) AVANT le commit du 2ᵉ clic. Tout à 0 si aucun aperçu en cours. */
export function previewResourceDelta(battle: BattleState | null): { action: number; move: number; adv: number } {
  const p = battle?.preview;
  if (!p) return { action: 0, move: 0, adv: 0 };
  // AUCUNE valeur de coût/gain n'est codée ici (anti-duplication — Action comme Mouvement comme Avantage) :
  //  - Mouvement : lu sur `p.cost`, le MÊME coût que le commit consomme (`movementUsed += cost`) ;
  //                la CHARGE est une manœuvre PLEINE → tout le Mouvement (mountMovement, comme le commit).
  //  - Avantage  : lu sur `p.adv`, SOURCE UNIQUE `chargeAdvantage()` partagée par preview / commit / IA.
  //  - Action    : DÉRIVÉE de la structure — viser un ennemi (`targetId`) = attaque, et la COURSE
  //                consomme aussi l'Action (LDB 15 l.79 — le commit passe par pendingRun).
  const action = 'targetId' in p || p.kind === 'run' ? 1 : 0;
  const active = battle?.combatants ? activeCombatant(battle) : undefined; // (les tests passent des battles minces)
  const move = p.kind === 'move' || p.kind === 'run' || p.kind === 'moveAttack'
    ? p.cost
    : p.kind === 'charge' && battle && active ? mountMovement(battle, active) : 0;
  const adv = p.kind === 'charge' ? p.adv : 0;
  return { action, move, adv };
}

/** Cibles VALIDES de l'attaque du héros actif (R4) : ennemis en vie atteignables (mêlée à l'Allonge / tir
 *  dans une bande de portée AVEC Ligne de Vue) — MÊMES prédicats que la résolution (via `previewAttack`),
 *  pour surligner les cibles cliquables et griser les inéligibles. Pur. Vide hors tour de héros. */
/** L'actif s'il est un héros-ATTAQUANT (arme à brandir + position) — précondition PARTAGÉE des calculs
 *  d'éligibilité de cible. Un navire-coque (sans arme) renvoie null : il agit en UNITÉ (Tests d'équipage), il
 *  n'attaque pas au fusil/à l'épée → `previewAttack` n'est pas appelé sur lui (et planterait faute d'arme). */
function activeHeroAttacker(get: Get): Combatant | null {
  const battle = get().battle;
  if (!battle) return null;
  const active = activeCombatant(battle);
  return active && controlsCombatant(get(), active) && !!active.pos && active.weapons.length > 0 ? active : null;
}

export function eligibleAttackTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeHeroAttacker(get);
  if (!active) return ids;
  for (const c of battle.combatants) {
    if (c.kind === active.kind || isOutOfAction(c) || !c.pos) continue; // camp RELATIF (l'actif conduit peut être un ennemi)
    const p = previewAttack(get, active, c);
    if (p.inRange && !p.blocked) ids.add(c.id);
  }
  return ids;
}

/** Ennemis SANS Ligne de Vue depuis le héros actif (LDB 13 l.123 — le tir est impossible) :
 *  l'UI les GRISE pour distinguer « hors LdV » de « hors de portée » (pas d'anneau dans les
 *  deux cas). Même vérité que l'attaque réelle (`previewAttack.blocked`, arme à distance
 *  seulement — la mêlée n'est jamais bloquée par la LdV). */
export function outOfSightTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeHeroAttacker(get); // navire-coque (sans arme) → aucune cible « hors de vue » à griser
  if (!active) return ids;
  for (const c of battle.combatants) {
    if (c.kind === active.kind || isOutOfAction(c) || !c.pos) continue; // camp RELATIF
    if (previewAttack(get, active, c).blocked) ids.add(c.id);
  }
  return ids;
}

/** Ligne de Vue d'un SORT (LDB 46 l.170 : « sauf indication contraire, vous devez toujours être
 *  capable de voir – par exemple, avoir en Ligne de vue – votre cible ») : BINAIRE — un Sort n'est
 *  pas un tir, aucune règle ne lui applique de malus de couvert → seul `.blocked` compte.
 *  Occupants ignorés (une créature ne bloque pas la vue, elle ne donne que du couvert — hors sorts). */
export function castSightBlocked(get: Get, from: Pt, to: Pt): boolean {
  const { scene, battle } = get();
  if (!scene) return false;
  return !losClear(scene, from, to, battle ? smokeOf(battle) : []);
}

/** Aperçu de DÉPLACEMENT vers `pt` (Marche ou Course) au SURVOL — composé des MÊMES sources que
 *  le clic-sol (`displayedReach`/`computeRunReach`/`pathTo`, géométrie de la monture incluse) :
 *  l'aperçu ne ment pas. Les gates de COMMIT (Peur à l'approche, Frénésie) restent au clic,
 *  comme pour le tap-1 tactile. null = case non atteignable / pas en mode neutre. */
export function movePreviewAt(get: Get, pt: Pt): { kind: 'move' | 'run'; path: Pt[]; cost: number } | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || battle.over || battle.action !== null) return null;
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return null;
  if (isEngaged(active) || !canMove(battle, active)) return null; // Engagé : le clic route vers le Désengagement
  const k = tileKey(pt.x, pt.y, pt.z ?? 0); // z-aware : une case de rempart (z1) ne matche plus la clé « x,y » du sol
  const reach = displayedReach(get);
  const inWalk = reach.has(k);
  const runReach = inWalk ? null : computeRunReach(get);
  if (!inWalk && !runReach?.has(k)) return null;
  const geom = mountOf(battle, active) ?? active;
  const path = pathTo(scene, active.pos, pt, moveEnv(battle, geom)) ?? [];
  if (path.length < 2) return null;
  return { kind: inWalk ? 'move' : 'run', path, cost: (inWalk ? reach.get(k) : runReach!.get(k)) ?? 0 };
}

/** Ennemis SANS Ligne de Vue depuis le héros actif pour un SORT (LDB 46 l.170) — même grisage
 *  que le tir, mais indépendant de l'arme portée (mode incantation). */
export function castOutOfSightTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === active.kind || isOutOfAction(c) || !c.pos) continue; // camp RELATIF
    if (castSightBlocked(get, active.pos, c.pos)) ids.add(c.id);
  }
  return ids;
}

/** Applique un résultat d'attaque déjà résolu : Blessures, États, Assommante,
 *  Avantage, animation, journal, fin de combat. */
/** Issue du Test opposé d'Esquive du Désengagement : le mover est l'« attaquant » du test ;
 *  une égalité parfaite (tie) = statu quo (ni fuite, ni avantage à l'adversaire — LDB Tests). */
export function disengageOutcome(winner: 'attacker' | 'defender' | 'tie'): 'success' | 'failure' | 'tie' {
  return winner === 'attacker' ? 'success' : winner === 'tie' ? 'tie' : 'failure';
}

/** Lance le Désengagement d'un combattant Engagé (LDB 15-Dépl l.84-89) : option A
 *  (Avantage > adversaires → résolue direct) ou option B (Test opposé d'Esquive vs le
 *  foe le plus dangereux). No-op « rouvre le mouvement » si plus aucun foe vivant. */
export function startDisengage(get: Get, set: SetFn, mover: Combatant): void {
  const battle = get().battle!;
  const foes = (mover.engagedWith ?? [])
    .map((id) => battle.combatants.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  // Désengagement GRATUIT du plus grand (LDB 85 l.373-374) : une créature plus grande que TOUS ses
  // adversaires Engagés les écarte et se déplace librement, sans Test ni sacrifice d'Avantage.
  // Plus grand que TOUS ses Engagés (85 l.373-374) OU Nuée (ignore l'Engagement en se déplaçant, l.200) → départ libre.
  const freeDisengage = foes.length > 0 && (mover.swarm || foes.every((f) => sizeGap(mover.size, f.size) >= 1));
  if (!foes.length || freeDisengage) {
    if (freeDisengage) {
      for (const f of foes) disengageFrom(mover, f); // lève les liens Engagé avec les plus petits écartés
      battle.log.push(ev('move', tr('cf.pushThrough', { name: mover.name }), mover.id));
    }
    // Lien d'Engagement périmé (foe mort/parti) OU désengagement gratuit : rouvrir le déplacement normal.
    set({ battle: { ...battle, action: null, reachable: moveReachFor(mover, get().scene!, mover.pos!, effectiveMovement(mover), moveEnv(battle, mover)) } });
    return;
  }
  // Option A du menu de Désengagement : « Sacrifier l'Avantage » (LDB 15-Dépl l.87, Avantage STRICTEMENT
  // supérieur → tombe à 0) OU, en mode « Avantage de groupe », « Retraite stratégique » (AA l.4139 : dépense
  // FIXE de 2 Avantages de la réserve du camp, abaissée à 1 par Impitoyable AA l.4418). Un seul chemin d'UI.
  const maxFoeAdv = Math.max(...foes.map((f) => f.advantage));
  // Impitoyable (LDB 10 l.591) : peut Sacrifier l'Avantage même sans supériorité stricte (mais il faut au
  // moins 1 Avantage à dépenser). En mode groupe : Retraite stratégique = dépense FIXE de la réserve du camp.
  const canSacrifice = groupAdvantage()
    ? spendableAdvantage(get, mover) >= retreatAdvantageCost(mover)
    : canDisengageWithLessAdvantage(mover)
      ? mover.advantage > 0
      : mover.advantage > maxFoeAdv; // Avantage strictement supérieur (l.87)
  // Après avoir agi, seule l'option A (Sacrifier l'Avantage) reste possible — sans Avantage supérieur
  // il n'y a RIEN à faire → no-op (pas de menu vide, et pas de relance d'Esquive : anti-boucle l.89).
  if (battle.acted && !canSacrifice) return;
  // Ouvre le MENU de choix. L'adversaire de référence (Esquive opposée + cible de la Fuite) =
  // le foe Engagé à la meilleure Compétence de Corps à corps (l.89). Son jet de CC est figé d'avance.
  const foe = foes.reduce((a, b) => (combatValue(b, 'melee') > combatValue(a, 'melee') ? b : a));
  const atk = rollDisengageAttack(foe, battleRng());
  set({
    pendingDisengage: {
      moverId: mover.id,
      foeId: foe.id,
      canSacrifice,
      canEsquive: !battle.acted, // Esquive/Fuite coûtent l'Action — indispo si déjà agi (anti-boucle)
      phase: 'choice',
      atk,
      def: null,
      result: null,
    },
  });
  // « Une situation = une modale » : le Désengagement est hôté dans la cascade (rendu par CascadeModal
  // via l'étape `jet:'disengage'`). `pendingDisengage` reste le porteur de données/phases ; les
  // résolveurs ferment LES DEUX. La ligne d'attaque figée du foe et les portraits restent inchangés.
  startCascade(get, set, { title: 'Se désengager', icon: '↩', purpose: 'combat', steps: [{ id: 'disengage', kind: 'disengageStep', jet: 'disengage', actorId: mover.id }] });
}

/** Lance l'action « Au Contact » d'un héros Engagé en mêlée (LDB 62 l.176, Option « Longueur d'arme »,
 *  règle `combat-weapon-reach`) : Test opposé de Corps à corps `mover` vs `foe`. Le jet du foe est tiré et
 *  FIGÉ d'avance (pattern Désengagement/Défense — montré dans la ligne adverse de la modale) ; le mover
 *  jouera SON jet influençable, et le VAINQUEUR choisira « combat normal » ou « au contact ». */
export function startAuContact(get: Get, set: SetFn, mover: Combatant, foe: Combatant): void {
  const atk = rollDisengageAttack(foe, battleRng()); // Corps à corps du foe, figé (jamais relancé)
  set({ pendingAuContact: { moverId: mover.id, foeId: foe.id, phase: 'roll', atk, def: null, result: null } });
}

/** Ouvre l'action d'Empoignade d'un combattant à son tour (LDB 14 l.161). Test opposé de FORCE `actor`
 *  vs `foe` ; le jet du foe est tiré et FIGÉ d'avance (pattern Désengagement/Au Contact). `canBreak` =
 *  l'acteur a un Avantage STRICTEMENT supérieur → il peut BRISER l'Empoignade gratuitement, ou tenter le
 *  Test opposé pour son Action (Dégâts / Empêtré). Le VAINQUEUR du Test choisit. */
export function startGrapple(get: Get, set: SetFn, actor: Combatant, foe: Combatant): void {
  const atk = rollGrappleForce(foe, battleRng()); // Force du foe, figée (jamais relancée)
  const canBreak = actor.advantage > foe.advantage;
  set({ pendingGrapple: { actorId: actor.id, foeId: foe.id, phase: 'roll', canBreak, atk, def: null, result: null } });
}

/** Cœur PARTAGÉ (flux joueur ET résolveur IA) d'une victoire d'Empoignade (LDB 14 l.161) : applique
 *  `GRAPPLE.win[mode]` (DONNÉE) — `free` se libère SOI-MÊME, `damage`/`entangle` frappent l'adversaire — et
 *  renvoie la ligne de journal. `dr` = DR du Test gagné (→ `ctx.sl`) ; `forceRoll` = jet de Force du VAINQUEUR
 *  (Localisation au lancer de Force, l.161). MUTE actor/foe ; ne touche NI `battle` NI `pending` (chaque
 *  appelant fait son propre `set`) → une SEULE application, deux orchestrations (modale joueur / instantané IA). */
export function resolveGrappleWin(actor: Combatant, foe: Combatant, mode: 'damage' | 'entangle' | 'free', dr: number, forceRoll: number): string {
  const beforeW = foe.wounds.current;
  const beforeEmp = stacks(actor, COND.empetre);
  applyOps(mode === 'free' ? actor : foe, GRAPPLE.win[mode], { caster: actor, sl: dr });
  if (mode === 'damage') {
    const loc = locationLabel(hitLocationByShape(reverseRoll(forceRoll), foe.bodyShape), foe.bodyShape); // Localisation au lancer de Force (l.161)
    return tr('cs.grappleDamage', { name: actor.name, foe: foe.name, n: beforeW - foe.wounds.current, loc });
  }
  if (mode === 'entangle') return tr('cs.grappleEntangle', { name: actor.name, foe: foe.name });
  return tr('cs.grappleFree', { name: actor.name, n: beforeEmp - stacks(actor, COND.empetre) });
}

/** Résolution PARTAGÉE d'un Test opposé de FORCE d'Empoignade par l'IA (LDB 14 l.161) : `actor` (« attaquant »)
 *  vs `foe`, jets de Force FIGÉS (jamais relancés). Sur succès → option Dégâts (BF+DR, PA ignorés ; Localisation
 *  au lancer de Force, via `resolveGrappleWin`) ; sur échec → `foe` gagne +1 Avantage ; égalité → rien. Renvoie
 *  la ligne de journal. MUTE actor/foe ; ne touche NI `battle` NI `pending` (l'appelant orchestre — Action
 *  verrouillée vs Attaque gratuite de tentacule/langue). SOURCE UNIQUE de l'issue opposée IA. */
export function resolveGrappleOpposed(get: Get, actor: Combatant, foe: Combatant): string {
  const actorRoll = rollGrappleForce(actor, battleRng());
  const foeRoll = rollGrappleForce(foe, battleRng());
  const opp = resolveOpposed(actorRoll, foeRoll);
  const result = disengageOutcome(opp.winner);
  if (result === 'success') return resolveGrappleWin(actor, foe, 'damage', Math.max(0, opp.netSL), actorRoll.roll);
  if (result === 'failure') campGain(get, foe, 1); // l'adversaire l'emporte → +1 Avantage (l.161) — réserve du camp en mode groupe (AA l.4114)
  return tr(result === 'failure' ? 'cs.grappleLose' : 'cs.grappleTie', { name: actor.name, foe: foe.name });
}

/** Case ATTEIGNABLE adjacente à `target` qui coûte le moins de Mouvement (point d'arrivée d'une Charge). */
export function bestAdjacentReachable(reach: Map<string, number>, target: Pt, targetN = 1, moverN = 1): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    // Adjacent à l'EMPREINTE de la cible (toute case du bloc N×N, pas seulement l'ancre) → un grand (créature,
    // navire) s'attaque depuis N'IMPORTE quel côté. `footprintChebyshev` coïncide avec `chebyshev` pour deux 1×1.
    if (footprintChebyshev({ x, y }, moverN, target, targetN) !== 1) continue;
    const d = reach.get(k)!;
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}

/** Cases de Mouvement LIBRE cliquables MAINTENANT (héros actif, mode neutre) : Marche restante
 *  (mouvement décomposable), géométrie de la monture, règle M-A-M, filtre Brisé. Vide si Engagé
 *  (le déplacement passe par le Désengagement — LDB 15 l.84). Reprend la logique de l'ex-mode
 *  « Déplacer » (battleSelectAction) ; source unique pour l'affichage ET la validation des clics. */
export function computeMoveReach(get: Get): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return new Map();
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return new Map();
  if (isEngaged(active) || !canMove(battle, active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const reach = moveReachFor(geom, scene, active.pos, movementRemaining(battle, active), moveEnv(battle, geom));
  return briseFleeFilter(scene, battle, active, reach);
}

/** Brisé (LDB 16 l.55) : « se déplacer jusqu'à se retrouver à l'abri, HORS DE VUE de l'ennemi ». Si des
 *  cases atteignables BRISENT la Ligne de Vue de tout adversaire (`tileSeenByFoe` faux), on s'y limite
 *  (gagner une cachette prime) ; sinon, à défaut de cachette, fuir = ne pas se rapprocher (distance). */
function briseFleeFilter(scene: Scene, battle: BattleState, active: Combatant, reach: Map<string, number>): Map<string, number> {
  if (!hasCondition(active, COND.brise)) return reach;
  const foes = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return reach;
  const smoke = smokeOf(battle);
  const hiddenTiles = new Map([...reach].filter(([k]) => {
    const [x, y] = k.split(',').map(Number);
    return !tileSeenByFoe(scene, foes, { x, y }, smoke);
  }));
  if (hiddenTiles.size) return hiddenTiles; // une cachette atteignable → s'y mettre à l'abri (RAW)
  const distNow = Math.min(...foes.map((e) => chebyshev(active.pos!, e.pos!)));
  return new Map([...reach].filter(([k]) => {
    const [x, y] = k.split(',').map(Number);
    return Math.min(...foes.map((e) => chebyshev({ x, y }, e.pos!))) >= distNow;
  }));
}

/** Zone NOMINALE de Course (LDB 15 l.79-82) : Marche + Course (3M cases, avant DR) — affichée dans une
 *  autre couleur ; un clic dedans demande le Test d'Athlétisme (+20), le déplacement réel dépendant du
 *  jet. Mêmes conditions que la Course : plein Mouvement, Action libre, non Engagé, pas À Terre. */
export function computeRunReach(get: Get): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over || battle.acted || battle.movementUsed > 0) return new Map();
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return new Map();
  if (isEngaged(active) || hasCondition(active, COND.aTerre) || !canTakeAction(active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const M = mountMovement(battle, active);
  if (M <= 0) return new Map();
  const reach = moveReachFor(geom, scene, active.pos, M * 3, moveEnv(battle, geom));
  return briseFleeFilter(scene, battle, active, reach);
}

/** Cases cliquables affichées/validées : budget SPÉCIAL stocké (Course, post-Désengagement)
 *  prioritaire, sinon Marche restante dérivée. */
export function displayedReach(get: Get): Map<string, number> {
  const battle = get().battle;
  if (!battle) return new Map();
  return battle.reachable.size > 0 ? battle.reachable : computeMoveReach(get);
}

/**
 * PARITÉ héros/IA sur l'approche (LDB 15 l.74-82) : si le plan de MARCHE n'amène pas l'ennemi au
 * contact, un combattant de mêlée non Engagé tente une CHARGE à portée de Course (2M × Bond/Foulée) ;
 * si même la Course ne suffit pas, il COURT (Action + Test d'Athlétisme — Chevaucher à cheval —,
 * résolution instantanée IA) : budget = Marche + Course + DR, et il n'attaque PAS ce tour.
 * Pure (rng injecté) — renvoie le plan retenu et le jet de Course éventuel.
 */
export function aiApproachPlan(
  input: EnemyTurnInput,
  geom: Combatant,
  action: EnemyAction,
  rng: RNG,
): { plan: EnemyAction; ran: { roll: number; budget: number } | null } {
  const enemy = input.enemy;
  const none = { plan: action, ran: null };
  if (action.kind !== 'move') return none;
  if (isEngaged(enemy) || hasCondition(enemy, COND.aTerre) || !canTakeAction(enemy)) return none;
  if (!enemy.weapons.some((w) => w.type === 'melee')) return none;
  const M = effectiveMovement(geom);
  if (M <= 0) return none;
  const atContact = (a: EnemyAction): boolean =>
    a.kind === 'move' && combatDistance({ ...enemy, pos: a.to } as Combatant, input.heroes.find((h) => h.id === a.thenTargetId) ?? input.heroes[0]) <= meleeReachTiles(enemy.weapons);
  if (atContact(action)) return none; // la Marche suffit déjà
  // Charge (portée de Course, sans Test — LDB 15 l.74-77).
  const courseBudget = Math.floor(M * 2 * runMultiplier(geom.traits));
  if (courseBudget <= input.movement) return none;
  const charge = chooseEnemyAction({ ...input, movement: courseBudget });
  if (charge.kind === 'move' && atContact(charge)) return { plan: charge, ran: null };
  // Course (LDB 15 l.79-82) : Test d'Athlétisme/Chevaucher, budget = Marche + Course + DR ; pas d'attaque.
  const r = resolveRun(testValue(enemy, enemy.mountId ? 'chevaucher' : 'athletisme'), M, rng);
  const runBudget = M + r.bonusCases;
  const run = runBudget > input.movement ? chooseEnemyAction({ ...input, movement: runBudget }) : action;
  if (run.kind === 'move' && (run.to.x !== action.to.x || run.to.y !== action.to.y))
    return { plan: run, ran: { roll: r.roll, budget: runBudget } };
  // La Course ne porte pas plus loin que le plan de Marche : marcher normalement (pas d'Action gâchée).
  return none;
}

/** Cible IMPOSÉE d'un combattant en Frénésie (LDB 21 l.34) : l'ennemi le plus proche dans sa Ligne
 *  de Vue (à distance égale, le plus blessé — même critère que l'IA). Null si pas frénétique ou
 *  aucun ennemi visible (alors pas de contrainte). */
export function frenzyTarget(get: Get, c: Combatant): Combatant | null {
  const { battle, scene } = get();
  if (!battle || !scene || !isFrenzied(c) || !c.pos) return null;
  const visible = battle.combatants.filter(
    (e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos && losClear(scene, c.pos!, e.pos!, smokeOf(battle)),
  );
  if (!visible.length) return null;
  return visible.sort((a, b) => {
    const da = combatDistance(c, a), db = combatDistance(c, b);
    if (da !== db) return da - db;
    return a.wounds.current - b.wounds.current;
  })[0];
}

/** Source de PEUR active dont `dest` RAPPROCHE l'acteur (LDB 21 l.29) — null si aucune, ou si
 *  immunisé à la Psychologie. « Sous l'emprise » ⟺ Test étendu de Calme pas encore au niveau
 *  de l'Indice (calmeDR < indice). Pure. */
export function fearedSourceTowards(battle: BattleState, active: Combatant, dest: Pt): Combatant | null {
  if (!active.pos || isPsychImmune(active)) return null;
  for (const p of active.psychState ?? []) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 1)) continue;
    const src = battle.combatants.find((c) => c.id === p.sourceId);
    if (src?.pos && !isOutOfAction(src) && chebyshev(dest, src.pos) < chebyshev(active.pos, src.pos)) return src;
  }
  return null;
}

export type AttackPlan =
  | { kind: 'attack' }
  | { kind: 'charge'; dest: Pt; path: Pt[]; adv: 0 | 1 }
  | { kind: 'moveAttack'; dest: Pt; path: Pt[]; cost: number }
  | { kind: 'blocked'; reason: string };

/** Ce qu'un clic sur CET ennemi ferait : attaque directe (Allonge / tir), Charge implicite
 *  (non Engagé + Mouvement intact + mêlée, portée de Course — LDB 15 l.74-77), ou
 *  rejoindre-et-attaquer dans la Marche restante (pas une Charge → pas de bonus). Pure-store. */
export function attackPlan(get: Get, active: Combatant, target: Combatant, opts?: { reach?: number; forceMelee?: boolean }): AttackPlan {
  const battle = get().battle!;
  const scene = get().scene!;
  // Géométrie de COMBAT (LDB 14) : un cavalier mesure reach/adjacence depuis l'empreinte de sa MONTURE
  // (le couple partage position+empreinte, souvent 2×2) ; idem si la CIBLE est montée. Sans monture = soi.
  const geom = mountOf(battle, active) ?? active;
  const tgtGeom = mountOf(battle, target) ?? target;
  // `opts` (attaque CHOISIE : arme tenue vs attaque naturelle gratuite) : `reach` impose l'Allonge (gratuites
  // de mêlée = 1), `forceMelee` ignore la branche distance même avec une arme à distance tenue. Sans opts =
  // comportement historique (arme du Set actif), byte-identique.
  if (combatDistance(geom, tgtGeom) <= (opts?.reach ?? meleeReachTiles(active.weapons))) return { kind: 'attack' };
  // L'arme du SET ACTIF décide : une arme à distance présente → tir. Gate PRÉ-clic (parité sort) :
  // sans Ligne de Vue (LDB 13 l.123) ou au-delà de la bande Extrême (Portée ×3), refuser AVANT la
  // modale — sinon « Lancer » fabrique un raté garanti qui consomme l'Action. Les gates de la
  // résolution restent (défense en profondeur). Le gate de RESSOURCE (Recharge/munition) est porté
  // par `firedAttackBlock` (concern orthogonal), rejoué par le clic ET le survol sur ce `{kind:'attack'}`.
  if (!opts?.forceMelee && attackWeapon(active.weapons, false).type === 'ranged') {
    const p = previewAttack(get, active, target);
    if (p.blocked) return { kind: 'blocked', reason: 'Pas de ligne de vue (cible masquée).' };
    if (!p.inRange) return { kind: 'blocked', reason: 'Cible hors de portée.' };
    return { kind: 'attack' };
  }
  // Mêlée hors d'Allonge :
  // Une STRUCTURE (ADE II ch.08) est inanimée : pas de Charge ni d'approche-puis-frappe implicite (la
  // frapper est une ACTION délibérée, sans +1 Avantage ni `fromCharge` qui bloquerait « Renoncer »).
  // On refuse → le joueur s'approche par un clic-sol normal (undoable), puis frappe une fois au contact.
  if (isInanimate(target)) return { kind: 'blocked', reason: 'Approche-toi pour la frapper.' };
  if (isEngaged(active)) return { kind: 'blocked', reason: 'Engagé : se désengager avant de rejoindre une autre cible.' };
  const env = moveEnv(battle, geom);
  if (battle.movementUsed === 0 && !hasCondition(active, COND.aTerre)) {
    // Charge (LDB 15 l.74-77) : manœuvre PLEINE, portée de Course (2M × Bond/Foulée), arrivée
    // adjacente la moins chère.
    const M = mountMovement(battle, active);
    const reach = moveReachFor(geom, scene, active.pos!, Math.floor(M * 2 * runMultiplier(geom.traits)), env);
    const dest = bestAdjacentReachable(reach, target.pos!, footprintN(target), footprintN(geom));
    if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de Charge.' };
    return { kind: 'charge', dest, path: pathTo(scene, active.pos!, dest, env) ?? [], adv: chargeAdvantage(M, footprintChebyshev(active.pos!, footprintN(geom), target.pos!, footprintN(target))) };
  }
  // Mouvement entamé (ou À Terre) : rejoindre dans la Marche restante.
  const reach = displayedReach(get);
  const dest = bestAdjacentReachable(reach, target.pos!, footprintN(target), footprintN(geom));
  if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de mêlée.' };
  return { kind: 'moveAttack', dest, path: pathTo(scene, active.pos!, dest, env) ?? [], cost: reach.get(`${dest.x},${dest.y}`)! };
}

/** Mort d'un combattant : pour un héros à Destin, suspend (pendingFateSave) au lieu de mourir
 *  (LDB ch.17 l.31-35) ; sinon finalise la mort. `restoreWounds` = PB d'avant le coup létal.
 *  `foe` = « l'individu ou l'élément qui l'a presque tué » (coup direct) → Cible d'une éventuelle
 *  Animosité si le Destin est dépensé (ADE II Annexe I, règle facultative) ; absent pour la mort lente. */
export function finalizeHeroDeath(get: Get, set: SetFn, hero: Combatant, source: 'hit' | 'slow', restoreWounds?: number, foe?: Pick<Combatant, 'name' | 'groups'>): void {
  // Le vrai gate est la RESSOURCE (`fate > 0`, présente sur tout kind), pas le `kind` : un combattant à
  // Destin (héros, ou ennemi conduit doté de Destin) est sauvé ; sinon la mort est finalisée.
  if ((hero.fate ?? 0) > 0) {
    const foeCible = foe ? (foe.groups?.[0] ?? foe.name) : undefined;
    set({ pendingFateSave: { heroId: hero.id, source, restoreWounds, ...(foeCible ? { foeCible } : {}) } });
  } else {
    hero.dead = true;
  }
}

/** Émet le déclencheur `onSlain` UNE seule fois pour un combattant mis HORS DE COMBAT — effets de DONNÉE
 *  « à la mort » (Démoniaque banni, LDB 85 p.339 ; futur explose/se dédouble). Atteignable par plusieurs
 *  chemins de mort (0 PB, Critique létal, mort-auto, mort lente) → garde d'unicité `slainNotified`.
 *  Renvoie les lignes de journal de l'effet (tissées par l'appelant à sa position). */
export function notifySlain(get: Get, set: SetFn, c: Combatant): string[] {
  if (!isOutOfAction(c) || c.slainNotified) return [];
  c.slainNotified = true;
  const lines = fireTriggers(get, c, 'onSlain', { rng: battleRng(), set });
  // Ops IMPURES « à la mort » (Charnier : 3d10 Zombies ; toute zone laissée en mourant) — inertes dans
  // applyOps, résolues ici (grille/initiative) comme au lancement d'un sort d'invocation/zone.
  lines.push(...resolveTriggerImpureOps(get, set, c, 'onSlain'));
  return lines;
}

/** Applique une Blessure critique (Coup Critique ou overkill) à `target` : PB (ignore BE+PA,
 *  plancher 0) + États + compteur. Mort Subite pour les figurants en overkill. RETOURNE `true`
 *  si le résultat est létal (le caller finalise via finalizeHeroDeath). Pousse le journal dans `log`. */
export function applyCriticalToTarget(
  target: Combatant,
  location: HitLocation,
  isCoupCritique: boolean,
  overkill: number,
  log: string[],
  set: SetFn,
  opts?: {
    ctx?: DeviationCtx; // qui inflige le coup + l'arme (→ modale enrichie) ; critTwice = B. de Sauvagerie de l'attaquant
    prerolled?: CriticalResolved; // Critique déjà tiré (déviation : on a montré CE Critique → on l'applique tel quel, sans re-tirer)
    suppressReveal?: boolean; // la modale de déviation a DÉJÀ affiché le Critique → ne pas re-pousser une révélation
    get?: Get; // navire : résout l'ÉQUIPAGE (`crewIds`) depuis la bataille pour répercuter Équipage/Éclats sur de vrais marins
  },
): boolean {
  const { ctx, prerolled, suppressReveal, get } = opts ?? {};
  // Structure de siège (AA p.121) : modèle de Critique DISTINCT du personnage — table propre (pas de Trauma
  // humain) et pas de « Mort » de personnage. Filet de sécurité pour TOUT appelant (opposé/magie) ; le chemin
  // d'attaque normal passe déjà par `applyStructureCriticalToTarget` (cf. `applyAttackResult`).
  if (target.bodyShape === 'structure') {
    applyStructureCriticalToTarget(set, target, { attackerId: ctx?.attackerId, attackerKind: ctx?.attackerKind, weapon: ctx?.weapon }, log);
    return false; // une Structure ne « meurt » pas comme un personnage : la destruction = ses Blessures → BRÈCHE
  }
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.51-54) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.name === COND.inconscient)) addCondition(target, COND.inconscient);
    log.push(tr('cf.collapse', { name: target.name }));
    return false;
  }
  // Coque inerte (véhicule / navire) : aucun Trauma humain. Le coup se résout sur les tables de NAVIRE
  // (MDG ch.13) via le module FRÈRE `shipCritical` — localisation par gréement (Coque/Gréement/Avirons/…
  // vs Équipage), effets en `GameOp` (Voie d'eau / En flammes) posés par `applyOps`. (Le `rollCritical` de
  // personnage indexerait des Traumatismes humains, hors-sujet pour une coque.)
  if (target.bodyShape === 'vehicule') {
    return applyHullCriticalToTarget(target, log, set, { ctx, suppressReveal, get });
  }
  // La Localisation est RÉSOLUE par l'appelant (Coup Critique = 1d100 frais via `critWoundLocation`, qui
  // honore aussi la loc choisie « Je ne faillirai pas ! » / le Critique pré-montré ; overkill = loc de
  // touche) et passée telle quelle : `applyCriticalToTarget` ne re-tire JAMAIS la loc → zéro double tirage.
  const loc = location;
  const crit = prerolled ?? rollCritical(target, loc, battleRng(), overkill, ctx?.critTwice);
  // Variante Aux Armes (l.2521-2523) : un Coup Critique « T » (trivial) n'est PAS compté dans le nombre de
  // Blessures Critiques nécessaires pour tuer → il n'incrémente pas `criticalWounds` (le LDB n'a pas de
  // trivial : chaque Critique compte). `critTwice` (Sauvagerie) reste tables LDB même en mode AA (critical.ts).
  const aaTrivial = !ctx?.critTwice && rule('combat-aa-blessures') === 'aa' && aaCriticalIsTrivial(crit.location, crit.roll);
  if (!aaTrivial) target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  target.tookCriticalThisFight = true; // fin de combat : Résistance Très Facile (+60) ou Infection Mineure (LDB 20 l.72)
  log.push(crit.log);
  const revealLines = [crit.log];
  // Effets DÉTAILLÉS pour la modale enrichie : chaque trauma (Amputation, Fracture…) AVEC son explication
  // RAW (note) — « à quoi ça correspond » (#critique). Localisation FR, et pas de « (Jambe droite) (jambeD) ».
  const details: { text: string; note?: string }[] = [];
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) {
      const text = `${t.label} (${locationLabel(t.location, target.bodyShape)})`;
      log.push(`  ↳ ${text}.`);
      revealLines.push(`  ↳ ${text}.`);
      details.push({ text, note: t.desc });
    }
    // Cumuls par comptage (LDB 18) : doigts (−5/doigt, 4+ → main) et dents (−1 Soc/paire) fusionnés ;
    // 2e œil/oreille → Cécité / Surdité agrégée (l.360/363).
    consolidateAmputations(target);
    for (const l of escalateSensoryLoss(target)) {
      log.push(`  ↳ ${l}`);
      revealLines.push(`  ↳ ${l}`);
      details.push({ text: l });
    }
  }
  if (!crit.lethal) {
    // `now` : horloge de jeu — sans elle, un effet d'HORLOGE (durée en jours, #153) calculerait son
    // échéance depuis 0 → expirerait immédiatement au tick suivant (`purgeClockEffects` compare à `get().gameTime`
    // réel). `location` : main affectée par l'op `disarm` (#153, convention DROITIER `brasD`→main/`brasG`→off).
    applyOps(target, crit.ops, { rng: battleRng(), now: get?.().gameTime, location: loc }); // effet immédiat (PB ignorant BE+PA + États) — langue GameOp
    if (crit.desc) {
      log.push(`  ↳ ${crit.desc}`); // effet long terme journalisé, non simulé
      revealLines.push(`  ↳ ${crit.desc}`);
      details.push({ text: crit.desc });
    }
  }
  // « Un jet = une modale » : modale de Coup Critique COMPLÈTE (qui inflige + arme + dé + localisation +
  // Blessures + États + effets expliqués), au niveau de la modale d'attaque. (Sautée si la modale de
  // déviation l'a déjà affichée — la déviation fusionne choix ET révélation sur une seule modale.)
  // SEULEMENT si un héros est concerné — il le SUBIT ou l'INFLIGE (arbitrage 2026-06-11, spec coop
  // §4bis) ; un critique purement ennemi↔ennemi reste au journal/bandeau (les lignes sont déjà dans `log`).
  const heroConcerned = target.kind === 'hero' || ctx?.attackerKind === 'hero';
  if (!suppressReveal && heroConcerned) {
    const sum = critImmediateSummary(crit.ops);
    pushReveal(set, {
      kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: revealLines, subjectId: target.id,
      severity: 'grave',
      actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
      crit: { location: locationLabel(crit.location, target.bodyShape), woundsLost: sum.woundsLost, conditions: sum.conditions.length ? sum.conditions : undefined },
    });
  }
  return crit.lethal; // « Mort » instantané → finalisé par le caller (sauvetage par Destin possible)
}

/**
 * Critique encaissé par une COQUE (véhicule/navire, `bodyShape:'vehicule'`) — MDG ch.13-14. On lit le gréement
 * de la coque (`vehicles.json` → `hull.rig`) pour la colonne de Localisation, puis on DÉLÈGUE au résolveur engine
 * PUR `applyHullCritical`, qui pose les États NAVALS sur la coque (`GameOp`) ET répercute sur l'ÉQUIPAGE : un coup
 * « Équipage » devient un Critique de PERSONNAGE sur un marin exposé, les Éclats infligent 9 Dégâts à autant de
 * marins. L'équipage est résolu depuis `target.crewIds` via la bataille (`get`) ; absent → effets de coque seuls.
 * La destruction de la coque NE passe PAS par un « Mort » de Critique mais par ses Blessures / l'État Naufrage —
 * on renvoie donc toujours `false`.
 */
function applyHullCriticalToTarget(
  target: Combatant,
  log: string[],
  set: SetFn,
  opts?: { ctx?: DeviationCtx; suppressReveal?: boolean; get?: Get },
): boolean {
  const { ctx, suppressReveal, get } = opts ?? {};
  const hull = findVehicleById(target.creatureId ?? '')?.hull;
  const rig: ShipRig = hull?.rig ?? 'mixte';
  const crew = get && target.crewIds
    ? (target.crewIds.map((id) => actorIn(get(), id)).filter(Boolean) as Combatant[])
    : [];
  // Réfs data-driven : `navire`/`ship-criticals` (MDG, défaut) ou `navire-fluvial`/`river-criticals` (T2C ch.5).
  const outcome = applyHullCritical(target, crew, rig, battleRng(), undefined, undefined, {
    locationTable: hull?.locationTable, criticalTable: hull?.criticalTable,
  });
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  for (const l of outcome.lines) log.push(l);
  const heroConcerned = target.kind === 'hero' || ctx?.attackerKind === 'hero'
    || crew.some((c) => c.kind === 'hero');
  if (!suppressReveal && heroConcerned) {
    pushReveal(set, {
      kind: 'critical', title: 'Critique de navire', dice: outcome.crewCrit?.crit.roll ?? 0, lines: outcome.lines,
      subjectId: target.id, severity: 'grave', actorId: ctx?.attackerId, weapon: ctx?.weapon, details: [],
    });
  }
  return false;
}

/**
 * Critique de Structure (AA p.120-121) — calqué sur `applyHullCriticalToTarget`. Tire la table propre aux
 * Structures (`rollStructureCritical`), applique les Blessures supplémentaires (langue `GameOp`, ignore BE/PA)
 * et, sur un Effondrement (96+), met la Structure à 0 Blessure (la destruction se matérialise en BRÈCHE par
 * `collapseStructure`, à la clôture de la résolution). Pousse la révélation « Critique de Structure » si un
 * héros est concerné. `forcedRoll` fige le d100 (tests). PUR vis-à-vis de la grille (aucun retrait ici).
 */
export function applyStructureCriticalToTarget(
  set: SetFn,
  target: Combatant,
  ctx: { attackerId?: string; attackerKind?: Combatant['kind']; weapon?: string },
  log: string[],
  forcedRoll?: number,
): StructureCriticalResolved {
  const outcome = rollStructureCritical(battleRng(), forcedRoll);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  applyOps(target, outcome.ops, { rng: battleRng() }); // Blessures supplémentaires (GameOp `wounds`, ignore BE+PA)
  if (outcome.destroyed) target.wounds.current = 0; // Effondrement → la Structure s'écroule (BRÈCHE à la clôture)
  for (const l of outcome.log) log.push(l);
  if (outcome.note) log.push(`  ↳ ${outcome.note}`); // effets verbatim sur les personnes (débris/Tests), non simulés
  if (target.kind === 'hero' || ctx.attackerKind === 'hero') {
    pushReveal(set, {
      kind: 'critical', title: 'Critique de Structure', dice: outcome.roll, lines: [...outcome.log, outcome.note],
      subjectId: target.id, severity: outcome.destroyed ? 'grave' : 'minor', actorId: ctx.attackerId, weapon: ctx.weapon, details: [],
    });
  }
  return outcome;
}

/** Effondrement d'une STRUCTURE de siège tombée à 0 Blessure (AA p.121) → BRÈCHE franchissable : pose le flag
 *  `structureDown` sur l'arête (`structureEdge`), RETIRE le Combattant inerte de la bataille et re-render
 *  (SCENE_DIRTY). Appelée à la CLÔTURE de la résolution (APRÈS le `set` qui réécrit `battle` depuis sa capture)
 *  → pas de clobber. No-op (réf inchangée pour la scène) si la cible n'a pas d'arête (structure hors scène). */
export function collapseStructure(get: Get, set: SetFn, target: Combatant): void {
  const e = target.structureEdge;
  set((s: GameState) => {
    const log = [...(s.battle?.log ?? []), ev('death', structureCollapseLog(target.name), target.id)];
    let combatants = s.battle?.combatants.filter((c) => c.id !== target.id) ?? [];
    let scene = s.scene;
    if (e && scene) {
      // Brèche : pose le flag `structureDown` sur l'arête (le Combattant-structure inerte est déjà retiré).
      scene = setStructureDown(scene, e.x, e.y, e.side, e.z ?? 0, true);
      // Effondrement de la PASSERELLE (z=1) portée par la structure abattue : ses occupants CHUTENT au
      // sol (dégâts de chute, LDB 15) et les tuiles deviennent infranchissables (`setTileCollapsed`).
      for (const tl of parapetTilesAbove(scene, e)) {
        const sc = scene; // réf non-null capturée pour les closures (scene est un `let` réassigné plus bas)
        combatants = combatants.map((c) => {
          if (c.pos?.x !== tl.x || c.pos?.y !== tl.y || (c.pos?.z ?? 0) !== 1) return c;
          const fallen = { ...c, wounds: { ...c.wounds }, conditions: c.conditions.map((x) => ({ ...x })) };
          // Hauteur de chute = vraie hauteur métrique (relief) de la passerelle (z=tl.z) au-dessus du sol (z=0).
          applyFall(fallen, Math.abs(heightAt(sc, tl.x, tl.y, tl.z) - heightAt(sc, tl.x, tl.y, 0)), battleRng());
          placeCombatant(fallen, sc, { x: tl.x, y: tl.y }); // chute au sol (z=0, omis) + hauteur rafraîchie
          log.push(ev('damage', `${c.name} chute de la passerelle qui s'effondre.`, c.id));
          return fallen;
        });
        scene = setTileCollapsed(scene, tl.x, tl.y, tl.z);
      }
    }
    return { scene, battle: s.battle ? { ...s.battle, combatants, log } : s.battle };
  });
  clearEngagementOf(get().battle?.combatants ?? [], target.id); // l'attaquant n'est plus Engagé avec la brèche
  bus.emit(EVT.SCENE_DIRTY);
}

/** Construit la révélation d'affichage d'un Coup Critique PRÉ-TIRÉ, SANS muter la cible (pour la modale
 *  de déviation : on montre le Critique qui menace avant le choix Dévier/Subir). Détails de base (sans la
 *  consolidation des amputations multiples, calculée seulement à l'application). */
export function previewCritEntry(target: Combatant, crit: CriticalResolved, ctx?: { attackerId?: string; weapon?: string }): RevealEntry {
  const lines = [crit.log];
  const details: { text: string; note?: string }[] = [];
  for (const t of crit.traumas) {
    const text = `${t.label} (${locationLabel(t.location, target.bodyShape)})`;
    lines.push(`  ↳ ${text}.`);
    details.push({ text, note: t.desc });
  }
  if (!crit.lethal && crit.desc) {
    lines.push(`  ↳ ${crit.desc}`);
    details.push({ text: crit.desc });
  }
  const sum = critImmediateSummary(crit.ops);
  return {
    kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines, subjectId: target.id,
    actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
    crit: { location: locationLabel(crit.location, target.bodyShape), woundsLost: sum.woundsLost, conditions: sum.conditions.length ? sum.conditions : undefined },
  };
}

/** Dévier 1 PA pour IGNORER le Critique (LDB 63 l.30) : sacrifie 1 PA à `location` ; la cible subit
 *  quand même les Blessures normales + `extraWounds` (recalcul à PA−1). RETOURNE false si aucune PA
 *  sacrifiable → la Déviation n'a pas lieu. Arme-agnostique (l'`extraWounds` est calculé par l'appelant). */
function deflectCrit(target: Combatant, location: HitLocation, extraWounds: number, log: string[]): boolean {
  if (!damageArmour(target, location)) return false;
  if (extraWounds > 0) target.wounds.current = Math.max(0, target.wounds.current - extraWounds);
  log.push(tr('cf.deflect', { name: target.name }));
  return true;
}

/** Triptyque PARTAGÉ d'application d'un Critique (mêlée/opposé/magie) : applique la table puis finalise
 *  une éventuelle mort par le chemin normal. `woundsBefore` = PB AVANT les dégâts de base (passé par
 *  l'appelant → restauration Destin correcte au Subir). */
function applyCritAndFinalize(
  get: Get, set: SetFn, target: Combatant, location: HitLocation, isCoupCritique: boolean, overkill: number,
  log: string[], ctx: DeviationCtx, woundsBefore: number, crit?: CriticalResolved, suppressReveal?: boolean,
): boolean {
  const lethal = applyCriticalToTarget(target, location, isCoupCritique, overkill, log, set, { ctx, prerolled: crit, suppressReveal, get });
  if (lethal) finalizeHeroDeath(get, set, target, 'hit', woundsBefore, get().battle?.combatants.find((c) => c.id === ctx.attackerId));
  return lethal;
}

/** Déviation AUTO de l'ennemi (LDB 63) : rule-gated, sacrifie 1 PA à la loc du Critique si possible →
 *  Critique ignoré. RETOURNE true si la Déviation a eu lieu. Révélation « dévié » si un héros est
 *  concerné (parité avec la révélation du Critique subi). Source UNIQUE pour les 3 chemins. */
function enemyAutoDeviate(
  set: SetFn, target: Combatant, location: HitLocation, extraWounds: number,
  ctx: { attackerId?: string; weapon?: string }, roll: number, log: string[], heroConcerned: boolean,
): boolean {
  if (!rule('combat-critical-deflect')) return false;
  if (deviatableArmourAt(target, location) <= 0) return false;
  if (!deflectCrit(target, location, extraWounds, log)) return false;
  if (heroConcerned)
    pushReveal(set, {
      kind: 'critical', title: tr('cf.critDeflectedTitle'), dice: roll, severity: 'minor',
      lines: [tr('cf.critDeflectedReveal', { loc: locationLabel(location, target.bodyShape) }), tr('cf.deflect', { name: target.name })],
      subjectId: target.id, actorId: ctx.attackerId, weapon: ctx.weapon,
    });
  return true;
}

/** Pousse l'étape de cascade « Coup Critique — dévier ? » (choix Dévier/Subir + révélation riche du
 *  Critique pré-tiré dans la MÊME modale). Builder UNIQUE des 3 chemins. */
function pushDeviationStep(set: SetFn, dev: PendingDeviation): void {
  pushCombatStep(set, {
    id: `cons-deviation-${dev.targetId}`, kind: 'deviation', actorId: dev.targetId, icon: 'fire/blast',
    label: 'Coup Critique — dévier ?',
    options: [{ key: 'devier', label: 'Dévier (−1 PA)' }, { key: 'subir', label: 'Subir' }],
    defaultChoice: 'devier', deviation: dev, reveal: dev.reveal, interactive: true,
  });
}

/** Une armure Bâclée frappée par un Coup Critique à sa localisation casse (LDB 60 l.82) — héros (pièces). */
function breakBacleArmour(target: Combatant, loc: HitLocation, log: string[]): void {
  const piece = (target.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && hasQuality(i, QUALITY_IDS.Bacle) && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return;
  piece.damageTaken = piece.pa ?? 0; // inutilisable
  recomputeLoadout(target);
  log.push(tr('cf.shoddyBreaks', { name: target.name, loc }));
}

/** « Arme possédant une lame » (Piège-lame, LDB 62 l.292) — la source ne liste pas les armes :
 *  approximation par mots-clés du nom (épées/dagues/haches/armes d'hast à fer tranchant). */
export function weaponHasBlade(w: Weapon | undefined): boolean {
  if (!w || w.type !== 'melee') return false;
  return /épée|epee|dague|lame|rapière|rapiere|cimeterre|couteau|sabre|fauchon|hache|hallebarde|glaive|estoc|faux|coutille|vouge/i.test(w.name);
}

/** Blessure critique « sèche » d'un Test opposé (LDB 14 l.7) : un double réussi inflige une Blessure
 *  critique à l'adversaire indépendamment du vainqueur de l'échange. Localisation = 1d100 frais (LDB 18
 *  l.53). Critique « sec » → aucune composante de Dégâts de base (overkill=0, deflectExtraWounds=0). La
 *  Déviation Critique (LDB 63 l.30) est offerte sur les TROIS chemins via les atomes partagés : l'ENNEMI
 *  dévie AUTO (`enemyAutoDeviate`, rule-gated), le HÉROS blindé CHOISIT (étape `self`), sinon le Critique
 *  est subi (`applyCritAndFinalize`). */
export function applyOpposedCritical(
  get: Get,
  set: SetFn,
  victim: Combatant,
  roll: number,
  ctx: { attackerId?: string; weapon?: string },
  log: string[],
): void {
  const loc = critWoundLocation(battleRng(), victim.bodyShape); // LDB 18 l.53 : Coup Critique → 1d100 frais (pas l'inversion de touche)
  // B. de Sauvagerie (LDB 41) : l'attaquant à l'origine du double tire deux lancers de Critique.
  const attacker = ctx.attackerId ? get().battle?.combatants.find((c) => c.id === ctx.attackerId) : undefined;
  const heroConcerned = victim.kind === 'hero' || attacker?.kind === 'hero';
  const c2: DeviationCtx = { ...ctx, attackerKind: attacker?.kind, critTwice: attacker ? hasActiveFlag(attacker, 'critRollTwice') : undefined };
  if (victim.kind === 'enemy') {
    if (enemyAutoDeviate(set, victim, loc, 0, ctx, roll, log, heroConcerned)) return;
  } else if (rule('combat-critical-deflect') && deviatableArmourAt(victim, loc) > 0) {
    // HÉROS blindé : on SUSPEND pour son choix Dévier/Subir (étape `self`, Critique « sec » pré-tiré).
    const crit = rollCritical(victim, loc, battleRng(), 0, c2.critTwice);
    const reveal = previewCritEntry(victim, crit, ctx);
    pushDeviationStep(set, {
      mode: 'self', attackerId: ctx.attackerId ?? '', targetId: victim.id, location: loc, crit,
      isCoupCritique: true, overkill: 0, deflectExtraWounds: 0, woundsBefore: victim.wounds.current, reveal, resumeAfter: true, ctx: c2,
    });
    return;
  }
  applyCritAndFinalize(get, set, victim, loc, true, 0, log, c2, victim.wounds.current);
}

/** Fabrique de cibles d'aire pour le combat COURANT (terre = rayon métrique à l'échelle de la scène ;
 *  navire = équipage exposé via `crewIds`) — SOURCE UNIQUE de la résolution `crewOf`, partagée par l'aire du
 *  tir individuel (`applyAttackResult`) ET le PILONNAGE INDIRECT (`siegeAimCommit`). Évite la re-duplication. */
export function battleAreaTargets(get: Get): (indice: number) => AreaTargets {
  const battle = get().battle!;
  return areaTargets(battle.combatants, sceneMetresPerTile(get().scene), (ship) => (ship.crewIds ?? []).map((id) => battle.combatants.find((c) => c.id === id)).filter((c): c is Combatant => !!c));
}

/** Rayon (cases) de l'aire d'une pièce indirecte servie par `gunner` (munition CHARGÉE prise en compte —
 *  l'Explosion vient de la bombe), à l'échelle de la scène. Sert à dimensionner le placeur de case. */
export function siegeBlastRadiusTiles(gunner: Combatant, weapon: Weapon, scene: Scene | null): number {
  const ammo = gunner.kind === 'hero' ? selectedAmmo(gunner, weapon) : undefined;
  const eff = ammo ? weaponWithAmmo(weapon, ammo) : weapon;
  return blastRadiusTiles(eff, sceneMetresPerTile(scene));
}

export function applyAttackResult(
  get: Get,
  set: SetFn,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
  deviated?: boolean,
  prerolledCrit?: CriticalResolved, // « Subir » après déviation : applique CE Critique (déjà montré) sans re-tirer
  deferAttackerAdvantage?: boolean, // Maniement de deux armes (LDB 10 l.638) : l'Avantage de l'attaquant est accordé à part (si les deux touchent)
  grapple?: boolean, // Empoignade (LDB 14 l.159) : « Au lieu d'infliger des Dégâts » — sur une touche, pose l'Empoignade + Empêtré au lieu de blesser
): boolean {
  // Surpris (LDB 16 l.136) : « après la première tentative effectuée pour vous toucher, vous perdez
  // l'État Surpris ». On le retire après une attaque STANDARD (deviated===undefined) — le +20 / l'absence
  // de défense ont déjà joué pour CELLE-CI ; les suivantes n'en bénéficieront plus. Les attaques GRATUITES
  // groupées d'une créature (Morsure+Piétinement, deviated===false) forment UN assaut-surprise : on garde
  // l'État jusqu'à la fin du Round (sinon la 2ᵉ attaque gratuite rouvrirait une défense en plein milieu).
  if (deviated === undefined && hasCondition(target, COND.surpris)) removeCondition(target, COND.surpris, 1);
  // Sauvegardes SYNCHRONES « après la touche » en registre ordonné (state/combat/hitModifiers) :
  // Démoniaque/Protection (`wardSaves`, RNG) → Bouclier anti-flèches → Dôme (RNG) → Martyr → Perturbante.
  // Chaque modifier RE-TESTE l'état courant de `res` et le TRANSFORME — ordre RAW encodé par `order`,
  // figé byte-pour-byte par `hitSaves.golden.test`. AUCUN ne SUSPEND (pas de pending) ; autoKill et
  // l'offre de Déviation Critique restent INLINE ci-dessous. Les saves posent leur ligne dans `res.log`
  // (journalisé par l'`ev(evKind, res.log, …)` final) → `sink` no-op ici.
  res = runHitModifiers({ get, set, attacker, target, weapon, res, sink: () => {} });
  // Empoignade (LDB 14 l.159) : « Au lieu d'infliger des Dégâts ». Sur une touche, on NEUTRALISE Dégâts,
  // Critique et mort-auto de CE coup (les branches Surpris/Engagé/Avantage/journal restent intactes) ; la
  // pose de l'Empoignade + de l'État *Empêtré* se fait après l'Engagement, plus bas.
  if (grapple && res.hit) res = { ...res, woundsLost: 0, critical: false, autoKill: false };
  // Cible Inconsciente — règle optionnelle « mort-auto » (LDB 16 l.112) : en CORPS À CORPS la cible est
  // tuée automatiquement. On applique la mort par le MÊME chemin que les morts normales (`finalizeHeroDeath`
  // → un héros à Destin est suspendu via pendingFateSave, sinon `dead = true`), pas un early-return brutal.
  // Le reste du flux d'attaque (États/Avantage/Critiques) est court-circuité : la cible est hors de combat.
  if (res.hit && res.autoKill) {
    const battle = get().battle!;
    attacker.aiming = false;
    if (weapon.type === 'melee' && !isInanimate(target)) engage(attacker, target); // Engagé symétrique (LDB 13 l.174-175) — jamais avec un objet INANIMÉ
    const currentBefore = target.wounds.current;
    target.wounds.current = 0;
    finalizeHeroDeath(get, set, target, 'hit', currentBefore, attacker); // Destin possible (héros) ; sinon mort directe
    if (isOutOfAction(target)) {
      clearEngagementOf(get().battle?.combatants ?? [], target.id);
      clearPsychOf(get().battle?.combatants ?? [], target.id);
    }
    if (attacker.pos && target.pos) {
      set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind: 'melee', defense: 'none', weapon, parryWeapon: res.parryWeapon, creatureAttack: creatureAttackKind(weapon) });
    const log = [...battle.log, ev('attack', tr('cf.finishHelpless', { name: attacker.name, foe: target.name }), attacker.id, target.id)];
    if (isOutOfAction(target)) log.push(ev('death', tr('cf.outOfAction', { name: target.name }), target.id));
    for (const line of notifySlain(get, set, target)) log.push(ev('death', line, target.id)); // effet « à la mort » (banni…) — mort-auto du désespéré
    set({ battle: { ...battle, acted: true, action: null, log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    return false; // application complète (mort-auto) — non suspendu côté cascade d'attaque
  }
  // Déviation Critique (LDB 63 l.63-66) : un HÉROS subit un Coup Critique à une localisation où il
  // porte de la PA → on SUSPEND pour son choix Dévier/Subir (modale). AUCUN effet de bord ici ; la
  // résolution (étape 'deviation', resolveDeviation) rappelle cette fonction avec `deviated` défini (early-return sauté →
  // application UNE seule fois). Les sous-attaques (balayage/Piétinement) passent `deviated` explicite
  // pour résoudre instantanément (pas de modale imbriquée). Les sorts (applyCast) gèrent leurs Critiques
  // à part : ils n'atteignent jamais cette fonction, donc pas de garde « arme » nécessaire.
  // #80 (LDB 18 l.55) : un Coup Critique RE-TIRE sa localisation, et « TOUTE la résolution du coup — Dégâts
  // non-critiques, DÉVIATION, armure Bâclée, table de Critiques — utilise CETTE localisation ». L'éligibilité
  // #43.2 à la Déviation (LDB 63 l.30, « emplacement protégé par une armure ») se teste donc sur la
  // localisation RE-TIRÉE du Critique — là où `deflectCrit` sacrifiera le PA — et NON sur la localisation de
  // touche, sinon on offrirait au héros une Déviation sans PA sacrifiable à la zone réellement frappée. Figée
  // ici (réutilisée sans re-tirer par la reprise Dévier/Subir). RNG-neutre : le tirage est seulement AVANCÉ
  // (aucun `battleRng` intercalé jusqu'à son point d'origine, au bloc Critique ci-dessous).
  // Blessure Critique = Coup Critique sur double OU dépassement (LDB 18 l.53) — la Déviation couvre LES DEUX
  // (LDB 63 l.30). `overkill0` = PB COURANTS dépassés par les Dégâts de base (avant re-localisation du Critique).
  const overkill0 = Math.max(0, (res.woundsLost ?? 0) - target.wounds.current);
  const dloc = (res.critical && deviated === undefined && target.kind === 'hero')
    ? (res.critLocation ??= critWoundLocation(battleRng(), target.bodyShape))
    : (res.location ?? 'corps'); // dépassement (≠ double) : loc de touche, pas de re-tirage
  // Règle optionnelle « Déviation Critique » (LDB 63 l.63) : si désactivée, on N'OFFRE PAS le choix
  // Dévier/Subir au héros → le Critique est subi directement (chemin normal ci-dessous).
  if (rule('combat-critical-deflect') && deviated === undefined && res.hit && res.woundsLost && (res.critical || overkill0 > 0) && pilotedByHuman(get(), target) && deviatableArmourAt(target, dloc) > 0) {
    // Pré-tire la Blessure Critique (graine figée) pour l'AFFICHER sur la modale de déviation — choix éclairé
    // Dévier/Subir, une seule modale. Aucune mutation de la cible ici ; « Subir » l'appliquera tel quel.
    const cloc = res.critical ? critWoundLocation(battleRng(), target.bodyShape, res.critLocation) : dloc;
    if (res.critical) res.critLocation = cloc; // LDB 18 l.55 (#80) : FIGE la loc re-tirée du Coup Critique AVANT la
    // suspension — la reprise (Dévier comme Subir) la réutilise sans RE-tirer ; sinon « Dévier » (qui ne repasse
    // pas `prerolledCrit`) sacrifierait 1 PA à une localisation ≠ de celle montrée au joueur. (Dépassement : pas de re-tirage.)
    const crit = rollCritical(target, cloc, battleRng(), overkill0, hasActiveFlag(attacker, 'critRollTwice'));
    const reveal = previewCritEntry(target, crit, { attackerId: attacker.id, weapon: weapon?.name });
    // Folding P3a : le choix Dévier/Subir devient une ÉTAPE de la séquence (Critique riche + options),
    // au lieu d'une modale `pendingDeviation` séparée. L'applier 'deviation' appelle resolveDeviation.
    pushDeviationStep(set, { mode: 'melee', attackerId: attacker.id, targetId: target.id, weapon, res, crit, reveal, resumeAfter: true });
    return true; // suspendu — la résolution part de l'applier 'deviation' (resolveDeviation, resume:false)
  }
  const battle = get().battle!;
  attacker.aiming = false; // l'attaque consomme la visée (tir : +20 déjà appliqué ; mêlée : visée gâchée)
  if (attacker.nextActionPenalty) attacker.nextActionPenalty = undefined; // pénalité de Maladresse consommée par ce Test

  if (weapon.type === 'melee' && !isInanimate(target)) engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13-Combat l.174-175) — jamais avec un objet INANIMÉ
  const critLog: string[] = [];
  // Empoignade (LDB 14 l.159) : « vous ET votre adversaire êtes Empoignés, et votre adversaire gagne
  // l'État *Empêtré* ». Pose APRÈS l'Engagement (les deux Empoignés) ; le bloc de Dégâts ci-dessous est
  // inerte (woundsLost neutralisé plus haut). RAW : pas de Dégâts sur l'initiation.
  if (grapple && res.hit) {
    // VOIE UNIQUE d'initiation, en DONNÉE : `GRAPPLE.init` pose l'*Empêtré* ET la relation (op `condition
    // {grapple:true}`) — mêmes effets qu'avant, mais éditables, partagés avec Constricteur/Tentacules/Langue.
    applyOps(target, GRAPPLE.init, { caster: attacker });
    critLog.push(tr('cf.grappleInit', { name: attacker.name, foe: target.name }));
  }
  if (res.hit && res.woundsLost && isStructure(target)) {
    // STRUCTURE de siège (AA p.121) : modèle DISTINCT du personnage — pas de Localisation, d'À Terre, de
    // Déviation d'armure ni de Trauma humain. Les Blessures sont déjà mitigées par `woundsFromHit` (Siège
    // ×2 / Résistant-Impénétrable-Bélier → 0). Un double qui retire AUSSI ≥25 % des Blessures RESTANTES
    // déclenche un Critique de Structure ; la chute à 0 Blessure devient une BRÈCHE (posée par
    // `collapseStructure` à la clôture, hors clobber du `set` final).
    const before = target.wounds.current;
    target.wounds.current = Math.max(0, before - res.woundsLost);
    if (res.critical && before > 0 && res.woundsLost >= before * 0.25 && target.wounds.current > 0)
      applyStructureCriticalToTarget(set, target, { attackerId: attacker.id, attackerKind: attacker.kind, weapon: weapon?.name }, critLog);
  } else if (res.hit && res.woundsLost) {
    // LDB 18 l.53-55 : un Coup Critique RE-TIRE la localisation (1d100 frais, ou choix RAW-2 « Je ne
    // faillirai pas ! », ou Critique déjà pré-tiré pour la Déviation) ; TOUTE la résolution du coup — Dégâts
    // NON-critiques (+ PA), Déviation, armure Bâclée, table de Critiques — utilise CETTE localisation. On la
    // fige sur `res` (location + critLocation) pour que l'aval (deflectCrit/enemyAutoDeviate/breakBacleArmour/
    // applyCritAndFinalize) la lise, puis on RECALCULE les Blessures de base à cette localisation
    // (`woundsAtCritLocation`). L'overkill (≠ Coup Critique) garde la localisation de la touche.
    if (res.critical) {
      const fresh = critWoundLocation(battleRng(), target.bodyShape, prerolledCrit?.location ?? res.critLocation);
      res.critLocation = fresh;
      res.location = fresh;
      res.woundsLost = woundsAtCritLocation(res, weapon, target, fresh);
    }
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    const loc = res.location ?? 'corps';
    if (res.critical) breakBacleArmour(target, loc, critLog); // armure Bâclée brisée par le Critique (LDB 60 l.82)
    // Blessures supplémentaires d'une Déviation (Dégâts recalculés à PA−1, LDB 63 l.30) : la PA n'est pas
    // encore sacrifiée ici (deflectCrit/enemyAutoDeviate le font) → on recompute woundsFromHit à PA−1
    // (`extraAP:-1`) et on isole le DELTA par rapport aux Blessures de base déjà appliquées.
    const extra = Math.max(0, woundsFromHit(weapon, target, loc, res.damage ?? 0, -1) - (res.woundsLost ?? 0));
    // Déviation (LDB 63 l.63-66) : l'ENNEMI dévie AUTO (rule-gated, `enemyAutoDeviate`) ; le HÉROS « Dévier »
    // sur re-entrée (deviated===true, sans prerolledCrit, `deflectCrit`). Sacrifient 1 PA puis ajoutent `extra`.
    let deviationApplied = false;
    if (res.critical || overkill > 0) {
      if (target.kind === 'enemy')
        deviationApplied = enemyAutoDeviate(set, target, loc, extra, { attackerId: attacker.id, weapon: weapon?.name }, prerolledCrit?.roll ?? res.attackerRoll, critLog, attacker.kind === 'hero');
      else if (deviated === true)
        deviationApplied = deflectCrit(target, loc, extra, critLog);
    }
    if (!deviationApplied && (res.critical || overkill > 0)) {
      // « Subir » après déviation proposée : applique LA Blessure Critique déjà montrée (prerolledCrit), sans
      // re-tirer ni re-révéler (la modale l'a affichée). Sinon : tirage + révélation normaux.
      const lethal = applyCritAndFinalize(get, set, target, loc, !!res.critical, Math.max(0, overkill), critLog, { attackerId: attacker.id, attackerKind: attacker.kind, weapon: weapon?.name, critTwice: hasActiveFlag(attacker, 'critRollTwice') }, currentBefore, prerolledCrit, !!prerolledCrit);
      // Frappe blessante (LDB 10) : +niveau Blessures quand on inflige une Blessure Critique.
      const fb = talentCritExtraWounds(attacker);
      if (fb > 0 && !lethal) {
        target.wounds.current = Math.max(0, target.wounds.current - fb);
        critLog.push(tr('cf.woundingStrike', { name: target.name, n: fb }));
      }
      // Effets « sur Critique » (Taillade → Hémorragique, Aux Armes p.89, et tout futur Trait/Talent/Atout/État)
      // — DISPATCHER UNIQUE générique (data-driven `effects:[{trigger:'onCrit'}]`), comme `onHit`. Plus de
      // boucle bespoke par capacité. (`woundingStrike`/`onCrit` restent dans la branche Subir uniquement.)
      if (res.critical && !lethal)
        critLog.push(...fireTriggers(get, attacker, 'onCrit', { victim: target, weapon, location: loc, woundsDealt: res.woundsLost, attackType: weapon.type, rng: battleRng(), set }));
    }
    // 0 PB → À Terre (LDB 18 l.28) : TOUJOURS quand on tombe à 0, EN PLUS du Critique éventuel (l'overkill
    // déclenche une Blessure critique mais ne dispense pas de l'État À Terre) ; sauf si déjà KO/mort.
    if (target.wounds.current <= 0 && !target.dead && !hasCondition(target, COND.inconscient)) applyZeroWounds(target);
    // Cible neutralisée → on ne reste pas Engagé avec elle (LDB 13) : on lève ses liens immédiatement
    // (sinon ils persisteraient jusqu'au franchissement de Round, bloquant Charge/déplacement libre).
    // Et ses effets PSYCHOLOGIQUES (Peur/Terreur/traits ciblés) prennent fin : on les retire des autres.
    if (isOutOfAction(target)) {
      clearEngagementOf(get().battle?.combatants ?? [], target.id);
      clearPsychOf(get().battle?.combatants ?? [], target.id);
    }
  }
  // Critiques du Test opposé (LDB 14 l.7) : « Si vous obtenez un Critique, votre adversaire reçoit
  // immédiatement une Blessure critique […] le DR est calculé comme d'habitude, tout comme la
  // détermination du vainqueur. » Un double RÉUSSI inflige donc un Critique même sans gagner l'échange.
  // (Pas de garde `deviated` : une 1ʳᵉ entrée qui SUSPEND (déviation) fait son early-return AVANT ce
  // bloc — la reprise « Dévier »/« Subir » l'exécute donc UNE seule fois, comme les sous-attaques.)
  if (weapon.type === 'melee' && res.defenderDetail) {
    const ad = res.attackerDetail;
    const dd = res.defenderDetail;
    // (a) Attaquant : Critique au jet mais échange PERDU (pas de touche) → le défenseur subit un Critique sec.
    if (ad && ad.success && isDoubleRoll(ad.roll) && !res.hit && !isOutOfAction(target)) {
      critLog.push(tr('cf.critDespiteLoss', { name: attacker.name }));
      applyOpposedCritical(get, set, target, ad.roll, { attackerId: attacker.id, weapon: weapon?.name }, critLog);
    }
    // (b) Défenseur : Critique sur sa défense → l'attaquant subit un Critique sec — UNIQUEMENT en PARADE
    // (« Test de Corps à corps », LDB 13 l.184) ; l'Esquive est un Test d'AGILITÉ → ne génère PAS de Critique.
    // `res.parryWeapon` n'est posé qu'en Parade (finishMelee). Un HÉROS qui PARE avec une arme Piège-lame face
    // à une lame peut choisir de PIÉGER à la place (LDB 62 l.292-294) → étape de séquence.
    if (dd.success && isDoubleRoll(dd.roll) && !isOutOfAction(attacker) && res.parryWeapon) {
      if (target.kind === 'hero' && res.parryWeapon && hasBladeTrap(res.parryWeapon) && weaponHasBlade(weapon)) {
        // Folding P3b : le choix Piéger/Critique devient une ÉTAPE de la séquence (texte + options),
        // au lieu d'une modale `pendingBladeTrap` séparée. L'applier 'bladeTrap' appelle resolveBladeTrap.
        const pbt: PendingBladeTrap = { defenderId: target.id, attackerId: attacker.id, weapon, parryWeaponUid: res.parryWeapon.uid!, defSL: dd.sl, roll: dd.roll };
        pushCombatStep(set, {
          id: `cons-bladetrap-${target.id}`, kind: 'bladeTrap', actorId: target.id, icon: 'item/weapon',
          label: 'Parade — piéger la lame ?',
          options: [{ key: 'trap', label: 'Piéger la lame' }, { key: 'crit', label: 'Coup Critique' }],
          defaultChoice: 'crit', bladeTrap: pbt,
          outcome: [
            `${target.name} place un Critique en parant avec ${res.parryWeapon.name} — la lame de ${attacker.name} (${weapon.name}) est à portée.`,
            `Piéger : Test opposé de Force (+${dd.sl} DR). Succès → ${attacker.name} lâche sa lame (Stupéfiant → brisée).`,
          ],
          interactive: true,
        });
      } else {
        critLog.push(tr('cf.critOnDefense', { name: target.name }));
        applyOpposedCritical(get, set, attacker, dd.roll, { attackerId: target.id, weapon: res.parryWeapon?.name }, critLog);
      }
    }
  }
  // Contre-attaque sur Test opposé de défense GAGNÉ en mêlée (Champion LDB 85 « cause autant de Dégâts
  // que si elle était l'attaquant » ; Riposte LDB 10 avec arme Rapide). « Qui peut contrer » lu en DONNÉES
  // (`canCounterOnDefenseWin` → capacité générique `counterOnDefenseWin`) ; la RÉSOLUTION (frappe avec le
  // jet de défense gagnant) reste machinerie (règle universelle).
  if (weapon.type === 'melee' && res.advantageTo === 'defender' && res.netSL > 0
      && canCounterOnDefenseWin(target, res.parryWeapon)
      && !isOutOfAction(target) && target.weapons[0]) {
    const riposte = resolveMeleePassive(target, attacker, target.weapons[0],
      { roll: res.defenderRoll ?? 1, target: res.defenderDetail?.target ?? 1, success: true, sl: res.netSL, isDouble: false });
    if (riposte.hit && riposte.woundsLost) {
      const before = attacker.wounds.current;
      attacker.wounds.current = Math.max(0, before - riposte.woundsLost);
      critLog.push(tr('cf.riposte', { name: target.name, n: riposte.woundsLost }));
      if (attacker.wounds.current <= 0 && !attacker.dead && !hasCondition(attacker, COND.inconscient)) applyZeroWounds(attacker);
      if (isOutOfAction(attacker)) {
        clearEngagementOf(get().battle?.combatants ?? [], attacker.id);
        clearPsychOf(get().battle?.combatants ?? [], attacker.id);
      }
    }
  }
  // Exposition aux Maladies (Infecté/Rongeur/Maladie (Type) ; munition Infecté) MIGRÉE en données :
  // `effects: onHit → if woundsDealt>0 → exposeDisease(<id>)` sur les traits/qualité de l'ATTAQUANT,
  // dispatchés par le `fireTriggers('onHit')` ci-dessous. Op GÉNÉRIQUE unique (plus de flags ad hoc).
  // Le bilan reste héros-only : exposer un non-héros est inerte. (LDB 20 l.32/49 ; LDB 85 p.340.)
  // Nausée (LDB 20 l.170) : un Test de DÉPLACEMENT raté (Esquive) fait vomir → État Sonné.
  if (res.defenderDetail?.mode === 'esquive' && !res.defenderDetail.success
      && hasActiveCapability(target, 'nausea') && !hasCondition(target, COND.sonne)) {
    addCondition(target, COND.sonne);
    critLog.push(tr('cf.vomitStun', { name: target.name }));
  }
  // Effet DÉCLENCHÉ « à la perte de PB » authoré (Sang corrosif : 1d10 aux Engagés, BE+PA, min 1, sur
  // TOUTE Blessure subie — LDB 85 l.220 ; Démoniaque : banni à 0 PB — `if woundsCurrent<=0`). Le TYPE
  // d'attaque (`weapon.type`) voyage dans le contexte ; un effet peut s'y restreindre (`attackType`).
  // Dispatcher générique (state/triggeredEffects), plus de handler en dur ni de branche par-nom.
  if (res.hit && res.woundsLost) {
    for (const line of fireTriggers(get, target, 'onWoundLoss', { rng: battleRng(), set, attackType: weapon.type, woundsDealt: res.woundsLost })) critLog.push(line);
    // Chanson de marin (MDG 09 l.38) : « Si le Personnage subit des Dégâts …, sa Chanson de marin prend fin. »
    if (target.singingShanty) critLog.push(...endShanty(get, target));
  }
  // Effet déclenché « à la mise hors de combat d'un adversaire » authoré (Affamé : Test de FM ou
  // festoie — perd Action + Mouvement) — dispatcher générique (state/triggeredEffects).
  if (res.hit && isOutOfAction(target) && !isOutOfAction(attacker)) {
    for (const line of fireTriggers(get, attacker, 'onKill', { rng: battleRng(), set })) critLog.push(line);
  }
  // Effet « à la mort » du SLAIN lui-même (Démoniaque banni…) — pour TOUT chemin de mort de cette
  // résolution : la CIBLE (touche, Critique létal, 0 PB) ET l'ATTAQUANT (Critique défensif opposé qui le
  // tue PENDANT sa charge). Émis une fois (garde `slainNotified`).
  for (const c of [target, attacker]) critLog.push(...notifySlain(get, set, c));
  // Taille (arme) : sur une touche réussie, endommage de 1 PA l'armure frappée (LDB 63 l.8).
  if (res.hit && hasQuality(weapon, QUALITY_IDS.Taille)) damageArmour(target, res.location ?? 'corps');
  // Tir avec une arme à Recharge → DÉCHARGÉE après le coup (LDB 62 l.333) : un Test étendu de Projectiles est
  // requis avant de retirer. Vaut pour TOUT tireur (héros ET ennemi) — parité du cycle de Rechargement (#126) ;
  // aucun état ni chemin parallèle pour l'IA.
  if (weapon.type === 'ranged' && (weapon.reload ?? 0) > 0) {
    // À Répétition (Indice) (LDB 62 l.264-265) : Indice munitions auto-rechargées entre les coups ;
    // le rechargement complet (Test étendu) n'est exigé qu'une fois le chargeur vide.
    const mag = magazineSize(weapon);
    if (mag != null) attacker.chambered = (attacker.chambered ?? mag) - 1;
    if (mag == null || (attacker.chambered ?? 0) <= 0) {
      attacker.chambered = undefined;
      attacker.loaded = false; // déchargé après le tir
      attacker.reloadProgress = 0;
    }
  }
  // Munition + Salve : suivi HÉROS-only (les ennemis ne comptabilisent pas de munitions, #126). `consumeAmmo` =
  // source unique du décrément (stock du poste servi OU inventaire).
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    attacker.shotsThisTurn = (attacker.shotsThisTurn ?? 0) + 1; // Salve : compteur de tirs du tour (−10 cumulatif)
    const used = selectedAmmo(attacker, weapon);
    if (used) consumeAmmo(attacker, used);
  }
  // Interruption du rechargement (LDB 62 l.335) : tout tireur touché en plein rechargement recommence à zéro.
  if (res.hit && res.woundsLost && (target.reloadProgress ?? 0) > 0) target.reloadProgress = 0;
  // Avantage (LDB Déplacement l.30-40) : +1 au vainqueur du Test opposé / sur une
  // Blessure infligée sans Test opposé (tir) ; perte de TOUT l'Avantage en échouant
  // un Test opposé ou en perdant une Blessure.
  if (res.advantageTo === 'attacker' && !deferAttackerAdvantage) {
    // Renversement : « au lieu de gagner +1, prendre l'Avantage adverse ». LDB 10 → tout l'Avantage
    // individuel de la cible (quand c'est mieux que +1) ; variante « Avantage de groupe » (AA l.4442) →
    // 1 dans la réserve adverse. Sinon +1 au vainqueur du Test opposé (per-combattant OU réserve du camp).
    if (weapon.type === 'melee' && stealsOneAdvantage(attacker)) {
      if (reversalStealOne(get, attacker, target)) critLog.push(tr('cf.reversal', { name: attacker.name }));
    } else if (weapon.type === 'melee' && hasStealAdvantage(attacker) && (target.advantage ?? 0) > 1) {
      gainAdvantage(attacker, target.advantage);
      target.advantage = 0;
      critLog.push(tr('cf.reversal', { name: attacker.name }));
    } else campGain(get, attacker);
    attacker.gainedAdvThisRound = true;
  }
  if (res.advantageTo === 'defender') {
    // Renversement côté défenseur (même règle qu'à l'attaque : voler l'Avantage adverse, ou +1).
    if (weapon.type === 'melee' && stealsOneAdvantage(target)) {
      if (reversalStealOne(get, target, attacker)) critLog.push(tr('cf.reversal', { name: target.name }));
    } else if (weapon.type === 'melee' && hasStealAdvantage(target) && (attacker.advantage ?? 0) > 1) {
      gainAdvantage(target, attacker.advantage);
      critLog.push(tr('cf.reversal', { name: target.name }));
    } else campGain(get, target);
    target.gainedAdvThisRound = true;
    if (!groupAdvantage()) attacker.advantage = 0; // l'attaquant a échoué au Test opposé (LDB ; pas de perte per-combattant en mode groupe)
  }
  if (res.hit && res.woundsLost && !groupAdvantage()) target.advantage = 0; // perdre une Blessure → perte de tout Avantage (LDB ; inerte en mode groupe)
  // Porte-Bouclier (LDB 10 p.144, VERBATIM) : « vous gagnez [niveau] Avantages SI VOUS PERDEZ le Test opposé »
  // en vous défendant au Bouclier — consolation d'une « situation désespérée », APRÈS la perte d'Avantage due
  // à la Blessure / au Test perdu. Défense PERDUE = l'attaquant a gagné (`advantageTo === 'attacker'`) et le
  // défenseur a paré au Bouclier (`res.parryWeapon`). Variante groupe AA → `shieldAdvantageLevel` = 0.
  if (res.advantageTo === 'attacker') {
    const shieldAdv = shieldAdvantageLevel(target, res.parryWeapon);
    if (shieldAdv) { campGain(get, target, shieldAdv); target.gainedAdvThisRound = true; }
  }
  const kind = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const defense = weapon.type === 'ranged' ? 'none' : bestDefenseMode(target);
  // Orientation : l'attaquant se tourne vers la cible, le défenseur vers l'attaquant (frappe offensive).
  if (attacker.pos && target.pos) {
    set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
  }
  // `weapon`/`parryWeapon` voyagent dans l'événement : le rig joue le geste de l'arme EMPLOYÉE
  // (2e frappe de dague gauche, tentacule…) et la parade de l'arme QUI A PARÉ (main-gauche,
  // bouclier) — pas ceux de l'arme principale.
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense, weapon, parryWeapon: res.parryWeapon, creatureAttack: creatureAttackKind(weapon) });
  const evKind: CombatEventKind = weapon.type === 'ranged' ? 'shoot' : 'attack';
  const log = [...battle.log, ev(evKind, res.log, attacker.id, target.id)];
  // Dispersion (LDB 14 l.144-151) : une arme de JET (Portée `{bf}`) dont le Test de Projectiles (Lancer)
  // ÉCHOUE dévie vers une tuile (1d10 direction / 9 = pieds du lanceur / 10 = pieds de la cible, 2d10 m
  // plafonnés à la demi-distance). Le jeu ne modélise pas l'arme au sol → l'effet visible RAW = la tuile
  // d'atterrissage (floater FX + journal). Les tirs à Portée FIXE (arc/arbalète/poudre) ratent sans dévier.
  if (!res.hit && isThrownWeapon(weapon) && attacker.pos && target.pos) {
    const land = scatter(attacker.pos, target.pos, battleRng(), sceneMetresPerTile(get().scene), get().scene?.dimensions);
    bus.emit(EVT.ANIM_FLOAT, { pos: land, text: tr('cf.scatterFloat'), kind: 'miss' });
    log.push(ev(evKind, tr('cf.scatter', { name: attacker.name }), attacker.id, target.id));
  }
  log.push(...evLines(critLog, 'crit', attacker.id, target.id));
  // Nerveux (LDB 85 p.340) : « facilement effrayée par […] les bruits forts » — un coup d'arme à
  // feu (Poudre noire/Explosion) terrifie les créatures Nerveuses présentes : +3 État Brisé.
  if (weapon.type === 'ranged' && isFirearmQuality(weapon)) {
    for (const c of battle.combatants) {
      // Nerveux (effet déclenché onStartled : +3 Brisé) — fired par le dispatcher générique (no-op si absent).
      // Cause 'noise' (bruits forts) → exemption Dressé (Guerre) lue par la Condition Flow `startleCause`.
      if (!isOutOfAction(c)) for (const line of fireTriggers(get, c, 'onStartled', { set, startleCause: 'noise' })) log.push(ev('condition', line, c.id));
    }
  }
  // Effets DÉCLENCHÉS « à la touche » authorés (donnée éditable) : Traits de l'attaquant (Toile, Venin…),
  // Atouts de l'arme (Assommante, Immobilisante…) et Enchantements actifs — agrégés et appliqués par UN
  // dispatcher générique (state/triggeredEffects). `location` (Assommante Tête) et `woundsDealt` (Venin
  // sur PB) alimentent les Conditions Flow de gating.
  if (res.hit) for (const line of fireTriggers(get, attacker, 'onHit', { victim: target, weapon, woundsDealt: res.woundsLost, margin: res.netSL, location: res.location, attackKind: creatureAttackKind(weapon), attackType: weapon.type, rng: battleRng(), set })) log.push(ev('condition', line, target.id));
  // Combat de masse (ADE II 08 l.139/145) : une Scène de COMBAT compte les touches des PJ sur l'ennemi
  // (−1/touche) ; no-op hors bataille de masse. Réduction PUIS résolue à la victoire (massBattleResumeCombat).
  if (res.hit) massBattleTrackHit(get, set, attacker, target);
  // Munitions/armes à AIRE (Tir de zone / Explosion) — résolveur UNIQUE partagé avec la bordée navale
  // (`combatArea.resolveWeaponArea`). Bande de portée + rayon en mètres convertis à l'échelle de la scène ;
  // les États « infligés par l'arme » sont propagés par le chemin GÉNÉRIQUE onHit (cf. `hitSecondary`).
  if (res.hit && weapon.type === 'ranged' && res.damage != null && attacker.pos && target.pos && !isOutOfAction(target)) {
    const area = resolveWeaponArea(get, set, {
      attacker, primaryTarget: target, weapon, damage: res.damage, location: res.location ?? 'corps', distanceTiles: combatDistance(attacker, target), margin: res.netSL,
    }, battleAreaTargets(get), battleRng());
    log.push(...evLines(area.lines, 'shoot', attacker.id, target.id));
  }
  // Interruption de Focalisation (LDB 46 l.193-194) : Dégâts subis pendant qu'on focalise
  // → Test de Calme Difficile (−20) ou perte des DR accumulés + Imparfaite Mineure.
  if (res.hit && res.woundsLost) log.push(...evLines(checkFocusInterruption(get, set, target), 'detail', target.id));
  if (isOutOfAction(target) && !isStructure(target)) log.push(ev('death', `${target.name} est mis hors de combat !`, target.id)); // structure → ligne d'Effondrement (collapseStructure), pas « hors de combat »
  // Salve (Aux Armes p.126) : un héros qui tire une arme à Salve gardant des tirs (chambered > 0) ne
  // consomme PAS son Action — il peut tirer encore ce tour (chaque tir suivant à −10 cumulatif).
  const salvoContinues = attacker.kind === 'hero' && weapon.type === 'ranged' && hasQuality(weapon, QUALITY_IDS.Salve) && (attacker.chambered ?? 0) > 0;
  // Lignes de journal différées par un hook profond (ex. `onGainCondition` ennemi/auto déclenché plus
  // haut dans cette résolution) → foldées dans le MÊME `log` réécrit, avant que ce `set` ne le clobbere.
  log.push(...drainPendingLog(get, set));
  set({ battle: { ...battle, acted: !salvoContinues, action: null, log } });
  // Structure de siège tombée à 0 Blessure → BRÈCHE : retrait du Combattant inerte + flag d'arête abattue.
  // APRÈS le `set` ci-dessus (qui réécrit `battle` depuis la capture STALE) pour ne pas re-réintroduire la structure.
  if (isStructure(target) && target.wounds.current <= 0) collapseStructure(get, set, target);
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resolveEnemyFumble(get, set, attacker, weapon, res); // Maladresse d'un ENNEMI attaquant → résolue instantanément
  // Maladresse d'un ENNEMI défenseur (Test opposé, LDB 14 l.48-51) : sa Parade/Esquive ratée sur un double.
  if (target.kind === 'enemy' && defenderFumbled(res, target.weapons[0], target) && !isOutOfAction(target) && target.weapons[0]) {
    applyOups(get, set, target, target.weapons[0], rollOups(target.weapons[0], battleRng()));
  }
  return false; // non suspendu : application complète terminée
}

/**
 * Interruption de Focalisation (LDB 46 l.194) : « La concentration est vitale pour focaliser. Si vous êtes
 * perturbé par quelque chose – bruits forts, Dégâts subis… –, vous devrez réussir un Test de Calme Difficile
 * (-20) ou subir une Incantation Imparfaite Mineure et perdre tous les DR accumulés jusque-là au Test étendu
 * de Focalisation. »
 *
 * Le Test de Calme du focaliseur est ROUTÉ par l'exécuteur de Flow CADENCE-AWARE (`runCombatFlow`) : héros en
 * cadence MANUELLE → étape de cascade INFLUENÇABLE (il PEUT dépenser sa Chance / sa Résilience pour garder son
 * sort) ; ennemi / cadence auto → jet inline. La branche d'ÉCHEC porte le marqueur `interruptFocus`, dont la
 * conséquence PROCÉDURALE (perte des DR + Imparfaite Mineure) s'exécute APRÈS le Test résolu, via le hook
 * `focusInterrupt` (→ `applyFocusInterruption`). Le résultat est porté par l'étape de cascade (manuel) ou la
 * ligne inline (auto). Le journal inline part dans la file différée (`pendingLogQueue`,
 * drainée par l'appelant — `applyAttackResult` / `applyCast`).
 */
export function checkFocusInterruption(get: Get, set: SetFn, target: Combatant): string[] {
  if (!target.focus || target.focus.dr <= 0) return [];
  // Branche d'échec : marqueur `interruptFocus` sur la cible (le focaliseur) → hook injecté. Succès = rien
  // (concentration maintenue, DR conservés). Le nœud `test` est résolu cadence-aware par `runCombatFlow`.
  const flow = testFlow(
    { skill: 'calme', difficulty: 'difficile', label: 'Focalisation interrompue' },
    EMPTY_FLOW,
    { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'interruptFocus' }] } },
  );
  runCombatFlow({ mode: 'combat', get, set, target, caster: target, label: 'Focalisation interrompue' }, flow);
  return []; // le journal voyage par la cascade (manuel) ou la file différée (inline) — pas de retour inline
}

/**
 * Conséquence PROCÉDURALE d'un Test de Calme d'interruption RATÉ (op `interruptFocus`, hook `focusInterrupt`) :
 * le focaliseur perd tous les DR accumulés sur son Sort focalisé (couverts par son composant — LDB 46 l.161) et
 * subit une Incantation Imparfaite Mineure (LDB 46 l.194). L'Imparfaite garde son rendu propre (étape de cascade
 * `miscast` pour un héros / lignes pour un ennemi) : le Test de Calme est l'étape influençable visible,
 * l'Imparfaite est sa conséquence en aval. Les lignes partent dans la file
 * différée (`pendingLogQueue`), drainée par l'appelant qui réécrit `battle.log`.
 */
export function applyFocusInterruption(get: Get, set: SetFn, focuser: Combatant): void {
  if (!focuser.focus || focuser.focus.dr <= 0) return; // garde (le composant/DR a pu changer entre Test et conséquence)
  const focusedSpellId = focuser.focus.spell;
  const lines = [tr('cf.focusLost', { name: focuser.name, dr: focuser.focus.dr, spell: findSpellById(focusedSpellId)?.label ?? focusedSpellId })];
  focuser.focus = undefined;
  const compUsed = useSpellComponent(focuser, focusedSpellId, lines); // un composant couvre aussi la Focalisation (incantation en cours)
  lines.push(...applyMiscast(get, set, focuser, 'mineure', { componentDowngrade: compUsed }));
  set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid: focuser.id }))] });
}

/** Une Maladresse de l'attaquant dans un résultat d'attaque ? (jet propre raté + double, LDB 14 l.53 ;
 *  arme Dangereuse : aussi tout jet raté incluant un 9, LDB 62 l.315 ; Doigts amputés : escalade par
 *  chiffre des unités si `attacker` fourni, LDB 18 l.251 — réutilise `maxFingersLostForWeapon`, #144). */
export function attackerFumbled(res: AttackResult, weapon?: Weapon, attacker?: Combatant): boolean {
  if (!res.attackerDetail) return false;
  const { roll, success } = res.attackerDetail;
  const fingers = attacker && weapon ? maxFingersLostForWeapon(attacker, weapon) : 0;
  return isFumble(roll, success, fingers) || dangerousNine(weapon, roll, success);
}

/** Une Maladresse du DÉFENSEUR (Test opposé) : sa défense propre ratée sur un double (LDB 14 l.48-51 ;
 *  parade avec une arme Dangereuse : aussi tout jet raté incluant un 9, LDB 62 l.315 ; Doigts amputés :
 *  escalade par chiffre des unités si `defender` fourni, LDB 18 l.251, #144). */
export function defenderFumbled(res: AttackResult, parryWeapon?: Weapon, defender?: Combatant): boolean {
  if (!res.defenderDetail) return false;
  const { roll, success } = res.defenderDetail;
  const fingers = defender && parryWeapon ? maxFingersLostForWeapon(defender, parryWeapon) : 0;
  return isFumble(roll, success, fingers) || dangerousNine(parryWeapon, roll, success);
}

/** La cible est-elle dans une bande de tir/portée VALIDE de `weapon` pour `shooter` (LDB 14 l.42-46) ?
 *  Tir → bande de portée non nulle (munition + BF inclus) ; mêlée → Allonge (`reachTiles`). Position
 *  inconnue (tests) → vrai (aucun filtre géométrique). Source UNIQUE du test « à distance de frappe ». */
export function inFiringBand(shooter: Combatant, target: Combatant, weapon: Weapon): boolean {
  if (!shooter.pos || !target.pos) return true;
  const d = combatDistance(shooter, target);
  if (weapon.type === 'ranged') {
    const rm = effectiveWeaponRange(weapon, selectedAmmo(shooter, weapon)?.ammoRangeMod, () => bonus(effectiveChar(shooter, 'F')));
    return rm != null && rangeBandModifier(d, rm) != null;
  }
  return d <= reachTiles(weapon);
}

/** Alliés (même camp) encore actifs, hors `c`, et À PORTÉE de `weapon` (LDB 14 l.42-46 : « à distance »).
 *  Sans position connue (tests), on ne filtre pas. */
function alliesAtRange(battle: BattleState, c: Combatant, weapon: Weapon): Combatant[] {
  return battle.combatants.filter((x) => x.id !== c.id && x.kind === c.kind && !isOutOfAction(x) && inFiringBand(c, x, weapon));
}

/**
 * Tir rapide (talent, LDB 10) — chemin IA. À l'ouverture d'un Round (sommet de `confirmRoundStart`, choke
 * commun à tous les Rounds et tous les modes), chaque combattant PILOTÉ PAR L'IA capable d'interrompre à
 * distance tire UNE fois, hors de l'ordre d'Initiative, sur l'ennemi valide le plus proche (Ligne de Vue +
 * bande de portée). Le tir ÉPUISE son tour normal — Action + Mouvement dus, consommés à l'ouverture de son
 * slot (loseNext*, mêmes champs que la Maladresse Oups! 61-80). Plusieurs tireurs : celui qui a pris le
 * talent le plus de fois agit d'abord (LDB 10). Les tirs de l'HUMAIN passent, eux, par `preemptRangedShot`
 * pendant la pause de début de Round (avant ce choke).
 */
export function runPreemptShots(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  const tirRapideTimes = (c: Combatant) => c.talents?.find((tl) => tl.talentId === 'tir-rapide')?.times ?? 1;
  const shooters = battle.combatants
    .filter((s) => aiDriven(get(), s) && canPreemptRanged(s) && canTakeAction(s) && !s.loseNextAction && !isOutOfAction(s) && !!s.pos)
    .sort((a, b) => tirRapideTimes(b) - tirRapideTimes(a)); // le plus « entraîné » tire d'abord (LDB 10)
  let changed = false;
  for (const shooter of shooters) {
    if (isOutOfAction(shooter) || shooter.loseNextAction) continue; // tué / déjà tiré par un tir précédent de ce Round
    const target = battle.combatants
      .filter((f) => f.kind !== shooter.kind && !isOutOfAction(f) && !!f.pos)
      .map((f) => ({ f, weapon: firedWeapon(shooter, f, undefined, battle.combatants) }))
      .filter((x) => x.weapon.type === 'ranged' && inFiringBand(shooter, x.f, x.weapon))
      .sort((a, b) => combatDistance(shooter, a.f) - combatDistance(shooter, b.f))
      .map((x) => x.f);
    for (const t0 of target) {
      const r = resolveAttack(get, shooter, t0); // null = pas de Ligne de Vue
      if (!r) continue;
      get().battle!.log.push(ev('shoot', tr('cf.tirRapide', { name: shooter.name }), shooter.id)); // marqueur AVANT le résultat (applyAttackResult recopie battle.log)
      applyAttackResult(get, set, shooter, r.victim ?? t0, r.weapon, r.res);
      shooter.loseNextAction = true; shooter.loseNextMovement = true; // tour normal épuisé (LDB 10)
      changed = true;
      break;
    }
    if (changed && checkBattleOver(get, set)) return;
  }
  if (changed) { set({ battle: { ...get().battle! } }); bus.emit(EVT.SCENE_DIRTY); }
}

/** Use/détruit l'arme sur l'ItemInstance SOURCE (héros → persiste, `recomputeLoadout` re-dérive),
 *  sinon sur le Weapon actif (ennemi/figurant, transient). Respecte Incassable (LDB 62 l.310). */
function wearActiveWeapon(c: Combatant, weapon: Weapon, destroy: boolean): void {
  // L'ItemInstance source de l'arme tenue : match par `uid` (posé par recomputeLoadout sur le Weapon dérivé).
  // Mains nues / Crochet n'ont pas d'uid → pas d'item source (usure transient via le `else` ci-dessous).
  const it = weapon.uid ? (c.items ?? []).find((i) => i.uid === weapon.uid) : undefined;
  if (isUnbreakable(it ?? weapon)) return; // Incassable : ni dégât ni destruction (LDB 62 l.310)
  // Sauvegarde Solide(N) contre une cassure instantanée : 1d10 ≥ seuil → l'arme résiste (LDB 60 l.64-67).
  if (destroy) {
    const thr = solideSaveThreshold(weapon);
    if (thr != null && d10(battleRng()) >= thr) return;
  }
  if (it) {
    if (destroy) {
      it.destroyed = true;
    } else {
      // Une Arme improvisée déjà à +0 qui prend un Dégât de plus devient inutilisable (LDB 62 l.178).
      if (isImprovised({ ...weapon, damageTaken: it.damageTaken ?? 0 })) it.destroyed = true;
      it.damageTaken = (it.damageTaken ?? 0) + 1;
    }
    recomputeLoadout(c); // re-dérive c.weapons depuis l'item usé (persiste via carryOverState items)
  } else if (destroy) {
    destroyWeapon(weapon);
  } else {
    damageWeapon(weapon);
  }
}

/**
 * Applique l'effet du Tableau des Oups ! au combattant `c` (mute + journalise). LDB 14 l.14-57.
 * Le chiffre des unités du jet sert de DR pour les touches (l.44).
 */
export function applyOups(get: Get, set: SetFn, c: Combatant, weapon: Weapon, r: OupsResolved): void {
  const battle = get().battle!;
  const log: string[] = [`${c.name} — Maladresse ! ${r.label}`];
  // Bâclé : l'arme casse sur toute Maladresse (Test raté + double, LDB 60 l.82) — sauvegarde Solide possible.
  if (hasQuality(weapon, QUALITY_IDS.Bacle)) wearActiveWeapon(c, weapon, true);
  const sb = bonus(effectiveChar(c, 'F'));
  const units = r.roll % 10;
  switch (r.kind) {
    case 'selfWound':
      c.wounds.current = Math.max(0, c.wounds.current - 1); // ignore BE+PA (l.18)
      if (c.wounds.current <= 0) applyZeroWounds(c);
      break;
    case 'weaponDamageActLast':
      wearActiveWeapon(c, weapon, false); // 1 Dégât d'arme, persisté sur l'ItemInstance source
      c.actLastNextRound = true;
      break;
    case 'actionPenalty':
      c.nextActionPenalty = 10;
      break;
    case 'loseMovement':
      c.loseNextMovement = true;
      break;
    case 'loseAction':
      c.loseNextAction = true;
      break;
    case 'trauma': {
      c.criticalWounds = (c.criticalWounds ?? 0) + 1; // « compte comme une Blessure critique » (l.41)
      const leg: HitLocation = battleRng().int(0, 1) === 0 ? 'jambeG' : 'jambeD'; // « se tord la cheville »
      c.traumas = [...(c.traumas ?? []), traumaById(dechirureFractureFicheId('dechirure', 'mineur', leg), { be: bonus(effectiveChar(c, 'E')) }, leg)];
      log.push(tr('cf.fumbleTear', { leg: leg === 'jambeG' ? tr('cf.legLeft') : tr('cf.legRight') }));
      break;
    }
    case 'hitAlly': {
      const allies = alliesAtRange(battle, c, weapon);
      if (allies.length) {
        const ally = allies[battleRng().int(0, allies.length - 1)];
        const loc = hitLocationByShape(reverseRoll(r.roll), ally.bodyShape);
        const lost = woundsFromHit(weapon, ally, loc, effectiveWeaponDamage(weapon, sb) + units); // plancher 1 (l.165)
        ally.wounds.current = Math.max(0, ally.wounds.current - lost);
        if (ally.wounds.current <= 0) applyZeroWounds(ally);
        log.push(tr('cf.fumbleHitAlly', { name: ally.name, loc: locationLabel(loc, ally.bodyShape), lost }));
      } else {
        addCondition(c, COND.sonne); // « Si personne n'est à distance, vous vous frappez tout seul → Sonné » (l.45-46)
        log.push(tr('cf.fumbleSelfStun'));
      }
      break;
    }
    case 'misfire': {
      const lost = woundsFromHit(weapon, c, 'brasD', effectiveWeaponDamage(weapon, sb) + units); // plancher 1
      c.wounds.current = Math.max(0, c.wounds.current - lost);
      if (c.wounds.current <= 0) applyZeroWounds(c);
      wearActiveWeapon(c, weapon, true); // arme détruite, persistée sur l'ItemInstance source
      log.push(tr('cf.fumbleMisfire', { lost }));
      // Arme d'équipe (MDG ch.12 l.464) : « Si une arme dotée du Défaut Arme d'équipe subit un Incident de
      // tir, tous les membres de son équipage sont affectés. » → CHAQUE servant APTE du poste (hors le
      // tireur, déjà frappé ci-dessus) subit le même coup (Dégâts au Bras principal, mitigés à SA fiche).
      if (hasQuality(weapon, QUALITY_IDS.ArmeDEquipe) && c.mannedPoste) {
        const servants = exposedCrew((c.mannedPoste.crewIds ?? [])
          .filter((id) => id !== c.id)
          .map((id) => battle.combatants.find((x) => x.id === id))
          .filter((x): x is Combatant => !!x));
        for (const s of servants) {
          const sLost = woundsFromHit(weapon, s, 'brasD', effectiveWeaponDamage(weapon, sb) + units);
          s.wounds.current = Math.max(0, s.wounds.current - sLost);
          if (s.wounds.current <= 0) applyZeroWounds(s);
          log.push(tr('cf.fumbleMisfireCrew', { name: s.name, lost: sLost }));
        }
      }
      break;
    }
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'info', c.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Maladresse d'un attaquant PILOTÉ PAR L'IA : résolue instantanément (IA abstraite). No-op si piloté humain/pas de fumble. */
export function resolveEnemyFumble(get: Get, set: SetFn, enemy: Combatant, weapon: Weapon, res: AttackResult): void {
  if (!aiDriven(get(), enemy) || !attackerFumbled(res, weapon, enemy)) return;
  applyOups(get, set, enemy, weapon, rollOups(weapon, battleRng()));
}

/** Ouvre la modale de défense réactive si l'attaque est : attaquant PILOTÉ PAR L'IA → défenseur PILOTÉ
 *  PAR UN HUMAIN, en mêlée, à portée, cible CAPABLE de se défendre (pas Surpris). Fige le jet d'attaque et
 *  suspend le tour de l'IA. Retourne true si la modale s'est ouverte. */
export function maybeOpenDefense(
  get: Get,
  set: SetFn,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon = attacker.weapons[0],
  free?: { kind: string; prevActed: boolean },
): boolean {
  if (!aiDriven(get(), attacker) || !pilotedByHuman(get(), target)) return false;
  // TIR sur un héros : ouvre la défense réactive UNIQUEMENT si le RAW l'autorise (Protectrice 2+ en
  // Ligne de Vue LDB 62 l.307 / Bout Portant LDB 14 l.62 / tireur Engagé LDB 14 l.70). Vide = tir non
  // opposable → résolution simple (resolveAttack). LoS acquise : l'IA ne tire que si elle voit (doAttack).
  if (weapon?.type === 'ranged') {
    const dist = combatDistance(attacker, target);
    const modes = rangedDefenseModes(attacker, target, weapon, dist, true);
    if (!modes.length) return false;
    const { env } = attackEnv(get, attacker, target, weapon);
    const atk = rollRangedAttacker(attacker, target, weapon, battleRng(), dist, undefined, env); // tir figé
    const best = bestRangedDefense(attacker, target, weapon, dist);
    set({
      pendingDefense: {
        attackerId: attacker.id, defenderId: target.id, weapon, location: null, atk,
        mode: best?.mode ?? modes[0], parryWeaponUid: best?.parryWeapon?.uid, modes, distanceTiles: dist, def: null, result: null,
        ...(free ? { free: true, freeKind: free.kind, prevActed: free.prevActed } : {}),
      },
    });
    startCascade(get, set, { title: 'Défense', icon: 'action/defend', purpose: 'combat', steps: [{ id: 'defense-jet', kind: 'defenseJet', jet: 'defense', actorId: target.id }] });
    return true;
  }
  if (weapon?.type !== 'melee') return false;
  if (combatDistance(attacker, target) > reachTiles(weapon)) return false; // Allonge incluse (RAW-3)
  if (cannotDefend(target)) return false; // Surpris → résolution instantanée (LDB États l.132)
  applyIncomingMeleeAdvantage(get, attacker, target); // +1 Avantage si cible Sonnée, AVANT le jet (une seule fois)
  // Le MÊME env que resolveAttack (météo, Flanc/dos, Surnombre, Combat monté) : le jet figé de la
  // défense réactive l'omettait — un cavalier IA attaquait un héros sans son +20 (LDB 14 l.217).
  const { env } = attackEnv(get, attacker, target, weapon);
  const atk = rollMeleeAttacker(attacker, target, weapon, battleRng(), undefined, env); // jet d'attaque figé
  set({
    pendingDefense: {
      attackerId: attacker.id,
      defenderId: target.id,
      weapon,
      location: null, // l'IA ne vise pas de localisation
      atk,
      mode: bestDefenseMode(target),
      def: null,
      result: null,
      // Attaque GRATUITE de créature (Morsure/Caudale/Piétinement) : portée au resolve pour
      // restaurer l'Action (gratuite), appliquer ses effets RAW et enchaîner la file.
      ...(free ? { free: true, freeKind: free.kind, prevActed: free.prevActed } : {}),
    },
  });
  startCascade(get, set, { title: 'Défense', icon: 'action/defend', purpose: 'combat', steps: [{ id: 'defense-jet', kind: 'defenseJet', jet: 'defense', actorId: target.id }] });
  return true;
}

/** Attaque de l'IA : ouvre la modale de défense (→ true, tour SUSPENDU) si la cible
 *  est un héros qui peut se défendre en mêlée ; sinon résout instantanément (→ false). */
export function doAttack(get: Get, set: SetFn, attacker: Combatant, target: Combatant): boolean {
  // Bénédiction de Protection (LDB 41 — L13) : Test de FM Accessible (+20) pour oser attaquer le
  // béni ; échec → l'IA renonce à CE coup (simplification : pas de re-ciblage, documentée).
  const ward = attackWardGate(attacker, target);
  const b0 = get().battle;
  if (ward.lines.length && b0) set({ battle: { ...b0, log: [...b0.log, ...evLines(ward.lines, 'info', attacker.id)] } });
  if (!ward.allowed) return false;
  if (maybeOpenDefense(get, set, attacker, target)) return true; // suspendu : reprise via defenseConfirm/Cancel
  // Tir ennemi : l'annoncer dans le journal de COMBAT (battle.log → fil + tiroir) DÈS la décision — un tir
  // n'ouvre pas de modale de défense, donc « on ne savait jamais sur qui il tirait » (#12d). Avant, l'annonce
  // partait dans le journal du GROUPE (invisible en combat).
  if (firedWeapon(attacker, target).type === 'ranged') {
    const b0 = get().battle;
    if (b0) set({ battle: { ...b0, log: [...b0.log, ev('shoot', tr('cf.aim', { name: attacker.name, target: target.name }), attacker.id, target.id)] } });
  }
  applyIncomingMeleeAdvantage(get, attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
  // Charge montée (LDB 14 l.223) : si l'attaquant a chargé ce tour, ses dégâts utilisent la Force + la
  // Taille de sa monture — PARITÉ avec le joueur (le proxy ne s'applique que s'il chevauche réellement).
  const r = resolveAttack(get, attacker, target, undefined, attacker.chargedThisTurn);
  if (!r) {
    get().log(firedWeapon(attacker, target).type === 'ranged' ? tr('cf.noLoSMasked') : tr('cs.meleeOutOfRange'));
    return false;
  }
  const suspended = applyAttackResult(get, set, attacker, r.victim ?? target, r.weapon, r.res); // r.victim = allié touché par un tir dévié (LDB 14 l.136)
  if (suspended) return true; // Déviation Critique du héros : la modale reprendra (autoCleave/Piétinement/advance rejoués au resolve)
  autoCleave(get, set, attacker, r.victim ?? target, r.res); // Frappe Mortelle : balayage auto si l'ennemi est plus grand
  return false;
}

// ---------------------------------------------------------------------------
// Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299)
// ---------------------------------------------------------------------------

/** Cibles de balayage : adversaires encore actifs, ADJACENTS (Chebyshev ≤ 1 — « à portée de ses
 *  attaques » = adjacence tant que l'Allonge n'est pas modélisée) et non déjà frappés dans ce
 *  balayage. Sans position connue (tests purs), on ne filtre pas sur la distance. */
export function cleaveTargets(battle: BattleState, attacker: Combatant, hitIds: string[]): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c) || hitIds.includes(c.id)) return false;
    if (!attacker.pos || !c.pos) return true;
    return combatDistance(attacker, c) <= 1;
  });
}

/** Balayage AUTOMATIQUE d'un ennemi (IA) après une touche de mêlée d'un plus grand (`res.cleave`,
 *  LDB 85 l.299) : enchaîne jusqu'à BCC attaques sur des adversaires adjacents non encore frappés,
 *  se déplaçant sur la case d'une cible tuée (l.10). Résolution instantanée — les enchaînements
 *  n'ouvrent pas de modale de défense interactive (simplification documentée pour l'IA).
 *  MACHINERIE GÉOMÉTRIQUE (pas une réaction d'entité câblée par-nom) : le déclencheur `res.cleave` est
 *  dérivé GÉNÉRIQUEMENT (combat.ts : `attacker.swarm` ∨ `sizeGap ≥ 1`) et la Frappe Mortelle est une
 *  RÈGLE OPTIONNELLE (`combat-frappe-mortelle`) ; le ciblage est l'adjacence pure (`cleaveTargets`). Aucun
 *  trait/talent n'est nommé — règle universelle de l'arène pour les attaquants surdimensionnés/Nuée. */
export function autoCleave(get: Get, set: SetFn, attacker: Combatant, primaryTarget: Combatant, res: AttackResult): void {
  if (!aiDriven(get(), attacker)) return;
  const sizeCleave = !!res.cleave; // Taille/Nuée : enchaîne sur une simple TOUCHE (LDB 85 l.299)
  // Frappe Mortelle (option, hors Taille) : enchaîner seulement après avoir TUÉ en un coup (LDB 14 l.9).
  const fm = !sizeCleave && !!rule('combat-frappe-mortelle') && isOutOfAction(primaryTarget);
  if (!sizeCleave && !fm) return;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  if (bcc < 1) return;
  const hitIds = [primaryTarget.id];
  // Cible primaire tuée → l'attaquant se déplace sur sa case avant d'enchaîner (l.10).
  if (isOutOfAction(primaryTarget) && primaryTarget.pos) {
    placeCombatant(attacker, get().scene, primaryTarget.pos);
    displaceSmaller(get, attacker); // en se recalant, un grand dégage les plus petits sous son empreinte (85 l.373-374)
  }
  for (let n = 0; n < bcc; n++) {
    const battle = get().battle;
    if (!battle || battle.over) break;
    const next = cleaveTargets(battle, attacker, hitIds)[0];
    if (!next) break;
    hitIds.push(next.id);
    const r = resolveAttack(get, attacker, next);
    if (!r) continue; // hors de portée (ne devrait pas : déjà filtré adjacent) — borne consommée tout de même
    applyAttackResult(get, set, attacker, r.victim ?? next, r.weapon, r.res, false); // enchaînement : résolution instantanée (pas de modale de déviation imbriquée)
    const killed = isOutOfAction(next);
    if (killed && next.pos) {
      placeCombatant(attacker, get().scene, next.pos); // se déplace sur la case libérée
      displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.373-374)
    }
    if (fm && !killed) break; // Frappe Mortelle : on ne poursuit qu'en TUANT (LDB 14 l.9)
  }
  set({ battle: { ...get().battle! } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Balayage d'un HÉROS (interactif) : appelé après l'application d'une attaque. Démarre le balayage
 *  sur une touche d'un plus grand (`res.cleave`), ou le poursuit si `wasChain` (un enchaînement vient
 *  d'être résolu). Ouvre/maintient `pendingCleave` tant qu'il reste des cibles adjacentes ET que le
 *  nombre d'enchaînements reste < BCC (LDB 14 l.12) ; sinon le ferme. Déplacement sur la case d'une
 *  cible tuée (l.10). */
export function maybeHeroCleave(get: Get, set: SetFn, attacker: Combatant, target: Combatant, res: AttackResult, wasChain: boolean): void {
  if (!pilotedByHuman(get(), attacker)) return;
  const pc = get().pendingCleave;
  const sizeCleave = !!res.cleave; // Taille : enchaîne sur une simple TOUCHE (LDB 85 l.299)
  // Démarrage Frappe Mortelle (option, hors Taille) : la cible doit être TUÉE en un coup (LDB 14 l.9).
  const fmStart = !pc && !sizeCleave && !!rule('combat-frappe-mortelle') && isOutOfAction(target);
  if (!pc && !sizeCleave && !fmStart) return; // ni balayage en cours, ni déclenché par cette touche
  const fm = pc ? !!pc.fm : fmStart; // mode porté par le pending (Taille vs Frappe Mortelle)
  const count = wasChain ? (pc?.count ?? 0) + 1 : pc?.count ?? 0; // un enchaînement résolu consomme une attaque
  const hitIds = pc ? [...new Set([...pc.hitIds, target.id])] : [target.id];
  if (isOutOfAction(target) && target.pos) {
    placeCombatant(attacker, get().scene, target.pos); // case libérée (l.10)
    displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.373-374)
  }
  const battle = get().battle!;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  const remaining = cleaveTargets(battle, attacker, hitIds);
  // Frappe Mortelle : la poursuite EXIGE d'avoir tué la cible enchaînée (LDB 14 l.9) ; la Taille enchaîne sur une touche.
  const fmStop = fm && wasChain && !isOutOfAction(target);
  if (!battle.over && count < bcc && remaining.length && !fmStop) {
    set({ pendingCleave: { attackerId: attacker.id, hitIds, count, fm }, battle: { ...battle } });
  } else {
    set({ pendingCleave: null, battle: { ...battle } });
  }
}

// ---------------------------------------------------------------------------
// Piétinement — action gratuite à 1 Avantage (LDB 85 - Traits de créature.md l.320-321)
// ---------------------------------------------------------------------------

/** Arme abstraite du Piétinement : Corps à corps (Bagarre), Dégâts = Bonus de Force (+0). */
export const TRAMPLE_WEAPON: Weapon = buildWeapon({ name: 'Piétinement', attackKind: 'pietinement', damage: { plusBF: true, flat: 0, bare: true } });

/** Résout un Piétinement : dépense 1 Avantage (coût de l'action gratuite) puis applique
 *  `resolveTrample` (BF +0, Corps à corps). Ne consomme PAS l'Action (« action gratuite »). */
export function applyTrample(get: Get, set: SetFn, attacker: Combatant, target: Combatant): void {
  const prevActed = get().battle?.acted ?? false; // « action gratuite » : ne doit pas consommer l'Action
  campSpend(get, attacker, 1); // coût : 1 Avantage (LDB 85 l.320) — réserve du camp en mode groupe (AA l.4142)
  const res = resolveTrample(attacker, target, battleRng());
  applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, res, false); // pose acted=true (attaque standard)… ; Piétinement = résolution instantanée (pas de modale)
  set({ battle: { ...get().battle!, acted: prevActed } }); // …qu'on restaure : le Piétinement est gratuit
}

/** L'IA piétine (faible priorité, après l'attaque principale) : action gratuite si l'ennemi a ≥1
 *  Avantage et qu'un adversaire adjacent plus petit est à portée. Instantané (pas de modale IA). */
export function aiMaybeTrample(get: Get, set: SetFn, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy) || enemy.advantage < 1) return;
  const battle = get().battle;
  if (!battle || battle.over) return;
  const target = trampleTarget(battle, enemy);
  if (!target) return;
  applyTrample(get, set, enemy, target);
}

/** Résolution IA des attaques d'Arme GRATUITES « disponibles » (`grantFreeAttack {when:'available'}` —
 *  aujourd'hui l'état Frénésie, LDB 21 l.34 : « un Test de CC gratuit chaque Round ») d'un combattant PILOTÉ
 *  PAR L'IA. Gate `!aiDriven` : ennemi OU héros en Auto-combat (un héros MANUEL la déclenche lui-même via
 *  l'affordance UI `hasFreeWeaponAttack`). DÉLÈGUE chaque op au MÊME résolveur que les attaques gratuites
 *  RÉACTIVES (`applyTalentFreeAttack` : plafond, coût d'Avantage, jet d'attaque, Action préservée) — un seul
 *  résolveur partagé, plus de chemin frenzy-spécifique ni de jet dupliqué. Cible = adversaire adjacent. */
export function aiAvailableFreeAttack(get: Get, set: SetFn, actor: Combatant): void {
  if (!aiDriven(get(), actor) || isOutOfAction(actor)) return;
  const battle = get().battle;
  if (!battle || battle.over || !actor.pos) return;
  const target = battle.combatants.find(
    (t) => t.kind !== actor.kind && !isOutOfAction(t) && !!t.pos && combatDistance(actor, t) <= 1,
  );
  if (!target) return;
  for (const { op, cap } of availableFreeAttackOps(actor))
    applyTalentFreeAttack(get, set, actor, op, { targetId: target.id, key: 'arme', cap });
}

// ── Attaques GRATUITES accordées par un TALENT déclenché (Assaut féroce `onHit`, Frappe réactive
//    `onCharged`) : op `grantFreeAttack{when:'immediate'}` portée en DONNÉE par le talent. Résolution
//    INSTANTANÉE (motif aiAvailableFreeAttack — pas de modale), arme TENUE, Action PRÉSERVÉE. La frappe est
//    OUVERTE par le hook `freeAttack` que `runCombatFlow` appelle sur le `do`/`grantFreeAttack` — un
//    éventuel jet préalable (Frappe réactive : Test d'Initiative LDB 10 l.429-432) est un nœud Flow
//    `test` EN AMONT (cadence-aware : héros manuel = jet influençable ; ennemi/auto = inline). ──

/** Résout UNE attaque gratuite de talent contre la cible `fa.targetId` (un TIERS : le chargeur pour Frappe
 *  réactive, la victime touchée pour Assaut féroce) : plafond /Round (`fa.cap` = niveau, via
 *  `freeAttacksThisTurn[fa.key]`) + 1× par chargeur ; coût (Avantage) ; puis frappe INSTANTANÉE à l'arme
 *  tenue, Action préservée. Le plafond borne aussi la récursion (un onHit qui touche → +1 attaque, recomptée
 *  → s'arrête au niveau). Appelée par le hook `freeAttack` quand `runCombatFlow` exécute le `do`/`grantFreeAttack`
 *  (le Test préalable a déjà réussi en amont, c'est un nœud Flow). */
function applyTalentFreeAttack(get: Get, set: SetFn, actor: Combatant, op: Extract<GameOp, { op: 'grantFreeAttack' }>, fa: FreeAttackFreeze): void {
  const target = get().battle?.combatants.find((c) => c.id === fa.targetId);
  if (!target || isOutOfAction(actor) || isOutOfAction(target) || !actor.pos || !target.pos) return;
  if ((actor.weapons[0]?.type ?? 'melee') !== 'melee') return; // attaque d'arme de mêlée (l'arme tenue)
  const uses = actor.freeAttacksThisTurn ?? {};
  if ((uses[fa.key] ?? 0) >= fa.cap) return; // plafond /Round atteint (= niveau du talent)
  const ck = `${fa.key}:${target.id}`;
  if (op.perChargerOncePerRound && (uses[ck] ?? 0) >= 1) return; // 1 riposte par chargeur (Frappe réactive)
  if (op.cost?.advantage != null && actor.advantage < op.cost.advantage) return; // Avantage insuffisant
  if (op.cost?.advantageOrMovement && actor.advantage <= 0) return; // simplifié : Avantage requis (« ou Mouvement » = raffinement)
  if (op.cost?.advantage != null) campSpend(get, actor, op.cost.advantage); // réserve du camp en mode groupe (AA l.4142) / le combattant (LDB)
  else if (op.cost?.advantageOrMovement) campSpend(get, actor, 1);
  actor.freeAttacksThisTurn = { ...uses, [fa.key]: (uses[fa.key] ?? 0) + 1, ...(op.perChargerOncePerRound ? { [ck]: 1 } : {}) };
  const prevActed = get().battle?.acted ?? false; // gratuite : Action préservée
  const r = resolveAttack(get, actor, target);
  if (r) applyAttackResult(get, set, actor, r.victim ?? target, r.weapon, r.res, false);
  set({ battle: { ...get().battle!, acted: prevActed } });
}

/** HOOK `freeAttack` (injecté dans la brique `combat/triggeredTest` par `createCombatSlice`) : pont
 *  exécuteur de Flow → vraie frappe. Appelé par `runCombatFlow` sur un `do`/`grantFreeAttack`. */
export function freeAttackHookImpl(get: Get, set: SetFn, actor: Combatant, op: Extract<GameOp, { op: 'grantFreeAttack' }>, fa: FreeAttackFreeze): void {
  applyTalentFreeAttack(get, set, actor, op, fa);
}

/** Résout les attaques gratuites DÉCLENCHÉES des talents de `actor` pour `trigger` (contre `victim`) —
 *  source : les `effects` du talent (donnée). Le Flow de chaque talent est JOUÉ par `runCombatFlow` (le
 *  nœud `choice`/`test` éventuel y est cadence-aware ; le `do`/`grantFreeAttack` ouvre la frappe via le
 *  hook contre `victim`, le tiers threadé dans `ctx.freeAttack`). Vaut héros ET IA. */
export function resolveFreeAttacks(get: Get, set: SetFn, actor: Combatant, trigger: EffectTrigger, victim: Combatant | undefined): void {
  if (!victim) return;
  // TOUTES les sources (Talent/Trait/Atout/État), pas seulement les talents : une réaction `grantFreeAttack`
  // (Frappe réactive `onCharged`, Assaut féroce `onHit`, et demain un Trait de créature) est jouée
  // indifféremment du KIND. On NE garde que les Flows qui accordent une attaque gratuite (`flowHasFreeAttack`) :
  // ils ciblent le TIERS via `freeAttack` ; les autres effets de ces triggers sont déjà joués par `fireTriggers`.
  for (const src of freeAttackSourcesOf(actor)) {
    for (const eff of src.effects) {
      if (eff.trigger !== trigger || !flowHasFreeAttack(eff.flow)) continue;
      runCombatFlow(
        { mode: 'combat', get, set, target: actor, caster: actor, label: src.label, freeAttack: { targetId: victim.id, cap: src.cap, key: src.key } },
        eff.flow,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Attaques GRATUITES de créature (Taille & traits) — chacune au prix de 1 Avantage, OPPOSÉE
// (la cible se défend Parade/Esquive, comme une attaque normale) et NE consomme PAS l'Action.
// RAW : Piétinement (LDB 85 l.320-321, BF+0), Morsure/Attaque caudale (l.338/340, Indice) ; priorité
// Morsure/Caudale (Indice) avant Piétinement (BF+0) — cf. exemple Aventures à Ubersreik.
// ---------------------------------------------------------------------------

/** Arme abstraite d'une attaque gratuite : Piétinement = BF+0 ; Morsure/Caudale/Tentacules = +Indice
 *  (BF inclus). STAMPE `attackKind: kind` → la pose/Condition lit le champ STABLE, pas le nom. */
export function freeAttackWeapon(kind: string, bonus: number): Weapon {
  if (kind === 'pietinement') return TRAMPLE_WEAPON; // déjà stampé attackKind:'pietinement'
  const name = kind === 'caudale' ? 'Attaque caudale' : kind === 'cornes' ? 'Cornes' : kind === 'tentacules' ? 'Tentacules' : 'Morsure';
  return buildWeapon({ name, attackKind: kind, damage: { plusBF: false, flat: bonus } }); // Indice de créature (SB déjà inclus) → « +N »
}

/** Type de pose d'attaque (rendu créature) : le champ STABLE `weapon.attackKind` stampé à la
 *  construction (multilangue-safe), sinon repli par NOM (armes de statbloc/dérivées/grantNatural non
 *  stampées : « Griffe »/« Morsure »…). undefined = arme manufacturée → pose générique du gabarit.
 *  Sert au tintage de l'animation d'attaque (AnimatedPlanToken) et à la Condition Flow `attackKind`. */
export function creatureAttackKind(weapon: { attackKind?: string; name: string }): string | undefined {
  if (weapon.attackKind) return weapon.attackKind;
  const n = weapon.name.toLowerCase();
  if (n.includes('morsure')) return 'morsure';
  if (n.includes('caudale') || n.includes('queue')) return 'caudale';
  if (n.includes('piétin') || n.includes('pietin')) return 'pietinement';
  if (n.includes('corne')) return 'cornes';
  if (n.includes('tentacule')) return 'tentacules';
  if (n.includes('griffe') || n === 'arme') return 'arme';
  return undefined;
}

/** Effets RAW post-touche d'une attaque gratuite (sur PB infligés) : Attaque caudale → cible de Taille
 *  INFÉRIEURE → À Terre (LDB 85 l.338). Le Venin est un `effects` du trait (dispatché par le
 *  `fireTriggers('onHit')` d'`applyAttackResult`, atteint aussi par les attaques gratuites). */
export function applyFreeAttackEffects(get: Get, attacker: Combatant, target: Combatant, kind: string, res: AttackResult): void {
  if (!res.hit) return; // les effets se déclenchent sur une touche réussie
  // (Constricteur = `effects` onHit du trait → Empêtré sur toute touche, appliqué par le
  //  `fireTriggers('onHit')` d'`applyAttackResult` — atteint aussi les attaques gratuites.)
  if (!res.woundsLost) return; // les effets suivants exigent des Points de Blessure perdus
  // Effets onHit AUTHORÉS de la manœuvre (donnée éditable `maneuver.effects` : Attaque caudale → À Terre
  // si la cible est plus petite ; Tentacules → Empêtré) — appliqués SCOPED à cette manœuvre (≠ l'onHit
  // générique des traits/atouts), via le MÊME exécuteur de Flow.
  const mEffects = maneuverEffectsOf(attacker, kind);
  if (mEffects.length) applyTriggeredEffects(get, attacker, mEffects, 'onHit', { victim: target, woundsDealt: res.woundsLost, attackKind: kind, rng: battleRng() }).forEach((l) => get().log(l));
  // (Vampirique = `effects` onHit du trait `vampirique`, gaté par la Condition Flow `attackKind: 'morsure'` →
  //  Vol de vie ; appliqué par le `fireTriggers('onHit')` d'`applyAttackResult` — atteint aussi les attaques gratuites.)
  // (Venin = `effects` du trait `Venin`, appliqué par le `fireTriggers('onHit')` d'`applyAttackResult`.)
}

/** Cible d'une attaque gratuite : adversaire adjacent actif (Piétinement exige une Taille inférieure). */
function freeAttackTarget(battle: BattleState, c: Combatant, kind: string): Combatant | undefined {
  if (kind === 'pietinement') return trampleTarget(battle, c);
  return battle.combatants.find((t) => t.kind !== c.kind && !isOutOfAction(t) && !!t.pos && !!c.pos && combatDistance(c, t) <= 1);
}

/** Résout UNE attaque gratuite de `kind` contre `target`, OPPOSÉE et GRATUITE : ouvre la modale de
 *  défense (héros) → suspendu (true) ; sinon résout instantanément (opposé auto, ou passif si Surpris),
 *  restaure l'Action et applique les effets. Dépense `cost` Avantage (coût RAW par type :
 *  Cornes/Tentacules 0, Morsure/Caudale/Piétinement 1). */
function applyFreeAttack(get: Get, set: SetFn, attacker: Combatant, target: Combatant, kind: string, bonus: number, cost = 1): boolean {
  const prevActed = get().battle?.acted ?? false;
  campSpend(get, attacker, cost); // réserve du camp en mode groupe (AA l.4142) / le combattant (LDB)
  const weapon = freeAttackWeapon(kind, bonus);
  if (maybeOpenDefense(get, set, attacker, target, weapon, { kind, prevActed })) return true; // suspendu : resolve via défense
  const res = resolveMelee(attacker, target, weapon, battleRng(), { defense: cannotDefend(target) ? 'none' : bestDefenseMode(target) });
  applyAttackResult(get, set, attacker, target, weapon, res, false);
  set({ battle: { ...get().battle!, acted: prevActed } }); // gratuite : ne consomme pas l'Action
  applyFreeAttackEffects(get, attacker, target, kind, res);
  return false;
}


// ── Wrappers IA des manœuvres (jet d'attaquant + RÉSOLVEUR GÉNÉRIQUE + clôture). Source UNIQUE du
//    « rouler le jet d'attaquant PUIS résoudre PUIS checkBattleOver » pour l'IA : le flux JOUEUR
//    passe par `FLOWS.maneuver` (modale différée) qui appelle les MÊMES `rollManeuverAttacker` /
//    `resolveManeuver`. Les noms publics historiques sont conservés (tests + chemin du sort Souffle). ──

/** Souffle / Vomissement (IA & sort) : roule le jet d'attaquant (CT, +40 pour le Vomi) puis résout la
 *  zone via le RÉSOLVEUR GÉNÉRIQUE. `centerOverride` = point d'impact imposé du sort « Souffle » (LDB 47).
 *  Clôt par `checkBattleOver`. */
export function applyAreaAttack(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack, centerOverride?: Combatant): boolean {
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'CT', battleRng(), maneuverAttackerDifficulty(a.kind));
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, a.avantage, centerOverride);
  if (!suspended) checkBattleOver(get, set); // la cascade de défense (héros) porte son propre checkBattleOver à la fermeture
  return suspended;
}

/** Langue préhensile (IA) : jet CT puis résolution ; gratuit (Action préservée). L'entraînement de la proie
 *  (pull) est une conséquence POST-TOUCHE (hook `maneuverPostHit`), jouée pour la voie silencieuse ET la voie
 *  cascade. Renvoie `true` si une défense de héros a suspendu (reprise à la fermeture). */
export function applyTongue(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack): boolean {
  const battle = get().battle;
  if (!battle || !attacker.pos) return false;
  // Cible = la plus proche (sélection IDENTIQUE à resolveManeuver pour une manœuvre à cible unique) ; on la
  // PASSE explicitement (chosenTarget) → la proie tirée = la proie touchée, sans ré-dériver.
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && !!c.pos);
  const target = foes.length ? foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c)) : undefined;
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'CT', battleRng());
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, a.avantage, target);
  if (!suspended) checkBattleOver(get, set);
  return suspended;
}

/** Entraînement de la Langue préhensile (LDB 85 p.340) — conséquence POST-TOUCHE injectée dans
 *  `applyManeuverEffects` (hook `maneuverPostHit`) : sur une TOUCHE (un pion *Empêtré* posé ce tour) d'une
 *  proie plus PETITE, elle est tirée vers la créature (pathing impur : `pullToward` + traversées de zone).
 *  Joué à l'IDENTIQUE pour la voie silencieuse (non-héros/Surpris) ET la voie cascade (héros influençable). */
function maneuverPostHitImpl(get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, tgt: Combatant, hadEmpetre: number): string[] {
  if (def.kind !== 'langue' || !tgt.pos || !attacker.pos) return [];
  if (!(stacks(tgt, COND.empetre) > hadEmpetre && sizeGap(attacker.size, tgt.size) > 0)) return [];
  const b = get().battle;
  if (!b) return [];
  const r = pullToward(get().scene!, attacker.pos, tgt.pos, chebyshev(attacker.pos, tgt.pos), { blocked: occupied(b, tgt) });
  if (r.pulled <= 0) return [];
  const from = { ...tgt.pos };
  placeCombatant(tgt, get().scene, r.dest);
  bus.emit(EVT.ANIM_MOVE, { id: tgt.id, path: [{ ...r.dest }] });
  applyZoneCrossings(get, tgt, [...tilesBetween(from, r.dest), { ...r.dest }]); // une traction TRAVERSE (Mur de feu, L11)
  return [tr('cs.tonguePull', { name: attacker.name, foe: tgt.name })];
}
// Câble la conséquence POST-TOUCHE (entraînement de la Langue) dans le résolveur feuille (inversion de
// dépendance : combatManeuvers reste sans import de combatFlow). Enregistré à l'import, comme les appliers.
setManeuverPostHitHook(maneuverPostHitImpl);

/** Hurlement fantomatique (IA) : PAS de jet d'attaquant ; dépense TOUS les Avantages (min 2, LDB 85
 *  l.135). Renvoie false si pas assez d'Avantage. Clôt par `checkBattleOver`. */
export function applyWail(get: Get, set: SetFn, attacker: Combatant): boolean {
  if (!attacker.pos || attacker.advantage < 2) return false;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === 'hurlement');
  if (!a) return false;
  // Pas de jet d'attaquant ; dépense TOUT (l.135). Le « Test de Résistance ou Brisé » (nœud Flow `test`)
  // ouvre une cascade influençable pour un héros MANUEL → SUSPEND (checkBattleOver déféré à sa fermeture).
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, null, attacker.advantage);
  if (!suspended) checkBattleOver(get, set);
  return true; // « a agi » (creatureFreeAttacks.test le vérifie en cadence auto) ; la suspension est lue via `maneuverCascadePending`
}

/** Regard pétrifiant (IA) : jet CT puis résolution ; l'IA dépense TOUT (min 1), +1 DR/Av (LDB 85 l.238).
 *  Consomme l'Action. Renvoie false si pas d'Avantage/cible. Clôt par `checkBattleOver`. */
export function applyGaze(get: Get, set: SetFn, attacker: Combatant): boolean {
  if (!attacker.pos || attacker.advantage < 1) return false;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === 'regard');
  if (!a) return false;
  const spent = attacker.advantage; // l'IA met tout (min 1)
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'CT', battleRng());
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, spent);
  set({ battle: { ...get().battle!, acted: true } }); // Regard = Action de la créature (l.238)
  if (!suspended) checkBattleOver(get, set); // héros influençable → checkBattleOver à la fermeture de la cascade
  return true;
}

/** Étreinte glaciale (IA) : jet CC puis résolution ; 2 Av + Action (LDB 85 l.112). Renvoie false si pas
 *  assez d'Avantage / pas de cible adjacente. Clôt par `checkBattleOver`. */
export function applyChillGrasp(get: Get, set: SetFn, attacker: Combatant): boolean {
  if (!attacker.pos || attacker.advantage < 2) return false;
  const battle = get().battle;
  if (!battle || !battle.combatants.some((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(attacker, c) <= 1)) return false;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === 'etreinte');
  if (!a) return false;
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'CC', battleRng());
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, a.avantage);
  set({ battle: { ...get().battle!, acted: true } }); // Étreinte = Action de la créature (l.112)
  if (!suspended) checkBattleOver(get, set); // héros influençable → checkBattleOver à la fermeture de la cascade
  return true;
}

/** Attaque-ACTION spéciale de l'IA (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
 *  normale, si la créature en a le trait et l'Avantage requis. Renvoie true si elle a agi. */
export function aiMaybeSpecialAction(get: Get, set: SetFn, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return false;
  const atks = creatureAttacks(enemy.traits ?? []);
  if (atks.some((a) => a.kind === 'regard') && enemy.advantage >= 1) return applyGaze(get, set, enemy);
  if (atks.some((a) => a.kind === 'etreinte') && enemy.advantage >= 2) return applyChillGrasp(get, set, enemy);
  // Battement (LDB 10 l.103 / AA l.4361) : un PNJ Engagé qui porte le Talent retire de l'Avantage à un
  // adversaire ARMÉ pas plus grand que lui, quand la réserve/l'Avantage adverse est non nul (sinon inutile).
  if (hasBattement(enemy)) {
    const battle = get().battle;
    const foe = battle?.combatants.find((c) => battementEligible(enemy, c) && spendableAdvantage(get, c) > 0);
    if (foe) return aiBattement(get, set, enemy, foe);
  }
  // Distraire (LDB 10 l.364 / AA l.4395) : à défaut d'attaque productive, un PNJ qui porte le Talent nie
  // l'Avantage d'un adversaire adjacent (Mouvement) — cible non déjà distraite, avec de l'Avantage à nier.
  if (hasDistraire(enemy) && enemy.pos) {
    const battle = get().battle;
    const foe = battle?.combatants.find(
      (c) => distraireEligible(enemy, c) && !c.distractedRounds && spendableAdvantage(get, c) > 0 && !!c.pos && combatDistance(enemy, c) <= 1,
    );
    if (foe) return aiDistraire(get, set, enemy, foe);
  }
  return false;
}

/** L'IA exécute un Battement (Action, LDB 10 l.103) : jet de Corps à corps NON opposé (inline), retire de
 *  l'Avantage adverse via `resolveBattement`. Consomme l'Action. Clôt par `checkBattleOver`. */
function aiBattement(get: Get, set: SetFn, enemy: Combatant, foe: Combatant): boolean {
  const battle = get().battle;
  if (!battle) return false;
  const atk = rollManeuverAttacker(enemy, 'CC', battleRng());
  const line = resolveBattement(get, enemy, foe, atk);
  set({ battle: { ...get().battle!, acted: true, action: null, log: [...get().battle!.log, ev('attack', line, enemy.id, foe.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** L'IA exécute un Distraire (Mouvement, LDB 10 l.364) : Test OPPOSÉ Athlétisme vs Calme (inline). Sur
 *  victoire, la cible est distraite (ne génère plus d'Avantage jusqu'à la fin du prochain Round). Consomme
 *  l'Action (l'IA renonce à attaquer ce tour). Clôt par `checkBattleOver`. */
function aiDistraire(get: Get, set: SetFn, enemy: Combatant, foe: Combatant): boolean {
  const battle = get().battle;
  if (!battle) return false;
  const atk = rollTest(distraireAttackValue(enemy), 'intermediaire', battleRng());
  const def = rollTest(distraireDefenseValue(foe), 'intermediaire', battleRng());
  const line = resolveDistraire(enemy, foe, atk, def);
  set({ battle: { ...get().battle!, acted: true, action: null, log: [...get().battle!.log, ev('attack', line, enemy.id, foe.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** L'IA enchaîne ses attaques gratuites de créature après l'attaque principale (chacune 1 Avantage,
 *  OPPOSÉE). File initialisée au 1er appel (Morsure/Attaque caudale des traits, PUIS Piétinement de
 *  Taille — les Indices d'abord), puis poursuivie après chaque modale de défense résolue. Retourne
 *  true si une modale s'est ouverte (tour SUSPENDU). */
/** Résout une Déviation Critique — invoquée par l'applier de l'étape de séquence 'deviation' (la reprise
 *  de l'IA est gérée par la FERMETURE de la séquence, pas ici). « Subir » applique le Critique pré-tiré
 *  (`dev.crit`) tel quel ; « Dévier » l'ignore (−1 PA). Union discriminée :
 *  - `melee` → RÉ-ENTRE `applyAttackResult` avec la décision (son tail décision-indépendant tourne UNE fois) ;
 *  - `self` → auto-contenu (opposé/magie n'ont pas de tail) : déflexion vs Critique pré-tiré directement. */
export function resolveDeviation(get: Get, set: SetFn, dev: PendingDeviation, deviate: boolean): void {
  const battle = get().battle;
  if (!battle) return;
  if (dev.mode === 'melee') {
    const attacker = battle.combatants.find((c) => c.id === dev.attackerId);
    const target = battle.combatants.find((c) => c.id === dev.targetId);
    if (attacker && target) {
      applyAttackResult(get, set, attacker, target, dev.weapon, dev.res, deviate, deviate ? undefined : dev.crit);
      autoCleave(get, set, attacker, target, dev.res); // balayage de l'ennemi plus grand sur les AUTRES héros
      // Maladresse du défenseur héros (parade/esquive active ratée sur un double, LDB 14 l.48-51).
      if (target.kind === 'hero' && defenderFumbled(dev.res, target.weapons[0], target) && !isOutOfAction(target)) {
        // Maladresse = étape APPENDUE à la cascade (donnée SUR l'étape — source unique, plus de `pendingFumble`) ;
        // la séquence avance déviation → Maladresse, et la reprise IA suit la fermeture (fumbleConfirm → cascadeNext).
        pushCombatStep(set, { id: `cons-fumble-${target.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: target.id, fumble: { weapon: target.weapons[0], result: null } });
        return;
      }
    }
    return;
  }
  // mode 'self' (opposé/tir/magie) : auto-contenu — pas de ré-entrée d'attaque, pas de tail.
  const target = battle.combatants.find((c) => c.id === dev.targetId);
  if (!target) return;
  const log: string[] = [];
  if (deviate) deflectCrit(target, dev.location, dev.deflectExtraWounds, log); // −1 PA, Critique ignoré, + Blessures recalculées
  else applyCritAndFinalize(get, set, target, dev.location, dev.isCoupCritique, dev.overkill, log, dev.ctx, dev.woundsBefore, dev.crit, true); // Subir : Critique pré-tiré
  // 0 PB → À Terre (LDB 18 l.28) ; cible neutralisée → on lève engagement + effets psy (parité avec la mêlée).
  if (target.wounds.current <= 0 && !target.dead && !hasCondition(target, COND.inconscient)) applyZeroWounds(target);
  if (isOutOfAction(target)) {
    clearEngagementOf(get().battle?.combatants ?? [], target.id);
    clearPsychOf(get().battle?.combatants ?? [], target.id);
  }
  if (log.length) {
    const b = get().battle;
    if (b) set({ battle: { ...b, log: [...b.log, ...evLines(log, 'crit', dev.attackerId, dev.targetId)] } }); // acteur = attaquant, sujet = cible (parité mode melee)
  }
  checkBattleOver(get, set);
}

/** Applier de l'étape de CHOIX « déviation » (folding P3a) : « Subir » applique le Critique pré-tiré,
 *  « Dévier » l'ignore (−1 PA). `resume:false` → la reprise de l'IA part de la FERMETURE de séquence
 *  (`cascadeNext`/`cascadeFinish` → `resumeSuspendedAI`). Le reste de l'attaque re-déclenché par
 *  resolveDeviation APPEND ses conséquences à la séquence (préservées par le liveMerge de commitStep). */
registerCascadeApplier('deviation', (get, set, step) => {
  if (step.deviation) resolveDeviation(get, set, step.deviation, step.chosen === 'devier');
});

export function aiCreatureFreeAttacks(get: Get, set: SetFn, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) { enemy.pendingFreeAttacks = undefined; return false; }
  const battle = get().battle;
  if (!battle || battle.over) { enemy.pendingFreeAttacks = undefined; return false; }
  if (enemy.pendingFreeAttacks === undefined) {
    const atks = creatureAttacks(enemy.traits ?? []);
    // Empoignade tenue par un Tentacule (LDB 85 p.343) UNIQUEMENT : « vous pouvez utiliser une Action d'Attaque
    // GRATUITE pour résoudre l'Empoignade AU LIEU de l'Action de la créature » — le tentacule tient pendant que
    // le corps agit. Pour CHAQUE adversaire encore Empoigné et en vie : Test opposé de Force GRATUIT (résolveur
    // PARTAGÉ `resolveGrappleOpposed`), instantané. La créature N'EST PAS verrouillée (ai.ts saute le verrou
    // LOT B pour le trait tentacule) → elle CONSERVE son Action normale. La Langue préhensile (p.340) n'a PAS
    // cette dérogation (« voir page 163 ») → elle est verrouillée comme tout grappleur (LOT B), pas ici.
    if (atks.some((a) => a.kind === 'tentacules')) {
      for (const fid of [...(enemy.grapplingWith ?? [])]) {
        const foe = battle.combatants.find((c) => c.id === fid);
        if (!foe || isOutOfAction(foe) || !areGrappling(enemy, foe)) continue;
        const line = resolveGrappleOpposed(get, enemy, foe);
        const b = get().battle; if (!b) break;
        set({ battle: { ...b, log: [...b.log, ev('attack', line, enemy.id, foe.id)] } });
        bus.emit(EVT.SCENE_DIRTY);
        checkBattleOver(get, set);
      }
    }
    // Attaques de ZONE/spéciales (Souffle/Vomi/Langue/Hurlement) : désormais des UNITÉS de la file — une
    // manœuvre de zone qui touche des HÉROS ouvre une cascade de défense INFLUENÇABLE (elle SUSPEND), donc
    // elle doit être RÉSUMABLE : la file est persistée sur l'ennemi ; la reprise re-appelle
    // `aiCreatureFreeAttacks` (file DÉFINIE → bloc d'init sauté, on enchaîne l'unité suivante). Ordre RAW
    // conservé : Souffle → Vomi → Langue → Hurlement, AVANT les gratuites de mêlée.
    const zoneKinds = (['souffle', 'vomi', 'langue', 'hurlement'] as const).filter((k) => atks.some((a) => a.kind === k));
    const traitKinds: string[] = [];
    for (const a of atks) {
      if (a.trigger !== 'free') continue;
      if (a.kind === 'morsure' || a.kind === 'caudale') traitKinds.push(a.kind);
      // Tentacules (LDB 85 l.354-355 : « Gagnez une Action d'Attaque gratuite PAR tentacule ») :
      // count× entrées (« 8 Tentacules +9 » → 8), coût d'Avantage 0.
      if (a.kind === 'tentacules') for (let i = 0; i < (a.count ?? 1); i++) traitKinds.push('tentacules');
    }
    // Cornes : Attaque gratuite gagnée EN CHARGEANT (LDB 85), sans coût d'Avantage.
    const cornes = enemy.chargedThisTurn && atks.some((a) => a.kind === 'cornes') ? ['cornes'] : [];
    enemy.chargedThisTurn = false; // consommée
    enemy.pendingFreeAttacks = [...zoneKinds, ...cornes, ...traitKinds, 'pietinement']; // zone d'abord, Piétinement (Taille) en dernier
  }
  while (enemy.pendingFreeAttacks.length) {
    const kind = enemy.pendingFreeAttacks[0];
    const b2 = get().battle; if (!b2 || b2.over) break;
    // Manœuvres de ZONE/spéciales : résolveur propre (opposé) — une défense de HÉROS ouvre une cascade
    // influençable et SUSPEND (return true → reprise à la fermeture via `resumeManeuverDefense`).
    if (kind === 'souffle' || kind === 'vomi' || kind === 'langue' || kind === 'hurlement') {
      enemy.pendingFreeAttacks.shift();
      const a = creatureAttacks(enemy.traits ?? []).find((x) => x.kind === kind);
      if (!a) continue;
      let suspended = false;
      // Hurlement : pas d'opposition, mais son « Test de Résistance ou Brisé » (nœud Flow `test`) ouvre une
      // cascade influençable pour un héros MANUEL → SUSPEND aussi (lue via `maneuverCascadePending`).
      if (kind === 'hurlement') { if (enemy.advantage >= 2) applyWail(get, set, enemy); suspended = maneuverCascadePending(get); }
      else if (enemy.advantage >= a.avantage) suspended = kind === 'langue' ? applyTongue(get, set, enemy, a) : applyAreaAttack(get, set, enemy, a);
      if (suspended) return true;
      continue;
    }
    // Coût en Avantage PAR TYPE (RAW, lu de creatureAttacks) : Cornes (Charge) et Tentacules = 0 ;
    // Morsure/Caudale = 1 ; Piétinement (Taille) = 1. Une entrée inabordable est SAUTÉE (pas de
    // break : des Tentacules à coût 0 restent jouables derrière une Morsure inabordable).
    const cost = kind === 'pietinement' ? 1 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.avantage ?? 1;
    if (enemy.advantage < cost) { enemy.pendingFreeAttacks.shift(); continue; }
    const target = freeAttackTarget(b2, enemy, kind);
    if (!target) { enemy.pendingFreeAttacks.shift(); continue; }
    const bonus = kind === 'pietinement' ? 0 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.bonus ?? 0;
    enemy.pendingFreeAttacks.shift();
    if (applyFreeAttack(get, set, enemy, target, kind, bonus, cost)) return true; // modale ouverte → reprise via defenseConfirm
  }
  enemy.pendingFreeAttacks = undefined; // file épuisée
  return false;
}

/** Une cascade de DÉFENSE à une manœuvre de zone IA est-elle ouverte (le tour de la créature est SUSPENDU) ?
 *  Testé après `aiMaybeSpecialAction` (Regard/Étreinte peuvent l'ouvrir) pour ne pas AVANCER le tour. */
function maneuverCascadePending(get: Get): boolean {
  const p = get().pendingCascade;
  return !!p && p.purpose === 'combat' && !!p.maneuverResume;
}

/** Reprend le tour de la créature après la fermeture d'une cascade de DÉFENSE à sa manœuvre de zone
 *  (Souffle/Regard/…). Miroir du « tail » de `defenseConfirm` : les héros ont défendu (influençable), on
 *  vérifie la fin de combat, puis on enchaîne les attaques gratuites RESTANTES (file persistée) — qui peuvent
 *  ROUVRIR une cascade (souffle → vomi → …) — sinon on avance. `free` = manœuvre gratuite (ne re-déclenche
 *  PAS les libres d'Arme post-Action, comme `defenseConfirm` pour `pd.free`). */
export function resumeManeuverDefense(get: Get, set: SetFn, resume: { attackerId: string; free: boolean }): void {
  checkBattleOver(get, set);
  const battle = get().battle;
  if (!battle || battle.over) return;
  const attacker = battle.combatants.find((c) => c.id === resume.attackerId);
  if (attacker && !isOutOfAction(attacker)) {
    if (!resume.free) aiAvailableFreeAttack(get, set, attacker); // manœuvre-ACTION (Regard/Étreinte) → libres d'Arme (Frénésie) après l'Action
    if (aiCreatureFreeAttacks(get, set, attacker)) return; // enchaîne la file (peut rouvrir une cascade)
  }
  resumeEnemyTurn(get, set); // → advanceTurn
}


/**
 * Composant d'incantation (LDB 46 l.158-163, règle optionnelle `magic-composant`) — appelé UNE fois
 * au point d'incantation d'un Sort d'Arcane/Domaine par un lanceur qui suit les règles de PERSONNAGE
 * (#143 — `followsCharacterRules`, PAS un proxy `kind`). Si un composant pour ce Sort est possédé :
 * il est CONSUMÉ « même si aucune Incantation Imparfaite n'a été obtenue » (l.161), une ligne est
 * journalisée, et `true` est renvoyé → toute Imparfaite de ce lancement sera dégradée (passé en
 * `componentDowngrade` à `applyMiscast`). Mute `caster.componentSpells`. Renvoie `false` (sans effet)
 * si la règle est éteinte, le lanceur ne suit pas les règles de Personnage, ou aucun composant ne
 * couvre le Sort. `lines` reçoit la ligne « composant consumé » le cas échéant.
 */
export function useSpellComponent(caster: Combatant, spellId: string, lines: string[]): boolean {
  if (!followsCharacterRules(caster) || rule('magic-composant') !== true) return false;
  const owned = caster.componentSpells ?? [];
  if (!owned.includes(spellId)) return false;
  const i = owned.indexOf(spellId);
  const next = [...owned];
  next.splice(i, 1); // retire UNE occurrence (consommée par l'incantation)
  caster.componentSpells = next;
  lines.push(tr('cf.componentConsumed', { name: caster.name }));
  return true;
}

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(get: Get, set: SetFn, caster: Combatant, severity: MiscastSeverity, opts?: { suppressReveal?: boolean; componentDowngrade?: boolean; sorceryCorruption?: boolean }): string[] {
  // Composant d'incantation (LDB 46 l.161, règle optionnelle) : si un composant adapté a été
  // SACRIFIÉ pour ce Sort (consommation décidée et journalisée au point d'incantation — cf.
  // `useSpellComponent`), il absorbe les pires effets du contrecoup : « toute Incantation Imparfaite
  // Majeure devient Mineure, et aucune Incantation Imparfaite Mineure n'a d'effet ». La transformation
  // de sévérité est PURE (engine/miscast.componentDowngrade) ; ne touche pas la Colère des dieux.
  if (opts?.componentDowngrade && severity !== 'colere') {
    const downgraded = componentDowngrade(severity);
    if (downgraded === null) {
      // Mineure → aucun effet : le composant a tout absorbé, on n'ouvre PAS d'Imparfaite.
      return [`${caster.name} : le composant absorbe l'Incantation Imparfaite Mineure (aucun effet).`];
    }
    return [
      tr('cf.componentDowngrade', { name: caster.name }),
      ...applyMiscast(get, set, caster, downgraded, { suppressReveal: opts.suppressReveal, sorceryCorruption: opts.sorceryCorruption }),
    ];
  }
  // Colère des dieux : +10 au jet par Point de Péché du lanceur (LDB 40 l.53).
  const sinPoints = severity === 'colere' ? caster.sinPoints ?? 0 : 0;
  const m = rollMiscast(severity, battleRng(), sinPoints);
  const lines = [m.log];
  // « Après le lancer et avoir appliqué le résultat, réduisez vos Points de Péché
  // de 1, jusqu'à un minimum de 0 » (LDB 40 l.53).
  if (severity === 'colere' && sinPoints > 0) {
    caster.sinPoints = sinPoints - 1;
    lines.push(tr('cf.sinExpiated', { name: caster.name, n: caster.sinPoints }));
  }
  // Ops IMMÉDIATS de la table (États, Blessures ignorant BE+PA, Corruption, pénalités/blocages
  // d'incantation temporisés, réduction à 0) — applicateur unique, AVANT le Test imbriqué (RAW :
  // « 1d10 Blessures […]. Résistance ou Sonné » — les Dégâts/sin tombent d'abord, puis le Test).
  const opsCtx: OpsCtx = {
    rng: battleRng(),
    label: m.name,
    now: get().gameTime,
    onCorruption: followsCharacterRules(caster) ? (n, align) => gainCorruption(get, set, caster, n, align) : undefined,
  };
  lines.push(...applyOps(caster, m.ops, opsCtx));
  // Sorcellerie (LDB 49) : « À chaque fois qu'un pratiquant de la Sorcellerie fait un jet sur le Tableau
  // des Incantations Imparfaites, il gagne 1 Point de Corruption. » — #143 : personnage (`followsCharacterRules`), pas un proxy `kind`.
  if (opts?.sorceryCorruption && followsCharacterRules(caster)) lines.push(...gainCorruption(get, set, caster, 1));
  // « Un jet = une modale » : le héros voit la conséquence (Colère/Imparfaite) INLINE dans la séquence
  // partagée (étape d'affichage) — plus de RevealModal séparée. `suppressReveal` : la Focalisation
  // interrompue (qui pousse déjà sa propre révélation « Calme » portant ces lignes) n'ouvre rien.
  if (caster.kind === 'hero' && !opts?.suppressReveal) {
    const colere = severity === 'colere';
    const title = colere ? 'Colère des dieux' : 'Incantation Imparfaite';
    const icon = colere ? 'magic/power' : 'fire/blast';
    // Charge riche `reveal` (table : dé + lignes) — comme le Critique ; le dé reste observable (Péché +10).
    const reveal: RevealEntry = { kind: 'miscast', title, dice: m.rolls[0], lines, subjectId: caster.id, severity: 'grave' };
    // FOLD : l'Imparfaite/Colère est une ÉTAPE de la cascade d'incantation ACTIVE (parité avec le
    // Critique d'attaque, appendu via pushReveal) — plus une cascade SÉPARÉE. `pushCombatStep` append
    // à la cascade `purpose:'combat'` en cours (jet d'incantation), ou démarre « Conséquences » si
    // aucune (Focalisation interrompue suppressReveal / contextes hors-cast) — fallback identique à l'ex-startCascade.
    pushCombatStep(set, { id: 'cons-miscast-0', kind: 'miscast', actorId: caster.id, icon, label: colere ? 'Colère des dieux' : 'Imparfaite', outcome: lines, reveal, interactive: true });
  }
  // Test imbriqué de l'entrée (« Résistance ou Sonné ») — résolu CADENCE-AWARE par l'exécuteur de Flow
  // UNIQUE, APRÈS les ops immédiats et l'étape de révélation : un lanceur HÉROS manuel le subit comme une
  // étape de cascade INFLUENÇABLE (Chance/Pacte/Résilience), appendue à la cascade d'incantation active ;
  // un ENNEMI/cadence auto le jette inline. Plus de jet imbriqué silencieux (fin du goal « aucun jet
  // silencieux héros »). `onFailHard` (Purifier la chair −4 DR → Inconscient) est honoré dans la branche
  // d'échec via la Condition Flow `slThreshold ≤ −4` (cf. `mkTest`).
  if (m.testFlow) runCombatFlow({ mode: 'combat', get, set, target: caster, caster, label: m.name, opsCtx }, m.testFlow);
  return lines;
}

/**
 * Clôt une action JOUEUR résolue (soin / incantation / Focalisation, et futures actions hors combat) :
 * EN COMBAT consomme l'Action (`acted`/`action:null`/`selectedSpellId:null`), journalise dans `battle.log`
 * et vérifie la fin de combat ; HORS COMBAT trace le `journal`. C'est la SORTIE commune — `combatOrParty`
 * fournit la RÉSOLUTION des acteurs (`actorIn`/`touchActors`), ce helper la finalisation.
 * `selectedSpellId:null` est neutre pour une action non-incantation (déjà null).
 */
export function finishPlayerAction(get: Get, set: SetFn, lines: string[], kind: CombatEventKind = 'info'): void {
  const battle = get().battle;
  if (battle) {
    // Filet de sécurité (cf. applyAttackResult) : un hook profond (ex. `onGainCondition` d'un ennemi
    // touché par les ops d'un sort de soutien, OU un rider de Domaine) a pu pousser des lignes dans la
    // file différée APRÈS les drains inline d'`applyCast` → on les folde dans le MÊME `log` réécrit,
    // avant que ce `set` ne le clobbere. File vide (cas commun heal/focus) → no-op.
    const log = [...battle.log, ...evLines(lines, kind), ...drainPendingLog(get, set)];
    set({ battle: { ...battle, acted: true, action: null, selectedSpellId: null, log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  } else {
    set({ party: [...get().party], journal: [...get().journal.slice(-40), ...lines] });
    bus.emit(EVT.SCENE_DIRTY);
  }
}

// (Le sommeil de groupe vit dans state/restFlow — `sleepParty`, source unique de la nuit.)

/** Refus d'un cast (sort introuvable, contrecoup bloquant, hors portée/LdV…) : EN COMBAT, poussé
 *  dans le FEED de combat (`battle.log`) — là où le joueur lit — au lieu du `journal` d'exploration
 *  (invisible pendant le combat). Hors combat (incantation hors combat, couture D), repli sur le
 *  journal. Sans ça, un cast refusé faisait un « clic muet » qui passait pour un bug (B4). */
function castRefused(get: Get, set: SetFn, actor: Combatant, msg: string): void {
  const battle = get().battle;
  if (battle) set({ battle: { ...battle, log: [...battle.log, ev('cast', msg, actor.id)] } });
  else get().log(msg);
}

/** Incante un sort/prière sur une cible (résolution via src/engine/magic). */
/** Ouvre la modale d'incantation (jet différé, façon attaque) : pose `pendingCast` sans lancer. */
export function castSpell(
  get: Get,
  set: SetFn,
  caster: Combatant,
  target: Combatant,
  label: string,
  fromGrimoire = false,
) {
  const spell = resolveSpell(label);
  if (!spell) {
    castRefused(get, set, caster, `Sort « ${label} » introuvable.`);
    return;
  }
  // Contrecoups bloquants (LDB 46/40) : « Propos ésotériques », « Vous abusez de ma patience »…
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell) ? 'priere' : 'langue');
  if (blocked) {
    castRefused(get, set, caster, `${caster.name} ne peut pas ${castInfoIsPrayer(spell) ? 'prier' : 'incanter'} : ${blocked}.`);
    return;
  }
  // Verrou de Péché du culte (MDG 11 l.142 — Stromfels : Invocation retirée à 2 Péchés, Béni à 5) —
  // lu en DONNÉE (`GodData.sinLocks`), générique à tout culte qui en porterait.
  const sinLock = prayerSinLock(caster, spell);
  if (sinLock) {
    castRefused(get, set, caster, tr('cf.sinLock', { cult: sinLock.cult, name: caster.name, talent: sinLock.family === 'beni' ? 'Béni' : 'Invocation', sin: String(caster.sinPoints ?? 0), threshold: String(sinLock.threshold) }));
    return;
  }
  // Lecture au grimoire (LDB 47 l.34) : sort NON mémorisé de son Domaine, NI doublé.
  if (fromGrimoire && !canCastFromGrimoire(caster, spell)) {
    castRefused(get, set, caster, tr('cf.grimoireRefused', { name: caster.name, spell: label }));
    return;
  }
  // Sort « Souffle » (LDB 47 p.244) : délégué à l'attaque de ZONE du Trait — la portée suit le
  // TRAIT (BE+20 m, LDB 85), pas le champ Portée du sort ; résolu comme zone, pas comme Projectile.
  const breathSpell = !!spell.breathAttack;
  // Portée (LDB 47) : cible directe hors de portée du sort → refus AVANT la modale (parité ZdE/tir).
  // `range` null = portée non chiffrable (« le lanceur », « au toucher », spécial) → pas de gate.
  if (get().battle && caster.pos && target.pos && caster.id !== target.id) {
    const range = breathSpell
      ? Math.max(1, Math.ceil((bonus(effectiveChar(caster, 'E')) + 20) / 2))
      : spellRangeTiles(spell.range, caster);
    if (range != null && combatDistance(caster, target) > range) {
      castRefused(get, set, caster, tr('cf.castOutOfRange', { spell: spell.label, range }));
      return;
    }
    // Ligne de Vue (LDB 46 l.170 : « vous devez toujours être capable de voir […] votre cible ») —
    // buff sur allié compris ; binaire, pas de malus de couvert pour un Sort. Couvre héros ET IA.
    if (castSightBlocked(get, caster.pos, target.pos)) {
      castRefused(get, set, caster, `${spell.label} : pas de ligne de vue.`);
      return;
    }
  }
  const focusedNI0 = caster.focus?.spell === spell.id && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: target.id, spellId: spell.id, missile: breathSpell ? false : isMagicMissile(spell),
      focused: focusedNI0, result: null, ...(fromGrimoire ? { grimoire: true } : {}),
    },
  });
  openCastCascade(get, set, caster); // « Une situation = une modale » : hôte la situation d'incantation dans la cascade
  // Lanceur PILOTÉ PAR L'IA : le MOTEUR roule l'incantation (plus de « Lancer » joueur — on ne lance pas
  // le dé d'un combattant automate), puis aiguille : Contre-sort à plusieurs si un héros peut Dissiper,
  // sinon la modale pré-roulée sert de RÉVÉLATION (résultat + « Appliquer », sans bouton « Lancer »).
  if (aiDriven(get(), caster) && get().battle) {
    get().castRoll();
    routeEnemyCast(get, set);
  }
}

/** Après le jet (figé) d'un Sort ENNEMI : ouvre le Contre-sort à plusieurs si au moins un héros peut
 *  Dissiper (LDB 46 l.201-202 ; cast RÉUSSI, pas une Prière, pas un Critique non-Projectile
 *  « inéluctable »). Sinon : on laisse `pendingCast` (pré-roulé) — la modale `cast` l'affiche en
 *  révélation. Exporté pour tester le routage de façon DÉTERMINISTE (jet figé contrôlé). */
export function routeEnemyCast(get: Get, set: SetFn): void {
  const pc = get().pendingCast;
  const battle = get().battle;
  if (!pc?.result || !battle) return;
  const caster = battle.combatants.find((c) => c.id === pc.casterId);
  const target = battle.combatants.find((c) => c.id === pc.targetId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !target || !spell) return;
  // Seul un Sort qui ABOUTIT se dissipe (cast réussi, DR ≥ NI) ; pas une Prière ; pas un Critique
  // non-Projectile « inéluctable » (défaut IA, LDB 46 l.59) — comme l'ancien bloc CastModal.
  const dispellable = pc.result.cast && isDispellableSpell(spell) && !(pc.result.isCritical && !pc.missile);
  const heroes = dispellable ? counterspellCandidates(battle, get().scene, caster, target).filter((c) => c.kind === 'hero') : [];
  if (heroes.length) {
    set({ pendingCounterspell: { participants: heroes.map((h) => ({ id: h.id, interactive: true, result: null })) } });
  }
}

/** Ouvre le multijet d'OPPOSITION d'un Sort `spec.opposed` (Fauche-démon → FM, Parole de Tzeentch →
 *  Int) : chaque cible (vivante) oppose son Test à l'incantation FIGÉE, DANS la modale de cast.
 *  Cible IA = rangée TÉMOIN (jet auto-roulé ici) ; cible héros = interactive. Renvoie false (→ le Sort
 *  s'applique normalement) si le Sort n'oppose pas ou s'il n'y a aucune cible. GARDE `pendingCast`. */
export function openCastOpposition(get: Get, set: SetFn, pc: PendingCast, targets: Combatant[]): boolean {
  const spell = effectiveSpellOf(pc);
  const opposed = spell?.opposed;
  if (!opposed) return false;
  const participants = targets
    .filter((t) => !isOutOfAction(t))
    .map((t) => ({ id: t.id, interactive: t.kind === 'hero', result: null }));
  if (!participants.length) return false;
  // `menace: 'magie'` : le Test opposé « résiste au Sort » → Résistance (Menace : Magie) offerte (LDB 10).
  set({ pendingCastOpposition: { participants, kind: opposed.kind, skill: opposed.skill, char: opposed.char, menace: 'magie' } });
  // Cibles IA (témoin) : jet auto-roulé immédiatement (révélé dans la modale, jamais caché).
  for (const p of participants) if (!p.interactive) get().oppositionRoll(p.id);
  return true;
}

/** Rayon INITIAL d'un sort de ZONE en mètres, depuis la cible STRUCTURÉE (`target.area`, source unique —
 *  l'ex-`zdeRadiusMeters` y est plié). `null` = pas un sort de ZdE chiffrable. */
export function zoneRadiusMeters(spell: NonNullable<ReturnType<typeof findSpell>>, caster: Combatant): number | null {
  const d = zdeDiameterMeters(spell.target, caster);
  return d == null ? null : d / 2;
}

/** Rayon en CASES après `alloc` Surincantations « +Zone » (LDB 47 l.29 : chaque allocation
 *  ajoute la valeur INITIALE de Zone d'Effet — Ø ×(1+n)). 1 case = 2 m. */
export const zoneRadiusTilesAt = (r0m: number, alloc: number): number =>
  Math.max(0, Math.floor((r0m * (1 + alloc)) / 2));

/** Ouvre la modale d'un sort de ZONE — flux « jet PUIS pose » (LDB 47 l.29/44) : pas de cible à
 *  désigner, le centre se choisit APRÈS le jet et la Surincantation (+Zone agrandit le gabarit).
 *  `targetId` = ancre lanceur (aucun effet ne lui est appliqué — les cibles réelles sont
 *  recensées à la pose). Retourne false si le sort n'est PAS une zone chiffrable. */
export function castZoneSpell(get: Get, set: SetFn, caster: Combatant, label: string): boolean {
  const spell = resolveSpell(label);
  if (!spell) return false;
  const r0m = zoneRadiusMeters(spell, caster);
  if (r0m == null) return false;
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell) ? 'priere' : 'langue');
  if (blocked) {
    castRefused(get, set, caster, `${caster.name} ne peut pas ${castInfoIsPrayer(spell) ? 'prier' : 'incanter'} : ${blocked}.`);
    return true; // c'était bien une zone — l'entrée est consommée (refus signalé)
  }
  // Verrou de Péché du culte (MDG 11 l.142) — même gate que `castSpell` (les miracles à ZdE passent ici).
  const sinLock = prayerSinLock(caster, spell);
  if (sinLock) {
    castRefused(get, set, caster, tr('cf.sinLock', { cult: sinLock.cult, name: caster.name, talent: sinLock.family === 'beni' ? 'Béni' : 'Invocation', sin: String(caster.sinPoints ?? 0), threshold: String(sinLock.threshold) }));
    return true;
  }
  const focusedNI0 = caster.focus?.spell === spell.id && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: caster.id, spellId: spell.id, missile: isMagicMissile(spell),
      focused: focusedNI0, result: null,
      zone: { center: null, radius: zoneRadiusTilesAt(r0m, 0), r0m },
    },
  });
  openCastCascade(get, set, caster); // hôte la situation d'incantation (jet → pose de zone → effets) dans la cascade
  return true;
}

/** « Une situation = une modale » (pattern wrapper-fold) : OUVRE une cascade `combat` à UNE étape
 *  `jet:'cast'` qui HÔTE toute la situation d'incantation (jet → opposition de cible → Contre-sort →
 *  Surincantation/pose de zone → Critique → effets). `pendingCast` reste le porteur de données ; ses
 *  résolveurs (`castConfirm`/`castCancel`/`castCommitZone`/`oppositionConfirm`/`counterspellConfirm`)
 *  ferment LES DEUX au point terminal. La cascade reste OUVERTE pour TOUTE la situation. Lanceur
 *  ENNEMI → `groupOwner:true` (l'arbitre `cascade` met l'owner à '*' : moment partagé + Contre-sort
 *  multi en coop) ; HÉROS → owner dérivé de `actorId` (le lanceur). Hôte aussi l'incantation HORS
 *  COMBAT (couture D) : `CascadeModal` lit `battle?.combatants ?? party`, l'owner = le héros lanceur,
 *  et les résolveurs de cast ferment le pending directement (jamais `cascadeFinish` → pas de reprise IA). */
export function openCastCascade(get: Get, set: SetFn, caster: Combatant): void {
  startCascade(get, set, {
    title: 'Incantation', icon: 'action/cast', purpose: 'combat',
    steps: [{ id: `cast-${caster.id}`, kind: 'cast', actorId: caster.id, jet: 'cast', ...(caster.kind === 'enemy' ? { groupOwner: true } : {}) }],
  });
}

/** Source UNIQUE de la « pose de zone » en cours — le gabarit qui suit le curseur. Couvre TOUT
 *  ce qui se pose librement : sorts ET miracles à ZdE (les prières passent par pendingCast).
 *  Le Souffle/Vomissement ne se posent PAS (LDB 85 : centre imposé — cible visible la plus
 *  proche, ou la cible du sort Souffle — cf. applyAreaAttack). Toute nouvelle source = une
 *  entrée ICI + un bras à `commitPlacedZone` ; l'UI (gabarit animé, survol, clic) est commune. */
export type PlacingZone = { source: 'cast' | 'siege'; label: string; casterId: string; radius: number; rangeTiles: number | null };
export function placingZoneOf(s: Pick<GameState, 'pendingCast' | 'pendingSiegeAim' | 'battle'>): PlacingZone | null {
  const pc = s.pendingCast;
  if (pc?.zone?.placing && !pc.zone.center) {
    const caster = s.battle?.combatants.find((c) => c.id === pc.casterId);
    const spell = effectiveSpellOf(pc);
    return {
      source: 'cast', label: spell?.label ?? pc.spellId, casterId: pc.casterId, radius: pc.zone.radius,
      rangeTiles: spell && caster ? spellRangeTiles(spell.range, caster) : null,
    };
  }
  // Pilonnage INDIRECT (« viser une case », AA p.122-123) : pièce indirecte servie en attente du point
  // d'impact — MÊME gabarit/curseur/clic que les sorts de zone (l'ancre = le servant, `casterId`).
  const sa = s.pendingSiegeAim;
  if (sa) return { source: 'siege', label: 'Pilonnage', casterId: sa.gunnerId, radius: sa.radius, rangeTiles: sa.rangeTiles };
  return null;
}

/** La case `pt` est-elle une POSE valide pour la zone en cours ? Portée depuis l'ancre + Ligne
 *  de Vue vers le point (LDB 46 l.170/202) — partagé par le gabarit (couleur) et le clic. */
export function placedZoneValidAt(get: Get, pz: PlacingZone, pt: Pt): boolean {
  const caster = get().battle?.combatants.find((c) => c.id === pz.casterId);
  if (!caster?.pos) return false;
  if (pz.rangeTiles != null && chebyshev(caster.pos, pt) > pz.rangeTiles) return false;
  return !castSightBlocked(get, caster.pos, pt);
}

/** Dépose la zone en cours sur `pt` — dispatch par source (chaque consommateur garde ses gates). */
export function commitPlacedZone(get: Get, set: SetFn, pt: Pt): void {
  const pz = placingZoneOf(get());
  if (!pz) return;
  if (pz.source === 'cast') castCommitZone(get, set, pt);
  else if (pz.source === 'siege') get().siegeAimCommit(pt); // pilonnage indirect → ouvre la modale de tir sur la case
}

/** POSE de la zone d'un SORT (après le jet et la Surincantation) : gates portée (LDB 47) + Ligne
 *  de Vue vers le point (LDB 46 l.170/202), puis applique le MÊME jet à tous les combattants du
 *  rayon FINAL — parité avec l'ancien flux (premier = target, reste = extraTargets,
 *  evaluateMissile par cible). Zone posée dans le vide : Sort lancé, Action consommée. */
export function castCommitZone(get: Get, set: SetFn, pt: Pt): void {
  const pc = get().pendingCast;
  const battle = get().battle;
  if (!pc?.zone || !pc.result || !battle) return;
  const caster = battle.combatants.find((c) => c.id === pc.casterId);
  const spell = effectiveSpellOf(pc);
  if (!caster?.pos || !spell) return;
  const res = pc.result;
  // « Puissance totale » (LDB 46 l.57) repêche un DR insuffisant — la pose reste permise (le
  // repêchage est appliqué par applyCast) ; tout autre échec ne se pose pas.
  const castable = res.cast || (!!res.isCritical && (pc.critChoice ?? 'puissance') === 'puissance');
  if (!castable) return;
  const range = spellRangeTiles(spell.range, caster);
  if (range != null && chebyshev(caster.pos, pt) > range) {
    get().log(tr('cf.zoneOutOfRange', { spell: spell.label, range }));
    return;
  }
  if (castSightBlocked(get, caster.pos, pt)) {
    get().log(tr('cf.noLineOfSight', { spell: spell.label }));
    return;
  }
  const radius = pc.zone.radius;
  const inZone = battle.combatants.filter((c) => !isOutOfAction(c) && c.pos && chebyshev(c.pos, pt) <= radius);
  set({ pendingCast: { ...pc, zone: { ...pc.zone, center: { ...pt }, placing: false } } });
  if (!inZone.length) {
    set({ pendingCast: null, pendingCascade: null }); // TERMINAL : ferme data + cascade-hôte (zone à vide)
    if (pc.focused) caster.focus = undefined; // le sort focalisé est consommé même à vide
    finishPlayerAction(get, set, [`${spell.label} : la zone ne touche personne.`], 'cast');
    return;
  }
  const first = inZone[0];
  const r1 = pc.missile && res.cast ? evaluateMissile(caster, first, spell, res) : res;
  // FOLD (parité castConfirm) : ne ferme QUE le jet ; la cascade d'incantation reste active pour
  // qu'un Critique de Sort / Imparfaite s'y appendent. Repère l'étape `jet:'cast'` AVANT applyCast.
  const cascBefore = get().pendingCascade;
  const castStepIdx = cascBefore && cascBefore.purpose === 'combat' && cascBefore.participants[cascBefore.cursor]?.jet === 'cast'
    ? cascBefore.cursor : -1;
  set({ pendingCast: null }); // ferme le jet ; cascade d'incantation conservée
  const ocDur = overcastDurationParts(overcastSourceOf(spell), pc.overcast?.duration ?? 0);
  applyCast(get, set, caster, first, spell, r1, pc.missile, pc.focused, pc.critChoice, {
    durationMult: ocDur.mult,
    durationBonusRounds: ocDur.bonusRounds,
    extraTargets: inZone.slice(1),
  });
  // Avance au-delà de l'étape cast (résolue) : conséquences appendues → jouées ; aucune → ferme.
  if (castStepIdx >= 0) {
    const casc = get().pendingCascade;
    if (casc && casc.purpose === 'combat' && casc.cursor === castStepIdx) {
      if (casc.participants.length > castStepIdx + 1) set({ pendingCascade: { ...casc, cursor: castStepIdx + 1 } });
      else set({ pendingCascade: null });
    }
  }
}

/** Contexte de visibilité OPTIONNEL pour filtrer des cibles de sort par Ligne de Vue (LDB 46
 *  l.170). Absent/null (hors combat, tests purs) : pas de filtre — comportement historique. */
export type SpellSight = { scene: Scene; smoke?: Pt[] } | null;
const spellSightBlocked = (sight: SpellSight | undefined, caster: Combatant, t: Combatant): boolean =>
  !!sight && !!caster.pos && !!t.pos && !losClear(sight.scene, caster.pos, t.pos, sight.smoke ?? []);
/** SpellSight depuis l'état courant (scène + fumée du combat), null hors combat. */
export const spellSightOf = (get: Get): SpellSight =>
  get().scene && get().battle ? { scene: get().scene!, smoke: smokeOf(get().battle!) } : null;

/** Unicité RAW (arcane LDB 46 l.116-121 / divin 40 l.16-19) : un effet OU une invocation de CE sort est-il
 *  DÉJÀ actif du côté du lanceur ? `true` si un combattant ALLIÉ porte un effet de ce sort (par identité de
 *  sort, `sourceSpellId`/`spell.spellId`) OU si une créature invoquée par CE sort et CE lanceur est encore
 *  en jeu. Empêche le re-cast en boucle d'un buff durable / d'une invocation. */
function isSpellActive(spell: SpellData, caster: Combatant, battle: BattleState | null): boolean {
  if (!battle) return false;
  const buffed = battle.combatants.some(
    (c) => c.kind === caster.kind && (c.activeEffects ?? []).some((e) => e.sourceSpellId === spell.id || e.spell?.spellId === spell.id),
  );
  if (buffed) return true;
  return battle.combatants.some((c) => c.summon?.spellId === spell.id && c.summon?.byId === caster.id && !isOutOfAction(c));
}

/**
 * Construit l'entrée de l'IA pour `enemy` : la LISTE complète de ses sorts RÉSOLUS + enrichis
 * (`CastableSpell[]` — portée/forme/fiabilité d'incantation/Focalisation/Unicité), plus le contexte
 * tactique partagé (escouade/orientation/perception/mouvement/blocage/fumée/vol). MUTUALISÉ par
 * `runEnemyAI`, le frais d'`aiApproachPlan` et les replans de budget (qui surchargent juste `movement`).
 * Couche IMPURE : a les DONNÉES de sort + le `battle`. Le `movement` n'inclut PAS le cas « vient
 * d'enfourcher » (Mouvement consommé) — l'appelant le force à 0 le cas échéant.
 */
export function buildAiInput(enemy: Combatant, get: Get): EnemyTurnInput {
  const battle = get().battle!;
  const scene = get().scene!;
  const foeKind = enemy.kind === 'enemy' ? 'hero' : 'enemy';
  const heroes = battle.combatants.filter((c) => c.kind === foeKind && !isOutOfAction(c));
  const squad = battle.combatants.filter((c) => c.kind === enemy.kind && !isOutOfAction(c) && c.pos && c.id !== enemy.id);
  // Géométrie porteuse (Combat monté, LDB 14) → empreinte + Mouvement + cases bloquées.
  const geom = mountOf(battle, enemy) ?? enemy;
  const blocked = occupied(battle, geom);
  const cavalryCharge = !!enemy.mountId && !isEngaged(enemy); // cavalier non Engagé : portée de Course (2×)
  let movement = Math.floor(effectiveMovement(geom) * (cavalryCharge ? 2 * runMultiplier(geom.traits) : 1));
  const flyM = flyMeters(enemy.traits); // Vol (Indice) (LDB 85 p.343) : remplace la Marche s'il porte plus loin
  if (flyM != null) movement = Math.max(movement, Math.floor(flyM / 2));
  const perceived = perceivedTiles(
    { scene, battle, party: get().party, partyPos: get().partyPos, gameTime: get().gameTime, lightLevel: get().lightLevel },
    enemy,
  );
  // Sorts connus, résolus + enrichis (portée en cases, forme, fiabilité d'incantation, Focalisation, Unicité).
  const spells: CastableSpell[] = [];
  for (const id of enemy.spells ?? []) {
    const data = resolveSpell(id);
    if (!data) continue;
    const cn = data.cn ?? 0;
    // Focalisation prête (DR cumulé ≥ NI) → fiabilité calculée à NI 0 ; sinon fiabilité normale.
    const ready = enemy.focus?.spell === data.id && (enemy.focus?.dr ?? 0) >= cn;
    const landProb = castLandProbability(enemy, data, ready);
    // Un sort dont le payload est une INVOCATION alliée (`op:summon on:caster`) est routé 'self' (et JAMAIS
    // 'focusable' : on ne focalise pas une invocation, on la LANCE) AVANT toute logique de zone — la machinerie
    // `castArea` = zone de DÉGÂTS (centre sur un paquet d'ennemis) ne convient pas (un summon sans ennemi dans
    // la zone ne se résout pas, tour gâché). En 'self', le chemin `cast` normal déclenche le summon (`applyCast`)
    // et pose `spell.id` sur le lien → Unicité (plus de re-invocation en boucle). La `target.kind='area'` d'un
    // tel sort (Réanimation) est COSMÉTIQUE — `applySummon` place les invoqués près du lanceur.
    const hasAllySummon = spellOps(data.effects, 'caster').some((o) => o.op === 'summon' && o.allyOfCaster !== false);
    const focusState: CastableSpell['focusState'] = ready ? 'ready'
      : (!hasAllySummon && landProb < 0.5 && isArcaneSpell(data) && !!focusSkillFor(enemy, data)) ? 'focusable'
        : 'none';
    const radius = hasAllySummon ? null : zdeRadiusTiles(data.target, enemy);
    const shape: CastableSpell['shape'] = hasAllySummon ? 'self'
      : radius != null ? { area: { radius } }
        : (data.range?.kind === 'self' || data.target?.kind === 'self') ? 'self'
          : 'single';
    spells.push({
      id: data.id, data, cn, range: spellRangeTiles(data.range, enemy), shape, landProb, focusState,
      active: isSpellActive(data, enemy, battle),
    });
  }
  // Structures destructibles (porte/mur) ciblables par les ARMES DE SIÈGE de l'ASSAILLANT (AA l.3808). Réservé
  // aux ENNEMIS (les assaillants brèchent l'enceinte) : un défenseur allié-IA n'attaque pas sa propre porte —
  // `structureImmune` n'y suffirait pas (une pièce de siège alliée la pourrait). Absent côté allié → aucun candidat.
  const structures = enemy.kind === 'enemy'
    ? battle.combatants.filter((c) => isStructure(c) && !isOutOfAction(c) && c.pos)
    : undefined;
  return {
    enemy, heroes, scene, blocked, noStop: cannotStopOn(battle, geom), movement, spells,
    smoke: smokeOf(battle), flying: flyM != null, perceived, facing: get().facing, squad,
    // « Servir cette pièce » (MDG ch.12) : postes de siège NON servis adjacents — KIND-AGNOSTIQUE (l'appelant
    // impur a la liste complète des combattants). Vide en scène sans emplacement → aucun candidat (parité golden).
    servablePostes: servablePostes(enemy, battle.combatants).map(({ hull, poste }) => ({ hullId: hull.id, posteUid: poste.item.uid })),
    structures,
  };
}

/** La meilleure action IA de `enemy` est-elle de PRÉPARER un sort (cast/castArea/focus) plutôt que d'agir
 *  au contact ? Peek DÉTERMINISTE lu par le hook de Frénésie (`aiMaybeFrenzy`) pour DIFFÉRER l'entrée en
 *  Frénésie tant qu'un sort (buff/invocation/dégâts) prime sur charger — RAW : l'entrée en Frénésie est un
 *  CHOIX (psychologie.md l.170). L'Unicité retire ces sorts un à un ; quand il ne reste que charger, la
 *  Frénésie passe au tour suivant. N'utilise AUCUN `battleRng` et ne mute rien (`buildAiInput`/
 *  `chooseEnemyAction` déterministes et purs) → planning de coop sans désync. */
export function aiWouldPrepareSpell(enemy: Combatant, get: Get): boolean {
  const a = chooseEnemyAction(buildAiInput(enemy, get));
  return a.kind === 'cast' || a.kind === 'castArea' || a.kind === 'focus';
}

/** Surincantation AUTOMATIQUE d'un lanceur ENNEMI (LDB 47 l.28-31 : « Pour chaque +2 DR […]
 *  vous pouvez ajouter une valeur de […] Cible égale à la valeur initiale ») : le surplus
 *  (DR − NI) est alloué à l'axe CIBLE d'un Projectile — adversaires actifs les plus proches,
 *  à PORTÉE du Sort, hors cible principale. Retourne le patch de pendingCast ({} si rien). */
export function aiOvercastPlan(
  caster: Combatant,
  targetId: string,
  spell: { cn: number | null; range: SpellRange | null },
  res: { cast: boolean; sl: number },
  combatants: Combatant[],
  focusedNI0 = false,
  sight?: SpellSight,
): { overcast?: { range: number; zone: number; duration: number; targets: number }; extraTargetIds?: string[] } {
  if (!res.cast || !caster.pos) return {};
  const ni = focusedNI0 ? 0 : spell.cn ?? 0;
  const budget = Math.floor(Math.max(0, res.sl - ni) / 2);
  if (budget <= 0) return {};
  const range = spellRangeTiles(spell.range, caster) ?? Infinity;
  const extras = combatants
    .filter((t) => t.kind !== caster.kind && t.id !== targetId && !isOutOfAction(t) && t.pos && combatDistance(caster, t) <= range && !spellSightBlocked(sight, caster, t))
    .sort((a, b) => combatDistance(caster, a) - combatDistance(caster, b))
    .slice(0, budget)
    .map((t) => t.id);
  if (!extras.length) return {};
  return { overcast: { range: 0, zone: 0, duration: 0, targets: extras.length }, extraTargetIds: extras };
}

/** Cibles SUPPLÉMENTAIRES proposables pour la Surincantation « Cible » (LDB 47 l.28-31), côté
 *  modale : hors cible principale, À PORTÉE du Sort (quand les positions existent — hors combat
 *  le groupe n'est pas sur un plateau), et surtout EN ÉTAT D'ÊTRE CIBLÉES — un Projectile vise un
 *  adversaire encore en combat (un figurant à 0 PB est mort, LDB 18 l.51-54) ; un sort bénéfique
 *  vise un allié non mort/évacué (l'Inconscient reste soignable). Aligné sur aiOvercastPlan/ZdE. */
export function overcastTargetCandidates(
  pool: Combatant[],
  caster: Combatant,
  targetId: string,
  spell: { range: SpellRange | null },
  missile: boolean,
  // Surincantation (LDB 47/41/42) : SOURCE (×initial Sort/Miracle vs +6 m fixe Bénédiction) et pas de
  // Portée alloués — EXPLICITES (aucun défaut caché qui pourrait mal-appliquer l'×initial à un sort divin).
  // `rangeSteps` 0 = portée de base ; étendre la Portée élargit l'ensemble des cibles atteignables.
  source: OvercastSource,
  rangeSteps: number,
  sight?: SpellSight,
): Combatant[] {
  const range = effectiveSpellRangeTiles(spell.range, caster, source, rangeSteps);
  return pool.filter((m) => {
    if (m.id === targetId) return false;
    if (missile ? m.kind === caster.kind || isOutOfAction(m) : m.kind !== caster.kind || m.dead || m.outOfRencontre) return false;
    if (range != null && caster.pos && m.pos && combatDistance(caster, m) > range) return false;
    // Ligne de Vue (LDB 46 l.170) : une cible supplémentaire doit aussi être visible du lanceur.
    return !spellSightBlocked(sight, caster, m);
  });
}

/** Sort effectif d'un pendingCast : NI DOUBLÉ pour une lecture au grimoire (LDB 47 l.34). */
export function effectiveSpellOf(pc: { spellId: string; grimoire?: boolean }): ReturnType<typeof findSpell> {
  const spell = resolveSpell(pc.spellId);
  if (!spell || !pc.grimoire || spell.cn == null) return spell;
  return { ...spell, cn: spell.cn * 2 };
}

/** Contre-lanceurs ÉLIGIBLES à la Dissipation (LDB 46 l.201-202) contre un Sort de `caster` visant
 *  `target` : camp opposé, actif, lanceur (Compétence Langue (Magick) ou Trait Lanceur de Sorts),
 *  pas encore de Contre-sort ce Round (« un seul Sort chaque Round »), et le Sort le CIBLE
 *  (« Si un Sort vous cible ») ou vise un point QU'IL PEUT VOIR « à une distance en mètres égale à
 *  votre Force Mentale » (1 case = 2 m ; Ligne de Vue scène + fumée). */
export function counterspellCandidates(
  battle: BattleState | null,
  scene: Scene | null | undefined,
  caster: Combatant,
  target: Combatant,
): Combatant[] {
  if (!battle || battle.over) return [];
  return battle.combatants.filter((c) => {
    if (c.kind === caster.kind || c.id === caster.id || isOutOfAction(c) || c.dispelledThisRound) return false;
    if (!knowsCastingSkill(c, 'langue', 'magick')) return false;
    if (c.id === target.id) return true;
    if (!c.pos || !target.pos) return false;
    if (combatDistance(c, target) > Math.max(1, Math.floor(effectiveChar(c, 'FM') / 2))) return false;
    return !scene || losClear(scene, c.pos, target.pos, smokeOf(battle));
  });
}

/** Applique une issue de Contre-sort DÉJÀ obtenue (`out`) au `pendingCast` FIGÉ : dissipé → le Sort
 *  échoue ; sinon l'incantation se re-détermine au DR NET (Projectile compris) et la Surincantation
 *  de l'IA est re-planifiée. SOURCE UNIQUE de l'application — partagée par le Contre-sort SOLO
 *  (IA, `applyCounterspell`) et le Contre-sort à PLUSIEURS (chaque héros a son jet déjà influencé,
 *  `counterspellConfirm`). N'effectue PAS le jet (déjà fait) ni la consommation d'essai (à l'appelant). */
export function applyCounterspellOutcome(get: Get, set: SetFn, counter: Combatant, out: CounterspellOutcome): boolean {
  const pc = get().pendingCast;
  if (!pc?.result || pc.result.dispelled) return false;
  const caster = get().battle?.combatants.find((c) => c.id === pc.casterId);
  const target = get().battle?.combatants.find((c) => c.id === pc.targetId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !target || !spell) return false;
  const res = pc.result;
  // Zone NON POSÉE (flux « jet puis pose ») : re-dériver le jet PUR (Dégâts par cible dérivés du DR
  // net à la pose), jamais un Projectile contre l'ancre.
  const unplacedZone = !!pc.zone && !pc.zone.center;
  let next: typeof pc.result;
  if (out.dispelled) {
    next = { ...res, cast: false, dispelled: true, hit: false, damage: undefined, woundsLost: undefined, defenderDefeated: false, log: `${out.log}` };
  } else {
    next = rederiveCastSL(caster, target, spell, res, pc.missile && !unplacedZone, pc.focused, out.casterNetSL - res.sl);
    next.log = `${out.log} ${next.log}`;
  }
  // Surincantation : le surplus a changé — re-plan IA (lanceur ennemi), remise à zéro sinon.
  const oc = aiDriven(get(), caster) && pc.missile && !pc.zone
    ? aiOvercastPlan(caster, pc.targetId, spell, next, get().battle?.combatants ?? [], pc.focused, spellSightOf(get))
    : {};
  set({ pendingCast: { ...pc, result: next, overcast: undefined, extraTargetIds: undefined, ...oc } });
  const b = get().battle;
  if (b) set({ battle: { ...b, log: [...b.log, ev('info', out.log, counter.id, caster.id)] } });
  return true;
}

/** Contre-sort SOLO (IA auto-dissipe le Sort d'un héros) : roule le Test opposé de Langue (Magick)
 *  (LDB 46 l.201-202) puis applique l'issue. Marque l'essai du Round (consommé même raté, l.202). */
export function applyCounterspell(get: Get, set: SetFn, counter: Combatant): boolean {
  const pc = get().pendingCast;
  if (!pc?.result || pc.result.dispelled) return false;
  const caster = get().battle?.combatants.find((c) => c.id === pc.casterId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !spell || !isDispellableSpell(spell)) return false;
  if (counter.kind === caster.kind || counter.dispelledThisRound) return false;
  counter.dispelledThisRound = true; // l'essai est consommé même s'il échoue (LDB 46 l.202)
  const out = resolveCounterspell(counter, castTestOf(pc.result), battleRng());
  return applyCounterspellOutcome(get, set, counter, out);
}

/** Choix du lanceur sur une Incantation CRITIQUE (LDB 46 l.52-59). */
export type CastCritChoice = 'critique' | 'puissance' | 'ineluctable';

/**
 * Exécute un sous-Flow de sort EN COMBAT via l'exécuteur UNIQUE `runCombatFlow` (after-aware) puis
 * RAMÈNE ses lignes de journal pour qu'`applyCast` les place INLINE dans son `logLines` (ordre du
 * journal de sort préservé).
 *
 * Pourquoi ce détour file→drain : `runCombatFlow` est le seul exécuteur qui porte la CONTINUATION
 * `after` d'un nœud `test` enfoui — un sort à Test interne (Lot 4) suspend alors en APPENDANT une étape
 * `triggeredTest` à la cascade `cast` active (openCastCascade), comme Critique/Maladresse de sort. Il
 * pousse son journal dans la file différée `pendingLogQueue` ; `drainPendingLog` la vide ici et rend les
 * lignes (`.text`) — la file capte AUSSI les lignes des hooks profonds déclenchés par les ops du sort
 * (`onGainCondition` d'un ennemi → Mâchoires), donc elles ne sont plus orphelines. Aucun sort n'ayant
 * ENCORE de nœud Flow `test`, `runCombatFlow` s'exécute de bout en bout (do/if seulement). */
function runCastFlow(get: Get, set: SetFn, target: Combatant, caster: Combatant, flow: Flow, opsCtx: OpsCtx): string[] {
  runCombatFlow({ mode: 'combat', get, set, target, caster, label: opsCtx.label ?? caster.name, opsCtx }, flow);
  return drainPendingLog(get, set).map((e) => e.text);
}

/** Applique un résultat d'incantation DÉJÀ obtenu (mute caster/cible, consomme l'Action). */
export function applyCast(
  get: Get,
  set: SetFn,
  caster: Combatant,
  target: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  res: CastResult & Partial<MissileResult>,
  missile: boolean,
  focusedNI0: boolean,
  critChoice?: CastCritChoice,
  extras?: { durationMult?: number; durationBonusRounds?: number; extraTargets?: Combatant[]; conjureForm?: ConjureForm; opposedOutcome?: Record<string, { resisted: boolean; margin: number }> },
) {
  const battle = get().battle; // null = incantation HORS COMBAT (couture D) : même applyCast, sortie journal
  // Durée surincantée DÉCOMPOSÉE (engine/overcast) : `rounds = base × mult + bonus`. Arcane/Miracle :
  // mult = 1+pas, bonus = 0 (×initial, joue aussi sur une durée d'horloge). Bénédiction : mult = 1,
  // bonus = 6 Rounds × pas (FIXE, rounds-only — pas de Bénédiction à durée d'horloge).
  const durationMult = Math.max(1, extras?.durationMult ?? 1);
  const durationBonusRounds = Math.max(0, extras?.durationBonusRounds ?? 0);
  let teleportReach: Map<string, number> | null = null; // Téléportation (Jalon 2.6) : posé APRÈS finishPlayerAction
  const extraTargets = extras?.extraTargets ?? [];

  // Incantation CRITIQUE (LDB 46 l.52-59) — SORTS seulement (Test de Langue (Magick)) :
  // les Vents octroient une puissance supplémentaire (choix du lanceur), mais cela a un
  // prix — Imparfaite Mineure, sauf Talent Diction instinctive.
  const isSort = !castInfoIsPrayer(spell);
  // DISSIPATION (LDB 46 l.204-207) : identité du Sort source, marquée sur ses ActiveEffect DURABLES (via
  // `OpsCtx.sourceSpell` → `applyOps`) pour autoriser un Test étendu de Langue (Magick) jusqu'au NI. Sorts
  // seulement (les Prières ne se dissipent pas par Contre-sort). Sort instantané → aucun effet → rien à marquer.
  const sourceSpell = isSort ? { spellId: spell.id, ni: spell.cn ?? 0, casterId: caster.id, label: spell.label } : undefined;
  // IDENTITÉ du sort (Unicité RAW / anti-spam IA) : posée sur TOUT effet durable de ce lancement — Prières
  // COMPRISES (≠ `sourceSpell`, réservé à la dissipation arcanique). Une bénédiction durable est ainsi
  // reconnue par `isSpellActive`/`buildAiInput` pour ne pas la re-lancer en boucle (LDB 46 l.116-121).
  const sourceSpellId = spell.id;
  // Un Sort DISSIPÉ (Contre-sort gagnant, LDB 46 l.201-202) n'est pas lancé : pas d'effet Critique
  // — « Puissance totale » (l.57) repêche un DR insuffisant, pas une Dissipation.
  const crit = !!res.isCritical && isSort && !res.dispelled;
  let choice = critChoice;
  if (crit) {
    // Défaut (IA / non choisi) : repêcher un DR insuffisant (Puissance totale), sinon
    // Blessure Critique pour un Projectile, sinon Force inéluctable.
    choice ??= !res.cast ? 'puissance' : missile ? 'critique' : 'ineluctable';
    if (choice === 'puissance' && !res.cast) {
      res = missile
        ? evaluateMissile(caster, target, spell, { ...res, cast: true })
        : { ...res, cast: true, log: `${caster.name} lance ${spell.label} (Puissance totale — Critique).` };
    }
  }
  const logLines: string[] = [res.log];
  // Composant d'incantation (LDB 46 l.158-163, règle optionnelle) : consommé UNE fois par lancement
  // d'un Sort d'Arcane/Domaine couvert, « même si aucune Incantation Imparfaite n'a été obtenue »
  // (l.161). `componentUsed` → toute Imparfaite de ce lancement est dégradée (Majeure→Mineure,
  // Mineure→annulée). N'a pas lieu pour une Prière (l.163 : composants = Sorts d'Arcane/Domaine).
  const componentUsed = isSort && useSpellComponent(caster, spell.id, logLines);
  // Influences malfaisantes (Règle du 8, LDB 46 l.89) & Sorcellerie (LDB 49) — Sorts seulement, à résoudre
  // APRÈS la résolution du Sort (bloc `applyExtraMiscast`). `nearCorruption` = source de Corruption à
  // proximité (lieu ou créature) ; `sorcery` = Sort du Domaine de la Sorcellerie, règle optionnelle active.
  const nearCorruption = isSort && castNearCorruption(get);
  const sorcery = isSort && rule('magic-sorcellerie') === true && isSorceryDomain(spell);
  // Sur un « 88 » près d'une Corruption, la Règle du 8 escalade l'Imparfaite du fumble en Majeure — on
  // NEUTRALISE alors l'Imparfaite Mineure de fumble (elle est subsumée), sinon on l'appliquerait en double.
  const ruleOfEightHandled = nearCorruption && res.roll % 10 === 8;
  /** Imparfaite ADDITIONNELLE due à la Règle du 8 / à la Sorcellerie, appliquée UNE fois après le Sort. */
  const applyExtraMiscast = (): void => {
    const roe = ruleOfEightSeverity(res.roll, nearCorruption, res.isFumble);
    if (roe) logLines.push(...applyMiscast(get, set, caster, roe, { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery }));
    else if (sorceryMandatoryMiscast(sorcery, componentUsed) && !res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'mineure', { sorceryCorruption: true }));
  };
  if (crit) {
    logLines.push(
      choice === 'critique'
        ? tr('cf.castCritical')
        : choice === 'puissance'
          ? tr('cf.overcastFullPower')
          : tr('cf.overcastIrresistible'),
    );
    if (!hasTalent(caster, 'Diction instinctive')) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery }));
    else logLines.push(tr('cf.dictionInstinctive'));
  }
  // « Avantages et Magie » (LDB 46 l.176) : si la cible a déjà été visée par un Sort du
  // MÊME Domaine ce Round, le lanceur gagne +1 Avantage (le Vent converge). Sorts seulement.
  if (battle && isSort && spell.domainId && res.cast) {
    const marks = battle.domainCasts ?? [];
    if (marks.some((m) => m.targetId === target.id && m.domain === spell.domainId)) {
      campGain(get, caster);
      caster.gainedAdvThisRound = true;
      logLines.push(tr('cf.windConverges', { name: caster.name, wind: spell.subType ?? spell.domainId, target: target.name }));
    }
    battle.domainCasts = [...marks, ...[target, ...extraTargets].map((t) => ({ targetId: t.id, domain: spell.domainId! }))];
  }

  if (missile) {
    // Touche d'un Projectile : application des Blessures + Critique (choix/overkill).
    const missileSpec = spell;
    const applyMissileHit = (t: Combatant, mres: CastResult & Partial<MissileResult>) => {
      // Manifestation de Ghur (Middenheim, #18) : un Projectile du Domaine de la Bête n'affecte PAS le
      // porteur — ses Dégâts ET ses effets (effets négatifs du Sort de la Bête) sont sautés sur cette cible.
      if (immuneToSpellDomain(t.traits, spell.domainId)) { logLines.push(tr('cf.spellDomainImmune', { name: t.name, spell: spell.label })); return; }
      // LDB 18 l.53/55 : un Projectile Coup Critique re-tire la Localisation (1d100 frais, MÊME primitive
      // que la mêlée — pas le dé inversé) et RÉ-ÉVALUE ses Dégâts à cette loc AVANT les atténuations
      // magiques ci-dessous (Résistance/Dôme/Martyr). `crit` = double d'Incantation, `choice` = Incantation Critique.
      if (crit && choice === 'critique') mres = evaluateMissile(caster, t, spell, mres, critWoundLocation(battleRng(), t.bodyShape));
      // Résistance à la Magie (Indice) (LDB 85 p.341) : « Le DR de tous les Sorts l'affectant est
      // réduit du nombre indiqué » → autant de Blessures en moins (dégâts du Projectile = dérivés du DR).
      const mr = magicResistanceOf(t.traits) + talentMagicResistance(t); // Trait (LDB 85) + Talent (LDB 10, 2×niveau)
      if (mr > 0 && mres.hit && mres.woundsLost) {
        mres = { ...mres, woundsLost: Math.max(0, mres.woundsLost - mr) };
        logLines.push(tr('cf.resistMagic', { name: t.name, mr }));
      }
      // Dôme (LDB 47 — L11) : Protection (6+) contre une Attaque MAGIQUE venant de l'extérieur.
      if (mres.hit && mres.woundsLost && battle && wardedAgainst(battle.combatants, caster, t, 'domeWard')) {
        const d = d10(battleRng());
        if (d >= 6) {
          logLines.push(tr('cf.domeSaved', { name: t.name, d }));
          return;
        }
      }
      // Martyr (LDB 43 l.107) : les Dégâts du Projectile vont au prêtre (BE doublé pour ces Dégâts).
      if (mres.hit && mres.woundsLost && battle) {
        const priest = martyrGuardOf(battle, t);
        if (priest) {
          const raw = mres.damage ?? mres.woundsLost;
          const taken = Math.max(0, raw - 2 * bonus(effectiveChar(priest, 'E')) - Math.max(0, priest.armour[mres.location ?? 'corps'] ?? 0));
          if (taken > 0) {
            loseWounds(priest, taken);
            if (priest.wounds.current <= 0) applyZeroWounds(priest);
          }
          logLines.push(tr('cf.martyrTakes', { priest: priest.name, name: t.name, taken: taken > 0 ? tr('cf.fragMartyrTaken', { taken }) : tr('cf.fragMartyrNoDmg') }));
          logLines.push(...checkFocusInterruption(get, set, priest));
          return;
        }
      }
      if (!mres.hit || !mres.woundsLost) return;
      const currentBefore = t.wounds.current;
      const overkill = mres.woundsLost - currentBefore;
      t.wounds.current = Math.max(0, currentBefore - mres.woundsLost);
      // Blessure Critique : choix « Incantation Critique » du lanceur (LDB 46 l.55), ou overkill.
      const critWound = crit && choice === 'critique';
      if (critWound || overkill > 0) {
        const loc = mres.location ?? 'corps'; // double → loc re-tirée (#80) ; dépassement → loc de touche
        const ovk = Math.max(0, overkill);
        const c2: DeviationCtx = { attackerId: caster.id, attackerKind: caster.kind, weapon: spell.label, critTwice: hasActiveFlag(caster, 'critRollTwice') };
        const heroConcerned = t.kind === 'hero' || caster.kind === 'hero';
        // Déviation Critique (LDB 63 l.30) : sur double (`critWound`) OU dépassement (`overkill`) — RAW complet,
        // parité avec la mêlée — pourvu que l'armure ABSORBE réellement (`magicDeviationEligible` : PA déviatable,
        // pas de bypass de Domaine Ombres/Métal/Cieux, sort qui n'ignore pas les PA).
        const elig = magicDeviationEligible(caster, t, loc, spell, mres, mres.woundsLost ?? 0, mr);
        let suspended = false;
        if (elig.eligible && t.kind === 'enemy' && enemyAutoDeviate(set, t, loc, elig.extraWounds, { attackerId: caster.id, weapon: spell.label }, mres.roll ?? 0, logLines, heroConcerned)) {
          // ennemi : déviation AUTO réussie (rule on + PA sacrifiable) → Critique ignoré. Sinon (règle OFF /
          // pas de PA), `enemyAutoDeviate` retourne false → on TOMBE sur `applyCritAndFinalize` (Critique subi).
        } else if (rule('combat-critical-deflect') && elig.eligible && t.kind === 'hero') {
          // HÉROS blindé : SUSPEND son choix (étape `self`, push SYNCHRONE — la boucle multi-cibles continue,
          // chaque cible porte SON propre step indépendant). Le Critique pré-tiré PORTE l'overkill (−20 table si
          // > BE, LDB 18 l.30) → un double qui dépasse garde sa sévérité au Subir.
          const cr2 = rollCritical(t, loc, battleRng(), ovk, c2.critTwice);
          pushDeviationStep(set, {
            mode: 'self', attackerId: caster.id, targetId: t.id, location: loc, crit: cr2,
            isCoupCritique: critWound, overkill: ovk, deflectExtraWounds: elig.extraWounds, woundsBefore: currentBefore,
            reveal: previewCritEntry(t, cr2, { attackerId: caster.id, weapon: spell.label }), resumeAfter: true, ctx: c2,
          });
          suspended = true;
        } else {
          applyCritAndFinalize(get, set, t, loc, critWound, ovk, logLines, c2, currentBefore);
        }
        // 0 PB → À Terre (LDB 18 l.28) — SAUF si suspendu (le Critique du héros n'est pas encore résolu :
        // resolveDeviation `self` s'en charge). Parité avec la mêlée et resolveDeviation.
        if (!suspended && t.wounds.current <= 0 && !t.dead && !hasCondition(t, COND.inconscient)) applyZeroWounds(t);
      } else if (t.wounds.current <= 0) {
        applyZeroWounds(t);
      }
      // Effets ADDITIONNELS d'un Projectile sur la cible (« Grands feux d'U'Zhul » : +2 En flammes, À
      // Terre ; « Drain » : soigne le lanceur) — lus depuis `spell.effects` (Flow éditable, feuilles
      // `on:'target'`). Réservé aux sorts CURÉS : un sort sans spec n'a pas d'effet missile parsé (iso-POC).
      if (missileSpec.curated && spellOps(spell.effects, 'target').length) {
        const rounds = missileSpec.duration?.kind === 'rounds' ? resolveFormula(missileSpec.duration.value, caster, battleRng()) : null;
        const clockMin = rounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
        logLines.push(...runCastFlow(get, set, t, caster, spellFlowFor(spell.effects, 'target'), {
          rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: res.sl,
          ...(rounds != null ? { defaultDurationRounds: rounds } : {}),
          ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
          ...(sourceSpell ? { sourceSpell } : {}), sourceSpellId,
          onCorruption: followsCharacterRules(t) ? (n, align) => gainCorruption(get, set, t, n, align) : undefined, // #143 : personnage, pas un proxy `kind`
        }));
      }
      // Vol de vie (LDB 48 — Mort : Caresse de Laniph, Vol de vie) : op `lifeSteal` du Flow (on:'caster')
      // — le lanceur récupère une fraction des Blessures RÉELLEMENT infligées (`ctx.woundsDealt`, jamais
      // plus que les PB perdus par la cible). Le missile ne joue pas le sous-Flow `caster`, on applique
      // donc la/les op(s) lifeSteal directement avec les Blessures infligées en contexte.
      if (mres.woundsLost) {
        const dealt = Math.min(mres.woundsLost, currentBefore);
        const lifeStealOps = spellOps(spell.effects, 'caster').filter((o) => o.op === 'lifeSteal');
        if (lifeStealOps.length) logLines.push(...applyOps(caster, lifeStealOps, { rng: battleRng(), caster, label: spell.label, woundsDealt: dealt }));
      }
      // Interruption de Focalisation : un Projectile magique blesse aussi un focaliseur (LDB 46 l.193).
      logLines.push(...checkFocusInterruption(get, set, t));
      if (isOutOfAction(t)) logLines.push(tr('cf.outOfAction', { name: t.name }));
    };
    applyMissileHit(target, res);
    // Nerveux (effet déclenché onStartled : magie → +3 Brisé) — dispatcher générique (state/triggeredEffects).
    // Cause 'magic' (présence de magie) → exemption Dressé (Magie) lue par la Condition Flow `startleCause`.
    for (const t of [target, ...extraTargets]) {
      if (res.cast && !isOutOfAction(t)) for (const line of fireTriggers(get, t, 'onStartled', { set, startleCause: 'magic' })) logLines.push(line);
    }
    // Surincantation « Cible » (LDB 47 l.28-31) : le MÊME jet frappe les cibles supplémentaires.
    for (const t2 of extraTargets) {
      if (!res.cast) break;
      const r2 = evaluateMissile(caster, t2, spell, res);
      logLines.push(r2.log);
      applyMissileHit(t2, r2);
      if (battle) bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: t2.id, result: r2, kind: 'spell', spell: spell.label, defense: 'none' });
    }
    // Attaques en chaîne (LDB 47 — L13) : « Si [le Projectile] réduit la cible à 0 Blessure, il
    // rebondit sur une autre cible » — ennemi du lanceur le plus proche de la cible précédente
    // (≤ BFM m), dans la portée INITIALE du sort, jamais re-touché ; mêmes Dégâts (même jet) ;
    // max BFM rebonds. S'arrête dès qu'une cible survit.
    const chainOp = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'chain' }> => o.op === 'chain');
    if (chainOp && res.cast && battle && caster.pos) {
      const maxBounces = Math.max(0, resolveFormula(chainOp.maxBounces, caster, battleRng()));
      const hopTiles = Math.max(1, Math.ceil(Math.max(0, resolveFormula(chainOp.hopMeters, caster, battleRng())) / 2));
      const initialRange = spellRangeTiles(spell.range, caster);
      const hitIds = new Set([target.id, ...extraTargets.map((t) => t.id)]);
      let prev = target;
      for (let bounce = 0; bounce < maxBounces; bounce++) {
        if (!(prev.wounds.current <= 0 || prev.dead)) break; // « réduit la cible à 0 Blessure »
        const next = battle.combatants
          .filter((c) => c.kind !== caster.kind && !hitIds.has(c.id) && !isOutOfAction(c) && c.pos
            && combatDistance(prev, c) <= hopTiles
            && (initialRange == null || combatDistance(caster, c) <= initialRange))
          .sort((a, b) => combatDistance(prev, a) - combatDistance(prev, b))[0];
        if (!next) break;
        const r2 = evaluateMissile(caster, next, spell, res);
        logLines.push(tr('cf.spellBounces', { spell: spell.label, name: next.name }), r2.log);
        applyMissileHit(next, r2);
        bus.emit(EVT.ANIM_ATTACK, { from: prev.id, to: next.id, result: r2, kind: 'spell', spell: spell.label, defense: 'none' });
        hitIds.add(next.id);
        prev = next;
      }
    }
    // Zone persistante d'un Projectile (Grands feux d'U'Zhul : « le feu continue de brûler
    // dans la Zone d'Effet pour la durée du Sort ») — posée autour de la cible touchée.
    if (res.cast) placeSpellZone(get, caster, target, spell, missileSpec, res.sl, durationMult, logLines);
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble && !ruleOfEightHandled) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery }));
    else if (focusedNI0 && !res.cast && !ruleOfEightHandled) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery }));
    applyExtraMiscast(); // Règle du 8 / Sorcellerie (LDB 46 l.89 / LDB 49)
    // Sort offensif : lanceur vers la cible, cible vers le lanceur.
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!), [target.id]: facingToward(target.pos!, caster.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  } else {
    if (res.cast) {
      // Effets structurés du sort (spec curée du registre, sinon repli regex sur la
      // desc — iso-POC). Durée hors-rounds (minutes/heures/jours, LDB 47) : l'effet reçoit une durée
      // `{scale:'clock'}` (échéance d'HORLOGE `gameTime`, purgée par l'horloge), pas un nombre de
      // Rounds — on n'en invente PAS. Surincantation « Durée » : ×(1+n) (LDB 47).
      const spec = spell;
      const baseRounds = spec.duration?.kind === 'rounds' ? resolveFormula(spec.duration.value, caster, battleRng()) : null;
      const rounds = baseRounds != null ? baseRounds * durationMult + durationBonusRounds : null;
      const baseClockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      const clockMin = baseClockMin != null ? baseClockMin * durationMult : null;
      if ((durationMult > 1 || durationBonusRounds > 0) && baseRounds != null) logLines.push(tr('cf.overcastDuration', { rounds: String(rounds) }));
      if (durationMult > 1 && baseClockMin != null) logLines.push(tr('cf.overcastDurationMin', { mult: durationMult }));
      for (const t of [target, ...extraTargets]) {
        if (t !== target) logLines.push(tr('cf.spellExtends', { spell: spell.label, name: t.name }));
        // OPPOSITION (spec.opposed) résolue dans la modale : une cible qui l'a emporté RÉSISTE (aucune
        // op) ; sinon les ops portent sur la MARGE de DR (l'écart de l'opposition → échelles `perSL`).
        const opp = extras?.opposedOutcome?.[t.id];
        if (opp?.resisted) { logLines.push(tr('cf.spellResisted', { name: t.name, spell: spell.label })); continue; }
        // Manifestation de Ghur (Middenheim, #18) : un Sort du Domaine de la Bête n'applique aucun de ses
        // effets au porteur (immunité par lore — `spellDomainImmunity`, lue par id depuis ses Traits).
        if (immuneToSpellDomain(t.traits, spell.domainId)) { logLines.push(tr('cf.spellDomainImmune', { name: t.name, spell: spell.label })); continue; }
        logLines.push(
          // Tout sort passe par le système Flow/EffectOp : `spell.effects` (Flow éditable, feuilles
          // `on:'target'`) → `runCombatFlow` (exécuteur unique, after-aware) → applyOps. Les feuilles
          // `on:'caster'` sont appliquées à part.
          ...runCastFlow(get, set, t, caster, spellFlowFor(spell.effects, 'target'), {
            rng: battleRng(),
            caster,
            label: spell.label,
            now: get().gameTime,
            sl: opp ? opp.margin : res.sl,
            ...(rounds != null ? { defaultDurationRounds: rounds } : {}),
            ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
            ...(sourceSpell ? { sourceSpell } : {}), sourceSpellId,
            ...(extras?.conjureForm ? { conjureForm: extras.conjureForm } : {}),
            onCorruption: followsCharacterRules(t) ? (n, align) => gainCorruption(get, set, t, n, align) : undefined, // #143 : personnage, pas un proxy `kind`
          }),
        );
        // Métamorphose (Forme bestiale, LDB 48) : op `polymorph` du Flow (on:'target') — appliquée
        // ci-dessus par runCastFlow → applyOps (expansion charMod différentiel + grantTrait via
        // engine/polymorph, auto-restitués à l'expiration). Plus de site dédié.
      }
      // POUSSÉE (Jalon 2.6 — « Toutes les créatures à BFM mètres sont repoussées de BFM
      // mètres », LDB 47 p.244) : recul en ligne (direction lanceur→cible) jusqu'à
      // l'obstacle ; la collision est journalisée (Dégâts = distance restante, MJ).
      for (const op of spellOps(spell.effects, 'caster')) {
        if (op.op !== 'push' || !battle || !caster.pos) continue;
        const pushTiles = Math.max(1, Math.floor(resolveFormula(op.meters, caster, battleRng()) / 2));
        for (const t of [target, ...extraTargets]) {
          if (t.id === caster.id || !t.pos || isOutOfAction(t)) continue;
          const r = pushAway(get().scene!, caster.pos, t.pos, pushTiles, { blocked: occupied(battle, t) });
          if (r.pushed > 0) {
            const fromPos = { ...t.pos };
            placeCombatant(t, get().scene, r.dest);
            bus.emit(EVT.ANIM_MOVE, { id: t.id, path: [{ ...r.dest }] });
            logLines.push(tr('cf.pushed', { name: t.name, m: r.pushed * 2 }));
            applyZoneCrossings(get, t, [...tilesBetween(fromPos, r.dest), { ...r.dest }]); // une poussée TRAVERSE (Mur de feu, L11)
          }
          if (r.collided) logLines.push(tr('cf.collided', { name: t.name }));
        }
      }
      // Sort « Souffle » (LDB 47 p.244) : « comme si vous aviez dépensé 2 Avantages pour activer
      // le Trait Souffle » — délégué à l'attaque de ZONE du Trait, centrée sur la CIBLE du sort,
      // Dégâts = Bonus d'Endurance du lanceur, Type mappé du Domaine. Sans coût d'Avantage (le
      // sort EST l'activation). Hors combat : pas de grille → journalisé.
      if (spec.breathAttack) {
        if (battle && caster.pos) {
          const type = domainBreathType(caster);
          // Manœuvre Souffle de 1ʳᵉ classe (données) choisie par le Type du Domaine ; défaut `souffle-feu`.
          // Indice = Bonus d'Endurance du lanceur (RAW : « Dégâts = Bonus d'Endurance »). Coût d'Avantage 0
          // (le sort EST l'activation).
          const sDef = (type && findManeuverById(`souffle-${norm(type)}`)) || findManeuverById('souffle-feu')!;
          const indice = bonus(effectiveChar(caster, 'E'));
          applyAreaAttack(get, set, caster, {
            kind: 'souffle', label: sDef.label, bonus: indice, indice, def: sDef,
            trigger: 'free', avantage: 0, aoe: true, magic: true, ...(type ? { type } : {}),
          }, target);
          if (!type) logLines.push(tr('cf.breathNoType'));
        } else {
          logLines.push(tr('cf.breathNarrative', { name: caster.name }));
        }
      }
      // Zone persistante d'un sort de soutien/zone (Mur de feu : « Quiconque traverse… »).
      if (res.cast) placeSpellZone(get, caster, target, spell, spec, res.sl, durationMult, logLines);
      // TÉLÉPORTATION (Jalon 2.6 — « vous vous téléportez de BFM mètres (+BFM par +2 DR) »,
      // LDB 47 p.245) : le choix de la case d'arrivée suit l'Appliquer (mode 'teleport',
      // cases = survol des obstacles, atterrissage libre — battleClickTile).
      const tpOp = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'teleport' }> => o.op === 'teleport');
      if (tpOp && res.cast) {
        let meters = Math.max(0, resolveFormula(tpOp.meters, caster, battleRng()));
        if (tpOp.perSL) {
          meters += Math.floor(Math.max(0, res.sl) / Math.max(1, tpOp.perSL.every))
            * Math.max(0, resolveFormula(tpOp.perSL.metersFormula, caster, battleRng()));
        }
        if (battle && caster.pos) {
          const tpTiles = Math.max(1, Math.floor(meters / 2));
          teleportReach = flyReachable(get().scene!, caster.pos, tpTiles, moveEnv(battle, caster));
          logLines.push(tr('cf.teleportChoose', { name: caster.name, m: meters }));
        } else {
          logLines.push(tr('cf.teleportFree', { name: caster.name, m: meters }));
        }
      }
    } else if (res.isFumble) {
      // Prière → Colère des dieux ; Sort → Incantation Imparfaite Mineure (subsumée par la Règle du 8 sur « 88 »).
      if (castInfoIsPrayer(spell)) logLines.push(...applyMiscast(get, set, caster, 'colere', { componentDowngrade: componentUsed }));
      else if (!ruleOfEightHandled) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery }));
    } else if (focusedNI0 && !ruleOfEightHandled) {
      // Sort focalisé dont l'incantation échoue (sans Maladresse) → Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery }));
    }
    applyExtraMiscast(); // Règle du 8 / Sorcellerie (LDB 46 l.89 / LDB 49)
    // Sort de SOUTIEN (bénédiction/soin/buff) ou prière non-projectile : émet aussi l'event
    // d'incantation → geste de canalisation (RigToken) + halo/aura tinté à l'école (IsoStage).
    // Soutien : le lanceur se tourne vers la cible ; pas de réaction de la cible (ce n'est pas une frappe).
    // Hors combat (pas de file/token tactique), on n'anime pas le geste iso.
    if (battle && caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!) } }));
    }
    if (battle) bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  }

  // Attributs de Domaine (LDB 48 — L14) : riders post-lancement d'un Sort « issu du Domaine ».
  if (res.cast) {
    for (const t of [target, ...extraTargets]) {
      // Une cible qui a EMPORTÉ l'opposition (spec.opposed) résiste au Sort entier : pas de rider de Domaine.
      if (extras?.opposedOutcome?.[t.id]?.resisted) continue;
      // Riders « à la touche » du Domaine = DONNÉE (`domains.json`), dispatchés comme les autres onHit ;
      // le gating « cible adverse / vivante / résiste par Talent » vit dans les Conditions Flow.
      logLines.push(...applyTriggeredEffects(get, caster, domainOnHitEffects(spell), 'onHit', { victim: t, rng: battleRng(), set }));
    }
    // (L'arc de zone des Cieux/Azyr est un `effects` AUTHORÉ du domaine — ciblage `on:{near:'victim'}` +
    //  op `wounds bypassArmour:'metal'` — dispatché par le `domainOnHitEffects` ci-dessus, plus de code dédié.)
    // Ops post-incantation au LANCEUR (Bête → Peur 1) — paramètre en données (DomainData.casterOps).
    logLines.push(...domainCasterOps(caster, spell, battleRng()));
    // Effets sur le LANCEUR (op casterOps — Vol de vie « retirez tout État Exténué dont vous
    // souffrez », buffs de soi d'un sort offensif) : appliqués une seule fois par lancement.
    const castSpec = spell;
    // INVOCATION (op `summon` du Flow éditable — Nécromancie, Hurlement du loup, Manifestation de démon,
    // Roi de la Nature…) : la/les créature(s) entrent en combat près du lanceur et se dissipent à
    // l'expiration (state/summonFlow). Effet IMPUR du Flow résolu ici (grille/initiative) ; les feuilles
    // `on:'caster'` sont par ailleurs jouées par runCastFlow (où `summon` reste inerte → pas de doublon).
    const sumRounds = castSpec.duration?.kind === 'rounds' ? resolveFormula(castSpec.duration.value, caster, battleRng()) : null;
    for (const sOp of spellOps(spell.effects, 'caster')) {
      if (sOp.op !== 'summon') continue;
      logLines.push(...applySummon(get, set, caster, sOp, { sl: res.sl, rounds: sumRounds, label: spell.label, rng: battleRng(), spellId: spell.id }));
    }
    // Effets sur le LANCEUR (feuilles `on:'caster'` de `spell.effects` — Vol de vie « retirez tout État
    // Exténué dont vous souffrez », buffs de soi d'un sort offensif) : appliqués UNE seule fois par lancement.
    if (spellOps(spell.effects, 'caster').length) {
      const baseRounds = castSpec.duration?.kind === 'rounds' ? resolveFormula(castSpec.duration.value, caster, battleRng()) : null;
      const clockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      logLines.push(...runCastFlow(get, set, caster, caster, spellFlowFor(spell.effects, 'caster'), {
        rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: res.sl,
        ...(baseRounds != null ? { defaultDurationRounds: baseRounds } : {}),
        ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
        ...(sourceSpell ? { sourceSpell } : {}), sourceSpellId,
        onCorruption: followsCharacterRules(caster) ? (n, align) => gainCorruption(get, set, caster, n, align) : undefined, // #143 : personnage, pas un proxy `kind`
      }));
    }
  }

  // Péché et Colère Divine (LDB 40 l.44-45) : à CHAQUE Test de Prière, si le dé des
  // unités ≤ Points de Péché → Colère des dieux, MÊME si le Test est réussi (la
  // Maladresse, elle, a déjà déclenché la sienne ci-dessus).
  if (castInfoIsPrayer(spell) && !res.isFumble && res.roll > 0 && prayerWrathTriggered(res.roll, caster.sinPoints ?? 0)) {
    logLines.push(tr('cf.wrathTriggered', { units: res.roll % 10, name: caster.name, sin: String(caster.sinPoints) }));
    logLines.push(...applyMiscast(get, set, caster, 'colere'));
  }

  // Le sort focalisé est consommé après le lancement.
  if (focusedNI0) caster.focus = undefined;
  finishPlayerAction(get, set, logLines, 'cast'); // sortie commune combat (log+conso Action) / hors combat (journal)
  // Téléportation (Jalon 2.6) : le choix de case suit la clôture du cast (qui remet action: null).
  if (teleportReach && get().battle) {
    set({ battle: { ...get().battle!, action: 'teleport', reachable: teleportReach } });
    bus.emit(EVT.SCENE_DIRTY);
  }
}

/** Renvoie vrai si le sort relève d'une Prière (Béni/Invocation) — discriminant STABLE `family`. */
export function castInfoIsPrayer(spell: SpellLike): boolean {
  return spell.family === 'beni' || spell.family === 'invocation';
}

/** Pose la ZONE PERSISTANTE d'un sort (op `zone` du Flow, on:'caster' — L11 Mur de feu : mur
 *  perpendiculaire à l'axe lanceur→cible centré sur la cible ; Grands feux : disque autour de la
 *  cible). Durée = celle du sort (`duration.kind==='rounds'` × Surincantation), formules résolues contre
 *  le LANCEUR. Effet IMPUR du Flow résolu ici (grille) ; hors combat : narratif. */
function placeSpellZone(
  get: Get,
  caster: Combatant,
  target: Combatant,
  spell: { label: string; effects?: Flow; duration?: import('../engine/spellDuration').SpellDuration | null; target?: import('../engine/spellRange').SpellTarget | null },
  _spec: unknown,
  sl: number,
  durationMult: number,
  logLines: string[],
): void {
  const pz = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'zone' }> => o.op === 'zone');
  if (!pz) return;
  const baseRounds = spell.duration?.kind === 'rounds' ? resolveFormula(spell.duration.value, caster, battleRng()) : 1;
  const rounds = Math.max(1, baseRounds * Math.max(1, durationMult));
  // Rayon par défaut (si l'op n'a pas de `radiusMeters`) : dérivé de la `target` du sort (« Zone Diamètre
  // BFM m » → rayon BFM/2). Protection de Phâ : Zone centrée sur le lanceur (range self).
  placeZoneFromOp(get, caster, target, pz, spell.label, rounds, sl, (zdeDiameterMeters(spell.target, caster) ?? 4) / 2, logLines);
}

/** Pose une ZONE persistante depuis un op `zone` (op-based, réutilisable HORS sort : effets déclenchés —
 *  zone laissée à la mort/touche…). `label`/`rounds`/`fallbackRadiusM` sont fournis par l'appelant (un
 *  sort les tire de sa durée/ZdE ; un trigger fournit des défauts). `target.pos` = centre du disque. */
function placeZoneFromOp(get: Get, caster: Combatant, target: Combatant, pz: Extract<GameOp, { op: 'zone' }>, label: string, rounds: number, sl: number, fallbackRadiusM: number, logLines: string[]): void {
  const battle = get().battle;
  if (!battle || !target.pos || !caster.pos) { logLines.push(tr('cf.zonePersists', { spell: label })); return; }
  const discRadiusM = pz.radiusMeters != null ? Math.max(0, resolveFormula(pz.radiusMeters, caster, battleRng())) : fallbackRadiusM;
  const tiles = pz.shape === 'wall'
    ? wallTiles(caster.pos, target.pos, metersToTiles(resolveZoneMeters(pz.lengthMeters ?? 2, pz.lengthPerSL, caster, sl, battleRng())))
    : discTiles(target.pos, metersToTiles(discRadiusM));
  const zone: BattleZone = {
    label, tiles, rounds, casterId: caster.id,
    ...(pz.blocksLoS ? { blocksLoS: true } : {}),
    ...(pz.onCross ? { onCross: pz.onCross } : {}),
    ...(pz.perRound ? { perRound: pz.perRound } : {}),
    ...(pz.barrier ? { barrier: {} } : {}),
    ...(pz.gate ? { gate: pz.gate } : {}),
    ...(pz.noCorruption ? { noCorruption: true } : {}),
  };
  battle.zones = [...(battle.zones ?? []), zone];
  logLines.push(tr('cf.zonePersistsRounds', { spell: label, rounds }));
  bus.emit(EVT.ANIM_AOE, { tiles, kind: 'spell' });
}

/** Résout les ops IMPURES (grille/initiative) d'un déclencheur — GÉNÉRIQUE, pas limité à summon : un
 *  effet de DONNÉE déclenché (Trait/Talent/Atout) qui invoque (Charnier : 3d10 Zombies à la mort) ou
 *  pose une zone est résolu ICI, comme au lancement d'un sort. `summon`/`zone` sont inertes dans
 *  `applyOps` (moteur pur) ; on les moissonne (`triggerEffectOps`) et on les dispatche vers leur
 *  résolveur state (applySummon / placeZoneFromOp). Les autres impures (grantFreeAttack, interruptFocus,
 *  breakBlade) fonctionnent déjà dans leur propre contexte (frappe gratuite / réactions de combat). */
export function resolveTriggerImpureOps(get: Get, set: SetFn, actor: Combatant, trigger: EffectTrigger): string[] {
  const lines: string[] = [];
  for (const op of triggerEffectOps(actor, trigger)) {
    if (op.op === 'summon') lines.push(...applySummon(get, set, actor, op, { rng: battleRng() }));
    else if (op.op === 'scheduleRespawn') lines.push(...scheduleRespawnFromOp(get, set, actor, op));
    else if (op.op === 'zone') placeZoneFromOp(get, actor, actor, op, actor.name, op.perRound ? 3 : 1, 0, 2, lines);
  }
  return lines;
}

/** RECONSTITUTION DIFFÉRÉE (op `scheduleRespawn`, Gardien éternel — Bestiaire de Middenheim) : à la mort du
 *  porteur, PROGRAMME (file `scheduledEffects`, horloge) la ré-invocation de la créature à `gameTime + d10
 *  jours`. Le délai `delayDays` est ROULÉ ici (`battleRng`, donc déterministe en test) ; `ref:'self'` se
 *  résout au `creatureId` du défunt (repli sur son nom). Un INSTANTANÉ minimal du défunt (id/name/kind/pos)
 *  sert de lanceur à `applySummon` au déclenchement. Le `cancelFlag` (précautions) reste désamorçable par un
 *  Effet de scène. Sans position (hors grille) : pas de point de reconstitution → no-op. */
function scheduleRespawnFromOp(
  get: Get, set: SetFn, actor: Combatant, op: Extract<GameOp, { op: 'scheduleRespawn' }>,
): string[] {
  if (!actor.pos) return [];
  const days = Math.max(1, resolveFormula(op.delayDays, actor, battleRng()));
  const count = Math.max(1, resolveFormula(op.count ?? 1, actor, battleRng()));
  const ref = op.ref === 'self' ? (actor.creatureId ?? actor.name) : op.ref;
  const respawn: ScheduledRespawn = {
    caster: { id: actor.id, name: actor.name, kind: actor.kind, pos: { ...actor.pos } },
    summon: { ref, count, allyOfCaster: op.allyOfCaster },
  };
  set((s: GameState) => ({ scheduledEffects: [...s.scheduledEffects, { executeAt: s.gameTime + days * MINUTES_PER_DAY, cancelFlag: op.cancelFlag, respawn }] }));
  return [`${actor.name} est terrassé… mais sa Source le reconstituera dans ${days} jour${days > 1 ? 's' : ''}.`];
}

/** Type de Souffle « correspondant le mieux » au Domaine du lanceur (sort Souffle, LDB 47 p.244 :
 *  « Le MJ détermine quel type d'attaque de Souffle correspond le mieux à votre Talent Magie des
 *  Arcanes ») — jeu sans MJ : seuls les Domaines au Type canonique évident sont mappés
 *  (Feu→Feu, Cieux→Électricité, Métal→Corrosif, Ombres→Fumée) ; les autres soufflent des Dégâts purs. */
function domainBreathType(caster: Combatant): string | undefined {
  return findDomainById(arcaneDomainIdOf(caster))?.breathType;
}

/** Bonus d'incantation CONDITIONNEL du Domaine (Aqshy l.157 : +`bonus` par État `perCondition` situé à
 *  `radiusStat` m du lanceur) — PARAMÈTRE en données (`DomainData.castBonus`) ; géométrie résolue ici. */
export function domainCastBonus(s: GameState, caster: Combatant, spell: { domainId?: string | null }): number {
  const cb = findDomainById(spell.domainId)?.castBonus;
  if (!cb || !caster.pos) return 0;
  const radius = Math.max(1, Math.ceil(bonus(effectiveChar(caster, cb.radiusStat)) / 2));
  let pions = 0;
  for (const c of s.battle?.combatants ?? []) {
    if (!c.pos || isOutOfAction(c)) continue;
    if (combatDistance(caster, c) <= radius) pions += stacks(c, cb.perCondition);
  }
  return cb.bonus * pions;
}

/** Le lanceur est-il « à proximité d'une Influence corruptrice » (LDB 46 l.89 / page 182) ? Data-driven :
 *  soit le lieu est marqué corrompu (flag de scène/campagne `corruption`, posé par un Effet setFlag de
 *  l'éditeur — décision D1), soit un combattant présent rayonne la Corruption (Trait `corruption`, réutilise
 *  `worstCorruptionExposure`). Consommé par la Règle du 8 (`applyCast`). */
export function castNearCorruption(get: Get): boolean {
  if (get().flags['corruption']) return true;
  const battle = get().battle;
  return !!battle && !!worstCorruptionExposure(battle);
}

/** « N'écoutez point la Sorcière » (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou
 *  quelqu'un dans les (BSoc) mètres subissent une pénalité de -20 aux Tests de Langue (Magick),
 *  en plus de toute autre pénalité. » — −20 si la CIBLE du Sort est dans le rayon d'un porteur
 *  de l'aura (`ActiveEffect.castWard`) encore en état de combattre. Sorts seulement (les Prières
 *  passent par Prière, pas Langue). Une fois, même sous plusieurs auras (toutes à −20). Hors
 *  combat (pas de géométrie), l'aura ne s'applique pas — limitation documentée. */
export function castWardPenalty(s: GameState, target: Combatant, spell: SpellLike): number {
  if (castInfoIsPrayer(spell)) return 0;
  if (!target.pos) return 0;
  const warded = (s.battle?.combatants ?? []).some(
    (w) => !isOutOfAction(w) && w.pos && (w.activeEffects ?? []).some(
      (e) => e.castWard && combatDistance(w, target) <= Math.max(1, Math.ceil(e.castWard.radiusMeters / 2)),
    ),
  );
  return warded ? -20 : 0;
}

/** Un Test de Contraction de fin de combat DÛ pour un héros (LDB 18/20) : la maladie, sa difficulté de
 *  Résistance (les crans de l'exposition — Contagieux : 2 plus difficile — DÉJÀ appliqués) et le libellé
 *  d'exposition. `instant` (Contagieux, EDO App.2 l.230) : contractée → incubation « Instantanée ».
 *  Le `resistVal` (Résistance effective) est figé à la décision. */
interface CombatEndDiseaseTest { disease: string; difficulty: Difficulty; label: string; instant?: boolean }

/** Valeur de Résistance d'un héros pour les Tests de Contraction (E + avances de Résistance) — figée à la
 *  décision pour rester stable entre la pose de l'étape et sa résolution. */
function combatEndResistVal(c: Combatant): number {
  return effectiveChar(c, 'E') + (c.skills?.find((s) => s.skillId === 'resistance')?.advances ?? 0);
}

/**
 * DÉCIDE et CONSOMME les Tests de fin de combat DUS pour le PERSONNAGE `c` (héros, ou combattant flagué
 * #143 `followsCharacterRules` — LDB 18 l.382/20 l.72/20 l.32-49 + LDB 19 Corruption) — SOURCE UNIQUE de
 * la décision : les marqueurs (`tookCriticalThisFight`/`woundDressed`/`diseaseExposure`) sont purgés ICI
 * (idempotent). Retourne la LISTE des Tests de Contraction de maladie dus + le NIVEAU d'exposition à la
 * Corruption (worst des créatures affrontées), ou `null` pour la Corruption si aucune. PUR de RNG (aucun
 * jet) : le jet vit dans l'étape de cascade (manuel) OU dans la résolution inline (non-interactif).
 */
function decideCombatEndHeroTests(
  c: Combatant, worstCorruption: import('../engine/corruption').ExposureLevel | null,
): { diseases: CombatEndDiseaseTest[]; corruption: import('../engine/corruption').ExposureLevel | null } {
  const dm = rule('disease-mode') as string;
  const diseases: CombatEndDiseaseTest[] = [];
  // Infection Mineure post-critique (LDB 20 l.72) : Résistance Très Facile (+60) — sauf blessure PANSÉE
  // (LDB 18 l.382). Règle « Utilisation des Maladies » : seul 'full' (RAW) applique l'Infection Mineure.
  if (c.tookCriticalThisFight) {
    const dressed = c.woundDressed;
    if (!c.dead && !dressed && dm === 'full' && contractionDue(c, 'infection-mineure'))
      diseases.push({ disease: 'infection-mineure', difficulty: 'tresFacile', label: 'Infection (Blessure critique)' });
  }
  c.tookCriticalThisFight = false; // consommé (idempotent)
  c.woundDressed = false;
  // Exposition aux Maladies (LDB 20 l.32/49 ; LDB 85 p.340) — SOURCE UNIQUE `diseaseExposure` (Infecté/
  // Rongeur/Maladie/munition/Contagieux exposent via l'op `exposeDisease`). Difficulté = celle de la
  // maladie (`def.contractDifficulty`), décalée des crans de l'exposition (Contagieux, EDO App.2
  // l.228-230 : « 2 niveaux plus difficile » → shift −2 ; « incubation “Instantanée” » → `instant`).
  // 'off' : aucune contraction.
  if (dm !== 'off' && !c.dead) {
    for (const exp of c.diseaseExposure ?? []) {
      const def = DISEASE_DEFS[exp.disease];
      if (def && contractionDue(c, def.id)) diseases.push({
        disease: def.id,
        difficulty: easeDifficulty(def.contractDifficulty, exp.difficultyShift ?? 0),
        label: `Contagion (${diseaseLabel(def.id)})`,
        ...(exp.instant ? { instant: true } : {}),
      });
    }
  }
  c.diseaseExposure = undefined;
  return { diseases, corruption: c.dead ? null : worstCorruption };
}

/** Pire Degré d'EXPOSITION à la Corruption des créatures affrontées (LDB 85 p.338 → LDB 19) — `null`
 *  si aucune créature corrompue. Le niveau s'applique à TOUS les héros survivants (avoir affronté). */
function worstCorruptionExposure(battle: BattleState): { level: import('../engine/corruption').ExposureLevel; label: string } | null {
  const degrees = battle.combatants
    .filter((c) => c.kind !== 'hero')
    .flatMap((c) => (c.traits ?? []).filter((t) => t.id === 'corruption').map((t) => t.arg).filter(Boolean));
  if (!degrees.length) return null;
  const rank = { mineure: 0, modérée: 1, majeure: 2 } as Record<string, number>;
  const worst = degrees.reduce((a, b) => (rank[b!.toLowerCase()] > rank[a!.toLowerCase()] ? b : a))!;
  const level = worst.toLowerCase() === 'majeure' ? 'majeure' : worst.toLowerCase() === 'modérée' ? 'moderee' : 'mineure';
  return { level, label: worst };
}

/** Résout INLINE (jet silencieux + conséquence) les Tests de fin de combat d'un PERSONNAGE NON-INTERACTIF
 *  (héros auto, ou PNJ #143 flagué `followsCharacterRules`, ou cible hors d'action / défaite) — même
 *  conséquence que les appliers de cascade, lignes au journal. Le worst d'exposition à la Corruption est passé (figé). */
function resolveCombatEndHeroTestsInline(
  get: Get, set: SetFn, c: Combatant,
  corr: { level: import('../engine/corruption').ExposureLevel; label: string } | null,
): string[] {
  const lines: string[] = [];
  const decided = decideCombatEndHeroTests(c, corr?.level ?? null);
  const resVal = combatEndResistVal(c);
  for (const d of decided.diseases) {
    const t = rollTest(resVal, d.difficulty, battleRng());
    lines.push(...applyContraction(c, d.disease, t.success, battleRng(), d.instant ? { instant: true } : undefined));
  }
  if (decided.corruption && corr) {
    const t = rollTest(testValue(c, 'resistance'), 'intermediaire', battleRng());
    const gain = corruptionGain(decided.corruption, t.success, Math.max(0, t.sl));
    lines.push(tr('cf.corruptionExposure', { name: c.name, label: corr.label, roll: t.roll, target: t.target, gain: gain ? '' : tr('cf.fragResists') }));
    if (gain > 0) lines.push(...gainCorruption(get, set, c, gain));
  }
  return lines;
}

/**
 * CASCADE de fin de combat (LDB 18/19/20) — extrait les JETS de PERSONNAGE de fin de combat de
 * `finalizeBattle` pour les rendre cadence-aware AVANT l'écran de victoire. Pour chaque PERSONNAGE
 * vivant (héros, ou combattant flagué #143 `followsCharacterRules` — PAS un proxy `kind`) :
 *  - INTERACTIF (cadence MANUELLE, conscient) → étapes INFLUENÇABLES (`combatEndDisease` par
 *    maladie, `combatEndCorruption` si exposition) — Chance/Résilience offertes, conséquence à la validation.
 *  - sinon (auto/rapide, ou hors d'action — défaite) → jet SILENCIEUX inline (journal), comme avant.
 * Les marqueurs sont CONSOMMÉS ici (source unique). La cascade ouverte porte `combatEndBoundary:true` :
 * à sa fermeture, le store enchaîne sur `finishCombatEnd` (writeback + écran de victoire). RNG-free pour
 * les personnages interactifs (le jet vit dans l'étape) ; les non-interactifs consomment `battleRng` inline.
 */
export function openCombatEndCascade(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle) return;
  const corr = worstCorruptionExposure(battle);
  const steps: import('./pendings').CascadeStep[] = [];
  const inlineLines: string[] = [];
  for (const c of battle.combatants) {
    if (!followsCharacterRules(c) || c.dead) continue; // #143 : RAW « Personnage » (LDB 18 l.5, LDB 20 l.14/206) — les créatures génériques et les défaits n'ont pas de jet de maladie/Corruption de fin de combat
    // Pas piloté-humain-manuel (auto/rapide) OU hors d'action (Inconscient — défaite) → jet inline silencieux.
    if (!humanControlled(get(), c) || isOutOfAction(c)) { inlineLines.push(...resolveCombatEndHeroTestsInline(get, set, c, corr)); continue; }
    const decided = decideCombatEndHeroTests(c, corr?.level ?? null);
    const resVal = combatEndResistVal(c);
    for (const d of decided.diseases) {
      steps.push({
        id: `combatEndDisease-${c.id}-${d.disease}`, kind: 'combatEndDisease', actorId: c.id, icon: 'medical/infection',
        rollLabel: 'Résistance', base: resVal, target: resVal + DIFFICULTY_MODIFIERS[d.difficulty] + combatTestPenalty(c),
        label: d.label, meta: { disease: d.disease, ...(d.instant ? { instant: true } : {}) },
        menace: 'maladie', // Test de Contraction = « résister à la Maladie » (Résistance (Menace), LDB 10)
      });
    }
    if (decided.corruption && corr) {
      const res = testValue(c, 'resistance');
      steps.push({
        id: `combatEndCorruption-${c.id}`, kind: 'combatEndCorruption', actorId: c.id, icon: 'nav/mutation',
        rollLabel: 'Résistance', base: res, target: res + DIFFICULTY_MODIFIERS.intermediaire + combatTestPenalty(c),
        label: `Exposition à la Corruption (${corr.label})`, meta: { level: corr.level, exposureLabel: corr.label },
        menace: 'corruption', // Test d'Exposition = « résister à la Corruption » (Résistance (Menace), LDB 10)
      });
    }
  }
  if (inlineLines.length) set({ journal: [...get().journal.slice(-40), ...inlineLines] });
  if (steps.length) startCascade(get, set, { title: 'Conséquences du combat', icon: 'condition/bleeding', purpose: 'combat', steps, combatEndBoundary: true });
}

/** Applier d'une étape `combatEndDisease` (LDB 18/20) : Test de Résistance RÉSOLU → échec = contracte la
 *  maladie (`applyContraction`). Lit `step.result` (posé par `FLOWS.cascade`) + `step.meta.disease`. */
registerCascadeApplier('combatEndDisease', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const disease = typeof step.meta?.disease === 'string' ? step.meta.disease : undefined;
  if (!disease) return;
  const lines = applyContraction(hero, disease, step.result.success, battleRng(), step.meta?.instant === true ? { instant: true } : undefined);
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
  return { journal: lines.length ? lines : [tr('cf.resistsInfection', { name: hero.name })] };
});

/** Applier d'une étape `combatEndCorruption` (LDB 19) : Test de Résistance RÉSOLU → `corruptionGain` selon
 *  le niveau et le DR, puis `gainCorruption` (seuil/mutation via sa propre modale). */
registerCascadeApplier('combatEndCorruption', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const level = step.meta?.level as import('../engine/corruption').ExposureLevel | undefined;
  const label = typeof step.meta?.exposureLabel === 'string' ? step.meta.exposureLabel : '';
  if (!level) return;
  const gain = corruptionGain(level, step.result.success, Math.max(0, step.result.sl));
  const lines = [tr('cf.corruptionExposure', { name: hero.name, label, roll: step.result.roll, target: step.result.target, gain: gain ? '' : tr('cf.fragResists') })];
  if (gain > 0) lines.push(...gainCorruption(get, set, hero, gain));
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
  return { journal: lines };
});

/** Ouvre une cascade INFLUENÇABLE à UNE étape de Contraction de maladie pour `patient` (Test de Résistance
 *  `difficulty` → `applyContraction` à la validation, via l'applier `combatEndDisease`) — HORS combat.
 *  Réutilisé par la Chirurgie (infection post-opératoire, LDB 10 l.365) : Chance/Résilience + auto-succès
 *  Résistance (Menace : Maladie) offerts, jamais un jet silencieux. `combatEndResistVal` fige la Résistance. */
export function openContractionCascade(get: Get, set: SetFn, patient: Combatant, disease: string, difficulty: Difficulty, title: string): void {
  const resVal = combatEndResistVal(patient);
  startCascade(get, set, {
    title, icon: 'condition/bleeding', purpose: 'test',
    steps: [{
      id: `infection-${patient.id}-${disease}`, kind: 'combatEndDisease', actorId: patient.id, icon: 'medical/infection',
      rollLabel: 'Résistance', base: resVal, target: resVal + DIFFICULTY_MODIFIERS[difficulty],
      label: title, result: null, interactive: true, meta: { disease }, menace: 'maladie',
    }],
  });
}

/** Fin de combat : réécrit l'état persistant de chaque héros (Blessures, critiques, mort, États
 *  persistants) vers `party`. Idempotent ; les champs non persistants du membre party sont conservés.
 *  Les JETS HÉROS de fin de combat (maladie/Corruption) sont résolus AVANT (cascade `openCombatEndCascade`
 *  ou inline) — ici, on ne fait QUE le writeback (les marqueurs ont déjà été consommés). */
export function finalizeBattle(get: Get, set: SetFn): void {
  const { battle, party } = get();
  if (!battle) return;
  // Effets « fin de combat » authorés de chaque combattant survivant (inerte tant qu'aucune donnée ne
  // porte un effet `onCombatEnd`) → collectés dans le journal de fin de combat.
  const endLines: string[] = [];
  emitCombatEvent('onCombatEnd', {
    get, set, battle, sink: (line) => endLines.push(line),
    audience: battle.combatants.filter((c) => !isOutOfAction(c)),
    triggerCtx: { rng: battleRng() },
  });
  const newParty = party.map((h) => {
    const c = battle.combatants.find((x) => x.id === h.id && x.kind === 'hero');
    return c ? { ...h, ...carryOverState(c) } : h;
  });
  set({ party: newParty, ...(endLines.length ? { journal: [...get().journal.slice(-40), ...endLines] } : {}) });
  // #30 — Blessures de COQUE persistantes : si une coque du combat EST le navire de campagne
  // (creatureId = vehicleId), son état de fin de combat est écrit sur `CampaignVessel.wounds`
  // (le voyage maritime et les réparations au port en repartent).
  const vessel = get().vessel;
  const hull = vessel ? battle.combatants.find((c) => c.creatureId === vessel.vehicleId) : undefined;
  if (vessel && hull) set({ vessel: { ...vessel, wounds: { current: hull.wounds.current, max: hull.wounds.max } } });
  // Réconciliation de la scène : tout combattant ISSU d'une entité de scène (identité unifiée,
  // Combatant.id === SceneEntity.id) et hors d'action quitte la scène. Victoire → les ennemis sont tous
  // hors d'action = retirés ; défaite → ennemis vivants = conservés ; les héros du groupe ne sont jamais
  // des entités de scène (jamais touchés). Hook futur : fuite hors-carte, morts persistants.
  const scene = get().scene;
  if (scene) {
    const entIds = new Set(scene.entities.map((e) => e.id));
    const fallen = battle.combatants.filter((c) => entIds.has(c.id) && isOutOfAction(c)).map((c) => c.id);
    if (fallen.length) removeEntities(get, set, fallen);
  }
}

export function checkBattleOver(get: Get, set: SetFn): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return true;
  // Combat monté (LDB 14 l.212-225) : une monture mise hors de combat désarçonne son cavalier (strict
  // RAW : à pied, pas de chute). Balayage centralisé ici car checkBattleOver suit chaque résolution de combat.
  const scene = get().scene;
  if (scene) {
    const dismounted = sweepDismountDeaths(battle, scene);
    if (dismounted.length) {
      set({ battle: { ...battle, log: [...battle.log, ...evLines(dismounted, 'detail')] } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  // Navires comme UNITÉS (MDG ch.13-14) : une coque COULÉE emporte son équipage par-dessus bord, une coque
  // sans équipage en état est PRISE et sort du combat — les deux voies de victoire navale (naufrage OU
  // abordage) convergent ici (kind-agnostique, sweep centralisé comme le désarçonnement ci-dessus).
  const navalResolved = resolveShipUnits(battle.combatants);
  if (navalResolved.length) {
    set({ battle: { ...battle, log: [...battle.log, ...evLines(navalResolved, 'detail')] } });
    bus.emit(EVT.SCENE_DIRTY);
  }
  // Un engin INERTE (affût servi, immune) ne compte JAMAIS comme un combattant vivant — ni côté allié
  // (`kind:'hero'`) ni côté ennemi : la victoire/défaite se joue sur les créatures (l'équipage), pas l'objet.
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !c.inert && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !c.inert && !isOutOfAction(c));
  if (!enemiesAlive) {
    // Tests de fin de combat des héros survivants (maladie/Corruption) AVANT l'écran de victoire (décision
    // utilisateur) : cadence-aware (héros manuel → cascade influençable). Si une cascade s'ouvre, on DIFFÈRE
    // la victoire — sa fermeture (`combatEndBoundary`) enchaîne sur `finishCombatEnd`/`finishVictory`.
    openCombatEndCascade(get, set);
    if (get().pendingCascade?.combatEndBoundary) return true; // l'écran de victoire suit la cascade
    finishVictory(get, set);
    return true;
  }
  if (!heroesAlive) {
    // Défaite : tous les héros hors d'action → les Tests de fin de combat se résolvent inline (aucun héros
    // interactif → pas de cascade), puis writeback. Pas d'écran de victoire à gater.
    openCombatEndCascade(get, set);
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, ev('info', tr('cf.defeat'))] } });
    return true;
  }
  return false;
}

/**
 * Finalisation de la VICTOIRE : writeback (`finalizeBattle`) PUIS pose de `over:'victory'` + capture des
 * récompenses dans `pendingVictory` (l'écran de victoire les lit). Appelée DIRECTEMENT par `checkBattleOver`
 * quand aucun Test de fin de combat n'est influençable, OU par `finishCombatEnd` à la fermeture de la
 * cascade de fin de combat. Idempotente vis-à-vis d'un `battle.over` déjà posé (garde en tête).
 */
export function finishVictory(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  finalizeBattle(get, set); // writeback AVANT onVictory (qui ajoute XP/butin au groupe)
  set({ battle: { ...get().battle!, over: 'victory', log: [...get().battle!.log, ev('info', tr('cf.victory'))] } });
  bus.emit(EVT.BATTLE_OVER, { victory: true }); // gong audio + hooks futurs
  // Capture des récompenses pour l'écran de victoire : on mesure ce que onVictory octroie (XP/or/butin)
  // par diff avant/après, + la liste des vaincus (groupée par nom). L'écran (VictoryScreen) lit `pendingVictory`.
  const xpBefore = get().party[0]?.xp ?? 0;
  const brassBefore = toBrass(get().money);
  // #9 : on sépare les effets onVictory. Récompenses/flags/journal s'appliquent MAINTENANT (pour peupler
  // l'écran) ; ceux qui CHANGENT le contexte (téléport/dialogue/combat) sont DIFFÉRÉS au clic « Continuer »
  // (dismissVictory) — sinon le téléport masque l'écran de victoire (cas de l'arène).
  const CONTEXT = new Set(['transition', 'transitionBack', 'startDialogue', 'startCombat']);
  // onVictory est un Flow (UN format avec triggers/dialogues) — on l'APLATIT ici (les `if` résolus contre
  // l'état courant) pour garder la partition CONTEXT/immédiat + la mesure de récompense sur la séquence plate.
  const all = battle.onVictory ? flattenFlow(battle.onVictory, conditionCtx(get())) : [];
  const deferred = all.filter((e) => CONTEXT.has(e.type));
  // L'ÉQUIPEMENT (giveTrapping sans heroId) devient du butin ATTRIBUABLE sur l'écran (qualités
  // conservées) au lieu d'aller d'office au 1er héros — même brique que la fenêtre de loot
  // (gearFromEffects). Un giveTrapping ciblé (heroId d'auteur) s'applique directement.
  const { gear, rest: immediate } = gearFromEffects(all.filter((e) => !CONTEXT.has(e.type)));
  const messages = immediate.filter((e) => e.type === 'journal').map((e) => (e as { text: string }).text);
  if (immediate.length) applyEffects(get, set, immediate);
  const after = get();
  const counts = new Map<string, { name: string; count: number; creatureId?: string }>();
  for (const c of battle.combatants) if (c.kind === 'enemy') {
    const key = c.creatureId ?? c.name; // regroupe par identité bestiaire (id), repli nom (statbloc custom)
    const e = counts.get(key);
    if (e) e.count++; else counts.set(key, { name: c.name, count: 1, creatureId: c.creatureId });
  }
  set({
    pendingVictory: {
      xp: Math.max(0, (after.party[0]?.xp ?? 0) - xpBefore),
      gold: fromBrass(Math.max(0, toBrass(after.money) - brassBefore)),
      gear: gear.length ? gear : undefined,
      defeated: [...counts.values()].map(({ name, count, creatureId }) => ({ name, count, creatureId })),
      messages: messages.length ? messages : undefined,
      onContinue: deferred.length ? deferred : undefined,
    },
  });
}

/** Continuation à la FERMETURE de la cascade de fin de combat (`combatEndBoundary`) : l'écran de victoire
 *  suit les Tests de fin de combat influencés. Re-dérive l'issue depuis l'état COURANT (une damnation par
 *  mutation a pu tuer un héros) : ennemis tous hors d'action → victoire ; sinon (héros tombé) → défaite. */
export function finishCombatEnd(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  if (get().combatCursor) set({ combatCursor: null }); // fin de combat : plus de navigation au curseur
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  if (heroesAlive) { finishVictory(get, set); return; }
  // Cas-limite : la mutation/damnation a achevé le dernier héros pendant la cascade → défaite.
  finalizeBattle(get, set);
  set({ battle: { ...get().battle!, over: 'defeat', log: [...get().battle!.log, ev('info', tr('cf.defeat'))] } });
}

/** Gantelet verrouillé (AA folio 94) — anti-lâcher GÉNÉRIQUE (capacité lue en DONNÉE `preventForcedDrop`,
 *  jamais par le nom de l'objet). Renvoie true si le porteur GARDE l'arme `drop` (la 1re fois dans la période
 *  de « 1 Round minimum » — il subit alors −20 pendant 1 Round, journalisé par l'appelant) ; false s'il doit
 *  la LÂCHER (aucun gantelet, ou SECOND évènement de lâcher pendant la période). Pose/réarme le marqueur
 *  transitoire `drop.gauntletSavedRound`. */
function lockedGauntletHolds(wielder: Combatant, drop: Weapon, round: number): boolean {
  const hasGauntlet = hasCapability(wielder, 'preventForcedDrop'); // capacité agrégée (gantelet PORTÉ/TENU)
  if (!hasGauntlet) return false;
  const saved = drop.gauntletSavedRound;
  if (saved != null && round <= saved + 1) { drop.gauntletSavedRound = undefined; return false; } // 2e évènement dans la période → lâche
  drop.gauntletSavedRound = round; // 1re sauvegarde (ou période écoulée → réarmement) : garde l'arme, −20/1 Round
  return true;
}

/**
 * Conséquence PROCÉDURALE d'un Test opposé de Piège-lame GAGNÉ par le défenseur (op `breakBlade`, hook
 * `bladeTrap`) : l'adversaire est désarmé de la lame visée (`bt.weaponUid`), arrachée de ses mains. Marge
 * NETTE `(DR final du défenseur + bt.defSL) − bt.attackerSL` ≥ 6 (Succès Stupéfiant, LDB 62 l.295) → la lame
 * est BRISÉE à moins qu'elle ne possède l'Atout Incassable (sauvegarde Solide gérée par `wearActiveWeapon`).
 * Échec/égalité au Test ⇒ branche `fail` (pas d'op, l'adversaire libère sa lame) → cette fonction n'est pas
 * appelée. La conséquence est EMPILÉE comme étape d'AFFICHAGE propre dans la cascade (`pushCombatStep` →
 * `bladeTrapResult`, applier muet) — MÊME paradigme que le Coup Critique (une étape visible « l'un sous
 * l'autre », acquittée par « Continuer/Terminer ») plutôt qu'une ligne noyée. `defenderSL` = le DR PROPRE du
 * jet résolu (la marge nette se recompose avec `bt`). */
export function applyBladeTrap(get: Get, set: SetFn, defender: Combatant, bt: BladeTrapFreeze, defenderSL: number): void {
  const battle = get().battle;
  if (!battle) return;
  const attacker = battle.combatants.find((c) => c.id === bt.attackerId);
  if (!attacker || isOutOfAction(attacker)) return;
  const drop = attacker.weapons.find((w) => w.uid === bt.weaponUid);
  if (!drop) return;
  const netSL = defenderSL + bt.defSL - bt.attackerSL; // marge nette du défenseur vainqueur (LDB 62 l.295)
  let line: string;
  if (netSL >= 6) {
    // Succès Stupéfiant : la lame est BRISÉE, à moins qu'elle ne possède l'Atout Incassable (l.295).
    wearActiveWeapon(attacker, drop, true);
    line = drop.destroyed
      ? tr('cf.bladeBroken', { name: attacker.name, weapon: drop.name })
      : tr('cf.bladeResists', { weapon: drop.name, name: attacker.name });
  } else {
    line = tr('cf.weaponDropped', { name: attacker.name, weapon: drop.name });
  }
  // Gantelet verrouillé (AA folio 94) : anti-lâcher — la lame DÉTRUITE échappe à cette grâce (un gantelet
  // ne sauve pas une arme brisée). Sinon, la 1re fois dans la période le porteur GARDE l'arme (−20/1 Round) ;
  // le 2e évènement de lâcher la fait tomber. Capacité lue en DONNÉE (`preventForcedDrop`), jamais par nom.
  if (!drop.destroyed && lockedGauntletHolds(attacker, drop, battle.round)) {
    pushCombatStep(set, { id: `cons-bladetrap-result-${defender.id}`, kind: 'bladeTrapResult', actorId: defender.id, icon: 'action/defend', label: tr('cf.bladeTrapLabel'), outcome: [tr('cf.lockedGauntletHold', { name: attacker.name, weapon: drop.name })], interactive: true });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    return;
  }
  attacker.weapons = attacker.weapons.filter((w) => w !== drop);
  // Étape d'AFFICHAGE empilée (comme un Coup Critique) : visible « l'un sous l'autre », acquittée par le
  // joueur. `actorId` = le défenseur piégeur (propriétaire de la modale en coop). Applier muet (préserve `outcome`).
  pushCombatStep(set, { id: `cons-bladetrap-result-${defender.id}`, kind: 'bladeTrapResult', actorId: defender.id, icon: 'item/weapon', label: tr('cf.bladeTrapLabel'), outcome: [line], interactive: true });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Applier MUET de l'étape d'AFFICHAGE de la conséquence Piège-lame : l'`outcome` (« lame brisée/arrachée »)
 *  est pré-posé sur l'étape (la mutation a déjà eu lieu dans `applyBladeTrap`) → rien à appliquer ici, seul
 *  l'affichage empilé reste (mirroir d'une révélation de Critique en étape de séquence). */
registerCascadeApplier('bladeTrapResult', () => {});

/** Applier de l'étape de CHOIX « piège-lame » (LDB 62 l.292-295). « Coup Critique » (défaut) inflige le
 *  critique normal sur sa défense (LDB 14 l.7). « Piéger » route un Test opposé de Force CADENCE-AWARE
 *  (le héros défenseur PEUT dépenser Chance/Résilience) via `runCombatFlow` : le défenseur jette, l'attaquant
 *  (porteur) oppose sa Force, en ajoutant le DR de la défense (`defSL`) au jet du défenseur (l.295) ; la
 *  branche de VICTOIRE porte l'op IMPURE `breakBlade` (désarme/brise, conséquence procédurale APRÈS le Test). */
registerCascadeApplier('bladeTrap', (get, set, step) => {
  const pbt = step.bladeTrap;
  if (!pbt) return;
  const battle = get().battle;
  const defender = battle?.combatants.find((c) => c.id === pbt.defenderId);
  const attacker = battle?.combatants.find((c) => c.id === pbt.attackerId);
  if (!defender || !attacker) return;
  if (step.chosen !== 'trap') {
    // Coup Critique normal sur la défense (le défenseur place le Critique sur l'attaquant).
    const parryWeaponName = defender.weapons.find((w) => w.uid === pbt.parryWeaponUid)?.name ?? 'arme';
    const lines = [tr('cf.critOnDefense', { name: defender.name })];
    applyOpposedCritical(get, set, attacker, pbt.roll, { attackerId: defender.id, weapon: parryWeaponName }, lines);
    const b = get().battle!;
    set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', defender.id, attacker.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    return;
  }
  if (isOutOfAction(attacker)) return;
  // Test opposé de Force CADENCE-AWARE : la branche success porte `breakBlade` (désarme/brise). Le bonus de DR
  // de la défense (`defSL`, l.295) s'ajoute au jet du défenseur via `opposed.bonusSL` (modifie vainqueur ET
  // marge nette) ; le contexte `bladeTrap` cible la lame de l'attaquant. `resolveFlowTest` complète le freeze
  // avec le DR de l'attaquant qu'IL jette (`attackerSL`) → la conséquence recompose la marge nette, sans
  // double-jet. `runCombatFlow` route le Test (héros manuel → cascade influençable ; ennemi/auto → inline).
  const bt: BladeTrapFreeze = { attackerId: attacker.id, weaponUid: pbt.weapon.uid!, defSL: pbt.defSL, attackerSL: 0 };
  const flow = testFlow(
    { characteristic: 'F', label: 'Piège-lame', opposed: { attacker: 'F', attackerLabel: 'Force', bonusSL: pbt.defSL } },
    { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'breakBlade' }] } },
    EMPTY_FLOW,
  );
  runCombatFlow({ mode: 'combat', get, set, target: defender, caster: attacker, label: 'Piège-lame', bladeTrap: bt }, flow);
});

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
export function resumeEnemyTurn(get: Get, set: SetFn): void {
  if (combatAdvanceBlocked(get())) return;
  setTimeout(() => advanceTurn(get, set), beatHold(get, 'enemyAdvance'));
}

/** Reprend un tour d'IA SUSPENDU par une modale bloquante (révélations OU séquence de conséquences de
 *  combat) une fois qu'elle est CLOSE — appelée par `dismissReveal` (file vidée) et par la fin d'une
 *  séquence de combat (`cascadeNext`/`cascadeFinish`). Garde alignée sur celle de `resumeEnemyTurn`. */
export function resumeSuspendedAI(get: Get, set: SetFn): void {
  const s = get();
  // `resumeSuspendedAI` ne surveillait historiquement PAS `pendingCast` → `{ cast: false }` (iso A1).
  if (combatAdvanceBlocked(s, { cast: false })) return;
  const battle = s.battle!;
  const active = activeCombatant(battle);
  if (!active || !aiDriven(s, active)) return;
  // L'acteur IA actif est MORT pendant la conséquence suspendue (ex. critique défensif du héros — un
  // démembrement — qui tue le chargeur PENDANT sa propre attaque) → son tour est terminé : AVANCER au
  // combattant suivant. Sans ça, `resumeEnemyTurn` ne serait jamais armé et la main ne reviendrait jamais
  // au héros (soft-lock observé). `advanceTurn` saute de lui-même les hors-combat.
  if (isOutOfAction(active)) { advanceTurn(get, set); return; }
  // Acteur IA ayant déjà agi (conséquence d'attaque) → fin de tour ; sinon début de tour (entretien) → IA.
  if (battle.acted) resumeEnemyTurn(get, set);
  else maybeRunEnemyTurn(get, set);
}

export function advanceTurn(get: Get, set: SetFn) {
  // Pause de début de Round (PERSONNE n'est actif, turn -1) : un advanceTurn retardataire (timer
  // d'IA en vol) ne doit pas ré-incrémenter le tour SOUS la pause — confirmRoundStart le posera.
  if (get().pendingRoundStart) return;
  if (combatAdvanceBlocked(get())) return;
  if (get().combatCursor) set({ combatCursor: null }); // le curseur clavier/manette appartient au tour qui s'achève
  const battle = get().battle!; // non-null garanti par combatAdvanceBlocked ci-dessus
  // La Charge ne vaut que pour le tour où elle a lieu (Cornes LDB 85, Épuisante LDB 62 l.319) :
  // consommée au passage au combattant suivant (filet de sécurité, l'IA la consomme aussi en chemin).
  const prevActive = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  if (prevActive?.chargedThisTurn) prevActive.chargedThisTurn = false;
  if (prevActive?.freeAttacksThisTurn) prevActive.freeAttacksThisTurn = undefined; // Attaques gratuites de manœuvre : 1/tour (compteur remis à zéro)
  fireTurnEndTriggers(get, set, prevActive); // effets de bord « fin de tour » authorés (inerte sans donnée)

  let turn = battle.turn;
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      // Franchissement de Round : upkeep (dégâts périodiques + 0 PB→Inconscient), puis la résolution
      // (morts lentes avec sauvetage par Destin) est déléguée à resolveRoundBoundary — résumable,
      // car elle peut suspendre (pendingFateSave / pendingRoundStart).
      const round = battle.round + 1;
      get().advanceTime(TIME_COST.combatRound); // « tout est horodaté » : 1 Round franchi = +combatRound min
      battle.log.push(ev('round', tr('cf.roundHeader', { round })));
      // Ordre du Round : on REPART de l'ordre canonique (baseOrder) — donc tout réordonnancement
      // (Maladresse « agir en dernier » Oups! 21-40, pré-emption Chance) ne dure qu'UN Round (l.22-25).
      // Règle optionnelle « Relancer l'Initiative chaque Round » (LDB 13 l.43, « effectuer un lancer pour
      // chaque Round ») : on re-tire la VALEUR d'Initiative de chaque combattant via `rollInitiative` (même
      // méthode `combat-init-method` qu'à l'ouverture) puis on recalcule l'ordre — ce nouvel ordre devient
      // la base canonique de CE Round. OFF (défaut) : `baseOrder` est conservé (comportement inchangé).
      let base = battle.baseOrder ?? battle.order;
      if (rule('combat-init-reroll')) {
        for (const c of battle.combatants) c.initiative = rollInitiative(c, battleRng());
        base = combatOrder(battle.combatants, isMerScene(get().scene), battleRng());
        battle.baseOrder = base;
      }
      // Agir en dernier : Maladresse (Oups! 21-40, 1 Round) OU arme Lente active (LDB 62 l.331, permanent).
      const lastIds = battle.combatants.filter((c) => c.actLastNextRound || strikesLast(c.weapons)).map((c) => c.id);
      battle.order = [...base.filter((id) => !lastIds.includes(id)), ...base.filter((id) => lastIds.includes(id))];
      for (const c of battle.combatants) if (c.actLastNextRound) { c.actLastNextRound = false; battle.log.push(ev('detail', tr('cf.actLast', { name: c.name }), c.id)); }
      // Entretien de Round PARTITIONNÉ (spec coop §4bis) : TOUT va au journal de combat (bandeau) ;
      // seules les lignes CONCERNANT UN HÉROS alimentent la révélation (les ennemis : journal seul).
      const heroRoundLines: string[] = [];
      const tickLine = (line: string, c?: Combatant) => {
        battle.log.push(ev('condition', line, c?.id));
        if (c?.kind === 'hero') heroRoundLines.push(line);
      };
      // TOUTE la séquence de franchissement de Round est déléguée aux hooks `roundBoundary`
      // (state/combat/roundHooks), ordonnés par `order` : end-of-round 10 → poison-resist 15 →
      // refresh-wounds 20 → triggers 25 → Instable 30 → Bestial 40 → Perturbant 50 → Surnombre 55 →
      // Détermination 70/72 → broken-recovery 74 → tail 76-79.5 → règles optionnelles (se-fatiguer 80).
      // (Mâchoires d'acier n'est plus un hook de Round : c'est un effet `onGainCondition` data-driven.)
      // advanceTurn n'orchestre plus que le CADRE (Round, ordre, révélation) ; le CONTENU vit en hooks.
      // (Frénésie : l'Arme libre est un grant de DONNÉE plafonné par freeAttacksThisTurn, remis à zéro au tour.)
      runCombatHooks('onRoundEnd', { get, set, battle, sink: tickLine });
      if (heroRoundLines.length) pushReveal(set, { kind: 'round', title: tr('cf.roundEndTitle', { n: round - 1 }), lines: heroRoundLines, severity: 'minor' }); // (entretien HÉROS — auto-fermée)
      // Maniement de deux armes : le −10 défensif expire au DÉBUT du prochain Tour de son porteur. Si ce
      // porteur est order[0] (il rejoue en premier), c'est ICI (le franchissement de Round) que son Tour démarre.
      const firstNext = battle.combatants.find((c) => c.id === battle.order[0]);
      if (firstNext) firstNext.dualStrikeDefensePenalty = false;
      set({ battle: { ...battle, turn: 0, round } });
      resolveRoundBoundary(get, set);
      return;
    }
    const next = battle.combatants.find((c) => c.id === battle.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  // Tour suivant dans le MÊME Round. La posture « Sur la défensive » expire (LDB Combat l.118).
  const newActive = battle.combatants.find((c) => c.id === battle.order[turn]);
  let movementUsed = 0;
  let acted = false;
  if (newActive) {
    newActive.defensiveStance = false;
    newActive.dualStrikeDefensePenalty = false; // Maniement de deux armes : expire au début de son Tour (LDB 10 l.638)
    // Maladresse (Oups! 61-80) : perte du Mouvement / de l'Action ce tour-ci.
    if (newActive.loseNextMovement) { movementUsed = mountMovement(battle, newActive); newActive.loseNextMovement = false; battle.log.push(ev('detail', tr('cf.loseMovement', { name: newActive.name }), newActive.id)); }
    if (newActive.loseNextAction) { acted = true; newActive.loseNextAction = false; battle.log.push(ev('detail', tr('cf.loseAction', { name: newActive.name }), newActive.id)); }
    fireTurnStartTriggers(get, set, newActive); // effets de bord « début de tour » authorés (inerte sans donnée)
    // Gate d'action par Round (op `actGate` — Racine de mandragore, LDB 71 l.35) : héros manuel → étape
    // de cascade influençable (issue appliquée sur la battle par l'applier) ; IA/auto → jet inline FOLDÉ
    // ici dans le budget du tour (l'Action est gardée, le Mouvement est perdu sur un échec).
    const gate = resolveActGates(get, set, newActive);
    for (const line of gate.lines) battle.log.push(ev('detail', line, newActive.id));
    if (gate.loseMovement && movementUsed === 0) movementUsed = mountMovement(battle, newActive);
  }
  set({ battle: { ...battle, turn, action: null, movementUsed, movedPreAction: false, acted, loadoutSwapped: false, reachable: new Map(), preview: null, runBudget: null, fearGate: null } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  // La Psychologie ne se teste PLUS par tour (LDB 21 : Traits ciblés/Terreur au DÉBUT du Round l.14,
  // Peur à la FIN de chaque Round l.27) → cascades de Round (openRoundStartPsych/openRoundEndPsych).
  maybeRunEnemyTurn(get, set);
}

/**
 * Fin de Round, RÉSUMABLE : (1) résout les morts lentes une par une — pour un héros à Destin,
 * suspend (pendingFateSave 'slow') ; (2) finalise les morts restantes ; (3) décrément d'Avantage
 * + Engagement (une seule fois, après toutes les morts) ; (4) pré-emption d'initiative (Chance,
 * 3e usage) sinon sélection de l'acteur + IA. Rappelée par fate* après résolution d'une mort lente.
 */
export function resolveRoundBoundary(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  // (1) Un héros mourant à Destin non résolu → suspend (LDB ch.17 l.31-35).
  const dying = battle.combatants.find((c) => c.kind === 'hero' && (c.fate ?? 0) > 0 && inDeathCondition(c));
  if (dying) {
    set({ pendingFateSave: { heroId: dying.id, source: 'slow' } });
    return;
  }
  // (2) Finaliser les morts lentes restantes (héros sans Destin) — + effet « à la mort » (onSlain) éventuel.
  for (const c of battle.combatants) if (inDeathCondition(c)) { c.dead = true; for (const line of notifySlain(get, set, c)) battle.log.push(ev('death', line, c.id)); }
  // (2bis) Mort par Hémorragique (LDB 16 l.105) — combattants `bleedDoomed` (jet RNG du hook `bleed-death`).
  //        Un héros à Destin → SUSPEND (pendingFateSave 'slow', re-entre ici après résolution ; le sauvé est
  //        éjecté → filtré) ; sinon mort finalisée (annonce différée + onSlain). Une fois tous résolus, on purge.
  const doomedBleed = (battle.bleedDoomed ?? [])
    .map((d) => ({ c: battle.combatants.find((x) => x.id === d.id), line: d.deathLine }))
    .filter((d): d is { c: Combatant; line: string } => !!d.c && !isOutOfAction(d.c));
  const bleedFateHero = doomedBleed.find((d) => d.c.kind === 'hero' && (d.c.fate ?? 0) > 0);
  if (bleedFateHero) { set({ pendingFateSave: { heroId: bleedFateHero.c.id, source: 'slow' } }); return; }
  for (const d of doomedBleed) { d.c.dead = true; battle.log.push(ev('death', d.line, d.c.id)); for (const line of notifySlain(get, set, d.c)) battle.log.push(ev('death', line, d.c.id)); }
  battle.bleedDoomed = undefined;
  // (3) Avantage : mode Livre de base → -1 si aucun gagné ce Round (LDB Dépl. l.40) ; mode « Avantage de
  //     groupe » (AA l.4146) → transfert de domination du camp majoritaire (REMPLACE décroissance +
  //     Surnombre). Engagé périmé (LDB 13-Combat l.175).
  if (groupAdvantage()) roundEndAdvantageTransfer(battle);
  for (const c of battle.combatants) {
    if (!groupAdvantage() && !isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
    c.gainedAdvThisRound = false;
    if (c.distractedRounds) c.distractedRounds = c.distractedRounds > 1 ? c.distractedRounds - 1 : undefined; // Distraire (LDB 10 l.364) : expire en fin de Round
    c.dispelledThisRound = undefined; // Dissipation : « un seul Sort chaque Round » (LDB 46 l.202)
  }
  // Nuée (LDB 85 l.200) : tout opposant ENGAGÉ avec une nuée perd 1 PB en fin de Round (submergé).
  const swarms = battle.combatants.filter((s) => s.swarm && !isOutOfAction(s));
  if (swarms.length)
    for (const c of battle.combatants) {
      if (c.swarm || isOutOfAction(c) || !(c.engagedWith ?? []).some((id) => swarms.some((s) => s.id === id))) continue;
      c.wounds.current = Math.max(0, c.wounds.current - 1);
      if (c.wounds.current <= 0) applyZeroWounds(c);
    }
  decayEngagement(battle.combatants);
  // Zones persistantes (L11) : un Round de moins ; les zones épuisées se dissipent (fumée, Mur de feu…).
  if (battle.zones?.length) {
    const d = decayZones(battle.zones);
    battle.zones = d.zones;
    for (const l of d.log) battle.log.push(ev('info', l));
  }
  // « Avantages et Magie » : la convergence de Domaine ne vaut que DANS le Round (LDB 46 l.176).
  if (battle.domainCasts?.length) battle.domainCasts = undefined;
  // (4) Le combat est-il terminé à ce franchissement ? (morts lentes finalisées ci-dessus → victoire/défaite,
  //     capture des récompenses incluse). On tranche AVANT de proposer la fenêtre d'initiative.
  if (checkBattleOver(get, set)) return;
  // (4bis) Psychologie de FIN de Round (LDB 21 l.27) : la PEUR est un Test ÉTENDU de Calme « à la fin
  //     de chaque Round ». APRÈS le Destin (résolu en (1), peut avoir suspendu/re-rappelé) ET les
  //     décomptes UNE-FOIS-PAR-ROUND ci-dessus (Avantage/Nuée/Engagement/zones — DÉJÀ appliqués), on
  //     ouvre UNE cascade (un héros par étape, applier 'combatPsych') qui SUSPEND la suite jusqu'à
  //     résolution. À sa fermeture (`roundBoundary`), le store enchaîne DIRECTEMENT sur `enterRoundStartPause`
  //     — surtout PAS `resolveRoundBoundary` (qui re-jouerait ces décomptes). Sinon (aucune Peur), on
  //     enchaîne ici même.
  openRoundEndCascade(get, set);
  if (get().pendingCascade) return;
  enterRoundStartPause(get, set);
}

/** Pause de DÉBUT DE ROUND (LDB ch.17 l.27) : on s'arrête à CHAQUE début de Round pour montrer
 *  l'initiative (frise d'initiative (InitiativeStrip)) et permettre la pré-emption (Chance, 3e usage ;
 *  futurs Atouts/talents). L'IA reste gelée jusqu'à « Commencer le round » (confirmRoundStart) — cf.
 *  garde de maybeRunEnemyTurn. EN COOP (arbitrage 2026-06-11) : seul le round 1 est gaté (ready-check
 *  de tous) — les rounds suivants S'ENCHAÎNENT sans pause. Extrait de `resolveRoundBoundary` pour être
 *  rappelable après la cascade de Peur de fin de Round. */
export function enterRoundStartPause(get: Get, set: SetFn): void {
  const b = get().battle;
  if (!b || b.over) return;
  for (const c of b.combatants) if (c.shotsThisTurn) c.shotsThisTurn = 0; // Salve : compteur de tirs réinitialisé à chaque Round
  const reset = { ...b, action: null, selectedAttack: undefined, movementUsed: 0, movedPreAction: false, acted: false, crewActed: {}, loadoutSwapped: false, reachable: new Map(), preview: null, runBudget: null, fearGate: null };
  if (get().net.mode !== 'local' && b.round > 1 && !b.handRaised) {
    set({ battle: reset, pendingRoundStart: null });
    get().confirmRoundStart();
    return;
  }
  // Auto-combat SOLO : on enchaîne les Rounds sans pause (l'IA joue tout le groupe). On NE touche PAS la
  // branche coop (ready-check du Round 1 préservé ci-dessus) ni le mode manuel/Rapide (pause conservée).
  if (cadenceAutoCombat() && get().net.mode === 'local') {
    set({ battle: reset, pendingRoundStart: null });
    get().confirmRoundStart();
    return;
  }
  // Pause de début de Round : PERSONNE n'est actif (turn -1) — confirmRoundStart posera le tour.
  set({ battle: { ...reset, turn: -1, handRaised: false }, pendingRoundStart: { round: b.round } });
}

/** IA : si le combattant actif est PILOTÉ par l'IA (ennemi, ou héros en Auto-combat possédé localement),
 *  il agit puis passe la main — cf. `aiDriven`. */
export function maybeRunEnemyTurn(get: Get, set: SetFn) {
  if (combatAdvanceBlocked(get(), { roundStart: true })) return;
  const battle = get().battle!;
  const active = activeCombatant(battle);
  if (!active || !aiDriven(get(), active) || isOutOfAction(active)) return;
  setTimeout(() => runEnemyAI(get, set, active.id), beatHold(get, 'turnHandoff'));
}

/** LDB 21 (Psychologie) l.29 : « Si la source de votre Peur se rapproche de vous, vous devez réussir un
 *  Test de Calme Intermédiaire (+0) ou gagner un État Brisé. » Appelé APRÈS le déplacement de `mover` (IA) :
 *  tout héros qui le craint (Peur active non vaincue) ET dont il s'est rapproché fait un Test de Calme,
 *  ROUTÉ par l'exécuteur de Flow CADENCE-AWARE (`runCombatFlow`) — héros en cadence MANUELLE → étape de
 *  cascade INFLUENÇABLE (Chance/Résilience) ; ennemi/héros auto → jet inline. La conséquence PURE de
 *  l'échec (1 État Brisé) est une op `condition` portée par la branche `fail`. Plusieurs héros craintifs
 *  testent sur un même déplacement (garde `lastApproachKey` : 1 Test par Tour de la source) ; chaque
 *  `runCombatFlow` APPEND son étape à la MÊME cascade `purpose:'combat'` → file naturelle. */
export function approachFearTrigger(get: Get, set: SetFn, mover: Combatant, fromPos: Pt): void {
  const battle = get().battle;
  if (!battle || !mover.pos) return;
  const approachKey = `${battle.round}:${battle.turn}`; // UN Test par Tour de la source (l.29) —
  // un déplacement DÉCOMPOSÉ en segments (ou move-then-attack) ne re-déclenche pas la modale.
  for (const c of battle.combatants) {
    if (c.kind === mover.kind || isOutOfAction(c) || !c.pos) continue;
    const peur = (c.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === mover.id && (p.calmeDR ?? 0) < (p.indice ?? 0));
    if (!peur || peur.lastApproachKey === approachKey) continue;
    if (chebyshev(mover.pos, c.pos) >= chebyshev(fromPos, c.pos)) continue; // ne s'est pas rapproché
    peur.lastApproachKey = approachKey;
    const flow = testFlow(
      { skill: 'calme', difficulty: 'intermediaire', label: 'Approche menaçante' },
      EMPTY_FLOW, // réussite : garde son sang-froid, rien à faire
      { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', name: COND.brise, value: 1 }] } },
    );
    runCombatFlow({ mode: 'combat', get, set, target: c, caster: c, label: 'Approche menaçante' }, flow);
  }
  // Inline (mover ennemi → héros auto/ennemi craintif) : les lignes partent dans la file différée. Le héros
  // manuel suspend (cascade) et n'en pousse aucune. On les folde dans le `battle.log` que le `move` réécrit.
  battle.log.push(...drainPendingLog(get, set));
}

/** Forme commune d'un Test de Psychologie de combat DÛ pour un héros (cumul `prevDR` = 0 sauf Peur étendue). */
type HeroPsychDue = { kind: PsychType; sourceId: string; sourceName: string; indice: number; prevDR: number; cible?: string };

/** Combattants en Ligne de Vue de `c` (hors lui-même, debout). Mutualisé par les deux collectes. */
function visibleFoesAndAllies(battle: BattleState, scene: import('./scene').Scene, c: Combatant): Combatant[] {
  return battle.combatants.filter((v) => v.id !== c.id && v.pos && !isOutOfAction(v) && losClear(scene, c.pos!, v.pos, smokeOf(battle)));
}

/** Test de Psychologie de DÉBUT de Round dû à `c` (LDB 21 l.14) : un Trait ciblé (re-test d'un actif
 *  OU nouveau déclenchement) ou une NOUVELLE Terreur en Ligne de Vue. Pur de lecture. La Peur (simple
 *  Taille/causesPeur) NE se teste PAS ici : c'est un Test étendu de FIN de Round (cf. collectHeroRoundEndPsych). */
export function collectHeroRoundStartPsych(get: Get, c: Combatant): HeroPsychDue | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos || isPsychImmune(c)) return null; // Immunité psy (trait/Frénésie/Détermination temp)
  const state = c.psychState ?? [];
  // NOUVELLE Terreur en Ligne de Vue (1ʳᵉ rencontre → Brisé, puis devient une Peur — LDB 21 l.55-57).
  for (const foe of battle.combatants) {
    if (foe.kind === c.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (!losClear(scene, c.pos, foe.pos, smokeOf(battle))) continue;
    const src = fearSourceFor(c, foe, riderFearSize(battle, c)); // Cavalier émérite (AA l.4369) : Taille = monture face à la Peur de Taille
    if (!src || src.kind !== 'terreur' || state.some((p) => p.sourceId === foe.id)) continue;
    return { kind: 'terreur', sourceId: foe.id, sourceName: foe.name, indice: src.indice, prevDR: 0 };
  }
  // Traits psy CIBLÉS (Animosité/Haine/… — LDB 21) : re-test des actifs, puis nouveaux déclenchements.
  const visible = visibleFoesAndAllies(battle, scene, c);
  for (const p of state) {
    if (p.active && CIBLE_TYPES.has(p.type) && p.cible && p.lastTestRound !== battle.round && visible.some((v) => groupMatch(p.cible!, v.groups ?? [])))
      return { kind: p.type, sourceId: p.sourceId ?? '', sourceName: '', indice: 0, prevDR: 0, cible: p.cible }; // affliction active à re-tester
  }
  const tt = targetedTrigger(c, visible);
  if (tt) return { kind: tt.type, sourceId: tt.sourceId, sourceName: '', indice: 0, prevDR: 0, cible: tt.cible };
  return null;
}

/** Test de Psychologie de FIN de Round dû à `c` (LDB 21 l.27) : une PEUR — nouvelle source de Peur en
 *  Ligne de Vue (Taille gap 1 / causesPeur), ou Peur active non encore vaincue ni testée ce Round. Test
 *  ÉTENDU de Calme (`prevDR` = DR cumulé). Pur de lecture. */
export function collectHeroRoundEndPsych(get: Get, c: Combatant): HeroPsychDue | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos || isPsychImmune(c)) return null;
  const state = c.psychState ?? [];
  // NOUVELLE source de Peur (pas Terreur — celle-ci passe par le début de Round) en Ligne de Vue.
  for (const foe of battle.combatants) {
    if (foe.kind === c.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (!losClear(scene, c.pos, foe.pos, smokeOf(battle))) continue;
    const src = fearSourceFor(c, foe, riderFearSize(battle, c)); // Cavalier émérite (AA l.4369) : Taille = monture face à la Peur de Taille
    if (!src || src.kind !== 'peur' || state.some((p) => p.sourceId === foe.id)) continue;
    return { kind: 'peur', sourceId: foe.id, sourceName: foe.name, indice: src.indice, prevDR: 0 };
  }
  // Peur ACTIVE (DR cumulé < Indice) non encore testée ce Round → Test étendu (cumul vers l'Indice).
  for (const p of state) {
    if (p.type === 'peur' && (p.calmeDR ?? 0) < (p.indice ?? 0) && p.lastTestRound !== battle.round) {
      const src = battle.combatants.find((x) => x.id === p.sourceId);
      return { kind: 'peur', sourceId: p.sourceId!, sourceName: src?.name ?? '', indice: p.indice ?? 1, prevDR: p.calmeDR ?? 0 };
    }
  }
  return null;
}

/** Une étape de Psychologie de combat (`combatPsych`) pour le héros `c` si un Test est dû selon
 *  `collect` (début ou fin de Round). La sortie de Frénésie est désormais un effet `onTurnStart` en
 *  DONNÉES (diffusé par `fireTurnStartTriggers`) — plus de force-exit ici. Renvoie `null` sinon. */
function psychStepFor(get: Get, set: SetFn, c: Combatant, collect: (get: Get, c: Combatant) => HeroPsychDue | null): import('./pendings').CascadeStep | null {
  const t = collect(get, c);
  if (!t) return null;
  const isCible = CIBLE_TYPES.has(t.kind);
  const cl = isCible ? CIBLE_LABEL[t.kind] : null;
  // Paramètres du Test EN DONNÉES (psychology.json `test`) : compétence (défaut Calme, valeur NUE par
  // `skillBaseValue`) + difficulté (défaut Intermédiaire). Plus de Calme/Intermédiaire codé en dur.
  const td = findPsychologyById(t.kind)?.test;
  const skill = td?.skill ?? 'calme';
  const base = skillBaseValue(c, skill);
  // Sans Peur (Ennemi) (LDB 10 l.864) : face à une NOUVELLE Peur/Terreur de l'ennemi spécifié, « un
  // seul Test de Calme Accessible (+20) » pour l'ignorer. Pas sur les re-tests d'une Peur déjà subie
  // (entrée psychState existante → Test étendu normal +0) ni sur les Traits ciblés.
  const sourceFoe = !isCible ? get().battle?.combatants.find((x) => x.id === t.sourceId) : undefined;
  const isNewSource = !(c.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === t.sourceId);
  const sansPeur = !!sourceFoe && isNewSource && sansPeurVs(c, sourceFoe);
  // Sans Peur force Accessible (+20) ; sinon la difficulté déclarée (défaut Intermédiaire +0).
  const difficulty: Difficulty = sansPeur ? 'accessible' : (td?.difficulty ?? 'intermediaire');
  const target = base + DIFFICULTY_MODIFIERS[difficulty];
  return {
    id: `psych-${c.id}`,
    kind: 'combatPsych',
    actorId: c.id,
    icon: cl?.icon ?? (t.kind === 'terreur' ? 'creature/scream' : 'flag/fear'),
    rollLabel: refLabel('skills', { id: skill }),
    base,
    target, // Test (Calme par défaut) à la difficulté déclarée, ou Accessible (+20) avec Sans Peur
    label: `${cl ? `${cl.label}${t.cible ? ` (${t.cible})` : ''}` : `${t.kind === 'terreur' ? 'Terreur' : 'Peur'} ${t.indice}`}${sansPeur ? ' · Sans Peur (+20)' : ''}`,
    combatPsych: { kind: t.kind, sourceId: t.sourceId, sourceName: t.sourceName, indice: t.indice, cible: t.cible, prevDR: t.prevDR, sansPeur },
  };
}

/** Une cascade de Round est-elle interdite (modale/cascade bloquante déjà ouverte) ? */
function roundCascadeBlocked(get: Get): boolean {
  const battle = get().battle;
  return !battle || !!battle.over || !!get().pendingCascade || get().pendingReveals.length > 0 || !!get().pendingFateSave;
}

/** Construit la cascade de Psychologie de combat (UNE étape par héros DÛ) à partir d'un collecteur.
 *  No-op si une cascade/modale bloquante est ouverte. Met l'IA en pause (purpose:'combat') jusqu'à
 *  résolution ; la reprise est gérée par `cascadeNext`/`cascadeFinish` (→ resumeSuspendedAI). */
function openCombatPsychCascade(
  get: Get,
  set: SetFn,
  collect: (get: Get, c: Combatant) => HeroPsychDue | null,
  title: string,
  icon: string,
  roundBoundary = false,
): void {
  if (roundCascadeBlocked(get)) return; // Maladresse = étape de pendingCascade (déjà couverte)
  const steps: import('./pendings').CascadeStep[] = [];
  for (const c of get().battle!.combatants) {
    if (!humanControlled(get(), c) || isOutOfAction(c)) continue;
    const st = psychStepFor(get, set, c, collect);
    if (st) steps.push(st);
  }
  if (!steps.length) return;
  startCascade(get, set, { title, icon, purpose: 'combat', steps, roundBoundary });
}

/** Cascade de Psychologie de DÉBUT de Round (Traits ciblés + nouvelles Terreurs, LDB 21 l.14) — un héros
 *  par étape. Appelée APRÈS `confirmRoundStart` (acteur posé) ; suspend l'IA jusqu'à résolution. */
export function openRoundStartPsych(get: Get, set: SetFn): void {
  openCombatPsychCascade(get, set, collectHeroRoundStartPsych, 'Sang-froid', 'resource/resolve');
}

/**
 * Cascade de FIN de Round (combat) — un SEUL `pendingCascade` fusionnant, PAR HÉROS, ses Tests
 * d'upkeep INFLUENÇABLES (Empoisonné → récupération du Brisé → se-fatiguer, LDB 16) PUIS son Test de
 * Peur (Test étendu de Calme, LDB 21 l.27). Les ENNEMIS sont déjà résolus en silence par les hooks
 * `roundBoundary` (poison-resist/broken-recovery/se-fatiguer). Ordre choisi : upkeep AVANT la
 * Peur (les effets de Round RAW — dont les hooks ennemi — précèdent la révélation/Psychologie de fin
 * de Round, et la sortie d'un État Sonné/Brisé peut influer sur l'état d'esprit). Appelée au
 * franchissement de Round APRÈS l'entretien/le Destin ; suspend l'IA jusqu'à résolution.
 *
 * Les conséquences d'upkeep RNG-free (retrait « caché » du Brisé, Exténué sans-Test) sont appliquées
 * DÉTERMINISTEment par le collecteur via le `sink` ci-dessous (journal de combat).
 */
export function openRoundEndCascade(get: Get, set: SetFn): void {
  if (roundCascadeBlocked(get)) return;
  const upkeepLines: { line: string; id?: string }[] = [];
  const sink = (line: string, c?: Combatant) => upkeepLines.push({ line, id: c?.id });
  const steps: import('./pendings').CascadeStep[] = [];
  for (const c of get().battle!.combatants) {
    if (!humanControlled(get(), c) || isOutOfAction(c)) continue;
    // 1) Upkeep du combattant (effets RNG-free). 2) Peur de fin de Round. (La sortie de Frénésie est un
    //    effet `onTurnStart` en données, jouée au début du tour du héros — plus ici.)
    steps.push(...collectHeroRoundEndUpkeep(get, c, sink));
    const psych = psychStepFor(get, set, c, collectHeroRoundEndPsych);
    if (psych) steps.push(psych);
  }
  // Lignes déterministes d'upkeep → journal de combat (les Tests influençables iront au journal de la
  // cascade à leur validation). On applique AVANT d'ouvrir la cascade pour garder l'ordre de lecture.
  if (upkeepLines.length) {
    const b = get().battle!;
    set({ battle: { ...b, log: [...b.log, ...upkeepLines.map((u) => ev('condition', u.line, u.id))] } });
  }
  if (!steps.length) return;
  startCascade(get, set, { title: 'Fin de Round', icon: 'time/clock', purpose: 'combat', steps, roundBoundary: true });
}

/** Conséquence d'un Test de Calme de COMBAT (étape de cascade) : pose/mets à jour le `psychState`.
 *  La résolution kind-agnostique (`rollTest(Calme)`) est faite par `FLOWS.cascade` ; ici on interprète
 *  le résultat par `kind`. Peur = Test ÉTENDU : cumule `prevDR + DR` vers l'Indice (vainc à ≥ Indice). */
registerCascadeApplier(
  'combatPsych',
  (get, set, step, hero) => {
    const cp = step.combatPsych;
    if (!hero || !step.result || !cp) return;
    const battle = get().battle;
    const r = step.result;
    hero.psychState ??= [];
    // DÉTERMINATION (LDB 17 l.62) : immunité TEMPORAIRE — la Peur/Terreur/Trait est IGNORÉE ce Round,
    // PAS vaincue. On NE cumule PAS le DR, on NE pose PAS de Brisé, on N'active PAS le trait ciblé : le
    // `psychState` (et le `calmeDR` d'une Peur déjà entamée) reste INCHANGÉ. Le collecteur de Round saute
    // ce héros tant que `psychImmuneRoundsLeft > 0` ; à l'expiration, la source reprend.
    if (step.immune) {
      set({ party: [...get().party] });
      if (battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
      return { journal: [tr('cf.psychImmune', { name: hero.name })] };
    }
    let line: string;
    let phobieLine: string | null = null;
    const res = psychResolution(cp.kind);
    if (res.mode === 'terreur') {
      // 1ʳᵉ rencontre (LDB 21 l.55-57) : échec → État `failCondition` = Indice + |DR négatifs| ; devient
      // l'état `becomes`. Conséquences lues en DONNÉES (psychology.json), plus de `'terreur'`/Brisé codé.
      const brise = r.success ? 0 : failConditionAmount(res.failAmount, cp.indice, r.sl);
      if (brise > 0 && res.failCondition) addCondition(hero, res.failCondition, brise);
      if (res.becomes) hero.psychState.push({ type: res.becomes, sourceId: cp.sourceId, indice: r.success ? 0 : cp.indice, calmeDR: 0, lastTestRound: battle?.round });
      line = r.success ? tr('out.terreurHold', { name: hero.name }) : tr('cf.terreurThenFear', { name: hero.name, foe: cp.sourceName, brise, indice: cp.indice });
      // Phobie du noir (ADE II Annexe I, règle facultative `psych-acquisition-optional`) : cumuler les États
      // Brisé subis À CAUSE de la Terreur ; à ≥ Bonus de FM → Phobie liée à la source (son Groupe si connu,
      // sinon son nom), puis remise à zéro du compteur. `gainPhobieIfThreshold` porte la garde de la règle.
      if (brise > 0 && res.failCondition === COND.brise) {
        hero.briseFromTerreur = (hero.briseFromTerreur ?? 0) + brise;
        const foe = battle?.combatants.find((x) => x.id === cp.sourceId);
        const gained = gainPhobieIfThreshold(hero, hero.briseFromTerreur, foe?.groups?.[0] ?? cp.sourceName ?? '');
        if (gained) {
          hero.psychTraits = [...(hero.psychTraits ?? []), gained.phobie];
          hero.briseFromTerreur = 0;
          phobieLine = `${hero.name} développe une Phobie durable : ${gained.phobie.cible}.`;
        }
      }
    } else if (CIBLE_TYPES.has(cp.kind)) {
      // Trait ciblé : échec → affliction active ; succès → marqueur inerte (pas de re-déclenchement).
      let e = hero.psychState.find((p) => p.type === cp.kind && p.cible === cp.cible);
      if (!e) { e = { type: cp.kind, cible: cp.cible, sourceId: cp.sourceId }; hero.psychState.push(e); }
      e.lastTestRound = battle?.round;
      e.active = !r.success;
      const cl = CIBLE_LABEL[cp.kind];
      line = r.success ? tr('out.cibleMaster', { name: hero.name, kind: cl?.label.toLowerCase() ?? cp.kind }) : tr('out.cibleGrip', { name: hero.name, kind: cl?.label.toLowerCase() ?? cp.kind });
    } else {
      // Peur = Test ÉTENDU de Calme (LDB 21 l.27) : cumuler le DR vers l'Indice (calque resolvePeurTest).
      // Sans Peur (LDB 10 l.864) : « un seul Test (+20) » → une réussite IGNORE la Peur d'emblée
      // (DR porté à l'Indice) ; un échec laisse le porteur sujet (re-tests suivants = Peur normale +0).
      // Sans Peur : une réussite IGNORE la Peur d'emblée (DR porté à l'Indice). Sinon Test étendu LDB 12
      // MUTUALISÉ (`extendedTestStep`) — un Round raté RETIRE désormais les DR négatifs (planché à 0),
      // au lieu de l'ancien cumul add-only (bug : la Peur ne pouvait jamais régresser).
      const calmeDR = cp.sansPeur && r.success
        ? Math.max(cp.prevDR, cp.indice)
        : extendedTestStep(cp.prevDR, r, cp.indice, !!rule('test-extended-min-sl')).total;
      let e = hero.psychState.find((p) => p.sourceId === cp.sourceId && p.type === 'peur');
      if (!e) { e = { type: 'peur', sourceId: cp.sourceId, indice: cp.indice, calmeDR: 0 }; hero.psychState.push(e); }
      e.calmeDR = calmeDR;
      e.lastTestRound = battle?.round;
      line = calmeDR >= cp.indice
        ? `${hero.name} ${cp.sansPeur ? 'ignore la Peur' : 'surmonte sa peur'}${cp.sourceName ? ` de ${cp.sourceName}` : ''}${cp.sansPeur ? ' (Sans Peur)' : ''}.`
        : `${hero.name} reste sous l'emprise de la Peur (${calmeDR}/${cp.indice} DR).`;
    }
    // Immunités croisées (LDB 21) : Animosité/Préjugé cèdent dès qu'on tombe sous un effet psy dominant.
    const superseded = suppressSupersededPsych(hero);
    set({ party: [...get().party] });
    if (battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
    return { journal: [line, ...(phobieLine ? [phobieLine] : []), ...superseded.map((tp) => tr('turn.psychSuperseded', { name: hero.name, psych: psychologyLabel(tp) }))] };
  },
  (success, name) => (success ? tr('out.terreurHold', { name }) : tr('cf.psychYields', { name })),
);

// === TRACE DE DÉCISION IA (DEV uniquement) ==================================================
// Buffer en anneau des derniers tours pilotés par l'IA : action CHOISIE + classement des candidats
// (l'« intention », via `consumeAiRanking`). Rempli au SEUL site d'enregistrement de `runEnemyAI`
// (jamais pollué par les appels secondaires aiApproachPlan / peek de Frénésie). Lu par les devtools
// (`__wfrp.aiLog`). N'a de contenu que si le flag `AI_TRACE` (ai.ts) est ON — sinon `top` reste vide.
export interface AiTurnRec { round: number; id: string; name: string; action: string; top: AiCandTrace[]; }
const AI_TURN_LOG: AiTurnRec[] = [];
export function aiTurnLog(): AiTurnRec[] { return AI_TURN_LOG; }
export function clearAiTurnLog() { AI_TURN_LOG.length = 0; }
/** Résumé COURT d'une action IA pour la trace (un coup d'œil = quoi/qui/où). */
function describeAiAction(a: EnemyAction): string {
  switch (a.kind) {
    case 'cast': return `cast ${a.spell}→${a.targetId}`;
    case 'castArea': return `castArea ${a.spell}@${a.center.x},${a.center.y}`;
    case 'focus': return `focus ${a.spell}`;
    case 'shoot': return `shoot ${a.targetId}`;
    case 'melee': return `melee ${a.targetId}`;
    case 'move': return `move→${a.thenTargetId}@${a.to.x},${a.to.y}`;
    case 'reload': return 'reload';
    case 'recover': return `recover ${a.state}`;
    case 'spendResource': return `spend ${a.resource}→${a.name}`;
    case 'grapple': return `grapple ${a.resolution}→${a.targetId}`;
    case 'manPoste': return `manPoste ${a.hullId}/${a.posteUid}`;
    case 'selfManeuver': return `selfManeuver ${a.maneuverId}`;
    case 'end': return 'end';
  }
}

/** Sélection de LOADOUT par l'IA (héros auto + ennemis à plusieurs sets d'armes). Un combattant qui porte un
 *  set À DISTANCE et un set de MÊLÉE dégaine le bon selon la situation : son arme à distance quand AUCUN
 *  adversaire ne l'engage (il tire/kite), son arme de mêlée au contact (ou en Frénésie, qui force la charge).
 *  Maneuver GRATUITE 1/tour (`cs.draw`, comme `battleSwitchLoadout`). Sans ça, un Chasseur dont la fronde est
 *  dans le set 2 (épée active en set 1) ne tirait JAMAIS (retour playtest 2026-06-27 : « le chasseur charge à
 *  l'arme simple alors qu'il a une fronde »). Les ennemis à statbloc (armes posées en dur, sans `loadouts`)
 *  ne passent pas ici. PUR-déterministe (aucun dé) → coop-safe ; seul l'état du combattant (set actif) change. */
function aiSelectLoadout(set: SetFn, enemy: Combatant, battle: BattleState): void {
  const sets = enemy.loadouts ?? [];
  if (sets.length < 2 || !enemy.pos) return;
  const items = enemy.items ?? [];
  const setKind = (lo: { main?: string }): 'ranged' | 'melee' | null => {
    const it = lo.main ? items.find((i) => i.uid === lo.main) : undefined;
    return it?.kind === 'ranged' ? 'ranged' : it?.kind === 'melee' ? 'melee' : null;
  };
  const rangedSet = sets.find((l) => setKind(l) === 'ranged');
  const meleeSet = sets.find((l) => setKind(l) === 'melee');
  if (!rangedSet || !meleeSet) return; // pas un hybride tir+mêlée → on ne touche pas au set choisi
  const foes = battle.combatants.filter((c) => c.kind !== enemy.kind && !isOutOfAction(c) && c.pos);
  const engaged = foes.some((f) => combatDistance(enemy, f) <= 1);
  const want = engaged || isFrenzied(enemy) ? meleeSet : rangedSet; // au contact / frénétique → mêlée ; sinon → tir
  if (enemy.activeLoadoutId === want.id) return; // déjà le bon set en main
  enemy.activeLoadoutId = want.id;
  recomputeLoadout(enemy);
  const drawn = enemy.weapons.find((w) => w.type === (want === meleeSet ? 'melee' : 'ranged'));
  battle.log.push(ev('detail', tr('cs.draw', { name: enemy.name, weapon: drawn?.name ?? '' }), enemy.id));
  set({ battle: { ...battle } });
}

export function runEnemyAI(get: Get, set: SetFn, enemyId: string) {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return;
  const enemy = battle.combatants.find((c) => c.id === enemyId);
  if (!enemy || isOutOfAction(enemy)) return advanceTurn(get, set);
  // Cycle de tour ennemi (LDB 21/85) en hooks `turnStart` ordonnés (state/combat/turnHooks) : fin de
  // Frénésie 10 → Rage 20 → tentative de Frénésie IA 30 → psychologie 40. La dépendance d'ordre RAW
  // (Frénésie/Rage AVANT la psychologie — la Frénésie en rend immunisé) est encodée par les `order`.
  // Ces hooks journalisent eux-mêmes (kinds `frenzy`/`fear`) ; `sink` n'est pas utilisé par eux.
  runCombatHooks('onTurnStart', { get, set, battle: get().battle!, self: enemy, sink: (line, c) => { get().battle!.log.push(ev('detail', line, c?.id)); } });
  // Stupide (LDB 85 p.341) : sans allié non-Stupide à ses côtés (adjacent), Test d'Intelligence Facile
  // (+40) au début du Round ; sur un échec, elle perd son Mouvement ET son Action. RESTE INLINE (pas un
  // hook) : c'est un CONTRÔLE DE FLUX (`return advanceTurn` saute le tour) — un hook `run(ctx):void` ne
  // peut pas exprimer « sauter le tour ». Il s'exécute APRÈS le dispatch `turnStart`, avant l'action IA.
  if (isStupid(enemy.traits) && enemy.pos) {
    const guided = battle.combatants.some(
      (a) => a.kind === enemy.kind && a.id !== enemy.id && !isOutOfAction(a) && !isStupid(a.traits) && a.pos && chebyshev(a.pos, enemy.pos!) <= 1,
    );
    if (!guided && !rollTest(effectiveChar(enemy, 'Int'), 'facile', battleRng()).success) {
      battle.log.push(ev('detail', tr('cf.stupid', { name: enemy.name }), enemy.id));
      set({ battle: { ...battle } });
      return advanceTurn(get, set);
    }
  }

  // Cible = camp OPPOSÉ à l'acteur : un ennemi vise les héros (inchangé) ; un héros auto-piloté (Auto-combat)
  // vise les ennemis. Les helpers Frénésie/psy ci-dessus s'appliquent à tout combattant piloté par l'IA
  // (`aiDriven`) — dont un héros auto ; Rage/Stupide restent gardés par leurs traits.
  const foeKind = enemy.kind === 'enemy' ? 'hero' : 'enemy';
  const heroes = battle.combatants.filter((c) => c.kind === foeKind && !isOutOfAction(c));
  if (heroes.length === 0) {
    checkBattleOver(get, set);
    return;
  }
  // Combat monté (LDB 14) : un PNJ à pied, non Engagé, adjacent à une monture LIBRE de son camp décide
  // de l'enfourcher (aucun jet → simple Mouvement ; il pourra ensuite ATTAQUER, mais pas se déplacer en plus).
  let justMounted = false;
  if (!enemy.mountId && !isEngaged(enemy) && canTakeAction(enemy)) {
    const freeMount = mountableNear(battle, enemy);
    if (freeMount) {
      mountUp(enemy, freeMount);
      justMounted = true;
      battle.log.push(ev('move', tr('cs.mount', { name: enemy.name, mount: freeMount.name }), enemy.id));
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  // Sélection de loadout (avant de bâtir l'entrée IA) : dégaine l'arme à distance hors de portée de mêlée,
  // l'arme de mêlée au contact — pour que `buildAiInput` voie le bon `weapons` (le tireur tire sa fronde).
  aiSelectLoadout(set, enemy, battle);
  // Combat monté (LDB 14 l.215) : géométrie porteuse (monture) pour le déplacement réel — empreinte +
  // chemin ; le couple est solidaire (positions synchronisées à l'exécution du « move »).
  const geom = mountOf(battle, enemy) ?? enemy;
  // Entrée de l'IA MUTUALISÉE (sorts résolus + escouade/orientation/perception/mouvement/vol/blocage).
  // « Vient d'enfourcher » → Mouvement consommé ce tour (l'IA n'a plus que son Action).
  let input = buildAiInput(enemy, get);
  if (justMounted) input.movement = 0;
  let action = chooseEnemyAction(input);
  // Dépense PROACTIVE de Détermination (LDB 17 l.57-63) : si l'IA décide de se DÉVERROUILLER (action
  // `spendResource`, ex. Brisé), on dépense la Détermination via l'action store `spendResolveCondition`
  // (coop-safe, hôte-autoritaire, ne consomme PAS l'Action — retire 1 pion/dépense) PUIS on RE-CHOISIT
  // l'action, le tout AVANT le dispatch, pour que l'acteur DÉVERROUILLÉ joue sa vraie action (melee/cast/
  // move) le MÊME tour — sans ré-armer les hooks de début de tour. Borne anti-boucle STRICTE : 1 pion par
  // tour ; on s'arrête si la dépense est sans effet (état inchangé) ou après les pions initiaux (safety).
  // ... et MÊME boucle pour « Briser l'Empoignade » (LDB 14 l.161) : Briser est GRATUIT (par le Mouvement) et
  // n'épuise PAS l'Action → l'ennemi libéré RE-DÉCIDE et joue sa vraie action (tir/cast/charge) le même tour.
  // Multi-Empoignade : chaque tour de boucle dénoue UN lien ; `grapplingWith` se vide → la garde ne re-fire plus.
  for (let safety = 8; safety > 0; safety--) {
    if (action.kind === 'spendResource') {
      const before = stacks(enemy, action.name);
      get().spendResolveCondition(enemy.id, action.name);
      if (stacks(enemy, action.name) >= before) break; // dépense inopérante → on n'insiste pas (anti-boucle dure)
    } else if (action.kind === 'grapple' && action.resolution === 'break') {
      const targetId = action.targetId; // capture AVANT la closure (narrowing perdu sur un `let` réassigné)
      const foe = battle.combatants.find((c) => c.id === targetId);
      if (!foe) break;
      clearGrapple(enemy, foe);
      removeCondition(enemy, COND.empetre, stacks(enemy, COND.empetre)); // se défait de l'*Empêtré* lié (LDB 14 l.161)
      battle.log.push(ev('dodge', tr('cs.grappleBreak', { name: enemy.name, foe: foe.name }), enemy.id, foe.id));
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    } else break;
    input = buildAiInput(enemy, get);
    if (justMounted) input.movement = 0;
    action = chooseEnemyAction(input);
  }
  // TRACE IA (DEV) : SEUL site d'enregistrement → `consumeAiRanking` vide le classement de l'appel qui
  // précède immédiatement (pas de pollution par aiApproachPlan/peek de Frénésie). `top` vide si flag off.
  AI_TURN_LOG.push({ round: battle.round, id: enemy.id, name: enemy.name, action: describeAiAction(action), top: consumeAiRanking() });
  if (AI_TURN_LOG.length > 400) AI_TURN_LOG.shift();
  const targetOf = (id: string) => battle.combatants.find((c) => c.id === id)!;
  const canAct = canTakeAction(enemy); // Sonné : pas d'Action — déplacement seul (LDB États l.123)

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant, delay: number = TEMPO.aimTelegraph) => {
    // Télégraphe (réticule + ligne — PLEINE en mêlée, pointillée au tir) pendant la pré-attaque :
    // même affordance que la visée du joueur, des deux côtés.
    const aimKind = firedWeapon(enemy, target).type === 'ranged' ? 'ranged' : enemy.chargedThisTurn ? 'charge' : 'melee';
    set({ actorAim: { fromId: enemy.id, toId: target.id, kind: aimKind } });
    bus.emit(EVT.SCENE_DIRTY);
    setTimeout(() => {
      set({ actorAim: null });
      const b = get().battle;
      // Tour caduc (combat fini OU relancé pendant le télégraphe → `enemy` hors du combat courant).
      if (!b || b.over || !b.combatants.includes(enemy)) return;
      // Attaque-ACTION spéciale (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
      // normale si la créature en a le trait + l'Avantage ; sinon attaque normale (opposée). Une manœuvre
      // spéciale qui touche des HÉROS ouvre une cascade de défense influençable → tour SUSPENDU (reprise
      // via `resumeManeuverDefense` à la fermeture), détectée par `maneuverCascadePending`.
      const suspended = aiMaybeSpecialAction(get, set, enemy) ? maneuverCascadePending(get) : doAttack(get, set, enemy, target);
      // Si la modale de défense s'ouvre, ne PAS armer advanceTurn ici : la reprise
      // est portée par defenseConfirm → resumeEnemyTurn (anti double-advance).
      if (!suspended) {
        aiAvailableFreeAttack(get, set, enemy); // attaque(s) d'Arme GRATUITE(S) « disponible(s) » après l'attaque principale (Frénésie LDB 21 l.34 = seule source en donnée)
        // Attaques gratuites de créature (Morsure/Caudale/Piétinement, OPPOSÉES) après l'attaque
        // principale ; si une modale de défense s'ouvre, ne PAS avancer (reprise via defenseConfirm).
        if (!aiCreatureFreeAttacks(get, set, enemy)) setTimeout(() => advanceTurn(get, set), beatHold(get, 'postAttack'));
      }
    }, delay);
  };

  // Combat monté (LDB 14 l.221) : une monture MONTÉE est dirigée par son cavalier — elle ne se déplace
  // pas seule (le couple bouge au tour du cavalier). Sans le Trait Nerveux, elle peut consacrer SA propre
  // Action à attaquer un adversaire au contact ; sinon elle passe son tour.
  if (enemy.riderId) {
    const skittish = isSkittishMount(enemy.traits); // Nerveux (LDB 14 l.221) → la monture passe son tour
    const foe = skittish || !canAct ? undefined
      : battle.combatants.find((c) => c.kind !== enemy.kind && !isOutOfAction(c) && !!c.pos && combatDistance(enemy, c) <= meleeReachTiles(enemy.weapons));
    if (foe) { attackThenAdvance(foe); return; }
    return advanceTurn(get, set);
  }

  // Sonné : l'ennemi ne peut pas agir → il renonce à son Action (l'éventuel déplacement
  // a déjà été réduit de moitié via effectiveMovement). Le « move » plus bas garde son
  // déplacement mais n'attaque pas en arrivant.
  switch (action.kind) {
    case 'end':
      return advanceTurn(get, set);
    case 'spendResource':
      // La boucle de dépense ci-dessus n'a PAS pu déverrouiller (dépense inopérante — l'acteur reste
      // verrouillé) : il n'a aucune autre action légale ce tour → il passe la main (terminal anti-boucle).
      return advanceTurn(get, set);
    case 'cast': {
      if (!canAct) return advanceTurn(get, set);
      const ctgt = targetOf(action.targetId);
      // Télégraphe d'incantation (parité tir) : ligne pointillée + réticule ~0,7 s avant le jet.
      set({ actorAim: { fromId: enemy.id, toId: ctgt.id, kind: 'cast' } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => {
        set({ actorAim: null });
        const b = get().battle;
        if (!b || b.over) return;
        castSpell(get, set, enemy, ctgt, action.spell);
        // La modale d'incantation témoin (Lancer → Contre-sort → Appliquer) SUSPEND le tour de
        // l'IA : la reprise est portée par castConfirm/castCancel → resumeEnemyTurn (anti
        // double-advance, même pattern que la défense). castSpell peut refuser (contrecoup
        // bloquant, hors de portée…) → pas de modale → l'ennemi passe.
        if (!get().pendingCast) setTimeout(() => advanceTurn(get, set), beatHold(get, 'enemyAdvance'));
      }, TEMPO.aimTelegraph);
      return;
    }
    case 'selfManeuver': {
      // Capacité SUR SOI (forme de combat lycanthrope, op transform) : résolution IMMÉDIATE sur le porteur
      // (aucune cible adverse ni jet d'attaquant). Coûte l'Action ; la 2ᵉ vient du `loseTurn` de ses effets.
      if (!canAct) return advanceTurn(get, set);
      const def = selfManeuversOf(enemy).find((m) => m.id === action.maneuverId);
      if (!def || !selfManeuverApplicable(enemy, def)) return advanceTurn(get, set);
      resolveManeuver(get, set, enemy, def, 0, null, 0, enemy); // cible = soi
      set({ battle: { ...get().battle!, acted: true } });
      checkBattleOver(get, set);
      setTimeout(() => advanceTurn(get, set), beatHold(get, 'enemyAdvance'));
      return;
    }
    case 'castArea': {
      if (!canAct) return advanceTurn(get, set);
      // Sort de ZONE (ZdE, LDB 47 l.44) d'un lanceur IA : MÊME drive que le missile (`case 'cast'`) — la
      // seule spécificité est de PORTER le centre décidé par l'IA pure (`action.center`, sur un paquet de
      // héros) dans `pendingCast.zone.autoCenter`. Ce centre est l'ÉQUIVALENT du curseur souris d'un héros :
      // le `castConfirm` PARTAGÉ le lira pour poser la zone tout seul (gardé par `aiDriven`), exactement
      // comme l'auto-combat fournit ses jets. PLUS de `castCommitZone` bespoke ici : la pose vit dans le
      // `castConfirm` UNIQUE. PARITÉ RAW (LDB 46 l.201-202) : la fenêtre de Contre-sort s'intercale AVANT la
      // pose (`routeEnemyCast`) ; dissipée → `castConfirm` ne pose RIEN (zone non posée, pending fermé).
      const center = action.center;
      // Télégraphe de ZONE (parité missile) : peint le DISQUE cible (centre + rayon) ~0,7 s avant la
      // résolution, au lieu de l'ancien `actorAim` dégénéré (ligne enemy→enemy, n'indiquait PAS l'aire).
      // Rayon = celui du sort CHOISI (forme `area` portée par `input.spells`), repli sur `zdeRadiusTiles`.
      const chosenAoe = input.spells.find((s) => s.id === action.spell);
      const aoeSp = resolveSpell(action.spell);
      const aoeRadius = (chosenAoe && typeof chosenAoe.shape === 'object' ? chosenAoe.shape.area.radius : undefined)
        ?? (aoeSp ? zdeRadiusTiles(aoeSp.target, enemy) ?? 1 : 1);
      set({ actorAoe: { casterId: enemy.id, center, radius: aoeRadius } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => {
        set({ actorAoe: null });
        const b = get().battle;
        if (!b || b.over || !b.combatants.includes(enemy)) return;
        if (!castZoneSpell(get, set, enemy, action.spell)) { advanceTurn(get, set); return; } // pas une zone chiffrable → passe
        const pc = get().pendingCast;
        if (!pc) { resumeEnemyTurn(get, set); return; } // refus (contrecoup bloquant) — castZoneSpell a journalisé
        // Porte le centre auto-choisi sur le pending (zone non encore posée, `center` reste null pour que le
        // Contre-sort s'intercale) — `castConfirm` PARTAGÉ posera la zone dessus une fois la fenêtre close.
        if (pc.zone) set({ pendingCast: { ...pc, zone: { ...pc.zone, autoCenter: center } } });
        get().castRoll(); // jet figé de l'IA (Surincantation no-op pour une ZdE — toutes cibles arrosées)
        // Fenêtre de Contre-sort (parité missile) : ouvre `pendingCounterspell` si au moins un héros peut
        // Dissiper. Le tour de l'IA est alors SUSPENDU et repris par counterspellConfirm/Cancel → castConfirm.
        routeEnemyCast(get, set);
        if (get().pendingCounterspell) return; // Contre-sort ouvert → counterspell* → castConfirm (pose & reprise)
        // Aucun Contre-sort : MÊME résolveur PARTAGÉ que le missile — castConfirm pose la zone sur autoCenter
        // (caster aiDriven) puis reprend le tour de l'IA. Zéro chemin spécial.
        get().castConfirm();
      }, TEMPO.aimTelegraph);
      return;
    }
    case 'focus': {
      // Focalisation (LDB 46) : on ouvre la modale comme le joueur ; en Auto le driver résout
      // focusRoll→focusConfirm (qui reprend le tour via aiDriven, cf. focusConfirm). Calqué sur reload.
      if (!canAct) return advanceTurn(get, set);
      get().battleFocusSpell(action.spell);
      if (!get().pendingFocus) advanceTurn(get, set);
      return;
    }
    case 'shoot': {
      if (!canAct) return advanceTurn(get, set);
      // Le télégraphe (réticule + ligne pointillée ~0,85 s) est porté par attackThenAdvance — même
      // affordance « qui va être frappé » que la mêlée et le sort (plus de double télégraphe).
      attackThenAdvance(targetOf(action.targetId));
      return;
    }
    case 'reload': {
      // Recharge (Test étendu de Projectiles, LDB 62 l.333) : résolution INLINE (pas de modale ni de Chance —
      // l'IA n'en a pas), MÊME cumul de DR vers l'Indice que le flux joueur (reloadConfirm). Interrompu →
      // recommence à zéro (géré à la prise de Blessure, applyAttackResult). Coûte l'Action ; calque de `recover`.
      if (!canAct) return advanceTurn(get, set);
      const rw = enemy.weapons.find((w) => w.type === 'ranged');
      if (!rw || (rw.reload ?? 0) <= 0 || enemy.loaded) return advanceTurn(get, set); // rien à recharger
      const reloadTarget = reloadDRTarget(rw);
      const progressBefore = enemy.reloadProgress ?? 0;
      const skillValue = combatValue(enemy, 'ranged', rw); // CT + avances Projectiles
      const test = rollTest(skillValue, 'intermediaire', battleRng());
      const drBonus = test.success ? reloadDRBonus(enemy, rw) : 0; // Rechargement rapide / Artilleur (LDB 10)
      const progress = Math.max(0, progressBefore + test.sl + drBonus); // Test étendu : cumul, plancher 0
      if (progress >= reloadTarget) { enemy.loaded = true; enemy.reloadProgress = 0; enemy.chambered = magazineSize(rw); }
      else enemy.reloadProgress = progress;
      // Issue = source UNIQUE avec le flux joueur (describeReload : popin ↔ journal).
      const pr: PendingReload = { actorId: enemy.id, actorName: enemy.name, weaponUid: rw.uid ?? '', reload: reloadTarget, progressBefore, skillValue, difficulty: 'intermediaire', roll: test.roll, target: test.target, sl: test.sl, success: test.success };
      set({ battle: { ...battle, acted: true, log: [...battle.log, ev('reload', describeReload(pr, progress, rw.name), enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => advanceTurn(get, set), beatHold(get, 'afterMove'));
      return;
    }
    case 'melee':
      if (!canAct) return advanceTurn(get, set);
      attackThenAdvance(targetOf(action.targetId));
      return;
    case 'recover': {
      // Se libérer (Empêtré, Test opposé de Force, l.61) / se rouler (En flammes, Athlétisme, l.77).
      // Paramètres du Test lus de la DONNÉE (`EtatData.recover`) par la SOURCE UNIQUE `resolveRecoverTest`
      // (même résolution que le flux joueur). IA = résolution INSTANTANÉE (pas de modale ni de Chance). Coûte l'Action.
      if (!canAct) return advanceTurn(get, set);
      const rt = resolveRecoverTest(enemy, action.state, battle);
      if (!rt) return advanceTurn(get, set); // État non récupérable par Action (pas de `recover` en donnée)
      let success: boolean, netSL: number;
      if (rt.opposed && rt.opponentValue != null) {
        const opp = opposedTest(rt.skillValue, rt.opponentValue, battleRng()); success = opp.attackerWins; netSL = opp.netSL;
      } else {
        const t = rollTest(rt.skillValue, rt.difficulty, battleRng()); success = t.success; netSL = Math.max(0, t.sl);
      }
      const removed = recoveredStacks(netSL, stacks(enemy, action.state), success);
      if (removed > 0) removeCondition(enemy, action.state, removed);
      const line = removed > 0
        ? (action.state === COND.empetre ? tr('cf.enemyFreed', { name: enemy.name, removed }) : tr('cf.enemyDouses', { name: enemy.name, removed }))
        : (action.state === COND.empetre ? tr('cf.enemyStaysEmpetre', { name: enemy.name }) : tr('cf.enemyStaysFlames', { name: enemy.name }));
      set({ battle: { ...battle, log: [...battle.log, ev('condition', line, enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => advanceTurn(get, set), beatHold(get, 'afterMove'));
      return;
    }
    case 'grapple': {
      // Empoignade (LDB 14 l.161) : l'Action d'un Empoigné = Test opposé de FORCE (le « Briser » a déjà été
      // résolu en amont par la boucle de re-décision, comme `spendResource`). Résolution INSTANTANÉE (pas de
      // modale ni de Chance) — calque du `recover` ; le `resolveGrappleWin` PARTAGÉ applique l'issue (joueur+IA).
      if (!canAct) return advanceTurn(get, set);
      const foe = targetOf(action.targetId);
      if (!foe || isOutOfAction(foe) || !areGrappling(enemy, foe)) return advanceTurn(get, set); // lien dénoué entre-temps
      // Politique IA : l'option DÉGÂTS (BF + DR, PA ignorés) — meilleure valeur garantie pour une créature qui
      // l'emporte (les options Empêtrer/Se libérer restent en DONNÉE, offertes au joueur). Test opposé PARTAGÉ
      // avec l'Attaque gratuite de tentacule/langue (`resolveGrappleOpposed`) ; ici il CONSOMME l'Action (l.161).
      const line = resolveGrappleOpposed(get, enemy, foe);
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('attack', line, enemy.id, foe.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
      setTimeout(() => advanceTurn(get, set), beatHold(get, 'postAttack'));
      return;
    }
    case 'manPoste': {
      // « Servir cette pièce » (MDG ch.12) : rejoindre un poste de siège adjacent (chef si non servi, sinon support) —
      // MÊME mutation KIND-AGNOSTIQUE (`serveAtPoste`) que l'action joueur et l'author-time. Coûte l'Action. Re-garde
      // la staleness : disparu, ou déjà rejoint pendant la décision → passe la main (pas de double-ajout).
      if (!canAct) return advanceTurn(get, set);
      const hull = battle.combatants.find((c) => c.id === action.hullId);
      const poste = hull?.postes?.find((p) => p.item.uid === action.posteUid);
      if (!poste || (poste.crewIds ?? []).includes(enemy.id)) return advanceTurn(get, set);
      serveAtPoste(enemy, poste, battle.combatants);
      set({ battle: { ...battle, acted: true, action: null, log: [...battle.log, ev('detail', tr('cs.manPoste', { name: enemy.name, weapon: poste.item.name }), enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => advanceTurn(get, set), beatHold(get, 'afterMove'));
      return;
    }
    case 'move': {
      // Simplification IA assumée (sévérité mineure, relevée par la revue de fidélité) :
      //  • l'IA ne fait JAMAIS de Désengagement (option joueur, LDB 15-Dépl l.84-89) : un
      //    ennemi Engagé qui se repositionne ne paie pas l'Esquive/le sacrifice d'Avantage.
      // PARITÉ d'approche (LDB 15 l.74-82) : Charge à portée de Course si la Marche ne suffit pas,
      // sinon Course (Test d'Athlétisme instantané, pas d'attaque ce tour) — cf. aiApproachPlan.
      const { plan, ran } = aiApproachPlan(input, geom, action, battleRng());
      const mv = plan.kind === 'move' ? plan : action;
      if (ran) battle.log.push(ev('move', tr('cf.enemyRun', { name: enemy.name, skill: enemy.mountId ? tr('cf.skillRide') : tr('cf.skillAthletics'), roll: ran.roll === 100 ? '00' : ran.roll, budget: ran.budget }), enemy.id));
      const wasEngaged = isEngaged(enemy);
      const distBefore = combatDistance(enemy, targetOf(mv.thenTargetId)); // distance de combat AVANT le déplacement
      const fromPos = { ...enemy.pos! }; // position AVANT déplacement (déclenchement de Peur à l'approche)
      const path = pathTo(scene, enemy.pos!, mv.to, { blocked: input.blocked, foot: sizeFootprint(geom.size) });
      // Télégraphe de DÉPLACEMENT (parité héros) : montrer le chemin + la destination AVANT que l'ennemi
      // bouge (« où il va »), puis il glisse dessus. Le mouvement réel + la suite (attaque/fin de tour)
      // sont DIFFÉRÉS après la tenue (beatHold moveTelegraph) — mêmes effets, juste annoncés d'abord.
      set({ actorMove: { id: enemy.id, path: path ?? [{ ...mv.to }] }, battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => {
        set({ actorMove: null }); // toujours retirer le télégraphe (même si le tour est devenu caduc)
        const b = get().battle;
        // Tour caduc (combat fini OU combat/scène relancé pendant le télégraphe → `enemy` n'appartient
        // plus au combat courant) : abandonner SANS muter, sinon on réécrirait l'ancien combat.
        if (!b || b.over || !b.combatants.includes(enemy)) return;
        placeCombatant(enemy, get().scene, mv.to);
        if (geom !== enemy) placeCombatant(geom, get().scene, mv.to); // Combat monté : la monture suit le cavalier (couple solidaire)
        displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.373-374)
        get().faceFromPath(enemy.id, path);
        if (geom !== enemy) get().faceFromPath(geom.id, path);
        bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
        if (geom !== enemy) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
        applyZoneCrossings(get, enemy, path ?? [{ ...mv.to }]); // Mur de feu & co (L11) : traverser coûte
        approachFearTrigger(get, set, enemy, fromPos); // LDB 21 l.29 : source de Peur qui s'approche → Test de Calme ou Brisé
        set({ battle: { ...battle } });
        bus.emit(EVT.SCENE_DIRTY);
        const tgt = targetOf(mv.thenTargetId);
        // La Course a consommé l'Action (LDB 15 l.79) → pas d'attaque en arrivant.
        if (!ran && canAct && combatDistance(enemy, tgt) <= meleeReachTiles(enemy.weapons)) {
          // Charge de l'IA : se ruer au contact depuis une position non-Engagée donne l'Avantage (LDB 15-Dépl l.74-77).
          if (!wasEngaged) {
            const adv = chargeAdvantage(effectiveMovement(geom), distBefore);
            if (adv) {
              campGain(get, enemy, adv);
              enemy.gainedAdvThisRound = true;
              enemy.chargedThisTurn = true; // Charge → Attaque gratuite de Cornes (LDB 85), résolue par aiCreatureFreeAttacks
              // Frappe réactive (LDB 10) : la cible CHARGÉE peut riposter HORS séquence (Test d'Init) avant
              // l'attaque du chargeur — talent d'attaque déclenchée en donnée (`grantFreeAttack onCharged`).
              resolveFreeAttacks(get, set, tgt, 'onCharged', enemy);
            }
          }
          attackThenAdvance(tgt, Math.max(TEMPO.preAttack, approachMs(get, path)));
        } else afterApproach(get, path, () => advanceTurn(get, set));
      }, beatHold(get, 'moveTelegraph'));
      return;
    }
  }
}


