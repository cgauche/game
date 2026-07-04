import { describe, it, expect } from 'vitest';
import { creatureToCombatant, statblockToCombatant } from './spawn';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { findCreature } from '../data';

// Dérivation des propriétés psychologiques au spawn (parse des traits, LDB 21+85).
describe('spawn — propriétés psychologiques', () => {
  it('statbloc « Terreur 2 » → causesTerreur ; « Immunité Psychologique » → psychImmune', () => {
    const c = statblockToCombatant(
      { name: 'X', char: { F: 30, E: 30, FM: 30 }, traits: [{ id: 'terreur', value: 2 }, { id: 'immunite-psychologique' }] },
      'x',
      { x: 0, y: 0 },
    );
    expect(c.causesTerreur).toBe(2);
    expect(c.psychImmune).toBe(true);
  });
  it('statbloc « Peur 4 » → causesPeur ; sans trait psy → champs absents', () => {
    expect(statblockToCombatant({ name: 'Y', char: { FM: 30 }, traits: [{ id: 'peur', value: 4 }] }, 'y', { x: 0, y: 0 }).causesPeur).toBe(4);
    const plain = statblockToCombatant({ name: 'Z', char: { FM: 30 } }, 'z', { x: 0, y: 0 });
    expect(plain.causesPeur).toBeUndefined();
    expect(plain.causesTerreur).toBeUndefined();
  });
});

describe('spawn — Groupes & traits psy ciblés (P3)', () => {
  it('creatureToCombatant : groups dérivés du folder (id canonique)', () => {
    const orc = findCreature('Orc')!; // folder « Les hordes de peaux-vertes »
    const c = creatureToCombatant(orc, 'e1', { x: 0, y: 0 });
    expect(c.groups).toContain('peau-verte');
  });
  it('statblockToCombatant : extras manuels conservés dans groups', () => {
    const c = statblockToCombatant({ name: 'Fanatique', char: { B: 10 }, groups: ['sigmarite', 'cultiste'] }, 'e2', { x: 0, y: 0 });
    expect(c.groups).toEqual(expect.arrayContaining(['sigmarite', 'cultiste']));
  });
  it('statblockToCombatant : trait « Animosité (elfe) » → psychTraits (Cible = id de Groupe)', () => {
    const c = statblockToCombatant({ name: 'Nain', char: { B: 10 }, traits: [{ id: 'animosite', arg: 'elfe' }] }, 'e3', { x: 0, y: 0 });
    expect(c.psychTraits).toEqual([{ type: 'animosite', cible: 'elfe' }]);
  });
  it('createHero : groups = racial(espèce) + carrière (ids)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    expect(h.groups).toEqual(expect.arrayContaining(['humain', 'soldat']));
  });
});
