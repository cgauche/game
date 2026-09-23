import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RACINE, sourcesSuivies } from '../scripts/guards/lib/modulesFeuilles.mjs';
import { detectionsDePointDEntree } from '../scripts/guards/lib/pointDEntree.mjs';

/**
 * Garde de classe #1801 — un module sait s'il est le point d'entrée du processus par
 * `import.meta.main`, jamais par une détection écrite à la main (`scripts/guards/lib/pointDEntree.mjs`
 * en porte la définition structurelle, sans liste d'exception par fichier).
 *
 * PÉRIMÈTRE : toute source JS/TS SUIVIE par git (`sourcesSuivies`), racine et tests compris.
 * Les cas plantés sont ASSEMBLÉS à l'exécution : ce fichier ne porte lui-même aucune détection, il
 * est donc soumis à sa propre garde comme le reste du périmètre.
 */

const ARGV = 'process' + '.argv';
const URL_DU_MODULE = 'import.meta' + '.url';
const FICHIER_DU_MODULE = 'import.meta' + '.filename';
const PROCESS = "'node" + ":process'";
const REQUIRE_PROCESS = `require(${PROCESS})`;
const ARGV_GLOBAL = 'globalThis.' + ARGV;
const MODULE_PARENT = 'module' + '.parent';

const detecte = (source: string) => detectionsDePointDEntree(source).length > 0;

describe('garde de classe — le point d’entrée se lit à import.meta.main', () => {
  it('cas plantés : chaque variante écrite à la main est détectée', () => {
    const variantes = [
      `const principal = ${ARGV}[1] && resolve(${ARGV}[1]) === fileURLToPath(${URL_DU_MODULE})`,
      `if (${ARGV}[1] && resolve(${ARGV}[1]) === resolve(fileURLToPath(${URL_DU_MODULE}))) main()`,
      `if (${URL_DU_MODULE} === pathToFileURL(${ARGV}[1]).href) {`,
      `if (fileURLToPath(${URL_DU_MODULE}) === ${ARGV}[1])`,
      `const principal = ${ARGV}[1] && ${ARGV}[1].endsWith('reconcile.mjs')`,
      `if (${URL_DU_MODULE} === \`file://\${join(process.cwd(), 'scripts/x.mjs')}\`) {`,
      `if (${ARGV}?.[1]?.endsWith('x.mjs')) main()`,
      `if (${ARGV}.at(1) === ${FICHIER_DU_MODULE}) main()`,
      `if (${ARGV}.includes(${FICHIER_DU_MODULE})) main()`,
      `if (resolve(${ARGV}.slice(1)[0]) === soi) main()`,
      `if (require` + `.main === module) main()`,
      `if (process` + `.mainModule) main()`,
      `const [, lance] = ${ARGV}`,
      `const lance = ${ARGV}[1] ?? ''`,
      // Un ALIAS d'`import.meta.main` : un second terme pour la même décision.
      'const principal = import.meta' + '.main',
      'export const lance = import.meta' + '.main',
      // Toute LECTURE du script lancé, même hors comparaison : un message d'usage la lit aussi.
      `\`Usage : node \${${ARGV}[1]} <dossier>\\n\``,
      `console.log(\`usage : node \${basename(${ARGV}[1])} <x>\`)`,
      `'process.stdout.write(JSON.stringify({ entree: ' + ${ARGV}[1] + ' }))'`,
      `const cible = resolve(${ARGV}[1] === undefined ? '.' : 'x')`,
      `if (${ARGV_GLOBAL}[1] === soi) main()`,
      `if (global.${ARGV}.at(1) === soi) main()`,
      `if (process['ar` + `gv'][1] === soi) main()`,
      `if (process["ar` + `gv"]?.[1] === soi) main()`,
      `if (${REQUIRE_PROCESS}.argv[1] === soi) main()`,
      `if (resolve(${ARGV}.slice(1, 2)[0]) === soi) main()`,
      `if (${ARGV}.slice(1).shift() === soi) main()`,
      `const [lance] = ${ARGV}.slice(1)`,
      `if (!${MODULE_PARENT}) main()`,
      `module.exports = ${MODULE_PARENT} ? api : main()`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : un NOM lié à `argv` ou à `process` lit le même script lancé', () => {
    const sources = [
      [`import { argv } from ${PROCESS}`, `if (argv[1] && resolve(argv[1]) === soi) {`],
      [`import { argv as a } from ${PROCESS}`, 'if (a[1] === soi) main()'],
      [`const a = ${ARGV}`, 'if (a[1] === soi) main()'],
      [`const { ${'ar' + 'gv'}: [, lance] } = process`, 'if (lance === soi) main()'],
      [`import proc from ${PROCESS}`, 'if (proc.argv[1] === soi) main()'],
      [`import * as proc from ${PROCESS}`, 'if (proc.argv.at(1) === soi) main()'],
      [`const { ${'ar' + 'gv'} } = ${REQUIRE_PROCESS}`, 'if (argv[1] === soi) main()'],
      [`const { ${'ar' + 'gv'}: [, lance] } = ${REQUIRE_PROCESS}`, 'if (lance === soi) main()'],
      [`const a = ${ARGV}, b = 2`, 'if (a[1] === soi) main()'],
      ['let a', `a = process['ar` + `gv']`, 'if (a[1] === soi) main()'],
      [`const proc = ${REQUIRE_PROCESS}`, 'if (proc.argv[1] === soi) main()'],
      ['const proc = globalThis' + '.process', 'if (proc.argv[1] === soi) main()'],
    ];
    for (const lignes of sources) {
      expect(detectionsDePointDEntree(lignes.join('\n')), lignes.join(' ⏎ ')).not.toEqual([]);
    }
  });

  it('cas plantés : une lecture coupée par un saut de ligne est détectée, à sa ligne', () => {
    expect(detectionsDePointDEntree(`const soi = 1\nif (${ARGV}\n[1] === soi) main()`)).toEqual([
      expect.objectContaining({ ligne: 2 }),
    ]);
    expect(detectionsDePointDEntree(`if (\n  resolve(\n    ${ARGV}[1]\n  ) === soi) main()`)).toEqual([
      expect.objectContaining({ ligne: 3 }),
    ]);
    expect(detecte(`if (${URL_DU_MODULE}\n  === pathToFileURL(x).href) main()`)).toBe(true);
  });

  it('contrôle négatif : ni lecture de l’élément 1, ni égalité à l’identité du module', () => {
    const neutres = [
      'if (import.meta.main) main()',
      `const root = resolve(${ARGV}[3] ?? join(dirname(fileURLToPath(${URL_DU_MODULE})), '..'))`,
      `const [, , commande] = ${ARGV}`,
      `const args = ${ARGV}.slice(2)`,
      "assert.notEqual(argv[1], 'graphql')",
      `const css = fileURLToPath(new URL('./x.css', ${URL_DU_MODULE}))`,
      `const flag = ${ARGV}.includes('--write')`,
      `const estFichier = ${URL_DU_MODULE}.startsWith('file:')`,
      `if (${URL_DU_MODULE}.includes('/node_modules/')) return`,
      `console.log(\`usage : node \${basename(${FICHIER_DU_MODULE})} <x>\`)`,
      `const n = ${ARGV}.slice(1).length`,
      `const [commande, ...reste] = ${ARGV}.slice(2)`,
      `const args = ${ARGV_GLOBAL}.slice(2)`,
      `const args = ${REQUIRE_PROCESS}.argv.slice(2)`,
      `const a = ${ARGV}.slice(2)\nif (a[1] === soi) main()`,
      `const { ${'ar' + 'gv'} } = ${REQUIRE_PROCESS}\nconst args = argv.slice(2)`,
      'module.exports = { main }',
      'const chemins = module.paths',
    ];
    for (const n of neutres) expect(detecte(n), n).toBe(false);
  });

  it('cas planté : la même détection CITÉE en commentaire est hors de portée', () => {
    const source = [`// ${ARGV}[1] === fileURLToPath(${URL_DU_MODULE})`, `/* ${ARGV}[1].endsWith('x.mjs') */`].join('\n');
    expect(detectionsDePointDEntree(source)).toEqual([]);
  });

  it('aucune source suivie ne détecte son point d’entrée à la main (tolérance ZÉRO)', () => {
    const suivies: string[] = sourcesSuivies();
    expect(suivies.length, 'le listage des sources suivies est vide').toBeGreaterThan(1000);
    const offenders: string[] = [];
    for (const rel of suivies) {
      let texte: string;
      try {
        texte = readFileSync(join(RACINE, rel), 'utf8');
      } catch {
        continue; // suivi mais supprimé de l'arbre : aucun code à lire
      }
      for (const { ligne, extrait } of detectionsDePointDEntree(texte)) offenders.push(`${rel}:${ligne} → ${extrait}`);
    }
    expect(offenders, `Détection(s) du point d'entrée écrite(s) à la main — utiliser \`import.meta.main\` :\n${offenders.join('\n')}`).toEqual([]);
  });
});
