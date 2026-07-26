import { describe, it, expect, beforeEach } from 'vitest';
import {
  autosaveLoad,
  autosaveSave,
  autosaveDelete,
  __setAutosaveBackendForTest,
  __resetAutosaveForTest,
  type EditorAutosaveBackend,
  type EditorAutosaveRecord,
} from './editorAutosave';
import { emptyScene } from './scene';

/** Backend en mémoire pour les tests — même contrat que `EditorAutosaveBackend` (cf. `projectLibrary.test.ts`). */
function fakeBackend(): EditorAutosaveBackend & { store: Map<string, EditorAutosaveRecord> } {
  const store = new Map<string, EditorAutosaveRecord>();
  return {
    store,
    async get(sceneId) {
      return store.get(sceneId) ?? null;
    },
    async put(entry) {
      store.set(entry.sceneId, entry);
    },
    async delete(sceneId) {
      store.delete(sceneId);
    },
    async clear() {
      store.clear();
    },
  };
}

describe('editorAutosave — filet local de crash de l’éditeur', () => {
  beforeEach(async () => {
    await __resetAutosaveForTest();
  });

  it('aller-retour : sauvegarde puis relecture de la MÊME scène (round-trip)', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const scene = { ...emptyScene(), id: 'scene-a', nom: 'Auberge' };
    await autosaveSave({ sceneId: scene.id, scene, savedAt: 123 });
    const rec = await autosaveLoad('scene-a');
    expect(rec).not.toBeNull();
    expect(rec!.scene.nom).toBe('Auberge');
    expect(rec!.savedAt).toBe(123);
    __setAutosaveBackendForTest(null);
  });

  it('ré-enregistrer la même scène écrase la version précédente (upsert par id)', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const scene = { ...emptyScene(), id: 'scene-a' };
    await autosaveSave({ sceneId: scene.id, scene: { ...scene, nom: 'v1' }, savedAt: 1 });
    await autosaveSave({ sceneId: scene.id, scene: { ...scene, nom: 'v2' }, savedAt: 2 });
    expect(backend.store.size).toBe(1);
    const rec = await autosaveLoad('scene-a');
    expect(rec!.scene.nom).toBe('v2');
    __setAutosaveBackendForTest(null);
  });

  it('autosaveDelete retire la sauvegarde — plus rien à relire ensuite', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const scene = { ...emptyScene(), id: 'scene-a' };
    await autosaveSave({ sceneId: scene.id, scene, savedAt: 1 });
    await autosaveDelete('scene-a');
    expect(await autosaveLoad('scene-a')).toBeNull();
    __setAutosaveBackendForTest(null);
  });

  it('scènes distinctes = entrées distinctes (keyé par sceneId, jamais un slot unique)', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    await autosaveSave({ sceneId: 'scene-a', scene: { ...emptyScene(), id: 'scene-a', nom: 'A' }, savedAt: 1 });
    await autosaveSave({ sceneId: 'scene-b', scene: { ...emptyScene(), id: 'scene-b', nom: 'B' }, savedAt: 1 });
    expect((await autosaveLoad('scene-a'))!.scene.nom).toBe('A');
    expect((await autosaveLoad('scene-b'))!.scene.nom).toBe('B');
    __setAutosaveBackendForTest(null);
  });

  it('lecture/écriture best-effort : un backend qui rejette ne fait jamais throw', async () => {
    const failing: EditorAutosaveBackend = {
      get: async () => { throw new Error('boom'); },
      put: async () => { throw new Error('boom'); },
      delete: async () => { throw new Error('boom'); },
      clear: async () => { throw new Error('boom'); },
    };
    __setAutosaveBackendForTest(failing);
    await expect(autosaveSave({ sceneId: 'x', scene: emptyScene(), savedAt: 1 })).resolves.toBeUndefined();
    await expect(autosaveLoad('x')).resolves.toBeNull();
    await expect(autosaveDelete('x')).resolves.toBeUndefined();
    __setAutosaveBackendForTest(null);
  });
});
