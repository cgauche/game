import { Combatant } from '../engine/types';
import { Money } from '../engine/money';
import type { CreatorDraft } from '../ui/creator/draft';

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
    return arr.filter(
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
const EXPORT_VERSION = 1;

/** Sérialise un héros (avec sa Richesse) en chaîne portable — sauvegarde, transfert d'appareil,
 *  ou partage pour rejoindre la coop d'un ami. Format taggé pour une réimportation robuste. */
export function rosterExport(entry: RosterEntry): string {
  return JSON.stringify({ kind: EXPORT_KIND, v: EXPORT_VERSION, hero: entry.hero, wealth: entry.wealth }, null, 2);
}

/** Lit une chaîne `rosterExport` (ou un `RosterEntry` nu) → `RosterEntry`, ou null si invalide.
 *  Réutilise la même garde que `rosterLoad` (hero.id chaîne) ; Richesse par défaut si absente. */
export function rosterImport(str: string): RosterEntry | null {
  try {
    const p = JSON.parse(str) as Partial<RosterEntry> & { hero?: { id?: unknown } };
    const hero = p?.hero;
    if (!hero || typeof hero !== 'object' || typeof hero.id !== 'string') return null;
    const w = (p as { wealth?: unknown }).wealth;
    const wealth: Money =
      w && typeof w === 'object' ? (w as Money) : { gold: 0, silver: 0, brass: 0 };
    return { hero: hero as unknown as Combatant, wealth };
  } catch {
    return null;
  }
}

function save(list: RosterEntry[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}
