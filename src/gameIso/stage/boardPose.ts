/**
 * POSE PAR FRAME des billboards du monde volumique (#1176, P2-4) — la passe que la MARCHE rejoue
 * soixante fois par seconde, hors de tout rendu React. Elle ne construit RIEN : ni géométrie, ni
 * matériau, ni texture ; elle ne fait que ré-orienter des quads déjà montés et les décaler du
 * glissement de l'instant.
 *
 * Module à part de `GameStage3D` — et c'est STRUCTUREL : cette passe est PURE (aucun DOM, aucun
 * contexte WebGL), donc mesurable telle quelle, là où la frame complète de l'écran demande un
 * renderer que jsdom ne sait pas fournir.
 *
 * Ce qui appartient à UN sujet voyage AVEC lui : son quad, son ombre de contact plaquée à l'aplomb de
 * la même ancre, et les LAMPES qu'il porte (#1245, L2). Une ombre laissée à l'ancre cuite attendrait le
 * marcheur sur sa case d'arrivée ; une lanterne laissée là éclairerait la case qu'il vient de quitter.
 */
import * as THREE from 'three';
import { billboardDepthOffsetUnits, billboardPose, poseContactShadow, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { billboardExposure, type PointLightSlots } from './stagePointLights';

/** Un billboard monté : ce qu'il faut pour le RE-POSER quand la caméra bouge, sans le reconstruire. */
export interface Board {
  sub: BillboardSubject;
  quad: { widthM: number; heightM: number; centerLiftM: number };
  mesh: THREE.Mesh;
  /** Matériau du quad — jamais lambertien (P2-5) : la normale d'un quad aligné écran est l'axe caméra.
   *  Le type reste ouvert pour l'écran de SPIKE, qui monte les siens. */
  material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
  /** Disque d'ombre de contact du sujet, quand il en porte un (`wantsContactShadow`). */
  shadow?: THREE.Object3D;
}

/** Caméra de la frame — l'offset de profondeur des quads se dérive de son plan (`near`/`far`). */
export type FrameCamera = THREE.Camera & { near: number; far: number };

/**
 * MATÉRIAU d'un billboard du stage (#1176, P2-5) — TOUJOURS `MeshBasicMaterial`, et c'est structurel :
 * un quad aligné écran a pour normale l'axe caméra, donc un matériau lambertien y mesure l'angle
 * caméra↔soleil et la luminosité d'un personnage change quand la vue tourne (mesuré : ×2,36 entre deux
 * crans). Sa lumière est donc un SCALAIRE : `luminance` = l'exposition du sujet À CET ENDROIT
 * (`billboardExposure` : l'exposition globale de la frame, plus les flaques de lampe qui l'atteignent),
 * multipliée par la teinte de visibilité du sujet.
 */
export function billboardMaterial(map: THREE.Texture, luminance: number): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.color.setScalar(luminance);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  return mat;
}

/** Ancre de travail du glissement — une seule, réutilisée : `billboardPose` ne mute pas ce qu'on lui
 *  donne, et une allocation par billboard et par frame n'a rien à faire dans la boucle. */
const ANCRE = new THREE.Vector3();

/** Décalage MONDE du sujet `cid` à l'instant de la frame, `null` s'il ne marche pas. */
export type GlideAt = (cid: string) => { dx: number; dy: number; dz: number } | null;

/** Les FLAQUES de la frame (#1245, L2/L3) : le POOL de lampes ponctuelles monté et la table qui vient
 *  d'y être écrite (`stage/stagePointLights.ts`), index par index, plus l'exposition globale du moment. */
export interface FrameLights {
  /** Le pool monté — ce que la passe DÉPLACE (les lampes d'un porteur qui glisse). */
  pool: readonly THREE.PointLight[];
  /** La table écrite : la position LOGIQUE de chaque lampe, celle d'où le glissement se compte. */
  slots: PointLightSlots;
  /** Exposition globale de la frame (`stageLights.surfaceLuminance`), que les flaques COMPLÈTENT. */
  surfaceLuminance: number;
}

/** Remet chaque lampe du pool sur sa position LOGIQUE — le point d'où le glissement de la frame se
 *  compte, et celui où une lampe revient dès que son porteur a fini son pas. */
function reposerLampes(lights: FrameLights): void {
  for (let i = 0; i < lights.pool.length; i++) {
    const w = lights.slots[i];
    if (w) lights.pool[i].position.set(w.x, w.y, w.z);
  }
}

/** Emmène les lampes PORTÉES par `cid` sur le glissement de leur porteur (`LightSource.srcId`). */
function glisserLampesDe(lights: FrameLights, cid: string, g: { dx: number; dy: number; dz: number }): void {
  for (let i = 0; i < lights.pool.length; i++) {
    const w = lights.slots[i];
    if (w?.srcId !== cid) continue;
    lights.pool[i].position.set(w.x + g.dx, w.y + g.dy, w.z + g.dz);
  }
}

/** Glissements de la frame, un par board, dans l'ordre du tableau. Tampon de module réutilisé : la
 *  passe demande son glissement UNE fois par sujet (`glide` lit l'horloge — deux appels dans la même
 *  frame rendraient deux instants), et une allocation par frame n'a rien à faire dans la boucle. */
const GLISSEMENTS: ({ dx: number; dy: number; dz: number } | null)[] = [];

/** Re-pose tous les quads face à la caméra de la frame, glissement de marche compris. Rend `true` si au
 *  moins un sujet a GLISSÉ — c'est le seul cas où la frame déplace un casteur, donc le seul où la carte
 *  d'ombre de la frame précédente cesse d'être valide (une rotation de caméra ne bouge aucune ombre).
 *
 *  Ce qui appartient à un sujet voyage avec lui, et une LAMPE PORTÉE en fait partie (#1245, L2) : la
 *  lanterne d'un marcheur suit la MÊME courbe de glissement que son quad — celle-ci, pas une seconde.
 *
 *  L'EXPOSITION des quads se recalcule ici (#1245, L3) parce qu'elle DÉPEND de la pose : un personnage
 *  qui marche entre dans la flaque case par case, à la cadence de la frame et non des rendus React.
 *
 *  DEUX PASSES, et c'est structurel : toutes les lampes glissent d'abord, les quads s'exposent ensuite.
 *  En une seule passe, l'exposition d'un sujet dépendrait de sa PLACE dans le tableau — le décor, posé
 *  avant les acteurs, échantillonnerait des lanternes encore à leur case de départ. */
export function poseBoards(boards: readonly Board[], camera: FrameCamera, glide: GlideAt, lights: FrameLights): boolean {
  const units = billboardDepthOffsetUnits(camera.near, camera.far);
  let aGlissé = false;
  reposerLampes(lights);
  GLISSEMENTS.length = boards.length;
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    const g = b.sub.cid ? glide(b.sub.cid) : null;
    GLISSEMENTS[i] = g;
    if (!g) continue;
    aGlissé = true;
    if (b.sub.cid) glisserLampesDe(lights, b.sub.cid, g);
  }
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i];
    const g = GLISSEMENTS[i];
    const ancre = g ? ANCRE.set(b.sub.anchor.x + g.dx, b.sub.anchor.y + g.dy, b.sub.anchor.z + g.dz) : b.sub.anchor;
    b.mesh.quaternion.copy(camera.quaternion);
    b.mesh.position.copy(billboardPose(ancre, b.quad.centerLiftM, camera.quaternion));
    b.material.polygonOffsetUnits = units;
    if (b.shadow) poseContactShadow(b.shadow, ancre);
    b.material.color.setScalar(b.sub.tint * billboardExposure(ancre, lights.pool, lights.surfaceLuminance));
  }
  return aGlissé;
}
