import type { AppearanceElement } from '../types';

// Peau verruqueuse + ventre pâle (troll) — calque torse : ventre clair (@peauH) + pustules/lumps
// dépareillés (@peauO ombre + @peauH reflet) → la masse verte uniforme cesse de lire « blob ».
// Art PARTAGÉ (owner) : élément + monsterInjection (m.verrues).
export const VERRUES_ART = `<g><ellipse cx="0" cy="6" rx="9" ry="12" fill="@peauH" opacity="0.35"/><circle cx="-7" cy="-14" r="1.7" fill="@peauO"/><circle cx="-6.3" cy="-14.7" r="0.7" fill="@peauH" opacity="0.7"/><circle cx="6" cy="-11" r="1.9" fill="@peauO"/><circle cx="6.7" cy="-11.7" r="0.8" fill="@peauH" opacity="0.7"/><circle cx="-3" cy="-3" r="1.4" fill="@peauO"/><circle cx="-2.5" cy="-3.5" r="0.6" fill="@peauH" opacity="0.7"/><circle cx="8" cy="2" r="1.6" fill="@peauO"/><circle cx="8.6" cy="1.4" r="0.6" fill="@peauH" opacity="0.7"/><circle cx="-8" cy="1" r="1.3" fill="@peauO"/><circle cx="2" cy="-17" r="1.3" fill="@peauO"/><circle cx="2.6" cy="-17.6" r="0.6" fill="@peauH" opacity="0.7"/><circle cx="4" cy="14" r="1.4" fill="@peauO"/></g>`;

export const element: AppearanceElement = {
  key: 'verrues', label: 'Verrues', category: 'trait',
  overlays: [{ bone: 'torse', svg: VERRUES_ART, scale: 'bone', layer: 98 }],
};
