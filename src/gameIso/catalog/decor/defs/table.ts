import type { PropViz } from '../../types';

// Table en bois : plateau (dessus en perspective) + quatre pieds. Meuble de base des pièces de service
// du théâtre (salle verte, loges d'artistes, costumiers). Cf. plan officiel NADJ p.40.
export const prop: PropViz = {
  id: 'table',
  label: 'Table',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="42" ry="9" fill="#000" opacity="0.2"/>` +
    `<rect x="34" y="106" width="6" height="42" fill="#5a3c22"/><rect x="80" y="106" width="6" height="42" fill="#5a3c22"/>` + // pieds avant
    `<rect x="47" y="104" width="5" height="40" fill="#4a3018"/><rect x="68" y="104" width="5" height="40" fill="#4a3018"/>` + // pieds arrière
    `<path d="M22 102 L98 102 L90 94 L30 94 Z" fill="#8a6038"/>` + // dessus (perspective)
    `<rect x="22" y="102" width="76" height="8" rx="2" fill="#6e4a28"/>` + // tranche du plateau
    `<path d="M30 94 L90 94 L98 102" fill="none" stroke="#9a6e42" stroke-width="1.5" opacity="0.7"/></g>`,
};
