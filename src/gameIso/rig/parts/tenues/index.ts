import { TENUE_DEFS } from './_registry.generated';
import { slugId } from '../../../../data/slug';
import { careers } from '../../../../data';
import type { TenueSet } from './types';
import type { StoredPalette } from '../../palette';

export type { TenueSet, TenueDef } from './types';

/**
 * Table des tenues DÉRIVÉE des seuls fichiers `defs/` (plus d'AUTO/MANUAL/merge). Ajouter une
 * tenue = déposer un fichier dans `defs/` (puis `npm run gen` hors dev). La taxonomie des classes
 * (careers.json) discrimine les archétypes de CLASSE (repli) des tenues SPÉCIFIQUES (par id) —
 * aucun flag `career` sur le def : la donnée des carrières est l'unique autorité.
 */
const CLASS_IDS = new Set((careers as Array<{ class: string }>).map((c) => c.class));
const isClassDef = (name: string): boolean => CLASS_IDS.has(slugId(name));

/** Tenues SPÉCIFIQUES (carrière / créature / PNJ / 'Nu') par id de tenue — lookup direct. */
export const TENUE_BY_ID: Record<string, TenueSet> = Object.fromEntries(
  TENUE_DEFS.filter((d) => !isClassDef(d.name)).map((d) => [slugId(d.name), d.set]),
);
/** Tenues d'ARCHÉTYPE DE CLASSE par id de classe — repli quand une carrière n'a pas de tenue dédiée. */
export const CLASS_TENUE_BY_ID: Record<string, TenueSet> = Object.fromEntries(
  TENUE_DEFS.filter((d) => isClassDef(d.name)).map((d) => [slugId(d.name), d.set]),
);
/** Palettes par défaut : tenue spécifique (par id) puis classe (par id de classe). */
export const TENUE_PALETTE_BY_ID: Record<string, StoredPalette> = Object.fromEntries(
  TENUE_DEFS.filter((d) => !isClassDef(d.name) && d.palette).map((d) => [slugId(d.name), d.palette!]),
);
export const CLASS_PALETTE_BY_ID: Record<string, StoredPalette> = Object.fromEntries(
  TENUE_DEFS.filter((d) => isClassDef(d.name) && d.palette).map((d) => [slugId(d.name), d.palette!]),
);
/** Tenue « nue » (corps de chair) — référencée à part par tenueFor pour le cas 'Nu'. */
export const TENUE_NUE: TenueSet = TENUE_BY_ID.nu;
/** Tenues qui ne chaussent pas (pied nu griffu), par id — SOURCE UNIQUE (plus de hardcode dans resolve). */
export const TENUE_BAREFOOT: ReadonlySet<string> = new Set(
  TENUE_DEFS.filter((d) => d.bareFoot).map((d) => slugId(d.name)),
);
/** Libellés des tenues SPÉCIFIQUES (sélecteur d'éditeur) — les archétypes de classe ne s'assignent pas à la main. */
export const SPECIFIC_TENUE_NAMES: string[] = TENUE_DEFS.filter((d) => !isClassDef(d.name)).map((d) => d.name);
