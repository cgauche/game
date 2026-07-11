import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cliquet du composeur d'affichage (#295, verrou 2) — le canal `journal:` d'un `CascadeApplier` a
 * disparu DU TYPE (`cascade.ts CascadeApplier`, mort du canal) : le compilateur interdit déjà toute
 * chaîne LIBRE re-décrivant le jet (`${step.result.roll}/${step.result.target}`, « réussi »/« raté »)
 * que la rangée `RollLine` affiche déjà (✓/✗ ±DR). Ce cliquet reste en CEINTURE (grep, pas seulement
 * type) ; le CONTENU des conséquences (`freeCons(...)`) est verrouillé par le describe « CONTENU »
 * ci-dessous — doctrine #295 : une ligne de conséquence narre l'effet DÉJÀ appliqué, jamais le jet.
 *
 * BASELINE gelée par fichier (patron `ui-ratchets.test.ts`), TOUTE à ZÉRO (#295 migration soldée) :
 * toute HAUSSE échoue (régression).
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

/** Baseline par fichier (relatif à la racine du repo, slashes avant) — ZÉRO partout : `travelFlow`/
 *  `travelPostes`/`seaVoyageFlow`/`shipwreck`/`pursuitFlow`/`combatFlow`/`combat/roundHooks`/
 *  `combat/turnHooks`/`combat/triggeredTest`/`restFlow`/`embrigadementFlow`/`riverVoyageFlow` (Lot 1) +
 *  `combatEffects`/`combatManeuvers`/`encounterPsychFlow` (mort du canal, #295) — plus aucun fichier
 *  du scope ne porte le canal `journal:` déprécié. */
const BASELINE: Record<string, { journalArrays: number; jetDup: number; verdict: number }> = {};

const SCOPE = [
  'src/state/travelFlow.ts', 'src/state/travelPostes.ts', 'src/state/seaVoyageFlow.ts', 'src/state/shipwreck.ts',
  'src/state/pursuitFlow.ts', 'src/state/combatFlow.ts', 'src/state/combat/roundHooks.ts', 'src/state/combat/turnHooks.ts',
  'src/state/combat/triggeredTest.ts', 'src/state/restFlow.ts', 'src/state/embrigadementFlow.ts', 'src/state/riverVoyageFlow.ts',
  'src/state/combatEffects.ts', 'src/state/combatManeuvers.ts', 'src/state/encounterPsychFlow.ts',
];

describe('cliquet composeur — canal journal: déprécié des CascadeApplier (#295, verrou 2, mort du canal)', () => {
  it('aucun fichier du scope ne réutilise le canal journal: (canal absent DU TYPE)', () => {
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

/**
 * Cliquet du composeur d'affichage (#295, Lot 5 — CONTENU) : le canal `journal:` a disparu (verrou
 * ci-dessus), mais la migration Lot 1 n'avait touché que le TYPE — pas le TEXTE. Ce second cliquet
 * scanne, PAR FICHIER du scope, le motif `${…roll}/${…target}` sur TOUT le fichier (pas seulement les
 * littéraux `journal:`, morts) : un re-print du jet dans un texte de conséquence (`freeCons(...)`,
 * `tell(...)`, `log(...)`…) juste au-dessus d'une rangée qui l'affiche déjà (CascadeModal, SteamSaveModal,
 * RenounceModal…) est le symptôme exact du mandat user (« le pire c'est les résultats qui remettent le
 * résultat du jet visible juste au-dessus »).
 *
 * BASELINE ZÉRO pour tout fichier entièrement purgé. BASELINE > 0 = liste NOMINATIVE de sites GARDÉS
 * (justifiés site par site, en commentaire au-dessus de chaque site) parce que le JOURNAL (ou le journal
 * de combat) y est la SEULE surface du jet (aucune rangée nulle part : replis IA/synchrones, sous-jets
 * internes sans étape de cascade propre, adversaires sans PJ, Test opposé inline défenseur non piloté par
 * un humain) — doctrine #295.
 */
const CONTENT_SCOPE = [
  'src/state/seaVoyageFlow.ts', 'src/state/travelFlow.ts', 'src/state/travelPostes.ts', 'src/state/riverVoyageFlow.ts',
  'src/state/shipwreck.ts', 'src/state/pursuitFlow.ts', 'src/state/corruptionFlow.ts', 'src/state/combat/triggeredTest.ts',
  'src/state/store.ts', 'src/state/seaActivities.ts',
];

/** Sites GARDÉS nominativement (journal = SEULE surface du jet) — toute hausse au-delà = régression. */
const CONTENT_BASELINE: Record<string, number> = {
  'src/state/seaVoyageFlow.ts': 2, // Exposition de nuit (multi-Tests/héros) + redémarrage vapeur (`runRestart`) : équipage/ambiance hors modale.
  'src/state/travelFlow.ts': 4, // bêtes de l'attelage (×2, sans rangée dédiée) + reprise de contrôle IA (×2, repli sans acteur joueur).
  'src/state/travelPostes.ts': 0,
  'src/state/riverVoyageFlow.ts': 5, // redressement multi-Round + éclats/calfatage/renflouage IA (repli sans pilote humain, ×4).
  'src/state/shipwreck.ts': 1, // Natation, repli SANS pilote humain à bord (aucune cascade démarrée).
  'src/state/pursuitFlow.ts': 1, // Mouvement des adversaires (pas des PJ, aucune rangée).
  'src/state/corruptionFlow.ts': 0,
  'src/state/combat/triggeredTest.ts': 2, // Test opposé INLINE (attaquant ET défenseur, aucun piloté humain) — SEULE surface des deux jets.
  'src/state/store.ts': 0,
  'src/state/seaActivities.ts': 4, // Activités de mer, résolution synchrone post-picks (aucune cascade, aucune rangée).
};

function jetEchoCount(src: string): number {
  return (src.match(/\$\{[^}]*\.roll\}\/\$\{[^}]*\.target\}/g) ?? []).length;
}

describe('cliquet composeur — CONTENU des conséquences : re-print roll/target hors rangée (#295 Lot 5)', () => {
  it('aucun fichier du scope CONTENU ne dépasse sa baseline nominative gardée', () => {
    const over: string[] = [];
    const stale: string[] = [];
    for (const rel of CONTENT_SCOPE) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const n = jetEchoCount(src);
      const b = CONTENT_BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} occurrence(s) (baseline gardée ${b})`);
      if (n < b) stale.push(`${rel} : baseline gardée ${b}, réel ${n}`);
    }
    expect(over, `Régression — re-print roll/target hors rangée (#295 Lot 5) :\n${over.join('\n')}`).toEqual([]);
    expect(stale, `Baseline(s) gardée(s) PÉRIMÉE(s) — abaisser (site purgé depuis) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le compteur détecte un re-print roll/target SYNTHÉTIQUE hors littéral journal:', () => {
    const regressed = "  return { consequences: freeCons([`${hero.name} : ${step.result.roll}/${step.result.target} → réussi.`]) };";
    expect(jetEchoCount(regressed)).toBe(1);
  });

  it('exhaustivité du scope CONTENU (tout fichier touché par le Lot 5 est couvert)', () => {
    for (const rel of Object.keys(CONTENT_BASELINE)) expect(CONTENT_SCOPE).toContain(rel);
  });
});
