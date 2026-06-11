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

// --- Variante CUIR (membrane de chauve-souris : furie du Chaos, démons ailés) ---------------
// Mêmes ancrages/vues que les ailes emplumées ; membrane en TOKENS @peau (suit la robe de la
// créature), bord inférieur festonné entre les doigts osseux, pouce-griffe au coude.
const aileCuir = (s: 1 | -1) =>
  `<path d="M${5 * s} -15 Q${13 * s} -26 ${17 * s} -38 L${20 * s} -34 Q${23 * s} -22 ${20 * s} -12 L${17 * s} -14 Q${18 * s} -4 ${14 * s} 2 L${11 * s} -2 Q${12 * s} 5 ${8 * s} 9 Q${10 * s} -4 ${6 * s} -11 Z" fill="@peauO" stroke="#1a1210" stroke-width="0.7"/>`
  + `<path d="M${6 * s} -14 Q${12 * s} -25 ${16 * s} -36" stroke="@peau" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
  + `<path d="M${18 * s} -33 Q${20 * s} -22 ${18 * s} -13 M${16 * s} -15 Q${17 * s} -6 ${13 * s} 0 M${10 * s} -3 Q${11 * s} 3 ${8 * s} 8" stroke="@peau" stroke-width="0.6" fill="none" opacity="0.8"/>`
  + `<path d="M${16 * s} -37 l${2.4 * s} -2.6 l${0.8 * s} 3.4 Z" fill="#cdbfa4" stroke="#1a1210" stroke-width="0.4"/>`;

/** Ailes de cuir — FACE : repliées derrière les épaules. */
export const AILES_CUIR_FRONT = `<g data-trait="vol">${aileCuir(1)}${aileCuir(-1)}</g>`;
/** Ailes de cuir — DOS : par-dessus le torse, pli central. */
export const AILES_CUIR_BACK = `<g data-trait="vol">${aileCuir(1)}${aileCuir(-1)}<path d="M-2 -15 Q0 -5 0 7 Q0 -5 2 -15" stroke="#1a1210" stroke-width="0.8" fill="none" opacity="0.6"/></g>`;
/** Ailes de cuir — PROFIL : une seule aile vers l'arrière. */
export const AILES_CUIR_PROFILE =
  '<g data-trait="vol">'
  + '<path d="M-2 -12 Q-12 -25 -17 -39 L-21 -34 Q-25 -21 -21 -10 L-17 -13 Q-19 -2 -14 4 L-11 0 Q-12 6 -7 10 Q-10 -3 -5 -10 Z" fill="@peauO" stroke="#1a1210" stroke-width="0.7"/>'
  + '<path d="M-3 -11 Q-11 -24 -16 -36" stroke="@peau" stroke-width="1.3" fill="none" stroke-linecap="round"/>'
  + '<path d="M-19 -33 Q-22 -21 -19 -12 M-16 -14 Q-18 -4 -13 2 M-10 -1 Q-11 4 -8 9" stroke="@peau" stroke-width="0.6" fill="none" opacity="0.8"/>'
  + '<path d="M-16 -38 l-2.6 -2.4 l-0.6 3.6 Z" fill="#cdbfa4" stroke="#1a1210" stroke-width="0.4"/>'
  + '</g>';
