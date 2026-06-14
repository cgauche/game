/**
 * Armes INVOQUÉES temporaires (op `conjureWeapon` — Arme aethyrique LDB 47, Faux de Shyish / Épée
 * ardente de Rhuin LDB 48). Une arme invoquée est un `ItemInstance` ORDINAIRE marqué `conjured`,
 * posé en inventaire et injecté en tête de `c.weapons` par `recomputeLoadout` (via le même `toWeapon`
 * que les armes tenues — aucune arme synthétique). Elle est retirée à l'expiration du Sort. Le SYSTÈME
 * réutilise donc entièrement la base d'armes (`itemFromTrapping`) et le loadout : seuls les Dégâts
 * (= BFM…) et l'Atout Magique sont surchargés par le Sort.
 */
import { Combatant, ItemInstance } from './types';
import { recomputeLoadout, itemFromTrapping, ensureDefaultLoadout, newLoadoutId } from './items';
import { trappings } from '../data';

type ConjuredSet = NonNullable<NonNullable<Combatant['activeEffects']>[number]['conjuredSet']>;

/** Pose l'objet invoqué dans un SET d'armes DÉDIÉ (« Arme invoquée ») et l'active — l'arme devient
 *  l'arme du set actif, convertie par `recomputeLoadout` comme toute arme tenue (zéro injection
 *  parallèle). Garantit d'abord les sets réels (Set I/II) pour une restauration propre. Mute `c`. */
export function equipConjuredWeapon(c: Combatant, item: ItemInstance): ConjuredSet {
  c.items = c.items ?? [];
  c.items.push(item);
  ensureDefaultLoadout(c); // sets réels présents → restoreLoadoutId pointe un vrai set
  const restoreLoadoutId = c.activeLoadoutId;
  const loadoutId = newLoadoutId();
  c.loadouts = [...(c.loadouts ?? []), { id: loadoutId, name: 'Arme invoquée', main: item.uid }];
  c.activeLoadoutId = loadoutId;
  recomputeLoadout(c);
  return { itemUid: item.uid, loadoutId, ...(restoreLoadoutId ? { restoreLoadoutId } : {}) };
}

/** À l'expiration : retire l'objet invoqué ET son set, et réactive le set d'origine (ou le 1ᵉʳ
 *  restant). Recompose le loadout. Pur ; mute `c`. */
export function dropExpiredConjuredWeapons(c: Combatant, expired: { conjuredSet?: ConjuredSet }[]): void {
  const sets = expired.map((e) => e.conjuredSet).filter((s): s is ConjuredSet => !!s);
  if (!sets.length) return;
  for (const s of sets) {
    c.items = (c.items ?? []).filter((it) => it.uid !== s.itemUid);
    c.loadouts = (c.loadouts ?? []).filter((lo) => lo.id !== s.loadoutId);
    if (c.activeLoadoutId === s.loadoutId) c.activeLoadoutId = s.restoreLoadoutId ?? c.loadouts?.[0]?.id;
  }
  recomputeLoadout(c);
}

/** FORME d'arme invoquée à forme libre (Arme aethyrique : « n'importe quelle forme, n'importe quelle
 *  Compétence de Corps à corps que vous possédez », LDB 47). `weapon` = arme RÉELLE de la base dont on
 *  clone le profil (Groupe/allonge/mains) ; `group` = sa Spécialisation de Corps à corps. */
export interface ConjureForm {
  weapon: string; // libellé d'une arme réelle (trapping) — son profil est cloné
  group: string; // Groupe / Spé de Corps à corps appliquée par combatValue
}

/** Une arme de mêlée est-elle un objet À INVOQUER ? Exclut les boucliers, armes improvisées, mains
 *  nues et armes Inoffensives — PAS « Arme simple » (= épée/hache/marteau/masse/lance courte, l'arme
 *  de base la plus commune, cf. sa description). */
function isConjurableWeapon(it: { name: string; qualities?: string[] }): boolean {
  if (/bouclier|improvis|mains nues/i.test(it.name)) return false;
  if (it.qualities?.some((q) => /inoffensiv/i.test(q))) return false;
  return true;
}

/** Formes proposées au lanceur : « n'importe quelle Compétence de Corps à corps que vous POSSÉDEZ »
 *  (LDB 47) → TOUTES les armes réelles des Spécialisations de Corps à corps connues (le lanceur
 *  CHOISIT son arme), les Spé les mieux entraînées d'abord. Aucune Spé → l'arme de base par défaut. */
export function conjureFormOptions(caster: Pick<Combatant, 'skills'>): ConjureForm[] {
  const groupAdv = new Map<string, number>(); // groupe (minuscule) → meilleures avances connues
  for (const s of caster.skills ?? []) {
    if (/corps à corps/i.test(s.name) && s.spec) {
      const g = s.spec.trim().toLowerCase();
      groupAdv.set(g, Math.max(groupAdv.get(g) ?? 0, s.advances ?? 0));
    }
  }
  if (!groupAdv.size) groupAdv.set('base', 0); // mage sans Spé → armes de base
  const out: { weapon: string; group: string; adv: number }[] = [];
  for (const t of trappings) {
    const it = itemFromTrapping(t.label);
    if (it?.kind !== 'melee' || !it.subType || !isConjurableWeapon(it)) continue;
    const adv = groupAdv.get(it.subType.toLowerCase());
    if (adv == null) continue;
    out.push({ weapon: t.label, group: it.subType, adv });
  }
  out.sort((a, b) => b.adv - a.adv); // meilleure Spé d'abord (l'ordre des armes dans la base sinon)
  const forms = out.map(({ weapon, group }) => ({ weapon, group }));
  return forms.length ? forms : [{ weapon: 'Arme simple', group: 'Base' }];
}
