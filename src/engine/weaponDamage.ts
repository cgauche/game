/**
 * Dégâts d'arme — Livre de base, « Les armes » (62-Les armes.md l.177-180). Chaque point de Dégât
 * reçu réduit les Dégâts de l'arme de 1 ; à +0 (ou BF +0) l'arme est improvisée. L'Atout Incassable
 * (l.310) exempte de tout dégât/corrosion/destruction. Réparation = hors combat (Jalon 5).
 */
import { Weapon } from './types';
import { isUnbreakable } from './qualities/dispatch';

/** Composante fixe (signée) des Dégâts, hors BF. Ex. '+BF+4' → 4, '+9' → 9, '+BF-2' → -2. */
function flatDamage(damage: string): number {
  const rest = (damage ?? '').replace(/BF/gi, '');
  return (rest.match(/[+-]?\d+/g) ?? []).reduce((s, n) => s + parseInt(n, 10), 0);
}

/** Dégâts d'arme effectifs après réduction par `damageTaken` (la composante fixe positive est
 *  réduite, plancher 0 → BF+0 improvisée ; une composante négative — mains nues — est préservée). */
export function effectiveWeaponDamage(w: Weapon, strengthBonus: number): number {
  const usesBF = /BF/i.test(w.damage ?? '');
  const flat = flatDamage(w.damage ?? '');
  const dt = w.damageTaken ?? 0;
  const reduced = flat >= 0 ? Math.max(0, flat - dt) : flat;
  return Math.max(0, (usesBF ? strengthBonus : 0) + reduced);
}

/** L'arme est-elle réduite à l'état improvisé (bonus de Dégâts à +0 par usure) ? */
export function isImprovised(w: Weapon): boolean {
  const flat = flatDamage(w.damage ?? '');
  return flat >= 0 && flat - (w.damageTaken ?? 0) <= 0;
}

/**
 * Profil de combat EFFECTIF d'une arme : si elle a été usée jusqu'à +0, elle devient une **Arme
 * improvisée** (LDB 62 l.178) — Dégâts `+BF+1`, Atout `Inoffensive`, **plus aucun Atout** (Empaleuse/
 * Perforante/Pointue… perdus). Sinon l'arme est renvoyée telle quelle. À appliquer avant tout calcul
 * de touche/dégâts/critique pour que la dégradation bascule réellement le profil.
 */
export function effectiveWeapon(w: Weapon): Weapon {
  if (!isImprovised(w)) return w;
  return { ...w, damage: '+BF+1', qualities: ['Inoffensive'], damageTaken: 0, reach: 'Moyenne' };
}

/** Inflige 1 point de Dégât à l'arme (sauf Incassable). */
export function damageWeapon(w: Weapon): void {
  if (isUnbreakable(w)) return;
  w.damageTaken = (w.damageTaken ?? 0) + 1;
}

/** Détruit l'arme (sauf Incassable) — inutilisable. */
export function destroyWeapon(w: Weapon): void {
  if (isUnbreakable(w)) return;
  w.destroyed = true;
}
