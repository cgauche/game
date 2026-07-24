import { describe, it, expect } from 'vitest';
import { emptyScene, layerTiles, type Scene, type Terrain } from '../../state/scene';
import {
  setMetresPerTile,
  setAmbientLight,
  setSceneFlags,
  patchEntity,
  patchEntityCombat,
  putLayer,
} from './editorState';

/** Primitives pures consommées par le headless-editor `buildScene`. */

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
