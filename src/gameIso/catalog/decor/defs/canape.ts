import type { PropViz } from '../../types';
import { project } from '../../../rig/facing';

// Canapé capitonné de velours et dorures : le siège d'honneur de la LOGE ROYALE (30) et du Salon des
// Seigneurs (39) du théâtre. Comme le siège, il PIVOTE avec la caméra (1×1, helper `project`) pour
// toujours présenter son dossier/assise dans le bon sens. Cf. plan officiel NADJ p.41.
const front = (cx: number) =>
  `<g><rect x="${cx - 38}" y="84" width="76" height="56" rx="12" fill="#6e1e1e"/>` + // dossier
  `<rect x="${cx - 34}" y="90" width="68" height="20" rx="8" fill="#8e2e2e"/>` + // capiton haut
  `<rect x="${cx - 34}" y="90" width="68" height="8" rx="4" fill="#c9a14a"/>` + // rail doré
  `<path d="M${cx - 38} 112 Q${cx} 126 ${cx + 38} 112 L${cx + 38} 138 Q${cx} 150 ${cx - 38} 138 Z" fill="#9c3636"/>` + // assise
  `<path d="M${cx - 18} 96 L${cx - 18} 120 M${cx + 18} 96 L${cx + 18} 120" stroke="#641c1c" stroke-width="2" opacity="0.6"/>` + // capitons
  `<rect x="${cx - 42}" y="104" width="10" height="40" rx="4" fill="#7a2424"/><rect x="${cx + 32}" y="104" width="10" height="40" rx="4" fill="#7a2424"/>` + // accoudoirs
  `<circle cx="${cx - 37}" cy="108" r="4" fill="#d8b24e"/><circle cx="${cx + 37}" cy="108" r="4" fill="#d8b24e"/></g>`;

const back = (cx: number) =>
  `<g><rect x="${cx - 38}" y="78" width="76" height="64" rx="14" fill="#561818"/>` +
  `<rect x="${cx - 32}" y="83" width="64" height="54" rx="11" fill="#7a2424"/>` +
  `<rect x="${cx - 32}" y="83" width="64" height="10" rx="5" fill="#c9a14a"/>` +
  `<line x1="${cx - 12}" y1="96" x2="${cx - 12}" y2="134" stroke="#451414" stroke-width="2" opacity="0.6"/>` +
  `<line x1="${cx + 12}" y1="96" x2="${cx + 12}" y2="134" stroke="#451414" stroke-width="2" opacity="0.6"/></g>`;

export const prop: PropViz = {
  id: 'canape',
  label: 'Canapé',
  render: (_params, ctx) => {
    const { view, mirror } = project(ctx?.dir ?? 'S', ctx?.dims?.rot ?? 0);
    const seat = view === 'back' ? back : front;
    const body = `<g><ellipse cx="60" cy="147" rx="42" ry="8" fill="#000" opacity="0.22"/>${seat(60)}</g>`;
    return mirror ? `<g transform="translate(120,0) scale(-1,1)">${body}</g>` : body;
  },
};
