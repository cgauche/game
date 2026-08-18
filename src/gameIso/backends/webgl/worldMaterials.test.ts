/**
 * MATÉRIAU DE PLAN TRANSPARENT (`materiauPlanTransparent`) — la source unique du triplet
 * `transparent` + `DoubleSide` + `forceSinglePass`, et la fusion des paramètres du site : un appelant
 * qui perdrait son `alphaTest` découperait le sprite entier, un autre son `depthFunc` peindrait sa
 * silhouette d'occlusion par-dessus les corps visibles.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { materiauPlanTransparent } from './worldMaterials';

describe('materiauPlanTransparent', () => {
  it('pose le triplet UNE PASSE : transparent + DoubleSide + forceSinglePass', () => {
    const mat = materiauPlanTransparent();
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mat.transparent).toBe(true);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.forceSinglePass).toBe(true);
  });

  it('respecte les paramètres du site (map, alphaTest, depthFunc, opacité, fog, couleur)', () => {
    const map = new THREE.Texture();
    const mat = materiauPlanTransparent({
      map,
      alphaTest: 0.42,
      depthFunc: THREE.GreaterDepth,
      depthWrite: false,
      opacity: 0.65,
      fog: false,
      color: new THREE.Color('#c0392b'),
    });
    expect(mat.map).toBe(map);
    expect(mat.alphaTest).toBe(0.42);
    expect(mat.depthFunc).toBe(THREE.GreaterDepth);
    expect(mat.depthWrite).toBe(false);
    expect(mat.opacity).toBe(0.65);
    expect(mat.fog).toBe(false);
    expect(mat.color.getHexString()).toBe('c0392b');
  });

  it('le triplet n’est PAS surchargeable par le site', () => {
    const mat = materiauPlanTransparent({ transparent: false, side: THREE.FrontSide, forceSinglePass: false });
    expect(mat.transparent).toBe(true);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.forceSinglePass).toBe(true);
  });
});
