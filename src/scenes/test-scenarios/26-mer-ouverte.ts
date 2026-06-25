import { makeShowcaseParty, PREGEN } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import type { Combatant, ShipPoste } from '../../engine/types';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

// Ids STABLES des 2 canonniers (Soldat + Chasseur) qui SERVENT les pierriers du navire des aventuriers.
const GUNNERS = [`pregen-${PREGEN.soldat}`, `pregen-${PREGEN.chasseur}`] as const;
// TOUT le groupe est À BORD → équipage du navire ami. À l'échelle Mer ils sont PASSAGERS : ni tour d'initiative,
// ni jeton individuel sur la mer (le NAVIRE agit en unité et les représente, MDG ch.14). Les 2 canonniers servent
// en plus les pierriers.
const ALL_CREW = [`pregen-${PREGEN.soldat}`, `pregen-${PREGEN.tueur}`, `pregen-${PREGEN.sorcier}`, `pregen-${PREGEN.chasseur}`];

/** Un poste de pierrier (canon léger de pont, MDG ch.12) à tribord du navire ami, servi par `chefId`. */
function pierrierPoste(chefId: string): ShipPoste {
  return { item: itemFromTrappingById('pierrier')!, side: 'tribord', crewIds: [chefId] };
}

/** Groupe d'arène ; les 2 canonniers embarquent des munitions de siège et démarrent chargés (tir au 1er Round). */
function makeNavalParty(): Combatant[] {
  const party = makeShowcaseParty();
  for (const id of GUNNERS) {
    const g = party.find((h) => h.id === id);
    if (!g) continue;
    const ammo = itemFromTrappingById('balles-et-poudre-pierrier')!;
    ammo.qty = 10;
    g.items = [ammo, ...(g.items ?? [])];
    g.loaded = true;
  }
  return party;
}

// MER OUVERTE (couche Mer, Phase A — MDG ch.12-13) : vitrine du RENDU naval à l'ÉCHELLE-NAVIRE.
//  - échelle de scène 10 m/case (RAW : 1 pt de Distance = 10 m, ch.13 l.362) → le M des navires et les portées
//    canon (50/75/150 m) tombent en nombres de cases jouables ;
//  - les coques occupent leur vraie Taille (footprint depuis `ship.size`) : un navire DOMINE la grille, il ne
//    se confond plus avec un marin ;
//  - mer claire (`ambientLight:'jour'` → pas de brouillard de guerre parasite sur l'open sea).
// La Manœuvre (bouton « Manœuvrer ») et l'éperonnage existants y tournent tels quels (cap visible, Dir8).
const scene = arena({ id: 'test-mer-ouverte', nom: 'Mer ouverte', w: 24, h: 16, terrain: 'eau', heroStart: { x: 4, y: 8 } });
scene.metresPerTile = 10; // échelle MER (RAW ch.13 l.362)
scene.ambientLight = 'jour'; // mer claire : pas de fog of war sur l'open sea
scene.startMessage =
  'Mer ouverte (couche Mer) : à 10 m/case, chaque navire occupe sa vraie Taille — il DOMINE la grille. Ton navire (cap EST) fait face à la cogue pirate à ~140 m (14 cases). « Manœuvrer » vire le cap ; « Servir le pierrier » lâche une volée dans l’arc de bordée.';

setEncounters(scene, [
  {
    id: 'enc-mer',
    enemies: [
      // La cogue ennemie (coque E45/B50, footprint « énorme » 3×3) + son équipage exposé (pirates).
      { ref: 'cogue', pos: { x: 18, y: 7 }, facing: 'O', label: 'Cogue pirate',
        crewIds: ['enemy-enc-mer-1', 'enemy-enc-mer-2'] },
      { ref: 'pirate-fluvial', pos: { x: 17, y: 6 } },
      { ref: 'pirate-fluvial', pos: { x: 17, y: 9 } },
      // Le NAVIRE des aventuriers (cap EST → la cogue plein est tombe dans l'arc de bordée TRIBORD), crewé par
      // le groupe ; les 2 canonniers servent les pierriers.
      { ref: 'bateau-de-patrouille', pos: { x: 4, y: 7 }, side: 'ally', facing: 'E', label: 'Navire des aventuriers',
        crewIds: [...ALL_CREW], postes: [pierrierPoste(GUNNERS[0]), pierrierPoste(GUNNERS[1])] },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'mer-ouverte',
  order: 26,
  icon: '🌊',
  title: 'Mer ouverte (échelle navale)',
  tests: 'Couche Mer, Phase A : échelle de scène 10 m/case (RAW ch.13) ; navires rendus à l’ÉCHELLE-NAVIRE (footprint depuis `ship.size`) ; mer claire (ambientLight). Manœuvre + bordée existantes y tournent.',
  partyNote: 'Groupe d’arène crewant le navire ami ; le Soldat + le Chasseur servent les pierriers',
  makeParty: makeNavalParty,
  scene,
  autoCombat: 'enc-mer',
};
