/**
 * Schéma de `weather.json` — Météo de voyage TERRESTRE (EDOC ch.5), consommée par
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
import { difficultySchema, sourceRefSchema } from '../common';

export const file = 'weather.json';

const weatherIdSchema = z.enum(['sec', 'beau', 'pluie', 'pluie-diluvienne', 'neige', 'blizzard']);

export const schema = z.strictObject({
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
  /** Liste MAISON des Caractéristiques réputées « physiques » (EDOC ch.5 l.82 ne la définit pas). */
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
});

export type WeatherData = z.infer<typeof schema>;
