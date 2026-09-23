import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { detectionsDePointDEntree } from '../scripts/guards/lib/pointDEntree.mjs';

/**
 * Garde de classe #1801 — un module sait s'il est le point d'entrée du processus par
 * `import.meta.main`, jamais par une détection écrite à la main (`scripts/guards/lib/pointDEntree.mjs`
 * en porte la définition structurelle, sans liste d'exception par fichier).
 *
 * PÉRIMÈTRE : `src/**`, `scripts/**` et `server/src/**`, tests compris.
 * Les cas plantés sont ASSEMBLÉS à l'exécution : ce fichier ne porte lui-même aucune détection, il
 * est donc soumis à sa propre garde comme le reste du périmètre.
 */

const SCAN: { dir: string; exts: string[] }[] = [
  { dir: 'src', exts: ['.ts', '.tsx'] },
  { dir: 'scripts', exts: ['.mjs', '.mts', '.ts', '.js'] },
  { dir: 'server/src', exts: ['.ts'] },
];

const ARGV = 'process' + '.argv';
const URL_DU_MODULE = 'import.meta' + '.url';
const FICHIER_DU_MODULE = 'import.meta' + '.filename';

const detecte = (source: string) => detectionsDePointDEntree(source).length > 0;

describe('garde de classe — le point d’entrée se lit à import.meta.main', () => {
  it('cas plantés : chaque variante écrite à la main est détectée', () => {
    const variantes = [
      `const isMain = ${ARGV}[1] && resolve(${ARGV}[1]) === fileURLToPath(${URL_DU_MODULE})`,
      `if (${ARGV}[1] && resolve(${ARGV}[1]) === resolve(fileURLToPath(${URL_DU_MODULE}))) main()`,
      `const invoked = resolve(${ARGV}[1] ?? '') === fileURLToPath(${URL_DU_MODULE});`,
      `if (${URL_DU_MODULE} === pathToFileURL(${ARGV}[1]).href) {`,
      `if (${ARGV}[1] && pathToFileURL(${ARGV}[1]).href === ${URL_DU_MODULE}) {`,
      `if (fileURLToPath(${URL_DU_MODULE}) === ${ARGV}[1])`,
      `const isMain = ${ARGV}[1] && ${ARGV}[1].endsWith('reconcile.mjs')`,
      `if (${URL_DU_MODULE} === \`file://\${join(process.cwd(), 'scripts/x.mjs')}\`) {`,
      `if (${ARGV}?.[1]?.endsWith('x.mjs')) main()`,
      `if (${ARGV}.at(1) === ${FICHIER_DU_MODULE}) main()`,
      `if (${ARGV}.includes(${FICHIER_DU_MODULE})) main()`,
      `if (require` + `.main === module) main()`,
      `if (process` + `.mainModule) main()`,
      `const [, lance] = ${ARGV}`,
      `const lance = ${ARGV}[1] ?? ''`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas planté : `argv` importé de node:process est le même script lancé', () => {
    const source = [
      "import { argv } from 'node" + ":process'",
      `if (argv[1] && resolve(argv[1]) === resolve(fileURLToPath(${URL_DU_MODULE}))) {`,
    ].join('\n');
    expect(detectionsDePointDEntree(source)).toEqual([expect.objectContaining({ ligne: 2 })]);
  });

  it('contrôle négatif : lire, afficher ou transmettre argv n’est pas détecter', () => {
    const neutres = [
      'if (import.meta.main) main()',
      'const isMain = import.meta.main',
      `const root = resolve(${ARGV}[3] ?? join(dirname(fileURLToPath(${URL_DU_MODULE})), '..'))`,
      `\`Usage : node \${${ARGV}[1]} <dossier>\\n\``,
      `const usage = \`Usage : node \${${ARGV}[1]} <dossier>\``,
      `const [, , commande] = ${ARGV}`,
      `'process.stdout.write(JSON.stringify({ entree: ' + ${ARGV}[1] + ' }))'`,
      "assert.notEqual(argv[1], 'graphql')",
      `const css = fileURLToPath(new URL('./x.css', ${URL_DU_MODULE}))`,
      `const flag = ${ARGV}.includes('--write')`,
    ];
    for (const n of neutres) expect(detecte(n), n).toBe(false);
  });

  it('cas planté : la même détection CITÉE en commentaire est hors de portée', () => {
    const source = [`// ${ARGV}[1] === fileURLToPath(${URL_DU_MODULE})`, `/* ${ARGV}[1].endsWith('x.mjs') */`].join('\n');
    expect(detectionsDePointDEntree(source)).toEqual([]);
  });

  it('aucune source du périmètre ne détecte son point d’entrée à la main (tolérance ZÉRO)', () => {
    const offenders: string[] = [];
    for (const { dir, exts } of SCAN) {
      for (const { rel, text } of readCorpus([dir], { exts, tests: true })) {
        for (const { ligne, extrait } of detectionsDePointDEntree(text)) offenders.push(`${rel}:${ligne} → ${extrait}`);
      }
    }
    expect(offenders, `Détection(s) du point d'entrée écrite(s) à la main — utiliser \`import.meta.main\` :\n${offenders.join('\n')}`).toEqual([]);
  });
});
