/**
 * Contrat de donnée (Lot 1 — docs/plans/2026-07-06-perennite-10-ans-design.md § Lot 1) : garantit que
 * `src/data/*.json` reste conforme à son schéma zod (`src/data/schemas/defs/`), migré INCRÉMENT par
 * INCRÉMENT (comme les registres `gen-registry.mjs`). Trois volets, patron `comment-poison-guard.test.ts` :
 *  (a) chaque dataset REGISTRÉ (`SCHEMA_DEFS`) parse et valide son JSON réel — message actionnable ;
 *  (b) EXHAUSTIVITÉ : tout `src/data/*.json` est soit registré, soit dans `PENDING` (gelé à l'état
 *      initial de la migration — characteristics.json en est sorti, l'EXEMPLAIRE de la convention) ;
 *  (c) CLIQUET : une entrée `PENDING` qui a désormais un schéma doit en SORTIR (sinon la liste ne
 *      fond jamais, cf. le même resserrage sur `no-emoji-affordance.test.ts`) ;
 *  (d) preuve plantée : une clé inconnue est REJETÉE par le schéma `characteristics` (TDD).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { schema as characteristicsSchema } from './schemas/defs/characteristics';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/**
 * Datasets `src/data/*.json` sans schéma — VIDE depuis la fin de la migration (94/94 sous contrat) :
 * tout nouveau `.json` doit NAÎTRE avec son def (`src/data/schemas/defs/<nom>.ts` + `npm run gen`),
 * sinon le volet (b) échoue. Une entrée ne s'ajoute ici qu'à titre transitoire assumé, jamais durable.
 */
const PENDING = new Set<string>([]);

/** Formate un `ZodError` en message ACTIONNABLE : `<fichier> → <chemin.du.champ>: <erreur>`. */
function formatZodError(file: string, error: z.ZodError): string {
  const lines = error.issues.map((iss) => `  - ${iss.path.join('.') || '(racine)'}: ${iss.message}`);
  return `${file} — JSON invalide contre son schéma :\n${lines.join('\n')}`;
}

describe('contrat de donnée — src/data/*.json valide son schéma zod (SCHEMA_DEFS)', () => {
  for (const def of SCHEMA_DEFS) {
    it(`${def.file} valide ${def.schema === characteristicsSchema ? '(schéma characteristics)' : 'son schéma'}`, () => {
      const raw = JSON.parse(readFileSync(`${DATA_DIR}${def.file}`, 'utf8'));
      const result = def.schema.safeParse(raw);
      expect(result.success, result.success ? '' : formatZodError(def.file, result.error)).toBe(true);
    });
  }

  it('EXHAUSTIVITÉ : tout src/data/*.json est registré (SCHEMA_DEFS) ou explicitement PENDING', () => {
    const registered = new Set(SCHEMA_DEFS.map((d) => d.file));
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    const orphans = files.filter((f) => !registered.has(f) && !PENDING.has(f));
    expect(orphans, 'Fichier(s) .json ni schématisé(s) ni dans PENDING — ajouter un schéma ou l\'entrée PENDING').toEqual([]);
  });

  it('CLIQUET : aucune entrée PENDING ne doit avoir déjà un schéma (retirer de PENDING sinon)', () => {
    const registered = new Set(SCHEMA_DEFS.map((d) => d.file));
    const staleEntries = [...PENDING].filter((f) => registered.has(f));
    expect(staleEntries, 'Entrée(s) PENDING périmée(s) — un schéma existe déjà : les retirer de PENDING').toEqual([]);
  });

  it('preuve plantée (TDD) : une clé inconnue est REJETÉE par le schéma characteristics', () => {
    const planted = [
      { abr: 'CC', label: 'Capacité de Combat', type: 'roll', desc: 'x', base: { Humain: 20 }, source: { book: 'livre-de-base', page: 33 }, inventedField: 'poison' },
    ];
    const result = characteristicsSchema.safeParse(planted);
    expect(result.success).toBe(false);
  });
});
