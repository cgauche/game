import type { QuadHeadDef } from '../types';

export const quadHead: QuadHeadDef = {
  key: 'basilic',
  label: 'Basilic',
  art: {
    // GUEULE BÉANTE de saurien (mâchoire inférieure décrochée, crocs haut+bas, gueule rouge),
    // museau à plaque cornée en bec, œil ROUGE incandescent (regard mortel), crête de pointes
    // @cheveux sur le crâne balayées vers la nuque — artwork LDB 79 p.319.
    profile: `<g transform="rotate(6)">` +
      // crête de crâne (3 pointes vers l'arrière) + membrane orangée, DERRIÈRE le crâne
      `<path d="M-1.5 -8.2 Q-4.4 -14.8 -6.4 -16.2 Q-5.6 -11.2 -5 -8.6 Z M-4.8 -7.6 Q-8.4 -13 -10.2 -14 Q-9 -9.4 -8.2 -6.8 Z M-7.8 -5.8 Q-11.6 -9.6 -13 -10.2 Q-11.8 -6.4 -10.6 -4.4 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` +
      `<path d="M-5.6 -12.2 Q-7.6 -11.4 -9 -10.2 M-9.2 -9.4 Q-11 -8.2 -11.9 -6.6" stroke="#c07b32" stroke-width="1" opacity="0.75" fill="none"/>` +
      // crâne + museau (dessus) : plaque cornée qui se termine en bec busqué
      `<path d="M-8 -4.5 Q-9.5 2.5 -4 5 Q-0.5 6 3 5.2 Q12 4.6 21 3.4 Q26 2.6 27 1 Q26.5 -1.6 21 -2.2 Q11 -3.2 5 -4.6 Q2 -8.4 -2.5 -8.8 Q-7 -8.2 -8 -4.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M4 -4.2 Q14 -3 24 -1.6" stroke="@corpsH" stroke-width="1.4" fill="none" opacity="0.6"/>` + // arête cornée claire du museau
      `<path d="M23.5 -0.6 l1.7 0.8" stroke="#1a0e08" stroke-width="0.8" stroke-linecap="round"/>` + // naseau en fente
      // gueule rouge (gape) + langue, SOUS la mâchoire sup, puis mâchoire inf DÉCROCHÉE vers l'avant-bas
      `<path d="M4 4.8 Q13 4.2 24 2.2 Q20 8.8 13 11.6 Q7 12.6 3.6 8.4 Z" fill="#6e1414"/>` +
      `<path d="M5 8.8 Q10 10.6 15 9.4" stroke="#b03a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
      `<path d="M2.5 5.5 Q3 10 7 13 Q13 16.6 20 16.2 Q23 15.6 22.6 13.8 Q17 13.4 12 11.2 Q7 9 4.8 5.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      // crocs : rangée sup (pendante) + rangée inf (dressée sur la mâchoire décrochée)
      `<path d="M7 4.9 l1 3.6 l1.3 -3.1 Z M11.5 4.5 l1 3.9 l1.3 -3.5 Z M16 4.1 l0.9 3.6 l1.2 -3.2 Z M20.5 3.4 l0.8 3.2 l1.1 -2.9 Z" fill="#efe6cf" stroke="#b8a888" stroke-width="0.3"/>` +
      `<path d="M8 12.6 l0.5 -3.4 l1.5 2.9 Z M12.5 14 l0.5 -3.5 l1.6 3 Z M17 14.8 l0.4 -3.2 l1.5 2.8 Z" fill="#efe6cf" stroke="#b8a888" stroke-width="0.3"/>` +
      // œil ROUGE incandescent fendu + arcade saillante ; écailles de joue
      `<ellipse cx="1.5" cy="-3.4" rx="2" ry="2.2" fill="#e35b22"/><ellipse cx="1.5" cy="-3.4" rx="0.55" ry="2" fill="#160a06"/><circle cx="2.2" cy="-4.2" r="0.4" fill="#ffd9a0" opacity="0.8"/>` +
      `<path d="M-1.6 -6.2 Q2 -7.2 4.8 -5.2" stroke="@corpsO" stroke-width="1.2" fill="none"/>` +
      `<path d="M-4 0 q1.6 1 3.2 0.8 M-5 2.4 q1.6 1 3.2 0.8" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.5"/></g>`,
    // face de saurien : crête de pointes au sommet, 2 yeux ROUGES, museau corné court, GUEULE
    // OUVERTE (rouge) à crocs — raccord avec le profil (mêmes crocs, même œil incandescent).
    front: `<g>` +
      `<path d="M-0.6 -13.4 Q-1.2 -20.6 -0.2 -22.8 Q1.6 -18.2 1.2 -13.6 Z M-4.2 -12.6 Q-6.8 -18.6 -8.2 -19.8 Q-6.8 -14.4 -5.4 -11.8 Z M4 -12.6 Q6.6 -18.6 8 -19.8 Q6.6 -14.4 5.2 -11.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // crête (3 pointes)
      `<path d="M-5.2 -16.4 Q-3 -18 -1 -18.6 M1.4 -18.6 Q3.6 -18 5.4 -16.4" stroke="#c07b32" stroke-width="1" opacity="0.75" fill="none"/>` + // membrane orangée
      `<path d="M-9 -10 Q-11 3 -5 9 Q0 12 5 9 Q11 3 9 -10 Q0 -14 -9 -10 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // crâne
      `<path d="M-4.4 7.5 Q-5.2 12.5 -3.2 15.5 Q0 17.4 3.2 15.5 Q5.2 12.5 4.4 7.5 Q0 10 -4.4 7.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // museau court
      `<path d="M-1.6 8.8 Q0 8.2 1.6 8.8 L1 14.8 Q0 15.6 -1 14.8 Z" fill="@corpsH" opacity="0.5"/>` + // plaque cornée
      `<path d="M-1.4 15.2 l0.9 1.2 M1.4 15.2 l-0.9 1.2" stroke="#1a0e08" stroke-width="0.7" stroke-linecap="round"/>` + // naseaux
      `<path d="M-4.4 16.8 Q0 15.6 4.4 16.8 Q3.4 22 0 22.8 Q-3.4 22 -4.4 16.8 Z" fill="#6e1414" stroke="@corpsO" stroke-width="0.5"/>` + // gueule béante
      `<path d="M-3.2 16.9 l0.7 2.1 l1 -1.9 M-0.4 16.5 l0.7 2.2 l1 -2 M2.4 16.7 l0.6 2 l0.9 -1.8" stroke="#efe6cf" stroke-width="0.7" fill="none"/>` + // crocs sup
      `<path d="M-1.9 22 l0.5 -1.9 l1 1.7 M1 21.9 l0.5 -1.8 l0.9 1.6" stroke="#efe6cf" stroke-width="0.7" fill="none"/>` + // crocs inf
      `<ellipse cx="-4.8" cy="-3" rx="1.9" ry="2.2" fill="#e35b22"/><ellipse cx="-4.8" cy="-3" rx="0.5" ry="2" fill="#160a06"/>` +
      `<ellipse cx="4.8" cy="-3" rx="1.9" ry="2.2" fill="#e35b22"/><ellipse cx="4.8" cy="-3" rx="0.5" ry="2" fill="#160a06"/>` + // yeux ROUGES
      `<path d="M-7.4 -5.4 Q-4.8 -7 -2 -5.2 M7.4 -5.4 Q4.8 -7 2 -5.2" stroke="@corpsO" stroke-width="1.2" fill="none"/></g>`, // arcades
    // dos du crâne : PAS d'oreilles, la crête @cheveux descend du sommet à la nuque
    back: `<g><path d="M-8.5 -12 Q-10 0 -5 9 Q0 13 5 9 Q10 0 8.5 -12 Q0 -16 -8.5 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M0 -15 Q-1 -21.4 -0.2 -23.6 Q1.4 -19 1 -15 Z M0 -8 Q-0.9 -13.6 -0.1 -15.6 Q1.4 -11.6 1 -8 Z M0 -1 Q-0.8 -6.2 0 -8.2 Q1.3 -4.6 1 -1 Z M0 6 Q-0.7 1.4 0 -0.4 Q1.2 3 0.9 6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/></g>`,
  },
};
