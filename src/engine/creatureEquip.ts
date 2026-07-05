/**
 * Dérivation PURE « traits → équipement » (armes jouables + armure en PA) d'une créature/statbloc.
 * SOURCE UNIQUE, partagée par le SPAWN de combat (`state/spawn`) ET le RENDU d'exploration (`gameIso`).
 * Vit dans `engine` (pur, ne dépend de rien d'en haut) → importable par le rendu SANS cycle de couches
 * (`state/spawn` importe déjà `gameIso`, donc `gameIso` ne peut pas importer `state/spawn`).
 */
import type { Weapon, ArmourPoints } from './types';
import type { TraitInstance, TraitList } from './statEntry';
import { buildWeapon, emptyArmour } from './items';
import type { WeaponDamageSpec } from './types';
import { findResolvedTrait, traitLabelById } from './traits/dispatch';
import { findTraitById, findTrappingById, qualityInstance, SPEC_SOURCES, type TrappingData } from '../data/index';
import { QUALITY_IDS } from './qualities/ids';
import { qualityIndice } from './qualities/dispatch';

/**
 * Résout l'`arg` d'un trait `arme`/`a-distance` (`specsSource` `weaponsMelee`/`weaponsRanged`, cf.
 * `data/index.ts`) vers son TRAPPING de catalogue — l'`arg` porte alors un `id` STABLE (validité :
 * `SPEC_SOURCES[source].resolves`), plus un libellé. `undefined` pour un `arg` NATUREL/libre/absent
 * (« Griffes », « Crocs »…) : ces traits sont `specsOpen` (RAW : attaques naturelles ou génériques
 * acceptées hors catalogue) — le rendu retombe alors sur le comportement générique/naturel.
 */
function catalogWeapon(arg: string | undefined, source: 'weaponsMelee' | 'weaponsRanged'): TrappingData | undefined {
  return arg && SPEC_SOURCES[source].resolves(arg) ? findTrappingById(arg) : undefined;
}

/**
 * Construit l'arme JOUABLE d'un trait dont l'`arg` a résolu à une arme du CATALOGUE : HÉRITE forme
 * (`shape`)/qualités/sous-type du trapping (comme les armes de héros, cf. loadout builder d'`items.ts`
 * `recomputeLoadout`) — Dégâts (`dmg`, Indice de créature) et Portée restent ceux du trait (surcharge
 * créature), `range` absent retombe sur celle du trapping. `reload` DÉRIVE de la Qualité Recharge
 * (LDB 62 l.333) — l'armement de créature étant en Traits, sans qualité portée, une arbalète/arquebuse
 * de bestiaire n'aurait sinon aucun défaut Recharge.
 */
function weaponFromTrapping(trapping: TrappingData, type: 'melee' | 'ranged', dmg: WeaponDamageSpec, range: number | undefined): Weapon {
  return buildWeapon({
    name: trapping.label,
    type,
    damage: dmg,
    range: range ?? (typeof trapping.range === 'number' ? trapping.range : undefined),
    reload: qualityIndice(trapping, QUALITY_IDS.Recharge) ?? 0,
    shape: trapping.shape,
    subType: trapping.subType ?? undefined,
    qualities: (trapping.qualities ?? []).map(qualityInstance),
  });
}

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
    const trapping = catalogWeapon(t.arg, 'weaponsRanged');
    if (trapping) return weaponFromTrapping(trapping, 'ranged', dmg, t.range);
    // Arme naturelle/libre (arg hors catalogue, ou absent) : pas de shape (le rendu retombe sur le Groupe).
    return buildWeapon({ name: t.arg || 'Attaque à distance', type: 'ranged', damage: dmg, range: t.range ?? undefined });
  }
  if (t.id === 'arme') {
    // Attaque naturelle de corps (flag DONNÉE `natural`) → aucune arme dessinée (pas de shape).
    if (t.natural) return buildWeapon({ name: t.arg ?? 'Arme', damage: dmg, natural: true });
    const trapping = catalogWeapon(t.arg, 'weaponsMelee');
    if (trapping) return weaponFromTrapping(trapping, 'melee', dmg, t.range);
    // Arme manufacturée hors catalogue, ou descripteur naturel non flaggé : générique, mêlée par défaut.
    return buildWeapon({ name: t.arg ?? 'Arme', damage: dmg });
  }
  // Attaque naturelle TYPÉE (Morsure, Cornes, Tentacules…) : reconnue par la CAPACITÉ du trait
  // (`capabilities.naturalWeapon`, donnée). L'arme reste UNE (l'Action d'attaque) ; le compte joue sur
  // les Attaques GRATUITES (aiCreatureFreeAttacks, LDB 85 l.354). `natural` → aucune arme tenue dessinée.
  // `attackKind = t.id` (l'id du trait EST le kind : morsure/cornes/tentacules) → la pose/anim route par
  // ce champ STABLE (handlingClass), jamais par le libellé.
  const nat = findTraitById(t.id)?.capabilities?.naturalWeapon;
  if (nat) return buildWeapon({ name: traitLabelById(t.id), type: nat.ranged ? 'ranged' : 'melee', damage: dmg, natural: true, attackKind: t.id });
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
  const r = findResolvedTrait(traits, 'armure');
  const n = r ? Number(r.indice ?? r.arg ?? 0) : 0;
  return emptyArmour(Number.isFinite(n) ? n : 0);
}
