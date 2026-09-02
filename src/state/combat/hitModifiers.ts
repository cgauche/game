/**
 * Registre de MODIFICATEURS DE TOUCHE ORDONNÉS (`HitModifier`) — couture d'extension calquée sur
 * `roundHooks`/`turnHooks` (module FEUILLE peuplé par effet de bord à l'import). Les sauvegardes
 * SYNCHRONES « après la touche » d'`applyAttackResult` vivent ICI, chacune étant un modifier ordonné par
 * `order` qui TESTE une condition et TRANSFORME `res` (l'`AttackResult`).
 *
 * N'importe RIEN de combatFlow (qui le ré-exporte via le baril) → pas de cycle. Les helpers propres
 * aux sauvegardes (`martyrGuardOf`, `wardedAgainst`, `organicProjectile`) sont DÉPLACÉS ici depuis
 * combatFlow (qui les ré-exporte pour `applyCast`/les tests, patron `brokenRecovery`).
 *
 * SÉMANTIQUE DE CHAÎNAGE (iso-comportement) : `runHitModifiers` enchaîne les modifiers dans l'ordre
 * `order`, chacun RE-TESTANT l'état COURANT de `res` (`ctx.res = modifier.apply(ctx)`) — exactement
 * comme les `if` successifs d'origine se suivaient et re-testaient `res` (un modifier qui annule déjà
 * les Dégâts fait court-circuiter les suivants via leur propre garde `res.woundsLost`). Renvoie le
 * `res` final. Aucun modifier ne SUSPEND (pas de `pushCombatStep`/pending) : autoKill et l'offre de
 * Déviation Critique restent INLINE dans `applyAttackResult`, APRÈS ce registre.
 *
 * ORDRE RAW (encodé par `order`, préservé byte-pour-byte par `hitSaves.golden.test`) :
 *   10 Démoniaque/Protection (`wardSaves`) → 20 Bouclier anti-flèches (`arrowWard`) →
 *   30 Dôme (`domeWard`) → 40 Martyr → 50 Perturbante.
 */
import type { BattleState } from '../store';
import type { Get, Set as SetFn } from '../flowTypes';
import type { Combatant, Weapon } from '../../engine/types';
import type { AttackResult } from '../../engine/combat';
import { d10 } from '../../engine/dice';
import { battleRng } from '../battleRng';
import { wardSaves, traitCapability } from '../../engine/traits/dispatch';
import { canPushback } from '../../engine/qualities/dispatch';
import { isOutOfAction, loseWounds, applyZeroWounds, isMagicallyAsleep, wakeSleeper } from '../../engine/conditions';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { combatDistance } from '../footprint';
import { porteeEnCases, pushBackTiles } from '../combatGeometry';
import { sceneMetresPerTile } from '../scene';
import { inBattleId } from '../combatants';

// ── Helpers propres aux sauvegardes, DÉPLACÉS depuis combatFlow (ré-exporté via le baril pour applyCast / tests) ──

/** Martyr (LDB 43 l.99) : le prêtre (vivant, présent) qui encaisse à la place de `target`, ou null. */
export function martyrGuardOf(battle: BattleState, target: Combatant): Combatant | null {
  const id = (target.activeEffects ?? []).find((e) => e.martyrGuard)?.martyrGuard;
  if (!id || id === target.id) return null;
  const priest = inBattleId(battle, id);
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
  mpt: number,
): boolean {
  return combatants.some((w) => !isOutOfAction(w) && w.pos && (w.activeEffects ?? []).some((e) => {
    const ward = e[field];
    if (!ward) return false;
    const r = porteeEnCases(ward.radiusMeters, mpt);
    return combatDistance(w, target) <= r && combatDistance(w, attacker) > r;
  }));
}

/** Projectile « constitué de matière organique » (Bouclier anti-flèches, LDB 47) — flag maison
 *  éditable, keyé par id (`Weapon.organicProjectile`). */
export function organicProjectile(w: Weapon): boolean {
  return !!w.organicProjectile;
}

// ── Registre ──────────────────────────────────────────────────────────────────────────────────────

/** Contexte d'un modifier de touche : l'état (get/set), les protagonistes, le `res` COURANT, et un
 *  `sink(line)` pour journaliser (les sauvegardes posent leur ligne dans `res.log`, pas via `sink` —
 *  `sink` reste disponible pour un futur modifier qui en aurait besoin). */
export interface HitModifierCtx {
  get: Get;
  set: SetFn;
  attacker: Combatant;
  target: Combatant;
  weapon: Weapon;
  res: AttackResult;
  sink: (line: string) => void;
}

/** Un modifier de touche = une sauvegarde NOMMÉE qui TRANSFORME `res`. `order` fixe sa position dans
 *  la séquence (l'ordre RAW est encodé par `order`). `apply` RE-TESTE `ctx.res` et renvoie le `res`
 *  (inchangé ou transformé). Ne SUSPEND jamais (pas de pending). */
export interface HitModifier {
  id: string;
  order: number;
  apply(ctx: HitModifierCtx): AttackResult;
}

const MODIFIERS: HitModifier[] = [];

/** Enregistre (ou REMPLACE par `id`) un modifier et garde la liste triée par `order` croissant.
 *  Idempotent par id (sûr face au double-import / HMR). */
export function registerHitModifier(h: HitModifier): void {
  const i = MODIFIERS.findIndex((x) => x.id === h.id);
  if (i >= 0) MODIFIERS[i] = h;
  else MODIFIERS.push(h);
  MODIFIERS.sort((a, b) => a.order - b.order);
}

/** Enchaîne les modifiers dans l'ordre `order` : pour chacun, `ctx.res = modifier.apply(ctx)` (thread
 *  `res`). Chaque modifier re-teste l'état courant de `res` — un modifier qui annule déjà les Dégâts
 *  fait no-oper les suivants via leur propre garde. Renvoie le `res` final. */
export function runHitModifiers(ctx: HitModifierCtx): AttackResult {
  for (const h of MODIFIERS) ctx.res = h.apply(ctx);
  return ctx.res;
}

/** Modifiers enregistrés (diagnostic / garde-fou de test). */
export function hitModifiers(): readonly HitModifier[] {
  return MODIFIERS;
}

// ── Sauvegardes post-touche (corps COPIÉS verbatim depuis applyAttackResult) ────────────────────────

registerHitModifier({
  // Sommeil (Magie mineure) / Belladone : un dormeur MAGIQUE (Inconscient À DURÉE, PB > 0) se RÉVEILLE
  // quand on l'attaque — « les bruits forts, le fait de la déplacer ou de la bousculer la réveille
  // instantanément » (sort Sommeil). Cette règle était laissée à un op `narrative` « arbitrage MJ » ; ici
  // le MJ, c'est le MOTEUR, donc on l'applique. Le dormeur n'est PAS achevé (≠ coup de grâce d'un Inconscient
  // à 0 PB, LDB 16 l.113 → `autoKill` annulé) : il encaisse une attaque normale et se relève. EXCEPTION :
  // Salive analgésique (capability `wakelessBite`) — la morsure INDOLORE s'accroche à la proie sans la réveiller.
  id: 'wake-sleeper',
  order: 5,
  apply: ({ attacker, target, res }) => {
    if (res.hit && isMagicallyAsleep(target) && !traitCapability(attacker.traits, 'wakelessBite')) {
      wakeSleeper(target);
      res = { ...res, autoKill: false, log: `${res.log ? res.log + ' ' : ''}${attacker.label} réveille ${target.label} en l'attaquant — le sommeil se rompt.` };
    }
    return res;
  },
});

registerHitModifier({
  // Démoniaque (Indice+) / Protection (Indice) — LDB 85 p.339/341 : « Lancez 1d10 après chaque coup
  // reçu ; si la créature obtient le nombre de l'Indice ou plus, le coup est ignoré, même critique. »
  // (Les héros n'ont pas ces traits → pas de double-jet sur les reprises de déviation.)
  id: 'ward-saves',
  order: 10,
  apply: ({ target, res }) => {
    if (res.hit && res.woundsLost) {
      for (const thr of wardSaves(target.traits)) {
        const d = d10(battleRng());
        if (d >= thr) {
          res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `${target.label} ignore le coup — sauvegarde ${d} ≥ ${thr} (Démoniaque/Protection).` };
          break;
        }
      }
    }
    return res;
  },
});

registerHitModifier({
  // Bouclier anti-flèches (LDB 47 — L11) : projectile ORGANIQUE entrant dans la zone → détruit,
  // « n'infligeant aucun Dégât à leur cible ». Le tir et la munition sont consommés normalement.
  id: 'arrow-ward',
  order: 20,
  apply: ({ get, attacker, target, weapon, res }) => {
    if (res.hit && weapon.type === 'ranged' && organicProjectile(weapon)
      && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'arrowWard', sceneMetresPerTile(get().scene))) {
      res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `Le projectile se désagrège en entrant dans la zone — ${target.label} est indemne (Bouclier anti-flèches).` };
    }
    return res;
  },
});

registerHitModifier({
  // Dôme (LDB 47 — L11) : Protection (6+) contre une attaque À DISTANCE venant de l'extérieur.
  id: 'dome-ward',
  order: 30,
  apply: ({ get, attacker, target, weapon, res }) => {
    if (res.hit && res.woundsLost && weapon.type === 'ranged'
      && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'domeWard', sceneMetresPerTile(get().scene))) {
      const d = d10(battleRng());
      if (d >= 6) res = { ...res, woundsLost: 0, damage: 0, critical: false, log: `${target.label} est couvert par le Dôme — sauvegarde ${d} ≥ 6, le tir est dévié.` };
    }
    return res;
  },
});

registerHitModifier({
  // Martyr (LDB 43 l.107) : « Vous recevez tous les Dégâts subis en principe par vos cibles » —
  // le prêtre encaisse les Dégâts BRUTS de la frappe, mitigés par 2×SON BE + ses PA à la
  // localisation touchée ; la cible ne perd rien (les États de la touche restent sur elle).
  id: 'martyr',
  order: 40,
  apply: ({ get, target, res }) => {
    if (res.hit && res.woundsLost) {
      const priest = martyrGuardOf(get().battle!, target);
      if (priest) {
        const loc = res.location ?? 'corps';
        const raw = res.damage ?? res.woundsLost;
        const taken = Math.max(0, raw - 2 * bonus(effectiveChar(priest, 'endurance')) - Math.max(0, priest.armour[loc] ?? 0));
        if (taken > 0) {
          loseWounds(priest, taken);
          if (priest.wounds.current <= 0) applyZeroWounds(priest);
        }
        res = { ...res, woundsLost: 0, log: `${res.log} Martyr : ${priest.label} reçoit les Dégâts à la place de ${target.label}${taken > 0 ? ` (${taken} PB, BE doublé)` : ' (encaissés sans dommage, BE doublé)'}.` };
      }
    }
    return res;
  },
});

registerHitModifier({
  // Perturbante (LDB 62 l.272-274) : mode « Repousser » armé → l'attaque réussie ne cause PAS de
  // Dégâts, l'adversaire recule d'1 m par DR du Test opposé (1 case = 2 m, LDB 15 l.12).
  id: 'pushback',
  order: 50,
  apply: ({ get, attacker, target, weapon, res }) => {
    if (attacker.pushbackMode && weapon.type === 'melee' && canPushback(weapon)) {
      attacker.pushbackMode = false; // consommé par cette attaque (réussie ou non)
      if (res.hit) {
        const meters = Math.max(0, res.netSL);
        const wanted = Math.floor(meters / 2);
        const moved = pushBackTiles(get, attacker, target, wanted);
        res = {
          ...res, woundsLost: 0, damage: 0, critical: false,
          log: `${attacker.label} repousse ${target.label} de ${meters} m (Perturbante${moved < wanted ? ' — recul bloqué' : ''}).`,
        };
      }
    }
    return res;
  },
});
