import { describe, it, expect } from 'vitest';
import { emptyScene, Scene } from '../../state/scene';
import {
  hitAt,
  moveSel,
  resizeSel,
  deleteSel,
  paintTiles,
  fillTerrainRect,
  addLayer,
  removeLayer,
  paintHeight,
  placeEntity,
  placeEntry,
  renameEntry,
  addTrigger,
  addRestZone,
  addEffectZone,
  effectZoneRect,
  addMember,
  addEnemyMember,
  removeMember,
  placeEmplacement,
  setPosteCrew,
  setPosteSide,
  setPosteEngine,
  SIEGE_ENGINES,
  selRect,
  sameSel,
  DEFAULT_LAYERS,
  addArchitectureBody,
  addArchitecturePart,
  addFacadeSection,
  addRoofSection,
  pickArchitectureEdge,
} from './editorState';
import type { Sel } from './editorState';
import { EMPTY_FLOW } from '../../state/flow';

function sceneWith(): Scene {
  const s = emptyScene(10, 10);
  s.entities = [
    { id: 'perso-0', kind: 'personnage', pos: { x: 2, y: 2 } },
    { id: 'enemy-0', kind: 'personnage', pos: { x: 1, y: 8 }, ref: 'Mutant', combat: { hiddenUntilCombat: true } },
  ];
  s.triggers = [{ id: 'trig-0', rect: { x: 4, y: 4, w: 2, h: 2 }, once: true, flow: EMPTY_FLOW }];
  s.architecture = [{
    id: 'corps-0',
    style: 'maison',
    storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }],
    facades: [],
    roofs: [{ id: 'roof-0', z: 0, foot: { x: 6, y: 6, w: 3, h: 3 }, profile: 'gable', ridge: 'x', eaveHeightM: 3, pitch: 0.75, material: 'tuile', roomZoneIds: [] }],
  }];
  s.encounters = [{ id: 'enc-0', members: [{ entityId: 'enemy-0' }] }];
  s.restZones = [{ rect: { x: 0, y: 5, w: 2, h: 2 }, places: { camp: true } }];
  s.entryPoints = { entree: { x: 9, y: 0 } };
  return s;
}

function sceneWithArchitecture(): Scene {
  return {
    ...emptyScene(10, 10),
    architecture: [{
      id: 'corps',
      style: 'maison',
      storeys: [{ id: 'z0', z: 0, parts: [{ id: 'aile', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: [] }],
      facades: [{ id: 'facade-sud', z: 0, edges: [{ x: 1, y: 2, side: 'N' }], appearance: 'mur-a-ossature-en-bois' }],
      roofs: [{ id: 'toit-nef', z: 0, foot: { x: 1, y: 1, w: 2, h: 2 }, profile: 'gable', ridge: 'x', eaveHeightM: 3, pitch: 0.75, material: 'tuile', roomZoneIds: [] }],
    }],
  };
}

function architecturePart(scene: Scene, sel: Extract<Sel, { type: 'architecturePart' }>) {
  return scene.architecture?.find((body) => body.id === sel.bodyId)?.storeys
    .find((storey) => storey.id === sel.storeyId)?.parts.find((part) => part.id === sel.id);
}

describe('editorState — architecture', () => {
  it('crée des volumes architecturaux avec ids stables', () => {
    const body = addArchitectureBody(emptyScene(10, 10), 'maison');
    const part = addArchitecturePart(body.scene, body.id, 'z0', { x: 1, y: 1, w: 2, h: 2 });
    if (!part) throw new Error('part architecturale absente');
    const facade = addFacadeSection(part.scene, body.id, { x: 1, y: 2, side: 'N' }, 'mur-a-ossature-en-bois');
    if (!facade) throw new Error('façade absente');
    const roof = addRoofSection(facade.scene, body.id, { x: 1, y: 1, w: 2, h: 2 }, 2);
    if (!roof) throw new Error('toiture absente');
    expect(body.id).toBe('architecture-0');
    expect(part.id).toBe('part-0');
    expect(facade.id).toBe('facade-0');
    expect(roof.id).toBe('roof-section-0');
    expect(roof.scene.architecture?.[0]?.roofs[0]?.z).toBe(2);
  });

  it('retourne null pour un corps ou étage périmé', () => {
    const scene = emptyScene(10, 10);
    expect(addArchitecturePart(scene, 'absent', 'z0', { x: 0, y: 0, w: 1, h: 1 })).toBeNull();
    expect(addFacadeSection(scene, 'absent', { x: 0, y: 0, side: 'N' }, 'mur')).toBeNull();
    expect(addRoofSection(scene, 'absent', { x: 0, y: 0, w: 1, h: 1 }, 1)).toBeNull();
    const body = addArchitectureBody(scene, 'maison');
    expect(addArchitecturePart(body.scene, body.id, 'z-inexistant', { x: 0, y: 0, w: 1, h: 1 })).toBeNull();
  });

  it('déplace et redimensionne une part architecturale par ids stables', () => {
    const scene = sceneWithArchitecture();
    const selected: Sel = { type: 'architecturePart', bodyId: 'corps', storeyId: 'z0', id: 'aile' };
    const moved = moveSel(scene, selected, { x: 3, y: 4 });
    const resized = resizeSel(moved, selected, { x: 8, y: 9 });
    expect(architecturePart(resized, selected)?.foot).toEqual({ x: 3, y: 4, w: 6, h: 6 });
  });

  it('sélectionne les volumes architecturaux de l’étage courant', () => {
    const scene = sceneWithArchitecture();
    expect(hitAt(scene, { x: 1, y: 1 }, DEFAULT_LAYERS)).toEqual({ type: 'architecturePart', bodyId: 'corps', storeyId: 'z0', id: 'aile' });
    expect(hitAt(scene, { x: 6, y: 6 }, DEFAULT_LAYERS)).toBeNull();
    scene.architecture!.push({
      id: 'etage', style: 'maison',
      storeys: [{ id: 'z1', z: 1, parts: [{ id: 'aile-haute', foot: { x: 1, y: 1, w: 2, h: 2 } }], roomZoneIds: [] }],
      facades: [],
      roofs: [{ id: 'toit-haut', z: 1, foot: { x: 6, y: 6, w: 2, h: 2 }, profile: 'gable', ridge: 'x', eaveHeightM: 3, pitch: 0.75, material: 'tuile', roomZoneIds: [] }],
    });
    expect(hitAt(scene, { x: 1, y: 1 }, DEFAULT_LAYERS, 1)).toEqual({ type: 'architecturePart', bodyId: 'etage', storeyId: 'z1', id: 'aile-haute' });
    expect(hitAt(scene, { x: 6, y: 6 }, DEFAULT_LAYERS, 0)).toBeNull();
    expect(hitAt(scene, { x: 6, y: 6 }, DEFAULT_LAYERS, 1)).toEqual({ type: 'roofSection', bodyId: 'etage', id: 'toit-haut' });
  });

  it('trouve une façade par son arête canonique et son étage', () => {
    const scene = sceneWithArchitecture();
    scene.architecture![0].facades = [
      { id: 'nord', z: 0, edges: [{ x: 1, y: 2, side: 'N' }], appearance: 'mur' },
      { id: 'est', z: 0, edges: [{ x: 1, y: 2, side: 'E' }], appearance: 'mur' },
      { id: 'haut', z: 1, edges: [{ x: 1, y: 2, side: 'N' }], appearance: 'mur' },
    ];
    expect(pickArchitectureEdge(scene, 1, 1.5, 0)).toEqual({ type: 'facadeSection', bodyId: 'corps', id: 'nord' });
    expect(pickArchitectureEdge(scene, 1.5, 2, 0)).toEqual({ type: 'facadeSection', bodyId: 'corps', id: 'est' });
    expect(pickArchitectureEdge(scene, 1, 1.5, 1)).toEqual({ type: 'facadeSection', bodyId: 'corps', id: 'haut' });
  });

  it('supprime une section de toit sans supprimer le corps', () => {
    const next = deleteSel(sceneWithArchitecture(), { type: 'roofSection', bodyId: 'corps', id: 'toit-nef' });
    expect(next.architecture?.[0]?.roofs).toEqual([]);
    expect(next.architecture?.[0]?.id).toBe('corps');
  });
});

describe('editorState — hitAt (priorité entité > entrée > trigger > repos > toiture)', () => {
  const s = sceneWith();
  it('touche chaque type au bon endroit', () => {
    expect(hitAt(s, { x: 1, y: 8 }, DEFAULT_LAYERS)).toEqual({ type: 'entity', id: 'enemy-0' }); // un ennemi EST une entité
    expect(hitAt(s, { x: 2, y: 2 }, DEFAULT_LAYERS)).toEqual({ type: 'entity', id: 'perso-0' });
    expect(hitAt(s, { x: 9, y: 0 }, DEFAULT_LAYERS)).toEqual({ type: 'entry', id: 'entree' });
    expect(hitAt(s, { x: 5, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'trigger', id: 'trig-0' });
    expect(hitAt(s, { x: 0, y: 5 }, DEFAULT_LAYERS)).toEqual({ type: 'restZone', idx: 0 });
    expect(hitAt(s, { x: 7, y: 7 }, DEFAULT_LAYERS)).toEqual({ type: 'roofSection', bodyId: 'corps-0', id: 'roof-0' });
    expect(hitAt(s, { x: 3, y: 0 }, DEFAULT_LAYERS)).toBeNull();
  });
  it('un calque masqué laisse cliquer à travers (le calque Ennemis masque les embusqueurs)', () => {
    expect(hitAt(s, { x: 5, y: 5 }, { ...DEFAULT_LAYERS, triggers: false })).toBeNull();
    expect(hitAt(s, { x: 1, y: 8 }, { ...DEFAULT_LAYERS, spawns: false })).toBeNull(); // ennemi caché masqué
    expect(hitAt(s, { x: 7, y: 7 }, { ...DEFAULT_LAYERS, roofs: false })).toBeNull(); // toit masqué → clic à travers
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
  it('déplace une section de toiture en gardant son empreinte dans la carte', () => {
    const out = moveSel(s, { type: 'roofSection', bodyId: 'corps-0', id: 'roof-0' }, { x: 9, y: 9 });
    expect(out.architecture?.[0]?.roofs[0].foot).toEqual({ x: 7, y: 7, w: 3, h: 3 });
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
    expect(deleteSel(s, { type: 'roofSection', bodyId: 'corps-0', id: 'roof-0' }).architecture?.[0]?.roofs).toHaveLength(0);
    expect(deleteSel(s, { type: 'restZone', idx: 0 }).restZones).toHaveLength(0);
    expect(deleteSel(s, { type: 'entry', id: 'entree' }).entryPoints).toBeUndefined();
    expect(deleteSel(s, null)).toBe(s);
  });
});

describe('editorState — peinture', () => {
  it('paintTiles peint un carré 3×3 clampé', () => {
    const out = paintTiles(emptyScene(10, 10), { x: 0, y: 0 }, 'eau', 3);
    expect(out.layers[0].tiles.filter((t) => t === 'eau')).toHaveLength(4); // coin : 2×2 visibles
  });
  it('fillTerrainRect remplit le rectangle', () => {
    const out = fillTerrainRect(emptyScene(10, 10), { x: 2, y: 2, w: 3, h: 2 }, 'eau');
    expect(out.layers[0].tiles.filter((t) => t === 'eau')).toHaveLength(6);
  });
  it('peint sur la COUCHE demandée (z)', () => {
    const s = addLayer(emptyScene(4, 4), 1);
    const out = fillTerrainRect(s, { x: 1, y: 1, w: 2, h: 2 }, 'plancher', 1);
    expect(out.layers[1].tiles.filter((t) => t === 'plancher')).toHaveLength(4);
    expect(out.layers[0].tiles.every((t) => t === 'herbe')).toBe(true); // sol intact
  });
});

describe('editorState — couches (multi-niveaux)', () => {
  it('addLayer ajoute une couche « vide », triée par z ; idempotent', () => {
    const s1 = addLayer(emptyScene(4, 4), 1);
    expect(s1.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(s1.layers[1].tiles.length).toBe(16);
    expect(s1.layers[1].tiles.every((t) => t === 'vide')).toBe(true); // grille transparente à construire
    expect(addLayer(s1, 1)).toBe(s1); // no-op si déjà présente
    // insérée dans l'ordre des z même posée à l'envers
    expect(addLayer(addLayer(emptyScene(4, 4), 2), 1).layers.map((l) => l.z)).toEqual([0, 1, 2]);
  });
  it('removeLayer retire une couche mais protège le sol (z=0) et la dernière couche', () => {
    const s = addLayer(emptyScene(4, 4), 1);
    expect(removeLayer(s, 1).layers.map((l) => l.z)).toEqual([0]);
    expect(removeLayer(s, 0)).toBe(s); // sol protégé (jamais de scène sans couche de base)
    expect(removeLayer(emptyScene(4, 4), 0).layers.length).toBe(1); // dernière protégée
  });
});

describe('editorState — hauteur métrique (paintHeight)', () => {
  it('écrit layer.height en MÈTRES (crée le tableau, 0 ailleurs)', () => {
    const s = paintHeight(emptyScene(4, 4), { x: 1, y: 1 }, 4, 1, 0);
    expect(s.layers[0].height).toBeDefined();
    expect(s.layers[0].height![1 * 4 + 1]).toBe(4); // +4 m (toit) sur la case peinte
    expect(s.layers[0].height![0]).toBe(0); // 0 mètre ailleurs
  });
  it('peint la hauteur sur la COUCHE demandée (z), couche de base intacte', () => {
    const s = paintHeight(addLayer(emptyScene(4, 4), 1), { x: 2, y: 2 }, 3, 1, 1);
    expect(s.layers[1].height![2 * 4 + 2]).toBe(3);
    expect(s.layers[0].height).toBeUndefined(); // sol jamais touché
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
});

describe('editorState — emplacement de siège (postes authorés à l’éditeur)', () => {
  it('SIEGE_ENGINES = engins posables non vide, tous avec art d’affût `siegeRig` (baliste présente)', () => {
    expect(SIEGE_ENGINES.length).toBeGreaterThan(0);
    expect(SIEGE_ENGINES.every((t) => !!t.siegeRig)).toBe(true); // posable ⇔ a un art d'affût
    expect(SIEGE_ENGINES.some((t) => t.id === 'baliste')).toBe(true);
  });

  it('placeEmplacement : pose un personnage COMPLET (ref source + poste équipage vide, apparence DÉRIVÉE)', () => {
    const out = placeEmplacement(emptyScene(10, 10), 'baliste', { x: 3, y: 3 })!;
    const ent = out.scene.entities.find((e) => e.id === out.id)!;
    expect(ent.kind).toBe('personnage'); // seul kind enrôlable → spawn en Combattant
    expect(ent.label).toBe('Baliste');
    expect(ent.ref).toBe('baliste'); // SOURCE de l'engin → spawn construit l'affût inerte ET le rig est dérivé de la ref
    expect(ent.appearance).toBeUndefined(); // PLUS d'espèce forcée : le rig d'affût se dérive de `ref` (resolveRender)
    expect(ent.postes).toHaveLength(1);
    expect(ent.postes![0].trappingId).toBe('baliste'); // #222 — réf catalogue authorée (base hydratée au spawn), plus d'`item` matérialisé
    expect(ent.postes![0].crewIds).toEqual([]); // pas d'équipage tant que non assigné
    expect(ent.postes![0].side).toBeUndefined(); // par défaut tir omni
    expect(ent.statblock).toBeUndefined(); // affût INERTE : pas de profil à PV (RAW-pur), le rig + spawn s'en chargent
  });

  it('placeEmplacement : trapping sans art d’affût (siegeRig) → null (pas d’entité fantôme)', () => {
    expect(placeEmplacement(emptyScene(10, 10), 'dague', { x: 1, y: 1 })).toBeNull(); // arme normale, pas un engin
    expect(placeEmplacement(emptyScene(10, 10), 'engin-inexistant', { x: 1, y: 1 })).toBeNull(); // id inconnu
  });

  it('placeEmplacement : pose sur l’étage courant (z), absent au sol', () => {
    expect(placeEmplacement(emptyScene(10, 10), 'baliste', { x: 1, y: 1 }, 0)!.scene.entities[0].z).toBeUndefined();
    const up = placeEmplacement(emptyScene(10, 10), 'baliste', { x: 1, y: 1 }, 2)!;
    expect(up.scene.entities.find((e) => e.id === up.id)!.z).toBe(2);
  });

  it('setPosteCrew : peuple crewIds DANS L’ORDRE (chef = crewIds[0]) ; réordonner change le chef', () => {
    let s = placeEmplacement(emptyScene(10, 10), 'baliste', { x: 3, y: 3 })!.scene;
    const id = s.entities[0].id;
    s = setPosteCrew(s, id, ['g1', 'g2']);
    expect(s.entities[0].postes![0].crewIds).toEqual(['g1', 'g2']);
    s = setPosteCrew(s, id, ['g2', 'g1']); // réordonner → chef devient g2
    expect(s.entities[0].postes![0].crewIds![0]).toBe('g2');
  });

  it('setPosteSide : pose puis RETIRE `side` (directionnel ↔ omni — clé absente, pas juste undefined)', () => {
    let s = placeEmplacement(emptyScene(10, 10), 'baliste', { x: 3, y: 3 })!.scene;
    const id = s.entities[0].id;
    s = setPosteSide(s, id, 'tribord');
    expect(s.entities[0].postes![0].side).toBe('tribord');
    s = setPosteSide(s, id, undefined);
    expect(s.entities[0].postes![0].side).toBeUndefined();
    expect('side' in s.entities[0].postes![0]).toBe(false); // retirée
  });

  it('setPosteEngine : change l’engin (trappingId + libellé + ref), apparence DÉRIVÉE de la ref, équipage conservé', () => {
    let s = placeEmplacement(emptyScene(10, 10), 'baliste', { x: 3, y: 3 })!.scene;
    const id = s.entities[0].id;
    s = setPosteCrew(s, id, ['g1']);
    s = setPosteEngine(s, id, 'mortier');
    const mortier = SIEGE_ENGINES.find((t) => t.id === 'mortier')!;
    expect(s.entities[0].postes![0].trappingId).toBe('mortier'); // #222 — la réf change, jamais une base copiée
    expect(s.entities[0].postes![0].item).toBeUndefined(); // base HYDRATÉE au spawn, pas matérialisée à l'authoring
    expect(s.entities[0].label).toBe(mortier.label);
    expect(s.entities[0].ref).toBe('mortier'); // ref restampée → spawn construit le BON affût ET le rig suit la ref
    expect(s.entities[0].appearance).toBeUndefined(); // jamais d'`appearance.species` restampé : le rig dérive de `ref`
    expect(s.entities[0].postes![0].crewIds).toEqual(['g1']); // équipage inchangé
    expect(setPosteEngine(s, id, 'dague')).toBe(s); // trapping sans siegeRig → no-op
    expect(setPosteEngine(s, id, 'engin-inexistant')).toBe(s); // engin inconnu → no-op
  });

  it('les mutations de poste sont des no-op sur une entité SANS poste', () => {
    const s = placeEntity(emptyScene(10, 10), 'personnage', undefined, { x: 1, y: 1 }).scene;
    const id = s.entities[0].id;
    expect(setPosteCrew(s, id, ['x']).entities[0].postes).toBeUndefined();
    expect(setPosteSide(s, id, 'proue').entities[0].postes).toBeUndefined();
  });
});

describe('editorState — points d’entrée (manque du POC comblé)', () => {
  it('placeEntry pose entree-0 puis un nom libre suivant', () => {
    const a = placeEntry(emptyScene(10, 10), { x: 1, y: 1 });
    expect(a.id).toBe('entree-0');
    const b = placeEntry(a.scene, { x: 2, y: 2 });
    expect(b.id).toBe('entree-1');
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
  it('selRect couvre trigger/restZone/toiture, null pour le ponctuel', () => {
    expect(selRect(s, { type: 'trigger', id: 'trig-0' })).toEqual({ x: 4, y: 4, w: 2, h: 2 });
    expect(selRect(s, { type: 'restZone', idx: 0 })).toEqual({ x: 0, y: 5, w: 2, h: 2 });
    expect(selRect(s, { type: 'roofSection', bodyId: 'corps-0', id: 'roof-0' })).toEqual({ x: 6, y: 6, w: 3, h: 3 });
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
