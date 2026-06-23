import type { AppearanceElement } from '../types';

// Peau hérissée de pointes : pointes osseuses acérées saillant de toute la peau, façon herse
// (mutation Peau hérissée de pointes, EDOC). Pointes blanc-os bordées de chair, semées sur le
// torse, les épaules, les bras et les jambes pour lire « tout le corps couvert de pointes ».
// Os de la pointe ≈ #d8cdb0, base de chair ≈ #9a6a52.
const SPIKE = 'fill="#d8cdb0" stroke="#6a5a3c" stroke-width="0.35"';

// Torse : pointes étagées sur les flancs et le sternum, dirigées vers l'extérieur/le haut.
const POINTES_TORSE = '<g data-mut="peau-herissee-de-pointes">'
  + `<path d="M-8 -14 l-3.4 -2.4 l1.4 3.4 Z M-8.6 -7 l-3.6 -1.4 l1.6 3.2 Z M-8.4 0 l-3.4 -0.6 l1.4 3 Z`
  + ` M8 -14 l3.4 -2.4 l-1.4 3.4 Z M8.6 -7 l3.6 -1.4 l-1.6 3.2 Z M8.4 0 l3.4 -0.6 l-1.4 3 Z" ${SPIKE}/>`
  // pointes médianes dressées vers le haut
  + `<path d="M-2.4 -16 l-0.6 -3.4 l1.6 3 Z M2.4 -16 l0.6 -3.4 l-1.6 3 Z M0 -13 l0 -3.6 l1.2 3.2 Z" ${SPIKE}/>`
  + '</g>';

// Épaule/bras : file de pointes le long du membre.
const POINTES_BRAS = (s: 1 | -1) => '<g data-mut="peau-herissee-de-pointes">'
  + `<path d="M${3 * s} 3 l${3 * s} -2 l${-1 * s} 3 Z M${3.4 * s} 11 l${3.2 * s} -1.6 l${-1.2 * s} 3 Z`
  + ` M${3.4 * s} 19 l${3.2 * s} -1 l${-1.2 * s} 2.8 Z" ${SPIKE}/>`
  + '</g>';

// Jambe : file de pointes sur la face externe de la cuisse/tibia.
const POINTES_JAMBE = (s: 1 | -1) => '<g data-mut="peau-herissee-de-pointes">'
  + `<path d="M${3.4 * s} 6 l${3.4 * s} -1.6 l${-1.2 * s} 3 Z M${3.6 * s} 18 l${3.4 * s} -1.2 l${-1.2 * s} 3 Z`
  + ` M${3.6 * s} 30 l${3.4 * s} -1 l${-1.2 * s} 2.8 Z" ${SPIKE}/>`
  + '</g>';

export const element: AppearanceElement = {
  key: 'peau-herissee-de-pointes', label: 'Peau hérissée de pointes', category: 'mutation',
  overlays: [
    { bone: 'torse', svg: POINTES_TORSE },
    { bone: 'epauleG', svg: POINTES_BRAS(-1) },
    { bone: 'epauleD', svg: POINTES_BRAS(1) },
    { bone: 'cuisseG', svg: POINTES_JAMBE(-1) },
    { bone: 'cuisseD', svg: POINTES_JAMBE(1) },
  ],
};
