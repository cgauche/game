/**
 * Schéma de `raceAppearance.json` — apparence de base d'une espèce de rig (Humain, Ogre, Skaven…),
 * consommée comme `RaceAppearanceData[]` (`src/data/index.ts`). PAR RÉFÉRENCE : `featureKeys`
 * (catalogue d'éléments), ids de gabarit/tête/jambes, libellé de tenue, couleurs — les SVG/gabarits
 * restent des registres CODE résolus par `src/gameIso/rig/races/index.ts`.
 */
import { z } from 'zod';

export const file = 'raceAppearance.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    /** Libellé d'AFFICHAGE de la race de rig (« Haut-Elfe », « Homme-bête ») — l'`id` au-dessus est
     *  son slug (#1467 L1b) : c'est lui que désignent `speciesRace.json` et les defs de créatures. */
    label: z.string().min(1),
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
