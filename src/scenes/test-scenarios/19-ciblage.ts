import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { CustomStatblock } from '../../state/scene';
import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Cible inerte : M 0 (ne bouge pas), encaisse — la recette observe le CIBLAGE, pas le combat. */
const MANNEQUIN: CustomStatblock = {
  name: "Mannequin d'entraînement",
  char: { M: 0, CC: 5, CT: 0, F: 20, E: 35, I: 5, Ag: 5, Dex: 5, Int: 5, FM: 5, Soc: 5, B: 40 },
  traits: [],
};

/** Arbalète de poing (Portée 10 m → Extrême ×3 = 15 cases) : le mannequin du fond est HORS portée. */
function tireur(): Combatant {
  const h = createHero({
    speciesLabel: 'Humains (Reiklander)',
    careerLabel: 'Soldat',
    name: 'Tireur (test)',
    motivation: 'Test',
    rng: makeRNG(1901),
    id: 'test-tireur-ciblage',
  });
  const arb = itemFromTrapping('Arbalète de poing')!;
  arb.equipped = true;
  const carreaux = itemFromTrapping('Carreau')!;
  const epee = itemFromTrapping('Arme simple')!; // l'« épée » générique du LDB (groupe Base)
  h.items = [arb, carreaux, epee];
  h.loadouts = undefined; h.activeLoadoutId = undefined;
  recomputeLoadout(h);
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const W = 24, H = 12;
const scene = arena({ id: 'test-ciblage', nom: 'Ciblage & Ligne de Vue', w: W, h: H, heroStart: { x: 2, y: 2 } });
// Mur vertical en x=10 (rangées y=5..11) : les rangées hautes restent DÉGAGÉES (couloir de tir).
for (let y = 5; y < H; y++) (scene.tiles as string[])[y * W + 10] = 'mur';
scene.startMessage =
  'Survolez les mannequins : proche = réticule + carte de visée ; derrière le mur = ⛔ LdV (tir ET sort) ; au fond = ⛔ hors de portée. Testez aussi Explosion (gabarit de zone) et Bouclier magique (sur soi).';
scene.encounters = [
  {
    id: 'enc-ciblage',
    enemies: [
      { statblock: MANNEQUIN, pos: { x: 6, y: 2 } }, // visible, courte portée
      { statblock: MANNEQUIN, pos: { x: 14, y: 8 } }, // derrière le mur (hors LdV)
      { statblock: MANNEQUIN, pos: { x: 21, y: 2 } }, // visible mais au-delà de Portée ×3 (19 cases)
    ],
  },
];

export const scenario: TestScenario = {
  id: 'ciblage',
  order: 19,
  icon: '🎯',
  title: 'Ciblage & LdV',
  tests:
    'Tooltip survol (arme/sort · compétence ±mod · Dégâts), réticule + ligne (pleine mêlée / pointillée tir-sort), refus au clic hors LdV / hors portée, ghost hors-LdV, gabarit ZdE.',
  partyNote: 'Tireur (Arbalète de poing 10 m + Épée) + Wilhelmina (sorts)',
  makeParty: () => {
    const P = makePregens();
    const w = P.find((p) => p.name.startsWith('Wilhelmina'))!;
    w.spells = ['Explosion', 'Bouclier magique', ...(w.spells ?? [])]; // ZdE + buff « Vous » pour la recette
    return [tireur(), w];
  },
  scene,
  autoCombat: 'enc-ciblage',
};
