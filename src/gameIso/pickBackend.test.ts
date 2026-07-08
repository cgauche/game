import { describe, it, expect, vi } from 'vitest';
import { pickBackend } from './pickBackend';
import type { SceneEntity } from '../state/scene';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';

const ent = (over: Partial<SceneEntity>): SceneEntity => ({ id: 'x', kind: 'prop', pos: { x: 0, y: 0 }, ...over });

describe('pickBackend — classifieur de backend (rig / plan / sprite)', () => {
  it('leader absent (groupe vide) → jeton VIDE (rig), id __party — plus de sprite villageois', () => {
    const r = pickBackend({ kind: 'partyLeader', leader: undefined });
    expect(r.backend).toBe('rig');
    expect(r.id).toBe('__party');
  });

  it('entité prop sans ref → sprite, id préfixé e-', () => {
    const r = pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'a', kind: 'prop' }) });
    expect(r.backend).toBe('sprite');
    expect(r.id).toBe('e-a');
  });

  it('personnage humanoïde (Villageois) → rig', () => {
    const r = pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'b', kind: 'personnage', ref: 'Villageois' }) });
    expect(r.backend).toBe('rig');
    expect(r.id).toBe('e-b');
  });

  it('personnage créature non-bipède (id rat-geant → espèce du record) → plan (fin de l’asymétrie sprite figé)', () => {
    const r = pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'c', kind: 'personnage', ref: 'rat-geant' }) });
    expect(r.backend).toBe('plan');
    expect(r.id).toBe('e-c');
  });
});

describe('pickBackend — coque de véhicule en COMBAT (#224 : routage par creatureId, pas par name)', () => {
  for (const id of ['cogue', 'loup-imperial']) {
    it(`combattant « ${id} » route vers le gabarit navire (jamais bipède)`, () => {
      const v = findVehicleById(id)!;
      expect(v?.hull).toBeTruthy();
      const c = vehicleCombatant(v, `g-${id}`)!;
      const r = pickBackend({ kind: 'combatant', combatant: c });
      expect(r.backend).toBe('plan');
    });

    it(`combattant « ${id} » renommé (label ≠ id) route toujours par creatureId, pas par name`, () => {
      const v = findVehicleById(id)!;
      const c = vehicleCombatant(v, `g-${id}-renamed`)!;
      c.name = 'Un Ennemi Sans Nom De Créature Valide';
      expect(c.creatureId).toBe(id);
      const r = pickBackend({ kind: 'combatant', combatant: c });
      expect(r.backend).toBe('plan');
    });
  }

  it('la garde DEV ne hurle pas pour une sceneEntity dont la ref est une coque de véhicule valide', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pickBackend({ kind: 'sceneEntity', ent: ent({ id: 'd', kind: 'personnage', ref: 'cogue' }) });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
