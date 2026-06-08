// Démon : élancé nerveux, membres longs.
import type { RaceDef } from '../types';
import { OV_CORNES_DEMON, OV_BRAS_ROUGE, OV_CUISSE_ROUGE, OV_STRIES } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Démon',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.06, legs: 1.06 },
  palette: { peau: "#9a201a", peauO: "#601010", peauH: "#c4382c", cheveux: "#1a1410", cheveuxO: "#0a0806", cheveuxH: "#2c2620" },
  career: 'Nu',
  head: 'demon',
  // Cornes noires derrière la tête ; membres rouges sang + stries au torse par-dessus la peau.
  features: [
    { bone: 'tete',    svg: OV_CORNES_DEMON,  scale: 'bone', layer: -2 },
    { bone: 'epauleG', svg: OV_BRAS_ROUGE,    scale: 'bone', layer: 98 },
    { bone: 'epauleD', svg: OV_BRAS_ROUGE,    scale: 'bone', layer: 98 },
    { bone: 'cuisseG', svg: OV_CUISSE_ROUGE,  scale: 'bone', layer: 98 },
    { bone: 'cuisseD', svg: OV_CUISSE_ROUGE,  scale: 'bone', layer: 98 },
    { bone: 'torse',   svg: OV_STRIES,        scale: 'bone', layer: 98 },
  ],
};
