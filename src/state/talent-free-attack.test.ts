/**
 * Talents d'attaque DÉCLENCHÉE en DONNÉE (`TalentData.effects` → op `grantFreeAttack{immediate}`, résolu
 * par `resolveTalentFreeAttacks`). Assaut féroce (LDB 10) : « une fois par Round, si vous touchez en mêlée
 * → attaque supplémentaire (coût Avantage ou Mouvement) ». Preuve que créer un talent qui DONNE une attaque
 * fonctionne de bout en bout depuis la donnée.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolveTalentFreeAttacks } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';

const HIT: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};

describe('Talents d’attaque déclenchée (grantFreeAttack en donnée)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingAttack: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent → l'attaque supplémentaire est à portée
    return { H, E };
  }

  it('Assaut féroce (onHit) : une touche du héros déclenche UNE attaque supplémentaire (1/Round)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'assaut-feroce', times: 1 }];
    H.advantage = 3; // de quoi payer l'attaque supplémentaire (coût Avantage)
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['assaut-feroce']).toBe(1); // le talent a tiré son attaque supplémentaire, 1× ce Round
  });

  it('sans le talent : une touche ne déclenche AUCUNE attaque supplémentaire', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.advantage = 3;
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false }, pendingAttack: { attackerId: H.id, targetId: E.id, location: null, result: HIT } });
    useGame.getState().attackConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['assaut-feroce']).toBeUndefined();
  });

  it('Frappe réactive (onCharged) : la cible Chargée riposte hors séquence si le Test d’Init réussit', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    H.characteristics.I = 99; // Test d'Initiative Intermédiaire quasi-garanti
    resolveTalentFreeAttacks(useGame.getState, useGame.setState, H, 'onCharged', E);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.freeAttacksThisTurn?.['frappe-reactive']).toBe(1); // a riposté 1× contre ce chargeur
    // 2ᵉ tentative contre le MÊME chargeur ce Round : refusée (1× par chargeur).
    resolveTalentFreeAttacks(useGame.getState, useGame.setState, H, 'onCharged', E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
  });
});
