import { describe, it, expect } from 'vitest';
import { canReroll } from './fortune';
import { evaluateTest } from './tests';
import { rederivePassiveAttack } from './combat';
import { rederiveCastSL, type SpellLike } from './magic';
import type { Combatant, Weapon } from './types';

describe('canReroll — Chance : relance 1×/Test sur jet propre raté (LDB ch.12 l.56 + ch.12 l.29-31)', () => {
  it('jet raté, pas encore relancé → relance possible', () => {
    expect(canReroll(true, false)).toBe(true);
  });
  it('jet raté mais déjà relancé → impossible (1 relance max, l.56)', () => {
    expect(canReroll(true, true)).toBe(false);
  });
  it('jet réussi → impossible (relance réservée aux Tests échoués, l.24)', () => {
    expect(canReroll(false, false)).toBe(false);
  });
  it('jet réussi et déjà relancé → impossible', () => {
    expect(canReroll(false, true)).toBe(false);
  });
});

const ranger = (CT = 50): Combatant =>
  ({
    name: 'Tir',
    characteristics: { CC: 40, CT, F: 35, E: 35, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    advantage: 0, conditions: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    wounds: { current: 10, max: 10 }, skills: [],
  }) as unknown as Combatant;
const cible = (E = 30): Combatant =>
  ({
    name: 'Cible',
    characteristics: { CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    advantage: 0, conditions: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    wounds: { current: 10, max: 10 }, skills: [],
  }) as unknown as Combatant;
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: '+9', range: 60, qualities: [] };

describe('rederivePassiveAttack — +1 DR (re-dérive un tir figé sans relancer)', () => {
  it('+1 DR augmente les Dégâts d’un tir réussi (BE+PA constants)', () => {
    const a = ranger();
    const d = cible(30); // BE(30) = 3, PA = 0
    const atk = evaluateTest(20, 50); // réussi, DR = 5 - 2 = 3
    const r0 = rederivePassiveAttack(a, d, bow, atk, 'ranged');
    const r1 = rederivePassiveAttack(a, d, bow, { ...atk, sl: atk.sl + 1 }, 'ranged');
    expect(r0.hit).toBe(true);
    expect(r1.woundsLost!).toBe(r0.woundsLost! + 1); // +1 DR = +1 dégât = +1 Blessure
  });
  it('+1 DR ne fabrique pas une touche sur un tir raté (succès = d100, inchangé)', () => {
    const atk = evaluateTest(80, 50); // d100 raté
    const r = rederivePassiveAttack(ranger(), cible(), bow, { ...atk, sl: atk.sl + 1 }, 'ranged');
    expect(r.hit).toBe(false);
  });
});

const mage = (Int = 30): Combatant =>
  ({
    name: 'Mage',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int, FM: 35, Soc: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, wounds: { current: 10, max: 10 },
    skills: [{ name: 'Langue', spec: 'Magick', characteristic: 'Int', advances: 1 }],
  }) as unknown as Combatant;
const dart: SpellLike = { label: 'Fléchette', type: 'Sort des Arcanes', cn: 3, desc: 'Projectile magique. Dégâts +4.' };

describe('rederiveCastSL — +1 DR sur une incantation figée', () => {
  it('+1 DR fait franchir le seuil NI (DR < NI → cast)', () => {
    // d100 = 28 ≤ cible 31 (Int30+1) → succès ; DR brut = 3 - 2 = 1 < NI 3 → pas lancé.
    const cur = { cast: false, roll: 28, target: 31, sl: 1, isCritical: false, isFumble: false, log: '' };
    const r2 = rederiveCastSL(mage(30), mage(30), dart, cur, false, false, 2); // +2 DR → DR 3 ≥ NI 3
    expect(r2.cast).toBe(true);
  });
});
