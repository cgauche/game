import { describe, it, expect } from 'vitest';
import { emptyScene, Scene } from '../../state/scene';
import {
  hitAt,
  moveSel,
  resizeSel,
  deleteSel,
  paintTiles,
  fillTerrainRect,
  addLevel,
  removeLevel,
  placeEntity,
  placeEntry,
  renameEntry,
  addTrigger,
  addRestZone,
  addEffectZone,
  effectZoneRect,
  addBuilding,
  addMember,
  addEnemyMember,
  removeMember,
  selRect,
  sameSel,
  DEFAULT_LAYERS,
} from './editorState';
import { EMPTY_FLOW } from '../../state/flow';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';

function sceneWith(): Scene {
  const s = emptyScene(10, 10);
  s.entities = [
    { id: 'perso-0', kind: 'personnage', pos: { x: 2, y: 2 } },
    { id: 'enemy-0', kind: 'personnage', pos: { x: 1, y: 8 }, ref: 'Mutant', combat: { hiddenUntilCombat: true } },
  ];
  s.triggers = [{ id: 'trig-0', rect: { x: 4, y: 4, w: 2, h: 2 }, once: true, flow: EMPTY_FLOW }];
  s.buildings = [{ id: 'b-0', type: 'maison', foot: { x: 6, y: 6, w: 3, h: 3 }, facing: 'S', reveal: 'cutaway', door: { x: 7, y: 8 }, params: {} }];
  s.encounters = [{ id: 'enc-0', members: [{ entityId: 'enemy-0' }] }];
  s.restZones = [{ rect: { x: 0, y: 5, w: 2, h: 2 }, places: { camp: true } }];
  s.entryPoints = { entree: { x: 9, y: 0 } };
  return s;
}

describe('editorState — hitAt (priorité entité > entrée > trigger > repos > bâtiment)', () => {
  const s = sceneWith();
  it('touche chaque type au bon endroit', () => {
    expect(hitAt(s, { x: 1, y: 8 }, DEFAULT_LAYERS)).toEqual({ type: 'entity', id: 'enemy-0' }); // un ennemi EST une entité
    expect(hitAt(s, { x: 2, y: 2 }, DEFAULT_LAYERS)).toEqual({ type: 'entity', id: 'perso-0' });
    expect(hitAt(s, { x: 9, y: 0 }, DEFAULT_LAYERS)).toEqual({ type: 'entry', id: 'entree' });
    expect(hitAt(s, { x: 5, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'trigger', id: 'trig-0' });
    expect(hitAt(s, { x: 0, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'restZone', idx: 0 });
    expect(hitAt(s, { x: 7, y: 7 }, DEFAULT_LAYERS)).toEqual({ type: 'building', id: 'b-0' });
    expect(hitAt(s, { x: 3, y: 0 }, DEFAULT_LAYERS)).toBeNull();
  });
  it('un calque masqué laisse cliquer à travers (le calque Ennemis masque les embusqueurs)', () => {
    expect(hitAt(s, { x: 5, y: 5 }, { ...DEFAULT_LAYERS, triggers: false })).toBeNull();
    expect(hitAt(s, { x: 1, y: 8 }, { ...DEFAULT_LAYERS, spawns: false })).toBeNull(); // ennemi caché masqué
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
  it('déplace un point d’entrée et un ennemi (entité)', () => {
    expect(moveSel(s, { type: 'entry', id: 'entree' }, { x: 3, y: 3 }).entryPoints!.entree).toEqual({ x: 3, y: 3 });
    expect(moveSel(s, { type: 'entity', id: 'enemy-0' }, { x: 4, y: 4 }).entities.find((e) => e.id === 'enemy-0')!.pos).toEqual({ x: 4, y: 4 });
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
    expect(deleteSel(s, { type: 'entity', id: 'perso-0' }).entities.map((e) => e.id)).toEqual(['enemy-0']);
    expect(deleteSel(s, { type: 'trigger', id: 'trig-0' }).triggers).toHaveLength(0);
    expect(deleteSel(s, { type: 'building', id: 'b-0' }).buildings).toHaveLength(0);
    expect(deleteSel(s, { type: 'restZone', idx: 0 }).restZones).toHaveLength(0);
    expect(deleteSel(s, { type: 'entry', id: 'entree' }).entryPoints).toBeUndefined();
    expect(deleteSel(s, null)).toBe(s);
  });
});

describe('editorState — peinture', () => {
  it('paintTiles peint un carré 3×3 clampé', () => {
    const out = paintTiles(emptyScene(10, 10), { x: 0, y: 0 }, 'eau', 3);
    expect(out.levels[0].tiles.filter((t) => t === 'eau')).toHaveLength(4); // coin : 2×2 visibles
  });
  it('fillTerrainRect remplit le rectangle', () => {
    const out = fillTerrainRect(emptyScene(10, 10), { x: 2, y: 2, w: 3, h: 2 }, 'eau');
    expect(out.levels[0].tiles.filter((t) => t === 'eau')).toHaveLength(6);
  });
  it('peint sur le NIVEAU demandé (z)', () => {
    const s = addLevel(emptyScene(4, 4), 1);
    const out = fillTerrainRect(s, { x: 1, y: 1, w: 2, h: 2 }, 'plancher', 1);
    expect(out.levels[1].tiles.filter((t) => t === 'plancher')).toHaveLength(4);
    expect(out.levels[0].tiles.every((t) => t === 'herbe')).toBe(true); // sol intact
  });
});

describe('editorState — étages (multi-niveaux)', () => {
  it('addLevel ajoute un étage « vide », trié par z ; idempotent', () => {
    const s1 = addLevel(emptyScene(4, 4), 1);
    expect(s1.levels.map((l) => l.z)).toEqual([0, 1]);
    expect(s1.levels[1].tiles.length).toBe(16);
    expect(s1.levels[1].tiles.every((t) => t === 'vide')).toBe(true);
    expect(addLevel(s1, 1)).toBe(s1); // no-op si déjà présent
  });
  it('removeLevel retire un étage mais protège le sol (z=0) et le dernier niveau', () => {
    const s = addLevel(emptyScene(4, 4), 1);
    expect(removeLevel(s, 1).levels.map((l) => l.z)).toEqual([0]);
    expect(removeLevel(s, 0)).toBe(s); // sol protégé
    expect(removeLevel(emptyScene(4, 4), 0).levels.length).toBe(1); // dernier protégé
  });
});

describe('editorState — pose', () => {
  it('placeEntity : pose DIRECTE d’un décor précis avec ses défauts de catalogue', () => {
    const { scene, id } = placeEntity(emptyScene(10, 10), 'prop', 'tonneau', { x: 1, y: 1 });
    const ent = scene.entities.find((e) => e.id === id)!;
    expect(ent.ref).toBe('tonneau');
    expect(ent.kind).toBe('prop');
  });
  it('placeEntity : pose un personnage d’espèce précise (appearance.species + libellé)', () => {
    const { scene, id } = placeEntity(emptyScene(10, 10), 'personnage', 'loup', { x: 1, y: 1 });
    const ent = scene.entities.find((e) => e.id === id)!;
    expect(ent.appearance?.species).toBe('loup'); // id d'espèce rig (pas `ref`, réservé au profil de stats)
    expect(ent.label).toBe('Loup');
  });
  it('placeEntity : pose sur l’étage courant (z), absent au sol', () => {
    const ground = placeEntity(emptyScene(10, 10), 'prop', 'tonneau', { x: 1, y: 1 }, 0);
    expect(ground.scene.entities.find((e) => e.id === ground.id)!.z).toBeUndefined();
    const upper = placeEntity(emptyScene(10, 10), 'prop', 'tonneau', { x: 1, y: 1 }, 2);
    expect(upper.scene.entities.find((e) => e.id === upper.id)!.z).toBe(2);
  });
  it('addTrigger / addRestZone créent au bon endroit', () => {
    const t = addTrigger(emptyScene(10, 10), { x: 1, y: 1, w: 2, h: 2 });
    expect(t.scene.triggers[0].id).toBe(t.id);
    const z = addRestZone(emptyScene(10, 10), { x: 0, y: 0, w: 2, h: 2 });
    expect(z.scene.restZones![z.idx].places.camp).toBe(true);
  });
  it('addEnemyMember : pose une entité-personnage CACHÉE + l’enrôle (rencontre créée si absente)', () => {
    const r = addEnemyMember(emptyScene(10, 10), '', 'Mutant', { x: 3, y: 3 });
    const ent = r.scene.entities.find((e) => e.id === r.entityId)!;
    expect(ent).toMatchObject({ kind: 'personnage', ref: 'Mutant', pos: { x: 3, y: 3 }, combat: { hiddenUntilCombat: true } });
    expect(r.scene.encounters[0].members).toEqual([{ entityId: r.entityId }]);
    // un 2ᵉ ennemi rejoint la MÊME rencontre
    const r2 = addEnemyMember(r.scene, r.encId, 'Gobelin', { x: 4, y: 4 });
    expect(r2.scene.encounters[0].members).toHaveLength(2);
  });
  it('addMember / removeMember : enrôle puis retire une entité existante (sans la supprimer)', () => {
    let s = emptyScene(10, 10);
    s = { ...s, entities: [{ id: 'p1', kind: 'personnage', pos: { x: 0, y: 0 } }], encounters: [{ id: 'enc-0', members: [] }] };
    s = addMember(s, 'enc-0', 'p1').scene;
    expect(s.encounters[0].members).toEqual([{ entityId: 'p1' }]);
    expect(addMember(s, 'enc-0', 'p1').scene.encounters[0].members).toHaveLength(1); // idempotent
    const out = removeMember(s, 'enc-0', 'p1');
    expect(out.encounters[0].members).toHaveLength(0);
    expect(out.entities).toHaveLength(1); // l'entité demeure
  });
  it('deleteSel d’une entité retire aussi ses rattachements de rencontre', () => {
    const s = sceneWith();
    const out = deleteSel(s, { type: 'entity', id: 'enemy-0' });
    expect(out.entities.find((e) => e.id === 'enemy-0')).toBeUndefined();
    expect(out.encounters[0].members).toHaveLength(0);
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
    expect(sameSel({ type: 'restZone', idx: 0 }, { type: 'restZone', idx: 0 })).toBe(true);
    expect(sameSel({ type: 'entity', id: 'a' }, { type: 'entity', id: 'a' })).toBe(true);
    expect(sameSel({ type: 'trigger', id: 'a' }, { type: 'trigger', id: 'b' })).toBe(false);
    expect(sameSel(null, null)).toBe(true);
    expect(sameSel(null, { type: 'entity', id: 'x' })).toBe(false);
    expect(sameSel({ type: 'effectZone', idx: 1 }, { type: 'effectZone', idx: 1 })).toBe(true);
    expect(sameSel({ type: 'effectZone', idx: 0 }, { type: 'effectZone', idx: 1 })).toBe(false);
  });
});

describe('Zones d\'effet (pièges) — authoring éditeur', () => {
  it('addEffectZone : rect + onCross Dégâts par défaut, id frais, sélectionnable', () => {
    const s0 = sceneWith();
    const { scene, idx } = addEffectZone(s0, { x: 3, y: 3, w: 2, h: 1 });
    const z = scene.effectZones![idx];
    expect(z.area).toEqual({ kind: 'rect', x: 3, y: 3, w: 2, h: 1 });
    expect(z.onCross?.some((o) => o.op === 'wounds')).toBe(true);
    expect(z.id).toBeTruthy();
    // hitAt trouve la zone sous une de ses cases
    expect(hitAt(scene, { x: 4, y: 3 }, DEFAULT_LAYERS)).toEqual({ type: 'effectZone', idx });
  });

  it('selRect/moveSel/resizeSel/deleteSel sur une zone d\'effet', () => {
    let scene = addEffectZone(sceneWith(), { x: 3, y: 3, w: 2, h: 2 }).scene;
    const sel = { type: 'effectZone' as const, idx: 0 };
    expect(selRect(scene, sel)).toEqual({ x: 3, y: 3, w: 2, h: 2 });
    scene = moveSel(scene, sel, { x: 5, y: 5 });
    expect(scene.effectZones![0].area).toMatchObject({ kind: 'rect', x: 5, y: 5, w: 2, h: 2 });
    scene = resizeSel(scene, sel, { x: 7, y: 6 });
    expect(scene.effectZones![0].area).toMatchObject({ w: 3, h: 2 });
    scene = deleteSel(scene, sel);
    expect(scene.effectZones).toHaveLength(0);
  });

  it('effectZoneRect : disque → boîte englobante', () => {
    expect(effectZoneRect({ kind: 'disc', cx: 5, cy: 5, radius: 1 })).toEqual({ x: 4, y: 4, w: 3, h: 3 });
  });
});
