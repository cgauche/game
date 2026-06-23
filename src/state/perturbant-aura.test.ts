import { describe, it, expect } from 'vitest';
import { combatHooksOf } from './combatHooks';
import './combat/roundHooks'; // effet de bord : enregistre les hooks de fin de Round (dont recompute-auras)
import { combatTestPenalty } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/**
 * Perturbant (LDB 85 p.341) — MIGRÉ en DONNÉES : l'aura (−20 aux Tests à BE mètres, ennemis seulement, NON
 * cumulable) vit dans `TraitData.aura` ; le hook GÉNÉRIQUE `recompute-auras` la projette (par géométrie)
 * dans `Combatant.auraMods`, lu par `passiveMods` (kind `etat`) → `combatTestPenalty`. Aucun trait nommé.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [], traits: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4,
  pos: { x: 5, y: 5 },
  ...over,
}) as unknown as Combatant;

const recompute = (combatants: Combatant[]) => {
  const hook = combatHooksOf('onRoundEnd').find((h) => h.id === 'recompute-auras')!;
  hook.run({ battle: { combatants } } as never);
};

describe('Perturbant — aura de DONNÉE projetée par le hook générique recompute-auras', () => {
  it('un ennemi à BE mètres d’une créature Perturbante subit −20 aux Tests', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never }); // BE 3 → 3 m
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } as never }); // 1 case = 2 m ≤ 3 m
    recompute([p, hero]);
    expect(hero.auraMods).toEqual([{ op: 'testMod', amount: -20 }]);
    expect(combatTestPenalty(hero)).toBe(-20);
  });
  it('hors de portée → aucune aura', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 15, y: 5 } as never });
    recompute([p, hero]);
    expect(hero.auraMods ?? []).toEqual([]);
    expect(combatTestPenalty(hero)).toBe(0);
  });
  it('un ALLIÉ de la créature Perturbante n’est PAS affecté (affects: enemies)', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const ally = mk({ id: 'a', kind: 'enemy', pos: { x: 6, y: 5 } as never });
    recompute([p, ally]);
    expect(ally.auraMods ?? []).toEqual([]);
  });
  it('NON-CUMUL : deux créatures Perturbantes adjacentes → −20 (pas −40)', () => {
    const p1 = mk({ id: 'p1', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const p2 = mk({ id: 'p2', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 6 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } as never });
    recompute([p1, p2, hero]);
    expect(hero.auraMods?.length).toBe(2); // deux sources accumulées
    expect(combatTestPenalty(hero)).toBe(-20); // mais non-cumul (pool min), pas −40
  });
  it('recalcul intégral : sorti de portée au Round suivant → aura effacée', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } as never });
    recompute([p, hero]);
    expect(hero.auraMods?.length).toBe(1);
    hero.pos = { x: 20, y: 20 } as never; // s'éloigne
    recompute([p, hero]);
    expect(hero.auraMods ?? []).toEqual([]); // reset + hors portée
  });
});
