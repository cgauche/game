/**
 * Schéma de `names.json` — banques de noms par race (LDB 05), consommé par
 * `src/data/index.ts:1438` (`Record<string, NamePool>` — clé = `SpeciesData.label`, ex. "Humain",
 * "Haut Elfe"…). `NamePool` = `src/data/index.ts:1134` : `lastNameSuffixes` n'est présent QUE pour
 * "Nain" dans le JSON réel (patronymes générés par suffixe, LDB 05 l.622) — optionnel ailleurs.
 */
import { z } from 'zod';

export const file = 'names.json';

const namePoolSchema = z.strictObject({
  maleFirstNames: z.array(z.string()),
  femaleFirstNames: z.array(z.string()),
  lastNames: z.array(z.string()),
  lastNameSuffixes: z.strictObject({
    M: z.array(z.string()),
    F: z.array(z.string()),
  }).optional(),
});

export const schema = z.record(z.string(), namePoolSchema);

export type NamesData = z.infer<typeof schema>;
