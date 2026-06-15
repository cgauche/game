import type { PropViz } from '../../types';
import { project } from '../../../rig/facing';

// Rangée de fauteuils d'opéra (3×1) : velours rouge + dorures, quatre sièges alignés — remplit le
// parterre. ORIENTATION : on PIVOTE avec la caméra via `project(facing, camRot)` (le MÊME helper que les
// rigs de personnages — `rig/facing.ts`). `facing` = orientation MONDE (la scène est au Nord) ; `project`
// la projette dans l'orientation caméra → vue avant/arrière (un facing cardinal ne donne jamais de profil).
// Donc tourner la caméra réoriente les sièges sans qu'ils restent figés.

/** Un fauteuil vu de FACE (assise + dossier vers la caméra). */
const front = (cx: number) =>
  `<g><rect x="${cx - 13}" y="94" width="26" height="36" rx="9" fill="#7a2222"/>` +
  `<rect x="${cx - 9}" y="98" width="18" height="28" rx="6" fill="#9c3636"/>` +
  `<rect x="${cx - 9}" y="98" width="18" height="7" rx="3" fill="#c9a14a"/>` +
  `<path d="M${cx - 13} 122 Q${cx} 131 ${cx + 13} 122 L${cx + 13} 134 Q${cx} 141 ${cx - 13} 134 Z" fill="#8e2b2b"/>` +
  `<rect x="${cx - 15.5}" y="112" width="5" height="26" rx="2" fill="#b58a2e"/>` +
  `<rect x="${cx + 10.5}" y="112" width="5" height="26" rx="2" fill="#b58a2e"/>` +
  `<circle cx="${cx - 13}" cy="112" r="3.3" fill="#d8b24e"/><circle cx="${cx + 13}" cy="112" r="3.3" fill="#d8b24e"/></g>`;

/** Un fauteuil vu DE DOS (le public regarde la scène) : dossier bombé vers la caméra, rail haut doré,
 *  couture centrale ; l'assise est cachée derrière. */
const back = (cx: number) =>
  `<g><rect x="${cx - 13}" y="90" width="26" height="46" rx="10" fill="#641c1c"/>` + // dos sombre
  `<rect x="${cx - 10}" y="93" width="20" height="41" rx="8" fill="#8a2a2a"/>` + // bombé clair
  `<rect x="${cx - 10}" y="93" width="20" height="6" rx="3" fill="#c9a14a"/>` + // rail haut doré
  `<line x1="${cx}" y1="101" x2="${cx}" y2="131" stroke="#531616" stroke-width="1.5" opacity="0.6"/>` + // couture
  `<rect x="${cx - 13}" y="131" width="4.5" height="8" fill="#3a2c1e"/><rect x="${cx + 8.5}" y="131" width="4.5" height="8" fill="#3a2c1e"/></g>`; // pieds entrevus

export const prop: PropViz = {
  id: 'rangee-sieges',
  foot: { w: 3, h: 1 },
  label: 'Rangée de fauteuils',
  render: (_params, ctx) => {
    const { view, mirror } = project(ctx?.dir ?? 'S', ctx?.dims?.rot ?? 0);
    const seat = view === 'back' ? back : front; // un facing cardinal → 'front'/'back' (jamais 'profile')
    const row = `<g><ellipse cx="60" cy="147" rx="55" ry="9" fill="#000" opacity="0.22"/>` +
      `<path d="M6 136 L114 136 L114 150 L6 150 Z" fill="#3a2c1e"/><path d="M6 136 L114 136" stroke="#241a10" stroke-width="2"/>` +
      [20, 48, 76, 104].map(seat).join('') +
      `</g>`;
    return mirror ? `<g transform="translate(120,0) scale(-1,1)">${row}</g>` : row; // miroir = regarde à gauche
  },
};
