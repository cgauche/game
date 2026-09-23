/**
 * GARDE — aucune API que `zod` étiquette comme retirée (`node_modules/zod/v4/classic/compat.d.ts:10`)
 * n'est employée sous `src/` ni `scripts/` (#1473 R1, décision 8). La liste des noms se lit dans la
 * déclaration de zod (`apisDepreciees`, `scripts/guards/lib/zodDeprecie.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { apisDepreciees, usagesDepreciees } from '../scripts/guards/lib/zodDeprecie.mjs';

const COMPAT = join(dirname(createRequire(import.meta.url).resolve('zod/package.json')), 'v4/classic/compat.d.ts');
const NOMS = apisDepreciees(readFileSync(COMPAT, 'utf8'));

describe('API retirée de zod', () => {
  it('la liste se LIT dans `compat.d.ts` et nomme les deux API que le dépôt employait', () => {
    expect(NOMS).toEqual(expect.arrayContaining(['ZodIssueCode', 'ZodTypeAny', 'setErrorMap', 'ZodFirstPartyTypeKind']));
    expect(NOMS).not.toContain('ZodRawShape');
  });

  it('témoin : un accès `z.Nom` et un import nommé depuis `zod` sont vus, un commentaire ne l’est pas', () => {
    const texte = [
      `ctx.addIssue({ code: z.${'ZodIssueCode'}.custom });`,
      `import { z, type ${'ZodTypeAny'} } from 'zod';`,
      `// z.${'ZodIssueCode'} en commentaire`,
      `const url = 'https://exemple'; // z.${'ZodTypeAny'}`,
    ].join('\n');
    expect(usagesDepreciees([{ rel: 'temoin.ts', text: texte }], NOMS)).toEqual(['temoin.ts:1 ZodIssueCode', 'temoin.ts:2 ZodTypeAny']);
  });

  it('aucun site sous `src/` ni `scripts/`', () => {
    const fichiers = readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mts', '.mjs'], tests: true });
    expect(usagesDepreciees(fichiers, NOMS)).toEqual([]);
  });
});
