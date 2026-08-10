import { Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type OrthographicCamera, type PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { depth, projectOccluder, occludesActor, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { makeShowcaseParty } from '../../data/pregens';
import type { Combatant } from '../../engine/types';
import { buildWalls } from '../builders/walls';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { BILLBOARD_BOX_ASPECT, anchorAndSize, billboardHeightM } from '../backends/webgl/billboardMath';
import { actorBillboards, bakeWorldGeometry, billboardPose, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { ndcAt, pickNearestCid, type PickTarget } from '../backends/webgl/spriteRaycast';
import { actorCapsuleOf } from './CulledScene';
import { wallLayerObjs } from './layers';
import { stage3dFraming } from './stage3dCamera';

/**
 * HIT-TEST DE SPRITE — CE QUE CHAQUE VOIE RÉPOND (#1176, lot P2-3).
 *
 * Les deux voies tranchent l'empilement AUTREMENT : la voie affine par son TRI DE PROFONDEUR (le
 * dernier peint reçoit l'`elementFromPoint` ; s'il ne porte pas de `data-cid`, il n'y a pas de jeton
 * sous le pixel), la voie volumique par la DISTANCE CAMÉRA d'un lancer de rayon. Cette garde épingle
 * les DEUX verdicts sur les mêmes situations — jamais l'intuition de l'un pour l'autre.
 *
 * Les deux mesures sont prises des fonctions de PRODUCTION : côté affine `occludesActor` sur les
 * panneaux projetés (l'occultation écran-espace dont le stage se sert déjà) et les profondeurs `d`
 * qu'émettent les couches ; côté volumique le bake du monde (`bakeWorldGeometry`) et des quads posés
 * exactement comme `GameStage3D` les pose.
 */
const CANVAS = { w: 1280, h: 720 };
const CAM = { x: 0, y: 0 };
const ZOOM = 1;
const NO_OCCLUDE = () => false;

type Camera = OrthographicCamera | PerspectiveCamera;

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

function cameraVolumique(dims: Dims, mpt: number): Camera {
  const f = stage3dFraming({ dims, mpt, cam: CAM, zoom: ZOOM, canvas: CANVAS });
  return affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
    target: new Vector3(f.centre.x, f.centre.y, f.centre.z),
  }).camera;
}

/** Le quad d'un acteur, posé comme `GameStage3D` le pose : aligné écran, ancré aux pieds. */
function quadDe(sub: BillboardSubject, camera: Camera): Mesh {
  const heightM = billboardHeightM('jeu', sub.kind) * sub.scaleK;
  const quad = anchorAndSize(heightM, BILLBOARD_BOX_ASPECT);
  const mesh = new Mesh(new PlaneGeometry(quad.widthM, quad.heightM), new MeshBasicMaterial());
  mesh.quaternion.copy(camera.quaternion);
  mesh.position.copy(billboardPose(sub.anchor, quad.centerLiftM, camera.quaternion));
  mesh.updateMatrixWorld(true);
  return mesh;
}

/** Sujet de billboard d'un combattant posé sur une case (le chemin de production `actorBillboards`). */
function sujet(scene: Scene, mpt: number, c: Combatant, x: number, y: number): BillboardSubject {
  const [s] = actorBillboards([{ c, x, y, z: 0 }], scene, mpt, () => 1);
  expect(s, 'aucun sujet de billboard — le rig ne se résout pas').toBeTruthy();
  return s;
}

/** Le verdict VOLUMIQUE sous un point monde : l'id rendu par le rayon (`null` = rien de cliquable). */
function verdictVolumique(camera: Camera, cibles: readonly PickTarget[], pointMonde: Vector3): string | null {
  const p = projectToScreen(camera, pointMonde, CANVAS);
  return pickNearestCid(camera, cibles, ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h }));
}

describe('Un jeton DERRIÈRE un mur qui le couvre — les deux voies le refusent au clic (#1176 P2-3)', () => {
  const scene = emptyScene(3, 3);
  scene.walls = [{ x: 1, y: 1, side: 'N' }];
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [hero] = makeShowcaseParty();

  it('AFFINE : le panneau couvre la capsule du jeton ET se peint après lui — aucun `data-cid` sous le pixel', () => {
    const murs = buildWalls(scene);
    const objs = wallLayerObjs(murs, dims, NO_OCCLUDE, 0, { zoom: 1, mpt });
    const capsule = actorCapsuleOf({ x: 0, y: 0, h: 0 }, dims);
    const panneau = projectOccluder(
      { polygons: murs[0].faces.map((face) => face.poly.map((p) => ({ x: p.x, y: p.y, lift: metricToLift(p.h) }))) },
      dims,
    );
    expect(occludesActor(panneau, capsule)).toBe(true);
    // Peint APRÈS le jeton : le jeton porte l'offset de couche +0.5 sur sa profondeur (`combatantObjs`).
    expect(objs[0].d).toBeGreaterThan(depth(0, 0, dims, 0) + 0.5);
  });

  it('VOLUMIQUE : la masse du monde gagne le rayon — le hit-test rend `null`, même verdict', () => {
    const camera = cameraVolumique(dims, mpt);
    const baked = bakeWorldGeometry(scene, mpt);
    const monde = new Mesh(baked.geometry, new MeshBasicMaterial());
    monde.updateMatrixWorld(true);
    const sub = sujet(scene, mpt, hero, 0, 0);
    const quad = quadDe(sub, camera);
    const cibles: PickTarget[] = [{ cid: null, object: monde }, { cid: hero.id, object: quad }];
    // Sans le mur, le jeton EST cliquable au même pixel : la garde mord des deux côtés.
    expect(verdictVolumique(camera, [{ cid: hero.id, object: quad }], quad.position)).toBe(hero.id);
    expect(verdictVolumique(camera, cibles, quad.position)).toBeNull();
  });
});

describe('Deux jetons qui se CHEVAUCHENT — même vainqueur des deux côtés (#1176 P2-3)', () => {
  const scene = emptyScene(6, 6);
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [a, b] = makeShowcaseParty();
  const POSE_A = { x: 2, y: 2 };
  const POSE_B = { x: 3, y: 3 }; // juste DEVANT A à l'écran (même colonne, une rangée de profondeur en plus)

  it('AFFINE : le plus PROFOND se peint en dernier — c’est lui que reçoit le hit-test natif', () => {
    // Deux jetons portent le MÊME offset de couche (`combatantObjs` : +0,5) : leur ordre EST celui de
    // `depth`, la clé de tri du stage.
    expect(depth(POSE_B.x, POSE_B.y, dims, 0)).toBeGreaterThan(depth(POSE_A.x, POSE_A.y, dims, 0));
  });

  it('VOLUMIQUE : le quad le plus PROCHE de la caméra gagne — le même jeton, et l’ordre du tableau n’y fait rien', () => {
    const camera = cameraVolumique(dims, mpt);
    const qa = quadDe(sujet(scene, mpt, a, POSE_A.x, POSE_A.y), camera);
    const qb = quadDe(sujet(scene, mpt, b, POSE_B.x, POSE_B.y), camera);
    // MI-CHEMIN des deux quads : le pixel où ils se recouvrent (B est décalé d'une rangée de
    // profondeur, soit moins que la hauteur d'un corps — leurs boîtes se chevauchent largement).
    const milieu = qa.position.clone().add(qb.position).multiplyScalar(0.5);
    const p = projectToScreen(camera, milieu, CANVAS);
    const ndc = ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h });
    // Prémisse : les deux quads sont bien touchés à ce pixel (sinon la garde ne mesurerait rien).
    expect(pickNearestCid(camera, [{ cid: a.id, object: qa }], ndc)).toBe(a.id);
    expect(pickNearestCid(camera, [{ cid: b.id, object: qb }], ndc)).toBe(b.id);
    // …et le verdict ne dépend que de la DISTANCE : les deux ordres de tableau donnent B.
    expect(pickNearestCid(camera, [{ cid: a.id, object: qa }, { cid: b.id, object: qb }], ndc)).toBe(b.id);
    expect(pickNearestCid(camera, [{ cid: b.id, object: qb }, { cid: a.id, object: qa }], ndc)).toBe(b.id);
  });
});

/**
 * DIVERGENCE MESURÉE ET ASSUMÉE (P2-3) : le rayon touche la BOÎTE du billboard, pas le tracé du corps.
 * Le hit-test natif du SVG, lui, suit la géométrie remplie — un clic dans le vide d'un sprite traverse
 * jusqu'au sol. La voie volumique est donc plus « collante » d'une demi-boîte autour du sujet. Lever
 * l'écart demande de lire l'alpha de la texture à l'UV touché (rasterisation en cache) : hors de ce lot.
 */
describe('Coin de la boîte d’un billboard — la voie volumique y répond ENCORE (écart assumé)', () => {
  it('un point du COIN du quad, hors du corps dessiné, rend quand même l’id', () => {
    const scene = emptyScene(6, 6);
    const dims = dimsDe(scene);
    const mpt = sceneMetresPerTile(scene);
    const [hero] = makeShowcaseParty();
    const camera = cameraVolumique(dims, mpt);
    const sub = sujet(scene, mpt, hero, 2, 2);
    const quad = quadDe(sub, camera);
    const heightM = billboardHeightM('jeu', sub.kind) * sub.scaleK;
    const { widthM } = anchorAndSize(heightM, BILLBOARD_BOX_ASPECT);
    // Coin haut-droit de la boîte, à 1 % du bord : le corps d'un rig n'y peint rien.
    const droite = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(widthM * 0.49);
    const haut = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(heightM * 0.49);
    const coin = quad.position.clone().add(droite).add(haut);
    expect(verdictVolumique(camera, [{ cid: hero.id, object: quad }], coin)).toBe(hero.id);
  });
});

/**
 * ÉGALITÉ EXACTE DE DISTANCE — le cas où la distance caméra ne tranche plus rien : deux jetons posés
 * sur la MÊME case y ont des quads COPLANAIRES (même ancre aux pieds, même orientation écran), donc
 * touchés au même millimètre par le rayon. Le verdict doit alors rester le même quel que soit l'ordre
 * du tableau de cibles — c'est ce que promet le JSDoc de `pickNearestCid`, et ce que son départage
 * (monde d'abord, puis id lexicographique) rend vrai.
 */
describe('Cibles à distance ÉGALE — le verdict ne dépend pas de l’ordre du tableau (#1176 P2-3)', () => {
  const scene = emptyScene(6, 6);
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [a, b] = makeShowcaseParty();
  const camera = cameraVolumique(dims, mpt);
  const suba = sujet(scene, mpt, a, 2, 2);
  const subb = sujet(scene, mpt, b, 2, 2);
  const qa = quadDe(suba, camera);
  const qb = quadDe(subb, camera);
  /** Juste au-dessus de l'ancre partagée : un point que les DEUX boîtes contiennent. */
  const vise = new Vector3(suba.anchor.x, suba.anchor.y, suba.anchor.z).add(
    new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(0.2),
  );
  const p = projectToScreen(camera, vise, CANVAS);
  const ndc = ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h });

  it('prémisse : les deux quads sont COPLANAIRES et touchés au même pixel', () => {
    expect(suba.anchor).toEqual(subb.anchor);
    expect(pickNearestCid(camera, [{ cid: a.id, object: qa }], ndc)).toBe(a.id);
    expect(pickNearestCid(camera, [{ cid: b.id, object: qb }], ndc)).toBe(b.id);
  });

  it('deux JETONS : le même id dans les deux ordres — le plus petit id, arbitraire mais STABLE', () => {
    const ca: PickTarget = { cid: a.id, object: qa };
    const cb: PickTarget = { cid: b.id, object: qb };
    expect(pickNearestCid(camera, [ca, cb], ndc)).toBe(pickNearestCid(camera, [cb, ca], ndc));
    expect(pickNearestCid(camera, [ca, cb], ndc)).toBe([a.id, b.id].sort()[0]);
  });

  it('un JETON et un OCCULTEUR : le monde gagne son égalité, le clic retombe sur la tuile', () => {
    // Occulteur SYNTHÉTIQUE : une masse posée exactement dans le plan du quad — la seule façon de
    // fabriquer l'égalité EXACTE que la cuisson du monde ne produit qu'au hasard d'une coïncidence.
    const masse: PickTarget = { cid: null, object: quadDe(suba, camera) };
    const jeton: PickTarget = { cid: a.id, object: qa };
    expect(pickNearestCid(camera, [jeton, masse], ndc)).toBeNull();
    expect(pickNearestCid(camera, [masse, jeton], ndc)).toBeNull();
  });
});
