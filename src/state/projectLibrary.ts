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
  label: string;
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

/** `SavedProject` : nom du projet (top-level, discriminant `startSceneId`+`published`+`project`). */
function isProjectLike(o: Record<string, unknown>): boolean {
  return typeof o.id === 'string' && typeof o.startSceneId === 'string'
    && typeof o.published === 'boolean' && !!o.project;
}

/** `CustomStatblock` (`state/scene.ts`) embarqué dans `project.scenes[].entities[].statblock` — même
 *  discriminant que le formulaire d'édition (`char` structuré, aucun autre porteur de ce dépôt n'a ce
 *  champ). Distinct des `SceneOp` `setVessel`/`adjustVessel` (`name?` d'AUTEUR, hors renommage — leur
 *  forme n'a pas de `char`, jamais reconnue ici). */
function isStatblockLike(o: Record<string, unknown>): boolean {
  return typeof o.char === 'object' && o.char !== null && !Array.isArray(o.char);
}

/** Renommage `name` → `label` (#608) des DEUX porteurs authorés d'un projet éditeur sérialisé —
 *  l'entrée de bibliothèque elle-même (`SavedProject.name`) et tout `CustomStatblock` embarqué dans ses
 *  scènes. `projectLibrary.ts` n'a AUCUNE chaîne `SAVE_VERSION`/`MIGRATIONS` (liste nue en
 *  localStorage, contrairement à `saves.ts`) : repli IDEMPOTENT à chaque lecture, patron
 *  `roster.ts`/`remapNameToLabelDeep` — un projet déjà migré (ou jamais affecté) traverse en no-op. */
export function remapProjectNamesDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapProjectNamesDeep);
  if (!node || typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  const bearer = isProjectLike(o) || isStatblockLike(o);
  if (bearer && typeof o.name === 'string' && !('label' in o)) {
    const { name, ...rest } = o;
    return Object.fromEntries(
      Object.entries({ label: name, ...rest }).map(([k, v]) => [k, remapProjectNamesDeep(v)]),
    );
  }
  if (bearer && o.label !== undefined && 'name' in o) {
    const { name: _drop, ...rest } = o;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, remapProjectNamesDeep(v)]));
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, remapProjectNamesDeep(v)]));
}

export function projectsLoad(): SavedProject[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return (remapProjectNamesDeep(arr) as unknown[]).filter(
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
