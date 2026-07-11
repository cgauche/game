// Whitelist PARTAGÉE du garde « exclusivité du seam de jet » (#274) — SOURCE UNIQUE consommée par
// `src/state/roll-seam-exclusivity-guard.test.ts` (Vitest) ET `scripts/git-hooks/pre-commit.mjs`
// (double détente). Raisons détaillées (une ligne par entrée, catégorie par catégorie) : voir la
// docstring de `roll-seam-exclusivity-guard.test.ts` — ce module ne porte QUE la liste, jamais sa
// justification dupliquée.

/** @type {Set<string>} */
export const ROLL_SEAM_FILE_WHITELIST = new Set([
  'src/data/mutations.ts',
  'src/state/rollSeam.ts',
  'src/state/rollFlowFactory.ts',
  'src/state/cascade.ts',
  'src/state/rollFlowSpecs.ts',
  'src/state/combat/roundHooks.ts',
  'src/state/combat/triggeredTest.ts',
  'src/state/combat/turnHooks.ts',
  'src/state/combatFlow.ts',
  'src/state/combatManeuvers.ts',
  'src/state/combatEffects.ts',
  'src/state/triggeredEffects.ts',
  'src/state/encounterPsychFlow.ts',
  'src/state/seaVoyageFlow.ts',
  'src/state/riverVoyageFlow.ts',
  'src/state/travelFlow.ts',
  'src/state/pursuitFlow.ts',
  'src/state/shipwreck.ts',
  'src/state/shipManeuver.ts',
  'src/state/restFlow.ts',
  'src/state/upkeep.ts',
  'src/state/corruptionFlow.ts',
  'src/state/shipCrew.ts',
  'src/state/interludeFlow.ts',
  'src/state/massBattleFlow.ts',
  'src/state/travelPostes.ts',
  'src/state/portFlow.ts',
  'src/state/landMarketFlow.ts',
]);

/** @param {string} rel @returns {boolean} */
export function rollSeamExcluded(rel) {
  return rel.startsWith('src/engine/') || ROLL_SEAM_FILE_WHITELIST.has(rel);
}
