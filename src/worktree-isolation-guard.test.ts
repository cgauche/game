import { describe, it, expect } from 'vitest';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import viteConfig from '../vite.config';

/**
 * Garde-fou ISOLATION DE WORKTREE — tout chemin de fichier déclaré par la config de test
 * (`test.setupFiles`, `test.globalSetup`) doit être ABSOLU et ancré sur `vite.config.ts`.
 *
 * Vitest résout un chemin RELATIF de config par `resolveModule(path, { paths: [root] })`, dont la
 * première base d'URL est le `root` SANS slash final : `new URL('./src/x', 'file:///…/Game/.wt')`
 * écrase le dernier segment et rend `file:///…/Game/src/x`. Un worktree posé d'UN niveau sous la
 * racine charge alors le fichier de l'arbre PARENT (graphes de modules dédoublés, singletons du
 * store perdus). Patron d'ancrage du dépôt : `scripts/typecheck-fast.mjs:10-12` et les scanners de
 * `src/data/*.test.ts` (`fileURLToPath(new URL('../..', import.meta.url))`).
 */

/** Vue étroite de la config lue : `defineConfig` rend une union, seuls ces champs sont gardés. */
type ConfigDeTest = { test?: { setupFiles?: string | string[]; globalSetup?: string | string[] } };

const RACINE_CONFIG = fileURLToPath(new URL('..', import.meta.url)); // dossier de vite.config.ts

/** REND la liste des chemins déclarés par un champ de config (`string` ou `string[]`, absent = []). */
function chemins(champ: string | string[] | undefined): string[] {
  if (champ === undefined) return [];
  return Array.isArray(champ) ? champ : [champ];
}

/** REND le chemin que vitest chargerait pour `chemin` depuis un `root` (base d'URL SANS slash). */
function resoluDepuisRootSansSlash(chemin: string, root: string): string {
  if (isAbsolute(chemin)) return resolve(chemin);
  return fileURLToPath(new URL(chemin, pathToFileURL(root).toString()));
}

/** VRAI si `cible` est située sous `dossier`. */
function estSous(cible: string, dossier: string): boolean {
  const rel = relative(dossier, cible);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

const conf = viteConfig as ConfigDeTest;
const declares: [string, string][] = [
  ...chemins(conf.test?.setupFiles).map((p) => ['test.setupFiles', p] as [string, string]),
  ...chemins(conf.test?.globalSetup).map((p) => ['test.globalSetup', p] as [string, string]),
];

describe('garde-fou isolation de worktree — les chemins de la config de test sont ancrés', () => {
  it('la config déclare au moins un fichier de setup (la garde a une matière)', () => {
    expect(declares.length).toBeGreaterThan(0);
  });

  it('chaque chemin déclaré est ABSOLU et situé sous le dossier de vite.config.ts', () => {
    const fautifs = declares
      .filter(([, p]) => !isAbsolute(p) || !estSous(resolve(p), RACINE_CONFIG))
      .map(([champ, p]) => `${champ} → ${p}`);
    expect(
      fautifs,
      `Chemin(s) de config non ancré(s) — utiliser \`fileURLToPath(new URL('./…', import.meta.url))\` :\n${fautifs.join('\n')}`,
    ).toEqual([]);
  });

  it('morsure : sous un root d’un niveau, un chemin relatif SORT du root, l’absolu y reste', () => {
    const rootFictif = resolve(RACINE_CONFIG, '.sous-arbre');
    // Cas planté : la forme relative historique remonte à l'arbre parent.
    const relatifResolu = resoluDepuisRootSansSlash('./src/test-setup.ts', rootFictif);
    expect(estSous(relatifResolu, rootFictif)).toBe(false);
    expect(relatifResolu).toBe(resolve(RACINE_CONFIG, 'src', 'test-setup.ts'));
    // Les chemins RÉELS de la config, eux, ne bougent pas avec le root.
    for (const [champ, p] of declares) {
      const resolu = resoluDepuisRootSansSlash(p, rootFictif);
      expect(resolu, `${champ} suit le root au lieu d’être ancré`).toBe(resolve(p));
      expect(estSous(resolu, RACINE_CONFIG), `${champ} sort du dépôt`).toBe(true);
    }
  });
});
