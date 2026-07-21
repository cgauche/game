import type { BodyDef } from '../types';

/**
 * Corps NU humain (@peau) — la fondation de chair sous toute tenue de monstre et le repli générique.
 * Repères du canon (`rig/SKELETON-CONTRACT.md`) : torse local col −32..−28 / ceinture ~+15 /
 * ourlet +34..38 ; jambe locale 0 (hanche) → 50 (cheville), genou 22..30.
 *
 * Invariant de silhouette (garde `scripts/qc/silhouette-coherence.mts`) : FACE et DOS partagent le
 * MÊME contour — seule la SURFACE (modelé, colonne, rotule/mollet) change. Ordre de peinture =
 * chair, puis nappes d'ombre, puis rehauts, puis traits (cf. `nu-ogre.ts`).
 */

// ── Torse — contour UNIQUE face/dos : épaules ±13 à −28, taille ±11.2 à +2, ourlet ±11 à +34.
const TORSE_CONTOUR =
  'M-13 -28 Q0 -32 13 -28 C13.4 -18 12.6 -6 11.2 2 C11.6 14 11.2 26 11 34 Q0 38 -11 34 C-11.2 26 -11.6 14 -11.2 2 C-12.6 -6 -13.4 -18 -13 -28 Z';
// Nappe d'ombre des flancs (le galbe du buste) — même contour, donc partagée face/dos.
const TORSE_FLANCS =
  '<path d="M-13 -28 C-13.4 -18 -12.6 -6 -11.2 2 C-11.6 14 -11.2 26 -11 34 L-9.2 33.5 C-9.5 25 -9.7 14 -9.3 3 C-10.5 -6 -11.3 -17 -10.9 -26.8 Z" fill="@peauO" opacity="0.3"/>'
  + '<path d="M13 -28 C13.4 -18 12.6 -6 11.2 2 C11.6 14 11.2 26 11 34 L9.2 33.5 C9.5 25 9.7 14 9.3 3 C10.5 -6 11.3 -17 10.9 -26.8 Z" fill="@peauO" opacity="0.3"/>';
const torse = (surface: string) =>
  `<path d="${TORSE_CONTOUR}" fill="@peau" stroke="@peauO" stroke-width="0.6"/>${TORSE_FLANCS}${surface}`;

const TORSE_FRONT = torse(
  // rehaut de carrure (haut de poitrine)
  '<path d="M-11.6 -26 Q0 -30 11.6 -26 L11.8 -21 Q0 -25 -11.8 -21 Z" fill="@peauH" opacity="0.35"/>'
  // traits : sillon des pectoraux, ligne médiane, nombril
  + '<path d="M-10.4 -19.5 Q-5.2 -15.8 -0.8 -18.8 M10.4 -19.5 Q5.2 -15.8 0.8 -18.8" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.6"/>'
  + '<path d="M0 -15.5 L0 12" stroke="@peauO" stroke-width="0.6" opacity="0.4"/>'
  + '<ellipse cx="0" cy="13.5" rx="1" ry="1.3" fill="@peauO" opacity="0.6"/>',
);

const TORSE_BACK = torse(
  // creux lombaire (nappe) — avant les rehauts
  '<path d="M-3.2 14 Q0 15.4 3.2 14 L2.6 26 Q0 27.2 -2.6 26 Z" fill="@peauO" opacity="0.3"/>'
  // rehauts : carrure d'épaules + omoplates
  + '<path d="M-12 -25 Q0 -28 12 -25 L12 -19.5 Q0 -22.5 -12 -19.5 Z" fill="@peauH" opacity="0.4"/>'
  + '<path d="M-9.8 -17 Q-5.2 -14.6 -2.4 -16.6 Q-6 -11 -9.8 -12.2 Z" fill="@peauH" opacity="0.3"/>'
  + '<path d="M9.8 -17 Q5.2 -14.6 2.4 -16.6 Q6 -11 9.8 -12.2 Z" fill="@peauH" opacity="0.3"/>'
  // trait : colonne
  + '<path d="M0 -26.5 L0 33" stroke="@peauO" stroke-width="0.7" opacity="0.55"/>',
);

// Profil : buste avancé +x, dos ombré — même bande de hauteurs que face/dos (col −28, ourlet 33..37).
const TORSE_PROFILE =
  '<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-5 -2 Q-7 -13 -5 -28 Q-3 -30 -1 -29 L-1 4 Z" fill="@peauO" opacity="0.5"/>'
  + '<path d="M3 -27 Q6 -10 4.6 4 L4 30" fill="none" stroke="@peauH" stroke-width="0.8" opacity="0.5"/>';

// ── Jambe — contour UNIQUE face/dos (hanche ±4.5 → cheville −3..4, calage des bottes/jambières).
const JAMBE_CONTOUR = 'M-4.5 0 Q-5 26 -3 50 L4 50 Q5 26 4.5 0 Z';
// Nappe du flanc externe (galbe de la cuisse), partagée face/dos.
const JAMBE_FLANC = '<path d="M-4.5 0 Q-5 26 -3 50 L-1.8 49.6 Q-3.5 26 -3.2 0 Z" fill="@peauO" opacity="0.3"/>';
const jambe = (surface: string) =>
  `<path d="${JAMBE_CONTOUR}" fill="@peau" stroke="@peauO" stroke-width="0.5"/>${JAMBE_FLANC}${surface}`;

const JAMBE_FRONT = jambe(
  // rotule (plaque de genou du canon, 22..30) + rehaut du tibia
  '<path d="M-3.6 22 Q-4.6 25.5 -2.9 28.5 Q1.4 29.4 3.2 25.8 Q3.7 22.4 2 20 Q-0.8 21.4 -3.6 22 Z" fill="@peauH" opacity="0.45"/>'
  + '<path d="M1 31 Q1.6 40 1.2 47.5" fill="none" stroke="@peauH" stroke-width="0.6" opacity="0.4"/>',
);

const JAMBE_BACK = jambe(
  // galbe du mollet + pli arrière du genou + tendon d'Achille
  '<path d="M-2.4 29.5 Q-3.6 34.5 -2.2 39.5 Q0.8 40.6 2.4 36.5 Q2.9 32 1.2 29 Q-0.6 30 -2.4 29.5 Z" fill="@peauH" opacity="0.4"/>'
  + '<path d="M-2.6 25 Q0 26.6 2.8 25" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.6"/>'
  + '<path d="M0.4 42 L0.5 49" stroke="@peauO" stroke-width="0.5" opacity="0.5"/>',
);

// Profil : cuisse pleine, creux arrière du genou (−2.4 à 22), mollet saillant (−4.4 à 33),
// cheville étroite ; l'avant (+x) porte rotule et arête du tibia.
const JAMBE_PROFILE =
  '<path d="M-4 0 Q-3.4 12 -2.4 22 Q-4.3 28 -4.4 33 Q-3.3 42 -2.6 50 L2.9 50 Q3.2 42 3.1 33 Q4.7 27 4.4 22 Q4.9 10 4.3 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>'
  // nappe de l'arrière (ischio → mollet → tendon)
  + '<path d="M-4 0 Q-3.4 12 -2.4 22 Q-4.3 28 -4.4 33 Q-3.3 42 -2.6 50 L-1.5 49.7 Q-2.2 42 -3 33 Q-2.9 28 -1.2 22 Q-2.1 12 -2.7 0 Z" fill="@peauO" opacity="0.35"/>'
  // rehauts : galbe du mollet, arête du tibia
  + '<path d="M-3.4 29 Q-4.6 33 -3.4 38.5" fill="none" stroke="@peauH" stroke-width="0.7" opacity="0.5"/>'
  + '<path d="M2.6 30 Q2.9 40 2.4 47" fill="none" stroke="@peauH" stroke-width="0.5" opacity="0.4"/>'
  // trait : rotule
  + '<path d="M3.4 19.5 Q4.9 22.5 3.5 26" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.55"/>';

export const body: BodyDef = {
  id: 'nu',
  label: 'Corps nu',
  torseFront: TORSE_FRONT,
  torseBack: TORSE_BACK,
  torseProfile: TORSE_PROFILE,
  jambe: { front: JAMBE_FRONT, back: JAMBE_BACK, profile: JAMBE_PROFILE },
};
