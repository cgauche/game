import { describe, it, expect } from 'vitest';
import {
  CREATURES, QUAD_SPECIES, WINGED_SPECIES,
  quadSpeciesMatch, wingSpeciesMatch, quadSpeciesNames, wingedSpeciesNames,
  bipedSpeciesMatch,
} from './index';
import { raceById } from '../races';

describe('registre de créatures (auto-collecté depuis defs/)', () => {
  it('CREATURES non vide + chaque entrée bien formée', () => {
    expect(CREATURES.length).toBeGreaterThanOrEqual(10);
    const PLANS = ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe', 'monolithic'];
    const PROPS: Record<string, keyof typeof CREATURES[number]> = {
      quadruped: 'quad', winged: 'quad', serpentine: 'serpent', arachnid: 'spider', avian: 'bird', cephalopod: 'octopus', spectral: 'spectre', squig: 'squig', amorphous: 'hulk', jabberslythe: 'jabber',
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
    expect(QUAD_SPECIES['Cheval']).toBeTruthy();
    expect(QUAD_SPECIES['Rat géant']).toBeTruthy(); // l'accent du `name` est préservé
    expect(WINGED_SPECIES['Dragon']?.wings).toBe('membrane');
  });

  it('détection d\'espèce bipède (ex-detectSpecies) — cas + chevauchements par priorité', () => {
    const cases: [string, string | undefined][] = [
      ['Guerrier des clans', 'Skaven'],
      ['Rat ogre', 'Rat ogre'], // def dédié (priorité 10 < Skaven 18) — morphologie de brute
      ['Vermine de choc', 'Vermine de choc'],
      ['Prophète gris', 'Prophète gris'],
      ['Esclave skaven', 'Esclave skaven'],
      ["Coureur d'égout", "Coureur d'égout"],
      ['Coureur nocturne', "Coureur d'égout"],
      ['Homme-rat', 'Skaven'],
      ['Ogre', 'Ogre'],
      ['Elfe sylvain', 'Elfe sylvain'],
      ['Haut-Elfe', 'Haut-Elfe'],
      ['Elfe', 'Haut-Elfe'], // générique → Haut-Elfe
      ['Nain mercenaire', 'Nain'],
      ['Minotaure', 'Minotaure'], // AVANT homme-bête
      ['Gor sauvage', 'Gor'], // def dédié (grandes cornes)
      ['Ungor', 'Ungor'], // « ungor » ne déclenche PAS \bgor\b (pas de limite de mot)
      ['Chamane-Brey', 'Chamane-Brey'],
      ['Homme-bête', 'Homme-bête'],
      ['Furie du Chaos', 'Furie du Chaos'],
      ['Horreur rose', 'Horreur rose'],
      ['Horreur bleue', 'Horreur bleue'],
      ['Horreur de Tzeentch', 'Horreur rose'], // « horreur » nu → rose (les plus courantes)
      ['Petit gobelin', 'Gobelin'],
      ['Snotling', 'Snotling'],
      ['Goule de crypte', 'Goule'],
      ['Zombie', 'Zombie'],
      ['Vampire', 'Vampire'],
      ['Sanguinaire de Khorne', 'Démon'],
      ['Squelette guerrier', 'Squelette'],
      ['Troll de pierre', 'Troll'],
      ['Bandit', undefined], // aucun match → Humain par défaut chez l'appelant
    ];
    for (const [name, exp] of cases) expect(bipedSpeciesMatch(name), name).toBe(exp);
  });

  it('défauts d\'apparence bipède portés par la Race', () => {
    expect(raceById('Skaven').career).toBe('Skaven');
    expect(raceById('Vampire').sex).toBe('M');
    expect(raceById('Goule').head).toBe('goule');
    expect(raceById('Nain').career).toBeUndefined(); // humanoïde simple : pas de défaut de tenue
  });

  it('routage par clé/alias à limite de mot', () => {
    expect(quadSpeciesMatch('Destrier de guerre')).toBe('Cheval');
    expect(quadSpeciesMatch('Loup funeste')).toBe('Loup');
    expect(quadSpeciesMatch('Rat ogre')).toBeUndefined(); // « rat » seul ≠ Rat géant (= skaven)
    expect(wingSpeciesMatch('Hyppogriffe')).toBe('Hippogriffe'); // orthographe LDB
    expect(wingSpeciesMatch('Vouivre nauséabonde')).toBe('Dragon');
    expect(wingSpeciesMatch('Hippogriffe')).not.toBe('Griffon'); // pas de capture sous-chaîne « griff »
  });
});
