// Nain : trapu et solide, jambes très courtes.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Nain',
  gabarit: 'courtaud',
  tenue: 'artisan',
  palette:  { cheveux: "#5a3a1e", peauO: "#d98e6a", peau: "#e0b48a", peauH: "#e9c39c", cheveuxO: "#54341a", cheveuxH: "#6a4423" },
  paletteF: { cheveux: "#7a5230", peau: "#e0b48a", peauO: "#d6a87c", cheveuxO: "#5e3412", cheveuxH: "#9a5a22" },
  features: feat('barbe-naine'),
};
