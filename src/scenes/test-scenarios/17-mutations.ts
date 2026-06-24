import { makeShowcaseParty } from '../../data/pregens';
import { rollMutation } from '../../data/mutations';
import { attachMutation } from '../../engine/corruption';
import { recomputeLoadout } from '../../engine/items';
import type { Combatant } from '../../engine/types';
import { arena, setEncounters } from './_shared';
import type { TestScenario } from './_shared';

// Visuels de mutation (LDB 19) : les 19 mutations physiques attachées en dur aux 4 pré-tirés
// (jets forcés sur la table → donnée verbatim), + des « Mutant » ennemis pour le chemin seed.
// Répartition pensée pour limiter les collisions d'art (1 seul visuel de visage majeur chacun).
const LOTS: number[][] = [
  [83, 23, 63, 38, 3], // Cornes asymétriques, Œil énorme, Langue pendante, Tentacule épais, Pattes d'animaux
  [93, 68, 78, 8], // Groin poilu, Plumes éparses, Écailles épineuses, Corpulent
  [53, 58, 13, 73], // Visage inversé, Peau d'acier, Doigts distendus, Court sur pattes
  [48, 33, 43, 88, 28, 18], // Beauté surnaturelle, Bouche supplémentaire, Peau brillante, Suintement de pus, Articulation, Émacié
];

function mutate(c: Combatant, rolls: number[]): Combatant {
  for (const r of rolls) attachMutation(c, rollMutation('physique', { int: () => r }));
  recomputeLoadout(c); // PA naturels (Peau d'acier, Écailles…)
  return c;
}

const scene = arena({ id: 'test-mutations', nom: 'Visuels de mutation', w: 18, h: 12, heroStart: { x: 2, y: 6 } });
scene.startMessage =
  'Les 19 mutations physiques (LDB 19) réparties sur le groupe : vérifier les calques sur les pions (tourner la caméra — les détails de visage disparaissent de dos), la morpho (corpulent/émacié/court sur pattes) et les portraits du HUD. Les Mutants ennemis tirent leurs visuels au hasard du même registre.';
setEncounters(scene, [
  {
    id: 'enc-mutants',
    enemies: [
      { ref: 'mutant', pos: { x: 12, y: 4 } },
      { ref: 'mutant', pos: { x: 14, y: 6 } },
      { ref: 'mutant', pos: { x: 12, y: 8 } },
    ],
  },
]);

export const scenario: TestScenario = {
  id: 'mutations',
  order: 17,
  icon: '🧬',
  title: 'Visuels de mutation',
  tests: 'Chaque mutation physique LDB 19 a son calque/morpho/peau sur le rig (héros mutés) ; tentacule = bras remplacé + Attaque gratuite 1/tour (Spécial → 🐙, Empêtré sur Dégâts) ; Cornes = arme naturelle (+BF) ; détails de visage en vue de face seulement ; portraits HUD mutés ; Mutants ennemis tirés du même registre.',
  partyNote: '4 pré-tirés portant à eux quatre les 19 mutations physiques',
  makeParty: () => makeShowcaseParty().map((c, i) => mutate(c, LOTS[i] ?? [])),
  scene,
  autoCombat: 'enc-mutants',
};
