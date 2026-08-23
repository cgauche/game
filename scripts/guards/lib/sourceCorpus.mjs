// Corpus SOURCE d'un jeu de dossiers : la marche de dossiers + la lecture, en UN seul endroit —
// le walk `readdirSync` + `readFileSync` des gardes qui balaient l'arbre réel de `src/**`.
// Consommateurs : `cascade-step-stake-guard`, `label-logic-guard`, `roll-seam-exclusivity-guard`.
//
// FRONTIÈRE : cette lib LIT, elle ne mémorise pas. Aucun cache de module, aucun AST — un appel = une
// lecture disque. La mémoïsation appartient à l'APPELANT, seul à connaître la durée de vie utile de
// son corpus (un `it` de garde, un run de générateur) ; un cache posé ici survivrait au worker.
// Les FILTRES de périmètre (exclusions nominatives, dossiers de whitelist) restent également chez
// l'appelant : ils font partie de ce que la garde MESURE.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt : `scripts/guards/lib/` → `../../../`. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');

const EST_TEST = /\.test\./;

/**
 * Fichiers source de `dirs` (absolus, ou relatifs à la racine du dépôt), parcourus RÉCURSIVEMENT
 * dans l'ordre de `readdirSync`, avec leur texte.
 * @param {string[]} dirs
 * @param {{ exts?: string[], tests?: boolean }} [opts] `exts` = extensions retenues
 *   (défaut `.ts`/`.tsx`) ; `tests` = garder les `*.test.*` (défaut : non).
 * @returns {{ abs: string, rel: string, text: string }[]} `rel` = chemin POSIX depuis la racine.
 */
export function readCorpus(dirs, { exts = ['.ts', '.tsx'], tests = false } = {}) {
  const out = [];
  const garde = (nom) => exts.some((e) => nom.endsWith(e)) && (tests || !EST_TEST.test(nom));
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!garde(e)) continue;
      out.push({ abs: p, rel: relative(ROOT, p).split('\\').join('/'), text: readFileSync(p, 'utf8') });
    }
  };
  for (const d of dirs) walk(isAbsolute(d) ? d : join(ROOT, d));
  return out;
}
