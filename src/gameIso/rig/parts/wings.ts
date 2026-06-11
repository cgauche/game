/**
 * AILES de bipède — repère local de l'os `torse` (centre ≈ (0,0), épaules ≈ y −18).
 * Ailes emplumées REPLIÉES dans le dos (silhouette sobre : le rig reste lisible),
 * trois vues : de face elles dépassent DERRIÈRE les épaules ; de dos elles couvrent
 * le dos ; de profil une seule aile part vers l'arrière.
 * Servies par le trait Vol (traitVisuals) — donc aussi par le sort « Envol » — et
 * réutilisables par les créatures (harpie custom…).
 */

// Une aile repliée : membrure haute, manteau de couvertures, rémiges étagées.
const aile = (s: 1 | -1) =>
  `<path d="M${6 * s} -16 Q${15 * s} -28 ${19 * s} -36 Q${22 * s} -24 ${18 * s} -12 Q${15 * s} 0 ${9 * s} 8 Q${12 * s} -4 ${8 * s} -12 Z" fill="#cdbb9a" stroke="#5a4a38" stroke-width="0.6"/>`
  + `<path d="M${7 * s} -15 Q${14 * s} -25 ${18 * s} -33" stroke="#8a6f52" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
  + `<path d="M${16 * s} -10 Q${13 * s} 0 ${9 * s} 7 M${17 * s} -16 Q${14 * s} -6 ${10 * s} 0 M${18 * s} -22 Q${15 * s} -13 ${12 * s} -6" stroke="#8a6f52" stroke-width="0.5" fill="none" opacity="0.7"/>`;

/** Vue de FACE : les deux ailes dépassent derrière les épaules (calque behind). */
export const AILES_FRONT = `<g data-trait="vol">${aile(1)}${aile(-1)}</g>`;
/** Vue de DOS : les ailes couvrent le dos (par-dessus le torse). */
export const AILES_BACK = `<g data-trait="vol">${aile(1)}${aile(-1)}<path d="M-2 -16 Q0 -6 0 6 Q0 -6 2 -16" stroke="#5a4a38" stroke-width="0.8" fill="none" opacity="0.6"/></g>`;
/** Vue de PROFIL : une seule aile ANCRÉE AU BORD ARRIÈRE du torse (le dos est à −x quand
 *  le personnage regarde +x) et déployée vers l'arrière — pas flottante derrière le corps. */
export const AILES_PROFILE =
  '<g data-trait="vol">'
  + '<path d="M-3 -13 Q-14 -26 -20 -37 Q-24 -22 -18 -9 Q-13 3 -6 9 Q-11 -3 -6 -10 Z" fill="#cdbb9a" stroke="#5a4a38" stroke-width="0.6"/>'
  + '<path d="M-4 -12 Q-13 -24 -18 -34" stroke="#8a6f52" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
  + '<path d="M-16 -8 Q-12 2 -7 8 M-17 -15 Q-13 -5 -8 1 M-18 -22 Q-15 -13 -11 -7" stroke="#8a6f52" stroke-width="0.5" fill="none" opacity="0.7"/>'
  + '</g>';
