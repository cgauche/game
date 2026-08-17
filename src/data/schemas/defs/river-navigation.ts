/**
 * Schéma de `river-navigation.json` — Navigation fluviale (MSRC 7 « Navigation fluviale »), pendant
 * fluvial de `sea-navigation.json`. Dérivé de la vue typée `DATA` (`src/engine/riverNavigation.ts`),
 * seul consommateur. `source` = réf structurée book+page+note PAR entrée/sous-objet (#278), non lue
 * par le moteur (`DATA as unknown as { ... }` ignore le champ superflu).
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../common';

export const file = 'river-navigation.json';

const riverWindDirId = z.enum(['arriere', 'cote', 'contraire']);

/** `BandRow` (`src/engine/riverNavigation.ts`) — table de tirage par fourchette d10. */
const bandRow = z.strictObject({ id: z.string(), label: z.string(), min: z.number(), max: z.number() });

/** `RiverWindEffect` (`src/engine/riverNavigation.ts`). */
const riverWindEffect = z.strictObject({
  pct: z.number().optional(),
  drift: z.boolean().optional(),
  tack: z.boolean().optional(),
  capsizeRisk: z.boolean().optional(),
  riggingRisk: z.boolean().optional(),
});

export const schema = z.strictObject({
  /** Couvre les champs scalaires (`windTickThreshold`/`driftPctOfSpeed`/`navBaseDifficulty`…) —
   *  `windForces`/`windDirections` et les sous-objets portent chacun leur propre `source`. */
  source: sourceRefSchema,
  windForces: z.array(bandRow.extend({ source: sourceRefSchema })),
  windDirections: z.array(bandRow.extend({ source: sourceRefSchema })),
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
    source: sourceRefSchema,
  }),
  capsize: z.strictObject({
    removeSailDifficulty: difficultySchema,
    rightDifficulty: difficultySchema,
    rightCumulativePenalty: z.number(),
    source: sourceRefSchema,
  }),
  outOfControl: z.strictObject({ navPenalty: z.number(), source: sourceRefSchema }),
  echouage: z.strictObject({ hullDamage: z.number(), source: sourceRefSchema }),
  temporaryRepair: z.strictObject({
    difficulty: difficultySchema,
    charpentierPenalty: z.number(),
    woundsPerRepair: z.string(),
    source: sourceRefSchema,
  }),
});

export type RiverNavigationData = z.infer<typeof schema>;
