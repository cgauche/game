/**
 * Schéma de `reliefMaterials.json` — apparence de RENDU du relief (falaise/rampe/tablier/pilier iso,
 * plafond/riser/sol-repli POV), consommée comme `ReliefMaterialDef[]` (`src/gameIso/catalog/relief/types.ts`).
 */
import { z } from 'zod';
import { detailRecipeSchema } from '../grammaire/valeurs';

export const file = 'reliefMaterials.json';
export const famille = 'entite';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    /** Masse BÂTIE (maçonnerie, ouvrage) vs relief NATUREL (talus) — absent = naturel. */
    built: z.boolean().optional(),
    detail: detailRecipeSchema.optional(),
    face: z.string(),
    foot: z.string().optional(),
    slopeTop: z.string().optional(),
    shadeDark: z.number().optional(),
  }),
);
