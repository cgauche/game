/**
 * Tableau des OBSESSIONS (EDOC ch.8, folio 69) — déterminant de Cible des mutations mentales qui
 * l'exigent (« Haine sporadique » → Haine (Cible) ; « Terribles phobies » → Effrayé (Cible)).
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import { OBSESSIONS, OBSESSIONS_SOURCE, rollObsession } from './obsessions';
import { attachMutation } from '../engine/corruption';
import { mutationById } from './mutations';
import type { Combatant } from '../engine/types';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 42, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], traits: [], psychTraits: [], psychState: [], mutations: [],
    ...p,
  } as Combatant;
}

describe('Tableau des Obsessions (EDOC ch.8 folio 69)', () => {
  it('couvre exactement 2d10 = 2..20 (19 entrées), source EDOC folio 69', () => {
    expect(OBSESSIONS.length).toBe(19);
    expect(OBSESSIONS[0]).toMatchObject({ min: 2, max: 2 });
    expect(OBSESSIONS[OBSESSIONS.length - 1]).toMatchObject({ min: 20, max: 20 });
    expect(OBSESSIONS_SOURCE).toEqual({ book: 'EDOC', page: 69 });
  });

  it('findTableEntry mappe les bornes (verbatim)', () => {
    expect(findTableEntry([...OBSESSIONS], 2).label).toBe('Objets inanimés');
    expect(findTableEntry([...OBSESSIONS], 8).label).toBe('Monstres');
    expect(findTableEntry([...OBSESSIONS], 11).label).toBe('Humains');
    expect(findTableEntry([...OBSESSIONS], 20).label).toBe('Bonheur');
  });

  it('rollObsession (2d10) renvoie un libellé du Tableau', () => {
    const labels = new Set(OBSESSIONS.map((e) => e.label));
    for (let s = 0; s < 30; s++) expect(labels.has(rollObsession(makeRNG(s)))).toBe(true);
  });
});

describe('Cible d’une mutation déterminée par les Obsessions', () => {
  it('« Haine sporadique » → Trait de créature Haine avec une Cible tirée sur les Obsessions', () => {
    const m = mutationById('haine-sporadique');
    expect(m).toBeTruthy();
    const c = hero();
    attachMutation(c, m!, makeRNG(7));
    const haine = (c.traits ?? []).find((t) => t.id === 'haine');
    expect(haine).toBeTruthy();
    expect(typeof haine!.arg).toBe('string');
    expect(new Set(OBSESSIONS.map((e) => e.label)).has(haine!.arg as string)).toBe(true);
  });

  it('« Terribles phobies » → Trait de créature Effrayé avec une Cible tirée sur les Obsessions', () => {
    const m = mutationById('terribles-phobies');
    expect(m).toBeTruthy();
    const c = hero();
    attachMutation(c, m!, makeRNG(3));
    const effraye = (c.traits ?? []).find((t) => t.id === 'effraye');
    expect(effraye).toBeTruthy();
    expect(new Set(OBSESSIONS.map((e) => e.label)).has(effraye!.arg as string)).toBe(true);
  });
});
