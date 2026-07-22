import type { ProjectDoc } from './worldMap';
import type { NarratifBlock } from './campaignNarratif';

/** Un projet éditeur SÉRIALISÉ en localStorage. Même forme que `ProjectDoc` (SOURCE UNIQUE du schéma
 *  de projet — plus de littéral `schema`/champs dupliqués), mais RELÂCHÉE pour le stock legacy : un
 *  projet enregistré avant #765 est un schema 2 sans `narratif`. La montée au format courant se fait
 *  au CHARGEMENT via `parseProject` (migration 2→3), jamais dans ce module. */
export type StoredProject = Omit<ProjectDoc, 'schema' | 'narratif'> & {
  schema: 2 | 3;
  narratif?: NarratifBlock;
};

/** Une entrée de la bibliothèque de projets (localStorage). `published` = jouable depuis le menu. */
export interface SavedProject {
  id: string;
  label: string;
  startSceneId: string; // scène de départ quand on JOUE la campagne
  savedAt: number;
  published: boolean;
  project: StoredProject;
}

const KEY = 'wfrp4.editor-projects.v1';
const MIGRATED_KEY = 'wfrp4.editor-projects.migrated-idb.v1';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

// ── Backend IndexedDB (une source de vérité pour les grosses campagnes qui dépassent localStorage) ──
// Patron `data/fsPersist.ts`. Un record par projet (clé = `id`), scalable à N grandes campagnes.
// GARDE : `indexedDB` absent (jsdom/node de test, SSR) → toutes ces fonctions NO-OP proprement,
// le `cache` mémoire reste alors l'unique source servie en SYNC.
const DB = 'wfrp4-library';
const STORE = 'projects';
const HAS_IDB = typeof indexedDB !== 'undefined';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAll(): Promise<SavedProject[]> {
  if (!HAS_IDB) return [];
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    r.onsuccess = () => resolve(r.result as SavedProject[]);
    r.onerror = () => reject(r.error);
  });
}
async function idbPut(entry: SavedProject): Promise<void> {
  if (!HAS_IDB) return;
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(id: string): Promise<void> {
  if (!HAS_IDB) return;
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbClear(): Promise<void> {
  if (!HAS_IDB) return;
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cache mémoire = source SYNC servie au picker/éditeur/tests. `null` tant qu'`initLibrary` n'a rien chargé. */
let cache: SavedProject[] | null = null;

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

/** Lecture SYNC de secours (localStorage) : sert tant que `cache` vaut `null`, et reste le filet
 *  de sécurité gardé pour la migration one-time vers IndexedDB. */
function readLocalStorage(): SavedProject[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return (remapProjectNamesDeep(arr) as unknown[]).filter(isSavedProject);
  } catch {
    return [];
  }
}

function isSavedProject(e: unknown): e is SavedProject {
  return (
    !!e &&
    typeof e === 'object' &&
    typeof (e as SavedProject).id === 'string' &&
    Array.isArray((e as SavedProject).project?.scenes)
  );
}

/**
 * Charge la bibliothèque en `cache` depuis IndexedDB (source de vérité). À AWAITER une fois au
 * démarrage (`main.tsx`) AVANT le premier rendu. NE REJETTE JAMAIS : toute erreur retombe sur la
 * lecture localStorage. Migration ONE-TIME idempotente (flag `MIGRATED_KEY`) : IndexedDB vide +
 * localStorage peuplé → recopie vers IndexedDB (localStorage conservé en filet).
 */
export async function initLibrary(): Promise<void> {
  try {
    if (!HAS_IDB) {
      cache = readLocalStorage();
      return;
    }
    const stored = (remapProjectNamesDeep(await idbGetAll()) as unknown[]).filter(isSavedProject);
    const legacy = readLocalStorage();
    const migrated = storage()?.getItem(MIGRATED_KEY) === '1';
    if (stored.length === 0 && legacy.length > 0 && !migrated) {
      await Promise.all(legacy.map(idbPut));
      try { storage()?.setItem(MIGRATED_KEY, '1'); } catch { /* quota/absent */ }
      cache = legacy;
      return;
    }
    cache = stored;
  } catch {
    cache = readLocalStorage();
  }
}

export function projectsLoad(): SavedProject[] {
  return cache ?? readLocalStorage();
}

/** Upsert par id (un même projet ré-enregistré écrase l'ancien). SYNC dans le cache, persistance async. */
export function projectSave(entry: SavedProject): void {
  cache = [...projectsLoad().filter((e) => e.id !== entry.id), entry];
  void idbPut(entry).catch(() => { /* persistance best-effort : le cache reste servi */ });
}

export function projectRemove(id: string): void {
  cache = projectsLoad().filter((e) => e.id !== id);
  void idbDelete(id).catch(() => { /* persistance best-effort : le cache reste servi */ });
}

/** Les projets marqués « publiés » — proposés au menu principal comme campagnes jouables. */
export function publishedProjects(): SavedProject[] {
  return projectsLoad().filter((e) => e.published);
}

/** Test-only : réinitialise le cache module-level (et vide IndexedDB si présent) pour l'isolation. */
export async function __resetLibraryForTest(): Promise<void> {
  cache = null;
  await idbClear().catch(() => { /* idb absent en jsdom */ });
}
