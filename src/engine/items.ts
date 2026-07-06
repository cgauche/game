/**
 * Système d'objets / équipement. Les objets portent les stats des `trappings`
 * (Dégâts, PA, qualités, encombrement). Les armes/armures ACTIVES en combat
 * (`Combatant.weapons` / `armour`) sont DÉRIVÉES de l'équipement via
 * recomputeLoadout : équiper une hache ou une armure change donc le combat.
 */
import { Combatant, ItemInstance, ItemKind, HitLocation, ArmourPoints, Weapon, WeaponLoadout, WeaponDamageSpec, QualityInstance, type ShipPoste } from './types';
import { bonus, baseWithTraits } from './characteristics';
import { talentEncumbranceBonus } from './combatFeatures/dispatch';
import { applyEnchants } from './weaponDamage';
import { cannotWieldTwoHanded, handAmputated } from './trauma';
import { mutationArmourBonus, nonDeviatableMutationAP } from './corruption';
import { findTrappingById, findVehicleById, qualityInstance, type TrappingRef, trappingRefLabel } from '../data';
import { QUALITY_IDS } from './qualities/ids';
import { slugId } from '../data/slug';
import { craftEncDelta } from './qualities/craftEconomy';
import { hasQuality, qualityIndice } from './qualities/dispatch';
import { hasTraitKey } from './traits/dispatch';
import { itemCapability } from './capabilities';

let uidCounter = 0;
export function newUid(): string {
  return `it-${++uidCounter}`;
}

/** Convention d'AFFICHAGE des Dégâts (spec → chaîne) : la SEULE fonction qui décide « +BF » vs « +N »
 *  vs « +BF+N ». DÉRIVE l'affichage de la donnée structurée (`WeaponDamageSpec`, dans `types.ts`). */
export function damageString(d: WeaponDamageSpec): string {
  if ('literal' in d) return d.literal;
  if (d.plusBF) return d.flat === 0 && d.bare ? '+BF' : `+BF+${d.flat}`;
  return d.flat < 0 ? `${d.flat}` : `+${d.flat}`; // Indice négatif : « -2 », pas « +-2 »
}

/** INVERSE de `damageString` (chaîne → spec) — pour la migration des données et la saisie éditeur,
 *  JAMAIS au runtime. « +BF+4 »→{plusBF,flat:4}, « +9 »→{plusBF:false,flat:9}, « +BF »→{plusBF,flat:0,bare},
 *  « -2 »→{plusBF:false,flat:-2}, sinon « Spécial » → {literal}. */
export function parseDamage(s: string): WeaponDamageSpec {
  const t = s.trim();
  const plusBF = /BF/i.test(t);
  const nums = t.replace(/BF/gi, '').match(/[+-]?\d+/g);
  if (!plusBF && !nums) return { literal: t }; // non chiffrable (« Spécial »)
  const flat = (nums ?? []).reduce((a, n) => a + parseInt(n, 10), 0);
  if (plusBF) return flat === 0 && !/\+\s*BF\s*[+-]\s*\d/i.test(t) ? { plusBF: true, flat: 0, bare: true } : { plusBF: true, flat };
  return { plusBF: false, flat };
}

/** Spécification d'une arme SYNTHÉTIQUE (≠ catalogue) : sert `buildWeapon` (→ Weapon) ET `weaponItem`
 *  (→ ItemInstance). `uid` : littéral (Tentacule : 'nat-tentacule'), préfixe → `${prefix}-${newUid()}`,
 *  ou absent → `buildWeapon` génère un uid stable par défaut (`w-${newUid()}`) : TOUTE arme construite
 *  porte un uid (les Pendings d'arme — rechargement/renversement/piège-lame — la retrouvent par uid). */
export interface WeaponSpec {
  name: string;
  type?: 'melee' | 'ranged';
  damage: WeaponDamageSpec;
  qualities?: QualityInstance[];
  subType?: string;
  reach?: string | null;
  range?: number | null;
  /** Recharge (Indice) — LDB 62 l.333 : DR à cumuler (Test étendu de Projectiles). 0/absent = aucun. */
  reload?: number;
  hands?: 1 | 2;
  uid?: string | { prefix: string };
  skin?: Record<string, string>;
  form?: string;
  /** Slug de FORME (routage de l'art rig) — propagé de l'ItemInstance/trait vers `Weapon.shape`. */
  shape?: string;
  /** Attaque naturelle de corps (aucune arme dessinée) — propagé vers `Weapon.natural`. */
  natural?: boolean;
  /** Nature d'attaque naturelle STAMPÉE (morsure/cornes/caudale/tentacules/pietinement…) — pour la
   *  pose/anim et la Condition `attackKind` ; le constructeur la connaît. Cf. `Weapon.attackKind`. */
  attackKind?: string;
  /** id de trapping source d'une arme built-in (Mains nues) — porté sur `Weapon.builtinId`. */
  builtinId?: string;
}

function specUid(uid: WeaponSpec['uid']): string {
  if (uid == null) return `w-${newUid()}`; // arme sans uid explicite → uid stable par défaut (universel)
  return typeof uid === 'string' ? uid : `${uid.prefix}-${newUid()}`; // UN seul appel newUid par arme
}

/** CONSTRUCTEUR D'ARME UNIQUE. Toute arme synthétique (naturelle, invoquée, gratuite, de trait de créature,
 *  mains nues, Tentacule) passe par ici — fin des re-déclarations éparpillées de la forme `Weapon`. Porte la
 *  convention de Dégâts (`damageString`), l'uid, la COPIE de `qualities` et les défauts (mêlée, 1 main). Le
 *  tag `hand` reste posé par l'appelant (cf. `recomputeLoadout`), comme pour les autres armes injectées. */
export function buildWeapon(spec: WeaponSpec): Weapon {
  const w: Weapon = {
    name: spec.name,
    type: spec.type ?? 'melee',
    damage: spec.damage, // spec STRUCTURÉE stockée telle quelle (affichage dérivé par damageString)
    qualities: [...(spec.qualities ?? [])],
    hands: spec.hands ?? 1,
  };
  if (spec.reach !== undefined) w.reach = spec.reach;
  if (spec.range !== undefined) w.range = spec.range;
  if (spec.reload !== undefined) w.reload = spec.reload;
  if (spec.subType !== undefined) w.subType = spec.subType;
  w.uid = specUid(spec.uid); // TOUJOURS défini (universel : Pendings d'arme par uid)
  if (spec.skin !== undefined) w.skin = spec.skin;
  if (spec.form !== undefined) w.form = spec.form;
  if (spec.shape !== undefined) w.shape = spec.shape;
  if (spec.natural !== undefined) w.natural = spec.natural;
  if (spec.attackKind !== undefined) w.attackKind = spec.attackKind;
  if (spec.builtinId !== undefined) w.builtinId = spec.builtinId;
  return w;
}

/** Arme « Mains nues » canonique reconnue par son marqueur STABLE (`builtinId`), pas par son nom
 *  (multilangue-safe). Utilisé pour exclure les Mains nues des armes « wielded » / choisissables. */
export const isUnarmed = (w: Weapon): boolean => w.builtinId === 'mains-nues';

/** Variante ItemInstance (objet d'inventaire) : RÉUTILISE `buildWeapon` pour le cœur (Dégâts, uid,
 *  qualities copiées, défauts) puis ne fait que la bascule `Weapon`→`ItemInstance` (`type`→`kind` + les
 *  champs propres à l'OBJET : enc/equipped/conjured). Utilisé par l'arme INVOQUÉE (op `grantWeapon`) posée
 *  dans un set d'armes dédié. */
export function weaponItem(spec: WeaponSpec & { conjured?: boolean }): ItemInstance {
  const { type, uid, ...rest } = buildWeapon(spec); // buildWeapon garantit toujours un uid
  return {
    ...rest,
    kind: type,
    uid: uid!,
    enc: 0,
    equipped: false,
    ...(spec.conjured ? { conjured: true } : {}),
  };
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

/** Construit une instance d'objet depuis un VÉHICULE de catalogue (`vehicles.json`, facette possession).
 *  Les véhicules vivent dans leur foyer unique ; un id de carrière (`barque`, `diligence`…) y est résolu. */
export function itemFromVehicleById(id: string): ItemInstance | null {
  const v = findVehicleById(id);
  if (!v) return null;
  return {
    uid: newUid(),
    trappingId: v.id, // re-dérivation : `itemFromTrappingById` retombera sur `vehicles.json`
    name: v.label,
    kind: 'misc',
    qualities: [],
    enc: v.enc ?? 0,
    equipped: false,
    desc: v.desc ?? null,
    subType: 'animaux-et-vehicules',
  };
}

/** Construit une instance d'objet depuis le catalogue par son `id` STABLE. Cherche d'abord les
 *  `trappings`, puis retombe sur le foyer des VÉHICULES (`vehicles.json`) — les véhicules ayant migré
 *  hors de `trappings.json`, un `TrappingRef` de carrière (`diligence`, `barque`…) y résout toujours.
 *  Pose `trappingId` (réf de re-dérivation). Id inconnu partout → null (objet hors-base → `customTrapping`). */
export function itemFromTrappingById(id: string): ItemInstance | null {
  const t = findTrappingById(id);
  if (!t) return itemFromVehicleById(id);
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
    trappingId: t.id,
    name: t.label,
    kind,
    damage: t.damage ?? undefined,
    // Allonge (mêlée) ⊥ Portée (tir) — LDB 62. La donnée est NORMALISÉE : `reach` = string|null (Allonge
    // ou formule de jet « BFx3 »), `range` = Portée numérique (m) des armes à portée fixe → copie DIRECTE,
    // plus de `Number(t.reach)` (le « type menteur » d'avant la migration est éliminé).
    reach: t.reach,
    range: t.range ?? null,
    qualities: (t.qualities ?? []).map(qualityInstance), // QualityRef[] (donnée) → QualityInstance[] runtime (structuré, frais)
    pa: t.pa ?? undefined,
    locs: locs && locs.length ? locs : undefined,
    enc: typeof t.enc === 'number' ? t.enc : 0, // 'ND' (ateliers) / 'Variable' (arme improvisée) → non-encombrant (0), jamais NaN
    equipped: false,
    ...(t.shape ? { shape: t.shape } : {}), // slug de FORME (routage de l'art rig) — absent pour munitions/siège/Mains nues
    desc: t.desc,
    ...(t.consumable ? { consumable: t.consumable } : {}), // effet de consommable (Flow) copié du catalogue
    ...(t.consumableDuration ? { consumableDuration: t.consumableDuration } : {}), // durée d'horloge (LDB 71/72 « Durée : … »), résolue au boire
    subType: t.subType ?? undefined,
    ...(t.weaponGroup ? { weaponGroup: t.weaponGroup } : {}), // Groupe de Projectiles d'une arme de siège (AA p.122)
    ...(t.soloSimple ? { soloSimple: true } : {}), // baliste « relativement simple » : tir solo perd les Atouts (l.3818)
    ...(t.indirect ? { indirect: true } : {}), // mortier/catapulte « arc élevé » (AA p.122-123) : tir INDIRECT → viser une case
    ...(t.requiresMastery ? { requiresMastery: true } : {}), // arme inhabituelle (ACE Annexe I p.219) : maîtrise requise
    hands: kind === 'melee' || kind === 'ranged' ? (t.hands === 2 ? 2 : 1) : undefined, // champ typé (LDB 62)
    qty: kind === 'ammo' ? (t.packSize ?? 1) : undefined, // taille de paquet typée
    ...(t.ammoRangeMod != null ? { ammoRangeMod: t.ammoRangeMod } : {}), // modificateur de Portée de la munition (LDB 62)
    // Les capacités de catégorie (weatherProtection/isShelter/isRations/isGrimoire/preventForcedDrop) NE
    // sont PAS copiées sur l'instance : elles restent lues DEPUIS le catalogue par `trappingId` (canal
    // `capabilities`), via `engine/capabilities` — comme `passive`. Une seule source de vérité.
    ...(t.container ? { container: t.container } : {}), // Contenant (LDB 64) : capacité de rangement
  };
}

/** Objet « custom » minimal (trinket / objet de quête) quand le nom n'est PAS un vrai trapping de la
 *  base : permet de donner un objet au groupe via `giveTrapping` sans entrée de données (cf. retrait de
 *  l'inventaire de groupe — « donner un objet = un trapping custom OU réel »). kind `misc`, sans stats. */
export function customTrapping(name: string): ItemInstance {
  return { uid: newUid(), name, kind: 'misc', qualities: [], enc: 0, equipped: false };
}

/** Résout l'ItemInstance d'un Effet `giveTrapping` : objet de CATALOGUE (`trappingId`) sinon objet CUSTOM
 *  (`custom`, nom libre hors-base). SOURCE UNIQUE (applyEffects + ramassage de prop). */
export function itemFromGive(give: { trappingId?: string; custom?: string }): ItemInstance {
  return (give.trappingId ? itemFromTrappingById(give.trappingId) : null) ?? customTrapping(give.custom ?? give.trappingId ?? 'Objet');
}

/** Libellé d'affichage d'un Effet `giveTrapping` (catalogue → label, sinon nom custom). */
export function giveTrappingLabel(give: { trappingId?: string; custom?: string }): string {
  return give.trappingId ? (findTrappingById(give.trappingId)?.label ?? give.trappingId) : (give.custom ?? 'Objet');
}

/** Limite d'Encombrement = Bonus de Force + Bonus d'Endurance, +2 par niveau de Costaud
 *  (LDB ; talent Costaud : « Augmentez les Points d'Encombrement … de votre niveau × 2 »). */
export function maxEncumbrance(c: Combatant): number {
  return bonus(baseWithTraits(c, 'F')) + bonus(baseWithTraits(c, 'E')) + talentEncumbranceBonus(c);
}

/** Encombrement transporté. Les objets PORTÉS sur le corps (armure ET accessoire) voient leur
 *  Encombrement réduit de 1 — souvent 0 une fois portés (LDB 61 l.21). Les armes tenues et le
 *  matériel simplement transporté gardent leur Encombrement plein ; un objet RANGÉ dans un contenant
 *  est absorbé par celui-ci (LDB 64 l.5) et ne compte pas au total. */
export function totalEncumbrance(c: Combatant): number {
  return (c.items ?? []).reduce((s, i) => {
    if (i.inside) return s; // rangé dans un contenant → absorbé par lui (LDB 64 l.5), ne compte pas
    const enc = (i.enc || 0) + craftEncDelta(i); // Léger -1 / Volumineux +1 (LDB 60)
    if (!!i.equipped && i.subType === 'protheses') return s; // prothèse portée = Enc 0 (LDB 73)
    // Objet PORTÉ sur le corps (armure OU accessoire — PAS une arme, qui se TIENT) : -1 (LDB 61 l.21) ;
    // armure Volumineux portée = 1 (LDB 60 l.91).
    const worn = !!i.equipped && isWearable(i);
    const eff = worn ? (i.kind === 'armor' && hasQuality(i, QUALITY_IDS.Volumineux) ? 1 : enc - 1) : enc;
    return s + Math.max(0, eff);
  }, 0);
}

/** Armure vide : PA uniforme `ap` sur toutes les localisations (0 par défaut). */
export function emptyArmour(ap = 0): ArmourPoints {
  return { tete: ap, brasG: ap, brasD: ap, corps: ap, jambeG: ap, jambeD: ap };
}

/** Latéralité d'une arme. La donnée canonique marque le 2-mains par le préfixe `(2M)` — UNIFORME mêlée ET
 *  distance (Arc/Arbalète/Arquebuse/Tromblon = (2M) ; Arbalète de poing/Pistolet/Fronde = 1 main).
 *  La donnée canonique porte la latéralité TYPÉE : `TrappingData.hands` (LDB 62), propagée par
 *  `itemFromTrapping` sur l'ItemInstance. Repli pour les armes BRUTES sans `hands` typé (statblocs
 *  d'ennemis, armes synthétiques) : Groupe « Deux-mains » typé (`subType==='deux-mains'`). Aucun parse
 *  de chaîne d'affichage. */
export function weaponHands(it: { hands?: 1 | 2; subType?: string }, ctx?: { mounted?: boolean }): 1 | 2 {
  // Cavalerie « (2M) » (LDB 62 l.142-143) : MONTÉE, l'arme est maniée à UNE main (l'autre tient les rênes) ;
  // utilisée À PIED, « toutes les armes à deux mains du Groupe Cavalerie sont aussi considérées comme des
  // armes à Deux Mains ». La donnée porte `hands:2` d'origine (= le profil à pied) ; on n'allège à 1 que monté.
  if (ctx?.mounted && it.subType === 'cavalerie' && it.hands === 2) return 1;
  if (it.hands === 1 || it.hands === 2) return it.hands;
  if (it.subType === 'deux-mains') return 2; // Groupe « Deux-mains » (id stable, donnée typée)
  return 1;
}

/** Arme exigeant DEUX mains (LDB 62). Pistolets/arquebuses (Poudre noire/Ingénierie) : 1 main par défaut. */
export function isTwoHandedWeapon(it: ItemInstance): boolean {
  return weaponHands(it) === 2;
}

/** Arme éligible à la MAIN SECONDAIRE (LDB 14 l.138 : « une arme de combat rapproché à une main OU un
 *  pistolet ») : arme de mêlée à UNE main, ou une arme à distance portant l'Atout Pistolet (qualité
 *  `pistolet` — « peut attaquer en Combat rapproché », inclut l'Arbalète de poing). Exclut donc les
 *  arcs/arbalètes ordinaires et toute arme à deux mains. Détection du pistolet par la QUALITÉ (id stable,
 *  multilangue-safe), pas par le nom. */
export function isOffHandEligible(it: ItemInstance): boolean {
  if (it.kind !== 'melee' && it.kind !== 'ranged') return false;
  if (weaponHands(it) !== 1) return false;
  if (it.kind === 'melee') return true;
  return hasQuality(it, 'pistolet'); // Atout Pistolet (qualities.json id) — seule arme à distance utilisable de la 2nde main
}

/** Couche de PORT d'une pièce d'armure (LDB 63) : le « Cuir souple » « peut être porté sans pénalité
 *  sous n'importe quelle autre Armure » (l.93) ; une armure Flexible « peut être portée sous une
 *  couche d'armure non Flexible » (l.105-106) ; le reste forme la couche extérieure rigide.
 *  Une seule pièce par couche et par localisation. */
export type ArmourLayer = 'souple' | 'flexible' | 'rigide';
export function armourLayer(it: ItemInstance): ArmourLayer {
  if (it.subType === 'cuir-souple') return 'souple'; // type d'armure « Cuir souple » (id)
  if (hasQuality(it, QUALITY_IDS.Flexible)) return 'flexible';
  return 'rigide';
}

/** Cape/manteau (« Vêtements et Accessoires », sans stats) : PORTABLE dans l'emplacement Cape de la
 *  fiche — purement cosmétique (rendu dorsal du rig), une seule à la fois. Détecté par la capacité
 *  par-OBJET `weatherProtection` (catalogue, ≠ nom — un objet `misc` qui protège des intempéries =
 *  un vêtement de dos). */
export function isCapeItem(it: ItemInstance): boolean {
  return it.kind === 'misc' && itemCapability(it, 'weatherProtection');
}

/** Objet PORTABLE sur le corps (armure + accessoire). Les armes se TIENNENT (loadout), les munitions ne se portent pas. */
export function isWearable(it: ItemInstance): boolean {
  return it.kind === 'armor' || it.kind === 'misc';
}

/** Remplissage actuel d'un contenant (LDB 64) : somme de l'Enc des objets rangés DEDANS (`inside === containerUid`). PUR. */
export function containerFillEnc(c: Combatant, containerUid: string): number {
  return (c.items ?? [])
    .filter((i) => i.inside === containerUid)
    .reduce((s, i) => s + (i.enc || 0) + craftEncDelta(i), 0);
}

/** Peut-on ranger `it` dans le contenant `containerUid` (LDB 64) ? Le contenant existe et a une capacité ;
 *  `it` n'est ni le contenant lui-même ni un contenant (pas d'imbrication) ; le Contenu restant suffit. PUR. */
export function canStow(c: Combatant, it: ItemInstance, containerUid: string): boolean {
  const container = (c.items ?? []).find((i) => i.uid === containerUid);
  const capacity = container?.container?.capacity;
  if (capacity == null) return false;
  if (it.uid === containerUid || it.container) return false; // pas d'auto-rangement ni d'imbrication de sacs
  return containerFillEnc(c, containerUid) + ((it.enc || 0) + craftEncDelta(it)) <= capacity;
}

/** Objets ÉQUIPÉS en conflit de port avec `it` : armure de MÊME couche sur ≥1 localisation commune
 *  (pas deux justaucorps de cuir l'un sur l'autre), ou autre cape déjà portée. Équiper `it` doit
 *  d'abord les retirer (échange façon jeu vidéo). */
export function equipConflicts(c: Combatant, it: ItemInstance): ItemInstance[] {
  const others = (c.items ?? []).filter((o) => o.uid !== it.uid && o.equipped);
  if (it.kind === 'armor' && it.locs?.length) {
    const layer = armourLayer(it);
    return others.filter(
      (o) => o.kind === 'armor' && armourLayer(o) === layer && (o.locs ?? []).some((l) => it.locs!.includes(l)),
    );
  }
  if (isCapeItem(it)) return others.filter(isCapeItem);
  return [];
}

let _unarmed: Weapon | null = null;
/** Arme « Mains nues » canonique, DÉRIVÉE du trapping (LDB 62 l.75 : +BF+0, Personnelle, Inoffensive) —
 *  plus de valeur codée en dur. Lazy + mémoïsé (data chargée au 1ᵉʳ appel). Copie fraîche à chaque appel. */
export function unarmedWeapon(): Weapon {
  if (!_unarmed) {
    const it = itemFromTrappingById('mains-nues');
    _unarmed = it
      ? buildWeapon({ name: it.name, damage: it.damage ?? { plusBF: true, flat: 0 }, reach: it.reach, qualities: it.qualities, subType: it.subType, builtinId: 'mains-nues' })
      : buildWeapon({ name: 'Mains nues', damage: { literal: '+BF+0' }, reach: 'Personnelle', qualities: [{ id: QUALITY_IDS.Inoffensive }], subType: 'bagarre', builtinId: 'mains-nues' });
  }
  return { ..._unarmed, hand: 'main' };
}

/** Libellé AUTO d'un set d'armes, DÉRIVÉ de son CONTENU (façon Dragon Age / Pillars) : nom de l'arme
 *  `main` (+ « + » nom de l'`off` quand il y en a une), ou « Mains nues » si le set est vide. Les noms sont
 *  lus dans l'inventaire du combattant (`c.items`). Remplace l'affichage du champ `name` (« Set I/II »). PUR. */
export function loadoutLabel(lo: WeaponLoadout, c: Combatant): string {
  const items = c.items ?? [];
  const nameOf = (uid?: string) => (uid ? items.find((i) => i.uid === uid)?.name : undefined);
  const main = nameOf(lo.main);
  const off = nameOf(lo.off);
  if (main && off) return `${main} + ${off}`;
  return main ?? off ?? 'Mains nues';
}

/** Loadout actif d'un combattant, ou null si le combattant n'a aucun set (cas traité par ensureDefaultLoadout dans recomputeLoadout). */
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

/** Résolution ALTERNATIVE d'attaque DÉRIVÉE (ADE II ch.08 l.233 : « Toutes les machines de guerre...
 *  utilisent... Projectiles [Machine de guerre], à l'exception du bélier, qui utilise Force ») — la SEULE
 *  arme de MÊLÉE du Groupe `machine-de-guerre` est le bélier : aucun id en dur, dérivé du Groupe + du type
 *  (comme le décompte d'équipage dérive du Groupe). Lu par `combatValue` (`Weapon.resolveChar`). */
function warMachineResolveChar(it: Pick<ItemInstance, 'kind' | 'weaponGroup'>): 'F' | undefined {
  return it.weaponGroup === 'machine-de-guerre' && it.kind === 'melee' ? 'F' : undefined;
}

/** Recalcule armes/armure actives + encombrement. Les ARMES viennent du loadout actif (contrainte 2 mains,
 *  tag `hand`) ; si aucun loadout, ensureDefaultLoadout en crée un automatiquement — UN SEUL modèle. */
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
    const hands = weaponHands(it, { mounted: !!c.mountId }); // Cavalerie (2M) à pied → vraies 2 mains (LDB 62 l.142-143)
    if (hands === 2 && cannotWieldTwoHanded(c)) return null; // amputation : pas d'arme à 2 mains (LDB 18 l.352)
    const reload = qualityIndice(it, QUALITY_IDS.Recharge) ?? 0;
    // Enchantements PORTÉS PAR L'OBJET (op augmentWeapon / arme invoquée) repliés ici → l'arme active
    // est déjà Magique/+Dégâts/onHit, donc visible partout ET appliquée à la résolution (pas de merge ailleurs).
    return applyEnchants({ name: it.name, type: it.kind as 'melee' | 'ranged', damage: it.damage ?? { plusBF: true, flat: 0, bare: true }, reach: it.reach,
      range: it.range, qualities: it.qualities, subType: it.subType, weaponGroup: it.weaponGroup, soloSimple: it.soloSimple, indirect: it.indirect, reload, damageTaken: it.damageTaken,
      skin: it.skin, form: it.form, shape: it.shape, hands, hand, uid: it.uid, mountSide: it.mountSide, resolveChar: warMachineResolveChar(it) }, it.enchants ?? []);
  };

  // UN SEUL modèle : tout combattant porteur d'armes passe par un loadout (auto-généré si absent — plus de
  // chemin « toutes armes équipées »). Les ennemis (armes du statbloc, posées en dur, sans items) ne passent
  // pas par ici (cf. spawn.ts), donc aucun statbloc n'est écrasé.
  if (!activeLoadout(c)) ensureDefaultLoadout(c);
  const weapons: Weapon[] = [];
  const lo = activeLoadout(c);
  if (lo) {
    // Mains amputées (LDB 18) : une main perdue ne tient rien. L'arme DIRECTRICE reste tenue tant qu'il reste
    // une main (le −20 CC/CT de l'amputation est porté par la séquelle) ; l'objet de main SECONDAIRE
    // (bouclier / 2e arme) tombe dès qu'une main manque. Les DEUX mains perdues → Mains nues.
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

  // Armes DÉRIVÉES d'un objet ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est considéré comme une
  // Dague » en mêlée) — DÉCLARATIF sur le trapping (`derivedWeapon`). Ajouter une prothèse-arme = la
  // donnée du trapping, plus aucun name-match `i.name === 'Crochet'` ici.
  for (const i of items) {
    const dw = i.equipped && i.trappingId ? findTrappingById(i.trappingId)?.derivedWeapon : undefined;
    if (dw) weapons.push({ hand: 'main', ...dw });
  }
  // Tentacule (trait Tentacules, LDB 85 p.343) : AUSSI une Attaque gratuite 1/tour (battleTentacle) ;
  // ici utilisable comme arme ordinaire. La mutation « Tentacule épais » confère le trait → couvert.
  if (hasTraitKey(c.traits, 'tentacules')) {
    weapons.push({ ...buildWeapon({ name: 'Tentacule', attackKind: 'tentacules', subType: 'base', uid: 'nat-tentacule', damage: { plusBF: true, flat: 0, bare: true } }), hand: 'main' });
  }
  // Armes NATURELLES de MUTATION (LDB 19 : « Compte comme une Arme de Créature », Dégâts = BF) —
  // op `grantNaturalWeapon` du `passive` de la mutation (même vocabulaire que les sorts/traits).
  // Ajouter une mutation-arme = ajouter cet op à la donnée. Dégâts LITTÉRAUX (mutations RAW = fixes).
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) {
    if (op.op === 'grantNaturalWeapon') {
      const flat = (typeof op.damage === 'number' ? op.damage : 0) + (op.damagePlus ?? 0);
      weapons.push({ hand: 'main', ...buildWeapon({
        name: op.name, damage: { plusBF: op.plusBF !== false, flat, bare: op.bare ? true : undefined },
        qualities: (op.qualities ?? []).map((id) => ({ id })), uid: { prefix: `nat-${slugId(op.name)}` },
      }) });
    }
  }
  // Armes NATURELLES accordées par un Sort (op `grantNaturalWeapon` — Dent et griffe : Morsure/Arme ;
  // Incarnation de Wyssan) : attaques ADDITIONNELLES tant que l'effet dure (retirées au recompute
  // d'expiration, dropExpiredGrantedWeapons). Même injection que Tentacule/Cornes.
  for (const e of c.activeEffects ?? []) {
    if (e.naturalWeapon) weapons.push({ ...e.naturalWeapon, hand: 'main' });
  }

  // Pièce d'artillerie SERVIE (`mannedPoste`, MDG ch.12-13) : SEUL le CHEF (`crewIds[0]`) DÉRIVE l'arme du poste
  // comme arme active taguée `mountSide` — comme un Tentacule/une Morsure (dans `weapons`, HORS inventaire). Les
  // membres SUPPORT (`crewIds[1..]`, Arme d'équipe) occupent la pièce (lien `mannedPoste`, comptés dans l'Indice)
  // mais ne TIRENT pas → pas d'arme. Le canon reste la pièce de la coque (vérité = la coque). KIND-AGNOSTIQUE.
  if (c.mannedPoste && c.mannedPoste.crewIds?.[0] === c.id) {
    const w = mannedPosteWeapon(c, c.mannedPoste);
    if (w) weapons.push(w);
  }

  // Mains nues toujours disponibles en dernier recours (stats canoniques du trapping, LDB 62 l.75).
  weapons.push(unarmedWeapon());

  const armour = wornArmourPoints(items);
  // Mutations de Corruption (LDB 19) : PA NATURELS additifs (Peau d'acier +2 partout,
  // Écailles épineuses +1 partout, Cornes asymétriques +1 Tête) — par-dessus l'armure portée.
  for (const l of Object.keys(armour) as (keyof typeof armour)[]) armour[l] += mutationArmourBonus(c, l);

  c.weapons = weapons;
  c.armour = armour;
  c.encumbrance = totalEncumbrance(c);
}

/**
 * Arme dérivée d'un poste d'artillerie SERVI (`mannedPoste`, MDG ch.12-13) — taguée `mountSide = poste.side`,
 * enchants/qualités de l'instance repliés (comme `toWeapon`, mais à partir du poste). Builder PARTAGÉ par
 * `recomputeLoadout` (chefs héros) ET `applyShipPostes` (octroi DIRECT aux chefs à statbloc qui ne recomputent
 * pas) → le canon apparaît de la MÊME façon quel que soit le `kind`. PUR.
 */
export function mannedPosteWeapon(c: Combatant, poste: ShipPoste): Weapon | undefined {
  const it: ItemInstance = { ...poste.item, mountSide: poste.side };
  if (it.destroyed) return undefined;
  const hands = weaponHands(it);
  if (hands === 2 && cannotWieldTwoHanded(c)) return undefined;
  const reload = qualityIndice(it, QUALITY_IDS.Recharge) ?? 0;
  return applyEnchants({ name: it.name, type: it.kind as 'melee' | 'ranged', damage: it.damage ?? { plusBF: true, flat: 0, bare: true }, reach: it.reach,
    range: it.range, qualities: it.qualities, subType: it.subType, weaponGroup: it.weaponGroup, soloSimple: it.soloSimple, indirect: it.indirect, reload, damageTaken: it.damageTaken,
    skin: it.skin, form: it.form, shape: it.shape, hands, hand: 'main', uid: it.uid, mountSide: it.mountSide, resolveChar: warMachineResolveChar(it) }, it.enchants ?? []);
}

let loadoutCounter = 0;
/** Génère les DEUX sets d'armes par défaut d'un héros qui n'en a pas : le 1er = meilleure arme de
 *  mêlée (+ bouclier/2e arme à 1 main en secondaire), le 2nd = 1re arme à distance (sinon vide).
 *  Idempotent. Le libellé d'un set est DÉRIVÉ de son contenu à l'affichage (`loadoutLabel`), pas stocké. */
export function ensureDefaultLoadout(c: Combatant): void {
  if (c.loadouts?.length) return;
  const items = (c.items ?? []).filter((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged'));
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');

  const set1: WeaponLoadout = { id: `lo-${++loadoutCounter}` };
  if (melee.length) {
    const main = [...melee].sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0];
    set1.main = main.uid;
    if (weaponHands(main) === 1) set1.off = melee.find((i) => i.uid !== main.uid && weaponHands(i) === 1)?.uid;
  }
  const set2: WeaponLoadout = { id: `lo-${++loadoutCounter}`, main: ranged[0]?.uid };
  c.loadouts = [set1, set2];
  c.activeLoadoutId = (set1.main ? set1 : set2.main ? set2 : set1).id;
}

/** Id de loadout unique (réutilise le compteur d'ensureDefaultLoadout). */
export function newLoadoutId(): string {
  return `lo-${++loadoutCounter}`;
}

/** Crée un loadout vide, le rend actif, et renvoie son id. */
export function loadoutCreate(c: Combatant): string {
  const id = newLoadoutId();
  c.loadouts = [...(c.loadouts ?? []), { id }];
  c.activeLoadoutId = id;
  return id;
}

/** Supprime un loadout ; si c'était l'actif, bascule sur le 1ᵉʳ restant (ou undefined). */
export function loadoutDelete(c: Combatant, id: string): void {
  c.loadouts = (c.loadouts ?? []).filter((l) => l.id !== id);
  if (c.activeLoadoutId === id) c.activeLoadoutId = c.loadouts[0]?.id;
}

export function loadoutSetActive(c: Combatant, id: string): void {
  if (c.loadouts?.some((l) => l.id === id)) c.activeLoadoutId = id;
}

/** Assigne (ou retire si `uid` null) une arme à un slot. Une arme à 2 mains en `main` vide le slot `off` ;
 *  une même arme ne peut occuper les DEUX mains (l'assigner à une main la retire de l'autre). */
export function loadoutSetSlot(c: Combatant, id: string, slot: 'main' | 'off', uid: string | null): void {
  const lo = c.loadouts?.find((l) => l.id === id);
  if (!lo) return;
  lo[slot] = uid ?? undefined;
  if (uid) {
    const other = slot === 'main' ? 'off' : 'main';
    if (lo[other] === uid) lo[other] = undefined; // une arme ne peut pas être tenue des deux mains à la fois
    if (slot === 'main') {
      const it = (c.items ?? []).find((i) => i.uid === uid);
      if (it && weaponHands(it) === 2) lo.off = undefined; // 2 mains → pas de secondaire
    }
  }
}

/**
 * Ajoute l'objet de catalogue `trappingId` à l'inventaire PERSONNEL d'un héros et re-dérive son équipement
 * actif. Retourne un NOUVEAU combattant (cloné). SOURCE UNIQUE du « donner un objet à un héros » : utilisée
 * par l'achat marchand (`buyItem`) ET l'assignation de butin. Id inconnu → inchangé.
 */
export function addItemToHero(hero: Combatant, trappingId: string): Combatant {
  const it = itemFromTrappingById(trappingId);
  if (!it) return hero;
  const clone: Combatant = structuredClone(hero);
  clone.items = [...(clone.items ?? []), it];
  recomputeLoadout(clone);
  return clone;
}

/**
 * PA portés par localisation, dérivés des pièces équipées. Une seule pièce compte par localisation
 * (la meilleure), SAUF Flexible (LDB 63) : « peut être portée sous une couche d'armure non
 * Flexible […] vous gagnez les bénéfices des deux » → meilleure pièce rigide + meilleure pièce
 * Flexible se CUMULENT. `exclude` retire des pièces du calcul (PA ignorés par la touche —
 * Partielle/Points faibles, cf. `ignoredArmourAP`).
 */
export function wornArmourPoints(items: ItemInstance[], exclude?: (it: ItemInstance) => boolean): ArmourPoints {
  const rigid = emptyArmour();
  const flex = emptyArmour();
  for (const it of items) {
    if (!it.equipped || it.kind !== 'armor' || !it.pa || !it.locs) continue;
    if (exclude?.(it)) continue;
    const net = Math.max(0, it.pa - (it.damageTaken ?? 0)); // PA nette des dégâts (LDB 63 l.53)
    const layer = hasQuality(it, QUALITY_IDS.Flexible) ? flex : rigid;
    for (const l of it.locs) layer[l] = Math.max(layer[l], net);
  }
  const armour = emptyArmour();
  for (const l of Object.keys(armour) as HitLocation[]) armour[l] = rigid[l] + flex[l];
  return armour;
}

/**
 * PA portés à `loc` IGNORÉS par cette touche (LDB 63, Qualités des armures) :
 *  - Partielle : « Un adversaire qui obtient un nombre pair pour vous toucher, ou obtient un
 *    Coup Critique, ignore les PA de l'armure Partielle » ;
 *  - Points faibles : « Si votre adversaire possède une arme avec l'Atout Empaleuse et obtient
 *    un Critique, les PA de votre armure sont ignorés ».
 * Différence entre les PA dérivés avec et sans les pièces ignorées (gère la superposition Flexible).
 */
export function ignoredArmourAP(c: Combatant, loc: HitLocation, hit: { roll: number; critical: boolean; empaleuse: boolean }): number {
  const items = c.items ?? [];
  if (!items.length) return 0;
  const even = hit.roll % 2 === 0;
  const ignored = (it: ItemInstance): boolean =>
    (hasQuality(it, QUALITY_IDS.Partielle) && (even || hit.critical)) ||
    (hasQuality(it, QUALITY_IDS.PointsFaibles) && hit.critical && hit.empaleuse);
  if (!items.some((it) => it.equipped && it.kind === 'armor' && it.locs?.includes(loc) && ignored(it))) return 0;
  return Math.max(0, wornArmourPoints(items)[loc] - wornArmourPoints(items, ignored)[loc]);
}

/** La localisation `loc` est-elle protégée par une pièce Impénétrable (LDB 63 : les Coups
 *  Critiques obtenus sur un jet de toucher IMPAIR sont ignorés) ? */
export function impenetrableAt(c: Combatant, loc: HitLocation): boolean {
  return (c.items ?? []).some(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0 && hasQuality(i, QUALITY_IDS.Impenetrable),
  );
}

/** PA d'armure SACRIFIABLE pour la Déviation Critique (LDB 63 l.30) à `loc` : `c.armour[loc]` (armure portée +
 *  statbloc créature + PA naturels de mutation) MOINS les PA marqués hors-Déviation (Écailles, EDO App.2 l.196).
 *  Le PA de sort (activeEffects) n'est pas une pièce d'armure et n'entre pas. > 0 ⇔ « protégé par une armure ». */
export function deviatableArmourAt(c: Combatant, loc: HitLocation): number {
  return (c.armour?.[loc] ?? 0) - nonDeviatableMutationAP(c, loc);
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

/** Putréfaction (LDB 47) : « le cuir se racornit (perdant 1 PA à 1 Localisation) » — endommage de
 *  1 PA la première pièce de CUIR portée encore intacte, re-dérive l'armure. Retourne la
 *  localisation touchée, ou null si rien en cuir (ennemi à armure plate : matière inconnue → MJ).
 *  Matière détectée par l'id de TYPE d'armure `subType` (« cuir-souple »/« cuir-bouilli ») — réf STABLE
 *  qui PORTE le matériau (≠ nom — multilangue-safe ; cohérent avec l'op `damageArmour{material:'cuir'}`). */
export function damageLeatherArmour(c: Combatant): HitLocation | null {
  const piece = (c.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && !!i.subType?.startsWith('cuir') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return null;
  piece.damageTaken = (piece.damageTaken ?? 0) + 1;
  recomputeLoadout(c);
  return piece.locs?.[0] ?? 'corps';
}

/** Score de dégâts approximatif pour le tri (composante fixe ; « Spécial » → 0). */
export function damageScore(d?: WeaponDamageSpec): number {
  return d && 'flat' in d ? d.flat : 0;
}

/** Construit l'inventaire d'un héros depuis des `TrappingRef[]` (possessions de Classe + niveau de
 *  carrière — déjà des refs par id). Un ref `{id}` à stats devient un objet ; le `count` d'une munition
 *  donne sa quantité. Les refs `{text}` (flavor hors catalogue : « Réseau d'informateurs ») n'ont pas
 *  de stats → ignorées. */
export function buildInventory(refs: TrappingRef[]): ItemInstance[] {
  const items: ItemInstance[] = [];
  for (const ref of refs) {
    if (!('id' in ref)) continue; // {text} narratif : pas d'objet à stats
    const it = itemFromTrappingById(ref.id);
    if (it) {
      if (it.kind === 'ammo' && ref.count && 'fixed' in ref.count) it.qty = ref.count.fixed; // quantité de la carrière
      items.push(it);
    }
  }
  // Équipement par défaut : la MEILLEURE arme de mêlée + la première à distance + les armures
  // SANS conflit de couche (max une pièce par couche × localisation, meilleure PA d'abord —
  // LDB 63 : pas de « 2 armures de cuir »). Les doublons restent dans l'inventaire (déséquipés).
  const melee = items.filter((i) => i.kind === 'melee');
  const ranged = items.filter((i) => i.kind === 'ranged');
  if (melee.length) melee.sort((a, b) => damageScore(b.damage) - damageScore(a.damage))[0].equipped = true;
  if (ranged.length) ranged[0].equipped = true;
  const holder = { items } as Combatant; // equipConflicts lit c.items (équipés au fil de l'eau)
  const armours = items.filter((i) => i.kind === 'armor').sort((a, b) => (b.pa ?? 0) - (a.pa ?? 0));
  for (const a of armours) if (!equipConflicts(holder, a).length) a.equipped = true;
  return items;
}

/** Famille de munitions canonique. Les armes à **Poudre noire** ET d'**Ingénierie** partagent les
 *  mêmes munitions (« Poudre noire et ingénierie ») — le LDB les regroupe sous « Armes à Poudre
 *  noire et d'Ingénierie » (62-Les armes l.150, l.174-175). Les autres familles (Arc/Arbalète/
 *  Fronde) correspondent à l'identique. Sans cette normalisation, une arme à feu (subType « Poudre
 *  noire ») ne trouverait jamais sa munition (subType « Poudre noire et ingénierie »). */
export function ammoFamily(subType?: string): string {
  const s = subType ?? ''; // `subType` = id de Groupe (poudre-noire / ingenierie / arc / arbalete / fronde…)
  if (s === 'poudre-noire' || s === 'ingenierie' || s === 'poudre-noire-et-ingenierie') return 'poudre-ingenierie';
  // Artillerie (AA/MDG) : les armes de siège (canon/baliste/mortier/pierrier) tirent les munitions de
  // siège (boulets, carreaux, bombes, mitraille). Sans cette normalisation, une arme de siège
  // (`armes-de-siege`) ne trouverait jamais sa munition (`munition-de-siege`).
  if (s === 'armes-de-siege' || s === 'munition-de-siege') return 'artillerie';
  return s;
}

/** Munitions compatibles avec une arme à distance (même famille canonique, qty>0) : l'inventaire du
 *  porteur, PLUS — s'il SERT cette pièce (`mannedPoste`) — le STOCK DU POSTE (MDG ch.12 l.410-424 :
 *  le coffre à boulets de la pièce), en tête (le stock de bord prime sur la besace du servant). */
export function compatibleAmmo(c: Combatant, weapon: Weapon): ItemInstance[] {
  if (weapon.type !== 'ranged') return [];
  const fam = ammoFamily(weapon.subType);
  if (!fam) return [];
  const match = (i: ItemInstance) => i.kind === 'ammo' && (i.qty ?? 0) > 0 && ammoFamily(i.subType) === fam;
  const poste = c.mannedPoste;
  const posteStock = poste && poste.item.uid === weapon.uid ? (poste.ammo ?? []).filter(match) : [];
  return [...posteStock, ...(c.items ?? []).filter(match)];
}

/** Munition que le porteur tirera : son choix ponctuel (`c.ammoUid`, hotbar) s'il est compatible, sinon la
 *  sélection PERSISTANTE du poste servi (`poste.ammoUid`, fiche du navire — MDG ch.12 : boulet/mitraille),
 *  sinon la 1re compatible. PUR (inventaire/famille) — vit ici (≠ état) pour servir AUSSI les sites combat
 *  MOTEUR (bandes de portée modifiées par la munition, `effectiveWeaponRange`). `undefined` = pas de munition. */
export function selectedAmmo(c: Combatant, weapon: Weapon): ItemInstance | undefined {
  const compat = compatibleAmmo(c, weapon);
  const poste = c.mannedPoste;
  const posteUid = poste && poste.item.uid === weapon.uid ? poste.ammoUid : undefined;
  return compat.find((a) => a.uid === c.ammoUid) ?? compat.find((a) => a.uid === posteUid) ?? compat[0];
}

/** CONSOMME une munition tirée (décrément `qty`, retrait à 0) LÀ OÙ ELLE VIT : stock du poste servi
 *  (`mannedPoste.ammo`) ou inventaire du tireur — source unique du décrément (tir individuel ET bordée). */
export function consumeAmmo(c: Combatant, used: ItemInstance): void {
  if ((used.qty ?? 0) <= 0) return;
  used.qty = (used.qty ?? 0) - 1;
  if (used.qty > 0) return;
  const poste = c.mannedPoste;
  if (poste?.ammo?.some((i) => i.uid === used.uid)) poste.ammo = poste.ammo.filter((i) => i.uid !== used.uid);
  else c.items = (c.items ?? []).filter((i) => i.uid !== used.uid);
}

/** Arme à distance « augmentée » par la munition tirée : Dégâts combinés (flats additionnés, BF si l'un
 *  l'utilise) et Atouts fusionnés (ex. Empaleuse de la Flèche). */
export function weaponWithAmmo(weapon: Weapon, ammo: ItemInstance): Weapon {
  const w = weapon.damage;
  const a = ammo.damage;
  const qualities = [...weapon.qualities];
  for (const q of ammo.qualities) if (!qualities.some((x) => x.id === q.id)) qualities.push(q);
  const damage: WeaponDamageSpec = 'flat' in w
    ? { plusBF: w.plusBF || (a != null && 'plusBF' in a && a.plusBF), flat: w.flat + (a != null && 'flat' in a ? a.flat : 0) }
    : w; // arme « Spécial » (literal) → inchangée
  return { ...weapon, damage, qualities };
}
