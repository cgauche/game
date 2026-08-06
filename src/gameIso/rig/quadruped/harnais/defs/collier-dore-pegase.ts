import type { QuadHarnaisDef } from '../types';

// COLLIER DORÉ DE PÉGASE — le collier d'harnais clouté du poitrail de l'artwork officiel
// (art-ref/ldb/page325_img7829.png, statblock Pégase LDB 323) : bande d'or à cinq clous suivant la
// courbe de l'encolure arquée.
//
// L'art vit dans les COORDONNÉES LOCALES de l'os `encolure` du gabarit `pegase` (`neckLen` 0,95 /
// `neckAngle` -28 cuits dans son tracé) : d'où `especes: ['pegase']`. La clé vise `encolure#profile`
// SEULEMENT — l'os `encolure` ne porte d'art qu'en profil, une clé nue y réclamerait deux vues
// qu'elle ne peint pas ; elle se ré-ouvrira le jour où un art de collier vu de bout existera.
// `plan: 0` = le plan de l'os
// lui-même : le fragment se peint APRÈS l'art de la bête, exactement comme la déco d'espèce le
// faisait.
export const quadHarnais: QuadHarnaisDef = {
  id: 'collier-dore-pegase',
  label: 'Collier doré de pégase',
  especes: ['pegase'],
  deco: {
    // collier doré clouté à la base de l'encolure (repère local : base du cou = y 0..8)
    'encolure#profile': [{ plan: 0, svg: `<g data-deco="collier">` +
      `<path d="M-12.5 4.5 Q0 10.5 14 6 L13 0.5 Q0 5.5 -11.5 -0.5 Z" fill="@accent" stroke="@accentO" stroke-width="0.7"/>` +
      `<path d="M-11.8 1 Q0 7 13.2 2" fill="none" stroke="@accentH" stroke-width="0.6" opacity="0.7"/>` +
      `<circle cx="-8" cy="3.2" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
      `<circle cx="-3" cy="5" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
      `<circle cx="2" cy="5.8" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
      `<circle cx="7" cy="4.9" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
      `<circle cx="11.5" cy="3.2" r="0.9" fill="#f2e3b2" stroke="@accentO" stroke-width="0.35"/>` +
      `</g>` }],
  },
};
