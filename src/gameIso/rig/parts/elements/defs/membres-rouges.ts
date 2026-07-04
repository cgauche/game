import type { AppearanceElement } from '../types';

// Démon de Khorne bicolore : membres rouge sang (épaules/cuisses) + trois stries de torse. Highlight
// clair (côté lumière) + arête sombre (côté ombre) → volume musculaire, pas un aplat. Art PARTAGÉ
// (owner) : cet élément + monsterInjection (m.membresRouges).
export const BRAS_ROUGE_ART = `<rect x="-3.4" y="-2" width="6.8" height="36" rx="3.2" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.6 1 Q-2.4 18 -1.6 33" stroke="#ad332a" stroke-width="1.5" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2 3 Q2.6 18 2 31" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.6" stroke-linecap="round"/>`;
export const CUISSE_ROUGE_ART = `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.8 3 Q-2 26 -1 47" stroke="#ad332a" stroke-width="1.6" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2.6 3 Q3 26 2.4 47" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>`;
export const STRIES_ART = `<path d="M-3 -22 L-3 4 M0 -24 L0 6 M3 -22 L3 4" stroke="#7a1f1c" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`;

export const element: AppearanceElement = {
  key: 'membres-rouges', label: 'Membres rouges (démon)', category: 'trait',
  overlays: [
    { bone: 'epauleG', svg: BRAS_ROUGE_ART },
    { bone: 'epauleD', svg: BRAS_ROUGE_ART },
    { bone: 'cuisseG', svg: CUISSE_ROUGE_ART },
    { bone: 'cuisseD', svg: CUISSE_ROUGE_ART },
    { bone: 'torse', svg: STRIES_ART },
  ],
};
