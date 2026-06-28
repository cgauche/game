import { pregen, PREGEN } from '../../data/pregens';
import type { Combatant } from '../../engine/types';
import { ambushTest } from '../ambush-test';
import type { TestScenario } from './_shared';

/**
 * Le combat « complet » de référence (exploration → dialogue → 5 mutants, ch.2). Son groupe absorbe les
 * anciens micro-tests Critiques/Mort, Destin/Résilience et Guérison : dans une vraie bagarre dangereuse,
 * chacun de ces mécanismes se déclenche naturellement — pas besoin d'un scénario dédié par mécanique.
 *  - Sigmund (Soldat) garde Destin + Résilience → sauvetage par le Destin / réussite garantie.
 *  - Klein (Voleur Halfling, peu de Blessures) n'a plus aucun Destin → 0 PB mène vraiment à
 *    À Terre → Inconscient → mort (cascade de Traumatisme).
 *  - Frère Anselm (Prêtre) sait Guérison → Action Soigner / arrêt d'Hémorragie sur un allié qui tombe.
 */
function groupe(): Combatant[] {
  const sigmund = pregen(PREGEN.soldat); // Destin/Résilience intacts (sauvetage in extremis)
  const grunni = pregen(PREGEN.tueur);
  const anselm = pregen(PREGEN.pretre);
  if (!anselm.skills.some((s) => s.skillId === 'guerison')) {
    anselm.skills.push({ skillId: 'guerison', characteristic: 'Int', advances: 25 }); // sinon pas d'Action Soigner
  }
  const klein = pregen(PREGEN.voleur); // Halfling fragile
  klein.fate = 0;
  klein.fortune = 0;
  klein.resilience = 0;
  klein.resolve = 0;
  return [sigmund, grunni, anselm, klein];
}

export const scenario: TestScenario = {
  id: 'embuscade',
  order: 2,
  category: '⚔️ Combat',
  icon: '🩸',
  title: "L'Embuscade",
  tests:
    'Combat complet exploration → dialogue → combat (5 mutants, ch.2). Y surviennent : Critiques & mort ' +
    '(Klein, Destin 0 → cascade À Terre/Inconscient/mort), sauvetage par le Destin & Résilience (Sigmund), ' +
    "Action Soigner & arrêt d'Hémorragie (Frère Anselm) sur un allié qui tombe.",
  partyNote: 'Sigmund (Destin) · Tueur nain · Frère Anselm (soigneur) · Klein le Voleur (fragile, Destin 0)',
  makeParty: groupe,
  scene: ambushTest,
  // pas d'autoCombat : on entre en exploration, le trigger lance le dialogue puis le combat.
};
