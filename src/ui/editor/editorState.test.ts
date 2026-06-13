import { describe, it, expect } from 'vitest';
import { emptyScene, Scene } from '../../state/scene';
import {
  hitAt,
  moveSel,
  resizeSel,
  deleteSel,
  paintTiles,
  fillTerrainRect,
  placeEntity,
  placeEntry,
  renameEntry,
  addTrigger,
  addRestZone,
  addBuilding,
  addSpawn,
  selRect,
  sameSel,
  DEFAULT_LAYERS,
} from './editorState';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';

function sceneWith(): Scene {
  const s = emptyScene(10, 10);
  s.entities = [{ id: 'perso-0', kind: 'personnage', pos: { x: 2, y: 2 } }];
  s.triggers = [{ id: 'trig-0', rect: { x: 4, y: 4, w: 2, h: 2 }, once: true, effects: [] }];
  s.buildings = [{ id: 'b-0', type: 'maison', foot: { x: 6, y: 6, w: 3, h: 3 }, facing: 'S', reveal: 'cutaway', door: { x: 7, y: 8 }, params: {} }];
  s.encounters = [{ id: 'enc-0', enemies: [{ ref: 'Mutant', pos: { x: 1, y: 8 } }] }];
  s.restZones = [{ rect: { x: 0, y: 5, w: 2, h: 2 }, places: { camp: true } }];
  s.entryPoints = { entree: { x: 9, y: 0 } };
  return s;
}

describe('editorState — hitAt (priorité spawn > entité > entrée > trigger > repos > bâtiment)', () => {
  const s = sceneWith();
  it('touche chaque type au bon endroit', () => {
    expect(hitAt(s, { x: 1, y: 8 }, DEFAULT_LAYERS)).toEqual({ type: 'spawn', enc: 0, idx: 0 });
    expect(hitAt(s, { x: 2, y: 2 }, DEFAULT_LAYERS)).toEqual({ type: 'entity', id: 'perso-0' });
    expect(hitAt(s, { x: 9, y: 0 }, DEFAULT_LAYERS)).toEqual({ type: 'entry', id: 'entree' });
    expect(hitAt(s, { x: 5, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'trigger', id: 'trig-0' });
    expect(hitAt(s, { x: 0, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'restZone', idx: 0 });
    expect(hitAt(s, { x: 7, y: 7 }, DEFAULT_LAYERS)).toEqual({ type: 'building', id: 'b-0' });
    expect(hitAt(s, { x: 3, y: 0 }, DEFAULT_LAYERS)).toBeNull();
  });
  it('un calque masqué laisse cliquer à travers', () => {
    expect(hitAt(s, { x: 5, y: 5 }, { ...DEFAULT_LAYERS, triggers: false })).toBeNull();
    expect(hitAt(s, { x: 1, y: 8 }, { ...DEFAULT_LAYERS, spawns: false })).toBeNull();
  });
});

describe('editorState — moveSel (clampé)', () => {
  const s = sceneWith();
  it('déplace une entité et clampe dans la carte', () => {
    const out = moveSel(s, { type: 'entity', id: 'perso-0' }, { x: 99, y: -5 });
    expect(out.entities[0].pos).toEqual({ x: 9, y: 0 });
  });
  it('déplace un trigger en gardant son rect dans la carte', () => {
    const out = moveSel(s, { type: 'trigger', id: 'trig-0' }, { x: 9, y: 9 });
    expect(out.triggers[0].rect).toEqual({ x: 8, y: 8, w: 2, h: 2 });
  });
  it('déplace un point d’entrée et un spawn', () => {
    expect(moveSel(s, { type: 'entry', id: 'entree' }, { x: 3, y: 3 }).entryPoints!.entree).toEqual({ x: 3, y: 3 });
    expect(moveSel(s, { type: 'spawn', enc: 0, idx: 0 }, { x: 4, y: 4 }).encounters[0].enemies![0].pos).toEqual({ x: 4, y: 4 });
  });
});

describe('editorState — resizeSel (coin NW fixe)', () => {
  const s = sceneWith();
  it('redimensionne un trigger vers la case visée', () => {
    const out = resizeSel(s, { type: 'trigger', id: 'trig-0' }, { x: 7, y: 8 });
    expect(out.triggers[0].rect).toEqual({ x: 4, y: 4, w: 4, h: 5 });
  });
  it('ne descend jamais sous 1×1 ni hors carte', () => {
    const out = resizeSel(s, { type: 'trigger', id: 'trig-0' }, { x: 0, y: 99 });
    expect(out.triggers[0].rect).toEqual({ x: 4, y: 4, w: 1, h: 6 });
  });
  it('redimensionne une zone de repos, ignore une entité', () => {
    expect(resizeSel(s, { type: 'restZone', idx: 0 }, { x: 3, y: 6 }).restZones![0].rect).toEqual({ x: 0, y: 5, w: 4, h: 2 });
    expect(resizeSel(s, { type: 'entity', id: 'perso-0' }, { x: 3, y: 6 })).toBe(s);
  });
});

describe('editorState — deleteSel', () => {
  const s = sceneWith();
  it('supprime chaque type', () => {
    expect(deleteSel(s, { type: 'entity', id: 'perso-0' }).entities).toHaveLength(0);
    expect(deleteSel(s, { type: 'trigger', id: 'trig-0' }).triggers).toHaveLength(0);
    expect(deleteSel(s, { type: 'building', id: 'b-0' }).buildings).toHaveLength(0);
    expect(deleteSel(s, { type: 'restZone', idx: 0 }).restZones).toHaveLength(0);
    expect(deleteSel(s, { type: 'spawn', enc: 0, idx: 0 }).encounters[0].enemies).toHaveLength(0);
    expect(deleteSel(s, { type: 'entry', id: 'entree' }).entryPoints).toBeUndefined();
    expect(deleteSel(s, null)).toBe(s);
  });
});

describe('editorState — peinture', () => {
  it('paintTiles peint un carré 3×3 clampé', () => {
    const out = paintTiles(emptyScene(10, 10), { x: 0, y: 0 }, 'eau', 3);
    expect(out.tiles.filter((t) => t === 'eau')).toHaveLength(4); // coin : 2×2 visibles
  });
  it('fillTerrainRect remplit le rectangle', () => {
    const out = fillTerrainRect(emptyScene(10, 10), { x: 2, y: 2, w: 3, h: 2 }, 'eau');
    expect(out.tiles.filter((t) => t === 'eau')).toHaveLength(6);
  });
});

describe('editorState — pose', () => {
  it('placeEntity : pose DIRECTE d’un décor précis avec ses défauts de catalogue', () => {
    const { scene, id } = placeEntity(emptyScene(10, 10), 'prop', 'tonneau', { x: 1, y: 1 });
    const ent = scene.entities.find((e) => e.id === id)!;
    expect(ent.ref).toBe('tonneau');
    expect(ent.kind).toBe('prop');
  });
  it('placeEntity : pose un personnage d’espèce précise', () => {
    const { scene, id } = placeEntity(emptyScene(10, 10), 'personnage', 'Loup', { x: 1, y: 1 });
    expect(scene.entities.find((e) => e.id === id)!.ref).toBe('Loup');
  });
  it('addTrigger / addRestZone / addSpawn créent au bon endroit', () => {
    const t = addTrigger(emptyScene(10, 10), { x: 1, y: 1, w: 2, h: 2 });
    expect(t.scene.triggers[0].id).toBe(t.id);
    const z = addRestZone(emptyScene(10, 10), { x: 0, y: 0, w: 2, h: 2 });
    expect(z.scene.restZones![z.idx].places.camp).toBe(true);
    const sp = addSpawn(emptyScene(10, 10), '', 'Mutant', { x: 3, y: 3 });
    expect(sp.scene.encounters[0].enemies![0]).toEqual({ ref: 'Mutant', pos: { x: 3, y: 3 } });
    const sp2 = addSpawn(sp.scene, sp.encId, 'Mutant', { x: 4, y: 4 });
    expect(sp2.scene.encounters[0].enemies).toHaveLength(2);
  });
  it('addBuilding : un drag pose l’empreinte dessinée telle quelle', () => {
    const r = addBuilding(emptyScene(10, 10), 'taverne', { x: 1, y: 1, w: 5, h: 2 })!;
    expect(r.scene.buildings![0].foot).toEqual({ x: 1, y: 1, w: 5, h: 2 });
  });
  it('addBuilding : un clic simple (1×1) pose l’empreinte par défaut du catalogue, clampée', () => {
    const foot = BUILDINGS_META['taverne'].defaultFoot; // 4×3 — pas de bâtiment 1×1 dégénéré
    const r = addBuilding(emptyScene(10, 10), 'taverne', { x: 2, y: 2, w: 1, h: 1 })!;
    expect(r.scene.buildings![0].foot).toEqual({ x: 2, y: 2, w: foot.w, h: foot.h });
    const edge = addBuilding(emptyScene(10, 10), 'taverne', { x: 9, y: 9, w: 1, h: 1 })!;
    const f = edge.scene.buildings![0].foot;
    expect(f.x + f.w).toBeLessThanOrEqual(10);
    expect(f.y + f.h).toBeLessThanOrEqual(10);
  });
});

describe('editorState — points d’entrée (manque du POC comblé)', () => {
  it('placeEntry pose entree-0 puis un nom libre suivant', () => {
    const a = placeEntry(emptyScene(10, 10), { x: 1, y: 1 });
    expect(a.name).toBe('entree-0');
    const b = placeEntry(a.scene, { x: 2, y: 2 });
    expect(b.name).toBe('entree-1');
    expect(Object.keys(b.scene.entryPoints!)).toHaveLength(2);
  });
  it('renameEntry renomme sans écraser une clé existante', () => {
    const s = sceneWith();
    expect(renameEntry(s, 'entree', 'porche').entryPoints).toEqual({ porche: { x: 9, y: 0 } });
    const two = placeEntry(s, { x: 1, y: 1 }).scene;
    expect(renameEntry(two, 'entree-0', 'entree')).toBe(two); // conflit → inchangé
  });
});

describe('editorState — selRect / sameSel', () => {
  const s = sceneWith();
  it('selRect couvre trigger/restZone/bâtiment, null pour le ponctuel', () => {
    expect(selRect(s, { type: 'trigger', id: 'trig-0' })).toEqual({ x: 4, y: 4, w: 2, h: 2 });
    expect(selRect(s, { type: 'restZone', idx: 0 })).toEqual({ x: 0, y: 5, w: 2, h: 2 });
    expect(selRect(s, { type: 'building', id: 'b-0' })).toEqual({ x: 6, y: 6, w: 3, h: 3 });
    expect(selRect(s, { type: 'entity', id: 'perso-0' })).toBeNull();
  });
  it('sameSel compare par identité de cible', () => {
    expect(sameSel({ type: 'spawn', enc: 0, idx: 0 }, { type: 'spawn', enc: 0, idx: 0 })).toBe(true);
    expect(sameSel({ type: 'trigger', id: 'a' }, { type: 'trigger', id: 'b' })).toBe(false);
    expect(sameSel(null, null)).toBe(true);
    expect(sameSel(null, { type: 'entity', id: 'x' })).toBe(false);
  });
});
