import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou FINS DE LIGNE de `Source/` — les livres VF sont la vérité CITABLE du dépôt (CLAUDE.md
 * règle 1) et toute réf `LDB <chap> l.<ligne>` se vérifie en comptant des lignes dans ces fichiers.
 * `.gitattributes:5` (`* text=auto eol=lf`) impose le LF dans l'index ET dans la copie de travail.
 *
 * CE QUE LA PORTE MESURE : `git ls-files --eol -- Source/` rend, par fichier, l'état de l'index
 * (`i/…`) et celui du disque (`w/…`). Tout fichier TEXTE doit être `i/lf` ET `w/lf` — liste BLANCHE :
 * `crlf`, `mixed` et `none` sont refusés, jamais tolérés. Les binaires (`-text`, cf. `.gitattributes`
 * §Binaires) sortent du périmètre : aucune conversion ne les concerne.
 *
 * OÙ ELLE MORD : sur la CI (checkout frais depuis l'index) elle est VACUE — tout y naît en LF. Elle
 * mord sur un arbre LOCAL qu'un outil a réécrit en CRLF (un parseur, un éditeur, une opération git
 * sous `core.autocrlf=true`) : un `Source/` en CRLF décale les lignes citées et fait mentir les réfs.
 * Geste de remise en état, nommé par le message : `git add --renormalize Source/`.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)

/** Une ligne de `git ls-files --eol` : `i/<eol>  w/<eol>  attr/<attrs>\t<chemin>`. */
export type EolRow = { index: string; worktree: string; path: string };

/** Découpe la sortie de `git ls-files --eol` en lignes structurées (colonnes séparées par des blancs,
 *  chemin séparé par une TABULATION — un chemin peut contenir des espaces). */
export function parseEolOutput(sortie: string): EolRow[] {
  const rows: EolRow[] = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    const tab = ligne.indexOf('\t');
    if (tab < 0) continue;
    const colonnes = ligne.slice(0, tab).trim().split(/\s+/);
    const index = colonnes.find((c) => c.startsWith('i/'))?.slice(2) ?? '';
    const worktree = colonnes.find((c) => c.startsWith('w/'))?.slice(2) ?? '';
    rows.push({ index, worktree, path: ligne.slice(tab + 1) });
  }
  return rows;
}

/** Fichiers TEXTE dont l'index ou le disque n'est pas en LF — le rapport de la porte. */
export function nonLf(rows: EolRow[]): string[] {
  return rows
    .filter((r) => r.index !== '-text' && r.worktree !== '-text')
    .filter((r) => r.index !== 'lf' || r.worktree !== 'lf')
    .map((r) => `${r.path} → index ${r.index || '(vide)'} / disque ${r.worktree || '(vide)'}`);
}

const SORTIE = execFileSync('git', ['ls-files', '--eol', '--', 'Source/'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 1 << 28,
});

describe('garde-fou fins de ligne — `Source/` reste en LF, index et disque', () => {
  it('la porte lit un inventaire NON VIDE (une mesure sur zéro fichier ne prouve rien)', () => {
    expect(parseEolOutput(SORTIE).length).toBeGreaterThan(1000);
  });

  it('cas planté : CRLF, mixed et index divergent sont refusés ; `-text` sort du périmètre', () => {
    const planté: EolRow[] = [
      { index: 'lf', worktree: 'crlf', path: 'Source/a.md' },
      { index: 'lf', worktree: 'mixed', path: 'Source/b.md' },
      { index: 'crlf', worktree: 'lf', path: 'Source/c.md' },
      { index: 'lf', worktree: 'lf', path: 'Source/d.md' },
      { index: '-text', worktree: '-text', path: 'Source/e.png' },
    ];
    expect(nonLf(planté).map((s) => s.split(' →')[0])).toEqual(['Source/a.md', 'Source/b.md', 'Source/c.md']);
  });

  it('cas planté : le chemin est lu après la TABULATION, espaces compris', () => {
    const ligne = 'i/lf    w/crlf   attr/text=auto eol=lf \tSource/WH - V4 - Livre/01 - Chapitre.md';
    expect(parseEolOutput(ligne)).toEqual([
      { index: 'lf', worktree: 'crlf', path: 'Source/WH - V4 - Livre/01 - Chapitre.md' },
    ]);
  });

  it('aucun fichier de `Source/` n’échappe au LF (tolérance ZÉRO)', () => {
    const offenders = nonLf(parseEolOutput(SORTIE));
    expect(
      offenders,
      `Fins de ligne non-LF sous \`Source/\` — les réfs \`LDB <chap> l.<ligne>\` s'y décalent.\nRemise en état : \`git add --renormalize Source/\` (cf. .gitattributes:5) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
