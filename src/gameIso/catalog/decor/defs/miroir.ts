import type { PropViz } from '../../types';

// Miroir psyché : grande glace argentée inclinée dans un cadre de bois pivotant, sur pied à deux montants
// et patins. Le miroir des loges d'artistes où l'on se costume. Cf. plan officiel NADJ p.40.
export const prop: PropViz = {
  id: 'miroir',
  label: 'Miroir',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="28" ry="7" fill="#000" opacity="0.2"/>` +
    // pied : deux montants + patins
    `<path d="M40 142 L46 96 M80 142 L74 96" stroke="#5a3c22" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M30 144 L52 144 M68 144 L90 144" stroke="#4a3018" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M46 118 L74 118" stroke="#4a3018" stroke-width="3.5"/>` +
    // axe de pivot (boutons laiton)
    `<circle cx="44" cy="92" r="3" fill="#d8a93b"/><circle cx="76" cy="92" r="3" fill="#d8a93b"/>` +
    // cadre incliné (légère perspective : haut décalé)
    `<path d="M40 30 L84 36 L80 100 L36 96 Z" fill="#6e4a28"/>` +
    `<path d="M40 30 L84 36 L80 100 L36 96 Z" fill="none" stroke="#7a5230" stroke-width="2"/>` +
    // glace argentée inclinée + reflets
    `<path d="M46 38 L78 42 L74 92 L44 89 Z" fill="#aebccb"/>` +
    `<path d="M46 38 L78 42 L74 92 L44 89 Z" fill="#c8d4e0" opacity="0.5"/>` +
    `<path d="M52 42 L58 88 M64 44 L70 86" stroke="#e6eef5" stroke-width="2.5" opacity="0.7" stroke-linecap="round"/>` +
    // fronton de cadre
    `<path d="M40 30 L84 36 L82 28 Q62 22 42 24 Z" fill="#7a5230"/></g>`,
};
