/**
 * Sauvegarde / chargement de partie (Jalon 5) — localStorage + export/import JSON.
 *
 * Snapshot ZÉRO-MAINTENANCE : on copie les clés de DONNÉES de `getInitialState()` depuis l'état
 * courant (toute nouvelle donnée d'état future est sauvée gratis — même principe que le reset de
 * partie, cf. game-newgame-reset-pattern) ; les actions (fonctions zustand) sont ignorées.
 * La scène vivante (mutée : fouilles consommées, entités retirées…), les flags, l'inventaire,
 * l'horloge et le groupe voyagent donc dans la save.
 *
 * Sauvegarde HORS COMBAT uniquement (battle non-null refusé par l'action store) : l'état
 * tactique suspendu (IA, modales de combat) n'est pas un point de reprise sûr.
 */
export const SAVE_VERSION = 1;

export interface SaveMeta {
  version: number;
  /** ISO — horodatage réel de la sauvegarde (méta d'affichage). */
  savedAt: string;
  /** Étiquette du slot (nom de la scène courante). */
  sceneLabel: string;
  /** Horloge de jeu (minutes) au moment de la sauvegarde. */
  gameTime: number;
}

export interface SaveGame extends SaveMeta {
  /** Clés de données de GameState (deep-copiées, JSON-sûres). */
  data: Record<string, unknown>;
}

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];
const KEY = (slot: SaveSlot) => `wfrp4.save.v${SAVE_VERSION}.${slot}`;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

/** Snapshot des clés de DONNÉES de l'état courant (les fonctions/actions sont ignorées). */
export function snapshotSave(
  state: Record<string, unknown>,
  initial: Record<string, unknown>,
  savedAt: string,
): SaveGame {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(initial)) {
    const v = state[k];
    if (typeof v === 'function') continue;
    data[k] = v === undefined ? null : v;
  }
  const scene = state.scene as { label?: string; id?: string } | null;
  return {
    version: SAVE_VERSION,
    savedAt,
    sceneLabel: scene?.label ?? scene?.id ?? 'Sans scène',
    gameTime: typeof state.gameTime === 'number' ? state.gameTime : 0,
    data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>, // deep copy JSON-sûre
  };
}

/** Validation de forme d'une save (version + data objet). */
export function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === SAVE_VERSION
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

export function saveToSlot(slot: SaveSlot, save: SaveGame): boolean {
  try {
    storage()?.setItem(KEY(slot), JSON.stringify(save));
    return readSlot(slot) != null; // confirme l'écriture (quota plein → null)
  } catch {
    return false;
  }
}

export function readSlot(slot: SaveSlot): SaveGame | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY(slot));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSave(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function deleteSlot(slot: SaveSlot): void {
  try {
    storage()?.removeItem(KEY(slot));
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

/** Métadonnées des 3 slots (null = vide) — pour l'UI de la modale Sauvegarde/Chargement. */
export function listSaves(): ({ slot: SaveSlot } & SaveMeta | null)[] {
  return SAVE_SLOTS.map((slot) => {
    const s = readSlot(slot);
    return s ? { slot, version: s.version, savedAt: s.savedAt, sceneLabel: s.sceneLabel, gameTime: s.gameTime } : null;
  });
}

/** Export : JSON lisible (téléchargement / presse-papier). */
export function exportSave(save: SaveGame): string {
  return JSON.stringify(save, null, 2);
}

/** Import : parse + validation stricte (null si invalide ou version inconnue). */
export function importSave(json: string): SaveGame | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return isValidSave(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
