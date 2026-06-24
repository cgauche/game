import { makeShowcaseParty } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

// Traits de créature (LDB 85) — vitrine des traits nouvellement câblés (Lot C) :
//  - Fantôme : Éthéré (seules les attaques magiques blessent), Instable (fin de Round à Avantage
//    inférieur → perd des PB), Peur 2, Infravision ;
//  - Démonette de Slaanesh : Démoniaque 8+ (sauvegarde 1d10, bannie à 0 PB), Champion (Dégâts en
//    défense gagnante), Perturbant (aura −20 à BE mètres), Corruption (Modérée → exposition du
//    groupe en fin de combat) ;
//  - Troll : Régénération (début de Round), Vomissement, Stupide (Test d'Int ou tour
//    perdu), Infecté (Test post-combat si on a été blessé), Coriace/Increvable ;
//  - Araignée géante : Toile (Empêtré sur touche), Bestial (Esquive seule, fuit sous ½ PB), Venin.
const scene = arena({ id: 'test-traits', nom: 'Traits de créature', w: 18, h: 12, heroStart: { x: 2, y: 6 } });
scene.startMessage =
  'Vitrine des Traits (LDB 85) : le Fantôme est Éthéré (frappez-le avec un sort !) et Instable ; la Démonette sauvegarde sur 8+ (Démoniaque), riposte en défense (Champion) et perturbe à 4 m (−20) ; le Troll régénère chaque Round et bave parfois (Stupide) ; l’Araignée emmaillote (Toile) et fuit sous la moitié de ses PB (Bestial).';
setEncounters(scene, [
  {
    id: 'enc-traits',
    enemies: [
      { ref: 'fantome', pos: { x: 12, y: 3 } },
      { ref: 'demonette-de-slaanesh', pos: { x: 14, y: 6 } },
      { ref: 'troll', pos: { x: 12, y: 9 } },
      { ref: 'araignee-geante', pos: { x: 9, y: 6 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'traits-creature',
  order: 15,
  icon: '🐲',
  title: 'Traits de créature',
  tests: 'Éthéré, Instable, Démoniaque (sauvegarde + bannissement), Champion, Perturbant, Régénération, Stupide, Infecté, Toile, Bestial, Venin, Corruption (exposition de fin de combat).',
  partyNote: '4 pré-tirés (dont un lanceur de sorts pour blesser l’Éthéré)',
  makeParty: makeShowcaseParty,
  scene,
  autoCombat: 'enc-traits',
};
