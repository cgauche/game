/**
 * Schéma de `merchants.json` — archétypes de marchand (#2, migré du CODE en donnée éditable,
 * doctrine « aucun archétype en dur »). Reflet FIDÈLE de `MerchantArchetypeDef`
 * (`src/state/merchants/types.ts`).
 */
import { z } from 'zod';

export const file = 'merchants.json';

const settlementSchema = z.enum(['village', 'ville', 'cite']);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    category: z.strictObject({
      types: z.array(z.string()).optional(),
      subTypes: z.array(z.string()).optional(),
    }),
    settlement: settlementSchema,
    resaleRate: z.number(),
    buyMarkup: z.number().optional(),
    bargainSkill: z.number().optional(),
    restockDays: z.number().optional(),
    curated: z.array(z.string()).optional(),
    boniment: z.string().optional(),
    unitKinds: z.array(z.enum(['bete', 'vehicule-terrestre'])).optional(), // 'navire' non géré à l'achat (payCart) -> #748
  }),
);

export type MerchantsData = z.infer<typeof schema>;
