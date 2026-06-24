import { pregenParty, PREGEN } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

const scene = arena({ id: 'test-engage', nom: 'Engagé / Charge / Désengagement', w: 16, h: 10, heroStart: { x: 2, y: 5 } });
scene.startMessage = 'Deux gobelins à quelques mètres : chargez, restez Engagé, puis désengagez-vous.';
setEncounters(scene, [
  {
    id: 'enc-engage',
    enemies: [
      { ref: 'gobelin', pos: { x: 9, y: 4 } },
      { ref: 'gobelin', pos: { x: 9, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'engagement',
  order: 5,
  icon: '⚔️',
  title: 'Engagé / Charge / Désengagement',
  tests: 'Charger (portée Course + Avantage), état Engagé symétrique, Se désengager (sacrifice d’Avantage / Esquive).',
  partyNote: 'Sigmund + Grunni (mêlée) vs 2 Gobelins',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.tueur),
  scene,
  autoCombat: 'enc-engage',
};
