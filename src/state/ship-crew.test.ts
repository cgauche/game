import { describe, it, expect } from 'vitest';
import { shipCrewAssignments, shipMoraleScore, shipDefaultRoles, crewTestContributors } from './shipCrew';
import { defaultCrewRole } from '../engine/crewMorale';
import { traumaById } from '../engine/trauma';
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

describe('defaultCrewRole — rôle naval inféré de la meilleure COMPÉTENCE (MDG 14 l.38-39)', () => {
  it('le rôle où sa meilleure compétence POSSÉDÉE est la plus haute (testValue = carac + avances)', () => {
    // Une seule compétence de marin → son rôle. Compétence = Dex 30 + avances (carac d'instance = Dex).
    expect(defaultCrewRole(mk('a', 30, [{ skillId: 'commandement', advances: 40 }]))).toBe('capitaine'); // Cmd 70
    expect(defaultCrewRole(mk('b', 30, [{ skillId: 'projectiles', advances: 40, spec: 'poudre-noire' }]))).toBe('artilleur'); // Proj 70
    // Voile 70 concourt pour Timonier ET Mousse (ex æquo) → Timonier, premier maximum (ordre du catalogue).
    expect(defaultCrewRole(mk('c', 30, [{ skillId: 'voile', advances: 40 }]))).toBe('timonier');
  });

  it('la COMPÉTENCE la plus haute décide entre deux rôles possédés', () => {
    // Guérison Dex 30 + 50 = 80 (Chirurgien) VS Perception Dex 30 + 30 = 60 (Vigie) → Chirurgien.
    const soigneur = mk('h', 30, [
      { skillId: 'guerison', advances: 50 },
      { skillId: 'perception', advances: 30 },
    ]);
    expect(defaultCrewRole(soigneur)).toBe('chirurgien');
  });

  it('Mousse par défaut si le membre sait Ramer/Voile sans autre rôle ; sinon null (le joueur assigne, l.39)', () => {
    // Ramer n'alimente que le rôle Mousse → Mousse.
    expect(defaultCrewRole(mk('r', 30, [{ skillId: 'ramer', advances: 20 }]))).toBe('mousse');
    // Aucune compétence de marin → pas de rôle par défaut.
    expect(defaultCrewRole(mk('x', 30, [{ skillId: 'crochetage', advances: 40 }]))).toBeNull();
    expect(defaultCrewRole(mk('y', 30, []))).toBeNull();
  });
});

describe('shipCrewAssignments — équipage → rôles pour un Test (MDG ch.14)', () => {
  it('rôle ÉPINGLÉ respecté ; rôle HORS du type de Test exclu', () => {
    const timonier = mk('t', 50, [{ skillId: 'voile', advances: 30 }], 'timonier');
    const artilleur = mk('g', 50, [{ skillId: 'projectiles', advances: 30, spec: 'poudre-noire' }], 'artilleur');
    const ship = hull(['t', 'g']);
    const a = shipCrewAssignments(ship, [ship, timonier, artilleur], 'manoeuvre'); // 'manoeuvre' n'inclut PAS artilleur
    expect(a.map((x) => x.roleId)).toEqual(['timonier']);
    expect(a[0].crew.id).toBe('t');
  });

  it('plusieurs membres au MÊME rôle (MDG ch.14 l.9 « plusieurs Personnages peuvent contribuer ») → tous contribuent', () => {
    const c1 = mk('a', 30, [{ skillId: 'voile', advances: 20 }], 'timonier'); // Voile 50
    const c2 = mk('b', 60, [{ skillId: 'voile', advances: 20 }], 'timonier'); // Voile 80
    const ship = hull(['a', 'b']);
    const a = shipCrewAssignments(ship, [ship, c1, c2], 'manoeuvre');
    expect(a).toHaveLength(2); // les DEUX au poste de Timonier (DR sommés), pas « le meilleur seul »
    expect(a.every((x) => x.roleId === 'timonier')).toBe(true);
  });

  it('inférence quand le rôle n’est pas épinglé', () => {
    const cap = mk('cap', 30, [{ skillId: 'commandement', advances: 40 }]); // inféré → capitaine (dans 'manoeuvre')
    const ship = hull(['cap']);
    expect(shipCrewAssignments(ship, [ship, cap], 'manoeuvre')).toEqual([{ crew: cap, roleId: 'capitaine' }]);
  });
});

describe('shipDefaultRoles — défaut GLOBAL : essentiel rempli en 1er + PJ étalés (MDG ch.14)', () => {
  it('remplit l’ESSENTIEL d’abord puis étale (pas 2 sur le même poste spécifique)', () => {
    const cap = mk('cap', 50, [{ skillId: 'commandement', advances: 30 }]); // → Capitaine
    const nav = mk('nav', 50, [{ skillId: 'orientation', advances: 30 }]);   // → Navigateur
    const helm = mk('helm', 40, [{ skillId: 'voile', advances: 0 }]);        // seul à la Voile → Timonier (essentiel)
    const m2 = mk('m2', 40, [{ skillId: 'ramer', advances: 0 }]);            // Ramer → Mousse (catch-all)
    const roles = shipDefaultRoles([cap, nav, helm, m2], 'manoeuvre');
    expect(roles.get('helm')).toBe('timonier');  // essentiel rempli EN PREMIER
    expect(roles.get('cap')).toBe('capitaine');
    expect(roles.get('nav')).toBe('navigateur'); // étalé — PAS un 2e Capitaine
    expect(roles.get('m2')).toBe('mousse');
  });

  it('un rôle ÉPINGLÉ est respecté et peut être MULTI (l.9)', () => {
    const a = mk('a', 50, [{ skillId: 'voile', advances: 20 }], 'timonier');
    const b = mk('b', 60, [{ skillId: 'voile', advances: 20 }], 'timonier');
    const roles = shipDefaultRoles([a, b], 'manoeuvre');
    expect(roles.get('a')).toBe('timonier');
    expect(roles.get('b')).toBe('timonier'); // 2 épinglés au même poste = OK
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

describe('crewTestContributors — sens transmis au RANKING du marin représentant (#158)', () => {
  it('Test VISUEL (phare, sense "vue") : ne pénalise pas un marin sourd dans le choix du représentant', () => {
    // Deux marins « vigie », aucun PJ → UN représentant choisi par crewRoleValue (l.39/41).
    const deaf = { ...mk('deaf', 40, [{ skillId: 'perception', advances: 0 }], 'vigie'), traumas: [traumaById('surdite', undefined, 'tete')] } as Combatant;
    const hearing = mk('hearing', 30, [{ skillId: 'perception', advances: 0 }], 'vigie');
    const ship = hull([deaf.id, hearing.id]);
    const crew = [deaf, hearing];
    const noPJ = new Set<string>();
    // Sans sens : la Surdité pénalise (conservateur) → deaf 20 < hearing 30 → le NON-sourd représente.
    expect(crewTestContributors(ship, crew, 'perception', noPJ).find((a) => a.roleId === 'vigie')!.crew.id).toBe('hearing');
    // Sens 'vue' : la Surdité ne vise QUE l'ouïe → deaf 40 > hearing 30 → le SOURD (meilleur) représente.
    expect(crewTestContributors(ship, crew, 'perception', noPJ, 'vue').find((a) => a.roleId === 'vigie')!.crew.id).toBe('deaf');
  });
});
