import type { PropViz } from '../../types';
import { project } from '../../../rig/facing';
import { P } from '../../decorPalette';

// Un SEUL fauteuil d'opéra (1×1) : velours rouge + dorures. Contrairement à `rangee-sieges` (bloc 3×1
// figé), un siège occupe UNE case → trois sièges alignés se RÉORIENTENT correctement quand on tourne la
// caméra (la rangée de 3 cases devient une colonne de 3 cases à 90°, ce qu'un sprite-rangée ne sait pas
// faire). ORIENTATION : on PIVOTE avec la caméra via `project(facing, camRot)` (le MÊME helper que les
// rigs — `rig/facing.ts`). `facing` = orientation MONDE (la scène est au Nord) ; `project` la projette
// dans l'orientation caméra → vue avant/arrière (un facing cardinal ne donne jamais de profil).

/** Un fauteuil vu de FACE (assise + dossier vers la caméra), centré sur cx, pieds ~y=147. */
const front = (cx: number) =>
  `<g><rect x="${cx - 24}" y="74" width="48" height="58" rx="15" fill="${P.sangFonce5}"/>` +
  `<rect x="${cx - 17}" y="80" width="34" height="46" rx="11" fill="${P.sangFonce14}"/>` +
  `<rect x="${cx - 17}" y="80" width="34" height="12" rx="5" fill="${P.boisMoyen21}"/>` +
  `<path d="M${cx - 24} 119 Q${cx} 133 ${cx + 24} 119 L${cx + 24} 138 Q${cx} 150 ${cx - 24} 138 Z" fill="${P.sangFonce11}"/>` +
  `<rect x="${cx - 28}" y="103" width="9" height="44" rx="3" fill="${P.boisMoyen23}"/>` +
  `<rect x="${cx + 19}" y="103" width="9" height="44" rx="3" fill="${P.boisMoyen23}"/>` +
  `<circle cx="${cx - 24}" cy="103" r="5.5" fill="${P.orMoyen9}"/><circle cx="${cx + 24}" cy="103" r="5.5" fill="${P.orMoyen9}"/></g>`;

/** Un fauteuil vu DE DOS (le public regarde la scène) : dossier bombé vers la caméra, rail haut doré,
 *  couture centrale ; l'assise est cachée derrière. Centré sur cx, pieds ~y=147. */
const back = (cx: number) =>
  `<g><rect x="${cx - 24}" y="66" width="48" height="74" rx="17" fill="${P.sangFonce}"/>` + // dos sombre
  `<rect x="${cx - 18}" y="71" width="36" height="66" rx="13" fill="${P.sangFonce10}"/>` + // bombé clair
  `<rect x="${cx - 18}" y="71" width="36" height="10" rx="5" fill="${P.boisMoyen21}"/>` + // rail haut doré
  `<line x1="${cx}" y1="84" x2="${cx}" y2="133" stroke="${P.sangSombre5}" stroke-width="2.5" opacity="0.6"/>` + // couture
  `<rect x="${cx - 24}" y="133" width="8" height="14" fill="${P.boisSombre11}"/><rect x="${cx + 16}" y="133" width="8" height="14" fill="${P.boisSombre11}"/></g>`; // pieds entrevus

export const prop: PropViz = {
  id: 'siege',
  label: 'Siège',
  searchable: false,
  render: (_params, ctx) => {
    const { view, mirror } = project(ctx?.dir ?? 'S', ctx?.dims?.rot ?? 0);
    const seat = view === 'back' ? back : front; // un facing cardinal → 'front'/'back' (jamais 'profile')
    const body =
      `<g><ellipse cx="60" cy="147" rx="28" ry="7" fill="${P.ombre}" opacity="0.22"/>` +
      seat(60) +
      `</g>`;
    return mirror ? `<g transform="translate(120,0) scale(-1,1)">${body}</g>` : body; // miroir = regarde à gauche
  },
};
