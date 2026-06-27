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
const rows = trappings as { id: string; type: string; subType?: string; reach?: unknown; range?: unknown; ammoRangeMod?: unknown; enc?: unknown }[];

const ALLONGE = new Set(['Personnelle', 'Très courte', 'Courte', 'Moyenne', 'Longue', 'Très longue', 'Considérable', 'Variable']);
const isNumericLike = (v: unknown): boolean =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^\d+(\.\d+)?$/.test(v.trim()));
const isThrownFormula = (v: unknown): boolean => typeof v === 'string' && /^BF(x\d+)?$/.test(v.trim());
const isBfSpec = (v: unknown): v is { bf: number } => typeof v === 'object' && v != null && typeof (v as { bf?: unknown }).bf === 'number';
const isAmmoMod = (v: unknown): boolean => typeof v === 'object' && v != null &&
  ((typeof (v as { mult?: unknown }).mult === 'number') !== (typeof (v as { add?: unknown }).add === 'number'));

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

  it('`reach` = Allonge PURE : uniquement un libellé whitelisté, ou null (aucun modificateur de munition)', () => {
    const bad = rows.filter((t) => t.reach != null && !(typeof t.reach === 'string' && ALLONGE.has(t.reach)));
    expect(bad.map((t) => `${t.id}=${JSON.stringify(t.reach)}`)).toEqual([]);
  });

  it('modificateur de munition = `ammoRangeMod` STRUCTURÉ ({mult}|{add}), avec `reach:null`', () => {
    const withMod = rows.filter((t) => t.ammoRangeMod != null);
    expect(withMod.length).toBeGreaterThanOrEqual(12); // Moitié/Quart/+50/-10/+10…
    expect(withMod.every((t) => isAmmoMod(t.ammoRangeMod) && t.reach == null)).toBe(true);
    // échantillon : mitraille = ¼ ; baton-pointu = ½ ; flèche elfique = +50 m.
    expect(rows.find((t) => t.id === 'mitraille-et-poudre')!.ammoRangeMod).toEqual({ mult: 0.25 });
    expect(rows.find((t) => t.id === 'baton-pointu')!.ammoRangeMod).toEqual({ mult: 0.5 });
    expect(rows.find((t) => t.id === 'fleche-elfique')!.ammoRangeMod).toEqual({ add: 50 });
  });
});

describe('trappings — `enc` typé HONNÊTEMENT (number ou cas spéciaux non-encombrants)', () => {
  // La donnée porte des STRINGS non chiffrées sur des objets non-encombrants : « ND » (ateliers),
  // « Variable » (arme improvisée). Le type les déclare ; le calcul d'Encombrement les traite comme 0.
  const ENC_STRINGS = new Set(['ND', 'Variable']);
  it('`enc` est un nombre, null, ou une string autorisée (« ND »/« Variable ») — jamais une autre string', () => {
    const bad = rows.filter((t) => t.enc != null && typeof t.enc !== 'number' && !(typeof t.enc === 'string' && ENC_STRINGS.has(t.enc)));
    expect(bad.map((t) => `${t.id}=${JSON.stringify(t.enc)}`)).toEqual([]);
  });
});
