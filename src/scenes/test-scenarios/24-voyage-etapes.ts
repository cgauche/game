import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrappingById } from '../../engine/items';
import { Combatant, SkillInstance } from '../../engine/types';
import { WorldMap } from '../../state/worldMap';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/**
 * #T2 Voyage par ÉTAPES (EDOC ch.5, règle optionnelle `travel-etapes`) — couche détaillée par-dessus
 * le voyage jour-par-jour du LDB. Ce scénario vérifie, sur un trajet en plusieurs Étapes :
 *  - les POSTES d'Activité PERSISTANTS (chaque héros tient son `travelRole`, 0 ré-assignation/jour) :
 *    Plein air (porte d'Exposition), Rester aux aguets (pas de surprise), Établir des cartes (Test
 *    étendu cumulé), Approvisionnement (fourrage) ;
 *  - les RENCONTRES EDOC déclenchées par la QUALITÉ des Tests (positive/fortuite/dangereuse) ;
 *  - le VÉHICULE à coque (diligence) bâti depuis `vehicles.json` (entité à PV, incidents).
 *
 * TOUT est paramétrable dans l'éditeur : la règle dans le panneau Règles maison (pré-activée via
 * `rules`), les routes/lieux/véhicules dans l'onglet « Monde », la météo sur la scène, et le poste de
 * chaque héros (`travelRole`) sur sa fiche. Aucune logique de voyage codée en dur dans la scène.
 */
const skill = (c: Combatant, skillId: string, advances: number, spec?: string, characteristic: SkillInstance['characteristic'] = 'Int') => {
  const ex = c.skills.find((s) => s.skillId === skillId && s.spec === spec);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ skillId, spec, characteristic, advances } as SkillInstance);
};

function groupe(): Combatant[] {
  // Chasseur — Plein air (Survie en extérieur) : sa réussite dispense le groupe d'Exposition.
  const bjorn = createHero({ speciesId: 'humains-reiklander', careerId: 'chasseur', name: 'Bjorn (test)', motivation: 'Test', rng: makeRNG(2401), id: 'bjorn' });
  bjorn.travelRole = 'plein-air';
  skill(bjorn, 'survie-en-exterieur', 60);
  bjorn.items = [...(bjorn.items ?? []), itemFromTrappingById('ration')!, itemFromTrappingById('ration')!];

  // Éclaireuse — Rester aux aguets (Perception) : le groupe ne peut être surpris cette Étape.
  const mira = createHero({ speciesId: 'humains-reiklander', careerId: 'eclaireur', name: 'Mira (test)', motivation: 'Test', rng: makeRNG(2402), id: 'mira' });
  mira.travelRole = 'rester-aux-aguets';
  skill(mira, 'perception', 50);

  // Érudit — Établir des cartes (Métier Cartographe) : Test étendu cumulé sur les Étapes.
  const aldric = createHero({ speciesId: 'humains-reiklander', careerId: 'erudit', name: 'Aldric (test)', motivation: 'Test', rng: makeRNG(2403), id: 'aldric' });
  aldric.travelRole = 'etablir-cartes';
  skill(aldric, 'metier', 70, 'Cartographe', 'Dex');

  // Maraudeur — Approvisionnement (Survie) volontairement FAIBLE : ses échecs déclenchent des
  // Rencontres dangereuses, et le manque de fourrage met le ravitaillement sous tension.
  const gerda = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'Gerda (test)', motivation: 'Test', rng: makeRNG(2404), id: 'gerda' });
  gerda.travelRole = 'approvisionnement';
  skill(gerda, 'survie-en-exterieur', 0, undefined, 'Int');

  return [bjorn, mira, aldric, gerda];
}

// ── Scènes : un relais de départ et une cité d'arrivée (la route porte le voyage) ──
const relais = arena({ id: 'test-etapes-relais', nom: 'Relais de Kaltbach', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
relais.weather = 'neige'; // intempéries : la porte « Plein air » devient visible (Exposition sinon)
relais.rest = { auberge: true };
relais.startMessage =
  'Voyage par Étapes (EDOC). Ouvrez la carte (🗺️) : la longue route de Drakenmoor (120 km) — chacun tient ' +
  'son POSTE (Bjorn au plein air, Mira aux aguets, Aldric cartographie, Gerda fourrage). En diligence, la ' +
  'coque encaisse les incidents. Le panneau Règles maison permet de couper le mode Étapes (« travel-etapes »).';

const cite = arena({ id: 'test-etapes-cite', nom: 'Drakenmoor', w: 12, h: 8, heroStart: { x: 3, y: 4 } });
cite.startMessage = 'Drakenmoor, au bout de la longue route. (Reprenez la carte pour repartir.)';

// ── Carte : route LONGUE (multi-Étapes, à pied OU en diligence à coque) ──
const carte: WorldMap = {
  id: 'test-etapes-carte',
  nom: 'Route de Drakenmoor (test Étapes)',
  places: [
    { id: 'p-relais', label: 'Kaltbach', pos: { x: 22, y: 60 }, scene: 'test-etapes-relais', icon: '🏚️' },
    { id: 'p-cite', label: 'Drakenmoor', pos: { x: 80, y: 30 }, scene: 'test-etapes-cite', icon: '🏰' },
  ],
  routes: [
    {
      id: 'r-drakenmoor',
      a: 'p-relais', b: 'p-cite',
      km: 120, // plusieurs Étapes (≈ 5 jours à M4 / 3-4 jours en diligence) : postes + rencontres répétés
      modes: ['pied', 'diligence'],
      perilDie: 0, // les Rencontres EDOC remplacent le d10 LDB sous le mode Étapes
      inns: true,
    },
  ],
};

export const scenario: TestScenario = {
  id: 'voyage-etapes',
  order: 24,
  icon: '🗺️',
  title: 'Voyage par Étapes (EDOC)',
  tests:
    'Voyage par Étapes (règle travel-etapes) : postes d’Activité PERSISTANTS (Plein air → porte d’Exposition, ' +
    'Rester aux aguets → pas de surprise, Établir des cartes → Test étendu cumulé, Approvisionnement → fourrage), ' +
    'Rencontres EDOC déclenchées par la qualité des Tests (positive/fortuite/dangereuse), véhicule à coque (diligence) ' +
    'depuis vehicles.json. Tout paramétrable : règle (panneau), routes/véhicules (Monde), postes (fiche).',
  partyNote: 'Bjorn (plein air) · Mira (aguets) · Aldric (cartographe) · Gerda (fourrage, faible)',
  makeParty: groupe,
  scene: relais,
  extraScenes: [cite],
  worldMap: carte,
  rules: { 'travel-etapes': true },
  // De quoi payer la diligence (extérieur : 1 sou/km × 120 km × 4 passagers = 480 sous = 4 CO) + auberges.
  money: { gold: 6, silver: 0, brass: 0 },
};
