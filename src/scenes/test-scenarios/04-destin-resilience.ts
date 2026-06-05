import { makePregens } from '../../data/pregens';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

function combattant(): Combatant {
  return JSON.parse(JSON.stringify(makePregens().find((p) => p.name.startsWith('Sigmund'))!)) as Combatant;
}

const scene = arena({ id: 'test-destin', nom: 'Destin & Résilience — arène', w: 14, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Un minotaure. Un coup létal déclenche le sauvetage par le Destin ; la Résilience garantit une réussite.';
scene.encounters = [{ id: 'enc-destin', enemies: [{ ref: 'Minotaure', pos: { x: 8, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'destin-resilience',
  order: 4,
  icon: '🍀',
  title: 'Destin / Résilience',
  tests: 'Coup létal → pendingFateSave (« Comment ça a pu rater ? » / « Meurs un autre jour ») + réussite garantie.',
  partyNote: 'Sigmund (Destin+Résilience) vs Minotaure',
  makeParty: () => [combattant()],
  scene,
  autoCombat: 'enc-destin',
};
