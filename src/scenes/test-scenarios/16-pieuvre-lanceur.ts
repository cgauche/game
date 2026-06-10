import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

// Créatures personnalisées (LDB 76/78/85) — vitrine des personnalisations d'auteur :
//  - Pieuvre des tourbières : « 8 Tentacules +9 » = arme d'Action Tentacules +9 ET 8 Attaques
//    gratuites PAR TOUR à coût d'Avantage 0, Empêtré sur Dégâts (LDB 85 l.354-355) + Constricteur ;
//  - Sorcier mutant (statbloc) : `spells: ['Fléchette']` → l'IA incante le Projectile magique ;
//  - Squelette + facultatif « Élite » (Trait standard, LDB 76 : ajouté à la liste Facultative de
//    toutes les créatures) + Caractéristiques aléatoires (LDB 78 : −10 + 2d10, tirage stable au spawn).
const scene = arena({ id: 'test-pieuvre-lanceur', nom: 'Créatures personnalisées', w: 18, h: 12, heroStart: { x: 2, y: 6 } });
scene.startMessage =
  'Personnalisations d’auteur : la Pieuvre frappe de ses 8 tentacules (gratuites, Empêtré sur Dégâts) ; le Sorcier mutant lance Fléchette ; le Squelette est un facultatif « Élite » (LDB 76) aux Caractéristiques aléatoires (LDB 78). Inspectez-les via l’ordre de bataille (chips de traits, M/Taille, badge 🪄).';
scene.encounters = [
  {
    id: 'enc-pieuvre',
    enemies: [
      { ref: 'Pieuvre des tourbières', pos: { x: 12, y: 6 } },
      {
        statblock: {
          name: 'Sorcier mutant',
          char: { M: 4, CC: 30, CT: 30, F: 30, E: 30, I: 40, Ag: 30, Dex: 30, Int: 40, FM: 45, Soc: 30 },
          traits: ['Arme (Dague) +4', 'Lanceur de Sorts (Sorcellerie)', 'Corruption (Mineure)'],
          spells: ['Fléchette'],
        },
        pos: { x: 14, y: 3 },
      },
      { ref: 'Squelette', pos: { x: 12, y: 9 }, optionals: ['Élite'], randomChars: true },
    ],
  },
];

export const scenario: TestScenario = {
  id: 'pieuvre-lanceur',
  order: 16,
  icon: '🐙',
  title: 'Créatures personnalisées',
  tests: '« 8 Tentacules +9 » (8 attaques gratuites à coût 0, Empêtré), ennemi lanceur de sorts (Fléchette via l’IA), trait facultatif (LDB 76 : Élite sur Squelette), Caractéristiques aléatoires (LDB 78), inspecteur enrichi (M/Taille, chips, badge 🪄).',
  partyNote: '4 pré-tirés',
  makeParty: () => makePregens().slice(0, 4),
  scene,
  autoCombat: 'enc-pieuvre',
};
