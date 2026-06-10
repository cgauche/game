/**
 * Système d'objets / équipement. Les objets portent les stats des `trappings`
 * (Dégâts, PA, qualités, encombrement). Les armes/armures ACTIVES en combat
 * (`Combatant.weapons` / `armour`) sont DÉRIVÉES de l'équipement via
 * recomputeLoadout : équiper une hache ou une armure change donc le combat.
 */
import { Combatant, ItemInstance, ItemKind, HitLocation, ArmourPoints, Weapon, WeaponLoadout } from './types';
import { bonus } from './characteristics';
import { cannotWieldTwoHanded, handAmputated } from './trauma';
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
  const twoHandMark = /\(2m\)/i.test(t.prefix ?? '') || /\(2m\)/i.test(t.label); // marqueur « (2M) » = 2 mains
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
    hands: kind === 'melee' || kind === 'ranged' ? (twoHandMark ? 2 : 1) : undefined, // marqueur (2M), uniforme
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

/** Latéralité d'une arme. La donnée canonique marque le 2-mains par le préfixe `(2M)` — UNIFORME mêlée ET
 *  distance (Arc/Arbalète/Arquebuse/Tromblon = (2M) ; Arbalète de poing/Pistolet/Fronde = 1 main).
 *  itemFromTrapping pose `hands` depuis ce marqueur → il fait foi ici. Fallback (objets legacy sans `hands`) :
 *  marqueur `(2M)` dans le nom, ou Groupe « Deux-mains ». */
export function weaponHands(it: { hands?: 1 | 2; name: string; subType?: string }): 1 | 2 {
  if (it.hands === 1 || it.hands === 2) return it.hands;
  if (/\(2m\)/i.test(it.name) || (it.subType ?? '').toLowerCase() === 'deux-mains') return 2;
  return 1;
}

/** Arme exigeant DEUX mains (LDB 62). Pistolets/arquebuses (Poudre noire/Ingénierie) : 1 main par défaut. */
export function isTwoHandedWeapon(it: ItemInstance): boolean {
  return weaponHands(it) === 2;
}

let _unarmed: Weapon | null = null;
/** Arme « Mains nues » canonique, DÉRIVÉE du trapping (LDB 62 l.75 : +BF+0, Personnelle, Inoffensive) —
 *  plus de valeur codée en dur. Lazy + mémoïsé (data chargée au 1ᵉʳ appel). Copie fraîche à chaque appel. */
export function unarmedWeapon(): Weapon {
  if (!_unarmed) {
    const it = itemFromTrapping('Mains nues');
    _unarmed = it
      ? { name: it.name, type: 'melee', damage: it.damage ?? '+BF+0', reach: it.reach, qualities: it.qualities, subType: it.subType, hands: 1 }
      : { name: 'Mains nues', type: 'melee', damage: '+BF+0', reach: 'Personnelle', qualities: ['Inoffensive'], subType: 'Bagarre', hands: 1 };
  }
  return { ..._unarmed, hand: 'main' };
}

/** Loadout actif d'un combattant, ou null si aucun (chemin legacy = toutes armes équipées). */
export function activeLoadout(c: Combatant): WeaponLoadout | null {
  if (!c.loadouts?.length) return null;
  return c.loadouts.find((l) => l.id === c.activeLoadoutId) ?? c.loadouts[0];
}

/** Une arme (par `uid` d'ItemInstance) est-elle ACTIVE dans le loadout courant ? Source de vérité = les
 *  armes DÉRIVÉES `c.weapons` (elles gèrent déjà contrainte 2 mains, amputation, destruction). Remplace la
 *  lecture de `it.equipped` pour les ARMES : « équipé » d'une arme = « tenue dans le set actif ». */
export function isWeaponActive(c: Combatant, uid?: string): boolean {
  return uid != null && (c.weapons ?? []).some((w) => w.uid === uid);
}

/** Recalcule armes/armure actives + encombrement. Les ARMES viennent du loadout actif (contrainte 2 mains,
 *  tag `hand`) ; sans loadout = comportement historique (toutes armes équipées, `hand:'main'`). */
export function recomputeLoadout(c: Combatant): void {
  const items = c.items ?? [];
  // Auto-prune : un slot référençant une arme qui a quitté l'inventaire (vente/transfert/perte) OU qui est
  // DÉTRUITE (Incident de Tir / usure, LDB 14/62) est vidé, sur TOUS les loadouts — évite les références
  // orphelines (et nettoie le slot d'une arme cassée, plus rééquipable telle quelle).
  const slotDead = (uid?: string) => uid != null && !items.some((i) => i.uid === uid && !i.destroyed);
  for (const lo of c.loadouts ?? []) {
    if (slotDead(lo.main)) lo.main = undefined;
    if (slotDead(lo.off)) lo.off = undefined;
  }
  const toWeapon = (it: ItemInstance, hand: 'main' | 'off'): Weapon | null => {
    if (it.destroyed) return null; // arme détruite : inutilisable (LDB 14 — Incident de Tir)
    const hands = weaponHands(it);
    if (hands === 2 && cannotWieldTwoHanded(c)) return null; // amputation : pas d'arme à 2 mains (LDB 18 l.352)
    const reload = indiceOf(it.qualities, 'Recharge') ?? 0;
    return { name: it.name, type: it.kind as 'melee' | 'ranged', damage: it.damage ?? '+BF', reach: it.reach,
      range: it.range, qualities: it.qualities, subType: it.subType, reload, damageTaken: it.damageTaken,
      skin: it.skin, hands, hand, uid: it.uid };
  };

  // UN SEUL modèle : tout combattant porteur d'armes passe par un loadout (auto-généré si absent — plus de
  // chemin « toutes armes équipées »). Les ennemis (armes du statbloc, posées en dur, sans items) ne passent
  // pas par ici (cf. spawn.ts), donc aucun statbloc n'est écrasé.
  if (!activeLoadout(c)) ensureDefaultLoadout(c);
  const weapons: Weapon[] = [];
  const lo = activeLoadout(c);
  if (lo) {
    // Mains amputées (LDB 18) : une main perdue ne tient rien. L'arme DIRECTRICE est conservée tant qu'il reste
    // une main (adaptation — le −20 CC/CT de l'amputation s'applique déjà via la séquelle) ; l'objet de main
    // SECONDAIRE (bouclier / 2e arme) tombe dès qu'une main manque (la main restante tient l'arme directrice).
    // Les DEUX mains perdues → Mains nues.
    const mainLost = handAmputated(c, 'main');
    const offLost = handAmputated(c, 'off');
    const mainIt = !(mainLost && offLost) && lo.main ? items.find((i) => i.uid === lo.main && (i.kind === 'melee' || i.kind === 'ranged')) : undefined;
    const mainW = mainIt ? toWeapon(mainIt, 'main') : null;
    if (mainW) weapons.push(mainW);
    const mainTwoHanded = mainW?.hands === 2;
    if (!mainTwoHanded && !mainLost && !offLost && lo.off) {
      const offIt = items.find((i) => i.uid === lo.off && (i.kind === 'melee' || i.kind === 'ranged'));
      const offW = offIt ? toWeapon(offIt, 'off') : null;
      if (offW) weapons.push(offW);
    }
    // Pas de resync `it.equipped` sur les ARMES : « équipé » d'une arme = « tenue dans ce set actif », ce que
    // `c.weapons` (dérivé ici) exprime déjà → les lecteurs passent par `isWeaponActive`. `it.equipped` ne sert
    // plus que pour l'armure (port) et de seed du loadout par défaut (ensureDefaultLoadout).
  }

  // Crochet PORTÉ (prothèse, LDB 73) : « en Combat rapproché, considéré comme une Dague ». Arme dérivée.
  if (items.some((i) => i.equipped && i.name === 'Crochet')) {
    weapons.push({ name: 'Crochet', type: 'melee', damage: '+BF+2', reach: 'Très courte', qualities: [], subType: 'Base', hands: 1, hand: 'main' });
  }
  // Mains nues toujours disponibles en dernier recours (stats canoniques du trapping, LDB 62 l.75).
  weapons.push(unarmedWeapon());

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

let loadoutCounter = 0;
/** Génère les loadouts par défaut d'un héros qui n'en a pas : « Mêlée » (meilleure arme de mêlée + bouclier/
 *  2e arme à 1 main en secondaire) et « Distance » (1re arme à distance) si présentes. Idempotent. */
export function ensureDefaultLoadout(c: Combatant): void {
  if (c.loadouts?.length) return;
  const items = (c.items ?? []).filter((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged'));
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');
  const loadouts: WeaponLoadout[] = [];

  if (melee.length) {
    const main = [...melee].sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0];
    let off: ItemInstance | undefined;
    if (weaponHands(main) === 1) off = melee.find((i) => i.uid !== main.uid && weaponHands(i) === 1);
    loadouts.push({ id: `lo-${++loadoutCounter}`, name: 'Mêlée', main: main.uid, off: off?.uid });
  }
  if (ranged.length) {
    loadouts.push({ id: `lo-${++loadoutCounter}`, name: 'Distance', main: ranged[0].uid });
  }
  if (!loadouts.length) return; // aucune arme équipée : pas de loadout (Mains nues suffisent via recompute)
  c.loadouts = loadouts;
  c.activeLoadoutId = loadouts[0].id;
}

/** Id de loadout unique (réutilise le compteur d'ensureDefaultLoadout). */
export function newLoadoutId(): string {
  return `lo-${++loadoutCounter}`;
}

/** Crée un loadout vide nommé, le rend actif, et renvoie son id. */
export function loadoutCreate(c: Combatant, name: string): string {
  const id = newLoadoutId();
  c.loadouts = [...(c.loadouts ?? []), { id, name }];
  c.activeLoadoutId = id;
  return id;
}

export function loadoutRename(c: Combatant, id: string, name: string): void {
  const lo = c.loadouts?.find((l) => l.id === id);
  if (lo) lo.name = name;
}

/** Supprime un loadout ; si c'était l'actif, bascule sur le 1ᵉʳ restant (ou undefined). */
export function loadoutDelete(c: Combatant, id: string): void {
  c.loadouts = (c.loadouts ?? []).filter((l) => l.id !== id);
  if (c.activeLoadoutId === id) c.activeLoadoutId = c.loadouts[0]?.id;
}

export function loadoutSetActive(c: Combatant, id: string): void {
  if (c.loadouts?.some((l) => l.id === id)) c.activeLoadoutId = id;
}

/** Assigne (ou retire si `uid` null) une arme à un slot. Une arme à 2 mains en `main` vide le slot `off`. */
export function loadoutSetSlot(c: Combatant, id: string, slot: 'main' | 'off', uid: string | null): void {
  const lo = c.loadouts?.find((l) => l.id === id);
  if (!lo) return;
  lo[slot] = uid ?? undefined;
  if (slot === 'main' && uid) {
    const it = (c.items ?? []).find((i) => i.uid === uid);
    if (it && weaponHands(it) === 2) lo.off = undefined; // 2 mains → pas de secondaire
  }
}

/**
 * Ajoute l'objet `label` à l'inventaire PERSONNEL d'un héros et re-dérive son équipement actif. Retourne
 * un NOUVEAU combattant (cloné). SOURCE UNIQUE du « donner un objet à un héros » : utilisée par l'achat
 * marchand (`buyItem`) ET l'assignation de butin de victoire — pas de logique dupliquée. Objet inconnu → inchangé.
 */
export function addItemToHero(hero: Combatant, label: string): Combatant {
  const it = itemFromTrapping(label);
  if (!it) return hero;
  const clone: Combatant = JSON.parse(JSON.stringify(hero));
  clone.items = [...(clone.items ?? []), it];
  recomputeLoadout(clone);
  return clone;
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
