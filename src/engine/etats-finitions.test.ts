import { describe, it, expect } from 'vitest';
import { addCondition, testStatePenalty, endOfRound, hasCondition, bleedDeathRoll, recoveredStacks } from './conditions';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import type { Combatant } from './types';

const C = (over: Partial<Combatant>): Combatant =>
  ({ id: 'c', name: 'C', kind: 'hero', conditions: [], skills: [], characteristics: { E: 90 }, wounds: { current: 20, max: 20 }, advantage: 3, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

describe('Finitions d\'États (LDB 16)', () => {
  it('subir un État quel qu\'il soit → perte de TOUT Avantage (l.15)', () => {
    const c = C({ advantage: 4 });
    addCondition(c, 'Aveuglé');
    expect(c.advantage).toBe(0);
  });

  it('testStatePenalty : À Terre −20 / Empêtré −10 sur un Test de déplacement (l.37 / l.85)', () => {
    expect(testStatePenalty(C({ conditions: [{ name: 'À Terre', value: 1 }] }), 'Athlétisme')).toBe(-20);
    expect(testStatePenalty(C({ conditions: [{ name: 'Empêtré', value: 1 }] }), 'Esquive')).toBe(-10);
    expect(testStatePenalty(C({ conditions: [{ name: 'À Terre', value: 1 }] }), 'Charme')).toBe(0); // Charme ≠ déplacement
  });

  it('Empoisonné : Test de Résistance en fin de Round retire l\'État, puis 1 Exténué (l.70-72)', () => {
    const c = C({ characteristics: { E: 90 } as never, conditions: [{ name: 'Empoisonné', value: 1 }] });
    endOfRound(c, makeRNG(1)); // E 90 → Résistance réussie → retire le poison
    expect(hasCondition(c, 'Empoisonné')).toBe(false);
    expect(hasCondition(c, 'Exténué')).toBe(true);
  });

  it('recoveredStacks : « 1 + DR » borné aux pions ; échec ⇒ 0 (l.61/77/107)', () => {
    expect(recoveredStacks(0, 3, true)).toBe(1);   // DR 0 → 1 pion
    expect(recoveredStacks(2, 3, true)).toBe(3);   // 1+2 = 3, borné à 3
    expect(recoveredStacks(5, 2, true)).toBe(2);   // borné au nombre de pions
    expect(recoveredStacks(-3, 3, true)).toBe(1);  // DR négatif clampé à 0 → 1
    expect(recoveredStacks(4, 3, false)).toBe(0);  // échec → rien
    expect(recoveredStacks(4, 0, true)).toBe(0);   // aucun pion → rien
  });

  it('Hémorragique : coagulation (double) du dernier État → 1 Exténué (l.109)', () => {
    const c = C({ conditions: [{ name: 'Hémorragique', value: 1 }] });
    const dbl: RNG = { int: () => 11 }; // jet 11 = double → coagule
    const out = bleedDeathRoll(c, dbl);
    expect(out.died).toBe(false);
    expect(hasCondition(c, 'Hémorragique')).toBe(false);
    expect(hasCondition(c, 'Exténué')).toBe(true);
  });
});
