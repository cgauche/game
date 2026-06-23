import type { AppearanceElement } from '../types';

// Pattes d'oiseau : les jambes deviennent celles d'un volatile — cuisse à duvet puis long tarse
// écailleux jaune-corne, pied à trois serres griffues vers l'avant + un ergot postérieur (mutation
// Pattes d'oiseau, EDOC). Membres mutés : remplacent jambes (cuisses) et pieds.
const TARSE = '<g data-mut="pattes-d-oiseau">'
  // haut de cuisse encore couvert de duvet (chair claire)
  + '<path d="M-2.6 0 Q0 -1 2.6 0 L2 5.6 Q0 6.6 -2 5.6 Z" fill="#b98a64" stroke="#7a5638" stroke-width="0.6" stroke-linejoin="round"/>'
  + '<path d="M-2 1.4 q1 1.6 0.4 3.2 M0.4 1.2 q0.8 1.8 0.2 3.4 M2 1.4 q-1 1.6 -0.4 3.2" stroke="#8a6a48" stroke-width="0.45" fill="none" opacity="0.6" stroke-linecap="round"/>'
  // long tarse écailleux jaune-corne, fin
  + '<path d="M-1.5 5.4 Q-1.9 9.5 -1.3 14 L1.3 14 Q1.9 9.5 1.5 5.4 Q0 6.4 -1.5 5.4 Z" fill="#d6ab4a" stroke="#9a7320" stroke-width="0.55" stroke-linejoin="round"/>'
  // anneaux d'écailles du tarse
  + '<path d="M-1.6 7.5 h3.2 M-1.6 9.5 h3.2 M-1.6 11.5 h3.2 M-1.6 13 h3" stroke="#9a7320" stroke-width="0.4" fill="none" opacity="0.7"/>'
  + '</g>';

// pied = trois serres griffues écartées vers l'avant + un ergot court vers l'arrière ; origine au talon
const PIED = '<g data-mut="pattes-d-oiseau">'
  // doigt avant central
  + '<path d="M-0.4 0 L0.4 0 L0.8 6.4 L0 7.4 L-0.8 6.4 Z" fill="#d6ab4a" stroke="#9a7320" stroke-width="0.5" stroke-linejoin="round"/>'
  + '<path d="M0 7 L0.6 8.6 L-0.2 8 Z" fill="#3a2a16"/>'
  // doigt avant gauche
  + '<path d="M-1.2 0.4 L-0.5 0.6 L-3 5.4 L-3.8 5 L-2.6 1.4 Z" fill="#cda042" stroke="#9a7320" stroke-width="0.5" stroke-linejoin="round"/>'
  + '<path d="M-3 5.2 L-4.4 6 L-3.6 5 Z" fill="#3a2a16"/>'
  // doigt avant droit
  + '<path d="M1.2 0.4 L0.5 0.6 L3 5.4 L3.8 5 L2.6 1.4 Z" fill="#cda042" stroke="#9a7320" stroke-width="0.5" stroke-linejoin="round"/>'
  + '<path d="M3 5.2 L4.4 6 L3.6 5 Z" fill="#3a2a16"/>'
  // ergot postérieur (vers le haut/arrière)
  + '<path d="M-0.4 -0.2 L-1.8 -2.6 L-0.8 -2 Z" fill="#c89a3a" stroke="#9a7320" stroke-width="0.45" stroke-linejoin="round"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'pattes-d-oiseau', label: 'Pattes d’oiseau', category: 'mutation',
  overlays: [
    { bone: 'cuisseG', svg: TARSE, replace: true },
    { bone: 'cuisseD', svg: TARSE, replace: true },
    { bone: 'piedG', svg: PIED, replace: true },
    { bone: 'piedD', svg: PIED, replace: true },
  ],
};
