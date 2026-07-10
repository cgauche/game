import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { RNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import {
  contractDisease,
  tickDisease,
  activeMalaiseCount,
  diseaseBlesseCount,
  diseasePassiveOps,
  diseasePsychTraits,
  rollContraction,
  applyDiseasePersist,
} from './disease';
import { effectivePsychTraits, isFrenzyCapable } from './psychology';
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
    expect(dz.minutesLeft).toBe(3 * MINUTES_PER_DAY);
    expect(dz.durationMinutes).toBe(5 * MINUTES_PER_DAY);
    expect(dz.persistDifficulty).toBe('facile');
    expect(dz.symptoms.map((s) => s.symptomId).sort()).toEqual(['blesse', 'malaise', 'persistant']);
  });

  it('contractDisease(nom inconnu) → null', () => {
    expect(contractDisease('Lèpre imaginaire', seq([]))).toBeNull();
  });

  // ── Durée unit-aware (heures|jours|minutes) → MINUTES — zéro dette « sous-journalier ≈ 0 jour » ──
  it('incubation en HEURES (Courante Galopante, LDB 20 l.43) : bascule en actif après quelques heures, DANS la journée', () => {
    // incubation 1d10 heures (jet=2 → 120 min), durée 1d10 jours (jet=4).
    const dz = contractDisease('courante-galopante', seq([2, 4]))!;
    expect(dz.phase).toBe('incubation'); // 2 h > 0 : plus jamais arrondi à 0 → vrai temps d'incubation
    expect(dz.minutesLeft).toBe(120);
    const c = sick({ diseases: [dz] });
    tickDisease(c, 60, seq([]), 80); // +1 h (sous la journée) → pas encore
    expect(c.diseases![0].phase).toBe('incubation');
    expect(c.diseases![0].minutesLeft).toBe(60);
    tickDisease(c, 60, seq([]), 80); // +1 h → 2 h écoulées → symptômes ACTIFS
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].minutesLeft).toBe(4 * MINUTES_PER_DAY); // durée mémorisée (4 jours)
  });

  it('maladie à l’ÉCHELLE jour : avance jour par jour (comportement existant préservé)', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 2, duration: 5 })!] });
    tickDisease(c, MINUTES_PER_DAY, seq([]), 80); // 1 jour
    expect(c.diseases![0].phase).toBe('incubation');
    expect(c.diseases![0].minutesLeft).toBe(1 * MINUTES_PER_DAY);
    tickDisease(c, MINUTES_PER_DAY, seq([]), 80); // 2e jour → actif
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY);
  });

  it('durée en HEURES (Mal de mer « par heure », MDG ch.14) : la maladie s’achève DANS la journée', () => {
    const dz = contractDisease('mal-de-mer', seq([]))!; // incubation instantanée (0) ; durée fixe 1 heure
    expect(dz.phase).toBe('active');
    expect(dz.minutesLeft).toBe(60);
    const c = sick({ diseases: [dz] });
    const log = tickDisease(c, 60, seq([3]), 80); // 1 h écoulée → fin de durée → Test de fin Intermédiaire (80) réussi
    expect(c.diseases).toHaveLength(0); // guérie en moins d’une journée — plus de durée « ≈ 1 jour » parasite
    expect(c.diseaseImmunities).toContain('mal-de-mer');
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it('incubation → active : les symptômes se déclarent, puis comptent', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 2, duration: 5 })!] });
    expect(activeMalaiseCount(c)).toBe(0); // incubation = pas encore de symptômes
    const log = tickDisease(c, 2 * MINUTES_PER_DAY, seq([]), 80);
    expect(c.diseases![0].phase).toBe('active');
    expect(c.diseases![0].minutesLeft).toBe(5 * MINUTES_PER_DAY);
    expect(log.some((l) => /se déclarent/.test(l))).toBe(true);
    expect(activeMalaiseCount(c)).toBe(1);
    expect(diseaseBlesseCount(c)).toBe(1);
  });

  it('persistant réussi en fin de durée → guérison naturelle', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // jour actif : blessé Résistance Accessible (d100=5 réussit), puis persistant Facile (d100=5 réussit)
    const log = tickDisease(c, MINUTES_PER_DAY, seq([5, 5]), 80);
    expect(c.diseases!.length).toBe(0);
    expect(log.some((l) => /guérit/.test(l))).toBe(true);
  });

  it('blessé raté → développe une Blessure Purulente (l.110)', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    // blessé Résistance Accessible raté (d100=50 > 21) → contracte BP (sa durée = 1d10 → 5) ; puis persistant
    // Facile raté (d100=99, sl≈−5) → BP (déjà là, no-op). L'Infection Mineure s'achève.
    tickDisease(c, MINUTES_PER_DAY, seq([50, 5, 99]), 1);
    expect(c.diseases!.map((d) => d.name)).toEqual(['blessure-purulente']);
    expect(c.diseases![0].phase).toBe('active'); // contractée « instantanément » (l.32)
  });

  it('tickDisease(defer) : DIFFÈRE les Tests (cycle Blessé + persistant), n’en roule AUCUN, résolus par les applicateurs', () => {
    const c = sick({ diseases: [contractDisease('infection-mineure', seq([]), { incubation: 0, duration: 1 })!] });
    const kinds: string[] = [];
    // seq([]) : si un seul jet était tiré, il renverrait undefined — la cascade ne DOIT rien rouler.
    const log = tickDisease(c, MINUTES_PER_DAY, seq([]), 80, (spec) => kinds.push(spec.kind));
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
    const log = tickDisease(c, MINUTES_PER_DAY, seq([1, 100, 5]), 5);
    expect(c.diseases!.map((d) => d.name)).toContain('infection-du-sang');
    expect(log.some((l) => /stupéfiant/.test(l))).toBe(true);
  });

  it('grantPsychTrait des symptômes actifs (Rage meurtrière) : Haine + Frénésie EFFECTIFS tant que la maladie est active, retirés à la guérison', () => {
    const lowRng: RNG = { int: () => 1 }; // tout Test réussit (roll=1) → cycle/persistant réussis
    // Témoin : aucune maladie → aucun Trait psy dérivé.
    expect(effectivePsychTraits(sick())).toEqual([]);

    // Vérole cérébrale à taches vertes ACTIVE (symptôme « Rage meurtrière » manifesté).
    const dz = contractDisease('verole-cerebrale-a-taches-vertes', lowRng, { incubation: 0, duration: 1 })!;
    expect(dz.phase).toBe('active');
    const c = sick({ diseases: [dz] });

    // La donnée du symptôme (passive grantPsychTrait) est désormais CÂBLÉE : sujet à Haine (toutes les
    // choses vivantes) + Frénésie. (diseasePsychTraits = le collecteur ; effectivePsychTraits = stockés ∪ dérivés.)
    expect(diseasePsychTraits(c)).toEqual([
      { type: 'haine', cible: 'toutes les choses vivantes' },
      { type: 'frenesie' },
    ]);
    const active = effectivePsychTraits(c);
    expect(active).toContainEqual({ type: 'haine', cible: 'toutes les choses vivantes' });
    expect(active).toContainEqual({ type: 'frenesie' });
    // EFFET RÉEL (pas juste l'appartenance à la liste) : la Frénésie octroyée par la maladie rend
    // le combattant frénésie-CAPABLE — sinon le grant resterait inerte au combat.
    expect(isFrenzyCapable(sick())).toBe(false); // témoin : sans maladie ni trait/talent
    expect(isFrenzyCapable(c)).toBe(true);

    // Fin de durée → Test persistant (Accessible) réussi → guérison → Traits retirés d'office (dérivation,
    // zéro bookkeeping : la maladie n'est plus active donc plus rien à dériver).
    tickDisease(c, MINUTES_PER_DAY, lowRng, 80);
    expect(c.diseases).toHaveLength(0);
    expect(effectivePsychTraits(c)).toEqual([]);
  });

  it('symptôme en INCUBATION : pas encore manifesté → aucun Trait psy dérivé', () => {
    const dz = contractDisease('verole-cerebrale-a-taches-vertes', { int: () => 1 }, { incubation: 2, duration: 5 })!;
    expect(dz.phase).toBe('incubation');
    expect(diseasePsychTraits(sick({ diseases: [dz] }))).toEqual([]); // dérivation gatée par phase==='active'
  });

  it('diseasePassiveOps : fièvre = charMod −10 aux Physiques/Sociaux, rien au Mental', () => {
    const c = sick({ diseases: [contractDisease('blessure-purulente', seq([]), { incubation: 0, duration: 5 })!] });
    const ops = diseasePassiveOps(c).filter((o): o is Extract<GameOp, { op: 'charMod' }> => o.op === 'charMod');
    const modOf = (char: string) => ops.filter((o) => o.char === char).map((o) => o.mod);
    expect(modOf('force')).toEqual([-10]);
    expect(modOf('sociabilite')).toEqual([-10]);
    expect(modOf('intelligence')).toEqual([]); // Mental non touché
    expect(modOf('force-mentale')).toEqual([]);
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
