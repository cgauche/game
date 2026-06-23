import type { AppearanceElement } from '../types';

// Branchies : trois fentes branchiales striées de chaque côté du cou (base de la tête), légèrement
// béantes et ourlées de rouge vif (chair interne). Os tête, face. Une fente = un volet de peau soulevé
// laissant voir l'intérieur rouge.
const slits = (sx: number) => {
  const x = 6.2 * sx;
  return [0, 0, 0].map((_, i) => {
    const y = 7.5 + i * 3.2;
    // volet de peau soulevé
    return `<path d="M${x} ${y} q${1.6 * sx} 0.4 ${1.9 * sx} 2.4 q${-0.9 * sx} 0.5 ${-1.9 * sx} 0.2 Z" fill="@peau" stroke="@peauO" stroke-width="0.45"/>`
      // fente rouge interne
      + `<path d="M${x + 0.3 * sx} ${y + 0.4} q${1 * sx} 0.3 ${1.2 * sx} 1.7" stroke="#a8242c" stroke-width="0.8" fill="none" stroke-linecap="round"/>`;
  }).join('');
};
const BRANCHIES = `<g data-mut="branchies">${slits(1)}${slits(-1)}</g>`;

export const element: AppearanceElement = {
  key: 'branchies', label: 'Branchies', category: 'mutation',
  overlays: [{ bone: 'tete', svg: BRANCHIES, view: 'front' }],
};
