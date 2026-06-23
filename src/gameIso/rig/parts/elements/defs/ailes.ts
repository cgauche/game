import type { AppearanceElement } from '../types';
import { AILES_FRONT, AILES_BACK, AILES_PROFILE } from '../../wings';

// Ailes emplumées poussant dans le dos (mutation) : RÉUTILISE l'art partagé de wings.ts (même
// silhouette que le trait Vol / le sort « Envol »), ancré sur l'os torse, DERRIÈRE le corps de
// face (layer -2) et par-dessus le dos de dos. Trois vues codifiées (cf. dorsal.ts).
export const element: AppearanceElement = {
  key: 'ailes', label: 'Ailes', category: 'mutation',
  overlays: [
    { bone: 'torse', svg: AILES_FRONT, view: 'front', layer: -2 },
    { bone: 'torse', svg: AILES_BACK, view: 'back', layer: 70 },
    { bone: 'torse', svg: AILES_PROFILE, view: 'profile' },
  ],
};
