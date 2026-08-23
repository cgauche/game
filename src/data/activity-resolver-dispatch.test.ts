/**
 * GARDE « un résolveur d'Activité a un CONSOMMATEUR » (#1318 V6) — pendant de l'union fermée
 * `ActivityResolver` : fermer le vocabulaire ne sert à rien si un membre n'est lu par personne. Un
 * résolveur sans consommateur est un NO-OP SILENCIEUX : la donnée le porte, l'auteur croit déclencher
 * une logique, et rien ne se produit.
 *
 * MESURE : occurrences du LITTÉRAL de chaîne (nœuds `StringLiteral` de l'AST — jamais un commentaire
 * ni de la prose) dans les sources de `src/`, hors fichiers de DÉFINITION du vocabulaire
 * (`engine/activities.ts`, `data/schemas/defs/activities.ts`) et hors tests.
 *
 * ANGLE DÉCLARÉ : la mesure ne relie pas le littéral à son TYPE — un homonyme d'un autre vocabulaire
 * (`bank.kind === 'mecenat'`) compte comme consommation. La garde est donc un DÉTECTEUR DE PLANCHER :
 * elle ne peut pas manquer un vrai zéro, elle peut être trop indulgente. C'est le sens utile ici.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { ACTIVITY_RESOLVERS, RESOLVER_OWNER, type ActivityResolver } from '../engine/activities';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/data/ → ../../ = racine

/** Fichiers qui DÉFINISSENT le vocabulaire (l'y citer n'est pas le consommer). */
const DEFINITION_FILES = new Set([
  'src/engine/activities.ts',
  'src/data/schemas/defs/activities.ts',
]);

/** Mot HORS vocabulaire, forgé au runtime pour les fixtures de MORSURE — jamais un membre réel, dont
 *  le zéro consommateur serait un vrai défaut. */
const MOT_FORGE = 'resolveurQuiNExistePas' as ActivityResolver;

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && !/\.test\.[tj]sx?$/.test(p)) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

/** Littéraux de chaîne d'un source (nœuds AST — ni commentaires, ni prose de gabarit). */
export function stringLiteralsOf(relPath: string, contenu: string): Set<string> {
  const sf = ts.createSourceFile(
    relPath,
    contenu,
    ts.ScriptTarget.Latest,
    true,
    relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) found.add(n.text);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** Consommateurs (chemins relatifs) de chaque résolveur, hors définitions et hors tests. */
export function consumersByResolver(
  files: { rel: string; contenu: string }[],
  resolvers: readonly ActivityResolver[],
): Map<ActivityResolver, string[]> {
  const out = new Map<ActivityResolver, string[]>(resolvers.map((r) => [r, []]));
  for (const { rel, contenu } of files) {
    if (DEFINITION_FILES.has(rel)) continue;
    const lits = stringLiteralsOf(rel, contenu);
    for (const r of resolvers) if (lits.has(r)) out.get(r)!.push(rel);
  }
  return out;
}

/**
 * Consommateurs du corpus RÉEL. COÛT MESURÉ (2026-08-23, 1880 fichiers / 15,2 Mo) : 2,0 s par
 * balayage, dont 1,6 s de `ts.createSourceFile`. Les deux `it` de cliquet lisent la MÊME carte :
 * elle est mémoïsée, et PARESSEUSE — au premier `it` qui la demande, jamais à la collecte de
 * vitest. Les `it` de MORSURE passent leur propre corpus FORGÉ au comparateur pur, hors mémo.
 */
let consumersMemo: Map<ActivityResolver, string[]> | undefined;
function consommateursReels(): Map<ActivityResolver, string[]> {
  return (consumersMemo ??= consumersByResolver(
    sourceFiles().map((f) => ({
      rel: relative(ROOT, f).split('\\').join('/'),
      contenu: readFileSync(f, 'utf8'),
    })),
    ACTIVITY_RESOLVERS,
  ));
}

describe('garde — un résolveur d’Activité a un CONSOMMATEUR (#1318 V6)', () => {
  it('chaque membre d’ACTIVITY_RESOLVERS est lu par au moins un consommateur de production — SANS exception', () => {
    const consumers = consommateursReels();
    expect(consumers.size, 'le balayage n’a pas couvert tout le vocabulaire').toBe(ACTIVITY_RESOLVERS.length);
    const mesure = ACTIVITY_RESOLVERS.map((r) => `${r} (famille ${RESOLVER_OWNER[r]}) : ${(consumers.get(r) ?? []).length}`);
    const orphelins = ACTIVITY_RESOLVERS
      .filter((r) => (consumers.get(r) ?? []).length === 0)
      .map((r) => `${r} (famille ${RESOLVER_OWNER[r]})`);
    expect(
      orphelins,
      'Résolveur(s) SANS consommateur — un membre du vocabulaire que personne ne lit est un no-op\n' +
        'silencieux : écrire sa branche chez son propriétaire, ou le retirer de l’enum ET de la donnée.\n' +
        'Consommateurs mesurés :\n' + mesure.join('\n'),
    ).toEqual([]);
  });

  it('MORSURE : le détecteur voit un résolveur absent, et ne s’émeut pas d’un présent (fixture)', () => {
    const fixture = [
      { rel: 'src/state/fauxFlow.ts', contenu: "export const f = (d: Def) => d.resolver === 'forage' ? 1 : 0;" },
      { rel: 'src/engine/activities.ts', contenu: `export const X = ['forage', '${MOT_FORGE}'];` }, // définition : ignorée
    ];
    const consumers = consumersByResolver(fixture, ['forage', MOT_FORGE]);
    expect(consumers.get('forage')).toEqual(['src/state/fauxFlow.ts']);
    expect(consumers.get(MOT_FORGE)).toEqual([]);
  });

  it('MORSURE : un littéral de COMMENTAIRE ne compte pas comme consommation', () => {
    const fixture = [{ rel: 'src/state/fauxFlow.ts', contenu: `// mentionne '${MOT_FORGE}' en prose\nexport const f = 1;` }];
    expect(consumersByResolver(fixture, [MOT_FORGE]).get(MOT_FORGE)).toEqual([]);
  });
});
