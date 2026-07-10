import { describe, it, expect } from 'vitest';
import { VEHICLES_LIST } from '../engine/travel';
import { vehicleCombatant } from '../engine/vehicle';
import { shipHitLocation } from '../engine/combat';

// MDG ch.12 = navires MARITIMES (18). Les bateaux FLUVIAUX T2C (propulsion:'fluvial') ont aussi une
// facette `ship` mais relèvent de leur propre table (T2C ch.5) — couverts par `16-embuscade-fluviale`.
const ships = VEHICLES_LIST.filter((v) => v.ship && v.hull?.propulsion === 'maritime');

describe('Navires MDG (ch.12) — profils en donnée', () => {
  it('18 navires (table EXEMPLES DE BATEAUX complète), chacun avec coque (E/B/rig) + facette ship complète', () => {
    expect(ships.length).toBe(18);
    for (const s of ships) {
      expect(s.hull?.char.endurance).toBeGreaterThan(0);
      expect(s.hull?.char.B).toBeGreaterThan(0);
      expect(['avirons', 'voile', 'mixte']).toContain(s.hull?.rig);
      expect(s.hull?.propulsion).toBe('maritime');
      expect(s.ship!.crew).toBeGreaterThan(0);
      expect(s.ship!.sail || s.ship!.oars).toBeTruthy(); // au moins un mode de propulsion
    }
  });

  it('gréement cohérent avec la propulsion (avirons/voile/mixte)', () => {
    const by = (id: string) => ships.find((s) => s.id === id)!;
    expect(by('coracle').hull!.rig).toBe('avirons'); // avirons seuls
    expect(by('caraque').hull!.rig).toBe('voile'); // voiles seules
    expect(by('langskip').hull!.rig).toBe('mixte'); // voiles + avirons
  });

  it('valeurs verbatim (Caraque E55/B90, Croiseur B275)', () => {
    expect(ships.find((s) => s.id === 'caraque')!.hull!.char).toEqual({ endurance: 55, B: 90 });
    expect(ships.find((s) => s.id === 'croiseur')!.hull!.char.B).toBe(275);
  });

  it('Bateau-trésor cathayen : ligne verbatim de la table (MDG ch.12 l.103)', () => {
    const bt = ships.find((s) => s.id === 'bateau-tresor-cathayen')!;
    expect(bt.purchase!.price.gold).toBe(10000);
    expect(bt.hull!.char).toEqual({ endurance: 50, B: 400 });
    expect(bt.hull!.rig).toBe('voile');
    expect(bt.ship!).toMatchObject({ crew: 220, manoeuvre: 0, lengthM: 130, capacity: 4000, sail: { m: 9, crew: 200 } });
  });

  it("un navire devient un Combattant à coque, frappé via la localisation de son gréement", () => {
    const cogue = VEHICLES_LIST.find((v) => v.id === 'cogue')!; // voile, E45/B50
    const c = vehicleCombatant(cogue)!;
    expect(c.bodyShape).toBe('vehicule');
    expect(c.wounds.max).toBe(50);
    expect(c.characteristics.endurance).toBe(45);
    // un coup à d100=15 sur un voilier touche le Gréement (MDG ch.13)
    expect(shipHitLocation(cogue.hull!.rig!, 15)).toBe('greement');
  });
});
