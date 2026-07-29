// Whitelist PARTAGÉE du garde « exclusivité du seam de jet » (#274) — SOURCE UNIQUE consommée par
// `src/state/roll-seam-exclusivity-guard.test.ts` (Vitest) ET `scripts/git-hooks/pre-commit.mjs`
// (double détente). Deux listes DISJOINTES, de nature différente :
//
//  1. `ROLL_SEAM_CORE` — exclusion de PRINCIPE : ces fichiers SONT le seam (la porte, la fabrique, le
//     séquenceur, les résolveurs de spec, le pont de Test déclenché en combat). Leur `rollTest(`/
//     `TestOutcome.seal(` est le foyer que le garde protège, pas un contournement : les exclure n'est
//     pas une exemption mais la définition du périmètre. Aucun compte : cette liste ne décroît pas.
//  2. `ROLL_SEAM_PHASE2_STOCK` — stock MESURÉ de sites restant à router par `openRoll` (#918 phase 2),
//     fichier → nombre de sites. Le compte est VÉRIFIÉ par le test : un site de plus dans un de ces
//     fichiers est rouge, et un site migré exige de mettre le compte à jour ICI. Cette liste décroît
//     jusqu'à disparaître ; on n'y ajoute pas de fichier.
//
// Les formes (S) « position de spec » et (M) « dé de monde » ne sont PLUS des entrées de liste : elles
// sont reconnues STRUCTURELLEMENT par le scanner (cf. en-tête de `rollSeamExclusivity.mjs`). C'est ce
// qui a retiré `src/data/mutations.ts`, `landMarketFlow.ts`, `shipCrew.ts` (tous leurs sites sont des
// dés de monde) ; `rollFlowFactory.ts` a rejoint le noyau, et `encounterPsychFlow.ts`/`restFlow.ts`
// n'avaient plus AUCUN site (leurs occurrences vivaient dans des commentaires).

/** Le seam lui-même — exclusion de principe, sans compte. @type {Set<string>} */
export const ROLL_SEAM_CORE = new Set([
  'src/state/rollSeam.ts',
  'src/state/rollFlowFactory.ts',
  'src/state/cascade.ts',
  'src/state/rollFlowSpecs.ts',
  'src/state/combat/triggeredTest.ts',
]);

/** Stock à résorber (#918 phase 2) : fichier → nombre de sites MESURÉ. @type {Map<string, number>} */
export const ROLL_SEAM_PHASE2_STOCK = new Map([
  ['src/state/combat/roundHooks.ts', 4],
  ['src/state/combat/turnHooks.ts', 1],
  ['src/state/combatEffects.ts', 1],
  ['src/state/combatFlow.ts', 10],
  ['src/state/combatManeuvers.ts', 4],
  ['src/state/corruptionFlow.ts', 2],
  ['src/state/interludeFlow.ts', 4],
  ['src/state/massBattleFlow.ts', 1],
  ['src/state/pursuitFlow.ts', 1],
  ['src/state/riverVoyageFlow.ts', 4],
  ['src/state/seaVoyageFlow.ts', 4],
  ['src/state/shipManeuver.ts', 2],
  ['src/state/shipwreck.ts', 2],
  ['src/state/travelFlow.ts', 7],
  ['src/state/travelPostes.ts', 1],
  ['src/state/triggeredEffects.ts', 1],
  ['src/state/upkeep.ts', 2],
]);

/** @type {Set<string>} */
export const ROLL_SEAM_FILE_WHITELIST = new Set([...ROLL_SEAM_CORE, ...ROLL_SEAM_PHASE2_STOCK.keys()]);

/** @param {string} rel @returns {boolean} */
export function rollSeamExcluded(rel) {
  return rel.startsWith('src/engine/') || ROLL_SEAM_FILE_WHITELIST.has(rel);
}
