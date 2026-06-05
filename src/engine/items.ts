/**
 * Système d'objets / équipement. Les objets portent les stats des `trappings`
 * (Dégâts, PA, qualités, encombrement). Les armes/armures ACTIVES en combat
 * (`Combatant.weapons` / `armour`) sont DÉRIVÉES de l'équipement via
 * recomputeLoadout : équiper une hache ou une armure change donc le combat.
 */
import { Combatant, ItemInstance, ItemKind, HitLocation, ArmourPoints, Weapon } from './types';
import { bonus } from './characteristics';
import { findTrapping } from '../data';

let uidCounter = 0;
export function newUid(): string {
  return `it-${++uidCounter}`;
}

/** Localisations d'armure (libellés trappings → localisations d'impact). */
const ARMOUR_LOC: Record<string, HitLocation[]> = {
  Tête: ['tete'],
  Bras: ['brasG', 'brasD'],
  Mains: ['brasG', 'brasD'],
  Corps: ['corps'],
  Jambes: ['jambeG', 'jambeD'],
};

function kindOf(type: string): ItemKind {
  if (type === 'melee') return 'melee';
  if (type === 'ranged') return 'ranged';
  if (type === 'armor') return 'armor';
  if (type === 'ammunition') return 'ammo';
  return 'misc';
}

/** Construit une instance d'objet depuis un trapping (par son label). */
export function itemFromTrapping(label: string): ItemInstance | null {
  const t = findTrapping(label);
  if (!t) return null;
  const kind = kindOf(t.type);
  const locs =
    t.loc != null
      ? t.loc
          .split(',')
          .map((s) => s.trim())
          .flatMap((p) => ARMOUR_LOC[p] ?? [])
      : undefined;
  return {
    uid: newUid(),
    name: t.label,
    kind,
    damage: t.damage ?? undefined,
    reach: t.reach,
    range: kind === 'ranged' ? Number(t.reach) || null : null,
    qualities: t.qualities ?? [],
    pa: t.pa ?? undefined,
    locs: locs && locs.length ? locs : undefined,
    enc: t.enc ?? 0,
    equipped: false,
    desc: t.desc,
  };
}

/** Limite d'Encombrement = Bonus de Force + Bonus d'Endurance, +2 par niveau de Costaud
 *  (LDB ; talent Costaud : « Augmentez les Points d'Encombrement … de votre niveau × 2 »). */
export function maxEncumbrance(c: Combatant): number {
  const costaud = (c.talents ?? []).find((t) => t.name.toLowerCase() === 'costaud')?.times ?? 0;
  return bonus(c.characteristics.F) + bonus(c.characteristics.E) + costaud * 2;
}

/** Encombrement transporté. Les objets PORTÉS (armure équipée) voient leur Encombrement
 *  réduit de 1 — souvent 0 une fois portés (LDB Encombrement l.22). Les armes tenues et
 *  le matériel simplement transporté gardent leur Encombrement plein. */
export function totalEncumbrance(c: Combatant): number {
  return (c.items ?? []).reduce((s, i) => {
    const worn = !!i.equipped && i.kind === 'armor';
    return s + Math.max(0, (i.enc || 0) - (worn ? 1 : 0));
  }, 0);
}

/** Armure vide : PA uniforme `ap` sur toutes les localisations (0 par défaut). */
export function emptyArmour(ap = 0): ArmourPoints {
  return { tete: ap, brasG: ap, brasD: ap, corps: ap, jambeG: ap, jambeD: ap };
}

/** Recalcule armes/armure actives + encombrement depuis l'équipement porté. */
export function recomputeLoadout(c: Combatant): void {
  const items = c.items ?? [];
  const weapons: Weapon[] = [];
  for (const it of items) {
    if (!it.equipped) continue;
    if (it.kind === 'melee' || it.kind === 'ranged')
      weapons.push({ name: it.name, type: it.kind, damage: it.damage ?? '+BF', reach: it.reach, range: it.range, qualities: it.qualities });
  }
  // Mains nues toujours disponibles en dernier recours.
  weapons.push({ name: 'Mains nues', type: 'melee', damage: '+BF-2', reach: 'Très courte', qualities: [] });

  const armour = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs) continue;
    for (const l of it.locs) armour[l] = Math.max(armour[l], it.pa);
  }

  c.weapons = weapons;
  c.armour = armour;
  c.encumbrance = totalEncumbrance(c);
}

/** Score de dégâts approximatif (somme des nombres, ex. "+BF+4" → 4). */
function damageScore(d?: string): number {
  if (!d) return 0;
  return (d.replace(/BF/gi, '').match(/[+-]?\d+/g) ?? []).reduce((a, n) => a + parseInt(n, 10), 0);
}

/** Construit l'inventaire d'un héros depuis une liste de noms de trappings. */
export function buildInventory(trappingNames: string[]): ItemInstance[] {
  const items: ItemInstance[] = [];
  for (const raw of trappingNames) {
    const name = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const it = itemFromTrapping(name);
    if (it) items.push(it);
  }
  // Équipement par défaut : la MEILLEURE arme de mêlée + la première à distance
  // + toutes les armures. Les doublons restent dans l'inventaire (déséquipés).
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');
  if (melee.length) melee.sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0].equipped = true;
  if (ranged.length) ranged[0].equipped = true;
  for (const a of items) if (a.kind === 'armor') a.equipped = true;
  return items;
}
