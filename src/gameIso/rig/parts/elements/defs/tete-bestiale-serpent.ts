import type { AppearanceElement } from '../types';

// Tête de serpent (Tête bestiale, sous-table EDOC) : crâne écailleux effilé vert, yeux fendus à
// pupille verticale, gueule ouverte sur des crochets à venin, langue fourchue tirée. Os tête, face.
const TETE_SERPENT = '<g data-mut="tete-bestiale-serpent">'
  // crâne écailleux effilé (pas d'oreilles : silhouette lisse et plate)
  + '<path d="M-5.5 0 Q-5 -5 0 -6 Q5 -5 5.5 0 Q5 7 2.4 11 Q0 12.5 -2.4 11 Q-5 7 -5.5 0 Z" fill="#5e8a4e" stroke="#33522a" stroke-width="0.6"/>'
  // écailles dorsales (motif)
  + '<path d="M-2.6 -2 L0 -4 L2.6 -2 M-3 1.5 L0 -0.5 L3 1.5 M-2.6 5 L0 3 L2.6 5" stroke="#3f6634" stroke-width="0.4" fill="none"/>'
  // yeux fendus, pupille verticale
  + '<ellipse cx="-3.2" cy="-0.4" rx="1.6" ry="1.3" fill="#d8c24a" stroke="#5a4a18" stroke-width="0.3"/>'
  + '<ellipse cx="3.2" cy="-0.4" rx="1.6" ry="1.3" fill="#d8c24a" stroke="#5a4a18" stroke-width="0.3"/>'
  + '<rect x="-3.55" y="-1.5" width="0.7" height="2.2" rx="0.3" fill="#14180a"/>'
  + '<rect x="2.85" y="-1.5" width="0.7" height="2.2" rx="0.3" fill="#14180a"/>'
  // naseaux fins
  + '<ellipse cx="-1" cy="5" rx="0.45" ry="0.7" fill="#2a3a20"/><ellipse cx="1" cy="5" rx="0.45" ry="0.7" fill="#2a3a20"/>'
  // gueule ouverte sombre
  + '<path d="M-3 8.5 Q0 13.5 3 8.5 Q0 11 -3 8.5 Z" fill="#2a1418" stroke="#33522a" stroke-width="0.5"/>'
  // crochets à venin (deux crocs recourbés à l'avant de la gueule)
  + '<path d="M-1.8 9 Q-1.4 11.5 -0.6 12.4" stroke="#f0ead8" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  + '<path d="M1.8 9 Q1.4 11.5 0.6 12.4" stroke="#f0ead8" stroke-width="0.7" fill="none" stroke-linecap="round"/>'
  // langue fourchue tirée
  + '<path d="M0 12 Q0 15 0 16.5 M0 16.5 L-1 18 M0 16.5 L1 18" stroke="#b03a44" stroke-width="0.55" fill="none" stroke-linecap="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'tete-bestiale-serpent', label: 'Tête bestiale (Serpent)', category: 'mutation',
  overlays: [{ bone: 'tete', svg: TETE_SERPENT, view: 'front' }],
};
