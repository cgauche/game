/** Emplacements de base d'une palette de rig (ordre stable) — source UNIQUE, lue par le schéma de donnée
 *  (`raceAppearance.tirageIndividuel`) et par le rig (`gameIso/rig/palette.ts`). Hors du chargeur pour
 *  rester importable par `src/gameIso`. */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'] as const;
export type Slot = (typeof SLOTS)[number];
