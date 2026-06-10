/**
 * L13 — Gates & redirections (LDB 41/42/47) :
 *  - Bénédiction de Protection : « Test de FM Accessible (+20) pour attaquer votre cible.
 *    Sur un échec, ils doivent choisir une cible ou une Action différente. »
 *  - Martyr : « Vous recevez tous les Dégâts subis en principe par vos cibles […] votre BE est
 *    doublé pour le calcul des PB subis à cause de ces Dégâts. »
 *  - Attaques en chaîne : « S'il réduit la cible à 0 Blessure, il rebondit […] max BFM fois. »
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyCast, applyAttackResult, attackWardGate, doAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG, type RNG } from '../engine/dice';
import { findSpell } from '../data';
import { tome1Intro } from '../scenes/tome1-intro';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import type { CastResult, MissileResult } from '../engine/magic';

/** RNG scripté (padding 5). */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 5 } as RNG;
}

describe('L13 — gates & redirections', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingReveals: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const H = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'H', rng: makeRNG(1) });
    const P = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'P', rng: makeRNG(2) });
    useGame.setState({ party: [H, P] });
    useGame.getState().startScene(tome1Intro);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    useGame.getState().seedRng(7);
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.name === 'H')!;
    const priest = b.combatants.find((c) => c.name === 'P')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    hero.pos = { x: 10, y: 10 };
    priest.pos = { x: 9, y: 10 };
    foes.forEach((f, i) => { f.pos = { x: 11 + i, y: 10 }; });
    return { hero, priest, foes };
  }

  it('B. de Protection : jet raté → l’attaque est refusée ; jet réussi → autorisée avec jet montré', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, roundsLeft: 6, attackWardFM: true }];
    E.characteristics.FM = 30; // cible Accessible 50
    const refused = attackWardGate(E, hero, seq([99]));
    expect(refused.allowed).toBe(false);
    expect(refused.lines.join(' ')).toMatch(/ne peut se résoudre|Bénédiction de Protection/);
    const allowed = attackWardGate(E, hero, seq([5]));
    expect(allowed.allowed).toBe(true);
    expect(allowed.lines.join(' ')).toMatch(/surmonte/);
    const noWard = attackWardGate(E, foes[1] ?? hero, seq([99]));
    if (foes[1]) expect(noWard).toEqual({ allowed: true, lines: [] }); // sans bénédiction : aucun Test
  });

  it('B. de Protection : l’IA renonce à frapper le héros béni (jet raté)', () => {
    const { hero, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Bénédiction de Protection', bonus: 0, roundsLeft: 6, attackWardFM: true }];
    E.characteristics.FM = 1; // cible 21
    // graine dont le 1er d100 rate la cible 21 (cherchée puis rejouée — déterministe par seed).
    let failSeed: number | null = null;
    for (let s = 1; s <= 60; s++) {
      useGame.getState().seedRng(s);
      if (!attackWardGate(E, hero).allowed) { failSeed = s; break; }
    }
    expect(failSeed).not.toBeNull();
    useGame.getState().seedRng(failSeed!);
    const before = hero.wounds.current;
    const suspended = doAttack(useGame.getState, useGame.setState, E, hero);
    expect(suspended).toBe(false);
    expect(hero.wounds.current).toBe(before);
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/Bénédiction de Protection/);
  });

  it('Martyr : le prêtre encaisse les Dégâts bruts à 2×BE, la cible ne perd rien', () => {
    const { hero, priest, foes } = setup();
    const E = foes[0];
    hero.activeEffects = [{ label: 'Martyr', bonus: 0, roundsLeft: 4, martyrGuard: priest.id }];
    priest.characteristics.E = 30; // BE 3 → doublé 6
    priest.armour.corps = 0;
    priest.wounds = { current: 12, max: 12 } as Combatant['wounds'];
    const heroBefore = hero.wounds.current;
    const res = { hit: true, damage: 10, woundsLost: 7, location: 'corps', critical: false, log: 'touche.' } as unknown as AttackResult;
    const weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [] } as unknown as Weapon;
    applyAttackResult(useGame.getState, useGame.setState, E, hero, weapon, res);
    expect(hero.wounds.current).toBe(heroBefore); // la cible est épargnée
    expect(priest.wounds.current).toBe(12 - Math.max(0, 10 - 6)); // 10 bruts − 2×BE(3) = 4
  });

  it('Attaques en chaîne : la cible tombe à 0 → le Projectile rebondit sur l’ennemi voisin', () => {
    const { hero, foes } = setup();
    const E1 = foes[0]; // cible principale, mourante
    const E2 = foes[1]; // voisin — receveur du rebond
    if (!E2) return; // garde : la rencontre doit fournir ≥ 2 ennemis
    hero.characteristics.FM = 40; // BFM 4 → 4 rebonds max, saut 4 m
    hero.skills.push({ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 10 });
    E1.wounds = { current: 1, max: 8 } as Combatant['wounds'];
    E2.pos = { x: 12, y: 10 }; // à 1 case d'E1 (11,10)
    const e2Before = E2.wounds.current;
    const res: CastResult & Partial<MissileResult> = {
      cast: true, roll: 30, target: 70, sl: 2, isCritical: false, isFumble: false, log: 'lance Attaques en chaîne',
      hit: true, woundsLost: 5, damage: 10, location: 'corps', defenderDefeated: false,
    };
    applyCast(useGame.getState, useGame.setState, hero, E1, findSpell('Attaques en chaîne')!, res, true, false);
    const log = useGame.getState().battle!.log.map((e) => e.text).join('\n');
    expect(E1.wounds.current).toBe(0);
    expect(log).toMatch(/rebondit sur/);
    expect(E2.wounds.current).toBeLessThan(e2Before); // le rebond a frappé
  });
});
