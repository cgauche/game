/**
 * Validation d'un dataset app-owned contre son schéma zod (SCHEMA_DEFS) — SOURCE UNIQUE partagée par :
 *  - le contrat CI (`schema-contract.test.ts`) : parse chaque `src/data/*.json` ;
 *  - la SAUVEGARDE éditeur/Compendium (`CodexEdit.save`) : refuse d'écrire une donnée invalide ;
 *  - le chargement DEV (`dev-validate.ts`) : plante au démarrage si un JSON hand-édité a divergé.
 * Aucune duplication : `formatZodError` vivait dans le fichier de test, elle est ici pour être réutilisée
 * (un module `.test` n'est pas importable par le code applicatif).
 */
import type { z } from 'zod';
import { SCHEMA_DEFS } from './_registry.generated';

/** Formate un `ZodError` en message ACTIONNABLE : `<fichier> → <chemin.du.champ>: <erreur>`. */
export function formatZodError(file: string, error: z.ZodError): string {
  const lines = error.issues.map((iss) => `  - ${iss.path.join('.') || '(racine)'}: ${iss.message}`);
  return `${file} — JSON invalide contre son schéma :\n${lines.join('\n')}`;
}

/** Schéma zod d'un dataset par nom de fichier (`<file>.json`), ou undefined s'il n'est pas registré. */
export function schemaForFile(file: string): z.ZodTypeAny | undefined {
  return SCHEMA_DEFS.find((d) => d.file === file)?.schema;
}

/** Valide `value` contre le schéma du fichier `file` : message actionnable (champ-par-champ) si
 *  invalide, `null` si valide OU si le fichier n'est pas registré (un dataset hors contrat ne bloque
 *  pas — l'exhaustivité 94/94 est garantie par `schema-contract.test.ts`, pas ici). */
export function validateDataset(file: string, value: unknown): string | null {
  const schema = schemaForFile(file);
  if (!schema) return null;
  const result = schema.safeParse(value);
  return result.success ? null : formatZodError(file, result.error);
}
