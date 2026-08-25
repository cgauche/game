/**
 * Schéma de `speciesRace.json` — règles ORDONNÉES espèce (slug/libellé) → race-id du rig, consommé
 * par `src/gameIso/rig/skeletons.ts` (`baseSpeciesOf`, type `SpeciesRule`). Une règle porte
 * EXACTEMENT un des 3 opérateurs (`prefix`/`includes`/`all`+`any`) — `_doc` documente la convention,
 * absente de la lecture runtime (cast `as`) mais présente dans le JSON réel : champ toléré ici.
 */
import { z } from 'zod';

export const file = 'speciesRace.json';
export const famille = 'config';

const speciesRuleSchema = z.strictObject({
  prefix: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  all: z.array(z.string()).optional(),
  any: z.array(z.string()).optional(),
  race: z.string(),
});

export const schema = z.strictObject({
  _doc: z.string().optional(),
  default: z.string(),
  rules: z.array(speciesRuleSchema),
});
