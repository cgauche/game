/**
 * Schéma de `naval-ports.json` — Index des ports de la Mer des Griffes (#217, MDG 15 l.439-506) :
 * catalogue par id STABLE, consommé par référence (`MapPlace.port.ref`) depuis la carte du monde
 * (`src/state/worldMap.ts`). `production`/`surplus`/`demande` sont keyés par id de `sea-cargo.json`
 * (+ marqueurs `commerce`/`minimum-vital`, cf. `PortProfile`, `src/engine/seaVoyage.ts`).
 */
import { z } from 'zod';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'naval-ports.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    /** Région/nation de la colonne « Lieu » de l'Index (regroupement RAW, ex. « Nordland », « Tilée »). */
    region: z.string(),
    taille: z.number(),
    richesse: z.number(),
    production: z.array(z.string()).optional(),
    surplus: z.record(z.string(), z.number()).optional(),
    demande: z.record(z.string(), z.number()).optional(),
    /** Grand port cosmopolite (Marienburg/Lothern, MDG 15 l.343-349). */
    cosmopolite: z.boolean().optional(),
    /** Colonne Dirigeant, verbatim. */
    dirigeant: z.string().optional(),
    /** Colonne Notes, verbatim Markdown. */
    desc: z.string().optional(),
    source: sourceRefSchema,
  }),
);
