/**
 * LE VERROU DE FORGE se mesure (#1262) — la marque `BuiltCascadeStep` est REQUISE, donc le type seul
 * suffirait… si le cast n'existait pas. Le lint (`no-restricted-syntax`, `eslint.config.js`) mure les
 * routes de forge ; ce test les LANCE sur la config RÉELLE (API ESLint, pas une copie de règle) et
 * exige le rouge. Sans lui, un sélecteur trop étroit laisse passer en silence : la sonde d'origine
 * (`TSAsExpression > TSTypeReference`, enfant DIRECT) rendait 0 erreur sur trois des quatre routes.
 *
 * La 4ᵉ route — annoter une valeur déjà élargie — est une LIMITE ASSUMÉE, dite au JSDoc de
 * `stepBrand.ts` : elle est ici en témoin explicite, jamais en oubli.
 */
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import ts from 'typescript';

/** Fichier de test SOUS le périmètre de la règle (jamais un minteur, qui est exempté). */
const SOUS_LA_REGLE = 'src/state/__sonde-verrou-marque.ts';

const eslint = new ESLint({ cwd: process.cwd() });

async function messagesDeVerrou(code: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: SOUS_LA_REGLE });
  return res.messages.filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => `${m.line}:${m.column}`);
}

const ENTETE = "import type { BuiltCascadeStep } from './stepBrand';\ndeclare const o: unknown;\n";

describe('#1262 — le lint mure les ROUTES DE FORGE de la marque', () => {
  it('`x as BuiltCascadeStep` — la forme directe', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const a = o as BuiltCascadeStep;\n`)).toHaveLength(1);
  });

  it('`<BuiltCascadeStep>x` — l’autre syntaxe de cast (nœud TSTypeAssertion, pas TSAsExpression)', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const b = <BuiltCascadeStep>o;\n`)).toHaveLength(1);
  });

  it('`x as BuiltCascadeStep[]` — un tableau s’interpose entre le cast et la référence', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const c = o as BuiltCascadeStep[];\n`)).toHaveLength(1);
  });

  it('`as unknown as readonly BuiltCascadeStep[]` — la route RÉALISTE vers `openSequence.steps`', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const d = [] as unknown as readonly BuiltCascadeStep[];\n`)).toHaveLength(1);
  });

  it('la marque JUMELLE (`BuiltRollRow`, monteur de rangée) est murée par la même règle', async () => {
    const code = "import type { BuiltRollRow } from '../ui/rollRowBuild';\ndeclare const o: unknown;\nexport const e = o as BuiltRollRow;\n";
    expect(await messagesDeVerrou(code)).toHaveLength(1);
  });

  it('LIMITE ASSUMÉE : annoter une valeur déjà élargie passe — aucun nœud de cast à interdire', async () => {
    const code = "import type { BuiltCascadeStep } from './stepBrand';\ndeclare const brut: any;\nexport const f: BuiltCascadeStep = brut;\n";
    expect(await messagesDeVerrou(code), 'documentée au JSDoc de `stepBrand.ts` — jamais un oubli').toHaveLength(0);
  });

  it('un cast SANS rapport avec la marque n’est pas touché (la règle ne mord que `Built*`)', async () => {
    const code = "import type { CascadeStep } from './pendings';\ndeclare const o: unknown;\nexport const g = o as CascadeStep;\n";
    expect(await messagesDeVerrou(code)).toHaveLength(0);
  });

  it('les MINTEURS restent exemptés : leur cast interne est la seule fabrique légitime', async () => {
    const [res] = await eslint.lintText(`${ENTETE}export const h = o as BuiltCascadeStep;\n`, { filePath: 'src/state/rollSeam.ts', warnIgnored: false });
    expect(res.messages.filter((m) => m.ruleId === 'no-restricted-syntax')).toHaveLength(0);
  });
});

/**
 * LES `@ts-expect-error` DU MURAGE SONT-ILS TUEURS ? (#1262 B4) — `roll-seam-mints.test.ts` atteste
 * que `pushCombatStep` refuse un littéral, par des directives `@ts-expect-error`. Une directive ne
 * vaut que si l'erreur attendue EXISTE : sous l'ancienne signature (`CascadeStep`), elle devient
 * INUTILISÉE et `tsc` rougit (TS2578) — c'est ce qui rend le test tueur plutôt que décoratif.
 *
 * Mesuré ICI sur un programme TypeScript RÉEL (API du compilateur, deux variantes de la MÊME
 * signature), pas sur une relecture du fichier : la sonde de mutation du lot devient une garde
 * REJOUABLE, au lieu d'une preuve à refaire à la main.
 */
const SONDE = (signature: 'BuiltCascadeStep' | 'CascadeStep') => `
declare const BRAND: unique symbol;
type CascadeStep = { id: string; kind: string };
type BuiltCascadeStep = CascadeStep & { readonly [BRAND]: true };
declare function pushCombatStep(step: ${signature}): void;
// @ts-expect-error — littéral nu : la marque de mint est absente
pushCombatStep({ id: 'e', kind: 'k' });
`;

function codesDeDiagnostic(code: string): number[] {
  const fileName = 'sonde-murage.ts';
  // `types: []` : la sonde ne dépend d'AUCUN `@types` du dépôt — elle mesure la signature, rien d'autre.
  const options: ts.CompilerOptions = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2020, types: [], skipLibCheck: true };
  const libPath = ts.getDefaultLibFilePath(options);
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2020, true);
  const host: ts.CompilerHost = {
    // Hors sonde : seule la bibliothèque standard de TypeScript est servie (références `/// <reference lib>`).
    getSourceFile: (n) => {
      if (n === fileName) return sf;
      const texte = ts.sys.readFile(n);
      return texte === undefined ? undefined : ts.createSourceFile(n, texte, ts.ScriptTarget.ES2020);
    },
    writeFile: () => {},
    getDefaultLibFileName: () => libPath,
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (n) => n.toLowerCase(),
    getCurrentDirectory: () => '',
    getNewLine: () => '\n',
    fileExists: (n) => n === fileName || ts.sys.fileExists(n),
    readFile: (n) => (n === fileName ? code : ts.sys.readFile(n)),
  };
  const program = ts.createProgram([fileName], options, host);
  return ts.getPreEmitDiagnostics(program).map((d) => d.code);
}

describe('#1262 B4 — la sonde de murage de `pushCombatStep` est TUEUSE', () => {
  it('signature MURÉE (`BuiltCascadeStep`) : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE('BuiltCascadeStep'))).toEqual([]);
  });

  it('signature D’AVANT (`CascadeStep`) : le littéral passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE('CascadeStep')), 'sans ce rouge, les `@ts-expect-error` du lot ne prouveraient rien').toContain(2578);
  });
});
