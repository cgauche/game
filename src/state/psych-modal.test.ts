import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { maybeOpenHeroPsych } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { evaluateTest } from '../engine/tests';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

describe('Test de Psychologie héros en modale (Peur/Terreur)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingPsych: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(enemySize: Combatant['size']) {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source
    E.size = enemySize;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn }, pendingPsych: null, pendingReveals: [] }); // vide la révélation d'Initiative
    return { H, E };
  }

  it('Terreur : maybeOpenHeroPsych ouvre la modale ; psychRoll+psychConfirm applique le Brisé', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('enorme'); // gap 2 → Terreur 2
    H.characteristics.FM = 10; // Test de Calme raté → Brisé
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    const pp = useGame.getState().pendingPsych;
    expect(pp).toBeTruthy();
    expect(pp!.kind).toBe('terreur');
    expect(pp!.sourceId).toBe(E.id);
    expect(pp!.result).toBeNull();

    useGame.getState().psychRoll();
    expect(useGame.getState().pendingPsych!.result).toBeTruthy();
    useGame.getState().psychConfirm();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.name === 'Brisé')).toBe(true);
    expect((h.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === E.id)).toBe(true);
    expect(useGame.getState().pendingPsych).toBeNull(); // la source est désormais en psychState → plus de test ce Round
  });

  it('Peur : la modale s’ouvre (kind peur) et cumule le DR', () => {
    useGame.getState().seedRng(2);
    const { E } = setup('grande'); // gap 1 → Peur 1
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    const pp = useGame.getState().pendingPsych;
    expect(pp?.kind).toBe('peur');
    expect(pp?.sourceId).toBe(E.id);
    useGame.getState().psychRoll();
    expect(typeof useGame.getState().pendingPsych!.result!.calmeDR).toBe('number');
    useGame.getState().psychConfirm();
    expect(useGame.getState().pendingPsych).toBeNull();
  });

  it('Peur — Résilience « Je ne faillirai pas ! » : réussite forcée + CHOIX de la valeur du dé (LDB 17 l.73)', () => {
    useGame.getState().seedRng(2);
    const { H } = setup('grande'); // Peur 1
    H.resilience = 2;
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingPsych?.kind).toBe('peur');

    // Résilience AVANT le jet : réussite garantie, défaut 01 → DR maximum, −1 Résilience.
    useGame.getState().psychForceSuccess();
    const r1 = useGame.getState().pendingPsych!;
    expect(r1.forced).toBe(true);
    expect(r1.result!.success).toBe(true);
    expect(r1.result!.roll).toBe(1);
    const target = r1.result!.target!;
    expect(r1.result!.calmeDR).toBe(Math.max(evaluateTest(1, target).sl, 1)); // cumule depuis prevDR=0
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.resilience).toBe(1);

    // « vous choisissez le résultat » : choisir le pire dé encore réussi (= la cible) → DR minimal.
    useGame.getState().psychSetForcedRoll(target);
    const r2 = useGame.getState().pendingPsych!;
    expect(r2.result!.roll).toBe(target);
    expect(r2.result!.calmeDR).toBe(Math.max(evaluateTest(target, target).sl, 0));

    // Un dé RATÉ (> cible) est refusé : le résultat ne change pas.
    useGame.getState().psychSetForcedRoll(Math.min(99, target) + 1);
    expect(useGame.getState().pendingPsych!.result!.roll).toBe(target);
  });

  it('pas de source de peur (ennemi de même Taille) → aucune modale', () => {
    setup('moyenne');
    maybeOpenHeroPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingPsych).toBeNull();
  });
});
