import { describe, expect, it } from 'vitest';
import { buildWorldGeometry, collectBillboards } from './sceneMeshes';
import { TINT_EXPLORED } from './visibilityTint';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { sceneMetresPerTile } from '../../../state/scene';
import { PROPS, propSvg } from '../../catalog/decor';

const scene = buildScene(siegeSpec);
const mpt = sceneMetresPerTile(scene);
const plein = () => 1;

/** Normale (unitaire) du triangle `i` de la géométrie fusionnée. */
function triNormal(pos: Float32Array | ArrayLike<number>, i: number) {
  const p = (k: number) => ({ x: pos[(i * 3 + k) * 3], y: pos[(i * 3 + k) * 3 + 1], z: pos[(i * 3 + k) * 3 + 2] });
  const [a, b, c] = [p(0), p(1), p(2)];
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / len, y: n.y / len, z: n.z / len, centre: { x: (a.x + b.x + c.x) / 3, z: (a.z + b.z + c.z) / 3 } };
}

describe('FUSION — toute la scène en UNE géométrie', () => {
  it('une seule BufferGeometry non indexée porte position + couleur de tous les triangles', () => {
    const g = buildWorldGeometry(scene, mpt, plein);
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color');
    expect(g.index).toBeNull(); // non indexée : `computeVertexNormals` donne la normale de FACE
    expect(pos.count).toBeGreaterThan(3000);
    expect(pos.count % 3).toBe(0);
    expect(col.count).toBe(pos.count);
    expect(g.getAttribute('normal').count).toBe(pos.count);
  });

  it('la teinte de visibilité MULTIPLIE la couleur de face (case explorée = plus sombre)', () => {
    const clair = buildWorldGeometry(scene, mpt, plein).getAttribute('color').array as Float32Array;
    const sombre = buildWorldGeometry(scene, mpt, () => TINT_EXPLORED).getAttribute('color').array as Float32Array;
    expect(sombre.length).toBe(clair.length);
    const somme = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
    expect(somme(sombre)).toBeCloseTo(somme(clair) * TINT_EXPLORED, 1);
  });
});

describe('ORIENTATION — les triangles regardent DEHORS (la carte d’ombre en dépend)', () => {
  it('aucune face horizontale ne regarde vers le bas, aucune face verticale vers l’intérieur', () => {
    const g = buildWorldGeometry(scene, mpt, plein);
    const pos = g.getAttribute('position').array as Float32Array;
    const cx = ((scene.dimensions.w - 1) / 2) * mpt;
    const cz = ((scene.dimensions.h - 1) / 2) * mpt;
    let versLeBas = 0;
    let versLInterieur = 0;
    let horizontales = 0;
    let verticales = 0;
    for (let i = 0; i < pos.length / 9; i++) {
      const n = triNormal(pos, i);
      if (Math.abs(n.y) > 1e-6) {
        horizontales++;
        if (n.y < 0) versLeBas++;
      } else {
        verticales++;
        if (n.x * (n.centre.x - cx) + n.z * (n.centre.z - cz) < 0) versLInterieur++;
      }
    }
    expect(horizontales).toBeGreaterThan(100);
    expect(verticales).toBeGreaterThan(10);
    expect({ versLeBas, versLInterieur }).toEqual({ versLeBas: 0, versLInterieur: 0 });
  });
});

describe('BILLBOARDS — sujets de la scène', () => {
  it('les personnages et le décor sont collectés, ancrés aux pieds, avec leur SVG par vue', () => {
    const subs = collectBillboards(scene, mpt, plein);
    const persos = subs.filter((s) => s.kind === 'personnage');
    expect(persos.length).toBeGreaterThan(0);
    expect(subs.some((s) => s.kind === 'prop')).toBe(true);
    const svg = persos[0].svg('front', false, 0);
    expect(svg).toContain('<defs>'); // le blob de rasterisation est un document ISOLÉ : défs incluses
    expect(svg).toContain('data-bone');
    expect(persos[0].svg('profile', false, 0)).not.toBe(svg); // la VUE demandée change le dessin
    expect(persos[0].box).toEqual({ w: 120, h: 150 });
  });

  it('le SVG d\'un PERSONNAGE ignore le cran de caméra, celui d\'un DÉCOR directionnel en dépend — c\'est ce qui règle la clé de cache', () => {
    const perso = collectBillboards(scene, mpt, plein).find((s) => s.kind === 'personnage')!;
    for (const camRot of [1, 2, 3] as const)
      expect(perso.svg('front', false, camRot)).toBe(perso.svg('front', false, 0));
    // Le décor délègue à `propSvg(ref, dir, camRot)` : un prop DIRECTIONNEL (`views`) pivote avec la
    // caméra, donc son cran reste dans la clé de cache. Lu sur le REGISTRE (les scènes du spike
    // n'en posent aucun aujourd'hui — une carte en posera un demain sans toucher au cache).
    const directionnels = Object.values(PROPS).filter((p) => p.views);
    expect(directionnels.length).toBeGreaterThan(0);
    expect(directionnels.every((p) => propSvg(p.id, 'S', 1) !== propSvg(p.id, 'S', 0))).toBe(true);
  });
});
