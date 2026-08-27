/**
 * Schéma de `names.json` — banques de noms par race (LDB 05), consommé par `src/data/index.ts`
 * (`Record<RaceKey, NamePool>`). La clé EST l'id d'espèce `raceKeySchema` (#313), celle que porte
 * `species.refChar` : `generateName` indexe la banque directement, sans conversion.
 * `NamePool` = `src/data/index.ts` : `lastNameSuffixes` n'est présent QUE pour `nain` dans le JSON
 * réel (patronymes générés par suffixe, LDB 05 l.627-633) — optionnel ailleurs.
 *
 * CLÉS EXHAUSTIVES : `z.record(z.enum, …)` exige en zod 4.4.3 TOUTES les clés déclarées — les 7
 * races jouables ont donc chacune leur banque, et une banque manquante est refusée au sceau.
 */
import { z } from 'zod';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'names.json';
export const famille = 'record';

const namePoolSchema = z.strictObject({
  maleFirstNames: z.array(z.string()),
  femaleFirstNames: z.array(z.string()),
  lastNames: z.array(z.string()),
  lastNameSuffixes: z.strictObject({
    M: z.array(z.string()),
    F: z.array(z.string()),
  }).optional(),
});

export const schema = z.record(raceKeySchema, namePoolSchema);
