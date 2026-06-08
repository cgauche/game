import { describe, it, expect } from 'vitest';
import { addCondition, testStatePenalty, endOfRound, hasCondition } from './conditions';
import { makeRNG } from './dice';
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
});
