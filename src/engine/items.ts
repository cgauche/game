/**
 * Système d'objets / équipement. Les objets portent les stats des `trappings`
 * (Dégâts, PA, qualités, encombrement). Les armes/armures ACTIVES en combat
 * (`Combatant.weapons` / `armour`) sont DÉRIVÉES de l'équipement via
 * recomputeLoadout : équiper une hache ou une armure change donc le combat.
 */
import { Combatant, ItemInstance, ItemKind, HitLocation, ArmourPoints, Weapon } from './types';
import { bonus } from './characteristics';
import { cannotWieldTwoHanded } from './trauma';
import { findTrapping } from '../data';
import { indiceOf } from './qualities/normalize';
import { craftEncDelta } from './qualities/craftEconomy';
import { hasQuality } from './qualities/dispatch';

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
  const qtyMatch = (t.prefix ?? '').match(/\((\d+)\)/); // « (12) » → 12 (taille du paquet de munitions)
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
    subType: t.subType ?? undefined,
    qty: kind === 'ammo' ? (qtyMatch ? parseInt(qtyMatch[1], 10) : 1) : undefined,
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
    const enc = (i.enc || 0) + craftEncDelta(i); // Léger -1 / Volumineux +1 (LDB 60 l.56/91)
    if (!!i.equipped && i.subType === 'Prothèses') return s; // prothèse portée = Enc 0 (LDB 73)
    const worn = !!i.equipped && i.kind === 'armor';
    // Objet porté : -1 (LDB Enc l.22) ; une armure Volumineux portée vaut Enc 1 (LDB 60 l.91).
    const eff = worn ? (hasQuality(i, 'Volumineux') ? 1 : enc - 1) : enc;
    return s + Math.max(0, eff);
  }, 0);
}

/** Armure vide : PA uniforme `ap` sur toutes les localisations (0 par défaut). */
export function emptyArmour(ap = 0): ArmourPoints {
  return { tete: ap, brasG: ap, brasD: ap, corps: ap, jambeG: ap, jambeD: ap };
}

/** Arme exigeant DEUX mains (LDB 62) : mêlée du Groupe « Deux-mains », arc (tous), arbalète SAUF « de poing ».
 *  Pistolets/arquebuses (Poudre noire/Ingénierie) partagent un subType ambigu (1 vs 2 mains) → non classés. */
export function isTwoHandedWeapon(it: ItemInstance): boolean {
  const st = (it.subType ?? '').toLowerCase();
  if (it.kind === 'melee') return st === 'deux-mains';
  if (it.kind === 'ranged') return st === 'arc' || (st === 'arbalète' && !/poing/i.test(it.name));
  return false;
}

/** Recalcule armes/armure actives + encombrement depuis l'équipement porté. */
export function recomputeLoadout(c: Combatant): void {
  const items = c.items ?? [];
  const weapons: Weapon[] = [];
  for (const it of items) {
    if (!it.equipped) continue;
    if (it.kind === 'melee' || it.kind === 'ranged') {
      if (it.destroyed) continue; // arme détruite : inutilisable (LDB 14 — Incident de Tir)
      // Amputation de main/bras (LDB 18 l.352) : pas d'arme à DEUX mains → repli mains nues. Mêlée = Groupe
      // « Deux-mains » ; distance = arcs (tous) et arbalètes (sauf « de poing »). Poudre noire/ingénierie = ambigu
      // (pistolet 1 main vs arquebuse 2 mains, même subType) → non bloqué.
      if (isTwoHandedWeapon(it) && cannotWieldTwoHanded(c)) continue;
      // Recharge (Indice) = Indice DR à cumuler par un Test étendu de Projectiles (LDB 63-Armures l.28-29).
      const reload = indiceOf(it.qualities, 'Recharge') ?? 0;
      weapons.push({ name: it.name, type: it.kind, damage: it.damage ?? '+BF', reach: it.reach, range: it.range, qualities: it.qualities, subType: it.subType, reload, damageTaken: it.damageTaken, skin: it.skin });
    }
  }
  // Crochet PORTÉ (prothèse, LDB 73) : « en Combat rapproché, considéré comme une Dague ». Arme dérivée.
  if (items.some((i) => i.equipped && i.name === 'Crochet')) {
    weapons.push({ name: 'Crochet', type: 'melee', damage: '+BF+2', reach: 'Très courte', qualities: [], subType: 'Base' });
  }
  // Mains nues toujours disponibles en dernier recours.
  weapons.push({ name: 'Mains nues', type: 'melee', damage: '+BF-2', reach: 'Très courte', qualities: [] });

  const armour = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs) continue;
    const net = Math.max(0, it.pa - (it.damageTaken ?? 0)); // PA nette des dégâts (LDB 63 l.53)
    for (const l of it.locs) armour[l] = Math.max(armour[l], net);
  }

  c.weapons = weapons;
  c.armour = armour;
  c.encumbrance = totalEncumbrance(c);
}

/** Endommage de 1 PA l'armure de `c` à la localisation `loc` (LDB 63 l.52-55). Héros : endommage la
 *  pièce la plus solide (damageTaken+1) puis re-dérive ; ennemi/figurant (armure plate du statblock,
 *  sans items) : décrément direct. RETOURNE true si une PA a été retirée. */
export function damageArmour(c: Combatant, loc: HitLocation): boolean {
  const pieces = (c.items ?? []).filter(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (pieces.length) {
    const piece = pieces.sort((a, b) => ((b.pa ?? 0) - (b.damageTaken ?? 0)) - ((a.pa ?? 0) - (a.damageTaken ?? 0)))[0];
    piece.damageTaken = (piece.damageTaken ?? 0) + 1;
    recomputeLoadout(c);
    return true;
  }
  if ((c.armour?.[loc] ?? 0) > 0) {
    c.armour[loc] = c.armour[loc] - 1; // armure plate (ennemi/figurant) : décrément direct
    return true;
  }
  return false;
}

/** Score de dégâts approximatif (somme des nombres, ex. "+BF+4" → 4). */
export function damageScore(d?: string): number {
  if (!d) return 0;
  return (d.replace(/BF/gi, '').match(/[+-]?\d+/g) ?? []).reduce((a, n) => a + parseInt(n, 10), 0);
}

/** Alias de munitions : certaines carrières listent un libellé de munition différent du trapping
 *  canonique (artefact de conversion). Ex. le Chasseur reçoit « Pierre (10) », mais la munition de
 *  Fronde s'appelle « Projectile de pierre » → sans alias, la fronde n'a pas de munition. */
const TRAPPING_ALIASES: Record<string, string> = { pierre: 'Projectile de pierre' };

/** Construit l'inventaire d'un héros depuis une liste de noms de trappings. */
export function buildInventory(trappingNames: string[]): ItemInstance[] {
  const items: ItemInstance[] = [];
  for (const raw of trappingNames) {
    const qtyM = raw.match(/\((\d+)\)\s*$/); // « Pierre (10) » → 10 munitions
    const base = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const it = itemFromTrapping(TRAPPING_ALIASES[base.toLowerCase()] ?? base);
    if (it) {
      if (it.kind === 'ammo' && qtyM) it.qty = parseInt(qtyM[1], 10); // quantité donnée par la carrière
      items.push(it);
    }
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

/** Famille de munitions canonique. Les armes à **Poudre noire** ET d'**Ingénierie** partagent les
 *  mêmes munitions (« Poudre noire et ingénierie ») — le LDB les regroupe sous « Armes à Poudre
 *  noire et d'Ingénierie » (62-Les armes l.150, l.174-175). Les autres familles (Arc/Arbalète/
 *  Fronde) correspondent à l'identique. Sans cette normalisation, une arme à feu (subType « Poudre
 *  noire ») ne trouverait jamais sa munition (subType « Poudre noire et ingénierie »). */
export function ammoFamily(subType?: string): string {
  const s = (subType ?? '').toLowerCase();
  if (s.includes('poudre noire') || s.includes('ingénierie') || s.includes('ingenierie')) return 'poudre-ingenierie';
  return s;
}

/** Munitions de l'inventaire compatibles avec une arme à distance (même famille canonique, qty>0). */
export function compatibleAmmo(c: Combatant, weapon: Weapon): ItemInstance[] {
  if (weapon.type !== 'ranged') return [];
  const fam = ammoFamily(weapon.subType);
  if (!fam) return [];
  return (c.items ?? []).filter((i) => i.kind === 'ammo' && (i.qty ?? 0) > 0 && ammoFamily(i.subType) === fam);
}

/** Arme à distance « augmentée » par la munition tirée : Dégâts combinés (concaténés —
 *  `effectiveWeaponDamage` somme les nombres) et Atouts fusionnés (ex. Empaleuse de la Flèche). */
export function weaponWithAmmo(weapon: Weapon, ammo: ItemInstance): Weapon {
  const extra = ammo.damage ?? '';
  const qualities = [...weapon.qualities];
  for (const q of ammo.qualities) if (!qualities.includes(q)) qualities.push(q);
  return { ...weapon, damage: `${weapon.damage}${extra}`, qualities };
}
