/**
 * Schéma de `sea-cargo.json` — COMMERCE MARITIME (MDG 15 l.309-436). Consommé par
 * `src/engine/seaVoyage.ts` (`CARGO as unknown as { ... }`, cast inline reflété ICI 1:1) : catalogue
 * de cargaisons (`CargoDef` — `src/engine/cargo.ts`), achat, vente, Commerce d'opportunité. `avail` =
 * plages d100 par saison (`Season`, `src/engine/travelStages.ts`) ; `price` = colonne par saison, ou
 * `{ dice }` (Vin maritime : 3d10, tiré une fois à l'achat).
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'sea-cargo.json';

const seasonRange = z.tuple([z.number(), z.number()]);
const seasonPrice = z.strictObject({ printemps: z.number(), ete: z.number(), automne: z.number(), hiver: z.number() });

/** Une CARGAISON ÉCHANGEABLE : disponibilité saisonnière + prix (tableau des cargaisons, l.406-434). */
const cargoMarchand = z.strictObject({
  id: z.string(),
  label: z.string(),
  avail: z.strictObject({ printemps: seasonRange, ete: seasonRange, automne: seasonRange, hiver: seasonRange }),
  price: z.union([seasonPrice, z.strictObject({ dice: z.string() })]),
  source: sourceRefSchema,
});

/** Un MARQUEUR de la colonne Production de l'Index (« commerce », « minimum vital », MDG 15 l.321) :
 *  il occupe la même colonne que les cargaisons sans être une marchandise — donc ni disponibilité ni
 *  prix. `echangeable: false` est le champ d'EXCLUSION lu par le résolveur (`engine/seaVoyage.ts`),
 *  qui filtre le catalogue échangeable à la source ; une entrée marchande ne porte pas le champ. */
const cargoMarqueur = z.strictObject({
  id: z.string(),
  label: z.string(),
  echangeable: z.literal(false),
  /** Qualificatif d'affichage ÉDITABLE (« plaque tournante » / « rien à échanger ») — cf. `CargoMarkerDef`. */
  hint: z.string().optional(),
  /** Ce marqueur désigne une PLAQUE TOURNANTE du commerce (MDG 15 l.321) — lu par `isTradeHubEntry`
   *  (`engine/cargo.ts`) : tirage d'une cargaison au hasard, bonus de vente, bradage. */
  tradeHub: z.literal(true).optional(),
  source: sourceRefSchema,
});

export const schema = z.strictObject({
  cargoes: z.array(z.union([cargoMarchand, cargoMarqueur])),
  buy: z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    bigPortSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    partialPurchaseSellerDR: z.number(),
    surplusSellerDR: z.number(),
    source: sourceRefSchema,
  }),
  sell: z.strictObject({
    offerPrice: z.array(z.strictObject({ sum: z.number(), pct: z.number() })),
    noProduceTargetPerSize: z.number(),
    commerceBonus: z.number(),
    producesGossip: z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number(), minMilles: z.number() }),
    surplusGossip: z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number() }),
    sellerDR: z.strictObject({ noProduce: z.number(), demand: z.number(), produces: z.number(), surplus: z.number() }),
    dumpingPctOfBase: z.number(),
    source: sourceRefSchema,
  }),
  overload: z.strictObject({
    hardCapPct: z.number(),
    paliers: z.array(
      z.strictObject({ id: z.string(), fromPct: z.number(), label: z.string(), mMod: z.number(), manoeuvreDR: z.number() }),
    ),
    source: sourceRefSchema,
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
    source: sourceRefSchema,
  }),
});
