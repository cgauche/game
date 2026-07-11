import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRollSeamExclusivity } from '../../scripts/guards/lib/rollSeamExclusivity.mjs';
import { rollSeamExcluded } from '../../scripts/guards/lib/rollSeamWhitelist.mjs';

/**
 * Garde-fou « exclusivité du seam de jet » (#274, DERNIER verrou du programme #276).
 * La porte `openRoll` (`src/state/rollSeam.ts`) +
 * `TestOutcome.seal` (`src/engine/testOutcome.ts`) sont le SEUL chemin scellé pour produire une issue
 * de Test — un `rollTest(`/`d100(`/`TestOutcome.seal(` inline hors whitelist forge un jet SANS passer
 * par la policy de surfaçage M/V/I (Décision 3). Double détente avec le hook pre-commit
 * (`scripts/git-hooks/pre-commit.mjs`) — un `rollTest` réintroduit dans un flow doit être rouge ICI
 * (CI/local) ET au commit.
 *
 * Whitelist (raison D'UNE LIGNE par entrée — balayage pré-garde #274) :
 *  - `src/engine/**` : moteur PUR, fonctions qui REÇOIVENT un `rng` sans jamais décider du
 *    surfaçage — c'est l'APPELANT (state/) qui choisit modale/MJ/inline (règle du seam elle-même).
 *  - `src/data/mutations.ts` : tirage de TABLE d100 (Corruption/mutation, LDB 19) — lookup verbatim,
 *    pas un Test de compétence, aucune décision de surfaçage à prendre.
 *  - `src/state/rollSeam.ts`/`rollFlowFactory.ts`/`cascade.ts`/`rollFlowSpecs.ts` : le NOYAU du seam
 *    lui-même (Décision 2 du doc de conception — la porte, la fabrique, le séquenceur générique, les
 *    résolveurs de spec).
 *  - Combat DÉJÀ CANONIQUE (Décision 6 du doc) : `combat/roundHooks.ts`, `combat/triggeredTest.ts`,
 *    `combat/turnHooks.ts`, `combatFlow.ts`, `combatManeuvers.ts`, `combatEffects.ts`,
 *    `triggeredEffects.ts`, `encounterPsychFlow.ts` — surfaçage déjà arbitré par `MODAL_DEFS`/
 *    `JET_AUTO` (`modalArbiter.ts`/`combatAuto.ts`), hors périmètre du seam hors-combat.
 *  - Flux hors-combat SANCTIONNÉS (repli SANS pilote humain déjà branché sur une modale plus haut
 *    dans la MÊME fonction, ou jet SECONDAIRE d'un applier déjà résolu — #295 Lot 5, RNG primitif
 *    hors périmètre du seam, Décision 6) : `seaVoyageFlow.ts`, `riverVoyageFlow.ts`, `travelFlow.ts`,
 *    `pursuitFlow.ts`, `shipwreck.ts`, `shipManeuver.ts`, `restFlow.ts`, `upkeep.ts`,
 *    `corruptionFlow.ts`, `shipCrew.ts`, `interludeFlow.ts`, `massBattleFlow.ts`, `travelPostes.ts` —
 *    dés d'ÉVÉNEMENT/MONDE (encontre %, désertion %, panne %, banque) sans skill/DR, pas des Tests.
 *  - `landMarketFlow.ts` : le Marchandage opposé (`opposedTest`, non capté par ce garde) reste
 *    synchrone (buyer-found % non migré) — seuls `rollTest`/`d100` y restent pour le buyer-found (%) ;
 *    Ragot/Évaluation MIGRÉS sur `openRoll` (#274). `portFlow.ts` (vente maritime, dernier reliquat
 *    #275/#274) est désormais ENTIÈREMENT migré (Ragot/acheteur/Marchandage en cascade `openRoll`) —
 *    plus dans cette whitelist.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src'];

const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel) || rollSeamExcluded(rel);

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return files;
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of scanFiles()) {
    const rel = relative(ROOT, f).split('\\').join('/');
    if (EXCLUDED(rel)) continue;
    const n = scanRollSeamExclusivity(rel, readFileSync(f, 'utf8')).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « seam de jet » — exclusivité de rollTest/d100/TestOutcome.seal (cliquet, #274)', () => {
  it('aucun fichier hors whitelist ne roule/scelle un Test en direct', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouveau jet forgé hors seam — router par openRoll (src/state/rollSeam.ts) ou justifier l'entrée dans la whitelist (roll-seam-exclusivity-guard.test.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte un rollTest inline SYNTHÉTIQUE', () => {
    const regressed = "const res = rollTest(best.value, 'intermediaire', battleRng());";
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner détecte un d100 inline SYNTHÉTIQUE', () => {
    const regressed = 'if (d100(rng) <= chance.target) { /* … */ }';
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner détecte un TestOutcome.seal( hors seam SYNTHÉTIQUE', () => {
    const regressed = "return TestOutcome.seal({ roll: 1, target: 40, success: true, sl: 1, isDouble: false });";
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('le noyau du seam (rollSeam.ts, hors scan) porte bien TestOutcome.seal( — sinon le foyer a bougé', () => {
    const src = readFileSync(join(ROOT, 'src/state/rollSeam.ts'), 'utf8');
    expect(scanRollSeamExclusivity('src/state/rollSeam.ts', src).length).toBeGreaterThan(0);
  });
});
