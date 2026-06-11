import type { PartArt } from './types';
import { baseSpeciesOf } from '../skeletons';
import { GENERATED_HEADS } from './generated/heads';
import { HAIRSTYLES } from './generated/hairstyles';
// NB : headViews.json (vues profil/dos générées E·7) n'est plus utilisé — l'art généré était
// hardcodé en hex (pas de recoloriage) et déformé. Profil/dos viennent désormais d'un art
// GÉNÉRIQUE en tokens ci-dessous (PROFILE_FACE / BACK_NAPE + PROFILE_HAIR / BACK_HAIR).

// Œil de secours : blanc + iris @yeux + pupille (PAS le gradient monstre g_eye).
// ANCRÉ data-eye comme les têtes générées → remplaçable par le système d'yeux
// (parts/eyes.ts : Vampire rougeoyant, œil de verre…) même sans tête dédiée.
const eye = (cx: number) =>
  `<g data-eye="${cx < 0 ? 'G' : 'D'}" data-ec="${cx} 7"><ellipse cx="${cx}" cy="7" rx="2" ry="1.3" fill="#f3ede1"/><circle cx="${cx}" cy="7" r="1.1" fill="@yeux"/><circle cx="${cx}" cy="7" r="0.6" fill="#140a06"/></g>`;

const VISAGE: Record<string, string[]> = {
  default: [
    `<circle cx="0" cy="7" r="9" fill="@peau"/>${eye(-3)}${eye(3)}`,
    `<circle cx="0" cy="7" r="9" fill="@peauO"/>${eye(-3)}${eye(3)}`,
  ],
};

const CHEVEUX: Record<string, string[]> = {
  'Humain:M': [
    `<path d="M-9 6 Q0 -7 9 6 Q5 -1 0 -1 Q-5 -1 -9 6Z" fill="@cheveux"/>`,
    `<path d="M-9 7 Q-10 -8 0 -8 Q10 -8 9 7 Q4 -2 0 -2 Q-4 -2 -9 7Z" fill="@cheveuxO"/>`,
    `<path d="M-9 6 Q0 -6 9 6 L9 12 Q0 8 -9 12Z" fill="@cheveux"/>`,
  ],
  'Humain:F': [
    `<path d="M-10 4 Q0 -8 10 4 L11 22 Q6 18 5 6 Q0 2 -5 6 Q-6 18 -11 22Z" fill="@cheveux"/>`,
    `<path d="M-10 4 Q0 -9 10 4 L10 16 Q0 10 -10 16Z" fill="@cheveuxH"/>`,
  ],
};

// =========================================================================================
// VUES PROFIL / DOS de la TÊTE — art générique COMMUN (partagé par toutes les espèces),
// 100 % en tokens (@peau/@cheveux…) pour recoloriage correct. La FACE reste l'art détaillé
// par espèce (heads.ts) ; ici on dessine un profil/dos PROPRES qui matchent ses proportions :
// crâne ovale (x±9, y -9..16), yeux à y≈6.6, bouche à y≈12.6. Le profil regarde vers +x.
// =========================================================================================

// Vue de DOS générique : crâne COUVERT de cheveux (@cheveux) — corrige « cheveux invisibles
// de dos » (avant : ovale de peau). La nuque/cou minimale (@peau) vient du visage de dos.
const BACK_HAIR =
  // calotte qui épouse le crâne, descend bas sur la nuque (couvre les oreilles)
  '<path d="M-9.6 6 Q-10.6 -9.5 0 -10 Q10.6 -9.5 9.6 6 Q9.4 11.5 6.4 14 Q0 16 -6.4 14 Q-9.4 11.5 -9.6 6Z" fill="@cheveux"/>' +
  // reflet à gauche (lumière), ombre à droite — volume du crâne
  '<path d="M-9.6 6 Q-10.6 -9.5 0 -10 Q-6.5 -8 -7.9 -1 Q-9 4 -9.6 6Z" fill="@cheveuxH" opacity="0.65"/>' +
  '<path d="M0 -10 Q10.6 -9.5 9.6 6 Q8.6 0 6.8 -3.4 Q3.6 -7.6 0 -8Z" fill="@cheveuxO" opacity="0.7"/>' +
  // raie centrale + mèches (texture)
  '<path d="M0 -9 Q0.4 3 0 14.5" stroke="@cheveuxO" stroke-width="0.6" fill="none" opacity="0.5"/>' +
  '<path d="M-5.5 -3 Q-6 6 -5 13 M5.5 -3 Q6 6 5 13 M-2.6 -5 Q-3 6 -2.6 14 M2.6 -5 Q3 6 2.6 14" stroke="@cheveuxO" stroke-width="0.45" fill="none" opacity="0.45"/>';
// Vue de PROFIL générique : scalp de CÔTÉ qui couvre le crâne (sommet + arrière) et dégage
// le visage (front, nez, bouche) côté +x. Solide (pas une couronne) → plus de crâne nu.
const PROFILE_HAIR =
  // masse principale : du front (+x, y≈-4) par-dessus le crâne (y≈-10) jusqu'à la nuque (-x, y≈13)
  '<path d="M5.5 -4 Q3.6 -10 -2 -10.2 Q-9 -10 -10 0 Q-10.4 7 -8.6 12.5 Q-7 15 -4.4 14.6 ' +
  'Q-6.2 11 -6.6 6 Q-7 -1 -3.6 -4.2 Q-0.4 -6.6 3.4 -5.6 Q5 -5.2 5.5 -4Z" fill="@cheveux"/>' +
  // reflet (haut/avant du crâne) et ombre (arrière)
  '<path d="M5.5 -4 Q3.6 -10 -2 -10.2 Q-6 -10 -8.2 -3.5 Q-5 -8 -1 -7.4 Q3 -7.2 5.5 -4Z" fill="@cheveuxH" opacity="0.55"/>' +
  '<path d="M-10 0 Q-10.4 7 -8.6 12.5 Q-7 15 -4.4 14.6 Q-6.2 11 -6.6 6 Q-7.4 2 -10 0Z" fill="@cheveuxO" opacity="0.6"/>' +
  // mèches (texture, suivent la courbe du crâne)
  '<path d="M2 -8 Q-4 -8 -7 -2 M-1 -9 Q-7 -7 -9 1 M-5 -7 Q-8 0 -7 8" stroke="@cheveuxO" stroke-width="0.45" fill="none" opacity="0.45"/>';
// Nuque/cou vus de dos (le crâne est couvert par les cheveux ci-dessus) — un peu d'oreille.
const BACK_NAPE =
  '<path d="M-3.8 11 Q0 13.4 3.8 11 L3.2 17.5 Q0 19.2 -3.2 17.5Z" fill="@peau"/>' +
  '<path d="M-3.6 12.4 Q0 14 3.6 12.4" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.5"/>';

// VISAGE de PROFIL générique (tokens) : silhouette de côté propre — front, arête du nez, lèvres,
// menton, un œil, une oreille. Remplace l'art headViews profil (hardcodé, déformé). Regarde +x.
const PROFILE_FACE =
  // contour du visage : crâne arrière arrondi (-x) → front (+x) → nez → lèvres → menton → mâchoire
  '<path d="M-8.5 5 Q-9 -2 -1 -2.2 ' + // sommet du crâne
  'Q5 -2 7.2 2.4 ' +                    // front bombé vers l'avant
  'Q8 4 7 5.2 ' +                       // arête au-dessus du nez
  'Q9.2 6.4 8.3 8.2 ' +                 // pointe du nez (saillie +x)
  'Q7.6 9.2 6.4 9.3 ' +                 // base du nez
  'Q7 10.6 5.8 11.4 ' +                 // lèvre supérieure
  'Q6.4 12.6 5.4 13.6 ' +               // menton avancé
  'Q3 16.4 -1 15.6 ' +                  // mâchoire / sous le menton
  'Q-7 14.5 -8.5 5Z" fill="@peau"/>' +
  // joue/tempe en ombre (côté arrière) pour le volume
  '<path d="M-8.5 5 Q-9 -2 -1 -2.2 Q-5 -1.4 -6.4 4 Q-7.4 9.5 -3.4 14.6 Q-7 13.4 -8.5 5Z" fill="@peauO" opacity="0.55"/>' +
  // reflet sur le front/nez (lumière de face)
  '<path d="M2 -1.6 Q6 -1 7.2 2.4 Q8 4 7 5.2 Q5.4 3 2.6 2.2 Q1.4 0 2 -1.6Z" fill="@peauH" opacity="0.5"/>' +
  // sourcil
  '<path d="M2.2 3.6 Q4.6 2.6 6.4 3.8" stroke="@cheveuxO" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
  // œil (de profil : amande, iris vers l'avant)
  '<ellipse cx="3.9" cy="5.9" rx="1.5" ry="1.15" fill="#f3ede1"/>' +
  '<circle cx="4.6" cy="6" r="1" fill="@yeux"/><circle cx="4.7" cy="6.1" r="0.6" fill="#140a06"/>' +
  // narine + bouche + ligne du menton
  '<path d="M7.4 8.4 Q6.6 8.8 6.2 8.2" stroke="@peauO" stroke-width="0.5" fill="none" stroke-linecap="round"/>' +
  '<path d="M5 11.8 Q6 12 6.2 11.4" stroke="#8a4a3a" stroke-width="0.7" fill="none" stroke-linecap="round"/>' +
  // oreille (côté arrière, vers -x)
  '<path d="M-2.6 6.4 Q-4.6 5.6 -4.8 7.8 Q-4.6 9.8 -2.4 9.4 Q-3.4 8 -2.6 6.4Z" fill="@peau" stroke="@peauO" stroke-width="0.45"/>' +
  '<path d="M-3.6 7.2 Q-4 8 -3.4 8.6" stroke="@peauO" stroke-width="0.4" fill="none"/>';

// =========================================================================================
// VUES PROFIL / DOS par COIFFURE. Le PROFILE_HAIR / BACK_HAIR génériques ci-dessus sont courts ;
// une coiffure longue (chignon, queue de cheval, tresses, cheveux lâchés) paraissait courte de
// profil/dos. On dérive ici un profil + dos PAR ARCHÉTYPE de coiffure (déduit du nom), en tokens
// (@cheveux/@cheveuxO/@cheveuxH) → recoloriables. Fallback = PROFILE_HAIR / BACK_HAIR générique.
// Repère : crâne ovale x±9..11, y -10..16 ; le profil regarde vers +x (nuque vers -x).
// =========================================================================================
type HairViews = { profile: string; back: string };

// Calotte de base de PROFIL (sommet + arrière du crâne, dégage le visage +x) — réutilisée.
const SCALP_PROFILE =
  '<path d="M5.5 -4 Q3.6 -10 -2 -10.2 Q-9 -10 -10 0 Q-10.4 7 -8.6 12.5 Q-7 15 -4.4 14.6 ' +
  'Q-6.2 11 -6.6 6 Q-7 -1 -3.6 -4.2 Q-0.4 -6.6 3.4 -5.6 Q5 -5.2 5.5 -4Z" fill="@cheveux"/>' +
  '<path d="M5.5 -4 Q3.6 -10 -2 -10.2 Q-6 -10 -8.2 -3.5 Q-5 -8 -1 -7.4 Q3 -7.2 5.5 -4Z" fill="@cheveuxH" opacity="0.55"/>';
// Calotte de base de DOS (crâne couvert) — réutilisée.
const SCALP_BACK =
  '<path d="M-9.6 6 Q-10.6 -9.5 0 -10 Q10.6 -9.5 9.6 6 Q9.4 11.5 6.4 14 Q0 16 -6.4 14 Q-9.4 11.5 -9.6 6Z" fill="@cheveux"/>' +
  '<path d="M-9.6 6 Q-10.6 -9.5 0 -10 Q-6.5 -8 -7.9 -1 Q-9 4 -9.6 6Z" fill="@cheveuxH" opacity="0.6"/>' +
  '<path d="M0 -10 Q10.6 -9.5 9.6 6 Q8.6 0 6.8 -3.4 Q3.6 -7.6 0 -8Z" fill="@cheveuxO" opacity="0.65"/>';

const HAIR_VIEWS: Record<string, HairViews> = {
  // court / mi-court : la calotte générique suffit largement.
  court: { profile: PROFILE_HAIR, back: BACK_HAIR },
  // dégarni / calvitie : couronne basse (sommet nu), tempes/nuque seulement.
  chauve: {
    profile:
      '<path d="M-10 2 Q-10.4 8 -8.6 13 Q-7 15 -4.4 14.6 Q-6.2 11 -6.6 6 Q-7 1 -6 -2 Q-8 -1 -10 2Z" fill="@cheveux"/>' +
      '<path d="M-6 -2 Q-3.4 -4 -0.2 -3.6 Q-4 -3 -6 -0.4Z" fill="@cheveuxO" opacity="0.7"/>',
    back:
      '<path d="M-9.6 6 Q-10 -1 -7.4 -3 Q-3 -5 0 -5 Q3 -5 7.4 -3 Q10 -1 9.6 6 Q9.4 11.5 6.4 14 Q0 16 -6.4 14 Q-9.4 11.5 -9.6 6Z" fill="@cheveux"/>' +
      '<path d="M-9.6 6 Q-10 -1 -7.4 -3 Q-5 -4 -2 -4 Q-6 -2 -7.4 2 Q-8.6 4 -9.6 6Z" fill="@cheveuxH" opacity="0.55"/>',
  },
  // mi-long en arrière / cheveux lâchés : la masse descend bas dans le dos et le long de la nuque.
  milong: {
    profile:
      SCALP_PROFILE +
      '<path d="M-10 0 Q-11 8 -9.6 16 Q-8.6 21 -6.6 21 Q-7.6 14 -7 6 Q-7.2 1 -10 0Z" fill="@cheveux"/>' +
      '<path d="M-10 0 Q-11 8 -9.6 16 Q-10.4 9 -9.4 2Z" fill="@cheveuxO" opacity="0.6"/>',
    back:
      SCALP_BACK +
      '<path d="M-9.6 6 Q-10.4 13 -9 20 Q-7.8 22 -6.6 21 Q-7.4 14 -7 8Z M9.6 6 Q10.4 13 9 20 Q7.8 22 6.6 21 Q7.4 14 7 8Z" fill="@cheveux"/>' +
      '<path d="M-6.6 12 Q0 14 6.6 12 L6 20 Q0 22 -6 20Z" fill="@cheveux"/>' +
      '<path d="M0 8 Q0.4 15 0 21" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.5"/>',
  },
  // longs cheveux lâchés : nappe qui tombe bas (épaules) devant la nuque et le long du flanc.
  long: {
    profile:
      SCALP_PROFILE +
      '<path d="M-10 -2 Q-12 10 -10.5 24 Q-9.5 30 -7 30 Q-8.5 18 -8 6 Q-8 -1 -10 -2Z" fill="@cheveux"/>' +
      '<path d="M-10 -2 Q-12 10 -10.5 24 Q-11.5 12 -10 0Z" fill="@cheveuxO" opacity="0.6"/>' +
      '<path d="M-7 6 Q-6.6 18 -7.4 29" stroke="@cheveuxH" stroke-width="0.5" fill="none" opacity="0.5"/>',
    back:
      SCALP_BACK +
      '<path d="M-9.6 4 Q-11.5 14 -10 28 Q-8.8 31 -7.4 30 Q-8 20 -7.4 9Z M9.6 4 Q11.5 14 10 28 Q8.8 31 7.4 30 Q8 20 7.4 9Z" fill="@cheveux"/>' +
      '<path d="M-7.4 9 Q0 12 7.4 9 L7 28 Q0 31 -7 28Z" fill="@cheveux"/>' +
      '<path d="M-9.6 4 Q-11.5 14 -10 28 Q-10.6 16 -9.2 5Z" fill="@cheveuxH" opacity="0.5"/>' +
      '<path d="M-4 10 Q-3.6 20 -4.2 29 M4 10 Q3.6 20 4.2 29 M0 11 Q0 20 0 30" stroke="@cheveuxO" stroke-width="0.45" fill="none" opacity="0.45"/>',
  },
  // queue de cheval HAUTE : crâne tiré, queue qui jaillit en arrière-haut (-x, vers le haut).
  queueHaute: {
    profile:
      '<path d="M5.5 -4 Q3.6 -10 -2 -10.4 Q-8 -10 -9 -2 Q-9.4 5 -8 11 Q-6.6 8 -6.6 2 Q-6.4 -3 -2 -5.4 Q1.4 -7 4.4 -6 Q5.2 -5.4 5.5 -4Z" fill="@cheveux"/>' +
      '<path d="M5.5 -4 Q3.6 -10 -2 -10.4 Q-6 -10 -8 -4 Q-4 -8 0 -7.4 Q3.4 -7.2 5.5 -4Z" fill="@cheveuxH" opacity="0.55"/>' +
      // la queue : part de l'arrière du crâne (-7,-7) vers le haut-arrière (-16,-22), effilée
      '<path d="M-6 -7 Q-12 -10 -15 -16 Q-17 -21 -15.5 -24 Q-14 -26 -12 -25 Q-14 -22 -13 -18 Q-11 -13 -7 -9 Q-5.6 -7.8 -6 -7Z" fill="@cheveux"/>' +
      '<path d="M-15 -16 Q-17 -21 -15.5 -24 Q-14.5 -20 -13 -17Z" fill="@cheveuxO" opacity="0.7"/>' +
      '<ellipse cx="-6.4" cy="-7.4" rx="2.4" ry="1.8" fill="@cheveux"/>',
    back:
      SCALP_BACK +
      // queue centrale qui pend bas dans le dos
      '<path d="M-2.4 -2 Q-3 8 -1.6 18 Q-1 24 0 26 Q1 24 1.6 18 Q3 8 2.4 -2 Q0 -3.4 -2.4 -2Z" fill="@cheveux"/>' +
      '<path d="M-1 0 Q-1.4 9 -0.6 18 Q0 9 0.4 0Z" fill="@cheveuxH" opacity="0.7"/>' +
      '<ellipse cx="0" cy="-3" rx="3" ry="2.2" fill="@cheveux"/><ellipse cx="0" cy="-3" rx="3" ry="2.2" fill="none" stroke="@cheveuxO" stroke-width="0.4"/>',
  },
  // queue de cheval BASSE : nuque + queue qui pend bas dans le dos depuis la base du crâne.
  queueBasse: {
    profile:
      SCALP_PROFILE +
      '<path d="M-8.6 8 Q-10 16 -9 24 Q-8 26 -6.6 25 Q-7.6 17 -6.8 9Z" fill="@cheveux"/>' +
      '<path d="M-8.6 8 Q-10 16 -9 24 Q-9.6 16 -8.4 9Z" fill="@cheveuxO" opacity="0.6"/>',
    back:
      SCALP_BACK +
      '<path d="M-2.2 8 Q-2.8 16 -1.4 24 Q-0.8 28 0 30 Q0.8 28 1.4 24 Q2.8 16 2.2 8 Q0 7 -2.2 8Z" fill="@cheveux"/>' +
      '<path d="M-0.8 9 Q-1.2 17 -0.4 25 Q0.4 17 0.8 9Z" fill="@cheveuxH" opacity="0.65"/>',
  },
  // chignon / knot : crâne tiré + nœud rond au sommet-arrière.
  chignon: {
    profile:
      '<path d="M5.5 -4 Q3.6 -10 -2 -10.4 Q-8 -10 -9 -2 Q-9.4 5 -8 11 Q-6.6 8 -6.6 2 Q-6.4 -4 -2 -6 Q1.6 -7.4 4.4 -6 Q5.2 -5.4 5.5 -4Z" fill="@cheveux"/>' +
      '<path d="M5.5 -4 Q3.6 -10 -2 -10.4 Q-6 -10 -8 -4 Q-4 -8 0 -7.6 Q3.4 -7.4 5.5 -4Z" fill="@cheveuxH" opacity="0.55"/>' +
      '<ellipse cx="-6" cy="-9" rx="3.4" ry="3" fill="@cheveux"/><ellipse cx="-6" cy="-9" rx="3.4" ry="3" fill="none" stroke="@cheveuxO" stroke-width="0.4"/>' +
      '<path d="M-8 -10 Q-6 -12 -3.6 -10.6 Q-6 -10 -7.6 -8Z" fill="@cheveuxH" opacity="0.8"/>',
    back:
      SCALP_BACK +
      '<ellipse cx="0" cy="-9.5" rx="4" ry="3.2" fill="@cheveux"/><ellipse cx="0" cy="-9.5" rx="4" ry="3.2" fill="none" stroke="@cheveuxO" stroke-width="0.4"/>' +
      '<path d="M-3 -11 Q0 -13 3 -11 Q0 -10.2 -3 -11Z" fill="@cheveuxH" opacity="0.8"/>',
  },
  // deux tresses encadrant le visage : tresses qui pendent bas, de chaque côté de la nuque.
  tresses: {
    profile:
      SCALP_PROFILE +
      // une tresse devant l'épaule (côté +x, qui encadre le visage) et une derrière (-x)
      '<path d="M6 2 Q8 6 7 12 Q8 16 6.6 20 Q7.6 16 6.2 13 Q7.4 9 6 5Z" fill="@cheveux"/>' +
      '<path d="M-8 6 Q-10 11 -9 17 Q-10 21 -8.4 25 Q-7.4 21 -8.4 18 Q-7 14 -7.2 8Z" fill="@cheveux"/>' +
      '<path d="M-8 6 Q-10 11 -9 17 Q-9.8 12 -8 8Z" fill="@cheveuxO" opacity="0.6"/>',
    back:
      SCALP_BACK +
      '<g fill="@cheveux"><path d="M-9 4 Q-11 8 -10 13 Q-11 17 -9.4 21 Q-8.4 17 -9.4 14 Q-8 10 -8.2 5Z"/><path d="M9 4 Q11 8 10 13 Q11 17 9.4 21 Q8.4 17 9.4 14 Q8 10 8.2 5Z"/></g>' +
      '<g fill="@cheveuxH" opacity="0.6"><path d="M-9 6 Q-10.4 9 -9.6 12 Q-8.6 9.4 -9 6Z"/><path d="M9 6 Q10.4 9 9.6 12 Q8.6 9.4 9 6Z"/></g>',
  },
  // bob / carré : masse mi-courte qui rentre vers la mâchoire (déjà ~OK générique mais un peu plus pleine).
  bob: {
    profile:
      '<path d="M6 -3 Q4 -10 -2 -10.4 Q-9 -10 -10 0 Q-10.6 7 -9 13 Q-7.4 16 -5.2 15.6 Q-7 12 -7 7 Q-7 0 -3.4 -3.8 Q-0.2 -6.2 4 -5.2 Q5.6 -4.6 6 -3Z" fill="@cheveux"/>' +
      '<path d="M6 -3 Q4 -10 -2 -10.4 Q-6 -10 -8.2 -3.5 Q-5 -8 -1 -7.4 Q3 -7.2 6 -3Z" fill="@cheveuxH" opacity="0.55"/>' +
      '<path d="M-9 13 Q-7.4 16 -5.2 15.6 Q-6.4 13.4 -6.4 10Z" fill="@cheveuxO" opacity="0.6"/>',
    back:
      '<path d="M-10 6 Q-11 -9.5 0 -10 Q11 -9.5 10 6 Q10.4 11 9.4 15 Q8 17 6 16.4 Q7 13 6.8 9 Q0 16 -6.8 9 Q-7 13 -6 16.4 Q-8 17 -9.4 15 Q-10.4 11 -10 6Z" fill="@cheveux"/>' +
      '<path d="M-10 6 Q-11 -9.5 0 -10 Q-6.5 -8 -7.9 -1 Q-9 4 -10 6Z" fill="@cheveuxH" opacity="0.6"/>' +
      '<path d="M0 -9 Q0.4 3 0 9" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.5"/>',
  },
  // bouclés volumineux : masse bombée, gros volume sur les côtés et au-dessus.
  boucles: {
    profile:
      '<path d="M7 -4 Q6 -12 -2 -12.4 Q-11 -12 -12 -1 Q-13 7 -10.5 15 Q-8.8 18 -6 17.4 Q-8 13 -7.6 6 Q-7.6 -2 -3.4 -5.2 Q0.2 -7.6 4.6 -6.4 Q6.4 -5.8 7 -4Z" fill="@cheveux"/>' +
      '<g fill="@cheveuxH" opacity="0.55"><circle cx="-2" cy="-10" r="2.6"/><circle cx="-8" cy="-5" r="2.6"/><circle cx="5" cy="-5" r="2.2"/></g>' +
      '<g fill="@cheveuxO" opacity="0.5"><circle cx="-10" cy="3" r="2.4"/><circle cx="-9" cy="11" r="2.2"/></g>',
    back:
      '<path d="M-11 6 Q-13 -10 0 -11 Q13 -10 11 6 Q11.5 12 9.5 17 Q8 19 6 18 Q0 15 -6 18 Q-8 19 -9.5 17 Q-11.5 12 -11 6Z" fill="@cheveux"/>' +
      '<g fill="@cheveuxH" opacity="0.55"><circle cx="-6" cy="-8" r="3"/><circle cx="2" cy="-9" r="3"/><circle cx="8" cy="-3" r="2.6"/><circle cx="-9" cy="-2" r="2.6"/></g>' +
      '<g fill="@cheveuxO" opacity="0.5"><circle cx="-8" cy="9" r="2.6"/><circle cx="8" cy="9" r="2.6"/><circle cx="0" cy="12" r="2.6"/></g>',
  },
};

/** Archétype de coiffure déduit du NOM (pour choisir le profil/dos adéquat). */
function hairArchetype(name: string): string {
  const n = name.toLowerCase();
  if (/calvitie|dégarni|degarni|chauve/.test(n)) return 'chauve';
  if (/chignon/.test(n)) return 'chignon';
  if (/tresse/.test(n)) return 'tresses';
  if (/queue/.test(n)) return /haute/.test(n) ? 'queueHaute' : 'queueBasse';
  if (/bouclé|boucle|bouclés/.test(n)) return 'boucles';
  if (/\bbob\b|carré|carre/.test(n)) return 'bob';
  if (/longs? cheveux|cheveux lâchés|laches|tombant/.test(n)) return 'long';
  if (/mi-longs?|mi long|en arrière|en arriere|ondulé|ondule/.test(n)) return 'milong';
  return 'court';
}

function pick(table: Record<string, string[]>, key: string, fallbackKey: string, idx: number): string {
  const arr = table[key] ?? table[fallbackKey] ?? Object.values(table)[0];
  return arr[idx >= 0 && idx < arr.length ? idx : 0];
}

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}.
 *  Priorité à l'art généré par espèce (dessiné depuis le LDB) ; sinon tables de secours.
 *  CHEVEUX : choix dans [défaut espèce, ...pool de coiffures partagé] via idx (parts/seed). */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): PartArt {
  const base = baseSpeciesOf(species);
  const key = `${base}:${sex}`;
  const gen = GENERATED_HEADS[key];
  if (slot === 'cheveux') {
    // Pool aligné avec les NOMS : [défaut espèce, ...HAIRSTYLES[sex]]. Le nom donne l'archétype
    // de coiffure → profil/dos dédié (chignon/queue/tresses/long… ne paraissent plus courts).
    const styled = (HAIRSTYLES[sex] ?? []).filter((h) => h.svg != null);
    const entries: { svg: string; name: string }[] = [
      ...(gen?.cheveux != null ? [{ svg: gen.cheveux, name: 'court' }] : []),
      ...styled.map((h) => ({ svg: h.svg, name: h.name })),
    ];
    if (entries.length) {
      const i = ((idx % entries.length) + entries.length) % entries.length;
      const v = HAIR_VIEWS[hairArchetype(entries[i].name)] ?? { profile: PROFILE_HAIR, back: BACK_HAIR };
      return { front: entries[i].svg, back: v.back, profile: v.profile };
    }
    return { front: pick(CHEVEUX, key, 'Humain:M', idx), back: BACK_HAIR, profile: PROFILE_HAIR };
  }
  if (gen?.visage != null) {
    // Visage de DOS = nuque seule (le crâne est couvert par les cheveux) ; PROFIL = silhouette
    // de côté générique en tokens (propre + recoloriable), commune à toutes les espèces.
    return { front: gen.visage, back: BACK_NAPE, profile: PROFILE_FACE };
  }
  // Secours (espèce sans tête générée, ex. Ogre) : nuque de dos, profil générique.
  return { front: pick(VISAGE, key, 'default', idx), back: BACK_NAPE, profile: PROFILE_FACE };
}
