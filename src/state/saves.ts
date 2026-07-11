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
 *
 * Les règles maison (surcharges de `policy.ts`, hors GameState) voyagent à part dans `rules` :
 * une save reste portable d'une machine à l'autre AVEC ses règles (le localStorage ne suffit pas).
 *
 * POLITIQUE DE MIGRATION (#301) — deux filets DISTINCTS et complémentaires :
 * 1. Champs manquants (donnée AJOUTÉE depuis la save) : tolérés gratuitement par le zustand `set`
 *    au chargement (`applyLoadedSave`, `store.ts`) — un champ absent du snapshot chargé garde sa
 *    valeur d'`initialFields` (`stateFields.ts`), jamais `undefined`.
 * 2. Renommage / restructuration (donnée qui a changé de FORME) : `SAVE_VERSION` + `MIGRATIONS`
 *    ci-dessous, chaînées par la primitive générique `migrateDoc` (`migrateDoc.ts` — même mécanique
 *    que `worldMap.ts` ProjectDoc/`schema` et `roster.ts` ROSTER_MIGRATIONS/`EXPORT_VERSION`, à
 *    RÉUTILISER plutôt que réinventer pour tout futur document versionné). Chaque bump de
 *    `SAVE_VERSION` DOIT ajouter l'entrée `MIGRATIONS[N]` correspondante ET une fixture golden
 *    `v(N+1)-*.json` sous `__fixtures__/saves/` — le CLIQUET de `saves-flow.test.ts` échoue sinon.
 *    Une version FUTURE (save plus récente que l'app) ou un trou dans la chaîne sont REFUSÉS
 *    (`null`), jamais silencieusement corrompus.
 */
import type { RuleValue } from '../engine/policy';
import { migrateDoc, type MigrationMap } from './migrateDoc';
import { remapCharKeysDeep } from './charKeyMigration';

export const SAVE_VERSION = 4;

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
  /** Surcharges de règles maison (`policy.ts`) actives à la sauvegarde — optionnel : une save
   *  d'avant ce champ n'en a pas (on garde alors les règles courantes de la machine au chargement). */
  rules?: Record<string, RuleValue>;
}

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;
const KEY = (slot: AnySlot) => `wfrp4.save.v${SAVE_VERSION}.${slot}`;

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
  rules: Record<string, RuleValue> = {},
): SaveGame {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(initial)) {
    const v = state[k];
    if (typeof v === 'function') continue;
    data[k] = v === undefined ? null : v;
  }
  const scene = state.scene as { nom?: string; id?: string } | null;
  return {
    version: SAVE_VERSION,
    savedAt,
    sceneLabel: scene?.nom ?? scene?.id ?? 'Sans scène',
    gameTime: typeof state.gameTime === 'number' ? state.gameTime : 0,
    data: JSON.parse(JSON.stringify(data)) as Record<string, unknown>, // deep copy JSON-sûre
    rules: { ...rules },
  };
}

// ── Règles maison dans le snapshot COOP (parité hôte/invité) ──────────────────────────────────
// Le snapshot réseau n'a qu'un champ `data` opaque (cf. net/session) : les surcharges de `policy.ts`
// y voyagent sous une clé RÉSERVÉE. Helpers PURS (testés), réutilisés par netFlow.

/** Clé réservée du payload coop transportant les règles maison (hors GameState). */
export const HOUSE_RULES_KEY = '__houseRules';

/** Joint les règles maison au snapshot coop (sous la clé réservée). */
export function packHouseRules(data: Record<string, unknown>, rules: Record<string, RuleValue>): Record<string, unknown> {
  return { ...data, [HOUSE_RULES_KEY]: rules };
}

/** Sépare les règles maison du reste de l'état (clé réservée retirée de `game` → pas de pollution). */
export function unpackHouseRules(data: Record<string, unknown>): { game: Record<string, unknown>; rules?: Record<string, RuleValue> } {
  const { [HOUSE_RULES_KEY]: rules, ...game } = data;
  return { game, rules: rules as Record<string, RuleValue> | undefined };
}

/** Validation de forme d'une save (version + data objet). */
export function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === SAVE_VERSION
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

/** Migrations SÉQUENTIELLES : la clé N met à niveau une save vN → v(N+1). À CHAQUE bump de
 *  `SAVE_VERSION`, ajouter ici l'entrée correspondante — sinon les saves antérieures seront refusées
 *  (jamais corrompues en silence). Chaînée par `migrateDoc` (primitive générique, `migrateDoc.ts`). */
export const MIGRATIONS: MigrationMap = {
  // v1 → v2 : les saves d'avant la carte de campagne (#T2 / Arène 2.0) portaient une carte VIDE
  // (places: []) — la restaurer écraserait celle du projet courant et ferait DISPARAÎTRE le bouton
  // de carte (recette : « la map n'apparaît pas »). Une carte sans lieux = pas de carte : on laisse
  // la base (état initial = campagne intégrée) la fournir, en supprimant la clé de la save.
  1: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    const wm = data.worldMap as { places?: unknown[] } | null | undefined;
    if (!wm || !wm.places?.length) delete data.worldMap;
    return { ...doc, version: 2, data };
  },
  // v2 → v3 : renommage CharKey → slugs pleins (#311, `CC`/`CT`/`F`/`E`/`I`/`Ag`/`Dex`/`Int`/`FM`/`Soc`
  // → `capacite-de-combat`/… ) — remappe RÉCURSIVEMENT tout l'état (party/vessel/travelPlan/scene…).
  2: (doc) => ({ ...doc, version: 3, data: remapCharKeysDeep(doc.data) as Record<string, unknown> }),
  // v3 → v4 (#275 Ronde 2 cran 3) : voyage MARITIME basculé sur le pipeline cascade — l'ancien FSM
  // `SeaVoyageState.step` et le Test d'équipage de VOYAGE (`PendingCrewTest.voyage`/`.resolved`) MEURENT.
  // `pendingCrewTest` ne sert plus QU'AU COMBAT — or une save est HORS COMBAT (saves.ts l.10, `battle`
  // refusé non-null) : tout `pendingCrewTest` présent dans une save v3 est donc NÉCESSAIREMENT un Test de
  // VOYAGE (le seul chemin hors-combat de l'ancien mécanisme) → toujours DROPPÉ (`null`), jamais réinjecté
  // dans le combat qui n'en a plus l'usage. `travelPlan.sea` EN VOL (une journée déjà entamée, `step` ≠
  // absent) : arbitrage SIMPLE accepté (#275 Ronde 2, cran 3 — migrer le point de reprise EXACT est non
  // trivial, la primitive de reprise est désormais `pendingCascade`, pas une donnée reconstructible hors
  // contexte) — la journée EN VOL est remise à son ÉTAT DE DÉPART (milles/voiles/phare/PV du jour à zéro,
  // `step` supprimé) : rien n'est dupliqué ni corrompu, la traversée reprend proprement au prochain
  // `runSeaDay` (Test de Progression du jour, RAW ch.13/15 inchangé) — au pire une journée « recommencée ».
  3: (doc) => {
    const data = { ...(doc.data as Record<string, unknown>) };
    if (data.pendingCrewTest != null) data.pendingCrewTest = null;
    const plan = data.travelPlan as { sea?: Record<string, unknown> } | null | undefined;
    if (plan?.sea) {
      const { step: _step, sailsDown: _sailsDown, lighthouseDR: _lighthouseDR, entries: _entries, paceToday: _paceToday, eventMMod: _eventMMod, minorDrift: _minorDrift, ...seaRest } = plan.sea;
      data.travelPlan = { ...plan, sea: { ...seaRest, milesToday: 0, sailsDown: false, lighthouseDR: 0, entries: [] } };
    }
    return { ...doc, version: 4, data };
  },
};

/** Met une save parsée au niveau `SAVE_VERSION` AVANT validation (point d'upgrade UNIQUE, via la
 *  primitive générique `migrateDoc`). Un bump de version ne jette donc plus les anciennes saves en
 *  silence : elles passent par la chaîne `MIGRATIONS`. Renvoie null si : pas un objet, version
 *  absente/non numérique, version FUTURE (on ne devine pas une structure plus récente), trou dans la
 *  chaîne, ou forme finale invalide. */
export function migrateSave(parsed: unknown): SaveGame | null {
  const save = migrateDoc(parsed, SAVE_VERSION, MIGRATIONS);
  return save && isValidSave(save) ? (save as unknown as SaveGame) : null;
}

export function saveToSlot(slot: AnySlot, save: SaveGame): boolean {
  try {
    storage()?.setItem(KEY(slot), JSON.stringify(save));
    return readSlot(slot) != null; // confirme l'écriture (quota plein → null)
  } catch {
    return false;
  }
}

export function readSlot(slot: AnySlot): SaveGame | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY(slot));
    if (!raw) return null;
    return migrateSave(JSON.parse(raw)); // upgrade éventuel puis validation
  } catch {
    return null;
  }
}

export function deleteSlot(slot: AnySlot): void {
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

/** Import : parse + migration éventuelle + validation (null si invalide ou version inconnue/future). */
export function importSave(json: string): SaveGame | null {
  try {
    return migrateSave(JSON.parse(json));
  } catch {
    return null;
  }
}
