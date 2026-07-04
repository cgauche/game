import type { AppearanceElement } from '../types';
import { WINGS } from '../../wings';

// Ailes emplumées poussant dans le dos (mutation) : RÉUTILISE l'art du registre wings (même
// silhouette que le trait Vol / le sort « Envol »), ancré sur l'os torse, DERRIÈRE le corps de
// face (layer -2) et par-dessus le dos de dos. Trois vues codifiées (cf. dorsal.ts).
export const element: AppearanceElement = {
  key: 'ailes', label: 'Ailes', category: 'mutation',
  overlays: [
    { bone: 'torse', svg: WINGS.plumes.front, view: 'front', layer: -2 },
    { bone: 'torse', svg: WINGS.plumes.back, view: 'back', layer: 70 },
    { bone: 'torse', svg: WINGS.plumes.profile, view: 'profile' },
  ],
};
