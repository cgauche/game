/**
 * Schéma de `hairs.json` — table Couleur des Cheveux (2d10, LDB 05 l.756-768), consommée comme
 * `DetailColorData` (src/data/index.ts, partagée avec `eyes.json`).
 */
import { z } from 'zod';
import { raceKeySchema, sourceRefSchema } from '../common';

export const file = 'hairs.json';

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    rand: z.number(),
    /** Override de la borne haute 2d10 PAR RACE (id stable `raceKeySchema`, #313 ; défaut = `rand`,
     *  calé LDB). Renseigné quand une édition d'une colonne utilise d'autres bornes que le LDB —
     *  ex. gnome (NADJ) : bornes 4-6/7-10/11 au lieu de 4/5-7/8-11 (#420). */
    randByRace: z.partialRecord(raceKeySchema, z.number()).optional(),
    /** Clé = `raceKeySchema` (id stable, #313) — partiel (7 colonnes, pas toutes présentes par entrée). */
    color: z.partialRecord(raceKeySchema, z.string()),
    /** Provenance MAJORITAIRE (5/7 colonnes LDB) ; `note` détaille les 2 colonnes hors LDB
     *  (gnome NADJ, ogre ADE II) — `sourceRefSchema` ne porte qu'UN livre par entrée. */
    source: sourceRefSchema.optional(),
  }),
);
