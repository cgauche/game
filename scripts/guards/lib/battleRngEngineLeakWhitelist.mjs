// Whitelist du garde « rng vivant → résolveur moteur » (#370, `battleRngEngineLeak.mjs`). RÉUTILISE
// la whitelist du seam de jet (`rollSeamWhitelist.mjs`, #274) : le garde renforcé au niveau FICHIER
// (#370, ronde 2) portait dette pour deux entrées supplémentaires. Depuis l'affinage par SIGNATURE
// (#912, ronde 3 — cf. en-tête de `battleRngEngineLeak.mjs`), le scanner ne signale plus un résolveur
// `resolveXxx` importé dont la signature moteur ne prend PAS de paramètre `RNG` — `resolveOpposed`
// (`src/engine/tests.ts`) et `resolveTavernRound` (`src/engine/tavernGame.ts`) sont PURS
// (`TestResult, TestResult → issue`, jamais de rng en paramètre) : `portFlow.ts` et `tavernFlow.ts`
// ne matchent PLUS AUCUN site et sont RETIRÉS de cette liste — ils n'y restaient que par imprécision
// du scan à l'échelle du fichier, jamais pour de la dette réelle.
//
// Seule entrée AU-DELÀ de la whitelist sœur : `combatSlice.ts` (recensé par le scan #370 — cœur de
// la boucle de combat, même régime que `combatFlow.ts`/`combatManeuvers.ts` déjà listés, mais
// n'appelle jamais `rollTest(`/`d100(` EN DIRECT — seulement via des résolveurs `resolve*` du moteur
// combat, RNG-capables pour de vrai (`resolveAttack`, `resolveMagicMissile`, `resolveCasting`,
// `resolveDistraire`…) — d'où l'absence de cette entrée dans la whitelist SŒUR). Son retrait relève
// d'un arbitrage d'architecture, pas d'une imprécision du scan.

import { ROLL_SEAM_FILE_WHITELIST } from './rollSeamWhitelist.mjs';

/** @type {Set<string>} */
export const BATTLE_RNG_ENGINE_LEAK_WHITELIST = new Set([
  ...ROLL_SEAM_FILE_WHITELIST,
  'src/state/combatSlice.ts',
]);

/** @param {string} rel @returns {boolean} */
export function battleRngEngineLeakExcluded(rel) {
  return rel.startsWith('src/engine/') || BATTLE_RNG_ENGINE_LEAK_WHITELIST.has(rel);
}
