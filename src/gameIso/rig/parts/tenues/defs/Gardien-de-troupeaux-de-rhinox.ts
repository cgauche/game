import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

// Gardien de troupeaux de rhinox (ADE II 02 l.904-950) — pâtre OGRE des Montagnes des Larmes.
// Illustration art-ref/ade2-carrieres/page038_img4 : casque d'acier teal à nasal et couvre-joues,
// haut CRIN ROUGE en queue de cheval ; épais COL de fourrure de rhinox (brun hirsute) ; plastron
// d'acier sur la poitrine par-dessus une tunique olive ; grande PANSIÈRE en CRÂNE DE RHINOX (os
// pâle craquelé, orbites creuses, nasal, moignons de cornes — « pansière avec un crâne de rhinox »,
// l.940) sur l'énorme panse ; avant-bras en canons d'acier lamellés ; jambières et sabatons d'acier ;
// cape de cuir dans le dos. Porté sur le CORPS D'OGRE (panse = silhouette du torse). Distinct de la
// tenue 'Ogre' générique (plaque-bedaine métal nue, épaulières de cuir, tête nue).
export const tenue: TenueDef = {
  label: 'Gardien de troupeaux de rhinox',
  id: "gardien-de-troupeaux-de-rhinox",
  palette: {
    metal: '#5f6c68', metalO: '#2b3532', metalH: '#8f9d97',
    crin: '#b23a2b', crinO: '#6e1f16', crinH: '#d05a44',
    fourrure: '#493726', fourrureO: '#281c11', fourrureH: '#6b5238',
    os: '#cdc6b0', osO: '#948b70', osH: '#e9e3d0',
    vet1: '#586138', vet1O: '#363e20', vet1H: '#79844f',
    cuir: '#59401f', cuirO: '#301f0e', cuirH: '#7c5a34',
  },
  set: {
    pied: BOTTE_CUIR,
    torse: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L11 34 Q0 38 -11 34 L-12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-12.4 -21 Q0 -25 12.4 -21 L12 6 L11 33 Q0 37 -11 33 L-12 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-8.4 8 Q-8.8 20 -8.2 31 M0 8 L0 33 M8.4 8 Q8.8 20 8.2 31" stroke="@vet1O" stroke-width="0.6" fill="none" opacity="0.5"/>`
        + `<path d="M-6.4 6 Q-6.8 18 -6.4 30 M6.4 6 Q6.8 18 6.4 30" stroke="@vet1H" stroke-width="0.4" fill="none" opacity="0.45"/>`
        + `<path d="M-11 -22 Q0 -26 11 -22 Q12.2 -12 10.6 -2 Q0 1.5 -10.6 -2 Q-12.2 -12 -11 -22 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M-11 -22 Q0 -26 11 -22 Q12.2 -12 10.6 -2 Q0 1.5 -10.6 -2 Q-12.2 -12 -11 -22 Z" fill="@metalO" opacity="0.16" stroke="none"/>`
        + `<path d="M0 -24 Q1.4 -13 0 -0.6" stroke="@metalH" stroke-width="0.7" fill="none" opacity="0.55"/>`
        + `<path d="M-6 -20 Q-6.6 -11 -6 -2.5 M6 -20 Q6.6 -11 6 -2.5" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.3"/>`
        + `<circle cx="-9" cy="-19" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="9" cy="-19" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="-8.4" cy="-4.4" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="8.4" cy="-4.4" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        + `<path d="M-9 -21 L-6 -23 L9 5 L6 7.5 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-7.5 -21.6 L7.4 6" stroke="@cuirH" stroke-width="0.4" fill="none" opacity="0.5"/>`
        + `<path d="M-11 -3 Q0 -7.5 11 -3 L10.6 1 Q0 -3 -10.6 1 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<rect x="-2" y="-4.2" width="4" height="3.4" rx="0.6" fill="@metal" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-10.6 -2 Q0 -7 10.6 -2 Q11.8 11 7.6 23 Q4.2 30.5 0 31.5 Q-4.2 30.5 -7.6 23 Q-11.8 11 -10.6 -2 Z" fill="@os" stroke="@osO" stroke-width="0.9"/>`
        + `<path d="M-9.4 -2 Q0 -6.4 9.4 -2 Q10 5 9 10 Q0 6 -9 10 Q-10 5 -9.4 -2 Z" fill="@osH" opacity="0.3" stroke="none"/>`
        + `<path d="M-8.6 -2.6 Q-12.8 -5 -13.2 -9.6 Q-11.6 -9 -10.4 -6.6 Q-9.2 -4.4 -7.4 -3.2 Z" fill="@os" stroke="@osO" stroke-width="0.6"/>`
        + `<path d="M8.6 -2.6 Q12.8 -5 13.2 -9.6 Q11.6 -9 10.4 -6.6 Q9.2 -4.4 7.4 -3.2 Z" fill="@os" stroke="@osO" stroke-width="0.6"/>`
        + `<path d="M-11.2 -6 Q-12.4 -8 -12.8 -9.4 M11.2 -6 Q12.4 -8 12.8 -9.4" stroke="@osO" stroke-width="0.4" fill="none" opacity="0.7"/>`
        + `<path d="M-8 3.2 Q-5.4 1.8 -3 4 Q-5.2 5.4 -7.6 4.8 Z" fill="#3a3020" opacity="0.72"/>`
        + `<path d="M8 3.2 Q5.4 1.8 3 4 Q5.2 5.4 7.6 4.8 Z" fill="#3a3020" opacity="0.72"/>`
        + `<path d="M-8.6 2 Q-5.2 -0.4 -2.4 2.6 M8.6 2 Q5.2 -0.4 2.4 2.6" stroke="@osO" stroke-width="0.7" fill="none" opacity="0.7"/>`
        + `<path d="M-1.4 6.6 Q0 5.8 1.4 6.6 L1.8 15.6 Q0 18 -1.8 15.6 Z" fill="#3a3020" opacity="0.68"/>`
        + `<path d="M0 7 L0 17" stroke="@osO" stroke-width="0.4" fill="none" opacity="0.5"/>`
        + `<path d="M-3.4 22 Q0 25.4 3.4 22" stroke="@osO" stroke-width="0.6" fill="none" opacity="0.6"/>`
        + `<path d="M-7 10.5 L-4.4 15.5 L-5.4 21 M6.6 9 L4.8 13.5 L5.6 19 M-1.6 20 L-0.6 26" stroke="@osO" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `<path d="M-9 6 L-6.6 11 M8.2 5.6 L6.4 10 M2.6 24 L3.6 28.5 M-8.4 13 L-6.8 17.5" stroke="@osO" stroke-width="0.45" fill="none" opacity="0.5"/>`
        + `<path d="M-13 -19 Q-13.5 -30 0 -31.5 Q13.5 -30 13 -19 Q11.4 -16 10 -18.5 Q8.4 -14.5 6.6 -17.6 Q4.6 -14 2.8 -17.4 Q0.8 -13.6 -1 -17.4 Q-3 -14 -4.8 -17.6 Q-6.6 -14.5 -8.4 -18 Q-10 -15.6 -11.4 -18.4 Q-12.4 -16.6 -13 -19 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.6"/>`
        + `<g stroke="@fourrureO" stroke-width="0.45" fill="none" opacity="0.7"><path d="M-9 -28 Q-9.6 -22 -9 -18.5"/><path d="M-4.5 -30 Q-5 -22 -4.6 -17.6"/><path d="M0 -31 L0 -17.6"/><path d="M4.5 -30 Q5 -22 4.6 -17.6"/><path d="M9 -28 Q9.6 -22 9 -18.5"/></g>`
        + `<g stroke="@fourrureH" stroke-width="0.4" fill="none" opacity="0.55"><path d="M-6.6 -29 Q-7 -22 -6.6 -18"/><path d="M2.2 -30.4 Q2.4 -22 2.2 -17.6"/><path d="M6.6 -29 Q7 -22 6.6 -18.5"/></g>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L11 34 Q0 38 -11 34 L-12 4 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-12.4 -21 Q0 -25 12.4 -21 L12 6 L11 33 Q0 37 -11 33 L-12 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-11.4 -22 Q0 -26 11.4 -22 Q12.4 -8 11 10 Q0 14 -11 10 Q-12.4 -8 -11.4 -22 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M0 -24 L0 12" stroke="@metalO" stroke-width="0.9" fill="none" opacity="0.7"/>`
        + `<path d="M-7 -8 Q0 -5 7 -8" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.45"/>`
        + `<circle cx="-9" cy="-19" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="9" cy="-19" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="-9" cy="6" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/><circle cx="9" cy="6" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        + `<path d="M-10.4 12 Q0 16 10.4 12 L10 33 Q0 37 -10 33 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-6 15 Q-6.4 24 -6 32 M0 15.5 L0 34 M6 15 Q6.4 24 6 32" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M6 -20 Q12 -17 12.6 2 Q13 20 9.4 33 L4.6 33 Q6.6 18 6 2 Q5.6 -10 6 -20 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
        + `<path d="M8.6 -14 Q9.4 2 8.4 22" stroke="@cuirH" stroke-width="0.5" fill="none" opacity="0.5"/><path d="M10.6 -6 Q11 8 9.6 26" stroke="@cuirO" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `<path d="M-13 -19 Q-13.5 -30 0 -31.5 Q13.5 -30 13 -19 Q11.4 -16 10 -18.5 Q8.4 -14.5 6.6 -17.6 Q4.6 -14 2.8 -17.4 Q0.8 -13.6 -1 -17.4 Q-3 -14 -4.8 -17.6 Q-6.6 -14.5 -8.4 -18 Q-10 -15.6 -11.4 -18.4 Q-12.4 -16.6 -13 -19 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.6"/>`
        + `<g stroke="@fourrureO" stroke-width="0.45" fill="none" opacity="0.7"><path d="M-9 -28 Q-9.6 -22 -9 -18.5"/><path d="M-4.5 -30 Q-5 -22 -4.6 -17.6"/><path d="M0 -31 L0 -17.6"/><path d="M4.5 -30 Q5 -22 4.6 -17.6"/><path d="M9 -28 Q9.6 -22 9 -18.5"/></g>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-7 -27 Q2 -31 8 -26 Q10.5 -8 11.5 6 Q12.5 22 7.5 33 Q0 37 -6 33 Q-7 6 -7 -27 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`
        + `<path d="M-6.4 -21 Q2 -25 7.6 -20.5 Q9.6 -6 10.6 6 Q11.4 21 7 32 Q0 36 -5.4 32 Q-6.2 6 -6.4 -21 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-3.4 8 Q-3.6 20 -3.2 31 M3 8 Q3.4 20 3 31" stroke="@vet1O" stroke-width="0.55" fill="none" opacity="0.5"/>`
        + `<path d="M-4 -23 Q3 -26 8 -22 Q9.4 -12 8.6 -2 Q3 0 -4 -2 Q-4.6 -12 -4 -23 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M-4 -23 Q3 -26 8 -22 Q9.4 -12 8.6 -2 Q3 0 -4 -2 Q-4.6 -12 -4 -23 Z" fill="@metalO" opacity="0.16" stroke="none"/>`
        + `<path d="M4.4 -24 Q6 -11 4.6 -1" stroke="@metalH" stroke-width="0.6" fill="none" opacity="0.5"/>`
        + `<circle cx="6" cy="-19" r="0.8" fill="@metalH" stroke="@metalO" stroke-width="0.3"/>`
        + `<path d="M-4 -3 Q3 -7 9.5 -1 Q11.5 13 8 27 Q2 31.5 -3 28.5 Q-4 13 -4 -3 Z" fill="@os" stroke="@osO" stroke-width="0.9"/>`
        + `<path d="M-4 -3 Q3 -7 9.5 -1 Q10.6 7 9.6 13 Q2 8.5 -4 12 Q-4 3 -4 -3 Z" fill="@osH" opacity="0.32" stroke="none"/>`
        + `<path d="M8.4 -1.6 Q11.8 -3.6 12.6 -7.8 Q11 -6.8 9.6 -4.6 Q8.4 -3 7.2 -2 Z" fill="@os" stroke="@osO" stroke-width="0.6"/>`
        + `<path d="M2.4 3.6 Q4.6 2.2 6.8 3.8 Q4.6 5 2.6 4.6 Z" fill="#241d12" opacity="0.88"/>`
        + `<path d="M1.4 2.2 Q4 0.4 7 2.2" stroke="@osO" stroke-width="0.7" fill="none" opacity="0.75"/>`
        + `<path d="M5.8 8 Q7.2 7.4 8.6 8.6 L7.8 15 Q6.8 15.8 5.8 14.6 Z" fill="#241d12" opacity="0.85"/>`
        + `<path d="M0.6 14 L2.4 19 L1.4 24 M6.4 13 L5.4 18 M-1.5 10 L-2 16" stroke="@osO" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `<path d="M-6.8 -3 Q3 -7 9.6 -1.5 L9.3 1.5 Q3 -3.4 -6.6 0.6 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/>`
        + `<path d="M-7 -19 Q-7 -30 3 -31 Q9.5 -30 9.5 -21.5 Q7.8 -18 6.2 -20.6 Q4.2 -16.4 2.2 -19.8 Q0.2 -15.8 -1.8 -19.6 Q-3.8 -16.2 -5.8 -20 Q-6.6 -18 -7 -19 Z" fill="@fourrure" stroke="@fourrureO" stroke-width="0.6"/>`
        + `<g stroke="@fourrureO" stroke-width="0.45" fill="none" opacity="0.7"><path d="M-5 -28 Q-5.4 -22 -5 -18.6"/><path d="M-0.4 -30 Q-0.8 -22 -0.4 -18.4"/><path d="M4.2 -30 Q4.4 -22 4 -18.8"/></g>`
        + `</g>`,
    },
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-3.4 -3 Q0 -4.8 3.4 -3 L3 27 Q0 28.6 -3 27 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
      + `<path d="M-5 -4 Q0 -7 5 -4 Q5.6 1 4.6 6 Q0 8 -4.6 6 Q-5.6 1 -5 -4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-3.4 -3.4 Q0 -5.8 3.4 -3.4 M-3.8 3 Q0 4.6 3.8 3" stroke="@vet1O" stroke-width="0.45" fill="none" opacity="0.5"/>`
      + `<path d="M-3.9 9.5 Q0 8 3.9 9.5 L3.7 13 Q0 14.6 -3.7 13 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.7"/>`
      + `<path d="M-3.7 13 Q0 14.6 3.7 13 L3.6 16.5 Q0 18 -3.6 16.5 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
      + `<path d="M-3.6 16.5 Q0 18 3.6 16.5 L3.6 20 Q0 21.4 -3.6 20 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.6"/>`
      + `<path d="M-3.6 20 Q0 21.4 3.6 20 L3.7 24 Q0 25.4 -3.7 24 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
      + `<path d="M-3.4 9.6 Q0 8.2 3.4 9.6" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.55"/>`
      + `<path d="M-3.7 23.6 Q0 25 3.7 23.6 L3.9 27 Q0 28.4 -3.9 27 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
      + `</g>`,
    jambes: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-4.8 0 Q-5.2 13 -4.7 25 L4.7 25 Q5.2 13 4.8 0 Q0 -1.6 -4.8 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2 1 Q-2.4 13 -2 24 M2 1 Q2.4 13 2 24" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M-4.6 22 Q0 20 4.6 22 Q5.4 26 4.4 30 Q0 32 -4.4 30 Q-5.4 26 -4.6 22 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-3.6 23.4 Q0 21.8 3.6 23.4" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `<path d="M-4.2 29 Q0 31 4.2 29 L4.4 44 L-4.4 44 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M0 30.5 L0 44" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M-2.4 31 L-2.4 43 M2.4 31 L2.4 43" stroke="@metalO" stroke-width="0.4" fill="none" opacity="0.3"/>`
        + `<path d="M-4.5 43 Q0 45 4.5 43 L4.9 50 Q4.7 54 3.2 54.6 L-3.2 54.6 Q-4.7 54 -4.9 50 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-4.7 46.4 Q0 48.4 4.7 46.4" stroke="@metalO" stroke-width="0.6" fill="none" opacity="0.5"/>`
        + `<path d="M-3.2 51.4 Q0 52.8 3.2 51.4" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.4"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-4.8 0 Q-5.2 13 -4.7 25 L4.7 25 Q5.2 13 4.8 0 Q0 -1.6 -4.8 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 1 L0 24" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M-4.4 23 Q0 21.4 4.4 23 Q5.2 26.5 4.2 30 Q0 32 -4.2 30 Q-5.2 26.5 -4.4 23 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M-4.2 29 Q0 31 4.2 29 L4.4 44 L-4.4 44 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M0 30.5 L0 44" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M-4.4 43 Q0 45 4.4 43 L4.6 49 Q4.4 52 3 52.4 L-3 52.4 Q-4.4 52 -4.6 49 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-3 47 L3 47" stroke="@metalO" stroke-width="0.6" fill="none" opacity="0.5"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.6 0 Q-4.4 26 -3 50 L4 50 Q4.6 26 3.8 0 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
        + `<path d="M-3.8 0 Q-4.4 13 -3.7 25 L4 25 Q4.6 13 4 0 Q0 -1.4 -3.8 0 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0.2 1 Q-0.2 13 0.2 24" stroke="@vet1O" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M-3.4 22 Q0.6 20 4.4 22.4 Q5.4 26 4.4 30 Q0.4 32 -3.2 30 Q-4.2 26 -3.4 22 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-2.4 23.4 Q0.6 21.8 4 23.6" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `<path d="M-3 29 Q0.4 31 4 29 L4.2 44 L-3.4 44 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M0.4 30.5 L0.4 44" stroke="@metalH" stroke-width="0.5" fill="none" opacity="0.45"/>`
        + `<path d="M-3.5 43 Q0.6 45 4.3 43 L7 44.6 Q8.8 46 7.6 49.6 L4.8 51 Q0.6 53.4 -3.7 52 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.8"/>`
        + `<path d="M-3.1 46.8 Q1 48.6 4.7 46.8" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.5"/>`
        + `<path d="M4.6 47.4 L7 46.4" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.45"/>`
        + `</g>`,
    },
    tete: {
      front: `<g stroke-linejoin="round">`
        + `<path d="M-2 -12 Q0 -13.6 2 -12 L1.5 -9.4 L-1.5 -9.4 Z" fill="@metal" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-0.6 -12.4 Q-4 -20 -2.6 -27 Q0 -33 5.2 -31 Q8.2 -28 7 -22.6 Q4.4 -16.6 2.4 -12.6 Z" fill="@crin" stroke="@crinO" stroke-width="0.5"/>`
        + `<g stroke="@crinO" stroke-width="0.5" fill="none" opacity="0.7"><path d="M-0.8 -13 Q-3.4 -20 -2 -26"/><path d="M1 -13 Q-0.8 -21 1.4 -28"/><path d="M2.6 -14 Q1.4 -22 4.6 -29.5"/></g>`
        + `<path d="M0.2 -13 Q-1.6 -21 0.6 -28 Q2.4 -31 4.4 -30" stroke="@crinH" stroke-width="0.5" fill="none" opacity="0.6"/>`
        + `<path d="M-10.5 2 Q-11.5 -12 0 -13.6 Q11.5 -12 10.5 2 Q0 -1.6 -10.5 2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M-10.5 2 Q-11.5 -12 0 -13.6 Q11.5 -12 10.5 2 Q0 -1.6 -10.5 2 Z" fill="@metalO" opacity="0.2" stroke="none"/>`
        + `<path d="M0 -13 Q-6 -9 -7 -1 Q-3.4 -3.6 0 -3.6 Q3.4 -3.6 7 -1 Q6 -9 0 -13 Z" fill="@metalH" opacity="0.22" stroke="none"/>`
        + `<path d="M-10.5 0 Q0 -3.6 10.5 0 L10.2 3 Q0 -0.6 -10.2 3 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-1.8 0 Q0 -1 1.8 0 L1.4 9 Q0 10 -1.4 9 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M0 0.6 L0 8.4" stroke="@metalH" stroke-width="0.4" fill="none" opacity="0.5"/>`
        + `<path d="M-10.4 1 Q-11.2 7 -9.4 12 Q-7.4 13.6 -6.4 11 Q-5.4 6 -6 0.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<path d="M10.4 1 Q11.2 7 9.4 12 Q7.4 13.6 6.4 11 Q5.4 6 6 0.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<circle cx="-6.6" cy="-3.4" r="0.6" fill="@metalH"/><circle cx="6.6" cy="-3.4" r="0.6" fill="@metalH"/><circle cx="0" cy="-9" r="0.6" fill="@metalH"/>`
        + `<circle cx="-7.6" cy="8.2" r="0.5" fill="@metalH"/><circle cx="7.6" cy="8.2" r="0.5" fill="@metalH"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-1 -12.4 Q-3.6 -20 -2.2 -27 Q0 -32 4.2 -30.4 Q6.6 -28 5.6 -22.8 Q3.4 -17 1.4 -12.8 Z" fill="@crin" stroke="@crinO" stroke-width="0.5"/>`
        + `<g stroke="@crinO" stroke-width="0.5" fill="none" opacity="0.7"><path d="M-1.4 -13 Q-2.8 -20 -1.6 -26"/><path d="M0.6 -13 Q-0.4 -21 1.4 -27.5"/><path d="M2.4 -14 Q1.6 -21 3.6 -28"/></g>`
        + `<path d="M-10.5 2 Q-11.5 -12 0 -13.6 Q11.5 -12 10.5 2 Q0 -1.6 -10.5 2 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M-10.5 2 Q-11.5 -12 0 -13.6 Q11.5 -12 10.5 2 Q0 -1.6 -10.5 2 Z" fill="@metalO" opacity="0.18" stroke="none"/>`
        + `<path d="M0 -13.4 L0 0" stroke="@metalO" stroke-width="0.7" fill="none" opacity="0.6"/>`
        + `<path d="M-8 -5 Q0 -8 8 -5" stroke="@metalO" stroke-width="0.5" fill="none" opacity="0.45"/>`
        + `<path d="M-10.2 1 Q0 -2.6 10.2 1 L10.4 4.6 Q0 1 -10.4 4.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-9.6 3.6 Q0 6.6 9.6 3.6 Q10 8 8.4 12 Q0 9 -8.4 12 Q-10 8 -9.6 3.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<circle cx="-6.6" cy="-3.4" r="0.6" fill="@metalH"/><circle cx="6.6" cy="-3.4" r="0.6" fill="@metalH"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-0.4 -12 Q-1.6 -13.6 -3.4 -12.4 L-2.6 -9.6 L-1 -10 Z" fill="@metal" stroke="@metalO" stroke-width="0.5"/>`
        + `<path d="M-0.8 -12.6 Q-6 -19 -8.2 -26 Q-9.2 -31 -5 -31 Q-2 -30 -2.2 -24.8 Q-1.8 -18 1 -13 Z" fill="@crin" stroke="@crinO" stroke-width="0.5"/>`
        + `<g stroke="@crinO" stroke-width="0.5" fill="none" opacity="0.7"><path d="M-1 -13.4 Q-5 -19 -6.6 -25.5"/><path d="M-2.6 -14 Q-6.4 -20 -7.6 -26"/></g>`
        + `<path d="M-4.4 -29.5 Q-6.6 -24 -5.4 -18" stroke="@crinH" stroke-width="0.5" fill="none" opacity="0.55"/>`
        + `<path d="M-9 2 Q-10 -12 -0.4 -13.6 Q7.6 -12.4 8 -0.6 Q0 -2 -9 2 Z" fill="url(#g_steel)" stroke="@metalO" stroke-width="0.9"/>`
        + `<path d="M-9 2 Q-10 -12 -0.4 -13.6 Q7.6 -12.4 8 -0.6 Q0 -2 -9 2 Z" fill="@metalO" opacity="0.2" stroke="none"/>`
        + `<path d="M-0.6 -13 Q-6 -9.4 -7.2 -1.4 Q-3.6 -3.8 0 -3.6" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.45"/>`
        + `<path d="M-9 0 Q0 -2.6 8 -1 L7.8 2 Q0 0 -8.8 3 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M5.6 -1.6 Q7.2 -2 8.2 -0.6 L7.8 8 Q6.6 8.6 5.6 7.6 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>`
        + `<path d="M-2.4 2 Q-3 8 -0.6 11.4 Q1.6 12.4 2.6 10 Q2 4.6 1.8 1 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>`
        + `<circle cx="-4.6" cy="-3.4" r="0.6" fill="@metalH"/><circle cx="2" cy="-6" r="0.55" fill="@metalH"/>`
        + `</g>`,
    },
  },
};
