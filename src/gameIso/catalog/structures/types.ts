/** Apparence PARTAGÉE d'une structure d'arête (mur/porte) — couche RENDU, consommée par l'iso
 *  (walls.ts) ET le POV (geometry.ts). Découplée de `StructureData` (règles, src/data). Couleurs :
 *  hex OU var CSS (`var(--struct-*)`, définies dans src/ui/styles/base.css) pour la pierre. */
export interface StructureAppearanceDef {
  id: string;                 // = id de structure (StructureData.id) OU 'plain' (mur sans structure)
  label: string;
  material: 'bois' | 'pierre';
  /** Couleur de face pleine (POV + repli). */
  face: string;
  /** PIERRE : bandes de fer / arase+merlons / gravats. */
  band?: string; cap?: string; rubble?: string; rubbleHi?: string;
  /** BOIS : palette iso par orientation (houseWallIso) + gravats. */
  wood?: {
    faceN: string; faceE: string; insetN: string; insetE: string;
    frameN: string; frameE: string; capN: string; capE: string;
    skirtN: string; skirtE: string; woodRubble: string; woodRubbleHi: string;
  };
  /** Fortification (rempart + corps de garde) : parapet crénelé. */
  parapet?: {
    heightLevelFrac: number;  // P = LEVEL_H * heightLevelFrac
    merlonCount: number; merlonStep: number; merlonHeightPx: number;
    bands: number[]; bandThickPx: number; parapetBandFrac: number; arasePx: number;
  };
  /** Ouverture (porte simple / corps de garde béant). */
  door?: {
    openingFrac: number; lintelPx: number;
    jamb?: string; jambCap?: string;               // porte bois (jambages)
    herse?: { bars: number; topFrac: number; traverseFracs: number[]; traverseColor: string };
  };
}
