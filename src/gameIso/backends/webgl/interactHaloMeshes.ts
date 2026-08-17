/**
 * BACKEND VOLUMIQUE des HALOS D'INTERACTION (#1176, P3-0g) — les deux affordances hors combat : le halo
 * permanent d'un décor FOUILLABLE et le halo de survol d'un PNJ interlocuteur. Même partage que
 * `dynamicMarkMeshes.ts` : le MONTAGE est ici, la POSE par frame vit dans `stage/interactHaloPose.ts`.
 *
 * POOLS de capacité FIXE, montés une fois pour la vie de l'écran — même raison qu'aux marques
 * dynamiques : ces halos PULSENT, donc ils se réécrivent à la cadence de la frame, et un pool qui se
 * redimensionne dans la boucle de rendu est un pool qui alloue dans la boucle de rendu.
 *
 * POURQUOI UN SLOT PAR VARIANTE DE SURVOL : l'opacité est une propriété de MATÉRIAU (elle ne voyage
 * pas par instance), et c'est précisément elle que la pulsation fait battre. Or les deux variantes ne
 * battent NI à la même cadence NI entre les mêmes bornes (`stage/interactHaloPose` : `HALO_PULSE_S`
 * 1,6 s 0,35→0,8 contre `HALO_HOVER_PULSE_S` 0,7 s 0,85→1) : un seul pool ne saurait porter les deux à
 * la même frame. Le slot est donc le halo DIVISÉ par sa variante, exactement comme les marques de
 * case sont divisées par leur opacité (`highlightMeshes.HighlightSlot`).
 *
 * UN ANNEAU EST UN CHAPELET DE CORDES, pas une géométrie d'anneau : c'est déjà la mécanique des anneaux
 * d'équipe (`stage/dynamicMarkPose.ringDashes`), et elle donne ce qu'une `RingGeometry` mise à
 * l'échelle ne donne pas — une épaisseur de trait qui ne dépend pas du rayon, et un pointillé possible
 * sans seconde géométrie. Le DISQUE translucide, lui, est un vrai disque : un remplissage n'a pas de
 * trait à tenir.
 */
import * as THREE from 'three';
import { GOLD_TINT, HALO_TINT } from '../../highlightTints';
import {
  HALO_FILL_OPACITY,
  HALO_STROKE_OPACITY,
  NPC_FILL_OPACITY,
  NPC_STROKE_OPACITY,
  SPARK_BRANCHES,
  SPARK_INNER_R_PX,
  SPARK_R_PX,
} from '../../builders/interactHalos';
import { tileQuadGeometry } from './highlightMeshes';
import { SPECKLE_LIFT_M } from './groundAccents';
import { withRenderRank } from './renderRanks';

/** Un pool de halo d'interaction. */
export type HaloSlot =
  | 'fouilleDisque'
  | 'fouilleContour'
  | 'fouilleDisqueSurvol'
  | 'fouilleContourSurvol'
  | 'fouillePing'
  | 'fouilleEtincelle'
  | 'pnjDisque'
  | 'pnjContour';

/** Tous les pools, dans l'ordre de RANG croissant. */
export const HALO_SLOTS: readonly HaloSlot[] = [
  'fouilleDisque',
  'fouilleContour',
  'fouilleDisqueSurvol',
  'fouilleContourSurvol',
  'fouillePing',
  'pnjDisque',
  'pnjContour',
  'fouilleEtincelle',
];

/** RANG de superposition, dans la MÊME échelle que les marques de case (`highlightMeshes.SLOT_RANK`,
 *  qui s'arrête à 8) et que les marques dynamiques (`dynamicMarkMeshes.DYN_SLOT_RANK`, qui s'arrête à
 *  12) : ces halos passent au-dessus des deux. L'ÉTINCELLE n'est pas au sol — son rang ne la départage
 *  de rien, mais la table reste totale. */
export const HALO_SLOT_RANK: Record<HaloSlot, number> = {
  fouilleDisque: 13,
  fouilleContour: 14,
  fouilleDisqueSurvol: 15,
  fouilleContourSurvol: 16,
  fouillePing: 17,
  pnjDisque: 18,
  pnjContour: 19,
  fouilleEtincelle: 20,
};

/** Décollement (m) d'un pool au-dessus de la surface qui le porte. */
export function haloSlotLiftM(slot: HaloSlot): number {
  return (HALO_SLOT_RANK[slot] + 1) * SPECKLE_LIFT_M;
}

/** Opacité de REPOS d'un slot, avant que la pulsation ne la module. La pose la MULTIPLIE par la
 *  pulsation de l'instant (`stage/interactHaloPose`). L'onde « sonar » et l'étincelle n'ont pas de
 *  repos propre : leur pulsation donne l'opacité entière. */
export const HALO_SLOT_OPACITY: Record<HaloSlot, number> = {
  fouilleDisque: HALO_FILL_OPACITY,
  fouilleContour: HALO_STROKE_OPACITY,
  fouilleDisqueSurvol: HALO_FILL_OPACITY,
  fouilleContourSurvol: HALO_STROKE_OPACITY,
  fouillePing: 1,
  fouilleEtincelle: 1,
  pnjDisque: NPC_FILL_OPACITY,
  pnjContour: NPC_STROKE_OPACITY,
};

/** Teintes — le catalogue partagé `gameIso/highlightTints` : le disque prend le halo doux,
 *  le contour, l'onde et l'étincelle prennent l'or. */
export const HALO_SLOT_TINT: Record<HaloSlot, string> = {
  fouilleDisque: HALO_TINT,
  fouilleContour: GOLD_TINT,
  fouilleDisqueSurvol: HALO_TINT,
  fouilleContourSurvol: GOLD_TINT,
  fouillePing: GOLD_TINT,
  fouilleEtincelle: GOLD_TINT,
  pnjDisque: HALO_TINT,
  pnjContour: GOLD_TINT,
};

/** POPULATION portée par les pools : le nombre de décors fouillables qu'ils tiennent EN MÊME TEMPS, et
 *  le nombre de décors RENFORCÉS (survol du curseur, PNJ désigné — bornés par nature : le pointeur ne
 *  désigne qu'une tuile). Toutes les capacités en DÉRIVENT : un pool de DISQUES plus grand que ce que
 *  son pool de CONTOURS sait habiller peindrait, au décor de trop, un disque NU. */
export const HALO_FOUILLES_MAX = 64;
export const HALO_SURVOL_MAX = 8;
/** Chapelet d'un anneau, en cordes. `ringDashes` en rend 20 pour le halo de référence sous la caméra
 *  losange, 25 pour l'onde à son maximum, 15 sous la vue du dessus ; le compte croît en RACINE du rayon
 *  (un décor à `foot.scale` 3 en demande 35, mesuré). Ce palier est la borne que les capacités
 *  multiplient — au-delà, la pose n'ENTAME pas le halo (elle ne le peint pas du tout). */
export const HALO_RING_CHORDS = 32;

/** Capacité FIXE de chaque pool, DÉRIVÉE de la population et du chapelet ci-dessus. Au-delà, la pose
 *  écrit ce qu'elle peut et s'arrête — elle ne réalloue jamais dans la boucle de rendu. */
export const HALO_SLOT_CAPACITY: Record<HaloSlot, number> = {
  fouilleDisque: HALO_FOUILLES_MAX,
  fouilleContour: HALO_FOUILLES_MAX * HALO_RING_CHORDS,
  fouilleDisqueSurvol: HALO_SURVOL_MAX,
  fouilleContourSurvol: HALO_SURVOL_MAX * HALO_RING_CHORDS,
  fouillePing: HALO_FOUILLES_MAX * HALO_RING_CHORDS,
  fouilleEtincelle: HALO_FOUILLES_MAX,
  pnjDisque: HALO_SURVOL_MAX,
  pnjContour: HALO_SURVOL_MAX * HALO_RING_CHORDS,
};

/** Gabarit UNITÉ d'un DISQUE plat : un cercle horizontal de DIAMÈTRE 1 centré sur l'origine (plan XZ),
 *  frère de `tileQuadGeometry`/`tileFrameGeometry`. Sa mise à l'échelle uniforme reste un disque —
 *  c'est tout ce qu'un remplissage demande. */
export function unitDiscGeometry(segments = 48): THREE.BufferGeometry {
  const geo = new THREE.CircleGeometry(0.5, segments);
  geo.rotateX(-Math.PI / 2); // le disque de three naît dans le plan XY : on le couche au sol
  return geo;
}

/** Gabarit UNITÉ de l'ÉTINCELLE, SOURCE UNIQUE du glyphe : l'étoile paramétrée par les constantes du
 *  builder (`SPARK_BRANCHES`, `SPARK_INNER_R_PX / SPARK_R_PX`), triangulée en ÉVENTAIL depuis son
 *  centre — `2n` triangles pour `n` branches, aucun canal de rendu de plus. DIAMÈTRE 1 de pointe à
 *  pointe, dans le plan XZ comme `tileQuadGeometry` : la pose la redresse et l'aligne sur la caméra. */
export function unitStarGeometry(branches = SPARK_BRANCHES, innerRatio = SPARK_INNER_R_PX / SPARK_R_PX): THREE.BufferGeometry {
  const pas = Math.PI / branches;
  const sommet = (i: number): [number, number] => {
    const r = (i % 2 === 0 ? 0.5 : 0.5 * innerRatio);
    return [r * Math.cos(i * pas), r * Math.sin(i * pas)];
  };
  const pos: number[] = [];
  for (let i = 0; i < 2 * branches; i++) {
    const [ax, az] = sommet(i);
    const [bx, bz] = sommet(i + 1);
    pos.push(0, 0, 0, ax, 0, az, bx, 0, bz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Pool d'un slot : disque plein pour un remplissage, étoile pour l'étincelle (face caméra, orientée
 *  par la pose), quad pour une corde d'anneau. Matériau NON éclairé — une affordance de jeu ne
 *  s'assombrit pas la nuit — et NON EMBRUMÉ (`fog: false`) : ce halo est du chrome d'interface, pas de
 *  la matière du monde ; la brume du POV (`applyFogGamma`, `sceneMeshes.ts`) délaverait une affordance
 *  lointaine de 71 % à 26 cases (#1176 P3-1c). */
export function buildHaloMesh(slot: HaloSlot, capacity = HALO_SLOT_CAPACITY[slot]): THREE.InstancedMesh {
  const disque = slot === 'fouilleDisque' || slot === 'fouilleDisqueSurvol' || slot === 'pnjDisque';
  const geo = disque ? unitDiscGeometry() : slot === 'fouilleEtincelle' ? unitStarGeometry() : tileQuadGeometry();
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(HALO_SLOT_TINT[slot]),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: HALO_SLOT_OPACITY[slot],
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.name = `halos:${slot}`;
  mesh.frustumCulled = false; // ces halos suivent le décor de toute la carte : la sphère du pool la vaudrait
  mesh.count = 0;
  return withRenderRank(mesh, 'chrome');
}
