import { flowFromEffects } from '../../state/flow';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { contractDisease } from '../../engine/disease';
import { itemFromTrapping } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { WorldMap } from '../../state/worldMap';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * #T2 Voyage & Nourriture : carte du monde (3 lieux), voyage à pied (6 h/jour, HALTES de nuit —
 * modale de Repos, campement ou relais d'auberge sur la grand-route), rations consommées, faim
 * RAW si on en manque, marche forcée, diligence payante, péripéties d'auteur (embuscade gobeline
 * → interruption + « Reprendre le voyage ») et table d10 RAW. L'auberge du village ouvre la
 * modale de Repos (chambres/repas PAR HÉROS, prix RAW) ; le bouton 🌙 dort sur place.
 */
function groupe(): Combatant[] {
  const erik = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Erik (test)', motivation: 'Test', rng: makeRNG(1501), id: 'erik' });
  erik.items = [...(erik.items ?? []), itemFromTrapping('Ration')!, itemFromTrapping('Ration')!, itemFromTrapping('Ration')!];
  erik.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.55 };
  // Greta voyage SANS provisions : sur un long trajet, la faim s'installe (LDB 18 l.417-422).
  const greta = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Greta (test)', motivation: 'Test', rng: makeRNG(1502), id: 'greta' });
  greta.appearance = { species: 'Humains (Reiklander)', sex: 'F', build: 0.45 };
  // Le groupe part DANS UN SALE ÉTAT pour que le bilan de nuit montre TOUS ses jets :
  //  - BLESSÉS → jet de Récupération (Résistance +20 → DR+BE PB, +BE/jour) chaque nuit ;
  //  - Erik fait des CAUCHEMARS (LDB 21 l.92) → Test de Calme chaque nuit, Exténué sur échec ;
  //  - Greta couve la VÉROLE URTICANTE (active, contagieuse — LDB 20) → progression quotidienne
  //    ET Test de Contagion d'Erik à chaque nuit de promiscuité ;
  //  - la PLUIE sur les scènes de départ → Exposition (2 Tests/nuit) en dormant dehors sans tente.
  erik.wounds.current = Math.max(1, erik.wounds.max - 8);
  greta.wounds.current = Math.max(1, greta.wounds.max - 6);
  erik.nightmares = true;
  greta.diseases = [contractDisease('Vérole Urticante', makeRNG(1503), { incubation: 0, duration: 5 })!];
  return [erik, greta];
}

// ── Scènes : village de départ (auberge), hameau, bourg, théâtre d'embuscade ──
const village = arena({ id: 'test-voyage-village', nom: 'Village de Weiler', w: 14, h: 9, heroStart: { x: 3, y: 4 } });
village.weather = 'pluie'; // nuit dehors = Exposition (la météo de la scène de départ suit le voyage)
village.startMessage =
  'Ouvrez la carte (🗺️) pour voyager : le hameau (24 km, route peu sûre), le bourg (30 km, diligence, relais) — ' +
  'et depuis le hameau, la LONGUE route d’Eichenfeld (96 km, 3 nuits). Le groupe part blessé : chaque nuit, ' +
  'le bilan montre la récupération. L’aubergiste ou le bouton 🌙 ouvrent la nuit.';
// L'offre de repos du village : l'auberge (la modale propose aussi la belle étoile).
village.rest = { auberge: true };
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
          // Nuit = MODALE DE REPOS (chambres/repas PAR HÉROS, prix RAW dans la modale).
          { text: '🛏️ Prendre des chambres pour la nuit.', flow: flowFromEffects([{ type: 'rest', lodging: 'auberge' }]) },
          // Repas de midi sans dormir (prix d'auteur) : remet la faim à zéro.
          { text: '🍲 Juste un repas (4 sous).', cost: { brass: 4 }, flow: flowFromEffects([{ type: 'mealParty' }]) },
          { text: 'Une autre fois. (Partir)' },
        ],
      },
    ],
  },
];

const hameau = arena({ id: 'test-voyage-hameau', nom: 'Hameau de Federholz', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
hameau.weather = 'pluie'; // la longue route part d'ici : camper sous la pluie expose
hameau.startMessage = 'Vous voilà à Federholz. (Reprenez la carte pour repartir — la LONGUE route d’Eichenfeld part d’ici.)';

const bourg = arena({ id: 'test-voyage-bourg', nom: 'Bourg de Steinbruck', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
bourg.startMessage = 'Steinbruck, ses quais et sa halle. (Reprenez la carte pour repartir.)';

const cite = arena({ id: 'test-voyage-cite', nom: 'Eichenfeld, la cité aux chênes', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
cite.startMessage = 'Eichenfeld, au bout de la longue route. (Reprenez la carte pour repartir.)';

const embuscade = arena({ id: 'test-voyage-embuscade', nom: 'Sous-bois — embuscade', w: 14, h: 9, terrain: 'herbe', heroStart: { x: 2, y: 4 } });
setEncounters(embuscade, [{
  id: 'enc-vembuscade',
  hidden: true, // embuscade de route : invisibles jusqu'au combat
  enemies: [
    { ref: 'gobelin', pos: { x: 9, y: 3 } },
    { ref: 'gobelin', pos: { x: 10, y: 5 } },
  ],
  surprise: 'party', // annulée si la Perception du voyage est réussie (« le groupe les voit venir »)
}]);

// ── Carte du monde : Weiler ↔ Federholz (piste dangereuse) et Weiler ↔ Steinbruck (diligence) ──
const carte: WorldMap = {
  id: 'test-voyage-carte',
  nom: 'Marches de Weiler (test)',
  places: [
    { id: 'p-village', label: 'Weiler', pos: { x: 24, y: 62 }, scene: 'test-voyage-village', icon: '🏠' },
    { id: 'p-hameau', label: 'Federholz', pos: { x: 72, y: 30 }, scene: 'test-voyage-hameau', icon: '🌲' },
    { id: 'p-bourg', label: 'Steinbruck', pos: { x: 70, y: 78 }, scene: 'test-voyage-bourg', icon: '⚓' },
    { id: 'p-cite', label: 'Eichenfeld', pos: { x: 90, y: 20 }, scene: 'test-voyage-cite', icon: '🏰' },
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
      inns: true, // relais de diligence : la halte de nuit propose l'auberge (modale de Repos)
    },
    {
      // LONG voyage (96 km à M4 = 4 jours / 3 nuits à pied) : récupération nocturne des blessés,
      // rations qui fondent, faim de Greta — relais d'auberges en chemin (ou belle étoile, au choix).
      id: 'r-longue',
      a: 'p-hameau', b: 'p-cite',
      km: 96,
      modes: ['pied', 'diligence'],
      inns: true,
      // « Attaqués ! » (table d10) a besoin d'une rencontre configurée — sinon l'alerte reste sans suite.
      ambush: { scene: 'test-voyage-embuscade', encounter: 'enc-vembuscade' },
    },
  ],
};

export const scenario: TestScenario = {
  id: 'voyage',
  order: 15,
  icon: '🧭',
  title: 'Voyage & Nourriture',
  tests: 'carte du monde, voyage à pied/diligence (temps, rations, marche forcée), HALTES de nuit (modale de Repos — camp sur la piste, relais sur les routes), LONG voyage 96 km = 3 nuits, bilan de nuit COMPLET : récupération des blessés, cauchemars d’Erik, Vérole Urticante de Greta (progression + contagion), Exposition sous la pluie, faim RAW ; péripéties + embuscade + reprise, auberge/🌙 au village',
  partyNote: 'Erik (3 rations, cauchemars) & Greta (sans provisions, Vérole) — blessés sous la pluie',
  makeParty: groupe,
  scene: village,
  extraScenes: [hameau, bourg, cite, embuscade],
  worldMap: carte,
  // De quoi payer la diligence (intérieur : 2 sc/km × 30 km × 2 passagers = 10 pa), l'auberge
  // (chambre 10 pa pour 2 + repas 1 pa/tête) et plusieurs repas en chemin.
  money: { gold: 2, silver: 10, brass: 0 },
};
