/**
 * Schéma de `river-navigation.json` — Navigation fluviale (T2C ch.5 « Navigation fluviale »), pendant
 * fluvial de `sea-navigation.json`. Dérivé de la vue typée `DATA` (`src/engine/riverNavigation.ts:62-78`),
 * seul consommateur. `_source` = note de traçabilité libre (non lue par le moteur).
 */
import { z } from 'zod';
import { difficultySchema, freeSourceNoteSchema } from '../common';

export const file = 'river-navigation.json';

const riverWindDirId = z.enum(['arriere', 'cote', 'contraire']);

/** `BandRow` (`src/engine/riverNavigation.ts:59`) — table de tirage par fourchette d10. */
const bandRow = z.strictObject({ id: z.string(), label: z.string(), min: z.number(), max: z.number() });

/** `RiverWindEffect` (`src/engine/riverNavigation.ts:46-57`). */
const riverWindEffect = z.strictObject({
  pct: z.number().optional(),
  drift: z.boolean().optional(),
  tack: z.boolean().optional(),
  capsizeRisk: z.boolean().optional(),
  riggingRisk: z.boolean().optional(),
});

export const schema = z.strictObject({
  _source: freeSourceNoteSchema.optional(),
  windForces: z.array(bandRow),
  windDirections: z.array(bandRow),
  windTickThreshold: z.number(),
  windTicksPerDay: z.number(),
  windEffect: z.record(z.string(), z.record(riverWindDirId, riverWindEffect)),
  driftPctOfSpeed: z.number(),
  driftNavPenalty: z.number(),
  navBaseDifficulty: difficultySchema,
  tackDifficulty: difficultySchema,
  savoirVoiesFluvialesDR: z.number(),
  rowingAgility: z.strictObject({
    difficulty: difficultySchema,
    failSpeedPct: z.number(),
    spectacularSL: z.number(),
    spectacularSpeedFactor: z.number(),
  }),
  capsize: z.strictObject({
    removeSailDifficulty: difficultySchema,
    rightDifficulty: difficultySchema,
    rightCumulativePenalty: z.number(),
  }),
  outOfControl: z.strictObject({ navPenalty: z.number() }),
  echouage: z.strictObject({ hullDamage: z.number() }),
  temporaryRepair: z.strictObject({
    difficulty: difficultySchema,
    charpentierPenalty: z.number(),
    woundsPerRepair: z.string(),
  }),
});

export type RiverNavigationData = z.infer<typeof schema>;
