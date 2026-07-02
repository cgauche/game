import { describe, it, expect } from 'vitest';
import { BUILDINGS_META, styleRoofMaterial } from './buildings';

const MATERIALS = new Set(['tuile', 'chaume', 'ardoise']);
const EXPECTED_IDS = ['chapelle', 'echoppe', 'forge', 'maison', 'manoir', 'taverne', 'tour'];

describe('méta des bâtiments (registre defs/ réduit au TOIT)', () => {
  // Un bâtiment = des `WallSeg` (murs d'arête) sur un sol de terrain ; le `BuildingDef` n'est plus
  // qu'une méta (id/label/empreinte + matériau de toit). La nappe de toit est rendue par le pivot
  // (`builders/roofs` + `backends/affineRoofs`).
  it('expose les ids de bâtiments attendus', () => {
    expect(Object.keys(BUILDINGS_META).sort()).toEqual(EXPECTED_IDS);
  });

  it('chaque méta ne porte QUE {id, label, defaultFoot, roofMaterial} valides', () => {
    for (const [id, m] of Object.entries(BUILDINGS_META)) {
      expect(m.id, id).toBe(id);
      expect(typeof m.label, id).toBe('string');
      expect(m.defaultFoot, id).toMatchObject({ w: expect.any(Number), h: expect.any(Number) });
      expect(MATERIALS.has(m.roofMaterial), `${id}.roofMaterial=${m.roofMaterial}`).toBe(true);
      expect(m, id).not.toHaveProperty('paramsSchema');
      expect(m, id).not.toHaveProperty('render');
    }
  });

  it('styleRoofMaterial résout la méta et retombe sur "tuile" pour un style inconnu', () => {
    expect(styleRoofMaterial('echoppe')).toBe('chaume');
    expect(styleRoofMaterial('forge')).toBe('ardoise');
    expect(styleRoofMaterial('zzz')).toBe('tuile');
  });
});
