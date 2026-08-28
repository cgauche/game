/**
 * Schéma de `interludeEvents.json` — Tableau des Événements « Entre deux aventures » (LDB `22 -
 * Événements.md`, d100), miroir strict de `InterludeEvent`/`InterludeEventFx`
 * (`src/data/interludeEvents.ts`).
 *
 * `desc` (clé d'ENVELOPPE) est EXIGÉE : c'est le résumé fidèle du texte, affiché au joueur.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

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

const doc = document(
  'interludeEvents',
  famille,
  {
    min: z.number(),
    max: z.number(),
    fx: fxSchema.optional(),
    /** Note d'atelier — JAMAIS affichée au joueur ni journalisée (contrairement à `desc`) : précise
     *  ce que `fx` ne modélise pas pour cet événement, à l'usage des auteurs de données. */
    atelierNote: z.string().optional(),
  },
  {
    min: { label: 'Borne basse (plage de tirage)' },
    max: { label: 'Borne haute (plage de tirage)' },
    fx: { label: 'Effets sur la trésorerie', hint: 'Impact chiffré argent/revenu/banque/activité' },
    atelierNote: { label: 'Note d’atelier', hint: 'Note interne aux auteurs de données — jamais affichée ni journalisée' },
  },
  {
    codex: { keys: ['interludeEvents'] },
    edit: { dataset: 'interludeEvents' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;
