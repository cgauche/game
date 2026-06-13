import { makePregens } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

const scene = arena({ id: 'test-magie', nom: 'Magie — incantation & bénédictions', w: 16, h: 10, heroStart: { x: 2, y: 5 } });
scene.startMessage = 'Lancez Fléchette/Choc (Sorcier), bénissez (Prêtre), tentez une Focalisation.';
setEncounters(scene, [
  {
    id: 'enc-magie',
    enemies: [
      { ref: 'Zombie', pos: { x: 10, y: 4 } },
      { ref: 'Zombie', pos: { x: 10, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'magie',
  order: 6,
  icon: '✨',
  title: 'Magie',
  tests: 'Modale d’incantation (NI/DR/Maladresse), Focalisation, Bénédictions.',
  partyNote: 'Wilhelmina (Sorcier) + Frère Anselm (Prêtre)',
  makeParty: () => {
    const P = makePregens();
    return [P.find((p) => p.name.startsWith('Wilhelmina'))!, P.find((p) => p.name.startsWith('Frère Anselm'))!];
  },
  scene,
  autoCombat: 'enc-magie',
};
