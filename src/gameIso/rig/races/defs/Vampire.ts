// Vampire : élancé aristocratique, légèrement plus court que le Haut-Elfe.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Vampire',
  gabarit: 'elance',
  gabaritOverride: { sl: 1.04, st: 0.96, legs: 1.0 },
  palette: { peau: "#e8cdb6", peauO: "#c2a288", peauH: "#f4e2d0", cheveux: "#161214", cheveuxO: "#0a0808", cheveuxH: "#2c262a" },
  tenue: 'Vampire',
  dropHeadgear: true,
  sex: 'M',
  parts: { cheveux: 1, visage: 0 },
  colors: { vet1: "#241018", vet2: "#6a0e18", cuir: "#1a0e12", metal: "#8a8f9e" },
  // Crocs (face) du catalogue ; yeux ROUGEOYANTS par CLÉ du catalogue d'yeux (réutilisable hors Vampire).
  features: feat('crocs'),
  eyes: { G: 'rouge', D: 'rouge' },
};
