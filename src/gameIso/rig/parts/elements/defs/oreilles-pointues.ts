import type { AppearanceElement } from '../types';
import { LAYER_OVER_CHEVEUX_UNDER_COIFFE } from '../../../bones';

// Oreilles pointues aux tempes (elfes) — tell de l'elfe, couleur @peau.
// Vues ÉCLATÉES (patron des cornes, cf. docs/creer-une-creature.md §4) : paire de face ET de
// dos ; de PROFIL, UNE seule forme balayée vers l'arrière (-x), base posée sur l'oreille du
// visage — l'oreille lointaine est occultée par le crâne (pas de farSide : rien n'en dépasse).
const PAIRE_FACE =
  '<g>'
  + '<path d="M-8 7 Q-15 4 -14 -3 Q-11 1 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M8 7 Q15 4 14 -3 Q11 1 7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '</g>';

// De dos : même silhouette (la paire dépasse du crâne), pavillon vu de derrière → pli
// interne remplacé par une ombre du dos du cartilage, vers le crâne.
const PAIRE_DOS =
  '<g>'
  + '<path d="M-8 7 Q-15 4 -14 -3 Q-11 1 -7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M8 7 Q15 4 14 -3 Q11 1 7 5 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-8.6 5.8 Q-11.5 3.6 -12.6 -0.8" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/>'
  + '<path d="M8.6 5.8 Q11.5 3.6 12.6 -0.8" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/>'
  + '</g>';

// De profil (le personnage regarde +x) : base sur l'oreille du visage (x≈-4..-2, y≈6..9.5),
// pointe balayée vers l'arrière-haut au-delà du bord du crâne.
const PROFIL =
  '<g>'
  + '<path d="M-2.2 6.2 Q-4 5 -6 4.6 Q-10 3.6 -13.5 -1.5 Q-12.8 3.4 -9.8 6.8 Q-6.8 9.8 -3.2 9.5 Q-2.1 8 -2.2 6.2 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-4.2 8.2 Q-8.2 6.6 -11 2.2" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.7"/>'
  + '</g>';

export const element: AppearanceElement = {
  key: 'oreilles-pointues', label: 'Oreilles pointues', category: 'trait',
  overlays: [
    { bone: 'tete', svg: PAIRE_FACE, scale: 'bone', layer: LAYER_OVER_CHEVEUX_UNDER_COIFFE, view: 'front' },
    { bone: 'tete', svg: PAIRE_DOS, scale: 'bone', layer: LAYER_OVER_CHEVEUX_UNDER_COIFFE, view: 'back' },
    { bone: 'tete', svg: PROFIL, scale: 'bone', layer: LAYER_OVER_CHEVEUX_UNDER_COIFFE, view: 'profile' },
  ],
};
