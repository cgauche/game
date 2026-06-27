import { pregen, pregenParty, PREGEN } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import { makeSorceress, makePriest } from './_casters';
import type { TestScenario } from './_shared';
import type { Combatant } from '../../engine/types';

const scene = arena({ id: 'test-etats-controle', nom: 'États & contrôle', w: 26, h: 20, heroStart: { x: 3, y: 10 } });
scene.startMessage =
  'États & contrôle : des infligeurs d’états (Araignée → Empêtré/Toile, Cockatrice → regard pétrifiant, ' +
  'Bête des marais, Griffon) + une Envoûteuse qui débuffe. Observez l’IA RÉAGIR aux états (se dégager ' +
  'd’Empêtré, se rouler hors d’En flammes, soins/purge si dispo) et en INFLIGER des deux côtés. ⚠ L’Envoûteuse ' +
  'cause Peur 2 + Terreur 2 à l’ouverture (Cockatrice = Redoutable, pas Peur).';
// Infligeurs d'états variés + 1 débuffeur caster. Réfs par ID stable (findCreatureById). Bêtes Grandes/
// Énorme : empreinte multi-cases, l'arène 26×20 leur laisse la place de manœuvrer.
setEncounters(scene, [
  {
    id: 'enc-etats',
    enemies: [
      { ref: 'araignee-geante', pos: { x: 17, y: 8 } }, // Toile → Empêtré sur touche
      { ref: 'cockatrice', pos: { x: 19, y: 6 } }, // regard pétrifiant + Redoutable
      { ref: 'bete-des-marais', pos: { x: 19, y: 13 } }, // brute Régénération/Stupide/Instable
      { ref: 'griffon', pos: { x: 21, y: 10 } }, // Énorme → Piétinement
      { ref: 'envouteuse', pos: { x: 23, y: 11 } }, // 12 sorts → débuffs
    ],
  },
]);

/**
 * « États & contrôle » : deux casters (Maelis la Sorcière — sorts à états ; Sœur Greta de Shallya — soins
 * et purge) + deux bagarreurs (Sigmund le guerrier, Grunni le nain Tueur) qui encaissent les états et
 * doivent s'en dégager. But : voir l'IA face aux états (recover Empêtré / En flammes, removeCondition si
 * un Miracle le permet) et en infliger des deux côtés.
 */
function makeParty(): Combatant[] {
  const ans = pregenParty(PREGEN.pretre)[0];
  const sorc = makeSorceress('h-sorc', 'Maelis, Sorcière', { x: 3, y: 9 });
  const shallya = makePriest(ans, 'h-shallya', 'Sœur Greta, Prêtresse de Shallya', 'Shallya', { Soc: 66, FM: 60, F: 40, E: 44 });
  shallya.pos = { x: 2, y: 11 };

  const sigmund = pregen(PREGEN.soldat); // guerrier de mêlée
  sigmund.pos = { x: 5, y: 9 };
  const grunni = pregen(PREGEN.tueur); // nain Tueur
  grunni.pos = { x: 5, y: 12 };

  return [sorc, shallya, sigmund, grunni];
}

export const scenario: TestScenario = {
  id: 'etats-controle',
  order: 28,
  icon: '🕸️',
  title: 'États & contrôle',
  tests: 'IA face aux États : se dégager d’Empêtré (Toile), se rouler hors d’En flammes, soins/purge (Miracle Shallya) ; et INFLIGER des états des deux côtés (Toile, regard pétrifiant, débuffs de l’Envoûteuse, sorts à états). Bêtes Grandes/Énorme (Piétinement).',
  partyNote: 'Sorcière + Prêtresse de Shallya + Guerrier + Tueur vs Araignée géante + Cockatrice + Bête des marais + Griffon + Envoûteuse',
  makeParty,
  scene,
  autoCombat: 'enc-etats',
};
