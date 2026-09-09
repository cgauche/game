import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou `isolate: false` × mock de MODULE — la suite tourne avec `test.isolate: false`
 * (`vite.config.ts`) : le graphe de modules est PARTAGÉ par worker. Un mock de module posé par un
 * fichier de test n'atteint donc pas un module déjà évalué par un fichier précédent du même worker :
 * la liaison dépend de l'ordre des fichiers, lui-même fonction du nombre de cœurs — vert en local,
 * rouge en CI (repro 2026-07-28, `resolve-membre.test.ts`, 5 seeds `--sequence.shuffle` sur 5).
 * Un besoin de tenue/donnée fabriquée s'enregistre dans le REGISTRE lu à l'appel (patron
 * `withTenue` de `src/gameIso/rig/parts/resolve-membre.test.ts`), jamais par mock de module.
 *
 * PÉRIMÈTRE : le mock de MODULE, et lui seul. L'autre famille du graphe partagé — l'espion posé sur
 * un namespace de module ou sur un prototype `three` — est fermée PAR CONSTRUCTION par
 * `test.restoreMocks: true` (vite.config.ts) : chaque espion est rendu après SON test, aucun ne fuit
 * vers les fichiers suivants du worker. La garde ne mesure donc que ce qu'elle couvre.
 * Les motifs traqués sont composés à l'exécution (jamais écrits en clair) : la garde est soumise à
 * la règle qu'elle fait respecter (#828) et ne se détecte pas elle-même.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)

/** Racines scannées — miroir de `test.include` (vite.config.ts), verrouillé par le test de dérive.
 *  Une racine du miroir qui DISPARAÎT fait LEVER `readCorpus` (refus du vide, par base) : la garde
 *  rougit en nommant la racine, au lieu de scanner un périmètre amputé en silence. */
const INCLUDE_ROOTS: { dir: string; re: RegExp; glob: string }[] = [
  { dir: 'src', re: /\.test\.(ts|tsx)$/, glob: 'src/**/*.test.{ts,tsx}' },
  { dir: 'server/src', re: /\.test\.ts$/, glob: 'server/src/**/*.test.ts' },
  { dir: 'scripts/map', re: /\.test\.ts$/, glob: 'scripts/map/**/*.test.ts' },
];

const VI = 'vi';
/** Appels de mock de MODULE (composés, cf. #828) — la famille dont la liaison dépend de l'ordre. */
const MODULE_MOCK_CALLS = [`${VI}.mock(`, `${VI}.doMock(`];

/** `file:line` de chaque appel de mock de module d'une source. */
export function moduleMockHits(source: string, label: string): string[] {
  const out: string[] = [];
  source.split(/\r?\n/).forEach((line, i) => {
    for (const call of MODULE_MOCK_CALLS) if (line.includes(call)) out.push(`${label}:${i + 1} → ${line.trim()}`);
  });
  return out;
}

/** Les fichiers de TEST des racines du miroir, avec leur chemin POSIX depuis la racine du dépôt. */
function scanIncludedTests(): { rel: string; text: string }[] {
  return INCLUDE_ROOTS.flatMap(({ dir, re }) =>
    readCorpus([dir], { tests: true })
      .filter(({ rel }) => re.test(rel))
      .map(({ rel, text }) => ({ rel, text })),
  );
}

const VITE_CONFIG = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
const ISOLATE_FALSE = /isolate\s*:\s*false/.test(VITE_CONFIG);

describe('garde-fou — mock de module interdit tant que la suite partage son graphe (`isolate: false`)', () => {
  it('la garde s\'arme sur l\'état RÉEL de vite.config.ts (`isolate: false` lu, jamais supposé)', () => {
    expect(ISOLATE_FALSE).toBe(true);
  });

  it('l’autre famille du graphe partagé est fermée par construction (`restoreMocks` LU dans la config)', () => {
    expect(
      /restoreMocks\s*:\s*true/.test(VITE_CONFIG),
      "l'en-tête de ce fichier affirme que `spyOn` est fermé par construction : `test.restoreMocks: true` doit exister dans vite.config.ts",
    ).toBe(true);
  });

  it('le périmètre scanné est celui de `test.include` — toute dérive de config casse ici', () => {
    for (const r of INCLUDE_ROOTS) expect(VITE_CONFIG).toContain(`'${r.glob}'`);
    const declared = VITE_CONFIG.match(/include:\s*\[([^\]]*)\]/)?.[1] ?? '';
    expect(declared.match(/'[^']+'/g) ?? []).toHaveLength(INCLUDE_ROOTS.length); // un glob = une racine scannée
  });

  it('cas planté : un appel de mock de module est détecté avec son `fichier:ligne` (preuve TDD)', () => {
    const planted = ['const x = 1;', `${VI}.mock('./career', () => ({}));`].join('\n');
    expect(moduleMockHits(planted, 'plante.test.ts')[0]).toContain('plante.test.ts:2');
    expect(moduleMockHits(`${VI}.doMock('./x');`, 'p.test.ts')).toHaveLength(1);
  });

  it('faux positif écarté : un espion ou une assertion typée ne sont pas des mocks de module', () => {
    expect(moduleMockHits(`${VI}.spyOn(console, 'warn');`, 'p.test.ts')).toEqual([]);
    expect(moduleMockHits(`${VI}.mocked(window.matchMedia);`, 'p.test.ts')).toEqual([]);
  });

  it('aucun fichier de test du périmètre ne mocke de module', () => {
    if (!ISOLATE_FALSE) return; // suite isolée par fichier : la liaison redevient déterministe
    const offenders: string[] = [];
    for (const { rel, text } of scanIncludedTests()) offenders.push(...moduleMockHits(text, rel));
    expect(offenders, `Mock de module sous \`isolate: false\` — la liaison dépend de l'ordre des fichiers du worker.\nEnregistrer la donnée fabriquée dans le registre lu à l'appel (patron \`withTenue\`, resolve-membre.test.ts) :\n${offenders.join('\n')}`).toEqual([]);
  });
});

/**
 * SINGLETONS D'OPTION sous `isolate: false` — même famille de défaut que le mock de module, mesurée
 * en vrai (2026-07-30) : `engine/fixedDie` porte l'option « Dés fixés » en variable de MODULE, donc
 * partagée par tous les fichiers d'un worker. Un fichier qui l'allume sans la rendre la fait fuir vers
 * les suivants — la fenêtre de pose de dé d'un Critique s'y ouvre, l'attaque suspend, les Blessures
 * n'arrivent jamais (`at-terre.test.ts` : « expected 3 to be <= 0 », vert ou rouge selon l'ordre).
 * La remise à zéro appartient donc au SOCLE (`src/test-setup.ts`), au même titre que les règles
 * optionnelles : aucun ordre d'exécution ne doit pouvoir décider du résultat.
 */
describe('singletons d’OPTION partagés — remis à zéro par le socle de test', () => {
  const SETUP = readFileSync(join(ROOT, 'src', 'test-setup.ts'), 'utf8');
  /** Le `beforeEach` du socle (le bloc qui prépare CHAQUE test), COMMENTAIRES RETIRÉS : un appel
   *  commenté ne remet rien à zéro — le lire comme tel serait une sonde menteuse. */
  const beforeEachBody = SETUP.slice(SETUP.indexOf('beforeEach(('), SETUP.indexOf('afterEach(('))
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

  it('le socle remet « Dés fixés » à zéro AVANT chaque test (pas seulement les fichiers qui y pensent)', () => {
    expect(beforeEachBody, "resetDesFixes() manque au beforeEach de src/test-setup.ts : l'option fuit d'un fichier à l'autre").toContain('resetDesFixes()');
    expect(SETUP).toContain("from './engine/fixedDie'");
  });

  it('les remises à zéro de singletons vivent AVANT le décor, dans le même beforeEach que les règles', () => {
    // Voisinage vérifié : la purge des règles optionnelles est la référence de cette famille.
    expect(beforeEachBody).toContain('loadRuleOverrides({})');
  });
});
