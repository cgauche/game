import { makeShowcaseParty, PREGEN } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import type { Combatant, ShipPoste } from '../../engine/types';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

// Ids STABLES des 2 canonniers (le Soldat + le Chasseur du groupe d'arène) qui SERVENT les pierriers.
const GUNNERS = [`pregen-${PREGEN.soldat}`, `pregen-${PREGEN.chasseur}`] as const;

/**
 * Un poste de PIERRIER (canon léger de pont, MDG ch.12) monté à tribord de la barge, servi par `chefId`.
 * La pièce appartient à la COQUE (source de vérité) ; au début du combat `applyShipPostes` la sert au chef
 * (`mannedPoste`) → l'attaque dédiée « Servir le pierrier » (arc de bordée). PLUS de pierrier en inventaire
 * (l'ancienne triche `armGunner`) : le canon est une pièce du navire, pas une arme perso du héros.
 */
function pierrierPoste(chefId: string): ShipPoste {
  return { item: itemFromTrappingById('pierrier')!, side: 'tribord', crewIds: [chefId] };
}

/**
 * Groupe d'arène, mais le Soldat + le Chasseur (les 2 chefs de pièce, cf. GUNNERS) embarquent des MUNITIONS
 * de siège (balles & poudre) et démarrent CHARGÉS — le CANON, lui, reste un poste de la barge (servi au
 * combat par `applyShipPostes`). Les 2 autres (Tueur + Sorcier) gardent leur arme de mêlée pour l'abordage.
 */
function makeNavalParty(): Combatant[] {
  const party = makeShowcaseParty();
  for (const id of GUNNERS) {
    const g = party.find((h) => h.id === id);
    if (!g) continue;
    const ammo = itemFromTrappingById('balles-et-poudre-pierrier')!;
    ammo.qty = 10; // de quoi bombarder plusieurs Rounds (Recharge entre chaque tir)
    g.items = [ammo, ...(g.items ?? [])];
    g.loaded = true; // chargé d'emblée → tir dès le 1er Round
  }
  return party;
}

// Bataille navale (MDG ch.13-14) — vitrine jouable de la chaîne navale :
//  - chaque canon est un POSTE de la coque, SERVI par un chef de pièce (MDG ch.12) : les 2 canonniers du
//    groupe servent les pierriers de LEUR barge (attaque « Servir le pierrier », arc de bordée) au lieu de
//    porter le canon en inventaire ;
//  - le NAVIRE ennemi (cogue, coque E45/B50) est un Combattant à PV : on le bombarde comme un ennemi ; un
//    Coup Critique se résout sur les tables de NAVIRE (localisation par gréement → États Voie d'eau / En
//    flammes) et son ÉQUIPAGE exposé (pirates, `crewIds`) encaisse les Éclats / un Critique « Équipage ».
const scene = arena({ id: 'test-bataille-navale', nom: 'Bataille navale', w: 18, h: 12, terrain: 'planches', heroStart: { x: 2, y: 6 } });
scene.startMessage =
  'Bataille navale (MDG) : tes 2 canonniers SERVENT les pierriers de votre barge (bouton « Servir le pierrier ») — bombardez la cogue ! C’est une COQUE à PV ; un Coup Critique se résout sur les tables de NAVIRE (Voie d’eau / En flammes). Les pirates sur le pont sont l’ÉQUIPAGE exposé : un critique « Équipage » ou les Éclats leur reviennent. Les 2 autres héros abordent.';

setEncounters(scene, [
  {
    id: 'enc-naval',
    enemies: [
      // index 0 = la cogue ennemie ; équipage exposé = les pirates (index 1-3), ids `enemy-enc-naval-<i>`.
      { ref: 'cogue', pos: { x: 13, y: 6 }, label: 'Cogue pirate',
        crewIds: ['enemy-enc-naval-1', 'enemy-enc-naval-2', 'enemy-enc-naval-3'] },
      { ref: 'pirate-fluvial', pos: { x: 11, y: 4 } },
      { ref: 'pirate-fluvial', pos: { x: 11, y: 8 } },
      { ref: 'chef-pirate', pos: { x: 15, y: 6 } },
      // index 4 = la BARGE AMIE (côté allié) : 2 pierriers SERVIS par les 2 canonniers du groupe. Son
      // équipage exposé (`crewIds`) = ces canonniers ; `applyShipPostes` leur pose le `mannedPoste`. Cap NORD
      // (appliqué par `faceAtCombatStart`) → la cogue, plein EST, tombe pile dans l'arc de la bordée TRIBORD
      // (octant 2) ; vire le cap (Phase 2 Manœuvre) et la cogue sort de l'arc.
      { ref: 'bateau-de-patrouille', pos: { x: 3, y: 6 }, side: 'ally', facing: 'N', label: 'Barge des aventuriers',
        crewIds: [...GUNNERS], postes: [pierrierPoste(GUNNERS[0]), pierrierPoste(GUNNERS[1])] },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'bataille-navale',
  order: 25,
  icon: '⛵',
  title: 'Bataille navale',
  tests: 'Postes d’artillerie SERVIS (MDG ch.12-13) : 2 héros servent les pierriers de leur barge (« Servir un poste », arc de bordée) au lieu de les porter en inventaire ; navire-Combattant à PV ; Coup Critique → tables de NAVIRE (États Voie d’eau / En flammes) ; équipage lié (crewIds) → Éclats / critique « Équipage » sur de vrais marins.',
  partyNote: 'Groupe d’arène ; le Soldat + le Chasseur servent les pierriers, le Tueur + le Sorcier abordent',
  makeParty: makeNavalParty,
  scene,
  autoCombat: 'enc-naval',
};
