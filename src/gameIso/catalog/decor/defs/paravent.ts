import type { PropViz } from '../../types';

// Paravent : cloison pliante à trois panneaux de toile tendue sur cadre, derrière laquelle les artistes
// se changent dans les loges/vestiaires. Cf. plan officiel NADJ p.40 (paravents des vestiaires des chœurs).
export const prop: PropViz = {
  id: 'paravent',
  label: 'Paravent',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="36" ry="7" fill="#000" opacity="0.2"/>` +
    // trois panneaux en accordéon (perspective légère)
    `<path d="M26 64 L48 58 L48 142 L26 146 Z" fill="#7a6a52"/>` +
    `<path d="M48 58 L72 58 L72 142 L48 142 Z" fill="#8a7a60"/>` +
    `<path d="M72 58 L94 64 L94 146 L72 142 Z" fill="#6e5e46"/>` +
    // cadres
    `<path d="M26 64 L48 58 L48 142 L26 146 Z" fill="none" stroke="#4a3c28" stroke-width="2"/>` +
    `<path d="M48 58 L72 58 L72 142 L48 142 Z" fill="none" stroke="#4a3c28" stroke-width="2"/>` +
    `<path d="M72 58 L94 64 L94 146 L72 142 Z" fill="none" stroke="#4a3c28" stroke-width="2"/>` +
    // liseré décoratif haut
    `<path d="M30 70 L46 65 M52 64 L68 64 M76 65 L90 70" stroke="#b58a4a" stroke-width="2" opacity="0.7"/></g>`,
};
