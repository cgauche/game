import type { PropViz } from '../../types';

// Pupitre du chef d'orchestre : estrade de bois, pupitre tripode à plan incliné portant une
// partition — la fosse d'orchestre de l'Opéra. Se lit « pupitre/orchestre » au premier coup d'œil.
export const prop: PropViz = {
  id: 'pupitre-chef',
  label: 'Pupitre de chef',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="24" ry="7" fill="#000" opacity="0.2"/>` +
    `<path d="M38 138 L82 138 L86 149 L34 149 Z" fill="#5e462a"/><rect x="38" y="129" width="44" height="10" rx="1" fill="#6e5230"/><path d="M38 129 L82 129" stroke="#4a3520" stroke-width="1.5"/>` +
    `<rect x="58" y="86" width="4" height="44" fill="#2b2b2e"/><path d="M60 128 L49 138 M60 128 L71 138 M60 128 L60 138" stroke="#2b2b2e" stroke-width="2.6" fill="none"/>` +
    `<path d="M43 80 L79 71 L81 85 L45 94 Z" fill="#3a3a3f"/><path d="M43 80 L79 71" stroke="#1f1f22" stroke-width="2"/>` +
    `<path d="M47 82 L75 74 L76 84 L48 91 Z" fill="#efe8d2"/><path d="M50 83 L73 77 M50 85 L73 79 M50 87 L73 81" stroke="#9a9486" stroke-width="0.8"/></g>`,
};
