/**
 * Registre des MODES de ciblage de combat — SOURCE UNIQUE de « pour l'action courante → quelles
 * cibles (combattant ou case) → quel réticule → que fait le commit ». Chaque mode (attaque, cast,
 * soin, surincantation, zone, téléportation, piétinement, au-contact, empoignade, bordée, siège,
 * Frappe Mortelle, deux armes) répond à CE besoin unique ; `currentTargetingMode(get)` est
 * l'aiguilleur. Les facettes (réticule au survol / cibles Tab-curseur / commit) qui vivaient à
 * trois endroits (targeting.ts, combatSlice.ts, IsoStage.tsx) sont ICI, unifiées.
 *
 * Module FEUILLE : importe combatFlow/targeting-helpers, n'est importé par AUCUN d'eux côté
 * combatFlow (zéro cycle d'exécution via le moteur de combat) — consommé par targeting.ts,
 * combatSlice.ts, combatCursor.ts, combatOrParty.ts.
 */
import type { Get, Set } from './flowTypes';
import type { Combatant, Weapon } from '../engine/types';
import { combineMods, attackTestLabel, isHelplessTarget } from '../engine/combat';
import { castInfo, isMagicMissile, missileDamage, spellRangeTiles } from '../engine/magic';
import { bonus, effectiveChar } from '../engine/characteristics';
import { effectiveRange } from '../engine/weaponDamage';
import { isOutOfAction, canTakeAction, hasCondition, COND } from '../engine/conditions';
import { isEngaged, reachTiles } from '../engine/engagement';
import { campGain, campSpend } from './combat/advantagePool';
import { hasActiveFlag } from '../engine/activeFlags';
import { isFrenzied } from '../engine/psychology';
import { healableTargets, combatHealModes } from '../engine/healing';
import { findSpellById } from '../data';
import { isStructure, structureImmune } from '../engine/structures';
import { overcastSourceOf } from '../engine/overcast';
import type { Pt } from './path';
import { combatDistance } from './footprint';
import { targetArc } from './fireArc';
import { bearingPostes } from './shipBattery';
import { serveTargetPoste, isPosteManned } from './shipPostes';
import { posteHullOf } from './siegePush';
import { spellOps } from './flow';
import { placeCombatant } from './spawn';
import { mountOf, mountMovement, attackGeomOf, combatGeomOf, pickAttackWeapon } from './mount';
import { pilotedByHuman } from './netOwnership';
import { inBattleId } from './combatOrParty';
import { afterApproach } from './combatDirector';
import { ev } from './combatLog';
import { t } from '../i18n';
import { bus, EVT } from './bus';
import type { GameState } from './store';
import {
  attackPlan, previewAttack, previewCast, castSightBlocked, selectedAttackOption,
  trampleTarget, auContactEligible, grappleActionEligible, firedAttackBlock,
  displaceSmaller, fearedSourceTowards, frenzyTarget, applyZoneCrossings,
  placingZoneOf, placedZoneValidAt, commitPlacedZone, overcastTargetCandidates,
  cleaveTargets, dualStrikeTargets, castZoneSpell, castSpell, spellSightOf, openAttackCascade,
  captureMoveSnapshot, firedWeapon,
} from './combatFlow';

export type HoverTargeting =
  | { kind: 'none' }
  /** Cible refusée au clic — `engaged` = mêlée verrouillée par l'Engagement (Désengagement requis) ;
   *  `unloaded` = arme à Recharge non chargée (recharger d'abord) ; `noammo` = plus de munition ;
   *  `sous-effectif` = machine de guerre ADE II sous la moitié de l'Équipe requise (ch.08 l.233). */
  | { kind: 'invalid'; reason: 'los' | 'range' | 'engaged' | 'unloaded' | 'noammo' | 'arc' | 'sous-effectif' | 'portee-min' | 'armeBannie';
      /** Munition attendue (libellé JOUEUR, `noammo`) — nommée dans l'affordance/tooltip pour dire quoi
       *  acheter/charger (« Pas de munitions (Boulet et poudre) »). */
      need?: string }
  | {
      kind: 'ok';
      /** Style de la ligne de visée : pointillée (tir/sort) ou pleine (mêlée, déplacement compris). */
      line: 'dashed' | 'solid';
      /** Nom de l'arme ou du sort. */
      title: string;
      /** Nom AFFICHÉ du combattant ciblé (retour playtest #201) — la cible déjà résolue par l'affordance. */
      targetName: string;
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

/** Aperçu d'un mode à ciblage TUILE (#198) — au survol souris/curseur clavier d'une case VALIDE
 *  (`tileValidAt` déjà vrai). `target` ancre le réticule (case d'arrivée / centre de zone) ; `path`
 *  (facultatif, ≥2 points) trace la direction depuis l'origine ; `cost` porte la distance/le coût
 *  affiché ; `label` est le texte du badge (rendu par `movePreviewEls`, MÊME primitive que l'aperçu de
 *  déplacement normal — pas de nouveau système visuel). */
export interface TilePreview {
  target: Pt;
  path?: Pt[];
  cost?: number;
  label: string;
}

/**
 * Un MODE de ciblage. Un mode-COMBATTANT remplit `affordance` (réticule au survol) + `commitCombatant`
 * (clic-token) ; un mode-CASE remplit `tileValidAt` + `commitTile` (clic-sol) + `tilePreview` (aperçu au
 * survol — voir `TileTargetingMode` ci-dessous, qui rend les trois REQUIS pour un mode-case : la garde
 * structurelle du ticket #198, un mode-case sans aperçu ne compile pas). `candidates` (Tab/curseur) vaut
 * par défaut « les combattants dont l'affordance ≠ 'none' » — un mode ne le surcharge que s'il a une
 * liste propre (soin, surincantation…). Tout est PUR (lit l'état) sauf les commit (mutent via set).
 */
export interface TargetingMode {
  id: string;
  affordance?(get: Get, active: Combatant, target: Combatant): HoverTargeting;
  candidates?(get: Get, active: Combatant): Combatant[];
  commitCombatant?(get: Get, set: Set, active: Combatant, id: string, opts?: BattleClickOpts): void;
  tileValidAt?(get: Get, active: Combatant, pt: Pt): boolean;
  commitTile?(get: Get, set: Set, active: Combatant, pt: Pt): void;
  tilePreview?(get: Get, active: Combatant, pt: Pt): TilePreview | null;
}

/** Mode-CASE COMPLET : `tileValidAt`/`commitTile`/`tilePreview` tous requis — un mode qui cible des
 *  tuiles (catalogue `TILE_MODES`) DOIT fournir son aperçu, sinon erreur de compilation (#198). */
export type TileTargetingMode = TargetingMode & Required<Pick<TargetingMode, 'tileValidAt' | 'commitTile' | 'tilePreview'>>;

/** Options du clic-token (parité `battleClickEntity`). */
export type BattleClickOpts = { confirm?: boolean; skipMountChoice?: boolean; forceAttackId?: string; wardCleared?: boolean };

/** Libellé de la compétence d'attaque : `attackTestLabel` (Corps à corps/Projectiles, ou la Carac
 *  de Résolution alternative de l'arme) + famille d'arme si connue. */
const weaponSkillLabel = (weapon: Weapon | undefined, kind: 'melee' | 'ranged', subType?: string): string =>
  `${attackTestLabel(weapon, kind)}${subType ? ` (${subType})` : ''}`;

/** Ops « cible » qui rendent un sort OFFENSIF → ciblable sur un ennemi (réticule + interdit hors portée,
 *  comme le tir). Tous les États WFRP sont négatifs (`condition`) ; `wounds` = Dégâts. Liste tenue
 *  COMPLÈTE côté offensif : un offensif oublié = sort injouable sur l'ennemi (le bug d'origine). */
const HARMFUL_TARGET_OPS = new Set<string>([
  'condition', 'wounds', 'corruption', 'lifeSteal', 'suffocate', 'senseLoss', 'loseTurn',
  'breakBlade', 'damageArmour', 'armourPierce', 'reduceToZero', 'castPenalty',
]);
/** Ops « cible » BÉNÉFIQUES-SANS-AMBIGUÏTÉ → buff sur allié/soi. Liste tenue EXHAUSTIVE au même titre
 *  que HARMFUL_TARGET_OPS (recensement du catalogue `GameOp`, engine/ops.ts) POUR LES OPS DONT LE SIGNE
 *  EST FIXE (soin, purge d'État/maladie/psy, octroi, protection…) : asymétrie ASSUMÉE avec HARMFUL —
 *  un offensif oublié rend un sort injouable sur l'ennemi (bug réel, HARMFUL doit rester complète) ;
 *  un bénéfique-clair oublié ici ne fait que retomber en 'any' (réticule des deux côtés, jamais caché).
 *  Les ops DUAL-SIGNE (`testMod`/`skillMod`/`attrMod`/`charDRBonus`/`sinMod`/`maxWeaponHands`… — la
 *  MÊME op est un buff OU un malus selon `amount`/`mod`/`hands`) sont VOLONTAIREMENT absentes : 'any'
 *  est le comportement voulu, jamais 'ally' pour un malus déguisé (Malédiction de malchance, testMod
 *  amount:-10, LDB 49 p.255 — verrouillé par le test dual-signe de targetingModes.test.ts). */
const HELPFUL_TARGET_OPS = new Set<string>([
  'ap', 'heal', 'cureCriticalWound', 'cureDisease', 'removeCondition', 'grantTrait', 'grantTalent',
  'grantWeapon', 'grantNaturalWeapon', 'grantFreeAttack', 'augmentWeapon', 'giveTrapping', 'freeReroll',
  'gainResource', 'arrowWard', 'attackWardFM', 'castWard', 'domeWard', 'weatherWard', 'mitigateIncoming',
  'ignoreStatePenalties', 'noBreath', 'noHunger', 'preventInfection', 'reduceDiseaseDays', 'diseaseTestMod', 'suppressSymptom', 'skillDRBonus',
  'martyr', 'endPsych', 'removePsychTrait', 'suppressPsych', 'gainAdvantage', 'critTwice',
  'grantCareerSkill', 'grantCareerTalent',
]);

export type SpellAffinity = 'enemy' | 'ally' | 'any';

/** Côté qu'un sort VISE, DÉRIVÉ de ses effets modélisés (aucun champ manuel sur les 243 sorts) :
 *  Projectile / Test opposé / Souffle / Poussée, ou un op « cible » NOCIF → 'enemy' (ciblable sur
 *  l'ennemi, réticule + interdit hors portée comme le tir) ; un op « cible » BÉNÉFIQUE seul → 'ally' ; sinon
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

// ───────────────────────────────────────────────────────────────────────────
// Affordances (réticule au survol) — corps DÉPLACÉS verbatim des branches de hoverTargeting
// ───────────────────────────────────────────────────────────────────────────

/** Mode BORDÉE (navire) : le bord qui porte est dérivé de la cible (`targetArc`) ; réticule si une pièce
 *  du bord porte ET la cible est à portée. 'arc' = aucune pièce sur ce bord ; 'range' = hors de portée. */
function batteryAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
  const side = targetArc(get().facing[active.id] ?? 'N', active.pos!, target.pos!);
  const postes = bearingPostes(active, side); // sur ce bord ET chargées (pas en cours de recharge)
  if (!postes.length) return { kind: 'invalid', reason: 'arc' };
  const mpt = get().scene?.metresPerTile ?? 2;
  const gbf = () => bonus(effectiveChar(active, 'force')); // paresseux : la portée navale est fixe (number) → BF jamais évalué
  const maxRange = Math.max(...postes.map((p) => effectiveRange(p.item.range, gbf) ?? 0)); // mètres — la plus longue pièce du bord
  if (maxRange && combatDistance(active, target) * mpt > maxRange) return { kind: 'invalid', reason: 'range' };
  return { kind: 'ok', line: 'dashed', title: `Bordée ${side}`, targetName: target.label, skill: 'Tir de batterie', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
}

/** Mode incantation : mêmes gates que castSpell (équipe → portée → LdV). */
function castAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle!;
  const sid = battle.selectedSpellId;
  if (!sid) return { kind: 'none' };
  const spell = findSpellById(sid);
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
      ? Math.max(1, Math.ceil((bonus(effectiveChar(active, 'endurance')) + 20) / 2))
      : spellRangeTiles(spell.range, active);
    if (range != null && combatDistance(active, target) > range) return { kind: 'invalid', reason: 'range' };
    if (castSightBlocked(get, active.pos!, target.pos!)) return { kind: 'invalid', reason: 'los' };
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
    targetName: target.label,
    skill: castInfo(spell).skill === 'priere' ? 'Prière' : 'Langue (Magick)',
    base: pv.base,
    mod: pv.target - pv.base,
    // Dégâts d'un Projectile AVANT DR (evaluateMissile : sort + DR + BFM) — parité arme (Force incluse).
    dmg: dmg ? dmg.damage + bonus(effectiveChar(active, 'force-mentale')) : null,
    preview: { kind: 'attack', targetId: target.id }, // l'incantation consomme l'Action (jauges)
  };
}

/** Mode ATTAQUE : l'`AttackOption` armée (selectedAttack / ancien mode maneuver/tentacle/trample). */
function attackAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle!;
  // Pièce de siège SERVABLE (poste, MDG 12 / AA 10 p.124) : un poste-porteur qu'on peut REJOINDRE (chef si non
  // servi, renfort sinon) → réticule « Servir » ; le clic rejoint l'équipe (jamais une attaque futile sur l'engin
  // inerte). Prioritaire. SOURCE `serveTargetPoste` (= hotbar/IA). Le tooltip d'ÉQUIPE (IsoStage) montre le détail.
  if (target.postes?.length) {
    const p = serveTargetPoste(active, target, battle.combatants);
    if (!p) return { kind: 'none' };
    const join = isPosteManned(p, battle.combatants);
    return { kind: 'ok', line: 'solid', title: `${join ? 'Renfort' : 'Servir'} : ${p.item.label}`, targetName: target.label, skill: join ? "Renfort d'équipe" : 'Chef de pièce', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
  }
  const option = selectedAttackOption(active, battle);
  if (!option) return { kind: 'none' }; // mode non-attaque (cast/heal/…) ou aucune attaque abordable
  if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
  // Structure (mur/porte) : cible RÉSERVÉE aux armes de siège — « attaquer un rempart à l'épée » n'a pas de
  // sens (RAW : Impénétrable imparable sans l'Atout Siège, ADE II 8 ; même gate que l'IA, ai.ts). Si
  // AUCUNE arme du porteur ne peut l'abîmer → pas de réticule (none) : le survol retombe sur le déplacement
  // (monter au rempart) au lieu d'un « hors de portée » absurde. Une pièce de siège SERVIE la rend ciblable.
  if (isStructure(target) && active.weapons.every((w) => structureImmune(w, target))) return { kind: 'none' };
  if (option.targeting === 'trample')
    return (active.advantage ?? 0) >= 1 && !!trampleTarget(battle, active, target.id)
      ? { kind: 'ok', line: 'solid', title: 'Piétinement', targetName: target.label, skill: 'Capacité de Combat', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } }
      : { kind: 'none' };
  if (option.targeting === 'zone') // Souffle/Vomi/Langue/Regard/Étreinte : réticule simple (portée/LdV au résolveur moteur)
    return { kind: 'ok', line: 'dashed', title: option.label, targetName: target.label, skill: 'Capacité de Combat', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
  if (option.targeting === 'aucontact') // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps, pas une frappe
    return auContactEligible(active, target)
      ? { kind: 'ok', line: 'dashed', title: 'Au contact', targetName: target.label, skill: 'Corps à corps', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } }
      : { kind: 'none' };
  if (option.targeting === 'grapple') // Empoignade (LDB 14 l.161) : Test opposé de Force, pas une frappe
    return grappleActionEligible(active, target)
      ? { kind: 'ok', line: 'dashed', title: 'Empoignade', targetName: target.label, skill: 'Force', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } }
      : { kind: 'none' };
  // === MÊLÉE (Arme + gratuites) : approche-puis-frappe — chemin réel + réticule au survol (le clic commet) ;
  // l'aperçu est calculé depuis la case d'ARRIVÉE (modificateurs honnêtes au contact). L'Allonge suit l'option.
  const plan = attackPlan(get, active, target, { reach: option.reach, forceMelee: option.forceMelee, weaponUid: option.weaponUid });
  if (plan.kind === 'blocked') {
    const p = previewAttack(get, active, target, undefined, { weaponUid: option.weaponUid });
    return { kind: 'invalid', reason: p.blocked ? 'los' : p.kind === 'melee' && isEngaged(active) ? 'engaged' : 'range' };
  }
  // Tir direct (pas une Charge/rejoindre, pas une attaque gratuite) refusé faute de ressource : MÊME
  // prédicat que le clic (firedAttackBlock) → le réticule annonce « recharger »/« plus de munitions »
  // au lieu d'une attaque qui se solderait par un log silencieux.
  if (plan.kind === 'attack' && !option.freeKind) {
    const block = firedAttackBlock(get, active, target, option.weaponUid);
    if (block) return { kind: 'invalid', reason: block.reason, ...(block.need ? { need: block.need } : {}) };
  }
  const from = plan.kind === 'attack' ? active : { ...active, pos: plan.dest };
  // `option.weaponUid` ÉPINGLE l'arme du poste servi pour l'option DÉDIÉE « Servir » (jamais pour 'arme',
  // qui reste auto-choisie parmi les armes PERSONNELLES — `pickAttackWeaponList`/addendum « un intent, une entrée »).
  const p = previewAttack(get, from, target, undefined, { weaponUid: option.weaponUid });
  return {
    kind: 'ok',
    // Gratuite (Morsure/Caudale/Tentacule) = toujours mêlée (trait solide) ; Arme = tir pointillé si à distance.
    line: option.freeKind ? 'solid' : p.kind === 'ranged' ? 'dashed' : 'solid',
    title: option.freeKind ? option.label : p.weapon.label,
    targetName: target.label,
    skill: option.freeKind ? weaponSkillLabel(undefined, 'melee') : weaponSkillLabel(p.weapon, p.kind, p.weapon.subType),
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

/** Mode SOIN (Guérison, LDB 09) : réticule « Soigner » sur soi + alliés adjacents soignables. */
function healAffordance(get: Get, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle!;
  const allies = battle.combatants.filter((c) => c.kind === active.kind); // camp RELATIF : on soigne SON camp
  if (!healableTargets(active, allies, { adjacency: true }).some((c) => c.id === target.id)) return { kind: 'none' };
  return { kind: 'ok', line: 'solid', title: 'Soigner', targetName: target.label, skill: 'Guérison', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
}

/** Mode SURINCANTATION (+Cible, LDB 47 l.28) : cibles supplémentaires éligibles (portée/éveillées/LdV). */
function overcastAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  const s = get();
  const pc = s.pendingCast!;
  const pool = s.battle?.combatants ?? s.party;
  const caster = pool.find((c) => c.id === pc.casterId);
  const spell = findSpellById(pc.spellId);
  if (!caster || !spell || !overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, overcastSourceOf(spell), pc.overcast?.range ?? 0, spellSightOf(get)).some((c) => c.id === target.id)) return { kind: 'none' };
  return { kind: 'ok', line: 'dashed', title: spell.label, targetName: target.label, skill: 'Langue (Magick)', base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
}

/** Mode FRAPPE MORTELLE (cleave, LDB 14 l.12) : enchaînements adjacents non encore frappés. */
function cleaveAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  const s = get();
  const battle = s.battle!;
  const pc = s.pendingCleave!;
  const atk = inBattleId(battle, pc.attackerId);
  if (!atk || !cleaveTargets(battle, atk, pc.hitIds).some((c) => c.id === target.id)) return { kind: 'none' };
  const weapon = firedWeapon(atk, target, undefined, battle.combatants); // MÊME résolution que la chaîne (resolveAttack, aucun weaponUid)
  return { kind: 'ok', line: 'solid', title: 'Frappe Mortelle', targetName: target.label, skill: attackTestLabel(weapon, 'melee'), base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
}

/** Mode 2ᵉ FRAPPE (deux armes, LDB 10 l.638) : cibles à portée de la main secondaire. */
function dualAffordance(get: Get, _active: Combatant, target: Combatant): HoverTargeting {
  const s = get();
  const battle = s.battle!;
  const ds = s.pendingDualStrike!;
  const atk = inBattleId(battle, ds.attackerId);
  const off = atk?.weapons.find((w) => w.uid === ds.offWeaponUid);
  if (!atk || !off || !dualStrikeTargets(battle, atk, off).some((c) => c.id === target.id)) return { kind: 'none' };
  return { kind: 'ok', line: 'solid', title: 'Deux armes', targetName: target.label, skill: attackTestLabel(off, 'melee'), base: 0, mod: 0, dmg: null, preview: { kind: 'attack', targetId: target.id } };
}

// ───────────────────────────────────────────────────────────────────────────
// Commit COMBATTANT (clic-token) — corps DÉPLACÉS verbatim de battleClickEntity
// ───────────────────────────────────────────────────────────────────────────

/** ATTAQUE : approche-puis-frappe — le SEUL exécuteur charge/moveAttack du jeu. Corps DÉPLACÉ verbatim
 *  de `battleClickEntity` (combatSlice) ; `active`/`id`/`opts` fournis par l'aiguilleur. */
function attackClickCommit(get: Get, set: Set, active: Combatant, id: string, opts?: BattleClickOpts): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return;
  const target = inBattleId(battle, id);
  if (!target) return;
  // Pièce de siège : un clic REJOINT l'équipe (chef/renfort) au lieu d'attaquer l'engin inerte — MÊME chemin que le
  // bouton hotbar (`battleManPoste`) et l'IA (`serveAtPoste`). `serveTargetPoste` = source unique de la cible.
  if (target.postes?.length) {
    const p = serveTargetPoste(active, target, battle.combatants);
    if (p) { get().battleManPoste({ hullId: target.id, posteUid: p.item.uid }); return; }
  }
  // ATTAQUE unifiée : l'`AttackOption` armée (clic droit = première abordable via `forceAttackId` ; sinon
  // `selectedAttack`, défaut 'arme' ; les anciens modes maneuver/tentacle/trample mappent sur leur option).
  const option = selectedAttackOption(active, battle, opts?.forceAttackId);
  if (!option || !scene) return;
  if (target.kind === active.kind) return; // camp RELATIF : on ne frappe que le camp ADVERSE (soin/sort via leurs modes)
  if (!canTakeAction(active) || hasCondition(active, COND.brise)) return; // Sonné/Brisé : pas d'attaque (parité boutons)
  // Frénésie (LDB 21 l.34) : la cible est IMPOSÉE — l'ennemi le plus proche en Ligne de Vue.
  if (isFrenzied(active)) {
    const ft = frenzyTarget(get, active);
    if (ft && ft.id !== id) {
      get().log(t('cs.frenzyMustAttack', { name: active.label, foe: ft.label }));
      if (battle.preview) set({ battle: { ...battle, preview: null } });
      return;
    }
  }
  // Aiguillage par NATURE de l'attaque : Piétinement (Taille) → flux dédié ; zone ciblée (Souffle/Vomi/
  // Langue/Regard/Étreinte) → `pendingManeuver` ; la MÊLÉE (Arme + Morsure/Caudale/Tentacule) passe par
  // l'approche-puis-frappe ci-dessous.
  if (option.targeting === 'trample') return get().battleTrample(target.id);
  // « Au Contact » (LDB 62 l.176) : action de Test opposé (pas une frappe) → flux dédié, jamais l'approche-puis-frappe.
  if (option.targeting === 'aucontact') return get().battleAuContact(target.id);
  // Empoignade (LDB 14 l.161) : action de Test opposé de Force entre deux Empoignés → flux dédié.
  if (option.targeting === 'grapple') return get().battleGrapple(target.id);
  if (option.targeting === 'zone') {
    set({ pendingManeuver: { attackerId: active.id, kind: option.kind!, maneuverId: option.def!.id, targetId: target.id, avantageSpent: option.advantageMode === 'variable' ? 1 : option.cost.advantage, result: null }, battle: { ...battle, action: null, selectedAttack: undefined } });
    return;
  }
  // === MÊLÉE : approche-puis-frappe (le SEUL exécuteur charge/moveAttack du jeu) ===
  const plan = attackPlan(get, active, target, { reach: option.reach, forceMelee: option.forceMelee, weaponUid: option.weaponUid });
  // L'Action dépensée interdit le DÉPLACEMENT combiné pour une attaque qui COÛTE l'Action (Arme hors
  // Frénésie) → frappe directe seulement. Une attaque GRATUITE (Morsure/Caudale/Tentacule, ou l'Arme en
  // attaque libre de Frénésie → `cost.action===false`) PEUT s'approcher (charge) même l'Action dépensée
  // (LDB 21 l.34 : « se déplacer au maximum vers l'ennemi le plus proche pour l'attaquer »).
  if (battle.acted && option.cost.action && plan.kind !== 'attack') return;
  if (plan.kind === 'blocked') {
    get().log(plan.reason);
    if (battle.preview) set({ battle: { ...battle, preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
    return;
  }
  // Tir refusé faute de RESSOURCE (arme à Recharge non chargée / plus de munition) : on coupe AVANT
  // l'aperçu (tap-1) pour que l'affordance ne mente pas — même prédicat que le réticule au survol
  // (firedAttackBlock). Concerne UNIQUEMENT l'attaque directe (plan 'attack') avec l'arme tenue : une
  // Charge/rejoindre (mêlée) ou une attaque gratuite (freeKind) n'emploie jamais l'arme à distance.
  if (plan.kind === 'attack' && !option.freeKind) {
    const block = firedAttackBlock(get, active, target, option.weaponUid);
    if (block) {
      get().log(block.detail);
      if (battle.preview) set({ battle: { ...battle, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
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
    const rider = target.mountId ? target : inBattleId(battle, target.riderId);
    const mount = target.riderId ? target : inBattleId(battle, target.mountId);
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
        get().log(t('cs.fearNoApproach', { name: active.label, feared: feared.label }));
        return;
      }
      set({ pendingApproach: { combatantId: active.id, sourceId: feared.id, intent: { kind: 'entity', id }, result: null }, battle: { ...get().battle!, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
  }
  if (battle.preview) set({ battle: { ...get().battle!, preview: null } });
  // Bénédiction de Protection (LDB 41 l.105) : la cible bénie impose un Test de FM Accessible (+20)
  // AVANT d'engager quoi que ce soit (charge comprise). Le jet du HÉROS est INFLUENÇABLE (Chance/
  // Résilience) → il DIFFÈRE la déclaration derrière `pendingWard`. `wardCleared` = ce gate a déjà été
  // franchi pour CE clic (relance) → on le saute.
  if (!opts?.wardCleared && hasActiveFlag(target, 'attackWardFM')) {
    set({ pendingWard: { attackerId: active.id, targetId: target.id, result: null }, battle: { ...get().battle!, preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
    return;
  }
  // Avantage de la manœuvre dépensé UNE fois, à la frappe (après TOUS les portails — aperçu/monture/Peur/
  // ward) : gratuites de mêlée (Morsure/Caudale… coût RAW). L'Arme (cost.advantage 0) ne dépense rien.
  if (option.cost.advantage) campSpend(get, active, option.cost.advantage); // réserve du camp en mode groupe (AA 11 l.30-38) / le combattant (LDB)
  // === Approche-puis-frappe : DEUX beats explicites ===
  let approachPath: { x: number; y: number }[] | null = null;
  let pa: GameState['pendingAttack'];
  if (plan.kind === 'charge') {
    // Charge (LDB 15 l.35-37) : se ruer au contact (portée de Course) puis attaquer — manœuvre
    // PLEINE (consomme tout le Mouvement). Combat monté : empreinte/Course de la MONTURE.
    // Undo PRÉ-JET (retour playtest) : capture l'état d'AVANT la charge pour pouvoir Annuler un misclic
    // tant qu'aucun dé n'est lancé (`attackCancel`) — positions, orientation, Mouvement, Avantage, chargé.
    const chargeUndo = {
      pos: Object.fromEntries(battle.combatants.filter((c) => c.pos).map((c) => [c.id, { ...c.pos! }])),
      facing: { ...get().facing }, movedPreAction: battle.movedPreAction, movementUsed: battle.movementUsed ?? 0,
      advGained: plan.adv, gainedAdvBefore: active.gainedAdvThisRound ?? false, chargedBefore: active.chargedThisTurn ?? false,
    };
    const geom = mountOf(battle, active) ?? active;
    approachPath = plan.path;
    active.pos = { ...plan.dest };
    if (geom !== active) geom.pos = { ...plan.dest }; // la monture charge sous le cavalier
    displaceSmaller(get, geom); // charge d'un grand : idem dégage les plus petits (85 l.373-374)
    get().faceFromPath(active.id, approachPath);
    if (geom !== active) get().faceFromPath(geom.id, approachPath);
    bus.emit(EVT.ANIM_MOVE, { id: active.id, path: approachPath });
    if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: approachPath });
    applyZoneCrossings(get, set, active, approachPath); // Mur de feu & co (L11) : charger À TRAVERS coûte
    campGain(get, active, plan.adv); // +1 si « fonçant » de ≥ M mètres (l.77, lecture stricte), AVANT le jet
    if (plan.adv > 0) active.gainedAdvThisRound = true;
    active.chargedThisTurn = true; // Charge → Atouts de Dégâts d'une arme Épuisante actifs (LDB 62 l.319) ; consommé en fin de tour
    set({ battle: { ...get().battle!, movementUsed: mountMovement(battle, active), action: null, preview: null, log: [...battle.log, ev('charge', t('cs.charge', { name: active.label, target: target.label, adv: plan.adv ? t('cs.fragChargeAdv', { adv: plan.adv }) : '' }), active.id, target.id)] } });
    pa = { attackerId: active.id, targetId: target.id, location: null, result: null, fromCharge: true, chargeUndo, ...(option.freeKind ? { freeKind: option.freeKind } : {}), ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
  } else {
    if (plan.kind === 'moveAttack') {
      // Rejoindre la cible dans la Marche restante (pas une Charge → pas de bonus), puis attaquer.
      // MÊMES mutations qu'un segment de battleClickTile (snapshot d'annulation compris).
      const b = get().battle!;
      const snapshot = (b.movementUsed ?? 0) === 0 ? captureMoveSnapshot(b, get().facing) : b.moveSnapshot ?? null;
      const geom = mountOf(b, active) ?? active;
      approachPath = plan.path;
      active.pos = { ...plan.dest };
      if (geom !== active) geom.pos = { ...plan.dest };
      displaceSmaller(get, geom);
      get().faceFromPath(active.id, approachPath);
      if (geom !== active) get().faceFromPath(geom.id, approachPath);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path: approachPath });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: approachPath });
      applyZoneCrossings(get, set, active, approachPath); // Mur de feu & co (L11)
      set({ battle: { ...b, moveSnapshot: snapshot, movementUsed: (b.movementUsed ?? 0) + plan.cost, movedPreAction: b.movedPreAction || !b.acted, action: null, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    }
    if (option.freeKind) {
      // Frappe GRATUITE (Morsure/Caudale/Tentacule) — déjà à portée (Allonge 1) : résolveur = arme
      // naturelle synthétique (freeAttackWeapon, via `pa.freeKind`) ; pas de gate Allonge/munitions.
      pa = { attackerId: active.id, targetId: target.id, location: null, result: null, freeKind: option.freeKind, ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
    } else {
      // Arme effectivement employée : choix EXPLICITE (poste servi → `option.weaponUid` épingle le canon)
      // sinon auto — chaque candidate de mêlée évaluée avec SA PROPRE géométrie (`pickAttackWeapon`,
      // #BUG-A : une arme personnelle n'hérite jamais de l'allonge de la coque servie) — PAS weapons[0],
      // sinon un héros mixte mêlée+distance ne pourrait jamais tirer une cible éloignée (LDB Armes l.297-298).
      const battleNow = get().battle!;
      const w = pickAttackWeapon(battleNow, active, target, option.weaponUid);
      if (w.type === 'melee' && combatDistance(attackGeomOf(battleNow, active, w), combatGeomOf(battleNow, target)) > reachTiles(w)) {
        get().log(t('cs.meleeOutOfRange')); // aucune arme à distance dispo → mêlée hors de portée
        return;
      }
      // Le gate de RESSOURCE (Recharge/munition) a déjà été appliqué plus haut (firedAttackBlock).
      pa = { attackerId: active.id, targetId: target.id, location: null, result: null, ...(option.weaponUid ? { weaponUid: option.weaponUid } : {}) };
    }
  }
  // Cible Inconsciente (LDB États l.113) : l'attaquant gagne « Je ne faillirai pas ! » SANS dépenser de
  // Résilience → réutilise le MÊME picker de Localisation (`pa.forced`/CritLocationPicker, LDB 17 l.68)
  // que le Critique forcé par Résilience. Réservé au joueur qui PILOTE ; l'IA (doAttack) résout hors de
  // ce chemin (pendingAttack), donc ne voit jamais ce choix.
  if (isHelplessTarget(target) && pilotedByHuman(get(), active)) pa = { ...pa, forced: true };
  // (2) FRAPPE — après le glissé d'approche : ouvre la SÉQUENCE de combat (jet d'attaque = ÉTAPE 0,
  // CascadeModal via useAttackJetProps ; ses conséquences s'empilent APRÈS dans la MÊME fenêtre). Garde
  // dans le différé : encore le tour de l'acteur et aucune autre cascade ouverte (anti double-ouverture).
  afterApproach(get, approachPath, () => {
    const b = get().battle;
    if (!b || b.over || b.order[b.turn] !== active.id || get().pendingCascade) return;
    // Point PARTAGÉ : gate « Main ensanglantée » (AA 07 l.117) puis ouverture de la cascade d'attaque.
    openAttackCascade(get, set, pa, 'Attaque', 'action/attack');
  });
}

/** CAST : un token n'est pas une cible de ZONE (la zone se pose après le jet) → modale ; sinon
 *  l'incantation vise l'allié/ennemi/soi. Corps DÉPLACÉ verbatim de battleClickEntity. */
function castClickCommit(get: Get, set: Set, active: Combatant, id: string): void {
  const battle = get().battle;
  if (!battle || !battle.selectedSpellId) return;
  const target = inBattleId(battle, id);
  if (!target) return;
  // Sort de ZONE : un token n'est pas une cible (la zone se pose après le jet) → modale.
  if (castZoneSpell(get, set, active, battle.selectedSpellId)) return;
  // L'incantation peut viser un allié, un ennemi ou soi-même.
  castSpell(get, set, active, target, battle.selectedSpellId);
}

// ───────────────────────────────────────────────────────────────────────────
// Commit CASE (clic-sol) — corps DÉPLACÉS verbatim de battleClickTile
// ───────────────────────────────────────────────────────────────────────────

/** TÉLÉPORTATION (Jalon 2.6 — sort « Téléportation », LDB 47) : le lanceur choisit sa case d'arrivée
 *  parmi les cases en surbrillance (survol des obstacles). Corps DÉPLACÉ verbatim de battleClickTile. */
function teleportCommitTile(get: Get, set: Set, active: Combatant, pt: Pt): void {
  const battle = get().battle;
  if (!battle) return;
  const k = `${pt.x},${pt.y}`;
  if (!battle.reachable.has(k)) return;
  const from = { ...active.pos! };
  const mount = mountOf(battle, active);
  active.pos = { ...pt };
  if (mount) mount.pos = { ...pt }; // couple cavalier↔monture solidaire (comme le déplacement)
  displaceSmaller(get, mount ?? active); // un grand qui se téléporte dégage aussi les plus petits sous son empreinte (LDB 85 l.373-374)
  get().faceFromPath(active.id, [from, pt]);
  bus.emit(EVT.ANIM_MOVE, { id: active.id, path: [{ ...pt }] });
  if (mount) bus.emit(EVT.ANIM_MOVE, { id: mount.id, path: [{ ...pt }] });
  set({ battle: { ...battle, action: null, reachable: new Map(), preview: null, log: [...battle.log, ev('move', t('cs.teleport', { name: active.label }), active.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** POUSSÉE d'un engin de siège CREWÉ (ADE II 8 l.258, Lot 2 #156) : le CHEF choisit sa case
 *  d'arrivée parmi les cases en surbrillance (`battle.reachable`, posé par `battlePushEngine` — plafonné
 *  à `rule('siege-engine-push-speed')`) — mouvement SIMPLE, aucun jet. Le delta (case cliquée − position
 *  du chef) est appliqué à l'ENGIN et à TOUS les servants du poste (`ShipPoste.crewIds`, chef inclus) :
 *  formation RIGIDE, MÊME patron que `shipAdvance` (store.ts) qui translate une coque + son équipage du
 *  MÊME delta. Consomme l'Action du chef (comme `battleManPoste`) ; l'engin reste SANS tour (`inert`,
 *  jamais ajouté à `battle.order`) — seul le rendu de la pièce suit (`posteAnchor` lit `hull.pos`).
 *
 *  v1 : la case d'arrivée de chaque SERVANT translaté n'est PAS revalidée individuellement (formation
 *  authorée souple, MÊME simplification que `shipAdvance` qui ne valide que la case de la coque) — un
 *  servant peut atterrir sur une case occupée/hors-scène si la formation initiale était irrégulière.
 *  Sans incidence pour l'engin ADE II en donnée aujourd'hui (empreinte 1×1, servants alignés en scénario). */
function pushCommitTile(get: Get, set: Set, active: Combatant, pt: Pt): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !active.pos) return;
  const k = `${pt.x},${pt.y}`;
  if (!battle.reachable.has(k)) return;
  const poste = active.mannedPoste;
  const hull = poste && posteHullOf(poste, battle.combatants);
  if (!poste || !hull?.pos) return;
  // Annulation (#199) : au PREMIER segment du Tour (`movementUsed === 0`), capture l'état AVANT de
  // pousser — MÊME snapshot que battleClickTile/moveAttack (positions + facing + movedPreAction +
  // loseNextMovement des servants), pour que `cancelMove` défasse aussi une poussée.
  const snapshot = (battle.movementUsed ?? 0) === 0 ? captureMoveSnapshot(battle, get().facing) : battle.moveSnapshot ?? null;
  const delta = { x: pt.x - active.pos.x, y: pt.y - active.pos.y };
  const movers = [hull, ...(poste.crewIds ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c?.pos)];
  for (const m of movers) {
    const from = { ...m.pos! };
    placeCombatant(m, scene, { x: from.x + delta.x, y: from.y + delta.y });
    bus.emit(EVT.ANIM_MOVE, { id: m.id, path: [from, { ...m.pos }] });
  }
  const dist = Math.max(Math.abs(delta.x), Math.abs(delta.y));
  // Pousser = le MOUVEMENT de TOUT l'équipage (LDB 13 l.106 : locomotion, aucun Test → le Mouvement, pas
  // l'Action). Le chef dépense son Mouvement MAINTENANT ; chaque autre servant dépensera le sien à son tour
  // (`loseNextMovement`) — tous poussent, tous en paient le Mouvement. L'Action du chef reste libre (il peut
  // assener la porte le même Round une fois au contact).
  for (const id of poste.crewIds ?? []) {
    if (id === active.id) continue;
    const c = inBattleId(battle, id);
    if (c) c.loseNextMovement = true;
  }
  const log = [...battle.log, ev('move', t('cs.pushEngine', { name: active.label, weapon: hull.label, n: dist, s: dist > 1 ? 's' : '' }), active.id)];
  set({ battle: { ...get().battle!, moveSnapshot: snapshot, movementUsed: mountMovement(get().battle!, active), action: null, reachable: new Map(), preview: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Sort de ZONE sélectionné : le clic-case OUVRE la modale — le centre se choisit APRÈS le jet.
 *  Sort non-zone : clic-sol sans effet en mode cast. Corps DÉPLACÉ verbatim de battleClickTile. */
function castCommitTile(get: Get, set: Set, active: Combatant, _pt: Pt): void {
  const battle = get().battle;
  if (battle && battle.action === 'cast' && battle.selectedSpellId && !battle.acted && !get().pendingCast) {
    castZoneSpell(get, set, active, battle.selectedSpellId);
  }
}

/** Pose la zone en cours sur la case d'un combattant cliqué (cast-zone / siège). */
function placingCommitCombatant(get: Get, _set: Set, _active: Combatant, id: string): void {
  const t = inBattleId(get().battle, id);
  if (t?.pos) get().battleClickTile({ ...t.pos });
}

// ───────────────────────────────────────────────────────────────────────────
// Les MODES (objets statiques) + l'aiguilleur
// ───────────────────────────────────────────────────────────────────────────

const ATTACK_MODE: TargetingMode = { id: 'attack', affordance: attackAffordance, commitCombatant: attackClickCommit };
const CAST_MODE: TargetingMode = {
  id: 'cast', affordance: castAffordance, commitCombatant: castClickCommit, commitTile: castCommitTile,
};
const BATTERY_MODE: TargetingMode = {
  id: 'battery', affordance: batteryAffordance,
  commitCombatant: (get, _set, active, id) => { get().battleShipBattery(active.id, id); },
};
const HEAL_MODE: TargetingMode = {
  id: 'heal', affordance: healAffordance,
  candidates: (get, active) => healableTargets(active, (get().battle?.combatants ?? []).filter((c) => c.kind === active.kind), { adjacency: true }),
  commitCombatant: (get, _set, _active, id) => {
    const target = inBattleId(get().battle, id);
    if (!target) return;
    const mode = combatHealModes(target)[0]; // mode par défaut au ciblage-carte ; la modale permet de basculer
    if (mode) get().battleHeal(id, mode);
  },
};
const OVERCAST_MODE: TargetingMode = {
  id: 'overcast', affordance: overcastAffordance,
  candidates: (get) => {
    const s = get();
    const pc = s.pendingCast;
    const pool = s.battle?.combatants ?? s.party;
    const caster = pc && pool.find((c) => c.id === pc.casterId);
    const spell = pc && findSpellById(pc.spellId);
    if (!pc || !caster || !spell) return [];
    return overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, overcastSourceOf(spell), pc.overcast?.range ?? 0, spellSightOf(get));
  },
  commitCombatant: (get, _set, _active, id) => { get().castToggleExtraTarget(id); },
};
const CLEAVE_MODE: TargetingMode = {
  id: 'cleave', affordance: cleaveAffordance,
  candidates: (get) => {
    const s = get();
    const battle = s.battle;
    const pc = s.pendingCleave;
    const atk = battle && pc && inBattleId(battle, pc.attackerId);
    return battle && pc && atk ? cleaveTargets(battle, atk, pc.hitIds) : [];
  },
  commitCombatant: (get, _set, _active, id) => { get().cleaveAttack(id); },
};
const DUAL_MODE: TargetingMode = {
  id: 'dual', affordance: dualAffordance,
  candidates: (get) => {
    const s = get();
    const battle = s.battle;
    const ds = s.pendingDualStrike;
    const atk = battle && ds && inBattleId(battle, ds.attackerId);
    const off = atk && ds && atk.weapons.find((w) => w.uid === ds.offWeaponUid);
    return battle && atk && off ? dualStrikeTargets(battle, atk, off) : [];
  },
  commitCombatant: (get, _set, _active, id) => { get().dualStrikeAttack(id); },
};
const TELEPORT_MODE: TileTargetingMode = {
  id: 'teleport',
  tileValidAt: (get, _active, pt) => !!get().battle?.reachable.has(`${pt.x},${pt.y}`),
  commitTile: teleportCommitTile,
  tilePreview: (_get, active, pt) => (active.pos ? { target: pt, path: [active.pos, pt], label: 'Téléporter' } : null),
};
/** POUSSÉE d'un engin de siège (ADE II 8 l.258, Lot 2 #156) : case-cible parmi `battle.reachable`
 *  (posé par `battlePushEngine`), MÊME gabarit que TELEPORT_MODE. */
const PUSH_MODE: TileTargetingMode = {
  id: 'push',
  tileValidAt: (get, _active, pt) => !!get().battle?.reachable.has(`${pt.x},${pt.y}`),
  commitTile: pushCommitTile,
  tilePreview: (get, active, pt) => {
    if (!active.pos) return null;
    const cost = get().battle?.reachable.get(`${pt.x},${pt.y}`) ?? 0;
    return { target: pt, path: [active.pos, pt], cost, label: `Pousser (${cost})` };
  },
};
/** Pose libre d'un gabarit de zone (sort de ZdE après jet OU pilonnage indirect de siège). */
const PLACING_MODE: TileTargetingMode = {
  id: 'placing-zone',
  tileValidAt: (get, _active, pt) => { const pz = placingZoneOf(get()); return !!pz && placedZoneValidAt(get, pz, pt); },
  commitTile: (get, set, _active, pt) => commitPlacedZone(get, set, pt),
  commitCombatant: placingCommitCombatant,
  tilePreview: (_get, _active, pt) => ({ target: pt, label: 'Poser la zone' }),
};

/** Catalogue des modes-CASE (#198) — SOURCE UNIQUE pour la garde exhaustive (test qui les itère et
 *  vérifie un aperçu non-vide sur une tuile valide) et pour tout consommateur générique (aperçu au
 *  survol, adressabilité DOM des cases valides). */
export const TILE_MODES: readonly TileTargetingMode[] = [TELEPORT_MODE, PUSH_MODE, PLACING_MODE];

/**
 * Aiguilleur UNIQUE — extrait factuellement des priorités de `battleClickEntity`/`hoverAim` :
 *   pendingCleave > pendingDualStrike > pendingCast.pickingTargets (Surincantation) >
 *   placingZoneOf (cast-zone OU siège) > battle.action ∈ {cast, heal, battery, teleport} > attack.
 * `battle.action` (string) et les `pending*` RESTENT l'état sous-jacent (ils gatent aussi mouvement/
 * fin de tour ailleurs) — on n'en DÉRIVE que le mode de ciblage.
 */
export function currentTargetingMode(get: Get): TargetingMode {
  const s = get();
  if (s.pendingCleave && !s.pendingAttack) return CLEAVE_MODE;
  if (s.pendingDualStrike && !s.pendingAttack) return DUAL_MODE;
  if (s.pendingCast?.pickingTargets) return OVERCAST_MODE;
  if (placingZoneOf(s)) return PLACING_MODE;
  const action = s.battle?.action ?? null;
  if (action === 'cast') return CAST_MODE;
  if (action === 'heal') return HEAL_MODE;
  if (action === 'battery') return BATTERY_MODE;
  if (action === 'teleport') return TELEPORT_MODE;
  if (action === 'push') return PUSH_MODE;
  return ATTACK_MODE;
}
