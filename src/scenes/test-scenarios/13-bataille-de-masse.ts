import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * « Bataille de masse » (ADE II 08, Le théâtre de la guerre) : vitrine du sous-système de Puissance de
 * Bataille. Deux armées (Puissance 50 vs 55) s'affrontent sur 3 Rounds de bataille. Avant la bataille,
 * un Personnage peut prononcer un Discours inspirant (Test de Commandement). Chaque Round : les PJ
 * choisissent une Scène cinématique — Test de Compétence (Motivation, Ligne de mire, Duel) OU combat
 * tactique (Charge, Tuez la bête) qui réutilise le combat existant — puis un Test spectaculaire de
 * Puissance résout l'affrontement. Les Scènes de combat pointent des rencontres de CETTE scène.
 */
const scene = buildScene({
  id: 'test-bataille-de-masse',
  nom: 'Bataille de masse — le théâtre de la guerre',
  description: 'Champ de bataille : la plaine devant les remparts.',
  size: [22, 16],
  heroStart: [3, 8],
  startMessage:
    'Deux armées se font face. Menez la bataille via l\'écran de Puissance de Bataille : galvanisez les ' +
    'troupes, choisissez vos Scènes cinématiques Round après Round, puis résolvez le Test spectaculaire ' +
    'de Puissance. Les Scènes « Charge » et « Tuez la bête ! » vous jettent dans une vraie mêlée.',
  encounters: [
    { id: 'enc-charge', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 6 } },
      { ref: 'mutant', pos: { x: 13, y: 8 } },
      { ref: 'mutant', pos: { x: 12, y: 10 } },
      { ref: 'mutant', pos: { x: 14, y: 8 } },
    ] },
    { id: 'enc-bete', enemies: [
      { ref: 'troll', pos: { x: 14, y: 8 } },
    ] },
  ],
});

export const scenario: TestScenario = {
  id: 'bataille-de-masse',
  order: 40,
  category: 'scenarios',
  icon: 'action/attack',
  title: 'Bataille de masse',
  tests:
    'Puissance de Bataille (ADE II 08) : estimation des deux armées, Discours inspirant (Commandement -> +10 ' +
    'au 1er Round), Scènes cinématiques (Test de Compétence OU combat tactique qui nourrit la Puissance), ' +
    'aléa de bataille (1d10), Test spectaculaire de Puissance (10 + DR, min 5), issue à la plus haute Puissance.',
  partyNote: '4 pré-tirés (soldat, chasseur, sorcier, tueur)',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
  scene,
  massBattle: {
    allyName: 'Armée des Personnages',
    enemyName: 'Horde ennemie',
    allyMight: 50,
    enemyMight: 55,
    plannedRounds: 3,
    terrain: 'La plaine boueuse s\'étend devant les remparts ; la horde dévale la pente en hurlant.',
    scenes: ['motivation', 'ligne-de-mire', 'charge', 'tuez-la-bete', 'duel'],
    sceneEncounters: { charge: 'enc-charge', 'tuez-la-bete': 'enc-bete' },
  },
};
