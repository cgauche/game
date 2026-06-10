import { describe, it, expect } from 'vitest';
import { Characteristics, Combatant, ItemInstance } from './types';
import { makeRNG, RNG } from './dice';
import { dailyFoodUpkeep, isStarving, hungerCharPenalties, rationCount, isRation } from './provisions';
import { effectiveChar } from './characteristics';
import { restRecovery } from './rest';
import { addCondition, stacks } from './conditions';

const chars = (E = 30): Characteristics => ({
  CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30,
});

const ration = (uid: string): ItemInstance => ({ uid, name: 'Ration', kind: 'misc', qualities: [], enc: 0, equipped: false });

function hero(opts: { E?: number; rations?: number; brouet?: boolean } = {}): Combatant {
  return {
    id: 'h', name: 'Gunnar', kind: 'hero',
    characteristics: chars(opts.E),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: Array.from({ length: opts.rations ?? 0 }, (_, i) => ration(`r${i}`)),
    skills: [], talents: opts.brouet ? [{ name: 'Brouet', times: 1 }] : [], movement: 4,
  };
}

/** RNG forcé : d100 → toujours `roll` (échec/réussite déterministe), d10 → 10. */
const fixed = (roll: number): RNG => ({ int: (min, max) => (max === 100 ? roll : max) });

describe('dailyFoodUpkeep — rations (LDB p.302) et faim (LDB 18 l.422)', () => {
  it('consomme 1 ration/jour ; nourri = pas de faim', () => {
    const c = hero({ rations: 2 });
    const r = dailyFoodUpkeep(c, 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.rationConsumed).toBe(true);
    expect(rationCount(c)).toBe(1);
    expect(isStarving(c)).toBe(false);
  });

  it('sans nourriture : Test de Résistance tous les 2 jours seulement', () => {
    const c = hero({ rations: 0 });
    const d1 = dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(d1.log).toEqual([]); // jour 1 : pas encore de Test
    expect(isStarving(c)).toBe(true);
    const d2 = dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(d2.log.join(' ')).toContain('Test de Résistance');
  });

  it('1ᵉʳ échec → −10 F et E (effectiveChar) ; 2ᵉ échec → dégâts ignorant les PA (min 1) + −10 ailleurs', () => {
    const c = hero({ rations: 0, E: 30 });
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // j1
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // j2 : Test raté → 1ᵉʳ échec
    expect(c.hunger?.failures).toBe(1);
    expect(effectiveChar(c, 'F')).toBe(20);
    expect(effectiveChar(c, 'E')).toBe(20);
    expect(effectiveChar(c, 'Ag')).toBe(30); // pas encore
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // j3
    const d4 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // j4 : 2ᵉ échec
    expect(c.hunger?.failures).toBe(2);
    expect(d4.damage).toBe(7); // d10 forcé à 10 − BE 3 = 7
    expect(effectiveChar(c, 'Ag')).toBe(20);
    expect(hungerCharPenalties(c, 'Int')).toEqual([-10]);
  });

  it('les Tests sont de plus en plus difficiles : −10 par Test déjà tenté (l.418)', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    const d2 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // 1ᵉʳ Test : cible 30
    expect(d2.log[0]).toContain('30');
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    const d4 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // 2ᵉ Test : cible 30 − 10 = 20
    expect(d4.log[0]).toContain('(−10)');
    expect(d4.log[0]).toContain('20');
  });

  it('manger à nouveau efface compteurs et malus (choix documenté)', () => {
    const c = hero({ rations: 0 });
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    dailyFoodUpkeep(c, 30, 3, fixed(95));
    expect(effectiveChar(c, 'F')).toBe(20);
    c.items!.push(ration('r9'));
    const r = dailyFoodUpkeep(c, 30, 3, makeRNG(1));
    expect(r.ate).toBe(true);
    expect(r.log.join(' ')).toContain('mange enfin à sa faim');
    expect(isStarving(c)).toBe(false);
    expect(effectiveChar(c, 'F')).toBe(30);
  });

  it('Brouet (LDB 10 l.113) : 1 ration couvre 2 jours, Test de faim tous les 3 jours', () => {
    const c = hero({ rations: 1, brouet: true });
    const d1 = dailyFoodUpkeep(c, 30, 3, makeRNG(1));
    expect(d1.rationConsumed).toBe(true);
    const d2 = dailyFoodUpkeep(c, 30, 3, makeRNG(1)); // jour « gratuit »
    expect(d2.ate).toBe(true);
    expect(d2.rationConsumed).toBe(false);
    // Puis plus rien : Test au 3ᵉ jour de jeûne (pas au 2ᵉ).
    dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j1
    const j2 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j2 : pas de Test
    expect(j2.log).toEqual([]);
    const j3 = dailyFoodUpkeep(c, 30, 3, fixed(95)); // jeûne j3 : Test
    expect(j3.log.join(' ')).toContain('Test de Résistance');
  });

  it('isRation : « Ration » / « Rations », pas « Rationnel »', () => {
    expect(isRation({ name: 'Ration' })).toBe(true);
    expect(isRation({ name: 'Rations (1 jour)' })).toBe(true);
    expect(isRation({ name: 'Rationnel' })).toBe(false);
  });
});

describe('Faim & repos (LDB 18 l.418) : pas de récupération naturelle sans provisions', () => {
  it('affamé : le repos ne rend ni PB ni Exténué (les maladies suivent leur cours)', () => {
    const c = hero({ rations: 0 });
    c.hunger = { days: 2, tests: 1, failures: 0 };
    c.wounds.current = 5;
    addCondition(c, 'Exténué', 2);
    const log = restRecovery(c, makeRNG(1));
    expect(c.wounds.current).toBe(5);
    expect(stacks(c, 'Exténué')).toBe(2);
    expect(log.join(' ')).toContain('affamé');
  });

  it('nourri : le repos fonctionne normalement', () => {
    const c = hero({ rations: 1 });
    c.wounds.current = 5;
    addCondition(c, 'Exténué', 2);
    restRecovery(c, makeRNG(1));
    expect(c.wounds.current).toBeGreaterThan(5);
    expect(stacks(c, 'Exténué')).toBe(0);
  });
});
