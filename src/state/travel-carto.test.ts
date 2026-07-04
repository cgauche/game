/**
 * Voyage — poste « Établir des cartes » (EDOC l.161) : Test ÉTENDU inter-Étapes. Gardes de non-régression
 * sur l'affichage du jet quotidien :
 *  - le libellé de la ligne de jet = la Compétence RÉELLEMENT utilisée, LABEL résolu AVEC sa spec
 *    (« Métier (Cartographe) »), jamais l'id brut (`metier`) ni `def.skills[0]` sans spec ;
 *  - le poste porte le contexte de test étendu (drDone/drTarget) → barre de DR côté cascade.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { buildStageSteps } from './travelPostes';
import type { Combatant } from '../engine/types';

const cartoHero = (): Combatant =>
  ({
    id: 'h', name: 'Hilda', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 40, I: 30, Ag: 30, Dex: 40, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    skills: [{ skillId: 'metier', spec: 'Cartographe', characteristic: 'Dex', advances: 20 }],
  } as Combatant);

describe('Voyage — poste Cartographie (Établir des cartes, test étendu)', () => {
  beforeEach(() => {
    useGame.setState({
      party: [cartoHero()],
      travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } }, extendedProgress: 1 } as never,
    });
  });

  it('rollLabel = compétence RÉSOLUE avec spec (« Métier (Cartographe) »), jamais l’id', () => {
    const steps = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete');
    const carto = steps.find((s) => s.meta?.activityId === 'etablir-cartes')!;
    expect(carto.rollLabel).toBe('Métier (Cartographe)');
  });

  it('porte le contexte de test étendu (drDone/drTarget) pour la barre de DR', () => {
    const steps = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete');
    const carto = steps.find((s) => s.meta?.activityId === 'etablir-cartes')!;
    expect(typeof carto.meta?.extendedDrTarget).toBe('number');
    expect(carto.meta?.extendedDrTarget as number).toBeGreaterThan(0);
    expect(carto.meta?.extendedDrDone).toBe(1); // = extendedProgress AVANT ce jet
  });
});
