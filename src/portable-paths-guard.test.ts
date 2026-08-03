import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou chemins PORTABLES — un chemin absolu de machine de dev (lecteur Windows, racine de
 * profil POSIX) écrit en dur dans une source `src/**` est mort partout ailleurs que sur la machine
 * qui l'a écrit : sur la CI (ubuntu-latest) il rend ENOENT. La résolution se fait relativement au
 * module : `fileURLToPath(new URL('./styles/x.css', import.meta.url))` en environnement `node`
 * (patron de `src/ui/atelier-conformance.test.ts`) ; en environnement `jsdom`, `new URL(rel, base)`
 * est détourné vers la base du document, la résolution y passe donc par
 * `join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'x.css')`.
 *
 * Détection STRUCTURELLE (aucune liste d'exception par fichier) :
 *   - lettre de lecteur Windows suivie d'un séparateur, non précédée d'une autre lettre — ce qui
 *     écarte les schémas d'URL (`http://`, `file://`) sans avoir à les nommer ;
 *   - racine de profil POSIX (`home`/`Users` + nom d'utilisateur).
 * Les cas plantés ci-dessous sont ASSEMBLÉS à l'exécution : ce fichier ne porte lui-même aucun
 * littéral de chemin absolu, il est donc soumis à sa propre garde comme le reste de `src/**`.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)
const SRC_DIR = join(ROOT, 'src');

const WIN_DRIVE = /(?<![A-Za-z])[A-Za-z]:[\\/]+[A-Za-z0-9._-]/;
const POSIX_HOME = /\/(?:home|Users)\/[A-Za-z0-9._-]+\//;

/** RETOURNE le motif de chemin absolu machine trouvé dans une ligne de source, ou `null`. */
export function absoluteMachinePathIn(line: string): string | null {
  const win = WIN_DRIVE.exec(line);
  if (win) return win[0];
  const posix = POSIX_HOME.exec(line);
  if (posix) return posix[0];
  return null;
}

function scanSrcFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e)) files.push(p);
    }
  };
  walk(SRC_DIR);
  return files;
}

const DRIVE = 'C' + ':';

describe('garde-fou chemins portables — aucun chemin absolu de machine dans src/**', () => {
  it('cas planté : un chemin de lecteur Windows est détecté (preuve TDD)', () => {
    const p = DRIVE + '/Users/' + 'dev' + '/projet/src/ui/styles/x.css';
    expect(absoluteMachinePathIn("readFileSync('" + p + "', 'utf8')")).not.toBeNull();
    expect(absoluteMachinePathIn("const d = '" + DRIVE + "\\projets\\jeu\\src';")).not.toBeNull();
  });

  it('cas planté : une racine de profil POSIX est détectée (preuve TDD)', () => {
    expect(absoluteMachinePathIn("readFileSync('/home/" + 'runner' + "/work/jeu/src/a.css')")).not.toBeNull();
    expect(absoluteMachinePathIn("'/Users/" + 'dev' + "/jeu/src/a.css'")).not.toBeNull();
  });

  it('faux positifs écartés : schémas d’URL, chemins relatifs et ratios (contrôle négatif)', () => {
    expect(absoluteMachinePathIn("fetch('http://localhost:5173/api')")).toBeNull();
    expect(absoluteMachinePathIn("new URL('file:///src/a.css')")).toBeNull();
    expect(absoluteMachinePathIn("import { x } from '../styles/components.css';")).toBeNull();
    expect(absoluteMachinePathIn("fileURLToPath(new URL('./styles/creator.css', import.meta.url))")).toBeNull();
    expect(absoluteMachinePathIn("const ratio = 'w:h';")).toBeNull();
    expect(absoluteMachinePathIn("const img = 'data:image/svg+xml;base64,AA';")).toBeNull();
  });

  it('aucune source de src/** ne porte de chemin absolu de machine (tolérance ZÉRO)', () => {
    const offenders: string[] = [];
    for (const f of scanSrcFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      const lines = readFileSync(f, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const hit = absoluteMachinePathIn(line);
        if (hit) offenders.push(`${rel}:${i + 1} → ${hit}`);
      });
    }
    expect(
      offenders,
      `Chemin(s) absolu(s) de machine — résoudre relativement à \`import.meta.url\` (cf. en-tête de ce fichier) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
