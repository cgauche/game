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
