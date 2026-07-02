import { describe, it, expect } from 'vitest';
import { availableResistance, markResistanceUsed, resistanceForcedSL } from './menace';
import { restoreFortune } from './fortune';
import type { Combatant } from './types';

/**
 * Talent « Résistance (Menace) » — LDB 10 l.1015-1021 : « Vous pouvez réussir automatiquement le
 * premier Test pour résister à la menace spécifiée […] à chaque séance de jeu. Si le DR requis est
 * important, utilisez votre Bonus d'Endurance comme DR pour le Test. » Moteur pur : disponibilité de
 * la spec, compteur « 1 par séance », DR = BE, remise à zéro par la couture de début de séance.
 */
const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 43, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [],
    talents: [{ talentId: 'resistance', spec: 'Maladie', times: 1 }],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 2, fortune: 0,
    ...p,
  } as Combatant);

describe('Résistance (Menace) — disponibilité de la spec (LDB 10 l.1015-1021)', () => {
  it('spec couvrant la menace → disponible (comparaison normalisée casse/accents)', () => {
    expect(availableResistance(hero(), 'Maladie')).toBe('Maladie');
    expect(availableResistance(hero(), 'maladie')).toBe('Maladie');
  });

  it('menace non couverte / talent absent / spec absente → indisponible', () => {
    expect(availableResistance(hero(), 'Poison')).toBeNull();
    expect(availableResistance(hero({ talents: [] }), 'Maladie')).toBeNull();
    expect(availableResistance(hero({ talents: [{ talentId: 'resistance', times: 1 }] as never }), 'Maladie')).toBeNull();
  });

  it('deux prises du talent (specs différentes) : chaque spec a SON usage', () => {
    const h = hero({ talents: [
      { talentId: 'resistance', spec: 'Maladie', times: 1 },
      { talentId: 'resistance', spec: 'Poison', times: 1 },
    ] });
    markResistanceUsed(h, 'Maladie');
    expect(availableResistance(h, 'Maladie')).toBeNull(); // consommée
    expect(availableResistance(h, 'Poison')).toBe('Poison'); // l'autre spec reste
  });

  it('« à chaque séance de jeu » : consommé cette séance → indisponible ; la couture de début de séance ré-arme', () => {
    const h = hero();
    markResistanceUsed(h, 'Maladie');
    expect(availableResistance(h, 'Maladie')).toBeNull();
    const [fresh] = restoreFortune([h]); // couture UNIQUE : Chance (LDB 17 l.47) + compteurs de séance
    expect(fresh.resistanceUsed).toBeUndefined();
    expect(availableResistance(fresh, 'Maladie')).toBe('Maladie');
    expect(fresh.fortune).toBe(2); // la Chance est bien restaurée par la MÊME couture
  });

  it('DR de l’auto-succès = Bonus d’Endurance (« utilisez votre Bonus d’Endurance comme DR »)', () => {
    expect(resistanceForcedSL(hero())).toBe(4); // E 43 → BE 4
  });
});
