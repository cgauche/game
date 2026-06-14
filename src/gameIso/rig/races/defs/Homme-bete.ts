// Homme-bête : trapu musclé voûté, légèrement étiré en hauteur.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Homme-bête',
  gabarit: 'trapu-massif',
  gabaritOverride: { sl: 1.02, st: 1.35, legs: 0.92 },
  palette: { peau: "#6b4a32", peauO: "#4a3322", peauH: "#876040", cheveux: "#3a281a", cheveuxO: "#241810", cheveuxH: "#4c3624" },
  pose: { torse: 14, cou: 12, tete: -9, epauleG: 5, epauleD: 5 },
  tenue: 'Nu',
  head: 'caprin',
  legs: 'chevre',
  // PAS de cornes ici : la taille des cornes = statut de l'homme-bête (LDB 83), portée par chaque
  // def créature (Gor grandes / Ungor vestigiales / Chamane caprines) en perso.features.
  features: feat('queue', 'pelage'),
};
