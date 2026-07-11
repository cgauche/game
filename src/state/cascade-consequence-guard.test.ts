import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cliquet du composeur d'affichage (#295 Lot 1, verrou 2) — le canal DÉPRÉCIÉ `journal:` d'un
 * `CascadeApplier` (cascade.ts `CascadeApplier`) est une chaîne LIBRE : elle peut re-décrire le jet
 * (`${step.result.roll}/${step.result.target}`, « réussi »/« raté ») que la rangée `RollLine` affiche
 * déjà (✓/✗ ±DR) — la duplication que #295 supprime (Décision 1b). `consequences: freeCons(...)`
 * (le canal migré) reste hors périmètre : ses lignes narrent une conséquence DÉJÀ appliquée, jamais le
 * jet lui-même — cf. `docs/plans/2026-07-10-conception-composeur-affichage-jets.md` § Verrous.
 *
 * BASELINE gelée par fichier (patron `ui-ratchets.test.ts`) : toute HAUSSE échoue (régression), toute
 * baseline devenue trop haute (fichier migré) doit être ABAISSÉE. Les fichiers du Lot 1 (#295) sont à
 * baseline ZÉRO — la moindre réapparition du canal `journal:` y échoue immédiatement.
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // racine du repo

/** Isole les littéraux `journal: [...]` d'un CascadeApplier (canal déprécié) — exclut les écritures
 *  d'ÉTAT `journal: [...get().journal...]` (spread de `state.journal`, un champ homonyme sans rapport). */
function journalLiterals(src: string): string[] {
  return src.match(/\bjournal:\s*\[(?!\.\.\.get\(\)\.journal)[^\]]*\]/gs) ?? [];
}

/** Compte, DANS les littéraux `journal:` isolés, les deux motifs de duplication du jet (doc § Verrous) :
 *  re-print du résultat (`${…roll|target|sl}`) et verdict en dur (réussi/raté/réussit/échoue). */
function dupCounts(src: string): { journalArrays: number; jetDup: number; verdict: number } {
  const snippets = journalLiterals(src);
  let jetDup = 0;
  let verdict = 0;
  for (const s of snippets) {
    jetDup += (s.match(/\$\{[^}]*\.(roll|target|sl)\b/g) ?? []).length;
    verdict += (s.match(/\b(r[ée]ussi|rat[ée]|r[ée]ussit|[ée]choue)\b/gi) ?? []).length;
  }
  return { journalArrays: snippets.length, jetDup, verdict };
}

/** Baseline par fichier (relatif à la racine du repo, slashes avant) — ZÉRO pour tout fichier migré au
 *  Lot 1 (#295) : `travelFlow`/`travelPostes`/`seaVoyageFlow`/`shipwreck`/`pursuitFlow`/`combatFlow`/
 *  `combat/roundHooks`/`combat/turnHooks`/`combat/triggeredTest`/`restFlow`/`embrigadementFlow`/
 *  `riverVoyageFlow` (Lot 1 fluvial, patron). Dette GELÉE ailleurs (appliers non encore migrés, hors
 *  périmètre Lot 1) : `combatEffects`/`combatManeuvers`/`encounterPsychFlow` — `jetDup`/`verdict` à 0
 *  partout dès aujourd'hui (aucune duplication RÉELLE mesurée), seul `journalArrays` reste non nul le
 *  temps de leur propre migration. */
const BASELINE: Record<string, { journalArrays: number; jetDup: number; verdict: number }> = {
  'src/state/combatEffects.ts': { journalArrays: 2, jetDup: 0, verdict: 0 },
  'src/state/combatManeuvers.ts': { journalArrays: 1, jetDup: 0, verdict: 0 },
  'src/state/encounterPsychFlow.ts': { journalArrays: 2, jetDup: 0, verdict: 0 },
};

const SCOPE = [
  'src/state/travelFlow.ts', 'src/state/travelPostes.ts', 'src/state/seaVoyageFlow.ts', 'src/state/shipwreck.ts',
  'src/state/pursuitFlow.ts', 'src/state/combatFlow.ts', 'src/state/combat/roundHooks.ts', 'src/state/combat/turnHooks.ts',
  'src/state/combat/triggeredTest.ts', 'src/state/restFlow.ts', 'src/state/embrigadementFlow.ts', 'src/state/riverVoyageFlow.ts',
  'src/state/combatEffects.ts', 'src/state/combatManeuvers.ts', 'src/state/encounterPsychFlow.ts',
];

describe('cliquet composeur — canal journal: déprécié des CascadeApplier (#295 Lot 1, verrou 2)', () => {
  it('aucun fichier migré (Lot 1) ne réutilise le canal journal: ; la dette gelée ailleurs ne DUPLIQUE pas le jet', () => {
    const over: string[] = [];
    const stale: string[] = [];
    for (const rel of SCOPE) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const n = dupCounts(src);
      const b = BASELINE[rel] ?? { journalArrays: 0, jetDup: 0, verdict: 0 };
      if (n.journalArrays > b.journalArrays || n.jetDup > b.jetDup || n.verdict > b.verdict) {
        over.push(`${rel} : journalArrays=${n.journalArrays}(base ${b.journalArrays}) jetDup=${n.jetDup}(base ${b.jetDup}) verdict=${n.verdict}(base ${b.verdict})`);
      }
      if (n.journalArrays < b.journalArrays || n.jetDup < b.jetDup || n.verdict < b.verdict) {
        stale.push(`${rel} : baseline journalArrays=${b.journalArrays}/jetDup=${b.jetDup}/verdict=${b.verdict}, réel ${n.journalArrays}/${n.jetDup}/${n.verdict}`);
      }
    }
    expect(over, `Régression canal journal: déprécié — migrer vers consequences: freeCons(...) :\n${over.join('\n')}`).toEqual([]);
    expect(stale, `Baseline(s) PÉRIMÉE(s) — abaisser (fichier assaini) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le compteur détecte une duplication SYNTHÉTIQUE de jet dans un littéral journal:', () => {
    const regressed = "registerCascadeApplier('x', (get, set, step, hero) => {\n"
      + "  return { journal: [`${hero.name} : ${step.result.roll}/${step.result.target} → réussi.`] };\n"
      + '});';
    const n = dupCounts(regressed);
    expect(n.journalArrays).toBe(1);
    expect(n.jetDup).toBeGreaterThan(0);
    expect(n.verdict).toBeGreaterThan(0);
  });

  it('fail-closed : une écriture d\'état journal: [...get().journal...] (state.journal) N\'EST PAS confondue avec le canal applier', () => {
    const stateWrite = "set({ journal: [...get().journal.slice(-40), 'ligne'] });";
    expect(journalLiterals(stateWrite)).toEqual([]);
  });

  it('aucun applier des surfaces migrées ne recense de nouveau fichier hors BASELINE (garde exhaustive du scope)', () => {
    for (const rel of Object.keys(BASELINE)) expect(SCOPE).toContain(rel);
  });
});
