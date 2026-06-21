/**
 * Ignorance de PA — mécanisme GÉNÉRAL et réutilisable (armes enchantées en mêlée, Projectiles
 * magiques, attributs de Domaine, qualités…). Un même descripteur `ArmourBypass` exprime tous les
 * cas RAW : ignorer N points, tout, seulement le métal (Chamon/Azyr), seulement le cuir (Ghur),
 * ou tout le non-magique (Ulgu). `bypassedAP` calcule combien de PA sont ignorés à une Localisation.
 *
 * Point de lecture unique : `engine/combat` (mêlée, `woundsFromHit`), `engine/magic` (Projectile,
 * via `domainMissileMods`) et tout futur consommateur appellent `bypassedAP` — pas de logique d'AP
 * dupliquée ailleurs.
 */
import type { Combatant, HitLocation, ArmourBypass, ItemInstance } from './types';
import { findWeaponGroupById } from '../data';
export type { ArmourBypass };

/** PA effectifs d'une pièce d'armure portée (usure déduite). */
const piecePA = (i: NonNullable<Combatant['items']>[number]): number => Math.max(0, (i.pa ?? 0) - (i.damageTaken ?? 0));

/** Matériau TYPÉ d'une pièce d'armure, dérivé de son Groupe (`subType` → `WeaponGroupData.material`) —
 *  SOURCE UNIQUE, plus de devinette par regex sur le nom. `undefined` = armure naturelle/synthétique. */
export function armourMaterialOf(item: ItemInstance): 'metal' | 'leather' | undefined {
  return findWeaponGroupById(item.subType)?.material;
}

/** Somme des PA des pièces portées à `loc` du `material` typé donné. */
function materialAPAt(c: Combatant, loc: HitLocation, material: 'metal' | 'leather'): number {
  return (c.items ?? [])
    .filter((i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && armourMaterialOf(i) === material)
    .reduce((s, i) => s + piecePA(i), 0);
}

/** PA des armures MÉTALLIQUES portées à `loc`. */
export const metalAPAt = (c: Combatant, loc: HitLocation): number => materialAPAt(c, loc, 'metal');

/** PA des armures de CUIR portées à `loc`. */
export const leatherAPAt = (c: Combatant, loc: HitLocation): number => materialAPAt(c, loc, 'leather');

/** PA MAGIQUES (effets actifs `apAll` — Armure Aethyrique) : seuls épargnés par Ulgu. */
export const magicAPOf = (c: Combatant): number => (c.activeEffects ?? []).reduce((s, e) => s + (e.apAll ?? 0), 0);

/** Points de PA IGNORÉS par `bypass` à la Localisation `loc`, bornés à `totalAP` (jamais négatif). */
export function bypassedAP(target: Combatant, loc: HitLocation, bypass: ArmourBypass | undefined, totalAP: number): number {
  if (!bypass || totalAP <= 0) return 0;
  if (bypass === 'all') return totalAP;
  if (typeof bypass === 'number') return Math.min(totalAP, Math.max(0, bypass));
  if (bypass === 'metal') return Math.min(totalAP, metalAPAt(target, loc));
  if (bypass === 'leather') return Math.min(totalAP, leatherAPAt(target, loc));
  if (bypass === 'nonMagic') return Math.max(0, totalAP - magicAPOf(target));
  return 0;
}
