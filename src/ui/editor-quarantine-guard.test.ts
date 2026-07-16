import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou #495 — l'ATELIER (`src/ui/editor/GameOpEditor.tsx` : `opSummary`/`formulaSummary` ;
 * `src/ui/editor/ConditionEditor.tsx` : `condSummary`) ne fuit plus sur une surface JOUEUR. Ces
 * résumeurs sont le vocabulaire TECHNIQUE de l'éditeur (ids bruts, jargon) — le renderer JOUEUR est
 * `opRows`/`GameOpChips` (`src/ui/compendium/opRows.ts`, `src/ui/GameOpChips.tsx`) et
 * `humanizeCondition` (`src/ui/compendium/humanize.ts`). Deux volets : (a) tout import nommant
 * `opSummary`/`formulaSummary`/`condSummary` depuis `editor/GameOpEditor`/`editor/ConditionEditor` —
 * ZÉRO exemption ; (b) tout AUTRE import depuis `editor/GameOpEditor`/`editor/ConditionEditor` (ex.
 * `GameOpEditor`/`ConditionEditor` eux-mêmes) — allowlist NOMINATIVE des surfaces d'atelier assumées
 * (Compendium éditable, galerie DEV). Patron structurel de `src/effective-values-guard.test.ts`
 * (#498) : comptage PAR LIGNE, fail-closed sur toute exemption périmée. Scan `src/**\/*.ts(x)` hors
 * `*.test.*` et hors `src/ui/editor/**` (l'atelier peut s'auto-référencer).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const EDITOR_DIR = join(SRC, 'ui', 'editor');

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (p === EDITOR_DIR) continue; // l'atelier peut s'auto-référencer
        walk(p);
      } else if (/\.(ts|tsx)$/.test(e) && !/\.test\.(ts|tsx)$/.test(e) && !e.endsWith('.d.ts')) {
        files.push(p);
      }
    }
  };
  walk(SRC);
  return files;
}

/** Import nommant `opSummary`/`formulaSummary`/`condSummary` DEPUIS `editor/GameOpEditor`/
 *  `editor/ConditionEditor` — ZÉRO exemption. */
const BANNED_NAMED_IMPORT_RX = /import\s*\{[^}]*\b(opSummary|formulaSummary|condSummary)\b[^}]*\}\s*from\s*['"][^'"]*editor\/(GameOpEditor|ConditionEditor)['"]/;

/** Tout import DEPUIS `editor/GameOpEditor`/`editor/ConditionEditor` (nommant autre chose que les 3
 *  bannis ci-dessus, capturé par la regex précédente en priorité) — allowlist nominative des surfaces
 *  d'atelier assumées, PAR module (un même fichier peut composer les 2 ateliers). */
const IMPORT_FROM_WORKSHOP_RX = /from\s*['"][^'"]*editor\/(GameOpEditor|ConditionEditor)['"]/;

const ALLOWLIST: { file: string; module: 'GameOpEditor' | 'ConditionEditor'; count: number; reason: string }[] = [
  { file: 'src/ui/compendium/CodexEdit.tsx', module: 'GameOpEditor', count: 1, reason: 'Compendium éditable = surface d’atelier assumée.' },
  { file: 'src/ui/compendium/StructFields.tsx', module: 'GameOpEditor', count: 1, reason: 'idem — surface d’atelier assumée.' },
  { file: 'src/ui/compendium/StructFields.tsx', module: 'ConditionEditor', count: 1, reason: 'idem — surface d’atelier assumée (#495).' },
  { file: 'src/ui/gallery/registry.tsx', module: 'GameOpEditor', count: 1, reason: 'spécimen vivant exigé par gallery-exhaustive.' },
];

/** Une déclaration `import { ... } from '...'` MULTILIGNE échappe au scan par ligne (les regex
 *  du garde-fou opèrent ligne à ligne) — on la replie en une seule ligne logique AVANT le scan.
 *  Le span repéré est remplacé par sa forme repliée (sans saut de ligne) suivie du même nombre de
 *  sauts de ligne qu'il en consommait : la déclaration devient scannable EN UNE LIGNE sur son numéro
 *  de PREMIÈRE ligne d'origine, et la numérotation de TOUT le reste du fichier reste inchangée (le
 *  rapport `fichier:ligne` pointe exactement le premier caractère de l'import). */
function foldMultilineImports(content: string): string {
  const IMPORT_DECL_RX = /import\s*(?:type\s*)?\{[^}]*\}\s*from\s*['"][^'"]+['"]/gs;
  return content.replace(IMPORT_DECL_RX, (decl) => {
    const newlineCount = (decl.match(/\n/g) ?? []).length;
    const folded = decl.replace(/\s*\n\s*/g, ' ');
    return folded + '\n'.repeat(newlineCount);
  });
}

describe('garde-fou quarantaine éditeur — opSummary/formulaSummary/condSummary ne fuient pas sur une surface joueur (#495)', () => {
  it('aucun import opSummary/formulaSummary/condSummary depuis editor/GameOpEditor|ConditionEditor, autres imports allowlistés', () => {
    const files = scanFiles();
    const bannedOffenders: string[] = [];
    const otherOffenders: string[] = [];
    const allowHits = new Map<string, number>();

    for (const f of files) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const lines = foldMultilineImports(readFileSync(f, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (BANNED_NAMED_IMPORT_RX.test(line)) {
          bannedOffenders.push(`${rel}:${i + 1} ${line.trim()}`);
          return;
        }
        const m = IMPORT_FROM_WORKSHOP_RX.exec(line);
        if (m) {
          const mod = m[1] as 'GameOpEditor' | 'ConditionEditor';
          const key = `${rel}#${mod}`;
          const entry = ALLOWLIST.find((e) => e.file === rel && e.module === mod);
          if (entry) {
            allowHits.set(key, (allowHits.get(key) ?? 0) + 1);
          } else {
            otherOffenders.push(`${rel}:${i + 1} ${line.trim()}`);
          }
        }
      });
    }

    expect(
      bannedOffenders,
      `opSummary/formulaSummary/condSummary importé hors atelier — utiliser opRows/GameOpChips/humanizeCondition (src/ui/compendium/opRows.ts, src/ui/GameOpChips.tsx, src/ui/compendium/humanize.ts) :\n${bannedOffenders.join('\n')}`,
    ).toEqual([]);

    expect(
      otherOffenders,
      `Import depuis editor/GameOpEditor|ConditionEditor hors allowlist nominative — ajouter à ALLOWLIST avec raison, ou composer opRows/GameOpChips/humanizeCondition :\n${otherOffenders.join('\n')}`,
    ).toEqual([]);

    const stale = ALLOWLIST.filter((e) => (allowHits.get(`${e.file}#${e.module}`) ?? 0) !== e.count).map(
      (e) => `${e.file}#${e.module} — attendu ${e.count}, trouvé ${allowHits.get(`${e.file}#${e.module}`) ?? 0}`,
    );
    expect(stale, `Exemption(s) périmée(s) (compte réel ≠ compte déclaré) — nettoyer ALLOWLIST :\n${stale.join('\n')}`).toEqual([]);
  });

  it('foldMultilineImports détecte un import MULTILIGNE banni (opSummary sur plusieurs lignes) et préserve le numéro de la 1re ligne', () => {
    const fixture = [
      "const x = 1;",
      "import {",
      "  opSummary,",
      "  GameOpEditor,",
      "} from '../editor/GameOpEditor';",
      "const y = 2;",
    ].join('\n');

    const folded = foldMultilineImports(fixture).split('\n');
    expect(folded).toHaveLength(6); // même nombre de lignes — numérotation préservée
    expect(BANNED_NAMED_IMPORT_RX.test(folded[1])).toBe(true); // ligne 2 = 1re ligne de l'import d'origine
    expect(folded[1]).toContain('opSummary');
    expect(folded[5]).toBe('const y = 2;'); // reste du fichier inchangé, numérotation intacte

    // Non replié (scan naïf par ligne), aucune des lignes brutes ne matche le motif banni : le
    // garde-fou AURAIT laissé fuiter cet import sans le repliage.
    expect(fixture.split('\n').some((l) => BANNED_NAMED_IMPORT_RX.test(l))).toBe(false);
  });
});
