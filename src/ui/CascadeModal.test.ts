import { describe, it, expect } from 'vitest';
import { jetStepPresentable } from './CascadeModal';
import type { CascadeStep } from '../state/pendings';
import type { Combatant } from '../engine/types';

/**
 * #P0-2 (recette d'écran 2026-07-10) : une étape-JET `worldOwner` (seam #275 Décision 3 —
 * désertion/Moral, `src/state/rollSeam.ts:183`) n'a AUCUN `actorId` par conception — le vieux garde
 * `if (!actor) return null` de `CascadeModal` rendait `null` pour TOUS les sièges, y compris l'owner
 * MJ (l'état disait « surfacé », l'écran ne montrait rien). `jetStepPresentable` est le prédicat
 * extrait qui remplace ce garde — testé ici en isolation (pas de harnais de rendu React dans ce repo).
 */
function baseStep(overrides: Partial<CascadeStep> = {}): CascadeStep {
  return { id: 's1', kind: 'sea-desertion', label: 'Désertion', target: 50, result: null, ...overrides };
}

describe('jetStepPresentable — présentabilité d’une étape-JET de cascade', () => {
  it('étape MONDIALE (`worldOwner`, aucun actorId) : PRÉSENTABLE malgré l’absence d’acteur', () => {
    const step = baseStep({ worldOwner: true, actorId: undefined });
    expect(jetStepPresentable(step, undefined)).toBe(true);
  });

  it('RÉGRESSION — étape À acteur (comportement historique) : présentable avec son acteur…', () => {
    const step = baseStep({ actorId: 'h1' });
    const actor = { id: 'h1', name: 'Aldo' } as Combatant;
    expect(jetStepPresentable(step, actor)).toBe(true);
  });

  it('…et NON présentable si son acteur est introuvable et l’étape n’est PAS mondiale (aucun repli silencieux)', () => {
    const step = baseStep({ actorId: 'orphan' });
    expect(jetStepPresentable(step, undefined)).toBe(false);
  });
});
