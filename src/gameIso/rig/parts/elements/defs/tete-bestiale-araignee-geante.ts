import type { AppearanceElement } from '../types';

// Tête d'araignée géante (Tête bestiale, sous-table EDOC) : carapace chitineuse sombre, grappe de
// 8 yeux noirs luisants, paire de chélicères/crochets à venin sous des mandibules. Os tête, face.
const TETE_ARAIGNEE = '<g data-mut="tete-bestiale-araignee-geante">'
  // carapace chitineuse arrondie, sombre
  + '<path d="M-6 -3 Q0 -7 6 -3 Q6.5 6 2.6 10 L-2.6 10 Q-6.5 6 -6 -3 Z" fill="#2e2a33" stroke="#12101a" stroke-width="0.6"/>'
  + '<path d="M-4.6 -2.5 Q0 -5 4.6 -2.5" stroke="#4a4452" stroke-width="0.5" fill="none"/>'
  // grappe de huit yeux noirs luisants (rangée haute + rangée basse + paire centrale médiane)
  + '<ellipse cx="-3.6" cy="-1" rx="1.3" ry="1.5" fill="#0a0810"/><ellipse cx="3.6" cy="-1" rx="1.3" ry="1.5" fill="#0a0810"/>'
  + '<ellipse cx="-1.4" cy="-2.4" rx="1" ry="1.1" fill="#0a0810"/><ellipse cx="1.4" cy="-2.4" rx="1" ry="1.1" fill="#0a0810"/>'
  + '<ellipse cx="-1.3" cy="1.4" rx="0.9" ry="1" fill="#0a0810"/><ellipse cx="1.3" cy="1.4" rx="0.9" ry="1" fill="#0a0810"/>'
  + '<ellipse cx="-4.8" cy="2.2" rx="0.8" ry="0.9" fill="#0a0810"/><ellipse cx="4.8" cy="2.2" rx="0.8" ry="0.9" fill="#0a0810"/>'
  // reflets sur les yeux
  + '<circle cx="-3.9" cy="-1.6" r="0.35" fill="#9a96a8"/><circle cx="3.3" cy="-1.6" r="0.35" fill="#9a96a8"/>'
  // chélicères / crochets à venin recourbés sous la face
  + '<path d="M-2.4 7.5 Q-3.6 11 -2 13.5 Q-2.8 11 -1.4 8.5 Z" fill="#3a3440" stroke="#14121c" stroke-width="0.5"/>'
  + '<path d="M2.4 7.5 Q3.6 11 2 13.5 Q2.8 11 1.4 8.5 Z" fill="#3a3440" stroke="#14121c" stroke-width="0.5"/>'
  // crochets noirs effilés (pointes à venin)
  + '<path d="M-2 13 Q-2.6 14.4 -1.2 14.8" stroke="#0c0a12" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  + '<path d="M2 13 Q2.6 14.4 1.2 14.8" stroke="#0c0a12" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  // mandibules / palpes latérales
  + '<path d="M-3 7 Q-6 8.5 -6.6 11" stroke="#2a2630" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
  + '<path d="M3 7 Q6 8.5 6.6 11" stroke="#2a2630" stroke-width="0.8" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-araignee-geante', label: 'Tête bestiale (Araignée géante)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TETE_ARAIGNEE, view: 'front' }],
};
