/**
 * Dispatcher PUR des qualités d'objet : lit le registre (`registry.ts`) et expose des helpers
 * que combat.ts/items.ts appellent au lieu de tester des chaînes en dur. Aucune mutation.
 */
import type { Weapon } from '../types';
import { QUALITIES, QualityDef, QualityCtx } from './registry';

/** Une chaîne d'objet « Solide 3 »/« précise » correspond-elle au label `key` ? (startsWith, casse-insensible). */
const matches = (raw: string, key: string): boolean => raw.toLowerCase().startsWith(key.toLowerCase());

/** L'objet possède-t-il la qualité `key` ? (remplace l'ancien `hasQ`, parité exacte). */
export function hasQuality(w: Weapon | undefined, key: string): boolean {
  return !!w && w.qualities.some((q) => matches(q, key));
}

/** QualityDef présentes sur l'arme (résolues depuis le registre, qualités inconnues ignorées). */
export function defsOf(w: Weapon | undefined): QualityDef[] {
  if (!w) return [];
  const out: QualityDef[] = [];
  for (const def of Object.values(QUALITIES)) {
    if (w.qualities.some((q) => matches(q, def.key))) out.push(def);
  }
  return out;
}

/** Somme d'un champ numérique du registre sur les qualités présentes (0 si aucune). */
export function qualitySum(w: Weapon | undefined, field: 'attackMod' | 'armourReduction' | 'damageDR'): number {
  return defsOf(w).reduce((s, d) => s + (d[field] ?? 0), 0);
}

/** Une qualité de l'arme déclenche-t-elle un Critique pour ce jet ? (Empaleuse multiple de 10). */
export function qualityCritTriggered(w: Weapon | undefined, roll: number): boolean {
  const ctx: QualityCtx = { weapon: w, roll };
  return defsOf(w).some((d) => d.critTrigger?.(ctx) ?? false);
}

/** Ajustement de DR de la PARADE (Test opposé) : Défensive (arme du défenseur) +1, À Enroulement (arme de l'attaquant) -1. */
export function parryDRAdjust(defenderWeapon: Weapon | undefined, attackerWeapon: Weapon | undefined): number {
  const def = defsOf(defenderWeapon).reduce((s, d) => s + (d.defenderParryDR ?? 0), 0);
  const atk = defsOf(attackerWeapon).reduce((s, d) => s + (d.attackerParryDR ?? 0), 0);
  return def + atk;
}

/** L'arme peut-elle tirer au Combat rapproché (Atout Pistolet) ? */
export function canFireWhileEngaged(w: Weapon | undefined): boolean {
  return !!w && w.type === 'ranged' && defsOf(w).some((d) => d.canFireWhileEngaged);
}

/** L'objet est-il insensible aux dégâts/destruction (Incassable) ? (remplace les regex /incassable/i). */
export function isUnbreakable(w: Weapon | undefined): boolean {
  return defsOf(w).some((d) => d.unbreakable);
}
