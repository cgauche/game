/**
 * Schéma de `renduMonte.json` — réglages MAISON du rendu du couple monté (non-règles), consommé par
 * `src/gameIso/rig/quadruped/harnais/index.ts` (`DEFAUT_HARNAIS_MONTE`). `_doc` documente la
 * convention dans le JSON réel (absent de la lecture runtime, cast `as`) : champ toléré ici, même
 * patron que `speciesRace.json`.
 */
import { z } from 'zod';

export const file = 'renduMonte.json';

export const schema = z.strictObject({
  _doc: z.string().optional(),
  harnaisParDefaut: z.string(),
});

export type RenduMonteData = z.infer<typeof schema>;
