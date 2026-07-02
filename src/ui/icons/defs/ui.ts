import type { IconFamily } from '../types';

/* Famille « interface » (tour par tour, alertes). Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'ui/wait',
    label: 'Attendre',
    svg:
      `<path ${K} d="M7.1 3.5 H16.9 M7.1 20.5 H16.9"/>` +
      `<path ${K} d="M8.1 4 C8.1 8.6 10.7 10.4 11.5 12 C10.7 13.6 8.1 15.4 8.1 20"/>` +
      `<path ${K} d="M15.9 4 C15.9 8.6 13.3 10.4 12.5 12 C13.3 13.6 15.9 15.4 15.9 20"/>` +
      `<path ${F} d="M9.8 19 C11.1 17.4 12.9 17.4 14.2 19 Z"/>` +
      `<circle ${F} cx="12" cy="14.9" r="0.75"/>`,
  },
  {
    id: 'ui/turn-end',
    label: 'Fin du tour',
    svg:
      `<path ${K} d="M5.4 6.9 H14.4 C17.4 6.9 19.4 8.9 19.4 11.9 C19.4 14.9 17.4 16.7 14.4 16.7 H6.6"/>` +
      `<path ${K} d="M6.4 16.7 L9.4 14 M6.4 16.7 L9.4 19.4"/>`,
  },
  {
    id: 'ui/round-start',
    label: 'Nouveau round',
    svg:
      `<path ${K} d="M13.9 4.7 C17.1 5.5 19.4 8.5 19.4 12 C19.4 16.1 16.1 19.4 12 19.4 C7.9 19.4 4.6 16.1 4.6 12 C4.6 9.1 6.2 6.6 8.6 5.4"/>` +
      `<path ${K} d="M13.9 4.7 L11.9 3.4 M13.9 4.7 L12.2 6.6"/>` +
      `<path ${F} d="M10.3 9.1 L15.5 12 L10.3 14.9 Z"/>`,
  },
  {
    id: 'ui/warning',
    label: 'Attention',
    svg:
      `<path ${K} d="M12 3.6 C12.4 3.6 12.7 3.8 12.9 4.2 L20.9 18.3 C21.3 19 20.8 19.9 20 19.9 H4 C3.2 19.9 2.7 19 3.1 18.3 L11.1 4.2 C11.3 3.8 11.6 3.6 12 3.6 Z"/>` +
      `<path ${K} d="M12 9.2 C12.1 10.8 12.1 12.3 12 13.8"/>` +
      `<circle ${F} cx="12" cy="16.6" r="1.15"/>`,
  },
  {
    id: 'ui/done',
    label: 'Fait',
    svg:
      `<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4.9 12.7 C6.7 14.1 8.3 15.8 9.8 17.9 C12.5 13.4 15.7 9.5 19.3 6.1"/>` +
      `<path ${KF} opacity="0.5" d="M6.9 11.6 C7.9 12.4 8.8 13.3 9.7 14.4"/>`,
  },
  {
    id: 'ui/preempt',
    label: 'Interruption',
    svg: `<path ${F} d="M13.8 2.4 L5.8 13.4 L10.5 13.4 L8.9 21.6 L18.2 10.1 L13.4 10.1 Z"/>`,
  },
];
