/**
 * Schéma de `structureAppearance.json` — apparence PARTAGÉE d'une structure d'arête (mur/porte),
 * consommée comme `StructureAppearanceDef[]` (`src/gameIso/catalog/structures/types.ts`). `material`
 * observé : 'bois' | 'pierre' (les seules valeurs présentes, alignées sur le type TS).
 */
import { z } from 'zod';
import { detailRecipeSchema } from '../common';

export const file = 'structureAppearance.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    material: z.enum(['bois', 'pierre']),
    detail: detailRecipeSchema.optional(),
    face: z.string(),
    post: z.string(),
    band: z.string().optional(),
    cap: z.string().optional(),
    rubble: z.string().optional(),
    rubbleHi: z.string().optional(),
    recess: z.string().optional(),
    wood: z
      .strictObject({
        inset: z.string(),
        frame: z.string(),
        cap: z.string(),
        skirt: z.string(),
        rubble: z.string(),
        rubbleHi: z.string(),
      })
      .optional(),
    parapet: z
      .strictObject({
        heightLevelFrac: z.number(),
        merlonCount: z.number(),
        merlonStep: z.number(),
        merlonHeightPx: z.number(),
        bands: z.array(z.number()),
        bandThickPx: z.number(),
        parapetBandFrac: z.number(),
        arasePx: z.number(),
      })
      .optional(),
    door: z
      .strictObject({
        openingFrac: z.number(),
        lintelPx: z.number(),
        jamb: z.string().optional(),
        jambCap: z.string().optional(),
        leaf: z.string().optional(),
        plank: z.string().optional(),
        handle: z.string().optional(),
        herse: z
          .strictObject({
            bars: z.number(),
            topFrac: z.number(),
            traverseFracs: z.array(z.number()),
            traverseColor: z.string(),
          })
          .optional(),
      })
      .optional(),
    window: z
      .strictObject({
        glass: z.string(),
        lit: z.string(),
        frame: z.string(),
        mullion: z.string(),
      })
      .optional(),
  }),
);

export type StructureAppearanceData = z.infer<typeof schema>;
