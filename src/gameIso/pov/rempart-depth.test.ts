import { describe, it, expect } from 'vitest';
import { buildPovDrawList } from './geometry';
import { makeCamera } from './camera';
import { scenario } from '../../scenes/test-scenarios/siege-explore';

/** En POV, une dalle de chemin de ronde (sol z1) COIFFE le bloc plein du mur (z0) : elle doit se peindre
 *  APRÈS le flanc de mur de sa colonne (donc au-dessus). Le tri par CENTROÏDE du peintre les mettait à
 *  égalité et `FLOOR_BIAS` enterrait la dalle sous le mur ; `FLOOR_ZLIFT` (sol remonté par son `z`) répare. */
describe('POV — la dalle z1 coiffe le mur z0 (pas l’inverse)', () => {
  it('la dalle z1 est peinte après le flanc de mur z0 de sa colonne', () => {
    const scene = scenario.scene;
    const cam = makeCamera(scene, { x: 14, y: 38, z: 1 }, 'O'); // sur le chemin de ronde, regard ouest
    const visible = new Set<string>();
    const { w, h } = scene.dimensions;
    for (const l of scene.layers) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) visible.add(`${x},${y},${l.z}`);
    const list = buildPovDrawList(scene, cam, visible, { at: () => 1 });
    let checked = 0;
    for (let x = 0; x < w; x++) {
      for (const y of [37, 38]) {
        const dalle = list.findIndex((it) => it.key === `floor:${x},${y},1`);
        const mur = list.findIndex((it) => it.key === `floor:${x},${y},0:0:cliff`);
        if (dalle < 0 || mur < 0) continue;
        checked++;
        expect(dalle).toBeGreaterThan(mur); // index plus grand = peint plus tard = au-dessus
      }
    }
    expect(checked).toBeGreaterThan(0); // au moins une colonne dalle+mur vérifiée (test non vide)
  });
});
