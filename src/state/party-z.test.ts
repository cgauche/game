import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene, type Terrain } from './scene';

/**
 * Déplacement d'exploration multi-niveaux : le groupe peut fouler une case d'ÉTAGE (plancher posé
 * sur le « vide »), et `partyPos` porte alors son `z`. Une case « vide » d'étage reste infranchissable.
 */
function twoLevelScene(): Scene {
  const s = emptyScene(4, 4); // niveau 0 : herbe marchable
  const z1 = new Array(16).fill('vide') as Terrain[];
  z1[1 * 4 + 1] = 'plancher'; // une seule case d'étage marchable
  s.levels.push({ z: 1, tiles: z1 });
  s.stairs = [{ from: { x: 1, y: 0, z: 0 }, to: { x: 1, y: 1, z: 1 } }];
  return s;
}

describe('exploration multi-niveaux : moveParty z', () => {
  beforeEach(() =>
    useGame.setState({ mode: 'exploration', battle: null, dialogue: null, scene: twoLevelScene(), partyPos: { x: 0, y: 0 }, party: [] }),
  );

  it('foule une case d’étage (plancher) → partyPos porte z=1', () => {
    useGame.getState().moveParty({ x: 1, y: 1, z: 1 });
    expect(useGame.getState().partyPos).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('refuse une case « vide » d’étage (rien à fouler)', () => {
    useGame.getState().moveParty({ x: 2, y: 2, z: 1 });
    expect(useGame.getState().partyPos).toEqual({ x: 0, y: 0 }); // inchangé
  });
});
