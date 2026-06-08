import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { RNG } from './dice';
import {
  contractDisease,
  tickDisease,
  activeMalaiseCount,
  diseaseBlesseCount,
  diseaseCharPenalties,
  rollContraction,
} from './disease';

/** RNG scripté : renvoie les valeurs dans l'ordre (déjà dans les bornes attendues). */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] };
}

const sick = (over: Partial<Combatant> = {}): Combatant =>
  ({ name: 'Malade', diseases: [], ...over }) as Combatant;

describe('disease — cycle de vie (LDB 20, sourcé)', () => {
  it('contractDisease(Infection Mineure) : incubation/durée figées, symptômes sourcés', () => {
    const dz = contractDisease('Infection Mineure', seq([]), { incubation: 3, duration: 5 })!;
    expect(dz.phase).toBe('incubation');
    expect(dz.daysLeft).toBe(3);
    expect(dz.durationDays).toBe(5);
    expect(dz.persistDifficulty).toBe('facile');
    expect(dz.symptoms.map((s) => s.kind).sort()).toEqual(['blesse', 'malaise', 'persistant']);
  });

  it('contractDisease(nom inconnu) → null', () => {
    expect(contractDisease('Lèpre imaginaire', seq([]))).toBeNull();
  });

  it('incubation → active : les symptômes se déclarent, puis comptent', () => {
    const c = sick({ diseases: [contractDisease('Infection Mineure', seq([]), { incubation: 2, duration: 5 })!] });
    expect(activeMalaiseCount(c)).toBe(0); // incubation = pas encore de symptômes
    const log = tickDisease(c, 2, seq([]), 80);
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].daysLeft).toBe(5);
    expect(log.some((l) => /se déclarent/.test(l))).toBe(true);
    expect(activeMalaiseCount(c)).toBe(1);
    expect(diseaseBlesseCount(c)).toBe(1);
  });

  it('persistant réussi en fin de durée → guérison naturelle', () => {
    const c = sick({ diseases: [contractDisease('Infection Mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // jour actif : blessé Résistance Accessible (d100=5 réussit), puis persistant Facile (d100=5 réussit)
    const log = tickDisease(c, 1, seq([5, 5]), 80);
    expect(c.diseases!.length).toBe(0);
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it('blessé raté → développe une Blessure Purulente (l.110)', () => {
    const c = sick({ diseases: [contractDisease('Infection Mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // blessé Résistance Accessible raté (d100=50 > 21) → contracte BP (sa durée = 1d10 → 5) ; puis persistant
    // Facile raté (d100=99, sl≈−5) → BP (déjà là, no-op). L'Infection Mineure s'achève.
    tickDisease(c, 1, seq([50, 5, 99]), 1);
    expect(c.diseases!.map((d) => d.name)).toEqual(['Blessure Purulente']);
    expect(c.diseases![0].phase).toBe('active'); // contractée « instantanément » (l.32)
  });

  it('persistant échec stupéfiant (−6) → Infection du Sang', () => {
    // résistance haute pour réussir le blessé (pas de BP parasite), mais on force l'échec stupéfiant du persistant.
    const c = sick({ diseases: [contractDisease('Blessure Purulente', seq([]), { incubation: 0, duration: 1 })!] });
    // resVal 5 → blessé cible 25 ; d100=1 réussit (pas de BP parasite). Persistant Intermédiaire cible 5,
    // d100=100 → sl 0−10 = −10 ≤ −6 → Infection du Sang (sa durée = 1d10 → 5).
    const log = tickDisease(c, 1, seq([1, 100, 5]), 5);
    expect(c.diseases!.map((d) => d.name)).toContain('Infection du Sang');
    expect(log.some((l) => /stupéfiant/.test(l))).toBe(true);
  });

  it('diseaseCharPenalties : fièvre = −10 aux Tests Physiques/Sociaux, 0 au Mental', () => {
    const c = sick({ diseases: [contractDisease('Blessure Purulente', seq([]), { incubation: 0, duration: 5 })!] });
    expect(diseaseCharPenalties(c, 'F')).toEqual([-10]);
    expect(diseaseCharPenalties(c, 'Soc')).toEqual([-10]);
    expect(diseaseCharPenalties(c, 'Int')).toEqual([]); // Mental non touché
    expect(diseaseCharPenalties(c, 'FM')).toEqual([]);
  });

  describe('rollContraction (post-critique +60, Chirurgie +20)', () => {
    it('Test de Résistance réussi → aucune maladie', () => {
      const c = sick();
      // resVal 80, Très Facile (+60) → cible plafonnée ; d100=5 réussit.
      const log = rollContraction(c, 'Infection Mineure', 80, 'tresFacile', seq([5]));
      expect(c.diseases ?? []).toHaveLength(0);
      expect(log).toHaveLength(0);
    });

    it('Test raté → contracte la maladie (incubation/durée tirées ensuite)', () => {
      const c = sick();
      // resVal 1, Très Facile (+60) → cible 61 ; d100=99 échoue → contractDisease tire incubation=3, durée=5.
      const log = rollContraction(c, 'Infection Mineure', 1, 'tresFacile', seq([99, 3, 5]));
      expect(c.diseases!.map((d) => d.name)).toEqual(['Infection Mineure']);
      expect(log.some((l) => /contracte/.test(l))).toBe(true);
    });

    it('déjà porteur de la maladie → ne relance rien (dédoublonnage)', () => {
      const c = sick({ diseases: [contractDisease('Infection Mineure', seq([]), { incubation: 0, duration: 5 })!] });
      const log = rollContraction(c, 'Infection Mineure', 1, 'tresFacile', seq([])); // aucun jet
      expect(c.diseases!).toHaveLength(1);
      expect(log).toHaveLength(0);
    });
  });
});
