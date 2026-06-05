import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { CustomStatblock } from '../../state/scene';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Cible inerte : M 0 (ne bouge pas), beaucoup de Blessures (encaisse les tirs) → passif. FIXTURE de test. */
const MANNEQUIN: CustomStatblock = {
  name: "Mannequin d'entraînement",
  char: { M: 0, CC: 5, CT: 0, F: 20, E: 35, I: 5, Ag: 5, Dex: 5, Int: 5, FM: 5, Soc: 5, B: 40 },
  traits: [],
};

function arbaletrier(): Combatant {
  const h = createHero({
    speciesLabel: 'Humains (Reiklander)',
    careerLabel: 'Soldat',
    name: 'Arbalétrier (test)',
    motivation: 'Test',
    rng: makeRNG(1101),
    id: 'test-arbaletrier',
  });
  const arb = itemFromTrapping('Arbalète')!;
  arb.equipped = true;
  const carreaux = itemFromTrapping('Carreau')!; // (12) → qty 12, subType Arbalète, Empaleuse
  h.items = [arb, carreaux];
  recomputeLoadout(h); // dérive weapons : Arbalète (reload 1, subType Arbalète) + Mains nues
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const scene = arena({ id: 'test-tir', nom: 'Tir & Rechargement — stand de tir', w: 16, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Stand de tir. Un mannequin attend à distance. Tirez, rechargez, retirez.';
scene.encounters = [{ id: 'enc-tir', enemies: [{ statblock: MANNEQUIN, pos: { x: 12, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'tir-rechargement',
  order: 1,
  icon: '🏹',
  title: 'Tir & Rechargement',
  tests:
    'Tir consomme 1 munition + Empaleuse ; modale de rechargement (Test étendu de Projectiles) ; arme déchargée → tir refusé.',
  partyNote: 'Arbalétrier solo (Arbalète Recharge 1 + Carreaux)',
  makeParty: () => [arbaletrier()],
  scene,
  autoCombat: 'enc-tir',
};
