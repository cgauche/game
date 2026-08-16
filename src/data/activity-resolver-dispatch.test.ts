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

/**
 * Résolveurs ENCORE sans consommateur de production. Ce n'est PAS une exemption : chaque entrée est
 * une dette ouverte, avec son ticket. Retirer une entrée est le geste de solde.
 */
const SANS_CONSOMMATEUR: Record<string, string> = {
  // `rassemblement` (ADE II 8) porte `resolver: "battleRally"` en donnée, mais AUCUN code de
  // production ne le lit : l'issue de l'Activité vient de ses bandes `outcomes`/`battle`. Le membre
  // reste au vocabulaire (la donnée le porte, le schéma la valide) — la branche est à écrire. #1329
  battleRally: '#1329 — Rassemblement : résolveur authoré, dispatch de bataille jamais écrit.',
};

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

describe('garde — un résolveur d’Activité a un CONSOMMATEUR (#1318 V6)', () => {
  const corpus = sourceFiles().map((f) => ({
    rel: relative(ROOT, f).split('\\').join('/'),
    contenu: readFileSync(f, 'utf8'),
  }));

  it('chaque membre d’ACTIVITY_RESOLVERS est lu par au moins un consommateur de production', () => {
    const consumers = consumersByResolver(corpus, ACTIVITY_RESOLVERS);
    const orphelins = [...consumers.entries()]
      .filter(([r, files]) => files.length === 0 && !(r in SANS_CONSOMMATEUR))
      .map(([r]) => `${r} (famille ${RESOLVER_OWNER[r]})`);
    expect(
      orphelins,
      'Résolveur(s) SANS consommateur — un membre du vocabulaire que personne ne lit est un no-op\n' +
        'silencieux : écrire sa branche chez son propriétaire, ou le retirer de l’enum ET de la donnée :\n' +
        orphelins.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : une dette de SANS_CONSOMMATEUR soldée se retire de la liste', () => {
    const consumers = consumersByResolver(corpus, ACTIVITY_RESOLVERS);
    const soldes = Object.keys(SANS_CONSOMMATEUR)
      .filter((r) => (consumers.get(r as ActivityResolver) ?? []).length > 0)
      .map((r) => `${r} : ${(consumers.get(r as ActivityResolver) ?? []).join(', ')}`);
    expect(soldes, 'Dette(s) SOLDÉE(s) — retirer ces entrées de SANS_CONSOMMATEUR :\n' + soldes.join('\n')).toEqual([]);
  });

  it('toute entrée de SANS_CONSOMMATEUR porte un ticket, et reste un membre du vocabulaire', () => {
    for (const [r, motif] of Object.entries(SANS_CONSOMMATEUR)) {
      expect(ACTIVITY_RESOLVERS, `${r} : dette listée hors du vocabulaire`).toContain(r);
      expect(motif, `${r} : dette sans référence de ticket`).toMatch(/#\d+/);
    }
  });

  it('MORSURE : le détecteur voit un résolveur absent, et ne s’émeut pas d’un présent (fixture)', () => {
    const fixture = [
      { rel: 'src/state/fauxFlow.ts', contenu: "export const f = (d: Def) => d.resolver === 'forage' ? 1 : 0;" },
      { rel: 'src/engine/activities.ts', contenu: "export const X = ['forage', 'battleRally'];" }, // définition : ignorée
    ];
    const consumers = consumersByResolver(fixture, ['forage', 'battleRally']);
    expect(consumers.get('forage')).toEqual(['src/state/fauxFlow.ts']);
    expect(consumers.get('battleRally')).toEqual([]);
  });

  it('MORSURE : un littéral de COMMENTAIRE ne compte pas comme consommation', () => {
    const fixture = [{ rel: 'src/state/fauxFlow.ts', contenu: "// mentionne 'battleRally' en prose\nexport const f = 1;" }];
    expect(consumersByResolver(fixture, ['battleRally']).get('battleRally')).toEqual([]);
  });
});
