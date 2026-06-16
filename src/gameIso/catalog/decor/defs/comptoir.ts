import type { PropViz } from '../../types';

// Comptoir : meuble de service à plateau (zinc/marbre) sur un bâti à panneaux. Sert de comptoir du
// « Bar des balcons » (36) à l'étage ET du « Vestiaire et vente des billets » (6) au rez. Cf. plan
// officiel NADJ p.40/p.41 (longs comptoirs en L des bars et de la billetterie).
export const prop: PropViz = {
  id: 'comptoir',
  label: 'Comptoir',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="44" ry="8" fill="#000" opacity="0.22"/>` +
    // bâti à panneaux
    `<rect x="24" y="104" width="72" height="42" fill="#5a3c22"/>` +
    `<rect x="29" y="110" width="28" height="30" rx="2" fill="#6e4a28"/><rect x="63" y="110" width="28" height="30" rx="2" fill="#6e4a28"/>` +
    `<rect x="29" y="110" width="28" height="30" rx="2" fill="none" stroke="#4a3018" stroke-width="1.5"/>` +
    `<rect x="63" y="110" width="28" height="30" rx="2" fill="none" stroke="#4a3018" stroke-width="1.5"/>` +
    // plateau débordant (perspective)
    `<path d="M18 104 L102 104 L96 96 L24 96 Z" fill="#9a8a6a"/>` +
    `<rect x="18" y="104" width="84" height="7" rx="2" fill="#7a6a4a"/>` +
    `<path d="M24 96 L96 96" stroke="#b9a97a" stroke-width="1.5" opacity="0.7"/>` +
    // moulure laiton
    `<rect x="18" y="101" width="84" height="2.5" fill="#c9a14a" opacity="0.8"/></g>`,
};
