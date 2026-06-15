import { Scene, Terrain } from '../state/scene';
import { buildEncounter } from '../state/encounterAuthoring';

/**
 * Scène de FIXTURE pour les tests de combat (neutre, sans contenu de campagne). Grille d'herbe
 * praticable + un point de départ héros. Remplace l'ancien usage de `tome1Intro` comme simple décor
 * de test (le Tome 1 a été retiré). Dimensions et `heroStart` calqués sur l'ancienne scène pour
 * rester un drop-in (les tests qui se déplacent relativement à (6,10) restent valides).
 */
const W = 22;
const H = 16;

// Rencontre `enc-mutants` (3 Mutants) : les tests de combat font `startCombat('enc-mutants')` puis
// adaptent les combattants à leur cas (Taille, États…). Mêmes id/positions que l'ancienne embuscade.
const enc = buildEncounter({
  id: 'enc-mutants',
  enemies: [
    { ref: 'Mutant', pos: { x: 16, y: 11 } },
    { ref: 'Mutant', pos: { x: 18, y: 12 } },
    { ref: 'Mutant', pos: { x: 17, y: 13 } },
  ],
});

export const testScene: Scene = {
  id: 'test-fixture',
  nom: 'Terrain de test',
  description: 'Scène neutre pour les tests de combat.',
  dimensions: { w: W, h: H },
  ambiance: 'exterieur',
  levels: [{ z: 0, tiles: new Array(W * H).fill('herbe') as Terrain[] }],
  entities: [{ id: 'start', kind: 'heroStart', pos: { x: 6, y: 10 } }, ...enc.entities],
  dialogues: [],
  triggers: [],
  encounters: [enc.encounter],
  flags: {},
};
