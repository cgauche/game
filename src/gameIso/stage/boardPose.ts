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
 * Ce qui appartient à UN sujet voyage AVEC lui : son quad ET son ombre de contact, plaquée à l'aplomb
 * de la même ancre. Une ombre laissée à l'ancre cuite attendrait le marcheur sur sa case d'arrivée.
 */
import * as THREE from 'three';
import { billboardDepthOffsetUnits, billboardPose, poseContactShadow, type BillboardSubject } from '../backends/webgl/sceneMeshes';

/** Un billboard monté : ce qu'il faut pour le RE-POSER quand la caméra bouge, sans le reconstruire. */
export interface Board {
  sub: BillboardSubject;
  quad: { widthM: number; heightM: number; centerLiftM: number };
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  /** Disque d'ombre de contact du sujet, quand il en porte un (`wantsContactShadow`). */
  shadow?: THREE.Object3D;
}

/** Caméra de la frame — l'offset de profondeur des quads se dérive de son plan (`near`/`far`). */
export type FrameCamera = THREE.Camera & { near: number; far: number };

/** Ancre de travail du glissement — une seule, réutilisée : `billboardPose` ne mute pas ce qu'on lui
 *  donne, et une allocation par billboard et par frame n'a rien à faire dans la boucle. */
const ANCRE = new THREE.Vector3();

/** Décalage MONDE du sujet `cid` à l'instant de la frame, `null` s'il ne marche pas. */
export type GlideAt = (cid: string) => { dx: number; dy: number; dz: number } | null;

/** Re-pose tous les quads face à la caméra de la frame, glissement de marche compris. */
export function poseBoards(boards: readonly Board[], camera: FrameCamera, glide: GlideAt): void {
  const units = billboardDepthOffsetUnits(camera.near, camera.far);
  for (const b of boards) {
    const g = b.sub.cid ? glide(b.sub.cid) : null;
    const ancre = g ? ANCRE.set(b.sub.anchor.x + g.dx, b.sub.anchor.y + g.dy, b.sub.anchor.z + g.dz) : b.sub.anchor;
    b.mesh.quaternion.copy(camera.quaternion);
    b.mesh.position.copy(billboardPose(ancre, b.quad.centerLiftM, camera.quaternion));
    b.material.polygonOffsetUnits = units;
    if (b.shadow) poseContactShadow(b.shadow, ancre);
  }
}
