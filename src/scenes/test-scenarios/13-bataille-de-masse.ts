import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * « Bataille de masse » (ADE II 08, Le théâtre de la guerre) : vitrine du sous-système de Puissance de
 * Bataille. Deux armées (Puissance 50 vs 55) s'affrontent sur 3 Rounds de bataille.
 *
 * Avant la bataille : jusqu'à 3 Activités pré-combat (Discours, Planification, Repérage, Sabotage…).
 * Chaque Round présente une SITUATION — un SOUS-ENSEMBLE de Scènes du moment (pas tout le catalogue),
 * dont des Scènes ENNEMIES qui s'imposent (Intrus = menace −20 aux autres Scènes ; enchaînements). Une
 * Scène par PJ : chacun résout SA Scène (Test OU combat tactique), les deltas se cumulent, puis le Test
 * spectaculaire de Puissance résout l'affrontement, et le Rassemblement soigne entre les Rounds.
 */
const scene = buildScene({
  id: 'test-bataille-de-masse',
  nom: 'Bataille de masse — le théâtre de la guerre',
  description: 'Champ de bataille : la plaine devant les remparts.',
  size: [22, 16],
  heroStart: [3, 8],
  startMessage:
    'Deux armées se font face. Menez la bataille via l\'écran de Puissance de Bataille : préparez-vous ' +
    '(Activités), puis Round après Round choisissez vos Scènes de la situation du moment (une par PJ), ' +
    'résolvez le Test spectaculaire de Puissance et rassemblez vos forces. Les Scènes « Pluie de flèches », ' +
    '« Charge », « Tuez la bête ! », « Duel » et « Intrus » vous jettent dans une vraie mêlée.',
  encounters: [
    { id: 'enc-charge', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 6 } },
      { ref: 'mutant', pos: { x: 13, y: 8 } },
      { ref: 'mutant', pos: { x: 12, y: 10 } },
      { ref: 'mutant', pos: { x: 14, y: 8 } },
    ] },
    { id: 'enc-pluie', enemies: [
      { ref: 'mutant', pos: { x: 15, y: 7 } },
      { ref: 'mutant', pos: { x: 16, y: 9 } },
      { ref: 'mutant', pos: { x: 17, y: 8 } },
    ] },
    { id: 'enc-bete', enemies: [
      { ref: 'troll', pos: { x: 14, y: 8 } },
    ] },
    { id: 'enc-duel', enemies: [
      { ref: 'mutant', pos: { x: 13, y: 8 } },
    ] },
    { id: 'enc-intrus', enemies: [
      { ref: 'mutant', pos: { x: 6, y: 7 } },
      { ref: 'mutant', pos: { x: 7, y: 9 } },
    ] },
    { id: 'enc-protection', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 7 } },
      { ref: 'mutant', pos: { x: 13, y: 9 } },
    ] },
    { id: 'enc-percee', enemies: [
      { ref: 'mutant', pos: { x: 12, y: 7 } },
      { ref: 'mutant', pos: { x: 13, y: 9 } },
      { ref: 'mutant', pos: { x: 14, y: 7 } },
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
    'Puissance de Bataille (ADE II 08) : Activités pré-combat, SITUATION par Round (sous-ensemble + menace ' +
    'Intrus qui s\'impose + enchaînements), une Scène par PJ (Test OU combat qui nourrit la Puissance en ' +
    'touches + kills), Rassemblement (Résistance), Test spectaculaire de Puissance (10 + DR, min 5), issue.',
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
    scenes: [
      'motivation', 'pluie-de-fleches', 'protection', 'tenez-votre-position', 'compte-a-rebours',
      'percee', 'ligne-de-mire', 'tuez-la-bete', 'survol', 'charge', 'duel', 'intrus',
    ],
    situations: [
      ['pluie-de-fleches', 'tenez-votre-position', 'motivation'],
      ['percee', 'compte-a-rebours', 'intrus'],
      ['duel', 'tuez-la-bete', 'survol'],
    ],
    sceneEncounters: {
      'pluie-de-fleches': 'enc-pluie',
      charge: 'enc-charge',
      'tuez-la-bete': 'enc-bete',
      duel: 'enc-duel',
      intrus: 'enc-intrus',
      protection: 'enc-protection',
      percee: 'enc-percee',
    },
  },
};
