/**
 * Schéma de `sea-navigation.json` — NAVIGATION MARITIME (MDG 13 l.39-351 + « Longs voyages »
 * ch.15 l.53-78). Consommé par `src/engine/seaNavigation.ts` (`DATA as unknown as { ... }`, cast
 * inline reflété ICI 1:1) : Périodes de travail, Forcer le rythme, Épuisement, Vitesses maximum,
 * Salissures, Orientation (Repères / Changement de cap), Phares & clochers, Longs voyages,
 * Course-poursuite, Réparations au port.
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'sea-navigation.json';
export const famille = 'config';

const tableRange = z.strictObject({ min: z.number(), max: z.number() });

export const schema = z.strictObject({
  workPeriodHours: z.strictObject({ voile: z.number(), avirons: z.number(), source: sourceRefSchema }),
  epuisement: z.strictObject({ difficulty: difficultySchema, forcedDifficulty: difficultySchema, source: sourceRefSchema }),
  forcerLeRythme: z.array(
    z.strictObject({
      bonusM: z.number(),
      voile: difficultySchema.optional(),
      avirons: difficultySchema.optional(),
      source: sourceRefSchema,
    }),
  ),
  vitesseMax: z.strictObject({
    safeBonus: z.number(),
    source: sourceRefSchema,
    table: z.array(
      tableRange.extend({
        difficulty: difficultySchema,
        per: z.enum(['heure', 'minute', 'round']),
        damage: z.number(),
        source: sourceRefSchema,
      }),
    ),
  }),
  salissures: z.strictObject({
    weeklyTest: z.boolean(),
    source: sourceRefSchema,
    levels: z.array(
      z.strictObject({
        level: z.number(),
        manDR: z.number(),
        mMod: z.number(),
        navDR: z.number(),
        repairPctOfBase: z.number(),
        desc: z.string(),
        source: sourceRefSchema,
      }),
    ),
  }),
  orientation: z.strictObject({
    testsPerDay: z.number(),
    source: sourceRefSchema,
    reperes: z.array(
      tableRange.extend({
        outcome: z.enum(['exact', 'ok', 'drift-minor', 'drift', 'drift-major']),
        desc: z.string(),
        source: sourceRefSchema,
      }),
    ),
    driftMajorBonus: z.number(),
    driftSide: z.strictObject({ tribordMax: z.number() }),
    changementDeCap: z.array(
      tableRange.extend({
        effect: z.enum(['aucun', 'retard', 'quart-de-tour', 'demi-tour']),
        delayPct: z.number().optional(),
        desc: z.string(),
        source: sourceRefSchema,
      }),
    ),
  }),
  phares: z.strictObject({
    voirLaLumiere: z.array(tableRange.extend({ difficulty: difficultySchema, source: sourceRefSchema })),
    perilSpotBonus: z.number(),
    source: sourceRefSchema,
    clocher: z.strictObject({ orientationDR: z.number(), distanceDiviseur: z.number(), source: sourceRefSchema }),
  }),
  longsVoyages: z.strictObject({
    millesParJourParM: z.number(),
    sansVoguerDeNuitDiviseur: z.number(),
    progressionPctParDR: z.number(),
    source: sourceRefSchema,
  }),
  poursuite: z.strictObject({
    distanceUnitM: z.number(),
    source: sourceRefSchema,
    escapeDistances: z.array(
      z.strictObject({ id: z.string(), label: z.string(), distance: z.number(), source: sourceRefSchema }),
    ),
    drDeltas: z.array(tableRange.extend({ delta: z.number(), source: sourceRefSchema })),
    lowMPenalty: z.array(z.strictObject({ m: z.number(), dr: z.number(), source: sourceRefSchema })),
  }),
  reparation: z.strictObject({
    portCostGoldPerWound: z.number(),
    /** Expression de dés texte (ex. « 1d10 ») — lue par `rollExpr`/`rollDice`. */
    testHours: z.string(),
    woundsPerTest: z.string(),
    charpentierPenalty: z.number(),
    lissageRepairSurcoutPct: z.number(),
    source: sourceRefSchema,
    temporaire: z.strictObject({
      difficultyMin: difficultySchema,
      difficultyMax: difficultySchema,
      hoursPerRepair: z.number(),
      woundsPerRepair: z.string(),
      failDamage: z.string(),
    }),
    entretienCrewTestDR: z.number(),
  }),
});

export type SeaNavigationData = z.infer<typeof schema>;
