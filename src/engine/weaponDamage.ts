/**
 * Dégâts d'arme — Livre de base, « Les armes » (62-Les armes.md l.177-180). Chaque point de Dégât
 * reçu réduit les Dégâts de l'arme de 1 ; à +0 (ou BF +0) l'arme est improvisée. L'Atout Incassable
 * (l.310) exempte de tout dégât/corrosion/destruction. Réparation = hors combat (Jalon 5).
 */
import { Weapon, WeaponEnchant, ArmourBypass } from './types';
import type { TriggeredEffect } from '../state/flow';
import { isUnbreakable, qualityIndice } from './qualities/dispatch';
import { QUALITY_IDS } from './qualities/ids';
import { norm } from '../lib/normalize';

/** L'arme matche-t-elle la FAMILLE requise par un enchantement (mot-clé sur nom/sous-type — « épée »,
 *  « hache », « lance ») ? Pas de famille requise → toujours vrai. Sert à CHOISIR l'arme tenue à
 *  enchanter au lancement (Épée de justice ne lie qu'une épée, etc.). */
export function weaponMatchesFamily(w: { name: string; subType?: string } | undefined, requires?: string): boolean {
  if (!requires) return true;
  if (!w) return false;
  return norm(`${w.name} ${w.subType ?? ''}`).includes(norm(requires));
}

/** Composante fixe (signée) des Dégâts, hors BF. Ex. '+BF+4' → 4, '+9' → 9, '+BF-2' → -2. */
function flatDamage(damage: string): number {
  const rest = (damage ?? '').replace(/BF/gi, '');
  return (rest.match(/[+-]?\d+/g) ?? []).reduce((s, n) => s + parseInt(n, 10), 0);
}

/** Dégâts d'arme encaissés EFFECTIFS (pour la pénalité) : l'Atout Solide(N) absorbe les N premiers
 *  Points de Dégâts sans pénalité (LDB 60 l.64). */
function effectiveDamageTaken(w: Weapon): number {
  return Math.max(0, (w.damageTaken ?? 0) - (qualityIndice(w, QUALITY_IDS.Solide) ?? 0));
}

/** Dégâts d'arme effectifs après réduction par `damageTaken` (la composante fixe positive est
 *  réduite, plancher 0 → BF+0 improvisée ; une composante négative — mains nues — est préservée). */
export function effectiveWeaponDamage(w: Weapon, strengthBonus: number): number {
  const usesBF = /BF/i.test(w.damage ?? '');
  const flat = flatDamage(w.damage ?? '');
  const dt = effectiveDamageTaken(w); // Solide(N) absorbe les N premiers points (LDB 60 l.64)
  const reduced = flat >= 0 ? Math.max(0, flat - dt) : flat;
  return Math.max(0, (usesBF ? strengthBonus : 0) + reduced);
}

/**
 * Replie les ENCHANTEMENTS d'une arme (op `augmentWeapon` / arme invoquée) dans son profil de combat :
 * Atouts ajoutés (Magique → `isMagicWeapon` → touche l'Éthéré ; Percutante…), bonus de Dégâts (sommé
 * par `flatDamage`), ignorance de PA, et effets « à la touche » (→ `w.onHitEffects`, lus par
 * `effectsOf`). Appelé par `recomputeLoadout` → l'arme dérivée `c.weapons` est DÉJÀ enchantée, donc
 * visible partout (récap, popover, preview) ET appliquée à la résolution. Sans enchant : arme inchangée.
 */
export function applyEnchants(w: Weapon, enchants: WeaponEnchant[]): Weapon {
  if (!enchants.length) return w;
  const out: Weapon = { ...w, qualities: [...(w.qualities ?? [])] };
  let dmgPlus = 0;
  const onHit: TriggeredEffect[] = [...(w.onHitEffects ?? [])];
  for (const e of enchants) {
    for (const q of e.addQualities ?? []) if (!out.qualities.includes(q)) out.qualities.push(q);
    dmgPlus += e.damageBonus ?? 0;
    if (e.onHitEffects?.length) onHit.push(...e.onHitEffects);
  }
  if (dmgPlus > 0) out.damage = `${out.damage ?? '+BF'}+${dmgPlus}`;
  const bypasses = enchants.map((e) => e.bypass).filter((b): b is ArmourBypass => b != null);
  if (bypasses.length) out.bypass = bypasses.includes('all') ? 'all' : bypasses[bypasses.length - 1]; // 'all' prime
  if (onHit.length) out.onHitEffects = onHit;
  return out;
}

/** L'arme est-elle réduite à l'état improvisé (bonus de Dégâts à +0 par usure) ? */
export function isImprovised(w: Weapon): boolean {
  const flat = flatDamage(w.damage ?? '');
  return flat >= 0 && flat - effectiveDamageTaken(w) <= 0;
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

/** Seuil de Sauvegarde (1d10 ≥ seuil ⇒ l'arme résiste) contre une cassure instantanée pour une arme
 *  Solide(N) : 9+ pour N=1, amélioré de 1 par Indice (8+ pour N=2…), LDB 60 l.64-67. null si non Solide. */
export function solideSaveThreshold(w: Weapon): number | null {
  const n = qualityIndice(w, QUALITY_IDS.Solide);
  return n && n > 0 ? Math.max(2, 10 - n) : null;
}
