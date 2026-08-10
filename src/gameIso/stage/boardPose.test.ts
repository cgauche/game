import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, PointLight, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CONTACT_SHADOW_LIFT_M, contactShadow, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { poseBoards, type Board, type FrameLights } from './boardPose';
import { billboardExposure, FLAME_INTENSITY, FLAME_LIFT_M, type PointLightSlots } from './stagePointLights';

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
    poseBoards([b], CAMERA, () => GLISSEMENT, flaques([]));
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
    poseBoards([b], CAMERA, () => null, flaques([]));
    expect(b.shadow!.position.x).toBeCloseTo(ancre.x, 6);
    expect(b.shadow!.position.z).toBeCloseTo(ancre.z, 6);
    expect(b.mesh.position.x).toBeCloseTo(ancre.x, 6);
  });

  it('le glissement n’est demandé QUE pour un sujet porteur d’id (décor : aucune question posée)', () => {
    const demandés: string[] = [];
    const decor = board(undefined, new Vector3(1, 0, 1), false);
    const acteur = board('h1', new Vector3(2, 0, 2), false);
    poseBoards([decor, acteur], CAMERA, (cid) => { demandés.push(cid); return null; }, flaques([]));
    expect(demandés).toEqual(['h1']);
  });
});

/**
 * LA LANTERNE GLISSE AVEC SON PORTEUR (#1245, L2) — une lampe PORTÉE appartient à son sujet au même
 * titre que son ombre de contact : elle suit la MÊME courbe de glissement, celle que la passe lit déjà,
 * jamais une seconde. Et l'EXPOSITION du quad (#1245, L3) se recalcule à la pose : c'est ainsi qu'un
 * personnage ENTRE dans la flaque en marchant, à la cadence de la frame.
 */
const PORTEE_M = 8; // brasero : 4 cases × 2 m
const EXTINCTION = 0.6; // ce qu'il reste à allumer sous le palier d'ambiance de la frame
const INTENSITE = FLAME_INTENSITY * Math.PI * EXTINCTION;
const LUM = 0.4; // exposition globale de la frame

/** Une lampe du pool telle que la décision l'a écrite (`stagePointLights`), portée ou posée. */
const lampe = (srcId: string, x: number, z: number) => ({ srcId, x, y: FLAME_LIFT_M, z, intensity: INTENSITE, distance: PORTEE_M });

/** Le POOL monté sur cette table — les lampes que la passe de pose déplace, index par index. */
function flaques(slots: PointLightSlots): FrameLights & { pool: PointLight[] } {
  const pool = slots.map((w) => {
    const l = new PointLight(0xffffff, 0, 0, 0);
    if (w) { l.position.set(w.x, w.y, w.z); l.intensity = w.intensity; l.distance = w.distance; }
    return l;
  });
  return { pool, slots, surfaceLuminance: LUM };
}

const delta = (a: Vector3, b: Vector3) => [a.x - b.x, a.y - b.y, a.z - b.z].map((v) => +v.toFixed(9));

describe('poseBoards — la lampe PORTÉE suit son porteur (#1245 L2)', () => {
  it('un sujet qui GLISSE décale son quad ET sa lampe du MÊME vecteur ; la lampe POSÉE ne bouge pas', () => {
    const b = board('h1', new Vector3(10, 0, 10), false);
    const f = flaques([lampe('h1', 10, 10), lampe('b0', 30, 30)]);
    poseBoards([b], CAMERA, () => null, f);
    const quadRepos = b.mesh.position.clone();
    const lampeRepos = f.pool[0].position.clone();
    const poséeRepos = f.pool[1].position.clone();

    poseBoards([b], CAMERA, () => GLISSEMENT, f);
    const attendu = [GLISSEMENT.dx, GLISSEMENT.dy, GLISSEMENT.dz];
    expect(delta(f.pool[0].position, lampeRepos)).toEqual(attendu);
    expect(delta(b.mesh.position, quadRepos)).toEqual(attendu); // la MÊME courbe, pas une seconde
    expect(delta(f.pool[1].position, poséeRepos)).toEqual([0, 0, 0]); // le brasero du décor reste chez lui
  });

  it('le pas ACHEVÉ, la lampe revient d’elle-même sur sa case logique (aucune passe de rattrapage)', () => {
    const b = board('h1', new Vector3(10, 0, 10), false);
    const f = flaques([lampe('h1', 10, 10)]);
    poseBoards([b], CAMERA, () => GLISSEMENT, f);
    poseBoards([b], CAMERA, () => null, f);
    expect([f.pool[0].position.x, f.pool[0].position.y, f.pool[0].position.z]).toEqual([10, FLAME_LIFT_M, 10]);
  });

  it('pendant TOUT le glissement, la lampe garde SON slot et son intensité — elle ne saute pas de sujet', () => {
    const b = board('h1', new Vector3(10, 0, 10), false);
    const autre = board('h2', new Vector3(20, 0, 20), false);
    const f = flaques([lampe('h2', 20, 20), lampe('h1', 10, 10)]);
    const suivies: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const g = { dx: i * 0.4, dy: 0, dz: i * 0.2 };
      poseBoards([b, autre], CAMERA, (cid) => (cid === 'h1' ? g : null), f);
      // Le slot 1 est celui de « h1 » depuis la première frame : c'est LUI qui glisse, jamais le slot 0.
      expect([f.pool[1].position.x, f.pool[1].position.z]).toEqual([10 + g.dx, 10 + g.dz]);
      expect([f.pool[0].position.x, f.pool[0].position.z]).toEqual([20, 20]);
      suivies.push(f.pool[1].intensity, f.pool[0].intensity);
    }
    expect(new Set(suivies)).toEqual(new Set([INTENSITE])); // aucune intensité réécrite par la pose
  });
});

describe('poseBoards — le personnage ENTRE dans la flaque (#1245 L3)', () => {
  it('le quad au pied de la lampe est PLUS CLAIR que le même quad à six cases', () => {
    const f = flaques([lampe('b0', 0, 0)]);
    const auFoyer = board('h1', new Vector3(0, 0, 0), false);
    const auLoin = board('h2', new Vector3(12, 0, 0), false); // 6 cases × 2 m
    poseBoards([auFoyer, auLoin], CAMERA, () => null, f);
    expect(auFoyer.material.color.r).toBeGreaterThan(auLoin.material.color.r);
    // …et c'est bien l'exposition PAR SUJET qui est posée, teinte de visibilité comprise.
    expect(auFoyer.material.color.r).toBeCloseTo(billboardExposure({ x: 0, y: 0, z: 0 }, f.pool, LUM), 12);
    expect(auLoin.material.color.r).toBe(LUM); // hors de la flaque : l'exposition de la frame, à l'octet
  });

  it('l’exposition d’un TÉMOIN ne dépend PAS de sa place dans le tableau (toutes les lampes glissent d’abord)', () => {
    // Le décor est posé AVANT les acteurs (`GameStage3D` : `[...decor, ...acteurs]`) : en une seule
    // passe, il échantillonnerait des lanternes encore à leur case de départ.
    const témoinAncre = new Vector3(13, 0, 10);
    const expo = (témoinDAbord: boolean) => {
      const f = flaques([lampe('h1', 10, 10)]);
      const porteur = board('h1', new Vector3(10, 0, 10), false);
      const témoin = board(undefined, témoinAncre, false);
      poseBoards(témoinDAbord ? [témoin, porteur] : [porteur, témoin], CAMERA, () => GLISSEMENT, f);
      return témoin.material.color.r;
    };
    expect(expo(true)).toBeCloseTo(expo(false), 12);
    // …et l'égalité n'est pas triviale : le témoin voit bien la lampe GLISSÉE, pas celle au repos.
    const f = flaques([lampe('h1', 10, 10)]);
    const auRepos = board(undefined, témoinAncre, false);
    poseBoards([auRepos], CAMERA, () => null, f);
    expect(Math.abs(expo(true) - auRepos.material.color.r)).toBeGreaterThan(0.001);
  });

  it('en MARCHANT vers la lampe, le quad s’éclaircit frame après frame', () => {
    const f = flaques([lampe('b0', 0, 0)]);
    const b = board('h1', new Vector3(12, 0, 0), false);
    const clartés: number[] = [];
    for (let i = 0; i <= 6; i++) {
      poseBoards([b], CAMERA, () => ({ dx: -2 * i, dy: 0, dz: 0 }), f);
      clartés.push(b.material.color.r);
    }
    expect(clartés).toEqual([...clartés].sort((a, c) => a - c));
    expect(clartés[6]).toBeGreaterThan(clartés[0]);
  });
});
