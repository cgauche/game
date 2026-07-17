import type { TenueDef } from '../types';

// Cultiste du Chaos : robe de cérémonie à capuchon + emblème pectoral (T1 ch.9 l.183 :
// « robes rouges […] dessinées, au niveau de la poitrine », Compagnon ch.9 : « robes de
// cérémonie de la couleur du culte »). vet1 = robe (recolorable par culte), vet2 = emblème.
// `botte` = cuir des bottes (aligne le pied système sur la cordelière/tiges @cuir).
export const tenue: TenueDef = {
  name: 'Cultiste',
  palette: { vet1: '#5a2326', vet2: '#c9a44a', cuir: '#4a3a28', botte: '#4a3a28' },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">`
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
      // profil/dos EXPLICITES : l'emblème @vet2 (or) gagnait le décompte dominantCloth →
      // la silhouette substituée virait au doré. Robe @vet1 + rappel discret de l'emblème.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-5 -27 Q3 -30 7 -25 Q8.5 -10 6.5 4 L6 34 Q-1 37.5 -6.5 34 L-5 4 Q-7 -13 -5 -27 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M3 -26 Q6 -10 5 4 L4.6 31 M-2 -26 Q-3.6 -10 -2.8 4 L-2.6 32" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.55"/>`
        + `<path d="M-5.4 8.6 Q1 11 6.4 8.6" stroke="@cuir" stroke-width="2.2" fill="none"/>`
        + `<circle cx="3.4" cy="-12" r="2.6" fill="none" stroke="@vet2" stroke-width="0.8"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-8.5 -26 Q0 -29 8.5 -26 L9 6 Q8.4 20 6 34 Q0 37 -6 34 Q-8.4 20 -9 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M0 -26 L0 34" stroke="@vet1O" stroke-width="0.8" opacity="0.6"/>`
        + `<path d="M-8.5 -23 Q0 -26 8.5 -23 L8.5 -18 Q0 -21 -8.5 -18 Z" fill="@vet1H" opacity="0.4"/>`
        + `<path d="M-8.6 8.6 Q0 11 8.6 8.6" stroke="@cuir" stroke-width="2.2" fill="none"/>`
        + `</g>`,
    },
    bras: {
      // manche PLEINE : épaule (y-3, dégage la tête) → coude → bouche de manche (y≈33),
      // la main du rig (poignet FK à y≈32) émerge de la bouche — AUCUN vide manche→main.
      front: `<g stroke-linejoin="round">`
        + `<path d="M-4.2 -3 Q0 -5.4 4.2 -3 L5 10 Q5.6 20 6 27 Q6.3 31.6 3.4 32.4 L-3.4 32.4 Q-6.3 31.6 -6 27 Q-5.6 20 -5 10 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2.6 0 Q-3.2 14 -3.4 29 M2.6 0 Q3.2 14 3.4 29" stroke="@vet1O" stroke-width="0.6" opacity="0.55" fill="none"/>`
        // bouche de manche (ourlet sombre)
        + `<path d="M-5.9 27.6 Q0 30 5.9 27.6 L5.4 31.8 Q0 33.4 -5.4 31.8 Z" fill="@vet1O" opacity="0.6" stroke="none"/>`
        + `<path d="M-5.9 27.8 Q0 30.2 5.9 27.8" fill="none" stroke="@vet1O" stroke-width="0.7"/>`
        + `</g>`,
      // profil : manche qui plie au coude (+x = AVANT), matière qui suit la courbure,
      // côté dorsal (-x) ombré, bouche de manche au poignet.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-4.4 -3 Q0.4 -5.6 4.6 -2.8 Q5.4 4 5 11 Q6.2 19 6.4 26.5 Q6.7 31 3.8 32 L-2.8 32 Q-5.5 30.8 -5 26 Q-4.6 18.5 -4.2 11 Q-5.2 4 -4.4 -3 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-4.4 -3 Q-5.2 4 -4.2 11 Q-4.6 18.5 -5 26 Q-5.5 30.8 -2.8 32 L-1 32 Q-2.3 24 -1.9 16 Q-2.4 8 -2.1 -3.6 Z" fill="@vet1O" opacity="0.45" stroke="none"/>`
        + `<path d="M2.8 -1 Q3.6 6 3.2 12 Q4.3 19 4.5 26" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.55"/>`
        + `<path d="M4.2 -1.5 Q5 4 4.8 10" fill="none" stroke="@vet1H" stroke-width="0.6" opacity="0.6"/>`
        + `<path d="M-4.8 27.6 Q0.8 30.2 6.4 27.8 L5.8 31.4 Q0 33.2 -3.8 31.6 Z" fill="@vet1O" opacity="0.6" stroke="none"/>`
        + `<path d="M-4.8 27.8 Q0.8 30.4 6.4 28" fill="none" stroke="@vet1O" stroke-width="0.7"/>`
        + `</g>`,
      // dos : couture axiale, côté corps (+x) ombré, capsule d'épaule assombrie.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-4.2 -3 Q0 -5.4 4.2 -3 L5 10 Q5.6 20 6 27 Q6.3 31.6 3.4 32.4 L-3.4 32.4 Q-6.3 31.6 -6 27 Q-5.6 20 -5 10 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M1.2 -1.8 Q3 -2.4 4.2 -3 L5 10 Q5.6 20 6 27 Q6.3 31.6 3.4 32.4 L1.8 32.4 Q1.1 16 1.2 -1.8 Z" fill="@vet1O" opacity="0.45" stroke="none"/>`
        + `<path d="M0.2 -2.2 Q0.6 14 0.4 31" fill="none" stroke="@vet1O" stroke-width="0.8" opacity="0.7"/>`
        + `<path d="M-4.2 -3 Q0 -5.4 4.2 -3 L4.5 1.6 Q0 -0.6 -4.5 1.6 Z" fill="@vet1O" opacity="0.5" stroke="none"/>`
        + `<path d="M-3.9 -0.6 Q-4.9 14 -4.6 29" fill="none" stroke="@vet1H" stroke-width="0.6" opacity="0.5"/>`
        + `<path d="M-5.9 27.8 Q0 30.2 5.9 27.8" fill="none" stroke="@vet1O" stroke-width="0.7" opacity="0.7"/>`
        + `</g>`,
    },
    jambes: {
      // bas de robe mi-mollet (ourlet y≈38) + TIGE DE BOTTE @cuir jusqu'à la cheville
      // (y=50.5, le pied système complète bout/talon) — mêmes hauteurs sur les 3 vues.
      front: `<g stroke-linejoin="round">`
        + `<path d="M-5.5 0 Q0 -1.6 5.5 0 L5.2 22 Q5.4 32 5.8 37.5 Q0 40 -5.8 37.5 Q-5.4 32 -5.2 22 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M-2 2 Q-2.5 20 -2.7 36 M2 2 Q2.5 20 2.7 36" stroke="@vet1O" stroke-width="0.6" opacity="0.5" fill="none"/>`
        + `<path d="M-5.8 35.6 Q0 38.2 5.8 35.6 L5.8 37.5 Q0 40 -5.8 37.5 Z" fill="@vet1O" opacity="0.55" stroke="none"/>`
        + `<path d="M-3.6 36 Q-4 43 -3.4 50.5 L3.4 50.5 Q4 43 3.6 36 Q0 38 -3.6 36 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.5 40.5 Q0 42 3.5 40.5" fill="none" stroke="@cuirO" stroke-width="0.7" opacity="0.7"/>`
        + `</g>`,
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-3.6 0 Q0 -1.4 3.8 0 L3.4 22 Q3.8 32 4.2 37.5 Q0 39.6 -4 37.3 Q-3.6 32 -3.4 22 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0.6 2 Q0.2 20 0.4 36" stroke="@vet1O" stroke-width="0.6" opacity="0.5" fill="none"/>`
        + `<path d="M-4 35.4 Q0 37.8 4.2 35.6 L4.2 37.5 Q0 39.6 -4 37.3 Z" fill="@vet1O" opacity="0.55" stroke="none"/>`
        + `<path d="M-3 36 Q-3.4 43 -3 50.5 L3.2 50.5 Q3.6 43 3.2 36 Q0 37.6 -3 36 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3 40.5 Q0 41.8 3.1 40.5" fill="none" stroke="@cuirO" stroke-width="0.7" opacity="0.7"/>`
        + `</g>`,
      back: `<g stroke-linejoin="round">`
        + `<path d="M-5.5 0 Q0 -1.6 5.5 0 L5.2 22 Q5.4 32 5.8 37.5 Q0 40 -5.8 37.5 Q-5.4 32 -5.2 22 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
        + `<path d="M0 2 L0 37" stroke="@vet1O" stroke-width="0.7" opacity="0.55" fill="none"/>`
        + `<path d="M-5.8 35.6 Q0 38.2 5.8 35.6 L5.8 37.5 Q0 40 -5.8 37.5 Z" fill="@vet1O" opacity="0.55" stroke="none"/>`
        + `<path d="M-3.6 36 Q-4 43 -3.4 50.5 L3.4 50.5 Q4 43 3.6 36 Q0 38 -3.6 36 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
        + `<path d="M-3.2 46 L3.3 46 L3.4 50.5 L-3.4 50.5 Z" fill="@cuirO" opacity="0.85"/>`
        + `</g>`,
    },
    tete: {
      front: `<g stroke-linejoin="round">`
        // capuchon FERMÉ sur le crâne (couvre cheveux/oreilles, seul l'ovale du visage est libre)
        + `<path d="M-9.4 4.6 Q-11 -8 -4 -15 Q2.6 -20.6 8.4 -14.2 Q11.2 -8 9.4 4.6 Q8.6 8.4 7 10 L5.4 7 Q6.4 2.6 6 -0.2 Q4.6 -2.4 0 -2.4 Q-4.6 -2.4 -6 -0.2 Q-6.4 2.6 -5.4 7 L-7 10 Q-8.6 8.4 -9.4 4.6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-2.6 -17 Q1.6 -22.6 6.8 -20.8 Q4.8 -18.4 4 -16 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-7.4 -7.4 Q0 -11.4 7.2 -7.2" stroke="@vet1O" stroke-width="0.8" fill="none" opacity="0.6"/>`
        + `<path d="M-5.8 -1.8 Q0 -4.2 5.8 -1.8" stroke="#1a0c0e" stroke-width="0.8" fill="none" opacity="0.5"/>`
        + `</g>`,
      // profil : cagoule de côté (visage ouvert vers +x = AVANT), pointe tombant sur la nuque.
      profile: `<g stroke-linejoin="round">`
        + `<path d="M-8.8 5 Q-11 -8 -4 -15 Q2.6 -20.6 8.4 -14.2 Q10.4 -9.4 9.4 -5.2 L4.6 -6.2 Q0 -6.8 -2.6 -4.6 Q-4.8 -2 -4.6 2 Q-4.4 4.6 -3.6 6.8 L-6.6 7.2 Q-8.2 6.6 -8.8 5 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-1 -17.2 Q-6.4 -21.6 -10.4 -18.6 Q-8 -16.8 -6.8 -14.4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M-7.6 -6.8 Q-2 -11 4.4 -8.6" stroke="@vet1O" stroke-width="0.8" fill="none" opacity="0.6"/>`
        + `<path d="M8.8 -6 Q3 -8.4 -2.2 -5.6 Q-4.6 -2.6 -4 3.2" fill="none" stroke="#1a0c0e" stroke-width="0.8" opacity="0.5"/>`
        + `</g>`,
      // dos : capuche pleine tombant jusqu'au col (rejoint le torse), couture axiale,
      // liseré sombre qui DÉTACHE la tête de la silhouette au zoom de jeu.
      back: `<g stroke-linejoin="round">`
        + `<path d="M-9.4 4.6 Q-11 -8 -4 -15 Q2.6 -20.6 8.4 -14.2 Q11.2 -8 9.4 4.6 Q8.8 9.4 6.6 11.6 Q0 14 -6.6 11.6 Q-8.8 9.4 -9.4 4.6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
        + `<path d="M-0.6 -17.6 Q4.4 -21.8 7.6 -19.2 Q4.2 -16.4 2.8 -12.6 Q0.6 -15.4 -0.6 -17.6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
        + `<path d="M0 -18 Q0.6 -4 0 12.6" stroke="@vet1O" stroke-width="0.8" opacity="0.65" fill="none"/>`
        + `<path d="M-7.4 -7.4 Q0 -11.4 7.2 -7.2" stroke="@vet1O" stroke-width="0.8" fill="none" opacity="0.6"/>`
        + `<path d="M-9.2 3.4 Q-10.6 -8 -4 -14.6 Q2.6 -20 8.2 -13.8 Q10.8 -8 9.2 3.4" fill="none" stroke="#1a0c0e" stroke-width="0.9" opacity="0.45"/>`
        + `</g>`,
    },
  },
};
