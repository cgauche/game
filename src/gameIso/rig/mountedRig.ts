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

const FAR_LEG = /(cuisse|tibia|pied)G$/; // de profil, G = côté LOINTAIN
const NEAR_LEG = /(cuisse|tibia|pied)D$/;

/** z d'un os du cavalier dans l'échelle de la monture quadrupède, selon la vue.
 *  Quad : pattes loin 1 · queue 3 · croupe 4 · TRONC(barillet) 5 · encolure 6 · TÊTE 7 · pattes proches 9.
 *  +z_natif*0.01 conserve l'ordre interne du cavalier (bras lointain derrière torse, etc.). */
export function riderZForQuad(view: View): (b: ResolvedBone) => number {
  if (view === 'profile') {
    return (b) => (FAR_LEG.test(b.id) ? 4.5 : NEAR_LEG.test(b.id) ? 8.2 : 6.6) + b.z * 0.01;
  }
  return (b) => 6.6 + b.z * 0.01; // face/dos : tout le cavalier devant le barillet, derrière la tête redressée
}

// ── CORPS ASSIS (sans arme), par vue ────────────────────────────────────────
// CONTRAINTE RIG : tibia/avant-bras NON dessinés (jambe=cuisse+pied, bras=épaule+main) → plier
// genou/coude DÉTACHE pied/main. On garde les membres ~DROITS (rotation de l'os entier).
// Rig 2D : de FACE/DOS une rotation de torse penche de CÔTÉ → pas d'inclinaison hors profil ;
// et les jambes straddlent par angles MIROIR (G+/D−), sinon elles partent du même côté.
function seatedBody(view: View): Pose {
  if (view === 'profile') {
    return { torse: 6, tete: -4, cuisseG: 16, cuisseD: 12, tibiaG: -8, tibiaD: -6, piedG: 2, piedD: 0, epauleG: -36 };
  }
  return { cuisseG: 10, cuisseD: -10, tibiaG: -5, tibiaD: 5 };
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

// ── HARNACHEMENT (selle/sangle/étrier/rênes) — os SYNTHÉTIQUES posés sur la monture quand
// elle est montée. Couleurs LITTÉRALES (les tokens de la monture sont déjà résolus ici) :
// cuir de sellerie, pas la robe. z calés dans l'échelle quad (cf. riderZForQuad) :
// selle 5.5 = au-dessus du barillet (5) et de la jambe lointaine (4.5), SOUS le corps du
// cavalier (6.6) et sa jambe proche (8.2) ; rênes 6.7 = par-dessus le corps, sous la jambe.
const CUIR = '#5b3f28', CUIR_O = '#36241a', METAL = '#b8b4a8';

/** Os de harnachement pour une monture RÉSOLUE. Profil = sellerie complète ; face/dos = tapis
 *  de selle + sangle (les rênes liraient mal de bout). Vide si pas d'os `tronc`. */
export function mountTackBones(mountBones: ResolvedBone[], view: View): ResolvedBone[] {
  const tronc = mountBones.find((b) => b.id === 'tronc');
  if (!tronc) return [];
  const sy = tronc.scale[1];
  const top = SADDLE_LOCAL_Y * sy; // haut du barillet (où s'assoit le bassin)
  const belly = 19 * sy; // bas du ventre (sangle)
  if (view !== 'profile') {
    const svg = `<g>` +
      `<path d="M-8 ${top - 2} Q0 ${top - 5.5} 8 ${top - 2} L7 ${top + 3} Q0 ${top + 1} -7 ${top + 3} Z" fill="${CUIR}" stroke="${CUIR_O}" stroke-width="0.6"/>` +
      `<path d="M-7.5 ${top + 2} L-6.5 ${belly} M7.5 ${top + 2} L6.5 ${belly}" stroke="${CUIR_O}" stroke-width="1.6"/>` +
      `</g>`;
    return [{ ...tronc, id: 'selle', parts: [{ svg, layer: 0 }], scale: [1, 1], z: 5.5 } as ResolvedBone];
  }
  // PROFIL : siège incurvé pommeau/troussequin + tapis + quartier + sangle + étrier.
  const selle = `<g>` +
    // tapis de selle (sous le cuir, dépasse derrière)
    `<path d="M-13 ${top + 1} L13 ${top + 1} L11.5 ${top + 7} L-11.5 ${top + 7} Z" fill="#7a2f26" stroke="#4c1d17" stroke-width="0.5"/>` +
    // siège : assise creuse entre pommeau (avant +x, relevé) et troussequin (arrière, relevé)
    `<path d="M-10 ${top + 1} Q-11 ${top - 4} -8.5 ${top - 5.5} Q-4 ${top - 1.5} 0 ${top - 1.5} Q5 ${top - 1.5} 8 ${top - 6} Q10.5 ${top - 4.5} 10 ${top + 1} Z" fill="${CUIR}" stroke="${CUIR_O}" stroke-width="0.7"/>` +
    `<path d="M-9 ${top} Q-4 ${top - 2.5} 0 ${top - 2.5} Q4 ${top - 2.5} 8 ${top - 1}" fill="none" stroke="${CUIR_O}" stroke-width="0.6" opacity="0.7"/>` +
    // quartier (flap) sur le flanc proche + sangle qui descend sous le ventre
    `<path d="M-6 ${top + 2} Q-7 ${top + 12} -3 ${top + 14} L4 ${top + 14} Q7 ${top + 10} 6 ${top + 2} Z" fill="${CUIR}" stroke="${CUIR_O}" stroke-width="0.6"/>` +
    `<path d="M0 ${top + 13} Q1 ${belly - 2} 0.5 ${belly}" fill="none" stroke="${CUIR_O}" stroke-width="2"/>` +
    // étrivière + étrier (anneau métal) sous le quartier
    `<path d="M2 ${top + 13} L2.4 ${top + 19}" stroke="${CUIR_O}" stroke-width="1.4"/>` +
    `<path d="M0.6 ${top + 19} L4.2 ${top + 19} L3.8 ${top + 23} Q2.4 ${top + 24.4} 1 ${top + 23} Z" fill="none" stroke="${METAL}" stroke-width="1.3"/>` +
    `</g>`;
  const out: ResolvedBone[] = [{ ...tronc, id: 'selle', parts: [{ svg: selle, layer: 0 }], scale: [1, 1], z: 5.5 } as ResolvedBone];
  // Rênes : du museau au pommeau (la main gauche du cavalier tient là). Os en coords BOÎTE
  // (matrice identité) — courbe douce qui suit le creux de l'encolure.
  const tete = mountBones.find((b) => b.id === 'tete');
  if (tete) {
    const mz = apply(tete.matrix, { x: 15 * tete.scale[0], y: 9 * tete.scale[1] });
    const pommel = apply(tronc.matrix, { x: 8, y: top - 4 });
    const sag = Math.max(mz.y, pommel.y) + 9;
    const reins = `<path d="M${mz.x.toFixed(1)} ${mz.y.toFixed(1)} Q${((mz.x + pommel.x) / 2).toFixed(1)} ${sag.toFixed(1)} ${pommel.x.toFixed(1)} ${pommel.y.toFixed(1)}" fill="none" stroke="${CUIR_O}" stroke-width="1.1"/>` +
      `<path d="M${(mz.x - 3).toFixed(1)} ${(mz.y - 4).toFixed(1)} L${(mz.x + 1).toFixed(1)} ${(mz.y + 1).toFixed(1)}" stroke="${CUIR_O}" stroke-width="1.2"/>`; // muserolle
    out.push({ id: 'renes', matrix: [1, 0, 0, 1, 0, 0], scale: [1, 1], parts: [{ svg: reins, layer: 0 }], z: 6.7 } as ResolvedBone);
  }
  return out;
}

/**
 * Assoit `riderBones` sur `mountBones` (tous deux boîte 120×150) → composite trié. L'ancre de
 * SELLE est dérivée de l'os `tronc` de la monture (haut du barillet) → s'adapte à toute monture
 * et toute vue. Le cavalier est ramené dans la boîte de la monture (échelle relative k).
 */
export function seatRiderOnMount(mountBones: ResolvedBone[], riderBones: ResolvedBone[], opts: SeatOpts): ResolvedBone[] {
  const { view, mountScale, riderScale, pelvisY = 96, lift = 4 } = opts;
  const k = riderScale / mountScale;
  const tronc = mountBones.find((b) => b.id === 'tronc') ?? mountBones[0];
  // haut du barillet en coords boîte monture (matrice de l'os × point local échellé par la part).
  const saddle = tronc ? apply(tronc.matrix, { x: 0, y: SADDLE_LOCAL_Y * tronc.scale[1] }) : { x: 60, y: 75 };
  const place: Matrix = [k, 0, 0, k, saddle.x - 60 * k, saddle.y - lift - pelvisY * k];
  return composeComposite([
    { bones: mountBones, z: (b) => b.z },                 // monture : z natif du gabarit
    { bones: riderBones, place, z: riderZForQuad(view) }, // cavalier : remappé + assis
  ]);
}
