import { describe, it, expect } from 'vitest';
import { shipCrewAssignments, shipMoraleScore } from './shipCrew';
import { defaultCrewRole } from '../engine/crewMorale';
import type { Combatant, SkillInstance } from '../engine/types';
import type { Get } from './flowTypes';

// Marin minimal (carac d'instance = Dex → valeur prévisible = Dex + avances), calqué sur crew-roles.test.ts.
const mk = (id: string, dex: number, skills: { skillId: string; advances: number; spec?: string }[] = [], shipRole?: string): Combatant =>
  ({
    id, name: id, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: dex, Int: 30, FM: 30, Soc: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [], wounds: { current: 10, max: 10, base: 10 }, shipRole,
  }) as unknown as Combatant;

const hull = (crewIds: string[], creatureId = 'cogue'): Combatant =>
  ({ id: 'ship', name: 'Navire', kind: 'npc', bodyShape: 'vehicule', creatureId, crewIds, conditions: [], wounds: { current: 50, max: 50, base: 50 } }) as unknown as Combatant;

const getWith = (vessel: unknown): Get => (() => ({ vessel })) as unknown as Get;

describe('defaultCrewRole — rôle naval inféré de la meilleure compétence', () => {
  it('un spécialiste tombe sur SON rôle ; Voile pure → Timonier (avant Mousse)', () => {
    expect(defaultCrewRole(mk('a', 30, [{ skillId: 'commandement', advances: 40 }]))).toBe('capitaine');
    expect(defaultCrewRole(mk('b', 30, [{ skillId: 'projectiles', advances: 40, spec: 'Poudre noire' }]))).toBe('artilleur');
    expect(defaultCrewRole(mk('c', 30, [{ skillId: 'voile', advances: 40 }]))).toBe('timonier');
  });
});

describe('shipCrewAssignments — équipage → rôles pour un Test (MDG ch.14)', () => {
  it('rôle ÉPINGLÉ respecté ; rôle HORS du type de Test exclu', () => {
    const timonier = mk('t', 50, [{ skillId: 'voile', advances: 30 }], 'timonier');
    const artilleur = mk('g', 50, [{ skillId: 'projectiles', advances: 30, spec: 'Poudre noire' }], 'artilleur');
    const ship = hull(['t', 'g']);
    const a = shipCrewAssignments(ship, [ship, timonier, artilleur], 'manoeuvre'); // 'manoeuvre' n'inclut PAS artilleur
    expect(a.map((x) => x.roleId)).toEqual(['timonier']);
    expect(a[0].crew.id).toBe('t');
  });

  it('collision sur un rôle → garde le MEILLEUR pour ce rôle', () => {
    const c1 = mk('a', 30, [{ skillId: 'voile', advances: 20 }], 'timonier'); // Voile 50
    const c2 = mk('b', 60, [{ skillId: 'voile', advances: 20 }], 'timonier'); // Voile 80
    const ship = hull(['a', 'b']);
    const a = shipCrewAssignments(ship, [ship, c1, c2], 'manoeuvre');
    expect(a).toHaveLength(1);
    expect(a[0].crew.id).toBe('b');
  });

  it('inférence quand le rôle n’est pas épinglé', () => {
    const cap = mk('cap', 30, [{ skillId: 'commandement', advances: 40 }]); // inféré → capitaine (dans 'manoeuvre')
    const ship = hull(['cap']);
    expect(shipCrewAssignments(ship, [ship, cap], 'manoeuvre')).toEqual([{ crew: cap, roleId: 'capitaine' }]);
  });
});

describe('shipMoraleScore — pont campagne → combat', () => {
  it('coque = navire de campagne → Moral du vaisseau ; sinon défaut 75', () => {
    const ship = hull([], 'cogue');
    expect(shipMoraleScore(getWith({ vehicleId: 'cogue', morale: { score: 60 } }), ship)).toBe(60);
    expect(shipMoraleScore(getWith({ vehicleId: 'knarr', morale: { score: 60 } }), ship)).toBe(75);
    expect(shipMoraleScore(getWith(null), ship)).toBe(75);
  });
});
