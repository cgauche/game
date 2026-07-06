/**
 * Schéma de `mass-battle.json` — 5 tables de bataille de masse (ADE II ch.8), miroir strict de
 * `PowerEstimateRow`/`MightModifierRow`/`WarMachineRow`/`StructureRow`/`HazardRow`
 * (`src/engine/massBattle.ts:27-35`).
 */
import { z } from 'zod';

export const file = 'mass-battle.json';

const powerEstimateRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  ally: z.number(),
  enemy: z.number(),
  example: z.string(),
});

const mightModifierRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  mod: z.number(),
  example: z.string(),
});

const warMachineRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  price: z.string(),
  crew: z.number(),
  availability: z.string(),
  range: z.string(),
  damage: z.string(),
  traits: z.string(),
  siege: z.boolean(),
});

const structureRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  be: z.number(),
  wounds: z.number(),
  traits: z.string(),
});

const hazardRowSchema = z.strictObject({
  min: z.number(),
  max: z.number(),
  label: z.string(),
  text: z.string(),
});

export const schema = z.strictObject({
  powerEstimate: z.array(powerEstimateRowSchema),
  mightModifiers: z.array(mightModifierRowSchema),
  warMachines: z.array(warMachineRowSchema),
  structures: z.array(structureRowSchema),
  hazards: z.array(hazardRowSchema),
});

export type MassBattleData = z.infer<typeof schema>;
