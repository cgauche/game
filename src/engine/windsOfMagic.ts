/**
 * Option : Vents Tourbillonnants (LDB 46 l.179-190) — « Avant chaque scène – ou même à chaque Round
 * dans des zones de turbulences magiques –, le MJ peut effectuer un lancer concernant la force des
 * Vents relatifs à la scène […]. Le modificateur peut être ajouté à vos Tests d'Incantation et de
 * Focalisation. » Table verbatim (l.183-190), tirage 1d10, lookup `findTableEntry`.
 *
 * « Si vous possédez le Talent Seconde vue, un Test de Perception Facile (+40) repérera de telles
 * perturbations. » (l.181) — le prédicat `hasSecondeVue` compare l'id du Talent DIRECTEMENT (patron
 * `talentId === 'beni'`, cf. combat-hardcode-guard.test.ts) : ni `hasTalent()` (littéral flaggé par la
 * garde) ni dispatch de capability (pas un pouvoir de combat).
 *
 * Module PUR : le grain (scène/Round) et la couture combat (tirage à l'ouverture, re-tirage au
 * Round, câblage `extraMod` de `resolveCasting`/`resolveFocus`) vivent en `state/` — cf.
 * `src/state/combatFlow.ts` (`windsOfMagicAtCombatStart`) et `src/state/combat/roundHooks.ts`.
 */
import type { RNG } from './dice';
import { defaultRNG, d10 } from './dice';
import { findTableEntry } from './tables';
import type { Combatant } from './types';
import ventsJson from '../data/vents-tourbillonnants.json';

/** `id`/`label` = affichage (Codex `ventsTourbillonnants`, `src/ui/compendium/registry.ts`) ; le
 *  lookup n'utilise que `min`/`max`/`mod` (`findTableEntry`). */
interface WindsEntry { id: string; min: number; max: number; mod: number; label: string }
const WINDS_TABLE = (ventsJson as { table: WindsEntry[] }).table;

/** Modificateur (LDB 46 l.183-190) pour un jet 1d10 donné — lecture LIVE de la donnée éditable. */
export function windsModFromRoll(roll: number): number {
  return findTableEntry(WINDS_TABLE, roll).mod;
}

export interface WindsRoll { roll: number; mod: number }

/** Tirage de la force des Vents (1d10 sur le Tableau, LDB 46 l.183-190). */
export function rollWindsOfMagic(rng: RNG = defaultRNG): WindsRoll {
  const roll = d10(rng);
  return { roll, mod: windsModFromRoll(roll) };
}

/** Le personnage possède-t-il le Talent Seconde vue (id direct, pas de `hasTalent()` littéral) ? */
export function hasSecondeVue(c: Combatant): boolean {
  return c.talents.some((t) => t.talentId === 'seconde-vue' && (t.times ?? 1) >= 1);
}
