/**
 * Schéma de `merchantFamilies.json` — familles de PRÉSENTATION du stock marchand, miroir de
 * `MerchantFamilyData` (`src/data/index.ts`). Consommé par `ui/MerchantPanel.tsx` (`FAMILIES`,
 * `familyOf`, `FAMILY_COLS` dérivés) — ordre du tableau = ordre d'affichage des onglets.
 */
import { z } from 'zod';

export const file = 'merchantFamilies.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    match: z.strictObject({
      trappingType: z.string().optional(),
      shield: z.boolean().optional(),
      unit: z.boolean().optional(),
    }),
    columns: z.array(z.string()),
  }),
);

export type MerchantFamiliesData = z.infer<typeof schema>;
