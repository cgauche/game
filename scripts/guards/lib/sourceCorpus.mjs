// Corpus SOURCE d'un jeu de dossiers : la marche de dossiers + la lecture, en UN seul endroit —
// la marche de `listerArbre` + le `readFileSync` des gardes qui balaient l'arbre réel de `src/**`.
// Consommateurs : TOUTE garde qui balaie l'arbre réel de `src/**` — aucun compte n'est écrit ici, il
// périmerait au premier import suivant ; la liste se CALCULE (`grep -rl sourceCorpus.mjs src scripts`).
//
// FRONTIÈRE : cette lib LIT, elle ne mémorise pas. Aucun cache de module, aucun AST — un appel = une
// lecture disque. La mémoïsation appartient à l'APPELANT, seul à connaître la durée de vie utile de
// son corpus (un `it` de garde, un run de générateur) ; un cache posé ici survivrait au worker.
// Les FILTRES de périmètre (exclusions nominatives, dossiers de whitelist) restent également chez
// l'appelant : ils font partie de ce que la garde MESURE.
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { listerArbre } from './lister.mjs';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt : `scripts/guards/lib/` → `../../../`. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');

const EST_TEST = /\.test\./;

/**
 * Fichiers source de `dirs` (absolus, ou relatifs à la racine du dépôt), parcourus RÉCURSIVEMENT
 * en ORDRE TOTAL (`listerArbre`), avec leur texte.
 * @param {string[]} dirs
 * @param {{ exts?: string[], tests?: boolean }} [opts] `exts` = extensions retenues
 *   (défaut `.ts`/`.tsx`) ; `tests` = garder les `*.test.*` (défaut : non).
 * @returns {{ abs: string, rel: string, text: string }[]} `rel` = chemin POSIX depuis la racine.
 */
export function readCorpus(dirs, { exts = ['.ts', '.tsx'], tests = false } = {}) {
  const garde = (nom) => exts.some((e) => nom.endsWith(e)) && (tests || !EST_TEST.test(nom));
  return dirs.flatMap((d) => {
    const base = isAbsolute(d) ? d : join(ROOT, d);
    return listerArbre(base, { filtre: garde }).map((rel) => {
      const p = join(base, rel);
      return { abs: p, rel: relative(ROOT, p).split('\\').join('/'), text: readFileSync(p, 'utf8') };
    });
  });
}
