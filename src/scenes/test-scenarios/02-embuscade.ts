import { makePregens } from '../../data/pregens';
import { ambushTest } from '../ambush-test';
import type { TestScenario } from './_shared';

export const scenario: TestScenario = {
  id: 'embuscade',
  order: 2,
  icon: '🩸',
  title: "L'Embuscade",
  tests: "Flux complet exploration → dialogue → combat (5 mutants, ch.2). L'ancien « Test rapide ».",
  partyNote: '4 pré-tirés',
  makeParty: () => makePregens().slice(0, 4),
  scene: ambushTest,
  // pas d'autoCombat : on entre en exploration, le trigger lance le dialogue puis le combat.
};
