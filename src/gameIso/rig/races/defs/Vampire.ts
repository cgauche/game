// Vampire : élancé aristocratique, légèrement plus court que le Haut-Elfe.
import type { RaceDef } from '../types';
import { OV_CROCS } from '../../parts/monstrous';
export const race: RaceDef = {
  id: 'Vampire',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.04, st: 0.96, legs: 1.0 },
  palette: { peau: "#e8cdb6", peauO: "#c2a288", peauH: "#f4e2d0", cheveux: "#161214", cheveuxO: "#0a0808", cheveuxH: "#2c262a" },
  career: 'Vampire',
  dropHeadgear: true,
  sex: 'M',
  parts: { cheveux: 1, visage: 0 },
  colors: { vet1: "#241018", vet2: "#6a0e18", cuir: "#1a0e12", metal: "#8a8f9e" },
  // Crocs discrets visibles de face seulement (calque par-dessus le visage humain).
  features: [
    { bone: 'tete', svg: OV_CROCS, scale: 'bone', layer: 98, view: 'front' },
  ],
};
