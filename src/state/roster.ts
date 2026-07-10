import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import type { CreatorDraft } from '../ui/creator/draft';
import { migrateDoc, type MigrationMap } from './migrateDoc';
import { remapCharKeysDeep } from './charKeyMigration';
import { t } from '../i18n';

/** Roster persistant (localStorage) des personnages créés via le créateur.
 *  Snapshot À LA CRÉATION : le héros tel que sorti de `buildHero`, plus sa
 *  Richesse initiale (créditée au groupe à la création, absente du Combatant —
 *  on la rejoue quand le personnage est repris dans un nouveau groupe).
 *  `draft` (optionnel) = le brouillon EXACT du créateur (tirages figés + choix
 *  étape par étape) : permet de RÉOUVRIR le personnage dans le créateur sans perte
 *  (un Combatant seul ne retient pas ces choix). Absent → édition reconstruite. */
export interface RosterEntry {
  hero: Combatant;
  wealth: Money;
  draft?: CreatorDraft;
}

const KEY = 'wfrp4.roster.v1';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

export function rosterLoad(): RosterEntry[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Le roster localStorage n'est PAS un doc versionné (liste nue, sans `version`) — le renommage
    // CharKey→slugs (#311) s'applique donc en repli IDEMPOTENT à chaque lecture (aucun ancien token
    // restant après un 1er passage → no-op), plutôt que via `migrateDoc` (réservé au format `EXPORT_VERSION`).
    return (remapCharKeysDeep(arr) as unknown[]).filter(
      (e): e is RosterEntry =>
        !!e && typeof e === 'object' && typeof (e as RosterEntry).hero?.id === 'string',
    );
  } catch {
    return [];
  }
}

export function rosterAdd(entry: RosterEntry): void {
  save([...rosterLoad().filter((e) => e.hero.id !== entry.hero.id), entry]);
}

export function rosterRemove(heroId: string): void {
  save(rosterLoad().filter((e) => e.hero.id !== heroId));
}

/** Met à jour l'entrée roster d'un héros DÉJÀ présent (édition de bio en jeu) — n'AJOUTE pas un héros
 *  absent du roster (un prétiré édité ne s'y invite pas). Resynchronise aussi `draft` (motivation/ambitions)
 *  pour le round-trip créateur. */
export function rosterUpdate(hero: Combatant): void {
  const list = rosterLoad();
  const i = list.findIndex((e) => e.hero.id === hero.id);
  if (i < 0) return;
  const prev = list[i];
  const draft: CreatorDraft | undefined = prev.draft
    ? { ...prev.draft, motivation: hero.motivation ?? '', ambitionShort: hero.details?.ambitionShort ?? '', ambitionLong: hero.details?.ambitionLong ?? '' }
    : prev.draft;
  list[i] = { ...prev, hero, draft };
  save(list);
}

const EXPORT_KIND = 'wfrp4-hero';
export const EXPORT_VERSION = 2;

/** Migrations SÉQUENTIELLES de l'export roster. À CHAQUE bump d'`EXPORT_VERSION`, ajouter ici
 *  l'entrée `vN → vN+1` — sinon les exports antérieurs sont refusés (jamais acceptés en silence
 *  avec des champs manquants). Chaînée par `migrateDoc` (primitive générique, `migrateDoc.ts`). */
export const ROSTER_MIGRATIONS: MigrationMap = {
  // v1 → v2 : renommage CharKey → slugs pleins (#311) — même remap que `saves.ts` MIGRATIONS[2].
  1: (doc) => ({ ...doc, version: 2, hero: remapCharKeysDeep(doc.hero) }),
};

/** Sérialise un héros (avec sa Richesse) en chaîne portable — sauvegarde, transfert d'appareil,
 *  ou partage pour rejoindre la coop d'un ami. Format taggé pour une réimportation robuste. */
export function rosterExport(entry: RosterEntry): string {
  return JSON.stringify({ kind: EXPORT_KIND, v: EXPORT_VERSION, hero: entry.hero, wealth: entry.wealth }, null, 2);
}

/** Résultat de `rosterImport` : soit l'entrée reconstruite, soit un message d'erreur EXPLICITE
 *  (jamais un `null` muet) — l'appelant UI l'affiche tel quel. */
export type RosterImportResult = { entry: RosterEntry; error?: undefined } | { entry?: undefined; error: string };

/** Lit une chaîne `rosterExport` (ou un `RosterEntry` nu antérieur au tag `kind`/`v`) → `RosterEntry`,
 *  ou une erreur EXPLICITE si invalide. Passe par `migrateDoc` (chaîne `ROSTER_MIGRATIONS`) : un
 *  export `kind` différent, ou de version future/inconnue, est REFUSÉ avec un message dédié —
 *  jamais accepté en silence avec des champs manquants (le format `{ v }` du fil est normalisé en
 *  `version` pour la primitive générique). Richesse par défaut (0) si absente. */
export function rosterImport(str: string): RosterImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(str);
  } catch {
    return { error: t('picker.import.error') };
  }
  if (!parsed || typeof parsed !== 'object') return { error: t('picker.import.error') };
  const raw = parsed as { kind?: unknown; v?: unknown; version?: unknown };
  if (raw.kind !== undefined && raw.kind !== EXPORT_KIND) return { error: t('picker.import.error.version') };
  const normalized = { ...raw, version: typeof raw.v === 'number' ? raw.v : raw.version };
  const doc = migrateDoc(normalized, EXPORT_VERSION, ROSTER_MIGRATIONS);
  if (!doc) return { error: t('picker.import.error.version') };
  const hero = (doc as { hero?: { id?: unknown } }).hero;
  if (!hero || typeof hero !== 'object' || typeof hero.id !== 'string') return { error: t('picker.import.error') };
  const w = (doc as { wealth?: unknown }).wealth;
  const wealth: Money =
    w && typeof w === 'object' ? (w as Money) : { gold: 0, silver: 0, brass: 0 };
  return { entry: { hero: hero as unknown as Combatant, wealth } };
}

function save(list: RosterEntry[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}
