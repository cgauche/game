// Elfe sylvain : élancé mais légèrement plus court et plus fin que le Haut-Elfe.
import type { RaceDef } from '../types';
import { feat } from '../../parts/elements';
export const race: RaceDef = {
  id: 'Elfe sylvain',
  gabarit: 'elance',
  tenue: 'bourgeois',
  gabaritOverride: { sl: 1.05, st: 0.9 },
  palette:  { peau: "#cdbd92", peauO: "#a89464", peauH: "#d8c9a0", cheveux: "#3c2e1a", cheveuxH: "#6b7a3a", cheveuxO: "#4a3a22" },
  paletteF: { peau: "#d8c9a0", peauO: "#8a7a52", peauH: "#e2d2a8", cheveux: "#5a4a2c", cheveuxH: "#7a6642", cheveuxO: "#4a3c22" },
  features: feat('oreilles-pointues'),
};
