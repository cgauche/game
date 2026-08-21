/**
 * MATÉRIAU DE PLAN TRANSPARENT (`materiauPlanTransparent`) — la source unique du triplet
 * `transparent` + `DoubleSide` + `forceSinglePass`, et la fusion des paramètres du site : un appelant
 * qui perdrait son `alphaTest` découperait le sprite entier, un autre son `depthFunc` peindrait sa
 * silhouette d'occlusion par-dessus les corps visibles.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { materiauPlanTransparent, worldSurfaceMaterials } from './worldMaterials';
import type { SurfaceGroup, WorldGeometry } from './sceneMeshes';

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

/**
 * RÉGIME PAR GROUPE DE SURFACE — le monde monte un matériau par groupe, et c'est le GROUPE qui décide
 * lequel : un groupe de décor volumique authore sa rugosité et son métal (`propMaterials.json`), que le
 * lambertien commun n'a pas à offrir. Sans cette sonde, `pbr` pouvait se perdre entre la cuisson et
 * l'écran sans qu'aucun test ne bouge.
 */
describe('worldSurfaceMaterials — un groupe qui authore sa lumière monte en matériau PBR', () => {
  const geoDe = (groups: SurfaceGroup[]): WorldGeometry => {
    const g = new THREE.BufferGeometry() as WorldGeometry;
    g.userData = { surfaceGroups: groups, propVertexRanges: [] };
    return g;
  };
  const NU: SurfaceGroup = { key: 'nu', kind: null };
  const PROP: SurfaceGroup = { key: 'prop|fer-noirci', kind: null, color: '#2e2f33', pbr: { roughness: 0.52, metalness: 0.85 } };

  it('groupe SANS `pbr` : lambertien — le régime du jeu, inchangé', () => {
    const [mat] = worldSurfaceMaterials(geoDe([NU]), 1).materials;
    expect(mat).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('groupe AVEC `pbr` : matériau standard, aux valeurs AUTHORÉES', () => {
    const [mat] = worldSurfaceMaterials(geoDe([PROP]), 1).materials;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((mat as THREE.MeshStandardMaterial).roughness).toBe(0.52);
    expect((mat as THREE.MeshStandardMaterial).metalness).toBe(0.85);
    expect(mat.vertexColors).toBe(true); // la couleur reste CUITE au sommet, comme partout ailleurs
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('les deux régimes cohabitent dans LE même maillage, un matériau par groupe', () => {
    const { materials } = worldSurfaceMaterials(geoDe([NU, PROP]), 1);
    expect(materials.map((m) => m.type)).toEqual(['MeshLambertMaterial', 'MeshStandardMaterial']);
  });

  it('régime PLAT (`lit: false`, planches QC) : le `pbr` ne rallume aucune lumière', () => {
    const [mat] = worldSurfaceMaterials(geoDe([PROP]), 1, { lit: false }).materials;
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
  });
});
