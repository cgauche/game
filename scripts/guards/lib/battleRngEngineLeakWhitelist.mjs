// Whitelist du garde « rng vivant → résolveur moteur » (#370, `battleRngEngineLeak.mjs`). RÉUTILISE
// la whitelist du seam de jet (`rollSeamWhitelist.mjs`, #274) : les MÊMES fichiers y sont sanctionnés
// pour la MÊME raison — surfaçage combat déjà arbitré (`MODAL_DEFS`/`JET_AUTO`) ou dé de monde/
// événement/applier POST-COMMIT (le jet du joueur, lui, est DÉJÀ passé par `openRoll` avant que
// l'applier ne roule l'adversaire — patron `portFlow.ts` PORT_SELL_BARGAIN_KIND/PORT_BUY_BARGAIN_KIND :
// `rollMerchantOpposition(merchantValue, battleRng())` roulé DANS l'applier, après que le héros a déjà
// posé son propre jet via `openPartyTest`). Un SEUL ajout au-delà du seam : `combatSlice.ts` (recensé
// par le scan #370 — cœur de la boucle de combat, même régime que `combatFlow.ts`/`combatManeuvers.ts`
// déjà listés, mais n'appelle jamais `rollTest(`/`d100(` EN DIRECT — seulement via des résolveurs
// `resolve*` du moteur combat — d'où l'absence de cette entrée dans la whitelist SŒUR).

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
