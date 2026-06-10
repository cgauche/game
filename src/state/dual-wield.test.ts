import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { resolveDualSecond, applyAttackResult } from './combatFlow';
import { reverseRoll, type AttackResult } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';

const W = (uid: string, hand: 'main' | 'off'): Weapon =>
  ({ uid, name: hand === 'main' ? 'Épée' : 'Dague', type: 'melee', damage: '+BF', qualities: [], hand, hands: 1 });

const CHARS = (cc: number) => ({ CC: cc, CT: 30, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 });
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });

const mkHero = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'h', name: 'H', kind: 'hero', pos: { x: 0, y: 0 }, size: 3,
  characteristics: CHARS(50), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 12, max: 12, current: 12 },
  weapons: [W('m', 'main'), W('o', 'off')], armour: ARM(), ...over,
} as unknown as Combatant);

const mkFoe = (id: string, x: number): Combatant => ({
  id, name: id, kind: 'enemy', pos: { x, y: 0 }, size: 3,
  characteristics: CHARS(30), skills: [], talents: [], advantage: 0, conditions: [],
  wounds: { base: 10, max: 10, current: 10 },
  weapons: [{ name: 'Griffe', type: 'melee', damage: '+BF', qualities: [] }], armour: ARM(),
} as unknown as Combatant);

function setupBattle(heroOver: Partial<Combatant> = {}) {
  const h = mkHero(heroOver); const f1 = mkFoe('f1', 1); const f2 = mkFoe('f2', 1);
  useGame.setState({
    scene: { ambiance: 'exterieur', weather: 'clair' } as any,
    gameTime: 0,
    battle: { combatants: [h, f1, f2], order: ['h', 'f1', 'f2'], turn: 0, round: 1, log: [],
      acted: false, movementUsed: 0, movedPreAction: false, loadoutSwapped: false, reachable: new Map() } as any,
    pendingReveals: [],
  });
  const b = useGame.getState().battle!;
  return {
    h: b.combatants.find((c) => c.id === 'h')!,
    f1: b.combatants.find((c) => c.id === 'f1')!,
    f2: b.combatants.find((c) => c.id === 'f2')!,
  };
}

describe('resolveDualSecond : 2ᵉ attaque du Maniement de deux armes (LDB 10 l.638)', () => {
  beforeEach(() => setupBattle());

  it('utilise le jet INVERSÉ de la main directrice comme jet de la 2ᵉ attaque (34 → 43)', () => {
    const { h, f2 } = setupBattle();
    const off = h.weapons.find((w) => w.hand === 'off')!;
    const res = resolveDualSecond(useGame.getState, h, f2, off, 34);
    expect(res.attackerRoll).toBe(reverseRoll(34)); // 43
  });

  it('exception Critique : utilise la valeur du tableau des Critiques, pas l’inversion', () => {
    const { h, f2 } = setupBattle();
    const off = h.weapons.find((w) => w.hand === 'off')!;
    const res = resolveDualSecond(useGame.getState, h, f2, off, 11, { critValue: 56 });
    expect(res.attackerRoll).toBe(56);
  });
});

describe('applyAttackResult : defer de l’Avantage de l’attaquant', () => {
  it('deferAttackerAdvantage=true → n’incrémente PAS l’Avantage de l’attaquant', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, h, f1, h.weapons[0], res, undefined, undefined, true);
    expect(h.advantage).toBe(0);
  });
  it('sans defer → incrémente normalement', () => {
    const { h, f1 } = setupBattle();
    h.advantage = 0;
    const res = { hit: true, attackerRoll: 10, netSL: 2, critical: false, advantageTo: 'attacker',
      defenderDefeated: false, woundsLost: 0, location: 'corps', log: 'x' } as unknown as AttackResult;
    applyAttackResult(useGame.getState, useGame.setState, h, f1, h.weapons[0], res);
    expect(h.advantage).toBe(1);
  });
});
