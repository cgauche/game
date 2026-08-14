/**
 * POSE PAR FRAME des HALOS D'INTERACTION du monde volumique (#1176, P3-0g) — la passe SŒUR de
 * `stage/dynamicMarkPose.ts`, et pour une raison de plus : ces halos ne se contentent pas de suivre le
 * décor, ils PULSENT. Ce que la voie affine obtient d'une animation CSS (le navigateur repeint son SVG
 * tout seul), la voie volumique ne l'obtient que d'une fonction de la frame — même patron que le
 * vacillement des lampes (`stage/stagePointLights.applyFlicker`, #1245).
 *
 * FOSSILE DE TRANSITION (#1176) : les quatre keyframes de `src/gameIso/anim.css` (`haloPulse`,
 * `haloPulseHover`, `haloPing`, `sparkBob`) et les fonctions de frame ci-dessous décrivent la MÊME
 * animation pour deux voies de rendu. La feuille reste la source de la voie affine tant que celle-ci
 * vit ; elle MEURT avec elle (lot P3-4), et ces fonctions restent seules — comme le catalogue
 * `highlightTints` reste seul quand les tokens CSS `--combat-*` tombent. Toute retouche de cadence se
 * fait donc AUX DEUX endroits jusque-là.
 *
 * ÉCARTS DÉCLARÉS avec la voie affine — mesurés, non résorbés, et qui meurent avec elle :
 *  — EASING : les rampes du navigateur (`ease-in-out`, `ease-out` = `cubic-bezier(0, 0, .58, 1)`) sont
 *    rendues par une sinusoïde et une quadratique de MÊMES bornes et MÊME cadence ; la forme diffère de
 *    quelques centièmes en milieu de course.
 *  — DESCENTE ÉCRAN du halo : la voie affine pose ses ellipses `HALO_CY_PX` px SOUS le centre de case
 *    le monde volumique pose son cercle AU centre — un cercle couché au sol n'a pas
 *    d'axe d'écran où descendre sans quitter ce sol.
 *  — LUEUR de survol : le double `drop-shadow` de `.interact-halo.hovered` (`anim.css:184`) n'a pas
 *    d'équivalent ici — un filtre d'écran ne se pose pas sur une instance.
 *  — LISERÉ de l'étincelle : le GLYPHE (étoile à quatre branches) est le même des deux côtés
 *    (`interactHalos.sparkPoints`, `interactHaloMeshes.unitStarGeometry`) ; son contour sombre
 *    (`GOLD_DARK_TINT`, 0,7 px) ne l'est pas — il demanderait un second pool.
 *
 * PURE : ni DOM ni contexte WebGL — elle ne fait que réécrire les matrices d'instance et l'opacité de
 * matériau de pools déjà montés (`backends/webgl/interactHaloMeshes`), au compte près. CÔTÉ
 * ALLOCATION : matrices, vecteurs, centre de travail sont des singletons de module, et les chapelets de
 * cordes sortent du cache de `ringDashes` (celui des anneaux d'équipe, partagé). Restent par frame le
 * relevé de comptes qu'elle REND, les deux petits objets de `haloPing`/`sparkBob`, et les deux vecteurs
 * que `billboardPose` rend PAR étincelle — la même dépense que la passe des billboards
 * (`boardPose.poseBoards`), quelques dizaines d'octets que la jeune génération ramasse.
 */
import * as THREE from 'three';
import { ISO_PX_PER_M } from '../iso';
import type { ProjKind } from '../../geometry/iso';
import { ringPhaseRad, strokeWidthK } from '../builders/dynamicMarks';
import {
  HALO_HOVER_SCALE,
  HALO_HOVER_STROKE_PX,
  HALO_RX_PX,
  HALO_STROKE_PX,
  NPC_HALO_RX_PX,
  PING_STROKE_PX,
  SPARK_DX_PX,
  SPARK_DY_PX,
  SPARK_R_PX,
  haloRadiusK,
  type InteractHalo,
  type InteractionHalos,
} from '../builders/interactHalos';
import { HALO_SLOT_OPACITY, haloSlotLiftM, type HaloSlot } from '../backends/webgl/interactHaloMeshes';
import { billboardPose } from '../backends/webgl/sceneMeshes';
import { pxPerM } from '../backends/webgl/worldTris';
import { ringDashes, writeRingChords } from './dynamicMarkPose';

/** Les pools montés, par slot — un slot absent n'est simplement pas peint. */
export type HaloPools = Partial<Record<HaloSlot, THREE.InstancedMesh>>;

/** Comptes d'instances écrites, par slot. */
export type HaloCounts = Record<HaloSlot, number>;

/** Ce que la frame apporte aux halos. */
export interface HaloFrame {
  /** Mètres par case. */
  mpt: number;
  /** Hauteur métrique du sol d'une case (0 au sol, cf. `builders/highlights`). */
  groundM: (x: number, y: number, z: number) => number;
  /** VUE de la caméra — la géométrie ÉCRAN d'un anneau en dépend (cf. `ringDashes`). */
  kind: ProjKind;
  /** Lacet de la CAMÉRA (degrés). Absent = cran zéro. */
  yawDeg?: number;
  /** Orientation de la CAMÉRA : l'étincelle est un quad ALIGNÉ ÉCRAN, et son décalage depuis le décor
   *  se mesure en pixels d'écran (`SPARK_DX_PX` vers la droite). */
  camQuat: THREE.Quaternion;
  /** Horloge de la frame, en SECONDES — la phase des pulsations. Toutes les instances la partagent :
   *  une animation CSS part elle aussi de l'origine du document, donc en phase pour toute la page. */
  tSec: number;
}

// ── CONVERSION DES KEYFRAMES (`src/gameIso/anim.css`) EN FONCTIONS DE FRAME ────────────────────────
// Chaque constante porte SA ligne de la feuille. Les rampes `ease-in-out` d'un motif symétrique
// (0 % / 50 % / 100 %) se lisent en SINUSOÏDE : `(1 − cos 2πp) / 2` vaut 0 aux bornes, 1 au milieu, et
// sa dérivée s'annule aux trois — la propriété même de `ease-in-out`. Le seul écart de FORME est là :
// la courbe de Bézier du navigateur et cette sinusoïde ne coïncident pas au pour-cent près. La CADENCE
// (période) et l'AMPLITUDE (bornes) sont, elles, celles de la feuille à l'exact.

/** `@keyframes haloPulse` — `.interact-halo { animation: haloPulse 1.6s ease-in-out infinite }`
 *  (anim.css:154-158) : opacité 0,35 aux bornes, 0,8 à mi-course. */
export const HALO_PULSE_S = 1.6;
export const HALO_PULSE_MIN = 0.35;
export const HALO_PULSE_MAX = 0.8;
/** `@keyframes haloPulseHover` — `.interact-halo.hovered { animation: haloPulseHover 0.7s … }`
 *  (anim.css:175-180) : cadence plus rapide, opacité 0,85 → 1. */
export const HALO_HOVER_PULSE_S = 0.7;
export const HALO_HOVER_PULSE_MIN = 0.85;
export const HALO_HOVER_PULSE_MAX = 1;

/** Rampe symétrique d'un `ease-in-out` sur une période : 0 → 1 → 0. */
function rampeSymetrique(p: number): number {
  return (1 - Math.cos(2 * Math.PI * p)) / 2;
}

/** Phase d'une animation de période `periodeS` à l'instant `tSec`, dans `[0, 1[`. */
export function phase(tSec: number, periodeS: number): number {
  const p = (tSec / periodeS) % 1;
  return p < 0 ? p + 1 : p;
}

/** MULTIPLICATEUR d'opacité du halo à l'instant `tSec` — la valeur que la feuille pose sur le groupe
 *  `.interact-halo`, et que les opacités d'attribut de ses deux ellipses multiplient. */
export function haloPulse(tSec: number, hovered: boolean): number {
  const min = hovered ? HALO_HOVER_PULSE_MIN : HALO_PULSE_MIN;
  const max = hovered ? HALO_HOVER_PULSE_MAX : HALO_PULSE_MAX;
  return min + (max - min) * rampeSymetrique(phase(tSec, hovered ? HALO_HOVER_PULSE_S : HALO_PULSE_S));
}

/** `@keyframes haloPing` — `.halo-ping { animation: haloPing 1.9s ease-out infinite }`
 *  (anim.css:190-195) : de `scale(0.65)`/opacité 0,7 à `scale(1.55)`/opacité 0 à 75 % de la période,
 *  puis RIEN jusqu'au tour suivant (le palier 75 %→100 % répète la même image, invisible). */
export const PING_S = 1.9;
export const PING_SCALE_MIN = 0.65;
export const PING_SCALE_MAX = 1.55;
export const PING_OPACITY_MAX = 0.7;
export const PING_END = 0.75;

/** Onde « sonar » de l'instant : échelle et opacité. L'`ease-out` du navigateur
 *  (`cubic-bezier(0, 0, .58, 1)`) est rendu par sa quadratique `1 − (1 − u)²` — mêmes bornes, même
 *  départ rapide, écart de forme borné à quelques centièmes en milieu de course. */
export function haloPing(tSec: number): { scale: number; opacity: number } {
  const p = phase(tSec, PING_S);
  if (p >= PING_END) return { scale: PING_SCALE_MAX, opacity: 0 };
  const u = p / PING_END;
  const e = 1 - (1 - u) * (1 - u);
  return { scale: PING_SCALE_MIN + (PING_SCALE_MAX - PING_SCALE_MIN) * e, opacity: PING_OPACITY_MAX * (1 - e) };
}

/** `@keyframes sparkBob` — `.halo-spark { animation: sparkBob 1.6s ease-in-out infinite }`
 *  (anim.css:197-201) : l'étincelle monte de 4 px à mi-course et son opacité passe de 0,85 à 1. */
export const SPARK_S = 1.6;
export const SPARK_RISE_PX = 4;
export const SPARK_OPACITY_MIN = 0.85;
export const SPARK_OPACITY_MAX = 1;

/** Flottement de l'étincelle à l'instant `tSec` : montée (pixels d'écran) et opacité. */
export function sparkBob(tSec: number): { risePx: number; opacity: number } {
  const r = rampeSymetrique(phase(tSec, SPARK_S));
  return { risePx: SPARK_RISE_PX * r, opacity: SPARK_OPACITY_MIN + (SPARK_OPACITY_MAX - SPARK_OPACITY_MIN) * r };
}

// ── POSE ──────────────────────────────────────────────────────────────────────────────────────────

const M = new THREE.Matrix4();
const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
/** Centre du halo en cours — une ancre de travail, jamais conservée. */
const CENTRE = new THREE.Vector3();
/** Axe DROITE de l'écran, dérivé de l'orientation caméra (décalage de l'étincelle). */
const DROITE = new THREE.Vector3();
/** Case et étage du halo en cours — une cellule de travail, réécrite à chaque halo (même idiome que
 *  `dynamicMarkPose.CASE_TRAVAIL` : un littéral par halo et par frame serait de la poussière). */
const CASE_TRAVAIL = { x: 0, y: 0, z: 0 };

/** Y pose la case d'un halo, et la rend. */
function caseDe(x: number, y: number, z: number): { x: number; y: number; z: number } {
  CASE_TRAVAIL.x = x;
  CASE_TRAVAIL.y = y;
  CASE_TRAVAIL.z = z;
  return CASE_TRAVAIL;
}
/** Rotation qui couche le quad HORIZONTAL de `tileQuadGeometry` dans le plan de l'écran, avant que
 *  l'orientation de la caméra ne l'y aligne : le gabarit unité est dans le plan XZ, un quart de tour
 *  autour de X le met dans le plan XY — celui que la caméra regarde de face. */
const REDRESSER = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

/** Position MONDE du centre d'un halo (même conversion que `dynamicMarkPose.poseCase` :
 *  `(x, y, h) → (x·mpt, h, y·mpt)`), relevée de `liftM`. Un halo POSÉ AU SOL prend le décollement de
 *  son slot — il est coplanaire des marques de case, qu'il doit surmonter sans z-fighter ; l'ÉTINCELLE,
 *  elle, flotte au-dessus du décor et n'a rien à départager : sa hauteur est la sienne. */
function centreDe(x: number, y: number, z: number, liftM: number, f: HaloFrame, out: THREE.Vector3): THREE.Vector3 {
  return out.set(x * f.mpt, f.groundM(Math.round(x), Math.round(y), z) + liftM, y * f.mpt);
}

/** Écrit un ANNEAU de halo (disque plein + contour) dans ses deux pools.
 *  SATURATION ATOMIQUE, comme les anneaux d'équipe : un halo qui ne tient pas n'est pas ENTAMÉ — ni son
 *  chapelet de cordes (un arc isolé se lirait comme une autre marque), NI son disque, qui sans son
 *  contour serait une flaque muette. Le disque ne dépasse donc jamais ce que le contour sait habiller. */
function poserAnneauDeHalo(
  pools: HaloPools,
  slotDisque: HaloSlot,
  slotContour: HaloSlot,
  compte: HaloCounts,
  centre: { x: number; y: number; z: number },
  rK: number,
  largeurPx: number,
  f: HaloFrame,
): void {
  const tirets = ringDashes(rK, null, f.kind);
  const phi0 = ringPhaseRad(f.kind) + ((f.yawDeg ?? 0) * Math.PI) / 180;
  const rM = rK * f.mpt;
  const contour = pools[slotContour];
  if (contour) {
    if (compte[slotContour] + tirets.length > contour.instanceMatrix.count) return;
    centreDe(centre.x, centre.y, centre.z, haloSlotLiftM(slotContour), f, CENTRE);
    compte[slotContour] = writeRingChords(contour, compte[slotContour], CENTRE, rM, strokeWidthK(largeurPx) * f.mpt, tirets, phi0);
  }
  const disque = pools[slotDisque];
  if (disque && compte[slotDisque] < disque.instanceMatrix.count) {
    centreDe(centre.x, centre.y, centre.z, haloSlotLiftM(slotDisque), f, CENTRE);
    Q.identity();
    S.set(2 * rM, 1, 2 * rM); // le gabarit unité a un DIAMÈTRE de 1
    disque.setMatrixAt(compte[slotDisque]++, M.compose(CENTRE, Q, S));
  }
}

/** Écrit l'ÉTINCELLE d'un décor fouillable : le glyphe ALIGNÉ ÉCRAN, décalé du centre du décor de ce
 *  que la voie affine décale le sien (droite `SPARK_DX_PX`, haut `SPARK_DY_PX`, flottement compris).
 *
 *  CE QUI SUIT L'ÉCHELLE DU DÉCOR, ET CE QUI NE LA SUIT PAS : la voie affine met à l'échelle la seule
 *  POSITION du glyphe (`translate(cx + SPARK_DX_PX·scale, cy − SPARK_DY_PX·scale)`) ;
 *  son tracé garde ses 6 px et son flottement ses 4 px (`anim.css:199`), quel que soit le décor. La
 *  taille et la montée sont donc INVARIANTES de `h.scale` ici aussi.
 *
 *  L'ÉLÉVATION suit le HAUT DE L'ÉCRAN, pas l'axe Y du monde : patron `sceneMeshes.billboardPose`,
 *  celui des billboards de la scène (`boardPose`). Une élévation en Y monde disparaîtrait sous la vue
 *  du dessus, où l'axe Y pointe vers l'œil. */
function poserEtincelle(mesh: THREE.InstancedMesh, n: number, h: InteractHalo, montéePx: number, f: HaloFrame): number {
  if (n >= mesh.instanceMatrix.count) return n;
  const parMetre = pxPerM(f.mpt); // px d'écran par mètre HORIZONTAL
  centreDe(h.centre.x, h.centre.y, h.cell.z, 0, f, CENTRE);
  DROITE.set(1, 0, 0).applyQuaternion(f.camQuat);
  CENTRE.addScaledVector(DROITE, (SPARK_DX_PX * h.scale) / parMetre);
  const hauteurM = (SPARK_DY_PX * h.scale + montéePx) / ISO_PX_PER_M; // px d'écran VERTICAUX par mètre
  P.copy(billboardPose(CENTRE, hauteurM, f.camQuat));
  Q.copy(f.camQuat).multiply(REDRESSER);
  const côtéM = (2 * SPARK_R_PX) / parMetre;
  S.set(côtéM, 1, côtéM);
  mesh.setMatrixAt(n++, M.compose(P, Q, S));
  return n;
}

/** Pose l'opacité de matériau d'un pool : son opacité de REPOS, modulée par la pulsation de l'instant.
 *  C'est le canal de la pulsation — une opacité ne voyage pas par instance, et toutes les instances
 *  d'un slot battent de toute façon en phase (cf. `HaloFrame.tSec`). */
function battreOpacite(mesh: THREE.InstancedMesh | undefined, repos: number, pulse: number): void {
  if (mesh) (mesh.material as THREE.MeshBasicMaterial).opacity = repos * pulse;
}

/** Comptes à zéro — un relevé NEUF par frame (la passe rend ce qu'elle a écrit). */
function comptesVierges(): HaloCounts {
  return {
    fouilleDisque: 0,
    fouilleContour: 0,
    fouilleDisqueSurvol: 0,
    fouilleContourSurvol: 0,
    fouillePing: 0,
    fouilleEtincelle: 0,
    pnjDisque: 0,
    pnjContour: 0,
  };
}

/**
 * Re-pose les halos d'interaction dans leurs pools, et fait battre leurs opacités. Rien n'est monté,
 * rien n'est démonté : c'est la passe que la boucle rejoue tant qu'un halo est à l'écran.
 */
export function poseInteractHalos(pools: HaloPools, halos: InteractionHalos, f: HaloFrame): HaloCounts {
  const n = comptesVierges();
  const étincelles = pools.fouilleEtincelle;
  const ping = haloPing(f.tSec);
  const spark = sparkBob(f.tSec);
  for (const h of halos.fouilles) {
    const rK = haloRadiusK(HALO_RX_PX) * h.scale;
    const centre = caseDe(h.centre.x, h.centre.y, h.cell.z);
    // La variante de SURVOL est le MÊME anneau, agrandi et épaissi par la feuille (`anim.css:183/187`) :
    // le facteur porte sur le groupe, donc sur le rayon ET sur le trait.
    if (h.hovered)
      poserAnneauDeHalo(pools, 'fouilleDisqueSurvol', 'fouilleContourSurvol', n, centre, rK * HALO_HOVER_SCALE, HALO_HOVER_STROKE_PX * HALO_HOVER_SCALE, f);
    else poserAnneauDeHalo(pools, 'fouilleDisque', 'fouilleContour', n, centre, rK, HALO_STROKE_PX, f);
    // ONDE « SONAR » : le même cercle, à l'échelle de l'instant — trait compris, la feuille l'échelonne
    // avec le reste du groupe (`transform: scale`, anim.css:191-195).
    const onde = pools.fouillePing;
    if (onde && ping.opacity > 0) {
      const tirets = ringDashes(rK, null, f.kind);
      if (n.fouillePing + tirets.length <= onde.instanceMatrix.count) {
        centreDe(centre.x, centre.y, centre.z, haloSlotLiftM('fouillePing'), f, CENTRE);
        n.fouillePing = writeRingChords(
          onde,
          n.fouillePing,
          CENTRE,
          rK * ping.scale * f.mpt,
          strokeWidthK(PING_STROKE_PX * ping.scale) * f.mpt,
          tirets,
          ringPhaseRad(f.kind) + ((f.yawDeg ?? 0) * Math.PI) / 180,
        );
      }
    }
    if (étincelles) n.fouilleEtincelle = poserEtincelle(étincelles, n.fouilleEtincelle, h, spark.risePx, f);
  }
  for (const p of halos.pnjs)
    // Le halo de PNJ porte TOUJOURS la classe `hovered` (`anim.css`) : même
    // agrandissement, même trait épaissi, même cadence rapide que la variante de survol d'une fouille.
    poserAnneauDeHalo(
      pools,
      'pnjDisque',
      'pnjContour',
      n,
      caseDe(p.cell.x, p.cell.y, p.cell.z),
      haloRadiusK(NPC_HALO_RX_PX) * HALO_HOVER_SCALE,
      HALO_HOVER_STROKE_PX * HALO_HOVER_SCALE,
      f,
    );
  const lent = haloPulse(f.tSec, false);
  const vif = haloPulse(f.tSec, true);
  battreOpacite(pools.fouilleDisque, HALO_SLOT_OPACITY.fouilleDisque, lent);
  battreOpacite(pools.fouilleContour, HALO_SLOT_OPACITY.fouilleContour, lent);
  battreOpacite(pools.fouilleDisqueSurvol, HALO_SLOT_OPACITY.fouilleDisqueSurvol, vif);
  battreOpacite(pools.fouilleContourSurvol, HALO_SLOT_OPACITY.fouilleContourSurvol, vif);
  battreOpacite(pools.fouillePing, HALO_SLOT_OPACITY.fouillePing, ping.opacity);
  battreOpacite(pools.fouilleEtincelle, HALO_SLOT_OPACITY.fouilleEtincelle, spark.opacity);
  battreOpacite(pools.pnjDisque, HALO_SLOT_OPACITY.pnjDisque, vif);
  battreOpacite(pools.pnjContour, HALO_SLOT_OPACITY.pnjContour, vif);
  for (const slot of Object.keys(n) as HaloSlot[]) {
    const mesh = pools[slot];
    if (!mesh) continue;
    mesh.count = n[slot];
    mesh.instanceMatrix.needsUpdate = true;
  }
  return n;
}
