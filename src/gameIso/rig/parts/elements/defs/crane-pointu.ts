import type { AppearanceElement } from '../types';

// Crâne en pointe : os conique de la couleur d'un ongle infecté émergeant du sommet du cuir chevelu
// déchiré (mutation Tête pointue, EDO Appendice 2). Posé sur l'os tête, DERRIÈRE (layer -2) comme
// les cornes, pour s'élever au-dessus du crâne.
const CRANE = '<g data-mut="crane-pointu">'
  + '<path d="M-3 -6.5 Q-1.2 -9 0 -17 Q1.2 -9 3 -6.5 Z" fill="#c9b79a" stroke="#8a7658" stroke-width="0.6"/>'
  + '<path d="M-3 -6.5 Q0 -5.5 3 -6.5" stroke="#8a7658" stroke-width="0.5" fill="none" opacity="0.6"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'crane-pointu', label: 'Crâne pointu', category: 'mutation',
  overlays: [{ bone: 'tete', svg: CRANE, layer: -2, view: 'front' }],
};
