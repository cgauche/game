/** Apparence PARTAGÉE d'une structure d'arête (mur/porte), consommée par l'iso (walls.ts) ET le POV
 *  (geometry.ts). Donnée pure (`src/data/structureAppearance.json`), découplée de `StructureData` (règles).
 *  Couleurs : hex ou var CSS (`var(--struct-*)`, base.css). L'iso dérive l'ombrage par orientation via
 *  `shade()` à partir des couleurs de base ci-dessous ; le POV les teinte par la lumière. */
import type { DetailRecipe } from '../../detail/types';

export interface StructureAppearanceDef {
  id: string;
  label: string;
  material: 'bois' | 'pierre';
  /** Recette de détail de surface (appareillage/joints/mouchetis — Lot 0, consommée au Lot 4). */
  detail?: DetailRecipe;
  /** Face principale (POV + base de la face iso, ombrée par orientation). */
  face: string;
  /** Montant d'extrémité — chapiteau/socle dérivés par ombrage. */
  post: string;
  /** PIERRE : ferrure / arase+merlons / gravats / renfoncement de passage. */
  band?: string; cap?: string; rubble?: string; rubbleHi?: string; recess?: string;
  /** BOIS : couleurs de base des autres parties (la face vient de `face`). */
  wood?: { inset: string; frame: string; cap: string; skirt: string; rubble: string; rubbleHi: string };
  /** Fortification : parapet crénelé. */
  parapet?: {
    heightLevelFrac: number;
    merlonCount: number; merlonStep: number; merlonHeightPx: number;
    bands: number[]; bandThickPx: number; parapetBandFrac: number; arasePx: number;
  };
  /** Ouverture (porte bois ajourée / corps de garde béant `openingFrac ≥ 1`). */
  door?: {
    openingFrac: number; lintelPx: number;
    jamb?: string; jambCap?: string;
    herse?: { bars: number; topFrac: number; traverseFracs: number[]; traverseColor: string };
  };
}
