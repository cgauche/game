/**
 * Schéma de `land-cargo.json` — COMMERCE TERRESTRE & FLUVIAL (Mort sur le Reik Compagnon ch.11
 * « Règles du commerce », p.70-78). Consommé par `src/engine/landCargo.ts` (`LAND as unknown as
 * { ... }`, cast inline reflété ICI 1:1). `wine: true` marque le Vin/Eau-de-vie (prix par la table de
 * qualité SECRÈTE `wineQuality`, pas par la colonne saisonnière). `_source` = note de provenance
 * (verbatim des tableaux), présente en tête du JSON.
 */
import { z } from 'zod';
import { difficultySchema, freeSourceNoteSchema } from '../common';

export const file = 'land-cargo.json';

const seasonRange = z.tuple([z.number(), z.number()]);
const seasonPrice = z.strictObject({ printemps: z.number(), ete: z.number(), automne: z.number(), hiver: z.number() });

export const schema = z.strictObject({
  _source: freeSourceNoteSchema,
  cargoes: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      /** Vin/Eau-de-vie : prix par `wineQuality`, pas par la colonne saisonnière (l.93-104). */
      wine: z.boolean().optional(),
      avail: z.strictObject({ printemps: seasonRange, ete: seasonRange, automne: seasonRange, hiver: seasonRange }),
      price: z.union([seasonPrice, z.strictObject({ dice: z.string() })]),
    }),
  ),
  wineQuality: z.array(z.strictObject({ min: z.number(), max: z.number(), label: z.string(), price: z.number() })),
  buy: z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    partialSurchargePct: z.number(),
    minEnc: z.number(),
    wineEvalDifficulty: difficultySchema,
    wineEvalEasyDifficulty: difficultySchema,
    wineAlcoholResistThreshold: z.number(),
  }),
  sell: z.strictObject({
    targetPerSize: z.number(),
    commerceBonus: z.number(),
    dumpingPctOfBase: z.number(),
    offerByRichesse: z.array(z.strictObject({ richesse: z.number(), label: z.string(), pct: z.number() })),
  }),
  gossip: z.strictObject({ difficulty: difficultySchema, mod: z.number() }),
  rumours: z.array(
    z.strictObject({
      min: z.number(),
      max: z.number(),
      biens: z.array(z.string()),
      text: z.string(),
    }),
  ),
});

export type LandCargoData = z.infer<typeof schema>;
