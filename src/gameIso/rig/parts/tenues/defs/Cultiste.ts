import type { TenueDef } from '../types';

// Cultiste du Chaos : robe de cérémonie à capuchon + emblème pectoral (T1 ch.9 l.183 :
// « robes rouges […] dessinées, au niveau de la poitrine », Compagnon ch.9 : « robes de
// cérémonie de la couleur du culte »). vet1 = robe (recolorable par culte), vet2 = emblème.
export const tenue: TenueDef = {
  name: 'Cultiste',
  career: true,
  palette: { vet1: '#5a2326', vet2: '#c9a44a', cuir: '#4a3a28' },
  set: {
    torse: `<g stroke-linejoin="round">`
      // robe ample drapée
      + `<path d="M-13 -26 Q0 -30 13 -26 L13 8 L12.4 34 Q0 38 -12.4 34 L-13 8 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
      + `<path d="M-6.5 -23 L-7.5 35 M6.5 -23 L7.5 35" stroke="@vet1O" stroke-width="0.7" opacity="0.55" fill="none"/>`
      // cordelière nouée
      + `<path d="M-12.5 9 Q0 12 12.5 9" stroke="@cuir" stroke-width="2.4" fill="none"/>`
      + `<path d="M-1 11 Q-2 19 0 25 M1.5 11 Q2.5 17 1.5 23" stroke="@cuir" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
      // emblème pectoral : HEPTAGRAMME (étoile à 7 branches tracée d'un trait, 7/3)
      + `<circle cx="0" cy="-12" r="5.4" fill="none" stroke="@vet2" stroke-width="1"/>`
      + `<path d="M0 -16.2 L2.75 -8.62 L-4.1 -13.3 L4.1 -13.3 L-2.75 -8.62 L0 -16.2" fill="none" stroke="@vet2" stroke-width="0.8" stroke-linejoin="round"/>`
      + `<path d="M2.75 -8.62 L-1.83 -16.05 L-4.1 -13.3 M4.1 -13.3 L1.83 -16.05 L-2.75 -8.62" fill="none" stroke="@vet2" stroke-width="0.8" stroke-linejoin="round"/>`
      + `</g>`,
    bras: `<g stroke-linejoin="round">`
      // manche tombante
      + `<path d="M-5 -3 Q0 -5.6 5 -3 L6.2 15 Q7 19.5 3.6 20.5 L-3.6 20.5 Q-7 19.5 -6.2 15 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-5.2 15 Q0 17.4 5.2 15" stroke="@vet1O" stroke-width="0.7" fill="none" opacity="0.6"/>`
      + `</g>`,
    jambes: `<g stroke-linejoin="round">`
      // bas de robe : la jambe disparaît dans le drapé
      + `<path d="M-5.5 0 Q0 -1.6 5.5 0 L5 26 Q4.6 38 3.8 44 L-3.8 44 Q-4.6 38 -5 26 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-2 2 L-2.6 42 M2 2 L2.6 42" stroke="@vet1O" stroke-width="0.6" opacity="0.5" fill="none"/>`
      + `</g>`,
    tete: `<g stroke-linejoin="round">`
      // capuchon FERMÉ sur le crâne (couvre cheveux/oreilles, seul l'ovale du visage est libre)
      + `<path d="M-9.4 4.6 Q-11 -8 -4 -15 Q2.6 -20.6 8.4 -14.2 Q11.2 -8 9.4 4.6 Q8.6 8.4 7 10 L5.4 7 Q6.4 2.6 6 -0.2 Q4.6 -2.4 0 -2.4 Q-4.6 -2.4 -6 -0.2 Q-6.4 2.6 -5.4 7 L-7 10 Q-8.6 8.4 -9.4 4.6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
      + `<path d="M-2.6 -17 Q1.6 -22.6 6.8 -20.8 Q4.8 -18.4 4 -16 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
      + `<path d="M-7.4 -7.4 Q0 -11.4 7.2 -7.2" stroke="@vet1O" stroke-width="0.8" fill="none" opacity="0.6"/>`
      + `<path d="M-5.8 -1.8 Q0 -4.2 5.8 -1.8" stroke="#1a0c0e" stroke-width="0.8" fill="none" opacity="0.5"/>`
      + `</g>`,
  },
};
