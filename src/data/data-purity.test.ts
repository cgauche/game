import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * GARDE DE PURETÉ DE LA COUCHE `src/data` (CLAUDE.md règle 3 ; #421 REDO). `src/data` est la base
 * APP-OWNED (JSON commité + fabriques : `pregens.ts`, `index.ts`…), EN AMONT de `src/ui`, `src/state`
 * ET `src/gameIso` : ces couches en dépendent, JAMAIS l'inverse. Ce test ÉCHOUE si un fichier de
 * `src/data` (hors `*.test.ts`) importe RUNTIME quoi que ce soit de `src/ui`, `src/state` ou
 * `src/gameIso` — `from '../ui/…'`/`from '../state/…'`/`from '../gameIso/…'`, `import('../ui/…')`,
 * y compris depuis un sous-dossier. Les imports de TYPE seuls (élidés à la compilation, ex.
 * `import type { Appearance } from '../gameIso/rig/appearance'`) sont autorisés : une déclaration
 * `import type …` est ÉLIDÉE à la compilation — critère STRUCTUREL, lu sur la ligne. Les réfs de type
 * INLINE (`import('../state/flow').Condition`), elles, ne sont pas distinguables d'un import runtime
 * par la ligne : elles restent couvertes PAR ALLOWLIST (fichier → réf inline factuelle), même patron
 * que `engine-purity.test.ts` sur `types.ts`→`gameIso`.
 *
 * Incident #421 : `pregens.ts` important `../ui/creator/draft` + `../ui/creator/creatorDefaults`
 * tirait tout le graphe `ui/creator` dans le graphe `data`, contaminant (Vitest `isolate:false`)
 * les tests d'intégrité `data` et `comment-poison-guard` — échecs NON-DÉTERMINISTES en full-suite
 * uniquement. Ce garde verrouille l'absence de cette inversion.
 *
 * Les fichiers de TEST sont exclus du scan : ils exercent légitimement des helpers `ui`/`state`
 * pour préparer leurs fixtures — ce sont des consommateurs, pas la couche `data`.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));

/** Segments interdits en amont de `data`, avec leur allowlist propre (fichier → réf inline factuelle). */
const FORBIDDEN_SEGMENTS: { segment: string; allow: Set<string> }[] = [
  {
    segment: 'ui',
    allow: new Set<string>(),
  },
  {
    segment: 'state',
    // `fsPersist.ts` : `import { downloadText } from '../state/fileIo'` — persistance DEV de
    // l'éditeur JSON (#518), inversion PRÉEXISTANTE distincte de #421 (qui porte sur
    // `pregens.ts`→`ui/creator`) ; non touchée par ce ticket.
    // `index.ts` : `import('../state/flow').Condition`/`.TriggeredEffect`/`.Flow` — réfs de TYPE
    // INLINE (indistinguables d'un import runtime à la ligne, contrairement à `import type …`),
    // élidées à la compilation, aucune dépendance runtime.
    // `props.types.ts` : `import { DIR8_ORDER, type Dir8 } from '../state/dir8'` — import MIXTE :
    // `DIR8_ORDER` est une VALEUR runtime (rotation d'empreinte par cap d'une place assise).
    // `dir8.ts` est un module FEUILLE (zéro import) : pas de contamination de graphe (#421) ;
    // l'inversion de couche elle-même est un défaut de couture tracé — #1506.
    allow: new Set(['fsPersist.ts', 'index.ts', 'props.types.ts']),
  },
  {
    segment: 'gameIso',
    // `index.ts` : `import('../gameIso/catalog/…').StructureAppearanceDef`/`ReliefMaterialDef`/
    // `RoofMaterialDef`/`AmbianceDef` — réfs de TYPE INLINE (formes des catalogues de rendu servis
    // depuis la donnée), élidées à la compilation, aucune dépendance runtime.
    allow: new Set(['index.ts']),
  },
];

/** Tout import (statique `from`, dynamique/inline `import(`, ou side-effect `import '…'`) ciblant un
 *  chemin `…/<segment>/…` (un ou plusieurs `../`). */
function importRegexFor(segment: string): RegExp {
  return new RegExp(`(?:\\bfrom\\s+|\\bimport\\s*\\(\\s*|\\bimport\\s+)['"](?:\\.\\.\\/)+${segment}\\/`);
}

/** Déclaration `import type … from '…'` : ÉLIDÉE à la compilation, donc zéro dépendance runtime.
 *  `import { type X } from '…'` (forme MIXTE) n'en est pas une : le module est bel et bien importé. */
const TYPE_ONLY_RE = /^\s*import\s+type\s/;

/** Retire commentaires de bloc et de ligne (une réf à `../ui/…`/`../state/…` en commentaire/doc n'est pas un import). */
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

/** Tous les `.ts` de `src/data` (récursif), hors `*.test.ts`. Chemins relatifs à DATA_DIR. */
function dataSources(dir = DATA_DIR, rel = ''): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...dataSources(`${dir}/${ent.name}`, relPath));
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(relPath);
  }
  return out;
}

describe('pureté de src/data — ne dépend JAMAIS (runtime) de src/ui, src/state ou src/gameIso (règle 3, #421)', () => {
  const files = dataSources();

  for (const { segment, allow } of FORBIDDEN_SEGMENTS) {
    const IMPORT_RE = importRegexFor(segment);

    it(`aucun fichier data (hors tests) n'importe RUNTIME de src/${segment} (sauf allowlist type-only/factuelle)`, () => {
      const offenders: string[] = [];
      for (const f of files) {
        const base = f.split('/').pop()!;
        if (allow.has(base)) continue;
        const code = stripComments(readFileSync(`${DATA_DIR}/${f}`, 'utf8'));
        if (code.split('\n').some((l) => IMPORT_RE.test(l) && !TYPE_ONLY_RE.test(l))) offenders.push(f);
      }
      expect(
        offenders,
        `Inversion de couche data→${segment} interdite (règle 3, #421). Fichiers fautifs :\n  ${offenders.join('\n  ')}\n` +
          `src/data ne doit jamais dépendre de src/${segment} — reconstruire sur les primitives engine (createHero, rollInitialWealth…).`,
      ).toEqual([]);
    });
  }

  it('le scan couvre bien src/data (sanity : > 100 fichiers)', () => {
    expect(files.length).toBeGreaterThan(100);
  });
});