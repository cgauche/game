/**
 * Schéma de `merchants.json` — archétypes de marchand (#2, migré du CODE en donnée éditable,
 * doctrine « aucun archétype en dur »). Reflet FIDÈLE de `MerchantArchetypeDef`
 * (`src/state/merchants/types.ts`).
 */
import { z } from 'zod';
import { refs } from '../grammaire/ref';

export const file = 'merchants.json';
export const famille = 'entite';

const settlementSchema = z.enum(['village', 'ville', 'cite']);

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    category: z.strictObject({
      /** CATÉGORIES de catalogue vendues (`TrappingData.categorie`) — mesuré : 1 porteur, valeurs ⊆ le
       *  vocabulaire de `trappings.json`. Absent = pas de filtre par catégorie. */
      categories: z.array(z.string()).optional(),
      /** Sous-types vendus (`TrappingData.subType`, Groupe d'objet) — axe DISTINCT, nom inchangé. */
      subTypes: z.array(z.string()).optional(),
    }),
    settlement: settlementSchema,
    resaleRate: z.number(),
    buyMarkup: z.number().optional(),
    bargainSkill: z.number().optional(),
    restockDays: z.number().optional(),
    /** Sélection d'objets proposés d'office — clés étrangères vers `trappings.json`. */
    curated: refs('trapping').optional(),
    boniment: z.string().optional(),
    unitKinds: z.array(z.enum(['bete', 'vehicule-terrestre'])).optional(), // 'navire' non géré à l'achat (payCart) -> #748
  }),
);
