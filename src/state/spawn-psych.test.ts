import { describe, it, expect } from 'vitest';
import { creatureToCombatant, statblockToCombatant } from './spawn';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { findCreature, findCreatureById } from '../data';

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
  it('creatureToCombatant : Talent Béni(Sigmar/Ulric) de la donnée → Groupe religieux (fixe le trou Phase 2)', () => {
    const pretreSigmar = findCreature('Prêtre de Sigmar')!;
    expect(creatureToCombatant(pretreSigmar, 'e4', { x: 0, y: 0 }).groups).toContain('sigmarite');
    const pretreUlric = findCreature('Prêtre D’ulric')!;
    expect(creatureToCombatant(pretreUlric, 'e5', { x: 0, y: 0 }).groups).toContain('ulricain');
  });
});

describe('DONNÉE creatures.json — cibles psy recalées vers un id de Groupe MAX FIDÉLITÉ (re-map Phase 2 → Phase psy)', () => {
  it('Bella la Noire : Animosité « Les riches, Les hommes-bêtes » → noble + homme-bete ; Préjugé « Baillis, Juristes » → bailli + juriste', () => {
    const c = creatureToCombatant(findCreature('Bella la Noire')!, 'p1', { x: 0, y: 0 });
    expect(c.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'noble' },
      { type: 'animosite', cible: 'homme-bete' },
      { type: 'prejuge', cible: 'bailli' },
      { type: 'prejuge', cible: 'juriste' },
    ]));
  });
  it('Eusapia Balacañon : Animosité « Tiléens » → tileen', () => {
    const c = creatureToCombatant(findCreature('Eusapia Balacañon')!, 'p2', { x: 0, y: 0 });
    expect(c.psychTraits).toEqual(expect.arrayContaining([{ type: 'animosite', cible: 'tileen' }]));
  });
  it('Hyppogriffe / Fanatique Gobelin / Brochet du Stir : Animosité « Tout »/« toutes les créatures !!! » → tout', () => {
    expect(creatureToCombatant(findCreature('Hyppogriffe')!, 'p3', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'animosite', cible: 'tout' }]));
    expect(creatureToCombatant(findCreature('Fanatique Gobelin')!, 'p4', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'animosite', cible: 'tout' }]));
    // Label « Brochet du Stir » ambigu (2 créatures homonymes, Zoo Impérial vs Bestiaire fluvial) → id STABLE.
    expect(creatureToCombatant(findCreatureById('brochet-du-stir-fluvial')!, 'p5', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'animosite', cible: 'tout' }]));
  });
  it('Chauve-souris vampire (Varghulf) / Vhargulf : Haine « Vivant »/« Êtres Vivants » → vivant', () => {
    expect(creatureToCombatant(findCreature('Chauve-souris vampire (Varghulf)')!, 'p6', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'haine', cible: 'vivant' }]));
    expect(creatureToCombatant(findCreature('Vhargulf')!, 'p7', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'haine', cible: 'vivant' }]));
  });
  it('Babrakkos : Haine « Teutogens » → teutogen', () => {
    const c = creatureToCombatant(findCreature('Babrakkos')!, 'p8', { x: 0, y: 0 });
    expect(c.psychTraits).toEqual(expect.arrayContaining([{ type: 'haine', cible: 'teutogen' }]));
  });
  it('Grain d’achillée le lutin : Préjugé « Créatures mortelles » → vivant', () => {
    const c = creatureToCombatant(findCreature('Grain d\'achillée le lutin')!, 'p9', { x: 0, y: 0 });
    expect(c.psychTraits).toEqual(expect.arrayContaining([{ type: 'prejuge', cible: 'vivant' }]));
  });
  it('Triton : Animosité « Elfes noirs » → elfe-noir', () => {
    const c = creatureToCombatant(findCreature('Triton')!, 'p10', { x: 0, y: 0 });
    expect(c.psychTraits).toEqual(expect.arrayContaining([{ type: 'animosite', cible: 'elfe-noir' }]));
  });
  it('Brigitte Schleigel : Préjugé « aristocrates, réactionnaires, miliciens, nantis, utilisateurs de mystracine » → noble + 1 reste inerte (aucun Groupe)', () => {
    const c = creatureToCombatant(findCreature('Brigitte Schleigel')!, 'p11', { x: 0, y: 0 });
    const prejuges = (c.psychTraits ?? []).filter((p) => p.type === 'prejuge');
    expect(prejuges).toEqual(expect.arrayContaining([{ type: 'prejuge', cible: 'noble' }]));
    expect(prejuges.some((p) => p.cible === undefined)).toBe(true); // réactionnaires/miliciens/mystracine : aucun Groupe
  });
  it('Ogre (Maigrichons) / Jetsam (Feu) / Volée de Noctecorbes (Lumière) / Sangsues (Sel) / créanciers / Étrangers / subjectifs : RESTENT inertes (aucun référent combattant)', () => {
    expect(creatureToCombatant(findCreature('Ogre')!, 'p12', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'prejuge', cible: undefined }]));
    expect(creatureToCombatant(findCreature('Jetsam - la Gelée Intelligente')!, 'p13', { x: 0, y: 0 }).psychTraits)
      .toEqual(expect.arrayContaining([{ type: 'phobie', cible: undefined, indice: 0 }]));
  });
});
