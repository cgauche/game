/**
 * Schéma de `roofMaterials.json` — apparence de RENDU des toits, consommée comme `RoofMaterialDef[]`
 * (`src/gameIso/catalog/roofs/types.ts`). 4 entrées réelles : 3 matériaux de couverture (tuile/chaume/
 * ardoise, teintes N/E/S/O + `detail` + volume d'avant-toit) et 1 « plan » vu du dessus (`planBody`/
 * `planEdge`/`planInner`/`planText` seulement — pas de N/E/S/O/detail).
 */
import { z } from 'zod';
import { detailRecipeSchema } from '../common';

export const file = 'roofMaterials.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    detail: detailRecipeSchema.optional(),
    N: z.string().optional(),
    E: z.string().optional(),
    S: z.string().optional(),
    O: z.string().optional(),
    line: z.string().optional(),
    planBody: z.string().optional(),
    planEdge: z.string().optional(),
    planInner: z.string().optional(),
    planText: z.string().optional(),
    eaveOverhangM: z.number().optional(),
    soffite: z.string().optional(),
    fasciaDropM: z.number().optional(),
    fasciaThickM: z.number().optional(),
    fascia: z.string().optional(),
    ridgeCap: z.string().optional(),
  }),
);
