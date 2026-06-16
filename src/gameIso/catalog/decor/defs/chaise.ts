import type { PropViz } from '../../types';

// Chaise en bois : assise, dossier à barreaux, quatre pieds. Le siège des pièces de service du théâtre
// (loges d'artistes, bureaux, costumiers) — distincte du fauteuil de loge capitonné. Cf. plan NADJ p.40.
export const prop: PropViz = {
  id: 'chaise',
  label: 'Chaise',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="27" ry="7" fill="#000" opacity="0.2"/>` +
    // pieds avant + arrière
    `<rect x="42" y="100" width="5" height="46" fill="#5a3c22"/><rect x="73" y="100" width="5" height="46" fill="#5a3c22"/>` +
    `<rect x="50" y="98" width="4" height="44" fill="#4a3018"/><rect x="66" y="98" width="4" height="44" fill="#4a3018"/>` +
    // assise (dessus en perspective)
    `<path d="M40 98 L80 98 L74 92 L46 92 Z" fill="#8a6038"/>` +
    `<rect x="40" y="98" width="40" height="6" rx="1.5" fill="#6e4a28"/>` +
    // montants du dossier
    `<rect x="44" y="48" width="5" height="50" fill="#5a3c22"/><rect x="71" y="48" width="5" height="50" fill="#5a3c22"/>` +
    // barreaux du dossier
    `<rect x="44" y="52" width="32" height="6" rx="2" fill="#7a5230"/>` +
    `<rect x="53" y="58" width="4" height="34" fill="#6e4a28"/><rect x="63" y="58" width="4" height="34" fill="#6e4a28"/>` +
    `<rect x="44" y="86" width="32" height="5" rx="2" fill="#7a5230"/>` +
    // barre d'entretoise entre pieds
    `<rect x="44" y="124" width="32" height="4" rx="1.5" fill="#4a3018"/></g>`,
};
