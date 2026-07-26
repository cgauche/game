import { describe, it, expect } from 'vitest';
import { emptyScene, isDescriptiveZone, layerTiles, type Scene, type Terrain } from '../../state/scene';
import {
  setMetresPerTile,
  setAmbientLight,
  setEnvironment,
  setSceneFlags,
  patchEntity,
  patchEntityCombat,
  putLayer,
  addEffectZone,
  renameEffectZone,
} from './editorState';

/** Primitives pures consommées par le headless-editor `buildScene`. */

describe('editorState — scalaires de scène', () => {
  it('emptyScene() pose des défauts EXPLICITES pour metresPerTile/ambientLight (#841 FU-A)', () => {
    const s = emptyScene(4, 4);
    expect(s.metresPerTile).toBe(2);
    expect(s.ambientLight).toBe('auto');
    expect(s.environment).toBeUndefined(); // « non spécifié » est une valeur légitime, pas un défaut caché
  });

  it('setMetresPerTile pose puis retire l’échelle métrique', () => {
    const s = emptyScene(4, 4);
    expect(setMetresPerTile(s, 10).metresPerTile).toBe(10);
    expect(setMetresPerTile(setMetresPerTile(s, 10), undefined).metresPerTile).toBeUndefined();
    expect(s.metresPerTile).toBe(2); // immuable — défaut d'origine inchangé
  });

  it('setAmbientLight pose puis retire la lumière ambiante', () => {
    const s = emptyScene(4, 4);
    expect(setAmbientLight(s, 'jour').ambientLight).toBe('jour');
    expect(setAmbientLight(setAmbientLight(s, 'jour'), undefined).ambientLight).toBeUndefined();
    expect(s.ambientLight).toBe('auto'); // immuable
  });

  it('setEnvironment pose puis retire la classification écologique — survit à un aller-retour JSON (#841 FU-A)', () => {
    const s = emptyScene(4, 4);
    const withEnv = setEnvironment(s, 'sauvage');
    expect(withEnv.environment).toBe('sauvage');
    expect(JSON.parse(JSON.stringify(withEnv)).environment).toBe('sauvage');
    expect(setEnvironment(withEnv, undefined).environment).toBeUndefined();
    expect(s.environment).toBeUndefined(); // immuable
  });

  it('setSceneFlags fusionne dans flags sans muter la scène', () => {
    const s: Scene = { ...emptyScene(4, 4), flags: { a: true } };
    const out = setSceneFlags(s, { b: false });
    expect(out.flags).toEqual({ a: true, b: false });
    expect(s.flags).toEqual({ a: true });
  });
});

describe('editorState — zone d’effet : presentation/id (#841 FU-B, le nœud)', () => {
  it('une zone posée à l’outil, patchée presentation:"interior", satisfait le filtre "Pièces révélées" (Inspector.tsx)', () => {
    const { scene, idx } = addEffectZone(emptyScene(6, 6), { x: 0, y: 0, w: 2, h: 2 });
    // La zone créée à l'outil porte un `onCross` (piège par défaut) : la vider est le geste qui la rend
    // DESCRIPTIVE (nom de pièce) — exactement ce que fait l'inspecteur en vidant le GameOpEditor.
    const asRoom = { ...scene, effectZones: scene.effectZones!.map((z, i) => (i === idx ? { ...z, onCross: undefined, presentation: 'interior' as const } : z)) };
    const zone = asRoom.effectZones![idx];
    // Prédicat EXACT de `RoomZoneSelect`/`roomZones` (Inspector.tsx:166-170) et de `roomFocus.ts`.
    expect(zone.presentation === 'interior' && isDescriptiveZone(zone)).toBe(true);
    expect(JSON.parse(JSON.stringify(asRoom)).effectZones[idx].presentation).toBe('interior'); // survit au JSON
  });

  it('renameEffectZone renomme l’id ET repropage la référence dans FacadeSection.roomZoneIds', () => {
    const { scene, idx } = addEffectZone(emptyScene(6, 6), { x: 0, y: 0, w: 2, h: 2 });
    const oldId = scene.effectZones![idx].id;
    const withFacade: Scene = {
      ...scene,
      architecture: [{
        id: 'corps-0',
        style: 'maison',
        storeys: [],
        facades: [{ id: 'facade-0', z: 0, edges: [], appearance: 'crepi', roomZoneIds: [oldId] }],
        masses: [],
      }],
    };
    const renamed = renameEffectZone(withFacade, oldId, 'salle-du-tresor');
    expect(renamed.effectZones![idx].id).toBe('salle-du-tresor');
    expect(renamed.architecture![0].facades[0].roomZoneIds).toEqual(['salle-du-tresor']);
  });

  it('renameEffectZone est un no-op si id absent, vide, identique ou en collision', () => {
    const { scene, idx } = addEffectZone(emptyScene(6, 6), { x: 0, y: 0, w: 2, h: 2 });
    const oldId = scene.effectZones![idx].id;
    const { scene: scene2 } = addEffectZone(scene, { x: 3, y: 3, w: 2, h: 2 });
    const dupeId = scene2.effectZones![1].id;
    expect(renameEffectZone(scene2, 'inexistant', 'x')).toBe(scene2);
    expect(renameEffectZone(scene2, oldId, '  ')).toBe(scene2);
    expect(renameEffectZone(scene2, oldId, oldId)).toBe(scene2);
    expect(renameEffectZone(scene2, oldId, dupeId)).toBe(scene2);
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
