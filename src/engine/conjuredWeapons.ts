/**
 * Armes INVOQUÉES temporaires (op `conjureWeapon` — Arme aethyrique LDB 47, Faux de Shyish / Épée
 * ardente de Rhuin LDB 48). Une arme invoquée est un `ItemInstance` ORDINAIRE marqué `conjured`,
 * posé en inventaire et injecté en tête de `c.weapons` par `recomputeLoadout` (via le même `toWeapon`
 * que les armes tenues — aucune arme synthétique). Elle est retirée à l'expiration du Sort. Le SYSTÈME
 * réutilise donc entièrement la base d'armes (`itemFromTrapping`) et le loadout : seuls les Dégâts
 * (= BFM…) et l'Atout Magique sont surchargés par le Sort.
 */
import { Combatant } from './types';
import { recomputeLoadout, itemFromTrapping } from './items';
import { trappings } from '../data';

/** Retire les objets invoqués des effets expirés (par uid) et recompose le loadout — l'arme
 *  directrice redevient l'arme réellement équipée / les Mains nues. Pur ; mute `c`. */
export function dropExpiredConjuredWeapons(c: Combatant, expired: { conjuredItemUid?: string }[]): void {
  const uids = expired.map((e) => e.conjuredItemUid).filter((u): u is string => !!u);
  if (!uids.length) return;
  c.items = (c.items ?? []).filter((it) => !uids.includes(it.uid));
  recomputeLoadout(c);
}

/** FORME d'arme invoquée à forme libre (Arme aethyrique : « n'importe quelle forme, n'importe quelle
 *  Compétence de Corps à corps que vous possédez », LDB 47). `weapon` = arme RÉELLE de la base dont on
 *  clone le profil (Groupe/allonge/mains) ; `group` = sa Spécialisation de Corps à corps. */
export interface ConjureForm {
  weapon: string; // libellé d'une arme réelle (trapping) — son profil est cloné
  group: string; // Groupe / Spé de Corps à corps appliquée par combatValue
}

/** Une ARME D'ATTAQUE de mêlée RÉELLE représentative par Groupe (sous-type), tirée de la base — la
 *  1ʳᵉ rencontrée, hors boucliers / armes improvisées / Inoffensives / mains nues. Source unique des
 *  profils (allonge/mains) : zéro stat d'arme réinventée. */
function meleeWeaponByGroup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of trappings) {
    const it = itemFromTrapping(t.label);
    if (it?.kind !== 'melee' || !it.subType) continue;
    if (/bouclier|improvis|mains nues/i.test(it.name)) continue; // pas une arme à invoquer
    if (it.qualities?.some((q) => /inoffensiv/i.test(q))) continue;
    const g = it.subType.toLowerCase();
    if (!map.has(g)) map.set(g, t.label);
  }
  return map;
}

/** Formes proposées au lanceur : « n'importe quelle Compétence de Corps à corps que vous POSSÉDEZ »
 *  (LDB 47) → une arme réelle représentative par Spécialisation de Corps à corps connue, la mieux
 *  entraînée d'abord. Aucune Spé → une arme de base par défaut. */
export function conjureFormOptions(caster: Pick<Combatant, 'skills'>): ConjureForm[] {
  const byGroup = meleeWeaponByGroup();
  const seen = new Set<string>();
  const forms = (caster.skills ?? [])
    .filter((s) => /corps à corps/i.test(s.name) && s.spec)
    .sort((a, b) => (b.advances ?? 0) - (a.advances ?? 0))
    .map((s) => s.spec!.trim())
    .filter((g) => (seen.has(g.toLowerCase()) ? false : seen.add(g.toLowerCase())))
    .map((g) => ({ group: g, weapon: byGroup.get(g.toLowerCase()) }))
    .filter((f): f is ConjureForm => !!f.weapon);
  if (forms.length) return forms;
  const fallback = byGroup.get('base') ?? [...byGroup.values()][0];
  return fallback ? [{ weapon: fallback, group: 'Base' }] : [];
}
