import { pregenParty, PREGEN } from '../../data/pregens';
import { itemFromTrappingById } from '../../engine/items';
import { buildScene } from '../../state/mapSpec';
import { setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * BÉLIER — PORTE (ADE II ch.08 « Le théâtre de la guerre » l.233) : consommateur LIVE du modèle ENGIN DE
 * SIÈGE CREWÉ — le bélier n'est PAS une arme portée en solo : c'est un EMPLACEMENT (poste `ShipPoste`,
 * `Combatant.mannedPoste`/`postes`) servi par une ÉQUIPE (Qualité `equipe`, Indice 6), exactement comme les
 * autres machines de guerre. Le SOLDAT (héros, id STABLE `pregen-101`) est le CHEF de pièce (`crewIds[0]`,
 * seul à tirer/manier) ; 5 servants PNJ (`garde-du-village`, IA) complètent l'Équipe de 6. `applyShipPostes`
 * sert le poste au chef au début du combat (aucune action « équiper » ni loadout) — le bélier SERVI est
 * assené contre une VRAIE porte (`porte-de-ville`, structure brèchable) : le jet d'attaque se résout sur la
 * Force du chef (jamais sa CC), seule la porte encaisse des Dégâts (Atout Bélier).
 *
 * Carte MINIMALE (10×8, pavée) : la partie démarre à l'adjacence immédiate de la porte (arête N de (5,4)),
 * un gobelin en défend l'autre côté (5,2) — combat direct, aucune traversée requise.
 */
const RAM_CREW = [
  `pregen-${PREGEN.soldat}`, // chef de pièce (crewIds[0]) : un héros, seul à manier le bélier
  'enemy-siege-belier-2', 'enemy-siege-belier-3', 'enemy-siege-belier-4', 'enemy-siege-belier-5', 'enemy-siege-belier-6', // 5 servants PNJ (Équipe 6, ADE II ch.08 l.233)
];

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
  startMessage: "Le Soldat sert le bélier (poste, Équipe de 6) : enfoncez la porte (Test de Force) puis venez à bout du défenseur.",
  walls: [{ x: 5, y: 4, side: 'N', structure: 'porte-de-ville' }],
});
setEncounters(scene, [
  {
    id: 'siege-belier',
    enemies: [
      { ref: 'gobelin', pos: { x: 5, y: 2 }, facing: 'S' }, // index 0 : défenseur
      // index 1 : l'EMPLACEMENT du bélier — affût INERTE (branche siège de `spawnEnemy`, `ref` porte un
      // `siegeRig`), servi par l'Équipe `RAM_CREW`. Position propre (le chef attaque depuis SA case, pas
      // celle de l'affût) — posée à l'adjacence de la porte pour la lisibilité de la scène.
      {
        ref: 'belier-ade2', pos: { x: 6, y: 5 }, facing: 'N', side: 'ally', label: 'Bélier (poste)',
        postes: [{ item: itemFromTrappingById('belier-ade2')!, crewIds: [...RAM_CREW] }],
      },
      // index 2-6 : les 5 servants PNJ (IA, agissent seuls) qui complètent l'Équipe (le 6e membre = le
      // Soldat, crewIds[0] ci-dessus).
      { ref: 'garde-du-village', pos: { x: 3, y: 6 }, facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: { x: 4, y: 6 }, facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: { x: 6, y: 6 }, facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: { x: 7, y: 6 }, facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
      { ref: 'garde-du-village', pos: { x: 8, y: 6 }, facing: 'N', side: 'ally', ai: true, label: 'Servant du bélier' },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'belier-porte',
  order: 42,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Bélier — porte',
  tests:
    "Bélier ADE II = engin de siège CREWÉ (ch.08 l.233), jamais une arme portée : posé en EMPLACEMENT " +
    "(poste), servi par une Équipe de 6 (le Soldat = chef, 5 servants PNJ) — Équipe incomplète bake −20, " +
    "sous la moitié rend l'affût INUTILISABLE (`firedAttackBlock`). Le chef assène le bélier sur une VRAIE " +
    "porte (structure brèchable, `Weapon.resolveChar`) : le jet se résout sur sa Force, jamais sa CC ; " +
    "seule la porte encaisse des Dégâts (Atout Bélier).",
  partyNote: 'Le Soldat sert le bélier (chef de pièce) ; 5 servants PNJ complètent l’Équipe requise.',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur),
  scene,
  autoCombat: 'siege-belier',
};
