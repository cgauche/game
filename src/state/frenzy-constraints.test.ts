import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { frenzyTarget } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { tome1Intro } from '../scenes/tome1-intro';

/**
 * Contraintes de Frénésie pour le HÉROS (LDB 21 l.34) : « vous devez vous déplacer à votre maximum
 * en direction de l'ennemi le plus proche dans votre Ligne de Vue pour l'attaquer. La seule Action
 * possible est un Test de Capacité de Combat ou un Test d'Athlétisme. »
 */
describe('Frénésie héros — cible imposée et déplacement contraint', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingAttack: null }); });

  function setup() {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = foes;
    for (const e of foes.slice(2)) e.wounds.current = 0;
    H.pos = { x: 6, y: 10 };
    H.frenzied = true;
    E1.pos = { x: 8, y: 10 }; // le plus PROCHE (2 cases)
    E2.pos = { x: 12, y: 10 }; // plus loin (6 cases)
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false }, pendingReveals: [] });
    return { H, E1, E2 };
  }

  it('frenzyTarget = l’ennemi le plus proche en Ligne de Vue', () => {
    const { H, E1 } = setup();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(frenzyTarget(useGame.getState, h)?.id).toBe(E1.id);
  });

  it('attaquer un AUTRE ennemi que le plus proche est refusé ; le plus proche passe', () => {
    const { E1, E2 } = setup();
    useGame.getState().battleClickEntity(E2.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull(); // refusé : pas le plus proche
    useGame.getState().battleClickEntity(E1.id, { confirm: true });
    expect(useGame.getState().pendingAttack?.targetId).toBe(E1.id); // charge/attaque sur la cible imposée
  });

  it('se déplacer en s’ÉLOIGNANT de la cible imposée est refusé ; s’en rapprocher passe', () => {
    const { H } = setup();
    const before = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    useGame.getState().battleClickTile({ x: before.x - 2, y: before.y }, { confirm: true }); // s'éloigne
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before);
    useGame.getState().battleClickTile({ x: before.x + 1, y: before.y }, { confirm: true }); // se rapproche
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: before.x + 1, y: before.y });
  });
});
