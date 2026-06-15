import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../state/scene';
import { addLevel, addStair } from './editorState';

/**
 * Outil escalier de l'éditeur : un clic sur l'étage courant pose un franchissement vertical vers la
 * même case de l'étage AU-DESSUS (z→z+1) — la traversée 3D consomme ces `Scene.stairs`. (Les escaliers
 * décalés/horizontaux restent éditables en JSON ; le clic couvre le cas courant « monter ici ».)
 */
describe('editorState — addStair', () => {
  it('relie la case courante à l’étage au-dessus (z→z+1)', () => {
    const s = addLevel(emptyScene(4, 4), 1); // niveaux 0 et 1
    const out = addStair(s, { x: 1, y: 1 }, 0);
    expect(out.stairs).toEqual([{ from: { x: 1, y: 1, z: 0 }, to: { x: 1, y: 1, z: 1 } }]);
  });

  it('no-op si l’étage au-dessus n’existe pas', () => {
    const s = emptyScene(4, 4); // niveau 0 seul
    expect(addStair(s, { x: 1, y: 1 }, 0)).toBe(s);
  });

  it('ne duplique pas un escalier déjà présent', () => {
    let s = addLevel(emptyScene(4, 4), 1);
    s = addStair(s, { x: 1, y: 1 }, 0);
    expect(addStair(s, { x: 1, y: 1 }, 0).stairs).toHaveLength(1);
  });
});
