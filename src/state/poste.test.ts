import { describe, it, expect } from 'vitest';
import { activityAsPoste, crewRoleAsPoste, type Poste } from './poste';
import { activitiesFor } from '../engine/activities';
import { crewRoles, findCrewRoleById } from '../data';

describe('poste — adaptateurs de projection (donnée-vue commune)', () => {
  it('activityAsPoste projette une Activité de voyage en Poste heroExclusive', () => {
    const def = activitiesFor('voyage').find((a) => a.id === 'plein-air')!;
    expect(def).toBeTruthy();
    const p = activityAsPoste(def);
    expect(p.id).toBe('plein-air');
    expect(p.label).toBe(def.label);
    expect(p.icon).toBe(def.icon); // les activités portent une icône
    expect(p.skills).toEqual(def.skills ?? []);
    expect(p.desc).toBe(def.desc);
    expect(p.cardinality).toBe('heroExclusive');
  });

  it("activityAsPoste : une Activité sans skills (Récupérer) projette skills=[]", () => {
    const def = activitiesFor('voyage').find((a) => a.id === 'recuperer')!;
    expect(def).toBeTruthy();
    const p = activityAsPoste(def);
    expect(p.skills).toEqual([]);
    expect(p.cardinality).toBe('heroExclusive');
  });

  it('crewRoleAsPoste projette un rôle d’équipage en Poste slotFilling, sans icône', () => {
    const r = findCrewRoleById('capitaine')!;
    expect(r).toBeTruthy();
    const p = crewRoleAsPoste(r);
    expect(p.id).toBe('capitaine');
    expect(p.label).toBe(r.label);
    expect(p.icon).toBeUndefined(); // les rôles d'équipage n'ont pas d'icône
    expect(p.skills).toEqual(r.skills);
    expect(p.desc).toBe(r.desc);
    expect(p.cardinality).toBe('slotFilling');
  });

  it('crewRoleAsPoste : le Mousse (2 compétences) conserve les deux', () => {
    const r = findCrewRoleById('mousse')!;
    const p = crewRoleAsPoste(r);
    expect(p.skills.map((s) => s.id)).toEqual(['voile', 'ramer']);
  });

  it('tous les rôles d’équipage se projettent sans exception (id/label stables)', () => {
    const postes: Poste[] = crewRoles.map(crewRoleAsPoste);
    expect(postes.length).toBe(crewRoles.length);
    for (const p of postes) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.cardinality).toBe('slotFilling');
    }
  });
});
