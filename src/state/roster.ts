import { Combatant } from '../engine/types';
import { Money } from '../engine/money';

/** Roster persistant (localStorage) des personnages créés via le créateur.
 *  Snapshot À LA CRÉATION : le héros tel que sorti de `buildHero`, plus sa
 *  Richesse initiale (créditée au groupe à la création, absente du Combatant —
 *  on la rejoue quand le personnage est repris dans un nouveau groupe). */
export interface RosterEntry {
  hero: Combatant;
  wealth: Money;
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

function save(list: RosterEntry[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}
