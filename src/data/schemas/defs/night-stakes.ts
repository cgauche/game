/**
 * Schéma de `night-stakes.json` — enjeu VERBATIM (règle 5) d'un `kind` d'étape de la cascade de nuit
 * (#331), migré depuis `NIGHT_STAKES` (`src/state/restFlow.ts`) en donnée app-owned (arbitrage
 * doctrine 2026-07-12 : un catalogue en dur est l'exception, il migre en donnée). Lu par `nightStake`.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'night-stakes.json';

export const schema = z.array(
  z.strictObject({
    kind: z.string(),
    stake: z.string(),
    source: sourceRefSchema,
  }),
);

export type NightStakesData = z.infer<typeof schema>;
