/**
 * TRONC COMMUN du COMMERCE DE CARGAISON — primitives PURES partagées par le commerce MARITIME
 * (Mer des Griffes ch.15, `seaVoyage.ts`) et le commerce TERRESTRE / FLUVIAL (Mort sur le Reik
 * Compagnon ch.11, `landCargo.ts`). Le RAW des deux livres suit la même structure « acheter bas /
 * transporter / revendre » ; SEULES les FORMULES (disponibilité, prix d'offre, bradage) et les
 * TABLEAUX (cargaisons, prix) diffèrent → ils vivent dans le module propre à chaque livre, ces
 * briques-ci (modèle de lot, tirage saisonnier, prix de base, Marchandage) NE SONT PAS dupliquées.
 */
import { d100, rollExpr, type RNG, defaultRNG } from './dice';
import type { Season } from './travelStages';

/** Un type de cargaison (bien volumineux) : plages saisonnières d100 (Tableau des cargaisons) + prix de
 *  base par saison (CO par 10 points d'Encombrement) — ou un jet de dés (`{dice}`, ex. Vin maritime 3d10). */
export interface CargoDef {
  id: string;
  label: string;
  avail: Record<Season, [number, number]>;
  price: Record<Season, number> | { dice: string };
}

/** Cargaison ALÉATOIRE de la saison : d100 dans la colonne saisonnière du tableau fourni (T2C l.71-78,
 *  MDG l.402-418). PUR. Repli sur la dernière entrée si aucune plage ne matche (tableaux exhaustifs 01-00). */
export function rollSeasonalCargo(cargoes: CargoDef[], season: Season, rng: RNG = defaultRNG): CargoDef {
  const r = d100(rng);
  return cargoes.find((c) => r >= c.avail[season][0] && r <= c.avail[season][1]) ?? cargoes[cargoes.length - 1];
}

/** Prix de BASE d'une cargaison (CO par 10 points d'Encombrement) pour la saison (T2C l.80-90, MDG
 *  l.420-436). Prix « à dés » (Vin maritime 3d10) tiré une fois à l'achat et NOTÉ. PUR (RNG injecté). */
export function cargoBasePrice(cargo: CargoDef, season: Season, rng: RNG = defaultRNG): number {
  if ('dice' in cargo.price) return rollExpr(cargo.price.dice, rng);
  return cargo.price[season];
}

/** Ampleur du Marchandage (LDB p.291, cité T2C l.127 & MDG) : le prix bouge de ±10 %, ou ±20 % si le
 *  négociant possède le Talent Négociateur. PUR. */
export function bargainDeltaPct(negotiator: boolean): number {
  return negotiator ? 20 : 10;
}

/** Un LOT de cargaison en cale/soute (`basePriceGold` = prix de base NOTÉ à l'achat, CO par point d'Enc —
 *  le Vin fige sa qualité/son 3d10 à ce moment). Modèle commun aux deux commerces. */
export interface CargoLot {
  cargoId: string;
  enc: number;
  basePriceGold: number;
}

/** Enc TOTAL embarqué (pénalités de Contenance, avaries « gâtent 1d10 Enc »…). PUR. */
export function cargoTotalEnc(lots: CargoLot[]): number {
  return lots.reduce((s, l) => s + Math.max(0, l.enc), 0);
}

/** SÉPARE jusqu'à `enc` points d'une cargaison (au fil des lots de cet id) en deux parts qui conservent
 *  chacune leur `basePriceGold` : `remaining` (ce qui reste) et `taken` (ce qui a été prélevé, splitté au
 *  besoin sur le dernier lot). PUR (nouvelles listes) — brique commune du retrait et du transfert. */
export function splitCargo(lots: CargoLot[], cargoId: string, enc: number): { remaining: CargoLot[]; taken: CargoLot[] } {
  let left = Math.max(0, enc);
  const remaining: CargoLot[] = [];
  const taken: CargoLot[] = [];
  for (const l of lots) {
    if (l.cargoId !== cargoId || left <= 0) { remaining.push(l); continue; }
    const take = Math.min(l.enc, left);
    left -= take;
    if (take > 0) taken.push({ ...l, enc: take });
    if (l.enc - take > 0) remaining.push({ ...l, enc: l.enc - take });
  }
  return { remaining, taken };
}

/** RETIRE `enc` points d'une cargaison (avarie, vol, vente partielle) — au fil des lots de cet id ; les
 *  lots vidés disparaissent. PUR (nouvelle liste). */
export function removeCargo(lots: CargoLot[], cargoId: string, enc: number): { lots: CargoLot[]; removed: number } {
  const { remaining, taken } = splitCargo(lots, cargoId, enc);
  return { lots: remaining, removed: taken.reduce((s, l) => s + l.enc, 0) };
}

// ── LE PORTEUR DE CHARGE (« CargoCarrier ») — tronc générique #327 ─────────────────────────────────
// Décision 1 (conception 2026-07-11) : UN concept pour héros, bête de bât, véhicule terrestre, barge et
// navire — ils diffèrent par leur SOURCE de capacité et leur modèle de contenu, pas par leur nature. Ce
// tronc est PUR : il fait l'arithmétique d'Enc + le transfert co-localisé ; la RÉSOLUTION de la capacité
// depuis les objets réels (héros/monture/véhicule/navire) vit dans la couture d'état `state/carriers.ts`,
// qui assemble ces structures via les constructeurs ci-dessous.

/** Nature physique d'un porteur → table de surcharge RAW (jambes = LDB p.295 ; coque = MDG ch.12). Portée
 *  par la structure pour que la couche de risque (lot D) DISPATCHE sans flag ad hoc — décision 4. */
export type CarrierHull = 'jambes' | 'coque';

/** Un PORTEUR DE CHARGE générique. `capacity`/`discreteEnc` sont des Enc déjà RÉSOLUS par la couture d'état
 *  (héros : `maxEncumbrance`/`totalEncumbrance` ; bête : `encPortee` ; véhicule : `chargement` ; navire :
 *  `ship.capacity`). L'Enc occupé se DÉRIVE (`carrierUsedEnc`) — jamais un 2ᵉ compteur à maintenir. */
export interface CargoCarrier {
  /** id STABLE : id de Combattant, uid d'ItemInstance (bête/véhicule), ou id de navire de campagne. */
  id: string;
  label: string;
  hull: CarrierHull;
  /** Capacité en Points d'Enc (source de la donnée du maillon). `Infinity` = non plafonné (convoi abstrait
   *  sans véhicule matérialisé : « information, pas plafond », landMarketFlow). */
  capacity: number;
  /** Enc des objets DISCRETS non-vrac déjà portés (héros : `totalEncumbrance` ; sinon 0). */
  discreteEnc: number;
  /** Cargaison en VRAC (cale/convoi/bât) — canal `CargoLot`. Vide, pas absent, pour l'uniformité. */
  cargo: CargoLot[];
  /** Localisation DÉRIVÉE (décision 5) : lieu courant du groupe (`MapPlace.id`)… */
  placeId?: string;
  /** …ou embarqué : uid/id du porteur-hôte (mule chargée sur une barge). */
  aboard?: string;
}

/** Enc TOTAL occupé par un porteur = objets discrets + cargaison en vrac (décision 2). PUR. */
export function carrierUsedEnc(c: CargoCarrier): number {
  return c.discreteEnc + cargoTotalEnc(c.cargo);
}

/** Enc RESTANT avant le plafond de capacité (jamais négatif ; `Infinity` pour un porteur non plafonné). PUR. */
export function carrierFreeEnc(c: CargoCarrier): number {
  return Math.max(0, c.capacity - carrierUsedEnc(c));
}

/** Peut-on encore charger `enc` points sur ce porteur ? Plafond DUR v1 (arbitrage A5.6) : on REFUSE
 *  au-delà de la capacité — aucun palier Surchargé côté tronc. PUR. */
export function carrierCanLoad(c: CargoCarrier, enc: number): boolean {
  return enc <= carrierFreeEnc(c);
}

/** CHARGE un lot de vrac sur le porteur, dans la limite du plafond dur (v1). Le lot est TRONQUÉ à la place
 *  restante (jamais au-delà) ; `loaded` = Enc effectivement embarqué. PUR (nouveau porteur). */
export function loadCargo(c: CargoCarrier, lot: CargoLot): { carrier: CargoCarrier; loaded: number } {
  const loaded = Math.min(Math.max(0, lot.enc), carrierFreeEnc(c));
  if (loaded <= 0) return { carrier: c, loaded: 0 };
  return { carrier: { ...c, cargo: [...c.cargo, { ...lot, enc: loaded }] }, loaded };
}

/** DÉCHARGE `enc` points d'une cargaison du porteur (au fil des lots de cet id). PUR (nouveau porteur). */
export function unloadCargo(c: CargoCarrier, cargoId: string, enc: number): { carrier: CargoCarrier; removed: number } {
  const { lots, removed } = removeCargo(c.cargo, cargoId, enc);
  return { carrier: { ...c, cargo: lots }, removed };
}

/** Deux porteurs sont CO-LOCALISÉS (décision 5) : embarqués l'un sur l'autre, embarqués sur le même hôte,
 *  ou au même Lieu de la carte. Un porteur n'est jamais co-localisé avec lui-même. PUR. */
export function carriersColocated(a: CargoCarrier, b: CargoCarrier): boolean {
  if (a.id === b.id) return false;
  if (a.aboard && a.aboard === b.id) return true;
  if (b.aboard && b.aboard === a.id) return true;
  if (a.aboard && a.aboard === b.aboard) return true;
  return a.placeId != null && a.placeId === b.placeId;
}

/** TRANSFÈRE jusqu'à `enc` points d'une cargaison d'un porteur vers un autre CO-LOCALISÉ (décision 8).
 *  Refuse (moved = 0) si les porteurs ne sont pas au même endroit. Le montant déplacé est plafonné par la
 *  place LIBRE de la cible (plafond dur v1) et par ce que la source possède ; les prix des lots sont
 *  préservés (split au besoin). PUR (nouveaux porteurs). */
export function transferCargo(
  from: CargoCarrier, to: CargoCarrier, cargoId: string, enc: number,
): { from: CargoCarrier; to: CargoCarrier; moved: number } {
  if (!carriersColocated(from, to)) return { from, to, moved: 0 };
  const cap = Math.min(Math.max(0, enc), carrierFreeEnc(to));
  const { remaining, taken } = splitCargo(from.cargo, cargoId, cap);
  const moved = taken.reduce((s, l) => s + l.enc, 0);
  if (moved <= 0) return { from, to, moved: 0 };
  return {
    from: { ...from, cargo: remaining },
    to: { ...to, cargo: [...to.cargo, ...taken] },
    moved,
  };
}
