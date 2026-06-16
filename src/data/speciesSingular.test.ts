import { describe, it, expect } from 'vitest';
import { speciesSingular } from './index';

describe('speciesSingular — affichage singulier d’un individu (B1)', () => {
  it('groupe pluriel simple → singulier', () => {
    expect(speciesSingular('Nains')).toBe('Nain');
    expect(speciesSingular('Halflings')).toBe('Halfling');
    expect(speciesSingular('Hauts elfes')).toBe('Haut elfe');
    expect(speciesSingular('Elfes sylvains')).toBe('Elfe sylvain');
  });
  it('conserve la sous-espèce entre parenthèses', () => {
    expect(speciesSingular('Humains (Reiklander)')).toBe('Humain (Reiklander)');
    expect(speciesSingular('Nains (Norse)')).toBe('Nain (Norse)');
    expect(speciesSingular('Humains (Altdorfer — South Banker)')).toBe('Humain (Altdorfer — South Banker)');
  });
  it('repli : groupe inconnu rendu tel quel', () => {
    expect(speciesSingular('Skavens')).toBe('Skavens');
  });
});
