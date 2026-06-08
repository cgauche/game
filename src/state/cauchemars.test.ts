import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { nightmareCheck, hasCondition } from '../engine/conditions';
import { nightsCrossed, MINUTES_PER_DAY } from '../engine/clock';
import { seedBattleRng } from './battleRng';
import type { RNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 35, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('nightsCrossed (clock)', () => {
  it('aucune nuit franchie dans la même journée diurne', () => {
    expect(nightsCrossed(12 * 60, 13 * 60)).toBe(0);
  });
  it('une nuit franchie (passe 22:00)', () => {
    expect(nightsCrossed(12 * 60, 23 * 60)).toBe(1);
  });
  it('deux nuits sur un repos de 2 jours', () => {
    expect(nightsCrossed(12 * 60, 12 * 60 + 2 * MINUTES_PER_DAY)).toBe(2);
  });
});

describe('nightmareCheck (LDB 21 l.92)', () => {
  it('Calme Facile +40 raté → Exténué', () => {
    const c = hero({ characteristics: { FM: 35 } as never });
    const fail: RNG = { int: () => 90 }; // 90 > (35+40=75) → échec
    nightmareCheck(c, fail);
    expect(hasCondition(c, 'Exténué')).toBe(true);
  });
  it('Calme réussi → pas d’Exténué', () => {
    const c = hero({ characteristics: { FM: 35 } as never });
    const ok: RNG = { int: () => 20 }; // 20 ≤ 75 → réussite
    nightmareCheck(c, ok);
    expect(hasCondition(c, 'Exténué')).toBe(false);
  });
});

describe('Effet inflictNightmares + hook nocturne (advanceTime)', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('inflictNightmares pose le trauma sur le héros visé', () => {
    const a = hero({ id: 'a' });
    const b = hero({ id: 'b' });
    useGame.setState({ party: [a, b] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictNightmares', heroId: 'b' }]);
    expect(useGame.getState().party.find((h) => h.id === 'b')!.nightmares).toBe(true);
    expect(useGame.getState().party.find((h) => h.id === 'a')!.nightmares).toBeUndefined();
  });

  it('franchir une nuit déclenche un Test pour le héros marqué (journal)', () => {
    const noon = 12 * 60; // milieu de journée d’un Jour 0
    useGame.setState({ party: [hero({ id: 'a', nightmares: true })], gameTime: noon, journal: [] });
    useGame.getState().advanceTime(12 * 60); // +12 h → passe 22:00
    expect(useGame.getState().journal.some((l) => /cauchemars|sommeil/i.test(l))).toBe(true);
  });

  it('un héros NON marqué ne déclenche rien la nuit', () => {
    useGame.setState({ party: [hero({ id: 'a' })], gameTime: 12 * 60, journal: [] });
    useGame.getState().advanceTime(12 * 60);
    expect(useGame.getState().journal.some((l) => /cauchemars|sommeil/i.test(l))).toBe(false);
  });

  it('rester en journée (aucune nuit franchie) ne déclenche rien', () => {
    useGame.setState({ party: [hero({ id: 'a', nightmares: true })], gameTime: 12 * 60, journal: [] });
    useGame.getState().advanceTime(60); // +1 h, reste avant 22:00
    expect(useGame.getState().journal.some((l) => /cauchemars|sommeil/i.test(l))).toBe(false);
  });
});
