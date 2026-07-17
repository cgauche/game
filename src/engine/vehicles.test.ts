import { describe, it, expect } from 'vitest';
import { vehicles, trappings } from '../data';
import { VEHICLES_LIST, TRAVEL_VEHICLES, TRAVEL_MODE_LABEL, vehicleTravel, travelModeIcon } from './travel';
import { itemFromTrappingById, itemFromVehicleById } from './items';

/**
 * Fondation données « véhicule à coque » (`vehicles.json`) — FOYER UNIQUE des transports payants.
 * On garantit l'intégrité du catalogue et l'accès data-driven (aucun `id` de véhicule codé en dur côté moteur).
 */
describe('catalogue véhicules (data-driven)', () => {
  it('expose les mêmes données via data/index et engine/travel', () => {
    expect(VEHICLES_LIST).toBe(vehicles);
    expect(VEHICLES_LIST.length).toBeGreaterThanOrEqual(2);
  });

  it('ids uniques (pas de doublon de véhicule)', () => {
    const ids = VEHICLES_LIST.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toute facette travel a un Déplacement > 0 et au moins une classe', () => {
    for (const v of TRAVEL_VEHICLES) {
      expect(v.travel!.movement).toBeGreaterThan(0);
      expect(v.travel!.classes.length).toBeGreaterThan(0);
      for (const c of v.travel!.classes) expect(c.brassPerKm).toBeGreaterThanOrEqual(0);
    }
  });

  it('diligence M6 (2/1 sous) et barge M8 (5/2 sous) — RAW LDB l.207-219', () => {
    const dil = vehicleTravel('diligence')!;
    expect(dil.movement).toBe(6);
    expect(dil.classes.map((c) => c.brassPerKm)).toEqual([2, 1]);
    const barge = vehicleTravel('barge')!;
    expect(barge.movement).toBe(8);
    expect(barge.classes.map((c) => c.brassPerKm)).toEqual([5, 2]);
  });

  it('vehicleTravel("pied") = undefined (le pied n’est pas un passage payant)', () => {
    expect(vehicleTravel('pied')).toBeUndefined();
  });

  it('libellés et pictogrammes de mode viennent de la donnée', () => {
    expect(TRAVEL_MODE_LABEL.pied).toBe('À pied');
    expect(TRAVEL_MODE_LABEL.diligence).toBe('Diligence');
    expect(travelModeIcon('pied')).toBe('travel/foot');
    expect(travelModeIcon('diligence')).toBe('travel/coach');
    expect(travelModeIcon('barge')).toBe('travel/barge');
  });
});

describe('dédup trappings ⊥ vehicles + résolution unifiée', () => {
  it('aucun id de véhicule ne subsiste en double dans trappings.json', () => {
    const trapIds = new Set(trappings.map((t) => t.id));
    const collisions = VEHICLES_LIST.filter((v) => trapIds.has(v.id)).map((v) => v.id);
    expect(collisions).toEqual([]);
  });

  it('les 6 véhicules migrés (achat) portent prix + dispo verbatim LDB p.306', () => {
    const dil = vehicles.find((v) => v.id === 'diligence')!;
    expect(dil.purchase).toEqual({ price: { gold: 150, silver: 0, bronze: 0 }, availability: 'Rare' });
    const coracle = vehicles.find((v) => v.id === 'coracle')!;
    expect(coracle.enc).toBe(6);
    expect(coracle.purchase!.price.gold).toBe(2);
  });

  it("itemFromVehicleById construit un ItemInstance d'inventaire (nom, enc, catégorie)", () => {
    const it = itemFromVehicleById('coracle')!;
    expect(it.name).toBe('Coracle');
    expect(it.enc).toBe(6);
    expect(it.subType).toBe('animaux-et-vehicules');
    expect(it.trappingId).toBe('coracle'); // re-dérivation
    expect(itemFromVehicleById('inexistant')).toBeNull();
  });

  it('un TrappingRef de carrière vers un véhicule migré résout TOUJOURS (repli vehicles)', () => {
    // careerLevels.json référence p.ex. `diligence` (Maître de diligence) et `barque` (carrières fluviales).
    for (const id of ['diligence', 'barque', 'charrette', 'chariot', 'chaland']) {
      const it = itemFromTrappingById(id);
      expect(it, id).not.toBeNull();
      expect(it!.name.length).toBeGreaterThan(0);
    }
  });

  it('hull (E/Blessures) posé là où le RAW EDOC 7 correspond sans ambiguïté', () => {
    expect(vehicles.find((v) => v.id === 'diligence')!.hull!.char).toEqual({ endurance: 45, B: 50 });
    expect(vehicles.find((v) => v.id === 'charrette')!.hull!.char).toEqual({ endurance: 25, B: 10 });
    expect(vehicles.find((v) => v.id === 'chariot')!.hull).toBeUndefined(); // 3 variantes EDOC → pas d'attribution
  });
});
