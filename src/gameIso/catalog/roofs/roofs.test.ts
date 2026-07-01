import { describe, it, expect } from 'vitest';
import { roofMaterial } from './index';
import { roofMaterials } from '../../../data';
import { roofFromCells } from '../buildings';
import type { Dims } from '../../iso';

describe('apparence de toit (JSON pur iso/plan)', () => {
  it('les 4 matériaux sont présents', () => {
    const ids = roofMaterials.map((m) => m.id).sort();
    expect(ids).toEqual(['ardoise', 'chaume', 'plan', 'tuile']);
  });

  it('résolution par id + teintes de couverture', () => {
    expect(roofMaterial('tuile').N).toBe('#a04836');
    expect(roofMaterial('chaume').N).toBe('#b0904a');
    expect(roofMaterial('ardoise').N).toBe('#63727f');
  });

  it('plan vu du dessus (vue carrée)', () => {
    expect(roofMaterial('plan').planBody).toBe('#6e4f3a');
    expect(roofMaterial('plan').planEdge).toBe('#241a12');
  });

  it('repli sur tuile pour un id inconnu', () => {
    expect(roofMaterial('inconnu').id).toBe('tuile');
  });

  it('couplage rendu : roofFromCells(material) peint les tuiles avec les teintes de la donnée', () => {
    const dims: Dims = { w: 6, h: 6 };
    const svg = roofFromCells(new Set(['1,1']), dims, 'tuile');
    expect(svg.length).toBeGreaterThan(0);
    // au moins une pente de tuile (teinte N/E/S/O de 'tuile') est présente dans le SVG
    const tones = ['#a04836', '#732a20', '#531b13', '#8a3527'];
    expect(tones.some((c) => svg.includes(c))).toBe(true);
  });
});
