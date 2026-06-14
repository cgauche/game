import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castSpell } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/** Contre-sort à PLUSIEURS (Dissipation, LDB 46 l.201-202/207 : « plusieurs lanceurs … effectuent
 *  leur lancer SÉPARÉMENT ») — flux MULTI parallèle : le Sort ENNEMI est figé dans `pendingCast`,
 *  chaque héros contre-lanceur a SON jet + influence (`pendingCounterspell.participants`). */
describe('Contre-sort à plusieurs (flux multi parallèle)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCounterspell: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Sorcier', name, careerTalent: 'Magie mineure', rng: makeRNG(seed) });
      h.spells = ['Fléchette'];
      h.resilience = 1; // pour le test Résilience
      return h;
    };
    const w1 = mk('W1', 707), w2 = mk('W2', 101);
    useGame.setState({ party: [w1, w2] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.characteristics.Int = 48; E.characteristics.FM = 53;
    E.skills = [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 15 }];
    E.spells = ['Carreau'];
    heroes.forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = { ...h.wounds, max: 99, current: 99 }; });
    E.pos = { x: 12, y: 10 }; // ≤ FM mètres de chaque héros
    useGame.setState({ battle: { ...b } });
    return { heroes: heroes as Combatant[], E };
  }

  /** Ouvre l'incantation ENNEMIE figée (= ce que fera le pré-roll de `castSpell` pour un lanceur IA). */
  function enemyCast(E: Combatant, target: Combatant) {
    castSpell(useGame.getState, useGame.setState, E, target, 'Carreau');
    useGame.getState().castRoll();
  }
  function openCounter(ids: string[]) {
    useGame.setState({ pendingCounterspell: { participants: ids.map((id) => ({ id, interactive: true, result: null })) } });
  }

  it('chaque héros lance SON Contre-sort (jets indépendants) et consomme son essai du Round', () => {
    useGame.getState().seedRng(9);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    useGame.getState().counterspellRoll(h1.id);
    useGame.getState().counterspellRoll(h2.id);
    const pcs = useGame.getState().pendingCounterspell!;
    expect(pcs.participants[0].result).toBeTruthy();
    expect(pcs.participants[1].result).toBeTruthy();
    const cur = () => useGame.getState().battle!.combatants;
    expect(cur().find((c) => c.id === h1.id)!.dispelledThisRound).toBe(true);
    expect(cur().find((c) => c.id === h2.id)!.dispelledThisRound).toBe(true);
    // « Appliquer » : agrège + résout via castConfirm → les deux pendings se ferment.
    useGame.getState().counterspellConfirm();
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
  });

  it('Résilience d’un héros FORCE la dissipation → la cible ne subit aucun Dégât', () => {
    useGame.getState().seedRng(5);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    useGame.getState().counterspellForceSuccess(h2.id); // « Je ne faillirai pas ! » → gagne l'opposition
    const part = useGame.getState().pendingCounterspell!.participants.find((p) => p.id === h2.id)!;
    expect(part.result!.dispelled).toBe(true);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h2.id)!.resilience).toBe(0); // 1 dépensé
    useGame.getState().counterspellConfirm();
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === h1.id)!.wounds.current).toBe(99); // dissipé : intacte
  });

  it('« Laisser passer » (aucun Contre-sort) → le Sort se résout tel quel', () => {
    useGame.getState().seedRng(3);
    const { heroes, E } = setup();
    const [h1] = heroes;
    enemyCast(E, h1);
    const castLog = useGame.getState().pendingCast!.result!.log;
    openCounter([h1.id]);
    useGame.getState().counterspellCancel(); // personne ne contre
    for (let i = 0; i < 8 && useGame.getState().pendingReveals.length; i++) useGame.getState().dismissReveal();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
    expect(castLog).not.toContain('Contre-sort'); // le jet ennemi n'a pas été opposé
  });
});
