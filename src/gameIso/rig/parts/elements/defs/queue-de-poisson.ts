import type { AppearanceElement } from '../types';

// Queue de POISSON (sirène) : EFFACE les jambes (cuisses/tibias/pieds) et, à la place, une queue
// écailleuse prend tout le bas du corps depuis la TAILLE jusqu'au sol, pointe = nageoire CAUDALE
// fourchue. La caudale réutilise la SILHOUETTE de `fish/composeFish.ts::caudal()` (fan fourchu),
// pivotée pour pointer vers le bas. Calque sur l'os `torse` (et NON `bassin`) : le torse est peint
// PAR-DESSUS le bassin à z égal, donc une queue sur le bassin disparaîtrait sous le buste ; sur le
// torse (layer 99 > buste) elle recouvre le bas du buste et descend au sol. Repère torse : origine
// ≈ haut-bassin, +y descend ; le sol est ~y56 en repère torse. Dessinée PAR VUE (de profil la queue
// est balayée en arrière). Couleurs LITTÉRALES (vert-de-mer) → robuste quelle que soit la tenue.
const COL = '#3f7d6e';   // écailles vert-de-mer
const DK = '#244e45';    // contour / ombre
const LT = '#67b49c';    // reflet

// Nageoire caudale fourchue — silhouette de caudal() (composeFish), pivotée -90° pour s'ouvrir vers le bas.
const CAUDAL =
  `<path d="M0 0 Q-6 -3 -17 -16 Q-11 -6 -5 0 Q-11 6 -17 16 Q-6 3 0 0 Z" fill="${COL}" stroke="${DK}" stroke-width="0.7"/>` +
  `<path d="M-5 0 Q-10 -6 -15 -13 M-5 0 Q-10 6 -15 13" stroke="${DK}" stroke-width="0.5" fill="none" opacity="0.5"/>`;

// Lignes d'écailles (festons) communes face/dos.
const SCALES =
  `<path d="M-9.5 14 Q0 19 9.5 14 M-8.5 22 Q0 26 8.5 22 M-7 30 Q0 33.5 7 30 M-5.6 38 Q0 41 5.6 38 M-4.4 46 Q0 48 4.4 46" stroke="${DK}" stroke-width="0.6" fill="none" opacity="0.55"/>`;

const FRONT =
  `<g data-mut="queue-de-poisson">` +
  `<path d="M-10 6 Q-13 20 -11 30 Q-8 44 -4.5 52 L4.5 52 Q8 44 11 30 Q13 20 10 6 Q0 11 -10 6 Z" fill="${COL}" stroke="${DK}" stroke-width="0.8"/>` +
  SCALES +
  `<path d="M-3 9 Q-4.5 30 -1.5 50" stroke="${LT}" stroke-width="1.6" fill="none" opacity="0.4"/>` +
  `<g transform="translate(0,49) rotate(-90) scale(0.6)">${CAUDAL}</g>` +
  `</g>`;

const BACK =
  `<g data-mut="queue-de-poisson">` +
  `<path d="M-10 6 Q-12.5 20 -11 30 Q-8 44 -4.5 52 L4.5 52 Q8 44 11 30 Q12.5 20 10 6 Q0 11 -10 6 Z" fill="${DK}" stroke="#16332d" stroke-width="0.8"/>` +
  `<path d="M0 9 Q0.4 30 0 50" stroke="${COL}" stroke-width="0.8" fill="none" opacity="0.7"/>` +
  SCALES +
  `<g transform="translate(0,49) rotate(-90) scale(0.6)">${CAUDAL}</g>` +
  `</g>`;

// Profil : la queue jaillit de la taille et BALAIE vers l'arrière-bas (-x), pointe relevée → un seul
// galbe (pas l'art de face plaqué). Nageoire caudale au bout, orientée le long du balayage.
const PROFILE =
  `<g data-mut="queue-de-poisson">` +
  `<path d="M-5 6 Q6 8 6.5 16 Q5.5 30 -3 42 Q-10 50 -17 54 Q-21 56 -22 52 Q-16 50 -11 43 Q-3 32 1 18 Q2 10 -5 6 Z" fill="${COL}" stroke="${DK}" stroke-width="0.8"/>` +
  `<path d="M-1 12 Q0 24 -7 34 Q-12 42 -18 48" stroke="${DK}" stroke-width="0.6" fill="none" opacity="0.5"/>` +
  `<path d="M3.5 14 Q2.5 24 -3.5 33 Q-9 41 -15 46" stroke="${LT}" stroke-width="1.2" fill="none" opacity="0.4"/>` +
  `<g transform="translate(-21,52) rotate(34) scale(0.58)">${CAUDAL}</g>` +
  `</g>`;

export const element: AppearanceElement = {
  key: 'queue-de-poisson', label: 'Queue de poisson (sirène)', category: 'jambes',
  overlays: [
    // EFFACE les membres inférieurs (la queue les remplace).
    { bone: 'cuisseG', svg: '', replace: true },
    { bone: 'cuisseD', svg: '', replace: true },
    { bone: 'tibiaG', svg: '', replace: true },
    { bone: 'tibiaD', svg: '', replace: true },
    { bone: 'piedG', svg: '', replace: true },
    { bone: 'piedD', svg: '', replace: true },
    // La queue, posée sur le TORSE (recouvre le bas du buste, descend au sol ≈ y56). Par VUE.
    { bone: 'torse', svg: FRONT, view: 'front' },
    { bone: 'torse', svg: BACK, view: 'back' },
    { bone: 'torse', svg: PROFILE, view: 'profile' },
  ],
};
