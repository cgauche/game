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
 * POLITIQUE DE VERSION (arbitrage utilisateur 2026-08-17) — deux filets DISTINCTS :
 * 1. Champs manquants (donnée AJOUTÉE depuis la save) : tolérés gratuitement par le zustand `set`
 *    au chargement (`applyLoadedSave`, `store.ts`) — un champ absent du snapshot chargé garde sa
 *    valeur d'`initialFields` (`stateFields.ts`), jamais `undefined`.
 * 2. Changement de FORME persistée : bump de `SAVE_VERSION`, et RIEN d'autre — aucune chaîne de
 *    migration, aucune fixture golden. Une save dont la version diffère de `SAVE_VERSION`
 *    (antérieure comme future) est REJETÉE et RETIRÉE du stockage à la lecture (`readSlot`), avec
 *    un message au joueur (témoin `takeObsoleteNotice`, rendu par `ui/SaveLoadModal`).
 */
import type { RuleValue } from '../engine/policy';

export const SAVE_VERSION = 27;

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
// #898 : la clé n'embarque plus la version (un bump de `SAVE_VERSION` rendait toute save existante
// invisible — `readSlot`/`listSaves` sondaient une clé qui n'avait jamais été écrite). La version vit
// SEULE dans le contenu (`SaveGame.version`). `LEGACY_KEY` ne sert plus qu'à NETTOYER les clés
// versionnées écrites par le code d'avant #898 : aucune ne porte la version courante.
const KEY = (slot: AnySlot) => `wfrp4.save.${slot}`;
const LEGACY_KEY = (version: number, slot: AnySlot) => `wfrp4.save.v${version}.${slot}`;

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
    // `campaignNarratif` (#767) = couche runtime posée par `loadProject`, non embarquée au snapshot :
    // sa persistance (forme + golden + bump `SAVE_VERSION`) est le périmètre de #766.
    if (k === 'campaignNarratif') continue;
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

/** Validation de forme d'une save (version COURANTE + data objet). */
export function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === SAVE_VERSION
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

/** Lit un document de save parsé : la version DOIT être `SAVE_VERSION`. Toute autre version —
 *  antérieure comme future — et toute forme invalide rendent `null`. */
export function parseSave(parsed: unknown): SaveGame | null {
  return isValidSave(parsed) ? parsed : null;
}

/** CAUSE du rejet d'une sauvegarde — l'écran de chargement en fait un message DISTINCT : la save
 *  d'une version antérieure, celle d'une version plus récente (retour à un build ancien) et le
 *  contenu illisible ne se disent pas d'un même mot. */
export type ObsoleteCause = 'anterieure' | 'future' | 'illisible';

/** Témoin « une sauvegarde a été trouvée puis retirée » + sa cause — posé par `readSlot`, consommé
 *  par l'écran de chargement. La PREMIÈRE cause d'une salve de lectures (`listSaves` en balaie trois)
 *  est celle qui parle : elle correspond à l'emplacement le plus haut de la liste. */
let obsoleteCause: ObsoleteCause | null = null;

/** Consomme le témoin de rejet (et le remet à zéro) — la cause si une save a été retirée du stockage
 *  depuis la dernière consommation, `null` sinon. */
export function takeObsoleteNotice(): ObsoleteCause | null {
  const c = obsoleteCause;
  obsoleteCause = null;
  return c;
}

/** Clé de mise à l'écart d'une save FUTURE, écrite par le code d'AVANT l'arbitrage 2026-08-17 (une
 *  save plus récente que l'app y était sauvegardée avant écrasement). Plus personne ne l'écrit : elle
 *  n'est plus qu'à PURGER, comme le reste de l'emplacement. */
const FUTURE_KEY = (slot: AnySlot) => `wfrp4.save.future.${slot}`;

/** TOUTES les clés de stockage d'un emplacement : la clé stable, la clé de QUARANTAINE historique et
 *  les clés VERSIONNÉES historiques (`wfrp4.save.vN.slot`, #898). */
function slotKeys(slot: AnySlot): string[] {
  const keys = [KEY(slot), FUTURE_KEY(slot)];
  for (let v = 1; v <= SAVE_VERSION; v++) keys.push(LEGACY_KEY(v, slot));
  return keys;
}

/** JETTE le contenu d'un emplacement (toutes ses clés) et pose le témoin de message avec sa cause. Un
 *  stockage qui refuse la suppression ne fait pas échouer la lecture — le message part quand même. */
function discardSlot(s: Storage, slot: AnySlot, cause: ObsoleteCause): void {
  obsoleteCause ??= cause;
  try {
    for (const k of slotKeys(slot)) s.removeItem(k);
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

export function saveToSlot(slot: AnySlot, save: SaveGame): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY(slot), JSON.stringify(save));
    return s.getItem(KEY(slot)) != null; // confirme l'écriture (quota plein → null)
  } catch {
    return false;
  }
}

/** Cause du rejet d'un document parsé dont la forme n'est pas celle d'une save COURANTE : la version
 *  la dit quand elle est lisible, sinon le document est simplement illisible. */
function causeOf(parsed: unknown): ObsoleteCause {
  const v = (parsed as { version?: unknown } | null | undefined)?.version;
  if (typeof v !== 'number') return 'illisible';
  return v > SAVE_VERSION ? 'future' : 'anterieure';
}

/** Cause du rejet d'un emplacement SANS clé stable mais dont une clé résiduelle survit : la clé de
 *  quarantaine ne portait que des saves FUTURES, une clé versionnée que des versions antérieures. */
function residualCause(s: Storage, slot: AnySlot): ObsoleteCause | null {
  if (s.getItem(FUTURE_KEY(slot)) != null) return 'future';
  return slotKeys(slot).some((k) => s.getItem(k) != null) ? 'anterieure' : null;
}

/** Lit l'emplacement : une save à `SAVE_VERSION`, ou `null`. Tout contenu d'une AUTRE version (clé
 *  stable, clé de quarantaine ou clé versionnée historique) ou illisible est JETÉ, témoin posé. */
export function readSlot(slot: AnySlot): SaveGame | null {
  const s = storage();
  if (!s) return null;
  let raw: string | null;
  try {
    raw = s.getItem(KEY(slot));
  } catch {
    return null;
  }
  if (raw == null) {
    try {
      const cause = residualCause(s, slot);
      if (cause) discardSlot(s, slot, cause);
    } catch {
      // stockage devenu indisponible en cours de sondage : rien à jeter
    }
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    discardSlot(s, slot, 'illisible'); // contenu illisible : il ne redeviendra jamais chargeable
    return null;
  }
  const save = parseSave(parsed);
  if (!save) {
    discardSlot(s, slot, causeOf(parsed));
    return null;
  }
  // La save est valide, mais une clé résiduelle d'un ancien code peut encore squatter l'emplacement.
  try {
    for (const k of slotKeys(slot)) if (k !== KEY(slot) && s.getItem(k) != null) s.removeItem(k);
  } catch {
    // stockage indisponible : rien à nettoyer
  }
  return save;
}

export function deleteSlot(slot: AnySlot): void {
  try {
    const s = storage();
    if (!s) return;
    for (const k of slotKeys(slot)) s.removeItem(k);
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

/** Import : parse + validation (null si invalide ou d'une AUTRE version que `SAVE_VERSION`). */
export function importSave(json: string): SaveGame | null {
  try {
    return parseSave(JSON.parse(json));
  } catch {
    return null;
  }
}
