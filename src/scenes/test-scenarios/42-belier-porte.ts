import { pregenParty, PREGEN } from '../../data/pregens';
import { itemFromTrappingById, recomputeLoadout } from '../../engine/items';
import { buildScene } from '../../state/mapSpec';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * BÉLIER — PORTE (ADE II ch.08 « Le théâtre de la guerre » l.233) : consommateur LIVE de la résolution
 * par FORCE d'une machine de guerre (`Weapon.resolveChar`, `combatValue`) — le bélier est la SEULE des 10
 * machines ADE II à ne PAS résoudre par Projectiles (Machine de guerre). Le Soldat manie le bélier (2
 * mains, via son inventaire/loadout — RAW ne l'exige PAS « servi » en poste pour être manié, à la
 * différence des pièces à distance) et l'assène contre une VRAIE porte (`porte-de-ville`, structure
 * brèchable AA/ADE II) : le jet d'attaque doit se résoudre sur la Force du Soldat, PAS sa CC, et seule la
 * porte (jamais un défenseur) encaisse des Dégâts (`ramVsNonDoor`/Atout Bélier, déjà implémentés).
 *
 * Carte MINIMALE (10×8, pavée) : la partie démarre à L'ADJACENCE immédiate de la porte (arête N de
 * (5,4)), un gobelin en défend l'autre côté (5,2) — combat direct, aucune traversée requise.
 */
const scene = buildScene({
  id: 'belier-porte',
  nom: 'Bélier — porte',
  description: "Un petit fort de siège : une porte de ville barre le passage, gardée par un gobelin.",
  size: [10, 8],
  terrain: 'pave',
  metresPerTile: 2,
  ambiance: 'exterieur',
  ambientLight: 'jour',
  heroStart: [5, 5], // à L'ADJACENCE immédiate de la porte (arête N de (5,4), à 1 case au sud)
  startMessage: "Enfoncez la porte au bélier (Test de Force) puis venez à bout du défenseur.",
  walls: [{ x: 5, y: 4, side: 'N', structure: 'porte-de-ville' }],
});
setEncounters(scene, [{ id: 'siege-belier', enemies: [{ ref: 'gobelin', pos: { x: 5, y: 2 }, facing: 'S' }] }]);

export const scenario: TestScenario = {
  id: 'belier-porte',
  order: 42,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Bélier — porte',
  tests:
    "Résolution par CARACTÉRISTIQUE d'une machine de guerre ADE II (`Weapon.resolveChar`, ADE II ch.08 l.233) : " +
    "le Soldat manie le Bélier (2 mains) et l'assène sur une VRAIE porte (structure brèchable) — le jet d'attaque " +
    "se résout sur la Force, jamais la CC ; seule la porte encaisse des Dégâts (Atout Bélier), tout autre coup " +
    "devenant Arme improvisée (`ramVsNonDoor`).",
  partyNote: 'Le Soldat est déjà équipé du Bélier, au contact immédiat de la porte.',
  makeParty: () => {
    const party = pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur);
    const soldat = party[0];
    const belier = itemFromTrappingById('belier-ade2')!;
    belier.equipped = true;
    soldat.items = [belier];
    soldat.loadouts = undefined;
    soldat.activeLoadoutId = undefined;
    recomputeLoadout(soldat);
    return party;
  },
  scene,
  autoCombat: 'siege-belier',
};
