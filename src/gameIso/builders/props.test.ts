import { describe, it, expect } from 'vitest';
import { emptyScene, type SceneEntity } from '../../state/scene';
import { buildProps } from './props';

/** BUILDER de props : clés stables, overlays de terrain, géométrie d'empreinte, vérités de scène. */
describe('buildProps — éléments prop du pivot', () => {
  const scene = () => {
    const s = emptyScene(6, 6);
    s.layers[0].tiles[1 * 6 + 2] = 'mur'; // (2,1) : overlay terrain « mur plein »
    s.layers[0].tiles[3 * 6 + 4] = 'bois'; // (4,3) : overlay terrain « arbre »
    s.entities = [
      { id: 'p1', kind: 'prop', pos: { x: 1, y: 1 } }, // ref absente → normalisée 'tonneau'
      { id: 'p2', kind: 'prop', pos: { x: 3, y: 2 }, ref: 'tente', foot: { w: 2, h: 2 }, facing: 'SE', anim: 'flottement', interact: { flow: { kind: 'seq', steps: [] } } },
      { id: 'npc', kind: 'personnage', pos: { x: 5, y: 5 } }, // pas un prop → ignoré
    ] as SceneEntity[];
    return s;
  };

  it('émet les overlays de TERRAIN (source terrain, toujours sous le voile) puis les props de scène', () => {
    const els = buildProps(scene());
    const terrain = els.filter((e) => e.source === 'terrain');
    expect(terrain.map((e) => e.key)).toEqual(['ov:2,1', 'ov:4,3']);
    expect(terrain.map((e) => e.ref)).toEqual(['mur', 'bois']);
    for (const t of terrain) expect(t.states.visible).toBe(false);
    const props = els.filter((e) => e.source === 'entity');
    expect(props.map((e) => e.key)).toEqual(['prop:p1', 'prop:p2']);
  });

  it('normalise la ref (défaut tonneau) et porte facing/empreinte/fx/interact', () => {
    const [p1, p2] = buildProps(scene()).filter((e) => e.source === 'entity');
    expect(p1.ref).toBe('tonneau');
    expect(p1.foot).toEqual({ offX: 0, offY: 0, scale: 1 });
    expect(p1.interact).toBe(false);
    expect(p2.ref).toBe('tente');
    expect(p2.facing).toBe('SE');
    expect(p2.foot).toEqual({ offX: 0.5, offY: 0.5, scale: 2 }); // décalage vers le centre + côté max
    expect(p2.span).toEqual({ w: 2, h: 2 });
    expect(p2.fx).toBe('flottement');
    expect(p2.interact).toBe(true);
    expect(p2.entId).toBe('p2');
  });

  it('tague `visible` un prop en vue, mémorisé sinon', () => {
    const els = buildProps(scene(), new Set(['1,1,0']));
    const p1 = els.find((e) => e.key === 'prop:p1')!;
    const p2 = els.find((e) => e.key === 'prop:p2')!;
    expect(p1.states.visible).toBe(true);
    expect(p2.states.visible).toBe(false);
  });

  it('filtre les étages avec `view` (z > activeZ coupé, viewZ isole) et émet tout sans `view`', () => {
    const s = scene();
    s.layers.push({ z: 1, tiles: new Array(36).fill('vide') });
    (s.entities[1] as SceneEntity).z = 1; // p2 à l'étage
    expect(buildProps(s).filter((e) => e.source === 'entity')).toHaveLength(2); // POV/éditeur : tout
    const game = buildProps(s, undefined, { activeZ: 0, viewZ: null });
    expect(game.filter((e) => e.source === 'entity').map((e) => e.key)).toEqual(['prop:p1']); // au-dessus → coupé
    const iso = buildProps(s, undefined, { activeZ: 0, viewZ: 1 });
    expect(iso.filter((e) => e.source === 'entity').map((e) => e.key)).toEqual(['prop:p2']); // isolement debug
  });
});
