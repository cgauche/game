import type { IconFamily } from '../types';

/* États-drapeaux (postures/psychologie hors conditions[]) — charte : voir defs/action.ts.
   NB : « Visée » (En joue) réutilise `action/aim` (même sens exact) — pas de doublon ici. */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Trait fin (détail secondaire). */
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';
/** Silhouette pleine à trous (evenodd). */
const FE = 'fill="currentColor" fill-rule="evenodd" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'flag/frenzy',
    label: 'Frénésie',
    svg:
      // Visage de face hurlant : yeux bridés de rage + gueule béante (trous evenodd), mèches hérissées.
      `<path ${FE} d="M12 3.6 C16 3.6 18.6 6.3 18.6 9.9 C18.6 12.8 17.1 15.1 14.7 16.1 L14.7 18.2 L9.3 18.2 L9.3 16.1 C6.9 15.1 5.4 12.8 5.4 9.9 C5.4 6.3 8 3.6 12 3.6 Z M8.1 8 L11 9.5 C10.4 10.5 9.2 10.8 8.2 10.2 C7.4 9.7 7.4 8.8 8.1 8 Z M15.9 8 C16.6 8.8 16.6 9.7 15.8 10.2 C14.8 10.8 13.6 10.5 13 9.5 Z M8.9 12 C11 11.4 13 11.4 15.1 12 C14.7 14.2 13.6 15.3 12 15.3 C10.4 15.3 9.3 14.2 8.9 12 Z"/>` +
      `<path ${KF} d="M7 3.9 L5.5 2.3 M10.1 2.7 L9.5 1.1 M13.9 2.7 L14.5 1.1 M17 3.9 L18.5 2.3"/>`,
  },
  {
    id: 'flag/focus',
    label: 'Focalisation',
    svg:
      `<circle ${K} cx="12" cy="12" r="5.3"/>` +
      `<circle ${F} cx="12" cy="12" r="2"/>` +
      `<path ${KF} d="M4.7 4.7 L7.5 7.5 M19.3 4.7 L16.5 7.5 M4.7 19.3 L7.5 16.5 M19.3 19.3 L16.5 16.5"/>`,
  },
  {
    id: 'flag/hungry',
    label: 'Affamé',
    svg:
      `<path ${K} d="M4.5 11 H19.5 C19.3 15.7 16.3 18.8 12 18.8 C7.7 18.8 4.7 15.7 4.5 11 Z"/>` +
      `<path ${KF} d="M9.8 20.6 H14.2"/>` +
      `<circle ${F} cx="7" cy="4.7" r="1.8"/>` +
      `<path ${K} d="M8.2 6 L12.7 11"/>`,
  },
  {
    id: 'flag/fear',
    label: 'Peur',
    svg:
      `<path ${KF} d="M4.2 6.2 L7.2 7.9 M3.6 11 L7 11.4 M4.2 15.8 L7.2 14.2"/>` +
      `<circle ${F} cx="15.6" cy="6.8" r="2.1"/>` +
      `<path ${K} d="M14.9 9.4 C14.2 11.5 14.6 13.9 16 16 C16.6 17.3 16.6 18.7 16 20.2"/>` +
      `<path ${K} d="M15.3 13.3 C17.2 14.6 18.4 16.6 18.9 20.1"/>` +
      `<path ${K} d="M14.9 10.3 C13.2 9.9 11.8 9.1 10.7 7.8"/>`,
  },
  {
    id: 'flag/defensive',
    label: 'Posture défensive',
    svg:
      `<path ${F} d="M12 3.2 C14.7 4.6 17.2 5.3 19.7 5.5 C19.6 12.4 17.1 17.5 12 20.7 C6.9 17.5 4.4 12.4 4.3 5.5 C6.8 5.3 9.3 4.6 12 3.2 Z"/>` +
      `<circle fill="var(--gold)" stroke="none" cx="12" cy="10.4" r="1.6"/>` +
      `<path ${KF} d="M2.4 9.9 L4.9 11 M2.9 14.4 L5.2 14"/>`,
  },
];
