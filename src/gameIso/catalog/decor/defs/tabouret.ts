import type { PropViz } from '../../types';

// Tabouret : petit siège sans dossier, assise ronde + trois pieds écartés. Meuble d'appoint des loges
// d'artistes, du passage et des ateliers du théâtre. Cf. plan officiel NADJ p.40.
export const prop: PropViz = {
  id: 'tabouret',
  label: 'Tabouret',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="24" ry="6" fill="#000" opacity="0.2"/>` +
    // trois pieds écartés
    `<path d="M48 118 L40 145" stroke="#5a3c22" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M72 118 L80 145" stroke="#5a3c22" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M60 120 L60 146" stroke="#4a3018" stroke-width="6" stroke-linecap="round"/>` +
    // entretoise basse
    `<path d="M44 132 L76 132" stroke="#4a3018" stroke-width="3.5"/>` +
    // assise ronde (tranche + dessus)
    `<ellipse cx="60" cy="116" rx="24" ry="9" fill="#6e4a28"/>` +
    `<ellipse cx="60" cy="112" rx="24" ry="8" fill="#8a6038"/>` +
    `<ellipse cx="60" cy="112" rx="16" ry="5" fill="#9a6e42" opacity="0.6"/></g>`,
};
