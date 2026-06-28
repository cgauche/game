/**
 * Ciblage au SURVOL — source unique du tooltip + réticule + ligne de visée du joueur (IsoStage).
 * Rejoue les MÊMES prédicats que le clic (attackPlan / castSpell) pour que l'affordance ne mente
 * jamais : réticule présent = le clic aboutira, ⛔ = il sera refusé (et pourquoi). Pur (lit l'état).
 */
import { Combatant } from '../engine/types';
import { combineMods } from '../engine/combat';
import { castInfo, isMagicMissile, missileDamage, spellRangeTiles } from '../engine/magic';
import { bonus, effectiveChar } from '../engine/characteristics';
import { effectiveRange } from '../engine/weaponDamage';
import { isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { findSpellById } from '../data';
import { combatDistance } from './footprint';
import { targetArc } from './fireArc';
import { bearingPostes } from './shipBattery';
import { spellOps } from './flow';
import type { GameState } from './store';
import { attackPlan, previewAttack, previewCast, castSightBlocked, selectedAttackOption, trampleTarget, auContactEligible, grappleActionEligible, firedAttackBlock } from './combatFlow';

export type HoverTargeting =
  | { kind: 'none' }
  /** Cible refusée au clic — `engaged` = mêlée verrouillée par l'Engagement (Désengagement requis) ;
   *  `unloaded` = arme à Recharge non chargée (recharger d'abord) ; `noammo` = plus de munition. */
  | { kind: 'invalid'; reason: 'los' | 'range' | 'engaged' | 'unloaded' | 'noammo' | 'arc' }
  | {
      kind: 'ok';
      /** Style de la ligne de visée : pointillée (tir/sort) ou pleine (mêlée, déplacement compris). */
      line: 'dashed' | 'solid';
      /** Nom de l'arme ou du sort. */
      title: string;
      /** Libellé de la compétence employée (« Projectiles (Arcs) », « Langue (Magick) »…). */
      skill: string;
      /** Valeur de compétence nue ; `mod` = somme des modificateurs situationnels (peut être 0). */
      base: number;
      mod: number;
      /** Dégâts AVANT le DR du jet (arme : Force incluse ; Projectile magique : sort + BFM). null = sans dégâts (buff). */
      dmg: number | null;
      /** Chemin RÉEL du déplacement combiné (Charge / rejoindre) — tracé au survol à la place de la ligne droite. */
      path?: { x: number; y: number }[];
      /** Nature de la manœuvre combinée (« Charge (+1 Avantage) », « Rejoindre + attaquer ») — info de décision. */
      note?: string;
      /** Aperçu SYNTHÉTISÉ de la forme `battle.preview` — pour le clignotant des jauges
       *  (`previewResourceDelta`) : MÊME source de coût/gain que le tap-1 tactile. */
      preview: { kind: 'attack' | 'charge' | 'moveAttack'; targetId: string; path?: { x: number; y: number }[]; dest?: { x: number; y: number }; cost?: number; adv?: 0 | 1 };
    };

/** Libellé de la compétence d'attaque : Corps à corps/Projectiles + famille d'arme si connue. */
const weaponSkillLabel = (kind: 'melee' | 'ranged', subType?: string): string =>
  `${kind === 'ranged' ? 'Projectiles' : 'Corps à corps'}${subType ? ` (${subType})` : ''}`;

/** Ops « cible » qui rendent un sort OFFENSIF → ciblable sur un ennemi (réticule + ⛔ hors portée,
 *  comme le tir). Tous les États WFRP sont négatifs (`condition`) ; `wounds` = Dégâts. Liste tenue
 *  COMPLÈTE côté offensif : un offensif oublié = sort injouable sur l'ennemi (le bug d'origine). */
const HARMFUL_TARGET_OPS = new Set<string>([
  'condition', 'wounds', 'corruption', 'lifeSteal', 'suffocate', 'senseLoss', 'loseTurn',
  'breakBlade', 'damageArmour', 'armourPierce', 'reduceToZero', 'castPenalty',
]);
/** Ops « cible » BÉNÉFIQUES → buff sur allié/soi. Liste partielle ASSUMÉE : un buff non listé retombe
 *  en 'any' (réticule des deux côtés, jamais caché) — pire cas anodin (buff montrable sur un ennemi). */
const HELPFUL_TARGET_OPS = new Set<string>([
  'ap', 'heal', 'cureCriticalWound', 'cureDisease', 'removeCondition', 'grantTrait', 'grantTalent',
  'grantWeapon', 'grantNaturalWeapon', 'grantFreeAttack', 'augmentWeapon', 'giveTrapping', 'freeReroll',
  'gainResource', 'arrowWard', 'attackWardFM', 'castWard', 'domeWard', 'weatherWard', 'mitigateIncoming',
  'ignoreStatePenalties', 'noBreath', 'noHunger', 'preventInfection', 'reduceDiseaseDays', 'skillDRBonus',
  'martyr', 'maxWeaponHands',
]);

export type SpellAffinity = 'enemy' | 'ally' | 'any';

/** Côté qu'un sort VISE, DÉRIVÉ de ses effets modélisés (aucun champ manuel sur les 243 sorts) :
 *  Projectile / Test opposé / Souffle / Poussée, ou un op « cible » NOCIF → 'enemy' (ciblable sur
 *  l'ennemi, réticule + ⛔ hors portée comme le tir) ; un op « cible » BÉNÉFIQUE seul → 'ally' ; sinon
 *  (narratif, mixte, sans op de cible) → 'any' (réticule permissif des deux côtés). La SOURCE est
 *  l'effet canon du sort (spells.json), pas une heuristique de mots-clés sur la description. */
export function spellAffinity(spell: NonNullable<ReturnType<typeof findSpellById>>): SpellAffinity {
  if (isMagicMissile(spell) || spell.opposed || spell.breathAttack) return 'enemy';
  // Poussée/Attaques en chaîne portent leur effet positionnel en op `on:'caster'` (push/chain) — invisible
  // au scan 'target' mais OFFENSIF (repousse/rebondit sur l'ennemi) → ciblage ennemi. teleport reste neutre ('any').
  if (spellOps(spell.effects, 'caster').some((o) => o.op === 'push' || o.op === 'chain')) return 'enemy';
  const ops = spellOps(spell.effects, 'target').map((o) => o.op);
  if (ops.some((o) => HARMFUL_TARGET_OPS.has(o))) return 'enemy';
  if (ops.some((o) => HELPFUL_TARGET_OPS.has(o))) return 'ally';
  return 'any';
}

/**
 * Évalue le survol de `target` par le héros `active` selon le mode courant :
 *  • mode neutre → attaque implicite (mêlée / tir / Charge / rejoindre) ;
 *  • mode incantation → sort sélectionné (Projectile sur un adversaire, bénéfique sur un allié/soi).
 * Retourne `none` quand le survol n'a pas de sens (mauvaise équipe, hors mode, hors combat).
 */
export function hoverTargeting(get: () => GameState, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle;
  if (!battle || battle.over || !active.pos || !target.pos) return { kind: 'none' };

  // ── Mode BORDÉE (navire) : le bord qui porte est dérivé de la cible (`targetArc`) ; réticule si une pièce
  //    du bord porte ET la cible est à portée. ⛔ 'arc' = aucune pièce sur ce bord ; 'range' = hors de portée. ──
  if (battle.action === 'battery') {
    if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
    const side = targetArc(get().facing[active.id] ?? 'N', active.pos, target.pos);
    const postes = bearingPostes(active, side); // sur ce bord ET chargées (pas en cours de recharge)
    if (!postes.length) return { kind: 'invalid', reason: 'arc' };
    const mpt = get().scene?.metresPerTile ?? 2;
    const gbf = () => bonus(effectiveChar(active, 'F')); // paresseux : la portée navale est fixe (number) → BF jamais évalué
    const maxRange = Math.max(...postes.map((p) => effectiveRange(p.item.range, gbf) ?? 0)); // mètres — la plus longue pièce du bord
    if (maxRange && combatDistance(active, target) * mpt > maxRange) return { kind: 'invalid', reason: 'range' };
    return { kind: 'ok', line: 'dashed', title: `Bordée ${side}`, skill: 'Tir de batterie', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
  }

  // ── Mode incantation : mêmes gates que castSpell (équipe → portée → LdV) ──
  if (battle.action === 'cast' && battle.selectedSpellId) {
    const spell = findSpellById(battle.selectedSpellId);
    if (!spell) return { kind: 'none' };
    const missile = isMagicMissile(spell);
    // Côté ciblable dérivé de l'EFFET du sort (spellAffinity), plus du seul flag Projectile : un sort
    // offensif non-Projectile (Choc, Sommeil…) se cible désormais sur l'ennemi, comme le tir.
    const aff = spellAffinity(spell);
    const enemyOk = target.kind !== active.kind && !isOutOfAction(target);
    const allyOk = target.kind === active.kind && !target.dead && !target.outOfRencontre;
    if (!(aff === 'enemy' ? enemyOk : aff === 'ally' ? allyOk : enemyOk || allyOk))
      return { kind: 'none' };
    if (target.id !== active.id) {
      // Souffle : la portée suit le TRAIT (BE+20 m), pas le champ Portée — même calcul que castSpell.
      const range = spell.breathAttack
        ? Math.max(1, Math.ceil((bonus(effectiveChar(active, 'E')) + 20) / 2))
        : spellRangeTiles(spell.range, active);
      if (range != null && combatDistance(active, target) > range) return { kind: 'invalid', reason: 'range' };
      if (castSightBlocked(get, active.pos, target.pos)) return { kind: 'invalid', reason: 'los' };
    }
    const pv = previewCast(active, spell, {
      missile,
      focused: active.focus?.spell === spell.id && active.focus.dr >= (spell.cn ?? 0),
    });
    const dmg = missile ? missileDamage(spell) : null;
    return {
      kind: 'ok',
      line: 'dashed',
      title: spell.label,
      skill: castInfo(spell).skill === 'priere' ? 'Prière' : 'Langue (Magick)',
      base: pv.base,
      mod: pv.target - pv.base,
      // Dégâts d'un Projectile AVANT DR (evaluateMissile : sort + DR + BFM) — parité arme (Force incluse).
      dmg: dmg ? dmg.damage + bonus(effectiveChar(active, 'FM')) : null,
      preview: { kind: 'attack', targetId: target.id }, // l'incantation consomme l'Action (jauges)
    };
  }

  // ── Mode ATTAQUE : l'`AttackOption` armée (selectedAttack / ancien mode maneuver/tentacle/trample) ──
  const option = selectedAttackOption(active, battle);
  if (!option) return { kind: 'none' }; // mode non-attaque (cast/heal/…) ou aucune attaque abordable
  if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
  if (option.targeting === 'trample')
    return (active.advantage ?? 0) >= 1 && !!trampleTarget(battle, active, target.id)
      ? { kind: 'ok', line: 'solid', title: 'Piétinement', skill: 'Capacité de Combat', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } }
      : { kind: 'none' };
  if (option.targeting === 'zone') // Souffle/Vomi/Langue/Regard/Étreinte : réticule simple (portée/LdV au résolveur moteur)
    return { kind: 'ok', line: 'dashed', title: option.label, skill: 'Capacité de Combat', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
  if (option.targeting === 'aucontact') // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps, pas une frappe
    return auContactEligible(active, target)
      ? { kind: 'ok', line: 'dashed', title: 'Au contact', skill: 'Corps à corps', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } }
      : { kind: 'none' };
  if (option.targeting === 'grapple') // Empoignade (LDB 14 l.161) : Test opposé de Force, pas une frappe
    return grappleActionEligible(active, target)
      ? { kind: 'ok', line: 'dashed', title: 'Empoignade', skill: 'Force', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } }
      : { kind: 'none' };
  // === MÊLÉE (Arme + gratuites) : approche-puis-frappe — chemin réel + réticule au survol (le clic commet) ;
  // l'aperçu est calculé depuis la case d'ARRIVÉE (modificateurs honnêtes au contact). L'Allonge suit l'option.
  const plan = attackPlan(get, active, target, { reach: option.reach, forceMelee: option.forceMelee });
  if (plan.kind === 'blocked') {
    const p = previewAttack(get, active, target);
    return { kind: 'invalid', reason: p.blocked ? 'los' : p.kind === 'melee' && isEngaged(active) ? 'engaged' : 'range' };
  }
  // Tir direct (pas une Charge/rejoindre, pas une attaque gratuite) refusé faute de ressource : MÊME
  // prédicat que le clic (firedAttackBlock) → le réticule annonce « recharger »/« plus de munitions »
  // au lieu d'une attaque qui se solderait par un log silencieux.
  if (plan.kind === 'attack' && !option.freeKind) {
    const block = firedAttackBlock(get, active, target, option.weaponUid);
    if (block) return { kind: 'invalid', reason: block.reason };
  }
  const from = plan.kind === 'attack' ? active : { ...active, pos: plan.dest };
  const p = previewAttack(get, from, target);
  return {
    kind: 'ok',
    // Gratuite (Morsure/Caudale/Tentacule) = toujours mêlée (trait solide) ; Arme = tir pointillé si à distance.
    line: option.freeKind ? 'solid' : p.kind === 'ranged' ? 'dashed' : 'solid',
    title: option.freeKind ? option.label : p.weapon.name,
    skill: option.freeKind ? weaponSkillLabel('melee') : weaponSkillLabel(p.kind, p.weapon.subType),
    base: p.base,
    mod: combineMods(p.mods),
    dmg: p.dmg, // (gratuite : Dégâts de l'arme tenue = cosmétique ; le chemin/réticule, lui, est exact)
    path: plan.kind === 'attack' ? undefined : plan.path,
    note: plan.kind === 'charge' ? `Charge${plan.adv ? ' (+1 Avantage)' : ''}` : plan.kind === 'moveAttack' ? 'Rejoindre + attaquer' : undefined,
    // Aperçu de la forme `battle.preview` (tap-1) : le clignotant des jauges lit le MÊME objet.
    preview: plan.kind === 'attack'
      ? { kind: 'attack', targetId: target.id }
      : { kind: plan.kind, targetId: target.id, path: plan.path, dest: plan.dest, ...(plan.kind === 'moveAttack' ? { cost: plan.cost } : { adv: plan.adv }) },
  };
}

/** Combattants que le héros ACTIF peut cibler au survol (hoverTargeting ≠ 'none' — bonne équipe pour
 *  l'action courante), triés du PLUS PROCHE au plus loin. Base du ciblage clavier (Tab). */
export function validTargets(get: () => GameState): Combatant[] {
  const battle = get().battle;
  if (!battle || battle.over) return [];
  const active = battle.combatants.find((c) => c.id === battle.order[battle.turn]);
  if (!active || active.kind !== 'hero' || !active.pos) return [];
  return battle.combatants
    .filter((c) => c.id !== active.id && c.pos && !isOutOfAction(c) && hoverTargeting(get, active, c).kind !== 'none')
    .sort((a, b) => combatDistance(active, a) - combatDistance(active, b));
}

/** Cible SUIVANTE (Tab) : la plus proche valide, ou la suivante par distance si une est déjà visée —
 *  cycle complet sur toutes les cibles valides puis retour à la première. Null si aucune. */
export function cycleTarget(get: () => GameState, currentId: string | null): Combatant | null {
  const sorted = validTargets(get);
  if (!sorted.length) return null;
  const idx = sorted.findIndex((c) => c.id === currentId);
  return sorted[(idx + 1) % sorted.length];
}
