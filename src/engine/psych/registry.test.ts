import { describe, it, expect } from 'vitest';
import { parsePsychTraits } from './registry';

describe('Psychologie data-driven (capabilities de traits.json) — LDB 21/85', () => {
  it('parse Peur/Terreur/Immunité + ciblés (Animosité/Phobie indice 1/Effrayé indice 0)', () => {
    const p = parsePsychTraits([{ id: 'peur', value: 2 }, { id: 'immunite-psychologique' }, { id: 'animosite', arg: 'Elfes' }, { id: 'phobie', arg: 'Serpents' }, { id: 'effraye', arg: 'Feu' }]);
    expect(p.causesPeur).toBe(2);
    expect(p.psychImmune).toBe(true);
    expect(p.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'Elfes' },
      { type: 'phobie', cible: 'Serpents', indice: 1 },
      { type: 'phobie', cible: 'Feu', indice: 0 },
    ]));
  });

  it('Cible « un au choix » ou vide → inerte (cible indéfinie)', () => {
    expect(parsePsychTraits([{ id: 'haine', arg: 'un au choix' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
  });

  it('un trait sans capacité psy est ignoré', () => {
    expect(parsePsychTraits([{ id: 'arme', value: 7 }])).toEqual({});
  });
});
