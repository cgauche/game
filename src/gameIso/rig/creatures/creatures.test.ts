import { describe, it, expect } from 'vitest';
import {
  CREATURES, QUAD_SPECIES, WINGED_SPECIES, quadSpeciesNames, wingedSpeciesNames,
} from './index';
import { raceById } from '../races';

describe('registre de créatures (auto-collecté depuis defs/)', () => {
  it('CREATURES non vide + chaque entrée bien formée', () => {
    expect(CREATURES.length).toBeGreaterThanOrEqual(10);
    const PLANS = ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe', 'crustace', 'fish', 'engin'];
    const PROPS: Record<string, keyof typeof CREATURES[number]> = {
      quadruped: 'quad', winged: 'quad', serpentine: 'serpent', arachnid: 'spider', avian: 'bird', cephalopod: 'octopus', spectral: 'spectre', squig: 'squig', amorphous: 'hulk', jabberslythe: 'jabber', crustace: 'crab', fish: 'fish',
    };
    for (const c of CREATURES) {
      expect(c.name, 'name').toBeTruthy();
      expect(PLANS).toContain(c.plan);
      const propField = PROPS[c.plan]; // chaque plan rigué porte son champ de props
      if (propField) expect(c[propField], `${c.name}.${propField}`).toBeTruthy();
    }
  });

  it('tables dérivées cohérentes avec les defs (zéro tableau central)', () => {
    expect(quadSpeciesNames().length).toBe(Object.keys(QUAD_SPECIES).length);
    expect(wingedSpeciesNames().length).toBe(Object.keys(WINGED_SPECIES).length);
    expect(QUAD_SPECIES['cheval']).toBeTruthy();
    expect(QUAD_SPECIES['rat-geant']).toBeTruthy(); // clé = id slug (l'accent du `name` est slugué)
    expect(WINGED_SPECIES['dragon']?.wings).toBe('membrane');
  });

  it('défauts d\'apparence bipède portés par la Race', () => {
    expect(raceById('Skaven').tenue).toBe('skaven');
    expect(raceById('Vampire').sex).toBe('M');
    expect(raceById('Goule').head).toBe('goule');
    expect(raceById('Nain').tenue).toBe('artisan'); // espèce civilisée → défaut HABILLÉ (anti-« à poil »), comme toutes les races
    expect(raceById('Humain').tenue).toBe('bourgeois');
  });
});
