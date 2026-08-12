/**
 * MONTÉ — postures & tenues d'arme DÉDIÉES au cavalier (PAS la pose à pied surchargée). Un
 * cavalier ne se tient pas comme un fantassin : corps assis qui straddle la monture, rênes en
 * main GAUCHE, et l'arme tenue selon une logique montée (lance COUCHÉE vers l'avant, 1-main
 * dressée prête, hampe au port). PUR. Assemble le composite via composeComposite (tri par os).
 *
 * L'assise est DÉRIVÉE du dos réel de la monture (os `tronc`) → s'adapte à toute monture
 * (cheval/loup) et à toute vue (profil/face/dos) sans seatY codé en dur.
 */
import { composeComposite } from './composite';
import type { ResolvedBone } from './composeRig';
import { addPose, type Pose } from './poses';
import type { View } from './facing';
import { apply, type Matrix } from './kinematics';
import { handlingClass, type Handling } from './anim/handling';
import type { Weapon } from '../../engine/types';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { planOptsForRecord, type ResolveOpts } from './bodyPlan';
import { DEFAUT_HARNAIS_MONTE } from './quadruped/harnais';
import { QUAD_RIDER_Z } from './quadruped/quadZ';

const FAR_LEG = /(cuisse|tibia|pied)G$/; // de profil, G = côté LOINTAIN
const NEAR_LEG = /(cuisse|tibia|pied)D$/;

/** z d'un os du cavalier dans l'échelle de la monture quadrupède (table `QUAD_RIDER_Z`), selon la
 *  VUE : hors profil, les deux jambes sont du même côté de l'œil (elles straddlent le corps vu de
 *  bout) et passent donc au même plan. +z_natif*0.01 conserve l'ordre interne du cavalier (bras
 *  lointain derrière torse, etc.). */
export function riderZForQuad(view: View): (b: ResolvedBone) => number {
  const { corps, jambeProche, jambeLointaine } = QUAD_RIDER_Z[view];
  return (b) => (FAR_LEG.test(b.id) ? jambeLointaine : NEAR_LEG.test(b.id) ? jambeProche : corps) + b.z * 0.01;
}

// ── CORPS ASSIS (sans arme), par vue ────────────────────────────────────────
// Assise en selle : bassin ancré au dos, cuisses écartées qui straddlent, genoux fléchis (`tibia`)
// et coudes légèrement pliés (`avantBras`) — chaîne FK complète cuisse→tibia→pied et
// épaule→avantBras→main, la main reste attachée au poignet.
// Rig 2D : de FACE/DOS une rotation de torse penche de CÔTÉ → pas d'inclinaison hors profil ;
// et les jambes straddlent par angles MIROIR (G+/D−), sinon elles partent du même côté.
function seatedBody(view: View): Pose {
  if (view === 'profile') {
    return { torse: 6, tete: -4, cuisseG: 16, cuisseD: 12, tibiaG: -8, tibiaD: -6, piedG: 2, piedD: 0, epauleG: -36, avantBrasG: -14, avantBrasD: -12 };
  }
  return { cuisseG: 10, cuisseD: -10, tibiaG: -5, tibiaD: 5, avantBrasG: -10, avantBrasD: -10 };
}

// ── TENUE D'ARME MONTÉE (remplace weaponRest à pied), par classe de maniement + vue ─────────
// Convention os `arme` : repos 165 = pointe BAS ; delta −75 ≈ horizontale (avant), −150 ≈ dressée.
function mountedWeaponHold(h: Handling, view: View): Pose {
  if (view === 'profile') {
    switch (h) {
      case 'lance_cav': return { arme: -86, epauleD: 18 };       // lance COUCHÉE vers l'avant (en arrêt)
      case 'hampe': case 'lourde2m': return { arme: -150, epauleD: 10, epauleG: 30 }; // hampe/2-mains au port
      case 'arc': case 'arbalete': case 'arme_feu': return { arme: -150, epauleD: 8 }; // à distance, dressé
      default: return { arme: -150, epauleD: 8 };                 // 1-main : épée DRESSÉE, prête
    }
  }
  // face/dos : armes dressées verticales (les coucher = vers l'écran, illisible).
  return { arme: -158, epauleD: 6 };
}

/** Pose complète du cavalier au repos monté = corps assis + tenue d'arme, par vue. */
export function mountedRest(view: View, weapon?: Weapon): Pose {
  const h = weapon ? handlingClass(weapon) : 'lame1m';
  return addPose(seatedBody(view), mountedWeaponHold(h, view));
}

export interface SeatOpts {
  view: View;
  /** échelle d'écran de la monture (celle du BodyToken porteur). */
  mountScale: number;
  /** échelle d'écran VOULUE du cavalier (assis). */
  riderScale: number;
  /** y du BASSIN dans la boîte du cavalier (ancre posée sur la selle). */
  pelvisY?: number;
  /** remontée fine au-dessus du dos (px boîte monture). */
  lift?: number;
}

// Point de SELLE dans le repère LOCAL de l'os `tronc` : haut du barillet (où s'assoit le bassin).
const SADDLE_LOCAL_Y = -15;

/**
 * Opts de rendu de la MONTURE d'un couple monté : celles de son record (`planOptsForRecord` —
 * précédence par champ, override vivant → record), avec le set d'équipement par DÉFAUT quand la
 * donnée n'en déclare aucun. Ce défaut est une INFÉRENCE MAISON de rendu (#1128), tenue en donnée
 * éditable (`src/data/renduMonte.json`) : les listes de Possessions de carrière donnent la monture
 * « avec selle et harnais » (LDB 08 l.557, ADE I 07 l.48) ; aucune règle n'attache la sellerie au
 * fait d'être monté. Un `harnais: ''` authoré (nu explicite) est donc respecté tel quel. PURE.
 */
export function mountedPlanOpts(recordId: string | undefined, override?: EntityAppearance): ResolveOpts {
  const opts = planOptsForRecord(recordId, override);
  return { ...opts, harnais: opts.harnais ?? DEFAUT_HARNAIS_MONTE };
}

/**
 * POSE du cavalier dans la boîte de la monture : échelle relative k + ancre de SELLE dérivée de l'os
 * `tronc` (haut du barillet) → s'adapte à toute monture et toute vue. Sa translation `y` est le HAUT
 * de la boîte 0..150 du cavalier ramené dans la boîte de la monture : négative, le composite déborde
 * par le haut de cette boîte (ce que la rasterisation doit savoir avant de dessiner).
 */
export function seatPlacement(mountBones: ResolvedBone[], opts: SeatOpts): Matrix {
  const { mountScale, riderScale, pelvisY = 96, lift = 4 } = opts;
  const k = riderScale / mountScale;
  const tronc = mountBones.find((b) => b.id === 'tronc') ?? mountBones[0];
  // haut du barillet en coords boîte monture (matrice de l'os × point local échellé par la part).
  const saddle = tronc ? apply(tronc.matrix, { x: 0, y: SADDLE_LOCAL_Y * tronc.scale[1] }) : { x: 60, y: 75 };
  return [k, 0, 0, k, saddle.x - 60 * k, saddle.y - lift - pelvisY * k];
}

/**
 * Assoit `riderBones` sur `mountBones` (tous deux boîte 120×150) → composite trié. Le cavalier est
 * ramené dans la boîte de la monture par `seatPlacement`.
 */
export function seatRiderOnMount(mountBones: ResolvedBone[], riderBones: ResolvedBone[], opts: SeatOpts): ResolvedBone[] {
  return composeComposite([
    { bones: mountBones, z: (b) => b.z },                                            // monture : z natif du gabarit
    { bones: riderBones, place: seatPlacement(mountBones, opts), z: riderZForQuad(opts.view) }, // cavalier : remappé + assis
  ]);
}
