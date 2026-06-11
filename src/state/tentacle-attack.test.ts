import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { recomputeLoadout } from '../engine/items';
import { attachMutation } from '../engine/corruption';
import { rollMutation } from '../data/mutations';
import { hasCondition } from '../engine/conditions';
import { tome1Intro } from '../scenes/tome1-intro';
import type { Combatant } from '../engine/types';

// ---------------------------------------------------------------------------
// Tentacule épais (LDB 19) → trait Tentacules (LDB 85 l.354) : arme naturelle +
// Attaque GRATUITE 1/tour (Empêtré sur Dégâts). Cornes asymétriques → Arme de
// Créature (Dégâts = Bonus de Force, LDB p.338).
// ---------------------------------------------------------------------------

const mutTentacule = () => rollMutation('physique', { int: () => 38 }); // Tentacule épais
const mutCornes = () => rollMutation('physique', { int: () => 83 }); // Cornes asymétriques

describe('armes naturelles de mutation (recomputeLoadout)', () => {
  it('trait Tentacules → arme Tentacule (+BF) ; Cornes asymétriques → arme Cornes (+BF)', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    attachMutation(hero, mutTentacule());
    attachMutation(hero, mutCornes());
    recomputeLoadout(hero);
    const t = hero.weapons.find((w) => w.uid === 'nat-tentacule');
    expect(t?.name).toBe('Tentacule');
    expect(t?.damage).toBe('+BF');
    const c = hero.weapons.find((w) => w.uid === 'nat-cornes');
    expect(c?.name).toBe('Cornes');
    expect(c?.damage).toBe('+BF');
  });

  it('sans mutation : aucune arme naturelle dérivée', () => {
    const hero = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    recomputeLoadout(hero);
    expect(hero.weapons.some((w) => w.uid === 'nat-tentacule' || w.uid === 'nat-cornes')).toBe(false);
  });
});

describe('Attaque gratuite de Tentacule (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(withTentacle = true) {
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
    if (withTentacle) {
      attachMutation(H, mutTentacule());
      recomputeLoadout(H);
    }
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('frappe gratuite : modale standard, Action préservée, 1/tour, Empêtré sur Dégâts', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup();
    H.characteristics.CC = 95;
    H.characteristics.F = 45;
    const before = E.wounds.current;
    useGame.getState().battleTentacle(E.id);
    const pa = useGame.getState().pendingAttack;
    expect(pa?.freeTentacle).toBe(true);
    expect(pa?.weaponUid).toBe('nat-tentacule');
    expect(pa?.result).toBeNull(); // « un jet = une modale » : rien n'est tiré avant Lancer
    useGame.getState().attackRoll();
    expect(useGame.getState().pendingAttack?.result).toBeTruthy();
    useGame.getState().attackConfirm();
    const st = useGame.getState();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    const h2 = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.acted).toBe(false); // GRATUITE : l'Action reste disponible
    expect(h2.tentacleUsedThisTurn).toBe(true); // consommée pour ce tour
    expect(e2.wounds.current).toBeLessThan(before); // CC 95 vs Mutant : touche déterministe (seed 2)
    expect(hasCondition(e2, 'Empêtré')).toBe(true); // LDB 85 l.354 : Dégâts → Empêtré
    // 2ᵉ tentative le même tour : refusée.
    useGame.getState().battleTentacle(E.id);
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('refusée sans le trait Tentacules', () => {
    const { E } = setup(false);
    useGame.getState().battleTentacle(E.id);
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('refusée hors de portée (cible non adjacente)', () => {
    const { E } = setup();
    E.pos = { x: 14, y: 10 };
    useGame.getState().battleTentacle(E.id);
    expect(useGame.getState().pendingAttack).toBeNull();
  });
});
