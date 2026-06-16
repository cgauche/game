import type { PropViz } from '../../types';

// Bureau : plateau en perspective, caisson à tiroirs d'un côté + pied simple de l'autre, une feuille de
// papier posée dessus. Mobilier des bureaux du concierge/gestionnaire et du régisseur. Cf. plan NADJ p.40.
export const prop: PropViz = {
  id: 'bureau',
  label: 'Bureau',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="42" ry="9" fill="#000" opacity="0.2"/>` +
    // pied simple (gauche)
    `<rect x="26" y="104" width="6" height="42" fill="#4a3018"/><rect x="38" y="104" width="6" height="42" fill="#4a3018"/>` +
    // caisson à tiroirs (droite)
    `<rect x="68" y="104" width="28" height="42" rx="1.5" fill="#5a3c22"/>` +
    `<rect x="68" y="104" width="28" height="42" rx="1.5" fill="none" stroke="#3a2614" stroke-width="1.5"/>` +
    `<rect x="71" y="108" width="22" height="10" rx="1.5" fill="#6e4a28"/>` +
    `<rect x="71" y="120" width="22" height="10" rx="1.5" fill="#6e4a28"/>` +
    `<rect x="71" y="132" width="22" height="10" rx="1.5" fill="#6e4a28"/>` +
    // boutons de tiroir laiton
    `<circle cx="82" cy="113" r="2" fill="#d8a93b"/><circle cx="82" cy="125" r="2" fill="#d8a93b"/><circle cx="82" cy="137" r="2" fill="#d8a93b"/>` +
    // plateau (dessus en perspective + tranche)
    `<path d="M18 100 L102 100 L94 90 L26 90 Z" fill="#8a6038"/>` +
    `<rect x="18" y="100" width="84" height="8" rx="2" fill="#6e4a28"/>` +
    `<path d="M26 90 L94 90 L102 100" fill="none" stroke="#9a6e42" stroke-width="1.2" opacity="0.6"/>` +
    // feuille de papier posée + encrier
    `<path d="M44 96 L70 96 L68 88 L42 88 Z" fill="#e8e2d2"/>` +
    `<path d="M47 91 L64 91 M46 93 L65 93" stroke="#9a8a6a" stroke-width="0.9"/>` +
    `<rect x="74" y="88" width="8" height="8" rx="1.5" fill="#2a3142"/><circle cx="78" cy="89" r="1.6" fill="#d8a93b"/></g>`,
};
