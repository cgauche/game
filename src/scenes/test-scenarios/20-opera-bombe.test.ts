import { flowEffects } from '../../state/flow';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { applyEffects } from '../../state/combatEffects';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { scenario } from './20-opera-bombe';
import type { Effect } from '../../state/scene';

/**
 * Valide le CÂBLAGE AUTHORED du scénario « Opéra — Bombe » (pas seulement les primitifs isolés) :
 * on rejoue les Effets RÉELS de la scène via le vrai store. Catch les fautes d'authoring (rect de
 * trigger, effets d'interact, flag de désamorçage mal nommé…).
 */
describe('Scénario « Opéra — Bombe » : le câblage en données compose', () => {
  // partyPos dans l'antichambre (le souffle de zone cible le groupe à partyPos hors combat).
  beforeEach(() => useGame.setState({ battle: null, flags: {}, scheduledEffects: [], gameTime: 20 * 60, partyPos: { x: 11, y: 6 } }));

  const armTrigger = scenario.scene.triggers.find((t) => t.id === 'armer-bombe')!;
  const plant = scenario.scene.entities.find((e) => e.id === 'plante')!;
  const detectTest = plant.interact!.effects[0] as Extract<Effect, { type: 'test' }>;

  function lonePartyAt(wounds: number) {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(1) });
    h.wounds = { current: wounds, max: wounds };
    useGame.setState({ party: [h] });
    return h;
  }

  it('le scénario expose bien le trigger d’armement et la plante interactive', () => {
    expect(armTrigger).toBeTruthy();
    expect(detectTest.type).toBe('test');
    expect(detectTest.easierIf?.hasSkill).toBe('Projectiles (Poudre noire)');
  });

  it('entrer dans la loge arme la mèche (delayedEffect programmé)', () => {
    lonePartyAt(30);
    applyEffects(useGame.getState, useGame.setState, flowEffects(armTrigger.flow));
    expect(useGame.getState().scheduledEffects).toHaveLength(1);
  });

  it('détecter la plante (branche RÉUSSITE) pose le flag de désamorçage → pas d’explosion', () => {
    const before = lonePartyAt(30).wounds.current;
    applyEffects(useGame.getState, useGame.setState, flowEffects(armTrigger.flow));
    applyEffects(useGame.getState, useGame.setState, detectTest.onSuccess!);
    expect(useGame.getState().flags.bombeDesamorcee).toBe(true);
    useGame.getState().advanceTime(120);
    expect(useGame.getState().party[0].wounds.current).toBe(before); // intacte
    expect(useGame.getState().scheduledEffects).toHaveLength(0);
  });

  it('ne pas désamorcer → l’explosion frappe le groupe au bout de la mèche', () => {
    const before = lonePartyAt(30).wounds.current;
    applyEffects(useGame.getState, useGame.setState, flowEffects(armTrigger.flow));
    useGame.getState().advanceTime(60); // franchit l'échéance
    expect(useGame.getState().party[0].wounds.current).toBeLessThanOrEqual(before - 15); // souffle (+ En flammes)
    expect(useGame.getState().scheduledEffects).toHaveLength(0);
  });
});
