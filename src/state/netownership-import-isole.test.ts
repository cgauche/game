/**
 * #1054 — `netOwnership` s'importe SEUL, sans monter le store. La table de possession (`ROUTES`,
 * #1051) doit être énumérable hors environnement de test complet (script, garde CI légère). Le
 * graphe `combatOrParty → targetingModes → … → store.ts` EXISTE (sonde (c) ci-dessous) : tout import
 * runtime de `netOwnership` vers cette famille de modules monte le store à l'import — et le store
 * s'évalue en `ReferenceError: Cannot access 'testRouter' before initialization`.
 *
 * DEUX mesures, complémentaires :
 *  (a) le CHEMIN RÉEL — un process `tsx` importe le module seul et doit sortir 0 (~0,25 s) ;
 *  (b) la CHAÎNE — fermeture transitive des imports RUNTIME du fichier : `store.ts` ne doit pas y
 *      être atteignable, et l'échec NOMME le chemin fautif. (a) seule cesserait de mordre le jour
 *      où le store s'évaluerait sans crasher ; (b) seule ne mesure pas ce que le moteur exécute.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const ENTREE = join(RACINE, 'src', 'state', 'netOwnership.ts');
const LOURD = join(RACINE, 'src', 'state', 'combatOrParty.ts');
const STORE = join(RACINE, 'src', 'state', 'store.ts');

/**
 * Specifiers d'un module chargés À L'EXÉCUTION, lus sur l'AST TypeScript — un `import`/`export … from`
 * qui n'est pas `type`, et les `import()` DYNAMIQUES. L'AST est indispensable ici : une lecture par
 * regex confond `import('./x').T` (position de TYPE, `ImportTypeNode`, effacé) avec un vrai
 * `await import('./x')` (`CallExpression`) — mesuré sur `pendings.ts`, qui type un champ par
 * `import('./restFlow').PendingRest` et paraissait donc charger tout le graphe de voyage.
 * Un `import { type A } from 'x'` non marqué `type` AU NIVEAU DE LA CLAUSE compte comme runtime :
 * le module y est bien évalué pour ses effets de bord.
 */
function specifiersRuntime(fichier: string): string[] {
  const sf = ts.createSourceFile(fichier, readFileSync(fichier, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const litt = (n: ts.Node | undefined): void => { if (n && ts.isStringLiteral(n)) out.push(n.text); };
  const walk = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && !n.importClause?.isTypeOnly) litt(n.moduleSpecifier);
    else if (ts.isExportDeclaration(n) && !n.isTypeOnly) litt(n.moduleSpecifier);
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) litt(n.arguments[0]);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

/** Résout un specifier RELATIF vers un fichier du dépôt ; `undefined` pour un paquet npm (hors sujet). */
function resoudre(depuis: string, spec: string): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = resolve(dirname(depuis), spec);
  for (const c of [`${base}.ts`, `${base}.tsx`, `${base}.json`, join(base, 'index.ts'), join(base, 'index.tsx'), base]) {
    if (/\.(ts|tsx|json)$/.test(c) && existsSync(c)) return c;
  }
  return undefined;
}

/** Chemin d'import RUNTIME de `depuis` vers `cible`, ou `null` s'il n'y en a pas (BFS = le plus court). */
function chemin(depuis: string, cible: string): string[] | null {
  const vus = new Map<string, string[]>([[depuis, [depuis]]]);
  const file = [depuis];
  while (file.length) {
    const f = file.shift()!;
    if (f.endsWith('.json')) continue;
    for (const spec of specifiersRuntime(f)) {
      const suiv = resoudre(f, spec);
      if (!suiv || vus.has(suiv)) continue;
      const route = [...vus.get(f)!, suiv];
      if (suiv === cible) return route;
      vus.set(suiv, route);
      file.push(suiv);
    }
  }
  return null;
}

const lisible = (route: string[] | null) => route?.map((f) => relative(RACINE, f).replace(/\\/g, '/')) ?? null;

describe('#1054 — `netOwnership` s’importe SEUL', () => {
  it('(a) chemin RÉEL : un process qui importe le module seul sort 0 et lit la table', () => {
    const r = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', "import('./src/state/netOwnership.ts').then((m) => { if (!(m.ROUTES.size > 200)) { throw new Error('table vide'); } })"],
      { cwd: RACINE, encoding: 'utf8' },
    );
    expect(r.stderr + r.stdout, 'l’import isolé de netOwnership échoue — un import LOURD est revenu').toBe('');
    expect(r.status, 'code de sortie de l’import isolé').toBe(0);
  });

  it('(b) CHAÎNE : `store.ts` n’est pas atteignable par les imports runtime du module', () => {
    expect(
      lisible(chemin(ENTREE, STORE)),
      'chaîne d’import runtime qui monte le store — la donnée doit descendre dans un module FEUILLE (patron `targetingHolder`/`combatants`)',
    ).toBeNull();
  });

  it('le détecteur de chaîne MORD : depuis `combatOrParty` (lourd), le chemin vers le store EXISTE', () => {
    // Sans cette sonde, un résolveur cassé rendrait `null` partout et (b) serait vert à tort.
    const route = lisible(chemin(LOURD, STORE));
    expect(route?.[0], 'le BFS ne part pas du module attendu').toBe('src/state/combatOrParty.ts');
    expect(route?.[(route?.length ?? 0) - 1]).toBe('src/state/store.ts');
    expect(route!.length, 'chaîne du lourd vers le store').toBeGreaterThan(1);
  });
});
