import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * GARDE DE PURETÉ DE LA COUCHE `state` (CLAUDE.md règle 3). `src/state` (store + flux) est en amont de
 * `src/ui` : l'UI dépend du store, JAMAIS l'inverse. Ce test ÉCHOUE si un fichier de `src/state`
 * (hors `*.test.ts`) importe RUNTIME quoi que ce soit de `src/ui` — `from '../ui/…'`,
 * `import('../ui/…')`, y compris depuis un sous-dossier (`'../../ui/…'`).
 *
 * Les fichiers de TEST sont exclus du scan : ils exercent légitimement des helpers `ui`
 * (`editorState`…) pour préparer leurs fixtures — ce sont des consommateurs, pas la couche `state`.
 *
 * Portée LIMITÉE à `state → ui` : le pendant `state → gameIso` est gardé séparément par
 * `gameiso-purity.test.ts` (#161 — la géométrie/simulation réellement partagée a été extraite vers
 * `src/geometry/`, `state/dir8.ts`, `state/viewLevel.ts`, `state/combatLog.ts`, `engine/dice.ts`).
 */

const STATE_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Imports engine→ui existants, tous des références de TYPE seulement (élidées à la compilation,
 *  aucune dépendance runtime sur `src/ui`). */
const ALLOWLIST = new Set([
  // `import type { IconId } from '../ui/icons'` — type seul, utilisé pour typer un champ de données.
  'combatManeuvers.ts',
  // `import type { CreatorDraft } from '../ui/creator/draft'` — type seul, forme du brouillon de création.
  'roster.ts',
]);

/** Tout import (statique `from`, dynamique/inline `import(`, ou side-effect `import '…'`) ciblant un
 *  chemin `…/ui/…` (un ou plusieurs `../`). */
const UI_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](?:\.\.\/)+ui\//;

/** Retire commentaires de bloc et de ligne (une réf à `../ui/…` en commentaire/doc n'est pas un import). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Tous les `.ts`/`.tsx` de `src/state` (récursif), hors `*.test.ts(x)`. Chemins relatifs à STATE_DIR. */
function stateSources(dir = STATE_DIR, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...stateSources(`${dir}/${ent.name}`, relPath));
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(relPath);
  }
  return out;
}

describe('pureté de state — src/state ne dépend JAMAIS (runtime) de src/ui (règle 3)', () => {
  const files = stateSources();

  it('aucun fichier state (hors tests) n\'importe RUNTIME de src/ui (sauf allowlist type-only)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const base = f.split('/').pop()!;
      if (ALLOWLIST.has(base)) continue;
      const code = stripComments(readFileSync(`${STATE_DIR}/${f}`, 'utf8'));
      if (code.split('\n').some((l) => UI_IMPORT.test(l))) offenders.push(f);
    }
    expect(
      offenders,
      `Inversion de couche state→ui interdite (règle 3). Fichiers fautifs :\n  ${offenders.join('\n  ')}\n` +
        'Le store/flux ne doit jamais dépendre de src/ui — extraire le type/la logique partagée, ou passer en allowlist si import de TYPE seulement.',
    ).toEqual([]);
  });

  it('le scan couvre bien la couche state (sanity : > 30 fichiers)', () => {
    expect(files.length).toBeGreaterThan(30);
  });
});
