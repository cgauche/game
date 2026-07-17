import { pregen, PREGEN } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * ASPERSION (MDG 16 l.19, #497) : une Créature marine échouée sur la terre ferme suffoque (Trait
 * `creature-marine`, `offTerrainSuffocates`) tant que personne ne l'asperge d'eau (`battleWater`,
 * Action posant `wateredThisRound`, `engine/suffocation.ts`) — cette scène expose le cas que la
 * recette du #497 réclame : une créature marine HORS de l'eau, adjacente à un porteur d'outre.
 * Terrain 100 % terrestre (aucune tuile d'eau sous elle) : `spawn.ts` dérive `offTerrain: true` au
 * placement, sans intervention manuelle. Fixture aussi vivante pour la suffocation (#477) : sans
 * aspersion, l'anguille perd 1 Blessure par Round (`suffocationTick`) — le combat direct laisse le
 * temps d'observer les deux issues (aspergée = immunisée ce Round / non aspergée = suffoque).
 * L'anguille spawn à 2 cases du Soldat (formation de groupe solo décalée d'1 case du `heroStart`) :
 * une case de mouvement suffit pour l'adjacence requise par `battleWater`.
 */
function porteurDOutre() {
  const h = pregen(PREGEN.soldat);
  const outre = itemFromTrappingById('outre-a-eau')!;
  h.items = [...(h.items ?? []), outre];
  return h;
}

const scene = arena({ id: 'test-aspersion', nom: 'Aspersion — créature marine hors de l’eau', heroStart: { x: 2, y: 4 } });
scene.startMessage =
  "Une anguille mâcheprise s'est échouée sur la berge, loin de l'eau : hors de son terrain, elle " +
  "suffoque (Trait Créature marine, MDG 16 l.19). Le Soldat porte une outre à eau — l'Action « " +
  "Asperger d'eau » l'immunise pour le Round où elle est posée ; sans elle, l'anguille perd 1 " +
  "Blessure par Round.";
setEncounters(scene, [
  { id: 'enc-aspersion', enemies: [{ ref: 'anguille-macheprise', pos: { x: 3, y: 4 } }] },
]);

export const scenario: TestScenario = {
  id: 'aspersion',
  order: 19,
  category: 'creatures',
  icon: 'scenario/bestiary',
  title: 'Aspersion — créature marine hors de l’eau (#497)',
  tests:
    "Action « Asperger d'eau » (MDG 16 l.19, #497) : une Créature marine (anguille mâcheprise) échouée " +
    "sur la terre (`offTerrain`, aucune tuile d'eau sous elle) suffoque Round après Round " +
    "(`suffocationTick`, #477) sauf si un porteur d'outre à eau (`hasWaterContainer`) l'asperge à " +
    "portée adjacente (`battleWater` pose `wateredThisRound`, aucun jet, consomme l'Action).",
  partyNote: 'Soldat solo, outre à eau en poche.',
  makeParty: () => [porteurDOutre()],
  scene,
  autoCombat: 'enc-aspersion',
};
