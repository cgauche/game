import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

// Combat monté (LDB 14 l.212-225). On place :
//  - une CAVALERIE ennemie : un Mutant (index 1) pré-monté sur un Cheval (index 0, Grande, M7) → `rides: 0` ;
//  - une MONTURE LIBRE ALLIÉE (index 2, `side:'ally'`) près du groupe → un héros peut l'enfourcher (bouton
//    « Monter », sous « Mouvement ») et profiter du +20 cavalerie / du Mouvement 7 ;
//  - un Gobelin à pied (index 3) comme cible plus petite que les montures (déclenche le +20).
const scene = arena({ id: 'test-monture', nom: 'Combat monté', w: 18, h: 11, heroStart: { x: 2, y: 5 } });
scene.startMessage =
  'Cavalerie : un Mutant chevauche un Cheval (Grande). Approchez la monture libre alliée (case ~6,7) et cliquez « Monter » pour chevaucher, puis chargez — le cavalier frappe à +20 toute cible plus petite que sa monture.';
scene.encounters = [
  {
    id: 'enc-monture',
    enemies: [
      { ref: 'Cheval', pos: { x: 13, y: 4 }, mount: true }, // #0 — destrier ennemi
      { ref: 'Mutant', pos: { x: 13, y: 4 }, rides: 0 }, //     #1 — cavalier (monté sur #0)
      { ref: 'Cheval', pos: { x: 6, y: 7 }, mount: true, side: 'ally' }, // #2 — monture libre, côté groupe
      { ref: 'Gobelin', pos: { x: 12, y: 7 } }, //             #3 — fantassin (cible plus petite)
    ],
  },
];

export const scenario: TestScenario = {
  id: 'monture',
  order: 12,
  icon: '🐎',
  title: 'Combat monté',
  tests: 'Cavalerie pré-montée (rendu en selle), monter une monture libre alliée, +20 vs cible plus petite que la monture, Mouvement de la monture, mort de la monture → cavalier démonté.',
  partyNote: 'Sigmund + Grunni (mêlée) vs un Mutant à cheval + un Gobelin',
  makeParty: () => {
    const P = makePregens();
    return [P.find((p) => p.name.startsWith('Sigmund'))!, P.find((p) => p.name.startsWith('Grunni'))!];
  },
  scene,
  autoCombat: 'enc-monture',
};
