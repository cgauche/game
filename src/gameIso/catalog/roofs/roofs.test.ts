import { describe, it, expect } from 'vitest';
import { roofMaterial } from './index';
import { roofMaterials } from '../../../data';

// Le couplage donnée → rendu (teintes par pan, liseré, rangs) est testé côté backend
// (`backends/affineRoofs.test.ts`) ; ici, la DONNÉE seule.
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

  it('les matériaux de couverture portent liseré + recette de rangs (consommés par builder + backend)', () => {
    for (const id of ['tuile', 'chaume', 'ardoise']) {
      const m = roofMaterial(id);
      expect(m.line, id).toBeTruthy();
      expect(m.detail?.courses?.hM ?? 0, id).toBeGreaterThan(0); // pas métrique des rangs (source unique)
      expect(m.detail?.courses?.joint, id).toBeTruthy(); // couleur des rangs
    }
    // Bardeaux (blocs décalés nuancés) sur les couvertures rigides ; rangs ORGANIQUES sur le chaume.
    expect(roofMaterial('tuile').detail?.courses?.blockWM).toBeDefined();
    expect(roofMaterial('ardoise').detail?.courses?.blockWM).toBeDefined();
    expect(roofMaterial('chaume').detail?.courses?.blockWM).toBeUndefined();
    expect(roofMaterial('chaume').detail?.courses?.edgeWobble ?? 0).toBeGreaterThan(0);
    expect(roofMaterial('chaume').detail?.tufts).toBeDefined(); // balayage de paille
  });

  it('plan vu du dessus (vue carrée)', () => {
    expect(roofMaterial('plan').planBody).toBe('#6e4f3a');
    expect(roofMaterial('plan').planEdge).toBe('#241a12');
  });

  it('repli sur tuile pour un id inconnu', () => {
    expect(roofMaterial('inconnu').id).toBe('tuile');
  });
});
