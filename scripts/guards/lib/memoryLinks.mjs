// Mécanique de scan du garde-fou « lien mort dans la mémoire persistante ».
//
// PORTÉE DÉCLARÉE — l'INDEX VIVANT, c'est-à-dire les `.md` à plat de `.claude/memory/`. Deux
// vérifications déterministes, chacune rendant `{ file, line, kind, tok }` :
//   1. WIKI     — tout `[[nom]]` (formes `[[nom|alias]]`, `[[nom#ancre]]`, `[[nom.md]]` comprises)
//                 désigne une fiche de l'index vivant.
//   2. MARKDOWN — tout lien `[libellé](cible.md)` de `MEMORY.md` désigne un fichier présent, résolu
//                 relativement à `.claude/memory/`.
//
// ANGLES MORTS DÉCLARÉS (ce que ce garde NE mesure PAS) :
//   - `.claude/memory/_archive/` est HORS index par construction (`_consolidation-plan-2026-07-05.md`
//     § PHASE A : fiches closes/fusionnées, « NON indexé »). Ses fichiers ne sont ni scannés ni
//     admis comme cible : un `[[…]]` vers une fiche archivée est donc DÉTECTÉ mort dans l'index
//     vivant, et l'archive se cite par chemin (`.claude/memory/_archive/<nom>.md`). Mesure du
//     2026-07-26 : `_archive/` porte lui-même 190 liens dont 89 hors index vivant — figés à dessein.
//   - la PERTINENCE d'une cible (le lien pointe-t-il la bonne fiche ?) n'est pas mesurable ici.
//   - les liens SORTANTS hors mémoire (`docs/…`, `src/…`) relèvent de `scripts/docs/check-doc-refs.mjs`.
//   - les blocs de code clôturés (```…```) sont retirés avant scan : un `[[…]]` y est un EXEMPLE.
//   - les liens markdown hors `MEMORY.md` (prose de fiche) ne sont pas vérifiés.
//
// Module ESM pur — consommé par `src/memory-links-guard.test.ts`.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { parUnitesDeCode, listerDossier } from './lister.mjs';
import { join } from 'node:path';

/** Dossier de la mémoire persistante, relatif à la racine du dépôt. */
export const MEMORY_DIR = '.claude/memory';
/** Index de l'index : la fiche qui référence toutes les autres en markdown. */
export const MEMORY_INDEX = 'MEMORY.md';

/** Les `.md` à plat de `.claude/memory/` — l'INDEX VIVANT (jamais `_archive/`). @returns {string[]} */
export function liveNotes(root) {
  const dir = join(root, MEMORY_DIR);
  return listerDossier(dir).filter((nom) => nom.endsWith('.md') && statSync(join(dir, nom)).isFile());
}

/** Retire les blocs de code clôturés en PRÉSERVANT le compte de lignes. @returns {string} */
function stripFences(text) {
  let fenced = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return ''; }
      return fenced ? '' : line;
    })
    .join('\n');
}

/**
 * Scanne l'index vivant. @returns {{file: string, line: number, kind: string, tok: string}[]}
 * `file` est relatif à la racine du dépôt, `line` 1-basée.
 */
export function scanMemoryLinks(root) {
  const notes = liveNotes(root);
  const known = new Set(notes.map((f) => f.replace(/\.md$/, '')));
  const problems = [];

  for (const file of notes) {
    const rel = `${MEMORY_DIR}/${file}`;
    const lines = stripFences(readFileSync(join(root, MEMORY_DIR, file), 'utf8')).split('\n');

    lines.forEach((line, i) => {
      // 1. WIKI — [[nom]], [[nom|alias]], [[nom#ancre]], [[nom.md]]
      for (const m of line.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const target = m[1].split(/[|#]/)[0].trim().replace(/\.md$/, '');
        if (!known.has(target)) problems.push({ file: rel, line: i + 1, kind: 'fiche inexistante', tok: `[[${target}]]` });
      }

      // 2. MARKDOWN — uniquement dans l'index, où les liens sont des chemins de fichier
      if (file !== MEMORY_INDEX) return;
      for (const m of line.matchAll(/\]\(([^)\s]+\.md)(?:#[^)\s]*)?\)/g)) {
        const tok = m[1];
        if (/^[a-z]+:\/\//i.test(tok)) continue;
        if (!existsSync(join(root, MEMORY_DIR, tok))) problems.push({ file: rel, line: i + 1, kind: 'fichier absent', tok });
      }
    });
  }

  return problems.sort((a, b) => parUnitesDeCode(a.file, b.file) || a.line - b.line || parUnitesDeCode(a.tok, b.tok));
}

/** Rapport `fichier:ligne  [nature]  jeton`, une ligne par lien fautif. @returns {string} */
export function formatMemoryLinkProblems(problems) {
  return problems.map((p) => `  ${p.file}:${p.line}  [${p.kind}]  ${p.tok}`).join('\n');
}
