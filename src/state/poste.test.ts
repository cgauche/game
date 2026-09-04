import { describe, it, expect } from 'vitest';
import { activityAsPoste, crewRoleAsPoste, stationAsPoste, type Poste } from './poste';
import { activitiesFor } from '../engine/activities';
import { crewRoles, findCrewRoleById, findShipStation, shipStations } from '../data';

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

  it('stationAsPoste projette une STATION à bord en Poste slotFilling, SANS compétence', () => {
    const st = findShipStation('avirons')!;
    expect(st).toBeTruthy();
    const p = stationAsPoste(st);
    expect(p.id).toBe('avirons');
    expect(p.label).toBe(st.label);
    expect(p.icon).toBeUndefined();
    // Aucune Compétence ne qualifie une PRÉSENCE : le livre demande qui s'y TROUVE (MDG 13 l.751),
    // pas qui sait y servir — l'inférence « auto » de la surface partagée n'a rien à proposer.
    expect(p.skills).toEqual([]);
    expect(p.desc).toBe(st.desc);
    expect(p.cardinality).toBe('slotFilling');
  });

  it('les CINQ stations se projettent sans exception, et aucune ne porte de compétence', () => {
    const postes: Poste[] = shipStations.map(stationAsPoste);
    expect(postes.map((p) => p.id)).toEqual(['pont', 'greement', 'nid-de-pie', 'avirons', 'cale']);
    for (const p of postes) {
      expect(p.label, p.id).toBeTruthy();
      expect(p.skills, p.id).toEqual([]);
      expect(p.cardinality, p.id).toBe('slotFilling');
    }
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
