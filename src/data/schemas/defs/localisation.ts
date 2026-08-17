/**
 * Schéma de `localisation.json` — tables de Localisation des coups, FOYER UNIQUE data-driven
 * (`src/engine/combat.ts`). Deux familles : `personnage` (Localisation humaine/créature par
 * FORME de corps, LDB 13 p.159 / LDB 76 p.310 — `BODY_SHAPES`, clé = `BodyShape`, valeurs = `HitLocation`) et
 * `navire`/`navire-fluvial` (Localisation navale par gréement, MDG 13 / MSRC 7 — `ShipLocation`).
 * `HitLocation`/`ShipLocation` : `src/engine/types.ts` / `src/engine/combat.ts`.
 */
import { z } from 'zod';
import { sourceRefSchema } from '../common';

export const file = 'localisation.json';

const hitLocation = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);
const shipLocation = z.enum([
  'equipage',
  'avirons',
  'greement',
  'coque',
  'equipements',
  'cargaison',
  'gouvernail',
  'superstructure',
]);

const bodyLocEntry = z.strictObject({ min: z.number(), max: z.number(), loc: hitLocation });
const shipLocEntry = z.strictObject({
  min: z.number(),
  max: z.number(),
  avirons: shipLocation,
  voile: shipLocation,
  mixte: shipLocation,
});

export const schema = z.strictObject({
  personnage: z.strictObject({
    source: sourceRefSchema,
    /** Clé = `BodyShape` (`src/engine/types.ts`) — seules `humanoide`/`serpent`/`araignee` sont
     *  présentes dans le JSON (les autres formes retombent sur `humanoide`, cf. `hitLocationByShape`). */
    shapes: z.record(z.string(), z.array(bodyLocEntry)),
  }),
  navire: z.strictObject({
    source: sourceRefSchema,
    rigs: z.array(z.string()),
    entries: z.array(shipLocEntry),
  }),
  'navire-fluvial': z.strictObject({
    source: sourceRefSchema,
    rigs: z.array(z.string()),
    entries: z.array(shipLocEntry),
  }),
});
