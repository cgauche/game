/**
 * Dérivation PURE « traits → équipement » (armes jouables + armure en PA) d'une créature/statbloc.
 * SOURCE UNIQUE, partagée par le SPAWN de combat (`state/spawn`) ET le RENDU d'exploration (`gameIso`).
 * Vit dans `engine` (pur, ne dépend de rien d'en haut) → importable par le rendu SANS cycle de couches
 * (`state/spawn` importe déjà `gameIso`, donc `gameIso` ne peut pas importer `state/spawn`). Avant, ces
 * fonctions vivaient dans `state/spawn` → inaccessibles au rendu → l'exploration n'affichait pas l'équipement.
 */
import type { Weapon, ArmourPoints } from './types';
import type { TraitInstance, TraitList } from './statEntry';
import { buildWeapon, emptyArmour } from './items';
import type { WeaponDamageSpec } from './types';
import { resolveTraits, traitLabelById } from './traits/dispatch';
import { findTraitById } from '../data/index';

/**
 * Parse UN trait d'arme WFRP4 (français) en arme jouable, ou null. Gère le TYPE
 * entre parenthèses (l'armement des monstres est dans les Traits) :
 *   « Arme +7 », « Arme (Épée) +7 », « Arme (Dague) +4 », « Arme (griffes) »,
 *   « À distance (Arbalète) +9 (60) », « À distance +8 (50) », « Morsure +9 ».
 * Le `name` = le TYPE quand il est manufacturé (→ le rig tient cette arme) ; sinon
 * une étiquette naturelle (→ weaponFamily renvoie '' = aucune arme dessinée).
 */
export function weaponFromTrait(t: TraitInstance): Weapon | null {
  // Indice de créature = SB déjà inclus → PAS de token BF (« +N », « -N » négatif) ; à défaut d'Indice,
  // arme générique « +BF » nu (SB-relatif). Le constructeur d'arme UNIQUE porte les deux conventions.
  const dmg: WeaponDamageSpec = t.value != null ? { plusBF: false, flat: t.value } : { plusBF: true, flat: 0, bare: true };
  if (t.id === 'a-distance') {
    if (t.value == null) return null; // « À distance » sans Indice de Dégâts : pas une arme jouable (RAW)
    return buildWeapon({ name: t.arg || 'Attaque à distance', type: 'ranged', damage: dmg, range: t.range ?? undefined });
  }
  if (t.id === 'arme') return buildWeapon({ name: t.arg ?? 'Arme', damage: dmg }); // mêlée par défaut
  // Attaque naturelle (Morsure, Cornes, Tentacules…) : reconnue par la CAPACITÉ TYPÉE du trait
  // (`capabilities.naturalWeapon`, donnée), plus par découpe du libellé au runtime. L'arme reste UNE
  // (l'Action d'attaque) ; le compte joue sur les Attaques GRATUITES (aiCreatureFreeAttacks, LDB 85 l.354).
  const nat = findTraitById(t.id)?.capabilities?.naturalWeapon;
  if (nat) return buildWeapon({ name: traitLabelById(t.id), type: nat.ranged ? 'ranged' : 'melee', damage: dmg });
  return null;
}

/** Armes EXPLICITES d'une créature (traits « Arme »/« À distance »/naturelles), SANS arme générique de
 *  repli. Pour le RENDU : une créature sans trait d'arme reste mains libres (un villageois ne tient rien) —
 *  le repli « Arme +BF » générique de `weaponsFromTraits` serait dessiné comme une épée (cf. weaponFamily). */
export function renderWeaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons: Weapon[] = [];
  for (const t of traits) {
    const w = weaponFromTrait(t);
    if (w) weapons.push(w);
  }
  return weapons;
}

/** Armes JOUABLES (combat) : comme `renderWeaponsFromTraits`, mais garantit AU MOINS une arme (« Arme »
 *  générique = poings) pour qu'un combattant puisse toujours frapper, même sans trait d'arme. */
export function weaponsFromTraits(traits: TraitList): Weapon[] {
  const weapons = renderWeaponsFromTraits(traits);
  if (weapons.length === 0) weapons.push(buildWeapon({ name: 'Arme', damage: { literal: '+BF' } })); // uid universel
  return weapons;
}

/** PA plats du trait « Armure (Indice) » (LDB 85, profils d'éditeur) — lus par le REGISTRE des
 *  Traits (Indice ou argument), plus de regex propre. 0 si absent. */
export function armourFromTraits(traits: TraitList): ArmourPoints {
  const r = resolveTraits(traits).find((x) => x.def.key === 'Armure');
  const n = r ? Number(r.indice ?? r.arg ?? 0) : 0;
  return emptyArmour(Number.isFinite(n) ? n : 0);
}
