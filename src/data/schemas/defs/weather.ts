/**
 * Schéma de `weather.json` — Météo de voyage TERRESTRE (EDOC 8), consommée par
 * `src/data/index.ts` et typée par `engine/travelStages.ts` (`Weather`, `WEATHER_LABEL`,
 * `WEATHER_TABLE`, `WeatherCondition`). Deux volets :
 *  - `seasons` : table de tirage d100 par saison (`ranges.max` = borne haute incluse → `weather`,
 *    lookup via `rollStageWeather`) ;
 *  - `conditions` : EFFETS par météo, MÊME vocabulaire de donnée que `sea-weather.json`
 *    (`visibiliteM`/`rangedMod` étendus des besoins terrestres : `physicalTestMod`, `powderUseless`,
 *    `rangedUseless`, `movementWalkOnly`, `resistanceTest`, `lightningNervous`).
 * `weather` enum = EXACTEMENT `engine/travelStages.ts` (`type Weather`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { difficultySchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'weather.json';
export const famille = 'config';

const weatherIdSchema = z.enum(['sec', 'beau', 'pluie', 'pluie-diluvienne', 'neige', 'blizzard']);

const doc = document(
  'weather',
  famille,
  {
  seasons: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      ranges: z.array(
        z.strictObject({
          max: z.number(),
          weather: weatherIdSchema,
        }),
      ),
      source: sourceRefSchema.optional(),
    }),
  ),
  /** Liste MAISON des Caractéristiques réputées « physiques » (EDOC 8 l.82 ne la définit pas). */
  physicalTestChars: z.array(z.string()),
  physicalTestCharsSource: sourceRefSchema.optional(),
  conditions: z.array(
    z.strictObject({
      id: weatherIdSchema,
      label: z.string(),
      /** Description VERBATIM (Markdown) de la source — rendue par `<Prose>` (règle 5). */
      desc: z.string().optional(),
      /** Visibilité en mètres (0 ≈ nulle) — plafonne la portée du tir en combat. */
      visibiliteM: z.number().optional(),
      /** Pénalité aux armes à DISTANCE (combat). */
      rangedMod: z.number().optional(),
      /** Armes à distance INUTILES (blizzard). */
      rangedUseless: z.boolean().optional(),
      /** Poudre à canon exposée inutilisable (pluie diluvienne). */
      powderUseless: z.boolean().optional(),
      /** Pénalité à tous les Tests PHYSIQUES (caracs de `physicalTestChars`). */
      physicalTestMod: z.number().optional(),
      /** Mouvement plafonné à la marche (neige/blizzard). */
      movementWalkOnly: z.boolean().optional(),
      /** Animaux au Trait Nerveux effrayables par les éclairs (pluie diluvienne). */
      lightningNervous: z.boolean().optional(),
      /** Test de Résistance de traversée (ou État) — DISTINCT de l'Exposition de fin d'Étape.
       *  `enjeu` = énoncé VERBATIM de la source (ce que l'échec coûte), rendu sous le titre d'étape. */
      resistanceTest: z
        .strictObject({ difficulty: difficultySchema, onFail: z.enum(['extenue']), enjeu: z.string().optional() })
        .optional(),
      source: sourceRefSchema.optional(),
    }),
  ),
  },
  {
    seasons: { label: 'Tirage saisonnier', hint: 'Table de tirage d100 de la météo, par saison' },
    physicalTestChars: {
      label: 'Caractéristiques physiques',
      hint: 'Liste MAISON des Caractéristiques réputées « physiques » (non définie par la source)',
    },
    physicalTestCharsSource: { label: 'Source de la liste maison', hint: 'Référence RAW/maison de la liste de Caractéristiques physiques' },
    conditions: { label: 'Conditions météo', hint: 'Effets par météo : visibilité, pénalités, Test de Résistance de traversée' },
  },
  {
    codex: { keys: ['weather', 'weatherConditions'] },
    edit: { none: 'édité par TABLEAU NICHÉ : les catégories Codex `weather`/`weatherConditions` éditent chacune un champ de ce document, jamais le document entier (CodexEdit.CATEGORY_DATASET)' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
