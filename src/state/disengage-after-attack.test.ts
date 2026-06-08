import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

/**
 * Bug playtest « pas le droit de bouger après avoir attaqué » : une attaque de mêlée Engage,
 * et le Désengagement était bloqué dès que l'Action était dépensée — y compris l'option A
 * (« Sacrifier l'Avantage ») qui, elle, NE coûte PAS l'Action (LDB 15-Dépl l.87). On vérifie
 * qu'après avoir agi, un héros Engagé avec l'Avantage supérieur peut encore partir via l'option A.
 */
describe('Désengagement après avoir attaqué (option A — LDB 15 l.87)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingDisengage: null }); });

  it('héros Engagé ayant DÉJÀ agi peut se désengager en sacrifiant l’Avantage', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'A', rng: makeRNG(3) });
    useGame.setState({ party: [hero] });
    useGame.getState().seedRng(3);
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    let st = useGame.getState();
    const H = st.battle!.combatants.find((c) => c.kind === 'hero')!;
    const E = st.battle!.combatants.find((c) => c.kind === 'enemy')!;
    H.engagedWith = [E.id]; E.engagedWith = [H.id];
    H.advantage = 2; E.advantage = 0;
    const turn = st.battle!.order.indexOf(H.id);
    // L'Action est DÉJÀ dépensée (le héros vient d'attaquer) :
    useGame.setState({ battle: { ...st.battle!, turn, action: null, moved: false, acted: true } });

    useGame.getState().battleDisengage(); // doit ouvrir le menu malgré l'Action dépensée
    const pd = useGame.getState().pendingDisengage;
    expect(pd).not.toBeNull();
    expect(pd!.canSacrifice).toBe(true);
    expect(pd!.canEsquive).toBe(false); // Esquive indisponible (coûte l'Action) → pas de boucle infinie

    useGame.getState().disengageConfirmA();
    st = useGame.getState();
    expect(st.battle!.action).toBe('move'); // mouvement libre rouvert
    expect(st.battle!.acted).toBe(true); // l'option A NE consomme PAS l'Action (préservée)
    expect(st.pendingDisengage).toBeNull();
  });
});
