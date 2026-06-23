import { makePregens } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

// Bataille navale (MDG ch.13-14) — vitrine de la chaîne navale COMPLÈTE, jouable :
//  - le NAVIRE ennemi (cogue, coque E45/B50, gréement Voile) est un Combattant à PV : on le bombarde
//    comme on frappe un ennemi ; un Coup Critique se résout sur les tables de NAVIRE (localisation par
//    gréement → Coque/Gréement/Avirons/Cargaison/Équipage) et pose des États NAVALS (Voie d'eau / En
//    flammes) qui le font couler ou brûler au fil des Rounds (endOfRound commun) ;
//  - l'ÉQUIPAGE exposé (pirates sur le pont) est LIÉ à la coque (`crewIds`) : un Critique « Équipage »
//    ou des Éclats reviennent à de VRAIS marins (Critique de personnage / 9 Dégâts).
const scene = arena({ id: 'test-bataille-navale', nom: 'Bataille navale', w: 18, h: 12, terrain: 'planches', heroStart: { x: 2, y: 6 } });
scene.startMessage =
  'Bataille navale (MDG) : la cogue pirate est une COQUE à PV — frappez-la ! Un Coup Critique se résout sur les tables de NAVIRE (Voie d’eau / En flammes selon la localisation par gréement). Les pirates sur le pont sont l’ÉQUIPAGE exposé : un critique « Équipage » ou les Éclats leur reviennent.';

setEncounters(scene, [
  {
    id: 'enc-naval',
    enemies: [
      // index 0 = la coque ; son équipage exposé = les pirates (index 1-3), ids déterministes `enemy-<enc>-<i>`.
      { ref: 'cogue', pos: { x: 13, y: 6 }, label: 'Cogue pirate',
        crewIds: ['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3'] },
      { ref: 'pirate-fluvial', pos: { x: 11, y: 4 } },
      { ref: 'pirate-fluvial', pos: { x: 11, y: 8 } },
      { ref: 'chef-pirate', pos: { x: 15, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'bataille-navale',
  order: 25,
  icon: '⛵',
  title: 'Bataille navale',
  tests: 'Navire-Combattant à PV ; Coup Critique → tables de NAVIRE (localisation par gréement, États Voie d’eau / En flammes, naufrage au fil des Rounds) ; équipage lié (crewIds) → un critique « Équipage » et les Éclats touchent de vrais marins.',
  partyNote: '4 pré-tirés contre une cogue pirate + son équipage',
  makeParty: () => makePregens().slice(0, 4),
  scene,
  autoCombat: 'enc-naval',
};
