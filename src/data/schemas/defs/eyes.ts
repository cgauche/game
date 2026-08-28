/**
 * Schéma de `eyes.json` — table Couleur des Yeux (2d10, LDB 05 l.742-754), consommée comme
 * `DetailColorData` (src/data/index.ts, partagée avec `hairs.json`).
 *
 * `source` reste OPTIONNELLE : la provenance portée est MAJORITAIRE (5/7 colonnes LDB), les 2
 * colonnes hors LDB (gnome NADJ, ogre ADE II) étant détaillées en prose — `sourceRefSchema` ne
 * porte qu'UN livre par entrée.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { raceKeySchema } from '../grammaire/valeurs';

export const file = 'eyes.json';
export const famille = 'entite';

const doc = document(
  'eyes',
  famille,
  {
    rand: z.number(),
    /** Clé = `raceKeySchema` (id stable, #313) — partiel (7 colonnes, pas toutes présentes par entrée). */
    color: z.partialRecord(raceKeySchema, z.string()),
  },
  {
    rand: { label: 'Seuil aléatoire (2d10)', hint: 'Borne haute cumulée du 2d10 qui atteint cette couleur' },
    color: { label: 'Couleur par race', hint: 'Couleur affichée, par race (colonne du tableau)' },
  },
  {
    codex: { keys: ['eyes'] },
    edit: { dataset: 'eyes' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
