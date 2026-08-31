// @vitest-environment jsdom
/**
 * `parseProject` est la porte UNIQUE des documents de projet (JSON committé, bibliothèque locale,
 * import de l'auteur — `src/data/schemas/validate.ts`). Ce que le chemin d'ÉCRITURE de l'éditeur
 * produit doit donc repasser cette porte : un projet que l'application écrit et ne peut plus rouvrir
 * est une perte de travail. Le round-trip est mesuré sur le chemin RÉEL (« Fichier → Enregistrer »
 * de `<Editor>` → `projectSave` → document capturé au dos d'IndexedDB), jamais sur un document forgé.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { __setIdbBackendForTest, type IdbBackend, type SavedProject } from '../../state/projectLibrary';
import { parseProject } from '../../state/worldMap';
import { emptyScene, type Scene } from '../../state/scene';
import { Editor } from './Editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  __setIdbBackendForTest(null);
  localStorage.clear();
});

/** Joue « Fichier → Enregistrer… → Enregistrer » sur un éditeur fraîchement monté et rend le
 *  document de projet TEL QU'ÉCRIT par l'application. */
async function enregistreEtCapture(): Promise<SavedProject> {
  const ecrits: SavedProject[] = [];
  const idb: IdbBackend = {
    async getAll() { return [] as SavedProject[]; },
    async put(entry) { ecrits.push(entry); },
    async delete() { /* non exercé */ },
    async clear() { /* non exercé */ },
  };
  __setIdbBackendForTest(idb);

  const initialScene: Scene = { ...emptyScene(4, 4), id: 'scene-round-trip', label: 'Round-trip' };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Editor initialScene={initialScene} />);
  });

  const byText = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
  await act(async () => { byText('Fichier').click(); });
  await act(async () => { byText('Enregistrer…').click(); });
  const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
  await act(async () => { saveBtn.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  await act(async () => { root.unmount(); });
  container.remove();

  expect(ecrits).toHaveLength(1);
  return ecrits[0];
}

describe('Éditeur — un projet ENREGISTRÉ repasse sa propre porte `parseProject`', () => {
  it('sans identité de campagne : le document écrit est relu sans erreur, et son enveloppe ne porte que les clés du schéma', async () => {
    const saved = await enregistreEtCapture();

    // La porte unique relit ce que l'application vient d'écrire.
    expect(() => parseProject(saved.project)).not.toThrow();
    const relu = parseProject(saved.project);
    expect(relu.scenes.map((s) => s.id)).toEqual(['scene-round-trip']);

    // L'éditeur démarre sans identité de campagne : l'enveloppe n'en porte AUCUNE clé.
    expect(saved.project).toMatchObject({ schema: 6 });
    expect(Object.keys(saved.project).sort()).toEqual(['narratif', 'scenes', 'schema']);
  });
});
