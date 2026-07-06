import type { PartArt } from './types';
import { baseSpeciesOf } from '../skeletons';
import { HEADS_BY_KEY } from './heads';
import { hairstylesForSex } from './hairstyles';
// Têtes (visage + coiffure défaut) en heads/defs, coiffures en hairstyles/defs (3 vues bakées).
// Le profil/dos du VISAGE reste un art GÉNÉRIQUE token ci-dessous (PROFILE_FACE / BACK_NAPE).

// Œil de secours : blanc + iris @yeux + pupille (PAS le gradient monstre g_eye).
// ANCRÉ data-eye comme les têtes générées → remplaçable par le système d'yeux
// (parts/eyes.ts : Vampire rougeoyant, œil de verre…) même sans tête dédiée.
const eye = (cx: number) =>
  `<g data-eye="${cx < 0 ? 'G' : 'D'}" data-ec="${cx} 7"><ellipse cx="${cx}" cy="7" rx="2" ry="1.3" fill="#f3ede1"/><circle cx="${cx}" cy="7" r="1.1" fill="@yeux"/><circle cx="${cx}" cy="7" r="0.6" fill="#140a06"/></g>`;

// Visage de REPLI (espèce sans tête dédiée en heads/defs, ex. Ogre) : crâne @peau + yeux ancrés.
const DEFAULT_VISAGE: string[] = [
  `<circle cx="0" cy="7" r="9" fill="@peau"/>${eye(-3)}${eye(3)}`,
  `<circle cx="0" cy="7" r="9" fill="@peauO"/>${eye(-3)}${eye(3)}`,
];

// =========================================================================================
// VUES PROFIL / DOS de la TÊTE — art générique COMMUN (partagé par toutes les espèces),
// 100 % en tokens (@peau/@cheveux…) pour recoloriage correct. La FACE reste l'art détaillé
// par espèce (heads/defs) ; ici on dessine un profil/dos PROPRES qui matchent ses proportions :
// crâne ovale (x±9, y -9..16), yeux à y≈6.6, bouche à y≈12.6. Le profil regarde vers +x.
// =========================================================================================

// Vue de DOS générique : crâne COUVERT de cheveux (@cheveux) — évite les « cheveux invisibles
// de dos ». La nuque/cou minimale (@peau) vient du visage de dos.
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

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}.
 *  Priorité à la tête dédiée (heads/defs, art LDB) ; sinon visage de repli générique.
 *  CHEVEUX : choix dans [défaut de tête, ...pool de coiffures partagé (hairstyles/defs)] via idx. */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): PartArt {
  const head = HEADS_BY_KEY[`${baseSpeciesOf(species)}:${sex}`];
  if (slot === 'cheveux') {
    // Pool = [défaut de tête (archétype 'court' → profil/dos GÉNÉRIQUES), ...coiffures du sexe
    // (chacune porte ses propres profil/dos bakés)]. L'idx (pins.cheveux / seed) choisit.
    const entries: { front: string; profile: string; back: string }[] = [
      ...(head?.cheveux != null ? [{ front: head.cheveux, profile: PROFILE_HAIR, back: BACK_HAIR }] : []),
      ...hairstylesForSex(sex).map((h) => ({ front: h.front, profile: h.profile, back: h.back })),
    ];
    if (!entries.length) return { front: '', back: BACK_HAIR, profile: PROFILE_HAIR };
    const e = entries[((idx % entries.length) + entries.length) % entries.length];
    return { front: e.front, back: e.back, profile: e.profile };
  }
  // Visage : art de tête dédié (dos = nuque, profil = silhouette générique commune à toutes les
  // espèces), sinon repli générique (espèce sans tête, ex. Ogre).
  const visage = head?.visage ?? DEFAULT_VISAGE[idx >= 0 && idx < DEFAULT_VISAGE.length ? idx : 0];
  return { front: visage, back: BACK_NAPE, profile: PROFILE_FACE };
}
