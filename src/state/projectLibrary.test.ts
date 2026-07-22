import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectsLoad, projectSave, projectRemove, publishedProjects, initLibrary, __resetLibraryForTest, SavedProject } from './projectLibrary';
import { Scene } from './scene';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const scene = (id: string): Scene => ({ id, nom: id }) as unknown as Scene;
const proj = (id: string, label = 'Projet', published = false): SavedProject => ({
  id,
  label,
  startSceneId: 's1',
  savedAt: 1000,
  published,
  project: { schema: 2, scenes: [scene('s1')] },
});

describe('projectLibrary — bibliothèque de projets éditeur (localStorage)', () => {
  beforeEach(async () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    await __resetLibraryForTest(); // cache module-level : reparte propre (isolation)
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('vide au départ', () => {
    expect(projectsLoad()).toEqual([]);
    expect(publishedProjects()).toEqual([]);
  });

  it('projectSave puis projectsLoad : le projet est retrouvé', () => {
    projectSave(proj('p1', 'La Diligence'));
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p1');
    expect(list[0].label).toBe('La Diligence');
    expect(list[0].project.scenes[0].id).toBe('s1');
  });

  it('projectSave avec le même id remplace (pas de doublon)', () => {
    projectSave(proj('p1', 'Avant'));
    projectSave(proj('p1', 'Après'));
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Après');
  });

  it('projectRemove retire l’entrée visée et garde les autres', () => {
    projectSave(proj('p1'));
    projectSave(proj('p2'));
    projectRemove('p1');
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p2');
  });

  it('publishedProjects ne renvoie que les projets publiés', () => {
    projectSave(proj('p1', 'Brouillon', false));
    projectSave(proj('p2', 'Publiée', true));
    const pub = publishedProjects();
    expect(pub).toHaveLength(1);
    expect(pub[0].id).toBe('p2');
  });

  it('stockage corrompu (JSON invalide ou pas un tableau) → []', () => {
    localStorage.setItem('wfrp4.editor-projects.v1', '{pas du json');
    expect(projectsLoad()).toEqual([]);
    localStorage.setItem('wfrp4.editor-projects.v1', '{"a":1}');
    expect(projectsLoad()).toEqual([]);
  });

  it('entrées invalides filtrées au chargement', () => {
    localStorage.setItem(
      'wfrp4.editor-projects.v1',
      JSON.stringify([
        null,
        42,
        { id: 'ok', name: 'X', startSceneId: 's1', savedAt: 1, published: false, project: { schema: 2, scenes: [{ id: 's1' }] } },
        { id: 'bad' }, // pas de project.scenes
      ]),
    );
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('ok');
  });

  it('repli IDEMPOTENT (#608) : une entrée legacy `name` (pré-renommage) migre en `label` à la '
    + 'lecture — sans casser un projet déjà enregistré', () => {
    localStorage.setItem(
      'wfrp4.editor-projects.v1',
      JSON.stringify([
        { id: 'p1', name: 'Legacy', startSceneId: 's1', savedAt: 1, published: false, project: { schema: 2, scenes: [{ id: 's1' }] } },
      ]),
    );
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Legacy');
    expect((list[0] as unknown as { name?: string }).name).toBeUndefined();
  });

  it('migration one-time : localStorage pré-peuplé + initLibrary() → cache le sert (repli sans IndexedDB en jsdom)', async () => {
    localStorage.setItem(
      'wfrp4.editor-projects.v1',
      JSON.stringify([
        { id: 'p1', label: 'Ancienne', startSceneId: 's1', savedAt: 1, published: true, project: { schema: 2, scenes: [{ id: 's1' }] } },
      ]),
    );
    await initLibrary();
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p1');
    expect(list[0].label).toBe('Ancienne');
    expect(publishedProjects()).toHaveLength(1);
  });

  it('sans localStorage : load → [], save/remove ne jettent pas', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(projectsLoad()).toEqual([]);
    expect(() => projectSave(proj('p1'))).not.toThrow();
    expect(() => projectRemove('p1')).not.toThrow();
  });
});
