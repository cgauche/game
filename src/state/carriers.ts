/**
 * COUTURE D'ÉTAT du PORTEUR DE CHARGE (#327) — expose les porteurs RÉELS du groupe comme des
 * `CargoCarrier` (tronc PUR `engine/cargo.ts`). Ce module RÉSOUT la capacité depuis les objets réels
 * (héros → `maxEncumbrance` ; bête de bât → `MountProfile.encPortee` ; véhicule terrestre →
 * `VehicleData.chargement` ; navire de campagne → `ship.capacity`) que le tronc, pur, ne connaît pas.
 *
 * SOURCE UNIQUE PAR PORTEUR (verrou 1 de la conception) : le carrier LIT le stock réel, il ne le double
 * pas — la cale du navire reste `CampaignVessel.cargo`, la cargaison en bât/véhicule reste
 * `ItemInstance.cargo`. Aucun 2ᵉ silo (le convoi abstrait `caravanCargo` a été matérialisé, lot C). Les
 * mutations passent par le tronc (`loadCargo`/`unloadCargo`/`transferCargo`) puis sont RE-PERSISTÉES sur
 * ces mêmes champs par `persistCarriersCargo` (patron `shipDamage.ts`).
 */
import type { Combatant, ItemInstance } from '../engine/types';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { mountProfileForTrapping } from '../engine/mountTravel';
import { findVehicleById } from '../data';
import { placeOfScene } from './worldMap';
import { type CargoCarrier, type CargoLot, cargoTotalEnc, carrierFreeEnc, spoilCargoByPct, cargoRaidLossPct, type CargoRaidOutcome } from '../engine/cargo';
import { rule } from '../engine/policy';
import type { GameState } from './store';

/** Tranche d'état lue pour dresser les porteurs — évite de dépendre du store entier (testable à plat). */
export type CarrierStateSlice = Pick<GameState, 'party' | 'vessel' | 'worldMap' | 'scene'>;

/** id STABLE du porteur « navire de campagne » (un seul en jeu). */
export const CAMPAIGN_VESSEL_CARRIER_ID = 'vessel';

/** Lieu courant du groupe (co-localisation par défaut de tous ses porteurs à terre). */
function currentPlaceId(s: CarrierStateSlice): string | undefined {
  return placeOfScene(s.worldMap, s.scene?.id ?? undefined)?.id;
}

const heroInParty = (h: Combatant): boolean => !h.dead && !h.outOfRencontre;

/** Capacité de bât d'un objet POSSÉDÉ s'il EST un porteur (véhicule `chargement` EDOC, ou bête `encPortee`) —
 *  undefined si l'objet n'est pas un porteur. Le véhicule PRIME (une bête attelée sert le véhicule). */
function itemCarrierCapacity(item: ItemInstance): number | undefined {
  if (!item.trappingId || item.destroyed) return undefined;
  const chargement = findVehicleById(item.trappingId)?.chargement;
  if (chargement != null) return chargement;
  return mountProfileForTrapping(item.trappingId)?.encPortee;
}

function itemIsVehicle(item: ItemInstance): boolean {
  return !!item.trappingId && !item.destroyed && findVehicleById(item.trappingId)?.chargement != null;
}

/** Construit le porteur `CargoCarrier` d'un objet de bât/véhicule (capacité déjà résolue). */
function itemCarrier(item: ItemInstance, capacity: number, placeId: string | undefined): CargoCarrier {
  return { id: item.uid, label: item.name, hull: 'jambes', capacity, discreteEnc: 0, cargo: item.cargo ?? [], placeId, aboard: item.aboard };
}

/** Porteurs de bât/chargement possédés par le groupe, SÉPARÉS véhicules/bêtes (pour la priorité d'achat). */
function landCarriers(s: CarrierStateSlice, placeId: string | undefined): { vehicles: CargoCarrier[]; beasts: CargoCarrier[] } {
  const vehicles: CargoCarrier[] = [];
  const beasts: CargoCarrier[] = [];
  for (const h of s.party) {
    if (!heroInParty(h)) continue;
    for (const item of h.items ?? []) {
      const cap = itemCarrierCapacity(item);
      if (cap == null) continue;
      (itemIsVehicle(item) ? vehicles : beasts).push(itemCarrier(item, cap, placeId));
    }
  }
  return { vehicles, beasts };
}

/** Porteur « navire de campagne » : la cale (`vessel.cargo`) EST la source unique (verrou 1). */
function vesselCarrier(s: CarrierStateSlice, placeId: string | undefined): CargoCarrier | undefined {
  const vessel = s.vessel;
  if (!vessel) return undefined;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return { id: CAMPAIGN_VESSEL_CARRIER_ID, label: vessel.name ?? findVehicleById(vessel.vehicleId)?.label ?? 'Navire', hull: 'coque', capacity, discreteEnc: 0, cargo: vessel.cargo ?? [], placeId };
}

/** TOUS les porteurs de charge réels du groupe (héros → bêtes/véhicules → navire). Chaque carrier LIT sa
 *  source unique (aucune copie persistée). */
export function partyCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const placeId = currentPlaceId(s);
  const out: CargoCarrier[] = [];
  for (const h of s.party) {
    if (!heroInParty(h)) continue;
    // Le héros lui-même : contenu = objets DISCRETS (transfert d'objet = giveTrapping, hors canal vrac).
    out.push({ id: h.id, label: h.name, hull: 'jambes', capacity: maxEncumbrance(h), discreteEnc: totalEncumbrance(h), cargo: [], placeId });
  }
  const { vehicles, beasts } = landCarriers(s, placeId);
  out.push(...vehicles, ...beasts);
  const v = vesselCarrier(s, placeId);
  if (v) out.push(v);
  return out;
}

/** Porteurs qui HÉBERGENT du vrac (`CargoLot`) : bêtes de bât, véhicules terrestres, navire — hors héros
 *  (canal discret). Cible du commerce de cargaison et du transfert. */
export function bulkCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const placeId = currentPlaceId(s);
  const { vehicles, beasts } = landCarriers(s, placeId);
  const out = [...vehicles, ...beasts];
  const v = vesselCarrier(s, placeId);
  if (v) out.push(v);
  return out;
}

const mostFree = (list: CargoCarrier[]): CargoCarrier | undefined =>
  list.reduce<CargoCarrier | undefined>((best, c) => (!best || carrierFreeEnc(c) > carrierFreeEnc(best) ? c : best), undefined);

/** Porteur DE DÉFAUT d'un achat de cargaison (verrou 4 / décision 7) : navire de campagne s'il existe,
 *  sinon le véhicule terrestre le plus libre, sinon la bête de bât la plus libre. `undefined` = le groupe
 *  n'a AUCUN porteur → le commerce de cargaison refuse (Contenance = plafond réel). */
export function primaryCargoCarrier(s: CarrierStateSlice): CargoCarrier | undefined {
  const placeId = currentPlaceId(s);
  const v = vesselCarrier(s, placeId);
  if (v) return v;
  const { vehicles, beasts } = landCarriers(s, placeId);
  return mostFree(vehicles) ?? mostFree(beasts);
}

/** Une référence à un lot de vrac (porteur + index) — pour lister/vendre/brader à travers tous les porteurs. */
export interface CargoRef { carrierId: string; carrierLabel: string; index: number; lot: CargoLot; }

/** Tous les lots de vrac du groupe, à plat (avec leur porteur) — surface de vente/bradage du marché. */
export function bulkCargoRefs(s: CarrierStateSlice): CargoRef[] {
  const out: CargoRef[] = [];
  for (const c of bulkCarriers(s)) c.cargo.forEach((lot, index) => out.push({ carrierId: c.id, carrierLabel: c.label, index, lot }));
  return out;
}

/** Enc TOTAL de vrac transporté par le groupe (tous porteurs de vrac) — malus de renflouage (l.99), tuile Cale. */
export function partyCargoTotalEnc(s: CarrierStateSlice): number {
  return bulkCarriers(s).reduce((sum, c) => sum + cargoTotalEnc(c.cargo), 0);
}

/** Enc de vrac porté par les BÊTES/VÉHICULES du groupe (hors navire) — tuile Chargement terre/fleuve. PUR. */
export function partyItemsCargoEnc(party: Combatant[]): number {
  return party.filter(heroInParty).flatMap((h) => h.items ?? [])
    .reduce((s, it) => s + (itemCarrierCapacity(it) != null ? cargoTotalEnc(it.cargo ?? []) : 0), 0);
}

/** Contenance CUMULÉE des bêtes/véhicules du groupe (hors navire) — dénominateur de la tuile Chargement. PUR. */
export function partyLandCapacity(party: Combatant[]): number {
  return party.filter(heroInParty).flatMap((h) => h.items ?? [])
    .reduce((s, it) => s + (itemCarrierCapacity(it) ?? 0), 0);
}

/** Retrouve un porteur du groupe par son id STABLE. */
export function carrierById(s: CarrierStateSlice, id: string): CargoCarrier | undefined {
  return partyCarriers(s).find((c) => c.id === id);
}

/** Porteurs de VRAC TERRESTRES du convoi (bêtes/véhicules — hors navire) : cible du vol terrestre. */
export function landBulkCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const { vehicles, beasts } = landCarriers(s, currentPlaceId(s));
  return [...vehicles, ...beasts];
}

/** VOL TERRESTRE GRADUÉ (#327 A5.1, arbitrage 2026-07-11) : quand une péripétie dangereuse terrestre se
 *  solde par un combat, la cargaison des porteurs du convoi subit un % d'Enc SELON L'ISSUE — combat gagné
 *  = rien ; fuite = `landRobberyFleePct` ; défaite = `landRobberyLossPct` (params maison). Retire des lots
 *  RÉELS (tronc `spoilCargoByPct`) et renvoie le patch d'état (`persistCarriersCargo`) + l'Enc perdu par
 *  porteur — le call-site (store) journalise en Consequence structurée. */
export function applyLandCargoRaid(
  s: CarrierStateSlice, outcome: CargoRaidOutcome,
): { patch: Partial<GameState>; pct: number; losses: { label: string; removed: number }[] } {
  const pct = cargoRaidLossPct(outcome, Number(rule('landRobberyFleePct')), Number(rule('landRobberyLossPct')));
  const losses: { label: string; removed: number }[] = [];
  const updates: { carrierId: string; cargo: CargoLot[] }[] = [];
  if (pct > 0) for (const c of landBulkCarriers(s)) {
    if (!c.cargo.length) continue;
    const r = spoilCargoByPct(c.cargo, pct);
    if (r.removed) { updates.push({ carrierId: c.id, cargo: r.lots }); losses.push({ label: c.label, removed: r.removed }); }
  }
  return { patch: updates.length ? persistCarriersCargo(s, updates) : {}, pct, losses };
}

/** RE-PERSISTE la cargaison de N porteurs sur leur source unique (verrou 1) : cale du navire
 *  (`vessel.cargo`) ou `ItemInstance.cargo` de la bête/véhicule possédé. Renvoie le patch d'état
 *  (`vessel`/`party`) à passer au `set` — jamais un 2ᵉ compteur. */
export function persistCarriersCargo(s: CarrierStateSlice, updates: { carrierId: string; cargo: CargoLot[] }[]): Partial<GameState> {
  const map = new Map(updates.map((u) => [u.carrierId, u.cargo]));
  const patch: Partial<GameState> = {};
  if (s.vessel && map.has(CAMPAIGN_VESSEL_CARRIER_ID)) {
    patch.vessel = { ...s.vessel, cargo: map.get(CAMPAIGN_VESSEL_CARRIER_ID)! };
  }
  let touched = false;
  const party = s.party.map((h) => {
    if (!h.items?.length) return h;
    let itemTouched = false;
    const items = h.items.map((item) => {
      if (!map.has(item.uid)) return item;
      itemTouched = true;
      return { ...item, cargo: map.get(item.uid)! };
    });
    if (!itemTouched) return h;
    touched = true;
    return { ...h, items };
  });
  if (touched) patch.party = party;
  return patch;
}
