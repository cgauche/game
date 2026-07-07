/**
 * Validation DURE des datasets app-owned au CHARGEMENT — DEV uniquement (`import.meta.env.DEV`). En prod,
 * le JSON servi a DÉJÀ été validé par la porte CI (`schema-contract.test.ts`) : aucun coût runtime.
 * En dev, une édition à la main d'un `src/data/*.json` qui diverge de son schéma zod (SCHEMA_DEFS) fait
 * remonter un message champ-par-champ (`formatZodError`) dès le démarrage — même contrat que la CI et que
 * la sauvegarde Codex, servi par la SOURCE UNIQUE `schemas/validate.ts`.
 */
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { validateDataset } from './schemas/validate';

/** Tous les `src/data/*.json` chargés EAGER par Vite (clé = chemin relatif `./<file>.json`). */
const RAW = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

/** Valide chaque dataset registré contre son schéma ; log champ-par-champ + throw au premier invalide. */
export function validateDataOnLoad(): void {
  const failures: string[] = [];
  for (const def of SCHEMA_DEFS) {
    const raw = RAW[`./${def.file}`];
    if (raw === undefined) { failures.push(`${def.file} — introuvable (import.meta.glob)`); continue; }
    const err = validateDataset(def.file, raw);
    if (err) failures.push(err);
  }
  if (failures.length) {
    const report = failures.join('\n\n');
    console.error(`[contrat de donnée] ${failures.length} dataset(s) invalide(s) :\n\n${report}`);
    throw new Error(`Contrat de donnée violé au chargement — corriger src/data/*.json :\n\n${report}`);
  }
}
