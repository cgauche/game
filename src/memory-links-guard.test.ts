import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  scanMemoryLinks,
  formatMemoryLinkProblems,
  liveNotes,
  MEMORY_DIR,
} from '../scripts/guards/lib/memoryLinks.mjs';

/**
 * Garde-fou « lien mort dans la mémoire persistante ».
 *
 * Un lien de fiche est la seule partie de la mémoire qui soit MÉCANIQUEMENT vérifiable : une prose
 * fausse se relit comme une vérité, un `[[nom]]` qui ne résout pas est un fait. La portée exacte et
 * les angles morts sont DÉCLARÉS en tête de `scripts/guards/lib/memoryLinks.mjs` — en résumé :
 * l'index VIVANT (`.claude/memory/*.md` à plat), `_archive/` hors index par construction.
 *
 * Le contrat est POSITIF et à ZÉRO : aucune liste d'offenseurs tolérés, aucun cliquet. Un lien
 * fautif fait échouer en le NOMMANT avec sa position (`fichier:ligne  [nature]  jeton`).
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url)); // src/ → ../ = racine du projet

/** Monte un faux arbre mémoire et rend son chemin racine (à supprimer par l'appelant). */
function forgeMemory(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'wfrp-mem-'));
  mkdirSync(join(root, MEMORY_DIR), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, MEMORY_DIR, name), body);
  return root;
}

describe('garde-fou « lien mort dans la mémoire persistante »', () => {
  it('MORSURE : un [[nom]] sans fiche et un lien MEMORY.md sans fichier sont nommés avec leur position', () => {
    const root = forgeMemory({
      'MEMORY.md': '# Index\n- [vivante](fiche-vivante.md)\n- [fantome](fiche-fantome.md)\n',
      'fiche-vivante.md': 'Prolonge [[fiche-vivante]].\nVoir [[fiche-jamais-ecrite]].\n',
    });
    try {
      const problems = scanMemoryLinks(root);
      expect(problems).toEqual([
        { file: `${MEMORY_DIR}/fiche-vivante.md`, line: 2, kind: 'fiche inexistante', tok: '[[fiche-jamais-ecrite]]' },
        { file: `${MEMORY_DIR}/MEMORY.md`, line: 3, kind: 'fichier absent', tok: 'fiche-fantome.md' },
      ]);
      expect(formatMemoryLinkProblems(problems)).toContain('fiche-vivante.md:2');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('les formes saines résolvent : alias, ancre, suffixe .md, et un exemple en bloc de code est ignoré', () => {
    const root = forgeMemory({
      'MEMORY.md': '[a](fiche-a.md) et [b](fiche-b.md#section)\n',
      'fiche-a.md': 'Voir [[fiche-b|le libellé]], [[fiche-b#ancre]], [[fiche-b.md]].\n',
      'fiche-b.md': 'Exemple de syntaxe :\n```\n[[une-fiche-qui-nexiste-pas]]\n```\nFin.\n',
    });
    try {
      expect(scanMemoryLinks(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('un [[…]] vers une fiche ARCHIVÉE est mort : `_archive/` est hors index vivant', () => {
    const root = forgeMemory({ 'fiche-a.md': 'Voir [[fiche-close]].\n' });
    mkdirSync(join(root, MEMORY_DIR, '_archive'), { recursive: true });
    writeFileSync(join(root, MEMORY_DIR, '_archive', 'fiche-close.md'), 'close\n');
    try {
      expect(scanMemoryLinks(root)).toEqual([
        { file: `${MEMORY_DIR}/fiche-a.md`, line: 1, kind: 'fiche inexistante', tok: '[[fiche-close]]' },
      ]);
      expect(liveNotes(root)).toEqual(['fiche-a.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ARBRE RÉEL : aucun lien mort dans `.claude/memory/`', () => {
    const problems = scanMemoryLinks(ROOT);
    expect(problems, `\n${formatMemoryLinkProblems(problems)}\n`).toEqual([]);
  });
});
