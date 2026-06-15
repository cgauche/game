import type { PropViz } from '../../types';

// Plante en pot : palmier d'intérieur dans un cache-pot — décor de hall/loge anodin… ou réceptacle
// idéal pour dissimuler une bombe (cf. « Une nuit à l'Opéra »).
export const prop: PropViz = {
  id: 'plante-pot',
  label: 'Plante en pot',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="20" ry="6" fill="#000" opacity="0.2"/>` +
    `<path d="M44 116 L76 116 L72 144 L48 144 Z" fill="#7a5230"/><path d="M44 116 L76 116 L75 122 L45 122 Z" fill="#8a6238"/>` +
    `<rect x="42" y="112" width="36" height="6" rx="2" fill="#6e4a2a"/><ellipse cx="60" cy="115" rx="16" ry="4" fill="#3a2a1a"/>` +
    `<g fill="#3f6b34"><path d="M60 114 Q40 84 30 56 Q44 78 60 100 Z"/><path d="M60 114 Q80 84 90 56 Q76 78 60 100 Z"/>` +
    `<path d="M60 112 Q56 76 60 48 Q64 76 60 112 Z"/><path d="M60 113 Q46 90 36 74 Q52 92 60 106 Z"/><path d="M60 113 Q74 90 84 74 Q68 92 60 106 Z"/></g>` +
    `<g fill="#4f7d40"><path d="M60 112 Q50 82 44 62 Q56 84 60 104 Z"/><path d="M60 112 Q70 82 76 62 Q64 84 60 104 Z"/></g></g>`,
};
