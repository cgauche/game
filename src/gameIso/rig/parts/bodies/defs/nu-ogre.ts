import type { BodyDef } from '../types';

/**
 * Corps NU de l'OGRE (@peau) — silhouette de CHAIR À PANSE TOMBANTE, d'après les illustrations
 * d'ADE II (Mangeur d'hommes p.35, torse nu : ADE II 02 l.855-901 ; Gardien de troupeaux p.38).
 * L'ogre n'est PAS un humain agrandi : le gabarit `brute` (sl 1.35 / st 1.7) ne fait qu'échelonner
 * le squelette humain — c'est ICI que vit sa morphologie.
 *
 * Lecture de l'illustration : POIRE/ŒUF — épaules relativement étroites, petits pectoraux HAUTS
 * posés SUR une panse énorme dont le plus large est aux ~2/3 (y≈14), qui SURPLOMBE la ceinture et
 * retombe sous la ligne de hanche (y≈38). Le dos, lui, n'est pas bedonnant : masse et bourrelets
 * de flanc. Repère LOCAL de l'os `torse` (épaules y=-28, hanches y=34), comme `nu.ts`.
 *
 * Ordre de peinture = la recette : chair, PUIS nappe d'ombre, PUIS rehauts, PUIS traits. Une arête
 * spéculaire tracée avant sa nappe d'ombre serait écrasée par elle.
 */
const FRONT =
  // chair : épaules ±12.5 → panse max ±16.8 à y≈14 → retombée sous la hanche (y≈38)
  '<path d="M-12.5 -28 Q0 -32.5 12.5 -28 C14.6 -18 15.8 -2 16.8 12 C17.2 26 11 34 5 37.4 Q0 39 -5 37.4 C-11 34 -17.2 26 -16.8 12 C-15.8 -2 -14.6 -18 -12.5 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  // NAPPE d'ombre du dessous de panse (le surplomb qui la fait TOMBER) — avant les rehauts
  + '<path d="M-15.6 22 C-13 32 -7 37 0 38.6 C7 37 13 32 15.6 22 C14 32 8 38.4 0 39.4 C-8 38.4 -14 32 -15.6 22 Z" fill="@peauO" opacity="0.55"/>'
  // ombre sous chaque pectoral (les pecs POSENT sur la panse)
  + '<path d="M-11.4 -7.6 Q-6 -4.4 -1.2 -7 Q-6.2 -2.6 -11.6 -5.6 Z" fill="@peauO" opacity="0.5"/>'
  + '<path d="M11.4 -7.6 Q6 -4.4 1.2 -7 Q6.2 -2.6 11.6 -5.6 Z" fill="@peauO" opacity="0.5"/>'
  // rehaut : LISERÉ de lumière le long du galbe gauche (un aplat en virgule au milieu du ventre
  // lirait comme une cicatrice ; le rim-light suit le contour et dit le VOLUME de la panse)
  + '<path d="M-16.6 12 C-15.6 -2 -14.4 -18 -12.4 -27.4 L-10.4 -26.6 C-12.6 -17 -13.8 -1.8 -14.6 12 C-14.4 20.4 -12.8 25.6 -10 29.6 L-11.4 31.4 C-14.6 26.8 -16.4 20.8 -16.6 12 Z" fill="@peauH" opacity="0.3"/>'
  // rehaut de carrure (haut de poitrine)
  + '<path d="M-11.6 -26 Q0 -30 11.6 -26 L11.8 -21 Q0 -25 -11.8 -21 Z" fill="@peauH" opacity="0.35"/>'
  // traits : sillon des pectoraux, ligne médiane, nombril enfoncé dans la panse
  + '<path d="M-11 -22.5 Q-5.6 -18.6 -0.8 -21.5 M11 -22.5 Q5.6 -18.6 0.8 -21.5" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.7"/>'
  + '<path d="M0 -20 L0 -8" stroke="@peauO" stroke-width="0.7" opacity="0.5"/>'
  + '<ellipse cx="0" cy="14" rx="1.5" ry="1.9" fill="@peauO" opacity="0.75"/>';

const BACK =
  // dos : massif, PAS bedonnant — flancs pleins (±14.6 à y≈12), tuck aux hanches
  '<path d="M-12.8 -27 Q0 -30.5 12.8 -27 C13.8 -14 14.6 0 14.4 12 C13.8 24 9 32 4.6 35.4 Q0 37 -4.6 35.4 C-9 32 -13.8 24 -14.4 12 C-14.6 0 -13.8 -14 -12.8 -27 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  // NAPPE : creux de la colonne + ombre basse du dos, avant les rehauts
  + '<path d="M-3.4 -24 Q0 -22.6 3.4 -24 L3 30 Q0 32 -3 30 Z" fill="@peauO" opacity="0.3"/>'
  + '<path d="M-13.4 22 C-10 30 -5 34.6 0 36 C5 34.6 10 30 13.4 22 C12 31 6 36.6 0 37.4 C-6 36.6 -12 31 -13.4 22 Z" fill="@peauO" opacity="0.45"/>'
  // rehauts : carrure d'épaules + omoplates
  + '<path d="M-12.4 -24 Q0 -27.6 12.4 -24 L12.6 -18.4 Q0 -22 -12.6 -18.4 Z" fill="@peauH" opacity="0.4"/>'
  + '<path d="M-11 -17 Q-6 -14.6 -2.6 -16.4 Q-6.4 -11 -11 -12 Z" fill="@peauH" opacity="0.3"/>'
  + '<path d="M11 -17 Q6 -14.6 2.6 -16.4 Q6.4 -11 11 -12 Z" fill="@peauH" opacity="0.3"/>'
  // traits : colonne + DEUX bourrelets de dos (le gras de l'ogre se lit aussi de dos)
  + '<path d="M0 -26 L0 32" stroke="@peauO" stroke-width="0.7" opacity="0.55"/>'
  + '<path d="M-13.6 6 Q0 10 13.6 6 M-14 18 Q0 22.4 14 18" fill="none" stroke="@peauO" stroke-width="0.7" opacity="0.5"/>';

const PROFILE =
  // profil : poitrine haute (+x≈9), panse BALLONNÉE vers l'avant (+x≈18.6 à y≈16) qui retombe
  // (y≈37) et SURPLOMBE ; dos creusé en lombaire (-x≈-8) — la lecture « ventre en avant ».
  '<path d="M-5 -28 Q3 -32 8 -26 C10.4 -18 9 -10 10.2 -2 C15 3.6 18.6 9 18.6 16 C18.4 27 13.4 34.4 6 37.6 Q-1 39.6 -6.6 33.6 L-6 4 Q-8.6 -13 -5 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  // NAPPE : dessous de panse (surplomb) + ombre dorsale — AVANT les rehauts
  + '<path d="M2.6 33.8 C8.6 32.6 14.6 27.4 17.2 20 C16.6 29.6 11.6 36.4 4.4 38.6 Q-1.4 39.8 -5.6 36.4 Z" fill="@peauO" opacity="0.5"/>'
  + '<path d="M-5 -2 Q-8.6 -13 -5 -28 Q-3 -30.4 -1 -29.4 L-1.4 4 Z" fill="@peauO" opacity="0.5"/>'
  // rehaut : arête de lumière sur la courbe avant de la panse (après la nappe, sinon écrasée)
  + '<path d="M9.4 -26 C11.6 -16 10.4 -8 11.6 -1.6 C15.8 3.4 17.2 9.4 17.2 16.4 C17 24 14.4 30 9.6 34" fill="none" stroke="@peauH" stroke-width="0.9" opacity="0.55"/>'
  // traits : pli sous le pectoral, pli de la panse qui retombe sur la hanche
  + '<path d="M9.6 -6.6 Q13 -3.6 11.6 -0.6" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.6"/>'
  + '<path d="M15.4 26.6 Q9 31 2.4 31.4" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.55"/>';

export const body: BodyDef = {
  id: 'nu-ogre',
  label: 'Corps nu — Ogre',
  torseFront: FRONT,
  torseBack: BACK,
  torseProfile: PROFILE,
  // jambe d'ogre : cuisse lourde s'effilant à la cheville (la masse porte sur des pattes courtes ;
  // `brute` raccourcit déjà les jambes via legs 0.8). Bas calé sur la jambe humaine (-3..4 à y=50)
  // pour que les jambières des tenues d'ogre existantes restent d'aplomb.
  jambe: '<path d="M-5.6 0 Q-6.2 15 -4.8 28 Q-4.4 40 -3 50 L4 50 Q5.2 40 4.9 28 Q6.2 15 5.6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>'
    + '<path d="M-4.8 26 Q0 28.6 4.9 26" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.5"/>',
};
