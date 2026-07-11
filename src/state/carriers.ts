/**
 * COUTURE D'ÉTAT du PORTEUR DE CHARGE (#327, lot B) — expose les porteurs RÉELS du groupe comme des
 * `CargoCarrier` (tronc PUR `engine/cargo.ts`). Ce module RÉSOUT la capacité depuis les objets réels
 * (héros → `maxEncumbrance` ; bête de bât → `MountProfile.encPortee` ; véhicule terrestre →
 * `VehicleData.chargement` ; navire de campagne → `ship.capacity`) que le tronc, pur, ne connaît pas.
 *
 * SOURCE UNIQUE PAR PORTEUR (verrou 1 de la conception) : le carrier LIT le stock réel, il ne le double
 * pas — la cale du navire reste `CampaignVessel.cargo`, la cargaison en bât reste `ItemInstance.cargo`,
 * le convoi terrestre abstrait reste `state.caravanCargo`. Aucun 2ᵉ silo. Les mutations passent par le
 * tronc (`loadCargo`/`unloadCargo`/`transferCargo`) puis sont re-persistées sur ces mêmes champs (lot C).
 */
import type { Combatant } from '../engine/types';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { mountProfileForTrapping } from '../engine/mountTravel';
import { findVehicleById } from '../data';
import { placeOfScene } from './worldMap';
import type { CargoCarrier } from '../engine/cargo';
import type { GameState } from './store';

/** Tranche d'état lue pour dresser les porteurs — évite de dépendre du store entier (testable à plat). */
export type CarrierStateSlice = Pick<GameState, 'party' | 'vessel' | 'caravanCargo' | 'worldMap' | 'scene'>;

/** id STABLE du porteur « navire de campagne » (un seul en jeu). */
export const CAMPAIGN_VESSEL_CARRIER_ID = 'vessel';
/** id STABLE du convoi terrestre abstrait (cargaison de groupe non encore matérialisée sur un véhicule). */
export const CARAVAN_CARRIER_ID = 'convoi';

/** Lieu courant du groupe (co-localisation par défaut de tous ses porteurs à terre). */
function currentPlaceId(s: CarrierStateSlice): string | undefined {
  return placeOfScene(s.worldMap, s.scene?.id ?? undefined)?.id;
}

/** Porteurs de BÂT/CHARGEMENT possédés par un héros : ses bêtes de somme (profil EDOC `encPortee`) et
 *  ses véhicules terrestres (`chargement`), matérialisés en `ItemInstance`. */
function heroBeastsAndVehicles(h: Combatant, placeId: string | undefined): CargoCarrier[] {
  const out: CargoCarrier[] = [];
  for (const item of h.items ?? []) {
    if (item.destroyed) continue;
    const profile = item.trappingId ? mountProfileForTrapping(item.trappingId) : undefined;
    if (profile) {
      out.push({ id: item.uid, label: item.name, hull: 'jambes', capacity: profile.encPortee, discreteEnc: 0, cargo: item.cargo ?? [], placeId, aboard: item.aboard });
      continue;
    }
    const chargement = item.trappingId ? findVehicleById(item.trappingId)?.chargement : undefined;
    if (chargement != null) {
      out.push({ id: item.uid, label: item.name, hull: 'jambes', capacity: chargement, discreteEnc: 0, cargo: item.cargo ?? [], placeId, aboard: item.aboard });
    }
  }
  return out;
}

/** TOUS les porteurs de charge réels du groupe, dans l'ordre héros → bêtes/véhicules → convoi → navire.
 *  Chaque carrier LIT sa source unique (aucune copie persistée). */
export function partyCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const placeId = currentPlaceId(s);
  const out: CargoCarrier[] = [];
  for (const h of s.party) {
    if (h.dead || h.outOfRencontre) continue;
    // Le héros lui-même : contenu = objets DISCRETS (transfert d'objet = giveTrapping, hors canal vrac).
    out.push({ id: h.id, label: h.name, hull: 'jambes', capacity: maxEncumbrance(h), discreteEnc: totalEncumbrance(h), cargo: [], placeId });
    out.push(...heroBeastsAndVehicles(h, placeId));
  }
  // Convoi terrestre abstrait (`caravanCargo`) : « information, pas plafond » tant qu'aucun véhicule ne le
  // porte (landMarketFlow) → capacité non plafonnée. Matérialisation sur un véhicule = lot C.
  const caravan = s.caravanCargo ?? [];
  if (caravan.length) {
    out.push({ id: CARAVAN_CARRIER_ID, label: 'Convoi', hull: 'jambes', capacity: Infinity, discreteEnc: 0, cargo: caravan, placeId });
  }
  // Navire de campagne : la cale (`vessel.cargo`) EST la source unique (verrou 1) ; Contenance = donnée navale.
  const vessel = s.vessel;
  if (vessel) {
    const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
    out.push({ id: CAMPAIGN_VESSEL_CARRIER_ID, label: vessel.name ?? findVehicleById(vessel.vehicleId)?.label ?? 'Navire', hull: 'coque', capacity, discreteEnc: 0, cargo: vessel.cargo ?? [], placeId });
  }
  return out;
}

/** Retrouve un porteur du groupe par son id STABLE. */
export function carrierById(s: CarrierStateSlice, id: string): CargoCarrier | undefined {
  return partyCarriers(s).find((c) => c.id === id);
}
