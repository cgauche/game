import { describe, it, expect } from 'vitest';
import type { Characteristics, Combatant, ItemInstance } from '../engine/types';
import type { CargoLot } from '../engine/cargo';
import { carrierUsedEnc } from '../engine/cargo';
import { partyCarriers, carrierById, CAMPAIGN_VESSEL_CARRIER_ID, CARAVAN_CARRIER_ID, type CarrierStateSlice } from './carriers';

const chars = (F = 30, E = 30): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: F, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

function hero(id: string, items: ItemInstance[] = [], F = 30, E = 30): Combatant {
  return {
    id, name: id, kind: 'hero', characteristics: chars(F, E),
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items, skills: [], talents: [], movement: 4,
  };
}

const item = (uid: string, over: Partial<ItemInstance> = {}): ItemInstance => ({ uid, name: uid, kind: 'misc', qualities: [], enc: 0, equipped: false, ...over });
const lot = (cargoId: string, enc: number): CargoLot => ({ cargoId, enc, basePriceGold: 1 });

const slice = (over: Partial<CarrierStateSlice> = {}): CarrierStateSlice => ({
  party: [], vessel: null, caravanCargo: [], worldMap: null, scene: null, ...over,
} as CarrierStateSlice);

describe('partyCarriers — couture d’état des porteurs (#327 lot B)', () => {
  it('un héros est un porteur à jambes : capacité = BF+BE, occupé = totalEncumbrance', () => {
    // F=40,E=40 → BF+BE = 4+4 = 8 ; deux objets non rangés à 2 Enc → occupé 4.
    const h = hero('nel', [item('a', { enc: 2 }), item('b', { enc: 2 })], 40, 40);
    const carriers = partyCarriers(slice({ party: [h] }));
    const hc = carriers.find((c) => c.id === 'nel')!;
    expect(hc).toMatchObject({ hull: 'jambes', capacity: 8 });
    expect(carrierUsedEnc(hc)).toBe(4);
    expect(hc.cargo).toEqual([]); // le héros porte des objets DISCRETS, pas du vrac
  });

  it('une bête de bât (trapping monture) expose encPortee comme capacité et lit item.cargo', () => {
    const mule = item('m1', { trappingId: 'mule', cargo: [lot('vin', 6)] }); // poney-ane-ou-mule → encPortee 14
    const carriers = partyCarriers(slice({ party: [hero('nel', [mule])] }));
    const mc = carriers.find((c) => c.id === 'm1')!;
    expect(mc).toMatchObject({ hull: 'jambes', capacity: 14 });
    expect(mc.cargo).toBe(mule.cargo); // SOURCE UNIQUE : le carrier lit le stock réel de l’instance
    expect(carrierUsedEnc(mc)).toBe(6);
  });

  it('un véhicule terrestre possédé expose chargement comme capacité', () => {
    const cart = item('v1', { trappingId: 'charrette' }); // vehicles.json chargement 25
    const mc = partyCarriers(slice({ party: [hero('nel', [cart])] })).find((c) => c.id === 'v1')!;
    expect(mc).toMatchObject({ hull: 'jambes', capacity: 25 });
  });

  it('le convoi terrestre abstrait (caravanCargo) est un porteur NON plafonné, source = caravanCargo', () => {
    const caravan = [lot('sel', 40)];
    const cc = carrierById(slice({ caravanCargo: caravan }), CARAVAN_CARRIER_ID)!;
    expect(cc.capacity).toBe(Infinity);
    expect(cc.cargo).toBe(caravan);
  });

  it('le navire de campagne : Contenance navale + cale = vessel.cargo (source unique, verrou 1)', () => {
    const cargo = [lot('vin', 50)];
    const vessel = { vehicleId: 'barge', name: 'Le Cormoran', cargo } as CarrierStateSlice['vessel'];
    const vc = carrierById(slice({ vessel }), CAMPAIGN_VESSEL_CARRIER_ID)!;
    expect(vc).toMatchObject({ hull: 'coque', capacity: 300, label: 'Le Cormoran' }); // barge ship.capacity 300
    expect(vc.cargo).toBe(cargo); // pas de double stock
  });

  it('les héros morts / hors rencontre ne sont pas des porteurs', () => {
    const dead = { ...hero('mort'), dead: true };
    expect(partyCarriers(slice({ party: [dead] })).some((c) => c.id === 'mort')).toBe(false);
  });
});
