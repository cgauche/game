/**
 * Registre de MODIFICATEURS DE TOUCHE ORDONNÉS (`HitModifier`) — couture d'extension calquée sur
 * `roundHooks`/`turnHooks` (module FEUILLE peuplé par effet de bord à l'import). Les sauvegardes
 * SYNCHRONES « après la touche » vivent ICI, chacune étant un modifier ordonné par `order` qui TESTE
 * une condition et TRANSFORME `res` (l'`AttackResult`). SITE UNIQUE des deux chemins de touche :
 * le coup physique (`applyAttackResult`) et le Projectile magique (`applyCast`/`applyMissileHit`),
 * qui n'a pas d'arme — la nature du coup se lit sur `ctx.attaque`, jamais sur `weapon.type`.
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
 * ORDRE (encodé par `order`, figé par `hitSaves.golden.test`) :
 *   5 Réveil d'un dormeur → 8 Bouclier anti-flèches (le projectile est détruit AVANT d'être un coup
 *   reçu) → 10 sauvegarde « 1d10 ≥ Indice » (traits propres + Trait octroyé par un Dôme) → 40 Martyr
 *   → 50 Perturbante.
 */
import type { BattleState } from '../store';
import type { Get, Set as SetFn } from '../flowTypes';
import type { Combatant, Weapon } from '../../engine/types';
import type { TraitList } from '../../engine/statEntry';
import type { AttackResult } from '../../engine/combat';
import { d10 } from '../../engine/dice';
import { battleRng } from '../battleRng';
import { wardSaves, traitCapability, formatWardSave } from '../../engine/traits/dispatch';
import { canPushback } from '../../engine/qualities/dispatch';
import { isOutOfAction, loseWounds, applyZeroWounds, isMagicallyAsleep, wakeSleeper } from '../../engine/conditions';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { woundsFromHit } from '../../engine/woundsCalc';
import { combatDistance } from '../footprint';
import { porteeEnCases, pushBackTiles } from '../combatGeometry';
import { sceneMetresPerTile } from '../scene';
import { inBattleId } from '../combatants';
import { t } from '../../i18n';

// ── Helpers propres aux sauvegardes, DÉPLACÉS depuis combatFlow (ré-exporté via le baril pour applyCast / tests) ──

/** Martyr (LDB 43 l.99) : le prêtre (vivant, présent) qui encaisse à la place de `target`, ou null. */
export function martyrGuardOf(battle: BattleState, target: Combatant): Combatant | null {
  const id = (target.activeEffects ?? []).find((e) => e.martyrGuard)?.martyrGuard;
  if (!id || id === target.id) return null;
  const priest = inBattleId(battle, id);
  return priest && !isOutOfAction(priest) && !priest.dead ? priest : null;
}

/** LES AURAS PORTÉES qui COUVRENT la cible (L11 — Bouclier anti-flèches / Dôme) : celles d'un porteur
 *  vivant dont le rayon contient la CIBLE et PAS l'attaquant (« provenant de l'extérieur » /
 *  « s'ils entrent dans la Zone d'Effet »). SITE UNIQUE de cette géométrie — les deux lectures
 *  (présence, charge de l'aura) en dérivent. */
function aurasCouvrant<T extends { radiusMeters: number }>(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  mpt: number,
  lire: (e: NonNullable<Combatant['activeEffects']>[number]) => T | undefined,
): T[] {
  const out: T[] = [];
  for (const w of combatants) {
    if (isOutOfAction(w) || !w.pos) continue;
    for (const e of w.activeEffects ?? []) {
      const aura = lire(e);
      if (!aura) continue;
      const r = porteeEnCases(aura.radiusMeters, mpt);
      if (combatDistance(w, target) <= r && combatDistance(w, attacker) > r) out.push(aura);
    }
  }
  return out;
}

/** PRÉSENCE d'une aura couvrante — la lecture booléenne d'`aurasCouvrant`. */
export function wardedAgainst(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  field: 'arrowWard' | 'domeWard',
  mpt: number,
): boolean {
  return aurasCouvrant(combatants, attacker, target, mpt, (e) => e[field]).length > 0;
}

/** Les Traits que les Dômes couvrant la cible lui OCTROIENT (LDB 47 l.410) — la charge de l'aura est
 *  de la DONNÉE (`domeWard.ward`, posé par l'op du sort), lue par le MÊME collecteur de sauvegardes
 *  que les traits propres du porteur (`engine/traits/dispatch.wardSaves`). */
export function domeWardTraits(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  mpt: number,
): TraitList {
  return aurasCouvrant(combatants, attacker, target, mpt, (e) => e.domeWard).map((a) => a.ward);
}

/** LES SAUVEGARDES « 1d10 ≥ Indice » offertes à la cible CONTRE CE COUP : celles de ses propres Traits
 *  (Démoniaque `LDB 85 l.98`, Protection `LDB 85 l.278`) et celles qu'une zone lui octroie
 *  (Dôme `LDB 47 l.410` — branche `attaque === 'melee'` ci-dessous). UN SEUL collecteur d'Indices
 *  (`engine/traits/dispatch.wardSaves`) pour les deux provenances. Le TRAIT voyage avec son seuil : le
 *  journal nomme celui qui a réellement sauvé, et `dome` dit d'où il vient. */
export function seuilsDeSauvegarde(
  combatants: Combatant[],
  attacker: Combatant,
  target: Combatant,
  attaque: TypeDAttaque,
  mpt: number,
): { thr: number; trait: TraitList[number]; dome: boolean }[] {
  const octroyes = attaque === 'melee' ? [] : domeWardTraits(combatants, attacker, target, mpt);
  // CHOIX D'IMPLÉMENTATION non sourcé — le RAW (LDB 47 l.410) OCTROIE le Trait et reste MUET sur le
  // cumul : ici un Trait ne se possède qu'UNE fois, donc deux dômes couvrants (ou un dôme sur un porteur
  // qui a déjà le Trait) n'offrent pas deux dés : UN seul par id de Trait, au meilleur Indice, la
  // PROVENANCE restant celle de la première source vue. Deux Traits DISTINCTS (Démoniaque + Protection)
  // restent deux sauvegardes.
  const meilleur = new Map<string, { thr: number; trait: TraitList[number]; dome: boolean }>();
  for (const { t, dome } of [
    ...(target.traits ?? []).map((t) => ({ t, dome: false })),
    ...octroyes.map((t) => ({ t, dome: true })),
  ]) {
    const thr = wardSaves([t])[0];
    if (thr == null) continue;
    const vu = meilleur.get(t.id);
    if (!vu) meilleur.set(t.id, { thr, trait: t, dome });
    else if (thr < vu.thr) meilleur.set(t.id, { thr, trait: t, dome: vu.dome });
  }
  return [...meilleur.values()];
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
  /** L'ARME du coup — absente quand la touche n'en a pas (Projectile magique) : les modifiers qui la
   *  lisent (Bouclier anti-flèches, Perturbante) sont alors hors de leur cas. */
  weapon?: Weapon;
  /** NATURE de l'attaque, la seule que les modifiers interrogent : une règle qui vise les attaques
   *  magiques ou à distance (LDB 47 l.410) ne se lit pas sur `weapon.type`, qu'un Projectile magique
   *  n'a pas. */
  attaque: TypeDAttaque;
  res: AttackResult;
  sink: (line: string) => void;
  /** Un TIERS a encaissé à la place de la cible (Martyr) — l'appelant en tire ce qui ne relève pas du
   *  registre (l'interruption de Focalisation vit dans `combatFlow`, que ce module n'importe pas). */
  encaisse?: (c: Combatant, pb: number) => void;
}

/** Les natures d'attaque qu'une sauvegarde peut distinguer — union FERMÉE : le corps à corps, le tir,
 *  et le Projectile magique (LDB 46), qui n'est porté par aucune arme. */
export type TypeDAttaque = 'melee' | 'ranged' | 'magique';

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

// ── Sauvegardes post-touche ────────────────────────────────────────────────────────────

registerHitModifier({
  // Sommeil (Magie mineure) / Belladone : un dormeur MAGIQUE (Inconscient À DURÉE, PB > 0) se RÉVEILLE
  // quand on l'attaque (LDB 47 l.277). Le dormeur n'est PAS achevé (≠ coup de grâce d'un Inconscient
  // à 0 PB, LDB 16 l.113 → `autoKill` annulé) : il encaisse une attaque normale et se relève. EXCEPTION :
  // Salive analgésique (capability `wakelessBite`) — la morsure INDOLORE s'accroche à la proie sans la réveiller.
  id: 'wake-sleeper',
  order: 5,
  apply: ({ attacker, target, res }) => {
    if (res.hit && isMagicallyAsleep(target) && !traitCapability(attacker.traits, 'wakelessBite')) {
      wakeSleeper(target);
      res = { ...res, autoKill: false, log: `${res.log ? res.log + ' ' : ''}${t('cf.wakeSleeper', { name: attacker.label, foe: target.label })}` };
    }
    return res;
  },
});

registerHitModifier({
  // SITE UNIQUE de la sauvegarde « 1d10 ≥ Indice » (Démoniaque LDB 85 l.98, Protection LDB 85 l.278,
  // et le Trait qu'un Dôme octroie, LDB 47 l.410) : un seul dé, quelle que soit la provenance de
  // l'Indice. (Les héros n'ont pas ces traits → pas de double-jet sur les reprises de déviation.)
  id: 'ward-saves',
  order: 10,
  apply: ({ get, attacker, target, attaque, res }) => {
    if (!res.hit || !res.woundsLost) return res;
    // Le journal NOMME le Trait qui a réellement sauvé (ou manqué), et d'où il vient — jamais un
    // « Démoniaque/Protection » à deviner. Graphie du seuil : `formatWardSave`, la seule. Un dé JETÉ
    // s'ÉCRIT, qu'il sauve ou non : sans la ligne du RATÉ, le joueur voit ses Blessures tomber sous
    // sa propre protection sans que rien ne le lui explique.
    const rates: string[] = [];
    for (const { thr, trait, dome } of seuilsDeSauvegarde(get().battle?.combatants ?? [], attacker, target, attaque, sceneMetresPerTile(get().scene))) {
      const d = d10(battleRng());
      const args = { name: target.label, roll: d, trait: formatWardSave(trait.id, thr), src: dome ? t('cf.wardFromDome') : '' };
      if (d < thr) { rates.push(t('cf.wardFailed', args)); continue; }
      // La réussite N'EFFACE PAS les dés déjà jetés : deux Traits (le sien + celui d'un Dôme) font deux
      // dés, et les deux s'écrivent, dans l'ordre où ils sont tombés.
      return { ...res, woundsLost: 0, damage: 0, critical: false, log: [...rates, t('cf.wardSaved', args)].join(' ') };
    }
    if (rates.length) res = { ...res, log: [res.log, ...rates].filter(Boolean).join(' ') };
    return res;
  },
});

registerHitModifier({
  // Bouclier anti-flèches (LDB 47 — L11) : projectile ORGANIQUE entrant dans la zone → détruit,
  // « n'infligeant aucun Dégât à leur cible ». Le tir et la munition sont consommés normalement.
  // AVANT les sauvegardes : un projectile détruit en vol n'est pas un coup reçu (LDB 85 l.98), il n'y a
  // donc aucun dé de sauvegarde à jeter contre lui.
  id: 'arrow-ward',
  order: 8,
  apply: ({ get, attacker, target, weapon, attaque, res }) => {
    if (res.hit && attaque === 'ranged' && weapon && organicProjectile(weapon)
      && wardedAgainst(get().battle?.combatants ?? [], attacker, target, 'arrowWard', sceneMetresPerTile(get().scene))) {
      res = { ...res, woundsLost: 0, damage: 0, critical: false, log: t('cf.arrowWardDestroys', { name: target.label }) };
    }
    return res;
  },
});

registerHitModifier({
  // Martyr (LDB 43 l.107) : la frappe est encaissée par le prêtre trouvé par `martyrGuardOf`, au lieu
  // de la cible — qui ne perd aucun PB (les États de la touche restent sur elle).
  id: 'martyr',
  order: 40,
  apply: ({ get, attacker, target, weapon, res, encaisse }) => {
    if (res.hit && res.woundsLost) {
      const priest = martyrGuardOf(get().battle!, target);
      if (priest) {
        const loc = res.location ?? 'corps';
        const raw = res.damage ?? res.woundsLost;
        // Aucun calcul propre à ce Miracle : on COMPOSE la primitive unique des Blessures
        // (LDB 13 l.159), qui apporte le PA à la Localisation, Robuste, les bypass d'arme et le
        // plancher ; LDB 43 l.107 n'y ajoute qu'un BE de plus retiré des Dégâts.
        const taken = woundsFromHit(weapon, priest, loc, raw - bonus(effectiveChar(priest, 'endurance')), 0, 1, attacker.size);
        loseWounds(priest, taken);
        if (priest.wounds.current <= 0) applyZeroWounds(priest);
        encaisse?.(priest, taken);
        res = { ...res, woundsLost: 0, log: `${res.log ? res.log + ' ' : ''}${t('cf.martyrTakes', { priest: priest.label, name: target.label, taken })}` };
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
  apply: ({ get, attacker, target, weapon, attaque, res }) => {
    if (attacker.pushbackMode && attaque === 'melee' && weapon && canPushback(weapon)) {
      attacker.pushbackMode = false; // consommé par cette attaque (réussie ou non)
      if (res.hit) {
        const meters = Math.max(0, res.netSL);
        const wanted = Math.floor(meters / 2);
        const moved = pushBackTiles(get, attacker, target, wanted);
        res = {
          ...res, woundsLost: 0, damage: 0, critical: false,
          log: t('cf.pushback', { name: attacker.label, foe: target.label, meters, bloque: moved < wanted ? t('cf.pushbackBlocked') : '' }),
        };
      }
    }
    return res;
  },
});
