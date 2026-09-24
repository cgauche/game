import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RACINE, sourcesSuivies } from '../scripts/guards/lib/modulesFeuilles.mjs';
import { estFichierVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { lecturesDHote } from '../scripts/guards/lib/graphiesDHote.mjs';

/**
 * Garde de classe #1801 — le rendu sous win32 (`scripts/docs/lib/plateforme-win32.mjs`) ne simule
 * pas les lectures définies par `scripts/guards/lib/graphiesDHote.mjs` : une source qui en porte une
 * rendrait sous win32 la graphie de l'hôte.
 *
 * PÉRIMÈTRE : toute source JS/TS SUIVIE par git (`sourcesSuivies`) hors instruments Vitest
 * (`estFichierVitest`), que le rendu sous win32 ne joue pas.
 * Les cas plantés sont ASSEMBLÉS à l'exécution : ce fichier ne porte lui-même aucune lecture d'hôte.
 */

const META = 'import' + '.meta';
const CR = 'create' + 'Require';
const REQ = 'req' + 'uire';

const detecte = (source: string) => lecturesDHote(source).length > 0;

describe('garde de classe — aucune lecture d’hôte que le rendu sous win32 ne simule', () => {
  it('cas plantés : chaque forme de lecture d’`import.meta.dirname`/`filename` est détectée', () => {
    const variantes = [
      `const ici = ${META}.dirname`,
      `const soi = ${META}.filename`,
      `const soi = ${META}?.filename`,
      `const ici = ${META} . dirname`,
      `const soi = ${META}['filename']`,
      `const ici = ${META}[\`dirname\`]`,
      `const { dirname } = ${META}`,
      `const { filename: soi, url } = ${META}`,
      `const racine = join(${META}.dirname, '..')`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : chaque acquisition de `path`/`url` hors hooks ESM est détectée', () => {
    const variantes = [
      `const path = ${REQ}('path')`,
      `const path = ${REQ}("node:path")`,
      `const { posix } = ${REQ}('node:path/posix')`,
      `const url = ${REQ}(\`node:url\`)`,
      `const path = ${CR}(${META}.url)('node:path')`,
      `const url = ${CR}(join(a, b))('url')`,
      `const path = process.getBuiltinModule('node:path')`,
      `const w = getBuiltinModule('path/win32')`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : un NOM lié à `createRequire(…)` acquiert de même, à sa ligne', () => {
    expect(lecturesDHote(`const req = ${CR}(${META}.url)\nconst path = req('node:path')`)).toEqual([
      expect.objectContaining({ ligne: 2 }),
    ]);
    expect(detecte(`const charger = module.${CR}(x)\ncharger('url')`)).toBe(true);
  });

  it('cas plantés : une lecture coupée par un saut de ligne est détectée, à sa première ligne', () => {
    expect(lecturesDHote(`const a = 1\nconst ici = ${META}\n  .dirname`)).toEqual([expect.objectContaining({ ligne: 2 })]);
    expect(lecturesDHote(`const path = ${REQ}(\n  'node:path',\n)`)).toEqual([expect.objectContaining({ ligne: 1 })]);
  });

  it('contrôle négatif : ce que les hooks ESM couvrent, et ce qui n’est pas une lecture d’hôte', () => {
    const neutres = [
      `const ici = fileURLToPath(new URL('.', ${META}.url))`,
      `if (${META}.main) main()`,
      "import path from 'node:path'",
      "const { posix } = await import('node:path')",
      `const ts = ${CR}(${META}.url)('typescript')`,
      `const m = ${REQ}('./path')`,
      `const m = ${REQ}('node:path-extra')`,
      'const dirname = path.dirname(fichier)',
      `const { dirname } = path`,
      `const x = config.${REQ}('path')`,
      `const nom = ${META}.url.endsWith('filename')`,
    ];
    for (const n of neutres) expect(detecte(n), n).toBe(false);
  });

  it('cas planté : la même lecture CITÉE en commentaire est hors de portée', () => {
    const source = [`// ${META}.filename`, `/* ${REQ}('node:path') */`].join('\n');
    expect(lecturesDHote(source)).toEqual([]);
  });

  it('aucune source suivie hors instruments ne porte une lecture d’hôte (tolérance ZÉRO)', () => {
    const suivies: string[] = sourcesSuivies().filter((rel: string) => !estFichierVitest(rel));
    expect(suivies.length, 'le listage des sources suivies est vide').toBeGreaterThan(1000);
    const offenders: string[] = [];
    for (const rel of suivies) {
      let texte: string;
      try {
        texte = readFileSync(join(RACINE, rel), 'utf8');
      } catch {
        continue; // suivi mais supprimé de l'arbre : aucun code à lire
      }
      for (const { ligne, extrait } of lecturesDHote(texte)) offenders.push(`${rel}:${ligne} → ${extrait}`);
    }
    expect(
      offenders,
      `Lecture(s) d'hôte non simulée(s) sous win32 — \`fileURLToPath(new URL(…, import.meta.url))\` et \`import … from\` :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
