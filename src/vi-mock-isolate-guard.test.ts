import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou `isolate: false` × mock de MODULE — la suite tourne avec `test.isolate: false`
 * (`vite.config.ts`) : le graphe de modules est PARTAGÉ par worker. Un mock de module posé par un
 * fichier de test n'atteint donc pas un module déjà évalué par un fichier précédent du même worker :
 * la liaison dépend de l'ordre des fichiers, lui-même fonction du nombre de cœurs — vert en local,
 * rouge en CI (repro 2026-07-28, `resolve-membre.test.ts`, 5 seeds `--sequence.shuffle` sur 5).
 * Un besoin de tenue/donnée fabriquée s'enregistre dans le REGISTRE lu à l'appel (patron
 * `withTenue` de `src/gameIso/rig/parts/resolve-membre.test.ts`), jamais par mock de module.
 *
 * PÉRIMÈTRE MESURÉ (2026-07-28, 1102 fichiers de test scannés = `test.include` de vite.config.ts) :
 *   - mock de module : 0 occurrence → la garde échoue au premier retour.
 *   - espion (`spyOn`) : 33 occurrences dans 10 fichiers → HORS garde.
 * ANGLE MORT ASSUMÉ — `spyOn` n'est PAS couvert. Deux familles s'y cachent, de risque inégal :
 * l'espion de `console` (inoffensif, restauré par le test qui le pose) et l'espion sur un NAMESPACE
 * DE MODULE (`IsoStage.test.tsx`, `harpoon-rope-cut.test.ts`, `ship-maneuver.test.ts`), qui mute
 * l'instance partagée du worker et fuit vers les fichiers suivants tant qu'aucune restauration
 * globale n'existe (`src/test-setup.ts` restaure les timers et les singletons, pas les espions).
 * Cette seconde famille reste à trancher ; la garde ne la mesure pas, elle ne la couvre donc pas.
 * Les motifs traqués sont composés à l'exécution (jamais écrits en clair) : la garde est soumise à
 * la règle qu'elle fait respecter (#828) et ne se détecte pas elle-même.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)

/** Racines scannées — miroir de `test.include` (vite.config.ts), verrouillé par le test de dérive. */
const INCLUDE_ROOTS: { dir: string; re: RegExp; glob: string }[] = [
  { dir: join(ROOT, 'src'), re: /\.test\.(ts|tsx)$/, glob: 'src/**/*.test.{ts,tsx}' },
  { dir: join(ROOT, 'server', 'src'), re: /\.test\.ts$/, glob: 'server/src/**/*.test.ts' },
  { dir: join(ROOT, 'scripts', 'map'), re: /\.test\.ts$/, glob: 'scripts/map/**/*.test.ts' },
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

function scanIncludedTests(): string[] {
  const files: string[] = [];
  const walk = (dir: string, re: RegExp) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p, re); }
      else if (re.test(e)) files.push(p);
    }
  };
  for (const r of INCLUDE_ROOTS) walk(r.dir, r.re);
  return files;
}

const VITE_CONFIG = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
const ISOLATE_FALSE = /isolate\s*:\s*false/.test(VITE_CONFIG);

describe('garde-fou — mock de module interdit tant que la suite partage son graphe (`isolate: false`)', () => {
  it('la garde s\'arme sur l\'état RÉEL de vite.config.ts (`isolate: false` lu, jamais supposé)', () => {
    expect(ISOLATE_FALSE).toBe(true);
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
    for (const f of scanIncludedTests()) {
      const label = relative(ROOT, f).replace(/\\/g, '/');
      offenders.push(...moduleMockHits(readFileSync(f, 'utf8'), label));
    }
    expect(offenders, `Mock de module sous \`isolate: false\` — la liaison dépend de l'ordre des fichiers du worker.\nEnregistrer la donnée fabriquée dans le registre lu à l'appel (patron \`withTenue\`, resolve-membre.test.ts) :\n${offenders.join('\n')}`).toEqual([]);
  });
});
