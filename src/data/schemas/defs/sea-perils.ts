/**
 * Schéma de `sea-perils.json` — Périls environnementaux en mer (MDG ch.13 l.423-564) : échouage,
 * dangers (Iceberg/Débris/Rocher/Bas-fonds), détroits, tourbillons, gestion à distance. Dérivé de la
 * vue typée `DATA` (`src/engine/seaPerils.ts:46-53`), seul consommateur.
 */
import { z } from 'zod';
import { difficultySchema } from '../common';

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
});

/** `StraitDef` (`src/engine/seaPerils.ts:33`). */
const straitDef = z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  navDR: z.number(),
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
});

export const schema = z.strictObject({
  echouer: z.strictObject({ desc: z.string() }),
  hazards: z.array(seaHazardDef),
  detroits: z.array(straitDef),
  tourbillons: z.array(whirlpoolDef),
  tourbillonSwim: z.strictObject({ skillId: z.string(), difficulty: difficultySchema }),
  gestionDesPerils: z.array(z.strictObject({ distanceM: z.number(), spot: difficultySchema, avoid: difficultySchema })),
});

export type SeaPerilsData = z.infer<typeof schema>;
