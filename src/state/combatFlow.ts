/**
 * Flux de combat (tour par tour) extrait de store.ts pour le garder navigable.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 * Refacto pure -- comportement preserve.
 */
import type { GameState, BattleState, RevealEntry } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { LootGear, PendingCast, PendingDeviation, PendingBladeTrap, PendingKnockdown } from './pendings';
import { Combatant, ItemInstance, HitLocation, Weapon, DIFFICULTY_MODIFIERS, HIT_LOCATION_LABELS } from '../engine/types';
import { rule } from '../engine/policy';
import { battleRng } from './battleRng';
import { ev, evLines, type CombatEventKind } from './combatLog';
import { TEMPO } from './tempo';
import { walkMs } from '../gameIso/walkPath';
import { facingToward } from '../gameIso/rig/facing';
import type { Dir8 } from './dir8';
import { d10 } from '../engine/dice';
import {
  resolveMelee,
  resolveRanged,
  bestRangedDefense,
  rangedDefenseModes,
  rollRangedAttacker,
  defenseValue,
  combatValue,
  attackModifiers,
  combineMods,
  rollMeleeAttacker,
  rollDisengageAttack,
  attackWeapon,
  hitLocationByShape,
  locationLabel,
  reverseRoll,
  woundsFromHit,
  rangeBandModifier,
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
import { engage, isEngaged, decayEngagement, chargeAdvantage, disengageFrom, clearEngagementOf, reachTiles, meleeReachTiles } from '../engine/engagement';
import { gainAdvantage } from '../engine/advantage';
import { sizeGap } from '../engine/size';
import { footprintTiles, combatDistance, sizeFootprint, occupiesTile } from './footprint';
import { isUnbreakable, resolveQualities, hasQuality, dangerousNine, magazineSize, hasBladeTrap, canPushback, strikesLast, isFirearmQuality } from '../engine/qualities/dispatch';
import { fireTriggers, applyTriggeredEffects, maneuverEffectsOf } from './triggeredEffects';
import { hasStealAdvantage, shieldAdvantageLevel, hasRiposte, talentCritExtraWounds, hasSurpriseSave, talentMagicResistance, hasBraveheart, outnumberCountBonus, hasStunSave, reloadDRBonus, talentFearIndice, fleeMovementBonus, hasFocusHarmony } from '../engine/combatFeatures/dispatch';
import { canStrikeFirst } from '../engine/qualities/dispatch';
import {
  wardSaves, hasChampionDefense, banishedAtZero,
  isStupid, hasRage, isUnstable, isBestial, isTerritorial, hasPerturbingAura,
  traitSeesInDark, isColdBlooded, bellicosePsychImmune, magicResistanceOf, immunityTypes, hasStealthAgBonus, flyMeters, runMultiplier,
  hasTraitKey, asTrait,
} from '../engine/traits/dispatch';
import {
  isMagicMissile,
  prayerWrathTriggered,
  castBlockedBy,
  hasTalent,
  evaluateMissile,
  spellRangeTiles,
  durationClockMinutes,
  castInfo,
  castingValue,
  castPenaltyMod,
  castTestTalentDR,
  knowsCastingSkill,
  isDispellableSpell,
  resolveCounterspell,
  castTestOf,
  rederiveCastSL,
  parseSpellDamage,
  zdeDiameterMeters,
  type CastResult,
  type MissileResult,
  type CounterspellOutcome,
} from '../engine/magic';
import { applyOps, resolveFormula, COMBAT_PERSIST, type GameOp } from '../engine/ops';
import { spellSpecFor } from '../data/spellspecs';
import { applySummon, purgeExpiredSummons } from './summonFlow';
import type { ConjureForm } from '../engine/conjuredWeapons';
import { gainCorruption, corruptionTarget } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import { eligibleTalent, canCastFromGrimoire } from '../engine/grimoire';
import { rollMiscast, type MiscastSeverity } from '../engine/miscast';
import { opposedTest, rollTest, evaluateTest, resolveOpposed, isDoubleRoll } from '../engine/tests';
import { effectiveChar, bonus, refreshWounds } from '../engine/characteristics';
import { partyBest, isSocialTest, socialPsychMod, socialPsychLabel, testValue } from '../engine/skills';
import { recomputeLoadout, itemFromTrapping, customTrapping, weaponWithAmmo, compatibleAmmo, damageArmour } from '../engine/items';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, endOfRound, addCondition, removeCondition, hasCondition, cannotDefend, canTakeAction, applyZeroWounds, loseWounds, tickDeath, usesSuddenDeath, inDeathCondition, stacks, recoveredStacks } from '../engine/conditions';
import { creatureAttacks, venomDifficulty, ATTACK_LABEL, type CreatureAttack } from '../engine/creatureAttacks';
import { hasActiveFlag } from '../engine/activeFlags';
import { suffocationTick } from '../engine/suffocation';
import { domainOf, domainOnHitRiders, domainMissileMods, ghurFearAfterCast, hasArcaneTalent } from '../engine/domainAttributes';
import { losBlockingTiles, decayZones, zonesRoundTick, crossZones, discTiles, wallTiles, metersToTiles, resolveZoneMeters, type BattleZone } from './zones';
import { carryOverState } from '../engine/persistence';
import { rollContraction, contractDisease, hasActiveSymptom, contagiousDiseases, DISEASE_DEFS } from '../engine/disease';
import { hasHealSkill, type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { openRest, placesOfKind } from './restFlow';
import { rollCritical, critLocationRoll, permanentAmputations, type CriticalResolved } from '../engine/critical';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { traumaFromKind, escalateSensoryLoss, consolidateAmputations } from '../engine/trauma';
import { effectiveWeaponDamage, damageWeapon, destroyWeapon, isImprovised, solideSaveThreshold, enchantOnHitConditions, enchantOnHitTests } from '../engine/weaponDamage';
import { TIME_COST } from '../engine/timeCost';
import { DAY_PHASES, minutesUntilNext, DAWN_MINUTE, MINUTES_PER_DAY } from '../engine/clock';
import { restRecovery } from '../engine/rest';
import { feedFromMeal } from '../engine/provisions';
import { runDailyUpkeep } from './upkeep';
import { findSpell } from '../data/index';
import { toBrass, fromBrass } from '../engine/money';
import { Scene, Effect, isWalkable } from './scene';
import { sweepDismountDeaths, mountedAttackMods, mountedDodgePenalty, mountMovement, mountOf, mountUp, mountableNear, movementRemaining, canMove } from './mount';
import { lineOfSightCover, coverModifier, smokeZone, tilesBetween } from './lineOfSight';
import { fearSourceFor, resolvePeurTest, resolveTerreurTest, calmeValue, isFrenzyCapable, isPsychImmune, clearPsychOf, resolveFrenzyEntry, targetedTrigger, resolveCalmeSimple, CIBLE_TYPES, CIBLE_LABEL, PsychType } from '../engine/psychology';
import { groupMatch } from '../engine/groups';
import { sceneCombatModifiers } from './sceneRules';
import { reachable, moveReachFor, flyReachable, pushAway, pathTo, chebyshev, Pt } from './path';
import { chooseEnemyAction, type EnemyAction, type EnemyTurnInput } from './ai';
import { resolveRun } from '../engine/movement';
import type { RNG } from '../engine/dice';
import { bus, EVT } from './bus';
// Géométrie de combat extraite (placement/déplacement/zones/flanc-dos/vision) — importée pour
// l'usage interne ET ré-exportée (baril) pour les importeurs de combatFlow.
import {
  occupied, pushBackTiles, findFreeTile, displaceSmaller, removeEntity, inRect,
  applyZoneCrossings, isFlankOrRear, seesInDark, smokeOf,
} from './combatGeometry';
export * from './combatGeometry';


// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

export function activeCombatant(battle: BattleState): Combatant | undefined {
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]);
}

// --- Effets de scène/campagne extraits → combatEffects.ts (baril) ---
export * from './combatEffects';
import { pushReveal, pushCombatStep, applyEffects, gearFromEffects, runSpellFlow } from './combatEffects';
import { spellFlowFor, spellOps, type Flow } from './flow';
import { startCascade, registerCascadeApplier } from './cascade';

/** Le défenseur choisit sa meilleure réaction : Parade (Corps à corps) ou Esquive
 *  (Agilité + avances, pénalité d'Encombrement incluse) — la plus haute valeur. */
export function bestDefenseMode(defender: Combatant): 'parade' | 'esquive' {
  // Bestial (LDB 85 p.338) : « En défense, elle peut seulement utiliser la Compétence Esquive. »
  if (isBestial(defender.traits)) return 'esquive';
  return defenseValue(defender, 'esquive') > defenseValue(defender, 'parade') ? 'esquive' : 'parade';
}

/** Sonné : tout adversaire qui frappe la cible en CORPS À CORPS gagne +1 Avantage
 *  AVANT son attaque (LDB États l.123) — ce +1 profite donc déjà au jet en cours puis
 *  persiste. À appeler une seule fois par attaque (avant le 1er jet ; pas sur une relance). */
export function applySonneMeleeAdvantage(attacker: Combatant, target: Combatant): void {
  if (attacker.weapons[0]?.type === 'melee' && target.conditions.some((c) => c.name === 'Sonné')) {
    gainAdvantage(attacker);
    attacker.gainedAdvThisRound = true;
  }
}

/** Munition que le héros tirera : celle sélectionnée (`ammoUid`) si compatible, sinon la 1re compatible. */
export function selectedAmmo(attacker: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(attacker, weapon);
  return compat.find((a) => a.uid === attacker.ammoUid) ?? compat[0];
}

/** Arme effectivement tirée : mêlée au contact, distance sinon (Atout Pistolet pour tirer en Combat
 *  rapproché — LDB Armes l.297-298), AUGMENTÉE de la munition pour un héros (Dégâts + Atouts combinés).
 *  Centralisé pour que résolution / Chance / application voient la MÊME arme (munition, Empaleuse, reload). */
export function firedWeapon(attacker: Combatant, target: Combatant, weaponUid?: string): Weapon {
  const adj = combatDistance(attacker, target) <= meleeReachTiles(attacker.weapons); // Allonge incluse (RAW-3)
  // Choix explicite du joueur : l'arme du loadout actif portant cet uid (si présente) ; sinon auto-choix.
  const chosen = weaponUid ? attacker.weapons.find((w) => w.uid === weaponUid) : undefined;
  const w = chosen ?? attackWeapon(attacker.weapons, adj);
  if (w.type === 'ranged' && attacker.kind === 'hero') {
    const ammo = selectedAmmo(attacker, w);
    if (ammo) return weaponWithAmmo(w, ammo);
  }
  return w;
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
    return { allowed: true, lines: [`${attacker.name} surmonte sa honte (FM 🎲 ${t.roll}/${t.target}) et attaque ${target.name} malgré la Bénédiction de Protection.`] };
  }
  return {
    allowed: false,
    lines: [
      `${attacker.name} — Test de Force Mentale Accessible (+20) : 🎲 ${t.roll}/${t.target} → échec.`,
      `${attacker.name} ne peut se résoudre à frapper ${target.name} (Bénédiction de Protection) — il doit choisir une autre cible ou une autre Action.`,
    ],
  };
}

/** Martyr (LDB 42 — L13) : le prêtre (vivant, présent) qui encaisse à la place de `target`, ou null. */
export function martyrGuardOf(battle: BattleState, target: Combatant): Combatant | null {
  const id = (target.activeEffects ?? []).find((e) => e.martyrGuard)?.martyrGuard;
  if (!id || id === target.id) return null;
  const priest = battle.combatants.find((c) => c.id === id);
  return priest && !isOutOfAction(priest) && !priest.dead ? priest : null;
}

/** Aura portée (L11 — Bouclier anti-flèches / Dôme) : vrai si la CIBLE est dans le rayon d'un
 *  porteur vivant de l'aura `field` ET l'attaquant HORS de ce rayon (« provenant de l'extérieur » /
 *  « s'ils entrent dans la Zone d'Effet »). */
export function wardedAgainst(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  field: 'arrowWard' | 'domeWard',
): boolean {
  return combatants.some((w) => !isOutOfAction(w) && w.pos && (w.activeEffects ?? []).some((e) => {
    const ward = e[field];
    if (!ward) return false;
    const r = Math.max(1, Math.ceil(ward.radiusMeters / 2));
    return combatDistance(w, target) <= r && combatDistance(w, attacker) > r;
  }));
}

/** Projectile « constitué de matière organique » (Bouclier anti-flèches, LDB 47 : « comme des
 *  flèches en bois ») : flèches (arcs), carreaux (arbalètes), javelots. Balles de poudre,
 *  pierres de fronde et couteaux de lancer ne le sont pas (« matière non organique »). */
export function organicProjectile(w: Weapon): boolean {
  return /\barc\b|arbal|javelot|fl[èe]che|carreau/i.test(`${w.name} ${w.subType ?? ''}`);
}

// applyZoneCrossings → combatGeometry.ts

/** Surprise au début du combat (LDB 13 l.52-81) : le camp pris en EMBUSCADE (`surprisedSide`) fait, pour
 *  chaque combattant, un Test opposé de Perception vs la Discrétion la plus FAIBLE des embusqueurs (l.77) ;
 *  les vaincus gagnent l'État `Surpris`. Mute les combatants, retourne le journal. */
export function applySurprise(combatants: Combatant[], surprisedSide: 'party' | 'enemies'): string[] {
  const surprisedKind = surprisedSide === 'party' ? 'hero' : 'enemy';
  const surprised = combatants.filter((c) => (surprisedKind === 'hero' ? c.kind === 'hero' : c.kind !== 'hero') && !isOutOfAction(c));
  const ambushers = combatants.filter((c) => (surprisedKind === 'hero' ? c.kind !== 'hero' : c.kind === 'hero') && !isOutOfAction(c));
  if (!surprised.length || !ambushers.length) return [];
  // L'embusqueur de référence = la Discrétion la plus FAIBLE du groupe (l.77). Furtif (LDB 85
  // p.339) : « Ajoutez son bonus d'Agilité au DR de tous ses Tests de Discrétion ».
  const sneak = ambushers.reduce((a, b) => (testValue(b, 'Discrétion') < testValue(a, 'Discrétion') ? b : a));
  const sneakVal = testValue(sneak, 'Discrétion');
  const sneakDR = hasStealthAgBonus(sneak.traits) ? bonus(effectiveChar(sneak, 'Ag')) : 0;
  const lines: string[] = [];
  for (const c of surprised) {
    // Embusqueur (Discrétion) vs guetteur (Perception) : si l'embusqueur l'emporte → le guetteur est Surpris.
    const aT = rollTest(sneakVal, 'intermediaire', battleRng());
    const dT = rollTest(testValue(c, 'Perception'), 'intermediaire', battleRng());
    if (resolveOpposed({ ...aT, sl: aT.sl + sneakDR }, dT).winner === 'attacker') {
      // Vigilance (LDB 10) : Test de Perception Intermédiaire (+0) pour ignorer la Surprise.
      if (hasSurpriseSave(c) && rollTest(testValue(c, 'Perception'), 'intermediaire', battleRng()).success) {
        lines.push(`${c.name} flaire l'embuscade (Vigilance) : pas de Surprise.`);
        continue;
      }
      addCondition(c, 'Surpris');
      lines.push(`${c.name} est pris par surprise !`);
    }
  }
  return lines;
}

// DIR8_RING / isFlankOrRear → combatGeometry.ts

/** Environnement d'attaque (LdV/couvert/météo/mouvement/tir-mêlée/surnombre/monture) — SOURCE UNIQUE
 *  des modificateurs positionnels/scéniques, partagée par la RÉSOLUTION (`resolveAttack`) ET l'APERÇU
 *  (`previewAttack`), pour que l'aperçu affiche EXACTEMENT ce que le jet appliquera (R4). Pur (lit l'état).
 *  `blocked` = tir sans Ligne de Vue ; `inMelee`/`crowd`/`cm`/`sc` servent à la résolution (tir dévié,
 *  « Tirer dans le tas », dodge météo) — l'aperçu n'utilise que `env`/`blocked`. */
// seesInDark → combatGeometry.ts

export interface AttackEnv { env: ModLine[]; blocked: boolean; inMelee: boolean; crowd: Combatant[]; cm: ModLine | null; sc: ReturnType<typeof sceneCombatModifiers>; }
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
  if (weapon.type === 'ranged') {
    const occupants = battle.combatants
      .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
      .map((c) => c.pos!);
    const los = lineOfSightCover(scene, attacker.pos!, target.pos!, occupants, smokeOf(battle));
    if (los.blocked) return { env, blocked: true, inMelee: false, crowd: [], cm: null, sc }; // pas de LdV (LDB 13 l.123)
    if (los.cover !== 'none') env.push({ label: `Couvert (${los.cover})`, value: coverModifier(los.cover) });
    // Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne : annule la pénalité d'obscurité.
    if (sc.concealed && !seesInDark(attacker)) env.push({ label: sc.label || 'Obscurité', value: -20 }); // cible dissimulée (LDB 14 l.107)
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
    // Tir dans la mêlée (LDB 14 l.134) : la cible est Engagée avec un allié du tireur.
    const inMelee = (target.engagedWith ?? []).some((id) => {
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
  if (tFacing && isEngaged(target) && attacker.pos && target.pos && isFlankOrRear(tFacing, facingToward(target.pos, attacker.pos)))
    env.push({ label: 'Flanc/dos', value: 20 });
  // Surnombre (LDB 14 l.85/92) : attaquants du camp de l'attaquant au contact de la cible (2 → +20, 3+ → +40).
  const onm = outnumberMod(battle.combatants.filter((c) => c.kind === attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1).length);
  if (onm) env.push(onm);
  env.push(...mountedAttackMods(battle, attacker, target, 'melee')); // Combat monté : +20 cible < monture / −10 viser le cavalier (LDB 14 l.217/219)
  return { env, blocked: false, inMelee: false, crowd: [], cm: null, sc };
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
): { res: AttackResult; weapon: Weapon; victim?: Combatant } | null {
  const dist = combatDistance(attacker, target);
  const weapon = firedWeapon(attacker, target, weaponUid); // arme choisie (ou auto) + munition combinées (héros distance)
  if (dist > reachTiles(weapon) && weapon.type === 'melee') return null; // hors de portée de mêlée (Allonge incluse, RAW-3)
  // (Sonné → +1 Avantage à l'attaquant en mêlée, LDB 16 l.123 : DÉJÀ géré par le flux d'attaque existant.)
  const battle = get().battle!;
  const { env, blocked, inMelee, crowd, cm, sc } = attackEnv(get, attacker, target, weapon, { intoCrowd, heldGround });
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
        stray.log = `Tir dans le tas : ${victim.name} est touché au hasard${rescued ? ' (succès dû au bonus → 0 DR)' : ''}.`;
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
  return { res: resolveMelee(attacker, target, weapon, battleRng(), { defense: bestDefenseMode(target), location, env, dodgeMod: sc.dodgeMod + mountedDodgePenalty(target), dmgProxy }), weapon };
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
  const { env } = attackEnv(get, attacker, target, offWeapon, {});
  const mods = attackModifiers(attacker, target, offWeapon, { kind: 'melee', location: opts?.location, env });
  const toHit = combatValue(attacker, 'melee', offWeapon) + combineMods(mods);
  const atkRoll = opts?.critValue != null ? opts.critValue : reverseRoll(mainRoll);
  const atk = evaluateTest(atkRoll, toHit); // { roll, target, success, sl, isDouble }
  const mode = cannotDefend(target) ? 'none' : bestDefenseMode(target);
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
  const dist = combatDistance(attacker, target);
  const weapon = firedWeapon(attacker, target, opts?.weaponUid);
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
  const inRange = kind === 'ranged' ? rangeBandModifier(dist, weapon.range ?? 0) != null : dist <= reachTiles(weapon);
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
    label: isPrayer ? 'Prière' : `Incantation / NI ${ni}`, // le test reste Langue (Magick) — « Projectile magique » ne change QUE Localisation/Dégâts après réussite (LDB 46 l.155-156)
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
export function eligibleAttackTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === 'hero' || isOutOfAction(c) || !c.pos) continue;
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
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'hero' || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === 'hero' || isOutOfAction(c) || !c.pos) continue;
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
  return lineOfSightCover(scene, from, to, [], battle ? smokeOf(battle) : []).blocked;
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
  if (!active || active.kind !== 'hero' || !active.pos) return null;
  if (isEngaged(active) || !canMove(battle, active)) return null; // Engagé : le clic route vers le Désengagement
  const k = `${pt.x},${pt.y}`;
  const reach = displayedReach(get);
  const inWalk = reach.has(k);
  const runReach = inWalk ? null : computeRunReach(get);
  if (!inWalk && !runReach?.has(k)) return null;
  const geom = mountOf(battle, active) ?? active;
  const path = pathTo(scene, active.pos, pt, occupied(battle, geom), sizeFootprint(geom.size)) ?? [];
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
  if (!active || active.kind !== 'hero' || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === 'hero' || isOutOfAction(c) || !c.pos) continue;
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
  // Désengagement GRATUIT du plus grand (LDB 85 l.308-309) : une créature plus grande que TOUS ses
  // adversaires Engagés les écarte et se déplace librement, sans Test ni sacrifice d'Avantage.
  // Plus grand que TOUS ses Engagés (85 l.308-309) OU Nuée (ignore l'Engagement en se déplaçant, l.200) → départ libre.
  const freeDisengage = foes.length > 0 && (mover.swarm || foes.every((f) => sizeGap(mover.size, f.size) >= 1));
  if (!foes.length || freeDisengage) {
    if (freeDisengage) {
      for (const f of foes) disengageFrom(mover, f); // lève les liens Engagé avec les plus petits écartés
      battle.log.push(ev('move', `${mover.name} écarte les plus petits et se déplace librement.`, mover.id));
    }
    // Lien d'Engagement périmé (foe mort/parti) OU désengagement gratuit : rouvrir le déplacement normal.
    const blocked = occupied(battle, mover);
    set({ battle: { ...battle, action: null, reachable: moveReachFor(mover, get().scene!, mover.pos!, effectiveMovement(mover), blocked) } });
    return;
  }
  const maxFoeAdv = Math.max(...foes.map((f) => f.advantage));
  const canSacrifice = mover.advantage > maxFoeAdv; // Avantage strictement supérieur (l.87)
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

/** Case ATTEIGNABLE adjacente à `target` qui coûte le moins de Mouvement (point d'arrivée d'une Charge). */
export function bestAdjacentReachable(reach: Map<string, number>, target: Pt): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (chebyshev({ x, y }, target) !== 1) continue;
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
  if (!active || active.kind !== 'hero' || !active.pos) return new Map();
  if (isEngaged(active) || !canMove(battle, active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  const reach = moveReachFor(geom, scene, active.pos, movementRemaining(battle, active), blocked, sizeFootprint(geom.size));
  return briseFleeFilter(battle, active, reach);
}

/** Brisé (LDB 16 l.55) : fuir seulement — retire toute case qui RAPPROCHE d'un ennemi. */
function briseFleeFilter(battle: BattleState, active: Combatant, reach: Map<string, number>): Map<string, number> {
  if (!hasCondition(active, 'Brisé')) return reach;
  const foes = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return reach;
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
  if (!active || active.kind !== 'hero' || !active.pos) return new Map();
  if (isEngaged(active) || hasCondition(active, 'À Terre') || !canTakeAction(active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  const M = mountMovement(battle, active);
  if (M <= 0) return new Map();
  const reach = moveReachFor(geom, scene, active.pos, M * 3, blocked, sizeFootprint(geom.size));
  return briseFleeFilter(battle, active, reach);
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
  if (isEngaged(enemy) || hasCondition(enemy, 'À Terre') || !canTakeAction(enemy)) return none;
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
  const r = resolveRun(testValue(enemy, enemy.mountId ? 'Chevaucher' : 'Athlétisme'), M, rng);
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
  if (!battle || !scene || !c.frenzied || !c.pos) return null;
  const visible = battle.combatants.filter(
    (e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos && !lineOfSightCover(scene, c.pos!, e.pos!, [], smokeOf(battle)).blocked,
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
export function attackPlan(get: Get, active: Combatant, target: Combatant): AttackPlan {
  const battle = get().battle!;
  const scene = get().scene!;
  if (combatDistance(active, target) <= meleeReachTiles(active.weapons)) return { kind: 'attack' };
  // L'arme du SET ACTIF décide : une arme à distance présente → tir. Gate PRÉ-clic (parité sort) :
  // sans Ligne de Vue (LDB 13 l.123) ou au-delà de la bande Extrême (Portée ×3), refuser AVANT la
  // modale — sinon « Lancer » fabrique un raté garanti qui consomme l'Action. Les gates de la
  // résolution restent (défense en profondeur) ; rechargement/munitions restent gérés au commit.
  if (attackWeapon(active.weapons, false).type === 'ranged') {
    const p = previewAttack(get, active, target);
    if (p.blocked) return { kind: 'blocked', reason: 'Pas de ligne de vue (cible masquée).' };
    if (!p.inRange) return { kind: 'blocked', reason: 'Cible hors de portée.' };
    return { kind: 'attack' };
  }
  // Mêlée hors d'Allonge :
  if (isEngaged(active)) return { kind: 'blocked', reason: 'Engagé : se désengager avant de rejoindre une autre cible.' };
  const geom = mountOf(battle, active) ?? active;
  const blocked = occupied(battle, geom);
  if (battle.movementUsed === 0 && !hasCondition(active, 'À Terre')) {
    // Charge (LDB 15 l.74-77) : manœuvre PLEINE, portée de Course (2M × Bond/Foulée), arrivée
    // adjacente la moins chère.
    const M = mountMovement(battle, active);
    const reach = moveReachFor(geom, scene, active.pos!, Math.floor(M * 2 * runMultiplier(geom.traits)), blocked, sizeFootprint(geom.size));
    const dest = bestAdjacentReachable(reach, target.pos!);
    if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de Charge.' };
    return { kind: 'charge', dest, path: pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size)) ?? [], adv: chargeAdvantage(M, chebyshev(active.pos!, target.pos!)) };
  }
  // Mouvement entamé (ou À Terre) : rejoindre dans la Marche restante.
  const reach = displayedReach(get);
  const dest = bestAdjacentReachable(reach, target.pos!);
  if (!dest) return { kind: 'blocked', reason: 'Cible hors de portée de mêlée.' };
  return { kind: 'moveAttack', dest, path: pathTo(scene, active.pos!, dest, blocked, sizeFootprint(geom.size)) ?? [], cost: reach.get(`${dest.x},${dest.y}`)! };
}

/** Mort d'un combattant : pour un héros à Destin, suspend (pendingFateSave) au lieu de mourir
 *  (LDB ch.17 l.31-35) ; sinon finalise la mort. `restoreWounds` = PB d'avant le coup létal. */
export function finalizeHeroDeath(get: Get, set: SetFn, hero: Combatant, source: 'hit' | 'slow', restoreWounds?: number): void {
  if (hero.kind === 'hero' && (hero.fate ?? 0) > 0) {
    set({ pendingFateSave: { heroId: hero.id, source, restoreWounds } });
  } else {
    hero.dead = true;
  }
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
  chosenCritLocation?: HitLocation, // RAW-2 : localisation CHOISIE (« Je ne faillirai pas ! », LDB 17 l.73)
  ctx?: { attackerId?: string; attackerKind?: Combatant['kind']; weapon?: string; critTwice?: boolean }, // qui inflige le coup + l'arme (→ modale enrichie) ; critTwice = B. de Sauvagerie de l'attaquant
  prerolled?: CriticalResolved, // Critique déjà tiré (déviation : on a montré CE Critique → on l'applique tel quel, sans re-tirer)
  suppressReveal?: boolean, // la modale de déviation a DÉJÀ affiché le Critique → ne pas re-pousser une révélation
): boolean {
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.51-54) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.name === 'Inconscient')) addCondition(target, 'Inconscient');
    log.push(`${target.name} s'effondre, hors de combat.`);
    return false;
  }
  // Coup Critique : localisation fraîche (1d100) SAUF si le joueur l'a choisie via « Je ne faillirai pas ! »
  // (RAW-2, LDB 17 l.73). Hors Coup Critique (overkill), on garde la localisation de la touche.
  const loc = prerolled ? prerolled.location : isCoupCritique ? (chosenCritLocation ?? critLocationRoll(battleRng(), target.bodyShape)) : location;
  const crit = prerolled ?? rollCritical(target, loc, battleRng(), overkill, ctx?.critTwice);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  target.tookCriticalThisFight = true; // fin de combat : Résistance Très Facile (+60) ou Infection Mineure (LDB 20 l.72)
  log.push(crit.log);
  const revealLines = [crit.log];
  // Effets DÉTAILLÉS pour la modale enrichie : chaque trauma (Amputation, Fracture…) AVEC son explication
  // RAW (note) — « à quoi ça correspond » (#critique). Localisation FR, et pas de « (Jambe droite) (jambeD) ».
  const details: { text: string; note?: string }[] = [];
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) {
      const locLbl = HIT_LOCATION_LABELS[t.location];
      const text = t.label.includes(locLbl) ? t.label : `${t.label} (${locLbl})`;
      log.push(`  ↳ ${text}.`);
      revealLines.push(`  ↳ ${text}.`);
      details.push({ text, note: t.note });
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
    target.wounds.current = Math.max(0, target.wounds.current - crit.woundsLoss); // ignore BE+PA, plancher 0
    for (const c of crit.conditions) addCondition(target, c.name, c.value);
    if (crit.note) {
      log.push(`  ↳ ${crit.note}`); // effet long terme journalisé, non simulé
      revealLines.push(`  ↳ ${crit.note}`);
      details.push({ text: crit.note });
    }
  }
  // « Un jet = une modale » : modale de Coup Critique COMPLÈTE (qui inflige + arme + dé + localisation +
  // Blessures + États + effets expliqués), au niveau de la modale d'attaque. (Sautée si la modale de
  // déviation l'a déjà affichée — la déviation fusionne choix ET révélation sur une seule modale.)
  // SEULEMENT si un héros est concerné — il le SUBIT ou l'INFLIGE (arbitrage 2026-06-11, spec coop
  // §4bis) ; un critique purement ennemi↔ennemi reste au journal/bandeau (les lignes sont déjà dans `log`).
  const heroConcerned = target.kind === 'hero' || ctx?.attackerKind === 'hero';
  if (!suppressReveal && heroConcerned) {
    pushReveal(set, {
      kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: revealLines, subjectId: target.id,
      severity: 'grave',
      actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
      crit: { location: HIT_LOCATION_LABELS[crit.location], woundsLost: crit.woundsLoss, conditions: crit.conditions.length ? crit.conditions : undefined },
    });
  }
  return crit.lethal; // « Mort » instantané → finalisé par le caller (sauvetage par Destin possible)
}

/** Construit la révélation d'affichage d'un Coup Critique PRÉ-TIRÉ, SANS muter la cible (pour la modale
 *  de déviation : on montre le Critique qui menace avant le choix Dévier/Subir). Détails de base (sans la
 *  consolidation des amputations multiples, calculée seulement à l'application). */
export function previewCritEntry(target: Combatant, crit: CriticalResolved, ctx?: { attackerId?: string; weapon?: string }): RevealEntry {
  const lines = [crit.log];
  const details: { text: string; note?: string }[] = [];
  for (const t of crit.traumas) {
    const locLbl = HIT_LOCATION_LABELS[t.location];
    const text = t.label.includes(locLbl) ? t.label : `${t.label} (${locLbl})`;
    lines.push(`  ↳ ${text}.`);
    details.push({ text, note: t.note });
  }
  if (!crit.lethal && crit.note) {
    lines.push(`  ↳ ${crit.note}`);
    details.push({ text: crit.note });
  }
  return {
    kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines, subjectId: target.id,
    actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
    crit: { location: HIT_LOCATION_LABELS[crit.location], woundsLost: crit.woundsLoss, conditions: crit.conditions.length ? crit.conditions : undefined },
  };
}

/** Déviation Critique (LDB 63 l.63-66) : sacrifie 1 PA à `loc` pour IGNORER le Critique ; la cible
 *  subit quand même les Blessures normales recalculées avec la PA réduite (probable +1 Blessure). */
function deviateArmour(target: Combatant, weapon: Weapon, res: AttackResult, log: string[]): void {
  damageArmour(target, res.location ?? 'corps');
  const extra = Math.max(0, woundsFromHit(weapon, target, res.location ?? 'corps', res.damage ?? 0) - (res.woundsLost ?? 0));
  if (extra) target.wounds.current = Math.max(0, target.wounds.current - extra);
  log.push(`${target.name} dévie le coup sur son armure (−1 PA, Critique ignoré).`);
}

/** Une armure Bâclée frappée par un Coup Critique à sa localisation casse (LDB 60 l.82) — héros (pièces). */
function breakBacleArmour(target: Combatant, loc: HitLocation, log: string[]): void {
  const piece = (target.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && hasQuality(i, 'Bâclé') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return;
  piece.damageTaken = piece.pa ?? 0; // inutilisable
  recomputeLoadout(target);
  log.push(`L'armure Bâclée de ${target.name} (${loc}) se brise sous le Coup Critique.`);
}

/** « Arme possédant une lame » (Piège-lame, LDB 62 l.292) — la source ne liste pas les armes :
 *  approximation par mots-clés du nom (épées/dagues/haches/armes d'hast à fer tranchant). */
export function weaponHasBlade(w: Weapon | undefined): boolean {
  if (!w || w.type !== 'melee') return false;
  return /épée|epee|dague|lame|rapière|rapiere|cimeterre|couteau|sabre|fauchon|hache|hallebarde|glaive|estoc|faux|coutille|vouge/i.test(w.name);
}

/** Blessure critique « sèche » d'un Test opposé (LDB 14 l.7) : un double réussi inflige une Blessure
 *  critique à l'adversaire indépendamment du vainqueur de l'échange. Localisation dérivée du jet
 *  critique inversé (comme une touche). Un ENNEMI avec de la PA à la zone dévie toujours (−1 PA,
 *  Critique ignoré — parité avec la Déviation auto de l'IA, LDB 63 l.63-66) ; un HÉROS victime le
 *  subit directement (pas de modale de déviation sur ce chemin secondaire — limitation documentée). */
function applyOpposedCritical(
  get: Get,
  set: SetFn,
  victim: Combatant,
  roll: number,
  ctx: { attackerId?: string; weapon?: string },
  log: string[],
): void {
  const loc = hitLocationByShape(reverseRoll(roll), victim.bodyShape);
  if (victim.kind === 'enemy' && (victim.armour[loc] ?? 0) > 0) {
    damageArmour(victim, loc);
    log.push(`${victim.name} dévie le Critique sur son armure (−1 PA, Critique ignoré).`);
    return;
  }
  const currentBefore = victim.wounds.current;
  // B. de Sauvagerie (LDB 41) : l'attaquant à l'origine du double tire deux lancers de Critique.
  const attacker = ctx.attackerId ? get().battle?.combatants.find((c) => c.id === ctx.attackerId) : undefined;
  const lethal = applyCriticalToTarget(victim, loc, true, 0, log, set, undefined,
    { ...ctx, attackerKind: attacker?.kind, critTwice: attacker ? hasActiveFlag(attacker, 'critRollTwice') : undefined });
  if (lethal) finalizeHeroDeath(get, set, victim, 'hit', currentBefore);
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
): boolean {
  // Surpris (LDB 16 l.136) : « après la première tentative effectuée pour vous toucher, vous perdez
  // l'État Surpris ». On le retire après une attaque STANDARD (deviated===undefined) — le +20 / l'absence
  // de défense ont déjà joué pour CELLE-CI ; les suivantes n'en bénéficieront plus. Les attaques GRATUITES
  // groupées d'une créature (Morsure+Piétinement, deviated===false) forment UN assaut-surprise : on garde
  // l'État jusqu'à la fin du Round (sinon la 2ᵉ attaque gratuite rouvrirait une défense en plein milieu).
  if (deviated === undefined && hasCondition(target, 'Surpris')) removeCondition(target, 'Surpris', 1);
  // Démoniaque (Indice+) / Protection (Indice) — LDB 85 p.339/341 : « Lancez 1d10 après chaque coup
  // reçu ; si la créature obtient le nombre de l'Indice ou plus, le coup est ignoré, même critique. »
  // (Les héros n'ont pas ces traits → pas de double-jet sur les reprises de déviation.)
  if (res.hit && res.woundsLost) {
    for (const thr of wardSaves(target.traits)) {
      const d = d10(battleRng());
      if (d >= thr) {
        res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `${target.name} ignore le coup — sauvegarde ${d} ≥ ${thr} (Démoniaque/Protection).` };
        break;
      }
    }
  }
  // Bouclier anti-flèches (LDB 47 — L11) : projectile ORGANIQUE entrant dans la zone → détruit,
  // « n'infligeant aucun Dégât à leur cible ». Le tir et la munition sont consommés normalement.
  if (res.hit && weapon.type === 'ranged' && organicProjectile(weapon)
    && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'arrowWard')) {
    res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `Le projectile se désagrège en entrant dans la zone — ${target.name} est indemne (Bouclier anti-flèches).` };
  }
  // Dôme (LDB 47 — L11) : Protection (6+) contre une attaque À DISTANCE venant de l'extérieur.
  else if (res.hit && res.woundsLost && weapon.type === 'ranged'
    && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'domeWard')) {
    const d = d10(battleRng());
    if (d >= 6) res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `${target.name} est couvert par le Dôme — sauvegarde ${d} ≥ 6, le tir est dévié.` };
  }
  // Martyr (LDB 42 — L13) : « Vous recevez tous les Dégâts subis en principe par vos cibles » —
  // le prêtre encaisse les Dégâts BRUTS de la frappe, mitigés par 2×SON BE + ses PA à la
  // localisation touchée ; la cible ne perd rien (les États de la touche restent sur elle).
  if (res.hit && res.woundsLost) {
    const priest = martyrGuardOf(get().battle!, target);
    if (priest) {
      const loc = res.location ?? 'corps';
      const raw = res.damage ?? res.woundsLost;
      const taken = Math.max(0, raw - 2 * bonus(effectiveChar(priest, 'E')) - Math.max(0, priest.armour[loc] ?? 0));
      if (taken > 0) {
        loseWounds(priest, taken);
        if (priest.wounds.current <= 0) applyZeroWounds(priest);
      }
      res = { ...res, woundsLost: 0, log: `${res.log} Martyr : ${priest.name} reçoit les Dégâts à la place de ${target.name}${taken > 0 ? ` (${taken} PB, BE doublé)` : ' (encaissés sans dommage, BE doublé)'}.` };
    }
  }
  // Perturbante (LDB 62 l.275-276) : mode « Repousser » armé → l'attaque réussie ne cause PAS de
  // Dégâts, l'adversaire recule d'1 m par DR du Test opposé (1 case = 2 m, LDB Déplacement l.55).
  if (attacker.pushbackMode && weapon.type === 'melee' && canPushback(weapon)) {
    attacker.pushbackMode = false; // consommé par cette attaque (réussie ou non)
    if (res.hit) {
      const meters = Math.max(0, res.netSL);
      const wanted = Math.floor(meters / 2);
      const moved = pushBackTiles(get, attacker, target, wanted);
      res = {
        ...res, woundsLost: 0, damage: 0, critical: false,
        log: `${attacker.name} repousse ${target.name} de ${meters} m (Perturbante${moved < wanted ? ' — recul bloqué' : ''}).`,
      };
    }
  }
  // Déviation Critique (LDB 63 l.63-66) : un HÉROS subit un Coup Critique à une localisation où il
  // porte de la PA → on SUSPEND pour son choix Dévier/Subir (modale). AUCUN effet de bord ici ; la
  // résolution (étape 'deviation', resolveDeviation) rappelle cette fonction avec `deviated` défini (early-return sauté →
  // application UNE seule fois). Les sous-attaques (balayage/Piétinement) passent `deviated` explicite
  // pour résoudre instantanément (pas de modale imbriquée). Les sorts (applyCast) gèrent leurs Critiques
  // à part : ils n'atteignent jamais cette fonction, donc pas de garde « arme » nécessaire.
  const dloc = res.location ?? 'corps';
  if (deviated === undefined && res.hit && res.woundsLost && res.critical && target.kind === 'hero') {
    // Pré-tire le Coup Critique (graine figée) pour l'AFFICHER sur la modale de déviation — choix éclairé
    // Dévier/Subir, une seule modale. Aucune mutation de la cible ici ; « Subir » l'appliquera tel quel.
    const overkill = Math.max(0, res.woundsLost - target.wounds.current);
    const cloc = res.critLocation ?? critLocationRoll(battleRng(), target.bodyShape);
    const crit = rollCritical(target, cloc, battleRng(), overkill, hasActiveFlag(attacker, 'critRollTwice'));
    const reveal = previewCritEntry(target, crit, { attackerId: attacker.id, weapon: weapon?.name });
    // Folding P3a : le choix Dévier/Subir devient une ÉTAPE de la séquence (Critique riche + options),
    // au lieu d'une modale `pendingDeviation` séparée. L'applier 'deviation' appelle resolveDeviation.
    const dev: PendingDeviation = { attackerId: attacker.id, targetId: target.id, weapon, res, crit, reveal, resumeAfter: true };
    pushCombatStep(set, {
      id: `cons-deviation-${target.id}`, kind: 'deviation', actorId: target.id, icon: '💥',
      label: 'Coup Critique — dévier ?', options: [{ key: 'devier', label: '🛡️ Dévier (−1 PA)' }, { key: 'subir', label: 'Subir' }],
      defaultChoice: 'subir', deviation: dev, reveal, interactive: true,
    });
    return true; // suspendu — la résolution part de l'applier 'deviation' (resolveDeviation, resume:false)
  }
  const battle = get().battle!;
  attacker.aiming = false; // l'attaque consomme la visée (tir : +20 déjà appliqué ; mêlée : visée gâchée)
  if (attacker.nextActionPenalty) attacker.nextActionPenalty = undefined; // pénalité de Maladresse consommée par ce Test

  if (weapon.type === 'melee') engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13-Combat l.174-175)
  const critLog: string[] = [];
  if (res.hit && res.woundsLost) {
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    const loc = res.location ?? 'corps';
    if (res.critical) breakBacleArmour(target, loc, critLog); // armure Bâclée brisée par le Critique (LDB 60 l.82)
    const autoDeviate = res.critical && target.kind === 'enemy' && (target.armour[loc] ?? 0) > 0; // ennemi : dévie toujours (auto)
    if (res.critical && (autoDeviate || deviated === true)) {
      deviateArmour(target, weapon, res, critLog); // Déviation (auto pour l'ennemi ; choix « Dévier » du héros, LDB 63 l.63-66)
    } else if (res.critical || overkill > 0) {
      // « Subir » après déviation proposée : applique LE Critique déjà montré (prerolledCrit), sans re-tirer
      // ni re-révéler (la modale de déviation l'a affiché). Sinon : tirage + révélation normaux.
      const lethal = applyCriticalToTarget(target, loc, !!res.critical, Math.max(0, overkill), critLog, set, res.critLocation, { attackerId: attacker.id, attackerKind: attacker.kind, weapon: weapon?.name, critTwice: hasActiveFlag(attacker, 'critRollTwice') }, prerolledCrit, !!prerolledCrit);
      // Frappe blessante (LDB 10) : +niveau Blessures quand on inflige une Blessure Critique.
      const fb = talentCritExtraWounds(attacker);
      if (fb > 0 && !lethal) {
        target.wounds.current = Math.max(0, target.wounds.current - fb);
        critLog.push(`Frappe blessante : ${target.name} perd ${fb} Blessure(s) de plus.`);
      }
      // Taillade (Aux Armes p.89) : une Blessure Critique infligée par une arme de Taillade ajoute
      // un État Hémorragique, en plus de tous les effets du Coup Critique.
      if (res.critical && !lethal) {
        for (const { def } of resolveQualities(weapon)) {
          if (!def.onCritCondition) continue;
          addCondition(target, def.onCritCondition);
          critLog.push(`${target.name} : ${def.onCritCondition} (${def.key}).`);
        }
      }
      if (lethal) finalizeHeroDeath(get, set, target, 'hit', currentBefore); // mort directe ou pause Destin
    }
    // 0 PB → À Terre (LDB 18 l.28) : TOUJOURS quand on tombe à 0, EN PLUS du Critique éventuel (l'overkill
    // déclenche une Blessure critique mais ne dispense pas de l'État À Terre) ; sauf si déjà KO/mort.
    if (target.wounds.current <= 0 && !target.dead && !hasCondition(target, 'Inconscient')) applyZeroWounds(target);
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
      critLog.push(`${attacker.name} place un Critique malgré l'échange perdu.`);
      applyOpposedCritical(get, set, target, ad.roll, { attackerId: attacker.id, weapon: weapon?.name }, critLog);
    }
    // (b) Défenseur : Critique sur sa défense → l'attaquant subit un Critique sec. Un HÉROS qui PARE
    // avec une arme Piège-lame face à une lame peut choisir de PIÉGER à la place (LDB 62 l.292-294) → modale.
    if (dd.success && isDoubleRoll(dd.roll) && !isOutOfAction(attacker)) {
      if (target.kind === 'hero' && res.parryWeapon && hasBladeTrap(res.parryWeapon) && weaponHasBlade(weapon)) {
        // Folding P3b : le choix Piéger/Critique devient une ÉTAPE de la séquence (texte + options),
        // au lieu d'une modale `pendingBladeTrap` séparée. L'applier 'bladeTrap' appelle resolveBladeTrap.
        const pbt: PendingBladeTrap = { defenderId: target.id, attackerId: attacker.id, weapon, parryWeaponName: res.parryWeapon.name, defSL: dd.sl, roll: dd.roll };
        pushCombatStep(set, {
          id: `cons-bladetrap-${target.id}`, kind: 'bladeTrap', actorId: target.id, icon: '🗡️',
          label: 'Parade — piéger la lame ?',
          options: [{ key: 'trap', label: '🗡️ Piéger la lame' }, { key: 'crit', label: '💥 Coup Critique' }],
          defaultChoice: 'crit', bladeTrap: pbt,
          outcome: [
            `${target.name} place un Critique en parant avec ${res.parryWeapon.name} — la lame de ${attacker.name} (${weapon.name}) est à portée.`,
            `Piéger : Test opposé de Force (+${dd.sl} DR). Succès → ${attacker.name} lâche sa lame (Stupéfiant → brisée).`,
          ],
          interactive: true,
        });
      } else {
        critLog.push(`${target.name} place un Critique sur sa défense.`);
        applyOpposedCritical(get, set, attacker, dd.roll, { attackerId: target.id, weapon: res.parryWeapon?.name }, critLog);
      }
    }
  }
  // Champion (LDB 85 p.338) : « Si elle gagne un Test opposé en se défendant dans un Combat au
  // Corps à corps, elle cause autant de Dégâts que si elle était l'attaquant. »
  if (weapon.type === 'melee' && res.advantageTo === 'defender' && res.netSL > 0
      && (hasChampionDefense(target.traits) || (hasRiposte(target) && canStrikeFirst(res.parryWeapon ? [res.parryWeapon] : [])))
      && !isOutOfAction(target) && target.weapons[0]) {
    const riposte = resolveMeleePassive(target, attacker, target.weapons[0],
      { roll: res.defenderRoll ?? 1, target: res.defenderDetail?.target ?? 1, success: true, sl: res.netSL, isDouble: false });
    if (riposte.hit && riposte.woundsLost) {
      const before = attacker.wounds.current;
      attacker.wounds.current = Math.max(0, before - riposte.woundsLost);
      critLog.push(`${target.name} ${hasChampionDefense(target.traits) ? '(Champion)' : '(Riposte)'} inflige ${riposte.woundsLost} Blessure(s) en défendant.`);
      if (attacker.wounds.current <= 0 && !attacker.dead && !hasCondition(attacker, 'Inconscient')) applyZeroWounds(attacker);
      if (isOutOfAction(attacker)) {
        clearEngagementOf(get().battle?.combatants ?? [], attacker.id);
        clearPsychOf(get().battle?.combatants ?? [], attacker.id);
      }
    }
  }
  // Infecté / Maladie (Type) (LDB 85 p.340) : un héros BLESSÉ par la créature porteuse est exposé →
  // Tests de Contraction post-combat (finalizeBattle, LDB 20 l.32/49). Rongeur Infecté → Fièvre du Rongeur.
  if (res.hit && res.woundsLost && target.kind === 'hero') {
    const atkTraits = attacker.traits ?? [];
    if (hasTraitKey(atkTraits, 'Infecté')) {
      target.woundedByInfected = true;
      if (/rat|skaven|rongeur/i.test(attacker.name)) target.woundedByRodent = true;
    }
    // Munition Infecté (Aux Armes p.102 — ferraille/débris souillés) : exposition à l'infection.
    if (hasQuality(weapon, 'Infecté')) target.woundedByInfected = true;
    for (const x of atkTraits) {
      const t = asTrait(x);
      if (t.key === 'Maladie' && t.arg && !(target.diseaseExposure ?? []).includes(t.arg)) {
        target.diseaseExposure = [...(target.diseaseExposure ?? []), t.arg];
      }
    }
  }
  // Nausée (LDB 20 l.170) : un Test de DÉPLACEMENT raté (Esquive) fait vomir → État Sonné.
  if (res.defenderDetail?.label === 'Esquive' && !res.defenderDetail.success
      && hasActiveSymptom(target, 'nausee') && !hasCondition(target, 'Sonné')) {
    addCondition(target, 'Sonné');
    critLog.push(`${target.name} vomit (Nausée) : Sonné.`);
  }
  // Effet DÉCLENCHÉ « à la perte de PB en mêlée » authoré (Sang corrosif : 1d10 aux Engagés, BE+PA,
  // min 1) — dispatcher générique (state/triggeredEffects), plus de handler en dur.
  if (res.hit && res.woundsLost && weapon.type === 'melee') {
    for (const line of fireTriggers(get, target, 'onWoundLoss', { rng: battleRng() })) critLog.push(line);
  }
  // Démoniaque (LDB 85 p.339) : à 0 PB, « son âme retourne immédiatement dans les Royaumes du
  // Chaos, ce qui la retire du jeu » — pas de corps, pas d'Inconscient.
  if (res.hit && target.wounds.current <= 0 && banishedAtZero(target.traits) && !target.dead) {
    target.dead = true;
    critLog.push(`${target.name} est bannie — son essence retourne aux Royaumes du Chaos !`);
  }
  // Effet déclenché « à la mise hors de combat d'un adversaire » authoré (Affamé : Test de FM ou
  // festoie — perd Action + Mouvement) — dispatcher générique (state/triggeredEffects).
  if (res.hit && isOutOfAction(target) && !isOutOfAction(attacker)) {
    for (const line of fireTriggers(get, attacker, 'onKill', { rng: battleRng() })) critLog.push(line);
  }
  // Taille (arme) : sur une touche réussie, endommage de 1 PA l'armure frappée (LDB 63 l.8).
  if (res.hit && hasQuality(weapon, 'Taille')) damageArmour(target, res.location ?? 'corps');
  // Munition héros : consommée à l'application ; arme à Recharge → déchargée (Test étendu requis pour recharger).
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    attacker.shotsThisTurn = (attacker.shotsThisTurn ?? 0) + 1; // Salve : compteur de tirs du tour (−10 cumulatif)
    const used = selectedAmmo(attacker, weapon);
    if (used && (used.qty ?? 0) > 0) {
      used.qty = (used.qty ?? 0) - 1;
      if (used.qty <= 0) attacker.items = (attacker.items ?? []).filter((i) => i.uid !== used.uid);
    }
    if ((weapon.reload ?? 0) > 0) {
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
  }
  // Interruption du rechargement (LDB 63-Armures l.29) : un héros touché en plein rechargement recommence à zéro.
  if (res.hit && res.woundsLost && target.kind === 'hero' && (target.reloadProgress ?? 0) > 0) target.reloadProgress = 0;
  // Qualités à effet « à la touche » (hook `onHit` du registre) : ex. Assommante — touche à la Tête →
  // Test opposé F vs Endurance+Résistance ; si l'attaquant l'emporte, la cible gagne l'État Sonné (LDB Armes l.268).
  let assommanteLog: string | null = null;
  if (res.hit) {
    for (const { def } of resolveQualities(weapon)) {
      const oh = def.onHit;
      if (!oh || (oh.location && res.location !== oh.location)) continue;
      const skillAdv = oh.opposed.defenderSkill
        ? target.skills.find((s) => s.name.toLowerCase().startsWith(oh.opposed.defenderSkill!.toLowerCase()))?.advances ?? 0
        : 0;
      const defVal = effectiveChar(target, oh.opposed.defender) + skillAdv;
      if (opposedTest(effectiveChar(attacker, oh.opposed.attacker), defVal, battleRng()).winner === 'attacker') {
        addCondition(target, oh.condition);
        assommanteLog = `${target.name} est ${oh.condition} (${def.key}).`;
        // Modale seulement si un héros subit OU inflige (spec coop §4bis) ; sinon journal/bandeau.
        if (target.kind === 'hero' || attacker.kind === 'hero')
          pushReveal(set, { kind: 'assommante', title: def.key, lines: [assommanteLog], subjectId: target.id, severity: 'minor' }); // « un jet = une modale » (Test opposé)
      }
    }
    // États « à la touche » des ENCHANTEMENTS d'arme actifs du porteur (Jalon 2.6 — Marteau
    // ardent : « toute cible frappée reçoit En flammes et À Terre » ; Épée ardente de Rhuin :
    // « quiconque est frappé gagne +1 En flammes »). RAW : sans Test, à la touche.
    if (weapon.type === 'melee') {
      const inGroups = (only?: string[], except?: string[]) =>
        (!only || only.some((g) => groupMatch(g, target.groups ?? [])))
        && (!except || !except.some((g) => groupMatch(g, target.groups ?? [])));
      for (const cond of enchantOnHitConditions(attacker, weapon)) {
        if (!inGroups(cond.onlyGroups)) continue; // ex. « Criminel » seulement (système de Groupes)
        addCondition(target, cond.name, cond.value ?? 1);
        assommanteLog = `${target.name} reçoit ${cond.value ?? 1} État ${cond.name} (arme enchantée).`;
      }
      // Test à la touche gaté par Groupe (Épée de justice : un Criminel teste Résistance ou tombe
      // Inconscient ; Morsure de l'hiver : une cible vivante teste ou gagne Sonné). RAW : Test à la touche.
      for (const ht of enchantOnHitTests(attacker, weapon)) {
        if (!ht || !inGroups(ht.onlyGroups, ht.exceptGroups)) continue;
        const t = rollTest(testValue(target, ht.skill), ht.difficulty, battleRng());
        if (!t.success) {
          for (const c of ht.onFail) addCondition(target, c.name, c.value ?? 1);
          assommanteLog = `${target.name} échoue à son Test de ${ht.skill} (arme enchantée) — ${ht.onFail.map((c) => c.name).join(', ')}.`;
        }
      }
    }
  }
  // Avantage (LDB Déplacement l.30-40) : +1 au vainqueur du Test opposé / sur une
  // Blessure infligée sans Test opposé (tir) ; perte de TOUT l'Avantage en échouant
  // un Test opposé ou en perdant une Blessure.
  if (res.advantageTo === 'attacker' && !deferAttackerAdvantage) {
    // Renversement (LDB 10) : « au lieu de gagner +1 Avantage, vous prenez tous les Avantages
    // actuels de votre adversaire » — appliqué quand c'est mieux que +1.
    if (weapon.type === 'melee' && hasStealAdvantage(attacker) && (target.advantage ?? 0) > 1) {
      gainAdvantage(attacker, target.advantage);
      target.advantage = 0;
      critLog.push(`${attacker.name} renverse l'échange et vole tous les Avantages (Renversement).`);
    } else gainAdvantage(attacker);
    attacker.gainedAdvThisRound = true;
  }
  if (res.advantageTo === 'defender') {
    // Renversement côté défenseur (même règle) ; Porte-Bouclier (LDB 10) : +niveau Avantage en
    // défense gagnée au Bouclier.
    if (weapon.type === 'melee' && hasStealAdvantage(target) && (attacker.advantage ?? 0) > 1) {
      gainAdvantage(target, attacker.advantage);
      critLog.push(`${target.name} renverse l'échange et vole tous les Avantages (Renversement).`);
    } else gainAdvantage(target);
    gainAdvantage(target, shieldAdvantageLevel(target, res.parryWeapon));
    target.gainedAdvThisRound = true;
    attacker.advantage = 0; // l'attaquant a échoué au Test opposé
  }
  if (res.hit && res.woundsLost) target.advantage = 0; // perdre une Blessure → perte de tout Avantage
  const kind = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const defense = weapon.type === 'ranged' ? 'none' : bestDefenseMode(target);
  // Orientation : l'attaquant se tourne vers la cible, le défenseur vers l'attaquant (frappe offensive).
  if (attacker.pos && target.pos) {
    set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
  }
  // `weapon`/`parryWeapon` voyagent dans l'événement : le rig joue le geste de l'arme EMPLOYÉE
  // (2e frappe de dague gauche, tentacule…) et la parade de l'arme QUI A PARÉ (main-gauche,
  // bouclier) — pas ceux de l'arme principale.
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense, weapon, parryWeapon: res.parryWeapon, creatureAttack: creatureAttackKind(weapon.name) });
  const evKind: CombatEventKind = weapon.type === 'ranged' ? 'shoot' : 'attack';
  const log = [...battle.log, ev(evKind, res.log, attacker.id, target.id)];
  log.push(...evLines(critLog, 'crit', attacker.id, target.id));
  if (assommanteLog) log.push(ev('condition', assommanteLog, target.id));
  // Nerveux (LDB 85 p.340) : « facilement effrayée par […] les bruits forts » — un coup d'arme à
  // feu (Poudre noire/Explosion) terrifie les créatures Nerveuses présentes : +3 État Brisé.
  if (weapon.type === 'ranged' && isFirearmQuality(weapon)) {
    for (const c of battle.combatants) {
      // Nerveux (effet déclenché onStartled : +3 Brisé) — fired par le dispatcher générique (no-op si absent).
      if (!isOutOfAction(c)) for (const line of fireTriggers(get, c, 'onStartled', {})) log.push(ev('condition', line, c.id));
    }
  }
  // Effets DÉCLENCHÉS « à la touche » authorés (donnée éditable) : Traits de l'attaquant (Toile…) ET
  // Atouts de l'arme (Immobilisante, Atout custom « 1d10 + Empêtré »…). UN dispatcher générique
  // (state/triggeredEffects) remplace les handlers en dur — Trait et Atout traités à l'identique.
  if (res.hit) for (const line of fireTriggers(get, attacker, 'onHit', { victim: target, weapon, rng: battleRng() })) log.push(ev('condition', line, target.id));
  // Déstabilisante (Aux Armes p.89) : après une touche, l'attaquant PEUT dépenser des Avantages pour
  // un Test opposé Force/Athlétisme ; gagné, la cible est mise À Terre. HÉROS → étape de CHOIX de la
  // cascade d'attaque (pushCombatStep, applier 'knockdown') ; IA → déclenché d'office.
  if (res.hit && weapon.type === 'melee' && !isOutOfAction(target)) {
    for (const { def } of resolveQualities(weapon)) {
      const kd = def.onHitKnockdown;
      if (!kd || (attacker.advantage ?? 0) < kd.advantageCost || hasCondition(target, kd.condition)) continue;
      if (attacker.kind === 'hero') {
        // Folding (comme Déviation/Piège-lame) : le choix du Renversement devient une ÉTAPE de CHOIX de
        // la cascade d'ATTAQUE (plus de modale `pendingKnockdown` séparée). L'applier 'knockdown' rejoue
        // resolveKnockdown sur l'option. L'attaquant/cible sont déjà montrés par la ligne d'attaque figée.
        pushCombatStep(set, {
          id: `cons-knockdown-${target.id}`, kind: 'knockdown', actorId: attacker.id, icon: '🤜',
          label: `🤜 ${def.key} — renverser ?`,
          options: [{ key: 'yes', label: `Renverser (${kd.advantageCost} Av)` }, { key: 'no', label: 'Renoncer' }],
          defaultChoice: 'no', interactive: true,
          knockdown: { attackerId: attacker.id, targetId: target.id, weaponName: weapon.name, quality: def.key, advantageCost: kd.advantageCost, char: kd.char, skill: kd.skill, condition: kd.condition },
        });
        break; // un seul renversement proposé par touche
      }
      attacker.advantage = (attacker.advantage ?? 0) - kd.advantageCost;
      const aSk = kd.skill ? (attacker.skills.find((s) => s.name.toLowerCase().startsWith(kd.skill!.toLowerCase()))?.advances ?? 0) : 0;
      const dSk = kd.skill ? (target.skills.find((s) => s.name.toLowerCase().startsWith(kd.skill!.toLowerCase()))?.advances ?? 0) : 0;
      const won = opposedTest(effectiveChar(attacker, kd.char) + aSk, effectiveChar(target, kd.char) + dSk, battleRng()).winner === 'attacker';
      if (won) {
        addCondition(target, kd.condition);
        const dline = `${target.name} est ${kd.condition} (${def.key}, ${kd.advantageCost} Avantages).`;
        log.push(ev('condition', dline, target.id));
        if (target.kind === 'hero') pushReveal(set, { kind: 'assommante', title: def.key, lines: [dline], subjectId: target.id, severity: 'minor' });
      } else {
        log.push(ev('detail', `${attacker.name} cherche à renverser ${target.name} (${def.key}, ${kd.advantageCost} Avantages) — sans succès.`, target.id));
      }
    }
  }
  // Tir de zone (Aux Armes p.89) : nuage de projectiles. À bout portant (≤ 1 case ≈ 2 m) → +Indice
  // Dégâts sur la cible ; à portée → la touche frappe AUSSI les Indice créatures les plus proches
  // (≤ Indice mètres, 1 case = 2 m). Réutilise la géométrie de zone (comme le Souffle de créature).
  if (res.hit && weapon.type === 'ranged' && res.damage != null && attacker.pos && target.pos && !isOutOfAction(target)) {
    const tz = resolveQualities(weapon).find((r) => r.def.areaFire);
    if (tz) {
      const indice = tz.indice ?? 1;
      if (chebyshev(attacker.pos, target.pos) <= 1) {
        loseWounds(target, indice);
        log.push(ev('shoot', `Tir de zone à bout portant : ${target.name} subit ${indice} Blessure(s) de plus.`, target.id));
      } else {
        const radTiles = Math.max(1, Math.ceil(indice / 2));
        const near = battle.combatants
          .filter((c) => c.kind !== attacker.kind && c.id !== target.id && !isOutOfAction(c) && c.pos && chebyshev(target.pos!, c.pos) <= radTiles)
          .sort((a, b) => chebyshev(target.pos!, a.pos!) - chebyshev(target.pos!, b.pos!))
          .slice(0, indice);
        for (const sec of near) {
          const wl = woundsFromHit(weapon, sec, res.location ?? 'corps', res.damage);
          if (wl > 0) {
            loseWounds(sec, wl);
            log.push(ev('shoot', `Tir de zone : ${sec.name} est aussi pris dans la gerbe — ${wl} Blessure(s).`, sec.id));
          }
        }
      }
    }
  }
  // Interruption de Focalisation (LDB 46 l.193-194) : Dégâts subis pendant qu'on focalise
  // → Test de Calme Difficile (−20) ou perte des DR accumulés + Imparfaite Mineure.
  if (res.hit && res.woundsLost) log.push(...evLines(checkFocusInterruption(get, set, target), 'detail', target.id));
  if (isOutOfAction(target)) log.push(ev('death', `${target.name} est mis hors de combat !`, target.id));
  // Salve (Aux Armes p.126) : un héros qui tire une arme à Salve gardant des tirs (chambered > 0) ne
  // consomme PAS son Action — il peut tirer encore ce tour (chaque tir suivant à −10 cumulatif).
  const salvoContinues = attacker.kind === 'hero' && weapon.type === 'ranged' && hasQuality(weapon, 'Salve') && (attacker.chambered ?? 0) > 0;
  set({ battle: { ...battle, acted: !salvoContinues, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resolveEnemyFumble(get, set, attacker, weapon, res); // Maladresse d'un ENNEMI attaquant → résolue instantanément
  // Maladresse d'un ENNEMI défenseur (Test opposé, LDB 14 l.48-51) : sa Parade/Esquive ratée sur un double.
  if (target.kind === 'enemy' && defenderFumbled(res, target.weapons[0]) && !isOutOfAction(target) && target.weapons[0]) {
    applyOups(get, set, target, target.weapons[0], rollOups(target.weapons[0], battleRng()));
  }
  return false; // non suspendu : application complète terminée
}

/**
 * Interruption de Focalisation (LDB 46 l.193-194) : « Si vous êtes perturbé par
 * quelque chose — bruits forts, Dégâts subis… — vous devrez réussir un Test de
 * Calme Difficile (−20) ou subir une Incantation Imparfaite Mineure et perdre
 * tous les DR accumulés au Test étendu de Focalisation. » Jet SUBI auto-résolu,
 * révélé au joueur pour un héros (kind 'calme' — précédent : Calme de Fuite).
 */
export function checkFocusInterruption(get: Get, set: SetFn, target: Combatant): string[] {
  if (!target.focus || target.focus.dr <= 0) return [];
  const t = rollTest(testValue(target, 'Calme'), 'difficile', battleRng());
  const lines = [
    `${target.name}, frappé en pleine Focalisation — Test de Calme Difficile (−20) : 🎲 ${t.roll}/${t.target} → ${t.success ? 'concentration maintenue' : 'concentration BRISÉE'}.`,
  ];
  if (!t.success) {
    lines.push(`${target.name} perd les ${target.focus.dr} DR focalisés sur ${target.focus.spell}.`);
    target.focus = undefined;
    lines.push(...applyMiscast(get, set, target, 'mineure', { suppressReveal: true })); // la révélation « Calme » ci-dessous porte déjà ces lignes
  }
  if (target.kind === 'hero')
    pushReveal(set, { kind: 'calme', title: 'Focalisation interrompue', dice: t.roll, lines: [...lines], subjectId: target.id, severity: 'minor' });
  return lines;
}

/** Une Maladresse de l'attaquant dans un résultat d'attaque ? (jet propre raté + double, LDB 14 l.53 ;
 *  arme Dangereuse : aussi tout jet raté incluant un 9, LDB 63 l.13-14). */
export function attackerFumbled(res: AttackResult, weapon?: Weapon): boolean {
  if (!res.attackerDetail) return false;
  const { roll, success } = res.attackerDetail;
  return isFumble(roll, success) || dangerousNine(weapon, roll, success);
}

/** Une Maladresse du DÉFENSEUR (Test opposé) : sa défense propre ratée sur un double (LDB 14 l.48-51 ;
 *  parade avec une arme Dangereuse : aussi tout jet raté incluant un 9, LDB 63 l.13-14). */
export function defenderFumbled(res: AttackResult, parryWeapon?: Weapon): boolean {
  if (!res.defenderDetail) return false;
  const { roll, success } = res.defenderDetail;
  return isFumble(roll, success) || dangerousNine(parryWeapon, roll, success);
}

/** Alliés (même camp) encore actifs, hors `c`, et À PORTÉE de `weapon` (LDB 14 l.42-46 : « à
 *  distance »). Tir → dans la bande de portée ; mêlée → portée d'Allonge de l'arme (`reachTiles`).
 *  Sans position connue (tests), on ne filtre pas. */
function alliesAtRange(battle: BattleState, c: Combatant, weapon: Weapon): Combatant[] {
  const allies = battle.combatants.filter((x) => x.id !== c.id && x.kind === c.kind && !isOutOfAction(x));
  if (!c.pos) return allies;
  return allies.filter((a) => {
    if (!a.pos) return true;
    const d = combatDistance(c, a);
    if (weapon.type === 'ranged' && weapon.range) return rangeBandModifier(d, weapon.range) != null;
    return d <= reachTiles(weapon);
  });
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
  if (hasQuality(weapon, 'Bâclé')) wearActiveWeapon(c, weapon, true);
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
      c.traumas = [...(c.traumas ?? []), traumaFromKind('dechirure', 'mineur', leg, { be: bonus(effectiveChar(c, 'E')) })];
      log.push(`  ↳ Déchirure musculaire (Mineure) à la ${leg === 'jambeG' ? 'jambe gauche' : 'jambe droite'}.`);
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
        log.push(`  ↳ Touche ${ally.name} (${locationLabel(loc, ally.bodyShape)}) : ${lost} Blessure(s).`);
      } else {
        addCondition(c, 'Sonné'); // « Si personne n'est à distance, vous vous frappez tout seul → Sonné » (l.45-46)
        log.push(`  ↳ Personne à portée : se frappe seul → Sonné.`);
      }
      break;
    }
    case 'misfire': {
      const lost = woundsFromHit(weapon, c, 'brasD', effectiveWeaponDamage(weapon, sb) + units); // plancher 1
      c.wounds.current = Math.max(0, c.wounds.current - lost);
      if (c.wounds.current <= 0) applyZeroWounds(c);
      wearActiveWeapon(c, weapon, true); // arme détruite, persistée sur l'ItemInstance source
      log.push(`  ↳ Incident de Tir : ${lost} Blessure(s) au Bras principal, arme détruite.`);
      break;
    }
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'info', c.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Maladresse d'un ENNEMI : résolue instantanément (IA abstraite). No-op si pas un ennemi/pas de fumble. */
export function resolveEnemyFumble(get: Get, set: SetFn, enemy: Combatant, weapon: Weapon, res: AttackResult): void {
  if (enemy.kind !== 'enemy' || !attackerFumbled(res, weapon)) return;
  applyOups(get, set, enemy, weapon, rollOups(weapon, battleRng()));
}

/** Ouvre la modale de défense réactive si l'attaque est : ennemi → héros, en mêlée,
 *  à portée, cible CAPABLE de se défendre (pas Surpris). Fige le jet d'attaque et
 *  suspend le tour de l'IA. Retourne true si la modale s'est ouverte. */
export function maybeOpenDefense(
  get: Get,
  set: SetFn,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon = attacker.weapons[0],
  free?: { kind: string; prevActed: boolean },
): boolean {
  if (attacker.kind !== 'enemy' || target.kind !== 'hero') return false;
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
    return true;
  }
  if (weapon?.type !== 'melee') return false;
  if (combatDistance(attacker, target) > reachTiles(weapon)) return false; // Allonge incluse (RAW-3)
  if (cannotDefend(target)) return false; // Surpris → résolution instantanée (LDB États l.132)
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée, AVANT le jet (une seule fois)
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
    if (b0) set({ battle: { ...b0, log: [...b0.log, ev('shoot', `${attacker.name} vise ${target.name}.`, attacker.id, target.id)] } });
  }
  applySonneMeleeAdvantage(attacker, target); // +1 Avantage si cible Sonnée (LDB États l.123), avant le jet
  // Charge montée (LDB 14 l.223) : si l'attaquant a chargé ce tour, ses dégâts utilisent la Force + la
  // Taille de sa monture — PARITÉ avec le joueur (le proxy ne s'applique que s'il chevauche réellement).
  const r = resolveAttack(get, attacker, target, undefined, attacker.chargedThisTurn);
  if (!r) {
    get().log(firedWeapon(attacker, target).type === 'ranged' ? 'Pas de ligne de vue (cible masquée).' : 'Cible hors de portée de mêlée.');
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
 *  n'ouvrent pas de modale de défense interactive (simplification documentée pour l'IA). */
export function autoCleave(get: Get, set: SetFn, attacker: Combatant, primaryTarget: Combatant, res: AttackResult): void {
  if (attacker.kind !== 'enemy') return;
  const sizeCleave = !!res.cleave; // Taille/Nuée : enchaîne sur une simple TOUCHE (LDB 85 l.299)
  // Frappe Mortelle (option, hors Taille) : enchaîner seulement après avoir TUÉ en un coup (LDB 14 l.9).
  const fm = !sizeCleave && !!rule('combat-frappe-mortelle') && isOutOfAction(primaryTarget);
  if (!sizeCleave && !fm) return;
  const bcc = bonus(effectiveChar(attacker, 'CC'));
  if (bcc < 1) return;
  const hitIds = [primaryTarget.id];
  // Cible primaire tuée → l'attaquant se déplace sur sa case avant d'enchaîner (l.10).
  if (isOutOfAction(primaryTarget) && primaryTarget.pos) {
    attacker.pos = { ...primaryTarget.pos };
    displaceSmaller(get, attacker); // en se recalant, un grand dégage les plus petits sous son empreinte (85 l.308-309)
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
      attacker.pos = { ...next.pos }; // se déplace sur la case libérée
      displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.308-309)
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
  if (attacker.kind !== 'hero') return;
  const pc = get().pendingCleave;
  const sizeCleave = !!res.cleave; // Taille : enchaîne sur une simple TOUCHE (LDB 85 l.299)
  // Démarrage Frappe Mortelle (option, hors Taille) : la cible doit être TUÉE en un coup (LDB 14 l.9).
  const fmStart = !pc && !sizeCleave && !!rule('combat-frappe-mortelle') && isOutOfAction(target);
  if (!pc && !sizeCleave && !fmStart) return; // ni balayage en cours, ni déclenché par cette touche
  const fm = pc ? !!pc.fm : fmStart; // mode porté par le pending (Taille vs Frappe Mortelle)
  const count = wasChain ? (pc?.count ?? 0) + 1 : pc?.count ?? 0; // un enchaînement résolu consomme une attaque
  const hitIds = pc ? [...new Set([...pc.hitIds, target.id])] : [target.id];
  if (isOutOfAction(target) && target.pos) {
    attacker.pos = { ...target.pos }; // case libérée (l.10)
    displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.308-309)
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
export const TRAMPLE_WEAPON: Weapon = { name: 'Piétinement', type: 'melee', damage: '+BF', qualities: [] };

/** Cible de Piétinement valide pour `c` (LDB 85 l.320-321) : adversaire ADJACENT, encore actif et
 *  PLUS PETIT (`sizeGap >= 1`). `targetId` borne la recherche à une cible précise (clic du joueur). */
export function trampleTarget(battle: BattleState, c: Combatant, targetId?: string): Combatant | undefined {
  return battle.combatants.find(
    (t) =>
      (targetId ? t.id === targetId : true) &&
      t.kind !== c.kind &&
      !isOutOfAction(t) &&
      !!t.pos &&
      !!c.pos &&
      combatDistance(c, t) <= 1 &&
      sizeGap(c.size, t.size) >= 1,
  );
}

/** Résout un Piétinement : dépense 1 Avantage (coût de l'action gratuite) puis applique
 *  `resolveTrample` (BF +0, Corps à corps). Ne consomme PAS l'Action (« action gratuite »). */
export function applyTrample(get: Get, set: SetFn, attacker: Combatant, target: Combatant): void {
  const prevActed = get().battle?.acted ?? false; // « action gratuite » : ne doit pas consommer l'Action
  attacker.advantage = Math.max(0, attacker.advantage - 1); // coût : 1 Avantage (LDB 85 l.320)
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

/** Attaque LIBRE de Frénésie (LDB 21 l.34 : « un Test de Capacité de Combat gratuit chaque Round ») :
 *  un ennemi frenzied porte une attaque de mêlée supplémentaire avec son arme contre un adversaire
 *  adjacent. Elle NE consomme ni Avantage ni Action. Résolution instantanée — comme autoCleave /
 *  aiMaybeTrample, l'IA ne déclenche pas de modale de défense (simplification documentée). */
export function aiFrenzyAttack(get: Get, set: SetFn, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || !enemy.frenzied || isOutOfAction(enemy)) return;
  const battle = get().battle;
  if (!battle || battle.over || !enemy.pos) return;
  if ((enemy.weapons[0]?.type ?? 'melee') !== 'melee') return; // CC Test = corps à corps
  const target = battle.combatants.find(
    (t) => t.kind !== enemy.kind && !isOutOfAction(t) && !!t.pos && combatDistance(enemy, t) <= 1,
  );
  if (!target) return;
  const prevActed = get().battle?.acted ?? false; // gratuite : on restaure l'état d'Action après coup
  const r = resolveAttack(get, enemy, target);
  if (!r) return;
  applyAttackResult(get, set, enemy, r.victim ?? target, r.weapon, r.res, false); // instantané (pas de modale)
  set({ battle: { ...get().battle!, acted: prevActed } });
}

// ---------------------------------------------------------------------------
// Attaques GRATUITES de créature (Taille & traits) — chacune au prix de 1 Avantage, OPPOSÉE
// (la cible se défend Parade/Esquive, comme une attaque normale) et NE consomme PAS l'Action.
// RAW : Piétinement (LDB 85 l.320-321, BF+0), Morsure/Attaque caudale (l.338/340, Indice) ; priorité
// Morsure/Caudale (Indice) avant Piétinement (BF+0) — cf. exemple Aventures à Ubersreik.
// ---------------------------------------------------------------------------

/** Arme abstraite d'une attaque gratuite : Piétinement = BF+0 ; Morsure/Caudale/Tentacules = +Indice (BF inclus). */
function freeAttackWeapon(kind: string, bonus: number): Weapon {
  if (kind === 'pietinement') return TRAMPLE_WEAPON;
  const name = kind === 'caudale' ? 'Attaque caudale' : kind === 'cornes' ? 'Cornes' : kind === 'tentacules' ? 'Tentacules' : 'Morsure';
  return { name, type: 'melee', damage: `+${bonus}`, qualities: [] };
}

/** Type de pose d'attaque (rendu créature) déduit du NOM de l'arme naturelle, ou undefined (arme
 *  manufacturée → pose générique du gabarit). Sert au tintage de l'animation d'attaque (AnimatedPlanToken). */
export function creatureAttackKind(weaponName: string): string | undefined {
  const n = weaponName.toLowerCase();
  if (n.includes('morsure')) return 'morsure';
  if (n.includes('caudale') || n.includes('queue')) return 'caudale';
  if (n.includes('piétin') || n.includes('pietin')) return 'pietinement';
  if (n.includes('corne')) return 'cornes';
  if (n.includes('tentacule')) return 'tentacules';
  if (n.includes('griffe') || n === 'arme') return 'arme';
  return undefined;
}

/** Difficulté de Test (clé) depuis le libellé FR de la Difficulté du Venin (défaut Intermédiaire). */
function venomDiffKey(label: string): import('../engine/types').Difficulty {
  const l = label.toLowerCase();
  if (l.includes('très facile')) return 'tresFacile';
  if (l.includes('facile')) return 'facile';
  if (l.includes('accessible')) return 'accessible';
  if (l.includes('très difficile')) return 'tresDifficile';
  if (l.includes('difficile')) return 'difficile';
  if (l.includes('complexe')) return 'complexe';
  return 'intermediaire';
}

/** Effets RAW post-touche d'une attaque gratuite (sur PB infligés) :
 *  - Attaque caudale → cible de Taille INFÉRIEURE → À Terre (LDB 85 l.338) ;
 *  - Atout Venin de la créature → Test de Résistance (Endurance) à la Difficulté du Venin ;
 *    sur un échec, la cible subit l'État Empoisonné (LDB 85 l.326, voir p.168). */
export function applyFreeAttackEffects(get: Get, attacker: Combatant, target: Combatant, kind: string, res: AttackResult): void {
  if (!res.hit) return; // les effets se déclenchent sur une touche réussie
  const traits = attacker.traits ?? [];
  // Constricteur (Hydre/Pieuvre, LDB 85) : toute touche → Empêtré (+ Empoignade possible).
  if (hasTraitKey(traits, 'Constricteur') && !hasCondition(target, 'Empêtré')) {
    addCondition(target, 'Empêtré');
    const cond = target.conditions.find((c) => c.name === 'Empêtré'); if (cond) cond.sourceId = attacker.id; // source du Test opposé de Force (LDB 16 l.61)
    get().log(`${target.name} est Empêtré (Constricteur).`);
  }
  if (!res.woundsLost) return; // les effets suivants exigent des Points de Blessure perdus
  // Effets onHit AUTHORÉS de la manœuvre (donnée éditable `maneuver.effects` : Attaque caudale → À Terre
  // si la cible est plus petite ; Tentacules → Empêtré) — appliqués SCOPED à cette manœuvre (≠ l'onHit
  // générique des traits/atouts), via le MÊME exécuteur de Flow.
  const mEffects = maneuverEffectsOf(attacker, kind);
  if (mEffects.length) applyTriggeredEffects(get, attacker, mEffects, 'onHit', { victim: target, woundsDealt: res.woundsLost, rng: battleRng() }).forEach((l) => get().log(l));
  // Vampirique (Vampire/Varghulf, LDB 85) : Morsure infligeant des PB → l'attaquant récupère autant.
  // (DIFFÉRÉ : effet gaté par le KIND d'attaque + possession d'un trait → vocabulaire manquant.)
  if (kind === 'morsure' && hasTraitKey(traits, 'Vampirique')) {
    attacker.wounds.current = Math.min(attacker.wounds.max, attacker.wounds.current + res.woundsLost);
    get().log(`${attacker.name} draine ${res.woundsLost} Blessure(s) (Vampirique).`);
  }
  const vd = venomDifficulty(attacker.traits ?? []);
  // Immunité (Type) (LDB 85 p.339) : un type « Poison » ignore totalement le Venin.
  if (vd && immunityTypes(target.traits).some((ty) => ty.includes('poison'))) {
    get().log(`${target.name} est immunisé au poison (Immunité).`);
  } else if (vd && !hasCondition(target, 'Empoisonné')) {
    const resAdv = target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0;
    const t = rollTest(effectiveChar(target, 'E') + resAdv, venomDiffKey(vd), battleRng());
    if (!t.success) {
      addCondition(target, 'Empoisonné');
      get().log(`${target.name} échoue à résister au Venin et est Empoisonné.`);
    } else get().log(`${target.name} résiste au Venin.`);
  }
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
  attacker.advantage = Math.max(0, attacker.advantage - cost);
  const weapon = freeAttackWeapon(kind, bonus);
  if (maybeOpenDefense(get, set, attacker, target, weapon, { kind, prevActed })) return true; // suspendu : resolve via défense
  const res = resolveMelee(attacker, target, weapon, battleRng(), { defense: cannotDefend(target) ? 'none' : bestDefenseMode(target) });
  applyAttackResult(get, set, attacker, target, weapon, res, false);
  set({ battle: { ...get().battle!, acted: prevActed } }); // gratuite : ne consomme pas l'Action
  applyFreeAttackEffects(get, attacker, target, kind, res);
  return false;
}

/** Émet l'animation d'attaque d'une attaque SPÉCIALE de créature → AnimatedPlanToken joue la pose
 *  dédiée (creatureAttackPoses) ; les biped/spectraux jouent leur clip d'attaque générique. */
function emitCreatureAttackAnim(attacker: Combatant, kind: string): void {
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: attacker.id, kind: 'creature', defense: 'none', result: { hit: true }, creatureAttack: kind });
}

/** Attaque de ZONE gratuite : Souffle (LDB 85, 2 Av) ou Vomissement (Troll, 3 Av). Cible visible la
 *  plus proche dans la portée (Souffle BE+20 m ; Vomi BE m), puis tous les ennemis dans la zone
 *  (Souffle : BF de la cible ; Vomi : 2 m). Test opposé CT/Esquive PAR cible ; sur un échec de la
 *  cible : Dégâts (mitigés BE+PA, sauf ignore-PA des Types Feu/Électricité/Poison) + effet de Type
 *  (Enflammé/Sonné/Empoisonné) ou Sonné (Vomi) + corrosion (Armure/Arme −1). Instantané (pas de modale
 *  IA), résolution opposée auto. Ne consomme pas l'Action. RAW : LDB 85 Souffle / Vomissement. */
export function applyAreaAttack(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack, centerOverride?: Combatant): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - a.avantage);
  const isVomi = a.kind === 'vomi';
  const be = bonus(effectiveChar(attacker, 'E'));
  const rangeTiles = Math.max(1, Math.ceil((isVomi ? be : be + 20) / 2)); // 1 case = 2 m
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= rangeTiles);
  // Centre IMPOSÉ (sort « Souffle », LDB 47 : la cible du sort est le point d'impact) si valide ;
  // sinon comportement trait : cible visible la plus proche.
  const center = centerOverride && centerOverride.pos && !isOutOfAction(centerOverride) && chebyshev(attacker.pos, centerOverride.pos) <= rangeTiles
    ? centerOverride
    : foes.length
      ? foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c))
      : null;
  if (!center) return;
  const blast = isVomi ? 1 : Math.max(1, Math.ceil(bonus(effectiveChar(center, 'F')) / 2)); // Souffle : BF de la cible ; Vomi : 2 m
  const affected = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(center.pos!, c.pos) <= blast);
  const type = (a.type ?? '').toLowerCase();
  const ignorePA = !isVomi && /feu|électric|electric|poison/.test(type);
  const corrosif = isVomi || /corros/.test(type);
  const damage = isVomi ? be + 4 : a.bonus; // Vomi = BE+4 ; Souffle = Indice
  const lines: string[] = [`${attacker.name} déclenche ${ATTACK_LABEL[a.kind]}${a.type ? ` (${a.type})` : ''} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  // Flash de la ZONE touchée à l'exécution (R7) : on montre l'empreinte (centre ± blast, clippée à la scène)
  // → on comprend pourquoi plusieurs combattants sont affectés. Émis pour TOUTE attaque de zone (ennemi/joueur).
  const sc2 = get().scene;
  const zone: Pt[] = [];
  for (let dx = -blast; dx <= blast; dx++)
    for (let dy = -blast; dy <= blast; dy++) {
      const x = center.pos!.x + dx, y = center.pos!.y + dy;
      if (sc2 && x >= 0 && y >= 0 && x < sc2.dimensions.w && y < sc2.dimensions.h) zone.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles: zone, kind: a.kind, type: a.type });
  for (const tgt of affected) {
    // Test opposé CT/Esquive (Vomi : Facile +40 pour l'attaquant à courte distance).
    const r = opposedTest(combatValue(attacker, 'ranged'), defenseValue(tgt, 'esquive'), battleRng(), isVomi ? 'facile' : 'intermediaire', 'intermediaire');
    if (!r.attackerWins) { lines.push(`${tgt.name} esquive.`); continue; }
    const tb = bonus(effectiveChar(tgt, 'E'));
    const pa = ignorePA ? 0 : Math.max(0, tgt.armour.corps ?? 0);
    const wl = Math.max(0, damage - tb - pa);
    if (wl > 0) { loseWounds(tgt, wl); lines.push(`${tgt.name} subit ${wl} Blessure(s)${ignorePA ? ' (ignore PA)' : ''}.`); }
    if (isVomi || /électric|electric/.test(type)) addCondition(tgt, 'Sonné');
    else if (/froid/.test(type) && wl > 0) for (let i = 0; i < Math.max(1, Math.floor(wl / 5)); i++) addCondition(tgt, 'Sonné'); // 1 Sonné / 5 Blessures
    if (/feu/.test(type)) addCondition(tgt, 'En flammes');
    if (/poison/.test(type)) addCondition(tgt, 'Empoisonné');
    if (corrosif) { // Armure & Arme portées subissent 1 Dégât
      tgt.armour.corps = Math.max(0, (tgt.armour.corps ?? 0) - 1);
      if (tgt.weapons[0]) tgt.weapons[0].damageTaken = (tgt.weapons[0].damageTaken ?? 0) + 1;
    }
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  }
  // Type Fumée : la zone se remplit de fumée et bloque les Lignes de vue pendant BE Rounds (RAW Souffle).
  let zones = get().battle!.zones;
  if (/fum/.test(type)) {
    const dur = Math.max(1, be); // Rounds = Bonus d'Endurance de la créature
    const tiles = smokeZone(attacker.pos!, center.pos!, blast);
    zones = [...(zones ?? []), { label: 'Fumée', tiles, rounds: dur, blocksLoS: true }];
    lines.push(`La zone se remplit de fumée — Lignes de vue bloquées ${dur} Round(s).`);
  }
  set({ battle: { ...get().battle!, zones, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Langue préhensile (Jabberslythe, LDB 85) : Attaque gratuite à 1 Avantage, À DISTANCE. Cible
 *  visible la plus proche, Test opposé CT/Esquive ; sur une touche : Dégâts = Indice + État Empêtré
 *  (et traction/Empoignade — non modélisées). Instantané. Ne consomme pas l'Action. */
export function applyTongue(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack): void {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos) return;
  attacker.advantage = Math.max(0, attacker.advantage - a.avantage);
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return;
  const tgt = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const r = opposedTest(combatValue(attacker, 'ranged'), defenseValue(tgt, 'esquive'), battleRng());
  const lines = [`${attacker.name} projette sa Langue préhensile sur ${tgt.name} !`];
  emitCreatureAttackAnim(attacker, a.kind);
  if (r.attackerWins) {
    const wl = Math.max(0, a.bonus - bonus(effectiveChar(tgt, 'E')) - Math.max(0, tgt.armour.corps ?? 0));
    if (wl > 0) { loseWounds(tgt, wl); lines.push(`${tgt.name} subit ${wl} Blessure(s).`); }
    // Effet onHit AUTHORÉ de la manœuvre (Langue → Empêtré) — donnée éditable `maneuver.effects`.
    lines.push(...applyTriggeredEffects(get, attacker, maneuverEffectsOf(attacker, 'langue'), 'onHit', { victim: tgt, woundsDealt: wl, rng: battleRng() }));
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  } else lines.push(`${tgt.name} esquive la langue.`);
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Hurlement fantomatique (Banshee, LDB 85) : Attaque gratuite (ne consomme pas l'Action), dépense
 *  TOUS les Avantages (min 2). Toutes les créatures VIVANTES (non Mort-vivant) à Initiative mètres
 *  subissent 1d10 Blessures (ignore BE et PA), un Test de Résistance Accessible (+20) ou l'État Brisé,
 *  et 3 États Assourdi. Instantané. Renvoie true si poussé. */
export function applyWail(get: Get, set: SetFn, attacker: Combatant): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos || attacker.advantage < 2) return false;
  attacker.advantage = 0; // dépense TOUS les Avantages
  const radius = Math.max(1, Math.ceil(effectiveChar(attacker, 'I') / 2)); // Initiative mètres → cases (2 m)
  const living = battle.combatants.filter(
    (c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && chebyshev(attacker.pos!, c.pos) <= radius && !hasTraitKey(c.traits, 'Mort-vivant'),
  );
  const lines = [`${attacker.name} pousse un Hurlement fantomatique !`];
  emitCreatureAttackAnim(attacker, 'hurlement');
  // Flash de la zone du Hurlement (R7) : rayon autour du crieur, clippé à la scène.
  const scW = get().scene;
  const zoneW: Pt[] = [];
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      const x = attacker.pos!.x + dx, y = attacker.pos!.y + dy;
      if (scW && x >= 0 && y >= 0 && x < scW.dimensions.w && y < scW.dimensions.h) zoneW.push({ x, y });
    }
  bus.emit(EVT.ANIM_AOE, { tiles: zoneW, kind: 'hurlement', type: '' });
  for (const tgt of living) {
    const wl = d10(battleRng()); // 1d10, ignore Endurance et PA
    loseWounds(tgt, wl);
    lines.push(`${tgt.name} subit ${wl} Blessure(s) (ignore Endurance et PA).`);
    // Effets onHit AUTHORÉS de la manœuvre (Hurlement → Test de Résistance ou Brisé, + 3 Assourdi) —
    // donnée éditable `maneuver.effects` (op `test` + `condition`).
    lines.push(...applyTriggeredEffects(get, attacker, maneuverEffectsOf(attacker, 'hurlement'), 'onHit', { victim: tgt, woundsDealt: wl, rng: battleRng() }));
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** Regard pétrifiant (Basilic, LDB 85) : pour son ACTION, la créature dépense ≥1 Avantage (l'IA
 *  dépense tout ce qu'elle a, min 1) → Test opposé CT/Initiative avec +1 DR par Avantage dépensé.
 *  La cible reçoit 1 État Sonné par tranche de 2 DR de marge ; pétrifiée si la marge atteint 6 DR.
 *  Cible visible la plus proche. Instantané. Consomme l'Action. Renvoie true si résolu. */
export function applyGaze(get: Get, set: SetFn, attacker: Combatant): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos || attacker.advantage < 1) return false;
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return false;
  const tgt = foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c));
  const spent = attacker.advantage; // l'IA met tout (min 1) — +1 DR par Avantage
  attacker.advantage = 0;
  const atk = rollTest(combatValue(attacker, 'ranged'), 'intermediaire', battleRng());
  const initVal = effectiveChar(tgt, 'I') + (tgt.skills.find((s) => s.name.toLowerCase().startsWith('initiative'))?.advances ?? 0);
  const def = rollTest(initVal, 'intermediaire', battleRng());
  const margin = atk.sl + spent - def.sl; // DR de l'attaquant (+Avantage) − DR du défenseur
  const lines = [`${attacker.name} fixe ${tgt.name} de son Regard pétrifiant (${spent} Avantage) !`];
  emitCreatureAttackAnim(attacker, 'regard');
  // Pétrifié à 6 DR de marge = issue spéciale de RÉSOLUTION (zéro les PB) → reste moteur. Le Sonné
  // échelonné (1 par 2 DR) est un effet onHit AUTHORÉ (donnée `maneuver.effects`, op `condition`
  // `valuePerSL{every:2}` alimenté par `ctx.sl = margin`).
  if (margin >= 6) { addCondition(tgt, 'Pétrifié'); tgt.wounds.current = 0; applyZeroWounds(tgt); lines.push(`${tgt.name} est définitivement changé en PIERRE !`); }
  else if (margin >= 2) lines.push(...applyTriggeredEffects(get, attacker, maneuverEffectsOf(attacker, 'regard'), 'onHit', { victim: tgt, margin, rng: battleRng() }));
  else lines.push(`${tgt.name} soutient le regard.`);
  set({ battle: { ...get().battle!, acted: true, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** Étreinte glaciale (Spectre de cairn, LDB 85) : ACTION + 2 Avantages. Test opposé CC vs Corps à
 *  corps/Esquive de la cible ; sur un succès, la cible perd 1d10 + DR Blessures ignorant le Bonus
 *  d'Endurance ET les PA. Attaque magique. Cible adjacente. Instantané. Consomme l'Action. */
export function applyChillGrasp(get: Get, set: SetFn, attacker: Combatant): boolean {
  const battle = get().battle;
  if (!battle || battle.over || !attacker.pos || attacker.advantage < 2) return false;
  const tgt = battle.combatants.find((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(attacker, c) <= 1);
  if (!tgt) return false;
  attacker.advantage = Math.max(0, attacker.advantage - 2);
  const r = opposedTest(combatValue(attacker, 'melee'), defenseValue(tgt, bestDefenseMode(tgt)), battleRng());
  const lines = [`${attacker.name} étreint ${tgt.name} de son toucher glacial !`];
  emitCreatureAttackAnim(attacker, 'etreinte');
  if (r.attackerWins) {
    const wl = d10(battleRng()) + r.netSL; // 1d10 + DR, ignore BE et PA
    loseWounds(tgt, wl);
    lines.push(`${tgt.name} perd ${wl} Blessure(s) (ignore Endurance et PA).`);
    if (tgt.wounds.current <= 0) applyZeroWounds(tgt);
  } else lines.push(`${tgt.name} résiste à l'étreinte.`);
  set({ battle: { ...get().battle!, acted: true, log: [...get().battle!.log, ...evLines(lines, 'attack', attacker.id, tgt.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** Attaque-ACTION spéciale de l'IA (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
 *  normale, si la créature en a le trait et l'Avantage requis. Renvoie true si elle a agi. */
export function aiMaybeSpecialAction(get: Get, set: SetFn, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return false;
  const atks = creatureAttacks(enemy.traits ?? []);
  if (atks.some((a) => a.kind === 'regard') && enemy.advantage >= 1) return applyGaze(get, set, enemy);
  if (atks.some((a) => a.kind === 'etreinte') && enemy.advantage >= 2) return applyChillGrasp(get, set, enemy);
  return false;
}

/** L'IA enchaîne ses attaques gratuites de créature après l'attaque principale (chacune 1 Avantage,
 *  OPPOSÉE). File initialisée au 1er appel (Morsure/Attaque caudale des traits, PUIS Piétinement de
 *  Taille — les Indices d'abord), puis poursuivie après chaque modale de défense résolue. Retourne
 *  true si une modale s'est ouverte (tour SUSPENDU). */
/** Résout une Déviation Critique — invoquée par l'applier de l'étape de séquence 'deviation' (la reprise
 *  de l'IA est gérée par la FERMETURE de la séquence, pas ici). « Subir » applique le Critique pré-tiré
 *  (`dev.crit`) tel quel ; « Dévier » l'ignore (−1 PA). */
export function resolveDeviation(get: Get, set: SetFn, dev: PendingDeviation, deviate: boolean): void {
  const battle = get().battle;
  if (!battle) return;
  const attacker = battle.combatants.find((c) => c.id === dev.attackerId);
  const target = battle.combatants.find((c) => c.id === dev.targetId);
  if (attacker && target) {
    applyAttackResult(get, set, attacker, target, dev.weapon, dev.res, deviate, deviate ? undefined : dev.crit);
    autoCleave(get, set, attacker, target, dev.res); // balayage de l'ennemi plus grand sur les AUTRES héros
    // Maladresse du défenseur héros (parade/esquive active ratée sur un double, LDB 14 l.48-51).
    if (target.kind === 'hero' && defenderFumbled(dev.res, target.weapons[0]) && !isOutOfAction(target)) {
      set({ pendingFumble: { combatantId: target.id, weapon: target.weapons[0], result: null, resumeAfter: true } });
      return; // la reprise suivra la modale de Maladresse (resumeAfter)
    }
  }
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
    // Attaques de ZONE (gratuites, instantanées) : Souffle (2 Av) puis Vomissement (3 Av) si abordables.
    const souffle = atks.find((a) => a.kind === 'souffle');
    if (souffle && enemy.advantage >= souffle.avantage) applyAreaAttack(get, set, enemy, souffle);
    const vomi = atks.find((a) => a.kind === 'vomi');
    if (vomi && enemy.advantage >= vomi.avantage) applyAreaAttack(get, set, enemy, vomi);
    const langue = atks.find((a) => a.kind === 'langue');
    if (langue && enemy.advantage >= langue.avantage) applyTongue(get, set, enemy, langue); // Jabberslythe : langue à distance
    if (atks.some((a) => a.kind === 'hurlement') && enemy.advantage >= 2) applyWail(get, set, enemy); // Banshee : cri (tous les Av)
    const traitKinds: string[] = [];
    for (const a of atks) {
      if (a.trigger !== 'free') continue;
      if (a.kind === 'morsure' || a.kind === 'caudale') traitKinds.push(a.kind);
      // Tentacules (LDB 85 l.354-355 : « Gagnez une Action d'Attaque gratuite PAR tentacule ») :
      // count× entrées (« 8 Tentacules +9 » → 8), coût d'Avantage 0.
      if (a.kind === 'tentacules') for (let i = 0; i < (a.count ?? 1); i++) traitKinds.push('tentacules');
    }
    // Cornes : Attaque gratuite gagnée EN CHARGEANT (LDB 85), sans coût d'Avantage → en tête.
    const cornes = enemy.chargedThisTurn && atks.some((a) => a.kind === 'cornes') ? ['cornes'] : [];
    enemy.chargedThisTurn = false; // consommée
    enemy.pendingFreeAttacks = [...cornes, ...traitKinds, 'pietinement']; // Piétinement (Taille) en dernier
  }
  while (enemy.pendingFreeAttacks.length) {
    const kind = enemy.pendingFreeAttacks[0];
    // Coût en Avantage PAR TYPE (RAW, lu de creatureAttacks) : Cornes (Charge) et Tentacules = 0 ;
    // Morsure/Caudale = 1 ; Piétinement (Taille) = 1. Une entrée inabordable est SAUTÉE (pas de
    // break : des Tentacules à coût 0 restent jouables derrière une Morsure inabordable).
    const cost = kind === 'pietinement' ? 1 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.avantage ?? 1;
    if (enemy.advantage < cost) { enemy.pendingFreeAttacks.shift(); continue; }
    const b2 = get().battle; if (!b2 || b2.over) break;
    const target = freeAttackTarget(b2, enemy, kind);
    if (!target) { enemy.pendingFreeAttacks.shift(); continue; }
    const bonus = kind === 'pietinement' ? 0 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.bonus ?? 0;
    enemy.pendingFreeAttacks.shift();
    if (applyFreeAttack(get, set, enemy, target, kind, bonus, cost)) return true; // modale ouverte → reprise via defenseConfirm
  }
  enemy.pendingFreeAttacks = undefined; // file épuisée
  return false;
}

// applyActiveEffect / COMBAT_PERSIST vivent désormais dans le moteur (engine/ops) —
// partagés par l'applicateur d'ops (sorts, tables de contrecoup, mutations).

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(get: Get, set: SetFn, caster: Combatant, severity: MiscastSeverity, opts?: { suppressReveal?: boolean }): string[] {
  // Colère des dieux : +10 au jet par Point de Péché du lanceur (LDB 40 l.53).
  const sinPoints = severity === 'colere' ? caster.sinPoints ?? 0 : 0;
  const m = rollMiscast(severity, battleRng(), sinPoints);
  const lines = [m.log];
  // « Après le lancer et avoir appliqué le résultat, réduisez vos Points de Péché
  // de 1, jusqu'à un minimum de 0 » (LDB 40 l.53).
  if (severity === 'colere' && sinPoints > 0) {
    caster.sinPoints = sinPoints - 1;
    lines.push(`${caster.name} : 1 Point de Péché expié (reste ${caster.sinPoints}).`);
  }
  // Ops de la table (États, Blessures ignorant BE+PA, Tests imbriqués, Corruption,
  // pénalités/blocages d'incantation temporisés, réduction à 0) — applicateur unique.
  lines.push(
    ...applyOps(caster, m.ops, {
      rng: battleRng(),
      label: m.name,
      now: get().gameTime,
      onCorruption: caster.kind === 'hero' ? (n) => gainCorruption(get, set, caster, n) : undefined,
    }),
  );
  // « Un jet = une modale » : le héros voit la conséquence (Colère/Imparfaite) INLINE dans la séquence
  // partagée (étape d'affichage) — plus de RevealModal séparée. `suppressReveal` : la Focalisation
  // interrompue (qui pousse déjà sa propre révélation « Calme » portant ces lignes) n'ouvre rien.
  if (caster.kind === 'hero' && !opts?.suppressReveal) {
    const colere = severity === 'colere';
    const title = colere ? 'Colère des dieux' : 'Incantation Imparfaite';
    const icon = colere ? '⚡' : '💥';
    // Charge riche `reveal` (table : dé + lignes) — comme le Critique ; le dé reste observable (Péché +10).
    const reveal: RevealEntry = { kind: 'miscast', title, dice: m.rolls[0], lines, subjectId: caster.id, severity: 'grave' };
    startCascade(get, set, {
      title, icon, purpose: 'combat',
      steps: [{ id: 'cons-miscast-0', kind: 'miscast', actorId: caster.id, icon, label: colere ? 'Colère des dieux' : 'Imparfaite', outcome: lines, reveal, interactive: true }],
    });
  }
  return lines;
}

/**
 * Clôt une action JOUEUR résolue (soin / incantation / Focalisation, et futures actions hors combat) :
 * EN COMBAT consomme l'Action (`acted`/`action:null`/`selectedSpell:null`), journalise dans `battle.log`
 * et vérifie la fin de combat ; HORS COMBAT trace le `journal`. C'est la SORTIE commune — `combatOrParty`
 * fournit la RÉSOLUTION des acteurs (`actorIn`/`touchActors`), ce helper la finalisation.
 * `selectedSpell:null` est neutre pour une action non-incantation (déjà null).
 */
export function finishPlayerAction(get: Get, set: SetFn, lines: string[], kind: CombatEventKind = 'info'): void {
  const battle = get().battle;
  if (battle) {
    set({ battle: { ...battle, acted: true, action: null, selectedSpell: null, log: [...battle.log, ...evLines(lines, kind)] } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  } else {
    set({ party: [...get().party], journal: [...get().journal.slice(-40), ...lines] });
    bus.emit(EVT.SCENE_DIRTY);
  }
}

// (Le sommeil de groupe vit dans state/restFlow — `sleepParty`, source unique de la nuit.)

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
  const spell = findSpell(label);
  if (!spell) {
    get().log(`Sort « ${label} » introuvable.`);
    return;
  }
  // Contrecoups bloquants (LDB 46/40) : « Propos ésotériques », « Vous abusez de ma patience »…
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell.type) ? 'Prière' : 'Langue');
  if (blocked) {
    get().log(`${caster.name} ne peut pas ${castInfoIsPrayer(spell.type) ? 'prier' : 'incanter'} : ${blocked}.`);
    return;
  }
  // Lecture au grimoire (LDB 47 l.34) : sort NON mémorisé de son Domaine, NI doublé.
  if (fromGrimoire && !canCastFromGrimoire(caster, spell)) {
    get().log(`${caster.name} ne peut pas lancer ${label} depuis un grimoire (mémorisé, hors Domaine ou pas de grimoire porté).`);
    return;
  }
  // Sort « Souffle » (LDB 47 p.244) : délégué à l'attaque de ZONE du Trait — la portée suit le
  // TRAIT (BE+20 m, LDB 85), pas le champ Portée du sort ; résolu comme zone, pas comme Projectile.
  const breathSpell = !!spellSpecFor(spell).breathAttack;
  // Portée (LDB 47) : cible directe hors de portée du sort → refus AVANT la modale (parité ZdE/tir).
  // `range` null = portée non chiffrable (« le lanceur », « au toucher », spécial) → pas de gate.
  if (get().battle && caster.pos && target.pos && caster.id !== target.id) {
    const range = breathSpell
      ? Math.max(1, Math.ceil((bonus(effectiveChar(caster, 'E')) + 20) / 2))
      : spellRangeTiles(spell.range, caster);
    if (range != null && combatDistance(caster, target) > range) {
      get().log(`${spell.label} : cible hors de portée (${range} cases).`);
      return;
    }
    // Ligne de Vue (LDB 46 l.170 : « vous devez toujours être capable de voir […] votre cible ») —
    // buff sur allié compris ; binaire, pas de malus de couvert pour un Sort. Couvre héros ET IA.
    if (castSightBlocked(get, caster.pos, target.pos)) {
      get().log(`${spell.label} : pas de ligne de vue.`);
      return;
    }
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: target.id, spellLabel: label, missile: breathSpell ? false : isMagicMissile(spell),
      focused: focusedNI0, result: null, ...(fromGrimoire ? { grimoire: true } : {}),
    },
  });
  openCastCascade(get, set, caster); // « Une situation = une modale » : hôte la situation d'incantation dans la cascade
  // Lanceur ENNEMI : le MOTEUR roule l'incantation (plus de « Lancer » joueur — on ne lance pas le
  // dé de l'adversaire), puis aiguille : Contre-sort à plusieurs si un héros peut Dissiper, sinon la
  // modale pré-roulée sert de RÉVÉLATION (résultat + « Appliquer », sans bouton « Lancer »).
  if (caster.kind === 'enemy' && get().battle) {
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
  const opposed = spell ? spellSpecFor(spell).opposed : undefined;
  if (!opposed) return false;
  const participants = targets
    .filter((t) => !isOutOfAction(t))
    .map((t) => ({ id: t.id, interactive: t.kind === 'hero', result: null }));
  if (!participants.length) return false;
  set({ pendingCastOpposition: { participants, kind: opposed.kind, skill: opposed.skill, char: opposed.char } });
  // Cibles IA (témoin) : jet auto-roulé immédiatement (révélé dans la modale, jamais caché).
  for (const p of participants) if (!p.interactive) get().oppositionRoll(p.id);
  return true;
}

/** Rayon INITIAL d'un sort de ZONE en mètres (spec curée prioritaire sur le champ Cible —
 *  même précédence que l'application). `null` = pas un sort de ZdE chiffrable. */
export function zoneRadiusMeters(spell: NonNullable<ReturnType<typeof findSpell>>, caster: Combatant): number | null {
  const specRadius = spellSpecFor(spell).zdeRadiusMeters;
  if (specRadius != null) return Math.max(0, resolveFormula(specRadius, caster));
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
  const spell = findSpell(label);
  if (!spell) return false;
  const r0m = zoneRadiusMeters(spell, caster);
  if (r0m == null) return false;
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell.type) ? 'Prière' : 'Langue');
  if (blocked) {
    get().log(`${caster.name} ne peut pas ${castInfoIsPrayer(spell.type) ? 'prier' : 'incanter'} : ${blocked}.`);
    return true; // c'était bien une zone — l'entrée est consommée (refus journalisé)
  }
  const focusedNI0 = caster.focus?.spell === label && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: caster.id, spellLabel: label, missile: isMagicMissile(spell),
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
    title: 'Incantation', icon: '🔮', purpose: 'combat',
    steps: [{ id: `cast-${caster.id}`, kind: 'cast', actorId: caster.id, jet: 'cast', ...(caster.kind === 'enemy' ? { groupOwner: true } : {}) }],
  });
}

/** Source UNIQUE de la « pose de zone » en cours — le gabarit qui suit le curseur. Couvre TOUT
 *  ce qui se pose librement : sorts ET miracles à ZdE (les prières passent par pendingCast).
 *  Le Souffle/Vomissement ne se posent PAS (LDB 85 : centre imposé — cible visible la plus
 *  proche, ou la cible du sort Souffle — cf. applyAreaAttack). Toute nouvelle source = une
 *  entrée ICI + un bras à `commitPlacedZone` ; l'UI (gabarit animé, survol, clic) est commune. */
export type PlacingZone = { source: 'cast'; label: string; casterId: string; radius: number; rangeTiles: number | null };
export function placingZoneOf(s: Pick<GameState, 'pendingCast' | 'battle'>): PlacingZone | null {
  const pc = s.pendingCast;
  if (pc?.zone?.placing && !pc.zone.center) {
    const caster = s.battle?.combatants.find((c) => c.id === pc.casterId);
    const spell = effectiveSpellOf(pc);
    return {
      source: 'cast', label: pc.spellLabel, casterId: pc.casterId, radius: pc.zone.radius,
      rangeTiles: spell && caster ? spellRangeTiles(spell.range, caster) : null,
    };
  }
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
    get().log(`${spell.label} : zone hors de portée (${range} cases).`);
    return;
  }
  if (castSightBlocked(get, caster.pos, pt)) {
    get().log(`${spell.label} : pas de ligne de vue.`);
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
  set({ pendingCast: null, pendingCascade: null }); // TERMINAL : ferme data + cascade-hôte AVANT applyCast (un Critique de Sort y rouvre sa propre cascade Imparfaite)
  applyCast(get, set, caster, first, spell, r1, pc.missile, pc.focused, pc.critChoice, {
    durationMult: 1 + (pc.overcast?.duration ?? 0),
    extraTargets: inZone.slice(1),
  });
}

/** Contexte de visibilité OPTIONNEL pour filtrer des cibles de sort par Ligne de Vue (LDB 46
 *  l.170). Absent/null (hors combat, tests purs) : pas de filtre — comportement historique. */
export type SpellSight = { scene: Scene; smoke?: Pt[] } | null;
const spellSightBlocked = (sight: SpellSight | undefined, caster: Combatant, t: Combatant): boolean =>
  !!sight && !!caster.pos && !!t.pos && lineOfSightCover(sight.scene, caster.pos, t.pos, [], sight.smoke ?? []).blocked;
/** SpellSight depuis l'état courant (scène + fumée du combat), null hors combat. */
export const spellSightOf = (get: Get): SpellSight =>
  get().scene && get().battle ? { scene: get().scene!, smoke: smokeOf(get().battle!) } : null;

/** Meilleur Projectile magique CONNU et jouable d'un ennemi (IA). Un Sort n'aboutit que si
 *  DR ≥ NI (LDB 46) : le SL maximal d'un Test = valeur/10 (Avantage compris, LDB 46 l.176) →
 *  on écarte les NI hors d'atteinte, puis on prend les Dégâts écrits les plus hauts (« Dégâts +N »,
 *  les DR du Test s'y ajoutent), à égalité le NI le plus bas (plus fiable). Repli : aucun NI
 *  atteignable → le moins exigeant (les Sorts mineurs NI 0 y pourvoient en pratique). */
export function aiBestMissile(enemy: Combatant): string | undefined {
  const known = (enemy.spells ?? [])
    .map((label) => findSpell(label))
    .filter((sp): sp is NonNullable<ReturnType<typeof findSpell>> => !!sp && isMagicMissile(sp));
  if (!known.length) return undefined;
  const dmg = (sp: { desc: string }) => parseSpellDamage(sp.desc)?.damage ?? 0;
  const maxSL = (sp: { type: string }) => {
    const info = castInfo(sp as any);
    // SL max d'un jet = valeur/10, + les DR de Talent lié au Test réussi (LDB 10 l.20 —
    // Diction instinctive ×N) : c'est ce qui détermine les NI passables SANS Focalisation.
    const tal = castTestTalentDR(enemy, info.skill === 'Prière' ? 'Prière' : 'Langue (Magick)');
    return Math.floor(castingValue(enemy, info.skill, info.spec) / 10) + tal;
  };
  const feasible = known.filter((sp) => (sp.cn ?? 0) <= maxSL(sp));
  const pool = feasible.length ? feasible : known;
  pool.sort((a, b) => dmg(b) - dmg(a) || (a.cn ?? 0) - (b.cn ?? 0));
  return pool[0].label;
}

/** Surincantation AUTOMATIQUE d'un lanceur ENNEMI (LDB 47 l.28-31 : « Pour chaque +2 DR […]
 *  vous pouvez ajouter une valeur de […] Cible égale à la valeur initiale ») : le surplus
 *  (DR − NI) est alloué à l'axe CIBLE d'un Projectile — adversaires actifs les plus proches,
 *  à PORTÉE du Sort, hors cible principale. Retourne le patch de pendingCast ({} si rien). */
export function aiOvercastPlan(
  caster: Combatant,
  targetId: string,
  spell: { cn: number | null; range: string | null },
  res: { cast: boolean; sl: number },
  combatants: Combatant[],
  focusedNI0 = false,
  sight?: SpellSight,
): { overcast?: { duration: number; targets: number }; extraTargetIds?: string[] } {
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
  return { overcast: { duration: 0, targets: extras.length }, extraTargetIds: extras };
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
  spell: { range: string | null },
  missile: boolean,
  sight?: SpellSight,
): Combatant[] {
  const range = spellRangeTiles(spell.range, caster);
  return pool.filter((m) => {
    if (m.id === targetId) return false;
    if (missile ? m.kind === caster.kind || isOutOfAction(m) : m.kind !== caster.kind || m.dead || m.outOfRencontre) return false;
    if (range != null && caster.pos && m.pos && combatDistance(caster, m) > range) return false;
    // Ligne de Vue (LDB 46 l.170) : une cible supplémentaire doit aussi être visible du lanceur.
    return !spellSightBlocked(sight, caster, m);
  });
}

/** Sort effectif d'un pendingCast : NI DOUBLÉ pour une lecture au grimoire (LDB 47 l.34). */
export function effectiveSpellOf(pc: { spellLabel: string; grimoire?: boolean }): ReturnType<typeof findSpell> {
  const spell = findSpell(pc.spellLabel);
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
    if (!knowsCastingSkill(c, 'Langue', 'Magick')) return false;
    if (c.id === target.id) return true;
    if (!c.pos || !target.pos) return false;
    if (combatDistance(c, target) > Math.max(1, Math.floor(effectiveChar(c, 'FM') / 2))) return false;
    return !scene || !lineOfSightCover(scene, c.pos, target.pos, [], smokeOf(battle)).blocked;
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
  const oc = caster.kind === 'enemy' && pc.missile && !pc.zone
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
  extras?: { durationMult?: number; extraTargets?: Combatant[]; conjureForm?: ConjureForm; opposedOutcome?: Record<string, { resisted: boolean; margin: number }> },
) {
  const battle = get().battle; // null = incantation HORS COMBAT (couture D) : même applyCast, sortie journal
  const durationMult = Math.max(1, extras?.durationMult ?? 1);
  let teleportReach: Map<string, number> | null = null; // Téléportation (Jalon 2.6) : posé APRÈS finishPlayerAction
  const extraTargets = extras?.extraTargets ?? [];

  // Incantation CRITIQUE (LDB 46 l.52-59) — SORTS seulement (Test de Langue (Magick)) :
  // les Vents octroient une puissance supplémentaire (choix du lanceur), mais cela a un
  // prix — Imparfaite Mineure, sauf Talent Diction instinctive.
  const isSort = !castInfoIsPrayer(spell.type);
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
  if (crit) {
    logLines.push(
      choice === 'critique'
        ? 'Incantation Critique : le Projectile inflige une Blessure Critique.'
        : choice === 'puissance'
          ? 'Puissance totale : le sort est lancé quels que soient NI et DR (mais peut être Dissipé).'
          : 'Force inéluctable : le sort ne peut pas être Dissipé.',
    );
    if (!hasTalent(caster, 'Diction instinctive')) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    else logLines.push('Diction instinctive : aucune Imparfaite sur le double réussi.');
  }
  // « Avantages et Magie » (LDB 46 l.176) : si la cible a déjà été visée par un Sort du
  // MÊME Domaine ce Round, le lanceur gagne +1 Avantage (le Vent converge). Sorts seulement.
  if (battle && isSort && spell.subType && res.cast) {
    const marks = battle.domainCasts ?? [];
    if (marks.some((m) => m.targetId === target.id && m.domain === spell.subType)) {
      gainAdvantage(caster);
      caster.gainedAdvThisRound = true;
      logLines.push(`${caster.name} : +1 Avantage — le Vent de ${spell.subType} converge sur ${target.name}.`);
    }
    battle.domainCasts = [...marks, ...[target, ...extraTargets].map((t) => ({ targetId: t.id, domain: spell.subType! }))];
  }

  if (missile) {
    // Touche d'un Projectile : application des Blessures + Critique (choix/overkill).
    const missileSpec = spellSpecFor(spell);
    const applyMissileHit = (t: Combatant, mres: CastResult & Partial<MissileResult>) => {
      // Résistance à la Magie (Indice) (LDB 85 p.341) : « Le DR de tous les Sorts l'affectant est
      // réduit du nombre indiqué » → autant de Blessures en moins (dégâts du Projectile = dérivés du DR).
      const mr = magicResistanceOf(t.traits) + talentMagicResistance(t); // Trait (LDB 85) + Talent (LDB 10, 2×niveau)
      if (mr > 0 && mres.hit && mres.woundsLost) {
        mres = { ...mres, woundsLost: Math.max(0, mres.woundsLost - mr) };
        logLines.push(`${t.name} résiste à la magie (−${mr} DR de Sort).`);
      }
      // Dôme (LDB 47 — L11) : Protection (6+) contre une Attaque MAGIQUE venant de l'extérieur.
      if (mres.hit && mres.woundsLost && battle && wardedAgainst(battle.combatants, caster, t, 'domeWard')) {
        const d = d10(battleRng());
        if (d >= 6) {
          logLines.push(`${t.name} est couvert par le Dôme — sauvegarde ${d} ≥ 6, le Sort se brise sur la voûte.`);
          return;
        }
      }
      // Martyr (LDB 42 — L13) : les Dégâts du Projectile vont au prêtre (BE doublé pour ces Dégâts).
      if (mres.hit && mres.woundsLost && battle) {
        const priest = martyrGuardOf(battle, t);
        if (priest) {
          const raw = mres.damage ?? mres.woundsLost;
          const taken = Math.max(0, raw - 2 * bonus(effectiveChar(priest, 'E')) - Math.max(0, priest.armour[mres.location ?? 'corps'] ?? 0));
          if (taken > 0) {
            loseWounds(priest, taken);
            if (priest.wounds.current <= 0) applyZeroWounds(priest);
          }
          logLines.push(`Martyr : ${priest.name} reçoit les Dégâts à la place de ${t.name}${taken > 0 ? ` (${taken} PB, BE doublé)` : ' (encaissés sans dommage, BE doublé)'}.`);
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
        const lethal = applyCriticalToTarget(t, mres.location ?? 'corps', critWound, Math.max(0, overkill), logLines, set, undefined, { attackerId: caster.id, attackerKind: caster.kind, weapon: spell.label, critTwice: hasActiveFlag(caster, 'critRollTwice') });
        if (lethal) finalizeHeroDeath(get, set, t, 'hit', currentBefore);
      } else if (t.wounds.current <= 0) {
        applyZeroWounds(t);
      }
      // Effets ADDITIONNELS d'un Projectile sur la cible (« Grands feux d'U'Zhul » : +2 En flammes, À
      // Terre ; « Drain » : soigne le lanceur) — lus depuis `spell.effects` (Flow éditable, feuilles
      // `on:'target'`). Réservé aux sorts CURÉS : un sort sans spec n'a pas d'effet missile parsé (iso-POC).
      if (missileSpec.curated && spellOps(spell.effects, 'target').length) {
        const rounds = missileSpec.durationRounds != null ? resolveFormula(missileSpec.durationRounds, caster, battleRng()) : null;
        const clockMin = rounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
        logLines.push(...runSpellFlow(t, caster, spellFlowFor(spell.effects, 'target'), {
          rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: res.sl,
          defaultDurationRounds: rounds ?? COMBAT_PERSIST,
          ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
          onCorruption: t.kind === 'hero' ? (n) => gainCorruption(get, set, t, n) : undefined,
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
      if (isOutOfAction(t)) logLines.push(`${t.name} est mis hors de combat !`);
    };
    applyMissileHit(target, res);
    // Nerveux (effet déclenché onStartled : magie → +3 Brisé) — dispatcher générique (state/triggeredEffects).
    for (const t of [target, ...extraTargets]) {
      if (res.cast && !isOutOfAction(t)) for (const line of fireTriggers(get, t, 'onStartled', {})) logLines.push(line);
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
    if (missileSpec.chainOnKill && res.cast && battle && caster.pos) {
      const maxBounces = Math.max(0, resolveFormula(missileSpec.chainOnKill.maxBounces, caster, battleRng()));
      const hopTiles = Math.max(1, Math.ceil(Math.max(0, resolveFormula(missileSpec.chainOnKill.hopMeters, caster, battleRng())) / 2));
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
        logLines.push(`${spell.label} rebondit sur ${next.name} !`, r2.log);
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
    if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    else if (focusedNI0 && !res.cast) logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    // Sort offensif : lanceur vers la cible, cible vers le lanceur.
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!), [target.id]: facingToward(target.pos!, caster.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  } else {
    if (res.cast) {
      // Effets structurés du sort (spec curée du registre, sinon repli regex sur la
      // desc — iso-POC). Durée hors-rounds (minutes/heures/jours, LDB 47) : l'effet est posé à
      // COMBAT_PERSIST (échelle tactique) AVEC son échéance d'HORLOGE `untilTime` (cascade #T3 —
      // « 1 heure » expire en 60 min de gameTime, plus au bout de 9999 Rounds) ; on n'invente
      // PAS un nombre de rounds. Surincantation « Durée » : ×(1+n) (LDB 47).
      const spec = spellSpecFor(spell);
      const baseRounds = spec.durationRounds != null ? resolveFormula(spec.durationRounds, caster, battleRng()) : null;
      const rounds = baseRounds != null ? baseRounds * durationMult : null;
      const baseClockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      const clockMin = baseClockMin != null ? baseClockMin * durationMult : null;
      if (durationMult > 1 && baseRounds != null) logLines.push(`Surincantation : durée ×${durationMult} (${rounds} Rounds).`);
      if (durationMult > 1 && baseClockMin != null) logLines.push(`Surincantation : durée ×${durationMult}.`);
      for (const t of [target, ...extraTargets]) {
        if (t !== target) logLines.push(`${spell.label} s'étend aussi à ${t.name} (Surincantation).`);
        // OPPOSITION (spec.opposed) résolue dans la modale : une cible qui l'a emporté RÉSISTE (aucune
        // op) ; sinon les ops portent sur la MARGE de DR (l'écart de l'opposition → échelles `perSL`).
        const opp = extras?.opposedOutcome?.[t.id];
        if (opp?.resisted) { logLines.push(`${t.name} résiste à ${spell.label} (Test opposé).`); continue; }
        logLines.push(
          // Tout sort passe par le système Flow/EffectOp : `spell.effects` (Flow éditable, feuilles
          // `on:'target'`) → `runSpellFlow` → applyOps. Les feuilles `on:'caster'` sont appliquées à part.
          ...runSpellFlow(t, caster, spellFlowFor(spell.effects, 'target'), {
            rng: battleRng(),
            caster,
            label: spell.label,
            now: get().gameTime,
            sl: opp ? opp.margin : res.sl,
            defaultDurationRounds: rounds ?? COMBAT_PERSIST,
            ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
            ...(extras?.conjureForm ? { conjureForm: extras.conjureForm } : {}),
            onCorruption: t.kind === 'hero' ? (n) => gainCorruption(get, set, t, n) : undefined,
          }),
        );
        // Métamorphose (Forme bestiale, LDB 48) : op `polymorph` du Flow (on:'target') — appliquée
        // ci-dessus par runSpellFlow → applyOps (expansion charMod différentiel + grantTrait via
        // engine/polymorph, auto-restitués à l'expiration). Plus de site dédié.
      }
      // POUSSÉE (Jalon 2.6 — « Toutes les créatures à BFM mètres sont repoussées de BFM
      // mètres », LDB 47 p.244) : recul en ligne (direction lanceur→cible) jusqu'à
      // l'obstacle ; la collision est journalisée (Dégâts = distance restante, MJ).
      if (spec.pushMeters != null && battle && caster.pos) {
        const pushTiles = Math.max(1, Math.floor(resolveFormula(spec.pushMeters, caster, battleRng()) / 2));
        for (const t of [target, ...extraTargets]) {
          if (t.id === caster.id || !t.pos || isOutOfAction(t)) continue;
          const r = pushAway(get().scene!, caster.pos, t.pos, pushTiles, occupied(battle, t));
          if (r.pushed > 0) {
            const fromPos = { ...t.pos };
            t.pos = { ...r.dest };
            bus.emit(EVT.ANIM_MOVE, { id: t.id, path: [{ ...r.dest }] });
            logLines.push(`${t.name} est repoussé de ${r.pushed * 2} m.`);
            applyZoneCrossings(get, t, [...tilesBetween(fromPos, r.dest), { ...r.dest }]); // une poussée TRAVERSE (Mur de feu, L11)
          }
          if (r.collided) logLines.push(`${t.name} percute un obstacle (Dégâts = distance restante — arbitrage MJ).`);
        }
      }
      // Sort « Souffle » (LDB 47 p.244) : « comme si vous aviez dépensé 2 Avantages pour activer
      // le Trait Souffle » — délégué à l'attaque de ZONE du Trait, centrée sur la CIBLE du sort,
      // Dégâts = Bonus d'Endurance du lanceur, Type mappé du Domaine. Sans coût d'Avantage (le
      // sort EST l'activation). Hors combat : pas de grille → journalisé.
      if (spec.breathAttack) {
        if (battle && caster.pos) {
          const type = domainBreathType(caster);
          applyAreaAttack(get, set, caster, {
            kind: 'souffle', label: 'Souffle', bonus: bonus(effectiveChar(caster, 'E')),
            trigger: 'free', avantage: 0, aoe: true, magic: true, ...(type ? { type } : {}),
          }, target);
          if (!type) logLines.push('Souffle : Domaine sans Type évident — Dégâts purs (« Le MJ détermine quel type… »).');
        } else {
          logLines.push(`${caster.name} crache un Souffle — hors combat, effet narratif (arbitrage MJ).`);
        }
      }
      // Zone persistante d'un sort de soutien/zone (Mur de feu : « Quiconque traverse… »).
      if (res.cast) placeSpellZone(get, caster, target, spell, spec, res.sl, durationMult, logLines);
      // TÉLÉPORTATION (Jalon 2.6 — « vous vous téléportez de BFM mètres (+BFM par +2 DR) »,
      // LDB 47 p.245) : le choix de la case d'arrivée suit l'Appliquer (mode 'teleport',
      // cases = survol des obstacles, atterrissage libre — battleClickTile).
      if (spec.teleportMeters != null && res.cast) {
        let meters = Math.max(0, resolveFormula(spec.teleportMeters, caster, battleRng()));
        if (spec.teleportPerSL) {
          meters += Math.floor(Math.max(0, res.sl) / Math.max(1, spec.teleportPerSL.every))
            * Math.max(0, resolveFormula(spec.teleportPerSL.metersFormula, caster, battleRng()));
        }
        if (battle && caster.pos) {
          const tpTiles = Math.max(1, Math.floor(meters / 2));
          teleportReach = flyReachable(get().scene!, caster.pos, tpTiles, occupied(battle, caster), sizeFootprint(caster.size));
          logLines.push(`${caster.name} peut se téléporter (${meters} m) — choisir la case d'arrivée.`);
        } else {
          logLines.push(`${caster.name} se téléporte (${meters} m) — repositionnement libre hors combat.`);
        }
      }
    } else if (res.isFumble) {
      // Prière → Colère des dieux ; Sort → Incantation Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, castInfoIsPrayer(spell.type) ? 'colere' : 'mineure'));
    } else if (focusedNI0) {
      // Sort focalisé dont l'incantation échoue (sans Maladresse) → Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, 'mineure'));
    }
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
      logLines.push(...domainOnHitRiders(caster, t, spell, t.kind !== caster.kind));
    }
    // Cieux (l.87) : le Sort « se dirige vers toutes les autres cibles dans les 2 mètres » de la
    // cible (sauf Magie des Arcanes (Cieux)) — BFM Dégâts, mitigés BE + PA (PA métal ignorées).
    if (domainOf(spell) === 'Cieux' && battle && target.pos) {
      const bfm = bonus(effectiveChar(caster, 'FM'));
      const splashed = battle.combatants.filter((c) =>
        c.id !== target.id && c.id !== caster.id && !isOutOfAction(c) && c.pos
        && combatDistance(target, c) <= 1 && !hasArcaneTalent(c, 'Cieux'));
      for (const s of splashed) {
        const totalAP = Math.max(0, s.armour.corps ?? 0);
        const dom = domainMissileMods(s, spell, 'corps', totalAP);
        const wl = Math.max(0, bfm - bonus(effectiveChar(s, 'E')) - Math.max(0, totalAP - dom.apIgnored));
        if (wl > 0) {
          loseWounds(s, wl);
          if (s.wounds.current <= 0) applyZeroWounds(s);
        }
        logLines.push(`L'arc d'Azyr saute sur ${s.name} : ${wl} Blessure(s) (attribut des Cieux).`);
      }
    }
    // Bête (l.9) : le lanceur gagne Peur 1 pour 1d10 Rounds après un Sort de la Bête réussi.
    logLines.push(...ghurFearAfterCast(caster, spell, battleRng()));
    // Effets sur le LANCEUR (op casterOps — Vol de vie « retirez tout État Exténué dont vous
    // souffrez », buffs de soi d'un sort offensif) : appliqués une seule fois par lancement.
    const castSpec = spellSpecFor(spell);
    // INVOCATION (op `summon` du Flow éditable — Nécromancie, Hurlement du loup, Manifestation de démon,
    // Roi de la Nature…) : la/les créature(s) entrent en combat près du lanceur et se dissipent à
    // l'expiration (state/summonFlow). Effet IMPUR du Flow résolu ici (grille/initiative) ; les feuilles
    // `on:'caster'` sont par ailleurs jouées par runSpellFlow (où `summon` reste inerte → pas de doublon).
    const sumRounds = castSpec.durationRounds != null ? resolveFormula(castSpec.durationRounds, caster, battleRng()) : null;
    for (const sOp of spellOps(spell.effects, 'caster')) {
      if (sOp.op !== 'summon') continue;
      logLines.push(...applySummon(get, set, caster, sOp, { sl: res.sl, rounds: sumRounds, label: spell.label, rng: battleRng() }));
    }
    // Effets sur le LANCEUR (feuilles `on:'caster'` de `spell.effects` — Vol de vie « retirez tout État
    // Exténué dont vous souffrez », buffs de soi d'un sort offensif) : appliqués UNE seule fois par lancement.
    if (spellOps(spell.effects, 'caster').length) {
      const baseRounds = castSpec.durationRounds != null ? resolveFormula(castSpec.durationRounds, caster, battleRng()) : null;
      const clockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      logLines.push(...runSpellFlow(caster, caster, spellFlowFor(spell.effects, 'caster'), {
        rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: res.sl,
        defaultDurationRounds: baseRounds ?? COMBAT_PERSIST,
        ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
        onCorruption: caster.kind === 'hero' ? (n) => gainCorruption(get, set, caster, n) : undefined,
      }));
    }
  }

  // Péché et Colère Divine (LDB 40 l.44-45) : à CHAQUE Test de Prière, si le dé des
  // unités ≤ Points de Péché → Colère des dieux, MÊME si le Test est réussi (la
  // Maladresse, elle, a déjà déclenché la sienne ci-dessus).
  if (castInfoIsPrayer(spell.type) && !res.isFumble && res.roll > 0 && prayerWrathTriggered(res.roll, caster.sinPoints ?? 0)) {
    logLines.push(`Le dé des unités (${res.roll % 10}) trahit les Péchés de ${caster.name} (${caster.sinPoints}) — Colère des dieux !`);
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

/** Renvoie vrai si le type de sort relève d'une Prière (Béni/Invocation). */
export function castInfoIsPrayer(type: string): boolean {
  return type === 'Béni' || type === 'Invocation';
}

/** Pose la ZONE PERSISTANTE d'un sort (op `zone` du Flow, on:'caster' — L11 Mur de feu : mur
 *  perpendiculaire à l'axe lanceur→cible centré sur la cible ; Grands feux : disque autour de la
 *  cible). Durée = celle du sort (`spec.durationRounds` × Surincantation), formules résolues contre
 *  le LANCEUR. Effet IMPUR du Flow résolu ici (grille) ; hors combat : narratif. */
function placeSpellZone(
  get: Get,
  caster: Combatant,
  target: Combatant,
  spell: { label: string; effects?: Flow },
  spec: ReturnType<typeof spellSpecFor>,
  sl: number,
  durationMult: number,
  logLines: string[],
): void {
  const pz = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'zone' }> => o.op === 'zone');
  if (!pz) return;
  const battle = get().battle;
  if (!battle || !target.pos || !caster.pos) {
    logLines.push(`${spell.label} : la zone persiste — hors grille de combat, arbitrage MJ.`);
    return;
  }
  const baseRounds = spec.durationRounds != null ? resolveFormula(spec.durationRounds, caster, battleRng()) : 1;
  const rounds = Math.max(1, baseRounds * Math.max(1, durationMult));
  const tiles = pz.shape === 'wall'
    ? wallTiles(caster.pos, target.pos, metersToTiles(resolveZoneMeters(pz.lengthMeters ?? 2, pz.lengthPerSL, caster, sl, battleRng())))
    : discTiles(target.pos, metersToTiles(Math.max(0, resolveFormula(pz.radiusMeters ?? 2, caster, battleRng()))));
  const zone: BattleZone = {
    label: spell.label, tiles, rounds, casterId: caster.id,
    ...(pz.blocksLoS ? { blocksLoS: true } : {}),
    ...(pz.onCross ? { onCross: pz.onCross } : {}),
    ...(pz.perRound ? { perRound: pz.perRound } : {}),
  };
  battle.zones = [...(battle.zones ?? []), zone];
  logLines.push(`${spell.label} : la zone persiste ${rounds} Round(s).`);
  bus.emit(EVT.ANIM_AOE, { tiles, kind: 'spell' });
}

/** Type de Souffle « correspondant le mieux » au Domaine du lanceur (sort Souffle, LDB 47 p.244 :
 *  « Le MJ détermine quel type d'attaque de Souffle correspond le mieux à votre Talent Magie des
 *  Arcanes ») — jeu sans MJ : seuls les Domaines au Type canonique évident sont mappés
 *  (Feu→Feu, Cieux→Électricité, Métal→Corrosif, Ombres→Fumée) ; les autres soufflent des Dégâts purs. */
function domainBreathType(caster: Combatant): string | undefined {
  const m = caster.talents.map((t) => t.name.match(/^Magie des Arcanes \(([^)]+)\)$/)).find(Boolean);
  const domain = (m?.[1] ?? '').toLowerCase();
  if (/feu/.test(domain)) return 'Feu';
  if (/cieux/.test(domain)) return 'Électricité';
  if (/m[ée]tal/.test(domain)) return 'Corrosif';
  if (/ombre/.test(domain)) return 'Fumée';
  return undefined;
}

/** Attribut d'Aqshy (LDB 48 l.157 — L14) : « Chaque État Enflammé situé à une distance en mètres
 *  égale à votre Bonus de Force Mentale ajoute +10 aux tentatives de Focalisation ou d'Incantation
 *  avec Aqshy. » — +10 par PION En flammes porté par un combattant à portée du LANCEUR.
 *  (Volet Focalisation : non câblé — différé documenté.) */
export function domainCastBonus(s: GameState, caster: Combatant, spell: { type?: string; subType?: string | null }): number {
  if (domainOf(spell) !== 'Feu' || !caster.pos) return 0;
  const radius = Math.max(1, Math.ceil(bonus(effectiveChar(caster, 'FM')) / 2));
  let pions = 0;
  for (const c of s.battle?.combatants ?? []) {
    if (!c.pos || isOutOfAction(c)) continue;
    if (combatDistance(caster, c) <= radius) pions += stacks(c, 'En flammes');
  }
  return 10 * pions;
}

/** « N'écoutez point la Sorcière » (LDB 42) : « Tous les Sorts qui ciblent quelque chose ou
 *  quelqu'un dans les (BSoc) mètres subissent une pénalité de -20 aux Tests de Langue (Magick),
 *  en plus de toute autre pénalité. » — −20 si la CIBLE du Sort est dans le rayon d'un porteur
 *  de l'aura (`ActiveEffect.castWard`) encore en état de combattre. Sorts seulement (les Prières
 *  passent par Prière, pas Langue). Une fois, même sous plusieurs auras (toutes à −20). Hors
 *  combat (pas de géométrie), l'aura ne s'applique pas — limitation documentée. */
export function castWardPenalty(s: GameState, target: Combatant, spell: { type: string }): number {
  if (castInfoIsPrayer(spell.type)) return 0;
  if (!target.pos) return 0;
  const warded = (s.battle?.combatants ?? []).some(
    (w) => !isOutOfAction(w) && w.pos && (w.activeEffects ?? []).some(
      (e) => e.castWard && combatDistance(w, target) <= Math.max(1, Math.ceil(e.castWard.radiusMeters / 2)),
    ),
  );
  return warded ? -20 : 0;
}

/** Fin de combat : réécrit l'état persistant de chaque héros (Blessures, critiques, mort, États
 *  persistants) vers `party`. Idempotent ; les champs non persistants du membre party sont conservés. */
export function finalizeBattle(get: Get, set: SetFn): void {
  const { battle, party } = get();
  if (!battle) return;
  // « Après un combat où vous avez subi une Blessure critique » (LDB 20 l.72) : Test de Résistance Très
  // Facile (+60) ou Infection Mineure. Auto-résolu (comme le Test de Résistance interne d'un critique) sur
  // les héros survivants ; mute le combattant AVANT le report d'état (carryOverState copie `diseases`).
  const infectLog: string[] = [];
  for (const c of battle.combatants) {
    if (c.kind !== 'hero' || !c.tookCriticalThisFight) continue;
    const dressed = c.woundDressed; // pansement/Guérison pendant le combat → pas d'Infection (LDB 18 l.382)
    c.tookCriticalThisFight = false; // consommé (idempotent même si finalizeBattle est rappelé)
    c.woundDressed = false;
    if (c.dead || dressed) continue;
    const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    infectLog.push(...rollContraction(c, 'Infection Mineure', resVal, 'tresFacile', battleRng()));
  }
  // Trait Infecté (LDB 20 l.32/49) : blessé par une créature Infectée → Résistance Facile (+40) ou
  // Blessure Purulente ; blessé par un RONGEUR Infecté → aussi Résistance Accessible (+20) ou Fièvre
  // du Rongeur. Trait Maladie (Type) (LDB 85 p.340) : Test de Contraction de la maladie portée.
  for (const c of battle.combatants) {
    if (c.kind !== 'hero' || c.dead) continue;
    const resVal = effectiveChar(c, 'E') + (c.skills?.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
    if (c.woundedByInfected) infectLog.push(...rollContraction(c, 'Blessure Purulente', resVal, 'facile', battleRng()));
    if (c.woundedByRodent) infectLog.push(...rollContraction(c, 'Fièvre du Rongeur', resVal, 'accessible', battleRng()));
    for (const name of c.diseaseExposure ?? []) {
      const def = DISEASE_DEFS[name] ?? Object.values(DISEASE_DEFS).find((d) => d.name.toLowerCase() === name.toLowerCase());
      if (def) infectLog.push(...rollContraction(c, def.name, resVal, def.contractDifficulty, battleRng()));
      else infectLog.push(`${c.name} a été exposé à : ${name} (maladie non répertoriée — arbitrage MJ).`);
    }
    c.woundedByInfected = false;
    c.woundedByRodent = false;
    c.diseaseExposure = undefined;
  }
  // Trait Corruption (Degré) (LDB 85 p.338 → LDB 19) : avoir AFFRONTÉ une créature corrompue est une
  // EXPOSITION du Degré indiqué — Test de Résistance Intermédiaire auto-résolu en fin de combat,
  // gain de Points selon le niveau et le DR (corruptionGain), puis seuil/mutation via gainCorruption.
  const degrees = battle.combatants
    .filter((c) => c.kind !== 'hero')
    .flatMap((c) => (c.traits ?? []).map(asTrait).filter((t) => t.key === 'Corruption').map((t) => t.arg).filter(Boolean));
  if (degrees.length) {
    const rank = { mineure: 0, modérée: 1, majeure: 2 } as Record<string, number>;
    const worst = degrees.reduce((a, b) => (rank[b!.toLowerCase()] > rank[a!.toLowerCase()] ? b : a))!;
    const level = worst.toLowerCase() === 'majeure' ? 'majeure' : worst.toLowerCase() === 'modérée' ? 'moderee' : 'mineure';
    for (const c of battle.combatants) {
      if (c.kind !== 'hero' || c.dead) continue;
      const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
      const gain = corruptionGain(level, t.success, Math.max(0, t.sl));
      infectLog.push(`${c.name} — exposition à la Corruption (${worst}) : Résistance ${t.roll}/${t.target}${gain ? '' : ', résiste'}.`);
      if (gain > 0) infectLog.push(...gainCorruption(get, set, c, gain));
    }
  }
  const newParty = party.map((h) => {
    const c = battle.combatants.find((x) => x.id === h.id && x.kind === 'hero');
    return c ? { ...h, ...carryOverState(c) } : h;
  });
  set({ party: newParty, ...(infectLog.length ? { journal: [...get().journal.slice(-40), ...infectLog] } : {}) });
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
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !isOutOfAction(c));
  if (!enemiesAlive) {
    finalizeBattle(get, set); // writeback AVANT onVictory (qui ajoute XP/butin au groupe)
    set({ battle: { ...get().battle!, over: 'victory', log: [...battle.log, ev('info', 'Victoire !')] } });
    bus.emit(EVT.BATTLE_OVER, { victory: true }); // gong audio + hooks futurs
    // Capture des récompenses pour l'écran de victoire : on mesure ce que onVictory octroie (XP/or/butin)
    // par diff avant/après, + la liste des vaincus (groupée par nom). L'écran (VictoryScreen) lit `pendingVictory`.
    const xpBefore = get().party[0]?.xp ?? 0;
    const brassBefore = toBrass(get().money);
    // #9 : on sépare les effets onVictory. Récompenses/flags/journal s'appliquent MAINTENANT (pour peupler
    // l'écran) ; ceux qui CHANGENT le contexte (téléport/dialogue/combat) sont DIFFÉRÉS au clic « Continuer »
    // (dismissVictory) — sinon le téléport masque l'écran de victoire (cas de l'arène).
    const CONTEXT = new Set(['transition', 'transitionBack', 'startDialogue', 'startCombat']);
    const all = battle.onVictory ?? [];
    const deferred = all.filter((e) => CONTEXT.has(e.type));
    // L'ÉQUIPEMENT (giveTrapping sans heroId) devient du butin ATTRIBUABLE sur l'écran (qualités
    // conservées) au lieu d'aller d'office au 1er héros — même brique que la fenêtre de loot
    // (gearFromEffects). Un giveTrapping ciblé (heroId d'auteur) s'applique directement.
    const { gear, rest: immediate } = gearFromEffects(all.filter((e) => !CONTEXT.has(e.type)));
    const messages = immediate.filter((e) => e.type === 'journal').map((e) => (e as { text: string }).text);
    if (immediate.length) applyEffects(get, set, immediate);
    const after = get();
    const counts = new Map<string, number>();
    for (const c of battle.combatants) if (c.kind === 'enemy') counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    set({
      pendingVictory: {
        xp: Math.max(0, (after.party[0]?.xp ?? 0) - xpBefore),
        gold: fromBrass(Math.max(0, toBrass(after.money) - brassBefore)),
        gear: gear.length ? gear : undefined,
        defeated: [...counts].map(([name, count]) => ({ name, count })),
        messages: messages.length ? messages : undefined,
        onContinue: deferred.length ? deferred : undefined,
      },
    });
    return true;
  }
  if (!heroesAlive) {
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, ev('info', 'Défaite…')] } });
    return true;
  }
  return false;
}

/** Résolution du choix Piège-lame (LDB 62 l.292-294). `trap=false` → Coup Critique normal (LDB 14 l.7) ;
 *  `trap=true` → Test opposé de Force (+DR de la défense) : victoire = désarme, Succès Stupéfiant (DR
 *  net ≥ 6) = brise la lame sauf Incassable (sauvegarde Solide), échec = l'adversaire se libère. */
/** Résout un Piège-lame — invoqué par l'applier de l'étape de séquence 'bladeTrap' (la reprise de l'IA
 *  part de la fermeture de séquence, pas ici). */
export function resolveBladeTrap(get: Get, set: SetFn, pbt: PendingBladeTrap, trap: boolean): void {
  const battle = get().battle;
  if (!battle) return;
  const defender = battle.combatants.find((c) => c.id === pbt.defenderId);
  const attacker = battle.combatants.find((c) => c.id === pbt.attackerId);
  if (!defender || !attacker) return;
  const lines: string[] = [];
  if (!trap) {
    lines.push(`${defender.name} place un Critique sur sa défense.`);
    applyOpposedCritical(get, set, attacker, pbt.roll, { attackerId: defender.id, weapon: pbt.parryWeaponName }, lines);
  } else if (!isOutOfAction(attacker)) {
    // Test opposé de Force, le piégeur ajoutant son DR du Test de Corps à corps précédent (l.293).
    const dT = rollTest(effectiveChar(defender, 'F'), 'intermediaire', battleRng());
    const aT = rollTest(effectiveChar(attacker, 'F'), 'intermediaire', battleRng());
    const opp = resolveOpposed({ ...dT, sl: dT.sl + pbt.defSL }, aT);
    lines.push(`Test opposé de Force : ${defender.name} 🎲 ${dT.roll}/${dT.target} (DR ${dT.sl}+${pbt.defSL}) contre ${attacker.name} 🎲 ${aT.roll}/${aT.target} (DR ${aT.sl}).`);
    if (opp.winner === 'attacker') {
      const drop = attacker.weapons.find((w) => (pbt.weapon.uid && w.uid === pbt.weapon.uid) || w.name === pbt.weapon.name);
      if (drop && opp.netSL >= 6) {
        // Succès Stupéfiant : la lame est BRISÉE, à moins qu'elle ne possède l'Atout Incassable (l.294).
        wearActiveWeapon(attacker, drop, true);
        lines.push(drop.destroyed
          ? `La lame de ${attacker.name} (${drop.name}) est BRISÉE par la manœuvre !`
          : `${drop.name} résiste à la casse (Incassable/Solide) mais est arrachée des mains de ${attacker.name}.`);
        attacker.weapons = attacker.weapons.filter((w) => w !== drop);
      } else if (drop) {
        attacker.weapons = attacker.weapons.filter((w) => w !== drop);
        lines.push(`${attacker.name} laisse tomber ${drop.name}, arrachée de ses mains !`);
      }
    } else {
      lines.push(`${attacker.name} libère sa lame et peut combattre normalement.`);
    }
  }
  const b = get().battle!;
  set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', defender.id, attacker.id)] } });
  // Modale seulement si un héros est d'un côté du piège (spec coop §4bis) — déjà journalisé ci-dessus.
  if (attacker.kind === 'hero' || defender.kind === 'hero')
    pushReveal(set, { kind: 'assommante', title: 'Piège-lame', lines: [...lines], subjectId: attacker.id, actorId: defender.id, weapon: pbt.parryWeaponName, severity: 'minor' });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Applier de l'étape de CHOIX « piège-lame » (folding P3b) : « Piéger » tente le Test opposé de Force,
 *  « Coup Critique » inflige le critique normal. Le RÉSULTAT (kind 'assommante') route lui-même dans la
 *  séquence (P2) ; `resume:false` → reprise par la fermeture de séquence. */
registerCascadeApplier('bladeTrap', (get, set, step) => {
  if (step.bladeTrap) resolveBladeTrap(get, set, step.bladeTrap, step.chosen === 'trap');
});

/** Déstabilisante (Aux Armes p.89) : résout le choix du héros de renverser (dépense d'Avantages +
 *  Test opposé Force/Athlétisme → À Terre). `accept=false` : il renonce, rien n'est dépensé. */
export function resolveKnockdown(get: Get, set: SetFn, accept: boolean, pk: PendingKnockdown): void {
  const { battle } = get();
  if (!battle) return;
  const attacker = battle.combatants.find((c) => c.id === pk.attackerId);
  const target = battle.combatants.find((c) => c.id === pk.targetId);
  if (!attacker || !target) return;
  const lines: string[] = [];
  if (accept && (attacker.advantage ?? 0) >= pk.advantageCost && !isOutOfAction(target) && !hasCondition(target, pk.condition)) {
    attacker.advantage = (attacker.advantage ?? 0) - pk.advantageCost;
    const aSk = pk.skill ? (attacker.skills.find((s) => s.name.toLowerCase().startsWith(pk.skill!.toLowerCase()))?.advances ?? 0) : 0;
    const dSk = pk.skill ? (target.skills.find((s) => s.name.toLowerCase().startsWith(pk.skill!.toLowerCase()))?.advances ?? 0) : 0;
    const aT = rollTest(effectiveChar(attacker, pk.char) + aSk, 'intermediaire', battleRng());
    const dT = rollTest(effectiveChar(target, pk.char) + dSk, 'intermediaire', battleRng());
    const opp = resolveOpposed(aT, dT);
    lines.push(`Renversement (${pk.quality}) — Test opposé : ${attacker.name} 🎲 ${aT.roll}/${aT.target} (DR ${aT.sl}) contre ${target.name} 🎲 ${dT.roll}/${dT.target} (DR ${dT.sl}).`);
    lines.push(opp.winner === 'attacker' ? `${target.name} est ${pk.condition} !` : `${target.name} garde son équilibre.`);
    if (opp.winner === 'attacker') addCondition(target, pk.condition);
  } else if (accept) {
    lines.push(`${attacker.name} ne peut plus tenter le renversement.`);
  }
  const b = get().battle!;
  if (lines.length) set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', attacker.id, target.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  // PAS de resumeEnemyTurn : la cascade d'attaque (purpose:'combat') reprend l'IA à sa finalisation.
}
/** Applier de l'étape de CHOIX « renversement » (Déstabilisante) — folding façon Déviation/Piège-lame. */
registerCascadeApplier('knockdown', (get, set, step) => {
  if (step.knockdown) resolveKnockdown(get, set, step.chosen === 'yes', step.knockdown);
});

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
export function resumeEnemyTurn(get: Get, set: SetFn): void {
  const b = get().battle;
  if (!b || b.over || get().pendingCast || get().pendingFateSave || get().pendingFumble || get().pendingCascade || get().pendingReveals.length) return;
  setTimeout(() => advanceTurn(get, set), TEMPO.enemyAdvance);
}

/** Reprend un tour d'IA SUSPENDU par une modale bloquante (révélations OU séquence de conséquences de
 *  combat) une fois qu'elle est CLOSE — appelée par `dismissReveal` (file vidée) et par la fin d'une
 *  séquence de combat (`cascadeNext`/`cascadeFinish`). Garde alignée sur celle de `resumeEnemyTurn`. */
export function resumeSuspendedAI(get: Get, set: SetFn): void {
  const { battle, pendingReveals, pendingCascade, pendingFateSave, pendingFumble } = get();
  if (!battle || battle.over || pendingReveals.length || pendingCascade || pendingFateSave || pendingFumble) return;
  const active = activeCombatant(battle);
  if (active && active.kind === 'enemy' && !isOutOfAction(active)) {
    // Ennemi ayant déjà agi (conséquence d'attaque) → fin de tour ; sinon début de tour (entretien) → IA.
    if (battle.acted) resumeEnemyTurn(get, set);
    else maybeRunEnemyTurn(get, set);
  }
}

export function advanceTurn(get: Get, set: SetFn) {
  const battle = get().battle;
  // Pause de début de Round (PERSONNE n'est actif, turn -1) : un advanceTurn retardataire (timer
  // d'IA en vol) ne doit pas ré-incrémenter le tour SOUS la pause — confirmRoundStart le posera.
  if (get().pendingRoundStart) return;
  if (!battle || battle.over || get().pendingCast || get().pendingFateSave || get().pendingFumble || get().pendingCascade || get().pendingReveals.length) return;
  // La Charge ne vaut que pour le tour où elle a lieu (Cornes LDB 85, Épuisante LDB 63 l.16-17) :
  // consommée au passage au combattant suivant (filet de sécurité, l'IA la consomme aussi en chemin).
  const prevActive = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  if (prevActive?.chargedThisTurn) prevActive.chargedThisTurn = false;
  if (prevActive?.tentacleUsedThisTurn) prevActive.tentacleUsedThisTurn = false; // Attaque gratuite de Tentacule : 1/tour

  let turn = battle.turn;
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      // Franchissement de Round : upkeep (dégâts périodiques + 0 PB→Inconscient), puis la résolution
      // (morts lentes avec sauvetage par Destin) est déléguée à resolveRoundBoundary — résumable,
      // car elle peut suspendre (pendingFateSave / pendingRoundStart).
      const round = battle.round + 1;
      get().advanceTime(TIME_COST.combatRound); // « tout est horodaté » : 1 Round franchi = +combatRound min
      battle.log.push(ev('round', `— Round ${round} —`));
      // Ordre du Round : on REPART de l'ordre canonique (baseOrder) — donc tout réordonnancement
      // (Maladresse « agir en dernier » Oups! 21-40, pré-emption Chance) ne dure qu'UN Round (l.22-25).
      const base = battle.baseOrder ?? battle.order;
      // Agir en dernier : Maladresse (Oups! 21-40, 1 Round) OU arme Lente active (LDB 63 l.25, permanent).
      const lastIds = battle.combatants.filter((c) => c.actLastNextRound || strikesLast(c.weapons)).map((c) => c.id);
      battle.order = [...base.filter((id) => !lastIds.includes(id)), ...base.filter((id) => lastIds.includes(id))];
      for (const c of battle.combatants) if (c.actLastNextRound) { c.actLastNextRound = false; battle.log.push(ev('detail', `${c.name} agira en dernier ce Round (Maladresse).`, c.id)); }
      // Entretien de Round PARTITIONNÉ (spec coop §4bis) : TOUT va au journal de combat (bandeau) ;
      // seules les lignes CONCERNANT UN HÉROS alimentent la révélation (les ennemis : journal seul).
      const heroRoundLines: string[] = [];
      const tickLine = (line: string, c?: Combatant) => {
        battle.log.push(ev('condition', line, c?.id));
        if (c?.kind === 'hero') heroRoundLines.push(line);
      };
      for (const c of battle.combatants) endOfRound(c, battleRng()).forEach((l) => tickLine(l, c));
      for (const c of battle.combatants) refreshWounds(c); // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
      // Effets « début de Round » authorés (Régénération : un d10 → soin = le dé si PB>0 ; à 0, 8+ →
      // 1 PB + reprise de conscience ; 10 → +1 Critique soigné) — dispatcher générique
      // (state/triggeredEffects). (Exception du Feu non suivie — provenance des Blessures non tracée.)
      for (const c of battle.combatants) {
        if (c.dead || c.outOfRencontre) continue;
        for (const line of fireTriggers(get, c, 'onRoundStart', { rng: battleRng() })) tickLine(line, c);
      }
      // Instable (LDB 85 p.340) : fin de Round Engagé avec un adversaire d'Avantage SUPÉRIEUR →
      // perd la différence en PB ; à 0 PB, elle « meurt » (les magies qui la maintiennent cèdent).
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || !isUnstable(c.traits)) continue;
        const foesAdv = (c.engagedWith ?? [])
          .map((id) => battle.combatants.find((x) => x.id === id))
          .filter((e): e is Combatant => !!e && e.kind !== c.kind && !isOutOfAction(e))
          .map((e) => e.advantage ?? 0);
        const diff = (foesAdv.length ? Math.max(...foesAdv) : 0) - (c.advantage ?? 0);
        if (diff > 0) {
          loseWounds(c, diff);
          tickLine(`${c.name} (Instable) est repoussée : −${diff} PB.`, c);
          if (c.wounds.current <= 0) { c.dead = true; tickLine(`${c.name} se délite — les magies qui la maintenaient s'effondrent.`, c); }
        }
      }
      // Bestial (LDB 85 p.338) : « Elle a peur du feu et gagne l'État Brisé si elle est touchée par
      // ce dernier » — approximé sur l'État En flammes (granularité Round, documenté).
      for (const c of battle.combatants) {
        if (!isOutOfAction(c) && isBestial(c.traits) && hasCondition(c, 'En flammes') && !hasCondition(c, 'Brisé')) {
          addCondition(c, 'Brisé');
          tickLine(`${c.name} (Bestial) est terrifié par les flammes : Brisé.`, c);
        }
      }
      // Perturbant (LDB 85 p.341) : −20 à tous les Tests à Bonus d'Endurance mètres d'une créature
      // Perturbante (non cumulable). Aura recalculée à chaque franchissement de Round (granularité assumée).
      for (const c of battle.combatants) {
        c.perturbed = !isOutOfAction(c) && !!c.pos && battle.combatants.some(
          (p) => p.id !== c.id && p.kind !== c.kind && !isOutOfAction(p) && p.pos
            && hasPerturbingAura(p.traits) && chebyshev(p.pos, c.pos!) * 2 <= bonus(effectiveChar(p, 'E')),
        );
      }
      // Surnombre (LDB 14 l.149) : un combattant surpassé en nombre (≥2 ennemis Engagés avec lui) perd 1 Avantage en fin de Round.
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || (c.advantage ?? 0) <= 0) continue;
        const foes = (c.engagedWith ?? []).filter((id) => {
          const e = battle.combatants.find((x) => x.id === id);
          return !!e && e.kind !== c.kind && !isOutOfAction(e);
        }).length;
        // Maîtrise du combat (LDB 10) : on compte pour 1+niveau personnes au calcul du surnombre.
        if (foes >= 2 + outnumberCountBonus(c)) { c.advantage = Math.max(0, c.advantage - 1); tickLine(`${c.name} est surpassé en nombre (${foes} c.1) : −1 Avantage.`, c); }
      }
      // Mâchoires d'acier (LDB 10) : Test de Résistance (+0) — retire 1 + DR États Sonné (résolu au
      // franchissement de Round, approximation de « chaque fois que vous gagnez un État Sonné »).
      for (const c of battle.combatants) {
        if (isOutOfAction(c) || !hasStunSave(c) || !stacks(c, 'Sonné')) continue;
        const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
        if (t.success) {
          const n = Math.min(stacks(c, 'Sonné'), 1 + Math.max(0, t.sl));
          removeCondition(c, 'Sonné', n);
          tickLine(`${c.name} secoue la tête (Mâchoires d'acier) : ${n} État(s) Sonné retiré(s).`, c);
        }
      }
      for (const c of battle.combatants) if (c.frenzied) c.frenzyFreeUsed = false; // Frénésie : nouvelle attaque CC gratuite chaque Round (LDB 21 l.34)
      for (const c of battle.combatants) if (c.ignoreCritMods) c.ignoreCritMods = false; // Détermination : « ignorer modifs de critique » expire au début du prochain Round (LDB 17 l.64)
      for (const c of battle.combatants) if (c.psychImmuneRoundsLeft) c.psychImmuneRoundsLeft -= 1; // Détermination : l'immunité psy décompte 1 Round (LDB 17 l.62)
      brokenRecovery(get, tickLine); // récupération du Brisé en fin de Round (LDB 16 l.57-59)
      for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => tickLine(l, c)); // 0 PB→Inconscient (LDB 18 l.28)
      for (const c of battle.combatants) suffocationTick(c).forEach((l) => tickLine(l, c)); // Noyade et Suffocation (LDB 18 l.424-425) ; la mort passe par inDeathCondition (Destin inclus)
      zonesRoundTick(battle.zones, battle.combatants, battleRng()).forEach((t) => tickLine(t.line, t.combatant)); // zones perRound (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »)
      for (const c of battle.combatants) if (isOutOfAction(c)) clearPsychOf(battle.combatants, c.id); // effets psy d'une créature morte → fin (catch-all toutes causes de mort)
      purgeExpiredSummons(battle, round).forEach((l) => tickLine(l)); // invocations à durée écoulée OU lanceur tombé (state/summonFlow)
      if (heroRoundLines.length) pushReveal(set, { kind: 'round', title: `Fin du Round ${round - 1}`, lines: heroRoundLines, severity: 'minor' }); // « un jet = une modale » (entretien HÉROS — auto-fermée)
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
    if (newActive.loseNextMovement) { movementUsed = mountMovement(battle, newActive); newActive.loseNextMovement = false; battle.log.push(ev('detail', `${newActive.name} perd son Mouvement (Maladresse).`, newActive.id)); }
    if (newActive.loseNextAction) { acted = true; newActive.loseNextAction = false; battle.log.push(ev('detail', `${newActive.name} perd son Action (Maladresse).`, newActive.id)); }
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
  // (2) Finaliser les morts lentes restantes (héros sans Destin).
  for (const c of battle.combatants) if (inDeathCondition(c)) c.dead = true;
  // (3) Avantage : -1 si aucun gagné ce Round (LDB Dépl. l.40) ; Engagé périmé (LDB 13-Combat l.175).
  for (const c of battle.combatants) {
    if (!isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
    c.gainedAdvThisRound = false;
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
  openRoundEndPsych(get, set);
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
  const reset = { ...b, action: null, movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, reachable: new Map(), preview: null, runBudget: null, fearGate: null };
  if (get().net.mode !== 'local' && b.round > 1 && !b.handRaised) {
    set({ battle: reset, pendingRoundStart: null });
    get().confirmRoundStart();
    return;
  }
  // Pause de début de Round : PERSONNE n'est actif (turn -1) — confirmRoundStart posera le tour.
  set({ battle: { ...reset, turn: -1, handRaised: false }, pendingRoundStart: { round: b.round } });
}

/** IA simple : si le combattant actif est un ennemi, il agit puis passe la main. */
export function maybeRunEnemyTurn(get: Get, set: SetFn) {
  const battle = get().battle;
  if (!battle || battle.over || get().pendingRoundStart || get().pendingCast || get().pendingFateSave || get().pendingFumble || get().pendingCascade || get().pendingReveals.length) return;
  const active = activeCombatant(battle);
  if (!active || active.kind !== 'enemy' || isOutOfAction(active)) return;
  setTimeout(() => runEnemyAI(get, set, active.id), TEMPO.turnHandoff);
}

/** LDB 21 l.29 : « Si la source de votre Peur se rapproche de vous, vous devez réussir un Test de Calme
 *  Intermédiaire (+0) ou gagner un État Brisé. » Appelé APRÈS le déplacement de `mover` (IA) : tout héros
 *  qui le craint (Peur active non vaincue) ET dont il s'est rapproché fait un Test de Calme ; échec → Brisé.
 *  Jet montré en révélation témoin (comme la Fuite). */
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
    const t = rollTest(calmeValue(c), 'intermediaire', battleRng());
    const line = t.success ? `${c.name} garde son sang-froid alors que ${mover.name} s'approche.` : `${c.name} panique alors que ${mover.name} s'approche : 1 État Brisé.`;
    if (!t.success) addCondition(c, 'Brisé', 1);
    battle.log.push(ev('fear', line, c.id, mover.id));
    if (c.kind === 'hero') pushReveal(set, { kind: 'calme', title: 'Approche menaçante', dice: t.roll, lines: [line], subjectId: c.id, severity: 'minor' });
  }
}

/** Récupération du Brisé en fin de Round (LDB 16 l.57-59) — combattant par combattant :
 *  - pas de Test si Engagé (l.57) ; sinon Test de Calme dont la Difficulté suit les circonstances
 *    (caché hors de vue → Accessible +20 ; ennemi à ≤ 3 cases → Très difficile −30 ; sinon Intermédiaire +0),
 *    retirant 1 + DR États Brisé sur un succès ;
 *  - +1 État Brisé retiré si l'on est resté caché hors de vue de TOUT ennemi ce Round (l.59).
 *  Émet chaque ligne via `sink(line, combattant)` — l'entretien de Round partitionne héros/ennemis. */
export function brokenRecovery(get: Get, sink: (line: string, c: Combatant) => void): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return;
  for (const c of battle.combatants) {
    if (!stacks(c, 'Brisé') || isOutOfAction(c) || !c.pos) continue;
    const enemies = battle.combatants.filter((e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos);
    const hidden = !!scene && enemies.length > 0 && enemies.every((e) => lineOfSightCover(scene, e.pos!, c.pos!, [], smokeOf(battle)).blocked);
    if (hidden) { removeCondition(c, 'Brisé', 1); sink(`${c.name} est resté caché hors de vue : retire 1 État Brisé.`, c); }
    // Récupération par Test de Calme : seulement si pas Engagé (l.57) — sauf Cœur vaillant
    // (LDB 10 : Test de Calme en fin de Round, sans restriction d'Engagement) — et qu'il reste du Brisé.
    if ((!isEngaged(c) || hasBraveheart(c)) && stacks(c, 'Brisé')) {
      const nearest = enemies.length ? Math.min(...enemies.map((e) => chebyshev(c.pos!, e.pos!))) : Infinity;
      const diff: import('../engine/types').Difficulty = hidden ? 'accessible' : nearest <= 3 ? 'tresDifficile' : 'intermediaire';
      const t = rollTest(calmeValue(c), diff, battleRng());
      if (t.success) {
        const removed = Math.min(stacks(c, 'Brisé'), 1 + Math.max(0, t.sl));
        removeCondition(c, 'Brisé', removed);
        sink(`${c.name} se ressaisit : retire ${removed} État(s) Brisé (Test de Calme réussi).`, c);
      } else {
        sink(`${c.name} reste Brisé (Test de Calme raté).`, c);
      }
    }
    // « Une fois que vous n'avez plus d'États Brisé, vous gagnez 1 État Exténué » (LDB 16 l.80).
    if (!stacks(c, 'Brisé')) { addCondition(c, 'Exténué'); sink(`${c.name} est Exténué (après s'être ressaisi).`, c); }
  }
}

/** Psychologie d'un ENNEMI (IA) au début de son tour (LDB 21) : teste Peur/Terreur des sources
 *  adverses en Ligne de Vue. Terreur ratée → Brisé ; Peur → Test étendu de Calme (cumul). Instantané
 *  et JOURNALISÉ (pas de modale/révélation pour l'IA — le joueur voit l'État Brisé). */
export function resolvePsychAI(get: Get, set: SetFn, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  // Belliqueux (LDB 85 p.338) : immunité psy tant qu'il a plus d'Avantages que son adversaire ENGAGÉ.
  const engagedFoesAdv = (enemy.engagedWith ?? [])
    .map((id) => battle.combatants.find((x) => x.id === id))
    .filter((e): e is Combatant => !!e && e.kind !== enemy.kind && !isOutOfAction(e))
    .map((e) => e.advantage ?? 0);
  if (isPsychImmune(enemy, engagedFoesAdv.length ? Math.max(...engagedFoesAdv) : undefined)) return; // Immunité (Psychologie) / Frénésie / Détermination temp / Belliqueux
  enemy.psychState ??= [];
  const log: string[] = [];
  // Nouvelles sources de peur/terreur en Ligne de Vue (non encore rencontrées).
  for (const foe of battle.combatants) {
    if (foe.kind === enemy.kind || isOutOfAction(foe) || !foe.pos) continue;
    if (lineOfSightCover(scene, enemy.pos, foe.pos, [], smokeOf(battle)).blocked) continue;
    const src = fearSourceFor(enemy, foe);
    if (!src || enemy.psychState.some((p) => p.sourceId === foe.id)) continue;
    if (src.kind === 'terreur') {
      const r = resolveTerreurTest(calmeValue(enemy), src.indice, battleRng(), isColdBlooded(enemy.traits)); // À sang-froid : inverse un raté (LDB 85)
      if (!r.success) {
        addCondition(enemy, 'Brisé', r.brise);
        log.push(`${enemy.name} est terrifié par ${foe.name} : ${r.brise} Brisé.`);
      }
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: r.success ? 0 : r.devientPeur, calmeDR: 0, lastTestRound: battle.round }); // Terreur → Peur
    } else {
      enemy.psychState.push({ type: 'peur', sourceId: foe.id, indice: src.indice, calmeDR: 0, lastTestRound: battle.round });
      log.push(`${enemy.name} a peur de ${foe.name}.`);
    }
  }
  // Test ÉTENDU de Calme des Peur actives (calmeDR < indice) — UNE fois par Round.
  for (const p of enemy.psychState) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 0) || p.lastTestRound === battle.round) continue;
    const r = resolvePeurTest(calmeValue(enemy), p.indice ?? 1, p.calmeDR ?? 0, battleRng(), isColdBlooded(enemy.traits)); // À sang-froid (LDB 85)
    p.calmeDR = r.calmeDR;
    p.lastTestRound = battle.round;
    if (r.vaincue) log.push(`${enemy.name} surmonte sa peur.`);
  }
  // ── Traits psy CIBLÉS (Animosité/Haine/… — LDB 21), instantané pour l'IA ──
  const visible = battle.combatants.filter((v) => v.id !== enemy.id && v.pos && !isOutOfAction(v) && !lineOfSightCover(scene, enemy.pos!, v.pos, [], smokeOf(battle)).blocked);
  for (const p of enemy.psychState) {
    // Re-test (fin de Round) des afflictions ciblées actives, tant qu'un membre du groupe est visible.
    if (!p.active || !CIBLE_TYPES.has(p.type) || !p.cible || p.lastTestRound === battle.round) continue;
    if (!visible.some((v) => groupMatch(p.cible!, v.groups ?? []))) continue;
    p.lastTestRound = battle.round;
    if (resolveCalmeSimple(calmeValue(enemy), battleRng()).success) { p.active = false; log.push(`${enemy.name} se ressaisit (${p.type}).`); }
  }
  const tt = targetedTrigger(enemy, visible); // nouveau Trait ciblé déclenché par un membre du groupe visible
  if (tt) {
    const r = resolveCalmeSimple(calmeValue(enemy), battleRng());
    enemy.psychState.push({ type: tt.type, cible: tt.cible, sourceId: tt.sourceId, active: !r.success, lastTestRound: battle.round });
    if (!r.success) log.push(`${enemy.name} est en proie à son ${tt.type} (${tt.cible}).`);
  }
  if (log.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'fear', enemy.id)] } });
}

/** Forme commune d'un Test de Psychologie de combat DÛ pour un héros (cumul `prevDR` = 0 sauf Peur étendue). */
type HeroPsychDue = { kind: PsychType; sourceId: string; sourceName: string; indice: number; prevDR: number; cible?: string };

/** Combattants en Ligne de Vue de `c` (hors lui-même, debout). Mutualisé par les deux collectes. */
function visibleFoesAndAllies(battle: BattleState, scene: import('./scene').Scene, c: Combatant): Combatant[] {
  return battle.combatants.filter((v) => v.id !== c.id && v.pos && !isOutOfAction(v) && !lineOfSightCover(scene, c.pos!, v.pos, [], smokeOf(battle)).blocked);
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
    if (lineOfSightCover(scene, c.pos, foe.pos, [], smokeOf(battle)).blocked) continue;
    const src = fearSourceFor(c, foe);
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
    if (lineOfSightCover(scene, c.pos, foe.pos, [], smokeOf(battle)).blocked) continue;
    const src = fearSourceFor(c, foe);
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
  const battle = get().battle;
  if (!battle || battle.over || get().pendingCascade || get().pendingReveals.length || get().pendingFateSave || get().pendingFumble) return;
  const steps: import('./pendings').CascadeStep[] = [];
  for (const c of battle.combatants) {
    if (c.kind !== 'hero' || isOutOfAction(c)) continue;
    endFrenzyIfDone(get, set, c); // une Frénésie finie (plus d'ennemi / Sonné) sort le héros (Exténué) avant tout test
    const t = collect(get, c);
    if (!t) continue;
    const isCible = CIBLE_TYPES.has(t.kind);
    const cl = isCible ? CIBLE_LABEL[t.kind] : null;
    const calme = calmeValue(c);
    steps.push({
      id: `psych-${c.id}`,
      kind: 'combatPsych',
      actorId: c.id,
      icon: cl?.emoji ?? (t.kind === 'terreur' ? '😱' : '😨'),
      rollLabel: 'Calme',
      base: calme,
      target: calme, // Test de Calme Intermédiaire (+0)
      label: cl ? `${cl.emoji} ${cl.label}${t.cible ? ` (${t.cible})` : ''}` : `${t.kind === 'terreur' ? '😱 Terreur' : '😨 Peur'} ${t.indice}`,
      combatPsych: { kind: t.kind, sourceId: t.sourceId, sourceName: t.sourceName, indice: t.indice, cible: t.cible, prevDR: t.prevDR },
    });
  }
  if (!steps.length) return;
  startCascade(get, set, { title, icon, purpose: 'combat', steps, roundBoundary });
}

/** Cascade de Psychologie de DÉBUT de Round (Traits ciblés + nouvelles Terreurs, LDB 21 l.14) — un héros
 *  par étape. Appelée APRÈS `confirmRoundStart` (acteur posé) ; suspend l'IA jusqu'à résolution. */
export function openRoundStartPsych(get: Get, set: SetFn): void {
  openCombatPsychCascade(get, set, collectHeroRoundStartPsych, 'Sang-froid', '😤');
}

/** Cascade de Psychologie de FIN de Round (Peur — Test étendu de Calme, LDB 21 l.27) — un héros par
 *  étape. Appelée au franchissement de Round APRÈS l'entretien/le Destin ; suspend l'IA jusqu'à résolution. */
export function openRoundEndPsych(get: Get, set: SetFn): void {
  openCombatPsychCascade(get, set, collectHeroRoundEndPsych, 'Peur — fin de Round', '😨', true);
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
      return { journal: [`${hero.name} est temporairement insensible à la Psychologie (Détermination).`] };
    }
    let line: string;
    if (cp.kind === 'terreur') {
      // 1ʳᵉ rencontre (LDB 21 l.55-57) : échec → Brisé = Indice + |DR négatifs| ; devient une Peur.
      const brise = r.success ? 0 : cp.indice + Math.max(0, -r.sl);
      if (brise > 0) addCondition(hero, 'Brisé', brise);
      hero.psychState.push({ type: 'peur', sourceId: cp.sourceId, indice: r.success ? 0 : cp.indice, calmeDR: 0, lastTestRound: battle?.round });
      line = r.success ? `${hero.name} garde son sang-froid.` : `${hero.name} est terrifié par ${cp.sourceName} : ${brise} État(s) Brisé, puis Peur ${cp.indice}.`;
    } else if (CIBLE_TYPES.has(cp.kind)) {
      // Trait ciblé : échec → affliction active ; succès → marqueur inerte (pas de re-déclenchement).
      let e = hero.psychState.find((p) => p.type === cp.kind && p.cible === cp.cible);
      if (!e) { e = { type: cp.kind, cible: cp.cible, sourceId: cp.sourceId }; hero.psychState.push(e); }
      e.lastTestRound = battle?.round;
      e.active = !r.success;
      const cl = CIBLE_LABEL[cp.kind];
      line = r.success ? `${hero.name} maîtrise son ${cl?.label.toLowerCase() ?? cp.kind}.` : `${hero.name} est en proie à son ${cl?.label.toLowerCase() ?? cp.kind}.`;
    } else {
      // Peur = Test ÉTENDU de Calme (LDB 21 l.27) : cumuler le DR vers l'Indice (calque resolvePeurTest).
      const dr = r.success ? Math.max(0, r.sl) : 0;
      const calmeDR = cp.prevDR + dr;
      let e = hero.psychState.find((p) => p.sourceId === cp.sourceId && p.type === 'peur');
      if (!e) { e = { type: 'peur', sourceId: cp.sourceId, indice: cp.indice, calmeDR: 0 }; hero.psychState.push(e); }
      e.calmeDR = calmeDR;
      e.lastTestRound = battle?.round;
      line = calmeDR >= cp.indice ? `${hero.name} surmonte sa peur${cp.sourceName ? ` de ${cp.sourceName}` : ''}.` : `${hero.name} reste sous l'emprise de la Peur (${calmeDR}/${cp.indice} DR).`;
    }
    set({ party: [...get().party] });
    if (battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
    return { journal: [line] };
  },
  (success, name) => (success ? `${name} garde son sang-froid.` : `${name} cède à la Psychologie.`),
);

/** Fin de Frénésie (LDB 21 l.36) : si plus aucun adversaire vivant en Ligne de Vue, ou si Sonné /
 *  Inconscient → quitte la Frénésie et gagne **Exténué**. À appeler au début du tour du combattant. */
export function endFrenzyIfDone(get: Get, set: SetFn, c: Combatant): void {
  if (!c.frenzied) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos) return;
  const stunned = c.conditions.some((x) => x.name === 'Sonné' || x.name === 'Inconscient');
  const foeInLoS = battle.combatants.some(
    (f) => f.kind !== c.kind && !isOutOfAction(f) && f.pos && !lineOfSightCover(scene, c.pos!, f.pos, [], smokeOf(battle)).blocked,
  );
  if (stunned || !foeInLoS) {
    c.frenzied = false;
    addCondition(c, 'Exténué');
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenzy', `${c.name} sort de Frénésie (Exténué).`, c.id)] } });
  }
}

/** L'IA tente d'entrer en Frénésie au début de son tour (LDB 21 l.32) : combattant capable, pas déjà
 *  frenzied ni immunisé à la Psychologie, avec un adversaire vivant en Ligne de Vue → Test de Force
 *  Mentale ; sur un succès, il entre en Frénésie (gérée ensuite par les drapeaux). Instantané, journalisé. */
export function aiMaybeFrenzy(get: Get, set: SetFn, enemy: Combatant): void {
  if (enemy.kind !== 'enemy' || enemy.frenzied || enemy.psychImmune || isOutOfAction(enemy) || !isFrenzyCapable(enemy)) return;
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !enemy.pos) return;
  const foeInLoS = battle.combatants.some(
    (f) => f.kind !== enemy.kind && !isOutOfAction(f) && f.pos && !lineOfSightCover(scene, enemy.pos!, f.pos, [], smokeOf(battle)).blocked,
  );
  if (!foeInLoS) return;
  if (resolveFrenzyEntry(effectiveChar(enemy, 'FM'), battleRng()).success) {
    enemy.frenzied = true;
    set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenzy', `${enemy.name} entre en Frénésie !`, enemy.id)] } });
  }
}

export function runEnemyAI(get: Get, set: SetFn, enemyId: string) {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return;
  const enemy = battle.combatants.find((c) => c.id === enemyId);
  if (!enemy || isOutOfAction(enemy)) return advanceTurn(get, set);
  endFrenzyIfDone(get, set, enemy); // Frénésie finie → Exténué, avant de tester la psychologie
  // Rage (LDB 85 p.341) : « dépenser tous ses Avantages (minimum 3) pour entrer en Frénésie ».
  if (hasRage(enemy.traits) && !enemy.frenzied && (enemy.advantage ?? 0) >= 3) {
    enemy.advantage = 0;
    enemy.frenzied = true;
    battle.log.push(ev('frenzy', `${enemy.name} entre dans une rage dévorante (Frénésie) !`, enemy.id));
    set({ battle: { ...battle } });
  }
  aiMaybeFrenzy(get, set, enemy); // l'IA tente d'entrer en Frénésie (LDB 21 l.32) AVANT le test psy (la Frénésie en rend immunisé) et le choix de cible
  resolvePsychAI(get, set, enemy); // Peur/Terreur de l'IA au début de son tour (instantané, journalisé)
  // Stupide (LDB 85 p.341) : sans allié non-Stupide à ses côtés (adjacent), Test d'Intelligence
  // Facile (+40) au début du Round ; sur un échec, elle perd son Mouvement ET son Action.
  if (isStupid(enemy.traits) && enemy.pos) {
    const guided = battle.combatants.some(
      (a) => a.kind === enemy.kind && a.id !== enemy.id && !isOutOfAction(a) && !isStupid(a.traits) && a.pos && chebyshev(a.pos, enemy.pos!) <= 1,
    );
    if (!guided && !rollTest(effectiveChar(enemy, 'Int'), 'facile', battleRng()).success) {
      battle.log.push(ev('detail', `${enemy.name} (Stupide) bave et regarde dans le vide — Mouvement et Action perdus.`, enemy.id));
      set({ battle: { ...battle } });
      return advanceTurn(get, set);
    }
  }

  const heroes = battle.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
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
      battle.log.push(ev('move', `${enemy.name} enfourche ${freeMount.name}.`, enemy.id));
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  // Combat monté (LDB 14 l.215) : un cavalier ENNEMI se déplace selon la géométrie de sa MONTURE
  // (empreinte + Mouvement) ; le couple est solidaire (positions synchronisées à l'exécution du « move »).
  const geom = mountOf(battle, enemy) ?? enemy;
  const blocked = occupied(battle, geom);
  // Meilleur Projectile magique connu et JOUABLE (NI atteignable, Dégâts max — cf. aiBestMissile) :
  // la détection a besoin des données de sort, donc elle reste ici (couche impure), pas dans ai.ts.
  const offensiveSpell = aiBestMissile(enemy);
  // Portée du sort en CASES, résolue ici (ai.ts est pur, sans données de sort) — gate de ciblage IA.
  const offensiveSpellData = offensiveSpell ? findSpell(offensiveSpell) : undefined;
  const spellRange = offensiveSpellData ? spellRangeTiles(offensiveSpellData.range, enemy) : undefined;
  // Charge de cavalerie (LDB 15-Dépl l.74-77 / 14 l.223) : un cavalier ennemi non Engagé fonce à la portée
  // de COURSE (2× le Mouvement de sa monture) — PARITÉ avec le joueur ; à pied, l'IA reste en Marche (M).
  const cavalryCharge = !!enemy.mountId && !isEngaged(enemy);
  // Bond ×2 / Foulée ×1,5 (LDB 85) sur la portée de COURSE/CHARGE (cavalerie) de la géométrie porteuse.
  let moveBudget = justMounted ? 0 : Math.floor(effectiveMovement(geom) * (cavalryCharge ? 2 * runMultiplier(geom.traits) : 1));
  // Vol (Indice) (LDB 85 p.343) : « elle peut voler jusqu'à Indice mètres » (1 case = 2 m) — le vol
  // remplace la Marche s'il porte plus loin. (Les obstacles traversés sont ignorés via `flying`.)
  const flyM = flyMeters(enemy.traits);
  if (!justMounted && flyM != null) moveBudget = Math.max(moveBudget, Math.floor(flyM / 2));
  const action = chooseEnemyAction({
    enemy,
    heroes,
    scene,
    blocked,
    movement: moveBudget,
    offensiveSpell,
    spellRange,
    smoke: smokeOf(battle),
    flying: flyM != null, // Vol : ignore terrains/obstacles/personnages traversés (LDB 85 p.343)
  });
  const targetOf = (id: string) => battle.combatants.find((c) => c.id === id)!;
  const canAct = canTakeAction(enemy); // Sonné : pas d'Action — déplacement seul (LDB États l.123)

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant, delay: number = TEMPO.preAttack) => {
    // Télégraphe (réticule + ligne — PLEINE en mêlée, pointillée au tir) pendant la pré-attaque :
    // même affordance que la visée du joueur, des deux côtés.
    set({ enemyAim: { fromId: enemy.id, toId: target.id, melee: firedWeapon(enemy, target).type !== 'ranged' } });
    bus.emit(EVT.SCENE_DIRTY);
    setTimeout(() => {
      set({ enemyAim: null });
      const b = get().battle;
      if (!b || b.over) return;
      // Attaque-ACTION spéciale (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
      // normale si la créature en a le trait + l'Avantage ; sinon attaque normale (opposée).
      const suspended = aiMaybeSpecialAction(get, set, enemy) ? false : doAttack(get, set, enemy, target);
      // Si la modale de défense s'ouvre, ne PAS armer advanceTurn ici : la reprise
      // est portée par defenseConfirm/defenseCancel → resumeEnemyTurn (anti double-advance).
      if (!suspended) {
        aiFrenzyAttack(get, set, enemy); // Frénésie : Test de CC gratuit après l'attaque principale (instantané, LDB 21 l.34)
        // Attaques gratuites de créature (Morsure/Caudale/Piétinement, OPPOSÉES) après l'attaque
        // principale ; si une modale de défense s'ouvre, ne PAS avancer (reprise via defenseConfirm).
        if (!aiCreatureFreeAttacks(get, set, enemy)) setTimeout(() => advanceTurn(get, set), TEMPO.postAttack);
      }
    }, delay);
  };

  // Combat monté (LDB 14 l.221) : une monture MONTÉE est dirigée par son cavalier — elle ne se déplace
  // pas seule (le couple bouge au tour du cavalier). Sans le Trait Nerveux, elle peut consacrer SA propre
  // Action à attaquer un adversaire au contact ; sinon elle passe son tour.
  if (enemy.riderId) {
    const nerveux = hasTraitKey(enemy.traits, 'Nerveux');
    const foe = nerveux || !canAct ? undefined
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
    case 'cast': {
      if (!canAct) return advanceTurn(get, set);
      const ctgt = targetOf(action.targetId);
      // Télégraphe d'incantation (parité tir) : ligne pointillée + réticule ~0,7 s avant le jet.
      set({ enemyAim: { fromId: enemy.id, toId: ctgt.id } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => {
        set({ enemyAim: null });
        const b = get().battle;
        if (!b || b.over) return;
        castSpell(get, set, enemy, ctgt, action.spell);
        // La modale d'incantation témoin (Lancer → Contre-sort → Appliquer) SUSPEND le tour de
        // l'IA : la reprise est portée par castConfirm/castCancel → resumeEnemyTurn (anti
        // double-advance, même pattern que la défense). castSpell peut refuser (contrecoup
        // bloquant, hors de portée…) → pas de modale → l'ennemi passe.
        if (!get().pendingCast) setTimeout(() => advanceTurn(get, set), TEMPO.enemyAdvance);
      }, TEMPO.aimTelegraph);
      return;
    }
    case 'shoot': {
      if (!canAct) return advanceTurn(get, set);
      const tgt = targetOf(action.targetId);
      // Télégraphe de tir : on montre QUI le tireur vise (réticule + cadrage) ~0,7 s AVANT de tirer
      // (retour playtest « jamais su sur qui il tirait »). doAttack journalise « X tire sur Y ».
      set({ enemyAim: { fromId: enemy.id, toId: tgt.id } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => { set({ enemyAim: null }); attackThenAdvance(tgt); }, TEMPO.aimTelegraph);
      return;
    }
    case 'melee':
      if (!canAct) return advanceTurn(get, set);
      attackThenAdvance(targetOf(action.targetId));
      return;
    case 'recover': {
      // Se libérer (Empêtré, Test opposé de Force, l.61) / se rouler (En flammes, Athlétisme, l.77).
      // IA = résolution INSTANTANÉE (pas de modale ni de Chance). Coûte l'Action.
      if (!canAct) return advanceTurn(get, set);
      let success: boolean, netSL: number;
      if (action.state === 'Empêtré') {
        const srcId = enemy.conditions.find((c) => c.name === 'Empêtré')?.sourceId;
        const src = srcId ? battle.combatants.find((c) => c.id === srcId && !isOutOfAction(c)) : undefined;
        if (src) { const opp = opposedTest(testValue(enemy, undefined, 'F'), testValue(src, undefined, 'F'), battleRng()); success = opp.attackerWins; netSL = opp.netSL; }
        else { const t = rollTest(testValue(enemy, undefined, 'F'), 'intermediaire', battleRng()); success = t.success; netSL = Math.max(0, t.sl); }
      } else {
        const t = rollTest(testValue(enemy, 'Athlétisme'), 'intermediaire', battleRng()); success = t.success; netSL = Math.max(0, t.sl);
      }
      const removed = recoveredStacks(netSL, stacks(enemy, action.state), success);
      if (removed > 0) removeCondition(enemy, action.state, removed);
      const line = removed > 0
        ? (action.state === 'Empêtré' ? `${enemy.name} se libère (${removed} État Empêtré retiré).` : `${enemy.name} étouffe les flammes (${removed} État En flammes retiré).`)
        : (action.state === 'Empêtré' ? `${enemy.name} reste Empêtré.` : `${enemy.name} reste En flammes.`);
      set({ battle: { ...battle, log: [...battle.log, ev('condition', line, enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      setTimeout(() => advanceTurn(get, set), TEMPO.afterMove);
      return;
    }
    case 'move': {
      // Simplification IA assumée (sévérité mineure, relevée par la revue de fidélité) :
      //  • l'IA ne fait JAMAIS de Désengagement (option joueur, LDB 15-Dépl l.84-89) : un
      //    ennemi Engagé qui se repositionne ne paie pas l'Esquive/le sacrifice d'Avantage.
      // PARITÉ d'approche (LDB 15 l.74-82) : Charge à portée de Course si la Marche ne suffit pas,
      // sinon Course (Test d'Athlétisme instantané, pas d'attaque ce tour) — cf. aiApproachPlan.
      const { plan, ran } = aiApproachPlan(
        { enemy, heroes, scene, blocked, movement: moveBudget, offensiveSpell, spellRange, smoke: smokeOf(battle), flying: flyM != null },
        geom, action, battleRng(),
      );
      const mv = plan.kind === 'move' ? plan : action;
      if (ran) battle.log.push(ev('move', `${enemy.name} prend sa Course (${enemy.mountId ? 'Chevaucher' : 'Athlétisme'} ${ran.roll === 100 ? '00' : ran.roll}) : jusqu'à ${ran.budget} cases.`, enemy.id));
      const wasEngaged = isEngaged(enemy);
      const distBefore = combatDistance(enemy, targetOf(mv.thenTargetId)); // distance de combat AVANT le déplacement
      const fromPos = { ...enemy.pos! }; // position AVANT déplacement (déclenchement de Peur à l'approche)
      const path = pathTo(scene, enemy.pos!, mv.to, blocked, sizeFootprint(geom.size));
      enemy.pos = mv.to;
      if (geom !== enemy) geom.pos = { ...mv.to }; // Combat monté : la monture suit le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.308-309)
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
            gainAdvantage(enemy, adv);
            enemy.gainedAdvThisRound = true;
            enemy.chargedThisTurn = true; // Charge → Attaque gratuite de Cornes (LDB 85), résolue par aiCreatureFreeAttacks
          }
        }
        attackThenAdvance(tgt, Math.max(TEMPO.preAttack, walkMs(path ?? []) + TEMPO.afterMove));
      } else setTimeout(() => advanceTurn(get, set), walkMs(path ?? []) + TEMPO.afterMove);
      return;
    }
  }
}


