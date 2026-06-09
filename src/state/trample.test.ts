import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { trampleTarget, aiMaybeTrample } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

// ---------------------------------------------------------------------------
// Piétinement — action gratuite à 1 Avantage (LDB 85 - Traits de créature.md l.320-321)
// ---------------------------------------------------------------------------

const at = (kind: 'hero' | 'enemy', id: string, x: number, y: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind,
    characteristics: { CC: 40, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Patte', type: 'melee', damage: '+BF', qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y }, ...over,
  }) as unknown as Combatant;

describe('trampleTarget — cible de Piétinement (pur)', () => {
  it('renvoie un adversaire adjacent PLUS PETIT et vivant ; pas un égal/lointain/mort', () => {
    const big = at('enemy', 'TROLL', 5, 5, { size: 'grande' });
    const small = at('hero', 'H1', 5, 6, { size: 'moyenne' }); // adjacent, plus petit
    const equal = at('hero', 'H2', 4, 5, { size: 'grande' }); // adjacent mais même Taille
    const far = at('hero', 'H3', 5, 9, { size: 'petite' }); // plus petit mais loin
    const battle = { combatants: [big, small, equal, far] } as unknown as BattleState;
    expect(trampleTarget(battle, big)?.id).toBe('H1');
    expect(trampleTarget(battle, big, 'H2')).toBeUndefined(); // ciblage explicite d'un égal → rien
    expect(trampleTarget(battle, big, 'H3')).toBeUndefined(); // trop loin
  });
});

describe('Piétinement en combat (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    E.wounds = { current: 30, max: 30, base: 30 } as Combatant['wounds'];
    E.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: 'trample', movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('héros plus grand piétine un adversaire adjacent plus petit (touche, action gratuite)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics.CC = 85;
    H.characteristics.F = 45;
    H.advantage = 2;
    const before = E.wounds.current;
    // Modale : battleTrample ouvre SANS tirer ; trampleRoll tire ; trampleConfirm applique (gratuit).
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeTruthy();
    expect(useGame.getState().pendingTrample!.result).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBe(before); // pas encore appliqué
    useGame.getState().trampleRoll();
    expect(useGame.getState().pendingTrample!.result).toBeTruthy();
    useGame.getState().trampleConfirm();
    const st = useGame.getState();
    expect(st.pendingTrample).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBeLessThan(before); // touché
    expect(st.battle!.acted).toBe(false); // action GRATUITE : n'a pas consommé l'Action
  });

  it('coût : un Piétinement raté dépense bien 1 Avantage (CC=1 → échec déterministe)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.size = 'grande';
    H.characteristics.CC = 1; // rate quasiment à coup sûr
    H.advantage = 2;
    const before = E.wounds.current;
    useGame.getState().battleTrample(E.id);
    useGame.getState().trampleRoll();
    useGame.getState().trampleConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.advantage).toBe(1); // 2 − 1 (coût), pas de +1 (raté)
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.wounds.current).toBe(before);
  });

  it('refusé sans Avantage : la modale ne s’ouvre pas', () => {
    const { H, E } = setup();
    H.size = 'grande';
    H.advantage = 0;
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeNull();
  });

  it('refusé contre une cible de même Taille : la modale ne s’ouvre pas', () => {
    const { H, E } = setup();
    H.size = 'moyenne';
    E.size = 'moyenne';
    H.advantage = 2;
    useGame.getState().battleTrample(E.id);
    expect(useGame.getState().pendingTrample).toBeNull();
  });

  it('IA : un ennemi plus grand avec de l’Avantage piétine un héros adjacent plus petit', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    E.size = 'enorme';
    E.characteristics.CC = 85;
    E.characteristics.F = 45;
    E.advantage = 2;
    H.size = 'moyenne';
    H.wounds = { current: 50, max: 50, base: 50 } as Combatant['wounds'];
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    const before = H.wounds.current;
    aiMaybeTrample(useGame.getState, useGame.setState, E);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(before);
  });
});
