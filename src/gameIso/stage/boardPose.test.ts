import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CONTACT_SHADOW_LIFT_M, contactShadow, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { poseBoards, type Board } from './boardPose';

/**
 * LA PASSE DE POSE DE LA MARCHE VOLUMIQUE (#1176, P2-4). Un sujet qui glisse ne voit PAS son quad
 * reconstruit : sa matrice se décale, et TOUT ce qui lui appartient se décale avec — son ombre de
 * contact comprise. L'ombre est le cas qui se rate en silence : montée dans le même groupe que le quad
 * mais absente de la boucle, elle reste plaquée sur la case d'arrivée pendant que le corps la quitte.
 */
const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);

function sujet(cid: string | undefined, anchor: Vector3): BillboardSubject {
  return {
    identity: `sonde:${cid ?? 'decor'}`,
    cid,
    kind: 'personnage',
    anchor,
    facing: 'S',
    scaleK: 1,
    tint: 1,
    box: { w: 120, h: 150 },
    svg: () => '',
  };
}

function board(cid: string | undefined, anchor: Vector3, avecOmbre: boolean): Board {
  const sub = sujet(cid, anchor);
  const material = new MeshBasicMaterial();
  const b: Board = {
    sub,
    quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
    mesh: new Mesh(new PlaneGeometry(2, 3), material),
    material,
  };
  if (avecOmbre) b.shadow = contactShadow(anchor, b.quad.widthM);
  return b;
}

const GLISSEMENT = { dx: 4, dy: 0.5, dz: -3 };

describe('poseBoards — l’ombre de contact voyage avec son sujet (#1176 P2-4)', () => {
  it('un sujet qui GLISSE emmène son quad ET son disque : mêmes x/z, à l’aplomb', () => {
    const ancre = new Vector3(10, 0, 10);
    const b = board('h1', ancre, true);
    poseBoards([b], CAMERA, () => GLISSEMENT);
    expect(b.shadow!.position.x).toBeCloseTo(ancre.x + GLISSEMENT.dx, 6);
    expect(b.shadow!.position.z).toBeCloseTo(ancre.z + GLISSEMENT.dz, 6);
    expect(b.shadow!.position.y).toBeCloseTo(ancre.y + GLISSEMENT.dy + CONTACT_SHADOW_LIFT_M, 6);
    // L'aplomb EST la relation mesurée : le disque suit le quad, pas une seconde intention.
    expect(b.shadow!.position.x).toBeCloseTo(b.mesh.position.x, 6);
    expect(b.shadow!.position.z).toBeCloseTo(b.mesh.position.z, 6);
  });

  it('un sujet IMMOBILE ne bouge pas d’un pouce : le disque reste sur son ancre cuite', () => {
    const ancre = new Vector3(10, 0, 10);
    const b = board('h1', ancre, true);
    poseBoards([b], CAMERA, () => null);
    expect(b.shadow!.position.x).toBeCloseTo(ancre.x, 6);
    expect(b.shadow!.position.z).toBeCloseTo(ancre.z, 6);
    expect(b.mesh.position.x).toBeCloseTo(ancre.x, 6);
  });

  it('le glissement n’est demandé QUE pour un sujet porteur d’id (décor : aucune question posée)', () => {
    const demandés: string[] = [];
    const decor = board(undefined, new Vector3(1, 0, 1), false);
    const acteur = board('h1', new Vector3(2, 0, 2), false);
    poseBoards([decor, acteur], CAMERA, (cid) => { demandés.push(cid); return null; });
    expect(demandés).toEqual(['h1']);
  });
});
