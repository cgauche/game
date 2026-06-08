import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 3, fortune: 0, ...p,
  } as Combatant);

describe('Effet restoreFortune — Chance regagnée en début de session (LDB 17 l.47)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('chaque héros regagne sa Chance jusqu’au maximum = Destin actuel', () => {
    const a = hero({ id: 'a', fate: 3, fortune: 0 });
    const b = hero({ id: 'b', fate: 2, fortune: 1 });
    useGame.setState({ party: [a, b] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'restoreFortune' }]);
    const p = useGame.getState().party;
    expect(p.find((h) => h.id === 'a')!.fortune).toBe(3); // 0 → Destin 3
    expect(p.find((h) => h.id === 'b')!.fortune).toBe(2); // 1 → Destin 2
  });

  it('n’affecte pas un combattant sans Destin (ennemi)', () => {
    const enemy = hero({ id: 'e', kind: 'enemy', fate: undefined, fortune: 0 });
    useGame.setState({ party: [enemy] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'restoreFortune' }]);
    expect(useGame.getState().party[0].fortune).toBe(0); // inchangé
  });
});
