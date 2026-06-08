import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/**
 * Arène (#3) — banc d'essai : vagues croissantes + maître d'arène (= marchand) entre les vagues.
 * 100 % DONNÉES, aucune mécanique dédiée : les vagues sont des `encounters` (butin + flag dans
 * `onVictory`), et le maître est une entité `dialogueId` + `merchant` dont les choix (gated par flags
 * composés `arene_vN`) lancent `startCombat` / `openMerchant`. Blessures persistantes (attrition) ;
 * Guérison 1/rencontre re-dispo à chaque vague + achats au maître pour récupérer.
 */
const scene = arena({ id: 'test-arene', nom: 'Arène — vagues & maître d’arène', w: 16, h: 11, heroStart: { x: 2, y: 5 } });
scene.startMessage = 'L’arène ! Parlez au maître d’arène pour vous équiper, puis affrontez les vagues. Survivez aux trois.';

// Maître d'arène : on lui parle (dialogue) ; il est AUSSI marchand (armurier) → choix « Marchander ».
scene.entities.push({ id: 'maitre', kind: 'personnage', label: 'Maître d’arène', pos: { x: 8, y: 1 }, dialogueId: 'dlg-arene', merchant: { archetype: 'armurier' } });

// Vagues croissantes = des encounters (ennemis du bestiaire). Le butin + le flag de progression sont
// posés dans `onVictory` (purement data — pas de système d'arène spécial).
scene.encounters = [
  {
    id: 'wave-1',
    enemies: [
      { ref: 'Rat géant', pos: { x: 12, y: 4 } },
      { ref: 'Rat géant', pos: { x: 13, y: 6 } },
      { ref: 'Gobelin', pos: { x: 12, y: 8 } },
    ],
    onVictory: [
      { type: 'giveMoney', gold: 5 },
      { type: 'giveXp', amount: 20 },
      { type: 'setFlag', flag: 'arene_v1' },
      { type: 'journal', text: 'Vague 1 vaincue ! Voyez le maître d’arène.' },
    ],
  },
  {
    id: 'wave-2',
    enemies: [
      { ref: 'Loup', pos: { x: 12, y: 4 } },
      { ref: 'Loup', pos: { x: 13, y: 6 } },
      { ref: 'Orc', pos: { x: 12, y: 8 } },
    ],
    onVictory: [
      { type: 'giveMoney', gold: 12 },
      { type: 'giveXp', amount: 40 },
      { type: 'setFlag', flag: 'arene_v2' },
      { type: 'journal', text: 'Vague 2 vaincue ! Le maître d’arène vous attend.' },
    ],
  },
  {
    id: 'wave-3',
    enemies: [
      { ref: 'Ogre', pos: { x: 12, y: 5 } },
      { ref: 'Gobelin', pos: { x: 13, y: 3 } },
      { ref: 'Gobelin', pos: { x: 13, y: 7 } },
    ],
    onVictory: [
      { type: 'giveMoney', gold: 25 },
      { type: 'giveXp', amount: 80 },
      { type: 'setFlag', flag: 'arene_v3' },
      { type: 'journal', text: 'ARÈNE VAINCUE ! Les trois vagues sont tombées. Gloire à vous !' },
    ],
  },
];

// Dialogue du maître : choix gated par flags COMPOSÉS (« arene_v1,!arene_v2 » = ET). La séquence des
// vagues est entièrement portée par les conditions — pas de compteur en dur.
scene.dialogues = [
  {
    id: 'dlg-arene',
    start: 'accueil',
    nodes: [
      {
        id: 'accueil',
        speaker: 'Maître d’arène',
        text: 'Alors, prêt à verser le sang pour la foule ? Équipe-toi, soigne-toi, puis choisis ta vague.',
        choices: [
          { text: 'Marchander / réparer / acheter des soins.', effects: [{ type: 'openMerchant', entityId: 'maitre' }] },
          { text: 'Lancer la vague 1.', condition: '!arene_v1', effects: [{ type: 'startCombat', encounter: 'wave-1' }] },
          { text: 'Lancer la vague 2.', condition: 'arene_v1,!arene_v2', effects: [{ type: 'startCombat', encounter: 'wave-2' }] },
          { text: 'Lancer la vague 3 (finale).', condition: 'arene_v2,!arene_v3', effects: [{ type: 'startCombat', encounter: 'wave-3' }] },
          { text: 'Savourer ta victoire.', condition: 'arene_v3', effects: [{ type: 'journal', text: 'Le maître d’arène s’incline : « Champion de l’arène ! »' }, { type: 'endDialogue' }] },
          { text: 'Plus tard.', effects: [{ type: 'endDialogue' }] },
        ],
      },
    ],
  },
];

// Bourse de départ (nouvelle partie = 0 CO) — versée en s'avançant vers le maître.
scene.triggers = [
  { id: 'bourse', rect: { x: 3, y: 3, w: 5, h: 5 }, once: true, effects: [{ type: 'giveMoney', gold: 40 }, { type: 'journal', text: 'Le maître vous avance 40 couronnes pour vous équiper.' }] },
];

export const scenario: TestScenario = {
  id: 'arene',
  order: 12,
  icon: '🏟️',
  title: 'Arène',
  tests: 'Vagues croissantes (3) + maître d’arène = marchand entre vagues, 100 % données (encounters + dialogue gated par flags composés). Blessures persistantes.',
  partyNote: '4 pré-tirés vs 3 vagues',
  makeParty: () => makePregens().slice(0, 4),
  scene,
};
