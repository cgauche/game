import type { PropViz } from '../../types';

// Rideau de scène d'opéra (3×1) : embrasure sombre encadrée de deux tentures de velours rouge
// nouées sur les côtés, lambrequin doré festonné, glands à embrasse (ballant `sway`). Lit « la scène ».
export const prop: PropViz = {
  id: 'rideau-scene',
  foot: { w: 3, h: 1 },
  label: 'Rideau de scène',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="54" ry="9" fill="#000" opacity="0.2"/>` +
    `<rect x="16" y="22" width="88" height="120" fill="#16121a"/>` +
    `<path d="M16 138 L104 138 L104 142 L16 142 Z" fill="#2a2230"/>` +
    `<path d="M8 22 Q44 70 34 142 L8 142 Z" fill="#7a2222"/>` +
    `<path d="M8 22 Q34 70 26 130" stroke="#9c3636" stroke-width="4" fill="none" opacity="0.8"/>` +
    `<path d="M16 24 Q40 72 32 138" stroke="#5e1818" stroke-width="3" fill="none" opacity="0.7"/>` +
    `<path d="M112 22 Q76 70 86 142 L112 142 Z" fill="#7a2222"/>` +
    `<path d="M112 22 Q86 70 94 130" stroke="#9c3636" stroke-width="4" fill="none" opacity="0.8"/>` +
    `<path d="M104 24 Q80 72 88 138" stroke="#5e1818" stroke-width="3" fill="none" opacity="0.7"/>` +
    `<path d="M6 18 L114 18 L114 34 Q98 48 86 34 Q74 48 60 34 Q46 48 34 34 Q22 48 6 34 Z" fill="#c9a14a"/>` +
    `<path d="M6 18 L114 18" stroke="#8a6a24" stroke-width="2"/>` +
    `<g fill="#8a6a24"><circle cx="34" cy="40" r="2.4"/><circle cx="60" cy="40" r="2.6"/><circle cx="86" cy="40" r="2.4"/></g>` +
    `<g class="sway"><path d="M30 96 L34 96 L33 108 L31 108 Z" fill="#d8b24e"/><circle cx="32" cy="110" r="3" fill="#d8b24e"/>` +
    `<path d="M86 96 L90 96 L89 108 L87 108 Z" fill="#d8b24e"/><circle cx="88" cy="110" r="3" fill="#d8b24e"/></g></g>`,
};
