/**
 * Schéma de `sea-perils.json` — Périls environnementaux en mer (MDG ch.13 l.423-564) : échouage,
 * dangers (Iceberg/Débris/Rocher/Bas-fonds), détroits, tourbillons, gestion à distance. Dérivé de la
 * vue typée `DATA` (`src/engine/seaPerils.ts:46-53`), seul consommateur.
 */
import { z } from 'zod';
import { difficultySchema, sourceRefSchema } from '../common';

export const file = 'sea-perils.json';

/** `ShipSize` (`src/data/index.ts:1252`). */
const shipSize = z.enum(['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']);

/** `SeaHazardDef` (`src/engine/seaPerils.ts:21-31`). */
const seaHazardDef = z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number().optional(),
  ic: z.number(),
  strandChancePct: z.number().optional(),
  entangleChancePct: z.number().optional(),
  entanglePenalties: z
    .array(
      z.strictObject({
        minSize: shipSize.optional(),
        maxSize: shipSize.optional(),
        manDR: z.number(),
        mMod: z.number(),
      }),
    )
    .optional(),
  freeTest: z.strictObject({ skillId: z.string(), difficulty: difficultySchema, totalDR: z.number() }).optional(),
  desc: z.string(),
  source: sourceRefSchema,
  /** Poids du tirage de collision (#444) — MAISON, cf. `hazardsWeightNote` ci-dessous. */
  weight: z.number().optional(),
});

/** `StraitDef` (`src/engine/seaPerils.ts:33`). */
const straitDef = z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  navDR: z.number(),
  source: sourceRefSchema,
});

/** `WhirlpoolDef` (`src/engine/seaPerils.ts:35-44`). */
const whirlpoolDef = z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  zoneRadiusM: z.number(),
  zoneSpiralM: z.number(),
  manDR: z.number(),
  ic: z.number(),
  evasion: z.strictObject({ difficulty: difficultySchema, totalDR: z.number() }),
  source: sourceRefSchema,
});

export const schema = z.strictObject({
  echouer: z.strictObject({ desc: z.string(), source: sourceRefSchema }),
  /** Pondération MAISON du tirage entre `hazards[]` (#444) — le RAW l.475-499 est muet sur la fréquence. */
  hazardsWeightNote: z.string(),
  hazards: z.array(seaHazardDef),
  detroits: z.array(straitDef),
  tourbillons: z.array(whirlpoolDef),
  tourbillonSwim: z.strictObject({ skillId: z.string(), difficulty: difficultySchema, source: sourceRefSchema }),
  gestionDesPerils: z.array(
    z.strictObject({ distanceM: z.number(), spot: difficultySchema, avoid: difficultySchema, source: sourceRefSchema }),
  ),
});

export type SeaPerilsData = z.infer<typeof schema>;
