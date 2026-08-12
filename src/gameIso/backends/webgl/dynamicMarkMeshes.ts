/**
 * BACKEND VOLUMIQUE des marques DYNAMIQUES (#1176, P3-0d) — le pendant three des trois repères que la
 * voie affine trace à la frame (`stage/tokens.dynamicHighlightObjs`) : lien d'ENGAGEMENT, contour de
 * l'unité ACTIVE, repère de position du GROUPE. Même partage que `highlightMeshes.ts` : le MONTAGE est
 * ici, la POSE par frame vit dans `stage/dynamicMarkPose.ts`.
 *
 * TROIS POOLS de capacité FIXE, montés une fois pour la vie de l'écran. Contrairement aux marques
 * statiques, la capacité ne suit même pas des paliers : ces marques se réécrivent SOIXANTE FOIS PAR
 * SECONDE (elles suivent la glisse de marche), et un pool qui se redimensionne dans la boucle de rendu
 * est un pool qui alloue dans la boucle de rendu.
 *
 * LE LIEN EST FAIT DE QUADS, pas d'une ligne, et c'est mesuré :
 *  - `LineBasicMaterial.linewidth` part à `gl.lineWidth`, que la quasi-totalité des pilotes WebGL
 *    borne à 1 (`ALIASED_LINE_WIDTH_RANGE`) — l'épaisseur 2 de la voie affine n'y serait pas rendue ;
 *  - `LineSegments.computeLineDistances()`, qu'exige `LineDashedMaterial` à chaque changement de
 *    géométrie, RECONSTRUIT son tableau et son `Float32BufferAttribute` à chaque appel
 *    (`three/src/objects/LineSegments.js`) — donc une allocation par frame de marche.
 * Un pointillé de quads n'a ni l'une ni l'autre limite : l'épaisseur est une échelle d'instance, et la
 * pose ne fait que réécrire des matrices. Le COÛT est borné par la nature de l'engagement : deux
 * combattants Engagés sont en CONTACT de mêlée, donc le lien fait environ une case — au pas de
 * pointillé de la voie affine (7 px, pour un pas de case qui se projette sur 35,78 px, cf.
 * `builders/dynamicMarks`), six quads pour un lien d'une case.
 */
import * as THREE from 'three';
import { ACTIVE_HALO_TINT, ENGAGE_TINT } from '../../highlightTints';
import { RING_FRAME_K, tileFrameGeometry, tileQuadGeometry } from './highlightMeshes';
import { SPECKLE_LIFT_M } from './groundAccents';

/** Un pool de marques dynamiques. */
export type DynMarkSlot = 'tether' | 'actif' | 'groupe';

/** Les trois pools, dans l'ordre de RANG croissant. */
export const DYN_MARK_SLOTS: readonly DynMarkSlot[] = ['tether', 'actif', 'groupe'];

/** RANG de superposition, dans la MÊME échelle que les marques statiques (`highlightMeshes.SLOT_RANK`,
 *  qui s'arrête à 8) : ces trois-là passent AU-DESSUS de toutes les marques de case, comme en affine où
 *  elles sont émises après le builder. */
export const DYN_SLOT_RANK: Record<DynMarkSlot, number> = { tether: 9, actif: 10, groupe: 11 };

/** Décollement (m) d'un pool au-dessus de la surface qui le porte. */
export function dynSlotLiftM(slot: DynMarkSlot): number {
  return (DYN_SLOT_RANK[slot] + 1) * SPECKLE_LIFT_M;
}

/** Opacités de la voie affine, à l'identique (le contour de l'actif n'y porte pas d'`opacity`). */
export const DYN_SLOT_OPACITY: Record<DynMarkSlot, number> = { tether: 0.6, actif: 1, groupe: 0.5 };

/** Teintes — le MÊME catalogue que la voie affine (`highlightTints`). */
export const DYN_SLOT_TINT: Record<DynMarkSlot, string> = {
  tether: ENGAGE_TINT,
  actif: ACTIVE_HALO_TINT,
  groupe: ACTIVE_HALO_TINT,
};

/** Épaisseur du cadre du repère de GROUPE : la MOITIÉ de celle du contour d'actif — le rapport exact
 *  des deux traits de la voie affine (1,5 px contre 3). */
export const PARTY_FRAME_K = RING_FRAME_K / 2;

/** Capacité FIXE de chaque pool. `tether` : une dizaine de quads par lien, donc de l'ordre de vingt
 *  liens simultanés ; `actif` : l'empreinte de la plus grande unité (5×5 = 25) ; `groupe` : le repère
 *  est unique. Au-delà, la pose écrit ce qu'elle peut et s'arrête à la capacité — elle ne réalloue
 *  jamais dans la boucle de rendu. */
export const DYN_SLOT_CAPACITY: Record<DynMarkSlot, number> = { tether: 256, actif: 32, groupe: 4 };

/** Pool d'un slot : géométrie du slot (quad plein pour un tiret de lien, cadre pour un contour),
 *  matériau NON éclairé et TEINTÉ à la couleur du slot — un repère de jeu ne s'assombrit pas la nuit,
 *  et ces trois-là ne portent qu'une teinte chacun (pas d'`instanceColor` à tenir). */
export function buildDynamicMarkMesh(slot: DynMarkSlot, capacity = DYN_SLOT_CAPACITY[slot]): THREE.InstancedMesh {
  const geo = slot === 'tether' ? tileQuadGeometry() : tileFrameGeometry(slot === 'groupe' ? PARTY_FRAME_K : RING_FRAME_K);
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(DYN_SLOT_TINT[slot]),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: DYN_SLOT_OPACITY[slot],
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.name = `marquesDyn:${slot}`;
  mesh.frustumCulled = false; // ces marques suivent l'action : la sphère du pool vaudrait la scène
  mesh.count = 0;
  return mesh;
}
