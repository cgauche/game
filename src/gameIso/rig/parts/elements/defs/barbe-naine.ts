import type { AppearanceElement } from '../types';

// Grande barbe nourrie ancrée à la mâchoire (Nain) — couleur @cheveux.
// Vues ÉCLATÉES (#428 volet art) : l'art de FACE ne se plaque plus sur les 3 vues.
// - face : masse frontale d'origine (moustache + tombée sur le torse) ;
// - profil : masse SOUS le menton, gonflée vers l'AVANT (+x), moustache sur la joue —
//   cohérente avec le visage de profil de cosmetic.ts (menton ≈ (5.4,13.6), regarde +x) ;
// - dos : rien (la barbe pousse devant, le crâne/la chevelure l'occultent de dos).
const FACE =
  '<g>'
  + '<path d="M-9 8 Q-12 24 -5 32 Q0 35 5 32 Q12 24 9 8 Q5 13 0 13 Q-5 13 -9 8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>'
  + '<path d="M-5 15 Q0 18 5 15" fill="none" stroke="@cheveuxO" stroke-width="0.7"/>'
  + '<path d="M-3 18 L-3 30 M3 18 L3 30" stroke="@cheveuxO" stroke-width="0.6" opacity="0.7"/>'
  + '</g>';

const PROFIL =
  '<g>'
  // masse principale : naît au bas de la joue/mâchoire, gonfle sous le menton vers l'avant
  + '<path d="M-5 11 Q-7.5 19 -4 26.5 Q-0.5 32.5 4.5 30.5 Q9.5 28 9.8 20 Q10 14.5 7.6 11.6 Q6.6 13.6 3.5 14.4 Q-1.5 15.6 -5 11 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>'
  // moustache : couvre lèvres/menton depuis la joue (le visage de face cache aussi la bouche)
  + '<path d="M2.6 10.6 Q6.4 9.8 8.6 11.4 Q8.2 13.4 6 13.6 Q3.6 13.8 2.2 12.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>'
  // stries de flot (la barbe coule vers l'avant-bas) + reflet haut
  + '<path d="M-3 16 Q-3.6 22 -0.8 27.5 M2 15.5 Q2.4 21.5 4.6 26.8" stroke="@cheveuxO" stroke-width="0.6" fill="none" opacity="0.7"/>'
  + '<path d="M5.8 13.6 Q8.4 16.2 8.8 20.4" stroke="@cheveuxH" stroke-width="0.6" fill="none" opacity="0.6"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'barbe-naine', label: 'Barbe naine', category: 'trait',
  overlays: [
    { bone: 'tete', svg: FACE, scale: 'bone', layer: 10, view: 'front' },
    { bone: 'tete', svg: PROFIL, scale: 'bone', layer: 10, view: 'profile' },
  ],
};
