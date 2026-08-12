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

  /**
   * LA ROUTE DE L'ALIAS (#1262 V3 Lf) — les sélecteurs de cast filtrent par NOM d'identifiant : une
   * seule ligne (`type A = BuiltRollRow`) suffisait à sortir du radar, et le cast passait alors tsc ET
   * eslint (mesuré EXIT 0 avant fermeture). L'alias est donc refusé À SA DÉCLARATION — mais seulement
   * quand le type ALIASÉ EST la marque : « aucun alias légitime n'existe » est FAUX, mesuré (4 sites,
   * `nightBands.ts` l.104/115/116 + `cascade.ts` l.57, types de CALLBACK qui exigent des étapes
   * mintées). Employer la marque dans une signature n'est pas la déguiser — les deux cas sont ici.
   */
  it('`type A = BuiltRollRow` — l’ALIAS est refusé à sa DÉCLARATION (sinon le cast repasse par un autre nom)', async () => {
    const code = [
      "import type { BuiltRollRow } from '../ui/rollRowBuild';",
      'declare const o: unknown;',
      'type AliasSonde = BuiltRollRow;',
      'export const i = o as AliasSonde;',
    ].join('\n');
    expect(await messagesDeVerrou(code), 'la route alias doit être MURÉE, pas seulement dite').toHaveLength(1);
  });

  it('l’alias sous un TABLEAU (`type B = readonly BuiltCascadeStep[]`) est refusé aussi', async () => {
    const code = [
      "import type { BuiltCascadeStep } from './stepBrand';",
      'declare const o: unknown;',
      'type AliasTab = readonly BuiltCascadeStep[];',
      'export const j = o as AliasTab;',
    ].join('\n');
    expect(await messagesDeVerrou(code)).toHaveLength(1);
  });

  it('un cast SANS rapport avec la marque n’est pas touché (la règle ne mord que `Built*`)', async () => {
    const code = "import type { CascadeStep } from './pendings';\ndeclare const o: unknown;\nexport const g = o as CascadeStep;\n";
    expect(await messagesDeVerrou(code)).toHaveLength(0);
  });

  it('un type de CALLBACK qui EXIGE des étapes mintées passe : employer la marque n’est pas la déguiser', async () => {
    const code = [
      "import type { BuiltCascadeStep } from './stepBrand';",
      'type Applier = (rowInserts: readonly BuiltCascadeStep[]) => BuiltCascadeStep[];',
      'export const l: Applier = (r) => [...r];',
    ].join('\n');
    expect(await messagesDeVerrou(code), 'forme RÉELLE de `nightBands.ts`/`cascade.ts` — la fauche serait le murage lui-même').toHaveLength(0);
  });

  it('LIMITE ASSUMÉE : le RENOMMAGE À L’IMPORT échappe encore — dit au JSDoc de `stepBrand.ts`, jamais un oubli', async () => {
    const code = [
      "import type { BuiltRollRow as S } from '../ui/rollRowBuild';",
      'declare const o: unknown;',
      'export const k = o as S;',
    ].join('\n');
    expect(await messagesDeVerrou(code), 'résidu MESURÉ (le sélecteur filtre par nom) : il est dit, pas couvert').toHaveLength(0);
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

/**
 * L'ENJEU D'UN TIRAGE EST REQUIS AU TYPE (#1262 V2 L6) — `TableSpec.stake` a perdu son `?`
 * (`rollSeam.ts`), et le cliquet textuel a perdu son volet `table:` dans le même geste
 * (`cascade-step-stake-guard.test.ts`). Le murage n'est complet qu'à DEUX serrures : celle-ci ferme
 * les mints (`tableStep`/`tableStepDone`), et `revealStep.ts` ferme la 3ᵉ fabrique exemptée du lint
 * ci-dessus — son `opts.table` n'accepte plus qu'une déclaration RÉSOLUE (`CascadeTableDone`), mesuré
 * par `reveal.test.ts`. Ce qui remplace le scan doit MORDRE : la sonde rejoue les DEUX signatures sur
 * un programme TypeScript réel — requise, la directive est consommée ; optionnelle, elle devient
 * inutilisée (TS2578). Sans ce rouge, les `@ts-expect-error` de `roll-seam-mints` ne prouveraient
 * rien, et le lot aurait retiré un scan sans rien mettre à sa place.
 */
const SONDE_ENJEU = (enjeu: 'stake: Stake' | 'stake?: Stake') => `
type Stake = { key: { dataset: string; kind: string } };
type TableSpec = { id: string; kind: string; label: string; actorId: string; table: { tableId: string }; ${enjeu} };
declare function tableStep(spec: TableSpec): void;
// @ts-expect-error — tirage MUET : l'enjeu est requis
tableStep({ id: 't', kind: 'k', label: 'Tirage', actorId: 'H1', table: { tableId: 'x' } });
`;

describe('#1262 V2 L6 — la sonde du murage de l’ENJEU des tirages est TUEUSE', () => {
  it('enjeu REQUIS : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE_ENJEU('stake: Stake'))).toEqual([]);
  });

  it('enjeu OPTIONNEL (l’état d’avant) : le tirage muet passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_ENJEU('stake?: Stake')), 'sans ce rouge, retirer le volet `table:` du cliquet laisserait un trou').toContain(2578);
  });
});

/**
 * L'ENJEU D'UNE ÉTAPE MONO EST REQUIS AU TYPE (#1262 V2 L6d) — deuxième famille murée, après les
 * tirages. La différence de forme est VOULUE et se lit ici : `stake: StakeRef | undefined` (et non
 * `stake: StakeRef`) supprime l'OMISSION — le déclarant DOIT parler de son enjeu — tout en laissant
 * exprimable le résiduel honnête (un porteur non résoluble), que la porte `monoStep` refuse alors
 * bruyamment (`refusePorte` : DEV throw, PROD journalisé). Une valeur muette ne peut donc plus
 * arriver par distraction, seulement par déclaration explicite — et elle se voit.
 *
 * La sonde rejoue les DEUX signatures sur un programme TypeScript réel : requise, la directive est
 * consommée ; optionnelle, elle devient inutilisée (TS2578). Sans ce rouge, le champ pourrait
 * redevenir `stake?:` sans qu'aucun test ne bouge.
 */
const SONDE_MONO = (enjeu: 'stake: Stake | undefined' | 'stake?: Stake') => `
type Stake = { key: { dataset: string; kind: string } };
type MonoSpec = { id: string; kind: string; label: string; actor: { id: string }; ${enjeu} };
declare function monoStep(spec: MonoSpec): void;
// @ts-expect-error — étape mono MUETTE : l'enjeu doit être déclaré
monoStep({ id: 'm', kind: 'k', label: 'L', actor: { id: 'H1' } });
`;

describe('#1262 V2 L6d — la sonde du murage de l’ENJEU des étapes MONO est TUEUSE', () => {
  it('enjeu REQUIS (valeur possiblement `undefined`) : la directive est CONSOMMÉE', () => {
    expect(codesDeDiagnostic(SONDE_MONO('stake: Stake | undefined'))).toEqual([]);
  });

  it('enjeu OPTIONNEL (l’état d’avant) : l’étape muette passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_MONO('stake?: Stake')), 'sans ce rouge, le murage des monos ne prouverait rien').toContain(2578);
  });
});

/**
 * LA RANGÉE DE JET EST MURÉE AU TYPE (#1262 V3 Lf) — jumelle de la marque d'étape : `BuiltRollRow`
 * porte désormais une propriété REQUISE et `RollShell.rows` l'exige (`readonly BuiltRollRow[]`), donc
 * un littéral monté à la main ne compile plus. C'est ce requis qui a REMPLACÉ le cliquet de comptage
 * `ui/roll-row-mount-ratchet.test.ts` (mort au même lot) : sans cette sonde, plus rien ne mesurerait
 * la porte au type, et un retour à la propriété optionnelle passerait en silence.
 *
 * Deux signatures rejouées sur un programme TypeScript réel : requise, la directive est consommée ;
 * optionnelle (l'état d'avant), le littéral nu passe et la directive devient INUTILISÉE (TS2578).
 */
const SONDE_RANGEE = (marque: 'readonly [BRAND]: true' | 'readonly [BRAND]?: true') => `
declare const BRAND: unique symbol;
type RollRowData = { row: { d?: { roll: number } }; rolled?: boolean; onRoll?: () => void };
type BuiltRollRow = RollRowData & { ${marque} };
declare function RollShell(props: { rows: readonly BuiltRollRow[] }): void;
// @ts-expect-error — rangée montée À LA MAIN : la marque de la porte est absente
RollShell({ rows: [{ row: {}, rolled: false }] });
`;

describe('#1262 V3 Lf — le murage de la RANGÉE de jet est TUEUR', () => {
  it('marque REQUISE : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE_RANGEE('readonly [BRAND]: true'))).toEqual([]);
  });

  it('marque OPTIONNELLE (l’état d’avant) : le littéral nu passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_RANGEE('readonly [BRAND]?: true')), 'sans ce rouge, la mort du cliquet laisserait un trou').toContain(2578);
  });
});
