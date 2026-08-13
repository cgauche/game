/**
 * LACET CONTINU de la caméra du stage (#1176, P2-7) — l'écart, en degrés, entre le lacet RÉELLEMENT
 * regardé et le cran de la vue (`camRot`/`camEdge`). La voie VOLUMIQUE seule le lit : le monde y est
 * une caméra réelle, qui accepte n'importe quel angle (`affineCamera(kind, yawDeg, …)`) et dont les
 * overlays SVG se re-projettent élément par élément (`Dims.yawDeg` → `tileCenter`). La voie affine
 * garde ses crans et son « dim-and-turn » — son atlas de sprites n'existe qu'aux crans.
 *
 * Hors du store Zustand, comme `state/stage3d.ts` dont il est le compagnon : `snapshotSave` sérialise
 * TOUTE clé de données de l'état initial, et un angle de vue vivant n'a rien à faire dans une
 * sauvegarde. Même patron que `state/viewLevel.ts` — le clavier le PILOTE, le rendu le LIT.
 *
 * DEUX angles, et c'est le cœur de la sensation : `cible` est là où le joueur veut regarder (une
 * touche = un quart de cran), `courant` est là où la caméra EST, et il y court à chaque frame. Un
 * seul angle donnerait un saut ; une file de crans donnerait une file d'attente.
 */
import type { Rot } from '../geometry/iso';
import { getStageBackend, subscribeStageBackend } from './stage3d';

/** Constante de temps de l'approche (ms) : le lacet courant couvre ~63 % de son retard à chaque `TAU`. */
const TAU_MS = 90;

/** Retard MAXIMAL toléré entre la cible et le lacet courant (degrés). Sans cette borne, la répétition
 *  clavier d'une touche maintenue empilerait un demi-tour d'avance, que la caméra continuerait de
 *  parcourir bien après le relâchement. Avec elle, maintenir Q/E fait tourner en CONTINU et relâcher
 *  arrête en moins d'un cran. */
const AVANCE_MAX_DEG = 90;

/** Écart en deçà duquel la caméra est ARRIVÉE (degrés) : sous le dixième de degré, plus aucun pixel
 *  d'overlay ne bouge — continuer à animer ne ferait que rendre pour rien. */
const ARRIVE_DEG = 0.05;

let cible = 0;
let courant = 0;
let anime = false;
let dernier = 0;
const subs = new Set<() => void>();

/** Lacet courant (degrés) à ajouter au cran de la vue. */
export const getStageYaw = (): number => courant;

/** LACET DE VUE à poser sur un `Dims` cranté (`Dims.yawDeg`) : le cran de la caméra plus l'écart
 *  continu. `undefined` en voie AFFINE — ses crans font foi, et un `Dims` sans lacet ne change rien.
 *
 *  SOURCE UNIQUE de cette composition, et ce n'est pas un confort : TOUT ce qui traduit un geste
 *  ÉCRAN en case (le pas clavier d'exploration, le curseur de combat, la sonde de recette) doit voir
 *  le MÊME lacet que le peintre. Un seul de ces chemins resté au cran, et la direction qu'on pousse
 *  cesse d'être celle qu'on regarde. */
export function viewYawDeg(camRot: number, camEdge: boolean): number | undefined {
  return getStageBackend() === 'webgl' ? camRot * 90 + (camEdge ? 45 : 0) + courant : undefined;
}

/** CRAN de vue atteint par un lacet : le cran de départ plus les quarts de tour PARCOURUS (arrondi au
 *  quart le plus proche). PUR — c'est la forme qui se mesure. */
export function rotAtYaw(camRot: number, yawOffsetDeg: number): Rot {
  return ((((camRot + Math.round(yawOffsetDeg / 90)) % 4) + 4) % 4) as Rot;
}

/** CRAN EFFECTIF de la vue : celui que le lacet RÉEL regarde, `undefined` en voie affine (le cran du
 *  store y fait foi).
 *
 *  Ce que le cran décide reste DISCRET — la géométrie de dégagement (quelle façade est frontale,
 *  quelle nappe coiffe le groupe) et les couches affines pré-triées, dont les memos ne doivent pas se
 *  rejouer soixante fois par seconde. Sous lacet libre, ce cran ne peut plus être celui du store :
 *  après un demi-tour, `camRot` vaut toujours 0 et la façade tombée serait celle du départ. Il change
 *  au FRANCHISSEMENT d'un quart, et lui seul y fait rejouer ces memos. */
export function viewRot(camRot: number): Rot | undefined {
  return getStageBackend() === 'webgl' ? rotAtYaw(camRot, courant) : undefined;
}

export function subscribeStageYaw(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** UN pas d'approche exponentielle, indépendant de la cadence de frame (PUR — c'est lui qui se mesure :
 *  la même durée de rotation sur une machine à 30 Hz et sur une à 144 Hz). */
export function yawStep(courantDeg: number, cibleDeg: number, dtMs: number): number {
  if (Math.abs(cibleDeg - courantDeg) <= ARRIVE_DEG) return cibleDeg;
  return courantDeg + (cibleDeg - courantDeg) * (1 - Math.exp(-Math.max(0, dtMs) / TAU_MS));
}

/** Nouvelle CIBLE après une poussée de `deltaDeg`, avance bornée (cf. `AVANCE_MAX_DEG`). PUR. */
export function yawTarget(courantDeg: number, cibleDeg: number, deltaDeg: number): number {
  const avance = cibleDeg + deltaDeg - courantDeg;
  return courantDeg + Math.max(-AVANCE_MAX_DEG, Math.min(AVANCE_MAX_DEG, avance));
}

/** Cran de la caméra de JEU (degrés) : les QUATRE vues diagonales (#1289). La géométrie de face
 *  (`camEdge`, +45°) reste entière — seule la caméra du joueur ne la vise plus. */
const CRAN_JEU_DEG = 90;

/** Avance maximale tolérée, EN CRANS, quand la poussée AIMANTE (cf. `snapYawTarget`). Le plafond ne
 *  peut pas s'exprimer en degrés relatifs au lacet courant : borner à ±90° d'un angle EN VOL pose la
 *  cible entre deux crans. En crans, un double-appui rapide vaut un demi-tour et relâcher arrête au
 *  cran suivant, sans jamais empiler un tour d'avance. */
const AVANCE_MAX_CRANS = 2;

/** Nouvelle CIBLE d'une poussée AIMANTÉE : le premier cran SITUÉ DANS LE SENS poussé — jamais la
 *  cible plus un delta. L'aimant est là pour l'angle QUELCONQUE : d'une vue de face (45°, restaurée
 *  d'une sauvegarde ou posée par la caméra libre DEV), une poussée horaire rend 90° et une poussée
 *  antihoraire 0° — le premier tour recale, il ne fait pas 135°. Angle mort DEV-seulement : une cible
 *  FINE posée par la caméra libre (`nudgeStageYaw`) à `k×90 − ε` a pour plancher `k` et rend `k×90`,
 *  soit une poussée sans déplacement visible ; la route du joueur n'a aucun appel fin. PUR. */
export function snapYawTarget(courantDeg: number, cibleDeg: number, dir: 1 | -1): number {
  const cranCourant = Math.round(courantDeg / CRAN_JEU_DEG);
  const vise = dir === 1 ? Math.floor(cibleDeg / CRAN_JEU_DEG) + 1 : Math.ceil(cibleDeg / CRAN_JEU_DEG) - 1;
  return Math.max(cranCourant - AVANCE_MAX_CRANS, Math.min(cranCourant + AVANCE_MAX_CRANS, vise)) * CRAN_JEU_DEG;
}

function notifier(): void {
  subs.forEach((f) => f());
}

/** UNE frame d'approche. L'ONGLET CACHÉ suspend `requestAnimationFrame` : au retour, `dt` vaut la
 *  durée entière de l'absence et le pas suivant pose `courant` sur `cible` — un SAUT, borné au retard
 *  maximal toléré (cf. `AVANCE_MAX_DEG`), donc d'un quart de tour au plus. */
function frame(now: number): void {
  const dt = dernier ? now - dernier : 16;
  dernier = now;
  courant = yawStep(courant, cible, dt);
  notifier();
  if (courant === cible) {
    anime = false;
    return;
  }
  requestAnimationFrame(frame);
}

/** Pose la CIBLE et lance (ou relance) l'approche — le geste commun aux deux façons de viser. */
function courirVers(nouvelleCible: number): void {
  cible = nouvelleCible;
  if (typeof requestAnimationFrame !== 'function') { // hors navigateur : le lacet arrive tout de suite
    courant = cible;
    notifier();
    return;
  }
  if (anime) return;
  anime = true;
  dernier = 0;
  requestAnimationFrame(frame);
}

/** Pousse le lacet de `deltaDeg` et lance (ou relance) l'approche. Vise un angle LIBRE : la caméra
 *  d'inspection (DEV), qui atteint les vues de face comme n'importe quel angle intermédiaire. */
export function nudgeStageYaw(deltaDeg: number): void {
  courirVers(yawTarget(courant, cible, deltaDeg));
}

/** AIMANTE le lacet au cran voisin (`snapYawTarget`) et lance l'approche : le geste de rotation du
 *  JOUEUR (Q/E, boutons d'orientation), qui ne connaît que les quatre vues diagonales (#1289). */
export function snapStageYawToCran(dir: 1 | -1): void {
  courirVers(snapYawTarget(courant, cible, dir));
}

/** Remet le lacet au cran. Deux coutures l'appellent : l'ENTRÉE DE SCÈNE (`startScene`/`transitionTo`,
 *  `state/store.ts` — une nouvelle carte se regarde depuis son cran) et la BASCULE DE VOIE, câblée
 *  juste dessous. Les tests s'en servent pour repartir du cran. */
export function resetStageYaw(): void {
  cible = 0;
  courant = 0;
  notifier();
}

// BASCULE DE VOIE : quitter le volumique rend la main aux crans, y revenir repart du cran du store. Un
// lacet survivant à l'aller-retour ferait sauter le monde d'un demi-tour au remontage. Le câblage vit
// ICI et pas dans `stage3d.ts`, qui ne doit rien connaître du lacet (il en est la dépendance).
subscribeStageBackend(resetStageYaw);
