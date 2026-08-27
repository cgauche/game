/**
 * Schéma de `speciesRace.json` — règles ORDONNÉES espèce (slug/libellé) → race-id du rig
 * (carrure/palette/features/posture), consommé
 * par `src/gameIso/rig/skeletons.ts` (`baseSpeciesOf`, type `SpeciesRule`). Une règle porte
 * EXACTEMENT un des 3 opérateurs : `prefix` (l'espèce COMMENCE par un des tokens), `includes` (elle
 * en CONTIENT un), `all`+`any` (elle contient TOUS les `all` ET un des `any`). Règles évaluées dans
 * l'ORDRE, première qui matche gagne ; aucune ne matche → `default`. L'espèce entrante est déjà en
 * minuscules. Ajouter un mapping = une ligne de `rules`.
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
  default: z.string(),
  rules: z.array(speciesRuleSchema),
});
