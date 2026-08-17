/**
 * Schéma de `raceAppearance.json` — apparence de base d'une espèce de rig (Humain, Ogre, Skaven…),
 * consommée comme `RaceAppearanceData[]` (`src/data/index.ts:1113`). PAR RÉFÉRENCE : `featureKeys`
 * (catalogue d'éléments), ids de gabarit/tête/jambes, libellé de tenue, couleurs — les SVG/gabarits
 * restent des registres CODE résolus par `src/gameIso/rig/races/index.ts`.
 */
import { z } from 'zod';

export const file = 'raceAppearance.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    gabarit: z.string(),
    gabaritOverride: z.record(z.string(), z.number()).optional(),
    palette: z.record(z.string(), z.string()).optional(),
    paletteF: z.record(z.string(), z.string()).optional(),
    head: z.string().optional(),
    legs: z.string().optional(),
    armG: z.string().optional(),
    armD: z.string().optional(),
    dropHeadgear: z.boolean().optional(),
    featureKeys: z.array(z.string()).optional(),
    pose: z.record(z.string(), z.number()).optional(),
    tenue: z.string().optional(),
    colors: z.record(z.string(), z.string()).optional(),
    sex: z.enum(['M', 'F']).optional(),
    parts: z.strictObject({ cheveux: z.number().optional(), visage: z.number().optional() }).optional(),
    scale: z.number().optional(),
    eyes: z.strictObject({ G: z.string().optional(), D: z.string().optional() }).optional(),
    extremites: z.enum(['lisses', 'griffues']).optional(),
  }),
);
