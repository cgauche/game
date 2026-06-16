import type { PropViz } from '../../types';

// Chevalet de sciage (tréteau) portant une planche en cours de débit, avec une scie posée dessus. Le
// poste de travail de la « Charpenterie et décors » (26) du théâtre. Cf. plan officiel NADJ p.40
// (tréteaux et bois de charpente).
export const prop: PropViz = {
  id: 'scie-chevalet',
  label: 'Chevalet de sciage',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="38" ry="8" fill="#000" opacity="0.2"/>` +
    // tréteau (pieds en X)
    `<path d="M34 146 L52 104 M50 146 L36 104" stroke="#5a3c22" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M72 146 L88 104 M86 146 L70 104" stroke="#5a3c22" stroke-width="6" stroke-linecap="round"/>` +
    `<rect x="34" y="100" width="56" height="8" rx="2" fill="#6e4a28"/>` +
    // planche en débit posée dessus
    `<path d="M24 96 L102 90 L102 99 L24 105 Z" fill="#9a7a4a"/>` +
    `<path d="M24 96 L102 90" stroke="#7a5a30" stroke-width="1.5" opacity="0.7"/>` +
    // scie posée
    `<path d="M58 90 L86 84 L86 88 L58 94 Z" fill="#b9c0c6"/>` +
    `<path d="M58 94 L86 88" stroke="#8a9098" stroke-width="1" opacity="0.8"/>` +
    `<rect x="54" y="88" width="8" height="6" rx="2" fill="#5a3c22"/></g>`,
};
