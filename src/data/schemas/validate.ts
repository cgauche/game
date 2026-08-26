/**
 * Validation d'un document authoré contre son schéma zod — SOURCE UNIQUE, DEUX portes :
 *  - `validateDataset(file, value)` : porte par FICHIER, pour qui connaît le nom du document —
 *    contrat CI (`schema-contract.test.ts`), sauvegarde éditeur/Compendium (`CodexEdit.save`),
 *    chargement DEV (`dev-validate.ts`), garde de pré-commit (`scripts/guards/validate-data.mts`).
 *    Le registre couvre les DEUX racines (`src/data` par basename, `src/scenes` par chemin relatif).
 *  - `validateDocument(schema, value)` : porte par SCHÉMA, pour un seam qui n'a PAS de nom de
 *    fichier — `parseProject` sert du JSON committé, du localStorage et de l'import utilisateur.
 * `formatZodError` est partagée par les deux (un module `.test` n'est pas importable par le code
 * applicatif).
 */
import type { z } from 'zod';
import { SCHEMA_DEFS } from './_registry.generated';
import { SCHEMA_DEFS_SCENES } from './_registry-scenes.generated';
import type { SchemaDef } from './types';
import type { MetaChamp } from './grammaire/meta';

/** Le registre des DEUX racines de documents (`src/data` + `src/scenes`). */
export const DEFS_DE_DOCUMENT: readonly SchemaDef[] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES];

/** Formate un `ZodError` en message ACTIONNABLE : `<sujet> → <chemin.du.champ>: <erreur>`. */
export function formatZodError(sujet: string, error: z.ZodError): string {
  const lines = error.issues.map((iss) => `  - ${iss.path.join('.') || '(racine)'}: ${iss.message}`);
  return `${sujet} — JSON invalide contre son schéma :\n${lines.join('\n')}`;
}

/** Schéma zod d'un document par nom de fichier (`characteristics.json`, `arene/arene-projet.json`),
 *  ou undefined s'il n'est pas registré. */
export function schemaForFile(file: string): z.ZodTypeAny | undefined {
  return DEFS_DE_DOCUMENT.find((d) => d.file === file)?.schema;
}

/** Méta d'ÉDITION d'un document par nom de fichier — le canal registre est le SEUL chemin
 *  schéma→atelier (`src/ui/compendium/editFields.ts`). `undefined` pour un def qui ne passe pas par
 *  `document()` ; adoption par def : lot L1b #1467. */
export function metaPourFichier(file: string): Readonly<Record<string, MetaChamp>> | undefined {
  return DEFS_DE_DOCUMENT.find((d) => d.file === file)?.meta;
}

/** Valide `value` contre le schéma du fichier `file` : `null` si valide, message actionnable
 *  (champ-par-champ) si invalide. Un fichier NON REGISTRÉ est une ERREUR NOMMÉE, jamais un
 *  laissez-passer : tout document des deux racines a son def (`defs/`, `defs-scenes/`). */
export function validateDataset(file: string, value: unknown): string | null {
  const schema = schemaForFile(file);
  if (!schema) {
    return `${file} — aucun schéma registré : déposer son def dans src/data/schemas/defs/ (racine src/data) ou defs-scenes/ (racine src/scenes), puis \`npm run gen\`.`;
  }
  const result = schema.safeParse(value);
  return result.success ? null : formatZodError(file, result.error);
}

/** Valide `value` contre `schema` — porte du seam SANS nom de fichier (chargement d'un projet depuis
 *  le localStorage ou un import utilisateur). Même format d'erreur actionnable ; `sujet` nomme le
 *  document dans le message. */
export function validateDocument(schema: z.ZodTypeAny, value: unknown, sujet = 'Document'): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : formatZodError(sujet, result.error);
}
