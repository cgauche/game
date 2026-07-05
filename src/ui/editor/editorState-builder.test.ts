import { describe, it, expect } from 'vitest';
import { emptyScene, layerTiles, type Scene, type Terrain } from '../../state/scene';
import {
  setMetresPerTile,
  setAmbientLight,
  setSceneFlags,
  patchEntity,
  patchEntityCombat,
  putLayer,
  addBuilding,
  edgeWallState,
} from './editorState';

/** Primitives PURES ajoutées pour le headless-editor (`buildScene`) : elles comblent les gaps de l'éditeur
 *  (échelle mer, lumière ambiante, flags initiaux, équipage/upgrades de coque, couche entière, bâtiment). */

describe('editorState — scalaires de scène', () => {
  it('setMetresPerTile pose puis retire l’échelle métrique', () => {
    const s = emptyScene(4, 4);
    expect(setMetresPerTile(s, 10).metresPerTile).toBe(10);
    expect(setMetresPerTile(setMetresPerTile(s, 10), undefined).metresPerTile).toBeUndefined();
    expect(s.metresPerTile).toBeUndefined(); // immuable
  });

  it('setAmbientLight pose puis retire la lumière ambiante', () => {
    const s = emptyScene(4, 4);
    expect(setAmbientLight(s, 'jour').ambientLight).toBe('jour');
    expect(setAmbientLight(setAmbientLight(s, 'jour'), undefined).ambientLight).toBeUndefined();
  });

  it('setSceneFlags fusionne dans flags sans muter la scène', () => {
    const s: Scene = { ...emptyScene(4, 4), flags: { a: true } };
    const out = setSceneFlags(s, { b: false });
    expect(out.flags).toEqual({ a: true, b: false });
    expect(s.flags).toEqual({ a: true });
  });
});

describe('editorState — patch d’entité', () => {
  const base = (): Scene => {
    const s = emptyScene(6, 6);
    s.entities = [{ id: 'e0', kind: 'personnage', pos: { x: 1, y: 1 }, combat: { hiddenUntilCombat: true } }];
    return s;
  };

  it('patchEntity fusionne les champs de haut niveau (crewIds/upgrades/facing)', () => {
    const out = patchEntity(base(), 'e0', { crewIds: ['c1'], upgrades: [{ id: 'blindage-fer' }], facing: 'N' });
    const e = out.entities[0];
    expect(e.crewIds).toEqual(['c1']);
    expect(e.upgrades).toEqual([{ id: 'blindage-fer' }]);
    expect(e.facing).toBe('N');
  });

  it('patchEntityCombat fusionne DANS combat sans écraser l’existant', () => {
    const out = patchEntityCombat(base(), 'e0', { skills: [{ id: 'projectiles', spec: 'poudre-noire', value: 40 }] });
    const e = out.entities[0];
    expect(e.combat?.skills?.[0].spec).toBe('poudre-noire');
    expect(e.combat?.hiddenUntilCombat).toBe(true); // préservé
  });

  it('no-op si l’entité est absente', () => {
    const s = base();
    expect(patchEntity(s, 'nope', { facing: 'S' })).toEqual(s);
    expect(patchEntityCombat(s, 'nope', { spells: ['x'] })).toEqual(s);
  });
});

describe('editorState — putLayer', () => {
  it('ajoute une couche z avec tuiles + hauteurs, triée', () => {
    const s = emptyScene(2, 2);
    const tiles: Terrain[] = ['pierre', 'pierre', 'pierre', 'pierre'];
    const height = [4, 4, 4, 4];
    const out = putLayer(s, 1, tiles, height);
    const l = out.layers.find((l) => l.z === 1)!;
    expect(l.tiles).toEqual(tiles);
    expect(l.height).toEqual(height);
    expect(out.layers.map((l) => l.z)).toEqual([0, 1]);
  });

  it('remplace la couche z existante (pas de doublon)', () => {
    const s = emptyScene(2, 2);
    const out = putLayer(putLayer(s, 0, ['eau', 'eau', 'eau', 'eau']), 0, ['herbe', 'herbe', 'herbe', 'herbe']);
    expect(out.layers.filter((l) => l.z === 0)).toHaveLength(1);
    expect(layerTiles(out, 0)).toEqual(['herbe', 'herbe', 'herbe', 'herbe']);
  });
});

describe('editorState — addBuilding (toit + murs de périmètre + porte + sol)', () => {
  const wallStruct = (s: Scene, x: number, y: number, side: 'N' | 'E'): string | undefined =>
    (s.walls ?? []).find((w) => w.x === x && w.y === y && w.side === side)?.structure;

  it('pose un toit, un périmètre de murs, une porte franchissable, et repeint le sol', () => {
    const s = emptyScene(8, 8);
    const { scene: out, id } = addBuilding(s, 'taverne', { x: 2, y: 2, w: 3, h: 3 }, {
      door: { x: 3, y: 4, side: 'S' },
      floor: 'planches',
      wallStructure: 'mur-en-bois',
    });
    const roof = out.roofs!.find((r) => r.id === id)!;
    expect(roof.style).toBe('taverne');
    expect(roof.foot).toEqual({ x: 2, y: 2, w: 3, h: 3 });
    // périmètre muré (arête N de la rangée du haut, arête E de la colonne de droite)
    expect(edgeWallState(out, 2, 2, 'N')).toBe('wall');
    expect(edgeWallState(out, 4, 4, 'E')).toBe('wall');
    // porte franchissable sur l’arête S de (3,4)
    expect(edgeWallState(out, 3, 4, 'S')).toBe('door');
    // structure destructible sur les murs pleins, pas sur la porte
    expect(wallStruct(out, 2, 2, 'N')).toBe('mur-en-bois');
    // sol repeint sur l’empreinte
    expect(layerTiles(out, 0)[2 + 2 * 8]).toBe('planches');
    expect(layerTiles(out, 0)[4 + 4 * 8]).toBe('planches');
  });
});
