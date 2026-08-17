/**
 * Schéma de `sea-events.json` — Humeur de Manann + Événements de bord/de port (MDG 15 l.83-129).
 * Dérivé de la vue typée `EVENTS`/`SeaEventDef`/`ManannFactor` (`src/engine/seaVoyage.ts:32-48`), seul
 * consommateur. `params` est un sac hétérogène PAR `kind` (ex. `moraleD10`, `days`, `roll`, `creatures`,
 * `restart`…), lu dynamiquement par clé (`eventParam`, `src/state/seaVoyageFlow.ts:730`) — reflet du
 * typage source `Record<string, unknown>`, jamais un champ ad hoc par `kind` (aucune contrainte connue
 * au-delà de « objet »).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'sea-events.json';

/** `ManannFactor.effect` (`src/engine/seaVoyage.ts:32`) : signe fixe (1|-1) + décompte flat/d10. */
const manannFactor = z.strictObject({
  id: z.string(),
  label: z.string(),
  effect: z.strictObject({
    sign: z.union([z.literal(1), z.literal(-1)]),
    flat: z.number(),
    d10: z.number(),
  }),
  source: sourceRefSchema,
});

/** `SeaEventDef` (`src/engine/seaVoyage.ts:34-42`) — `params` = sac hétérogène PAR `kind`, lu par clé. */
const seaEventDef = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  kind: z.string(),
  params: z.record(z.string(), z.unknown()),
  source: sourceRefSchema,
});

/** Palier du VOYAGE RAPIDE (`FastVoyagePalier`, `src/engine/seaVoyage.ts`) — cran du d10 (l.33-37) :
 *  fourchette `[min,max]` (`findTableEntry`) + conséquences en % (équipage/cargaison/Blessures) et
 *  Coups Critiques. `desc` = verbatim RAW (règle 5). */
const fastVoyagePalier = z.strictObject({
  min: z.number(),
  max: z.number(),
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  crewLostPct: z.number(),
  cargoLostPct: z.number(),
  hullLostPct: z.number(),
  criticals: z.number(),
  source: sourceRefSchema,
});

export const schema = z.strictObject({
  manann: z.strictObject({
    base: z.number(),
    portEventMod: z.number(),
    source: sourceRefSchema,
    factors: z.array(manannFactor),
  }),
  boardEvents: z.array(seaEventDef),
  portEvents: z.array(seaEventDef),
  fastVoyage: z.strictObject({ source: sourceRefSchema, paliers: z.array(fastVoyagePalier) }),
});
