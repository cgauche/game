import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from './flow';
import type { Combatant } from '../engine/types';

/** Test de SCÈNE (dialogue/exploration) : au lieu de désigner AUTOMATIQUEMENT le meilleur du groupe,
 *  on porte la liste des candidats et le JOUEUR choisit qui lance (`testSetActor`) avant le jet. */
describe('Test de scène — choix du lanceur dans le groupe', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null }); });

  const mk = (id: string, name: string, dex: number) => ({
    id, name, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: dex, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  } as unknown as Combatant);

  it('candidats = tout le groupe ; défaut = le meilleur ; testSetActor re-cible le Test', () => {
    useGame.setState({ party: [mk('h1', 'Alric', 55), mk('h2', 'Bri', 35)] });
    runFlow(useGame.getState, useGame.setState, testFlow({ characteristic: 'Dex', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.candidates?.map((c) => c.id)).toEqual(['h1', 'h2']); // tout le groupe vivant
    expect(pt.actorId).toBe('h1'); // défaut = le meilleur (Dex 55)
    // SOUTIEN (LDB 12) : l'AUTRE membre assiste (+10, plafond Bonus de Carac 5) → 55 + 10.
    expect(pt.skillValue).toBe(65);
    // Le joueur DÉSIGNE Bri (Dex 35) → valeur + cible re-ciblées (Soutien d'Alric : +10) sans recalcul.
    useGame.getState().testSetActor('h2');
    const pt2 = useGame.getState().pendingTest!;
    expect(pt2.actorId).toBe('h2');
    expect(pt2.skillValue).toBe(45); // 35 + 10 (Soutien)
    expect(pt2.target).toBe(45); // Intermédiaire (+0)
  });

  it('un seul héros vivant → pas de choix (candidates absent)', () => {
    useGame.setState({ party: [mk('h1', 'Solo', 40)] });
    runFlow(useGame.getState, useGame.setState, testFlow({ characteristic: 'Dex', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.candidates).toBeUndefined();
    expect(useGame.getState().pendingTest!.actorId).toBe('h1');
  });

  it('testSetActor refusé APRÈS le jet (le lanceur est figé)', () => {
    useGame.setState({ party: [mk('h1', 'Alric', 55), mk('h2', 'Bri', 35)] });
    runFlow(useGame.getState, useGame.setState, testFlow({ characteristic: 'Dex', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    useGame.getState().testRoll();
    useGame.getState().testSetActor('h2'); // après le jet → no-op
    expect(useGame.getState().pendingTest!.actorId).toBe('h1');
  });
});
