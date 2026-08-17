import { describe, expect, it } from 'vitest';
import { SPARK_BRANCHES, SPARK_INNER_R_PX, SPARK_R_PX } from '../../builders/interactHalos';
import { unitStarGeometry } from './interactHaloMeshes';

/**
 * GLYPHE de l'étincelle (#1176, P3-0g) — `unitStarGeometry` est la SEULE définition de l'étoile qui
 * signale un décor fouillable : c'est cet éventail de triangles que la pose met à l'échelle et
 * aligne sur la caméra. Ce que ce banc tient, c'est la FORME rendue : le compte de branches, les
 * deux rayons qui alternent, la platitude dans le plan XZ et la fermeture du tour.
 */

/** Les sommets du POURTOUR dans l'ordre du tracé : chaque triangle est `centre, sommet(i), sommet(i+1)`. */
function pourtour(geo: ReturnType<typeof unitStarGeometry>): { x: number; y: number; z: number }[] {
  const pos = geo.getAttribute('position');
  const out: { x: number; y: number; z: number }[] = [];
  for (let t = 0; t * 3 + 1 < pos.count; t++) {
    const i = t * 3 + 1;
    out.push({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) });
  }
  return out;
}

const rayon = (p: { x: number; z: number }) => Math.hypot(p.x, p.z);

/** Les sommets vivent dans un tampon FLOAT32 (`Float32BufferAttribute`) : ~7 chiffres significatifs. */
const PREC = 6;

describe('Gabarit de l’ÉTINCELLE — la forme du glyphe rendu (#1176 P3-0g)', () => {
  it('un ÉVENTAIL de 2n triangles, tous piqués au centre', () => {
    const pos = unitStarGeometry().getAttribute('position');
    expect(pos.count, 'trois sommets par triangle, deux triangles par branche').toBe(2 * SPARK_BRANCHES * 3);
    for (let t = 0; t * 3 < pos.count; t++) {
      const i = t * 3;
      expect([pos.getX(i), pos.getY(i), pos.getZ(i)], `le triangle ${t} part du centre`).toEqual([0, 0, 0]);
    }
  });

  it('POINTES et CREUX alternent, dans le rapport des rayons du builder, pour un DIAMÈTRE 1', () => {
    const bord = pourtour(unitStarGeometry());
    expect(bord).toHaveLength(2 * SPARK_BRANCHES);
    const creux = 0.5 * (SPARK_INNER_R_PX / SPARK_R_PX);
    for (let i = 0; i < bord.length; i++)
      expect(rayon(bord[i]), i % 2 === 0 ? `pointe ${i}` : `creux ${i}`).toBeCloseTo(i % 2 === 0 ? 0.5 : creux, PREC);
    // diamètre 1 de pointe à pointe : les branches vont par paires opposées
    const opposée = bord[SPARK_BRANCHES];
    expect(Math.hypot(bord[0].x - opposée.x, bord[0].z - opposée.z)).toBeCloseTo(1, PREC);
  });

  it('le glyphe est PLAT dans le plan XZ — la pose seule le redresse', () => {
    for (const p of pourtour(unitStarGeometry())) expect(p.y).toBe(0);
  });

  it('le tour se FERME : le dernier triangle rejoint le premier sommet', () => {
    const pos = unitStarGeometry().getAttribute('position');
    const dernier = pos.count - 1; // 3e sommet du dernier triangle
    expect(pos.getX(dernier)).toBeCloseTo(pos.getX(1), PREC);
    expect(pos.getZ(dernier)).toBeCloseTo(pos.getZ(1), PREC);
    expect(rayon({ x: pos.getX(dernier), z: pos.getZ(dernier) }), 'et il ferme sur une POINTE').toBeCloseTo(0.5, PREC);
  });

  it('le nombre de branches et la profondeur des creux sont PARAMÉTRABLES', () => {
    const bord = pourtour(unitStarGeometry(6, 0.4));
    expect(bord).toHaveLength(12);
    for (let i = 0; i < bord.length; i++) expect(rayon(bord[i])).toBeCloseTo(i % 2 === 0 ? 0.5 : 0.2, PREC);
  });
});

/**
 * PIN D'IDENTITÉ du glyphe — les attentes ci-dessus se DÉRIVENT des mêmes constantes que le code :
 * muter `SPARK_BRANCHES` ou `SPARK_INNER_R_PX` les déplace en bloc et les laisse toutes vertes. Ce
 * bloc-ci mesure le glyphe de l'EXTÉRIEUR, avec des chiffres écrits en dur : le compte de branches,
 * le rapport creux/pointe, et les deux rayons du gabarit unité. Une retouche de forme doit rougir
 * ICI — puis se ré-arbitrer, pas se réaligner en silence.
 *
 * PROVENANCE des chiffres : `SPARK_R_PX = 6` et `SPARK_INNER_R_PX = 1,7·√2 = 2,4041630560342617`
 * (l'étoile historique à quatre branches, creux sur la demi-diagonale du carré 1,7) → un rapport
 * creux/pointe de 0,40069384267237695, soit un creux à 0,20034692133618847 sur un gabarit de
 * DIAMÈTRE 1.
 */
describe('ÉTINCELLE — PIN de l’identité du glyphe, en valeurs ABSOLUES', () => {
  it('QUATRE branches, rayons 6 px et 1,7·√2 px', () => {
    expect(SPARK_BRANCHES).toBe(4);
    expect(SPARK_R_PX).toBe(6);
    expect(SPARK_INNER_R_PX).toBeCloseTo(2.4041630560342617, 12);
  });

  it('le rapport creux/pointe vaut 0,4007', () => {
    expect(SPARK_INNER_R_PX / SPARK_R_PX).toBeCloseTo(0.40069384267237695, 12);
  });

  it('le gabarit unité pointe à 0,5 EXACTEMENT et creuse à 0,20034692', () => {
    const bord = pourtour(unitStarGeometry());
    expect(bord).toHaveLength(8);
    expect(bord[0].x, 'la première pointe est sur l’axe +X, au rayon 0,5').toBe(0.5);
    expect(bord[0].z).toBe(0);
    expect(rayon(bord[1]), 'le premier creux').toBeCloseTo(0.20034692133618847, PREC);
    expect(rayon(bord[2]), 'la pointe suivante').toBeCloseTo(0.5, PREC);
  });
});
