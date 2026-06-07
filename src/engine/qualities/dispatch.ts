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

/** Qualités du registre présentes sur l'objet (normalisées, avec Indice). Chaînes inconnues ignorées. */
export function resolveQualities(w: QualityCarrier | undefined): ResolvedQuality[] {
  if (!w) return [];
  const out: ResolvedQuality[] = [];
  for (const raw of w.qualities) {
    const p = parseQuality(raw);
    if (p) out.push({ def: QUALITIES[p.key], indice: p.indice });
  }
  return out;
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

export interface DamageStepCtx {
  /** DR-pour-dégâts de base (déjà augmenté de Pointue). */
  effDR: number;
  /** Dé des unités du jet de toucher (LDB 62 l.279/313). */
  units: number;
}
export interface DamageStep {
  /** DR-dégâts effectif (Dévastatrice : max(DR, unités)). */
  dmgDR: number;
  /** Bonus plat de Dégâts (Percutante : + dé des unités). */
  bonus: number;
}

/** Ajustement de Dégâts dû aux qualités : Dévastatrice (DR = max(DR, dé des unités)), Percutante
 *  (+ dé des unités) ; **annulés** si une qualité Inoffensive est présente. `extra` = qualités
 *  conférées hors arme (ex. par la Taille, LDB 85 l.295). Pur. */
export function qualityDamageStep(w: QualityCarrier | undefined, ctx: DamageStepCtx, extra: string[] = []): DamageStep {
  const defs = resolveQualities(w);
  for (const raw of extra) {
    const p = parseQuality(raw);
    if (p) defs.push({ def: QUALITIES[p.key], indice: p.indice });
  }
  if (defs.some((r) => r.def.negatesDamageAtouts)) return { dmgDR: ctx.effDR, bonus: 0 };
  const dmgDR = defs.some((r) => r.def.dmgDRMode === 'maxUnits') ? Math.max(ctx.effDR, ctx.units) : ctx.effDR;
  const bonus = defs.some((r) => r.def.damageBonusUnits) ? ctx.units : 0;
  return { dmgDR, bonus };
}
