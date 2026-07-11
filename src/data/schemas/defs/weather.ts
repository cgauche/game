/**
 * Schéma de `weather.json` — table de Météo de voyage par saison (EDOC ch.5), consommé par
 * `src/data/index.ts:1389` et typé par `engine/travelStages.ts` (`Weather`, `WEATHER_LABEL`,
 * `WEATHER_TABLE`). `ranges` = plages d100 croissantes (`max` = borne haute incluse) → `weather`,
 * lookup via `findTableEntry`-like (`rollStageWeather`). `weather` enum = EXACTEMENT
 * `engine/travelStages.ts:46` (`type Weather`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'weather.json';

const weatherIdSchema = z.enum(['sec', 'beau', 'pluie', 'pluie-diluvienne', 'neige', 'blizzard']);

export const schema = z.array(
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
);

export type WeatherData = z.infer<typeof schema>;
