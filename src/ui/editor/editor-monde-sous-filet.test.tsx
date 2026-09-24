// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor';
import { emptyScene, type Scene } from '../../state/scene';
import { editeur } from '../../state/editeurBridge';
import {
  __setAutosaveBackendForTest, __resetAutosaveForTest, autosaveSave,
  type EditorAutosaveBackend, type EditorAutosaveRecord,
} from '../../state/editorAutosave';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
  __setAutosaveBackendForTest(null);
});

async function monter(initialScene: Scene): Promise<HTMLDivElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<Editor initialScene={initialScene} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return container;
}

function autosaveEnMemoire(): EditorAutosaveBackend {
  const store = new Map<string, EditorAutosaveRecord>();
  return {
    async get(sceneId) { return store.get(sceneId) ?? null; },
    async put(entry) { store.set(entry.sceneId, entry); },
    async delete(sceneId) { store.delete(sceneId); },
    async clear() { store.clear(); },
  };
}

const MESSAGE = "Le monde de l'éditeur a rencontré une erreur de rendu";

/**
 * FILET DU MONDE DE L'ÉDITEUR — une donnée d'auteur qui fait LEVER le canevas (ici une espèce hors
 * vocabulaire rig, `gameIso/rig/appearance.ts`) n'emporte que le canevas : l'Inspecteur, l'onglet
 * Validation et la barre d'outils restent montés, et corriger la donnée relève le monde sans recharger
 * (la scène est la clé de reprise du `SceneErrorBoundary`).
 */
describe('Éditeur — une levée du monde n’emporte que le monde', () => {
  it('le canevas tombe, l’Inspecteur reste ; corriger la donnée relève le monde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const initialScene: Scene = {
      ...emptyScene(6, 6),
      id: 'filet',
      entities: [{ id: 'pnj-faute', kind: 'personnage', pos: { x: 2, y: 2 }, appearance: { species: 'espece-hors-vocabulaire' } }],
    } as Scene;
    const container = await monter(initialScene);

    expect(container.textContent).toContain(MESSAGE);
    expect(container.querySelector('.insp-title'), 'l’Inspecteur est monté').not.toBeNull();
    expect(container.textContent).toContain('Validation');
    expect(container.textContent).toContain('Fichier ▾');

    await act(async () => { editeur.patcherEntite!('pnj-faute', { appearance: undefined }); });
    expect(container.textContent).not.toContain(MESSAGE);
    expect(container.querySelector('.editor-canvas-wrap svg'), 'le canevas est relevé').not.toBeNull();
  });
});

/**
 * LE FILET DE CRASH NE CONTOURNE PLUS RIEN — la restauration de l'autosave ne passe que par
 * `normalizeScene` (`useEditorAutosave.ts`, `restore`), pas par le schéma : une scène qui porte un
 * décor volumique au cap refusé RENTRE. L'éditeur y survit : le monde la cuit (billboard d'erreur,
 * `buildProps`), l'onglet Validation la nomme.
 */
describe('Éditeur — restaurer une sauvegarde locale fautive', () => {
  it('la scène fautive est réinjectée, le monde tient, la Validation nomme la faute', async () => {
    await __resetAutosaveForTest();
    __setAutosaveBackendForTest(autosaveEnMemoire());
    const fautive: Scene = {
      ...emptyScene(6, 6),
      id: 'scene-autosave-fautive',
      entities: [{ id: 'p3', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau', facing: 'NE' }],
    };
    await autosaveSave({ sceneId: fautive.id, scene: fautive, savedAt: 999 });
    const container = await monter({ ...emptyScene(6, 6), id: fautive.id });

    const restaurer = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Restaurer')!;
    await act(async () => { restaurer.click(); });
    expect(editeur.listerEntites!().find((e) => e.id === 'p3'), 'la restauration a réinjecté la scène fautive').toMatchObject({ ref: 'tonneau' });
    expect(container.textContent).not.toContain(MESSAGE);
    expect(container.querySelector('.editor-canvas-wrap svg'), 'le canevas est monté').not.toBeNull();

    const onglet = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Validation'))!;
    await act(async () => { onglet.click(); });
    expect(container.querySelector('.ed-validation')?.textContent).toContain('décor volumique « tonneau » au cap NE');
  });
});
