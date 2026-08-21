import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Raycaster, Vector2, type Intersection } from 'three';
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../../../state/scene';
import { findPropById } from '../../../data';
import { buildWorldGeometry, wholeSceneBillboardEls, worldBakeDeps, type WorldGeometry } from './sceneMeshes';
import { pickNearestTarget, propEntityAtHit, type PickTarget, type PropVertexRange, type WorldPickMesh } from './spriteRaycast';

/**
 * PICKING PAR `entId` — un décor volumique est cuit dans la MASSE du monde : il n'a ni maillage propre
 * ni quad. Ce qui le rend cliquable, ce sont les plages de sommets ORIGINAUX relevées à la cuisson,
 * qu'un cutaway (qui réécrit l'index de dessin, jamais les sommets) ne peut pas périmer.
 *
 * L'invariant #1297 est l'autre moitié du contrat : la géométrie NON-prop du monde (mur, sol, toit)
 * n'entre jamais dans les candidats, donc un acteur derrière un mur reste cliquable.
 */
const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
CAMERA.updateMatrixWorld(true);
const NDC = { x: 0, y: 0 };

const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });
const volumeEntity = (id: string): SceneEntity =>
  ({ id, kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S' }) as SceneEntity;
const legacyEntity = (id: string): SceneEntity =>
  ({ id, kind: 'prop', pos: { x: 5, y: 5 }, ref: 'tonneau' }) as SceneEntity;
const patchEntity = (scene: Scene, id: string, patch: Partial<SceneEntity>): Scene =>
  ({ ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, ...patch } as SceneEntity : e)) });

/** Les triangles CUITS d'un décor, tels que le rayon les rendrait : trois index de sommets ORIGINAUX. */
function* bakedPropFaces(world: WorldGeometry, entId: string): Generator<{ a: number; b: number; c: number }> {
  for (const r of world.userData.propVertexRanges) {
    if (r.entId !== entId) continue;
    for (let v = r.vertexStart; v < r.vertexStart + r.vertexCount; v += 3) yield { a: v, b: v + 1, c: v + 2 };
  }
}

describe('Cuisson d’un décor volumique — une seule voie, et son id de picking', () => {
  it('cuit un prop volumique une fois, sans sujet billboard, et conserve son id de picking', () => {
    const scene = sceneWith(volumeEntity('table-1'), legacyEntity('tonneau-1'));
    const els = wholeSceneBillboardEls(scene);
    expect(els.props.map((p) => p.entId)).toEqual(['tonneau-1']);
    const world = buildWorldGeometry(scene, 2, () => 1);
    expect(world.userData.propVertexRanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ entId: 'table-1', vertexStart: expect.any(Number), vertexCount: expect.any(Number) }),
    ]));
    // Deux matériaux de recette ⇒ deux groupes de surface ⇒ deux plages DISJOINTES sous le même id.
    expect(world.userData.propVertexRanges.filter((r) => r.entId === 'table-1').length).toBeGreaterThan(1);
    let triangles = 0;
    for (const face of bakedPropFaces(world, 'table-1')) {
      expect(propEntityAtHit(world.userData.propVertexRanges, face)).toBe('table-1');
      triangles++;
    }
    expect(triangles).toBeGreaterThan(0);
    expect(worldBakeDeps(scene, 2)).toEqual(expect.arrayContaining([findPropById('table-ronde-4-tabourets')!.volume]));
  });

  it('worldBakeDeps invalide la cuisson pour add/remove/pos/ref/facing d’un prop', () => {
    const base = sceneWith(volumeEntity('table-1'));
    for (const changed of [
      { ...base, entities: [] },
      { ...base, entities: [...base.entities, volumeEntity('table-2')] },
      patchEntity(base, 'table-1', { pos: { x: 3, y: 4 } }),
      patchEntity(base, 'table-1', { ref: 'comptoir-droit' }),
      patchEntity(base, 'table-1', { facing: 'E' }),
    ]) expect(worldBakeDeps(changed, 2)).not.toEqual(worldBakeDeps(base, 2));
  });
});

// ————————————————————————————————————————————————————————————————
// Maillages SYNTHÉTIQUES : la seule façon de poser à la main un index déjà compacté par un cutaway,
// et des profondeurs exactes autour d'un décor.
// ————————————————————————————————————————————————————————————————

/** Deux triangles de 2×2 m centrés sur l'axe de la caméra, à `z` — six sommets, dans cet ordre. */
function quadVertices(z: number): number[] {
  const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x, y, z]);
  return [...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]].flat();
}

/** Maillage monde à N quads empilés en profondeur, index d'IDENTITÉ moins les quads `retirés`. */
function mondeCuit(quads: readonly number[], retirés: readonly number[], ranges: PropVertexRange[]): WorldPickMesh & Mesh {
  const positions = quads.flatMap((z) => quadVertices(z));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const index: number[] = [];
  quads.forEach((_, q) => {
    if (retirés.includes(q)) return; // le cutaway a COMPACTÉ l'index : ces sommets ne sont plus dessinés
    for (let k = 0; k < 6; k++) index.push(q * 6 + k);
  });
  geo.setIndex(new BufferAttribute(new Uint32Array(index), 1));
  const mesh = new Mesh(geo, new MeshBasicMaterial()) as WorldPickMesh & Mesh;
  mesh.userData = { propVertexRanges: ranges };
  mesh.updateMatrixWorld(true);
  return mesh;
}

/** Quad de billboard d'un combattant, à `z`. */
function combatantBillboard(cid: string, z = -5): PickTarget {
  const m = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  return { cid, object: m };
}

/** Première intersection du rayon central avec le maillage monde. */
function raycastProp(mesh: Mesh): Intersection {
  const r = new Raycaster();
  r.setFromCamera(new Vector2(NDC.x, NDC.y), CAMERA);
  const [hit] = r.intersectObject(mesh, true);
  return hit;
}

describe('pickNearestTarget — le décor volumique se clique par ses sommets', () => {
  it('un cutaway placé avant le prop conserve le picking par sommets originaux', () => {
    // Quad 0 = masse DÉGAGÉE devant (index compacté, plus dessinée) ; quad 1 = le décor, derrière.
    const propRange: PropVertexRange = { entId: 'table-1', vertexStart: 6, vertexCount: 6 };
    const mesh = mondeCuit([-3, -5], [0], [propRange]);
    const hit = raycastProp(mesh);
    expect(hit.face && [hit.face.a, hit.face.b, hit.face.c].every((i) => i >= propRange.vertexStart && i < propRange.vertexStart + propRange.vertexCount)).toBe(true);
    expect(pickNearestTarget(CAMERA, [], mesh, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
  });

  it('arbitre combattants et faces de prop par distance globale', () => {
    const monde = mondeCuit([-5], [], [{ entId: 'table-1', vertexStart: 0, vertexCount: 6 }]);
    expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1', -7)], monde, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
    expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1', -3)], monde, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
  });

  it('ignore une face monde non-prop et conserve le clic acteur derrière le mur', () => {
    // Quad 0 = MUR devant (aucune plage) ; quad 1 = un décor loin derrière — le monde EST donc balayé.
    const wallFirst = mondeCuit([-2, -8], [], [{ entId: 'table-1', vertexStart: 6, vertexCount: 6 }]);
    const wallHit = raycastProp(wallFirst);
    expect(propEntityAtHit(wallFirst.userData.propVertexRanges!, wallHit.face!)).toBeNull();
    expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1')], wallFirst, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
  });
});
