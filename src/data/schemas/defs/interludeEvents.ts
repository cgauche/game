/**
 * Schéma de `interludeEvents.json` — Tableau des Événements « Entre deux aventures » (LDB `22 -
 * Événements.md`, d100), miroir strict de `InterludeEvent`/`InterludeEventFx`
 * (`src/data/interludeEvents.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'interludeEvents.json';
export const famille = 'entite';

const fxSchema = z.strictObject({
  moneyPct: z.number().optional(),
  revenuePct: z.number().optional(),
  revenueClasses: z.array(z.string()).optional(),
  revenueBlockedClasses: z.array(z.string()).optional(),
  bankPct: z.number().optional(),
  fortuneMaxDelta: z.number().optional(),
  loseActivity: z.boolean().optional(),
  stashRaided: z.boolean().optional(),
  bankCrashCheck: z.boolean().optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    min: z.number(),
    max: z.number(),
    label: z.string(),
    /** Résumé fidèle du texte (verbatim abrégé). */
    desc: z.string(),
    fx: fxSchema.optional(),
    source: sourceRefSchema.optional(),
    /** Note d'atelier — JAMAIS affichée au joueur ni journalisée (contrairement à `desc`) : précise
     *  ce que `fx` ne modélise pas pour cet événement, à l'usage des auteurs de données. */
    atelierNote: z.string().optional(),
  }),
);
