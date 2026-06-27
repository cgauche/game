import { describe, it, expect } from 'vitest';
import { combatOpening } from './combat';
import { COND } from './conditions';
import type { Combatant } from './types';

function mk(opts: Partial<Combatant>): Combatant {
  return {
    id: 'c', name: 'c', kind: 'enemy', advantage: 0, conditions: [],
    characteristics: {} as never, size: 'moyenne', psychState: [], groups: [],
    weapons: [], armour: {} as never, skills: [], talents: [], movement: 4,
    wounds: { current: 10, max: 10 }, ...opts,
  } as Combatant;
}

/**
 * Ouverture de combat (#78) — dérivée du RÉSULTAT de surprise (État Surpris déjà posé par
 * applySurprise), pas de l'intention. L'embuscade (héros surpris) prime sur l'assaut.
 */
describe('combatOpening — type d’ouverture dérivé de l’État Surpris', () => {
  it('un héros surpris → embuscade (on nous tombe dessus)', () => {
    const hero = mk({ id: 'h', kind: 'hero', conditions: [{ name: COND.surpris, value: 1 }] });
    const enemy = mk({ id: 'e', kind: 'enemy' });
    expect(combatOpening([hero, enemy])).toBe('ambush');
  });

  it('un ennemi surpris, aucun héros surpris → assaut (on les prend par surprise)', () => {
    const hero = mk({ id: 'h', kind: 'hero' });
    const enemy = mk({ id: 'e', kind: 'enemy', conditions: [{ name: COND.surpris, value: 1 }] });
    expect(combatOpening([hero, enemy])).toBe('assault');
  });

  it('personne surpris → combat ordinaire', () => {
    const hero = mk({ id: 'h', kind: 'hero' });
    const enemy = mk({ id: 'e', kind: 'enemy' });
    expect(combatOpening([hero, enemy])).toBe('combat');
  });

  it('héros ET ennemi surpris → l’embuscade prime', () => {
    const hero = mk({ id: 'h', kind: 'hero', conditions: [{ name: COND.surpris, value: 1 }] });
    const enemy = mk({ id: 'e', kind: 'enemy', conditions: [{ name: COND.surpris, value: 1 }] });
    expect(combatOpening([hero, enemy])).toBe('ambush');
  });
});
