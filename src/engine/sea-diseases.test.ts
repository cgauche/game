import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { RNG, makeRNG } from './dice';
import { contractDisease, tickDisease } from './disease';

/** RNG scripté : renvoie les valeurs dans l'ordre. */
const seq = (values: number[]): RNG => { let i = 0; return { int: () => values[i++] }; };
const sick = (over: Partial<Combatant> = {}): Combatant => ({ name: 'Marin', diseases: [], ...over }) as Combatant;

/**
 * Maladies marines (MDG ch.14) — réutilisent le CYCLE de maladie EXISTANT (`disease.ts` + `maladies.json`),
 * pas de mécanique parallèle : mêmes incubation/durée/symptômes/Test de fin que les maladies du LDB 20.
 */
describe('Mal de mer (MDG ch.14) — cycle de maladie réutilisé', () => {
  it("onset immédiat (incubation 0) ; symptômes malaise/nausée + Test de fin Intermédiaire ; immunité après guérison", () => {
    const dz = contractDisease('mal-de-mer', seq([]))!;
    expect(dz.phase).toBe('active'); // incubation {n:0} → symptômes immédiats
    expect(dz.symptoms.map((s) => s.kind).sort()).toEqual(['malaise', 'nausee', 'persistant']);
    expect(dz.persistDifficulty).toBe('intermediaire'); // Résistance Intermédiaire (+0) RAW
  });

  it('guérison (Test de fin réussi) → immunité « ne souffrira plus jamais de cette forme » (immuneAfterCure)', () => {
    const c = sick({ diseases: [contractDisease('mal-de-mer', seq([]), { incubation: 0, duration: 1 })!] });
    tickDisease(c, 1, seq([3]), 60); // fin de durée → Résistance 3/60 = réussite auto → guéri
    expect(c.diseases).toHaveLength(0);
    expect(c.diseaseImmunities).toContain('mal-de-mer');
  });
});

describe('Scorbut (MDG ch.14) — cycle de maladie réutilisé', () => {
  it('symptômes blessé/intoxication/malaise/nausée ; durée 1d10 (après reprise de nourriture fraîche)', () => {
    const dz = contractDisease('scorbut', makeRNG(1), { incubation: 0 })!;
    expect(dz.phase).toBe('active');
    expect(dz.symptoms.map((s) => s.kind).sort()).toEqual(['blesse', 'intoxication', 'malaise', 'nausee']);
    expect(dz.durationDays).toBeGreaterThanOrEqual(1);
    expect(dz.durationDays).toBeLessThanOrEqual(10);
  });
});
