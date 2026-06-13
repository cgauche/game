import { describe, it, expect } from 'vitest';
import { parsePsychTraits } from './registry';
import { PSYCH_DEFS } from './_registry.generated';

describe('Registre Psychologie (defs/ auto-chargé, gen-registry) — LDB 21/85', () => {
  it('les 10 traits psy sont chargés', () => {
    expect(PSYCH_DEFS).toHaveLength(10);
  });

  it('parse Peur/Terreur/Immunité + ciblés (Animosité/Phobie indice 1/Effrayé indice 0)', () => {
    const p = parsePsychTraits(['Peur 2', 'Immunité (Psychologie)', 'Animosité (Elfes)', 'Phobie (Serpents)', 'Effrayé (Feu)']);
    expect(p.causesPeur).toBe(2);
    expect(p.psychImmune).toBe(true);
    expect(p.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'Elfes' },
      { type: 'phobie', cible: 'Serpents', indice: 1 },
      { type: 'phobie', cible: 'Feu', indice: 0 },
    ]));
  });

  it('Cible « un au choix » ou vide → inerte (cible indéfinie)', () => {
    expect(parsePsychTraits(['Haine (un au choix)']).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
  });
});
