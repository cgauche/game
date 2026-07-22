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

// ── Torse — contour UNIQUE face/dos : épaules ±13 à −28 (coins arrondis), TAILLE creusée ±9.3
//    vers y≈8, HANCHES au point le plus large ±12.4 vers y≈22.5, puis les côtés descendent
//    presque droit (±7 à y≈32) jusqu'à un bas d'ENTREJAMBE discret RENTRÉ dans le gabarit du
//    bassin : encoche d'AINE en V léger et peu profond au centre (±2 à y≈33, notch +0 à y≈32.4)
//    — plus de lobe/goutte pendante, plus de pointe basse à y35, plus de dalle/jupe.
const TORSE_CONTOUR =
  'M-13 -28 Q0 -33 13 -28 C13 -16 10.4 -4 9.3 8 C8.8 15 12.2 18.5 12.4 22.5 C12.5 27 10.8 30.5 7 32.2 Q4.5 33.2 2 33.2 Q1 32.4 0 32.4 Q-1 32.4 -2 33.2 Q-4.5 33.2 -7 32.2 C-10.8 30.5 -12.5 27 -12.4 22.5 C-12.2 18.5 -8.8 15 -9.3 8 C-10.4 -4 -13 -16 -13 -28 Z';
// Nappe d'ombre des flancs (le galbe du buste, taille creusée → hanche → descente d'aine) — partagée face/dos.
const TORSE_FLANCS =
  '<path d="M-13 -28 C-13 -16 -10.4 -4 -9.3 8 C-8.8 15 -12.2 18.5 -12.4 22.5 C-12.5 27 -10.8 30.5 -7 32.2 L-6.4 30.8 C-9 29.5 -10.6 26.5 -10.6 22.7 C-10.5 18.8 -7.4 15.5 -7.6 8.5 C-8.6 -4 -11.2 -16 -11 -26.5 Z" fill="@peauO" opacity="0.3"/>'
  + '<path d="M13 -28 C13 -16 10.4 -4 9.3 8 C8.8 15 12.2 18.5 12.4 22.5 C12.5 27 10.8 30.5 7 32.2 L6.4 30.8 C9 29.5 10.6 26.5 10.6 22.7 C10.5 18.8 7.4 15.5 7.6 8.5 C8.6 -4 11.2 -16 11 -26.5 Z" fill="@peauO" opacity="0.3"/>';
const torse = (surface: string) =>
  `<path d="${TORSE_CONTOUR}" fill="@peau" stroke="@peauO" stroke-width="0.6"/>${TORSE_FLANCS}${surface}`;

const TORSE_FRONT = torse(
  // rehaut de carrure (haut de poitrine)
  '<path d="M-11.6 -26 Q0 -30 11.6 -26 L11.8 -21 Q0 -25 -11.8 -21 Z" fill="@peauH" opacity="0.35"/>'
  // traits : sillon des pectoraux, ligne médiane, nombril
  + '<path d="M-10.4 -19.5 Q-5.2 -15.8 -0.8 -18.8 M10.4 -19.5 Q5.2 -15.8 0.8 -18.8" fill="none" stroke="@peauO" stroke-width="0.6" opacity="0.6"/>'
  + '<path d="M0 -15.5 L0 12" stroke="@peauO" stroke-width="0.6" opacity="0.4"/>'
  + '<ellipse cx="0" cy="13.5" rx="1" ry="1.3" fill="@peauO" opacity="0.6"/>'
  // plis inguinaux : léger V (aine) séparant tronc et cuisses, sans marche
  + '<path d="M-8 26.5 Q-4.4 30 -1.2 32.2 M8 26.5 Q4.4 30 1.2 32.2" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.45"/>',
);

const TORSE_BACK = torse(
  // creux lombaire (nappe, petit du dos) — avant les rehauts, s'arrête au-dessus du fessier
  '<path d="M-3 13 Q0 14.4 3 13 L2.3 22 Q0 23 -2.3 22 Z" fill="@peauO" opacity="0.3"/>'
  // FESSIER : nappe d'ombre sous les fesses (sillon sous-fessier) — bornée DANS le contour partagé
  + '<path d="M-6.5 29 Q-3.5 31 0 30.8 Q3.5 31 6.5 29 Q4.5 31.8 0 31.6 Q-4.5 31.8 -6.5 29 Z" fill="@peauO" opacity="0.32"/>'
  // FESSIER : deux masses glutéales arrondies (rehaut galbé, pas de bloc)
  + '<path d="M-1.4 24.5 Q-6 22.6 -9.2 25.4 Q-10 29.4 -7 31.6 Q-3.2 32.4 -1.4 29 Q-0.6 26.6 -1.4 24.5 Z" fill="@peauH" opacity="0.36"/>'
  + '<path d="M1.4 24.5 Q6 22.6 9.2 25.4 Q10 29.4 7 31.6 Q3.2 32.4 1.4 29 Q0.6 26.6 1.4 24.5 Z" fill="@peauH" opacity="0.36"/>'
  // rehauts d'épaules ARRONDIS : yoke de carrure (coins courbes, plus de rectangle)
  + '<path d="M-11.4 -24.5 Q0 -27.6 11.4 -24.5 Q12.6 -22 10.4 -19.6 Q0 -22.2 -10.4 -19.6 Q-12.6 -22 -11.4 -24.5 Z" fill="@peauH" opacity="0.4"/>'
  // omoplates : galbe ovale (plus de triangle à angle marqué)
  + '<path d="M-9.6 -17.2 Q-4.6 -15 -2.8 -16.6 Q-4 -11.4 -7.6 -12 Q-9.9 -14.2 -9.6 -17.2 Z" fill="@peauH" opacity="0.3"/>'
  + '<path d="M9.6 -17.2 Q4.6 -15 2.8 -16.6 Q4 -11.4 7.6 -12 Q9.9 -14.2 9.6 -17.2 Z" fill="@peauH" opacity="0.3"/>'
  // trait : colonne (se prolonge en SILLON inter-fessier au bas)
  + '<path d="M0 -26.5 L0 24" stroke="@peauO" stroke-width="0.7" opacity="0.55"/>'
  + '<path d="M0 24 L0 32.4" stroke="@peauO" stroke-width="0.9" opacity="0.6"/>',
);

// Profil : buste avancé +x, dos ombré — même bande de hauteurs que face/dos (col −28, ourlet 33..37).
// Taille creusée (front ~+5.6 / dos ~-5 à y≈4) ; bas-VENTRE avant PLAT et vertical (~+5.4→+4.6, plus
// de saillie « couche »), léger creux inguinal, et FESSIER arrondi à l'ARRIÈRE (−7.4 vers y≈27).
const TORSE_PROFILE =
  '<path d="M-5 -28 Q3 -31 7 -26 Q8 -10 5.6 4 Q5.4 16 5.4 26 Q5.2 30 4.6 33 Q0 37 -6 33 Q-7.4 27 -6 15 Q-5 4 -5.4 -6 Q-7 -16 -5 -28 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-5.4 -6 Q-7 -16 -5 -28 Q-3 -30 -1 -29 L-1 6 Z" fill="@peauO" opacity="0.5"/>'
  // galbe arrondi de la fesse (rehaut arrière)
  + '<path d="M-6.4 17 Q-8 23 -6.2 30" fill="none" stroke="@peauH" stroke-width="0.7" opacity="0.45"/>'
  // arête avant du buste (aplatie au bas-ventre) + léger creux inguinal
  + '<path d="M3 -27 Q6 -10 5 4 Q5 18 4.8 31" fill="none" stroke="@peauH" stroke-width="0.8" opacity="0.5"/>'
  + '<path d="M4.9 26 Q3.6 29.5 3.4 32" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.4"/>';

// ── Jambe — contour UNIQUE face/dos. Sommet ARRONDI et rentré (±3 à y≈0, la cuisse émerge de SOUS
//    le bassin, sous l'ourlet du torse à ±12.5 monde) → s'ouvre à ±4.5 vers y≈13 → genou → cheville −4..4.
const JAMBE_CONTOUR =
  'M-3 0.5 Q0 -0.8 3 0.5 C3.4 4 4.5 8 4.5 13 Q5 26 4 50 L-4 50 Q-5 26 -4.5 13 C-4.5 8 -3.4 4 -3 0.5 Z';
// Nappe du flanc externe (galbe de la cuisse, sommet rentré), partagée face/dos.
const JAMBE_FLANC =
  '<path d="M-3 0.5 C-3.4 4 -4.5 8 -4.5 13 Q-5 26 -4 50 L-2.3 49.6 Q-3.4 26 -3 13 C-3 8 -2 4 -1.8 1 Z" fill="@peauO" opacity="0.3"/>';
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
  '<path d="M-3.4 0.6 Q-3 12 -2.4 22 Q-4.3 28 -4.4 33 Q-3.3 42 -2.6 50 L2.9 50 Q3.2 42 3.1 33 Q4.7 27 4.4 22 Q4.6 10 3.8 0.6 Q0 -0.9 -3.4 0.6 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>'
  // nappe de l'arrière (ischio → mollet → tendon)
  + '<path d="M-3.4 0.6 Q-3 12 -2.4 22 Q-4.3 28 -4.4 33 Q-3.3 42 -2.6 50 L-1.5 49.7 Q-2.2 42 -3 33 Q-2.9 28 -1.2 22 Q-2.1 12 -2.7 0.6 Z" fill="@peauO" opacity="0.35"/>'
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
