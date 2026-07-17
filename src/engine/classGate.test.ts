/**
 * Gate de Classe GÉNÉRIQUE des Activités — deux SOURCES distinctes (juge 2026-07-17, écart réel) :
 * LDB 23 l.197 « Activités de Classe » gate sur la Classe COURANTE (« si vous n'appartenez pas à la
 * Classe spécifiée ») ; AA 12 l.5 « Activités de Guerrier » gate sur l'HISTORIQUE (« s'il n'a jamais
 * appartenu à la Classe des Guerriers »). `classGate.scope` distingue les deux (défaut `'current'`).
 */
import { describe, it, expect } from 'vitest';
import { classGatedDifficulty, everBelongedClasses, statusIncomeMax } from './activities';
import { toBrass } from './money';
import type { Combatant } from './types';

const hero = (career: string, careerHistory?: string[]): Pick<Combatant, 'career' | 'careerHistory'> =>
  ({ career, ...(careerHistory ? { careerHistory } : {}) });

describe('classGatedDifficulty — scope « current » (LDB 23 l.197, défaut)', () => {
  it('sans classGate : la Difficulté déclarée est inchangée', () => {
    expect(classGatedDifficulty({ difficulty: 'intermediaire' }, hero('soldat'))).toBe('intermediaire');
  });

  it('Classe COUVERTE (Carrière COURANTE) : la Difficulté déclarée est inchangée', () => {
    const def = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1 } };
    expect(classGatedDifficulty(def, hero('soldat'))).toBe('complexe');
  });

  it("hors Classe COURANTE : « plus dur d'un Niveau » (Complexe → Difficile, exemple LDB 23 l.197)", () => {
    const def = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1 } };
    expect(classGatedDifficulty(def, hero('erudit'))).toBe('difficile');
  });

  it('hors Classe, plusieurs Classes couvertes (Entraînement au Combat : Guerriers, Itinérants)', () => {
    const def = { difficulty: 'intermediaire' as const, classGate: { classes: ['guerriers', 'itinerants'], outsidePenalty: 1 } };
    expect(classGatedDifficulty(def, hero('colporteur'))).toBe('intermediaire');
    expect(classGatedDifficulty(def, hero('charlatan'))).toBe('complexe');
  });

  it('difficulty absente : repli Intermédiaire, durci d’un cran hors Classe', () => {
    const def = { classGate: { classes: ['roublards'], outsidePenalty: 1 } };
    expect(classGatedDifficulty(def, hero('charlatan'))).toBe('intermediaire');
    expect(classGatedDifficulty(def, hero('soldat'))).toBe('complexe');
  });

  it('un ex-guerrier RECONVERTI (Classe courante ≠ Guerriers) reste hors gate `current` MÊME avec un passé de Guerrier', () => {
    const def = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1 } };
    expect(classGatedDifficulty(def, hero('erudit', ['soldat', 'erudit']))).toBe('difficile');
  });
});

describe('classGatedDifficulty — scope « ever » (AA 12 l.5 « n\'a jamais appartenu »)', () => {
  it('jamais-guerrier (aucune Carrière Guerriers dans l’historique) : majoré, comme `current`', () => {
    const def = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1, scope: 'ever' as const } };
    expect(classGatedDifficulty(def, hero('erudit'))).toBe('difficile');
  });

  it('Guerrier ACTUEL (Classe courante = Guerriers) : couvert', () => {
    const def = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1, scope: 'ever' as const } };
    expect(classGatedDifficulty(def, hero('soldat'))).toBe('complexe');
  });

  it("un EX-guerrier reconverti (careerHistory contient une Carrière Guerriers) : PAS de majoration `ever`, alors que `current` majore", () => {
    const gateCurrent = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1 } };
    const gateEver = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1, scope: 'ever' as const } };
    const exGuerrier = hero('erudit', ['soldat', 'erudit']);
    expect(classGatedDifficulty(gateCurrent, exGuerrier)).toBe('difficile'); // LDB 23 : Classe courante ≠ Guerriers
    expect(classGatedDifficulty(gateEver, exGuerrier)).toBe('complexe'); // AA 12 : a un jour appartenu → couvert
  });

  it('careerHistory ABSENT : replie sur `[career]` (héros jamais reclassé)', () => {
    const def = { difficulty: 'complexe' as const, classGate: { classes: ['guerriers'], outsidePenalty: 1, scope: 'ever' as const } };
    expect(classGatedDifficulty(def, hero('soldat'))).toBe('complexe');
    expect(classGatedDifficulty(def, hero('erudit'))).toBe('difficile');
  });
});

describe('everBelongedClasses', () => {
  it('sans careerHistory : la seule Classe COURANTE', () => {
    expect([...everBelongedClasses(hero('soldat'))]).toEqual(['guerriers']);
  });
  it('avec careerHistory : toutes les Classes CUMULÉES, sans doublon', () => {
    expect([...everBelongedClasses(hero('erudit', ['soldat', 'colporteur', 'erudit']))].sort()).toEqual(['guerriers', 'itinerants', 'lettres']);
  });
});

describe('statusIncomeMax (Réputation, LDB 23 l.228-234 — « le maximum de vos revenus standards »)', () => {
  it('Bronze : 2d10 sous de cuivre par Standing → max 20 × Standing', () => {
    expect(toBrass(statusIncomeMax('bronze', 4))).toBe(80);
  });
  it('Argent : 1d10 pistoles par Standing → max 10 pa × Standing', () => {
    expect(toBrass(statusIncomeMax('argent', 2))).toBe(20 * 12);
  });
  it('Or : 1 couronne d’or FIXE par Standing (pas de dé)', () => {
    expect(statusIncomeMax('or', 3).gold).toBe(3);
  });
});
