/**
 * Schéma de `sea-cargo.json` — COMMERCE MARITIME (MDG ch.15 l.309-436). Consommé par
 * `src/engine/seaVoyage.ts` (`CARGO as unknown as { ... }`, cast inline reflété ICI 1:1) : catalogue
 * de cargaisons (`CargoDef` — `src/engine/cargo.ts`), achat, vente, Commerce d'opportunité. `avail` =
 * plages d100 par saison (`Season`, `src/engine/travelStages.ts`) ; `price` = colonne par saison, ou
 * `{ dice }` (Vin maritime : 3d10, tiré une fois à l'achat).
 */
import { z } from 'zod';
import { difficultySchema, freeSourceNoteSchema } from '../common';

export const file = 'sea-cargo.json';

const seasonRange = z.tuple([z.number(), z.number()]);
const seasonPrice = z.strictObject({ printemps: z.number(), ete: z.number(), automne: z.number(), hiver: z.number() });

export const schema = z.strictObject({
  cargoes: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      avail: z.strictObject({ printemps: seasonRange, ete: seasonRange, automne: seasonRange, hiver: seasonRange }),
      price: z.union([seasonPrice, z.strictObject({ dice: z.string() })]),
    }),
  ),
  buy: z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    bigPortSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    partialPurchaseSellerDR: z.number(),
    surplusSellerDR: z.number(),
  }),
  sell: z.strictObject({
    offerPrice: z.array(z.strictObject({ sum: z.number(), pct: z.number() })),
    noProduceTargetPerSize: z.number(),
    commerceBonus: z.number(),
    producesGossip: z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number(), minMilles: z.number() }),
    surplusGossip: z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number() }),
    sellerDR: z.strictObject({ noProduce: z.number(), demand: z.number(), produces: z.number(), surplus: z.number() }),
    dumpingPctOfBase: z.number(),
  }),
  overload: z.strictObject({
    _source: freeSourceNoteSchema,
    hardCapPct: z.number(),
    paliers: z.array(
      z.strictObject({ id: z.string(), fromPct: z.number(), label: z.string(), mMod: z.number(), manoeuvreDR: z.number() }),
    ),
  }),
  opportunite: z.strictObject({
    investMaxEnc: z.boolean(),
    test: z.strictObject({
      skillId: z.string(),
      difficulty: difficultySchema,
      totalDR: z.number(),
      maxAttempts: z.number(),
    }),
    outcomes: z.array(
      z.strictObject({
        on: z.enum(['success', 'failure']),
        minMissing: z.number().optional(),
        minExtraDR: z.number().optional(),
        pct: z.number(),
      }),
    ),
  }),
});

export type SeaCargoData = z.infer<typeof schema>;
