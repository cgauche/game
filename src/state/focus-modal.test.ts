import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

// Focalisation par modale (LDB — Test étendu) : « un jet = une modale ».
describe('Focalisation en modale (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingFocus: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('battleFocusSpell ouvre pendingFocus sans tirer ; focusRoll tire ; focusConfirm cumule le DR + consomme l’Action', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'Mage', rng: makeRNG(3) });
    hero.characteristics.FM = 80;
    hero.spells = ['Arme aethyrique'];
    if (!hero.skills.some((s) => s.skillId === 'focalisation')) hero.skills.push({ skillId: 'focalisation', advances: 20, characteristic: 'FM' } as never);
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(2);
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    let st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'focus', selectedSpell: 'Arme aethyrique', acted: false } });

    useGame.getState().battleFocusSpell('Arme aethyrique');
    expect(useGame.getState().pendingFocus).toBeTruthy();
    expect(useGame.getState().pendingFocus!.result).toBeNull(); // pas encore lancé

    useGame.getState().focusRoll();
    expect(useGame.getState().pendingFocus!.result).toBeTruthy(); // jet figé

    useGame.getState().focusConfirm();
    st = useGame.getState();
    expect(st.pendingFocus).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === heroC.id)!.focus?.spell).toBe('Arme aethyrique'); // DR cumulé
    expect(st.battle!.acted).toBe(true); // la Focalisation consomme l'Action
  });

  it('un sort non focalisable (Magie mineure) n’ouvre pas la modale', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name: 'Mage', rng: makeRNG(3) });
    hero.spells = ['Fléchette'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const st = useGame.getState();
    const heroC = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const turn = st.battle!.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...st.battle!, turn, action: 'focus', acted: false } });
    useGame.getState().battleFocusSpell('Fléchette'); // Magie mineure → non focalisable
    expect(useGame.getState().pendingFocus).toBeNull();
  });
});
