import { describe, it, expect } from 'vitest';
import trappings from './trappings.json';

/**
 * Garde-fou de DONNÉE — verrouille l'invariant « Allonge ⊥ Portée » (LDB 62) et empêche le retour du
 * « type menteur » `reach: string|null` (qui contenait jadis des NOMBRES, puis des formules de Portée).
 *   - `reach` = Allonge de MÊLÉE (string « Moyenne »/« Longue »…) / null — JAMAIS un nombre, JAMAIS une
 *     formule de Portée « BFx3 ». (Les munitions gardent EN PLUS un modificateur relatif à l'arme —
 *     « Moitié de l'arme »/« +50 »… — axe distinct, hors `range` propre.)
 *   - `range` = SPEC de Portée de tir : `number` (mètres fixes) OU `{bf}` (arme de jet : BF×bf m).
 *     UNIQUEMENT sur les armes à distance.
 */
const rows = trappings as { id: string; type: string; subType?: string; reach?: unknown; range?: unknown }[];

const isNumericLike = (v: unknown): boolean =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^\d+(\.\d+)?$/.test(v.trim()));
const isThrownFormula = (v: unknown): boolean => typeof v === 'string' && /^BF(x\d+)?$/.test(v.trim());
const isBfSpec = (v: unknown): v is { bf: number } => typeof v === 'object' && v != null && typeof (v as { bf?: unknown }).bf === 'number';

describe('trappings — invariant Allonge (reach) ⊥ Portée (range)', () => {
  it('AUCUN `reach` numérique ni formule de Portée « BFxN » (type menteur éliminé)', () => {
    expect(rows.filter((t) => isNumericLike(t.reach)).map((t) => t.id)).toEqual([]);
    expect(rows.filter((t) => isThrownFormula(t.reach)).map((t) => t.id)).toEqual([]);
  });

  it('`reach` est toujours string|null (jamais un nombre)', () => {
    expect(rows.filter((t) => t.reach != null && typeof t.reach !== 'string').map((t) => t.id)).toEqual([]);
  });

  it('`range` = number (mètres fixes) OU {bf} (jet), porté UNIQUEMENT par une arme à distance', () => {
    const withRange = rows.filter((t) => t.range != null);
    expect(withRange.length).toBeGreaterThan(0);
    expect(withRange.every((t) => typeof t.range === 'number' || isBfSpec(t.range))).toBe(true);
    expect(withRange.filter((t) => t.type !== 'ranged').map((t) => t.id)).toEqual([]);
  });

  it('toute arme de JET (`range:{bf}`) a un bf > 0 et un `reach` nul', () => {
    const thrown = rows.filter((t) => isBfSpec(t.range));
    expect(thrown.length).toBeGreaterThanOrEqual(9); // javelot, couteau-de-lancer, bolas, lasso, bombe…
    expect(thrown.every((t) => (t.range as { bf: number }).bf > 0 && t.reach == null)).toBe(true);
  });

  it('une arme de mêlée n\'a pas de Portée', () => {
    expect(rows.filter((t) => t.type === 'melee' && t.range != null).map((t) => t.id)).toEqual([]);
  });

  it('échantillon : Arc (50 m), Javelot (BF×3, reach nul), Hallebarde (Allonge « Longue », pas de Portée)', () => {
    const arc = rows.find((t) => t.id === 'arc')!;
    expect(arc.reach).toBeNull();
    expect(arc.range).toBe(50);
    const jav = rows.find((t) => t.id === 'javelot')!;
    expect(jav.reach).toBeNull();
    expect(jav.range).toEqual({ bf: 3 });
    const hall = rows.find((t) => t.id === 'hallebarde')!;
    expect(hall.reach).toBe('Longue');
    expect(hall.range ?? null).toBeNull();
  });

  it('naval intact : mitraille garde reach « Quart de l\'arme » (sémantique MDG préservée)', () => {
    expect(rows.find((t) => t.id === 'mitraille-et-poudre')!.reach).toBe("Quart de l'arme");
  });
});
