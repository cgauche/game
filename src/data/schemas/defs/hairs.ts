/**
 * Schéma de `hairs.json` — table Couleur des Cheveux (2d10, LDB 05 l.756-768), consommée comme
 * `DetailColorData` (src/data/index.ts, partagée avec `eyes.json`).
 *
 * `source` reste OPTIONNELLE : la provenance portée est MAJORITAIRE (5/7 colonnes LDB), les 2
 * colonnes hors LDB (gnome NADJ, ogre ADE II) étant détaillées en prose — `sourceRefSchema` ne
 * porte qu'UN livre par entrée.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'hairs.json';
export const famille = 'entite';

const doc = document(
  'hairs',
  famille,
  {
    rand: z.number(),
    /** Override de la borne haute 2d10 PAR RACE (id stable `raceKeySchema`, #313 ; défaut = `rand`,
     *  calé LDB). Renseigné quand une édition d'une colonne utilise d'autres bornes que le LDB —
     *  ex. gnome (NADJ) : bornes 4-6/7-10/11 au lieu de 4/5-7/8-11 (#420). */
    randByRace: z.partialRecord(raceKeySchema, z.number()).optional(),
    /** Clé = `raceKeySchema` (id stable, #313) — partiel (7 colonnes, pas toutes présentes par entrée). */
    color: z.partialRecord(raceKeySchema, z.string()),
  },
  {
    rand: { label: 'Seuil aléatoire (2d10)', hint: 'Borne haute cumulée du 2d10 qui atteint cette couleur, sauf borne propre à une race' },
    randByRace: { label: 'Borne par race', hint: 'Borne haute 2d10 propre à une race, quand elle diffère du LDB' },
    color: { label: 'Couleur par race', hint: 'Couleur affichée, par race (colonne du tableau)' },
  },
  {
    codex: { keys: ['hairs'] },
    edit: { dataset: 'hairs' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
