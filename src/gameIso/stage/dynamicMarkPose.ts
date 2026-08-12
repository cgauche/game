/**
 * POSE PAR FRAME des marques DYNAMIQUES du monde volumique (#1176, P3-0d) — la passe SŒUR de
 * `stage/boardPose.ts`, et pour la même raison : ces trois repères SUIVENT le jeton qui glisse. Un lien
 * d'engagement recalculé au rendu React attendrait le marcheur sur sa case d'arrivée ; le contour de
 * l'actif y resterait collé à la case qu'il vient de quitter.
 *
 * MÊME CANAL DE GLISSEMENT que les billboards : la `GlideAt` que la boucle donne à `poseBoards`, donc
 * la courbe UNIQUE de `fx/walkPose.walkGlideM`. Aucune seconde interpolation n'est calculée ici.
 *
 * PURE : ni DOM ni contexte WebGL — elle ne fait que réécrire les matrices d'instance de pools déjà
 * montés (`backends/webgl/dynamicMarkMeshes`), au compte près. CÔTÉ ALLOCATION : rien de GPU ni de
 * géométrique n'est créé ici (matrices, vecteurs et cases de travail sont des singletons de module) ;
 * ne restent que le petit relevé de comptes qu'elle REND et la fermeture d'écriture — deux littéraux
 * éphémères que la jeune génération ramasse, mesurés à quelques dizaines d'octets par frame.
 */
import * as THREE from 'three';
import { TETHER_DASH_K, TETHER_GAP_K, TETHER_WIDTH_K, type DynamicMarks, type MarkCell } from '../builders/dynamicMarks';
import { dynSlotLiftM, type DynMarkSlot } from '../backends/webgl/dynamicMarkMeshes';
import { diagOnce } from '../rig/devDiag';
import type { GlideAt } from './boardPose';

/** Les pools montés, par slot — un slot absent n'est simplement pas peint. */
export type DynMarkPools = Partial<Record<DynMarkSlot, THREE.InstancedMesh>>;

/** Ce que la frame apporte : l'échelle du monde, le glissement de l'instant, la hauteur des sols. */
export interface DynMarkFrame {
  /** Mètres par case. */
  mpt: number;
  /** Décalage MONDE d'un sujet à l'instant de la frame — `null` s'il ne marche pas. */
  glide: GlideAt;
  /** Hauteur métrique du sol d'une case (0 au sol, cf. `builders/highlights`). */
  groundM: (x: number, y: number, z: number) => number;
}

/** Comptes d'instances écrites, par slot. */
export type DynMarkCounts = Record<DynMarkSlot, number>;

/** Aucun glissement — la valeur d'un sujet immobile, réutilisée pour ne rien allouer. */
const IMMOBILE = { dx: 0, dy: 0, dz: 0 };

const M = new THREE.Matrix4();
const P = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const AXE_Y = new THREE.Vector3(0, 1, 0);
/** Extrémités du lien en cours — deux ancres de travail, pour ne rien allouer dans la boucle. */
const A_BOUT = new THREE.Vector3();
const B_BOUT = new THREE.Vector3();
/** Case de travail du parcours d'empreinte — réécrite à chaque case, jamais conservée. */
const CASE_TRAVAIL: MarkCell = { x: 0, y: 0, z: 0 };

/** Nombre de tirets d'un pointillé de longueur `lenM`, au pas `dashM + gapM` — la sémantique de
 *  `stroke-dasharray` que la voie affine obtient du navigateur : un tiret est peint dès que son DÉBUT
 *  tombe avant la fin du segment, le dernier étant CLIPPÉ à cette fin (`poserLiens` le raccourcit).
 *  Un segment plus court qu'un tiret en porte donc UN — sans quoi deux combattants sur des cases
 *  voisines n'auraient aucun lien visible. */
export function tetherDashCount(lenM: number, dashM: number, gapM: number): number {
  if (!(lenM > 0)) return 0;
  return Math.max(1, Math.ceil(lenM / (dashM + gapM)));
}

/** Position MONDE d'une case, glissement du sujet compris (`(x, y, h) → (x·mpt, h, y·mpt)`, la
 *  conversion de `worldTris.gpToWorld`), décollée du rang de son slot. */
function poseCase(cell: MarkCell, g: { dx: number; dy: number; dz: number }, slot: DynMarkSlot, f: DynMarkFrame, out: THREE.Vector3): THREE.Vector3 {
  return out.set(
    cell.x * f.mpt + g.dx,
    f.groundM(cell.x, cell.y, cell.z) + g.dy + dynSlotLiftM(slot),
    cell.y * f.mpt + g.dz,
  );
}

/** Écrit le LIEN d'engagement : un chapelet de quads plats entre les deux extrémités, chacune emmenée
 *  par le glissement de SON combattant. Renvoie le compte de quads écrits.
 *
 *  SATURATION ATOMIQUE : un lien dont le chapelet ne tient pas dans ce qui reste du pool n'est pas
 *  ENTAMÉ — un chapelet coupé en son milieu se lit comme un lien PLUS COURT, donc comme une autre
 *  situation de mêlée, là où un lien absent se lit comme absent. La pose s'arrête au premier lien qui
 *  ne rentre pas : sauter celui-là pour peindre un lien plus court derrière lui ferait clignoter la
 *  population d'une frame à l'autre. */
function poserLiens(mesh: THREE.InstancedMesh, marks: DynamicMarks, f: DynMarkFrame): number {
  const dashM = TETHER_DASH_K * f.mpt;
  const gapM = TETHER_GAP_K * f.mpt;
  const largeurM = TETHER_WIDTH_K * f.mpt;
  const capacité = mesh.instanceMatrix.count;
  const a = A_BOUT;
  const b = B_BOUT;
  let n = 0;
  for (const lien of marks.tethers) {
    poseCase(lien.a.cell, f.glide(lien.a.id) ?? IMMOBILE, 'tether', f, a);
    poseCase(lien.b.cell, f.glide(lien.b.id) ?? IMMOBILE, 'tether', f, b);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len <= 0) continue;
    const tirets = tetherDashCount(len, dashM, gapM);
    if (n + tirets > capacité) {
      if (import.meta.env?.DEV)
        diagOnce('marquesDyn:tether:saturation', () =>
          console.warn(
            `[marques dyn] pool « tether » saturé (capacité ${capacité}) : le lien ${lien.a.id}–${lien.b.id} demande ${tirets} quads et n'est pas peint — capacité à relever (dynamicMarkMeshes.DYN_SLOT_CAPACITY).`,
          ),
        );
      break;
    }
    // Lacet du chapelet : le quad UNITÉ est étiré sur son axe X, qu'une rotation d'axe Y amène sur la
    // direction du lien — `rotY(θ)` envoie +X sur `(cos θ, 0, −sin θ)`.
    Q.setFromAxisAngle(AXE_Y, Math.atan2(-dz / len, dx / len));
    S.set(1, 1, largeurM);
    for (let i = 0; i < tirets; i++) {
      const début = i * (dashM + gapM);
      const fin = Math.min(début + dashM, len);
      const t = (début + fin) / 2 / len;
      S.x = fin - début;
      P.set(a.x + dx * t, a.y + (b.y - a.y) * t, a.z + dz * t);
      mesh.setMatrixAt(n++, M.compose(P, Q, S));
    }
  }
  return n;
}

/**
 * Re-pose les trois marques dynamiques dans leurs pools. Rien n'est monté, rien n'est démonté : c'est
 * la passe que la marche rejoue soixante fois par seconde, à côté de celle des billboards.
 */
export function poseDynamicMarks(pools: DynMarkPools, marks: DynamicMarks, f: DynMarkFrame): DynMarkCounts {
  const counts: DynMarkCounts = { tether: 0, actif: 0, groupe: 0 };
  const écrire = (slot: DynMarkSlot, n: number) => {
    const mesh = pools[slot];
    if (!mesh) return;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    counts[slot] = n;
  };
  const liens = pools.tether;
  if (liens) écrire('tether', poserLiens(liens, marks, f));
  const actif = pools.actif;
  if (actif) {
    let n = 0;
    if (marks.active) {
      const { id, cell, n: côté } = marks.active;
      const g = f.glide(id) ?? IMMOBILE;
      Q.identity();
      S.set(f.mpt, 1, f.mpt);
      // Une case du CONTOUR par case d'empreinte — la même population que les losanges de la voie
      // affine (`footprintTiles`, même parcours dy·dx), et une épaisseur de trait qui ne dépend pas de la
      // taille de l'unité. Parcours INDICIEL sur une cellule de travail : l'empreinte d'une frame ne
      // laisse pas un tableau de `Pt` derrière elle soixante fois par seconde.
      const côtés = Math.max(1, côté); // `footprintTiles` rend UNE case sous 1 : même plancher ici
      for (let dy = 0; dy < côtés && n < actif.instanceMatrix.count; dy++)
        for (let dx = 0; dx < côtés && n < actif.instanceMatrix.count; dx++) {
          CASE_TRAVAIL.x = cell.x + dx;
          CASE_TRAVAIL.y = cell.y + dy;
          CASE_TRAVAIL.z = cell.z;
          actif.setMatrixAt(n++, M.compose(poseCase(CASE_TRAVAIL, g, 'actif', f, P), Q, S));
        }
    }
    écrire('actif', n);
  }
  const groupe = pools.groupe;
  if (groupe) {
    let n = 0;
    // Le repère du groupe se pose à sa case LOGIQUE, sans glissement : la voie affine le trace ainsi
    // (`dynamicHighlightObjs`), et le meneur qui marche le laisse derrière lui.
    if (marks.party && groupe.instanceMatrix.count > 0) {
      Q.identity();
      S.set(f.mpt, 1, f.mpt);
      groupe.setMatrixAt(n++, M.compose(poseCase(marks.party, IMMOBILE, 'groupe', f, P), Q, S));
    }
    écrire('groupe', n);
  }
  return counts;
}
