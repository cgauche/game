import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { findVehicleById } from '../data';
import { vehicleCombatant, applyVehicleProblem } from './vehicle';

describe('véhicule-à-coque (Combatant à PV)', () => {
  it('bâtit une coque depuis la facette hull (Diligence E45/B50)', () => {
    const diligence = findVehicleById('diligence')!;
    const c = vehicleCombatant(diligence)!;
    expect(c.id).toBe('vehicle-diligence');
    expect(c.name).toBe('Diligence');
    expect(c.bodyShape).toBe('vehicule');
    expect(c.characteristics.E).toBe(45);
    expect(c.wounds).toEqual({ current: 50, max: 50, base: 50 });
    expect(c.psychImmune).toBe(true);
  });

  it('sans facette hull → pas de coque (transport sans entité à PV)', () => {
    const chariot = findVehicleById('chariot')!; // transport terrestre simple, pas de `hull`
    expect(vehicleCombatant(chariot)).toBeUndefined();
  });

  it('Problème « Accident » (96-100) inflige 2d10 − Bonus d\'Endurance à la coque (min 1)', () => {
    const c = vehicleCombatant(findVehicleById('diligence')!)!; // BE = 4
    // makeRNG seedé : l'`applyOps`/`wounds` consomme le même flux que le test — on vérifie le RÉSULTAT.
    const r = applyVehicleProblem(c, 96, makeRNG(7));
    expect(r.entry.id).toBe('accident');
    const dealt = 50 - c.wounds.current;
    expect(dealt).toBeGreaterThanOrEqual(1); // 2d10 (2..20) − 4, plancher 1
    expect(dealt).toBeLessThanOrEqual(16);
  });

  it('Problème « Incontrôlable » (1-50) n\'endommage PAS la coque', () => {
    const c = vehicleCombatant(findVehicleById('diligence')!)!;
    const r = applyVehicleProblem(c, 10, makeRNG(1));
    expect(r.entry.id).toBe('incontrolable');
    expect(c.wounds.current).toBe(50); // aucun vehicleWounds
  });

  it('Problème « Cassé » (80-95) applique 1d10 − BE (min 1) et journalise', () => {
    const c = vehicleCombatant(findVehicleById('charrette')!)!; // E25/B10, BE = 2
    const r = applyVehicleProblem(c, 85, makeRNG(3));
    expect(r.entry.id).toBe('casse');
    expect(c.wounds.current).toBeLessThan(10);
    expect(c.wounds.current).toBeGreaterThanOrEqual(0);
    expect(r.lines.length).toBeGreaterThan(0);
  });
});
