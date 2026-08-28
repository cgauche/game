/**
 * Schéma de `sea-perils.json` — Périls environnementaux en mer (MDG 13 l.423-564) : échouage,
 * dangers (Iceberg/Débris/Rocher/Bas-fonds), détroits, tourbillons, gestion à distance. Dérivé de la
 * vue typée `DATA` (`src/engine/seaPerils.ts`), seul consommateur.
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'sea-perils.json';
export const famille = 'config';

/** `ShipSize` (`src/data/index.ts`). */
const shipSize = z.enum(['minuscule', 'tres-petite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse']);

/** `SeaHazardDef` (`src/engine/seaPerils.ts`). */
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

/** `StraitDef` (`src/engine/seaPerils.ts`). */
const straitDef = z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  navDR: z.number(),
  source: sourceRefSchema,
});

/** `WhirlpoolDef` (`src/engine/seaPerils.ts`). */
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

const champs = {
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
};

const doc = document(
  'sea-perils',
  famille,
  champs,
  {
    echouer: { label: 'Échouage', hint: "Description et référence de la règle d'échouage" },
    hazardsWeightNote: { label: 'Note de pondération', hint: 'Pondération MAISON du tirage entre dangers — le RAW ne chiffre pas la fréquence' },
    hazards: { label: 'Dangers de navigation', hint: 'Catalogue des dangers (Iceberg/Débris/Rocher/Bas-fonds) — collision, empêtrement' },
    detroits: { label: 'Détroits', hint: 'Passages resserrés : Mouvement max et DR de Navigation pour les franchir' },
    tourbillons: { label: 'Tourbillons', hint: "Zones dangereuses : rayon, spirale d'aspiration, chance d'évasion" },
    tourbillonSwim: { label: 'Nage hors tourbillon', hint: "Compétence et difficulté pour s'extraire à la nage" },
    gestionDesPerils: { label: 'Gestion à distance', hint: "Distance de détection/d'évitement d'un péril repéré à temps" },
  },
  { codex: { keys: ['seaPerils'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export type SeaPerilsData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
