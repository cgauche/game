/**
 * Dégâts d'arme — Livre de base, « Les armes » (62-Les armes.md l.177-180). Chaque point de Dégât
 * reçu réduit les Dégâts de l'arme de 1 ; à +0 (ou BF +0) l'arme est improvisée. L'Atout Incassable
 * (l.310) exempte de tout dégât/corrosion/destruction. Réparation = hors combat (Jalon 5).
 */
import { Weapon, WeaponEnchant, ArmourBypass, WeaponRangeSpec, AmmoRangeMod } from './types';
import type { TriggeredEffect } from './flowCore';
import { isUnbreakable, qualityIndice } from './qualities/dispatch';
import { QUALITY_IDS } from './qualities/ids';
import { reachRank } from './engagement';
import { norm } from '../lib/normalize';

/** L'arme matche-t-elle la FAMILLE requise par un enchantement (mot-clé sur nom/sous-type — « épée »,
 *  « hache », « lance ») ? Pas de famille requise → toujours vrai. Sert à CHOISIR l'arme tenue à
 *  enchanter au lancement (Épée de justice ne lie qu'une épée, etc.). */
export function weaponMatchesFamily(w: { name: string; subType?: string } | undefined, requires?: string): boolean {
  if (!requires) return true;
  if (!w) return false;
  return norm(`${w.name} ${w.subType ?? ''}`).includes(norm(requires));
}

/** Dégâts d'arme encaissés EFFECTIFS (pour la pénalité) : l'Atout Solide(N) absorbe les N premiers
 *  Points de Dégâts sans pénalité (LDB 60 l.64). */
function effectiveDamageTaken(w: Weapon): number {
  return Math.max(0, (w.damageTaken ?? 0) - (qualityIndice(w, QUALITY_IDS.Solide) ?? 0));
}

/** Dégâts d'arme effectifs après réduction par `damageTaken` (la composante fixe positive est
 *  réduite, plancher 0 → BF+0 improvisée ; une composante négative — mains nues — est préservée).
 *  Lit la donnée STRUCTURÉE (`WeaponDamageSpec`) — zéro parsing de chaîne ; « Spécial » (literal) → 0. */
export function effectiveWeaponDamage(w: Weapon, strengthBonus: number): number {
  const d = w.damage;
  const usesBF = 'plusBF' in d && d.plusBF;
  const flat = 'flat' in d ? d.flat : 0;
  const dt = effectiveDamageTaken(w); // Solide(N) absorbe les N premiers points (LDB 60 l.64)
  const reduced = flat >= 0 ? Math.max(0, flat - dt) : flat;
  return Math.max(0, (usesBF ? strengthBonus : 0) + reduced);
}

/** Portée d'arme EFFECTIVE en mètres (MIROIR de `effectiveWeaponDamage` pour les Dégâts) : résout une
 *  `WeaponRangeSpec` non résolue avec le BF du porteur. `number` (mètres fixes) → lui-même ; `{ bf }`
 *  (arme de jet) → `BF * bf` ; null/undefined (pas de Portée) → null. Appelée AUX SITES d'usage (combat :
 *  bandes de portée ; affichage : récap/Codex), jamais stockée — dynamique au BF courant. `strBonus` peut
 *  être un fournisseur PARESSEUX (`() => BF`) : il n'est évalué QUE pour une Portée `{bf}` — une Portée
 *  fixe n'exige donc PAS le BF (ni les caractéristiques) du porteur. */
export function effectiveRange(range: WeaponRangeSpec | null | undefined, strBonus: number | (() => number)): number | null {
  if (range == null) return null;
  if (typeof range === 'number') return range;
  return (typeof strBonus === 'function' ? strBonus() : strBonus) * range.bf;
}

/** Applique le modificateur de la MUNITION sélectionnée à la Portée déjà résolue de l'arme (mètres, LDB 62
 *  colonne « Portée ») : `{ mult }` → `round(rangeM * mult)` (« Moitié de l'arme » = ×0.5) ; `{ add }` →
 *  `max(0, rangeM + add)` (± mètres) ; mod absent/null OU arme sans Portée (`rangeM` null) → inchangé. */
export function applyAmmoMod(rangeM: number | null, mod: AmmoRangeMod | null | undefined): number | null {
  if (rangeM == null || mod == null) return rangeM;
  return 'mult' in mod ? Math.round(rangeM * mod.mult) : Math.max(0, rangeM + mod.add);
}

/** Portée EFFECTIVE de l'arme avec la munition sélectionnée : `applyAmmoMod(effectiveRange(weapon.range,
 *  strBonus), ammoMod)`. SOURCE UNIQUE pour les sites combat (bandes de portée) — le BF reste paresseux. */
export function effectiveWeaponRange(weapon: { range?: WeaponRangeSpec | null }, ammoMod: AmmoRangeMod | null | undefined, strBonus: number | (() => number)): number | null {
  return applyAmmoMod(effectiveRange(weapon.range, strBonus), ammoMod);
}

/** Arme de JET (javelot, couteau de lancer, bombe…) : sa Portée est une SPEC `{ bf }` (BF × N mètres,
 *  LDB 62) — par opposition à une Portée fixe en mètres (arc/arbalète/poudre). C'est le classifieur des
 *  armes lancées, seules concernées par la Dispersion d'un Test de Projectiles (Lancer) raté (LDB 14). */
export function isThrownWeapon(weapon: { type?: string; range?: WeaponRangeSpec | null }): boolean {
  return weapon.type === 'ranged' && typeof weapon.range === 'object' && weapon.range != null && 'bf' in weapon.range;
}

/**
 * Replie les ENCHANTEMENTS d'une arme (op `augmentWeapon` / arme invoquée) dans son profil de combat :
 * Atouts ajoutés (Magique → `isMagicWeapon` → touche l'Éthéré ; Percutante…), bonus de Dégâts (ajouté
 * au `flat` de la `WeaponDamageSpec`), ignorance de PA, et effets « à la touche » (→ `w.onHitEffects`, lus par
 * `effectsOf`). Appelé par `recomputeLoadout` → l'arme dérivée `c.weapons` est DÉJÀ enchantée, donc
 * visible partout (récap, popover, preview) ET appliquée à la résolution. Sans enchant : arme inchangée.
 */
export function applyEnchants(w: Weapon, enchants: WeaponEnchant[]): Weapon {
  if (!enchants.length) return w;
  const out: Weapon = { ...w, qualities: [...(w.qualities ?? [])] };
  let dmgPlus = 0;
  const onHit: TriggeredEffect[] = [...(w.onHitEffects ?? [])];
  for (const e of enchants) {
    for (const id of e.addQualities ?? []) if (!out.qualities.some((x) => x.id === id)) out.qualities.push({ id }); // addQualities = ids (valueless)
    dmgPlus += e.damageBonus ?? 0;
    if (e.onHitEffects?.length) onHit.push(...e.onHitEffects);
  }
  if (dmgPlus > 0 && 'flat' in out.damage) out.damage = { ...out.damage, flat: out.damage.flat + dmgPlus };
  const bypasses = enchants.map((e) => e.bypass).filter((b): b is ArmourBypass => b != null);
  if (bypasses.length) out.bypass = bypasses.includes('all') ? 'all' : bypasses[bypasses.length - 1]; // 'all' prime
  if (onHit.length) out.onHitEffects = onHit;
  return out;
}

/** L'arme est-elle réduite à l'état improvisé (bonus de Dégâts à +0 par usure) ? */
export function isImprovised(w: Weapon): boolean {
  if (!('flat' in w.damage)) return false; // « Spécial » (literal) : jamais improvisé
  const flat = w.damage.flat;
  return flat >= 0 && flat - effectiveDamageTaken(w) <= 0;
}

/** Profil d'**Arme improvisée** (LDB 62 l.29/178/185) : Dégâts `+BF+1`, Atout `Inoffensive`, **plus aucun
 *  autre Atout**, Allonge Moyenne. SOURCE UNIQUE — partagé par l'usure (Dégâts à +0) ET la Lance de
 *  cavalerie hors Charge (`effectiveWeapon`), pour ne pas dupliquer le littéral. */
function improvisedProfile(w: Weapon): Weapon {
  return { ...w, damage: { plusBF: true, flat: 1 }, qualities: [{ id: QUALITY_IDS.Inoffensive }], damageTaken: 0, reach: 'Moyenne' };
}

/** Lance de cavalerie (Groupe Cavalerie, nom contenant « lance ») — la règle « improvisée hors Charge »
 *  (LDB 62 l.59) ne vise QUE les lances du Groupe, pas le Marteau à bec-de-corbin ni le Sabre. Détection
 *  par la DONNÉE de combat (`subType` + nom), JAMAIS par le `WeaponDef.group` de rendu. */
function isCavalryLance(w: Weapon): boolean {
  return w.subType === 'cavalerie' && norm(w.name).includes('lance');
}

/** Contexte d'usage d'une arme — règles d'arme CONTEXTUELLES de Groupe (LDB 62), dérivé de l'attaquant
 *  au moment où l'arme est liée à l'attaque (cf. `firedWeapon`). */
export interface WeaponContext {
  /** L'attaquant a Chargé ce Round (`Combatant.chargedThisTurn`). */
  charged?: boolean;
  /** L'attaquant est monté (`Combatant.mountId`). */
  mounted?: boolean;
  /** L'attaquant possède la Spécialisation de Corps à corps du Groupe de l'arme (`hasWeaponGroupSkill`). */
  hasGroupSkill?: boolean;
  /** Combat « au contact » avec la cible (LDB 62 l.176, Option « Longueur d'arme ») : toute arme plus
   *  longue que Courte y est traitée comme une Arme improvisée. Dérivé de `areInContact(attacker, target)`. */
  auContact?: boolean;
}

/**
 * Profil de combat EFFECTIF d'une arme, contexte d'usage compris. Sans `ctx` : seule l'usure→improvisée
 * (LDB 62 l.178) s'applique — Dégâts `+BF+1`, Atout `Inoffensive`, plus aucun autre Atout ; une arme non
 * altérée est renvoyée TELLE QUELLE (même référence). Avec `ctx`, deux règles de Groupe contextuelles
 * s'ajoutent :
 *  - Lance de cavalerie utilisée hors d'un Round de Charge → **Arme improvisée** (LDB 62 l.59).
 *  - Fléau manié **sans la Spécialisation** appropriée → Défaut **Dangereuse**, et **aucun autre Atout**
 *    n'est utilisé (LDB 62 l.146-147).
 * À appliquer LÀ où l'arme se lie à l'attaque pour que la transformation atteigne la touche, les Dégâts ET
 * le jet RATÉ (la Dangereuse se déclenche sur un échec). Idempotent : ré-appliquer sur un profil déjà
 * transformé (ex. l'usure recalculée dans `applyHit`) ne le ré-altère pas.
 */
export function effectiveWeapon(w: Weapon, ctx?: WeaponContext): Weapon {
  if (isImprovised(w)) return improvisedProfile(w); // usure jusqu'à +0 (LDB 62 l.178)
  if (ctx?.charged === false && isCavalryLance(w)) return improvisedProfile(w); // Lance hors Charge (l.59)
  // Combat « au contact » (LDB 62 l.176) : « n'importe quelle arme plus longue que Courte est considérée
  // comme une Arme improvisée » (l'adversaire est entré dans la longueur d'arme). Allonge ≤ Courte
  // (mains nues / dague) → inchangée. MÊME branche que la Lance hors Charge (profil improvisé partagé).
  if (ctx?.auContact && w.type === 'melee' && reachRank(w.reach) > reachRank('Courte')) return improvisedProfile(w);
  // Fléau sans la Spécialisation : Défaut Dangereuse + AUCUN autre Atout (l.146-147). Le Test reste sur la
  // Caractéristique brute — déjà assuré par `combatValue` (pas de Spé → pas d'avances), le subType est gardé.
  if (ctx?.hasGroupSkill === false && w.subType === 'fleau') return { ...w, qualities: [{ id: QUALITY_IDS.Dangereuse }] };
  return w;
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
