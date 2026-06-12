/**
 * Ciblage au SURVOL — source unique du tooltip + réticule + ligne de visée du joueur (IsoStage).
 * Rejoue les MÊMES prédicats que le clic (attackPlan / castSpell) pour que l'affordance ne mente
 * jamais : réticule présent = le clic aboutira, ⛔ = il sera refusé (et pourquoi). Pur (lit l'état).
 */
import { Combatant } from '../engine/types';
import { combineMods } from '../engine/combat';
import { castInfo, isMagicMissile, parseSpellDamage, spellRangeTiles } from '../engine/magic';
import { bonus, effectiveChar } from '../engine/characteristics';
import { isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { findSpell } from '../data';
import { spellSpecFor } from '../data/spellspecs';
import { combatDistance } from './footprint';
import type { GameState } from './store';
import { attackPlan, previewAttack, previewCast, castSightBlocked } from './combatFlow';

export type HoverTargeting =
  | { kind: 'none' }
  /** Cible refusée au clic — `engaged` = mêlée verrouillée par l'Engagement (Désengagement requis). */
  | { kind: 'invalid'; reason: 'los' | 'range' | 'engaged' }
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
    };

/** Libellé de la compétence d'attaque : Corps à corps/Projectiles + famille d'arme si connue. */
const weaponSkillLabel = (kind: 'melee' | 'ranged', subType?: string): string =>
  `${kind === 'ranged' ? 'Projectiles' : 'Corps à corps'}${subType ? ` (${subType})` : ''}`;

/**
 * Évalue le survol de `target` par le héros `active` selon le mode courant :
 *  • mode neutre → attaque implicite (mêlée / tir / Charge / rejoindre) ;
 *  • mode incantation → sort sélectionné (Projectile sur un adversaire, bénéfique sur un allié/soi).
 * Retourne `none` quand le survol n'a pas de sens (mauvaise équipe, hors mode, hors combat).
 */
export function hoverTargeting(get: () => GameState, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle;
  if (!battle || battle.over || !active.pos || !target.pos) return { kind: 'none' };

  // ── Mode incantation : mêmes gates que castSpell (équipe → portée → LdV) ──
  if (battle.action === 'cast' && battle.selectedSpell) {
    const spell = findSpell(battle.selectedSpell);
    if (!spell) return { kind: 'none' };
    const missile = isMagicMissile(spell);
    if (missile ? target.kind === active.kind || isOutOfAction(target) : target.kind !== active.kind || target.dead || target.outOfRencontre)
      return { kind: 'none' };
    if (target.id !== active.id) {
      // Souffle : la portée suit le TRAIT (BE+20 m), pas le champ Portée — même calcul que castSpell.
      const range = spellSpecFor(spell).breathAttack
        ? Math.max(1, Math.ceil((bonus(effectiveChar(active, 'E')) + 20) / 2))
        : spellRangeTiles(spell.range, active);
      if (range != null && combatDistance(active, target) > range) return { kind: 'invalid', reason: 'range' };
      if (castSightBlocked(get, active.pos, target.pos)) return { kind: 'invalid', reason: 'los' };
    }
    const pv = previewCast(active, spell, {
      missile,
      focused: active.focus?.spell === spell.label && active.focus.dr >= (spell.cn ?? 0),
    });
    const dmg = missile ? parseSpellDamage(spell.desc) : null;
    return {
      kind: 'ok',
      line: 'dashed',
      title: spell.label,
      skill: castInfo(spell).skill === 'Prière' ? 'Prière' : 'Langue (Magick)',
      base: pv.base,
      mod: pv.target - pv.base,
      // Dégâts d'un Projectile AVANT DR (evaluateMissile : sort + DR + BFM) — parité arme (Force incluse).
      dmg: dmg ? dmg.damage + bonus(effectiveChar(active, 'FM')) : null,
    };
  }

  // ── Mode neutre : attaque implicite ──
  if (battle.action !== null) return { kind: 'none' };
  if (target.kind === active.kind || isOutOfAction(target)) return { kind: 'none' };
  const plan = attackPlan(get, active, target);
  if (plan.kind === 'blocked') {
    const p = previewAttack(get, active, target);
    return { kind: 'invalid', reason: p.blocked ? 'los' : p.kind === 'melee' && isEngaged(active) ? 'engaged' : 'range' };
  }
  // Charge / rejoindre : aperçu calculé depuis la case d'ARRIVÉE (modificateurs honnêtes au contact) ;
  // le CHEMIN réel et la nature de la manœuvre remontent au survol (le clic UNIQUE commet tout).
  const from = plan.kind === 'attack' ? active : { ...active, pos: plan.dest };
  const p = previewAttack(get, from, target);
  return {
    kind: 'ok',
    line: p.kind === 'ranged' ? 'dashed' : 'solid',
    title: p.weapon.name,
    skill: weaponSkillLabel(p.kind, p.weapon.subType),
    base: p.base,
    mod: combineMods(p.mods),
    dmg: p.dmg,
    path: plan.kind === 'attack' ? undefined : plan.path,
    note: plan.kind === 'charge' ? `Charge${plan.adv ? ' (+1 Avantage)' : ''}` : plan.kind === 'moveAttack' ? 'Rejoindre + attaquer' : undefined,
  };
}
