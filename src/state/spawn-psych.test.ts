import { describe, it, expect } from 'vitest';
import { statblockToCombatant } from './spawn';

// Dérivation des propriétés psychologiques au spawn (parse des traits, LDB 21+85).
describe('spawn — propriétés psychologiques', () => {
  it('statbloc « Terreur 2 » → causesTerreur ; « Immunité (Psychologie) » → psychImmune', () => {
    const c = statblockToCombatant(
      { name: 'X', char: { F: 30, E: 30, FM: 30 }, traits: ['Terreur 2', 'Immunité (Psychologie)'] },
      'x',
      { x: 0, y: 0 },
    );
    expect(c.causesTerreur).toBe(2);
    expect(c.psychImmune).toBe(true);
  });
  it('statbloc « Peur 4 » → causesPeur ; sans trait psy → champs absents', () => {
    expect(statblockToCombatant({ name: 'Y', char: { FM: 30 }, traits: ['Peur 4'] }, 'y', { x: 0, y: 0 }).causesPeur).toBe(4);
    const plain = statblockToCombatant({ name: 'Z', char: { FM: 30 } }, 'z', { x: 0, y: 0 });
    expect(plain.causesPeur).toBeUndefined();
    expect(plain.causesTerreur).toBeUndefined();
  });
});
