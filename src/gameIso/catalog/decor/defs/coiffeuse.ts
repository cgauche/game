import type { PropViz } from '../../types';

// Coiffeuse de loge : table de toilette à tiroirs surmontée d'un miroir encadré, avec deux chandeliers.
// Le meuble emblématique des vestiaires des chœurs / loges d'artistes du théâtre (les acteurs s'y
// maquillent). Cf. plan officiel NADJ p.40 (coiffeuses contre le mur des vestiaires 11/12/13).
export const prop: PropViz = {
  id: 'coiffeuse',
  label: 'Coiffeuse',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="34" ry="8" fill="#000" opacity="0.22"/>` +
    // pieds + caisson à tiroirs
    `<rect x="34" y="112" width="6" height="34" fill="#5a3c22"/><rect x="80" y="112" width="6" height="34" fill="#5a3c22"/>` +
    `<rect x="36" y="108" width="48" height="30" rx="2" fill="#6e4a28"/>` +
    `<rect x="40" y="113" width="40" height="9" rx="1.5" fill="#7a5230"/><rect x="40" y="125" width="40" height="9" rx="1.5" fill="#7a5230"/>` +
    `<circle cx="60" cy="118" r="2" fill="#d8a93b"/><circle cx="60" cy="130" r="2" fill="#d8a93b"/>` +
    // miroir encadré ovale
    `<ellipse cx="60" cy="78" rx="22" ry="28" fill="#5a3c22"/>` +
    `<ellipse cx="60" cy="78" rx="17" ry="23" fill="#b9cdd4"/>` +
    `<path d="M50 62 Q60 70 56 92" stroke="#dcebf0" stroke-width="3" fill="none" opacity="0.7"/>` +
    // chandeliers d'appoint
    `<rect x="40" y="100" width="3" height="10" fill="#b58a2e"/><circle cx="41.5" cy="98" r="3" fill="#f0d98a"/>` +
    `<rect x="77" y="100" width="3" height="10" fill="#b58a2e"/><circle cx="78.5" cy="98" r="3" fill="#f0d98a"/></g>`,
};
