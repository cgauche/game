import { createHero, skillCharacteristicById } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrappingById } from '../../engine/items';
import type { Combatant, SkillInstance } from '../../engine/types';
import { buildScene } from '../../state/mapSpec';
import type { WorldMap } from '../../state/worldMap';
import type { TestScenario } from './_shared';

/**
 * « Voyage maritime » — la traversée en mer JOUABLE (MDG ch.13/15), pendant naval du « Voyage & temps long »
 * TERRESTRE. Une route MARITIME (`MapRoute.sea`, distance en MILLES) relie deux ports ; le groupe appareille
 * sur le NAVIRE DE CAMPAGNE (`state.vessel` = une cogue), et chaque jour de mer enchaîne : météo/vent →
 * Test d'équipage de Progression → phare à l'atterrage → Test d'équipage d'Orientation → entretien de la
 * coque (elle démarre endommagée) → halte de nuit, jusqu'à l'ACCOSTAGE au port d'arrivée (écran Port :
 * réparer/caréner/commerce). L'équipage = les PJ (MDG 14 l.39), chacun tenant son RÔLE.
 */

/** Ajoute/renforce une Compétence sur un héros, à la Caractéristique CANONIQUE de la Compétence (donnée). */
function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const characteristic = skillCharacteristicById(skillId);
  const ex = c.skills.find((s) => s.skillId === skillId && s.spec === spec);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ skillId, spec, characteristic, advances } as SkillInstance);
}

/** Quatre marins couvrant les RÔLES d'équipage essentiels des Tests de voyage (MDG ch.14) : Capitaine
 *  (Progression), Timonier/Mousse (Manœuvre/Affaler/Entretien), Navigateur (Orientation), Vigie
 *  (Perception au phare). `shipRole` ÉPINGLE le rôle de chacun pour un défaut d'équipage lisible. */
function crew(): Combatant[] {
  const cap = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Capitaine Brenner', motivation: 'Test', rng: makeRNG(4801), id: 'mar-cap' });
  cap.shipRole = 'capitaine';
  skill(cap, 'commandement', 50);
  skill(cap, 'voile', 40);
  cap.items = [...(cap.items ?? []), itemFromTrappingById('ration')!, itemFromTrappingById('ration')!];
  cap.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.55 };

  const timo = createHero({ speciesId: 'humains-reiklander', careerId: 'chasseur', name: 'Timonière Hilda', motivation: 'Test', rng: makeRNG(4802), id: 'mar-timo' });
  timo.shipRole = 'timonier';
  skill(timo, 'voile', 55);
  skill(timo, 'ramer', 45);
  skill(timo, 'metier', 40, 'Charpentier'); // entretien de la coque au soir
  timo.appearance = { species: 'Humains (Reiklander)', sex: 'F', build: 0.42 };

  const navi = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', name: 'Navigateur Ansmann', motivation: 'Test', rng: makeRNG(4803), id: 'mar-navi' });
  navi.shipRole = 'navigateur';
  skill(navi, 'orientation', 55);
  skill(navi, 'savoir', 40, 'oceans'); // bonus d'Orientation au phare (MDG ch.13 l.335)
  navi.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.48 };

  const vigie = createHero({ speciesId: 'humains-reiklander', careerId: 'eclaireur', name: 'Vigie Perla', motivation: 'Test', rng: makeRNG(4804), id: 'mar-vigie' });
  vigie.shipRole = 'vigie';
  skill(vigie, 'perception', 55);
  skill(vigie, 'voile', 35);
  vigie.appearance = { species: 'Humains (Reiklander)', sex: 'F', build: 0.4 };

  return [cap, timo, navi, vigie];
}

// ── Deux ports : Salzenmund (départ) et Marienburg (arrivée, phare + grand port de commerce) ──
const departPort = buildScene({
  id: 'test-mer-depart',
  nom: 'Salzenmund — les quais',
  description: 'Arène de test.',
  size: [14, 9],
  terrain: 'planches',
  heroStart: [3, 4],
  weather: 'brouillard',
  startMessage:
    'Salzenmund, port de départ. Ouvrez la carte du monde et prenez la route MARITIME de Marienburg (480 milles) ' +
    'en mode « Mer » : votre cogue appareille (state.vessel). Chaque jour de mer = météo/vent, Test d’équipage de ' +
    'Progression puis d’Orientation, entretien de la coque le soir (elle part endommagée), et une halte de nuit. ' +
    'À l’approche de Marienburg, la vigie guette le phare. À l’accostage, l’écran Port ouvre réparation et commerce.',
});

const arrivePort = buildScene({
  id: 'test-mer-arrivee',
  nom: 'Marienburg — le Grand Port',
  description: 'Arène de test.',
  size: [14, 9],
  terrain: 'planches',
  heroStart: [3, 4],
  startMessage:
    'Marienburg, au bout de la traversée. Ouvrez l’écran Port : réparez la coque (1 CO/Blessure), carénez les ' +
    'Salissures, achetez/vendez de la cargaison (grand port cosmopolite). (Reprenez la carte pour repartir.)',
});

// ── Carte du monde : une seule route, MARITIME (milles), avec phare à l'arrivée ──
const carte: WorldMap = {
  id: 'test-mer-carte',
  nom: 'Mer des Griffes (test)',
  places: [
    {
      id: 'p-salzenmund', label: 'Salzenmund', pos: { x: 20, y: 30 }, scene: 'test-mer-depart', icon: 'scenario/port',
      // port de production côtière (sel/poisson) — permet aussi réparer/caréner au départ
      port: { taille: 3, richesse: 3, production: ['sel', 'poisson-sale'], surplus: { sel: 1 } },
    },
    {
      id: 'p-marienburg', label: 'Marienburg', pos: { x: 75, y: 55 }, scene: 'test-mer-arrivee', icon: 'scenario/port',
      // grand port cosmopolite (MDG 15 l.343) + phare à l'atterrage (MDG 13 l.337)
      port: { taille: 4, richesse: 5, production: ['commerce', 'produits-de-luxe'], surplus: { 'produits-de-luxe': 1 }, cosmopolite: true, lighthouse: true },
    },
  ],
  routes: [
    {
      id: 'route-marienburg',
      a: 'p-salzenmund', b: 'p-marienburg',
      km: 480, // MILLES (route sea) : plusieurs jours de mer à M5 (18×5 = 90 milles/jour, ± vent)
      modes: ['mer'],
      sea: true,
      seaHeading: 'ouest',
    },
  ],
};

export const scenario: TestScenario = {
  id: 'voyage-maritime',
  order: 12,
  category: 'naval',
  icon: 'scenario/port',
  title: 'Voyage maritime',
  tests:
    'Traversée en mer JOUABLE (MDG ch.13/15) : route MARITIME (milles) entre 2 ports, appareillage sur le navire ' +
    'de campagne (cogue), journée = météo/vent + Tests d’équipage de Progression & d’Orientation (modales), phare ' +
    'à l’atterrage (Perception), entretien de coque le soir (part endommagée), haltes de nuit, puis ACCOSTAGE au ' +
    'Grand Port (écran Port : réparer/caréner/commerce). Équipage = les PJ, chacun à son rôle (Capitaine/Timonier/' +
    'Navigateur/Vigie).',
  partyNote: 'Équipage : Capitaine Brenner (Commandement) · Timonière Hilda (Voile/Charpentier) · Navigateur Ansmann (Orientation) · Vigie Perla (Perception)',
  makeParty: crew,
  scene: departPort,
  extraScenes: [arrivePort],
  worldMap: carte,
  money: { gold: 40, silver: 0, brass: 0 }, // de quoi réparer la coque au port
  // Cogue de campagne : coque ENDOMMAGÉE (déclenche l'entretien du soir), tonneaux d'eau suivis, Moral neuf.
  vessel: {
    vehicleId: 'cogue',
    morale: { score: 75, lastMoraleWeek: 0, factors: [] },
    wounds: { current: 15, max: 50 }, // coque mal en point : entretien chaque nuit, encore à réparer à l'arrivée
    waterLitres: 600,
  },
};
