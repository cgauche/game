import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * GARDE DE PURETÉ DU MOTEUR (CLAUDE.md règle 3 ; issue #8). `src/engine` est la couche RÈGLES, PURE :
 * `state`/`ui`/`rendu` en dépendent, JAMAIS l'inverse. Ce test ÉCHOUE si un fichier de `src/engine`
 * (hors `*.test.ts`) importe quoi que ce soit de `src/state`, `src/ui` ou `src/gameIso` —
 * `from '../state/…'`, `import('../ui/…')`, y compris depuis un sous-dossier (`'../../gameIso/…'`).
 *
 * Le modèle de logique authorée (Flow/Condition/TriggeredEffect/EffectOp + helpers purs) a été extrait
 * dans `engine/flowCore` précisément pour casser cette inversion : le moteur importe `./flowCore`, la
 * couche `state` (`state/flow`) ne fait qu'INSTANCIER la feuille générique sur l'union `Effect`.
 *
 * Les fichiers de TEST sont exclus du scan : ils exercent légitimement le runtime `state`/`ui`/`gameIso`
 * (`runSpellFlowLines`, `applyTriggeredEffects`, `combatantVisuals`…) — ce sont des consommateurs, pas
 * le moteur.
 */

const ENGINE_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Segments interdits en amont d'`engine`, avec leur allowlist propre (fichier → raison factuelle). */
const FORBIDDEN_SEGMENTS: { segment: string; allow: Set<string> }[] = [
  {
    segment: 'state',
    allow: new Set<string>(),
  },
  {
    segment: 'ui',
    allow: new Set(),
  },
  {
    segment: 'gameIso',
    // `types.ts` l.1203 : `appearance?: import('../gameIso/rig/appearance').Appearance` — référence de
    // TYPE seulement (inline `import(...).T`), élidée à la compilation ; aucune dépendance runtime.
    allow: new Set(['types.ts']),
  },
];

/** Tout import (statique `from`, dynamique/inline `import(`, ou side-effect `import '…'`) ciblant un
 *  chemin `…/<segment>/…` (un ou plusieurs `../`). */
function importRegexFor(segment: string): RegExp {
  return new RegExp(`(?:\\bfrom\\s+|\\bimport\\s*\\(\\s*|\\bimport\\s+)['"](?:\\.\\.\\/)+${segment}\\/`);
}

/** Retire commentaires de bloc et de ligne (une réf à `../state/…` en commentaire/doc n'est pas un import). */
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

/** Tous les `.ts` de `src/engine` (récursif), hors `*.test.ts`. Chemins relatifs à ENGINE_DIR. */
function engineSources(dir = ENGINE_DIR, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...engineSources(`${dir}/${ent.name}`, relPath));
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(relPath);
  }
  return out;
}

describe('pureté du moteur — src/engine ne dépend JAMAIS de src/state, src/ui ou src/gameIso (#8, règle 3)', () => {
  const files = engineSources();

  for (const { segment, allow } of FORBIDDEN_SEGMENTS) {
    const IMPORT_RE = importRegexFor(segment);

    it(`aucun fichier engine (hors tests) n'importe de src/${segment} (sauf allowlist)`, () => {
      const offenders: string[] = [];
      for (const f of files) {
        const base = f.split('/').pop()!;
        if (allow.has(base)) continue;
        const code = stripComments(readFileSync(`${ENGINE_DIR}/${f}`, 'utf8'));
        if (code.split('\n').some((l) => IMPORT_RE.test(l))) offenders.push(f);
      }
      expect(
        offenders,
        `Inversion de couche engine→${segment} interdite (règle 3). Fichiers fautifs :\n  ${offenders.join('\n  ')}\n` +
          `Le moteur ne doit jamais dépendre de src/${segment} — extraire le type/la logique partagée vers une couche neutre.`,
      ).toEqual([]);
    });
  }

  it('le scan couvre bien le moteur (sanity : > 50 fichiers)', () => {
    expect(files.length).toBeGreaterThan(50);
  });
});
