import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { RNG } from './dice';
import {
  contractDisease,
  tickDisease,
  activeMalaiseCount,
  diseaseBlesseCount,
  diseasePassiveOps,
  rollContraction,
  applyDiseasePersist,
} from './disease';
import type { GameOp } from './ops';

/** RNG scripté : renvoie les valeurs dans l'ordre (déjà dans les bornes attendues). */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] };
}

const sick = (over: Partial<Combatant> = {}): Combatant =>
  ({ name: 'Malade', diseases: [], ...over }) as Combatant;

describe('disease — cycle de vie (LDB 20, sourcé)', () => {
  it('contractDisease(Infection Mineure) : incubation/durée figées, symptômes sourcés', () => {
    const dz = contractDisease('infection-mineure', seq([]), { incubation: 3, duration: 5 })!;
    expect(dz.phase).toBe('incubation');
    expect(dz.daysLeft).toBe(3);
    expect(dz.durationDays).toBe(5);
    expect(dz.persistDifficulty).toBe('facile');
    expect(dz.symptoms.map((s) => s.symptomId).sort()).toEqual(['blesse', 'malaise', 'persistant']);
  });

  it('contractDisease(nom inconnu) → null', () => {
    expect(contractDisease('Lèpre imaginaire', seq([]))).toBeNull();
  });

  it('incubation → active : les symptômes se déclarent, puis comptent', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 2, duration: 5 })!] });
    expect(activeMalaiseCount(c)).toBe(0); // incubation = pas encore de symptômes
    const log = tickDisease(c, 2, seq([]), 80);
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].daysLeft).toBe(5);
    expect(log.some((l) => /se déclarent/.test(l))).toBe(true);
    expect(activeMalaiseCount(c)).toBe(1);
    expect(diseaseBlesseCount(c)).toBe(1);
  });

  it('persistant réussi en fin de durée → guérison naturelle', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // jour actif : blessé Résistance Accessible (d100=5 réussit), puis persistant Facile (d100=5 réussit)
    const log = tickDisease(c, 1, seq([5, 5]), 80);
    expect(c.diseases!.length).toBe(0);
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it('blessé raté → développe une Blessure Purulente (l.110)', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // blessé Résistance Accessible raté (d100=50 > 21) → contracte BP (sa durée = 1d10 → 5) ; puis persistant
    // Facile raté (d100=99, sl≈−5) → BP (déjà là, no-op). L'Infection Mineure s'achève.
    tickDisease(c, 1, seq([50, 5, 99]), 1);
    expect(c.diseases!.map((d) => d.name)).toEqual(['blessure-purulente']);
    expect(c.diseases![0].phase).toBe('active'); // contractée « instantanément » (l.32)
  });

  it('tickDisease(defer) : DIFFÈRE les Tests (cycle Blessé + persistant), n’en roule AUCUN, résolus par les applicateurs', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    const kinds: string[] = [];
    // seq([]) : si un seul jet était tiré, il renverrait undefined — la cascade ne DOIT rien rouler.
    const log = tickDisease(c, 1, seq([]), 80, (spec) => kinds.push(spec.kind));
    expect(kinds.sort()).toEqual(['diseasePersist', 'diseaseTick']); // Blessé → étape générique 'diseaseTick'
    expect(c.diseases![0].endTestPending).toBe(true); // la maladie attend la validation de son étape
    expect(log.some((l) => /guérit|persiste|Purulente|Gangrène/.test(l))).toBe(false); // RIEN pré-résolu
    // Résolution à la validation des étapes : le Test de cycle réussi serait un no-op (onFail non appliqué
    // par l'applier `diseaseTick` côté state) ; persistant réussi → guérison.
    applyDiseasePersist(c, 'infection-mineure', true, 2, seq([]));
    expect(c.diseases!.length).toBe(0);
  });

  it('persistant échec stupéfiant (−6) → Infection du Sang', () => {
    // résistance haute pour réussir le blessé (pas de BP parasite), mais on force l'échec stupéfiant du persistant.
    const c = sick({ diseases: [contractDisease('blessure-purulente', seq([]), { incubation: 0, duration: 1 })!] });
    // resVal 5 → blessé cible 25 ; d100=1 réussit (pas de BP parasite). Persistant Intermédiaire cible 5,
    // d100=100 → sl 0−10 = −10 ≤ −6 → Infection du Sang (sa durée = 1d10 → 5).
    const log = tickDisease(c, 1, seq([1, 100, 5]), 5);
    expect(c.diseases!.map((d) => d.name)).toContain('infection-du-sang');
    expect(log.some((l) => /stupéfiant/.test(l))).toBe(true);
  });

  it('diseasePassiveOps : fièvre = charMod −10 aux Physiques/Sociaux, rien au Mental', () => {
    const c = sick({ diseases: [contractDisease('blessure-purulente', seq([]), { incubation: 0, duration: 5 })!] });
    const ops = diseasePassiveOps(c).filter((o): o is Extract<GameOp, { op: 'charMod' }> => o.op === 'charMod');
    const modOf = (char: string) => ops.filter((o) => o.char === char).map((o) => o.mod);
    expect(modOf('F')).toEqual([-10]);
    expect(modOf('Soc')).toEqual([-10]);
    expect(modOf('Int')).toEqual([]); // Mental non touché
    expect(modOf('FM')).toEqual([]);
  });

  describe('rollContraction (post-critique +60, Chirurgie +20)', () => {
    it('Test de Résistance réussi → aucune maladie', () => {
      const c = sick();
      // resVal 80, Très Facile (+60) → cible plafonnée ; d100=5 réussit.
      const log = rollContraction(c, 'infection-mineure', 80, 'tresFacile', seq([5]));
      expect(c.diseases ?? []).toHaveLength(0);
      expect(log).toHaveLength(0);
    });

    it('Test raté → contracte la maladie (incubation/durée tirées ensuite)', () => {
      const c = sick();
      // resVal 1, Très Facile (+60) → cible 61 ; d100=99 échoue → contractDisease tire incubation=3, durée=5.
      const log = rollContraction(c, 'infection-mineure', 1, 'tresFacile', seq([99, 3, 5]));
      expect(c.diseases!.map((d) => d.name)).toEqual(['infection-mineure']);
      expect(log.some((l) => /contracte/.test(l))).toBe(true);
    });

    it('déjà porteur de la maladie → ne relance rien (dédoublonnage)', () => {
      const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 5 })!] });
      const log = rollContraction(c, 'infection-mineure', 1, 'tresFacile', seq([])); // aucun jet
      expect(c.diseases!).toHaveLength(1);
      expect(log).toHaveLength(0);
    });
  });
});
