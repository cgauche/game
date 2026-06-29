import { pregen, PREGEN } from '../../data/pregens';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

/**
 * Structure DESTRUCTIBLE jouable (M2) : une PORTE de siège (Résistant, BE 2 / Bl 8) posée sur l'arête EST
 * de la case (6,5) barre le passage vers l'Est tant qu'elle tient. On approche un héros de mêlée et on la
 * frappe (le corps à corps passe la Résistance ; un tir sans Atout Siège rebondirait) jusqu'à la BRÈCHE :
 * à 0 Blessure la porte s'effondre, la case s'ouvre (passage + Ligne de Vue rouverts), le rempart devient
 * des gravats. Un gobelin lointain garde la bataille en vie (la structure 'npc' ne compte pas pour la fin).
 */
const W = 14, H = 10;
const scene = arena({ id: 'siege-structure', nom: 'Siège — abattre une porte', w: W, h: H, terrain: 'sol', heroStart: { x: 3, y: 5 } });

// Porte sur l'arête EST de (6,5) : entre (6,5) et (7,5). Le Combattant-structure spawne à l'ancrage (6,5).
scene.walls = [{ x: 6, y: 5, side: 'E', structure: 'porte' }];

setEncounters(scene, [
  { id: 'enc-porte', enemies: [{ ref: 'gobelin', pos: { x: 12, y: 8 } }] },
]);

scene.startMessage =
  'Abattez la PORTE (arête EST de la case 6,5) : approchez un héros et frappez-la jusqu’à la brèche. ' +
  'Résistante → le corps à corps passe, le tir sans Atout Siège rebondit. À 0 Blessure : brèche franchissable.';

export const scenario: TestScenario = {
  id: 'siege-structure',
  order: 40,
  category: '⚔️ Combat',
  icon: '🏰',
  title: 'Siège — abattre une porte',
  tests:
    'Structure destructible : spawn de la porte au combat, ciblage (overlay d’arête cliquable), corps à corps ' +
    'qui passe la Résistance, Blessures mitigées (BE), brèche à 0 Bl (passage + LdV rouverts), rendu rempart→gravats.',
  partyNote: 'Groupe pré-tiré ; un héros de mêlée frappe la porte.',
  makeParty: () => [pregen(PREGEN.soldat), pregen(PREGEN.tueur)],
  scene,
};
