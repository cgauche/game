import { Scene } from './scene';
import type { WorldMap } from './worldMap';

/** Un projet éditeur sérialisé (même forme que l'export JSON v2 : scènes + carte du monde). */
export interface ProjectV2 {
  schema: 2;
  scenes: Scene[];
  worldMap?: WorldMap;
}

/** Une entrée de la bibliothèque de projets (localStorage). `published` = jouable depuis le menu. */
export interface SavedProject {
  id: string;
  name: string;
  startSceneId: string; // scène de départ quand on JOUE la campagne
  savedAt: number;
  published: boolean;
  project: ProjectV2;
}

const KEY = 'wfrp4.editor-projects.v1';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

export function projectsLoad(): SavedProject[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is SavedProject =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as SavedProject).id === 'string' &&
        Array.isArray((e as SavedProject).project?.scenes),
    );
  } catch {
    return [];
  }
}

/** Upsert par id (un même projet ré-enregistré écrase l'ancien). */
export function projectSave(entry: SavedProject): void {
  save([...projectsLoad().filter((e) => e.id !== entry.id), entry]);
}

export function projectRemove(id: string): void {
  save(projectsLoad().filter((e) => e.id !== id));
}

/** Les projets marqués « publiés » — proposés au menu principal comme campagnes jouables. */
export function publishedProjects(): SavedProject[] {
  return projectsLoad().filter((e) => e.published);
}

function save(list: SavedProject[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas l'édition pour ça
  }
}
