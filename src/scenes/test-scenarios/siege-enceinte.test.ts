import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './siege-enceinte';
import { combatDistance } from '../../state/footprint';
import { lineOfSightCover } from '../../state/lineOfSight';

/**
 * Vérif LOGIQUE (headless) du siège vertical : sur la base z-aware (Lot 0), un défenseur sur le chemin de
 * ronde (z=1) voit/tire un assaillant au sol (z=0) et n'est PAS frappable en mêlée à travers le vide.
 */
describe('Siège vertical — combat z-aware (siege-enceinte)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('scène : 2 niveaux, escalier DANS LA COUR (z0↔z1), corps de garde (porte + tours)', () => {
    const s = scenario.scene;
    expect(s.levels.map((l) => l.z)).toEqual([0, 1]);
    // Escalier = volée dans la cour (palier en saillie z=1), pas collé au mur.
    expect(s.stairs?.[0]).toMatchObject({ from: { x: 3, y: 7, z: 0 }, to: { x: 3, y: 7, z: 1 } });
    // Corps de garde : une PORTE de ville (height:1, monte au chemin de ronde) + des TOURS (height:2).
    expect(s.walls?.some((w) => w.structure === 'porte-de-ville')).toBe(true);
    expect(s.walls?.filter((w) => w.structure === 'porte-de-ville').every((w) => w.height === 1)).toBe(true);
    expect(s.walls?.some((w) => w.height === 2)).toBe(true); // tours du corps de garde / d'angle
  });

  it('défenseur z=1 (chemin de ronde) ↔ assaillant z=0 : distance verticale, LdV dégagée, mêlée à travers le vide refusée', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const scene = useGame.getState().scene!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy' && c.pos);

    // Les assaillants ont bien spawné au SOL (z=0, z omis).
    expect(foes.length).toBeGreaterThan(0);
    expect(foes.every((f) => (f.pos!.z ?? 0) === 0)).toBe(true);

    // Le héros monte sur le chemin de ronde (z=1), au-dessus de la tuile de mur (9,6).
    hero.pos = { x: 9, y: 6, z: 1 };

    // (a) Un assaillant en contrebas, juste au pied du mur (9,5 au sol) : distance z-aware = 2 → PAS mêlée-adjacent.
    const below = foes[0]; below.pos = { x: 9, y: 5 };
    expect(combatDistance(hero, below)).toBe(2); // max(horizontal 1, vertical 2)

    // (b) Un assaillant dans le champ : le défenseur le VOIT et peut le tirer (LdV cross-z dégagée par-dessus le parapet).
    const field = foes[1]; field.pos = { x: 11, y: 1 };
    expect(combatDistance(hero, field)).toBeGreaterThanOrEqual(2); // atteignable au tir, pas au contact
    expect(lineOfSightCover(scene, hero.pos, field.pos!, []).blocked).toBe(false);
    // …et la LdV vers l'assaillant au pied du mur reste dégagée (on tire droit en bas).
    expect(lineOfSightCover(scene, hero.pos, below.pos!, []).blocked).toBe(false);
  });

  it('emplacements de siège (baliste/canon) : INERTES → ciblables (combatants) mais SANS tour (hors order)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('assaut');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const baliste = b.combatants.find((c) => c.id === 'empl-baliste');
    const canon = b.combatants.find((c) => c.id === 'empl-canon');
    expect(baliste?.inert).toBe(true);
    expect(canon?.inert).toBe(true);
    expect(baliste?.bodyShape).not.toBe('vehicule'); // PAS une coque-navire (rendu = engin via l'espèce)
    expect(b.order).not.toContain('empl-baliste');   // inerte → aucun tour (l'arme se SERT, l'affût n'agit pas)
    expect(b.order).not.toContain('empl-canon');
    expect(b.combatants).toContain(baliste);          // mais RESTE dans le combat (ciblable / servable)
  });
});
