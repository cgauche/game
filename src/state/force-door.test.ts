import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

/** Enfoncer une porte à PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE, métier =
 *  DÉGÂTS sur objet (BE / B). Chaque héros frappe indépendamment (Bagarre → DR + BF − BE) avec son
 *  propre cycle d'influence ; la somme ronge les Blessures jusqu'à céder. Objets : PAS de minimum 1. */
describe('Enfoncer une porte à plusieurs (objet BE/B, jets indépendants)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingForceDoor: null, flags: {} }); });

  function heroes() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name, rng: makeRNG(seed) });
      h.fortune = 2; h.resilience = 2; h.characteristics.F = 45; // Bonus de Force 4
      return h;
    };
    const a = mk('A', 1), b = mk('B', 2);
    useGame.setState({ party: [a, b] });
    return [a, b];
  }

  it('chacun frappe indépendamment ; les dégâts cumulés font céder la porte (flag posé)', () => {
    useGame.getState().seedRng(7);
    const [a, b] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte de la cave', doorBE: 0, doorB: 8, heroIds: [a.id, b.id], flag: 'cave_ouverte' });
    let guard = 0;
    while (useGame.getState().pendingForceDoor && guard++ < 40) {
      const p = useGame.getState().pendingForceDoor!;
      p.participants.forEach((part) => useGame.getState().forceDoorRoll(part.id)); // chacun SON jet
      expect(useGame.getState().pendingForceDoor!.participants.every((x) => x.result)).toBe(true);
      useGame.getState().forceDoorConfirm(); // applique la somme du Round
    }
    expect(useGame.getState().pendingForceDoor).toBeNull(); // la porte a cédé
    expect(useGame.getState().flags.cave_ouverte).toBe(true); // ouverture en jeu (flag de scène)
    expect(guard).toBeGreaterThanOrEqual(1);
  });

  it('EDO : DR + BF < BE → 0 dégât (la porte ne bouge pas) — objets sans minimum 1', () => {
    const [a, b] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte blindée', doorBE: 8, doorB: 5, heroIds: [a.id, b.id] });
    // Coups faibles (comme Gerhardt : DR −2 + BF 4 = 2 < BE 8 → 0).
    const p = useGame.getState().pendingForceDoor!;
    useGame.setState({ pendingForceDoor: { ...p, participants: p.participants.map((x) => ({ ...x, result: { roll: 63, target: 46, sl: -2, damage: 0 } })) } });
    useGame.getState().forceDoorConfirm();
    expect(useGame.getState().pendingForceDoor!.doorB).toBe(5); // 0 dégât → Blessures inchangées, nouveau Round
  });

  it('Résilience garantit un coup ; chaque héros dépense SES propres ressources', () => {
    const [a] = heroes();
    useGame.getState().startForceDoor({ label: 'Porte', doorBE: 0, doorB: 50, heroIds: [a.id] });
    useGame.getState().forceDoorForceSuccess(a.id); // « Je ne faillirai pas ! » → DR max → dégâts
    const r = useGame.getState().pendingForceDoor!.participants[0].result!;
    expect(r.damage).toBeGreaterThan(0);
    expect(useGame.getState().party[0].resilience).toBe(1); // 1 Point de Résilience dépensé (le SIEN)
  });
});
