import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from './flow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

describe('Test de Sociabilité vs groupe haï (dialogue) — malus psy appliqué (LDB 21, P3)', () => {
  beforeEach(() => {
    useGame.setState({ pendingTest: null, battle: null });
  });

  function hero(name: string, soc: number, traits: { type: string; cible: string }[] = []) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name, rng: makeRNG(1) });
    h.characteristics.Soc = soc;
    h.skills = []; // pas d'avances → testValue = Soc brut
    h.psychTraits = traits as never;
    return h;
  }

  it('un Test de Charme vs « Elfes » : le PJ haineux subit −20, target réduite', () => {
    const a = hero('Gotrek', 50, [{ type: 'animosite', cible: 'Elfes' }]);
    useGame.setState({ party: [a] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'Charme', difficulty: 'intermediaire', vsGroups: ['Elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.actorId).toBe(a.id);
    expect(pt.skillValue).toBe(30); // 50 − 20 (Animosité)
    expect(pt.target).toBe(30); // Intermédiaire +0
    expect(pt.psychMod).toBe(-20);
    expect(pt.psychDetail).toBe('Animosité −20 envers Elfe'); // libellé lisible (finding #5)
  });

  it('choisit le meilleur PJ EFFECTIF (malus intégré au choix)', () => {
    const haineux = hero('Gotrek', 50, [{ type: 'animosite', cible: 'Elfes' }]); // 50 − 20 = 30
    const neutre = hero('Felix', 40); // 40, pas de malus
    useGame.setState({ party: [haineux, neutre] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'Charme', vsGroups: ['Elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.actorId).toBe(neutre.id); // Felix (40) > Gotrek (30 après malus)
    expect(pt.psychMod ?? 0).toBe(0); // l'acteur choisi n'a pas de malus
  });

  it('Test NON-social (Force) vs un groupe → aucun malus psy', () => {
    const a = hero('Gotrek', 50, [{ type: 'animosite', cible: 'Elfes' }]);
    useGame.setState({ party: [a] });
    runFlow(useGame.getState, useGame.setState, testFlow({ characteristic: 'F', vsGroups: ['Elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.psychMod ?? 0).toBe(0); // F n'est pas un Test de Sociabilité
  });

  it('Animosité ACTIVE (Test de Psy échoué) → pas de malus social « contenu » (compulsion, LDB 21 l.24)', () => {
    const a = hero('Gotrek', 50, [{ type: 'animosite', cible: 'Elfes' }]);
    a.psychState = [{ type: 'animosite', cible: 'Elfes', active: true }] as never; // état actif (échec)
    useGame.setState({ party: [a] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: 'Charme', vsGroups: ['Elfe'] }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.psychMod ?? 0).toBe(0); // actif → compulsion, pas le −20 contenu
    expect(pt.skillValue).toBe(50);
  });
});
