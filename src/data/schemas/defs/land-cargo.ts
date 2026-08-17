/**
 * Schéma de `land-cargo.json` — COMMERCE TERRESTRE & FLUVIAL (Mort sur le Reik Compagnon ch.11
 * « Règles du commerce », p.70-78). Consommé par `src/engine/landCargo.ts` (`LAND as unknown as
 * { ... }`, cast inline reflété ICI 1:1). `wine: true` marque le Vin/Eau-de-vie (prix par la table de
 * qualité SECRÈTE `wineQuality`, pas par la colonne saisonnière). `_source` = note de provenance
 * (verbatim des tableaux), présente en tête du JSON.
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../common';

export const file = 'land-cargo.json';

const seasonRange = z.tuple([z.number(), z.number()]);
const seasonPrice = z.strictObject({ printemps: z.number(), ete: z.number(), automne: z.number(), hiver: z.number() });

/** Une CARGAISON ÉCHANGEABLE : disponibilité saisonnière + prix (l.71-89). */
const cargoMarchand = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Vin/Eau-de-vie : prix par `wineQuality`, pas par la colonne saisonnière (l.93-104). */
  wine: z.boolean().optional(),
  avail: z.strictObject({ printemps: seasonRange, ete: seasonRange, automne: seasonRange, hiver: seasonRange }),
  price: z.union([seasonPrice, z.strictObject({ dice: z.string() })]),
  source: sourceRefSchema,
});

/** Un MARQUEUR de la colonne Produits de l'Index (« Commerce », « Subsistance », MSRC 13 l.24-28 et
 *  l.119) : il occupe la même colonne que les cargaisons sans être une marchandise — donc ni
 *  disponibilité ni prix. `echangeable: false` est le champ d'EXCLUSION lu par le résolveur
 *  (`engine/landCargo.ts`), qui filtre le catalogue échangeable à la source ; une entrée marchande ne
 *  porte pas le champ. */
const cargoMarqueur = z.strictObject({
  id: z.string(),
  label: z.string(),
  echangeable: z.literal(false),
  /** Qualificatif d'affichage ÉDITABLE (« plaque tournante » / « rien à échanger ») — cf. `CargoMarkerDef`. */
  hint: z.string().optional(),
  source: sourceRefSchema,
});

export const schema = z.strictObject({
  cargoes: z.array(z.union([cargoMarchand, cargoMarqueur])),
  wineQuality: z.array(
    z.strictObject({ min: z.number(), max: z.number(), label: z.string(), price: z.number(), source: sourceRefSchema }),
  ),
  buy: z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    partialSurchargePct: z.number(),
    minEnc: z.number(),
    wineEvalDifficulty: difficultySchema,
    wineEvalEasyDifficulty: difficultySchema,
    wineAlcoholResistThreshold: z.number(),
    source: sourceRefSchema,
  }),
  sell: z.strictObject({
    targetPerSize: z.number(),
    commerceBonus: z.number(),
    dumpingPctOfBase: z.number(),
    offerByRichesse: z.array(z.strictObject({ richesse: z.number(), label: z.string(), pct: z.number() })),
    source: sourceRefSchema,
  }),
  gossip: z.strictObject({ difficulty: difficultySchema, mod: z.number(), source: sourceRefSchema }),
  rumours: z.array(
    z.strictObject({
      min: z.number(),
      max: z.number(),
      biens: z.array(z.string()),
      text: z.string(),
      source: sourceRefSchema,
    }),
  ),
});
