import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { WorldMap } from '../../state/worldMap';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/**
 * #T2 Voyage & Nourriture : carte du monde (3 lieux), voyage à pied (6 h/jour, nuits de camp,
 * rations consommées, faim RAW si on en manque), marche forcée, diligence payante, péripéties
 * d'auteur (embuscade gobeline → interruption + « Reprendre le voyage ») et table d10 RAW.
 * L'auberge du village vend le gîte ET le couvert (effets `rest` + `mealParty`).
 */
function groupe(): Combatant[] {
  const erik = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Erik (test)', motivation: 'Test', rng: makeRNG(1501), id: 'erik' });
  erik.items = [...(erik.items ?? []), itemFromTrapping('Ration')!, itemFromTrapping('Ration')!, itemFromTrapping('Ration')!];
  erik.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.55 };
  // Greta voyage SANS provisions : sur un long trajet, la faim s'installe (LDB 18 l.417-422).
  const greta = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Greta (test)', motivation: 'Test', rng: makeRNG(1502), id: 'greta' });
  greta.appearance = { species: 'Humains (Reiklander)', sex: 'F', build: 0.45 };
  return [erik, greta];
}

// ── Scènes : village de départ (auberge), hameau, bourg, théâtre d'embuscade ──
const village = arena({ id: 'test-voyage-village', nom: 'Village de Weiler', w: 14, h: 9, heroStart: { x: 3, y: 4 } });
village.startMessage =
  'Ouvrez la carte (🗺️ en haut à gauche) pour voyager : le hameau (24 km à pied, route peu sûre) ou le bourg ' +
  '(30 km, diligence possible). L’aubergiste offre gîte et couvert (repas = faim remise à zéro).';
village.entities.push({ id: 'aubergiste', kind: 'personnage', label: 'Aubergiste', pos: { x: 8, y: 3 }, dialogueId: 'dlg-auberge' });
village.dialogues = [
  {
    id: 'dlg-auberge',
    start: 'accueil',
    nodes: [
      {
        id: 'accueil',
        speaker: 'Aubergiste',
        text: 'Une table, une chope, un lit ? Tout se paie, mais tout est bon.',
        choices: [
          // « Repas, auberge » + « Chambre, commune » (LDB p.302) — prix d'auteur groupés ; le
          // repas remet la faim à zéro (mealParty), la nuit applique le repos (rest).
          { text: 'Repas chaud et une nuit (10 sous).', cost: { brass: 10 }, effects: [{ type: 'mealParty' }, { type: 'rest', days: 1 }] },
          { text: 'Juste un repas (4 sous).', cost: { brass: 4 }, effects: [{ type: 'mealParty' }] },
          { text: 'Une autre fois. (Partir)' },
        ],
      },
    ],
  },
];

const hameau = arena({ id: 'test-voyage-hameau', nom: 'Hameau de Federholz', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
hameau.startMessage = 'Vous voilà à Federholz. (Reprenez la carte pour repartir.)';

const bourg = arena({ id: 'test-voyage-bourg', nom: 'Bourg de Steinbruck', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
bourg.startMessage = 'Steinbruck, ses quais et sa halle. (Reprenez la carte pour repartir.)';

const embuscade = arena({ id: 'test-voyage-embuscade', nom: 'Sous-bois — embuscade', w: 14, h: 9, terrain: 'herbe', heroStart: { x: 2, y: 4 } });
embuscade.encounters = [{
  id: 'enc-vembuscade',
  enemies: [
    { ref: 'Gobelin', pos: { x: 9, y: 3 } },
    { ref: 'Gobelin', pos: { x: 10, y: 5 } },
  ],
  surprise: 'party', // annulée si la Perception du voyage est réussie (« le groupe les voit venir »)
}];

// ── Carte du monde : Weiler ↔ Federholz (piste dangereuse) et Weiler ↔ Steinbruck (diligence) ──
const carte: WorldMap = {
  id: 'test-voyage-carte',
  nom: 'Marches de Weiler (test)',
  places: [
    { id: 'p-village', label: 'Weiler', pos: { x: 24, y: 62 }, scene: 'test-voyage-village', icon: '🏠' },
    { id: 'p-hameau', label: 'Federholz', pos: { x: 72, y: 30 }, scene: 'test-voyage-hameau', icon: '🌲' },
    { id: 'p-bourg', label: 'Steinbruck', pos: { x: 70, y: 78 }, scene: 'test-voyage-bourg', icon: '⚓' },
  ],
  routes: [
    {
      id: 'r-piste',
      a: 'p-village', b: 'p-hameau',
      km: 24, // 1 jour plein à M4 (6 h/jour RAW) — nuit de camp garantie au-delà
      modes: ['pied'],
      // Péripétie d'AUTEUR quasi certaine : les gobelins de la piste (interruption + reprise).
      perils: [{
        label: 'Des silhouettes vertes jaillissent des fourrés !',
        chancePct: 90,
        effects: [
          { type: 'transition', scene: 'test-voyage-embuscade' },
          { type: 'startCombat', encounter: 'enc-vembuscade' },
        ],
      }],
      ambush: { scene: 'test-voyage-embuscade', encounter: 'enc-vembuscade' }, // cible du « Attaqués ! » (d10)
    },
    {
      id: 'r-grandroute',
      a: 'p-village', b: 'p-bourg',
      km: 30,
      modes: ['pied', 'diligence'],
      perilDie: 0, // grand-route sûre : pas de tirage d10 (paramétrable par route)
    },
  ],
};

export const scenario: TestScenario = {
  id: 'voyage',
  order: 15,
  icon: '🧭',
  title: 'Voyage & Nourriture',
  tests: 'carte du monde, voyage à pied/diligence (temps, rations, marche forcée), faim RAW, péripéties + embuscade + reprise, repas d’auberge',
  partyNote: 'Erik (3 rations) & Greta (sans provisions)',
  makeParty: groupe,
  scene: village,
  extraScenes: [hameau, bourg, embuscade],
  worldMap: carte,
};
