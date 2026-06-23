import { describe, it, expect } from 'vitest';
import { resolveRecoverTest } from './recover';
import type { Combatant } from '../../engine/types';

/**
 * `resolveRecoverTest` — SOURCE UNIQUE des paramètres du Test de récupération par Action (LDB 16 l.61/77),
 * lue de la donnée `EtatData.recover`. Partagée par l'IA (combatFlow) et le flux joueur (combatSlice) ;
 * fin du `if state === empetre … else athletisme` dupliqué. Pin de la résolution (skill/opposé/source).
 */
const mk = (over: Partial<Combatant>): Combatant =>
  ({ id: 'c', name: 'C', kind: 'enemy', conditions: [], skills: [], characteristics: { F: 40, Ag: 35 } as never,
     wounds: { current: 10, max: 10 }, ...over } as unknown as Combatant);

describe('resolveRecoverTest (LDB 16 l.61/77) — données EtatData.recover', () => {
  it('En flammes : Test d’Athlétisme SIMPLE (l.77)', () => {
    const c = mk({ conditions: [{ name: 'en-flammes', value: 1 }] });
    const r = resolveRecoverTest(c, 'en-flammes')!;
    expect(r.opposed).toBe(false);
    expect(r.skillLabel).toBe('Athlétisme');
    expect(r.difficulty).toBe('intermediaire');
  });

  it('Empêtré + escapeStrength FIGÉE : Test OPPOSÉ de Force contre cette valeur (priorité, même source absente)', () => {
    const c = mk({ conditions: [{ name: 'empetre', value: 1, escapeStrength: 55, sourceId: 'ghost' }] });
    const r = resolveRecoverTest(c, 'empetre')!; // pas de battle → source vivante introuvable, mais escapeStrength prime
    expect(r.opposed).toBe(true);
    expect(r.opponentValue).toBe(55);
    expect(r.skillLabel).toBe('Force');
  });

  it('Empêtré + source VIVANTE (sans escapeStrength) : opposé contre la Force de la source', () => {
    const c = mk({ conditions: [{ name: 'empetre', value: 1, sourceId: 's' }] });
    const src = mk({ id: 's', name: 'Toile', characteristics: { F: 62 } as never });
    const r = resolveRecoverTest(c, 'empetre', { combatants: [c, src] })!;
    expect(r.opposed).toBe(true);
    expect(r.opponentValue).toBe(62); // Force de la source vivante
    expect(r.opponentName).toBe('Toile');
  });

  it('Empêtré sans source ni escapeStrength : Test SIMPLE (pas d’opposition)', () => {
    const c = mk({ conditions: [{ name: 'empetre', value: 1 }] });
    const r = resolveRecoverTest(c, 'empetre')!;
    expect(r.opposed).toBe(false);
    expect(r.skillLabel).toBe('Force');
  });

  it('État sans `recover` (Sonné) : non récupérable par Action → null', () => {
    const c = mk({ conditions: [{ name: 'sonne', value: 1 }] });
    expect(resolveRecoverTest(c, 'sonne')).toBeNull();
  });
});
