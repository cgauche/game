/**
 * Dispatcher PUR des qualités d'objet : NORMALISE chaque chaîne via `parseQuality` (clé canonique
 * du registre + Indice typé), puis expose des helpers que combat.ts/items.ts/combatFlow appellent
 * au lieu de tester des chaînes en dur. Aucune mutation. Accepte tout porteur de `qualities`
 * (Weapon ou ItemInstance).
 */
import type { Weapon } from '../types';
import { QUALITIES, QualityDef, QualityCtx } from './registry';
import { parseQuality } from './normalize';

/** Tout porteur de qualités (Weapon ou ItemInstance) — seul `qualities` est requis. */
export type QualityCarrier = { qualities: string[] };

/** Une qualité résolue présente sur un objet : sa définition de registre + son Indice éventuel. */
export interface ResolvedQuality {
  def: QualityDef;
  indice?: number;
}

/** Qualités du registre présentes sur l'objet (normalisées, avec Indice). Chaînes inconnues ignorées.
 *  Applique la PRÉSÉANCE `beats` : une qualité vaincue par une autre présente est retirée
 *  (« Imprécise prend le dessus » sur Précise, LDB 63 l.20 ; Lente sur Rapide, LDB 62 l.321). */
export function resolveQualities(w: QualityCarrier | undefined): ResolvedQuality[] {
  if (!w) return [];
  const out: ResolvedQuality[] = [];
  for (const raw of w.qualities) {
    const p = parseQuality(raw);
    if (p) out.push({ def: QUALITIES[p.key], indice: p.indice });
  }
  const beaten = new Set(out.flatMap((r) => r.def.beats ?? []));
  return beaten.size ? out.filter((r) => !beaten.has(r.def.key)) : out;
}

/** L'objet possède-t-il la qualité canonique `key` ? (remplace l'ancien `hasQ` startsWith). */
export function hasQuality(w: QualityCarrier | undefined, key: string): boolean {
  return resolveQualities(w).some((r) => r.def.key === key);
}

/** Indice de la qualité `key` sur l'objet (ex. Solide/Recharge → N), ou undefined si absente/sans Indice. */
export function qualityIndice(w: QualityCarrier | undefined, key: string): number | undefined {
  return resolveQualities(w).find((r) => r.def.key === key)?.indice;
}

/** Somme d'un champ numérique du registre sur les qualités présentes (0 si aucune). */
export function qualitySum(w: QualityCarrier | undefined, field: 'attackMod' | 'armourReduction' | 'damageDR'): number {
  return resolveQualities(w).reduce((s, r) => s + (r.def[field] ?? 0), 0);
}

/** Une qualité de l'arme déclenche-t-elle un Critique pour ce jet ? (Empaleuse multiple de 10). */
export function qualityCritTriggered(w: QualityCarrier | undefined, roll: number): boolean {
  const ctx: QualityCtx = { roll };
  return resolveQualities(w).some((r) => r.def.critTrigger?.(ctx) ?? false);
}

/** Ajustement de DR de la PARADE (Test opposé) : Défensive (arme du défenseur) +1, À Enroulement (arme de l'attaquant) -1. */
export function parryDRAdjust(defenderWeapon: QualityCarrier | undefined, attackerWeapon: QualityCarrier | undefined): number {
  const def = resolveQualities(defenderWeapon).reduce((s, r) => s + (r.def.defenderParryDR ?? 0), 0);
  const atk = resolveQualities(attackerWeapon).reduce((s, r) => s + (r.def.attackerParryDR ?? 0), 0);
  return def + atk;
}

/** L'arme peut-elle tirer au Combat rapproché (Atout Pistolet) ? */
export function canFireWhileEngaged(w: Weapon | undefined): boolean {
  return !!w && w.type === 'ranged' && resolveQualities(w).some((r) => r.def.canFireWhileEngaged);
}

/** L'objet est-il insensible aux dégâts/destruction (Incassable) ? (remplace les regex /incassable/i). */
export function isUnbreakable(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.def.unbreakable);
}

/** L'arme est-elle une arme à feu (Poudre noire / Explosion) ? (remplace les regex /poudre|explos/i sur les qualités). */
export function isFirearmQuality(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.def.firearm);
}

/** Ajustement de DR d'un Test RATÉ utilisant l'objet : Pratique +1, Peu Fiable -1 (LDB 60 l.59/88).
 *  Renvoie 0 si le test est RÉUSSI (la règle ne vise que les échecs). */
export function craftTestDRAdjust(w: QualityCarrier | undefined, success: boolean): number {
  if (success) return 0;
  return resolveQualities(w).reduce((s, r) => s + (r.def.testFailDR ?? 0), 0);
}

/** Somme des modificateurs de Sociabilité (Laid -10, LDB 60 l.85) des qualités du porteur. */
export function qualitySocMod(w: QualityCarrier | undefined): number {
  return resolveQualities(w).reduce((s, r) => s + (r.def.socMod ?? 0), 0);
}

/** Indice d'une Arme d'équipe maniée en sous-effectif (toujours, faute d'équipe modélisée), ou 0. */
function crewedSoloIndice(w: QualityCarrier | undefined): number {
  return resolveQualities(w).find((r) => r.def.crewedTeam)?.indice ?? 0;
}

/** DR cible du rechargement (Recharge Indice), DOUBLÉ pour une Arme d'équipe maniée seul
 *  (sous-effectif, Aux Armes p.124). 0 si l'arme n'a pas le Défaut Recharge. */
export function reloadDRTarget(w: (QualityCarrier & { reload?: number }) | undefined): number {
  return (w?.reload ?? 0) * (crewedSoloIndice(w) >= 2 ? 2 : 1);
}

/** ±DR au Test d'ATTAQUE avec l'arme (Imprécise -1, LDB 63 l.19) — réussi ou raté. Inclut le sous-
 *  effectif d'une Arme d'équipe d'Indice ≥ 3 (Imprécise, Aux Armes p.124). */
export function attackDRAdjust(w: QualityCarrier | undefined): number {
  return resolveQualities(w).reduce((s, r) => s + (r.def.attackDR ?? 0), 0) + (crewedSoloIndice(w) >= 3 ? -1 : 0);
}

/** +DR à TOUT Test de défense (Parade ET Esquive) contre l'arme de l'attaquant (Lente +1, LDB 63 l.26). */
export function vsDefenseDRAdjust(attackerWeapon: QualityCarrier | undefined): number {
  return resolveQualities(attackerWeapon).reduce((s, r) => s + (r.def.vsDefenseDR ?? 0), 0);
}

/** Rapide (LDB 62 l.320-321) : −10 à la PARADE contre une arme Rapide si l'arme de parade n'est
 *  pas Rapide elle-même. 0 sinon (l'Esquive et les autres Compétences défendent normalement). */
export function rapideParryMod(attackerWeapon: QualityCarrier | undefined, parryWeapon: QualityCarrier | undefined): number {
  if (!resolveQualities(attackerWeapon).some((r) => r.def.fastStrike)) return 0;
  return resolveQualities(parryWeapon).some((r) => r.def.fastStrike) ? 0 : -10;
}

/** Lente (LDB 63 l.25) : le porteur d'une arme Lente (active) frappe en dernier dans le Round. */
export function strikesLast(weapons: QualityCarrier[] | undefined): boolean {
  return (weapons ?? []).some((w) => resolveQualities(w).some((r) => r.def.slowStrike));
}

/** Rapide (LDB 62 l.318-319) : le porteur peut attaquer hors de l'ordre d'Initiative (pré-emption gratuite). */
export function canStrikeFirst(weapons: QualityCarrier[] | undefined): boolean {
  return (weapons ?? []).some((w) => resolveQualities(w).some((r) => r.def.fastStrike));
}

/** Dangereuse (LDB 63 l.13-14) : ce jet RATÉ avec cette arme inclut-il un 9 (dizaines ou unités) ?
 *  Une Arme d'équipe d'Indice ≥ 4 maniée en sous-effectif devient Dangereuse (Aux Armes p.124). */
export function dangerousNine(w: QualityCarrier | undefined, roll: number, success: boolean): boolean {
  const dangerous = resolveQualities(w).some((r) => r.def.fumbleOn9) || crewedSoloIndice(w) >= 4;
  if (success || !dangerous) return false;
  return roll % 10 === 9 || Math.floor(roll / 10) % 10 === 9;
}

/** Chargeur (Indice) avant rechargement complet : À Répétition (LDB 62 l.264) ou Salve (Aux Armes
 *  p.126) — l'arme tire Indice fois avant d'exiger un rechargement. undefined si l'arme n'en a pas. */
export function magazineSize(w: QualityCarrier | undefined): number | undefined {
  const r = resolveQualities(w).find((x) => x.def.magazine || x.def.salvo);
  return r ? r.indice ?? 1 : undefined;
}

/** Protectrice (Indice) : PA conférés à TOUTES les localisations quand on OPPOSE l'attaque avec
 *  cette arme (LDB 62 l.306). 0 si la qualité est absente. */
export function protectriceAP(parryWeapon: QualityCarrier | undefined): number {
  const r = resolveQualities(parryWeapon).find((x) => x.def.parryAP);
  return r ? r.indice ?? 1 : 0;
}

/** Protectrice ≥ 2 : permet d'OPPOSER les projectiles tirés en Ligne de Vue (LDB 62 l.307).
 *  Renvoie l'arme protectrice utilisable, ou undefined. */
export function rangedOpposeWeapon(weapons: Weapon[] | undefined): Weapon | undefined {
  return (weapons ?? []).find((w) => {
    const r = resolveQualities(w).find((x) => x.def.parryAP);
    return r && (r.indice ?? 1) >= 2;
  });
}

/** Perturbante (LDB 62 l.275-276) : l'arme peut repousser au lieu de blesser. */
export function canPushback(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.def.pushback);
}

/** Piège-lame (LDB 62 l.292-294) : l'arme peut piéger une lame sur un Critique défensif. */
export function hasBladeTrap(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.def.bladeTrap);
}

/** Arme MAGIQUE (qualité enchantée, ADE2) : ses attaques comptent comme magiques (Éthéré, LDB 85). */
export function isMagicWeapon(w: QualityCarrier | undefined): boolean {
  return resolveQualities(w).some((r) => r.def.magic);
}

export interface DamageStepCtx {
  /** DR-pour-dégâts de base (déjà augmenté de Pointue). */
  effDR: number;
  /** Dé des unités du jet de toucher (LDB 62 l.279/313). */
  units: number;
  /** L'attaquant a Chargé ce Tour (gating Épuisante, LDB 63 l.16-17). */
  charged?: boolean;
}
export interface DamageStep {
  /** DR-dégâts effectif (Dévastatrice : max(DR, unités)). */
  dmgDR: number;
  /** Bonus plat de Dégâts (Percutante : + dé des unités). */
  bonus: number;
}

/** Ajustement de Dégâts dû aux qualités : Dévastatrice (DR = max(DR, dé des unités)), Percutante
 *  (+ dé des unités) ; **annulés** si une qualité Inoffensive est présente. `extra` = qualités
 *  conférées hors arme (ex. par la Taille, LDB 85 l.295). Épuisante (LDB 63 l.16-17) : les Atouts
 *  de Dégâts DE L'ARME ne valent qu'en Charge (`ctx.charged`) — pas ceux conférés par la Taille. Pur. */
export function qualityDamageStep(w: QualityCarrier | undefined, ctx: DamageStepCtx, extra: string[] = []): DamageStep {
  // Épuisante : hors Charge, Percutante/Dévastatrice portées par l'ARME sont inertes (LDB 63 l.16-17).
  const tiring = resolveQualities(w).some((r) => r.def.chargeGatedDamageAtouts) && !ctx.charged;
  const defs = tiring
    ? resolveQualities(w).filter((r) => r.def.dmgDRMode !== 'maxUnits' && !r.def.damageBonusUnits)
    : resolveQualities(w);
  for (const raw of extra) {
    const p = parseQuality(raw);
    if (p) defs.push({ def: QUALITIES[p.key], indice: p.indice });
  }
  if (defs.some((r) => r.def.negatesDamageAtouts)) return { dmgDR: ctx.effDR, bonus: 0 };
  const dmgDR = defs.some((r) => r.def.dmgDRMode === 'maxUnits') ? Math.max(ctx.effDR, ctx.units) : ctx.effDR;
  const bonus = defs.some((r) => r.def.damageBonusUnits) ? ctx.units : 0;
  return { dmgDR, bonus };
}
